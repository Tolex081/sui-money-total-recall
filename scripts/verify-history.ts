import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {TatumChain} from '../src/adapters/tatum/chain';
import {USDC_TYPE} from '../src/domain/money';
import type {Movement} from '../src/domain/types';
type Reference={referenceAddress:string;transactions:Movement[];queriedBounds:{from:string;to:string}};
const reference:Reference=JSON.parse(await readFile('evidence/public/transfer-reference.json','utf8'));
assert.equal(reference.transactions.length,2);
const checkpoints=reference.transactions.map(m=>BigInt(m.checkpoint)).sort((a,b)=>a<b?-1:1);
assert.ok(BigInt(reference.queriedBounds.from)<=checkpoints[0]&&BigInt(reference.queriedBounds.to)>checkpoints.at(-1)!);
const request={address:reference.referenceAddress,fromCheckpoint:reference.queriedBounds.from,toCheckpoint:reference.queriedBounds.to};
let providerAttempts=0;
const chain=new TatumChain(async()=>{if(++providerAttempts>16)throw Error('READ_BUDGET_EXCEEDED');await new Promise(resolve=>setTimeout(resolve,650));});
try{
 const service=await chain.serviceStatus();
 assert.equal(service.network,'mainnet');
 const pages:{reason:string;transactionCount:number;movementCount:number;complete:boolean;cursorAdvanced:boolean}[]=[],movements=new Map<string,Movement>();
 let cursor:string|null=null,complete=false,firstIds:string[]=[];
 for(let index=0;index<4;index++){
  const page=await chain.historyPage({...request,cursor});
  if(index===0)firstIds=page.movements.map(m=>m.id).sort();
  const cursorAdvanced=page.continuation!==null&&page.continuation!==cursor;
  if(!page.complete)assert.equal(cursorAdvanced,true);
  pages.push({reason:page.reason,transactionCount:page.transactionCount,movementCount:page.movements.length,complete:page.complete,cursorAdvanced});
  for(const m of page.movements)movements.set(m.id,m);
  if(page.complete){complete=true;break;}cursor=page.continuation;
 }
 assert.equal(complete,true,'Bounded reference history did not complete within the reviewed request budget');
 assert.ok(pages.length>=2,'The reviewed public reference window must exercise real cursor resume');
 const repeated=await chain.historyPage(request);assert.deepEqual(repeated.movements.map(m=>m.id).sort(),firstIds);
 const transactions=reference.transactions.map(expected=>{
  const actual=[...movements.values()].find(m=>m.digest===expected.digest&&m.coinType===USDC_TYPE);
  assert.ok(actual);assert.equal(actual.delta,expected.delta);assert.equal(actual.status,'success');assert.equal(actual.operation,'simple_transfer');
  return {digest:actual.digest,coinType:actual.coinType,delta:actual.delta,checkpoint:actual.checkpoint,status:actual.status};
 });
 assert.ok(transactions.some(m=>BigInt(m.delta)>0n)&&transactions.some(m=>BigInt(m.delta)<0n));
 const report={checkedAt:new Date().toISOString(),source:'Actual Tatum Mainnet bounded history through retry-aware adapter',publicReference:true,unrelatedToUserWallet:true,unrelatedToSyntheticFinances:true,referenceAddress:reference.referenceAddress,bounds:request,pages,complete,bothDirectionsVerified:true,repeatedFirstPageStable:true,distinctMovementCount:movements.size,distinctTransactionCount:new Set([...movements.values()].map(m=>m.digest)).size,transactions,providerAttempts,maximumProviderAttempts:16,mainnetWrites:0,failureRecoveryEvidence:'Transient throttling/timeouts, authentication/retention errors, stream interruption and stalled cursors are explicit protobuf/gRPC fixture tests in tests/tatum-adapter.test.ts. No real outage or throttle was induced.'};
 await writeFile('evidence/public/history-recovery.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({complete,pages:pages.length,bothDirectionsVerified:true,repeatedFirstPageStable:true,providerAttempts,mainnetWrites:0}));
}catch(error){console.error('Read-only history verification failed:',error instanceof Error&&'code' in error?error.code:'CHECK_FAILED');process.exitCode=1;}finally{chain.close();}
