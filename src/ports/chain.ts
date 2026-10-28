import type { Balance, Coverage, Movement } from '@/domain/types';
export type ServiceObservation = { network: 'mainnet'; chainId: string; checkpoint: string; observedAt: string; lowestCheckpoint: string | null; lowestTransactionCheckpoint: string | null };
export type HistoryRequest = { address: string; fromCheckpoint: string; toCheckpoint: string; cursor?: string | null };
export type HistoryPage = { movements: Movement[]; coverage: Coverage; continuation: string | null; complete: boolean; reason: string; transactionCount: number };
export interface ChainPort {
  serviceStatus(): Promise<ServiceObservation>;
  coinMetadata(coinType: string): Promise<{ coinType: string; decimals: number; symbol: string }>;
  balances(address: string): Promise<Balance>;
  transaction(digest: string, owner: string): Promise<Movement[]>;
  historyPage(input: HistoryRequest): Promise<HistoryPage>;
}
