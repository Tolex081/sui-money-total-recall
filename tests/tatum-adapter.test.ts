import {it,expect} from 'vitest';
import {GrpcTypes} from '@mysten/sui/grpc';
import {normalizeSuiAddress} from '@mysten/sui/utils';
import {extractTransaction,collectHistoryPage} from '@/adapters/tatum/chain';
import {readTatum} from '@/adapters/tatum/read';
import {AppError} from '@/lib/security';
import {USDC_TYPE,SUI_TYPE} from '@/domain/money';
const owner=normalizeSuiAddress('0x1'),destination=normalizeSuiAddress('0x2'),third=normalizeSuiAddress('0x3');
function fixture(){return GrpcTypes.ExecutedTransaction.create({digest:'explicit-protobuf-test-fixture',checkpoint:100n,timestamp:{seconds:1793188800n,nanos:0},effects:{status:{success:true},gasUsed:{computationCost:100n,storageCost:0n,storageRebate:0n}},transaction:{gasPayment:{owner},kind:{data:{oneofKind:'programmableTransaction',programmableTransaction:{inputs:[],commands:[{command:{oneofKind:'transferObjects',transferObjects:{objects:[]}}}]}}}},balanceChanges:[{address:owner,coinType:USDC_TYPE,amount:'-40000000'},{address:destination,coinType:USDC_TYPE,amount:'40000000'},{address:owner,coinType:SUI_TYPE,amount:'-100'}]});}
it('F11 protobuf adapter supports ordinary two-owner transfers and marks failed execution',()=>{const tx=fixture(),m=extractTransaction(tx,owner).find(m=>m.coinType===USDC_TYPE)!;expect(m.operation).toBe('simple_transfer');expect(m.counterparty).toBe(destination);expect(m.delta).toBe('-40000000');tx.effects!.status!.success=false;expect(extractTransaction(tx,owner)[0].status).toBe('failed');});
it('F11 protobuf multi-recipient, bridged lookalike and arbitrary Move calls stay review-only',()=>{
  const multiple=fixture();multiple.balanceChanges[1].amount='25000000';multiple.balanceChanges.push(GrpcTypes.BalanceChange.create({address:third,coinType:USDC_TYPE,amount:'15000000'}));expect(extractTransaction(multiple,owner).every(m=>m.operation==='complex')).toBe(true);
  const bridged=fixture();bridged.balanceChanges.forEach(c=>{if(c.coinType===USDC_TYPE)c.coinType='0x'+ '4'.repeat(64)+'::usdc::USDC';});expect(extractTransaction(bridged,owner).every(m=>m.operation==='complex')).toBe(true);
  const arbitrary=fixture();const data=arbitrary.transaction!.kind!.data;if(data?.oneofKind!=='programmableTransaction')throw Error('Fixture kind');data.programmableTransaction.commands=[GrpcTypes.Command.create({command:{oneofKind:'moveCall',moveCall:{package:third,module:'pool',function:'swap',typeArguments:[USDC_TYPE],arguments:[]}}})];expect(extractTransaction(arbitrary,owner).every(m=>m.operation==='complex')).toBe(true);
});
it('F11 protobuf sponsor-paid gas is zero for the tracked wallet',()=>{const tx=fixture();tx.transaction!.gasPayment!.owner=third;tx.balanceChanges=tx.balanceChanges.filter(c=>c.coinType===USDC_TYPE);expect(extractTransaction(tx,owner)[0].gasPaid).toBe('0');});
it('F22 repeated protobuf net-change entries never double count; conflicting entries fail closed',()=>{const tx=fixture();tx.balanceChanges.push(tx.balanceChanges[0],tx.balanceChanges[1]);const first=extractTransaction(tx,owner).find(m=>m.coinType===USDC_TYPE)!;expect(first.delta).toBe('-40000000');tx.balanceChanges.reverse();expect(extractTransaction(tx,owner).find(m=>m.coinType===USDC_TYPE)!.id).toBe(first.id);tx.balanceChanges.push(GrpcTypes.BalanceChange.create({address:owner,coinType:USDC_TYPE,amount:'-1'}));expect(()=>extractTransaction(tx,owner)).toThrow('conflictingNetBalanceChange');});

