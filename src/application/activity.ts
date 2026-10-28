import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { transaction } from '@/adapters/postgres/client';
import { AppError, destinationId } from '@/lib/security';
import { safeText } from '@/domain/learning';
import { units, USDC_TYPE } from '@/domain/money';
import { weeklySuggestions } from '@/domain/recurrence';
import { assertAllocationPayment } from './eligibility';
import { accountState } from './state';
import { newEvent,queueEvent } from './commands';
import type { Profile } from './auth';
export const annotationInput=z.object({category:safeText,note:safeText,ownTransfer:z.boolean(),rememberDestination:z.boolean(),expectedRevision:z.number().int().nonnegative(),supersedesEventId:z.string().optional()}).strict();
export async function annotate(profile:Profile,movementId:string,raw:unknown) {
  const data=annotationInput.parse(raw);
  return transaction(async db=>{
    const row=(await db.query('SELECT * FROM chain_movements WHERE profile_id=$1 AND id=$2',[profile.id,movementId])).rows[0];
    if(!row)throw new AppError('NOT_FOUND',404,'Payment not found.');
    if(row.coin_type!==USDC_TYPE||row.operation!=='simple_transfer'||row.execution_status!=='success')throw new AppError('INELIGIBLE_MOVEMENT',400,'This activity needs review and cannot be classified as a supported payment.');
    if(data.rememberDestination)throw new AppError('SEPARATE_RULE_REQUIRED',409,'Save the explanation first, then confirm a separate destination rule. A note alone never becomes a rule.');
    const event=newEvent(profile,{kind:'payment_explanation',logicalKey:'annotation:'+movementId,sourceRecordIds:[movementId],expectedRevision:data.expectedRevision,supersedesEventId:data.supersedesEventId,payload:{movementId,category:data.category,note:data.note,ownTransfer:data.ownTransfer}});
    return queueEvent(db,profile,event,data.expectedRevision);
  });
}
const destinationRuleInput=z.object({movementId:z.string().max(120),kind:z.enum(['own_destination_rule','category_rule']),category:safeText.optional(),ownTransfer:z.boolean().optional(),expectedRevision:z.number().int().nonnegative(),supersedesEventId:z.string().optional()}).strict();
export async function destinationRule(profile:Profile,raw:unknown) {
  const data=destinationRuleInput.parse(raw);
  return transaction(async db=>{
    const movement=(await db.query('SELECT * FROM chain_movements WHERE profile_id=$1 AND id=$2',[profile.id,data.movementId])).rows[0];
    if(!movement?.counterparty||movement.operation!=='simple_transfer'||movement.execution_status!=='success'||BigInt(movement.delta)>=0n||movement.coin_type!==USDC_TYPE)throw new AppError('INELIGIBLE_MOVEMENT',400,'Choose an eligible outgoing payment with a known destination.');
    const dest=destinationId(profile.id,movement.counterparty);
    if(data.kind==='category_rule'&&!data.category)throw new AppError('CATEGORY_REQUIRED',400,'Choose a category for this rule.');
    const event=newEvent(profile,{kind:data.kind,logicalKey:data.kind+':'+dest,sourceRecordIds:[data.movementId],expectedRevision:data.expectedRevision,supersedesEventId:data.supersedesEventId,payload:data.kind==='category_rule'?{destinationId:dest,category:data.category!}:{destinationId:dest,ownTransfer:data.ownTransfer??true}});
    return queueEvent(db,profile,event,data.expectedRevision);
  });
}
const allocationInput=z.object({sourceId:z.string().max(120),targetId:z.string().max(160),amount:z.string().max(78),expectedRevision:z.number().int().nonnegative().default(0)}).strict();
export async function reimbursement(profile:Profile,raw:unknown) {
  const data=allocationInput.parse(raw), amount=units(data.amount).toString(),id=randomUUID();
  return transaction(async db=>{
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
    const found=(await db.query('SELECT id FROM chain_movements WHERE profile_id=$1 AND id=ANY($2::text[])',[profile.id,[data.sourceId,data.targetId]])).rows;
    if(found.length!==2)throw new AppError('NOT_FOUND',404,'Select two distinct payments belonging to this account.');
    await assertAllocationPayment(db,profile,data.sourceId);await assertAllocationPayment(db,profile,data.targetId);
    const event=newEvent(profile,{kind:'reimbursement_link',logicalKey:'reimbursement:'+id,sourceRecordIds:[data.sourceId,data.targetId],expectedRevision:0,payload:{allocationIds:[id]}});
    const result=await queueEvent(db,profile,event,0);
    await db.query("INSERT INTO reimbursement_allocations(profile_id,id,source_id,target_id,amount,state,event_id) VALUES($1,$2,$3,$4,$5,'pending',$6)",[profile.id,id,data.sourceId,data.targetId,amount,event.eventId]);
    return result;
  });
}
export async function allocateCommitment(profile:Profile,targetId:string,raw:unknown) {
  const data=z.object({sourceId:z.string().max(120),amount:z.string().max(78)}).strict().parse(raw),amount=units(data.amount).toString();
  return transaction(async db=>{
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
    const source=await assertAllocationPayment(db,profile,data.sourceId);
    const target=(await db.query('SELECT * FROM commitment_occurrences WHERE profile_id=$1 AND id=$2',[profile.id,targetId])).rows[0];
    if(!source||!target)throw new AppError('NOT_FOUND',404,'Payment or commitment not found.');
    await db.query("INSERT INTO commitment_allocations(profile_id,id,source_id,target_id,amount,checkpoint) VALUES($1,$2,$3,$4,$5,$6)",[profile.id,randomUUID(),data.sourceId,targetId,amount,source.checkpoint]);
    return {saved:true,calculation:'pending_balance',reason:'The allocation is saved. Its reservation releases only when a verified balance includes the payment checkpoint.'};
  });
}
export async function decideSuggestion(profile:Profile,suggestionId:string,raw:unknown) {
  const data=z.object({decision:z.enum(['confirmed','rejected']),amount:z.string().max(78).optional(),nextDate:z.iso.date().optional(),alias:safeText.optional(),associateRuleId:z.string().max(100).optional()}).strict().parse(raw);
  const state=await accountState(profile), suggestion=weeklySuggestions(state.movements,state.annotations,profile.timezone).find(s=>s.id===suggestionId);
  if(!suggestion)throw new AppError('SUGGESTION_CHANGED',409,'History changed. Review the current suggestion.');
  return transaction(async db=>{
    const logicalKey='suggestion:'+suggestionId.slice(0,100);
    const prior=(await db.query('SELECT id FROM learned_events WHERE profile_id=$1 AND logical_key=$2',[profile.id,logicalKey])).rows[0];
    if(prior)throw new AppError('SUGGESTION_REVIEWED',409,'This unchanged suggestion already has a decision.');
    if(data.decision==='confirmed') {
      if(!data.amount||!data.nextDate||!data.alias)throw new AppError('CONFIRM_DETAILS',400,'Confirm the amount, alias and next due date.');
      const overlap=state.rules.filter(r=>!r.learnedEventId&&!r.cancelled&&r.category===suggestion.category&&r.amount===units(data.amount!).toString());
      if(overlap.length&&!data.associateRuleId)throw new AppError('EXISTING_COMMITMENT',409,'An explicit commitment may cover this payment. Review and associate it before adding another obligation.');
      const event=newEvent(profile,{kind:'recurrence_confirmation',logicalKey,sourceRecordIds:suggestion.sourceIds,expectedRevision:0,payload:{ruleId:randomUUID(),alias:data.alias,amount:units(data.amount).toString(),category:suggestion.category,nextDate:data.nextDate,frequency:'weekly',associateRuleId:data.associateRuleId}});
      return queueEvent(db,profile,event,0);
    }
    return queueEvent(db,profile,newEvent(profile,{kind:'suggestion_decision',logicalKey,sourceRecordIds:suggestion.sourceIds,expectedRevision:0,payload:{suggestionId,decision:'rejected'}}),0);
  });
}

