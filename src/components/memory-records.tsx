'use client';
import { EyeOff, PencilLine } from 'lucide-react';
import type { AccountState } from '@/domain/state';
import { describe } from './memories-live';

type Memory = AccountState['memories'][number];
type Status = 'active' | 'turned_off' | 'saving' | 'change_failed';
const statusText: Record<Status, string> = { active: 'Active', turned_off: 'Turned off', saving: 'Saving to Walrus…', change_failed: 'Last change didn’t save' };
const groupTitle = { Labels: 'Payment labels', Plan: 'Plan rules', Other: 'Other' } as const;

// One card per remembered thing: the newest confirmed version leads in plain words, older versions and the
// storage proof sit underneath for anyone who wants to check them.
export function MemoryRecords({ state, demo, busy, onCorrect, onTurnOff }: { state: AccountState; demo: boolean; busy: boolean; onCorrect: (m: Memory) => void; onTurnOff: (m: Memory) => void }) {
  const byKey = new Map<string, Memory[]>();
  for (const m of state.memories) byKey.set(m.envelope.logicalKey, [...(byKey.get(m.envelope.logicalKey) ?? []), m]);
  const when = (iso: string | null) => iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: state.plan.timezone }).format(new Date(iso)).replace('Sept', 'Sep') : null;

  const records = [...byKey.values()].map(list => {
    const versions = [...list].sort((a, b) => b.envelope.revision - a.envelope.revision), newest = versions[0];
    const confirmed = versions.filter(m => m.state === 'recall_confirmed' && m.envelope.kind !== 'deactivation');
    const status: Status = newest.envelope.kind === 'deactivation' ? (newest.state === 'recall_confirmed' ? 'turned_off' : 'saving') : newest.state === 'recall_confirmed' ? 'active' : newest.state === 'failed' ? 'change_failed' : 'saving';
    const shown = newest.envelope.kind !== 'deactivation' && newest.state === 'recall_confirmed' ? newest : confirmed[0] ?? newest;
    return { key: newest.envelope.logicalKey, newest, shown, status, earlier: versions.filter(m => m !== shown && m.envelope.kind !== 'deactivation') };
  }).sort((a, b) => Number(a.status === 'turned_off') - Number(b.status === 'turned_off'));

  const groups = (['Labels', 'Plan', 'Other'] as const).map(g => ({ g, items: records.filter(r => describe(r.shown, state).group === g) })).filter(x => x.items.length);
  return <>{groups.map(({ g, items }) => <section key={g} className="card memories-group" aria-labelledby={`records-${g}`}>
    <h2 id={`records-${g}`}>{groupTitle[g]} <span className="read-count">{items.length}</span></h2>
    <ul>{items.map(r => {
      const d = describe(r.shown, state), correctable = r.shown.envelope.kind === 'recurrence_confirmation' || r.shown.envelope.kind === 'reimbursement_link' || (r.shown.envelope.kind === 'correction' && r.shown.envelope.payload.targetKind === 'recurrence');
      const saved = when(r.shown.recalledAt);
      return <li key={r.key} className={'memory-record ' + r.status}>
        <div className="memory-line">
          <strong>{d.title}</strong>
          <span className="muted">{d.detail}</span>
          {r.status === 'change_failed' && <span className="memory-failed">A newer change didn’t save, so this version is still the one in use.</span>}
          {r.status === 'saving' && r.shown !== r.newest && <span className="muted">This version stays in use until Walrus confirms the change.</span>}
        </div>
        <span className={'move-state ' + (r.status === 'active' ? 'confirmed' : r.status === 'change_failed' ? 'failed' : '')}>{statusText[r.status]}</span>
        {!demo && r.status === 'active' && <span className="memory-actions">
          {correctable && <button className="text-button memory-forget" disabled={busy} onClick={() => onCorrect(r.shown)}><PencilLine size={14} aria-hidden="true"/>Correct<span className="sr-only"> {d.title}</span></button>}
          <button className="text-button memory-forget" disabled={busy} onClick={() => onTurnOff(r.shown)}><EyeOff size={14} aria-hidden="true"/>Turn off<span className="sr-only"> {d.title}</span></button>
        </span>}
        {r.earlier.length > 0 && <details className="memory-history">
          <summary>{r.earlier.length} earlier version{r.earlier.length > 1 ? 's' : ''}</summary>
          <ol>{r.earlier.map(m => { const e = describe(m, state); return <li key={m.envelope.eventId}><span>{e.title}</span><span className="muted">{e.detail}{m.state === 'failed' ? ' · didn’t save' : m.envelope.revision < r.shown.envelope.revision ? ' · replaced' : ' · not confirmed yet'}</span></li>; })}</ol>
        </details>}
        <details className="memory-proof">
          <summary>Technical proof</summary>
          <dl>
            <div><dt>Read back from Walrus</dt><dd>{saved ?? 'Not yet'}</dd></div>
            <div><dt>Version</dt><dd>{r.shown.envelope.revision}</dd></div>
            <div><dt>Record</dt><dd className="break-all">{r.shown.envelope.eventId}</dd></div>
            <div><dt>Walrus blob</dt><dd className="break-all">{r.shown.blobId ?? 'Not stored yet'}</dd></div>
          </dl>
          <pre>{JSON.stringify(r.shown.envelope, null, 2)}</pre>
        </details>
      </li>;
    })}</ul>
  </section>)}</>;
}
