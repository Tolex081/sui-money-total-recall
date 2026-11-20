'use client';
import { useMemo, useState, type FormEvent } from 'react';
import { Lightbulb, TrendingUp, Target, PiggyBank, X, ShieldAlert, ShieldCheck, Info } from 'lucide-react';
import type { AccountState } from '@/domain/state';
import { amount, units } from '@/domain/money';
import { insights, checkPayment, dismissedInsights, type Insight, type PaymentCheck } from '@/domain/insights';
import { summarize } from '@/domain/summary';
import { IntegrationIdentity } from './integration-brand';
import { api } from './http';

const money = (v: bigint) => amount(v);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "What memory changed": the same plan worked out with and without what Sui Money remembers, the reasons, and advice
// learned from the user's own labelled spending. Dismissing advice is remembered too.
export function LearnedInsights({ state }: { state: AccountState }) {
  const demo = state.mode === 'synthetic';
  const [hidden, setHidden] = useState<string[]>([]), [error, setError] = useState('');
  const dismissed = useMemo(() => [...dismissedInsights(state, hidden)], [state, hidden]);
  const result = useMemo(() => insights(state, { dismissed }), [state, dismissed]);
  const learnedBills = useMemo(() => {
    const plan = summarize(state).plan;
    return plan.state === 'ready' ? plan.rows.filter(r => r.learnedEventId && r.outstanding > 0n) : [];
  }, [state]);

  if (!result.ready) return null;
  const { recommended, naive, routineRows, items } = result;
  const difference = naive.daily - recommended.daily;
  const labelCount = new Set(routineRows.flatMap(r => r.memoryIds)).size;
  const billTotal = learnedBills.reduce((t, r) => t + r.outstanding, 0n);

  async function dismiss(item: Insight) {
    setHidden(h => [...h, item.id]); setError('');
    if (demo) return;
    try { await api('/insights/decision', { insightId: item.id, decision: 'rejected' }); }
    catch (e) { setHidden(h => h.filter(id => id !== item.id)); setError((e as Error).message); }
  }

  return <section className="card insights-card" aria-labelledby="insights-title" data-tour="insights">
    <div className="section-title"><div><h2 id="insights-title">What memory changed</h2><p className="muted small-text">The same plan, worked out with and without what Sui Money remembers on <IntegrationIdentity provider="walrus"/>.</p></div></div>
    <div className="insights-compare">
      <div className="insights-figure"><span className="insights-figure-label">Without memory</span><strong>{money(naive.daily)}</strong><small>USDC a day</small></div>
      <div className="insights-figure learned"><span className="insights-figure-label">With memory</span><strong>{money(recommended.daily)}</strong><small>USDC a day</small></div>
    </div>
    <p className="insights-verdict">{difference > 0n
      ? <>Memory lowers your daily figure by <b>{money(difference)} USDC</b>, so it doesn’t promise money your habits already spend.</>
      : difference < 0n ? <>Memory raises your daily figure by <b>{money(-difference)} USDC</b>.</> : <>Memory doesn’t change today’s figure yet. Label a few more payments and it will.</>}</p>
    {(learnedBills.length > 0 || routineRows.length > 0) && <ul className="insights-why">
      {learnedBills.length > 0 && <li><Info size={15} aria-hidden="true"/><span><b>{money(billTotal)} USDC</b> of bills you confirmed from past payments: {[...new Set(learnedBills.map(b => b.alias))].join(', ')}.</span></li>}
      {routineRows.map(p => <li key={p.category}><TrendingUp size={15} aria-hidden="true"/><span><b>{p.category}</b>: about {money(p.weekly)} USDC a week in {p.weeksSeen} of the last 4 weeks, so {money(p.expected)} USDC is expected before your plan ends. Learned from {plural(p.memoryIds.length, 'remembered label')}.</span></li>)}
    </ul>}
    {items.filter(i => i.kind !== 'routine_spend').length > 0 && <ul className="insights-list" aria-label="Advice learned from your spending">
      {items.filter(i => i.kind !== 'routine_spend').map(item => <li key={item.id} className={'insight insight-' + item.kind}>
        <InsightIcon item={item}/>
        <p>{insightText(item)}</p>
        <button className="icon-button" aria-label="Dismiss this advice" title={demo ? 'Dismiss (demo: this browser only)' : 'Dismiss. Sui Money remembers this.'} onClick={() => void dismiss(item)}><X size={15} aria-hidden="true"/></button>
      </li>)}
    </ul>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <PaymentChecker state={state} categories={result.patterns.map(p => p.category)}/>
    <p className="micro">{labelCount > 0 ? `${plural(labelCount, 'remembered label')} taught these patterns.` : 'Patterns appear once a category is labelled in 3 of the last 4 weeks.'} Rules, not guesses: each figure names the memories it used.{result.dismissedCount ? ` ${plural(result.dismissedCount, 'piece')} of advice you dismissed stays hidden.` : ''}</p>
  </section>;
}

function InsightIcon({ item }: { item: Insight }) {
  const Icon = item.kind === 'goal_at_risk' ? ShieldAlert : item.kind === 'goal_on_track' ? Target : item.kind === 'save_suggestion' ? PiggyBank : item.kind === 'trend_up' ? TrendingUp : Lightbulb;
  return <Icon size={18} aria-hidden="true"/>;
}

export function insightText(item: Insight): string {
  switch (item.kind) {
    case 'goal_at_risk': return item.cutCategory && item.weeklyCut
      ? `At your usual pace, your ${item.purpose} goal is ${money(item.gap)} USDC short this plan. Spending ${money(item.weeklyCut)} USDC less a week on ${item.cutCategory} closes the gap.`
      : `At your usual pace, your ${item.purpose} goal is ${money(item.gap)} USDC short this plan. One category can’t close it; consider a later target date.`;
    case 'goal_on_track': return `Your ${item.purpose} goal is on track, even after your usual spending. ${money(item.slack)} USDC is still free.`;
    case 'save_suggestion': return `After your usual spending, about ${money(item.slack)} USDC is free. Saving ${money(item.weekly)} USDC a week keeps half of it as a cushion.`;
    case 'trend_up': return `${item.category} is up: ${money(item.lastWeek)} USDC last week against about ${money(item.weekly)} USDC usually.`;
    case 'routine_spend': return `${item.category}: about ${money(item.weekly)} USDC a week.`;
  }
}

// Try a payment before making it. Uses the same check as the Send screen.
function PaymentChecker({ state, categories }: { state: AccountState; categories: string[] }) {
  const [value, setValue] = useState(''), [category, setCategory] = useState(categories[0] ?? ''), [check, setCheck] = useState<PaymentCheck | null>(null), [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    try { const n = units(value.trim()); if (n <= 0n) throw new Error('Enter an amount above zero.'); setCheck(checkPayment(state, n, category || null)); }
    catch (e) { setCheck(null); setError((e as Error).message); }
  }
  return <form className="payment-check" onSubmit={submit} aria-label="Check a payment against your plan">
    <h3>Check a payment first</h3>
    <div className="payment-check-row">
      <label><span>Amount (USDC)</span><input inputMode="decimal" value={value} onChange={e => { setValue(e.target.value); setCheck(null); }} placeholder="0.00"/></label>
      <label><span>For</span><select value={category} onChange={e => { setCategory(e.target.value); setCheck(null); }}>{categories.map(c => <option key={c}>{c}</option>)}<option value="">Something else</option></select></label>
      <button className="button" type="submit">Check</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {check && <PaymentVerdict check={check}/>}
  </form>;
}

export function PaymentVerdict({ check }: { check: PaymentCheck }) {
  const Icon = check.level === 'ok' ? ShieldCheck : ShieldAlert;
  return <div className={'payment-verdict verdict-' + check.level} role="status">
    <Icon size={18} aria-hidden="true"/>
    <div>
      {check.messages.map(m => <p key={m}>{m}</p>)}
      {check.cutsInto.length > 0 && <ul>{check.cutsInto.map(c => <li key={c.alias + c.dueDate}>{c.alias}, due {c.dueDate}: {money(c.amount)} USDC short</li>)}</ul>}
      {check.dailyAfter !== null && check.level !== 'stop' && <p className="micro">Afterwards, about {money(check.dailyAfter)} USDC a day is left once your usual spending is covered.</p>}
    </div>
  </div>;
}
