import { NextResponse } from 'next/server';
import { TatumChain } from '@/adapters/tatum/chain';
import { WalrusMemory } from '@/adapters/memwal/memory';
import { database } from '@/adapters/postgres/client';
import { required } from '@/lib/config';
import { equalSecret,hash } from '@/lib/security';
import { consumeLimits } from '@/lib/rate-limit';
import { learnedEventSchema } from '@/domain/learning';
import { USDC_TYPE } from '@/domain/money';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  const secret=process.env.INTERNAL_ADMIN_SECRET;
  if(!secret||!equalSecret(request.headers.get('x-internal-admin')??'',secret))return NextResponse.json({error:'Not found'},{status:404});
  await consumeLimits([{key:'internal:spike',max:1,seconds:60}]);
  const chain=new TatumChain(async()=>{await new Promise(r=>setTimeout(r,550));});
  try{
    const service=await chain.serviceStatus(),reference=required('REFERENCE_SUI_ADDRESS'),balance=await chain.balances(reference);
    const digests=required('REFERENCE_TRANSACTION_DIGESTS').split(',').map(s=>s.trim());
    if(digests.length!==2)throw Error('Two verified public reference digests are required.');
    const transactions=[];
    for(const digest of digests)transactions.push(...(await chain.transaction(digest,reference)).filter(m=>m.coinType===USDC_TYPE));
    const bothDirectionsVerified=transactions.some(m=>m.status==='success'&&m.operation==='simple_transfer'&&BigInt(m.delta)>0n)&&transactions.some(m=>m.status==='success'&&m.operation==='simple_transfer'&&BigInt(m.delta)<0n);
    if(!bothDirectionsVerified)throw Error('Public reference transaction verification failed.');
    const memory=new WalrusMemory(required('MEMWAL_NAMESPACE_DEMO'));
    const recall=await memory.client.recall({query:'Sui Money synthetic planning preference',namespace:memory.namespace,limit:5});
    const safe=recall.results.filter(r=>{try{return learnedEventSchema.parse(JSON.parse(r.text)).provenance==='synthetic_demo';}catch{return false;}});
    const result={checkedAt:new Date().toISOString(),environment:process.env.VERCEL_ENV??'local',commit:process.env.BUILD_SOURCE_REVISION||process.env.VERCEL_GIT_COMMIT_SHA||'uncommitted',runtime:{node:process.version,platform:process.platform,arch:process.arch},tatum:{state:'passed',service,referenceAddressHash:hash(reference),balance,publicReferenceTransactions:transactions,bothDirectionsVerified},walrus:{state:'authenticated_recall_passed',syntheticBlobIds:safe.map(r=>r.blob_id),totalReturned:recall.results.length},database:{state:'write_read_pending'}};
    await database().query("INSERT INTO public_proof(id,payload,checked_at) VALUES('integrations',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,checked_at=now()",[result]);
    const persisted=(await database().query("SELECT payload FROM public_proof WHERE id='integrations'")).rows[0];
    if(persisted.payload.checkedAt!==result.checkedAt)throw Error('DB_ROUNDTRIP_FAILED');
    result.database.state='write_read_passed';await database().query("UPDATE public_proof SET payload=$1 WHERE id='integrations'",[result]);
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:'Integration spike failed',code:(error as {code?:string}).code??'INTEGRATION_FAILED'},{status:503});}
  finally{chain.close();}
}
