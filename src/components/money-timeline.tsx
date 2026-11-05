import { Pin } from 'lucide-react';
import { Temporal } from '@js-temporal/polyfill';
import { amount } from '@/domain/money';

export type TimelineRow = { id: string; dueDate: string; alias: string; outstanding: bigint; remembered: boolean };

const PLOT_H = 132, TOP = 14, BOTTOM = 10;
const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z')).replace('Sept', 'Sep');

// The money timeline: what is left to spend, from today to the plan's end date, stepping down as each commitment
// falls due. It starts at the balance after the reserve and ends at what the plan leaves, so it adds up to Today's figure.
export function MoneyTimeline({ today, endDate, start, rows, maxRows = 6 }: { today: string; endDate: string; start: bigint; rows: TimelineRow[]; maxRows?: number }) {
  const total = Math.max(1, Temporal.PlainDate.from(today).until(Temporal.PlainDate.from(endDate)).days);
  const sorted = [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.alias.localeCompare(b.alias));
  const steps = sorted.reduce<(TimelineRow & { x: number; after: bigint; overdue: boolean })[]>((list, r) => {
    const before = list.length ? list[list.length - 1].after : start;
    const offset = Math.min(total, Math.max(0, Temporal.PlainDate.from(today).until(Temporal.PlainDate.from(r.dueDate)).days));
    return [...list, { ...r, x: offset / total, after: before - r.outstanding, overdue: r.dueDate < today }];
  }, []);
  const end = steps.length ? steps[steps.length - 1].after : start, top = start > 0n ? start : 1n, floor = end < 0n ? end : 0n;
  const y = (v: bigint) => TOP + (Number(top - v) / Number(top - floor || 1n)) * (PLOT_H - TOP - BOTTOM);
  let path = `M0 ${y(start)}`;
  for (const s of steps) path += ` H${(s.x * 1000).toFixed(1)} V${y(s.after).toFixed(1)}`;
  path += ' H1000';
  const zeroY = y(0n), shown = steps.slice(0, maxRows);

  return <figure className="money-timeline">
    <div className="timeline-plot" style={{ height: PLOT_H }}>
      <svg viewBox={`0 0 1000 ${PLOT_H}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" x2="1000" y1={zeroY} y2={zeroY} className="timeline-zero" vectorEffect="non-scaling-stroke"/>
        <path d={`${path} V${zeroY} H0 Z`} className="timeline-area"/>
        <path d={path} className="timeline-line" vectorEffect="non-scaling-stroke"/>
      </svg>
      {steps.map(s => <span key={s.id} className={'timeline-dot' + (s.remembered ? ' remembered' : '')} style={{ left: `${s.x * 100}%`, top: y(s.after) }} title={`${s.alias} · ${day(s.dueDate, { day: 'numeric', month: 'short' })} · −${amount(s.outstanding)} USDC`}/>)}
      <span className="timeline-value start">{amount(start)}</span>
      <span className={'timeline-value end' + (end < 0n ? ' short' : '')}>{amount(end)} left</span>
    </div>
    <div className="timeline-axis" aria-hidden="true"><span>Today, {day(today, { day: 'numeric', month: 'short' })}</span><span>{day(endDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
    <figcaption className="sr-only">From {amount(start)} USDC after your reserve today to {amount(end)} USDC on {day(endDate, { day: 'numeric', month: 'long' })}, after {steps.length} commitment{steps.length === 1 ? '' : 's'}.</figcaption>
    {shown.length > 0 && <ol className="timeline-ledger">
      <li className="ledger-head" aria-hidden="true"><span>Due</span><span>Commitment</span><span>Amount</span><span>Left after</span></li>
      {shown.map(s => <li key={s.id}>
        <span className="ledger-date">{s.overdue ? 'Overdue' : day(s.dueDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <span className="ledger-name">{s.alias}{s.remembered && <span className="ledger-pin"><Pin size={12} aria-hidden="true"/>Remembered</span>}</span>
        <span className="ledger-amount">−{amount(s.outstanding)}</span>
        <span className="ledger-after">{amount(s.after)}</span>
      </li>)}
    </ol>}
    {steps.length > shown.length && <p className="micro">{steps.length - shown.length} more before {day(endDate, { day: 'numeric', month: 'short' })}.</p>}
  </figure>;
}
