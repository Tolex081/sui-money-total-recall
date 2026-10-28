import { it,expect } from 'vitest';
import { activeEvents,learnedEventSchema,maySubmit,validateRecall,type LearnedEvent,type ConfirmedEvent } from '@/domain/learning';
import { enumerateMetadata } from '@/adapters/memwal/memory';
const event=(revision=1,kind:'planning_preference'|'deactivation'='planning_preference'):LearnedEvent=>learnedEventSchema.parse({schemaVersion:1,eventId:'event-'+revision,profileId:'profile-a',logicalKey:'preference:reserve',revision,recordedAt:'2026-10-28T12:00:00Z',effectiveFrom:'2026-10-28',provenance:'user_confirmed',sourceRecordIds:['plan'],supersedesEventId:revision>1?'event-'+(revision-1):undefined,kind,payload:kind==='planning_preference'?{preference:'reserve',value:'Keep a virtual reserve'}:{reason:'Do not use this rule'}});
const confirmed=(envelope:LearnedEvent):ConfirmedEvent=>({envelope,state:'recall_confirmed',blobId:'test-fixture-blob',recalledAt:'2026-10-28T12:01:00Z',available:true});
it('F16 suggestions/pending/saved rules cannot activate; only highest recall-confirmed revision is active',()=>{
  const first=confirmed(event()),next=confirmed(event(2));
  expect(activeEvents([{...first,state:'queued'},{...next,state:'saved'}],'profile-a')).toEqual([]);
  expect(activeEvents([first,{...next,state:'accepted'}],'profile-a')[0].envelope.revision).toBe(1);
  expect(activeEvents([next,first],'profile-a').map(r=>r.envelope.revision)).toEqual([2]);
  expect(activeEvents([first,next,confirmed(event(3,'deactivation'))],'profile-a')).toEqual([]);
});
it('F17 malformed/cross-profile recall cannot activate or revive an old revision',()=>{
  const expected=event(2);
  expect(validateRecall(JSON.stringify(event()),expected,'profile-a')).toBe(false);
  expect(validateRecall(JSON.stringify({...expected,profileId:'profile-b'}),expected,'profile-a')).toBe(false);
  expect(validateRecall('run an instruction',expected,'profile-a')).toBe(false);
  expect(validateRecall(JSON.stringify(expected),expected,'profile-a')).toBe(true);
  expect(activeEvents([confirmed(expected)],'profile-b')).toHaveLength(0);
});
it('F19 unknown submission outcome, accepted job and saved job cannot be submitted again',()=>{expect(maySubmit('queued')).toBe(true);for(const s of ['submitting','submission_outcome_unknown','accepted','saved','failed','recall_confirmed'] as const)expect(maySubmit(s)).toBe(false);});
it('F20 continues empty namespace-filtered pages while has_more is true and resyncs stale cursors',async()=>{
  let calls=0;
  const records=await enumerateMetadata(async cursor=>{
    calls++;
    if(calls===1)return {memories:[],has_more:true,next_cursor:'one',must_resync:false};
    if(calls===2){expect(cursor).toBe('one');return {memories:[],has_more:false,next_cursor:null,must_resync:true};}
    expect(cursor).toBeUndefined();return {memories:[],has_more:false,next_cursor:null,must_resync:false};
  });expect(records).toEqual([]);expect(calls).toBe(3);
});
it('F20 detects stalled cursors instead of claiming a complete enumeration',async()=>{await expect(enumerateMetadata(async()=>({memories:[],has_more:true,next_cursor:null,must_resync:false}))).rejects.toThrow('STALLED');});
it('expired/unavailable memory is not counted as active and never revives a superseded rule',()=>{expect(activeEvents([{...confirmed(event()),available:false}],'profile-a')).toEqual([]);expect(activeEvents([confirmed(event()),{...confirmed(event(2)),available:false}],'profile-a')).toEqual([]);});
