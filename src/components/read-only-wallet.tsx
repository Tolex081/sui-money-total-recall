'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { api } from './http';
import type { AccountState } from '@/domain/state';
import { READ_ONLY_WALLET_CONSENT_VERSION, OPERATOR_MANAGED_CONSENT_VERSION } from '@/domain/consent';
import { amount, integer, SUI_TYPE, USDC_TYPE } from '@/domain/money';

type SyncKind = 'balances' | 'history';
type Props = {
  screen: string;
  state: AccountState;
  busy: boolean;
  error: string;
  onSync: (kind: SyncKind) => void;
  onAcceptConsent: () => void;
  labels: boolean;
  onLabeled: () => void;
};
const labelCategories = ['Food', 'Groceries', 'Transport', 'Home', 'Internet', 'Learning', 'Health', 'Family', 'Work', 'Other'];

function ConsentCard({ busy, onAccept }: { busy: boolean; onAccept: () => void }) {
  const [accepted, setAccepted] = useState(false);
  return <section className="card read-consent" aria-labelledby="read-consent-title">
    <span className="read-only-label"><ShieldCheck size={15}/> Read-only wallet access</span>
    <h2 id="read-consent-title">Before we read your wallet</h2>
    <p>When you refresh your balance or import activity, Sui Money saves those Tatum results to your wallet profile in its managed database so they remain available when you return. The service operator controls that database.</p>
    <p>This step does not write Walrus memories (labeling payments asks separately), change your plan, submit transactions, or request payment approvals. Tatum reads public Sui Mainnet data for the address you signed in with.</p>
    <label className="read-consent-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/><span>I understand and agree to save my wallet balance and imported activity in this profile.</span></label>
    <button className="button primary" disabled={!accepted || busy} onClick={onAccept}>{busy ? 'Saving your choice…' : 'Agree and open read-only wallet'}</button>
    <Link className="text-link" href="/about">Read about data handling</Link>
    <p className="micro">Consent version {READ_ONLY_WALLET_CONSENT_VERSION}. This does not enable budget edits.</p>
  </section>;
}

function clockLabel(instant: string, timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(instant)) + ' · ' + timezone;
}

type MovementRecord = AccountState['movements'][number];
// Matches the server's annotate() eligibility: only settled native-USDC simple transfers can be labeled.
const labelable = (m: MovementRecord) => m.coinType === USDC_TYPE && m.operation === 'simple_transfer' && m.status === 'success';
// Exact amounts without padding: at least two decimals, more only when the value needs them.
const exact = (value: string | bigint, decimals: number) => amount(value, decimals, decimals).replace(/(\.\d{2}\d*?)0+$/, '$1');
const finished = ['recall_confirmed', 'failed', 'submission_outcome_unknown', 'idle'];

function MemoryConsent({ onAccepted }: { onAccepted: () => void }) {
  const [accepted, setAccepted] = useState(false), [saving, setSaving] = useState(false), [failure, setFailure] = useState('');
  async function accept() { setSaving(true); setFailure(''); try { await api('/consent/memory', { accepted: true }); onAccepted(); } catch (e) { setFailure((e as Error).message); } finally { setSaving(false); } }
  return <div className="read-label-panel">
    <strong>Remember your labels with Walrus Memory</strong>
    <p>Each label is stored on Walrus Mainnet in an account the operator manages, so Sui Money can recall it next time. Walrus storage can’t be erased on request. Use short aliases like “Rent” or “Landlord”, never names, phone numbers or keys.</p>
    <label className="read-consent-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/><span>I agree to store my payment labels in operator-managed Walrus Memory.</span></label>
    {failure && <p className="read-inline-error" role="alert">{failure}</p>}
    <button className="button primary small" disabled={!accepted || saving} onClick={accept}>{saving ? 'Saving your choice…' : 'Agree and label payments'}</button>
    <p className="micro">Consent version {OPERATOR_MANAGED_CONSENT_VERSION}. Budgeting stays paused.</p>
  </div>;
}

