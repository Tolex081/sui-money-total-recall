import { Temporal } from '@js-temporal/polyfill';
import { integer, USDC_TYPE } from './money';
import { localToday } from './planning';
import { eligibleExpense } from './spending';
import type { Annotation, CommitmentRule, Movement, Occurrence } from './types';
export function occurrences(rules: CommitmentRule[], through: string): Occurrence[] {
  const rows: Occurrence[] = [];
  for (const rule of rules) {
    const start = Temporal.PlainDate.from(rule.startDate);
    let due = start;
    for (let index = 0; index < 550 && due.toString() < through; index++) {
      const date = due.toString();
      if (date >= rule.effectiveFrom && (!rule.endDate || date < rule.endDate)) rows.push({ id: `${rule.id}:${date}`, ruleId: rule.id, dueDate: date, alias: rule.alias, category: rule.category, amount: rule.amount, cancelled: !!rule.cancelled, learnedEventId: rule.learnedEventId });
      if (rule.frequency === 'once') break;
      due = rule.frequency === 'weekly' ? due.add({ days: 7 }) : start.add({ months: index + 1 }).with({ day: rule.dayOfMonth ?? start.day }, { overflow: 'constrain' });
    }
  }
  return rows;
}
export function weeklySuggestions(movements: Movement[], annotations: Annotation[], timezone: string) {
  const groups = new Map<string, Movement[]>();
  for (const m of [...new Map(movements.map(m => [m.id, m])).values()]) {
    const a = annotations.find(a => a.movementId === m.id);
    if (!a || !a.eventId || a.category === 'Unclassified' || !m.counterparty || m.coinType !== USDC_TYPE || !eligibleExpense(m, annotations)) continue;
    const key = `${m.counterparty}|${m.coinType}|${a.category}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.entries()].flatMap(([key, group]) => {
    const rows = group.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (rows.length < 3) return [];
    const dates = rows.map(m => Temporal.PlainDate.from(localToday(m.timestamp, timezone)));
    if (dates.slice(1).some((d, i) => { const gap = dates[i].until(d).days; return gap < 6 || gap > 8; })) return [];
    const amounts = rows.map(m => -integer(m.delta)).sort((a,b) => a < b ? -1 : a > b ? 1 : 0);
    const mid = Math.floor(amounts.length / 2);
    const median = amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2n;
    if (amounts.some(a => (a > median ? a - median : median - a) * 100n > median * 5n)) return [];
    return [{ id: key + '|' + rows.map(m => m.id + ':' + m.delta).join(','), sourceIds: rows.map(m => m.id), median: median.toString(), nextDate: dates.at(-1)!.add({ days: 7 }).toString(), category: annotations.find(a => a.movementId === rows[0].id)!.category, destination: rows[0].counterparty }];
  });
}
