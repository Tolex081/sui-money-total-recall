// Phase Four assistant engine (pure, no AI model, no network). Fixture account state only.
import { describe, it, expect } from 'vitest';
import { answer, understand, amountIn, goalRecords } from '@/domain/assistant';
import { learnedEventSchema, type ConfirmedEvent, type LearnedEvent } from '@/domain/learning';
import { units, USDC_TYPE } from '@/domain/money';
import { demoState } from '@/adapters/mock/demo';
import type { AccountState } from '@/domain/state';

const GOAL = '11111111-1111-4111-8111-111111111111';
const u = (v: string) => units(v).toString();
const goalEvent = (revision: number, target: string, over: { profileId?: string; purpose?: string; supersedes?: string; kind?: 'deactivation' } = {}): LearnedEvent => learnedEventSchema.parse({
  schemaVersion: 1, eventId: `goal-${over.profileId ?? 'a'}-${revision}`, profileId: over.profileId ?? 'profile-a', logicalKey: 'goal:' + GOAL, revision,
  recordedAt: `2026-11-04T10:0${revision}:00Z`, effectiveFrom: '2026-11-04', provenance: 'user_confirmed', sourceRecordIds: [],
  ...(revision > 1 ? { supersedesEventId: over.supersedes ?? `goal-${over.profileId ?? 'a'}-${revision - 1}` } : {}),
  ...(over.kind === 'deactivation' ? { kind: 'deactivation', payload: { reason: 'Forgotten by the user' } } : { kind: 'savings_goal', payload: { goalId: GOAL, purpose: over.purpose ?? 'Laptop', target: u(target), saved: '0', frequency: 'weekly', targetDate: '2027-02-04', startDate: '2026-11-04' } }),
});
const row = (envelope: LearnedEvent, state = 'recall_confirmed'): ConfirmedEvent => ({ envelope, state, blobId: state === 'recall_confirmed' ? 'blob-' + envelope.eventId : null, recalledAt: state === 'recall_confirmed' ? '2026-11-04T10:30:00Z' : null, available: true });
function account(memories: ConfirmedEvent[], over: Partial<AccountState> = {}): AccountState {
  const base = demoState();
  return { ...base, profile: { ...base.profile, id: 'profile-a' }, today: '2026-11-04', now: '2026-11-04T12:00:00Z', memories,
    balance: { usdc: u('1000'), sui: '0', observedAt: '2026-11-04T11:59:00Z', checkpoint: null, observedTip: '500', source: 'tatum', stale: false },
    plan: { ...base.plan, endDate: '2026-11-30', reserve: u('100') }, occurrences: [], commitmentAllocations: [], ...over };
}
const corrected = () => [row(goalEvent(1, '500')), row(goalEvent(2, '700', { purpose: 'Laptop MAc' }))];

describe('understanding questions', () => {
  it('maps the demo questions and common variants to the right intent', () => {
    const cases: [string, string][] = [
      ['What am I currently saving towards?', 'current_goal'], ['what is my goal', 'current_goal'],
      ['What was my previous target?', 'goal_history'], ['what did my target used to be before', 'goal_history'],
      ['How much should I contribute weekly?', 'contribution'], ['how much do I need to put aside per week', 'contribution'],
      ['Show my recent USDC transactions', 'transactions'], ['any incoming payments?', 'transactions'],
      ['Increase my goal to 1,000 USDC', 'propose_goal'], ["I'm saving 500 USDC for a laptop", 'propose_goal'], ['I have saved 120 USDC', 'propose_goal'],
      ['What if my target was 1,000 USDC?', 'what_if'], ['Can I spend 80 USDC?', 'can_spend'], ["What's my balance?", 'balances'],
      ['What can I spend before my plan ends?', 'plan'], ['Verify my memories from Walrus', 'verify'], ['what do you remember about me', 'memories'], ['hello', 'help'],
    ];
    for (const [q, intent] of cases) expect(understand(q).intent, q).toBe(intent);
  });
  it('reads amounts exactly and ignores wallet addresses', () => {
    expect(amountIn('increase it to 1,000 USDC')).toBe(1_000_000_000n);
    expect(amountIn('can I spend $80.5?')).toBe(80_500_000n);
    expect(amountIn('send to 0x6d29ddc95b')).toBe(null);
    expect(amountIn('no number here')).toBe(null);
  });
});