function LabelForm({ movement, state, onDone }: { movement: MovementRecord; state: AccountState; onDone: () => void }) {
  const existing = state.annotations.find(a => a.movementId === movement.id);
  const prior = state.memories.filter(m => m.envelope.logicalKey === 'annotation:' + movement.id).sort((a, b) => b.envelope.revision - a.envelope.revision)[0];
  const [category, setCategory] = useState(existing?.category ?? 'Other'), [note, setNote] = useState(existing?.note ?? ''), [own, setOwn] = useState(existing?.ownTransfer ?? false);
  const [status, setStatus] = useState(''), [failure, setFailure] = useState(''), [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFailure('');
    try {
      await api('/activity/' + encodeURIComponent(movement.id) + '/annotation', { category, note, ownTransfer: own, rememberDestination: false, expectedRevision: prior?.envelope.revision ?? 0, supersedesEventId: prior?.envelope.eventId });
      // No background worker exists, so the page drives the job: submit, wait for storage, then confirm by recall.
      let confirmed = false;
      for (let attempt = 0; attempt < 12 && !confirmed; attempt++) {
        setStatus(attempt === 0 ? 'Saving to Walrus Memory…' : 'Waiting for Walrus to confirm the label…');
        const job = await api<{ state: string; error?: string }>('/memory-jobs/advance', {});
        if (finished.includes(job.state)) { if (job.state !== 'recall_confirmed' && job.state !== 'idle') throw new Error(job.error ?? 'The label could not be confirmed.'); confirmed = true; }
        else await new Promise(resolve => setTimeout(resolve, 7000));
      }
      // An unconfirmed label stays visibly pending on the row; it is never shown as remembered early.
      setStatus(confirmed ? 'Remembered.' : 'Saved. Walrus is still confirming this label.'); onDone();
    } catch (e) { setFailure((e as Error).message); setStatus(''); } finally { setSaving(false); }
  }
  return <form className="read-label-panel" onSubmit={submit}>
    <label>What was this for?<input value={note} onChange={event => setNote(event.target.value)} maxLength={160} placeholder="e.g. October rent" required/></label>
    <label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{labelCategories.map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="read-label-own"><input type="checkbox" checked={own} onChange={event => setOwn(event.target.checked)}/>Moved to another wallet of mine</label>
    {failure && <p className="read-inline-error" role="alert">{failure}</p>}
    {status && <p className="micro" role="status">{status}</p>}
    <button className="button primary small" disabled={saving}>{saving ? 'Saving…' : existing ? 'Update label' : 'Save label'}</button>
  </form>;
}

function Movement({ movement, state, labels, onLabeled }: { movement: MovementRecord; state: AccountState; labels: boolean; onLabeled: () => void }) {
  const [open, setOpen] = useState(false);
  const timezone = state.plan.timezone, annotation = state.annotations.find(a => a.movementId === movement.id);
  const delta = integer(movement.delta), incoming = delta > 0n;
  const asset = movement.coinType === USDC_TYPE ? 'native USDC' : movement.coinType === SUI_TYPE ? 'SUI' : 'other asset';
  const decimals = movement.coinType === SUI_TYPE ? 9 : 6;
  const shownAmount = exact(delta < 0n ? -delta : delta, decimals);
  const memoryAgreed = state.profile.consentVersion === OPERATOR_MANAGED_CONSENT_VERSION;
  const party = movement.counterparty ? `${movement.counterparty.slice(0, 6)}…${movement.counterparty.slice(-4)}` : null;
  const time = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: timezone }).format(new Date(movement.timestamp));
  const canLabel = labels && labelable(movement);
  const pending = state.memories.filter(m => m.envelope.logicalKey === 'annotation:' + movement.id && !['recall_confirmed', 'failed'].includes(m.state)).sort((a, b) => b.envelope.revision - a.envelope.revision)[0];
  const pendingNote = pending && typeof pending.envelope.payload === 'object' && pending.envelope.payload && 'note' in pending.envelope.payload ? String(pending.envelope.payload.note) : null;
  // Two layers per payment: the Tatum fact on top, the Walrus-remembered label (or the prompt for one) beneath it.
  return <li className="pay-row">
    <div className="pay-fact">
      <span className={'read-direction ' + (incoming ? 'incoming' : 'outgoing')} aria-hidden="true">{incoming ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</span>
      <div className="pay-main">
        <strong>{incoming ? 'Received' : 'Sent'}{party ? <> {incoming ? 'from' : 'to'} <span className="pay-party" title={movement.counterparty ?? undefined}>{party}</span></> : ''}</strong>
        <span>{time}{movement.status === 'failed' ? ', failed' : ''}{movement.digest && <> · <a className="pay-digest" href={`https://suiscan.xyz/mainnet/tx/${movement.digest}`} target="_blank" rel="noreferrer">View transaction</a></>}</span>
      </div>
      <div className={'pay-value ' + (incoming ? 'incoming' : '')}><strong>{incoming ? '+' : '−'}{shownAmount}</strong><small>{asset === 'native USDC' ? 'USDC' : asset}</small></div>
    </div>
    {annotation ? <div className="pay-memory">
      <Sparkles size={14} aria-hidden="true"/>
      <span><b>{annotation.note}</b> {annotation.ownTransfer ? 'Own transfer' : annotation.category}</span>
      {canLabel && <button className="pay-memory-edit" aria-expanded={open} onClick={() => setOpen(!open)}>Edit</button>}
    </div> : pendingNote ? <div className="pay-memory pending" role="status">
      <RefreshCw size={14} aria-hidden="true"/>
      <span><b>{pendingNote}</b> Waiting for Walrus to confirm</span>
    </div> : canLabel && <button className="pay-prompt" aria-expanded={open} onClick={() => setOpen(!open)}><Tag size={14} aria-hidden="true"/>What was this for?</button>}
    {open && (memoryAgreed ? <LabelForm movement={movement} state={state} onDone={() => { setOpen(false); onLabeled(); }}/> : <MemoryConsent onAccepted={onLabeled}/>)}
  </li>;
}

