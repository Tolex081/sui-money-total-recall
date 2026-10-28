import { Temporal } from '@js-temporal/polyfill';
import { planning } from './planning';
import { spending } from './spending';
import type { AccountState } from './state';
export function summarize(state:AccountState,disabledLearnedIds:string[]=[]){
  const occurrences=state.occurrences.filter(o=>!o.learnedEventId||!disabledLearnedIds.includes(o.learnedEventId));
  const annotations=state.annotations.filter(a=>!a.eventId||!disabledLearnedIds.includes(a.eventId));
  return {plan:planning({balance:state.balance,plan:state.plan,today:state.today,occurrences,allocations:state.commitmentAllocations}),spending:spending(state.movements,annotations,state.reimbursements,{from:Temporal.PlainDate.from(state.today).subtract({days:30}).toString(),to:state.now},state.coverage)};
}
