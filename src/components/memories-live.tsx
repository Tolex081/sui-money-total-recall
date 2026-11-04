'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { EyeOff, PencilLine, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from './http';
import { LabelPicker } from './label-picker';
import type { AccountState } from '@/domain/state';
import { amount, SUI_TYPE } from '@/domain/money';

type Memory = AccountState['memories'][number];
const UNSETTLED = ['queued', 'submitting', 'accepted', 'saved', 'submission_outcome_unknown'];

// One line of plain language per remembered thing, so people can see what the app will use and drop what's wrong.
function describe(m: Memory, state: AccountState): { title: string; detail: string; group: 'Labels' | 'Plan' | 'Other' } {
  const e = m.envelope;
  switch (e.kind) {
    case 'payment_explanation': {
      const movement = state.movements.find(x => x.id === e.payload.movementId);
      const paid = movement ? `${amount(movement.delta.replace('-', ''), movement.coinType === SUI_TYPE ? 9 : 6)} ${movement.coinType === SUI_TYPE ? 'SUI' : 'USDC'} ${movement.delta.startsWith('-') ? 'sent' : 'received'} ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: state.plan.timezone }).format(new Date(movement.timestamp))}` : 'A payment';
      return { title: `“${e.payload.note}”`, detail: `${e.payload.ownTransfer ? 'Own transfer' : e.payload.category} · ${paid}`, group: 'Labels' };
    }
    case 'planning_preference': return { title: 'Your usual reserve', detail: `${amount(e.payload.value)} USDC kept aside when you plan`, group: 'Plan' };
    case 'recurrence_confirmation': return { title: `Recurring bill: ${e.payload.alias}`, detail: `${amount(e.payload.amount)} USDC · ${e.payload.frequency === 'once' ? 'once' : e.payload.frequency} · next ${e.payload.nextDate}`, group: 'Plan' };
    case 'suggestion_decision': return { title: e.payload.decision === 'confirmed' ? 'A suggested weekly payment you confirmed' : 'A suggested weekly payment you turned down', detail: 'Used when Sui Money suggests bills', group: 'Plan' };
    case 'category_rule': return { title: 'Payments to one address', detail: `Always counted as ${e.payload.category}`, group: 'Labels' };
    case 'own_destination_rule': return { title: 'One of your own wallets', detail: 'Transfers there are not counted as spending', group: 'Labels' };
    case 'reimbursement_link': return { title: 'Money you got back', detail: `Linked to ${e.payload.allocationIds.length} payment${e.payload.allocationIds.length > 1 ? 's' : ''}, so it isn’t counted as spending`, group: 'Other' };
    case 'correction': return e.payload.targetKind === 'annotation' ? { title: `“${e.payload.value.note}”`, detail: `Corrected label · ${e.payload.value.category}`, group: 'Labels' } : 'alias' in e.payload.value ? { title: `Recurring bill: ${e.payload.value.alias}`, detail: 'Corrected bill', group: 'Plan' } : { title: 'A reversed payment match', detail: 'The bill counts as unpaid again', group: 'Plan' };
    case 'savings_goal': return { title: `Saving for ${e.payload.purpose}`, detail: `${amount(e.payload.target)} USDC by ${e.payload.targetDate} · ${e.payload.frequency} contributions · ${amount(e.payload.saved)} USDC saved so far`, group: 'Plan' };
    default: return { title: 'Remembered item', detail: '', group: 'Other' };
  }
}
const labelOf = (m: Memory) => m.envelope.kind === 'payment_explanation' ? m.envelope.payload : null;

