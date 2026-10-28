import type { PoolClient } from 'pg';
import { activeEvents,learnedEventSchema,type ConfirmedEvent } from '@/domain/learning';
import { USDC_TYPE } from '@/domain/money';
import { localToday } from '@/domain/planning';
import { AppError,destinationId } from '@/lib/security';
import type { Profile } from './auth';

// Caller holds the profile row lock, shared with memory activation. This checks
// destination rules as well as physical annotations inside the allocation transaction.
export async function assertAllocationPayment(db:PoolClient,profile:Profile,id:string){
  const m=(await db.query('SELECT * FROM chain_movements WHERE profile_id=$1 AND id=$2',[profile.id,id])).rows[0];
  if(!m)throw new AppError('NOT_FOUND',404,'Payment not found.');
  if(m.coin_type!==USDC_TYPE||m.execution_status!=='success'||m.operation!=='simple_transfer')throw new AppError('INELIGIBLE_MOVEMENT',400,'Choose a successful supported native-USDC payment.');
  const rows=(await db.query('SELECT e.envelope,e.available,j.state,j.blob_id,j.recalled_at,j.expires_at FROM learned_events e JOIN memory_jobs j ON j.profile_id=e.profile_id AND j.event_id=e.id WHERE e.profile_id=$1',[profile.id])).rows;
  const confirmed:ConfirmedEvent[]=rows.map(r=>({envelope:learnedEventSchema.parse(r.envelope),available:r.available&&(!r.expires_at||new Date(r.expires_at).getTime()>Date.now()),state:r.state,blobId:r.blob_id,recalledAt:r.recalled_at?new Date(r.recalled_at).toISOString():null}));
  const active=activeEvents(confirmed,profile.id);
  const annotation=(await db.query('SELECT * FROM payment_annotations WHERE profile_id=$1 AND movement_id=$2',[profile.id,id])).rows[0];
  const explicit=annotation&&active.some(e=>e.envelope.eventId===annotation.event_id)?annotation:null;
  const ownRule=!explicit&&BigInt(m.delta)<0n&&m.counterparty&&active.some(({envelope:e})=>e.kind==='own_destination_rule'&&e.payload.ownTransfer&&e.payload.destinationId===destinationId(profile.id,m.counterparty)&&localToday(new Date(m.event_time).toISOString(),profile.timezone)>=e.effectiveFrom);
  if(explicit?.own_transfer||ownRule)throw new AppError('OWN_TRANSFER',409,'Own transfers cannot settle consumption commitments or reimburse expenses. Correct the interpretation first.');
  return m;
}
