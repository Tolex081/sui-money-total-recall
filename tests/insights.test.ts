import { it, expect } from 'vitest';
import { demoState } from '@/adapters/mock/demo';
import { insights, checkPayment, spendingPatterns, dismissedInsights } from '@/domain/insights';
import { learnedEventSchema, type ConfirmedEvent } from '@/domain/learning';
import { units } from '@/domain/money';
import type { AccountState } from '@/domain/state';

const usdc = (v: string) => units(v);
function withGoal(state: AccountState, target: string): AccountState {
  const envelope = learnedEventSchema.parse({ schemaVersion: 1, eventId: 'goal-event-1', profileId: state.profile.id, logicalKey: 'goal:g1', revision: 1, kind: 'savings_goal', recordedAt: '2026-10-28T10:00:00.000Z', effectiveFrom: '2026-10-28', provenance: 'synthetic_demo', sourceRecordIds: [], payload: { goalId: '11111111-1111-4111-8111-111111111111', purpose: 'laptop', target: usdc(target).toString(), saved: '0', frequency: 'weekly', targetDate: '2026-11-04', startDate: '2026-10-28' } });
  const memory: ConfirmedEvent = { envelope, state: 'recall_confirmed', blobId: 'test-fixture-blob', recalledAt: '2026-10-28T10:01:00.000Z', available: true };
  return { ...state, memories: [memory] };
}
function dismissal(state: AccountState, suggestionId: string): ConfirmedEvent {
  const envelope = learnedEventSchema.parse({ schemaVersion: 1, eventId: 'dismiss-1', profileId: state.profile.id, logicalKey: 'insight:' + suggestionId, revision: 1, kind: 'suggestion_decision', recordedAt: '2026-10-28T10:00:00.000Z', effectiveFrom: '2026-10-28', provenance: 'synthetic_demo', sourceRecordIds: [], payload: { suggestionId, decision: 'rejected' } });
  return { envelope, state: 'recall_confirmed', blobId: 'test-fixture-blob', recalledAt: '2026-10-28T10:01:00.000Z', available: true };
}

it('remembered context changes the future daily recommendation', () => {
  const r = insights(demoState());
  if (!r.ready) throw Error('not ready');
  // Without memory: no learned weekly bills and no known habits.
  expect(r.naive.daily).toBe(usdc('66.59'));
  // With memory: learned groceries and transport bills are reserved, and eating out (labelled in 4 of 4 weeks,
  // covered by no bill) is expected to continue: 30.75 a week × 11/7 weeks = 48.33.
  expect(r.recommended.routine).toBe(usdc('48.33'));
  expect(r.recommended.daily).toBe(usdc('50.01'));
  expect(r.recommended.daily).toBeLessThan(r.naive.daily);
});

it('patterns are learned from remembered labels only', () => {
  const state = demoState();
  expect(spendingPatterns(state).map(p => p.category)).toContain('Food');
  const forgotten = { ...state, annotations: state.annotations.map(a => ({ ...a, eventId: undefined })) };
  expect(spendingPatterns(forgotten)).toEqual([]);
});

it('a category seen in fewer than 3 of the last 4 weeks is not a pattern', () => {
  const state = demoState();
  const food = state.movements.filter(m => !['synthetic-food-2', 'synthetic-food-3'].includes(m.id));
  expect(spendingPatterns({ ...state, movements: food }).map(p => p.category)).not.toContain('Food');
});

it('bills already reserved for a category are not counted twice', () => {
  const r = insights(demoState());
  if (!r.ready) throw Error('not ready');
  expect(r.patterns.find(p => p.category === 'Groceries')?.coveredByBill).toBe(true);
  expect(r.routineRows.map(p => p.category)).toEqual(['Food']);
});

it('warns when usual spending puts a savings goal at risk and names the cut that closes it', () => {
  const r = insights(withGoal(demoState(), '590'));
  if (!r.ready) throw Error('not ready');
  const risk = r.items.find(i => i.kind === 'goal_at_risk');
  expect(risk).toBeTruthy();
  if (risk?.kind !== 'goal_at_risk') throw Error();
  expect(risk.gap).toBeGreaterThan(0n);
  expect(risk.memoryIds).toContain('goal-event-1');
});

it('a goal with room to spare is on track; no goal gives a savings suggestion', () => {
  const ok = insights(withGoal(demoState(), '100'));
  if (!ok.ready) throw Error();
  expect(ok.items.some(i => i.kind === 'goal_on_track')).toBe(true);
  const none = insights(demoState());
  if (!none.ready) throw Error();
  const save = none.items.find(i => i.kind === 'save_suggestion');
  if (save?.kind !== 'save_suggestion') throw Error();
  expect(save.weekly).toBe(usdc('137.54'));
});

it('dismissed advice, remembered as a decision, stays hidden', () => {
  const state = demoState();
  const first = insights(state);
  if (!first.ready) throw Error();
  const id = first.items.find(i => i.kind === 'save_suggestion')!.id;
  const remembered = { ...state, memories: [dismissal(state, id)] };
  const after = insights(remembered, { dismissed: [...dismissedInsights(remembered)] });
  if (!after.ready) throw Error();
  expect(after.items.some(i => i.id === id)).toBe(false);
  expect(after.dismissedCount).toBe(1);
});

it('payment check: fits, above habit, and past safe-to-spend with what it cuts into', () => {
  const state = demoState();
  expect(checkPayment(state, usdc('20'), 'Food').level).toBe('ok');
  const habit = checkPayment(state, usdc('80'), 'Food');
  expect(habit.level).toBe('caution');
  expect(habit.messages.join(' ')).toMatch(/2\.6× what you usually spend on Food/);
  const big = checkPayment(state, usdc('700'), 'Food');
  expect(big.level).toBe('stop');
  expect(big.cutsInto[0].alias).toBe('Weekly groceries');
});

it('payment check names the goal a payment would take from', () => {
  const state = withGoal(demoState(), '300');
  const r = insights(state);
  if (!r.ready) throw Error();
  const check = checkPayment(state, r.recommended.discretionary + usdc('1'), null);
  expect(check.level).toBe('stop');
  expect(check.messages[0]).toMatch(/goal: laptop/);
});
