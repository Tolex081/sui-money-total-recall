import { database, transaction } from '@/adapters/postgres/client';
import { TatumChain } from '@/adapters/tatum/chain';
import { chainReadBudget, consumeLimits } from '@/lib/rate-limit';
import { recordBalance } from './state';
import type { Profile } from './auth';
import { AppError } from '@/lib/security';
type BoundsSearch={lo:string;hi:string;target:string;tip:string;fromTime:string;toTime:string;floor:string};
// One request performs at most two binary-search probes or one stream page. Progress survives process restart.
export async function syncWallet(profile:Profile,kind:'balances'|'history') {
  await consumeLimits([{key:`sync:${profile.id}`,max:1,seconds:4}]);
  const chain=new TatumChain(async()=>{await new Promise(resolve=>setTimeout(resolve,550));await chainReadBudget(profile.id);});
  try {
    if(kind==='balances'){const balance=await chain.balances(profile.wallet);await recordBalance(profile.id,balance);return {balance,saved:true};}
    const saved=(await database().query('SELECT * FROM sync_progress WHERE profile_id=$1',[profile.id])).rows[0];
    if(!saved || saved.coverage.state==='complete') {
      const service=await chain.serviceStatus();
      if(service.lowestCheckpoint===null)throw new AppError('RETENTION_UNKNOWN',503,'History retention has not been established.',true);
      const toTime=new Date().toISOString(),fromTime=new Date(Date.now()-30*86400000).toISOString();
      const search:BoundsSearch={lo:service.lowestCheckpoint,hi:service.checkpoint,target:fromTime,tip:(BigInt(service.checkpoint)+1n).toString(),fromTime,toTime,floor:service.lowestCheckpoint};
      await database().query(`INSERT INTO sync_progress(profile_id,filter_version,cursor,coverage) VALUES($1,1,NULL,$2) ON CONFLICT(profile_id) DO UPDATE SET cursor=NULL,coverage=$2,version=sync_progress.version+1`,[profile.id,{state:'partial',from:fromTime,to:toTime,reason:'Resolving the 30-day checkpoint boundary.',search}]);
      return {state:'partial',reason:'History bounds search started. Continue import.'};
    }
    if(saved.coverage.search) {
      const search:BoundsSearch=saved.coverage.search;
      for(let i=0;i<2&&BigInt(search.lo)<BigInt(search.hi);i++) {
        const mid=(BigInt(search.lo)+BigInt(search.hi))/2n;
        const observed=await chain.checkpointTime(mid.toString());
        if(observed<search.target)search.lo=(mid+1n).toString();else search.hi=mid.toString();
      }
      let coverage:Record<string,unknown>={...saved.coverage,search};
      if(search.lo===search.hi){const floorTime=await chain.checkpointTime(search.floor);coverage={state:'partial',from:floorTime>search.fromTime?floorTime:search.fromTime,to:search.toTime,reason:floorTime>search.fromTime?'Retention does not cover the full requested 30 days.':'Bounded history ready.',retentionGap:floorTime>search.fromTime};}
      const updated=await database().query('UPDATE sync_progress SET from_checkpoint=$3,to_checkpoint=$4,coverage=$5,version=version+1,updated_at=now() WHERE profile_id=$1 AND version=$2',[profile.id,saved.version,search.lo,search.tip,coverage]);
      if(!updated.rowCount)throw new AppError('SYNC_CONFLICT',409,'Another tab advanced the import. Refresh and continue.');
      return coverage;
    }
    const page=await chain.historyPage({address:profile.wallet,fromCheckpoint:saved.from_checkpoint,toCheckpoint:saved.to_checkpoint,cursor:saved.cursor});
    return transaction(async db=>{
      const current=(await db.query('SELECT version FROM sync_progress WHERE profile_id=$1 FOR UPDATE',[profile.id])).rows[0];
      if(current.version!==saved.version)throw new AppError('SYNC_CONFLICT',409,'Another tab advanced the import.');
      for(const movement of page.movements) await db.query(`INSERT INTO chain_movements(profile_id,id,digest,coin_type,delta,checkpoint,event_time,execution_status,operation,counterparty,facts,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'tatum') ON CONFLICT(profile_id,id) DO NOTHING`,[profile.id,movement.id,movement.digest,movement.coinType,movement.delta,movement.checkpoint,movement.timestamp,movement.status,movement.operation,movement.counterparty,movement]);
      const coverage={...page.coverage,from:saved.coverage.from,to:saved.coverage.to,state:page.complete&&!saved.coverage.retentionGap?'complete':'partial',retentionGap:saved.coverage.retentionGap,reason:saved.coverage.retentionGap?'Imported available range; requested period has a retention gap.':page.reason};
      await db.query('UPDATE sync_progress SET cursor=$2,scanned_checkpoint=$3,coverage=$4,version=version+1,updated_at=now() WHERE profile_id=$1',[profile.id,page.continuation,page.coverage.scannedCheckpoint,coverage]);
      return {coverage,imported:page.movements.length,hasMore:!!page.continuation};
    });
  }finally{chain.close();}
}
