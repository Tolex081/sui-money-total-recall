export type Coverage = { state: 'complete' | 'partial' | 'not_synced' | 'unavailable'; from: string | null; to: string | null; reason: string; cursor?: string | null; scannedCheckpoint?: string | null };
export type Movement = {
  id: string; digest: string | null; owner: string; coinType: string; delta: string;
  checkpoint: string; timestamp: string; status: 'success' | 'failed';
  operation: 'simple_transfer' | 'complex'; counterparty: string | null;
  gasPaid: string; gasCredit?: string; gasNet?: string; source: 'tatum' | 'synthetic';
};
export type Annotation = { movementId: string; category: string; note: string; ownTransfer: boolean; eventId?: string };
export type Allocation = { id: string; sourceId: string; targetId: string; amount: string; state: 'pending' | 'active' | 'reversed'; receiptDate?: string; checkpoint?: string };
export type Occurrence = { id: string; ruleId: string; dueDate: string; alias: string; category: string; amount: string; cancelled: boolean; learnedEventId?: string };
export type Plan = { endDate: string | null; endKind: 'income' | 'planning'; reserve: string; timezone: string; version: number; expectedIncome: string | null };
export type Balance = { usdc: string; sui: string; observedAt: string; checkpoint: string | null; source: 'tatum' | 'synthetic'; stale: boolean };
export type CommitmentRule = { id: string; alias: string; amount: string; category: string; startDate: string; frequency: 'once' | 'weekly' | 'monthly'; dayOfMonth?: number; effectiveFrom: string; endDate?: string; cancelled?: boolean; learnedEventId?: string; destination?: string | null };
