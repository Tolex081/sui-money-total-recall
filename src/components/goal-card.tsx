'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PencilLine, PiggyBank, RefreshCw } from 'lucide-react';
import { Temporal } from '@js-temporal/polyfill';
import type { AccountState } from '@/domain/state';
import type { LearnedEvent } from '@/domain/learning';
import { amount, units } from '@/domain/money';
import { goalPlan, type SavingsGoal } from '@/domain/goals';
import { api } from './http';

type Act = (path: string, payload: unknown, success?: string) => Promise<Record<string, unknown> | null>;
type Memory = AccountState['memories'][number];
type GoalEvent = Extract<LearnedEvent, { kind: 'savings_goal' }>;
const UNSETTLED = ['queued', 'submitting', 'accepted', 'saved', 'submission_outcome_unknown'];
const usdc = (v: string | bigint) => amount(v);
const plain = (v: string) => amount(v, 6, 6).replaceAll(',', '').replace(/\.?0+$/, '') || '0';
const longDate = (d: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const isGoal = (m: Memory | undefined): m is Memory & { envelope: GoalEvent } => m?.envelope.kind === 'savings_goal';

// The goal's state from its memory revisions: the confirmed one is in use; a newer unconfirmed one is a pending
// change that doesn't touch the plan until Walrus confirms it (brief 9.4a).
function goalStatus(state: AccountState) {
  const byKey = new Map<string, Memory[]>();
  for (const m of state.memories) if (m.envelope.logicalKey.startsWith('goal:')) byKey.set(m.envelope.logicalKey, [...(byKey.get(m.envelope.logicalKey) ?? []), m]);
  for (const history of byKey.values()) {
    history.sort((a, b) => b.envelope.revision - a.envelope.revision);
    const latest = history[0], active = history.find(m => m.state === 'recall_confirmed');
    if (active?.envelope.kind === 'deactivation' && latest === active) continue;
    if (latest.envelope.kind === 'deactivation' && latest.state !== 'failed') continue;
    const shown = isGoal(active) ? active : undefined;
    const pending = latest !== active && isGoal(latest) ? latest : undefined;
    if (!shown && (!pending || pending.state === 'failed')) continue;
    return { shown, pending, pendingState: pending ? (pending.state === 'failed' ? 'failed' : UNSETTLED.includes(pending.state) ? 'saving' : pending.state) : null };
  }
  return null;
}

export function GoalCard({ state, demo, busy, act, onChanged }: { state: AccountState; demo: boolean; busy: boolean; act: Act; onChanged?: () => void }) {
  const status = goalStatus(state);
  const [editing, setEditing] = useState(false);
  const reload = useRef(onChanged);
  useEffect(() => { reload.current = onChanged; }, [onChanged]);
  const waiting = status?.pendingState === 'saving' ? status.pending!.envelope.eventId : '';

  // No background worker exists, so the page moves a pending goal save along until Walrus confirms it.
  useEffect(() => {
    if (!waiting || demo) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 12 && !cancelled; attempt++) {
        try { const job = await api<{ state: string }>('/memory-jobs/advance', {}); if (cancelled) return; if (['recall_confirmed', 'idle', 'failed', 'submission_outcome_unknown'].includes(job.state)) { reload.current?.(); return; } } catch { return; }
        await new Promise(resolve => setTimeout(resolve, 7000));
      }
    })();
    return () => { cancelled = true; };
  }, [waiting, demo]);

  const shown = status?.shown?.envelope, pending = status?.pending?.envelope;
  async function save(goal: Omit<SavingsGoal, 'goalId' | 'startDate'>) {
    const base = pending ?? shown;
    const path = base ? '/goals/' + encodeURIComponent(base.payload.goalId) : '/goals';
    const latest = base && status?.pendingState === 'failed' ? status.pending!.envelope : base;
    const result = await act(path, { ...goal, expectedRevision: latest?.revision ?? 0, ...(latest ? { supersedesEventId: latest.eventId } : {}) }, 'Goal sent to Walrus Memory.');
    if (result) setEditing(false);
    return !!result;
  }

  if (!shown && !pending || (!shown && status?.pendingState === 'failed')) return <section className="card goal-card" aria-labelledby="goal-title">
    <div className="section-title"><div><h2 id="goal-title"><PiggyBank size={18} aria-hidden="true"/> Savings goal</h2><p className="muted small-text">Tell Sui Money what you’re saving for. It’s remembered on Walrus and sets aside each contribution from what you can spend.</p></div></div>
    {editing || demo ? <GoalForm today={state.today} busy={busy} demo={demo} focusOnOpen={editing} onSave={save} onCancel={() => setEditing(false)}/> : <button className="button primary small" onClick={() => setEditing(true)}>Set a savings goal</button>}
  </section>;

  const inUse = shown?.payload, next = pending?.payload;
  const plan = inUse ? goalPlan(inUse, inUse.startDate, state.today) : null;
  const through = state.plan.endDate;
  const beforeEnd = plan && through ? plan.dates.filter(d => d < through) : [];
  const setAside = plan ? beforeEnd.reduce(total => { const left = plan.remaining - total; return total + (plan.contribution < left ? plan.contribution : left); }, 0n) : 0n;
  const per = inUse?.frequency === 'monthly' ? 'month' : 'week';
  return <section className="card goal-card" aria-labelledby="goal-title" aria-live="polite">
    <div className="section-title">
      <div><h2 id="goal-title"><PiggyBank size={18} aria-hidden="true"/> Saving for {(inUse ?? next)!.purpose}</h2><p className="muted small-text">Remembered on Walrus. {inUse ? 'In use in your plan.' : 'It counts in your plan once Walrus confirms it.'}</p></div>
      <span className={'move-state ' + (inUse ? 'confirmed' : '')}>{inUse ? 'Remembered' : 'Saving…'}</span>
    </div>
    {inUse && plan && <>
      <div className="goal-figures">
        <div><span className="micro">Target</span><strong>{usdc(inUse.target)} <small>USDC</small></strong><span className="micro">by {longDate(inUse.targetDate)}</span></div>
        <div><span className="micro">Saved so far</span><strong>{usdc(inUse.saved)} <small>USDC</small></strong><span className="micro">{plan.progress}% of the target</span></div>
        <div><span className="micro">Suggested</span><strong>{usdc(plan.contribution)} <small>USDC</small></strong><span className="micro">{plan.reached ? 'Goal reached' : plan.overdue ? 'today, the target date has passed' : `a ${per}, next ${longDate(plan.dates[0])}`}</span></div>
      </div>
      <div className="goal-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={plan.progress} aria-label="Progress towards the goal"><span style={{ width: `${plan.progress}%` }}/></div>
      <p className="micro">{plan.reached ? 'Nothing more is set aside.' : through ? `${usdc(setAside)} USDC is set aside from what you can spend: ${beforeEnd.length} contribution${beforeEnd.length === 1 ? '' : 's'} before ${longDate(through)}. Nothing is moved or locked in your wallet.` : 'Choose a plan date to set contributions aside.'} The suggestion splits what’s left evenly over the remaining {per}s, rounded up to the cent.</p>
    </>}
    {next && status?.pendingState === 'saving' && <p className="micro"><RefreshCw size={12} className="spin" aria-hidden="true"/> {inUse ? `Changing to ${usdc(next.target)} USDC by ${longDate(next.targetDate)}. The current goal stays in use until Walrus confirms.` : `Saving ${usdc(next.target)} USDC by ${longDate(next.targetDate)} to Walrus.`}</p>}
    {next && status?.pendingState === 'failed' && <p className="memory-failed">Your change to {usdc(next.target)} USDC didn’t save. The current goal is still in use.</p>}
    {inUse && !editing && status?.pendingState !== 'saving' && <div className="move-actions"><button className="button small" disabled={demo} onClick={() => setEditing(true)}><PencilLine size={14} aria-hidden="true"/>Change goal</button></div>}
    {editing && inUse && <GoalForm today={state.today} busy={busy} demo={demo} focusOnOpen initial={status?.pendingState === 'failed' && next ? next : inUse} onSave={save} onCancel={() => setEditing(false)}/>}
  </section>;
}

