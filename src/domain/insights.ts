import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { activeEvents } from './learning';
import { activeGoals } from './goals';
import { max } from './money';
import { spending } from './spending';
import { summarize } from './summary';
import type { AccountState } from './state';

// The learning layer. Memory used to only keep context (labels, bills, goals). Here the remembered labels become
// spending patterns, and those patterns change the advice: the daily allowance, the goal check, a savings
// suggestion and the check before a payment. Every rule is deterministic and runs on remembered (Walrus-confirmed
// or labelled) context only. The same advice is always also worked out WITHOUT memory, so the difference is visible.

const CENT = 10000n; // 0.01 USDC in base units
const WEEK_MS = 7 * 24 * 3600 * 1000;
const WEEKS = 4;
const MIN_WEEKS_SEEN = 3;
// Not spending the user chooses week to week, so never a "pattern".
const NOT_ROUTINE = new Set(['unclassified', 'own transfer', 'incoming', 'reimbursement', 'savings']);
// Fixed costs: never suggested as the place to cut back.
const FIXED = new Set(['home', 'rent', 'internet', 'utilities', 'bills', 'insurance', 'debt', 'loan']);

export type Pattern = {
  category: string;
  weekly: bigint;          // typical weekly spend: the last 4 weeks added up, divided by 4, rounded down to the cent
  weeks: bigint[];         // spend per week, newest first
  weeksSeen: number;
  lastWeek: bigint;
  trend: 'up' | 'down' | 'steady';
  coveredByBill: boolean;  // a bill or commitment of the same category already reserves for it
  flexible: boolean;
  memoryIds: string[];     // the remembered labels this pattern was learned from
  movementIds: string[];
};

export type Insight =
  | { id: string; kind: 'routine_spend'; category: string; weekly: bigint; expected: bigint; memoryIds: string[] }
  | { id: string; kind: 'goal_at_risk'; purpose: string; gap: bigint; cutCategory: string | null; weeklyCut: bigint | null; memoryIds: string[] }
  | { id: string; kind: 'goal_on_track'; purpose: string; slack: bigint; memoryIds: string[] }
  | { id: string; kind: 'save_suggestion'; weekly: bigint; slack: bigint; memoryIds: string[] }
  | { id: string; kind: 'trend_up'; category: string; lastWeek: bigint; weekly: bigint; memoryIds: string[] };

export type Recommendation = { daily: bigint; discretionary: bigint; routine: bigint; slack: bigint; days: number; commitments: bigint };

const floorCent = (v: bigint) => v / CENT * CENT;
const ceilCent = (v: bigint) => (v + CENT - 1n) / CENT * CENT;
const insightId = (parts: string) => 'insight_' + bytesToHex(sha256(new TextEncoder().encode(parts))).slice(0, 32);
const norm = (s: string) => s.trim().toLowerCase();

// Weekly windows end at the last moment history was read (never past "now"), newest first.
function windows(state: AccountState) {
  const end = Math.min(Date.parse(state.coverage.to ?? state.now), Date.parse(state.now));
  return Array.from({ length: WEEKS }, (_, i) => ({ from: new Date(end - (i + 1) * WEEK_MS).toISOString(), to: new Date(end - i * WEEK_MS).toISOString() }));
}

// Only labels that came from memory (they carry the event that remembered them) teach a pattern.
export function rememberedAnnotations(state: AccountState) { return state.annotations.filter(a => !!a.eventId); }

