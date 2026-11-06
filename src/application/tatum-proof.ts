import { database } from '@/adapters/postgres/client';
import { TatumChain } from '@/adapters/tatum/chain';
import { chainReadBudget, consumeLimits } from '@/lib/rate-limit';
import { AppError } from '@/lib/security';
import type { Profile } from './auth';

export type TatumProof = {
  checkedAt: string; digest: string; source: 'Tatum Sui Mainnet gRPC';
  stored: { checkpoint: string; status: string; delta: string; coinType: string };
  tatum: { checkpoint: string; status: string; delta: string } | null;
  verdict: 'matches' | 'differs' | 'not_found';
  differences: string[];
};

// Read-only: re-reads one of the signed-in wallet's own stored payments from Tatum's Sui Mainnet gateway by its
// transaction digest and compares what Tatum returns now with what Sui Money saved. Nothing is written.
export async function verifyMovementWithTatum(profile: Profile, movementId: string): Promise<TatumProof> {
  await consumeLimits([{ key: 'tatum-proof:' + profile.id, max: 10, seconds: 60 }]);
  const row = (await database().query('SELECT digest, coin_type, delta::text AS delta, checkpoint::text AS checkpoint, execution_status FROM chain_movements WHERE profile_id=$1 AND id=$2', [profile.id, movementId])).rows[0];
  if (!row) throw new AppError('NOT_FOUND', 404, 'Payment not found.');
  const stored = { checkpoint: row.checkpoint, status: row.execution_status, delta: row.delta, coinType: row.coin_type };
  const chain = new TatumChain(async () => { await chainReadBudget(profile.id); });
  const base = { checkedAt: new Date().toISOString(), digest: row.digest as string, source: 'Tatum Sui Mainnet gRPC' as const, stored };
  try {
    const movements = await chain.transaction(row.digest, profile.wallet);
    const match = movements.find(m => m.coinType === row.coin_type) ?? null;
    if (!match) return { ...base, tatum: null, verdict: 'differs', differences: ['Tatum returned the transaction but no change for this coin.'] };
    const tatum = { checkpoint: match.checkpoint, status: match.status, delta: match.delta };
    const differences = [
      tatum.checkpoint !== stored.checkpoint ? `checkpoint ${tatum.checkpoint} (saved ${stored.checkpoint})` : '',
      tatum.status !== stored.status ? `result ${tatum.status} (saved ${stored.status})` : '',
      tatum.delta !== stored.delta ? `amount ${tatum.delta} (saved ${stored.delta})` : '',
    ].filter(Boolean);
    return { ...base, tatum, verdict: differences.length ? 'differs' : 'matches', differences };
  } catch (e) {
    if ((e as Error).message === 'TATUM_NOT_FOUND') return { ...base, tatum: null, verdict: 'not_found', differences: ['Tatum did not return this transaction.'] };
    throw new AppError('TATUM_UNAVAILABLE', 503, 'Tatum could not be reached just now. Try again in a moment.', true);
  } finally { chain.close(); }
}
