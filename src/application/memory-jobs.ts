import { database, transaction } from '@/adapters/postgres/client';
import { WalrusMemory,enumerateMetadata } from '@/adapters/memwal/memory';
import { learnedEventSchema, type LearnedEvent } from '@/domain/learning';
import { assertAllocationPayment } from './eligibility';
import { persistOccurrences } from './commands';
import { consumeLimits } from '@/lib/rate-limit';
import { AppError,destinationId } from '@/lib/security';
import { localToday } from '@/domain/planning';
import { USDC_TYPE } from '@/domain/money';
import type { Profile } from './auth';
import type { CommitmentRule } from '@/domain/types';
import { Temporal } from '@js-temporal/polyfill';

async function applyEvent(profile:Profile,event:LearnedEvent,jobId:string,blobId:string) {
  await transaction(async db=>{
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
    const job=(await db.query('SELECT * FROM memory_jobs WHERE profile_id=$1 AND id=$2 FOR UPDATE',[profile.id,jobId])).rows[0];
    if(!job || job.state==='recall_confirmed') return;
    const latest=(await db.query('SELECT revision FROM learned_events WHERE profile_id=$1 AND logical_key=$2 ORDER BY revision DESC LIMIT 1',[profile.id,event.logicalKey])).rows[0];
    if(latest?.revision!==event.revision) throw new AppError('VERSION_CONFLICT',409,'A newer event exists.');
    if(event.kind==='own_destination_rule'&&event.payload.ownTransfer){
      const allocated=(await db.query(`SELECT m.counterparty,m.event_time FROM chain_movements m WHERE m.profile_id=$1 AND m.coin_type=$2 AND m.delta<0 AND NOT EXISTS(SELECT 1 FROM payment_annotations p WHERE p.profile_id=m.profile_id AND p.movement_id=m.id) AND (EXISTS(SELECT 1 FROM commitment_allocations a WHERE a.profile_id=m.profile_id AND a.source_id=m.id AND a.state='active') OR EXISTS(SELECT 1 FROM reimbursement_allocations a WHERE a.profile_id=m.profile_id AND a.target_id=m.id AND a.state IN('pending','active')))`,[profile.id,USDC_TYPE])).rows;
      if(allocated.some(m=>m.counterparty&&destinationId(profile.id,m.counterparty)===event.payload.destinationId&&localToday(new Date(m.event_time).toISOString(),profile.timezone)>=event.effectiveFrom))throw new AppError('ALLOCATION_CONFLICT',409,'Reverse matching allocations before activating this own-transfer rule.');
    }
    const annotation=event.kind==='payment_explanation'?event.payload:event.kind==='correction'&&event.payload.targetKind==='annotation'?event.payload.value:null;
    if(annotation) {
      if(annotation.ownTransfer && (await db.query(`SELECT 1 FROM reimbursement_allocations WHERE profile_id=$1 AND (target_id=$2 OR source_id=$2) AND state IN('active','pending') UNION ALL SELECT 1 FROM commitment_allocations WHERE profile_id=$1 AND source_id=$2 AND state='active'`,[profile.id,annotation.movementId])).rowCount) throw new AppError('ALLOCATION_CONFLICT',409,'Reverse existing allocations before classifying this payment as an own transfer.');
      await db.query(`INSERT INTO payment_annotations(profile_id,movement_id,event_id,revision,category,note,own_transfer) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(profile_id,movement_id) DO UPDATE SET event_id=$3,revision=$4,category=$5,note=$6,own_transfer=$7`,[profile.id,annotation.movementId,event.eventId,event.revision,annotation.category,annotation.note,annotation.ownTransfer]);
    }
    const recurrence=event.kind==='recurrence_confirmation'?event.payload:event.kind==='correction'&&event.payload.targetKind==='recurrence'?event.payload.value:null;
    if(recurrence) {
      if(recurrence.associateRuleId) {
        const existing=(await db.query('SELECT * FROM commitment_rules WHERE profile_id=$1 AND id=$2',[profile.id,recurrence.associateRuleId])).rows[0];
        if(!existing) throw new AppError('NOT_FOUND',404,'Associated commitment no longer exists.');
        // Association records context without duplicating the user's explicit obligation.
      } else {
        const old=(await db.query('SELECT * FROM commitment_rules WHERE profile_id=$1 AND id=$2 FOR UPDATE',[profile.id,recurrence.ruleId])).rows[0];
        if(old && old.event_id && old.event_id!==event.supersedesEventId) throw new AppError('VERSION_CONFLICT',409,'Recurring rule changed.');
        if(old) {
          await db.query('UPDATE commitment_rules SET definition=$3,version=version+1 WHERE profile_id=$1 AND id=$2',[profile.id,recurrence.ruleId,{...old.definition,endDate:event.effectiveFrom}]);
          await db.query(`UPDATE commitment_occurrences o SET cancelled=true WHERE profile_id=$1 AND rule_id=$2 AND scheduled_date>=$3 AND NOT EXISTS(SELECT 1 FROM commitment_allocations a WHERE a.profile_id=o.profile_id AND a.target_id=o.id AND a.state='active')`,[profile.id,recurrence.ruleId,event.effectiveFrom]);
        }
        const rule:CommitmentRule={id:old?recurrence.ruleId+':'+event.revision:recurrence.ruleId,alias:recurrence.alias,category:recurrence.category,amount:recurrence.amount,startDate:recurrence.nextDate,frequency:recurrence.frequency,dayOfMonth:Temporal.PlainDate.from(recurrence.nextDate).day,effectiveFrom:event.effectiveFrom,learnedEventId:event.eventId,destination:null};
        await db.query('INSERT INTO commitment_rules(profile_id,id,definition,event_id) VALUES($1,$2,$3,$4) ON CONFLICT(profile_id,id) DO UPDATE SET definition=$3,event_id=$4,version=commitment_rules.version+1',[profile.id,rule.id,rule,event.eventId]);
        const end=(await db.query('SELECT end_date FROM plans WHERE profile_id=$1',[profile.id])).rows[0]?.end_date??Temporal.PlainDate.from(event.effectiveFrom).add({days:90}).toString();
        await persistOccurrences(db,profile.id,rule,String(end).slice(0,10));
      }
    }
    if(event.kind==='reimbursement_link'){for(const id of event.payload.allocationIds){const link=(await db.query('SELECT source_id,target_id FROM reimbursement_allocations WHERE profile_id=$1 AND id=$2',[profile.id,id])).rows[0];if(!link)throw new AppError('NOT_FOUND',404,'Allocation not found.');await assertAllocationPayment(db,profile,link.source_id);await assertAllocationPayment(db,profile,link.target_id);}}
    if(event.kind==='reimbursement_link') await db.query("UPDATE reimbursement_allocations SET state='active' WHERE profile_id=$1 AND event_id=$2 AND state='pending'",[profile.id,event.eventId]);
    if(event.kind==='correction'&&event.payload.targetKind==='reimbursement') for(const id of event.payload.value.reverseIds) await db.query("UPDATE reimbursement_allocations SET state='reversed' WHERE profile_id=$1 AND id=$2 AND state='active'",[profile.id,id]);
    if(event.kind==='deactivation'&&event.supersedesEventId) {
      await db.query("UPDATE reimbursement_allocations SET state='reversed' WHERE profile_id=$1 AND event_id=$2 AND state IN('pending','active')",[profile.id,event.supersedesEventId]);
      await db.query('DELETE FROM payment_annotations WHERE profile_id=$1 AND event_id=$2',[profile.id,event.supersedesEventId]);
      const rules=(await db.query('SELECT id,definition FROM commitment_rules WHERE profile_id=$1 AND event_id=$2',[profile.id,event.supersedesEventId])).rows;
      for(const rule of rules) {
        await db.query('UPDATE commitment_rules SET definition=$3,version=version+1 WHERE profile_id=$1 AND id=$2',[profile.id,rule.id,{...rule.definition,endDate:event.effectiveFrom}]);
        await db.query(`UPDATE commitment_occurrences o SET cancelled=true WHERE profile_id=$1 AND rule_id=$2 AND scheduled_date>=$3 AND NOT EXISTS(SELECT 1 FROM commitment_allocations a WHERE a.profile_id=o.profile_id AND a.target_id=o.id AND a.state='active')`,[profile.id,rule.id,event.effectiveFrom]);
      }
    }
    await db.query('UPDATE learned_events SET activated_at=now() WHERE profile_id=$1 AND id=$2',[profile.id,event.eventId]);
    await db.query("UPDATE memory_jobs SET state='recall_confirmed',blob_id=$3,recalled_at=now(),error_code=NULL,updated_at=now() WHERE profile_id=$1 AND id=$2",[profile.id,jobId,blobId]);
  });
}
export async function advanceMemoryJob(profile:Profile,providedMemory?:Pick<WalrusMemory,'submit'|'status'|'recallEvent'>) {
  await consumeLimits([{key:'memory:poll:global',max:30,seconds:60},{key:`memory:poll:${profile.id}`,max:10,seconds:60}]);
  const job=await transaction(async db=>{
    const row=(await db.query(`SELECT j.*,e.envelope FROM memory_jobs j JOIN learned_events e ON e.profile_id=j.profile_id AND e.id=j.event_id WHERE j.profile_id=$1 AND j.state IN('queued','submitting','accepted','saved','submission_outcome_unknown') ORDER BY j.updated_at LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,[profile.id])).rows[0];
    if(row?.state==='submitting'&&Date.now()-new Date(row.updated_at).getTime()>60000) {await db.query("UPDATE memory_jobs SET state='submission_outcome_unknown',updated_at=now() WHERE profile_id=$1 AND id=$2",[profile.id,row.id]);row.state='submission_outcome_unknown';}
    return row;
  });
  if(!job)return {state:'idle'};
  const memory=providedMemory??new WalrusMemory(profile.namespace),event=learnedEventSchema.parse(job.envelope);
  if(job.state==='queued') {
    await consumeLimits([{key:'memory:write:global',max:4,seconds:60},{key:`memory:write:${profile.id}`,max:3,seconds:60}]);
    const claimed=await database().query("UPDATE memory_jobs SET state='submitting',attempts=attempts+1,updated_at=now() WHERE profile_id=$1 AND id=$2 AND state='queued' RETURNING id",[profile.id,job.id]);
    if(!claimed.rowCount)return {state:'pending'};
    try { const accepted=await memory.submit(event); await database().query("UPDATE memory_jobs SET state='accepted',remote_job_id=$3,error_code=NULL,updated_at=now() WHERE profile_id=$1 AND id=$2",[profile.id,job.id,accepted.job_id]);return {state:'accepted',jobId:job.id}; }
    catch(error) {
      const configuration = error instanceof Error && error.message==='FREE_WRITE_ENTITLEMENT_UNCONFIRMED';
      await database().query("UPDATE memory_jobs SET state=$3,error_code=$4,updated_at=now() WHERE profile_id=$1 AND id=$2",[profile.id,job.id,configuration?'queued':'submission_outcome_unknown',configuration?'FREE_WRITE_ENTITLEMENT_UNCONFIRMED':'SUBMISSION_OUTCOME_UNKNOWN']);
      return {state:configuration?'queued':'submission_outcome_unknown',jobId:job.id,error:configuration?'Confirm free sponsored writes in setup.':'The write outcome is unknown. It will not be automatically submitted again.'};
    }
  }
  if(job.state==='submitting')return {state:'submitting',jobId:job.id};
  if(job.state==='submission_outcome_unknown') {
    const matches=await memory.recallEvent(event);
    if(matches.length===1){await applyEvent(profile,event,job.id,matches[0].blob_id);return {state:'recall_confirmed',jobId:job.id};}
    return {state:'submission_outcome_unknown',jobId:job.id,duplicateBlobs:matches.length>1?matches.map(m=>m.blob_id):[],error:'Reconcile this event with the operator; absence from semantic recall does not prove no write exists.'};
  }
  const remote=await memory.status(job.remote_job_id);
  if(remote.status==='failed') {
    await transaction(async db=>{await db.query("UPDATE memory_jobs SET state='failed',error_code='REMOTE_WRITE_FAILED',updated_at=now() WHERE profile_id=$1 AND id=$2",[profile.id,job.id]);await db.query("UPDATE reimbursement_allocations SET state='reversed' WHERE profile_id=$1 AND event_id=$2 AND state='pending'",[profile.id,event.eventId]);});
    return {state:'failed',jobId:job.id};
  }
  if(remote.status==='not_found')return {state:job.state,jobId:job.id,error:'Remote job unavailable. Operator reconciliation required; no duplicate submission.'};
  if(remote.status!=='done'||!remote.blob_id)return {state:'accepted',jobId:job.id};
  if(remote.namespace&&remote.namespace!==profile.namespace)throw new AppError('MEMORY_NAMESPACE_MISMATCH',502,'Memory verification failed.');
  await database().query("UPDATE memory_jobs SET state='saved',blob_id=$3,updated_at=now() WHERE profile_id=$1 AND id=$2",[profile.id,job.id,remote.blob_id]);
  const matches=await memory.recallEvent(event);
  if(matches.some(m=>m.blob_id===remote.blob_id)){await applyEvent(profile,event,job.id,remote.blob_id);return {state:'recall_confirmed',jobId:job.id,duplicateBlobs:matches.length>1?matches.map(m=>m.blob_id):[]};}
  return {state:'saved',jobId:job.id,error:'Stored; waiting for a matching signed recall before activation.'};
}
export async function refreshRecall(profile:Profile) {
  await consumeLimits([{key:'memory:recall:global',max:12,seconds:60},{key:`memory:recall:${profile.id}`,max:3,seconds:60}]);
  const memory=new WalrusMemory(profile.namespace);
  // Enumeration, unlike semantic recall, establishes storage availability for all known blobs.
  const metadata=await enumerateMetadata(cursor=>memory.metadataPage(cursor));
  await transaction(async db=>{
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
    const jobs=(await db.query("SELECT id,event_id,blob_id FROM memory_jobs WHERE profile_id=$1 AND state='recall_confirmed'",[profile.id])).rows;
    for(const job of jobs){
      const meta=metadata.find(m=>m.blob_id===job.blob_id);
      const available=!!meta&&meta.status==='active'&&(!meta.expires_at||new Date(meta.expires_at)>new Date());
      await db.query('UPDATE learned_events SET available=$3 WHERE profile_id=$1 AND id=$2',[profile.id,job.event_id,available]);
      if(meta?.expires_at)await db.query('UPDATE memory_jobs SET expires_at=$3 WHERE profile_id=$1 AND id=$2',[profile.id,job.id,meta.expires_at]);
    }
  });
  const recall=await memory.client.recall({query:'Current confirmed Sui Money context, spending classifications and planning preferences',namespace:profile.namespace,limit:30});
  const {validateRecall}=await import('@/domain/learning');
  let verified=0;
  for(const hit of recall.results) {
    let candidate:LearnedEvent;try{candidate=learnedEventSchema.parse(JSON.parse(hit.text));}catch{continue;}
    if(candidate.profileId!==profile.id)continue;
    const row=(await database().query('SELECT e.envelope,j.blob_id FROM learned_events e JOIN memory_jobs j ON j.profile_id=e.profile_id AND j.event_id=e.id WHERE e.profile_id=$1 AND e.id=$2 AND j.state=\'recall_confirmed\'',[profile.id,candidate.eventId])).rows[0];
    if(row&&row.blob_id===hit.blob_id&&validateRecall(hit.text,row.envelope,profile.id)){await database().query('UPDATE memory_jobs SET recalled_at=now() WHERE profile_id=$1 AND event_id=$2',[profile.id,candidate.eventId]);verified++;}
  }
  return {verified,totalReturned:recall.results.length,complete:false,observedAt:new Date().toISOString(),reason:'Semantic recall is bounded. Financial projections use the complete validated event log; other previously verified events remain cached.'};
}