function dayHeading(key: string, today: string, yesterday: string) {
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(key + 'T12:00:00Z'));
}

function freshness(observedAt: string, now: string) {
  const minutes = Math.round((Date.parse(now) - Date.parse(observedAt)) / 60000);
  if (minutes < 1) return 'Checked just now';
  if (minutes < 60) return `Checked ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `Checked ${hours} h ago` : `Checked ${Math.round(hours / 24)} d ago`;
}

export function ReadOnlyWallet({ screen, state, busy, error, onSync, onAcceptConsent, labels, onLabeled }: Props) {
  const consented = [READ_ONLY_WALLET_CONSENT_VERSION, OPERATOR_MANAGED_CONSENT_VERSION].includes(state.profile.consentVersion ?? '');
  if (!consented) return <ConsentCard busy={busy} onAccept={onAcceptConsent}/>;

  if (screen === 'plan') return <section className="card read-release-card">
    <span className="read-only-label">Personal planning is paused</span>
    <h2>Wallet facts are available. Budget changes are still locked.</h2>
    <p>The balance read has no checkpoint that proves it includes a matched payment. Until Tatum supplies that consistency evidence, this screen won’t calculate a personal spending allowance or release bill reservations.</p>
    <p>Your current balance and imported payments are available in <Link className="text-link" href="/today">Today</Link> and <Link className="text-link" href="/activity">Activity</Link>. No budget edits or memory writes are enabled in this read-only pilot.</p>
  </section>;

  if (screen === 'memories' || screen === 'learning') return <section className="card read-release-card">
    <span className="read-only-label">Walrus Memory · no new writes</span>
    <h2>{screen === 'memories' ? 'Memory changes are paused.' : 'Learning updates are paused.'}</h2>
    <p>This live pilot is currently read-only. It does not create or correct Walrus memories. Your onchain balance and activity remain available from Today and Activity.</p>
  </section>;

  const balance = state.balance;
  const rows = [...state.movements].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const shown = screen === 'activity' ? rows.slice(0, 25) : rows.slice(0, 5);
  const historyComplete = state.coverage.state === 'complete';
  const unlabeled = rows.filter(m => labelable(m) && !state.annotations.some(a => a.movementId === m.id) && !state.memories.some(e => e.envelope.logicalKey === 'annotation:' + m.id && e.state !== 'failed')).length;
  const timezone = state.plan.timezone, dayKey = (instant: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(instant));
  const today = dayKey(state.now), yesterday = dayKey(new Date(Date.parse(state.now) - 86400000).toISOString());
  const days = shown.reduce<{ key: string; items: MovementRecord[] }[]>((groups, movement) => {
    const key = dayKey(movement.timestamp), last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(movement); else groups.push({ key, items: [movement] });
    return groups;
  }, []);
  return <div className="read-only-wallet">
    <section className="card read-balance-card" aria-label="Wallet balance from Tatum">
      <div className="balance-head">
        <h2>Your balance</h2>
        <span className={'balance-fresh' + (busy ? ' busy' : '')} role="status">{busy ? 'Refreshing from Tatum…' : balance ? freshness(balance.observedAt, state.now) : 'Not read yet'}</span>
        <button className="icon-button" onClick={() => onSync('balances')} disabled={busy} aria-label={balance ? 'Refresh balance' : 'Read balance'}><RefreshCw size={17} className={busy ? 'spin' : ''}/></button>
      </div>
      <strong className="read-balance-amount">{balance ? exact(balance.usdc, 6) : '—'} <small>USDC</small></strong>
      <div className="read-sui-row"><span>SUI for network fees</span><strong>{balance ? exact(balance.sui, 9) : '—'} <small>SUI</small></strong></div>
      <p className="micro balance-note">{balance ? `Read from Sui Mainnet through Tatum at ${clockLabel(balance.observedAt, timezone)}. A payment you just sent can take a moment to show.` : 'Your balance is read from Sui Mainnet through Tatum as soon as this screen opens.'}</p>
      <details className="read-evidence-details"><summary>How Tatum checked these values</summary>
        <p>The server queried the signed-in address through Tatum’s Sui Mainnet gRPC service. It checked the network identity, exact coin type and metadata before saving the result.</p>
        <p>USDC coin type · 6 decimals</p><code>{USDC_TYPE}</code>
        <p>SUI coin type · 9 decimals</p><code>{SUI_TYPE}</code>
        <p className="micro">Tatum does not attach a checkpoint to this balance response. The latest service checkpoint is separate and is not treated as the balance’s checkpoint.</p>
      </details>
    </section>

    <section className="card read-activity-card" aria-labelledby="read-activity-title">
      <div className="section-title"><div><h2 id="read-activity-title">{screen === 'activity' ? 'Payments' : 'Recent payments'}</h2><p className="muted small-text">What moved is read from the chain. What it was for comes from you.</p></div>
        {!historyComplete && <button className="button small" onClick={() => onSync('history')} disabled={busy}><RefreshCw size={14} className={busy ? 'spin' : ''}/>{state.coverage.state === 'not_synced' ? 'Import last 30 days' : 'Continue import'}</button>}
      </div>
      {!historyComplete && <p className="read-coverage-line">{state.coverage.reason}</p>}
      {error && <p className="read-inline-error" role="alert">{error}</p>}
      {labels && unlabeled > 0 && <p className="read-needs-label" role="status"><Tag size={14}/>{unlabeled} {unlabeled === 1 ? 'payment is' : 'payments are'} waiting for a label. Sui Money remembers what you tell it.</p>}
      {shown.length ? days.map(day => <section className="pay-day" key={day.key} aria-label={dayHeading(day.key, today, yesterday)}>
        <h3>{dayHeading(day.key, today, yesterday)}</h3>
        <ul>{day.items.map(movement => <Movement key={movement.id} movement={movement} state={state} labels={labels} onLabeled={onLabeled}/>)}</ul>
      </section>) : <p className="read-empty">{historyComplete ? 'No USDC or SUI payments in the last 30 days.' : 'Import your last 30 days of payments to see them here.'}</p>}
      {screen !== 'activity' && rows.length > shown.length && <Link className="text-link" href="/activity">View all imported activity</Link>}
      {historyComplete && <p className="micro">The imported window is bounded to the provider’s available history. This is not a lifetime wallet export.</p>}
    </section>
    {screen === 'activity' && rows.length > 25 && <p className="micro">Showing the latest 25 imported movements. The full saved list remains profile-scoped.</p>}
  </div>;
}
