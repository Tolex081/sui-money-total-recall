import { learnedEventSchema,type LearnedEvent } from './learning';
import { units } from './money';
export function seedEvents(recordedAt:string):LearnedEvent[]{
  const events:LearnedEvent[]=[];
  function add(id:string,kind:LearnedEvent['kind'],payload:unknown,sources:string[],logicalKey=id,supersedesEventId?:string,revision=1){events.push(learnedEventSchema.parse({schemaVersion:1,eventId:'sm-demo-v1-'+id,profileId:'synthetic-demo',logicalKey,revision,recordedAt,effectiveFrom:'2026-10-28',provenance:'synthetic_demo',sourceRecordIds:sources,kind,payload,supersedesEventId}));}
  for(const [id,category,note] of [['lunch','Food','Lunch with a friend'],['groceries','Groceries','Shared grocery shop'],['book','Learning','A new book'],['transport-1','Transport','First weekly transport'],['transport-2','Transport','Second weekly transport'],['transport-3','Transport','Third weekly transport']])add('explanation-'+id,'payment_explanation',{movementId:'synthetic-'+id,category,note,ownTransfer:false},['synthetic-'+id]);
  for(const [id,category] of [['market','Groceries'],['transport','Transport'],['cafe','Food']])add('category-'+id,'category_rule',{destinationId:'synthetic-'+id,category},['synthetic-'+(id==='cafe'?'lunch':id==='market'?'groceries':'transport-3')]);
  add('own-destination','own_destination_rule',{destinationId:'synthetic-second-wallet',ownTransfer:true},['synthetic-own']);
  add('reimbursement-one','reimbursement_link',{allocationIds:['synthetic-allocation-ten']},['synthetic-refund','synthetic-groceries']);
  add('reimbursement-two','reimbursement_link',{allocationIds:['synthetic-allocation-five']},['synthetic-refund','synthetic-groceries']);
  for(const [id,alias,amount,category,nextDate] of [['groceries','Weekly groceries','45','Groceries','2026-10-30'],['transport','Weekly transport','25','Transport','2026-10-29'],['book','Weekly learning','12','Learning','2026-10-31']])add('recurring-'+id,'recurrence_confirmation',{ruleId:'synthetic-weekly-'+id,alias,amount:units(amount).toString(),category,nextDate,frequency:'weekly'},['synthetic-'+(id==='transport'?'transport-3':id)]);
  for(const [id,preference,value] of [['reserve','reserve','Keep a virtual reserve of 180 USDC'],['horizon','horizon','Plan until the next expected income date'],['category','category','Keep unknown spending visible until explained']])add('preference-'+id,'planning_preference',{preference,value},['synthetic-plan']);
  add('correct-category','correction',{targetKind:'annotation',value:{movementId:'synthetic-book',category:'Learning',note:'A new book for learning',ownTransfer:false}},['synthetic-book'],'explanation-book','sm-demo-v1-explanation-book',2);
  add('correct-transport','correction',{targetKind:'recurrence',value:{ruleId:'synthetic-weekly-transport',alias:'Weekly transport',amount:units('22').toString(),category:'Transport',nextDate:'2026-10-29',frequency:'weekly'}},['synthetic-transport-3'],'recurring-transport','sm-demo-v1-recurring-transport',2);
  add('correct-note','correction',{targetKind:'annotation',value:{movementId:'synthetic-lunch',category:'Food',note:'Shared lunch was a one-time payment',ownTransfer:false}},['synthetic-lunch'],'explanation-lunch','sm-demo-v1-explanation-lunch',2);
  add('correct-allocation','correction',{targetKind:'reimbursement',value:{reverseIds:['synthetic-allocation-five']}},['synthetic-refund','synthetic-groceries'],'reimbursement-two','sm-demo-v1-reimbursement-two',2);
  add('disable-category-cafe','deactivation',{reason:'One lunch does not establish a future category rule'},['synthetic-lunch'],'category-cafe','sm-demo-v1-category-cafe',2);
  add('disable-recurring-book','deactivation',{reason:'A one-time book is not a weekly commitment'},['synthetic-book'],'recurring-book','sm-demo-v1-recurring-book',2);
  return events;
}
