import { database, transaction } from '@/adapters/postgres/client';
import { activeEvents, learnedEventSchema, type ConfirmedEvent } from '@/domain/learning';
import { occurrences } from '@/domain/recurrence';
import { localToday } from '@/domain/planning';
import { USDC_TYPE } from '@/domain/money';
import { Temporal } from '@js-temporal/polyfill';
import { destinationId } from '@/lib/security';
import type { Profile } from './auth';
import type { Allocation, Annotation, Balance, CommitmentRule, Coverage, Movement, Occurrence, Plan } from '@/domain/types';
import type { AccountState } from '@/domain/state';
export type { AccountState } from '@/domain/state';
export { summarize } from '@/domain/summary';
export async function accountState(profile: Profile): Promise<AccountState> {
  return transaction(async db => {
    await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const balanceRow=(await db.query('SELECT * FROM balance_observations WHERE profile_id=$1 AND error_code IS NULL ORDER BY observed_at DESC LIMIT 1',[profile.id])).rows[0];
    const planRow=(await db.query('SELECT * FROM plans WHERE profile_id=$1',[profile.id])).rows[0];
    const movements=(await db.query<{facts:Movement}>('SELECT facts FROM chain_movements WHERE profile_id=$1 ORDER BY event_time DESC,id',[profile.id])).rows.map(r=>r.facts);
    const annotationRows=(await db.query('SELECT * FROM payment_annotations WHERE profile_id=$1',[profile.id])).rows;
    let annotations:Annotation[]=annotationRows.map(r=>({movementId:r.movement_id,category:r.category,note:r.note,ownTransfer:r.own_transfer,eventId:r.event_id}));
    const toAllocation=(r:Record<string,unknown>):Allocation=>({id:r.id as string,sourceId:r.source_id as string,targetId:r.target_id as string,amount:r.amount as string,state:r.state as Allocation['state'],checkpoint:r.checkpoint as string|undefined,receiptDate:movements.find(m=>m.id===r.source_id)?.timestamp});
    const reimbursements=(await db.query('SELECT * FROM reimbursement_allocations WHERE profile_id=$1',[profile.id])).rows.map(toAllocation);
    const commitmentAllocations=(await db.query('SELECT * FROM commitment_allocations WHERE profile_id=$1',[profile.id])).rows.map(toAllocation);
    const rules=(await db.query<{definition:CommitmentRule;version:number}>('SELECT definition,version FROM commitment_rules WHERE profile_id=$1',[profile.id])).rows.map(r=>({...r.definition,version:r.version}));
    const sync=(await db.query<{coverage:Coverage}>('SELECT coverage FROM sync_progress WHERE profile_id=$1',[profile.id])).rows[0];
    const memories:ConfirmedEvent[]=(await db.query('SELECT e.envelope,e.available,j.state,j.blob_id,j.recalled_at,j.expires_at FROM learned_events e JOIN memory_jobs j ON j.profile_id=e.profile_id AND j.event_id=e.id WHERE e.profile_id=$1 ORDER BY e.created_at',[profile.id])).rows.map(r=>({envelope:learnedEventSchema.parse(r.envelope),available:r.available&&(!r.expires_at||new Date(r.expires_at).getTime()>Date.now()),state:r.state,blobId:r.blob_id,recalledAt:r.recalled_at ? new Date(r.recalled_at).toISOString():null}));
    const activeConfirmed=activeEvents(memories,profile.id);
    const activeIds=new Set(activeConfirmed.map(e=>e.envelope.eventId));
    annotations=annotations.filter(a=>!a.eventId||activeIds.has(a.eventId));
    for(const m of movements){
      if(m.coinType!==USDC_TYPE||m.operation!=='simple_transfer'||m.status!=='success'||BigInt(m.delta)>=0n||!m.counterparty||annotations.some(a=>a.movementId===m.id))continue;
      const destination=destinationId(profile.id,m.counterparty),date=localToday(m.timestamp,profile.timezone);
      const matching=activeConfirmed.map(a=>a.envelope).filter(e=>(e.kind==='category_rule'||e.kind==='own_destination_rule')&&e.payload.destinationId===destination&&date>=e.effectiveFrom);
      const own=matching.find(e=>e.kind==='own_destination_rule'&&e.payload.ownTransfer),category=matching.find(e=>e.kind==='category_rule');
      if(own)annotations.push({movementId:m.id,category:'Own transfer',note:'Confirmed destination rule',ownTransfer:true,eventId:own.eventId});
      else if(category&&category.kind==='category_rule')annotations.push({movementId:m.id,category:category.payload.category,note:'Confirmed destination rule',ownTransfer:false,eventId:category.eventId});
    }
    const plan:Plan=planRow?{endDate:planRow.end_date?String(planRow.end_date).slice(0,10):null,endKind:planRow.end_kind,reserve:planRow.reserve,expectedIncome:planRow.expected_income,timezone:profile.timezone,version:planRow.version}:{endDate:null,endKind:'income',reserve:'0',expectedIncome:null,timezone:profile.timezone,version:0};
    const now=new Date().toISOString(), today=localToday(now,profile.timezone);
    const through=plan.endDate??Temporal.PlainDate.from(today).add({days:90}).toString();
    const savedOccurrences=(await db.query<{definition:Occurrence;cancelled:boolean}>('SELECT definition,cancelled FROM commitment_occurrences WHERE profile_id=$1',[profile.id])).rows.map(r=>({...r.definition,cancelled:r.cancelled}));
    const activeRules=rules.filter(r=>!r.learnedEventId||activeIds.has(r.learnedEventId));
    // Preserve historical and partly settled obligations, but unavailable context
    // cannot generate new unpaid future obligations or revive an old revision.
    const eligibleSaved=savedOccurrences.filter(o=>!o.learnedEventId||activeIds.has(o.learnedEventId)||o.dueDate<today||commitmentAllocations.some(a=>a.targetId===o.id&&a.state==='active'));
    const allOccurrences=[...new Map([...occurrences(activeRules,through),...eligibleSaved].map(o=>[o.id,o])).values()];
    return {profile:{id:profile.id,wallet:profile.wallet,timezone:profile.timezone,consentVersion:profile.consent_version},balance:balanceRow?{usdc:balanceRow.usdc,sui:balanceRow.sui,checkpoint:balanceRow.checkpoint,observedAt:new Date(balanceRow.observed_at).toISOString(),source:'tatum',stale:Date.now()-new Date(balanceRow.observed_at).getTime()>120000}:null,plan,movements,annotations,reimbursements,commitmentAllocations,rules,occurrences:allOccurrences,coverage:sync?.coverage??{state:'not_synced',from:null,to:null,reason:'No history imported yet.'},memories,today,now,mode:'personal',memoryStatus:'Previously confirmed context is cached until signed recall is refreshed.'};
  });
}
export async function recordBalance(profileId:string,balance:Balance) { await database().query('INSERT INTO balance_observations(id,profile_id,usdc,sui,checkpoint,observed_at,metadata_version,source) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,\'tatum\')',[profileId,balance.usdc,balance.sui,balance.checkpoint,balance.observedAt,'@mysten/sui@2.38.0:USDC6:SUI9']); }
