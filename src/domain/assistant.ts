// Phase Four financial assistant: a deterministic engine, no AI model. It works out what was asked, reads only the
// account state it is given (the signed-in profile's, loaded on the server), and answers from the app's own data and
// maths. Every figure carries its source: Walrus Memory (confirmed memories), Sui blockchain (Tatum observations) or
// Calculated (Sui Money's planning maths). It never writes: a goal change comes back as a proposal the user confirms
// through the existing goal route, with its usual consent, revision and Walrus checks.
import { amount, integer, units, SUI_TYPE, USDC_TYPE } from './money';
import { goalPlan, type SavingsGoal } from './goals';
import { summarize } from './summary';
import type { AccountState } from './state';
import { activeEvents, type LearnedEvent } from './learning';

export type Source = 'walrus' | 'sui' | 'calculated';
type GoalView = { goalId: string; purpose: string; target: string; saved: string; frequency: 'weekly' | 'monthly'; targetDate: string; startDate: string; revision: number; eventId: string; recordedAt: string; blobId: string | null; confirmedAt: string | null };
type Schedule = { contribution: string; remaining: string; progress: number; reached: boolean; overdue: boolean; dates: number; nextDate: string | null; per: 'week' | 'month' };
export type AssistantBlock =
  | { kind: 'goal'; source: 'walrus'; goal: GoalView; schedule: Schedule }
  | { kind: 'goal_history'; source: 'walrus'; revisions: { revision: number; purpose: string; target: string; state: 'active' | 'replaced' | 'saving' | 'failed'; recordedAt: string }[] }
  | { kind: 'contribution'; source: 'calculated'; target: string; saved: string; schedule: Schedule; hypothetical: boolean }
  | { kind: 'balances'; source: 'sui'; usdc: string | null; sui: string | null; observedAt: string | null; stale: boolean }
  | { kind: 'transactions'; source: 'sui'; rows: { id: string; direction: 'in' | 'out'; amount: string; coin: 'USDC' | 'SUI'; timestamp: string; counterparty: string | null; label: string | null }[]; coverage: { state: string; from: string | null; to: string | null; reason: string }; total: number }
  | { kind: 'plan'; source: 'calculated'; ready: boolean; reason: string | null; endDate: string | null; leftToSpend: string | null; daily: string | null; bills: string | null; goalSetAside: string | null; reserve: string | null; held: string | null; shortfall: string | null }
  | { kind: 'proposal'; source: 'calculated'; current: { target: string; contribution: string; per: 'week' | 'month' } | null; proposed: { purpose: string; target: string; saved: string; frequency: 'weekly' | 'monthly'; targetDate: string; contribution: string; per: 'week' | 'month' }; request: { path: string; body: Record<string, unknown> } }
  | { kind: 'memories'; source: 'walrus'; items: { kind: string; summary: string; recordedAt: string }[] }
  | { kind: 'verify'; source: 'walrus'; checkedAt?: string; results?: { kind: string; revision: number; verdict: string; summary: string }[] };
export type AssistantAnswer = { intent: Intent; text: string; blocks: AssistantBlock[]; suggestions: string[] };
export type Intent = 'help' | 'current_goal' | 'goal_history' | 'contribution' | 'what_if' | 'propose_goal' | 'transactions' | 'balances' | 'plan' | 'can_spend' | 'memories' | 'verify';

const SUGGESTIONS = ['What am I saving towards?', 'What was my previous target?', 'How much should I contribute weekly?', 'Show my recent USDC transactions', 'What can I spend before my plan ends?', 'Increase my goal to 1,000 USDC'];
const usd = (v: bigint | string) => amount(v);
const plain = (v: bigint | string) => amount(v, 6, 6).replaceAll(',', '').replace(/\.?0+$/, '') || '0';
const short = (address: string | null) => address ? address.slice(0, 6) + '…' + address.slice(-4) : null;
const longDate = (d: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));

