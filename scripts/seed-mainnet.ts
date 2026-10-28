import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { database } from '../src/adapters/postgres/client';
import { WalrusMemory,enumerateMetadata } from '../src/adapters/memwal/memory';
import { seedEvents } from '../src/domain/seed';
import { learnedEventSchema } from '../src/domain/learning';
import { demoState } from '../src/adapters/mock/demo';
import { summarize } from '../src/domain/summary';
import { consumeLimits } from '../src/lib/rate-limit';
import { required } from '../src/lib/config';
if(!process.argv.includes('--write')){console.error('No write performed. Use --write only after confirming sponsored Mainnet writes.');process.exit(1);}
if(process.env.VERCEL_ENV==='preview')throw Error('Preview cannot seed production memories.');
const db=database(),namespace=required('MEMWAL_NAMESPACE_DEMO'),memory=new WalrusMemory(namespace);
if(process.env.MEMWAL_FREE_WRITES_CONFIRMED!=='true')throw Error('FREE_WRITE_ENTITLEMENT_UNCONFIRMED');
const state=demoState(),summary=summarize(state);assert.equal(summary.plan.state,'ready');assert.equal(state.movements.every(m=>m.source==='synthetic'&&m.digest===null),true);assert.equal(seedEvents(new Date().toISOString()).length,24);
try{
  for(const event of seedEvents(new Date().toISOString()))await db.query("INSERT INTO operator_seed_jobs(namespace,event_id,envelope,state) VALUES($1,$2,$3,'queued') ON CONFLICT(namespace,event_id) DO NOTHING",[namespace,event.eventId,event]);
  await db.query("UPDATE operator_seed_jobs SET state='submission_outcome_unknown',error_code='PROCESS_INTERRUPTED' WHERE namespace=$1 AND state='submitting' AND updated_at<now()-interval '1 minute'",[namespace]);
  const queued=(await db.query("SELECT * FROM operator_seed_jobs WHERE namespace=$1 AND state='queued' ORDER BY envelope->>'recordedAt',event_id LIMIT 4",[namespace])).rows;
  for(const row of queued){
    try{await consumeLimits([{key:'memory:write:global',max:4,seconds:60}]);}catch{console.log('Write allowance reached; progress is durable. Resume after the minute window.');break;}
    const event=learnedEventSchema.parse(row.envelope);
    await db.query("UPDATE operator_seed_jobs SET state='submitting',updated_at=now() WHERE namespace=$1 AND event_id=$2",[namespace,row.event_id]);
    try{const result=await memory.submit(event);await db.query("UPDATE operator_seed_jobs SET state='accepted',remote_job_id=$3,updated_at=now() WHERE namespace=$1 AND event_id=$2",[namespace,row.event_id,result.job_id]);console.log('Accepted '+row.event_id);}
    catch{await db.query("UPDATE operator_seed_jobs SET state='submission_outcome_unknown',error_code='SUBMISSION_OUTCOME_UNKNOWN',updated_at=now() WHERE namespace=$1 AND event_id=$2",[namespace,row.event_id]);console.log('Unknown submission outcome; automatic resubmit blocked for '+row.event_id);break;}
  }
  const pending=(await db.query("SELECT * FROM operator_seed_jobs WHERE namespace=$1 AND state IN('accepted','saved','submission_outcome_unknown') ORDER BY updated_at LIMIT 8",[namespace])).rows;
  for(const row of pending){
    const event=learnedEventSchema.parse(row.envelope);
    if(row.remote_job_id){const job=await memory.status(row.remote_job_id);if(job.status==='failed'){await db.query("UPDATE operator_seed_jobs SET state='failed',error_code='REMOTE_FAILED',updated_at=now() WHERE namespace=$1 AND event_id=$2",[namespace,row.event_id]);continue;}if(job.status!=='done'||!job.blob_id)continue;await db.query("UPDATE operator_seed_jobs SET state='saved',blob_id=$3,updated_at=now() WHERE namespace=$1 AND event_id=$2",[namespace,row.event_id,job.blob_id]);row.blob_id=job.blob_id;}
    const matches=await memory.recallEvent(event);const matching=matches.find(m=>!row.blob_id||m.blob_id===row.blob_id);
    if(matching)await db.query("UPDATE operator_seed_jobs SET state='recall_confirmed',blob_id=$3,recalled_at=now(),updated_at=now(),error_code=NULL WHERE namespace=$1 AND event_id=$2",[namespace,row.event_id,matching.blob_id]);
  }
  const metadata=await enumerateMetadata(c=>memory.metadataPage(c));
  const jobs=(await db.query('SELECT event_id,envelope,state,remote_job_id,blob_id,recalled_at FROM operator_seed_jobs WHERE namespace=$1 ORDER BY event_id',[namespace])).rows;
  const manifest=jobs.map(j=>{const meta=metadata.find(m=>m.blob_id===j.blob_id);const expired=!!meta?.expires_at&&new Date(meta.expires_at)<=new Date();return {eventId:j.event_id,envelope:j.envelope,state:j.state,jobId:j.remote_job_id,blobId:j.blob_id,recalledAt:j.recalled_at,stored:!!meta,storageStatus:meta?.status??'not_listed',expiresAt:meta?.expires_at??null,endEpoch:meta?.end_epoch??null,available:!!meta&&!expired};});
  const confirmed=[...new Set(manifest.filter(m=>m.state==='recall_confirmed'&&m.stored&&m.available).map(m=>m.blobId))];
  const report={checkedAt:new Date().toISOString(),network:'mainnet',provenance:'synthetic_demo',confirmedActiveStoredCount:confirmed.length,target:24,minimum:15,complete:confirmed.length>=24,retentionTarget:'2026-11-30T23:59:59Z',retentionVerified:manifest.length===24&&manifest.every(m=>m.expiresAt&&new Date(m.expiresAt)>=new Date('2026-11-30T23:59:59Z')),memories:manifest};
  await db.query("INSERT INTO public_proof(id,payload,checked_at) VALUES('seed',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,checked_at=now()",[report]);
  await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/seed-mainnet.json',JSON.stringify(report,null,2));
  console.log(`Confirmed distinct stored seed memories: ${confirmed.length}/24. Resume accepted jobs; no completed event is written again.`);
}finally{await db.end();}
