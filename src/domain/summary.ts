import { Temporal } from '@js-temporal/polyfill';
import { planning } from './planning';
import { goalOccurrences } from './goals';
import { spending } from './spending';
import type { AccountState } from './state';
export function summarize(state:AccountState,disabledLearnedIds:string[]=[]){
  // An active, Walrus-confirmed savings goal sets its upcoming contributions aside like commitments.
  const goals=state.plan.endDate?goalOccurrences(state.memories,state.profile.id,state.today,state.plan.endDate):[];
  const occurrences=[...state.occurrences,...goals].filter(o=>!o.learnedEventId||!disabledLearnedIds.includes(o.learnedEventId));
  const annotations=state.annotations.filter(a=>!a.eventId||!disabledLearnedIds.includes(a.eventId));
  const now=Temporal.Instant.from(state.now),lastScan=Temporal.Instant.from(state.coverage.to??state.now),cutoff=Temporal.Instant.compare(lastScan,now)<=0?lastScan:now;
  const period={from:cutoff.subtract({hours:720}).toString({smallestUnit:'millisecond'}),to:cutoff.toString({smallestUnit:'millisecond'})};
  return {plan:planning({balance:state.balance,plan:state.plan,today:state.today,occurrences,allocations:state.commitmentAllocations}),spending:spending(state.movements,annotations,state.reimbursements,period,state.coverage)};
}
