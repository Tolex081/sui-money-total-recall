// Read-only Walrus audit: never invokes remember, renew or transfer methods.
import { mkdir,writeFile } from 'node:fs/promises';
import { database } from '../src/adapters/postgres/client';
import { WalrusMemory,enumerateMetadata } from '../src/adapters/memwal/memory';
import { learnedEventSchema } from '../src/domain/learning';
import { required } from '../src/lib/config';
const db=database(),namespace=required('MEMWAL_NAMESPACE_DEMO'),memory=new WalrusMemory(namespace);
try {
  const metadata=await enumerateMetadata(c=>memory.metadataPage(c));
  const jobs=(await db.query('SELECT event_id,envelope,state,remote_job_id,blob_id,recalled_at FROM operator_seed_jobs WHERE namespace=$1 ORDER BY event_id',[namespace])).rows;
  if(jobs.length!==24)throw Error('Expected the exact approved 24-event batch.');
  const memories=[];
  for(const j of jobs){
    const event=learnedEventSchema.parse(j.envelope),meta=metadata.find(m=>m.blob_id===j.blob_id);
    const matches=await memory.recallEvent(event),matched=matches.some(m=>m.blob_id===j.blob_id);
    const expiresAt=meta?.expires_at??null,available=meta?.status==='active'&&(!expiresAt||new Date(expiresAt)>new Date());
    memories.push({eventId:j.event_id,envelope:event,state:j.state,jobId:j.remote_job_id,blobId:j.blob_id,recalledAt:matched?new Date().toISOString():j.recalled_at,matchingRecall:matched,stored:!!meta,storageStatus:meta?.status??'not_listed',expiresAt,endEpoch:meta?.end_epoch??null,available});
  }
  const count=new Set(memories.filter(m=>m.state==='recall_confirmed'&&m.matchingRecall&&m.available).map(m=>m.blobId)).size;
  const report={checkedAt:new Date().toISOString(),network:'mainnet',provenance:'synthetic_demo',audit:'read_only_existing_approved_batch',confirmedActiveStoredCount:count,target:24,minimum:15,complete:count===24,retentionTarget:'2026-11-30T23:59:59Z',retentionVerified:memories.every(m=>m.expiresAt&&new Date(m.expiresAt)>=new Date('2026-11-30T23:59:59Z')),memories};
  await db.query("INSERT INTO public_proof(id,payload,checked_at) VALUES('seed',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,checked_at=now()",[report]);
  await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/seed-mainnet.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({confirmed:count,retentionVerified:report.retentionVerified,missingExpiry:memories.filter(m=>!m.expiresAt).map(m=>m.eventId)}));
}finally{await db.end();}
