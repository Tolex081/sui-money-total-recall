import { integer, sum, SUI_TYPE, USDC_TYPE } from './money';
import { planning } from './planning';
import { occurrences } from './recurrence';
import type { Annotation, Balance, Movement, Occurrence, Plan } from './types';

// The SUI budget mirrors the USDC plan in SUI's own units (9 decimals). There is no price conversion: SUI and USDC
// are budgeted side by side, never added together. It shares the USDC plan's end date.
export type SuiBill = { id: string; alias: string; amount: string; startDate: string; frequency: 'once' | 'weekly' | 'monthly'; paidDates: string[] };
export type SuiBudget = { reserve: string; version: number; bills: SuiBill[] };
export const emptySuiBudget: SuiBudget = { reserve: '0', version: 0, bills: [] };

// Bills count from the day they were added, and a paid occurrence stops counting.
export function suiOccurrences(bills: SuiBill[], through: string): Occurrence[] {
  const rules = bills.map(b => ({ id: b.id, alias: b.alias, amount: b.amount, category: 'SUI', startDate: b.startDate, frequency: b.frequency, effectiveFrom: b.startDate }));
  return occurrences(rules, through).map(o => ({ ...o, cancelled: bills.find(b => b.id === o.ruleId)!.paidDates.includes(o.dueDate) }));
}

export function suiPlanning(input: { balance: Balance | null; plan: Plan; budget: SuiBudget; today: string }) {
  const { balance, plan, budget, today } = input;
  const through = plan.endDate ?? today;
  return planning({ balance: balance ? { ...balance, usdc: balance.sui } : null, plan: { ...plan, reserve: budget.reserve }, today, occurrences: suiOccurrences(budget.bills, through), allocations: [] });
}

// SUI spent: settled plain SUI payments out of this wallet, without the network fee, excluding transfers to the
// user's own wallets and the SUI row that is only the gas for a USDC payment.
export function suiSpending(movements: Movement[], annotations: Annotation[], period: { from: string; to: string }) {
  const unique = [...new Map(movements.map(m => [m.id, m])).values()];
  const usdcDigests = new Set(unique.filter(m => m.coinType === USDC_TYPE).map(m => m.digest));
  const rows = unique.filter(m => m.coinType === SUI_TYPE && m.status === 'success' && m.operation === 'simple_transfer' && integer(m.delta) < 0n && !usdcDigests.has(m.digest) && m.timestamp >= period.from && m.timestamp < period.to && !annotations.find(a => a.movementId === m.id)?.ownTransfer)
    .map(m => ({ movement: m, spent: -integer(m.delta) - integer(m.gasNet ?? m.gasPaid ?? '0') }))
    .filter(r => r.spent > 0n);
  return { spent: sum(rows.map(r => r.spent)), rows };
}
