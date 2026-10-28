import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { database,transaction } from '@/adapters/postgres/client';
import { authenticate,issueChallenge,verifyChallenge,revoke,sessionCookie,CONSENT_VERSION } from '@/application/auth';
import { accountState,summarize } from '@/application/state';
import { savePlan,saveCommitment,newEvent,queueEvent,rememberReserve,reverseCommitmentAllocation } from '@/application/commands';
import { annotate,reimbursement,allocateCommitment,decideSuggestion,destinationRule,correctMemory } from '@/application/activity';
import { advanceMemoryJob,refreshRecall } from '@/application/memory-jobs';
import { syncWallet } from '@/application/sync';
import { consumeLimits } from '@/lib/rate-limit';
import { AppError,assertSameOrigin,hash } from '@/lib/security';
import { appMode,configurationStatus } from '@/lib/config';
import { safeText } from '@/domain/learning';
import { weeklySuggestions } from '@/domain/recurrence';
import { demoState,demoComparison } from '@/adapters/mock/demo';

export const runtime='nodejs';
export const dynamic='force-dynamic';
function json(value:unknown,status=200) {return new NextResponse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
async function body(request:Request) {
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('CONTENT_TYPE',415,'Use JSON for this request.');
  const reader=request.body?.getReader();if(!reader)throw new AppError('BODY_REQUIRED',400,'Request body required.');
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();throw new AppError('BODY_TOO_LARGE',413,'Keep this request under 16 KB.');}chunks.push(value);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError('INVALID_JSON',400,'Malformed JSON body.');}
}
async function proof() {
  const base={mode:appMode(),network:'Sui Mainnet only',build:process.env.BUILD_SOURCE_REVISION||process.env.VERCEL_GIT_COMMIT_SHA||'local-uncommitted',tatum:{state:'not_verified'},walrus:{state:'not_verified',confirmedDemoMemories:0},deployment:{state:'not_verified'},checkedAt:null};
  if(!process.env.DATABASE_URL)return base;
  try{const rows=(await database().query('SELECT id,payload,checked_at FROM public_proof')).rows;const integration=rows.find(r=>r.id==='integrations')?.payload,seed=rows.find(r=>r.id==='seed')?.payload;return {...base,tatum:integration?.tatum??base.tatum,walrus:{...(integration?.walrus??base.walrus),confirmedDemoMemories:seed?.confirmedActiveStoredCount??0,retentionVerified:seed?.retentionVerified??false},deployment:integration?{state:'runtime_verified',runtime:integration.runtime,checkedAt:integration.checkedAt,commit:integration.commit}:base.deployment,evidence:rows.map(r=>({id:r.id,...r.payload,checkedAt:r.checked_at}))};}catch{return {...base,database:{state:'unavailable'}};}
}
async function handle(request:Request) {
  const path=new URL(request.url).pathname.replace(/^\/api\//,'');const method=request.method;
  appMode();
  if(method==='GET'&&path==='health')return json({mode:appMode(),status:'application_reachable',dependencies:configurationStatus(),liveIntegrationVerified:false});
  if(method==='GET'&&path==='proof')return json(await proof());
  if(path==='demo'||path.startsWith('demo/')){
    if(method!=='GET')throw new AppError('READ_ONLY',405,'The public demo is read-only.');
    if(!['demo','demo/state','demo/learning-comparison','demo/memories'].includes(path))throw new AppError('NOT_FOUND',404,'Demo route not found.');
    if(path==='demo/learning-comparison')return json(demoComparison());
    if(path==='demo/memories'){
      if(!process.env.DATABASE_URL)return json({memories:[],state:'not_seeded',reason:'Mainnet memory proof is not available.'});
      const seed=(await database().query("SELECT payload,checked_at FROM public_proof WHERE id='seed'")).rows[0];
      if(!seed)return json({memories:[],state:'not_seeded',reason:'Mainnet memory proof is not available.'});
      const memories=(seed.payload.memories??[]).filter((m:{envelope?:{provenance?:string;profileId?:string}})=>m.envelope?.provenance==='synthetic_demo'&&m.envelope?.profileId==='synthetic-demo').map((m:{envelope:unknown;state:string;blobId:string|null;recalledAt:string|null;available:boolean})=>({envelope:m.envelope,state:m.state,blobId:m.blobId,recalledAt:m.recalledAt,available:m.available}));
      return json({memories,state:'cached_signed_evidence',confirmedActiveStoredCount:seed.payload.confirmedActiveStoredCount,checkedAt:seed.checked_at,reason:'Cached signed recall evidence for synthetic Mainnet seed records; fictional finance replay remains separate.'});
    }
    return json(demoState());
  }
  const identityOnly=['auth/challenge','auth/verify','auth/logout','account'].includes(path);
  if(process.env.PERSONAL_ACCESS_ENABLED==='false'&&!identityOnly)throw new AppError('RELEASE_GATE',503,'Personal financial screens are gated while mandatory live verification is completed. Wallet identity verification, the read-only demo and proof remain available.');
  if(method==='POST')assertSameOrigin(request);
  if(method==='POST'&&path==='auth/challenge'){
    const data=z.object({wallet:z.string().max(80)}).strict().parse(await body(request));
    await consumeLimits([{key:'auth:global',max:40,seconds:60},{key:'auth:wallet:'+hash(data.wallet),max:5,seconds:60}]);
    return json(await issueChallenge(data.wallet));
  }
  if(method==='POST'&&path==='auth/verify'){
    await consumeLimits([{key:'auth:verify:global',max:40,seconds:60}]);
    const data=z.object({id:z.uuid(),wallet:z.string().max(80),signature:z.string().max(12000)}).strict().parse(await body(request));
    const result=await verifyChallenge(data,sessionCookie(request));const response=json({profile:{wallet:result.profile.wallet,timezone:result.profile.timezone,consentVersion:result.profile.consent_version},csrf:result.csrf});
    const secure=new URL(request.url).protocol==='https:';
    response.cookies.set('sm_session',result.sessionToken,{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge:604800});
    response.cookies.set('sm_csrf',result.csrf,{httpOnly:false,secure,sameSite:'strict',path:'/',maxAge:604800});return response;
  }
  const profile=await authenticate(request,method==='POST',path==='auth/logout');
  if(method==='POST'&&path==='auth/logout'){await revoke(request);const response=json({signedOut:true});response.cookies.delete('sm_session');response.cookies.delete('sm_csrf');return response;}
  if(method==='GET'&&path==='account')return json({wallet:profile.wallet,timezone:profile.timezone,consentVersion:profile.consent_version});
  if(method==='POST'&&path==='plan')return json(await savePlan(profile,await body(request)));
  if(method==='POST'&&profile.consent_version!==CONSENT_VERSION)throw new AppError('CONSENT_REQUIRED',409,'Review the operator-managed memory terms and save your plan to continue.');
  if(method==='POST'&&path==='commitments')return json(await saveCommitment(profile,await body(request)));
  if(method==='POST'&&path==='preferences/reserve')return json(await rememberReserve(profile,await body(request)));
  if(method==='POST'&&/^commitment-allocations\/[^/]+\/reverse$/.test(path))return json(await reverseCommitmentAllocation(profile,decodeURIComponent(path.split('/')[1])));
  if(method==='POST'&&path==='sync'){const input=z.object({kind:z.enum(['balances','history'])}).strict().parse(await body(request));return json(await syncWallet(profile,input.kind));}
  if(method==='POST'&&/^activity\/[^/]+\/annotation$/.test(path))return json(await annotate(profile,decodeURIComponent(path.split('/')[1]),await body(request)));
  if(method==='POST'&&path==='destination-rules')return json(await destinationRule(profile,await body(request)));
  if(method==='POST'&&path==='reimbursements')return json(await reimbursement(profile,await body(request)));
  if(method==='POST'&&/^commitments\/[^/]+\/allocate$/.test(path))return json(await allocateCommitment(profile,decodeURIComponent(path.split('/')[1]),await body(request)));
  if(method==='POST'&&/^suggestions\/[^/]+\/decision$/.test(path))return json(await decideSuggestion(profile,decodeURIComponent(path.split('/')[1]),await body(request)));
  if(method==='POST'&&/^memories\/[^/]+\/correct$/.test(path))return json(await correctMemory(profile,decodeURIComponent(path.split('/')[1]),await body(request)));
  if(method==='POST'&&path==='memory-jobs/advance')return json(await advanceMemoryJob(profile));
  if(method==='POST'&&path==='memories/recall')return json(await refreshRecall(profile));
  if(method==='POST'&&/^memories\/[^/]+\/deactivate$/.test(path)){
    const id=decodeURIComponent(path.split('/')[1]);const data=z.object({reason:safeText,expectedRevision:z.number().int().positive()}).strict().parse(await body(request));
    return json(await transaction(async db=>{const prior=(await db.query('SELECT envelope FROM learned_events WHERE profile_id=$1 AND id=$2',[profile.id,id])).rows[0];if(!prior)throw new AppError('NOT_FOUND',404,'Memory not found.');return queueEvent(db,profile,newEvent(profile,{kind:'deactivation',logicalKey:prior.envelope.logicalKey,sourceRecordIds:prior.envelope.sourceRecordIds,expectedRevision:data.expectedRevision,supersedesEventId:id,payload:{reason:data.reason}}),data.expectedRevision);}));
  }
  if(method==='GET'&&/^memory-jobs\/[^/]+$/.test(path)){const job=(await database().query('SELECT id,event_id,state,blob_id,error_code,recalled_at,expires_at FROM memory_jobs WHERE profile_id=$1 AND id::text=$2',[profile.id,path.split('/')[1]])).rows[0];if(!job)throw new AppError('NOT_FOUND',404,'Memory job not found.');return json(job);}
  if(method==='GET'&&['state','today','balances','activity','plan','memories','learning-comparison','export','suggestions'].includes(path)) {
    const state=await accountState(profile);
    if(path==='balances')return json({balance:state.balance});
    if(path==='today')return json({...summarize(state),balance:state.balance,coverage:state.coverage});
    if(path==='plan')return json({plan:state.plan,rules:state.rules,occurrences:state.occurrences,allocations:state.commitmentAllocations});
    if(path==='activity'){
      const url=new URL(request.url);const offset=z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('offset')??0);
      return json({movements:state.movements.slice(offset,offset+25),annotations:state.annotations,coverage:state.coverage,nextOffset:offset+25<state.movements.length?offset+25:null});
    }
    if(path==='memories')return json({memories:state.memories,memoryStatus:state.memoryStatus});
    if(path==='suggestions'){const reviewed=new Set(state.memories.filter(m=>m.state==='recall_confirmed').map(m=>m.envelope.logicalKey));return json({suggestions:weeklySuggestions(state.movements,state.annotations,profile.timezone).filter(s=>!reviewed.has('suggestion:'+s.id.slice(0,100)))});}
    if(path==='learning-comparison'){const learned=state.memories.filter(m=>m.state==='recall_confirmed').map(m=>m.envelope.eventId);return json({hypothetical:true,withMemory:summarize(state),withoutSelectedLearnedRules:summarize(state,learned),observedAt:state.balance?.observedAt,eventIds:learned});}
    if(path==='export')return json({schemaVersion:1,exportedAt:new Date().toISOString(),...state});
    return json(state);
  }
  throw new AppError('NOT_FOUND',404,'Route not found.');
}
async function safeHandle(request:Request){
  const requestId=randomUUID();
  try{return await handle(request);}catch(error){
    if(error instanceof AppError)return json({error:{code:error.code,message:error.message,retryable:error.retryable,requestId}},error.status);
    if(error instanceof z.ZodError)return json({error:{code:'VALIDATION',message:error.issues.map(i=>i.message).join(' '),retryable:false,requestId}},400);
    const code=error instanceof Error&&error.message.startsWith('CONFIG_MISSING:')?'CONFIGURATION_REQUIRED':(error as {code?:string})?.code==='23505'?'VERSION_CONFLICT':(error as {code?:string})?.code==='P0001'?'ALLOCATION_REJECTED':'DEPENDENCY_UNAVAILABLE';
    return json({error:{code,message:code==='CONFIGURATION_REQUIRED'?'Application setup is incomplete. No live data has been substituted.':code==='VERSION_CONFLICT'?'Another edit is pending or already saved. Refresh and review.':code==='ALLOCATION_REJECTED'?'The payment is ineligible or would exceed an allocation limit.':'A required service is unavailable. Your last confirmed data remains unchanged.',retryable:code==='DEPENDENCY_UNAVAILABLE',requestId}},code==='VERSION_CONFLICT'?409:code==='ALLOCATION_REJECTED'?400:503);
  }
}
export const GET=safeHandle;
export const POST=safeHandle;