export function spendingPatterns(state: AccountState, upcomingCategories: string[] = []): Pattern[] {
  const annotations = rememberedAnnotations(state);
  const byCategory = new Map<string, { label: string; weeks: bigint[]; memoryIds: Set<string>; movementIds: Set<string> }>();
  windows(state).forEach((period, index) => {
    const report = spending(state.movements, annotations, state.reimbursements, period, state.coverage);
    for (const row of report.rows) {
      if (NOT_ROUTINE.has(norm(row.category)) || row.net <= 0n) continue;
      const key = norm(row.category);
      const entry = byCategory.get(key) ?? { label: row.category, weeks: Array(WEEKS).fill(0n), memoryIds: new Set(), movementIds: new Set() };
      entry.weeks[index] += row.net;
      const eventId = annotations.find(a => a.movementId === row.movement.id)?.eventId;
      if (eventId) entry.memoryIds.add(eventId);
      entry.movementIds.add(row.movement.id);
      byCategory.set(key, entry);
    }
  });
  const covered = new Set(upcomingCategories.map(norm));
  return [...byCategory.entries()].flatMap(([key, e]) => {
    const weeksSeen = e.weeks.filter(w => w > 0n).length;
    if (weeksSeen < MIN_WEEKS_SEEN) return [];
    const weekly = floorCent(e.weeks.reduce((a, b) => a + b, 0n) / BigInt(WEEKS));
    const lastWeek = e.weeks[0];
    const trend = lastWeek * 100n > weekly * 125n ? 'up' as const : lastWeek * 100n < weekly * 75n ? 'down' as const : 'steady' as const;
    return [{ category: e.label, weekly, weeks: e.weeks, weeksSeen, lastWeek, trend, coveredByBill: covered.has(key), flexible: !FIXED.has(key), memoryIds: [...e.memoryIds].sort(), movementIds: [...e.movementIds].sort() }];
  }).sort((a, b) => (b.weekly > a.weekly ? 1 : b.weekly < a.weekly ? -1 : a.category.localeCompare(b.category)));
}

// Every remembered thing that can change the plan: learned bills (from recurrence memories) and remembered labels.
export function learnedIds(state: AccountState) {
  const ids = new Set<string>();
  for (const o of state.occurrences) if (o.learnedEventId) ids.add(o.learnedEventId);
  for (const a of state.annotations) if (a.eventId) ids.add(a.eventId);
  for (const m of state.memories) ids.add(m.envelope.eventId);
  return [...ids];
}

// Ids of insights the user dismissed. The decision is itself remembered (suggestion_decision), so it holds across
// devices and sessions once Walrus confirms it; `extra` covers decisions still saving.
export function dismissedInsights(state: AccountState, extra: string[] = []) {
  const fromMemory = activeEvents(state.memories, state.profile.id).flatMap(m => m.envelope.kind === 'suggestion_decision' && m.envelope.payload.decision === 'rejected' && m.envelope.payload.suggestionId.startsWith('insight_') ? [m.envelope.payload.suggestionId] : []);
  return new Set([...fromMemory, ...extra]);
}

export function insights(state: AccountState, options: { dismissed?: string[] } = {}) {
  const withMemory = summarize(state);
  const withoutMemory = summarize({ ...state, memories: [] }, learnedIds(state));
  const plan = withMemory.plan, bare = withoutMemory.plan;
  const upcoming = plan.state === 'ready' ? plan.rows.filter(r => r.outstanding > 0n).map(r => r.category) : [];
  const patterns = spendingPatterns(state, upcoming);
  if (plan.state !== 'ready' || bare.state !== 'ready') return { ready: false as const, patterns, items: [] as Insight[], reason: plan.reason };

  const days = plan.days;
  // Routine spending that no bill already reserves for, spread over the days left in the plan.
  const routineRows = patterns.filter(p => !p.coveredByBill).map(p => ({ ...p, expected: ceilCent(p.weekly * BigInt(days) / 7n) }));
  const routine = routineRows.reduce((t, p) => t + p.expected, 0n);
  const slack = plan.discretionary - routine;
  const recommended: Recommendation = { daily: floorCent(max(0n, slack) / BigInt(days)), discretionary: plan.discretionary, routine, slack, days, commitments: plan.commitments };
  const naive: Recommendation = { daily: bare.daily, discretionary: bare.discretionary, routine: 0n, slack: bare.discretionary, days: bare.days, commitments: bare.commitments };

  const items: Insight[] = [];
  for (const p of routineRows) items.push({ id: insightId(`routine|${norm(p.category)}|${p.weekly}`), kind: 'routine_spend', category: p.category, weekly: p.weekly, expected: p.expected, memoryIds: p.memoryIds });
  for (const p of patterns.filter(p => p.trend === 'up' && p.flexible)) items.push({ id: insightId(`trend|${norm(p.category)}|${p.lastWeek}`), kind: 'trend_up', category: p.category, lastWeek: p.lastWeek, weekly: p.weekly, memoryIds: p.memoryIds });

  const goals = activeGoals(state.memories, state.profile.id);
  const weeksLeft = BigInt(Math.max(1, Math.ceil(days / 7)));
  const patternMemory = routineRows.flatMap(p => p.memoryIds);
  if (goals.length) {
    const { event, goal } = goals[0];
    if (slack < 0n) {
      const gap = -slack;
      const cut = routineRows.filter(p => p.flexible).sort((a, b) => (b.weekly > a.weekly ? 1 : -1))[0] ?? null;
      const weeklyCut = cut ? ceilCent(gap / weeksLeft) : null;
      items.push({ id: insightId(`goal-risk|${goal.goalId}|${gap}`), kind: 'goal_at_risk', purpose: goal.purpose, gap, cutCategory: cut && weeklyCut! <= cut.weekly ? cut.category : null, weeklyCut: cut && weeklyCut! <= cut.weekly ? weeklyCut : null, memoryIds: [event.eventId, ...patternMemory] });
    } else items.push({ id: insightId(`goal-ok|${goal.goalId}|${slack}`), kind: 'goal_on_track', purpose: goal.purpose, slack, memoryIds: [event.eventId, ...patternMemory] });
  } else if (slack > 0n) {
    const weekly = floorCent(slack / weeksLeft / 2n);
    if (weekly > 0n) items.push({ id: insightId(`save|${weekly}`), kind: 'save_suggestion', weekly, slack, memoryIds: patternMemory });
  }
  const hidden = new Set(options.dismissed ?? []);
  return { ready: true as const, patterns, recommended, naive, routineRows, items: items.filter(i => !hidden.has(i.id)), dismissedCount: items.filter(i => hidden.has(i.id)).length, goal: goals[0]?.goal ?? null };
}