// What POST /memories/recall returns: Walrus' answer for each active memory, already checked on the server.
type Verified = { eventId: string; logicalKey: string; revision: number; kind: string; verdict: 'matched' | 'not_returned' | 'failed_verification' | 'unavailable' | 'not_checked'; reason?: string; blobId?: string; sameBlob?: boolean; remembered?: Record<string, string | boolean>; supersedes: { eventId: string; revision: number } | null; supersessionConsistent: boolean; recalledAt: string };
type Verification = { checkedAt: string; activeCount: number; checkedCount: number; results: Verified[] };
const verdictText: Record<Verified['verdict'], string> = { matched: 'Returned by Walrus · matches', not_returned: 'Not returned by Walrus', failed_verification: 'Returned, but didn’t match', unavailable: 'Walrus unavailable', not_checked: 'Not checked this time' };
function walrusSummary(r: Verified) {
  const v = r.remembered ?? {};
  if (r.kind === 'payment_explanation') return `“${v.note}” · ${v.ownTransfer ? 'Own transfer' : v.category}`;
  if (r.kind === 'planning_preference' && typeof v.value === 'string') return `Usual reserve · ${amount(v.value)} USDC`;
  if (r.kind === 'recurrence_confirmation' && typeof v.amount === 'string') return `${v.alias} · ${amount(v.amount)} USDC · ${v.frequency}`;
  if (r.kind === 'savings_goal' && typeof v.target === 'string') return `Saving for ${v.purpose} · ${amount(v.target)} USDC by ${v.targetDate} · ${v.frequency}`;
  return r.kind.replaceAll('_', ' ');
}