// Corrections share the original logical key. Nothing changes until the new revision
// has both durable storage and matching recall evidence.
export async function correctMemory(profile:Profile,eventId:string,raw:unknown) {
  const input=z.object({expectedRevision:z.number().int().positive(),amount:z.string().max(78).optional(),alias:safeText.optional(),nextDate:z.iso.date().optional(),frequency:z.enum(['once','weekly','monthly']).optional(),reverse:z.literal(true).optional()}).strict().parse(raw);
  return transaction(async db=>{
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
    const prior=(await db.query("SELECT e.envelope FROM learned_events e JOIN memory_jobs j ON j.profile_id=e.profile_id AND j.event_id=e.id WHERE e.profile_id=$1 AND e.id=$2 AND j.state='recall_confirmed'",[profile.id,eventId])).rows[0]?.envelope;
    if(!prior)throw new AppError('NOT_FOUND',404,'Confirmed memory not found.');
    if(prior.kind==='reimbursement_link') {
      if(!input.reverse)throw new AppError('CONFIRM_REVERSAL',400,'Confirm reversal of this reimbursement link.');
      return queueEvent(db,profile,newEvent(profile,{kind:'correction',logicalKey:prior.logicalKey,sourceRecordIds:prior.sourceRecordIds,expectedRevision:input.expectedRevision,supersedesEventId:eventId,payload:{targetKind:'reimbursement',value:{reverseIds:prior.payload.allocationIds}}}),input.expectedRevision);
    }
    const recurrence=prior.kind==='recurrence_confirmation'?prior.payload:prior.kind==='correction'&&prior.payload.targetKind==='recurrence'?prior.payload.value:null;
    if(!recurrence)throw new AppError('UNSUPPORTED_CORRECTION',400,'Edit payment explanations in Activity or deactivate this context.');
    if(!input.amount||!input.alias||!input.nextDate||!input.frequency)throw new AppError('CONFIRM_DETAILS',400,'Enter the corrected alias, positive amount, frequency and next local date.');
    const amount=units(input.amount).toString();if(BigInt(amount)<=0n)throw new AppError('INVALID_AMOUNT',400,'A recurring amount must be positive.');
    const currentRule=(await db.query('SELECT id FROM commitment_rules WHERE profile_id=$1 AND event_id=$2',[profile.id,eventId])).rows[0];
    return queueEvent(db,profile,newEvent(profile,{kind:'correction',logicalKey:prior.logicalKey,sourceRecordIds:prior.sourceRecordIds,expectedRevision:input.expectedRevision,supersedesEventId:eventId,payload:{targetKind:'recurrence',value:{...recurrence,ruleId:currentRule?.id??recurrence.ruleId,amount,alias:input.alias,nextDate:input.nextDate,frequency:input.frequency}}}),input.expectedRevision);
  });
}