// ---- Understanding the question -------------------------------------------------------------------------------------
// A first amount written in the message, in USDC base units. Numbers inside dates or wallet addresses are ignored.
export function amountIn(text: string): bigint | null {
  const match = text.replace(/0x[0-9a-f]+/gi, ' ').match(/(?:^|[\s$])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,6}))?(?!\d)(?!\s*(?:st|nd|rd|th)\b)/i);
  if (!match) return null;
  try { return units(match[1].replaceAll(',', '') + (match[2] ? '.' + match[2] : '')); } catch { return null; }
}
export function understand(raw: string): { intent: Intent; amount: bigint | null; coin: 'USDC' | 'SUI' | null; direction: 'in' | 'out' | null; frequency: 'weekly' | 'monthly' | null; purpose: string | null } {
  const text = raw.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  const value = amountIn(text);
  const coin: 'USDC' | 'SUI' | null = /\bsui\b/.test(text.replace(/sui money/g, '')) ? 'SUI' : /\busdc\b|\bdollars?\b|\$/.test(text) ? 'USDC' : null;
  const direction: 'in' | 'out' | null = /\b(incoming|received|receive|got|came in|deposits?)\b/.test(text) ? 'in' : /\b(outgoing|sent|send|paid|spent|spend on|withdraw)/.test(text) && !/can i/.test(text) ? 'out' : null;
  const frequency: 'weekly' | 'monthly' | null = /\b(monthly|per month|a month|each month|every month)\b/.test(text) ? 'monthly' : /\b(weekly|per week|a week|each week|every week)\b/.test(text) ? 'weekly' : null;
  const purpose = text.match(/\bfor (?:a |an |my |the )?([a-z][a-z0-9 ]{1,40}?)(?: by| with| at| weekly| monthly|[.,!?]|$)/)?.[1]?.trim() ?? null;
  const base = { amount: value, coin, direction, frequency, purpose };
  if (/\b(verify|check)\b.*\bwalrus\b|\bwalrus\b.*\b(verify|check|confirm)/.test(text)) return { intent: 'verify', ...base };
  if (/\bcan i (spend|afford|buy|pay)\b|\bis it ok(ay)? to spend\b|\bafford\b/.test(text) && value !== null) return { intent: 'can_spend', ...base };
  if (/\bwhat if\b|\bif (my |the )?(goal|target) (was|were|is|became)\b|\bhow much .* if\b/.test(text) && value !== null) return { intent: 'what_if', ...base };
  if ((/\b(change|increase|raise|set|update|lower|reduce|make|move|bump|switch|edit|adjust)\b/.test(text) && /\b(goal|target|contribution|saving)/.test(text) && (value !== null || frequency !== null)) || (/\b(i've|i have|i) saved\b/.test(text) && value !== null) || (/\b(start|create|new|add)\b.*\b(goal|saving)/.test(text) && value !== null) || (/\b(i'm|i am|want to be) saving\b/.test(text) && value !== null)) return { intent: 'propose_goal', ...base };
  if (/\b(previous|earlier|old|before|history|changed|original|last) (goal|target)|\b(goal|target) (history|before|changes)\b|\bwhat (was|did) my\b/.test(text)) return { intent: 'goal_history', ...base };
  if (/\bhow much\b.*\b(save|contribut|put aside|set aside|put away)|\bcontribut|\bper (week|month)\b|\b(weekly|monthly) (plan|amount|saving)/.test(text)) return { intent: 'contribution', ...base };
  if (/\bsaving (for|towards?|up)\b|\b(my|current|savings) (goal|target)\b|\bgoal\b/.test(text)) return { intent: 'current_goal', ...base };
  if (/\btransactions?\b|\bpayments?\b|\bactivity\b|\btransfers?\b|\bincoming\b|\boutgoing\b|\breceived\b|\bsent\b/.test(text)) return { intent: 'transactions', ...base };
  if (/\bbalance\b|\bhow much (do i have|usdc|sui|money)\b|\bin my wallet\b|\bholding/.test(text)) return { intent: 'balances', ...base };
  if (/\bleft to spend\b|\bbudget\b|\bplan\b|\bspend (today|per day|each day|a day)\b|\bdaily\b|\bbills?\b/.test(text)) return { intent: 'plan', ...base };
  if (/\bremember\b|\bmemor(y|ies)\b|\bwhat do you know\b/.test(text)) return { intent: 'memories', ...base };
  return { intent: 'help', ...base };
}

