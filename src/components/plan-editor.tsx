'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CalendarDays, RotateCcw } from 'lucide-react';
import { Temporal } from '@js-temporal/polyfill';
import type { AccountState } from '@/domain/state';
import { amount, units } from '@/domain/money';
import { summarize } from '@/domain/summary';
import { occurrences } from '@/domain/recurrence';
import { activeEvents } from '@/domain/learning';
import { OPERATOR_MANAGED_CONSENT_VERSION } from '@/domain/consent';

type Act = (path: string, payload: unknown, success?: string) => Promise<Record<string, unknown> | null>;
const usdc = (value: string | bigint) => amount(value);
const plain = (value: string) => amount(value, 6, 6).replaceAll(',', '').replace(/\.?0+$/, '') || '0';
const longDate = (d: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));

// The plan's inputs sit in the open and every change recalculates "left to spend" at once, before anything is
// saved. Saving is one button; the memory consent is asked only if it was never given.
export function PlanEditor({ state, demo, busy, act }: { state: AccountState; demo: boolean; busy: boolean; act: Act }) {
  const saved = { date: state.plan.endDate ?? '', reserve: plain(state.plan.reserve), kind: state.plan.endKind };
  const [date, setDate] = useState(saved.date), [reserve, setReserve] = useState(saved.reserve), [kind, setKind] = useState(saved.kind);
  const [accepted, setAccepted] = useState(false), [remember, setRemember] = useState(false), [timezone, setTimezone] = useState(state.plan.timezone);
  const dateField = useRef<HTMLInputElement>(null);
  const consented = demo || state.profile.consentVersion === OPERATOR_MANAGED_CONSENT_VERSION;

  const today = Temporal.PlainDate.from(state.today), max = today.add({ days: 90 }).toString();
  let reserveUnits: bigint | null = null, reserveError = '';
  try { reserveUnits = units(reserve.trim() || '0'); } catch (e) { reserveError = (e as Error).message; }
  const dateError = !date ? 'Choose a date.' : date <= state.today ? 'Choose a date after today.' : date > max ? 'Plan up to 90 days ahead.' : '';

  // Bills are generated on the server only up to the saved end date, so a longer draft adds the missing ones here.
  const through = date && !dateError ? date : state.plan.endDate ?? state.today;
  const extra = occurrences(state.rules.filter(r => !r.cancelled && (!r.learnedEventId || activeEvents(state.memories, state.profile.id).some(e => e.envelope.eventId === r.learnedEventId))), through).filter(o => !state.occurrences.some(x => x.id === o.id));
  const draft: AccountState = { ...state, occurrences: [...state.occurrences, ...extra], plan: { ...state.plan, endDate: dateError ? state.plan.endDate : date, endKind: kind, reserve: reserveUnits === null ? state.plan.reserve : reserveUnits.toString() } };
  const preview = summarize(draft).plan;
  const dirty = date !== saved.date || (reserveUnits !== null && reserveUnits.toString() !== state.plan.reserve) || kind !== saved.kind || timezone !== state.plan.timezone || remember;

  const quick: [string, string][] = [['1 week', today.add({ days: 7 }).toString()], ['2 weeks', today.add({ days: 14 }).toString()], ['End of month', today.with({ day: today.daysInMonth }).toString()], ['30 days', today.add({ days: 30 }).toString()]];
  const zones = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch { return [state.plan.timezone]; } })();
  const preferences = state.memories.filter(m => m.envelope.logicalKey === 'preference:reserve').sort((a, b) => b.envelope.revision - a.envelope.revision);
  const prior = preferences[0]?.envelope;

  function openPicker() { const field = dateField.current; if (!field || field.disabled) return; field.focus(); try { field.showPicker(); } catch { /* Older browsers: the focused field still takes typing. */ } }
  function undo() { setDate(saved.date); setReserve(saved.reserve); setKind(saved.kind); setTimezone(state.plan.timezone); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (dateError || reserveError || demo) return;
    const result = await act('/plan', { endDate: date, endKind: kind, reserve: reserve.trim() || '0', expectedIncome: state.plan.expectedIncome ? plain(state.plan.expectedIncome) : null, timezone, version: state.plan.version, consentVersion: 'operator-managed-v1', timezonePreviewAccepted: true }, 'Plan saved.');
    if (result && remember) await act('/preferences/reserve', { reserve: reserve.trim() || '0', expectedRevision: prior?.revision ?? 0, ...(prior ? { supersedesEventId: prior.eventId } : {}) });
  }

  const ready = preview.state === 'ready';
  // Savings goal contributions are counted like commitments; show them on their own line.
  const goalSetAside = ready ? preview.rows.filter(r => r.ruleId.startsWith('goal:')).reduce((n, r) => n + r.outstanding, 0n) : 0n;
  return <div className="plan-summary-grid plan-live">
    <form className="card plan-editor" onSubmit={submit} aria-labelledby="plan-editor-title">
      <h2 id="plan-editor-title">Your plan</h2>
      <div className="plan-field">
        <label htmlFor="plan-until">Plan until</label>
        <div className="plan-date" onClick={openPicker}>
          <CalendarDays size={18} aria-hidden="true"/>
          <input id="plan-until" ref={dateField} type="date" value={date} min={today.add({ days: 1 }).toString()} max={max} onChange={e => setDate(e.target.value)} aria-invalid={!!dateError} aria-describedby="plan-until-help"/>
          <span className="plan-date-days">{ready ? `${preview.days} days` : '—'}</span>
        </div>
        <p className={dateError && date ? 'read-inline-error' : 'micro'} id="plan-until-help">{dateError && date ? dateError : date ? longDate(date) : 'Pick the day your next income arrives, or any day up to 90 days away.'}</p>
        <div className="read-filters plan-quick" role="group" aria-label="Quick dates">{quick.map(([label, value]) => <button key={label} type="button" className={'read-filter' + (date === value ? ' active' : '')} aria-pressed={date === value} onClick={() => setDate(value)}>{label}</button>)}</div>
        <div className="read-filters plan-kind" role="group" aria-label="What the date is">{([['income', 'Next income'], ['planning', 'Just a date']] as const).map(([value, label]) => <button key={value} type="button" className={'read-filter' + (kind === value ? ' active' : '')} aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}</div>
      </div>
      <div className="plan-field">
        <label htmlFor="plan-reserve">Keep aside · USDC</label>
        <input id="plan-reserve" className="plan-reserve-input" inputMode="decimal" value={reserve} onChange={e => setReserve(e.target.value.replace(',', '.'))} aria-invalid={!!reserveError} aria-describedby="plan-reserve-help"/>
        <p className={reserveError ? 'read-inline-error' : 'micro'} id="plan-reserve-help">{reserveError || 'Left out of what you can spend. Nothing is locked in your wallet.'}</p>
      </div>
      <details className="quiet-details plan-more">
        <summary>More options</summary>
        <label>Time zone<select value={timezone} onChange={e => setTimezone(e.target.value)}>{(zones.includes(timezone) ? zones : [timezone, ...zones]).map(z => <option key={z}>{z}</option>)}</select></label>
        <label className="checkbox-label"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/>Also remember this reserve for future plan choices. This queues a separate write; it is usable only after confirmed recall.</label>
      </details>
      {!consented && <label className="checkbox-label"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}/>I understand the operator owns the shared memory account, its relayer processes notes, and hiding a rule is not permanent erasure. <Link href="/about">Read details</Link>.</label>}
      {demo ? <p className="micro">Demo: try the dates and amounts. Nothing is saved.</p> : <div className="move-actions">
        <button className="button primary" disabled={busy || !dirty || !!dateError || !!reserveError || (!consented && !accepted)}>{busy ? 'Saving…' : 'Save plan'}</button>
        {dirty ? <button type="button" className="button" onClick={undo}><RotateCcw size={15} aria-hidden="true"/>Undo changes</button> : <span className="micro plan-saved">All changes saved</span>}
      </div>}
    </form>
    <section className="card plan-preview" aria-live="polite" aria-labelledby="plan-preview-title">
      <div className="plan-preview-head"><span id="plan-preview-title" className="plan-preview-label">Left to spend</span>{dirty && <span className="pill amber">Not saved yet</span>}</div>
      <h2>{ready ? usdc(preview.discretionary) : '—'} <small>USDC</small></h2>
      <p>{ready ? (preview.shortfall > 0n ? `Bills and your reserve are ${usdc(preview.shortfall)} USDC more than you hold.` : `About ${usdc(preview.daily)} USDC a day until ${longDate(draft.plan.endDate!)}.`) : preview.state === 'unknown_balance' ? 'Your balance hasn’t been read yet.' : 'Choose a date to see what you can spend.'}</p>
      {ready && <dl className="plan-math">
        <div><dt>In your wallet</dt><dd>{state.balance ? usdc(state.balance.usdc) : '—'}</dd></div>
        <div><dt>Bills before then</dt><dd>{preview.commitments - goalSetAside > 0n ? '−' : ''}{usdc(preview.commitments - goalSetAside)}</dd></div>
        {goalSetAside > 0n && <div><dt>Savings goal</dt><dd>−{usdc(goalSetAside)}</dd></div>}
        <div><dt>Kept aside</dt><dd>{preview.reserve > 0n ? '−' : ''}{usdc(preview.reserve)}</dd></div>
        <div className="total"><dt>Left to spend</dt><dd>{usdc(preview.discretionary)}</dd></div>
      </dl>}
      <p className="micro">{state.balance ? `Balance ${state.balance.stale ? 'last checked' : 'checked'} ${new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: state.plan.timezone }).format(new Date(state.balance.observedAt))}. It updates as payments arrive.` : ''} Expected income is left out until it lands.</p>
    </section>
  </div>;
}