// A plain form, then a confirmation step that shows exactly what will be remembered.
function GoalForm({ today, busy, demo, focusOnOpen = false, initial, onSave, onCancel }: { today: string; busy: boolean; demo: boolean; focusOnOpen?: boolean; initial?: SavingsGoal; onSave: (goal: Omit<SavingsGoal, 'goalId' | 'startDate'>) => Promise<boolean>; onCancel: () => void }) {
  const [purpose, setPurpose] = useState(initial?.purpose ?? ''), [target, setTarget] = useState(initial ? plain(initial.target) : ''), [saved, setSaved] = useState(initial ? plain(initial.saved) : '0');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>(initial?.frequency ?? 'weekly'), [targetDate, setTargetDate] = useState(initial?.targetDate ?? Temporal.PlainDate.from(today).add({ months: 3 }).toString());
  const [confirming, setConfirming] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  // Only take focus when someone opened the form, never on page load.
  useEffect(() => { if (focusOnOpen) field.current?.focus(); }, [focusOnOpen]);
  let targetUnits: bigint | null = null, savedUnits: bigint | null = null, error = '';
  try { targetUnits = units(target.trim() || '0'); if (targetUnits <= 0n) error = 'Enter a target above zero.'; } catch (e) { error = (e as Error).message; }
  try { savedUnits = units(saved.trim() || '0'); } catch (e) { error ||= (e as Error).message; }
  if (!purpose.trim()) error ||= 'Say what you’re saving for.';
  if (!targetDate || targetDate < today) error ||= 'Choose today or a later date.';
  const unchanged = !!initial && purpose.trim() === initial.purpose && targetUnits?.toString() === initial.target && savedUnits?.toString() === initial.saved && frequency === initial.frequency && targetDate === initial.targetDate;
  const goal = { purpose: purpose.trim(), target: target.trim(), saved: saved.trim() || '0', frequency, targetDate };
  const preview = targetUnits && savedUnits !== null && !error ? goalPlan({ ...goal, goalId: 'preview', target: targetUnits.toString(), saved: savedUnits.toString(), startDate: today }, today, today) : null;

  function review(event: FormEvent) { event.preventDefault(); if (!error && !unchanged) setConfirming(true); }
  if (confirming) return <div className="read-label-panel goal-confirm" role="group" aria-labelledby="goal-confirm-title">
    <h3 id="goal-confirm-title">{initial ? 'Change your goal to this?' : 'Remember this goal?'}</h3>
    <p><strong>Saving for {goal.purpose}: {usdc(targetUnits!)} USDC by {longDate(targetDate)}</strong>, {frequency} contributions, {usdc(savedUnits!)} USDC saved so far.</p>
    {preview && <p className="micro">Suggested: {usdc(preview.contribution)} USDC a {frequency === 'weekly' ? 'week' : 'month'}.</p>}
    <p className="micro">Saved to Walrus Memory as {initial ? 'a new version that replaces the current one. The current goal stays in use until Walrus confirms' : 'your goal. It counts in your plan once Walrus confirms it'}. Walrus keeps every version; use a short description, not personal details.</p>
    <div className="read-label-actions">
      <button className="button primary small" disabled={busy || demo} onClick={() => void onSave(goal).then(ok => { if (!ok) setConfirming(false); })}>{busy ? 'Saving…' : initial ? 'Yes, change it' : 'Yes, remember it'}</button>
      <button type="button" className="button small" disabled={busy} onClick={() => setConfirming(false)}>Back</button>
    </div>
  </div>;
  return <form className="read-label-panel goal-form" onSubmit={review} onKeyDown={e => { if (e.key === 'Escape' && !busy) { e.preventDefault(); onCancel(); } }}>
    <label>What for<input ref={field} value={purpose} maxLength={60} onChange={e => setPurpose(e.target.value)} placeholder="e.g. a laptop" required/></label>
    <div className="goal-form-row">
      <label>Target · USDC<input inputMode="decimal" value={target} onChange={e => setTarget(e.target.value.replace(',', '.'))} placeholder="500" required/></label>
      <label>Saved so far · USDC<input inputMode="decimal" value={saved} onChange={e => setSaved(e.target.value.replace(',', '.'))}/></label>
    </div>
    <div className="goal-form-row">
      <label>By<input type="date" value={targetDate} min={today} onChange={e => setTargetDate(e.target.value)} required/></label>
      <div className="goal-frequency"><span>Contributions</span><div className="read-filters" role="group" aria-label="How often you contribute">{(['weekly', 'monthly'] as const).map(f => <button key={f} type="button" className={'read-filter' + (frequency === f ? ' active' : '')} aria-pressed={frequency === f} onClick={() => setFrequency(f)}>{f === 'weekly' ? 'Weekly' : 'Monthly'}</button>)}</div></div>
    </div>
    <p className={error && (target || purpose) ? 'read-inline-error' : 'micro'}>{error && (target || purpose) ? error : preview ? `Suggested: ${usdc(preview.contribution)} USDC a ${frequency === 'weekly' ? 'week' : 'month'}, set aside from what you can spend.` : 'Amounts are in USDC. Nothing is moved or locked in your wallet.'}</p>
    {demo ? <p className="micro">Demo: try it out. Nothing is saved.</p> : <div className="read-label-actions">
      <button className="button primary small" disabled={busy || !!error || unchanged}>Review</button>
      <button type="button" className="button small" onClick={onCancel} disabled={busy}>Cancel</button>
    </div>}
  </form>;
}
