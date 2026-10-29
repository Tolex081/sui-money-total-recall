import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import { transaction } from '@/adapters/postgres/client';
import { learnedEventSchema, safeText, type LearnedEvent } from '@/domain/learning';
import { horizon, localToday } from '@/domain/planning';
import { occurrences } from '@/domain/recurrence';
import { units } from '@/domain/money';
import type { CommitmentRule } from '@/domain/types';
import { AppError } from '@/lib/security';
import type { Profile } from './auth';

const amountInput=z.string().max(78).transform((s,ctx)=>{try{return units(s).toString();}catch(error){ctx.addIssue({code:'custom',message:(error as Error).message});return z.NEVER;}});
export const planInput=z.object({endDate:z.iso.date(),endKind:z.enum(['income','planning']),reserve:amountInput,expectedIncome:amountInput.nullable(),timezone:z.string().max(80),version:z.number().int().nonnegative(),consentVersion:z.literal('operator-managed-v1'),timezonePreviewAccepted:z.boolean().optional()}).strict();
export const commitmentInput=z.object({id:z.string().max(100).optional(),alias:safeText,amount:amountInput,category:safeText,startDate:z.iso.date(),frequency:z.enum(['once','weekly','monthly']),destination:z.string().max(100).nullable().optional(),version:z.number().int().nonnegative().optional(),cancelled:z.boolean().optional()}).strict();
export async function persistOccurrences(db:PoolClient,profileId:string,rule:CommitmentRule,through:string) {
  const generated=occurrences([rule],through);
  for(const o of generated) await db.query(`INSERT INTO commitment_occurrences(profile_id,id,rule_id,scheduled_date,amount,cancelled,definition) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(profile_id,id) DO NOTHING`,[profileId,o.id,o.ruleId,o.dueDate,o.amount,o.cancelled,o]);
}
export async function savePlan(profile:Profile,raw:unknown) {
  const data=planInput.parse(raw);
  try{Temporal.Now.zonedDateTimeISO(data.timezone);}catch{throw new AppError('INVALID_TIMEZONE',400,'Choose a valid IANA timezone.');}
  if(horizon(localToday(new Date().toISOString(),data.timezone),data.endDate)===null) throw new AppError('INVALID_HORIZON',400,'Choose a future date within 90 local calendar days.');
  if(data.timezone!==profile.timezone&&!data.timezonePreviewAccepted) throw new AppError('TIMEZONE_PREVIEW_REQUIRED',409,'Review the timezone change: commitment local dates stay fixed; chain times will display in the new zone.');
  return transaction(async db=>{
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
    const existing=(await db.query('SELECT version FROM plans WHERE profile_id=$1 FOR UPDATE',[profile.id])).rows[0];
    if((existing?.version??0)!==data.version) throw new AppError('VERSION_CONFLICT',409,'Your plan changed in another tab. Refresh before editing.');
    await db.query(`INSERT INTO plans(profile_id,end_date,end_kind,reserve,expected_income,version) VALUES($1,$2,$3,$4,$5,1) ON CONFLICT(profile_id) DO UPDATE SET end_date=$2,end_kind=$3,reserve=$4,expected_income=$5,version=plans.version+1,updated_at=now()`,[profile.id,data.endDate,data.endKind,data.reserve,data.expectedIncome]);
    await db.query('UPDATE profiles SET timezone=$2,consent_version=$3 WHERE id=$1',[profile.id,data.timezone,data.consentVersion]);
    const rules=(await db.query<{definition:CommitmentRule}>('SELECT definition FROM commitment_rules WHERE profile_id=$1',[profile.id])).rows;
    for(const r of rules) await persistOccurrences(db,profile.id,r.definition,data.endDate);
    return {saved:true,version:data.version+1};
  });
}
export async function saveCommitment(profile:Profile,raw:unknown) {
  const data=commitmentInput.parse(raw);
  if(BigInt(data.amount)<=0n) throw new AppError('INVALID_AMOUNT',400,'Commitments need a positive USDC amount.');
  const rule:CommitmentRule={id:data.id??randomUUID(),alias:data.alias,category:data.category,amount:data.amount,startDate:data.startDate,frequency:data.frequency,dayOfMonth:Temporal.PlainDate.from(data.startDate).day,effectiveFrom:localToday(new Date().toISOString(),profile.timezone),destination:data.destination,cancelled:data.cancelled};
  return transaction(async db=>{
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
    const prior=(await db.query('SELECT * FROM commitment_rules WHERE profile_id=$1 AND id=$2 FOR UPDATE',[profile.id,rule.id])).rows[0];
    if(data.id&&!prior) throw new AppError('NOT_FOUND',404,'Commitment not found.');
    if(prior && prior.version!==data.version) throw new AppError('VERSION_CONFLICT',409,'Commitment changed. Refresh before editing.');
    if(prior?.event_id) throw new AppError('LEARNED_RULE',409,'Correct a remembered rule through its memory revision.');
    if(prior) {
      // An edit explicitly cancels unpaid future occurrences; settled/partly settled facts remain.
      await db.query(`UPDATE commitment_occurrences o SET cancelled=true WHERE profile_id=$1 AND rule_id=$2 AND scheduled_date>=$3 AND NOT EXISTS(SELECT 1 FROM commitment_allocations a WHERE a.profile_id=o.profile_id AND a.target_id=o.id AND a.state='active')`,[profile.id,rule.id,rule.effectiveFrom]);
    }
    if(prior) await db.query('UPDATE commitment_rules SET definition=$3,version=version+1 WHERE profile_id=$1 AND id=$2',[profile.id,rule.id,{...prior.definition,endDate:rule.effectiveFrom}]);
    else await db.query('INSERT INTO commitment_rules(profile_id,id,definition) VALUES($1,$2,$3)',[profile.id,rule.id,rule]);
    const end=(await db.query('SELECT end_date FROM plans WHERE profile_id=$1',[profile.id])).rows[0]?.end_date??Temporal.PlainDate.from(rule.effectiveFrom).add({days:90}).toString();
    // New revision uses its own rule identity so edited unpaid occurrences cannot collide with preserved settled ones.
    if(prior) {rule.id=randomUUID();await db.query('INSERT INTO commitment_rules(profile_id,id,definition) VALUES($1,$2,$3)',[profile.id,rule.id,rule]);}
    await persistOccurrences(db,profile.id,rule,String(end).slice(0,10));
    return {saved:true,id:rule.id};
  });
}
export async function queueEvent(db:PoolClient,profile:Profile,raw:unknown,expectedRevision:number) {
  const event=learnedEventSchema.parse(raw);
  if(event.profileId!==profile.id||event.provenance!=='user_confirmed') throw new AppError('INVALID_PROFILE',403,'Invalid event owner.');
  await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
  const prior=(await db.query('SELECT id,revision FROM learned_events WHERE profile_id=$1 AND logical_key=$2 ORDER BY revision DESC LIMIT 1',[profile.id,event.logicalKey])).rows[0];
  if((prior?.revision??0)!==expectedRevision||event.revision!==expectedRevision+1||event.supersedesEventId!==(prior?.id??undefined)) throw new AppError('VERSION_CONFLICT',409,'This context changed. Refresh before saving.');
  await db.query('INSERT INTO learned_events(profile_id,id,logical_key,revision,envelope) VALUES($1,$2,$3,$4,$5)',[profile.id,event.eventId,event.logicalKey,event.revision,event]);
  const jobId=randomUUID();
  await db.query(`INSERT INTO memory_jobs(profile_id,id,event_id,state,logical_key) VALUES($1,$2,$3,'queued',$4)`,[profile.id,jobId,event.eventId,event.logicalKey]);
  return {eventId:event.eventId,jobId,state:'queued',active:false};
}
export function newEvent(profile:Profile,input:Pick<LearnedEvent,'kind'|'payload'> & {logicalKey:string;sourceRecordIds:string[];expectedRevision:number;supersedesEventId?:string}):LearnedEvent {
  return learnedEventSchema.parse({schemaVersion:1,eventId:randomUUID(),profileId:profile.id,logicalKey:input.logicalKey,revision:input.expectedRevision+1,kind:input.kind,recordedAt:new Date().toISOString(),effectiveFrom:localToday(new Date().toISOString(),profile.timezone),provenance:'user_confirmed',sourceRecordIds:input.sourceRecordIds,supersedesEventId:input.supersedesEventId,payload:input.payload});
}