describe('Walrus memory: latest confirmed revision only', () => {
  it('answers with the latest confirmed goal (700) and explains the previous target (500)', () => {
    const state = account(corrected());
    const now = answer(state, 'What am I currently saving towards?');
    expect(now.text).toContain('700.00 USDC'); expect(now.text).toContain('From your Walrus Memory');
    expect(now.blocks[0]).toMatchObject({ kind: 'goal', source: 'walrus', goal: { revision: 2, target: u('700') } });
    const before = answer(state, 'What was my previous target?');
    expect(before.text).toContain('previous target was 500.00 USDC');
    expect(before.blocks[0]).toMatchObject({ kind: 'goal_history', revisions: [{ revision: 1, state: 'replaced' }, { revision: 2, state: 'active' }] });
  });
  it('a pending change is not treated as confirmed, and blocks another proposal', () => {
    const state = account([row(goalEvent(1, '500')), row(goalEvent(2, '700'), 'saved')]);
    const now = answer(state, 'What am I saving towards?');
    expect(now.blocks[0]).toMatchObject({ kind: 'goal', goal: { revision: 1, target: u('500') } });
    expect(now.text).toContain('still saving');
    const again = answer(state, 'Increase my goal to 1,000 USDC');
    expect(again.blocks).toEqual([]); expect(again.text).toContain('still being saved');
  });
  it('a failed change keeps the previous goal; a new proposal supersedes the failed revision', () => {
    const state = account([row(goalEvent(1, '500')), row(goalEvent(2, '700'), 'failed')]);
    expect(answer(state, 'What am I saving towards?').blocks[0]).toMatchObject({ goal: { revision: 1, target: u('500') } });
    expect(answer(state, 'What was my previous target?').blocks[0]).toMatchObject({ revisions: [{ revision: 1, state: 'active' }, { revision: 2, state: 'failed' }] });
    const p = answer(state, 'Change my goal to 900 USDC').blocks[0];
    expect(p).toMatchObject({ kind: 'proposal', request: { body: { expectedRevision: 2, supersedesEventId: 'goal-a-2', target: '900' } } });
  });
  it('a forgotten goal (confirmed deactivation) is no goal', () => {
    const state = account([row(goalEvent(1, '500')), row(goalEvent(2, '0', { kind: 'deactivation' }))]);
    expect(goalRecords(state)).toBe(null);
    expect(answer(state, 'What am I saving towards?').text).toContain('don\'t have a confirmed savings goal');
  });
});

describe('authenticated-user isolation', () => {
  it('ignores memories that belong to another profile, even if present in the state', () => {
    const state = account([row(goalEvent(1, '9999', { profileId: 'profile-b', purpose: 'Someone else' }))]);
    expect(goalRecords(state)).toBe(null);
    const reply = answer(state, 'What am I saving towards?');
    expect(reply.text).not.toContain('9,999'); expect(reply.text).not.toContain('Someone else');
    expect(answer(state, 'What do you remember about me?').blocks[0]).toMatchObject({ kind: 'memories', items: [] });
  });
});

describe('calculations reuse Sui Money maths', () => {
  it('700 USDC weekly to 4 Feb 2027 is 50.00 USDC a week; a what-if never changes anything', () => {
    const state = account(corrected());
    expect(answer(state, 'How much should I contribute weekly?').blocks[0]).toMatchObject({ kind: 'contribution', source: 'calculated', hypothetical: false, schedule: { contribution: u('50'), dates: 14 } });
    const whatIf = answer(state, 'What if my target was 1,000 USDC?');
    expect(whatIf.blocks[0]).toMatchObject({ hypothetical: true, schedule: { contribution: u('71.43') } });
    expect(whatIf.text).toContain('Nothing has been changed');
  });
  it('says planned contributions are not payments', () => {
    expect(answer(account(corrected()), 'How much should I contribute weekly?').text).toContain('not payments');
  });
});

