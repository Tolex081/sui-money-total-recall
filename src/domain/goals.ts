import { Temporal } from '@js-temporal/polyfill';
import { integer, max } from './money';
import { activeEvents, type ConfirmedEvent, type LearnedEvent } from './learning';
import type { Occurrence } from './types';

// A savings goal is remembered on Walrus like any other learned context. Only the active, recall-confirmed revision
// counts: a pending goal or pending change never alters the plan (brief 9.4a). All amounts are USDC base units.
export type SavingsGoal = Extract<LearnedEvent, { kind: 'savings_goal' }>['payload'];
const CENT = 10000n; // 0.01 USDC in base units (6 decimals)
const MAX_DATES = 400;

// Contribution dates run from the goal's own start date in weekly or calendar-monthly steps. Dates before today
// are behind us; the ones from today up to and including the target date are still to come.
export function contributionDates(goal: Pick<SavingsGoal, 'frequency' | 'targetDate'>, startDate: string, today: string): string[] {
  const start = Temporal.PlainDate.from(startDate), target = Temporal.PlainDate.from(goal.targetDate), now = Temporal.PlainDate.from(today);
  const dates: string[] = [];
  for (let index = 0; index < MAX_DATES * 3 && dates.length < MAX_DATES; index++) {
    const due = goal.frequency === 'weekly' ? start.add({ days: 7 * index }) : start.add({ months: index }).with({ day: start.day }, { overflow: 'constrain' });
    if (Temporal.PlainDate.compare(due, target) > 0) break;
    if (Temporal.PlainDate.compare(due, now) >= 0) dates.push(due.toString());
  }
  return dates;
}

// Deterministic suggestion: what is left, split evenly over the remaining contribution dates and rounded up to the
// cent so the goal is met by the target date. If no date remains (the target date is today's first step or has
// passed), the whole remainder is due today. Nothing is due once the goal is reached.
export function goalPlan(goal: SavingsGoal, startDate: string, today: string) {
  const target = integer(goal.target), saved = integer(goal.saved);
  const remaining = max(0n, target - saved);
  const scheduled = contributionDates(goal, startDate, today);
  const overdue = scheduled.length === 0 && remaining > 0n;
  const dates = remaining === 0n ? [] : overdue ? [today] : scheduled;
  const raw = dates.length ? (remaining + BigInt(dates.length) - 1n) / BigInt(dates.length) : 0n;
  const contribution = (raw + CENT - 1n) / CENT * CENT;
  const progress = target === 0n ? 100 : Number(max(0n, target - remaining) * 100n / target);
  return { target, saved, remaining, contribution, dates, overdue, reached: remaining === 0n, progress };
}

export function activeGoals(memories: ConfirmedEvent[], profileId: string) {
  return activeEvents(memories, profileId).flatMap(m => m.envelope.kind === 'savings_goal' ? [{ event: m.envelope, goal: m.envelope.payload }] : []);
}

// Contributions due before the plan's end date are set aside like commitments. The last one never asks for more
// than is still left to save.
export function goalOccurrences(memories: ConfirmedEvent[], profileId: string, today: string, through: string): Occurrence[] {
  return activeGoals(memories, profileId).flatMap(({ event, goal }) => {
    const plan = goalPlan(goal, goalStart(event), today);
    let left = plan.remaining;
    return plan.dates.filter(d => d < through).flatMap(dueDate => {
      const amount = plan.contribution < left ? plan.contribution : left;
      left -= amount;
      return amount > 0n ? [{ id: `goal:${goal.goalId}:${dueDate}`, ruleId: `goal:${goal.goalId}`, dueDate, alias: `Save for ${goal.purpose}`, category: 'Savings', amount: amount.toString(), cancelled: false, learnedEventId: event.eventId }] : [];
    });
  });
}

// The schedule is anchored to the day the goal was first saved, so a correction changes the amounts but keeps
// the same contribution days.
export function goalStart(event: LearnedEvent) { return event.kind === 'savings_goal' ? event.payload.startDate : event.effectiveFrom; }
