'use client';
import { useState, type FormEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { api } from './http';
import type { AccountState } from '@/domain/state';
import { amount, units } from '@/domain/money';
import { emptySuiBudget, suiOccurrences, suiPlanning, suiSpending } from '@/domain/sui-budget';
import { localToday } from '@/domain/planning';

const sui = (value: string | bigint) => amount(value, 9, 9).replace(/(\.\d{2}\d*?)0+$/, '$1');
const date = (d: string, timezone: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: timezone }).format(new Date(d + 'T12:00:00Z'));
const frequencyLabel = { once: 'Once', weekly: 'Every week', monthly: 'Every month' } as const;

// SUI planned in its own units beside the USDC plan. Same end date, its own reserve and bills; nothing is converted.
export function SuiBudgetPanel({ state, onChanged }: { state: AccountState; onChanged: () => void }) {
  const budget = state.suiBudget ?? emptySuiBudget, timezone = state.plan.timezone;
  const plan = suiPlanning({ balance: state.balance, plan: state.plan, budget, today: state.today });
  const now = Date.parse(state.now), spent = suiSpending(state.movements, state.annotations, { from: new Date(now - 30 * 86400000).toISOString(), to: state.now });
  const upcoming = suiOccurrences(budget.bills, state.plan.endDate ?? localToday(new Date(now + 31 * 86400000).toISOString(), timezone)).filter(o => !o.cancelled).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const [editingReserve, setEditingReserve] = useState(false), [adding, setAdding] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  async function run(path: string, body: unknown, done?: () => void) {
    setBusy(true); setError('');
    try { await api(path, body); done?.(); onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <section className="card sui-budget" aria-labelledby="sui-budget-title">
    <div className="section-title"><div><h2 id="sui-budget-title">SUI budget</h2><p className="muted small-text">Planned in SUI, separately from USDC, up to {state.plan.endDate ? date(state.plan.endDate, timezone) : 'your plan’s end date'}.</p></div>
      <button className="button small" onClick={() => setAdding(!adding)} aria-expanded={adding}><Plus size={14} aria-hidden="true"/>Add SUI bill</button>
    </div>
    <dl className="sui-budget-figures">
      <div className="lead"><dt>SUI left to spend</dt><dd>{plan.state === 'ready' ? <>{sui(plan.discretionary)} <small>SUI</small></> : '—'}</dd>
        <dd className="micro">{plan.state === 'ready' ? (plan.shortfall > 0n ? `Your SUI bills and reserve are ${sui(plan.shortfall)} SUI more than you hold.` : `About ${sui(plan.daily)} SUI a day for ${plan.days} days. Keep some for network fees.`) : plan.state === 'incomplete' ? 'Set your plan’s end date above to see this.' : plan.reason}</dd></div>
      <div><dt>SUI in wallet</dt><dd>{state.balance ? sui(state.balance.sui) : '—'} <small>SUI</small></dd></div>
      <div><dt>SUI bills before the end date</dt><dd>{plan.state === 'ready' ? sui(plan.commitments) : '—'} <small>SUI</small></dd></div>
      <div><dt>SUI reserve</dt><dd>{sui(budget.reserve)} <small>SUI</small> <button className="text-button" onClick={() => setEditingReserve(!editingReserve)} aria-expanded={editingReserve}>Change</button></dd></div>
      <div><dt>SUI spent, last 30 days</dt><dd>{sui(spent.spent)} <small>SUI</small></dd></div>
    </dl>
    {editingReserve && <ReserveForm budget={budget} busy={busy} onSave={reserve => run('/sui-budget/reserve', { reserve, version: budget.version }, () => setEditingReserve(false))} onCancel={() => setEditingReserve(false)}/>}
    {adding && <BillForm today={state.today} busy={busy} onSave={bill => run('/sui-budget/bills', bill, () => setAdding(false))} onCancel={() => setAdding(false)}/>}
    {error && <p className="read-inline-error" role="alert">{error}</p>}
    <h3 className="sui-budget-subhead">Upcoming SUI bills</h3>
    {upcoming.length ? <ul className="sui-bills">{upcoming.slice(0, 12).map(o => { const bill = budget.bills.find(b => b.id === o.ruleId)!; return <li key={o.id}>
      <span><strong>{o.alias}</strong><span className="muted"> · {date(o.dueDate, timezone)} · {frequencyLabel[bill.frequency]}</span></span>
      <span className="sui-bill-amount">{sui(o.amount)} <small>SUI</small></span>
      <span className="sui-bill-actions">
        <button className="text-button" disabled={busy} onClick={() => void run(`/sui-budget/bills/${o.ruleId}/paid`, { date: o.dueDate })}><Check size={13} aria-hidden="true"/> Paid<span className="sr-only"> {o.alias} on {o.dueDate}</span></button>
        <button className="text-button" disabled={busy} onClick={() => void run(`/sui-budget/bills/${o.ruleId}/remove`, {})}><X size={13} aria-hidden="true"/> Remove<span className="sr-only"> {o.alias}{bill.frequency !== 'once' ? ' and its future payments' : ''}</span></button>
      </span>
    </li>; })}</ul> : <p className="read-empty">No SUI bills yet. Add one for anything you pay in SUI.</p>}
  </section>;
}

function ReserveForm({ budget, busy, onSave, onCancel }: { budget: { reserve: string }; busy: boolean; onSave: (reserve: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(sui(budget.reserve).replaceAll(',', ''));
  let problem = ''; try { units(value.trim() || '0', 9); } catch (e) { problem = (e as Error).message; }
  return <form className="read-label-panel sui-inline-form" onSubmit={(e: FormEvent) => { e.preventDefault(); if (!problem) onSave(value.trim() || '0'); }}>
    <label>SUI to keep untouched<input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(',', '.'))} aria-invalid={!!problem} aria-describedby="sui-reserve-help"/></label>
    <p className={problem ? 'read-inline-error' : 'micro'} id="sui-reserve-help">{problem || 'Nothing is locked. It’s only left out of what you can spend.'}</p>
    <div className="read-label-actions"><button className="button primary small" disabled={busy || !!problem}>{busy ? 'Saving…' : 'Save reserve'}</button><button type="button" className="button small" onClick={onCancel}>Cancel</button></div>
  </form>;
}

function BillForm({ today, busy, onSave, onCancel }: { today: string; busy: boolean; onSave: (bill: { alias: string; amount: string; startDate: string; frequency: string }) => void; onCancel: () => void }) {
  const [alias, setAlias] = useState(''), [value, setValue] = useState(''), [start, setStart] = useState(today), [frequency, setFrequency] = useState('monthly');
  let problem = ''; if (value.trim()) { try { if (units(value.trim(), 9) === 0n) problem = 'Enter an amount above zero.'; } catch (e) { problem = (e as Error).message; } }
  return <form className="read-label-panel sui-inline-form" onSubmit={(e: FormEvent) => { e.preventDefault(); if (!problem) onSave({ alias: alias.trim(), amount: value.trim(), startDate: start, frequency }); }}>
    <label>Name<input value={alias} onChange={e => setAlias(e.target.value)} maxLength={60} placeholder="e.g. Validator fee" required/></label>
    <label>Amount in SUI<input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(',', '.'))} placeholder="0.00" required aria-invalid={!!problem} aria-describedby="sui-bill-help"/></label>
    {problem && <p className="read-inline-error" id="sui-bill-help" role="alert">{problem}</p>}
    <label>First payment<input type="date" value={start} min={today} onChange={e => setStart(e.target.value)} required/></label>
    <label>Repeats<select value={frequency} onChange={e => setFrequency(e.target.value)}><option value="once">Once</option><option value="weekly">Every week</option><option value="monthly">Every month</option></select></label>
    <p className="micro">Use a short alias, not a person’s name.</p>
    <div className="read-label-actions"><button className="button primary small" disabled={busy || !alias.trim() || !value.trim() || !!problem}>{busy ? 'Saving…' : 'Add bill'}</button><button type="button" className="button small" onClick={onCancel}>Cancel</button></div>
  </form>;
}
