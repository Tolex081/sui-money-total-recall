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
const admin=new Pool({connectionString:input,max:1}),pool=new Pool({connectionString:connection.toString(),max:4});
const results:{test:string;passed:boolean}[]=[];
async function test(name:string,fn:()=>Promise<void>){await fn();results.push({test:name,passed:true});console.log('PASS '+name);}
const a=randomUUID(),b=randomUUID(),walletA=Ed25519Keypair.generate(),walletB=Ed25519Keypair.generate();
const usdc='0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
let applicationDb:Pool|undefined;
try{
  await admin.query('CREATE SCHEMA "'+schema+'"');
  await test('Empty PostgreSQL migrations through version 3',async()=>{for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>/^\d+.*\.sql$/.test(f)).sort())await pool.query(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));assert.equal((await pool.query('SELECT max(version) AS version FROM schema_migrations')).rows[0].version,3);});
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
  await test('F20 expired confirmed context cannot generate future unpaid obligations',async()=>{
    const {newEvent,queueEvent,persistOccurrences}=await import('../src/application/commands');const {transaction}=await import('../src/adapters/postgres/client');const {accountState}=await import('../src/application/state');
    const profile=(await pool.query('SELECT * FROM profiles WHERE id=$1',[a])).rows[0],date=Temporal.Now.plainDateISO(profile.timezone).add({days:2}).toString();
    const event=newEvent(profile,{kind:'recurrence_confirmation',logicalKey:'expired-future',sourceRecordIds:[],expectedRevision:0,payload:{ruleId:'expired-rule',alias:'Expired context',amount:'1000000',category:'Other',nextDate:date,frequency:'weekly'}});
    await transaction(async db=>{const job=await queueEvent(db,profile,event,0);await db.query("UPDATE memory_jobs SET state='recall_confirmed',blob_id='synthetic-test-blob',recalled_at=now(),expires_at=now()-interval '1 day' WHERE profile_id=$1 AND id=$2",[a,job.jobId]);const rule={id:'expired-rule',alias:'Expired context',amount:'1000000',category:'Other',startDate:date,frequency:'weekly' as const,effectiveFrom:date,learnedEventId:event.eventId};await db.query('INSERT INTO commitment_rules(profile_id,id,definition,event_id) VALUES($1,$2,$3,$4)',[a,rule.id,rule,event.eventId]);await persistOccurrences(db,a,rule,Temporal.PlainDate.from(date).add({days:8}).toString());});
    const state=await accountState(profile);assert.equal(state.memories.find(m=>m.envelope.eventId===event.eventId)?.available,false);assert.equal(state.occurrences.some(o=>o.ruleId==='expired-rule'),false);
  });
  console.log('All real PostgreSQL tests passed in an isolated disposable schema.');
}catch(error){console.error('Database test failed:',error instanceof Error?error.message:'unknown');process.exitCode=1;}
finally{
  await applicationDb?.end();await pool.end();
  // Generated test schema is the sole destructive target; no public/application table is dropped.
  if(!/^test_[0-9a-f]{32}$/.test(schema))throw Error('Invalid cleanup schema');
  await admin.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await admin.end();
  await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/db-tests.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'authenticated-neon-postgresql-isolated-schema',tests:results,complete:!process.exitCode},null,2));
}
