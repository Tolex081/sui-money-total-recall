import { it, expect } from 'vitest';
import { learnedEventSchema, type ConfirmedEvent, type LearnedEvent } from '@/domain/learning';
import { contributionDates, goalOccurrences, goalPlan } from '@/domain/goals';
import { planning } from '@/domain/planning';
import { units } from '@/domain/money';

// Milestone 2: savings goal memory. Pure, deterministic maths in USDC base units; no Walrus involved.
const usdc = (v: string) => units(v).toString();
const goal = (over: Partial<{ target: string; saved: string; frequency: 'weekly' | 'monthly'; targetDate: string; startDate: string }> = {}) => ({ goalId: '11111111-1111-4111-8111-111111111111', purpose: 'laptop', target: usdc('500'), saved: '0', frequency: 'weekly' as const, targetDate: '2026-12-30', startDate: '2026-11-04', ...over });
const event = (revision: number, payload: ReturnType<typeof goal>): LearnedEvent => learnedEventSchema.parse({ schemaVersion: 1, eventId: 'goal-event-' + revision, profileId: 'profile-a', logicalKey: 'goal:' + payload.goalId, revision, recordedAt: '2026-11-04T10:00:00Z', effectiveFrom: '2026-11-04', provenance: 'user_confirmed', sourceRecordIds: [], ...(revision > 1 ? { supersedesEventId: 'goal-event-' + (revision - 1) } : {}), kind: 'savings_goal', payload });
const confirmed = (envelope: LearnedEvent, state = 'recall_confirmed'): ConfirmedEvent => ({ envelope, state, blobId: 'test-fixture-blob', recalledAt: '2026-11-04T10:01:00Z', available: true });
const plan = { endDate: '2026-11-30', endKind: 'planning' as const, reserve: '0', timezone: 'UTC', version: 1, expectedIncome: null };
const balance = { usdc: usdc('1000'), sui: '0', observedAt: '2026-11-04T09:00:00Z', checkpoint: '1', source: 'tatum' as const, stale: false };

it('weekly 500 USDC laptop goal: nine contributions of 55.56 USDC up to the target date', () => {
  expect(contributionDates(goal(), '2026-11-04', '2026-11-04')).toEqual(['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25', '2026-12-02', '2026-12-09', '2026-12-16', '2026-12-23', '2026-12-30']);
  const p = goalPlan(goal(), '2026-11-04', '2026-11-04');
  expect(p.contribution).toBe(55_560_000n); expect(p.remaining).toBe(500_000_000n); expect(p.progress).toBe(0); expect(p.reached).toBe(false);
});

it('changing the target to 700 USDC changes the suggestion to 77.78 USDC on the same days', () => {
  const p = goalPlan(goal({ target: usdc('700') }), '2026-11-04', '2026-11-04');
  expect(p.contribution).toBe(77_780_000n); expect(p.dates).toHaveLength(9);
});

it('monthly contributions step by calendar month and saved money lowers the suggestion', () => {
  const monthly = goal({ frequency: 'monthly', targetDate: '2027-05-04' });
  expect(contributionDates(monthly, '2026-11-04', '2026-11-04')).toEqual(['2026-11-04', '2026-12-04', '2027-01-04', '2027-02-04', '2027-03-04', '2027-04-04', '2027-05-04']);
  expect(goalPlan(monthly, '2026-11-04', '2026-11-04').contribution).toBe(71_430_000n);
  const p = goalPlan(goal({ saved: usdc('140') }), '2026-11-04', '2026-11-04');
  expect(p.contribution).toBe(40_000_000n); expect(p.progress).toBe(28);
});

it('later in the goal only the remaining days count', () => {
  expect(goalPlan(goal(), '2026-11-04', '2026-11-20').dates).toEqual(['2026-11-25', '2026-12-02', '2026-12-09', '2026-12-16', '2026-12-23', '2026-12-30']);
  expect(goalPlan(goal(), '2026-11-04', '2026-11-20').contribution).toBe(83_340_000n);
});

it('a passed target date asks for the remainder today; a reached goal asks for nothing', () => {
  const late = goalPlan(goal({ targetDate: '2026-11-10', saved: usdc('120.5') }), '2026-11-04', '2026-11-20');
  expect(late.overdue).toBe(true); expect(late.dates).toEqual(['2026-11-20']); expect(late.contribution).toBe(379_500_000n);
  const done = goalPlan(goal({ saved: usdc('600') }), '2026-11-04', '2026-11-04');
  expect(done.reached).toBe(true); expect(done.contribution).toBe(0n); expect(done.dates).toEqual([]); expect(done.progress).toBe(100);
});

it('the plan sets aside contributions due before its end date, and the last one never overshoots', () => {
  const memories = [confirmed(event(1, goal()))];
  const rows = goalOccurrences(memories, 'profile-a', '2026-11-04', '2026-11-30');
  expect(rows.map(r => [r.dueDate, r.amount])).toEqual([['2026-11-04', '55560000'], ['2026-11-11', '55560000'], ['2026-11-18', '55560000'], ['2026-11-25', '55560000']]);
  expect(rows[0]).toMatchObject({ alias: 'Save for laptop', category: 'Savings', learnedEventId: 'goal-event-1' });
  const ready = planning({ balance, plan, today: '2026-11-04', occurrences: rows, allocations: [] });
  expect(ready.state).toBe('ready'); if (ready.state !== 'ready') return;
  expect(ready.commitments).toBe(222_240_000n); expect(ready.remainder).toBe(777_760_000n);
  const all = goalOccurrences([confirmed(event(1, goal({ target: usdc('100'), targetDate: '2026-11-18' })))], 'profile-a', '2026-11-04', '2027-01-01');
  expect(all.map(r => r.amount)).toEqual(['33340000', '33340000', '33320000']);
});

it('only the active, Walrus-confirmed revision changes the plan (Session C/D)', () => {
  const first = event(1, goal()), second = event(2, goal({ target: usdc('700') }));
  const pendingChange = goalOccurrences([confirmed(first), confirmed(second, 'saved')], 'profile-a', '2026-11-04', '2026-11-30');
  expect(pendingChange.every(r => r.amount === '55560000' && r.learnedEventId === 'goal-event-1')).toBe(true);
  const confirmedChange = goalOccurrences([confirmed(first), confirmed(second)], 'profile-a', '2026-11-04', '2026-11-30');
  expect(confirmedChange.every(r => r.amount === '77780000' && r.learnedEventId === 'goal-event-2')).toBe(true);
  const ready = planning({ balance, plan, today: '2026-11-04', occurrences: confirmedChange, allocations: [] });
  expect(ready.state === 'ready' && ready.remainder).toBe(688_880_000n);
  expect(goalOccurrences([confirmed(first, 'queued')], 'profile-a', '2026-11-04', '2026-11-30')).toEqual([]);
  expect(goalOccurrences([confirmed(first)], 'profile-b', '2026-11-04', '2026-11-30')).toEqual([]);
});

it('goal memories reject a zero target, a target date before the start and unknown fields', () => {
  expect(() => event(1, goal({ target: '0' }))).toThrow();
  expect(() => event(1, goal({ targetDate: '2026-11-01' }))).toThrow();
  expect(() => event(1, { ...goal(), note: 'extra' } as ReturnType<typeof goal>)).toThrow();
});