// ---- Reading the account state --------------------------------------------------------------------------------------
type Row = AccountState['memories'][number];
const UNSETTLED = ['queued', 'submitting', 'accepted', 'saved', 'submission_outcome_unknown'];
// The goal's revisions for THIS profile only. The active one is the latest Walrus-confirmed revision; a newer
// unconfirmed one is a pending change; a forgotten goal (confirmed deactivation) has no active revision.
export function goalRecords(state: AccountState) {
  const own = state.memories.filter(m => m.envelope.profileId === state.profile.id && m.envelope.logicalKey.startsWith('goal:'));
  const keys = [...new Set(own.map(m => m.envelope.logicalKey))];
  for (const key of keys.reverse()) {
    const history = own.filter(m => m.envelope.logicalKey === key).sort((a, b) => a.envelope.revision - b.envelope.revision);
    const latest = history[history.length - 1];
    const confirmed = [...history].reverse().find(m => m.state === 'recall_confirmed' && !!m.blobId && !!m.recalledAt && m.available);
    if (confirmed?.envelope.kind === 'deactivation') continue;
    const active = confirmed?.envelope.kind === 'savings_goal' ? confirmed : null;
    const pending = latest !== active && UNSETTLED.includes(latest.state) ? latest : null;
    if (!active && !pending) continue;
    return { key, history, latest, active, pending };
  }
  return null;
}
function view(row: Row): GoalView {
  const e = row.envelope as Extract<LearnedEvent, { kind: 'savings_goal' }>;
  return { ...e.payload, revision: e.revision, eventId: e.eventId, recordedAt: e.recordedAt, blobId: row.blobId, confirmedAt: row.recalledAt };
}
function schedule(goal: SavingsGoal, today: string): Schedule {
  const p = goalPlan(goal, goal.startDate, today);
  return { contribution: p.contribution.toString(), remaining: p.remaining.toString(), progress: p.progress, reached: p.reached, overdue: p.overdue, dates: p.dates.length, nextDate: p.dates[0] ?? null, per: goal.frequency === 'monthly' ? 'month' : 'week' };
}
const scheduleText = (s: Schedule) => s.reached ? 'The goal is reached, so nothing more is suggested.' : s.overdue ? `The target date has passed, so the remaining ${usd(s.remaining)} USDC is suggested now.` : `Suggested: ${usd(s.contribution)} USDC a ${s.per} over the ${s.dates} remaining ${s.per === 'week' ? 'weeks' : 'months'}, starting ${longDate(s.nextDate!)}.`;
const PLANNED = 'These are planned contributions, not payments: nothing is moved or locked in your wallet.';

