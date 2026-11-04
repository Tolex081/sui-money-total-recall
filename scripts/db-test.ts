import { readFile,readdir,mkdir,writeFile } from 'node:fs/promises';
import { randomUUID,randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { Temporal } from '@js-temporal/polyfill';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
const schema='test_'+randomUUID().replaceAll('-','');
const input=process.env.TEST_DATABASE_URL??process.env.DATABASE_URL;
if(!input)throw new Error('TEST_DATABASE_URL is required (or DATABASE_URL for an isolated disposable test schema).');
const connection=new URL(input);connection.searchParams.set('options','-c search_path='+schema);
process.env.DATABASE_URL=connection.toString();process.env.APP_ORIGIN='http://localhost:3000';process.env.MEMWAL_NAMESPACE_SECRET??=randomBytes(32).toString('base64url');
const admin=new Pool({connectionString:input,max:1,connectionTimeoutMillis:8000}),pool=new Pool({connectionString:connection.toString(),max:4,connectionTimeoutMillis:8000});
for(const connectionPool of [admin,pool])connectionPool.on('error',()=>console.error('An idle test database connection closed; the pool will reconnect.'));
const results:{test:string;passed:boolean}[]=[];
async function test(name:string,fn:()=>Promise<void>){await fn();results.push({test:name,passed:true});console.log('PASS '+name);}
const a=randomUUID(),b=randomUUID(),walletA=Ed25519Keypair.generate(),walletB=Ed25519Keypair.generate();
const usdc='0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
let applicationDb:Pool|undefined;
try{
  await admin.query('CREATE SCHEMA "'+schema+'"');
  await test('Empty PostgreSQL migrations through version 5',async()=>{for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>/^\d+.*\.sql$/.test(f)).sort())await pool.query(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));assert.equal((await pool.query('SELECT max(version) AS version FROM schema_migrations')).rows[0].version,5);});
  await pool.query('INSERT INTO profiles(id,wallet,namespace) VALUES($1,$2,$3),($4,$5,$6)',[a,walletA.toSuiAddress(),'test-a-'+a,b,walletB.toSuiAddress(),'test-b-'+b]);
  async function movement(id:string,delta:string,owner=a){await pool.query("INSERT INTO chain_movements(profile_id,id,digest,coin_type,delta,checkpoint,event_time,execution_status,operation,facts,source) VALUES($1,$2,$3,$4,$5,100,now(),'success','simple_transfer','{}','tatum')",[owner,id,'synthetic-database-test',usdc,delta]);}
  await movement('expense','-40000000');await movement('refund','15000000');await movement('other-expense','-40000000',b);
  await test('F07 PostgreSQL concurrent reimbursement allocations conserve capacity',async()=>{const outcomes=await Promise.allSettled([pool.query("INSERT INTO reimbursement_allocations(profile_id,id,source_id,target_id,amount,state) VALUES($1,$2,'refund','expense',10000000,'pending')",[a,randomUUID()]),pool.query("INSERT INTO reimbursement_allocations(profile_id,id,source_id,target_id,amount,state) VALUES($1,$2,'refund','expense',10000000,'pending')",[a,randomUUID()])]);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal((await pool.query('SELECT sum(amount)::text total FROM reimbursement_allocations WHERE profile_id=$1',[a])).rows[0].total,'10000000');});
  await test('Cross-profile allocation references rejected',async()=>{await assert.rejects(pool.query("INSERT INTO reimbursement_allocations(profile_id,id,source_id,target_id,amount,state) VALUES($1,$2,'refund','other-expense',1000000,'pending')",[a,randomUUID()]));});
  await test('Immutable chain facts and duplicate imports',async()=>{await assert.rejects(pool.query("UPDATE chain_movements SET delta=0 WHERE profile_id=$1 AND id='expense'",[a]));await assert.rejects(movement('expense','-40000000'));});
  const rule={id:'bill-rule',alias:'Test bill',amount:'50000000',category:'Home',startDate:'2026-11-01',frequency:'once',effectiveFrom:'2026-10-28'};
  await pool.query('INSERT INTO commitment_rules(profile_id,id,definition) VALUES($1,$2,$3)',[a,rule.id,rule]);
  await pool.query("INSERT INTO commitment_occurrences(profile_id,id,rule_id,scheduled_date,amount,definition) VALUES($1,'bill-rule:2026-11-01','bill-rule','2026-11-01',50000000,'{}')",[a]);
  await test('F07 commitment allocation race cannot spend one outflow twice',async()=>{const outcomes=await Promise.allSettled([pool.query("INSERT INTO commitment_allocations(profile_id,id,source_id,target_id,amount,checkpoint) VALUES($1,$2,'expense','bill-rule:2026-11-01',30000000,100)",[a,randomUUID()]),pool.query("INSERT INTO commitment_allocations(profile_id,id,source_id,target_id,amount,checkpoint) VALUES($1,$2,'expense','bill-rule:2026-11-01',30000000,100)",[a,randomUUID()])]);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);});
  await test('Sync page and cursor roll back together',async()=>{const db=await pool.connect();try{await db.query('BEGIN');await db.query("INSERT INTO sync_progress(profile_id,filter_version,cursor,coverage) VALUES($1,1,'test-cursor','{}')",[a]);await db.query('ROLLBACK');assert.equal((await pool.query('SELECT 1 FROM sync_progress WHERE profile_id=$1',[a])).rowCount,0);}finally{db.release();}});
  const auth=await import('../src/application/auth');const {database}=await import('../src/adapters/postgres/client');applicationDb=database();
  let signedSession:Awaited<ReturnType<typeof auth.verifyChallenge>>;
  await test('G09 valid wallet signature, durable single-use nonce and replay rejection',async()=>{const c=await auth.issueChallenge(walletA.toSuiAddress()),signature=await walletA.signPersonalMessage(new TextEncoder().encode(c.message));signedSession=await auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:signature.signature});await assert.rejects(auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:signature.signature}));});
  await test('Invalid signature and wrong wallet rejected',async()=>{const c=await auth.issueChallenge(walletA.toSuiAddress()),signature=await walletB.signPersonalMessage(new TextEncoder().encode(c.message));await assert.rejects(auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:signature.signature}));await assert.rejects(auth.verifyChallenge({id:c.id,wallet:walletB.toSuiAddress(),signature:signature.signature}));});
  await test('Expired nonce rejected',async()=>{const c=await auth.issueChallenge(walletA.toSuiAddress()),signature=await walletA.signPersonalMessage(new TextEncoder().encode(c.message));await pool.query("UPDATE auth_challenges SET expires_at=now()-interval '1 minute' WHERE id=$1",[c.id]);await assert.rejects(auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:signature.signature}));});
  await test('Concurrent nonce consumption succeeds only once',async()=>{const c=await auth.issueChallenge(walletA.toSuiAddress()),signature=await walletA.signPersonalMessage(new TextEncoder().encode(c.message));const outcomes=await Promise.allSettled([auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:signature.signature}),auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:signature.signature})]);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);});
  await test('Wrong app domain rejected',async()=>{const c=await auth.issueChallenge(walletA.toSuiAddress()),signature=await walletA.signPersonalMessage(new TextEncoder().encode(c.message));process.env.APP_ORIGIN='http://other.invalid';try{await assert.rejects(auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:signature.signature}));}finally{process.env.APP_ORIGIN='http://localhost:3000';}});
  await test('Wallet switch rejects a session for the previous address',async()=>{const req=new Request('http://localhost:3000/api/state',{headers:{cookie:'sm_session='+signedSession.sessionToken,'x-wallet-address':walletB.toSuiAddress()}});await assert.rejects(auth.authenticate(req));});
  await test('CSRF, missing session and revocation enforced',async()=>{const req=new Request('http://localhost:3000/api/plan',{headers:{cookie:'sm_session='+signedSession.sessionToken,'x-csrf-token':signedSession.csrf}});assert.equal((await auth.authenticate(req,true)).id,a);await assert.rejects(auth.authenticate(new Request(req.url,{headers:{cookie:'sm_session='+signedSession.sessionToken}}),true));await assert.rejects(auth.authenticate(new Request(req.url)));await auth.revoke(req);await assert.rejects(auth.authenticate(req));});
  await test('Optimistic plan edit rejects concurrent stale version',async()=>{const {savePlan}=await import('../src/application/commands');const profile=(await pool.query('SELECT * FROM profiles WHERE id=$1',[a])).rows[0];const input={endDate:Temporal.Now.plainDateISO('Africa/Lagos').add({days:10}).toString(),endKind:'income',reserve:'100',expectedIncome:null,timezone:'Africa/Lagos',version:0,consentVersion:'operator-managed-v1'};const outcomes=await Promise.allSettled([savePlan(profile,input),savePlan(profile,input)]);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);});
  await test('F19 unknown memory submission persists across calls and never resubmits',async()=>{const {newEvent,queueEvent}=await import('../src/application/commands');const {transaction}=await import('../src/adapters/postgres/client');const {advanceMemoryJob}=await import('../src/application/memory-jobs');const profile=(await pool.query('SELECT * FROM profiles WHERE id=$1',[b])).rows[0];await transaction(db=>queueEvent(db,profile,newEvent(profile,{kind:'planning_preference',logicalKey:'test-unknown',sourceRecordIds:[],expectedRevision:0,payload:{preference:'category',value:'Food'}}),0));let submits=0,recalls=0;const memory={submit:async()=>{submits++;throw Error('SIMULATED_RESPONSE_LOST_AFTER_ACCEPTANCE');},status:async()=>{throw Error('No known job id');},recallEvent:async()=>{recalls++;return [];}};assert.equal((await advanceMemoryJob(profile,memory)).state,'submission_outcome_unknown');assert.equal((await advanceMemoryJob(profile,memory)).state,'submission_outcome_unknown');assert.equal(submits,1);assert.equal(recalls,1);assert.equal((await pool.query('SELECT state,attempts FROM memory_jobs WHERE profile_id=$1',[b])).rows[0].attempts,1);assert.equal((await pool.query('SELECT activated_at FROM learned_events WHERE profile_id=$1',[b])).rows[0].activated_at,null);});
  await test('HTTP handlers reject cross-profile resource IDs, namespace injection and export leakage',async()=>{
    const routes=await import('../src/app/api/[...path]/route');
    const c=await auth.issueChallenge(walletA.toSuiAddress()),sig=await walletA.signPersonalMessage(new TextEncoder().encode(c.message));
    const session=await auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:sig.signature});
    await pool.query("UPDATE profiles SET consent_version='operator-managed-v1' WHERE id=$1",[a]);
    const foreign=(await pool.query('SELECT id,event_id FROM memory_jobs WHERE profile_id=$1',[b])).rows[0];
    const original=process.env.PERSONAL_ACCESS_ENABLED;process.env.PERSONAL_ACCESS_ENABLED='true';
    async function call(path:string,data?:unknown){const req=new Request('http://localhost:3000/api/'+path,{method:data===undefined?'GET':'POST',headers:{origin:'http://localhost:3000',cookie:'sm_session='+session.sessionToken,'x-csrf-token':session.csrf,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return data===undefined?routes.GET(req):routes.POST(req);}
    try{
      assert.equal((await call('memory-jobs/'+foreign.id)).status,404);
      assert.equal((await call('activity/other-expense/annotation',{category:'Food',note:'Shared meal',ownTransfer:false,rememberDestination:false,expectedRevision:0})).status,404);
      assert.equal((await call('reimbursements',{sourceId:'refund',targetId:'other-expense',amount:'1'})).status,404);
      assert.equal((await call('commitments/foreign-bill/allocate',{sourceId:'expense',amount:'1'})).status,404);
      assert.equal((await call('memories/'+foreign.event_id+'/deactivate',{reason:'Do not use this',expectedRevision:1})).status,404);
      assert.equal((await call('memories/'+foreign.event_id+'/correct',{expectedRevision:1,reverse:true})).status,404);
      assert.equal((await call('plan',{namespace:'forged-other-profile'})).status,400);
      const exported=await call('export');assert.equal(exported.status,200);const text=await exported.text();assert.equal(text.includes(walletB.toSuiAddress()),false);assert.equal(text.includes(foreign.event_id),false);assert.equal(text.includes('test-b-'+b),false);
      const state=await (await call('state?profileId='+b+'&namespace=forged')).json();assert.equal(state.profile.id,a);
    }finally{if(original===undefined)delete process.env.PERSONAL_ACCESS_ENABLED;else process.env.PERSONAL_ACCESS_ENABLED=original;}
  });
  await test('Read-only pilot allows payment labels only behind their flag and memory consent',async()=>{
    const routes=await import('../src/app/api/[...path]/route');
    const c=await auth.issueChallenge(walletA.toSuiAddress()),sig=await walletA.signPersonalMessage(new TextEncoder().encode(c.message));
    const session=await auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:sig.signature});
    await movement('label-expense','-12000000');
    await pool.query("UPDATE profiles SET consent_version='read-only-wallet-v1' WHERE id=$1",[a]);
    const saved={access:process.env.PERSONAL_ACCESS_ENABLED,read:process.env.PERSONAL_READ_ENABLED,labels:process.env.PERSONAL_LABELS_ENABLED};
    delete process.env.PERSONAL_ACCESS_ENABLED;process.env.PERSONAL_READ_ENABLED='true';delete process.env.PERSONAL_LABELS_ENABLED;
    async function call(path:string,data?:unknown){const req=new Request('http://localhost:3000/api/'+path,{method:data===undefined?'GET':'POST',headers:{origin:'http://localhost:3000',cookie:'sm_session='+session.sessionToken,'x-csrf-token':session.csrf,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return data===undefined?routes.GET(req):routes.POST(req);}
    const label={category:'Home',note:'Test rent',ownTransfer:false,rememberDestination:false,expectedRevision:0};
    try{
      assert.equal((await call('activity/label-expense/annotation',label)).status,503);
      process.env.PERSONAL_LABELS_ENABLED='true';
      assert.equal((await call('activity/label-expense/annotation',label)).status,409);
      assert.equal((await call('consent/memory',{accepted:true})).status,200);
      const queued=await call('activity/label-expense/annotation',label);assert.equal(queued.status,200);assert.equal((await queued.json()).state,'queued');
      assert.equal((await call('plan',{endDate:'2026-12-01'})).status,503);
      const state=await (await call('state')).json();assert.equal(state.memories.some((m:{envelope:{logicalKey:string}})=>m.envelope.logicalKey==='annotation:label-expense'),true);assert.equal(state.rules.length,0);
    }finally{for(const [key,name] of [['access','PERSONAL_ACCESS_ENABLED'],['read','PERSONAL_READ_ENABLED'],['labels','PERSONAL_LABELS_ENABLED']] as const){const value=saved[key];if(value===undefined)delete process.env[name];else process.env[name]=value;}}
  });
  await test('F20 expired confirmed context cannot generate future unpaid obligations',async()=>{
    const {newEvent,queueEvent,persistOccurrences}=await import('../src/application/commands');const {transaction}=await import('../src/adapters/postgres/client');const {accountState}=await import('../src/application/state');
    const profile=(await pool.query('SELECT * FROM profiles WHERE id=$1',[a])).rows[0],date=Temporal.Now.plainDateISO(profile.timezone).add({days:2}).toString();
    const event=newEvent(profile,{kind:'recurrence_confirmation',logicalKey:'expired-future',sourceRecordIds:[],expectedRevision:0,payload:{ruleId:'expired-rule',alias:'Expired context',amount:'1000000',category:'Other',nextDate:date,frequency:'weekly'}});
    await transaction(async db=>{const job=await queueEvent(db,profile,event,0);await db.query("UPDATE memory_jobs SET state='recall_confirmed',blob_id='synthetic-test-blob',recalled_at=now(),expires_at=now()-interval '1 day' WHERE profile_id=$1 AND id=$2",[a,job.jobId]);const rule={id:'expired-rule',alias:'Expired context',amount:'1000000',category:'Other',startDate:date,frequency:'weekly' as const,effectiveFrom:date,learnedEventId:event.eventId};await db.query('INSERT INTO commitment_rules(profile_id,id,definition,event_id) VALUES($1,$2,$3,$4)',[a,rule.id,rule,event.eventId]);await persistOccurrences(db,a,rule,Temporal.PlainDate.from(date).add({days:8}).toString());});
    const state=await accountState(profile);assert.equal(state.memories.find(m=>m.envelope.eventId===event.eventId)?.available,false);assert.equal(state.occurrences.some(o=>o.ruleId==='expired-rule'),false);
  });
  await test('F16 confirmed recurrence, correction and deactivation change only active future obligations',async()=>{
    const {newEvent,queueEvent}=await import('../src/application/commands');const {transaction}=await import('../src/adapters/postgres/client');const {accountState,summarize}=await import('../src/application/state');const {advanceMemoryJob}=await import('../src/application/memory-jobs');
    const id=randomUUID(),key=Ed25519Keypair.generate(),today=Temporal.Now.plainDateISO('Africa/Lagos'),next=today.add({days:1}).toString(),end=today.add({days:10}).toString();
    const profile=(await pool.query('INSERT INTO profiles(id,wallet,namespace) VALUES($1,$2,$3) RETURNING *',[id,key.toSuiAddress(),'projection-fixture-'+id])).rows[0];
    await pool.query("INSERT INTO plans(profile_id,end_date,end_kind,reserve,version) VALUES($1,$2,'planning',100000000,1)",[id,end]);
    await pool.query("INSERT INTO balance_observations(id,profile_id,usdc,sui,checkpoint,observed_at,metadata_version,source) VALUES($1,$2,500000000,0,100,now(),'isolated-fixture','tatum')",[randomUUID(),id]);
    // Deliberately synthetic adapter evidence: this tests projection transactions,
    // not signed Mainnet transport (covered by the independent live manifest).
    const fixture={submit:async()=>{throw Error('No writes allowed in projection fixture');},status:async()=>{throw Error('No remote job');},recallEvent:async(e:import('../src/domain/learning').LearnedEvent)=>[{blob_id:'fixture-'+e.eventId,text:JSON.stringify(e),distance:0}]};
    const first=newEvent(profile,{kind:'recurrence_confirmation',logicalKey:'projection-rule',sourceRecordIds:[],expectedRevision:0,payload:{ruleId:'projection-rule',alias:'Test recurring bill',amount:'20000000',category:'Other',nextDate:next,frequency:'weekly',origin:'manual'}});
    async function pending(event:typeof first,revision:number){await transaction(async db=>{const job=await queueEvent(db,profile,event,revision);await db.query("UPDATE memory_jobs SET state='submission_outcome_unknown' WHERE profile_id=$1 AND id=$2",[id,job.jobId]);});}
    async function remainder(){const state=await accountState(profile),result=summarize(state).plan;if(result.state!=='ready')throw Error('Fixture plan not ready');return {value:result.remainder,observedAt:state.balance!.observedAt};}
    await pending(first,0);const before=await remainder();assert.equal(before.value,400000000n);await advanceMemoryJob(profile,fixture);assert.equal((await remainder()).value,360000000n);
    const correction=newEvent(profile,{kind:'correction',logicalKey:first.logicalKey,sourceRecordIds:[],expectedRevision:1,supersedesEventId:first.eventId,payload:{targetKind:'recurrence',value:{ruleId:'projection-rule',alias:'Test recurring bill',amount:'15000000',category:'Other',nextDate:next,frequency:'weekly',origin:'manual'}}});
    await pending(correction,1);assert.equal((await remainder()).value,360000000n);await advanceMemoryJob(profile,fixture);assert.equal((await remainder()).value,370000000n);
    const deactivate=newEvent(profile,{kind:'deactivation',logicalKey:first.logicalKey,sourceRecordIds:[],expectedRevision:2,supersedesEventId:correction.eventId,payload:{reason:'Do not use this recurrence'}});await pending(deactivate,2);await advanceMemoryJob(profile,fixture);const after=await remainder();assert.equal(after.value,400000000n);assert.equal(after.observedAt,before.observedAt);assert.equal((await pool.query('SELECT id FROM learned_events WHERE profile_id=$1',[id])).rowCount,3);
  });
  // Milestone 1. MOCKED WALRUS: these use in-process stand-ins for MemWal. They prove ownership, read-only and lifecycle
  // rules in our code against real PostgreSQL; they are not evidence that Mainnet Walrus stores or returns anything.
  await test('M1 pilot Walrus recall (mocked Walrus): own namespace only, exact match required, read-only, rate-limited',async()=>{
    const {newEvent,queueEvent}=await import('../src/application/commands');const {transaction}=await import('../src/adapters/postgres/client');
    const {verifyMemoriesFromWalrus}=await import('../src/application/memory-recall');const {AppError}=await import('../src/lib/security');
    const routes=await import('../src/app/api/[...path]/route');
    await pool.query('DELETE FROM rate_limit_buckets');
    const profileA=(await pool.query('SELECT * FROM profiles WHERE id=$1',[a])).rows[0],profileB=(await pool.query('SELECT * FROM profiles WHERE id=$1',[b])).rows[0];
    async function confirmed(profile:typeof profileA,key:string,note:string){const event=newEvent(profile,{kind:'payment_explanation',logicalKey:key,sourceRecordIds:[],expectedRevision:0,payload:{movementId:key,category:'Other',note,ownTransfer:false}});await transaction(async db=>{const job=await queueEvent(db,profile,event,0);await db.query("UPDATE memory_jobs SET state='recall_confirmed',blob_id=$3,recalled_at=now() WHERE profile_id=$1 AND id=$2",[profile.id,job.jobId,'blob-'+event.eventId]);});return event;}
    const matched=await confirmed(profileA,'m1-recall-matched','Recall matched'),forged=await confirmed(profileA,'m1-recall-forged','Recall forged'),missing=await confirmed(profileA,'m1-recall-missing','Recall missing'),broken=await confirmed(profileA,'m1-recall-broken','Recall broken'),foreign=await confirmed(profileB,'m1-recall-other','Other profile');
    // The only thing the stand-in offers is event-level recall: touching anything else (such as listing) fails the test.
    const namespaces:string[]=[],answers=new Map<string,{text:string;blob_id:string}[]>([
      [matched.eventId,[{text:JSON.stringify(matched),blob_id:'blob-'+matched.eventId},{text:JSON.stringify(foreign),blob_id:'neighbour'}]],
      [forged.eventId,[{text:JSON.stringify({...forged,profileId:b}),blob_id:'forged'},{text:JSON.stringify({...forged,payload:{...forged.payload,note:'Tampered'}}),blob_id:'tampered'}]],
      [missing.eventId,[{text:JSON.stringify(foreign),blob_id:'neighbour'}]]]);
    const source=(namespace:string)=>{namespaces.push(namespace);return new Proxy({recallCandidates:async(eventId:string)=>{if(eventId===broken.eventId)throw Error('relayer down');return answers.get(eventId)??[];}},{get(target,prop){if(prop!=='recallCandidates'&&prop!=='then')throw Error('Recall used '+String(prop));return Reflect.get(target,prop);}});};
    const snapshot=async()=>JSON.stringify((await pool.query("SELECT (SELECT json_agg(t ORDER BY id) FROM learned_events t) e,(SELECT json_agg(t ORDER BY id) FROM memory_jobs t) j,(SELECT json_agg(t ORDER BY movement_id) FROM payment_annotations t) p,(SELECT json_agg(t ORDER BY id) FROM profiles t) pr,(SELECT json_agg(t ORDER BY id) FROM commitment_rules t) r,(SELECT json_agg(t ORDER BY id) FROM chain_movements t) m")).rows[0]);
    const before=await snapshot();
    const result=await verifyMemoriesFromWalrus(profileA,source);
    assert.deepEqual(namespaces,[profileA.namespace]);
    const by=(id:string)=>result.results.find(r=>r.eventId===id)!;
    assert.equal(by(matched.eventId).verdict,'matched');assert.equal((by(matched.eventId) as {blobId?:string}).blobId,'blob-'+matched.eventId);assert.equal((by(matched.eventId) as {remembered?:Record<string,unknown>}).remembered?.note,'Recall matched');
    assert.equal(by(forged.eventId).verdict,'failed_verification');assert.equal(by(missing.eventId).verdict,'not_returned');assert.equal(by(broken.eventId).verdict,'unavailable');
    assert.equal(result.results.some(r=>r.eventId===foreign.eventId),false);assert.equal(JSON.stringify(result).includes(b),false);assert.equal(JSON.stringify(result).includes(profileB.namespace),false);assert.equal(JSON.stringify(result).includes('neighbour'),false);
    assert.equal(await snapshot(),before,'Recall must not change memory, label, profile, rule or ledger rows');
    // Profile B, asking with its own session, gets only its own memory.
    const other=await verifyMemoriesFromWalrus(profileB,ns=>({recallCandidates:async()=>{assert.equal(ns,profileB.namespace);return [];}}));assert.deepEqual(other.results.map(r=>r.eventId),[foreign.eventId]);
    // Per-profile limit: profile A has used 1 of 3 recalls this minute.
    await verifyMemoriesFromWalrus(profileA,source);await verifyMemoriesFromWalrus(profileA,source);
    await assert.rejects(verifyMemoriesFromWalrus(profileA,source),(e:unknown)=>e instanceof AppError&&e.code==='RATE_LIMITED');
    // The route: unauthenticated callers are refused; the pilot gate applies; nothing in the request selects a namespace.
    const saved={access:process.env.PERSONAL_ACCESS_ENABLED,read:process.env.PERSONAL_READ_ENABLED,labels:process.env.PERSONAL_LABELS_ENABLED};
    const c=await auth.issueChallenge(walletA.toSuiAddress()),sig=await walletA.signPersonalMessage(new TextEncoder().encode(c.message)),session=await auth.verifyChallenge({id:c.id,wallet:walletA.toSuiAddress(),signature:sig.signature});
    const call=()=>routes.POST(new Request('http://localhost:3000/api/memories/recall',{method:'POST',headers:{origin:'http://localhost:3000',cookie:'sm_session='+session.sessionToken,'x-csrf-token':session.csrf,'content-type':'application/json'},body:JSON.stringify({namespace:profileB.namespace,profileId:b})}));
    try{delete process.env.PERSONAL_ACCESS_ENABLED;process.env.PERSONAL_READ_ENABLED='true';process.env.PERSONAL_LABELS_ENABLED='true';
      const anonymous=await routes.POST(new Request('http://localhost:3000/api/memories/recall',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({namespace:profileB.namespace,profileId:b})}));assert.equal(anonymous.status,401);
      delete process.env.PERSONAL_LABELS_ENABLED;assert.equal((await call()).status,503);}
    finally{for(const [key,name] of [['access','PERSONAL_ACCESS_ENABLED'],['read','PERSONAL_READ_ENABLED'],['labels','PERSONAL_LABELS_ENABLED']] as const){const value=saved[key];if(value===undefined)delete process.env[name];else process.env[name]=value;}}
  });
  await test('M1 payment-label correction (mocked Walrus): old label stays until the new revision is confirmed; failure keeps it; forget removes it',async()=>{
    const {annotate}=await import('../src/application/activity');const {advanceMemoryJob}=await import('../src/application/memory-jobs');const {accountState}=await import('../src/application/state');
    const {activeEvents,learnedEventSchema}=await import('../src/domain/learning');const {verifyMemoriesFromWalrus}=await import('../src/application/memory-recall');const {newEvent,queueEvent}=await import('../src/application/commands');const {transaction}=await import('../src/adapters/postgres/client');
    await pool.query('DELETE FROM rate_limit_buckets');
    await pool.query("UPDATE profiles SET consent_version='operator-managed-v1' WHERE id=$1",[a]);
    const profile=(await pool.query('SELECT * FROM profiles WHERE id=$1',[a])).rows[0];
    await movement('m1-lunch','-9000000');
    // Stand-in relayer: every write is accepted and stored; recall returns exactly what was stored, unless told to fail.
    const stored=new Map<string,string>();let failNext=false;
    const walrus={submit:async(e:import('../src/domain/learning').LearnedEvent)=>{stored.set('job-'+e.eventId,JSON.stringify(e));return {job_id:'job-'+e.eventId};},status:async(jobId:string)=>failNext?{status:'failed'}:{status:'done',blob_id:'blob-'+jobId},recallEvent:async(e:import('../src/domain/learning').LearnedEvent)=>{const text=stored.get('job-'+e.eventId);return text?[{blob_id:'blob-job-'+e.eventId,text,distance:0}]:[];}};
    const prev=process.env.MEMWAL_FREE_WRITES_CONFIRMED;process.env.MEMWAL_FREE_WRITES_CONFIRMED='true';
    // Isolation: jobs left pending by earlier tests on this profile would be advanced first (oldest first), so close them.
    await pool.query("UPDATE memory_jobs SET state='failed' WHERE profile_id=$1 AND state IN ('queued','submitting','accepted','saved','submission_outcome_unknown')",[a]);
    // Advance until this label's newest job settles, and report that job's state.
    async function settle(){for(let i=0;i<6;i++){await advanceMemoryJob(profile,walrus as never);const job=(await pool.query("SELECT j.state FROM memory_jobs j JOIN learned_events e ON e.profile_id=j.profile_id AND e.id=j.event_id WHERE j.profile_id=$1 AND e.logical_key='annotation:m1-lunch' ORDER BY e.revision DESC LIMIT 1",[a])).rows[0];if(['recall_confirmed','failed'].includes(job.state))return job.state;}return 'pending';}
    const label=async()=>(await accountState(profile)).annotations.find(x=>x.movementId==='m1-lunch')?.note;
    const latestActive=async()=>activeEvents((await accountState(profile)).memories,a).find(m=>m.envelope.logicalKey==='annotation:m1-lunch')?.envelope;
    try{
      await annotate(profile,'m1-lunch',{category:'Food',note:'Lunch',ownTransfer:false,rememberDestination:false,expectedRevision:0});
      assert.equal(await settle(),'recall_confirmed');assert.equal(await label(),'Lunch');const rev1=(await latestActive())!;assert.equal(rev1.revision,1);
      // Correction queued: Lunch stays in use until Walrus confirms Groceries.
      await annotate(profile,'m1-lunch',{category:'Groceries',note:'Groceries',ownTransfer:false,rememberDestination:false,expectedRevision:1,supersedesEventId:rev1.eventId});
      assert.equal(await label(),'Lunch');assert.equal((await latestActive())!.eventId,rev1.eventId);
      // The relayer reports the write failed: Lunch is still the label, revision 1 still active.
      await pool.query('DELETE FROM rate_limit_buckets');failNext=true;assert.equal(await settle(),'failed');failNext=false;
      assert.equal(await label(),'Lunch');assert.equal((await latestActive())!.eventId,rev1.eventId);
      const failed=(await pool.query("SELECT envelope FROM learned_events WHERE profile_id=$1 AND logical_key='annotation:m1-lunch' AND revision=2",[a])).rows[0].envelope;
      // Retry as a new revision that names the failed one; once confirmed it becomes the label and revision 1 is superseded.
      await pool.query('DELETE FROM rate_limit_buckets');
      await annotate(profile,'m1-lunch',{category:'Groceries',note:'Groceries',ownTransfer:false,rememberDestination:false,expectedRevision:2,supersedesEventId:failed.eventId});
      assert.equal(await settle(),'recall_confirmed');assert.equal(await label(),'Groceries');
      const rev3=(await latestActive())!;assert.equal(rev3.revision,3);assert.equal(rev3.supersedesEventId,failed.eventId);
      assert.equal(activeEvents((await accountState(profile)).memories,a).some(m=>m.envelope.eventId===rev1.eventId),false);
      // A stale correction (based on revision 1) is refused instead of overwriting the confirmed label.
      await assert.rejects(annotate(profile,'m1-lunch',{category:'Food',note:'Stale edit',ownTransfer:false,rememberDestination:false,expectedRevision:1,supersedesEventId:rev1.eventId}));
      // Fresh read-back: verification returns the corrected envelope and its place in the revision history.
      const check=await verifyMemoriesFromWalrus(profile,()=>({recallCandidates:async(id:string)=>{const text=stored.get('job-'+id);return text?[{text,blob_id:'blob-job-'+id}]:[];}}));
      const row=check.results.find(r=>r.logicalKey==='annotation:m1-lunch')!;assert.equal(row.verdict,'matched');assert.equal(row.revision,3);assert.equal((row as {remembered?:Record<string,unknown>}).remembered?.note,'Groceries');assert.deepEqual(row.supersedes,{eventId:failed.eventId,revision:2});assert.equal(row.supersessionConsistent,true);
      // Forget: a confirmed deactivation removes the label; the stored copies stay on Walrus.
      await pool.query('DELETE FROM rate_limit_buckets');
      await transaction(db=>queueEvent(db,profile,learnedEventSchema.parse(newEvent(profile,{kind:'deactivation',logicalKey:'annotation:m1-lunch',sourceRecordIds:[],expectedRevision:3,supersedesEventId:rev3.eventId,payload:{reason:'Forgotten by the user'}})),3));
      assert.equal(await settle(),'recall_confirmed');assert.equal(await label(),undefined);assert.equal(await latestActive(),undefined);
    }finally{if(prev===undefined)delete process.env.MEMWAL_FREE_WRITES_CONFIRMED;else process.env.MEMWAL_FREE_WRITES_CONFIRMED=prev;}
  });
  console.log('All real PostgreSQL tests passed in an isolated disposable schema.');
}catch(error){console.error('Database test failed:',error instanceof Error?error.message:'unknown');process.exitCode=1;}
finally{
  await applicationDb?.end();await pool.end();
  // Generated test schema is the sole destructive target; no public/application table is dropped.
  if(!/^test_[0-9a-f]{32}$/.test(schema))throw Error('Invalid cleanup schema');
  await admin.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await admin.end();
  await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/db-tests.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:['localhost','127.0.0.1','::1'].includes(new URL(input).hostname)?'local-postgresql-isolated-schema':'authenticated-hosted-postgresql-isolated-schema',tests:results,complete:!process.exitCode},null,2));
}
