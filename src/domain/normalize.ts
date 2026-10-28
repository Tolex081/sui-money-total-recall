import { integer, SUI_TYPE, USDC_TYPE } from './money';
import type { Movement } from './types';
// Adapter-owned extraction supplies these fields after checking installed protobuf types.
export type ExtractedTransaction = { digest: string; checkpoint: string; timestamp: string; success: boolean; simple: boolean; changes: { owner: string; coinType: string; amount: string; entryId?: string }[]; counterparty: string | null; gasOwner: string | null; gasCost: string };
export function normalize(tx: ExtractedTransaction, owner: string): Movement[] {
  const totals = new Map<string, bigint>();
  const seen = new Set<string>();
  for (const change of tx.changes) {
    if (change.owner !== owner) continue;
    // Only deduplicate entries with an explicit stable provenance ID. Equal-valued distinct changes must sum.
    if (change.entryId && seen.has(change.entryId)) continue;
    if (change.entryId) seen.add(change.entryId);
    totals.set(change.coinType, (totals.get(change.coinType) ?? 0n) + integer(change.amount));
  }
  const gasNet=tx.gasOwner===owner?integer(tx.gasCost):0n;
  return [...totals.entries()].map(([coinType, delta]) => ({ id: `${tx.digest}:${owner}:${coinType}`, digest: tx.digest, owner, coinType, delta: delta.toString(), checkpoint: tx.checkpoint, timestamp: tx.timestamp, status: tx.success ? 'success' : 'failed', operation: tx.simple && (coinType === USDC_TYPE || coinType === SUI_TYPE) ? 'simple_transfer' : 'complex', counterparty: tx.counterparty, gasPaid:(gasNet>0n?gasNet:0n).toString(),gasCredit:(gasNet<0n?-gasNet:0n).toString(),gasNet:gasNet.toString(),source: 'tatum' }));
}
