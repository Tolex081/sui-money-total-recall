import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {TatumChain,extractTransaction} from '../src/adapters/tatum/chain';
import {GrpcTypes} from '@mysten/sui/grpc';
import {normalizeStructTag} from '@mysten/sui/utils';
import {USDC_TYPE} from '../src/domain/money';
import type {Movement} from '../src/domain/types';
const chain=new TatumChain(async()=>{await new Promise(r=>setTimeout(r,550));});
try{
  const service=await chain.serviceStatus(),tip=BigInt(service.checkpoint),from=tip-150000n;
  const candidates=new Map<string,{movements:Movement[];incomingFromOther:boolean;outgoing:boolean}>();
  let before:Uint8Array|undefined,scannedTransactions=0,finished=false;
  for(let page=0;page<8&&!finished;page++){
    const stream=chain.client.ledgerService.listTransactions({startCheckpoint:tip-5000n,endCheckpoint:tip+1n,readMask:{paths:['digest','checkpoint','timestamp','transaction','effects.status','effects.gas_used','balance_changes']},options:{limit:100,ordering:GrpcTypes.Ordering.DESCENDING,before}});
    for await(const frame of stream.responses){
      if(frame.watermark?.cursor)before=frame.watermark.cursor;
      if(frame.end?.reason===GrpcTypes.QueryEndReason.CHECKPOINT_BOUND)finished=true;
      const tx=frame.transaction;if(!tx)continue;scannedTransactions++;
      const owners=[...new Set(tx.balanceChanges.filter(c=>c.coinType&&normalizeStructTag(c.coinType)===USDC_TYPE).map(c=>c.address).filter((s):s is string=>!!s))];
      for(const address of owners){
        const m=extractTransaction(tx,address).find(m=>m.coinType===USDC_TYPE&&m.operation==='simple_transfer'&&m.status==='success');if(!m)continue;
        const prior=candidates.get(address)??{movements:[],incomingFromOther:false,outgoing:false};prior.movements.push(m);prior.incomingFromOther||=BigInt(m.delta)>0n&&tx.transaction?.sender!==address;prior.outgoing||=BigInt(m.delta)<0n;candidates.set(address,prior);
      }
    }
    await stream.status;if([...candidates.values()].some(c=>c.incomingFromOther&&c.outgoing))break;
    await new Promise(r=>setTimeout(r,550));
  }
  let report:Record<string,unknown>|null=null;
  const sorted=[...candidates.entries()].sort((a,b)=>Number(b[1].outgoing)-Number(a[1].outgoing)||b[1].movements.length-a[1].movements.length);
  for(const [address,initial] of sorted.slice(0,6)){
    const movements=[...initial.movements];let cursor:string|null=null;const pages:unknown[]=[];
    for(let index=0;index<5;index++){const page=await chain.historyPage({address,fromCheckpoint:from.toString(),toCheckpoint:(tip+1n).toString(),cursor});movements.push(...page.movements);pages.push({count:page.transactionCount,reason:page.reason,cursor:page.continuation,scanned:page.coverage.scannedCheckpoint});cursor=page.continuation;if(!cursor)break;}
    const incoming=movements.find(m=>m.coinType===USDC_TYPE&&m.operation==='simple_transfer'&&m.status==='success'&&BigInt(m.delta)>0n),outgoing=movements.find(m=>m.coinType===USDC_TYPE&&m.operation==='simple_transfer'&&m.status==='success'&&BigInt(m.delta)<0n);
    if(!incoming||!outgoing)continue;
    const direct=[];
    for(const movement of [incoming,outgoing]){
      const call=await chain.client.ledgerService.getTransaction({digest:movement.digest!,readMask:{paths:['digest','checkpoint','timestamp','transaction','effects.status','effects.gas_used','balance_changes']}});
      const tx=call.response.transaction;if(!tx)throw Error('Missing reference transaction');
      const verified=extractTransaction(tx,address).find(m=>m.coinType===USDC_TYPE);if(!verified||verified.status!=='success'||verified.delta!==movement.delta)throw Error('Reference mismatch');
      direct.push({...verified,transactionSender:tx.transaction?.sender??null});
    }
    if(direct[0].transactionSender===address)continue;
    report={checkedAt:new Date().toISOString(),publicReference:true,source:'Actual Tatum Sui Mainnet ListTransactions and GetTransaction responses',referenceAddress:address,transactions:direct,pages,paginationVerified:pages.length>1,incomingNotSentByReference:true,discovery:{scannedTransactions,boundedCheckpoints:5000},queriedBounds:{from:from.toString(),to:(tip+1n).toString()},sources:direct.map(m=>'https://suiscan.xyz/mainnet/tx/'+m.digest),labels:'Public reference transactions; unrelated to the builder wallet and fictional demo finances'};
    const config=parseEnv(await readFile('.env.local','utf8'));config.REFERENCE_SUI_ADDRESS=address;config.REFERENCE_TRANSACTION_DIGESTS=direct.map(m=>m.digest).join(',');await writeFile('.env.local',Object.entries(config).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n');break;
  }
  await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/transfer-reference.json',JSON.stringify(report??{checkedAt:new Date().toISOString(),state:'not_proven',candidateWallets:candidates.size,scannedTransactions,reason:'No ordinary-transfer wallet with both directions established in this bounded discovery and history query.'},null,2));
  console.log(report?'Both ordinary native-USDC transfer directions directly verified; public references configured privately.':'Ordinary-transfer reference remains unverified after the bounded scan.');
}finally{chain.close();}