export async function rememberReserve(profile:Profile,raw:unknown){
  const input=z.object({reserve:amountInput,expectedRevision:z.number().int().nonnegative(),supersedesEventId:z.string().max(100).optional()}).strict().parse(raw);
  return transaction(db=>queueEvent(db,profile,newEvent(profile,{kind:'planning_preference',logicalKey:'preference:reserve',sourceRecordIds:[],expectedRevision:input.expectedRevision,supersedesEventId:input.supersedesEventId,payload:{preference:'reserve',value:input.reserve}}),input.expectedRevision));
}

export async function rememberManualRecurrence(profile:Profile,raw:unknown){
  const input=commitmentInput.parse(raw);
  if(input.id||input.cancelled||BigInt(input.amount)<=0n)throw new AppError('INVALID_RECURRENCE',400,'Confirm a new positive recurring commitment.');
  if(input.startDate<localToday(new Date().toISOString(),profile.timezone))throw new AppError('INVALID_DATE',400,'Choose today or a future local date for remembered context.');
  return transaction(async db=>{
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
    const duplicate=(await db.query("SELECT id FROM commitment_rules WHERE profile_id=$1 AND definition->>'amount'=$2 AND definition->>'category'=$3 AND NOT coalesce((definition->>'cancelled')::boolean,false) AND (definition->>'endDate' IS NULL OR definition->>'endDate'>$4) LIMIT 1",[profile.id,input.amount,input.category,localToday(new Date().toISOString(),profile.timezone)])).rows[0];
    if(duplicate)throw new AppError('EXISTING_COMMITMENT',409,'An entered commitment may already cover this. Review it before adding remembered obligations.');
    const id=randomUUID();
    return queueEvent(db,profile,newEvent(profile,{kind:'recurrence_confirmation',logicalKey:'manual-recurrence:'+id,sourceRecordIds:[],expectedRevision:0,payload:{ruleId:id,alias:input.alias,amount:input.amount,category:input.category,nextDate:input.startDate,frequency:input.frequency,origin:'manual'}}),0);
  });
}

export async function reverseCommitmentAllocation(profile:Profile,id:string){
  return transaction(async db=>{
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[profile.id]);
    const result=await db.query("UPDATE commitment_allocations SET state='reversed' WHERE profile_id=$1 AND id::text=$2 AND state='active' RETURNING id",[profile.id,id]);
    if(!result.rowCount)throw new AppError('NOT_FOUND',404,'Active allocation not found.');
    return {saved:true,reversed:true};
  });
}