describe('confirmed actions: proposals never write', () => {
  it('increasing to 1,000 USDC returns a proposal for the existing goal route with the right revision', () => {
    const state = account(corrected());
    const before = JSON.stringify(state);
    const reply = answer(state, 'Increase my goal to 1,000 USDC');
    expect(reply.blocks).toHaveLength(1);
    expect(reply.blocks[0]).toMatchObject({ kind: 'proposal', current: { target: u('700'), contribution: u('50') }, proposed: { target: u('1000'), contribution: u('71.43') },
      request: { path: '/goals/' + GOAL, body: { purpose: 'Laptop MAc', target: '1000', saved: '0', frequency: 'weekly', targetDate: '2027-02-04', expectedRevision: 2, supersedesEventId: 'goal-a-2' } } });
    expect(reply.text).toContain('Nothing is saved until you confirm');
    expect(JSON.stringify(state)).toBe(before); // the engine is pure: no state change
  });
  it('a first goal proposes a create with revision 0; a saved-so-far update keeps the target', () => {
    const fresh = answer(account([]), "I'm saving 500 USDC for a laptop").blocks[0];
    expect(fresh).toMatchObject({ kind: 'proposal', current: null, proposed: { purpose: 'Laptop', target: u('500'), frequency: 'weekly' }, request: { path: '/goals', body: { expectedRevision: 0, target: '500' } } });
    const saved = answer(account(corrected()), 'I have saved 140 USDC').blocks[0];
    expect(saved).toMatchObject({ proposed: { target: u('700'), saved: u('140') }, request: { body: { saved: '140', target: '700' } } });
  });
  it('an unchanged or zero target is not proposed', () => {
    expect(answer(account(corrected()), 'Change my goal to 700 USDC').blocks).toEqual([]);
    expect(answer(account(corrected()), 'Change my goal to 0 USDC').blocks).toEqual([]);
  });
});

describe('missing, stale and incomplete data', () => {
  it('a missing balance is unknown, never zero', () => {
    const reply = answer(account(corrected(), { balance: null }), "What's my balance?");
    expect(reply.text).toContain('unknown, not zero'); expect(reply.blocks[0]).toMatchObject({ usdc: null, sui: null });
    expect(answer(account(corrected(), { balance: null }), 'Can I spend 80 USDC?').text).toContain('unknown, not zero');
  });
  it('a stale balance is not used for spending answers', () => {
    const stale = account(corrected(), { balance: { usdc: u('1000'), sui: '0', observedAt: '2026-11-01T00:00:00Z', checkpoint: null, source: 'tatum', stale: true } });
    expect(answer(stale, "What's my balance?").text).toContain('treat your current balance as unknown');
    const spend = answer(stale, 'Can I spend 80 USDC?');
    expect(spend.blocks).toEqual([]); expect(spend.text).toContain('out of date');
  });
  it('unimported history is called out, not presented as complete', () => {
    const reply = answer(account([], { movements: [], coverage: { state: 'not_synced', from: null, to: null, reason: 'No history imported yet.' } }), 'Show my recent USDC transactions');
    expect(reply.text).toContain('hasn\'t been imported'); expect(reply.blocks[0]).toMatchObject({ kind: 'transactions', total: 0 });
  });
  it('lists only real movements with their direction, coin and label', () => {
    const reply = answer(account([]), 'Show incoming USDC transactions');
    const block = reply.blocks[0];
    if (block.kind !== 'transactions') throw new Error('expected transactions');
    expect(block.rows.every(r => r.direction === 'in' && r.coin === 'USDC')).toBe(true);
    expect(block.total).toBe(demoState().movements.filter(m => m.status === 'success' && m.coinType === USDC_TYPE && BigInt(m.delta) > 0n).length);
  });
});

describe('O04: conservative spending answers', () => {
  it('a matched but unproven bill payment stays set aside; the answer says it may be low, never high', () => {
    const state = account([], {
      occurrences: [{ id: 'rent', ruleId: 'rent', dueDate: '2026-11-10', alias: 'Rent', category: 'Home', amount: u('200'), cancelled: false }],
      commitmentAllocations: [{ id: 'paid', sourceId: 'tx', targetId: 'rent', amount: u('50'), state: 'active', checkpoint: '101' }],
    });
    const reply = answer(state, 'Can I spend 80 USDC?');
    expect(reply.blocks[0]).toMatchObject({ kind: 'plan', held: u('50'), leftToSpend: u('700') }); // 1000 - 100 reserve - 200 bill (50 paid but held)
    expect(reply.text).toContain('never too high');
    expect(reply.text).toContain('Yes.');
  });
  it('says no when the amount exceeds what is left', () => {
    expect(answer(account(corrected()), 'Can I spend 900 USDC?').text).toContain('Not without dipping into your plan');
  });
});
