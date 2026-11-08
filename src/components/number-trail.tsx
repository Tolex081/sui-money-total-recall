'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Database, Link2, Calculator, PencilLine, X } from 'lucide-react';
import type { AccountState } from '@/domain/state';
import { amount } from '@/domain/money';

type Memory = AccountState['memories'][number];
export type TrailRow = { id: string; ruleId?: string; dueDate: string; alias: string; outstanding: bigint; learnedEventId?: string };
export type TrailInput = { state: AccountState; rows: TrailRow[]; commitments: bigint; reserve: bigint; result: bigint; daily: bigint; days: number; base: string; label: string };

// The newest confirmed, still-active record behind a plan item: a savings goal by its goal ID, otherwise by the
// item's event, otherwise by the bill's own name.
function rememberedFor(state: AccountState, row: TrailRow): Memory | null {
  const live = state.memories.filter(m => m.state === 'recall_confirmed');
  const turnedOff = new Set(live.filter(m => m.envelope.kind === 'deactivation').map(m => m.envelope.logicalKey));
  const usable = live.filter(m => m.envelope.kind !== 'deactivation' && !turnedOff.has(m.envelope.logicalKey));
  const newest = (list: Memory[]) => [...list].sort((a, b) => b.envelope.revision - a.envelope.revision)[0] ?? null;
  const payload = (m: Memory) => (m.envelope as { payload: Record<string, unknown> }).payload;
  if (row.ruleId?.startsWith('goal:')) return newest(usable.filter(m => m.envelope.kind === 'savings_goal' && payload(m).goalId === row.ruleId!.slice(5)));
  const byEvent = row.learnedEventId ? usable.find(m => m.envelope.eventId === row.learnedEventId) : undefined;
  if (byEvent) return byEvent;
  const aliasOf = (m: Memory) => { const p = payload(m); const v = (m.envelope.kind === 'correction' ? p.value : p) as Record<string, unknown> | undefined; return typeof v?.alias === 'string' ? v.alias : null; };
  return newest(usable.filter(m => aliasOf(m) === row.alias));
}
function reserveMemory(state: AccountState): Memory | null {
  return state.memories.filter(m => m.state === 'recall_confirmed' && m.envelope.kind === 'planning_preference' && !['category', 'horizon'].includes(String((m.envelope.payload as { preference?: string }).preference)))
    .sort((a, b) => b.envelope.revision - a.envelope.revision)[0] ?? null;
}

// "Where does this number come from?": every input to the figure, each with its source and its proof.
export function NumberTrail({ state, rows, commitments, reserve, result, daily, days, base }: Omit<TrailInput, 'label'>) {
  const synthetic = state.mode === 'synthetic', balance = state.balance;
  const day = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z')).replace('Sept', 'Sep');
  const at = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: state.plan.timezone }).format(new Date(iso)).replace('Sept', 'Sep');
  const walrus = (m: Memory) => <span className="trail-src walrus"><Database size={12} aria-hidden="true"/>Remembered on Walrus · version {m.envelope.revision}{m.blobId ? <> · blob …{m.blobId.slice(-8)}</> : null}</span>;
  // Repeats of the same item (a weekly bill, a goal's contributions) read as one line with a count.
  const groups = [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).reduce<{ key: string; alias: string; first: string; count: number; total: bigint; row: TrailRow }[]>((list, r) => {
    const key = (r.ruleId ?? r.alias) + '|' + r.alias, g = list.find(x => x.key === key);
    if (g) { g.count++; g.total += r.outstanding; } else list.push({ key, alias: r.alias, first: r.dueDate, count: 1, total: r.outstanding, row: r });
    return list;
  }, []);
  const res = reserveMemory(state);
  return <div className="number-trail">
    <p className="number-trail-lead">Every part of this figure has a source you can check. Nothing is estimated by a model.</p>
    <ol>
      <li>
        <div><strong>USDC in your wallet</strong>
          {synthetic ? <span className="trail-src you"><PencilLine size={12} aria-hidden="true"/>Fictional demo snapshot{balance ? ` · ${at(balance.observedAt)}` : ''}</span>
            : <span className="trail-src sui"><Link2 size={12} aria-hidden="true"/>Read from Sui Mainnet through Tatum{balance ? ` · ${at(balance.observedAt)}` : ''}</span>}
        </div>
        <b>{balance ? amount(balance.usdc) : '—'}</b>
      </li>
      {groups.map(g => { const m = rememberedFor(state, g.row); return <li key={g.key}>
        <div><strong>{g.alias} <span className="muted">· {g.count > 1 ? `${g.count} times, from ${day(g.first)}` : `due ${day(g.first)}`}</span></strong>
          {m ? walrus(m) : <span className="trail-src you"><PencilLine size={12} aria-hidden="true"/>Entered by you on Plan</span>}
        </div>
        <b>−{amount(g.total)}</b>
      </li>; })}
      <li>
        <div><strong>Your reserve</strong>{reserve > 0n && res ? walrus(res) : <span className="trail-src you"><PencilLine size={12} aria-hidden="true"/>Set by you on Plan</span>}</div>
        <b>−{amount(reserve)}</b>
      </li>
      <li className="trail-total">
        <div><strong>Left to spend</strong><span className="trail-src calc"><Calculator size={12} aria-hidden="true"/>Calculated · exact to the cent · {amount(commitments)} set aside in total</span></div>
        <b>{amount(result)} <small>USDC</small></b>
      </li>
    </ol>
    <p className="micro">{days > 0 ? `About ${amount(daily)} USDC a day for ${days} days, rounded down so it never overstates. ` : ''}Check the Walrus records on <Link className="text-link" href={base + '/memories'}>Memories</Link> and the wallet reads on <Link className="text-link" href="/proof">Integration proof</Link>.</p>
  </div>;
}

// The button and its dialog, shared by Today (demo) and Plan (signed-in wallets) so both behave the same.
export function NumberTrailButton({ className, buttonLabel = 'Where does this number come from?', ...input }: TrailInput & { className?: string; buttonLabel?: string }) {
  const [open, setOpen] = useState(false), dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLButtonElement>(null);
  useEffect(() => { const d = dialog.current; if (open && d && !d.open) d.showModal(); else if (!open && d?.open) { d.close(); opener.current?.focus(); } }, [open]);
  return <>
    <button ref={opener} type="button" className={className ?? 'trail-button'} onClick={() => setOpen(true)}>{buttonLabel}</button>
    <dialog ref={dialog} className="dialog" aria-label={input.label} onCancel={e => { e.preventDefault(); setOpen(false); }}>
      <div className="row"><h2>{input.label}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setOpen(false)}><X size={20} aria-hidden="true"/></button></div>
      {open && <NumberTrail {...input}/>}
    </dialog>
  </>;
}
