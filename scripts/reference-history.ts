import { mkdir,writeFile } from 'node:fs/promises';
import { TatumChain,extractTransaction } from '../src/adapters/tatum/chain';
import { GrpcTypes } from '@mysten/sui/grpc';
import { normalizeStructTag } from '@mysten/sui/utils';
import { USDC_TYPE } from '../src/domain/money';
import type { Movement } from '../src/domain/types';
const chain=new TatumChain(async()=>{await new Promise(r=>setTimeout(r,550));});
try{
  const info=await chain.serviceStatus(),tip=BigInt(info.checkpoint);
  // Discover public reference facts in a small recent ledger interval, never scan from genesis.
  const call=chain.client.ledgerService.listTransactions({startCheckpoint:tip-200n,endCheckpoint:tip+1n,readMask:{paths:['digest','checkpoint','timestamp','transaction','effects.status','effects.gas_used','balance_changes']},options:{limit:100,ordering:GrpcTypes.Ordering.DESCENDING}});
  const candidates=new Map<string,{movement:Movement;sender:string|null}>();
  let transactionFrames=0,balanceChangeEntries=0;const coinTypes=new Set<string>();let endReason='unknown';
  for await(const frame of call.responses){if(frame.end?.reason!==undefined)endReason=GrpcTypes.QueryEndReason[frame.end.reason];const tx=frame.transaction;if(!tx)continue;transactionFrames++;balanceChangeEntries+=tx.balanceChanges.length;tx.balanceChanges.forEach(c=>{if(c.coinType)coinTypes.add(normalizeStructTag(c.coinType));});const owners=[...new Set(tx.balanceChanges.filter(c=>c.coinType&&normalizeStructTag(c.coinType)===USDC_TYPE).map(c=>c.address).filter((s):s is string=>!!s))];for(const owner of owners){const movement=extractTransaction(tx,owner).find(m=>m.coinType===USDC_TYPE&&m.status==='success');if(movement&&!candidates.has(owner))candidates.set(owner,{movement,sender:tx.transaction?.sender??null});}}
  await call.status;
  let evidence:unknown=null;
  for(const [address,first] of [...candidates.entries()].slice(0,3)){
    const from=tip-50000n,to=tip+1n;
    let cursor:string|null=null;const movements:Movement[]=[];const pages:unknown[]=[];
    for(let page=0;page<3;page++){
      const result=await chain.historyPage({address,fromCheckpoint:from.toString(),toCheckpoint:to.toString(),cursor});movements.push(...result.movements);pages.push({count:result.transactionCount,cursor:result.continuation,complete:result.complete,reason:result.reason,scanned:result.coverage.scannedCheckpoint});cursor=result.continuation;
      if(!cursor)break;
    }
    const incoming=movements.find(m=>m.coinType===USDC_TYPE&&BigInt(m.delta)>0n),outgoing=movements.find(m=>m.coinType===USDC_TYPE&&BigInt(m.delta)<0n);
    if(incoming&&outgoing){evidence={checkedAt:new Date().toISOString(),source:'Tatum gRPC public reference data, unrelated to fictional demo finances',referenceAddress:address,fromCheckpoint:from.toString(),toCheckpoint:to.toString(),discovery:first,movements:[incoming,outgoing],pages,bothDirections:true,paginationVerified:pages.length>1};break;}
  }
  await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/reference-history.json',JSON.stringify(evidence??{checkedAt:new Date().toISOString(),state:'not_proven',candidateCount:candidates.size,discovery:{transactionFrames,balanceChangeEntries,coinTypes:[...coinTypes],endReason},reason:'No reference with both native-USDC directions found in the bounded discovery interval.'},null,2));
  console.log(evidence?'Public reference history proved both directions; inspect sanitized evidence.':'Both directions not established; evidence gate remains open.');
}finally{chain.close();}