export function LiveMemories({ state, onChanged }: { state: AccountState; onChanged: () => void }) {
  // The newest revision of each memory decides what it is now. A change or a forget is a newer revision; until Walrus
  // confirms it, the previous confirmed revision stays the one in use, and if it fails the previous one simply remains.
  const latest = new Map<string, Memory>();
  for (const m of state.memories) { const prior = latest.get(m.envelope.logicalKey); if (!prior || m.envelope.revision > prior.envelope.revision) latest.set(m.envelope.logicalKey, m); }
  const confirmedBefore = (key: string, below: number) => state.memories.filter(m => m.envelope.logicalKey === key && m.envelope.revision < below && m.state === 'recall_confirmed' && m.envelope.kind !== 'deactivation').sort((a, b) => b.envelope.revision - a.envelope.revision)[0];
  const rows = [...latest.values()].map(m => {
    const before = confirmedBefore(m.envelope.logicalKey, m.envelope.revision);
    if (m.envelope.kind === 'deactivation') {
      if (!before) return null;
      return { latest: m, shown: before, status: m.state === 'recall_confirmed' ? 'forgotten' : UNSETTLED.includes(m.state) ? 'forgetting' : 'remembered' } as const;
    }
    if (m.state === 'recall_confirmed') return { latest: m, shown: m, status: 'remembered' } as const;
    if (m.state === 'failed') return before ? { latest: m, shown: before, status: 'change_failed' } as const : null;
    return before ? { latest: m, shown: before, status: 'changing' } as const : { latest: m, shown: m, status: 'saving' } as const;
  }).filter((r): r is NonNullable<typeof r> => !!r && r.status !== 'forgotten');
  const forgottenCount = [...latest.values()].filter(m => m.envelope.kind === 'deactivation' && m.state === 'recall_confirmed').length;

  // Forget shows at once; the server's refreshed state takes over when it arrives.
  const [forgotten, setForgotten] = useState<string[]>([]), [confirming, setConfirming] = useState<string | null>(null), [editing, setEditing] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [announce, setAnnounce] = useState('');
  const [verification, setVerification] = useState<Verification | null>(null), [verifying, setVerifying] = useState(false), [verifyError, setVerifyError] = useState('');
  const reload = useRef(onChanged);
  useEffect(() => { reload.current = onChanged; }, [onChanged]);
  const shownRows = rows.map(r => forgotten.includes(r.latest.envelope.eventId) && r.status === 'remembered' ? { ...r, status: 'forgetting' as const } : r);
  const waiting = rows.filter(r => r.status === 'forgetting' || r.status === 'saving' || r.status === 'changing').map(r => r.latest.envelope.eventId).join(',');

  // No background worker exists, so the page moves pending saves along until Walrus confirms them.
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 12 && !cancelled; attempt++) {
        try { const job = await api<{ state: string }>('/memory-jobs/advance', {}); if (cancelled) return; if (['recall_confirmed', 'idle', 'failed', 'submission_outcome_unknown'].includes(job.state)) { reload.current(); return; } } catch { return; }
        await new Promise(resolve => setTimeout(resolve, 7000));
      }
    })();
    return () => { cancelled = true; };
  }, [waiting]);

  async function forget(row: (typeof rows)[number]) {
    setBusy(true); setError('');
    try {
      await api('/memories/' + encodeURIComponent(row.latest.envelope.eventId) + '/deactivate', { reason: 'Forgotten by the user', expectedRevision: row.latest.envelope.revision });
      setForgotten(current => [...current, row.latest.envelope.eventId]); setConfirming(null); setAnnounce(`Forgetting ${describe(row.shown, state).title}.`); onChanged();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  // A label change is the existing label save: a new revision of the same memory that names the one it replaces.
  async function saveLabel(row: (typeof rows)[number], label: { note: string; category: string; ownTransfer: boolean }) {
    const movementId = labelOf(row.shown)?.movementId;
    if (!movementId) return false;
    setBusy(true); setError('');
    try {
      await api('/activity/' + encodeURIComponent(movementId) + '/annotation', { ...label, rememberDestination: false, expectedRevision: row.latest.envelope.revision, supersedesEventId: row.latest.envelope.eventId });
      setEditing(null); setAnnounce(`Saving “${label.note}”. The current label stays in use until Walrus confirms.`); onChanged(); return true;
    } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }
  async function verify() {
    setVerifying(true); setVerifyError('');
    try { setVerification(await api<Verification>('/memories/recall', {})); } catch (e) { setVerifyError((e as Error).message); } finally { setVerifying(false); }
  }

  const groups = (['Labels', 'Plan', 'Other'] as const).map(g => ({ name: g, items: shownRows.filter(r => describe(r.shown, state).group === g) })).filter(g => g.items.length);
  const time = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium', timeZone: state.plan.timezone }).format(new Date(iso));
  return <div className="memories-live">
    <p className="sr-only" role="status">{announce}</p>
    <section className="card memories-intro" aria-labelledby="memories-intro-title">
      <h2 id="memories-intro-title">What Sui Money remembers about this wallet</h2>
      <p>These are things you confirmed: payment labels and plan rules. They come back when you sign in again, on any device, and they change what Today and Plan show. If something is wrong or out of date, change it or forget it.</p>
      <ul className="settings-notes">
        <li>Each one is saved to Walrus Memory and only counts once Walrus returns the same record.</li>
        <li>They’re kept in Sui Money’s Walrus account, in a space only your signed-in wallet can open through this app.</li>
        <li>Forgetting hides a memory everywhere in Sui Money. Walrus keeps the stored copy, which can’t be erased.</li>
      </ul>
      {rows.some(r => r.status === 'remembered' || r.status === 'changing' || r.status === 'change_failed') && <div className="move-actions">
        <button className="button" disabled={verifying} onClick={() => void verify()}><ShieldCheck size={15} aria-hidden="true"/>{verifying ? 'Asking Walrus…' : 'Verify memories from Walrus'}</button>
      </div>}
      {verifyError && <p className="read-inline-error" role="alert">{verifyError}</p>}
    </section>

    {verification && <section className="card walrus-verify" aria-labelledby="walrus-verify-title" aria-live="polite">
      <h2 id="walrus-verify-title">Returned by Walrus</h2>
      <p className="muted small-text">Read from Walrus at {time(verification.checkedAt)} and checked against the copy saved when each memory was confirmed. Showing {verification.checkedCount} of {verification.activeCount} memories in use.</p>
      <ul>{verification.results.map(r => <li key={r.eventId}>
        <div className="memory-line">
          <strong>{r.verdict === 'matched' ? walrusSummary(r) : r.kind.replaceAll('_', ' ')}</strong>
          <span className="muted">Revision {r.revision}{r.supersedes ? ` · replaces revision ${r.supersedes.revision}` : ''}{r.blobId ? ` · blob …${r.blobId.slice(-10)}` : ''}{r.verdict === 'matched' && !r.sameBlob ? ' · another stored copy' : ''}{!r.supersessionConsistent ? ' · revision history doesn’t line up' : ''}</span>
          {r.reason && <span className="muted">{r.reason}</span>}
        </div>
        <span className={'move-state ' + (r.verdict === 'matched' ? 'confirmed' : r.verdict === 'unavailable' || r.verdict === 'not_checked' ? '' : 'failed')}>{verdictText[r.verdict]}</span>
      </li>)}</ul>
    </section>}

    {error && <p className="read-inline-error" role="alert">{error}</p>}
    {groups.length ? groups.map(g => <section key={g.name} className="card memories-group" aria-labelledby={`memories-${g.name}`}>
      <h2 id={`memories-${g.name}`}>{g.name === 'Labels' ? 'Payment labels' : g.name === 'Plan' ? 'Plan rules' : 'Other'} <span className="read-count">{g.items.length}</span></h2>
      <ul>{g.items.map(row => { const d = describe(row.shown, state), id = row.latest.envelope.eventId, label = labelOf(row.shown), pending = row.status === 'changing' || row.status === 'change_failed' ? labelOf(row.latest) : null; return <li key={id} className={editing === id ? 'editing' : ''}>
        <div className="memory-line">
          <strong>{d.title}</strong><span className="muted">{d.detail}</span>
          {row.status === 'changing' && <span className="muted">{pending ? `Changing to “${pending.note}”. ` : 'Saving a change. '}{d.title} stays in use until Walrus confirms.</span>}
          {row.status === 'change_failed' && <span className="memory-failed">{pending ? `Your change to “${pending.note}” didn’t save. ` : 'Your change didn’t save. '}{d.title} is still in use.</span>}
        </div>
        <span className={'move-state ' + (row.status === 'remembered' || row.status === 'change_failed' ? 'confirmed' : '')}>{row.status === 'forgetting' ? 'Forgetting…' : row.status === 'saving' ? 'Saving…' : row.status === 'changing' ? 'Changing…' : 'Remembered'}</span>
        {row.status === 'change_failed' && pending && <button className="text-button memory-forget" disabled={busy} onClick={() => void saveLabel(row, pending)}>Try again<span className="sr-only"> to save “{pending.note}”</span></button>}
        {row.status === 'remembered' && editing !== id && (confirming === id ? <span className="memory-confirm">
          <span>Stop using this?</span>
          <button className="button small" disabled={busy} onClick={() => void forget(row)}>{busy ? 'Forgetting…' : 'Forget'}</button>
          <button className="text-button" onClick={() => setConfirming(null)}>Keep</button>
        </span> : <span className="memory-actions">
          {label && <button className="text-button memory-forget" onClick={() => { setEditing(id); setConfirming(null); }}><PencilLine size={14} aria-hidden="true"/>Change<span className="sr-only"> {d.title}</span></button>}
          <button className="text-button memory-forget" onClick={() => setConfirming(id)}><EyeOff size={14} aria-hidden="true"/>Forget<span className="sr-only"> {d.title}</span></button>
        </span>)}
        {editing === id && label && <ChangeLabel label={label} busy={busy} onSave={next => saveLabel(row, next)} onCancel={() => setEditing(null)}/>}
      </li>; })}</ul>
    </section>) : <section className="card memories-group"><h2>Nothing remembered yet</h2><p className="muted">Label a payment in <Link className="text-link" href="/activity">Activity</Link> or save a plan rule, and it appears here.</p></section>}
    <p className="micro">{forgottenCount ? `${forgottenCount} forgotten item${forgottenCount > 1 ? 's are' : ' is'} no longer used. ` : ''}{waiting ? <><RefreshCw size={12} className="spin" aria-hidden="true"/> Waiting for Walrus to confirm a change.</> : ''}</p>
  </div>;
}

function ChangeLabel({ label, busy, onSave, onCancel }: { label: { note: string; category: string; ownTransfer: boolean }; busy: boolean; onSave: (next: { note: string; category: string; ownTransfer: boolean }) => Promise<boolean>; onCancel: () => void }) {
  const [note, setNote] = useState(label.note), [category, setCategory] = useState(label.category);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { field.current?.focus(); }, []);
  const unchanged = note.trim() === label.note && category === label.category;
  return <form className="read-label-panel memory-change" onSubmit={(event: FormEvent) => { event.preventDefault(); if (note.trim() && !unchanged) void onSave({ note: note.trim(), category, ownTransfer: label.ownTransfer }); }} onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel(); } }}>
    <LabelPicker id="memory-change-label" ref={field} note={note} category={category} onChange={(nextNote, nextCategory) => { setNote(nextNote); setCategory(nextCategory); }} required label="Change this label to"/>
    <p className="micro">Saved as a new version on Walrus. The current label stays in use until Walrus confirms the change.</p>
    <div className="read-label-actions">
      <button className="button primary small" disabled={busy || !note.trim() || unchanged}>{busy ? 'Saving…' : 'Save change'}</button>
      <button type="button" className="button small" onClick={onCancel} disabled={busy}>Cancel</button>
    </div>
  </form>;
}
