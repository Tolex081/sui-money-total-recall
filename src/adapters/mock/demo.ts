import type { AccountState } from '@/domain/state';
import { summarize } from '@/domain/summary';
import { occurrences } from '@/domain/recurrence';
import { units,USDC_TYPE } from '@/domain/money';
import type { Movement,Annotation,CommitmentRule } from '@/domain/types';
const now='2026-10-28T12:00:00.000Z';
function movement(id:string,date:string,value:string,destination:string):Movement {
  const negative=value.startsWith('-');return {id:'synthetic-'+id,digest:null,owner:'fictional-primary-wallet',coinType:USDC_TYPE,delta:(negative?-units(value.slice(1)):units(value)).toString(),checkpoint:'100',timestamp:date+'T10:00:00.000Z',status:'success',operation:'simple_transfer',counterparty:'synthetic-'+destination,gasPaid:'1200000',source:'synthetic'};
}
const movements:Movement[]=[
  movement('lunch','2026-10-27','-18.50','cafe'),movement('groceries','2026-10-26','-40','market'),movement('refund','2026-10-27','15','friend'),
  movement('own','2026-10-25','-120','second-wallet'),movement('book','2026-10-24','-12','bookshop'),
  movement('transport-3','2026-10-21','-22','transport'),movement('transport-2','2026-10-14','-22','transport'),movement('transport-1','2026-10-07','-22','transport'),
  movement('internet','2026-10-03','-38','internet'),movement('income','2026-10-01','1600','sender'),
  movement('groceries-2','2026-10-19','-45','market'),movement('groceries-3','2026-10-12','-45','market'),movement('groceries-4','2026-10-05','-45','market'),
  movement('unknown','2026-10-28','-9.25','unknown'),
];
const aliases:Record<string,[string,string]>={lunch:['Food','Lunch with a friend'],groceries:['Groceries','Shared grocery shop'],refund:['Reimbursement','Part of the shared grocery shop'],own:['Own transfer','Moved to my other wallet'],book:['Learning','A new book'],internet:['Internet','Home internet'],income:['Incoming','Unassigned incoming transfer'],unknown:['Unclassified','Add an explanation to this payment']};
const annotations:Annotation[]=movements.filter(m=>m.id!=='synthetic-unknown').map(m=>{
  const key=m.id.replace('synthetic-',''), a=aliases[key]??(key.startsWith('transport')?['Transport','Weekly transport']:['Groceries','Weekly grocery shop']);
  return {movementId:m.id,category:a[0],note:a[1],ownTransfer:key==='own',eventId:key==='own'?'synthetic-learning-own':'synthetic-explanation-'+key};
});
const rules:CommitmentRule[]=[
  {id:'synthetic-rent',alias:'Rent',amount:units('290').toString(),category:'Home',startDate:'2026-11-01',frequency:'once',effectiveFrom:'2026-10-28'},
  {id:'synthetic-internet',alias:'Home internet',amount:units('38').toString(),category:'Internet',startDate:'2026-11-03',frequency:'once',effectiveFrom:'2026-10-28'},
  {id:'synthetic-weekly-market',alias:'Weekly groceries',amount:units('45').toString(),category:'Groceries',startDate:'2026-10-30',frequency:'weekly',effectiveFrom:'2026-10-28',learnedEventId:'synthetic-learning-groceries'},
  {id:'synthetic-weekly-transport',alias:'Weekly transport',amount:units('22').toString(),category:'Transport',startDate:'2026-10-29',frequency:'weekly',effectiveFrom:'2026-10-28',learnedEventId:'synthetic-learning-transport'},
];
export function demoState():AccountState {
  return {profile:{id:'synthetic-demo',wallet:'Fictional account',timezone:'Africa/Lagos',consentVersion:null},balance:{usdc:units('1240.50').toString(),sui:units('2.46',9).toString(),observedAt:now,checkpoint:'100',source:'synthetic',stale:false},plan:{endDate:'2026-11-08',endKind:'income',reserve:units('180').toString(),expectedIncome:units('1600').toString(),timezone:'Africa/Lagos',version:1},movements,annotations,reimbursements:[{id:'synthetic-reimbursement',sourceId:'synthetic-refund',targetId:'synthetic-groceries',amount:units('15').toString(),state:'active',receiptDate:'2026-10-27T10:00:00.000Z'}],commitmentAllocations:[],rules,occurrences:occurrences(rules,'2026-11-08'),coverage:{state:'complete',from:'2026-09-28T12:00:00.000Z',to:now,reason:'Complete fictional dataset only. This is not an imported wallet.'},memories:[],today:'2026-10-28',now,mode:'synthetic',memoryStatus:'Synthetic learning replay. Mainnet writes and recall have not yet been verified.'};
}
export function demoComparison() {
  const state=demoState();
  return {hypothetical:true,provenance:'synthetic_replay',fixedDate:state.today,observedAt:state.balance!.observedAt,withMemory:summarize(state),withoutSelectedLearnedRules:summarize(state,['synthetic-learning-own','synthetic-learning-groceries','synthetic-learning-transport']),eventIds:['synthetic-learning-own','synthetic-learning-groceries','synthetic-learning-transport'],blobIds:[],mainnetVerified:false};
}
