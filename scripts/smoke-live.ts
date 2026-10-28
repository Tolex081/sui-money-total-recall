import { mkdir,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { TatumChain } from '../src/adapters/tatum/chain';
import { WalrusMemory,enumerateMetadata } from '../src/adapters/memwal/memory';
import { database } from '../src/adapters/postgres/client';
import { required } from '../src/lib/config';
import { hash } from '../src/lib/security';
const report:{checkedAt:string;environment:string;checks:Record<string,unknown>;complete:boolean}={checkedAt:new Date().toISOString(),environment:'local-authenticated-live',checks:{},complete:false};
const chain=new TatumChain(async()=>{await new Promise(r=>setTimeout(r,550));});
let failed=false;
async function check(name:string,fn:()=>Promise<unknown>){try{const result=await fn();report.checks[name]={state:'passed',result};console.log(name+': passed');return result;}catch(e){failed=true;const error=e as {code?:string;message?:string};const safeCode=error.message?.startsWith('CONFIG_MISSING:')||error.message==='FREE_WRITE_ENTITLEMENT_UNCONFIRMED'?error.message:error.code??'CHECK_FAILED';report.checks[name]={state:'failed',code:safeCode};console.error(name+': failed ('+safeCode+'); no secret details logged.');}}
try{
  const service=await check('tatum-service',()=>chain.serviceStatus());
  await check('coin-metadata',async()=>[await chain.coinMetadata((await import('../src/domain/money')).USDC_TYPE),await chain.coinMetadata((await import('../src/domain/money')).SUI_TYPE)]);
  const reference=required('REFERENCE_SUI_ADDRESS');
  await check('reference-balances',()=>chain.balances(reference));
  const digests=(process.env.REFERENCE_TRANSACTION_DIGESTS??'').split(',').map(s=>s.trim()).filter(Boolean);
  const movements=[];
  for(const digest of digests) {const value=await check('transaction-'+hash(digest).slice(0,8),()=>chain.transaction(digest,reference));if(value)movements.push(...value as Awaited<ReturnType<TatumChain['transaction']>>);}
  if(service){
    const tip=BigInt((service as {checkpoint:string}).checkpoint),lower=movements.length?BigInt(movements[0].checkpoint)>2n?BigInt(movements[0].checkpoint)-2n:0n:tip-1000n;
    const upper=movements.length?BigInt(movements[0].checkpoint)+2n:tip+1n;
    const first=await check('history-page',()=>chain.historyPage({address:reference,fromCheckpoint:lower.toString(),toCheckpoint:upper.toString()}));
    if(first){const page=first as Awaited<ReturnType<TatumChain['historyPage']>>;movements.push(...page.movements);if(page.continuation)await check('history-resume',()=>chain.historyPage({address:reference,fromCheckpoint:lower.toString(),toCheckpoint:upper.toString(),cursor:page.continuation}));}
  }
  const directions={incoming:movements.some(m=>BigInt(m.delta)>0n),outgoing:movements.some(m=>BigInt(m.delta)<0n),referenceAddressHash:hash(reference)};
  report.checks['history-both-directions']={state:directions.incoming&&directions.outgoing?'passed':'unverified',...directions};
  if(!directions.incoming||!directions.outgoing)failed=true;
  const memory=new WalrusMemory(required('MEMWAL_NAMESPACE_DEMO'));
  await check('memory-signed-recall',async()=>{const result=await memory.client.recall({query:'Sui Money synthetic confirmed context',namespace:memory.namespace,limit:5});return {returned:result.results.length,blobIds:result.results.map(r=>r.blob_id)};});
  await check('memory-metadata',async()=>{const rows=await enumerateMetadata(c=>memory.metadataPage(c));return {stored:rows.length,active:rows.filter(r=>r.status==='active'&&(!r.expires_at||new Date(r.expires_at)>new Date())).length,expiry:rows.map(r=>({blobId:r.blob_id,status:r.status,expiresAt:r.expires_at,endEpoch:r.end_epoch}))};});
  await check('postgres-read',async()=>{const r=await database().query('SELECT version FROM schema_migrations ORDER BY version');return {versions:r.rows.map(r=>r.version)};});
  if(process.argv.includes('--write')) {
    const envelope={schemaVersion:1 as const,eventId:'spike-'+randomUUID(),profileId:'synthetic-demo',logicalKey:'spike-preference',revision:1,kind:'planning_preference' as const,recordedAt:new Date().toISOString(),effectiveFrom:'2026-10-28',provenance:'synthetic_demo' as const,sourceRecordIds:['synthetic-plan'],payload:{preference:'reserve' as const,value:'Keep a virtual reserve of 180 USDC'}};
    await check('memory-mainnet-write',async()=>{
      const accepted=await memory.submit(envelope);report.checks['accepted-job']={jobId:accepted.job_id,eventId:envelope.eventId};
      await mkdir('evidence/private',{recursive:true});await writeFile('evidence/private/spike-job.json',JSON.stringify({accepted,envelope},null,2));
      const result=await memory.client.waitForRememberJob(accepted.job_id,{timeoutMs:45000,pollIntervalMs:2500});const recalled=await memory.recallEvent(envelope);
      if(!recalled.some(r=>r.blob_id===result.blob_id))throw Error('RECALL_NOT_CONFIRMED');return {jobId:accepted.job_id,blobId:result.blob_id,eventId:envelope.eventId,recallConfirmed:true};
    });
  }
  report.complete=!failed;
}catch(e){failed=true;report.checks['setup']={state:'failed',code:(e as Error).message.startsWith('CONFIG_MISSING:')?(e as Error).message:'SETUP_FAILED'};}
finally{
  chain.close();await database().end().catch(()=>{});
  await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/live-smoke.json',JSON.stringify(report,(_,v)=>typeof v==='bigint'?v.toString():v,2));
  console.log('Sanitized report: evidence/public/live-smoke.json. Both-direction history and deployed verification remain independent gates.');
  if(failed)process.exitCode=1;
}