export type PaymentCheck = { level: 'ok' | 'caution' | 'stop'; messages: string[]; dailyAfter: bigint | null; cutsInto: { alias: string; dueDate: string; amount: bigint }[] };

// Before a payment is signed: does it fit the plan, does it eat into a goal or a bill, and is it far above what this
// user usually spends in that category? Amount is in USDC base units.
export function checkPayment(state: AccountState, amountUnits: bigint, category?: string | null): PaymentCheck {
  const result = insights(state);
  const messages: string[] = [];
  if (!result.ready) return { level: 'caution', messages: ['There is no plan with a verified balance yet, so this payment can’t be checked against it.'], dailyAfter: null, cutsInto: [] };
  const { recommended } = result, plan = summarize(state).plan;
  if (plan.state !== 'ready') return { level: 'caution', messages: [plan.reason], dailyAfter: null, cutsInto: [] };
  let level: PaymentCheck['level'] = 'ok';
  const cutsInto: PaymentCheck['cutsInto'] = [];
  if (amountUnits > recommended.discretionary) {
    level = 'stop';
    // What is left short if this goes out now: goal savings first (they are the money a person actually dips into),
    // then bills from the latest due date back.
    let over = amountUnits - recommended.discretionary;
    const isGoal = (r: { ruleId: string }) => r.ruleId.startsWith('goal:');
    for (const row of [...plan.rows].filter(r => r.outstanding > 0n).sort((a, b) => Number(isGoal(b)) - Number(isGoal(a)) || b.dueDate.localeCompare(a.dueDate))) {
      if (over <= 0n) break;
      const take = row.outstanding < over ? row.outstanding : over;
      cutsInto.push({ alias: row.alias, dueDate: row.dueDate, amount: take });
      over -= take;
    }
    const goalHit = cutsInto.find(c => c.alias.startsWith('Save for '));
    messages.push(goalHit ? `This would take money set aside for your goal: ${goalHit.alias.replace('Save for ', '')}.` : 'This is more than is safe to spend before your plan ends. Bills due later would be short.');
    if (over > 0n) messages.push('It would also cut into your reserve.');
  } else if (amountUnits > max(0n, recommended.slack)) {
    level = 'caution';
    messages.push('It fits today, but leaves too little for what you usually spend before your plan ends.');
  }
  const pattern = category ? result.patterns.find(p => norm(p.category) === norm(category)) : undefined;
  if (pattern && pattern.weekly > 0n && amountUnits * 2n > pattern.weekly * 3n) {
    if (level === 'ok') level = 'caution';
    const times = Number(amountUnits * 10n / pattern.weekly) / 10;
    messages.push(`That is about ${times}× what you usually spend on ${pattern.category} in a week.`);
  }
  if (level === 'ok') messages.push('This fits your plan and your usual spending.');
  const dailyAfter = floorCent(max(0n, recommended.slack - amountUnits) / BigInt(recommended.days));
  return { level, messages, dailyAfter, cutsInto };
}