it('G03 transient gRPC throttling retries once with jitter and charges both attempts to the read budget',async()=>{
  let attempts=0,budget=0;const delays:number[]=[];
  const result=await readTatum(async()=>{if(++attempts===1)throw Object.assign(new Error('fixture throttle'),{code:'RESOURCE_EXHAUSTED'});return 'verified-read';},async()=>{budget++;},{random:()=>0.5,sleep:async ms=>{delays.push(ms);}});
  expect(result).toBe('verified-read');expect(attempts).toBe(2);expect(budget).toBe(2);expect(delays).toEqual([375]);
});
it('G03 exhausted transient reads are bounded and authentication/retention errors never retry',async()=>{
  for(const [code,expected,attemptsExpected] of [['RESOURCE_EXHAUSTED','TATUM_RATE_LIMITED',2],['UNAVAILABLE','TATUM_UNAVAILABLE',2],['DEADLINE_EXCEEDED','TATUM_UNAVAILABLE',2],['UNAUTHENTICATED','TATUM_AUTH_UNAVAILABLE',1],['PERMISSION_DENIED','TATUM_AUTH_UNAVAILABLE',1],['NOT_FOUND','TATUM_RECORD_UNAVAILABLE',1],['OUT_OF_RANGE','TATUM_RECORD_UNAVAILABLE',1]] as const){
    let attempts=0;await expect(readTatum(async()=>{attempts++;throw Object.assign(new Error('explicit provider-error fixture'),{code});},async()=>{},{sleep:async()=>{}})).rejects.toMatchObject({code:expected});expect(attempts).toBe(attemptsExpected);
  }
});
it('G03 numeric native gRPC statuses work and local request-budget rejection never calls the provider',async()=>{
  let attempts=0;expect(await readTatum(async()=>{if(++attempts===1)throw Object.assign(new Error('native transport fixture'),{code:14});return 5;},async()=>{},{sleep:async()=>{}})).toBe(5);
  let calls=0;await expect(readTatum(async()=>{calls++;return 1;},async()=>{throw new AppError('RATE_LIMITED',429,'test budget');})).rejects.toMatchObject({code:'RATE_LIMITED'});expect(calls).toBe(0);
});
const historyRequest={address:owner,fromCheckpoint:'1',toCheckpoint:'200',cursor:'b2xk'};
async function* frames(...values:GrpcTypes.ListTransactionsResponse[]){for(const value of values)yield value;}
it('F13 empty filtered SCAN_LIMIT advances its real cursor without claiming complete coverage',async()=>{
  const page=await collectHistoryPage(historyRequest,frames(GrpcTypes.ListTransactionsResponse.create({watermark:{cursor:new Uint8Array([1,2,3]),checkpoint:90n},end:{reason:GrpcTypes.QueryEndReason.SCAN_LIMIT}})),Promise.resolve({code:'OK'}));
  expect(page.movements).toEqual([]);expect(page.continuation).toBe('AQID');expect(page.complete).toBe(false);expect(page.coverage.scannedCheckpoint).toBe('90');
  const end=await collectHistoryPage({...historyRequest,cursor:page.continuation},frames(GrpcTypes.ListTransactionsResponse.create({end:{reason:GrpcTypes.QueryEndReason.CHECKPOINT_BOUND}})),Promise.resolve({code:'OK'}));expect(end.complete).toBe(true);expect(end.continuation).toBe(null);
});
it('G03 interruption discards partial movements/cursor and retries from the original saved frontier',async()=>{
  let attempts=0;const frontiers:string[]=[];
  const page=await readTatum(async()=>{
    attempts++;frontiers.push(historyRequest.cursor);
    if(attempts===1){async function* interrupted(){yield GrpcTypes.ListTransactionsResponse.create({transaction:fixture(),watermark:{cursor:new Uint8Array([9]),checkpoint:100n}});throw Object.assign(new Error('explicit interrupted stream fixture'),{code:'UNAVAILABLE'});}return collectHistoryPage(historyRequest,interrupted(),Promise.reject(Object.assign(new Error('fixture status'),{code:'UNAVAILABLE'})));}
    return collectHistoryPage(historyRequest,frames(GrpcTypes.ListTransactionsResponse.create({end:{reason:GrpcTypes.QueryEndReason.CHECKPOINT_BOUND}})),Promise.resolve({code:'OK'}));
  },async()=>{},{sleep:async()=>{}});
  expect(attempts).toBe(2);expect(frontiers).toEqual(['b2xk','b2xk']);expect(page.movements).toEqual([]);expect(page.complete).toBe(true);
});
it('F13 a terminal frame cannot override a failed final transport status or a stalled cursor',async()=>{
  await expect(collectHistoryPage(historyRequest,frames(GrpcTypes.ListTransactionsResponse.create({transaction:fixture(),end:{reason:GrpcTypes.QueryEndReason.CHECKPOINT_BOUND}})),Promise.resolve({code:'UNAVAILABLE'}))).rejects.toMatchObject({code:'UNAVAILABLE'});
  await expect(collectHistoryPage(historyRequest,frames(GrpcTypes.ListTransactionsResponse.create({end:{reason:GrpcTypes.QueryEndReason.SCAN_LIMIT}})),Promise.resolve({code:'OK'}))).rejects.toMatchObject({code:'TATUM_CURSOR_STALLED'});
});
