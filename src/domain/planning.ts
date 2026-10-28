import { Temporal } from '@js-temporal/polyfill';
import { integer, max, sum } from './money';
import type { Allocation, Balance, Occurrence, Plan } from './types';
export function localToday(instant: string, timezone: string) { return Temporal.Instant.from(instant).toZonedDateTimeISO(timezone).toPlainDate().toString(); }
export function horizon(today: string, endDate: string | null): number | null {
  if (!endDate) return null;
  try { const days = Temporal.PlainDate.from(today).until(Temporal.PlainDate.from(endDate)).days; return days > 0 && days <= 90 ? days : null; } catch { return null; }
}
export function planning(input: { balance: Balance | null; plan: Plan; today: string; occurrences: Occurrence[]; allocations: Allocation[] }) {
  const { balance, plan, today, allocations } = input;
  const days = horizon(today, plan.endDate);
  if (!balance) return { state: 'unknown_balance' as const, reason: 'A verified balance is required.', days };
  if (days === null) return { state: 'incomplete' as const, reason: 'Choose a future end date within 90 local calendar days.', days };
  const eligible = [...new Map(input.occurrences.map(o => [o.id, o])).values()].filter(o => !o.cancelled && o.dueDate < plan.endDate!);
  const rows = eligible.map(o => {
    const paid = allocations.filter(a => a.targetId === o.id && a.state === 'active');
    const inconsistent = paid.some(a => !a.checkpoint || !balance.checkpoint || integer(a.checkpoint) > integer(balance.checkpoint));
    const paidAmount = sum(paid.map(a => integer(a.amount)));
    if (paidAmount > integer(o.amount)) throw new Error('Commitment over-allocation.');
    return { ...o, outstanding: integer(o.amount) - paidAmount, inconsistent };
  });
  if (rows.some(o => o.inconsistent)) return { state: 'pending_balance' as const, reason: 'Refresh balance to include the matched payment before releasing its reservation.', days };
  const commitments = sum(rows.map(o => o.outstanding));
  const reserve = integer(plan.reserve);
  if (reserve < 0n) throw new Error('Reserve cannot be negative.');
  const remainder = integer(balance.usdc) - reserve - commitments;
  const discretionary = max(0n, remainder);
  const daily = discretionary / BigInt(days) / 10000n * 10000n;
  return { state: 'ready' as const, days, commitments, reserve, remainder, discretionary, shortfall: max(0n, -remainder), daily, leftover: discretionary - daily * BigInt(days), rows, observedAt: balance.observedAt, stale: balance.stale };
}