// ---- Answering ------------------------------------------------------------------------------------------------------
export function answer(state: AccountState, message: string, options: { demo?: boolean } = {}): AssistantAnswer {
  const q = understand(message);
  const goal = goalRecords(state);
  const activeGoal = goal?.active ? view(goal.active) : null;
  const noGoal = (): AssistantAnswer => ({ intent: q.intent, text: goal?.pending ? 'Your savings goal is still being saved to Walrus Memory. It will count once Walrus confirms it.' : 'You don\'t have a confirmed savings goal yet. Tell me one, for example "I\'m saving 500 USDC for a laptop".', blocks: [], suggestions: ['I\'m saving 500 USDC for a laptop', 'What can I spend before my plan ends?'] });
  switch (q.intent) {
    case 'current_goal': {
      if (!activeGoal) return noGoal();
      const s = schedule(activeGoal, state.today);
      const pending = goal?.pending?.envelope.kind === 'savings_goal' ? ` A change to ${usd(goal.pending.envelope.payload.target)} USDC is still saving; this goal stays in use until Walrus confirms it.` : '';
      return { intent: q.intent, text: `From your Walrus Memory: you're saving for ${activeGoal.purpose}, ${usd(activeGoal.target)} USDC by ${longDate(activeGoal.targetDate)}, with ${activeGoal.frequency} contributions. ${scheduleText(s)}${pending} "Saved so far" (${usd(activeGoal.saved)} USDC) is what you entered, not a wallet reading.`, blocks: [{ kind: 'goal', source: 'walrus', goal: activeGoal, schedule: s }], suggestions: ['What was my previous target?', 'How much should I contribute weekly?', 'Increase my goal to 1,000 USDC'] };
    }
    case 'goal_history': {
      if (!goal) return noGoal();
      const revisions = goal.history.filter(r => r.envelope.kind === 'savings_goal').map(r => { const p = (r.envelope as Extract<LearnedEvent, { kind: 'savings_goal' }>).payload; return { revision: r.envelope.revision, purpose: p.purpose, target: p.target, recordedAt: r.envelope.recordedAt, state: (r === goal.active ? 'active' : r.state === 'failed' ? 'failed' : UNSETTLED.includes(r.state) ? 'saving' : 'replaced') as 'active' | 'replaced' | 'saving' | 'failed' }; });
      const replaced = revisions.filter(r => r.state === 'replaced');
      const text = replaced.length && activeGoal ? `Your previous target was ${usd(replaced[replaced.length - 1].target)} USDC (version ${replaced[replaced.length - 1].revision}). You changed it to ${usd(activeGoal.target)} USDC in version ${activeGoal.revision}, which is the one in use. Walrus keeps every version; older ones are marked replaced and no longer count.` : activeGoal ? `Your goal hasn't been changed: version ${activeGoal.revision}, ${usd(activeGoal.target)} USDC, is the only one.` : 'Your goal has no confirmed version yet.';
      return { intent: q.intent, text, blocks: [{ kind: 'goal_history', source: 'walrus', revisions }], suggestions: ['What am I saving towards?', 'How much should I contribute weekly?'] };
    }
    case 'contribution':
    case 'what_if': {
      if (!activeGoal) return noGoal();
      const target = q.intent === 'what_if' && q.amount !== null ? q.amount : integer(activeGoal.target);
      if (target <= 0n) return { intent: q.intent, text: 'A target has to be more than zero.', blocks: [], suggestions: SUGGESTIONS.slice(0, 3) };
      const goalNow = { ...activeGoal, target: target.toString(), frequency: q.frequency ?? activeGoal.frequency };
      const s = schedule(goalNow, state.today);
      const hypothetical = target !== integer(activeGoal.target) || goalNow.frequency !== activeGoal.frequency;
      const current = schedule(activeGoal, state.today);
      const text = hypothetical ? `If your target were ${usd(target)} USDC with ${goalNow.frequency} contributions, you'd need ${usd(s.contribution)} USDC a ${s.per} (today it's ${usd(current.contribution)} USDC a ${current.per} for ${usd(activeGoal.target)} USDC). Nothing has been changed.` : `${scheduleText(s)} That's for your ${usd(activeGoal.target)} USDC ${activeGoal.purpose} goal, using its saved-so-far amount of ${usd(activeGoal.saved)} USDC. ${PLANNED}`;
      return { intent: q.intent, text, blocks: [{ kind: 'contribution', source: 'calculated', target: target.toString(), saved: activeGoal.saved, schedule: s, hypothetical }], suggestions: hypothetical ? [`Change my goal to ${plain(target)} USDC`, 'What am I saving towards?'] : ['What if my target was 1,000 USDC?', 'What can I spend before my plan ends?'] };
    }
    case 'propose_goal': {
      if (goal?.pending) return { intent: q.intent, text: 'A change to your goal is still being saved to Walrus Memory. Wait until it\'s confirmed, then ask again.', blocks: [], suggestions: ['What am I saving towards?'] };
      const savedUpdate = /\b(i've|i have|i) saved\b/i.test(message);
      const base = activeGoal ?? (goal?.latest.envelope.kind === 'savings_goal' ? view(goal.latest) : null);
      if (!base) {
        if (q.amount === null || q.amount <= 0n) return { intent: q.intent, text: 'Tell me the target and what it\'s for, for example "I\'m saving 500 USDC for a laptop".', blocks: [], suggestions: ['I\'m saving 500 USDC for a laptop'] };
        const purpose = q.purpose ? q.purpose.charAt(0).toUpperCase() + q.purpose.slice(1, 60) : 'My goal';
        const targetDate = addMonths(state.today, 3), frequency = q.frequency ?? 'weekly';
        const draft: SavingsGoal = { goalId: 'proposal', purpose, target: q.amount.toString(), saved: '0', frequency, targetDate, startDate: state.today };
        const s = schedule(draft, state.today);
        return { intent: q.intent, text: `Here's the goal I'd save: ${purpose}, ${usd(q.amount)} USDC by ${longDate(targetDate)} with ${frequency} contributions, about ${usd(s.contribution)} USDC a ${s.per}. You can change the date later on Plan. Nothing is saved until you confirm.`, blocks: [{ kind: 'proposal', source: 'calculated', current: null, proposed: { purpose, target: q.amount.toString(), saved: '0', frequency, targetDate, contribution: s.contribution, per: s.per }, request: { path: '/goals', body: { purpose, target: plain(q.amount), saved: '0', frequency, targetDate, expectedRevision: 0 } } }], suggestions: [] };
      }
      const nextTarget = savedUpdate ? integer(base.target) : q.amount ?? integer(base.target);
      const nextSaved = savedUpdate && q.amount !== null ? q.amount : integer(base.saved);
      const frequency = q.frequency ?? base.frequency;
      if (nextTarget <= 0n) return { intent: q.intent, text: 'A target has to be more than zero.', blocks: [], suggestions: [] };
      if (nextTarget === integer(base.target) && nextSaved === integer(base.saved) && frequency === base.frequency) return { intent: q.intent, text: `Your goal is already ${usd(base.target)} USDC with ${base.frequency} contributions.`, blocks: [], suggestions: ['What am I saving towards?'] };
      const latest = goal!.latest;
      const draft: SavingsGoal = { goalId: base.goalId, purpose: base.purpose, target: nextTarget.toString(), saved: nextSaved.toString(), frequency, targetDate: base.targetDate, startDate: base.startDate };
      const before = activeGoal ? schedule(activeGoal, state.today) : null, after = schedule(draft, state.today);
      const change = savedUpdate ? `saved so far from ${usd(base.saved)} to ${usd(nextSaved)} USDC` : nextTarget !== integer(base.target) ? `your target from ${usd(base.target)} to ${usd(nextTarget)} USDC` : `contributions from ${base.frequency} to ${frequency}`;
      return { intent: q.intent, text: `I'd change ${change}. ${before ? `Your suggested contribution would go from ${usd(before.contribution)} to ${usd(after.contribution)} USDC a ${after.per}.` : `That's ${usd(after.contribution)} USDC a ${after.per}.`} Nothing is saved until you confirm; your current goal stays in use until Walrus confirms the change.`, blocks: [{ kind: 'proposal', source: 'calculated', current: before && activeGoal ? { target: activeGoal.target, contribution: before.contribution, per: before.per } : null, proposed: { purpose: base.purpose, target: nextTarget.toString(), saved: nextSaved.toString(), frequency, targetDate: base.targetDate, contribution: after.contribution, per: after.per }, request: { path: '/goals/' + encodeURIComponent(base.goalId), body: { purpose: base.purpose, target: plain(nextTarget), saved: plain(nextSaved), frequency, targetDate: base.targetDate, expectedRevision: latest.envelope.revision, supersedesEventId: latest.envelope.eventId } } }], suggestions: [] };
    }
    case 'transactions': {
      const coin = q.coin, direction = q.direction;
      const rows = state.movements.filter(m => m.status === 'success' && (m.coinType === USDC_TYPE || m.coinType === SUI_TYPE) && (!coin || (coin === 'USDC' ? m.coinType === USDC_TYPE : m.coinType === SUI_TYPE)) && (!direction || (direction === 'in' ? integer(m.delta) > 0n : integer(m.delta) < 0n)))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const labels = new Map(state.annotations.map(a => [a.movementId, a.note]));
      const shown = rows.slice(0, 8).map(m => { const d = integer(m.delta), isSui = m.coinType === SUI_TYPE; return { id: m.id, direction: (d > 0n ? 'in' : 'out') as 'in' | 'out', amount: amount(d < 0n ? -d : d, isSui ? 9 : 6, isSui ? 4 : 2), coin: (isSui ? 'SUI' : 'USDC') as 'USDC' | 'SUI', timestamp: m.timestamp, counterparty: short(m.counterparty), label: labels.get(m.id) ?? null }; });
      const coverage = { state: state.coverage.state, from: state.coverage.from, to: state.coverage.to, reason: state.coverage.reason };
      const scope = `${direction === 'in' ? 'incoming ' : direction === 'out' ? 'outgoing ' : ''}${coin ?? 'USDC and SUI'}`;
      const limit = state.coverage.state === 'complete' ? `This covers your imported history${state.coverage.from ? ` from ${longDate(state.coverage.from.slice(0, 10))}` : ''}.` : state.coverage.state === 'not_synced' ? (rows.length ? 'Your full history hasn\'t been imported, so these are only payments Sui Money has seen; older activity may be missing. Import it on Activity.' : 'Your history hasn\'t been imported yet. Import it on Activity to see your transactions.') : `Your imported history is incomplete, so some activity may be missing: ${state.coverage.reason}`;
      const text = rows.length ? `From the Sui blockchain (read through Tatum): I see ${rows.length} ${scope} transaction${rows.length === 1 ? '' : 's'}${rows.length > 8 ? ', newest 8 shown' : ''}. ${limit}` : `I found no ${scope} transactions. ${limit}`;
      return { intent: q.intent, text, blocks: [{ kind: 'transactions', source: 'sui', rows: shown, coverage, total: rows.length }], suggestions: ['Show incoming transactions', 'What\'s my balance?'] };
    }
    case 'balances': {
      const b = state.balance;
      if (!b) return { intent: q.intent, text: 'I don\'t have a balance reading for your wallet yet, so it\'s unknown, not zero. Open Today to read it from Sui.', blocks: [{ kind: 'balances', source: 'sui', usdc: null, sui: null, observedAt: null, stale: true }], suggestions: [] };
      const when = new Date(b.observedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
      return { intent: q.intent, text: b.stale ? `Your last balance reading (${when}) showed ${usd(b.usdc)} USDC and ${amount(b.sui, 9, 4)} SUI. It's out of date, so treat your current balance as unknown until it refreshes.` : `Read from the Sui blockchain at ${when}: ${usd(b.usdc)} USDC and ${amount(b.sui, 9, 4)} SUI.`, blocks: [{ kind: 'balances', source: 'sui', usdc: b.usdc, sui: b.sui, observedAt: b.observedAt, stale: b.stale }], suggestions: ['What can I spend before my plan ends?', 'Show my recent USDC transactions'] };
    }
    case 'plan':
    case 'can_spend': {
      const block = planBlock(state);
      if (!block.ready) return { intent: q.intent, text: `I can't work out what you can spend yet: ${block.reason}`, blocks: [block], suggestions: [] };
      if (state.balance?.stale) return { intent: q.intent, text: 'Your balance reading is out of date, so I won\'t estimate what you can spend until it refreshes. It refreshes automatically on this screen; ask again in a moment.', blocks: [], suggestions: ['What\'s my balance?'] };
      const held = block.held && integer(block.held) > 0n ? ` ${usd(block.held)} USDC you've already paid toward bills is still set aside until your balance confirms it, so this may be a little low, never too high.` : '';
      const goalPart = block.goalSetAside && integer(block.goalSetAside) > 0n ? `, ${usd(block.goalSetAside)} for your savings goal` : '';
      if (q.intent === 'can_spend' && q.amount !== null) {
        const left = integer(block.leftToSpend!), ok = q.amount <= left;
        return { intent: q.intent, text: ok ? `Yes. After bills${goalPart} and your reserve, you have ${usd(left)} USDC left to spend until ${longDate(block.endDate!)}; spending ${usd(q.amount)} leaves ${usd(left - q.amount)}.${held}` : `Not without dipping into your plan. You have ${usd(left)} USDC left to spend after bills${goalPart} and your reserve; ${usd(q.amount)} is ${usd(q.amount - left)} more.${held}`, blocks: [block], suggestions: ['How much should I contribute weekly?'] };
      }
      return { intent: q.intent, text: block.shortfall && integer(block.shortfall) > 0n ? `Your bills${goalPart} and reserve are ${usd(block.shortfall)} USDC more than your wallet holds, so there's nothing left to spend until ${longDate(block.endDate!)}.${held}` : `You have ${usd(block.leftToSpend!)} USDC left to spend until ${longDate(block.endDate!)}, about ${usd(block.daily!)} a day, after bills${goalPart} and your reserve.${held}`, blocks: [block], suggestions: ['Can I spend 50 USDC?', 'What am I saving towards?'] };
    }
    case 'memories': {
      const items = activeEvents(state.memories, state.profile.id).map(m => ({ kind: m.envelope.kind, summary: memorySummary(m.envelope), recordedAt: m.envelope.recordedAt })).filter(i => i.summary).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 8);
      return { intent: q.intent, text: items.length ? `Here's what's confirmed in your Walrus Memory (newest first). Older versions of changed items are kept but don't count.` : 'Nothing is confirmed in your Walrus Memory yet.', blocks: [{ kind: 'memories', source: 'walrus', items }], suggestions: ['Verify my memories from Walrus', 'What am I saving towards?'] };
    }
    case 'verify':
      return { intent: q.intent, text: options.demo ? 'Live verification needs your own signed-in account.' : 'Checking with Walrus now: each confirmed memory is read back and compared with what was saved.', blocks: options.demo ? [] : [{ kind: 'verify', source: 'walrus' }], suggestions: [] };
    default:
      return { intent: 'help', text: 'I can answer from your Walrus Memory, your wallet on Sui and your plan. Try one of these:', blocks: [], suggestions: SUGGESTIONS };
  }
}

function planBlock(state: AccountState): Extract<AssistantBlock, { kind: 'plan' }> {
  const p = summarize(state).plan;
  if (p.state !== 'ready') return { kind: 'plan', source: 'calculated', ready: false, reason: p.state === 'unknown_balance' ? 'your balance hasn\'t been read yet, so it\'s unknown, not zero.' : 'your plan has no end date yet. Set one on Plan.', endDate: state.plan.endDate, leftToSpend: null, daily: null, bills: null, goalSetAside: null, reserve: null, held: null, shortfall: null };
  const goalSetAside = p.rows.filter(r => r.ruleId.startsWith('goal:')).reduce((n, r) => n + r.outstanding, 0n);
  return { kind: 'plan', source: 'calculated', ready: true, reason: null, endDate: state.plan.endDate, leftToSpend: p.discretionary.toString(), daily: p.daily.toString(), bills: (p.commitments - goalSetAside).toString(), goalSetAside: goalSetAside.toString(), reserve: p.reserve.toString(), held: p.held.toString(), shortfall: p.shortfall.toString() };
}
function memorySummary(e: LearnedEvent): string {
  switch (e.kind) {
    case 'savings_goal': return `Saving for ${e.payload.purpose}: ${usd(e.payload.target)} USDC by ${e.payload.targetDate}, ${e.payload.frequency}`;
    case 'payment_explanation': return `Payment label: "${e.payload.note}" (${e.payload.ownTransfer ? 'own transfer' : e.payload.category})`;
    case 'planning_preference': return e.payload.preference === 'reserve' && /^\d+$/.test(e.payload.value) ? `Usual reserve: ${usd(e.payload.value)} USDC` : `Planning preference: ${e.payload.value}`;
    case 'recurrence_confirmation': return `Recurring bill: ${e.payload.alias}, ${usd(e.payload.amount)} USDC ${e.payload.frequency}`;
    default: return '';
  }
}
function addMonths(date: string, months: number) {
  const [y, m, d] = date.split('-').map(Number), t = new Date(Date.UTC(y, m - 1 + months, 1)), last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
