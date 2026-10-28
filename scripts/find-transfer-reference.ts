import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {TatumChain,extractTransaction} from '../src/adapters/tatum/chain';
import {GrpcTypes} from '@mysten/sui/grpc';
import {normalizeStructTag,normalizeSuiAddress} from '@mysten/sui/utils';
import {USDC_TYPE} from '../src/domain/money';
const chain=new TatumChain(async()=>{await new Promise(r=>setTimeout(r,550));});
try{
  const service=await chain.serviceStatus(),tip=BigInt(service.checkpoint),from=tip-2000000n;
  const references=new Map<string,string[]>();
  let streamEnd='unknown';
  const excludedPackages=new Set<string>();
  for(let round=0;round<5&&references.size<4;round++){
    const foreignPackages=new Map<string,number>();
    const literals:GrpcTypes.TransactionLiteral[]=[{negated:false,predicate:{oneofKind:'moveCall',moveCall:{function:normalizeSuiAddress('0x2')+'::balance::send_funds'}}},...[...excludedPackages].map(pkg=>({negated:true,predicate:{oneofKind:'moveCall' as const,moveCall:{function:pkg}}}))];
    const stream=chain.client.ledgerService.listTransactions({startCheckpoint:from,endCheckpoint:tip+1n,readMask:{paths:['digest','checkpoint','timestamp','transaction','effects.status','effects.gas_used','balance_changes']},filter:{terms:[{literals}]},options:{limit:100,ordering:GrpcTypes.Ordering.DESCENDING}});
    for await(const frame of stream.responses){
      if(frame.end?.reason!==undefined)streamEnd=GrpcTypes.QueryEndReason[frame.end.reason];const tx=frame.transaction;if(!tx)continue;
      const data=tx.transaction?.kind?.data;
      if(data?.oneofKind==='programmableTransaction')for(const c of data.programmableTransaction.commands){if(c.command.oneofKind==='moveCall'){const pkg=c.command.moveCall.package;if(pkg&&pkg!==normalizeSuiAddress('0x2'))foreignPackages.set(pkg,(foreignPackages.get(pkg)??0)+1);}}
      const owners=[...new Set(tx.balanceChanges.filter(c=>c.coinType&&normalizeStructTag(c.coinType)===USDC_TYPE).map(c=>c.address).filter((v):v is string=>!!v))];
      for(const address of owners){const m=extractTransaction(tx,address).find(m=>m.coinType===USDC_TYPE&&m.operation==='simple_transfer'&&m.status==='success');if(m)references.set(address,[...(references.get(address)??[]),tx.digest!]);}
    }
    await stream.status;
    for(const [pkg] of [...foreignPackages].sort((a,b)=>b[1]-a[1]).slice(0,2))excludedPackages.add(pkg);
    await new Promise(r=>setTimeout(r,550));
  }
  let report:Record<string,unknown>|null=null;
  for(const address of [...references.keys()].slice(0,5)){
    let cursor:string|null=null;const all:ReturnType<typeof extractTransaction>=[],pages:unknown[]=[];
    for(let index=0;index<4;index++){
      const page=await chain.historyPage({address,fromCheckpoint:from.toString(),toCheckpoint:(tip+1n).toString(),cursor});all.push(...page.movements);pages.push({count:page.transactionCount,reason:page.reason,continuation:page.continuation,scannedCheckpoint:page.coverage.scannedCheckpoint});cursor=page.continuation;if(!cursor)break;
    }
    const incoming=all.find(m=>m.coinType===USDC_TYPE&&m.operation==='simple_transfer'&&m.status==='success'&&BigInt(m.delta)>0n);
    const outgoing=all.find(m=>m.coinType===USDC_TYPE&&m.operation==='simple_transfer'&&m.status==='success'&&BigInt(m.delta)<0n);
    if(!incoming||!outgoing)continue;
    const verified=[];
    for(const m of [incoming,outgoing]){const direct=await chain.transaction(m.digest!,address);const match=direct.find(x=>x.id===m.id);if(!match||match.delta!==m.delta||match.coinType!==USDC_TYPE||match.status!=='success')throw Error('Direct transaction verification mismatch');const raw=await chain.client.ledgerService.getTransaction({digest:m.digest!,readMask:{paths:['digest','transaction.sender','balance_changes','effects.status','checkpoint','timestamp']}});verified.push({...match,transactionSender:raw.response.transaction?.transaction?.sender??null});}
    if(verified[0].transactionSender===address)continue;
    report={checkedAt:new Date().toISOString(),source:'Actual Tatum gRPC Mainnet ledger and transaction responses',publicReference:true,unrelatedToUserWallet:true,unrelatedToSyntheticFinances:true,referenceAddress:address,transactions:verified,pages,paginationVerified:pages.length>1,incomingNotSentByReference:true,discoveryFilter:'0x2::balance::send_funds',queriedBounds:{from:from.toString(),to:(tip+1n).toString()},sources:verified.map(m=>'https://suiscan.xyz/mainnet/tx/'+m.digest)};
    const config=parseEnv(await readFile('.env.local','utf8'));config.REFERENCE_SUI_ADDRESS=address;config.REFERENCE_TRANSACTION_DIGESTS=[incoming.digest,outgoing.digest].join(',');await writeFile('.env.local',Object.entries(config).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n');break;
  }
  await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/transfer-reference.json',JSON.stringify(report??{checkedAt:new Date().toISOString(),state:'not_proven',candidateWallets:references.size,streamEnd,reason:'No both-direction simple native-USDC reference verified in this bounded scan.'},null,2));
  console.log(report?'Verified public native-USDC transfers in both directions, including a non-sender incoming payment; private reference configuration updated.':'Bounded simple-transfer search did not establish both directions.');
}finally{chain.close();}
