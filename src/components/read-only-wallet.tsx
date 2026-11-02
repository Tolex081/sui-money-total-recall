'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, RefreshCw, Search, Send, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { api } from './http';
import type { AccountState } from '@/domain/state';
import type { planning } from '@/domain/planning';
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
  // Sending and planning are separate releases on top of the read-only pilot.
  moves?: boolean;
  plan?: ReturnType<typeof planning> | null;
};
export const labelCategories = ['Food', 'Groceries', 'Transport', 'Home', 'Internet', 'Learning', 'Health', 'Family', 'Work', 'Other'];

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
type MemoryRecord = AccountState['memories'][number];
const UNSETTLED = ['queued', 'submitting', 'accepted', 'saved'];
const labelPayload = (m: MemoryRecord) => {
  const p = (typeof m.envelope.payload === 'object' && m.envelope.payload ? m.envelope.payload : {}) as { note?: unknown; category?: unknown; ownTransfer?: unknown };
  return { note: typeof p.note === 'string' ? p.note : 'your label', category: typeof p.category === 'string' ? p.category : 'Other', ownTransfer: p.ownTransfer === true };
};
// The newest label event for a payment decides what its row shows: confirmed, waiting, unknown outcome or failed.
const latestLabel = (state: AccountState, movementId: string) => state.memories.filter(m => m.envelope.logicalKey === 'annotation:' + movementId).sort((a, b) => b.envelope.revision - a.envelope.revision)[0];

// No background worker exists, so the page drives pending label jobs: submit, wait for storage, then confirm by recall.
// It runs at list level so the label form can close as soon as the label is saved. Stalls are tracked per label event,
// so a label saved after an earlier one stalled still shows as waiting.
function useLabelConfirmation(state: AccountState, enabled: boolean, onLabeled: () => void) {
  const pending = state.memories.filter(m => m.envelope.logicalKey.startsWith('annotation:') && UNSETTLED.includes(m.state)).sort((a, b) => a.envelope.recordedAt.localeCompare(b.envelope.recordedAt));
  const [stalled, setStalled] = useState<Record<string, string>>({}), [announcement, setAnnouncement] = useState('');
  const active = pending.filter(m => !stalled[m.envelope.eventId]);
  const signature = active.map(m => m.envelope.eventId).join(','), oldestNote = active[0] ? labelPayload(active[0]).note : '';
  const reload = useRef(onLabeled);
  useEffect(() => { reload.current = onLabeled; }, [onLabeled]);
  useEffect(() => {
    if (!enabled || !signature) return;
    const waiting = signature.split(',');
    const stall = (reason: string) => setStalled(current => ({ ...current, ...Object.fromEntries(waiting.map(id => [id, reason])) }));
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 12; attempt++) {
        try {
          const job = await api<{ state: string; error?: string }>('/memory-jobs/advance', {});
          if (cancelled) return;
          // The server advances the oldest pending job first, so a confirmation belongs to the oldest pending label.
          if (job.state === 'recall_confirmed') { setAnnouncement(`Remembered: ${oldestNote}`); reload.current(); return; }
          if (job.state === 'idle' || job.state === 'submission_outcome_unknown') { reload.current(); return; }
          if (job.state === 'failed') { setAnnouncement(`Walrus didn’t store “${oldestNote}”.`); reload.current(); return; }
        } catch (e) { if (!cancelled) stall((e as Error).message); return; }
        await new Promise(resolve => setTimeout(resolve, 7000));
        if (cancelled) return;
      }
      stall('Walrus is taking longer than usual. Your label is saved and still waiting to be confirmed.');
    })();
    return () => { cancelled = true; };
  }, [enabled, signature, oldestNote]);
  // Check again clears this label's stall (restarting the loop) and runs one check now, which also reconciles an unknown outcome by recall.
  const retry = (eventId: string) => {
    setStalled(current => { const next = { ...current }; delete next[eventId]; return next; });
    api('/memory-jobs/advance', {}).then(() => reload.current()).catch(e => setStalled(current => ({ ...current, [eventId]: (e as Error).message })));
  };
  return { stalled, announcement, retry };
}

function MemoryConsent({ movement, summary, onAccepted, onCancel }: { movement: MovementRecord; summary: string; onAccepted: () => void; onCancel: () => void }) {
  const [accepted, setAccepted] = useState(false), [saving, setSaving] = useState(false), [failure, setFailure] = useState('');
  async function accept() { setSaving(true); setFailure(''); try { await api('/consent/memory', { accepted: true }); onAccepted(); } catch (e) { setFailure((e as Error).message); } finally { setSaving(false); } }
  return <div className="read-label-panel" role="group" aria-labelledby={`memory-consent-${movement.id}`} onKeyDown={event => { if (event.key === 'Escape' && !saving) { event.preventDefault(); onCancel(); } }}>
    <strong id={`memory-consent-${movement.id}`}>Before you label {summary}</strong>
    <p>Sui Money remembers labels with Walrus Memory, so they’re there next time you sign in.</p>
    <ul className="read-consent-facts">
      <li><b>What’s stored:</b> your note, its category, and whether it was a transfer to your own wallet, linked to this payment’s transaction ID and your wallet address.</li>
      <li><b>What isn’t:</b> your balance, your other payments, or anything you don’t type into a label.</li>
      <li><b>For how long:</b> Walrus storage can’t be erased on request. You can replace a label, but earlier versions stay stored.</li>
    </ul>
    <p>The operator runs the Walrus account, so use short aliases like “Rent” or “Landlord”, never names, phone numbers or keys.</p>
    <label className="read-consent-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/><span>I agree to store my payment labels in operator-managed Walrus Memory.</span></label>
    {failure && <p className="read-inline-error" role="alert">{failure}</p>}
    <div className="read-label-actions">
      <button className="button primary small" disabled={!accepted || saving} onClick={accept}>{saving ? 'Saving your choice…' : 'Agree and label this payment'}</button>
      <button type="button" className="button small" onClick={onCancel} disabled={saving}>Not now</button>
    </div>
    <Link className="text-link" href="/about">How Sui Money handles your data</Link>
  </div>;
}

function LabelForm({ movement, state, onSaved, onCancel }: { movement: MovementRecord; state: AccountState; onSaved: () => void; onCancel: () => void }) {
  const existing = state.annotations.find(a => a.movementId === movement.id);
  const prior = latestLabel(state, movement.id), draft = prior?.state === 'failed' ? labelPayload(prior) : null;
  const [category, setCategory] = useState(draft?.category ?? existing?.category ?? 'Other'), [note, setNote] = useState(draft?.note ?? existing?.note ?? ''), [own, setOwn] = useState(draft?.ownTransfer ?? existing?.ownTransfer ?? false);
  const [failure, setFailure] = useState(''), [saving, setSaving] = useState(false);
  const noteField = useRef<HTMLInputElement>(null);
  useEffect(() => { noteField.current?.focus(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFailure('');
    try {
      await api('/activity/' + encodeURIComponent(movement.id) + '/annotation', { category, note, ownTransfer: own, rememberDestination: false, expectedRevision: prior?.envelope.revision ?? 0, supersedesEventId: prior?.envelope.eventId });
      // Saved: the row's pending chip takes over while Walrus confirms in the background.
      onSaved();
    } catch (e) { setFailure((e as Error).message); setSaving(false); }
  }
  return <form className="read-label-panel" onSubmit={submit} onKeyDown={event => { if (event.key === 'Escape' && !saving) { event.preventDefault(); onCancel(); } }}>
    <label>What was this for?<input ref={noteField} value={note} onChange={event => setNote(event.target.value)} maxLength={160} placeholder="e.g. October rent" required aria-describedby={`permanence-${movement.id}`}/></label>
    <label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{labelCategories.map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="read-label-own"><input type="checkbox" checked={own} onChange={event => setOwn(event.target.checked)}/>Moved to another wallet of mine</label>
    {failure && <p className="read-inline-error" role="alert">{failure}</p>}
    <p className="micro" id={`permanence-${movement.id}`}>Saved permanently to Walrus Memory. Use a short alias, not a person’s name.</p>
    <div className="read-label-actions">
      <button className="button primary small" disabled={saving}>{saving ? 'Saving…' : existing || draft ? 'Save label again' : 'Save label'}</button>
      <button type="button" className="button small" onClick={onCancel} disabled={saving}>Cancel</button>
    </div>
  </form>;
}

function Movement({ movement, state, labels, onLabeled, stalled, onRetry }: { movement: MovementRecord; state: AccountState; labels: boolean; onLabeled: () => void; stalled: Record<string, string>; onRetry: (eventId: string) => void }) {
  const [open, setOpen] = useState(false), [retrying, setRetrying] = useState(false), [retryError, setRetryError] = useState('');
  const opener = useRef<HTMLButtonElement>(null), chip = useRef<HTMLDivElement>(null), focusChip = useRef(false);
  const timezone = state.plan.timezone, annotation = state.annotations.find(a => a.movementId === movement.id);
  const delta = integer(movement.delta), incoming = delta > 0n;
  const asset = movement.coinType === USDC_TYPE ? 'native USDC' : movement.coinType === SUI_TYPE ? 'SUI' : 'other asset';
  const decimals = movement.coinType === SUI_TYPE ? 9 : 6;
  const shownAmount = exact(delta < 0n ? -delta : delta, decimals);
  const memoryAgreed = state.profile.consentVersion === OPERATOR_MANAGED_CONSENT_VERSION;
  const party = movement.counterparty ? `${movement.counterparty.slice(0, 6)}…${movement.counterparty.slice(-4)}` : null;
  const time = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: timezone }).format(new Date(movement.timestamp));
  const canLabel = labels && labelable(movement);
  const summary = `the ${shownAmount} USDC you ${incoming ? 'received' : 'sent'}${party ? ` ${incoming ? 'from' : 'to'} ${party}` : ''}`;
  const latest = latestLabel(state, movement.id), latestNote = latest ? labelPayload(latest).note : '';
  const status = !latest ? null : UNSETTLED.includes(latest.state) ? (stalled[latest.envelope.eventId] ? 'stalled' : 'waiting') : latest.state === 'submission_outcome_unknown' ? 'unknown' : latest.state === 'failed' ? 'failed' : null;
  // After a save, focus moves to the chip that replaced the prompt, so keyboard users land on the new status.
  useEffect(() => { if (focusChip.current && status && chip.current) { chip.current.focus(); focusChip.current = false; } }, [status]);
  const close = () => { setOpen(false); requestAnimationFrame(() => opener.current?.focus()); };
  async function saveAgain() {
    if (!latest) return;
    setRetrying(true); setRetryError('');
    const payload = labelPayload(latest);
    try { await api('/activity/' + encodeURIComponent(movement.id) + '/annotation', { ...payload, rememberDestination: false, expectedRevision: latest.envelope.revision, supersedesEventId: latest.envelope.eventId }); focusChip.current = true; onLabeled(); }
    catch (e) { setRetryError((e as Error).message); } finally { setRetrying(false); }
  }
  // Two layers per payment: the Tatum fact on top, the Walrus-remembered label (or the prompt for one) beneath it.
  return <li className="pay-row">
    <div className="pay-fact">
      <span className={'read-direction ' + (incoming ? 'incoming' : 'outgoing')} aria-hidden="true">{incoming ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</span>
      <div className="pay-main">
        <strong>{incoming ? 'Received' : 'Sent'}{party ? <> {incoming ? 'from' : 'to'} <span className="pay-party" title={movement.counterparty ?? undefined}>{party}</span></> : ''}</strong>
        <span>{time}{movement.status === 'failed' ? ', failed' : ''}{movement.digest && <> · <a className="pay-digest" href={`https://suiscan.xyz/mainnet/tx/${movement.digest}`} target="_blank" rel="noreferrer">View transaction<span className="sr-only"> of {shownAmount} USDC on Suiscan (opens in a new tab)</span></a></>}</span>
      </div>
      <div className={'pay-value ' + (incoming ? 'incoming' : '')}><strong>{incoming ? '+' : '−'}{shownAmount}</strong><small>{asset === 'native USDC' ? 'USDC' : asset}</small></div>
    </div>
    {status === 'waiting' ? <div ref={chip} tabIndex={-1} className="pay-memory pending">
      <RefreshCw size={14} aria-hidden="true"/>
      <span><b>{latestNote}</b> Saved. Waiting for Walrus to confirm.</span>
    </div> : status === 'stalled' || status === 'unknown' ? <div ref={chip} tabIndex={-1} className="pay-memory pending stalled">
      <RefreshCw size={14} aria-hidden="true"/>
      <span><b>{latestNote}</b> {status === 'unknown' ? 'Walrus hasn’t confirmed whether this was stored. It won’t be sent twice.' : stalled[latest!.envelope.eventId]}</span>
      <button className="pay-memory-edit" onClick={() => onRetry(latest!.envelope.eventId)}>Check again<span className="sr-only"> for “{latestNote}”</span></button>
    </div> : status === 'failed' ? <div ref={chip} tabIndex={-1} className="pay-memory failed">
      <AlertCircle size={14} aria-hidden="true"/>
      <span><b>Walrus didn’t store “{latestNote}”.</b> {annotation ? `Your earlier label “${annotation.note}” still applies.` : 'This payment has no label yet.'}{retryError && <> {retryError}</>}</span>
      {canLabel && <button className="pay-memory-edit" disabled={retrying} onClick={() => memoryAgreed ? void saveAgain() : setOpen(true)}>{retrying ? 'Saving…' : 'Try again'}<span className="sr-only"> to save “{latestNote}”</span></button>}
    </div> : annotation ? <div className="pay-memory">
      <Sparkles size={14} aria-hidden="true"/>
      <span><b>{annotation.note}</b> {annotation.ownTransfer ? 'Own transfer' : annotation.category}</span>
      {canLabel && <button ref={opener} className="pay-memory-edit" aria-expanded={open} onClick={() => setOpen(!open)}>Edit<span className="sr-only"> label “{annotation.note}”</span></button>}
    </div> : canLabel && <button ref={opener} className="pay-prompt" aria-expanded={open} onClick={() => setOpen(!open)}><Tag size={14} aria-hidden="true"/>What was this for?<span className="sr-only"> {incoming ? 'Received' : 'Sent'} {shownAmount} USDC{party ? ` ${incoming ? 'from' : 'to'} ${party}` : ''}</span></button>}
    {open && (status === null || status === 'failed') && (memoryAgreed ? <LabelForm movement={movement} state={state} onSaved={() => { setOpen(false); focusChip.current = true; onLabeled(); }} onCancel={close}/> : <MemoryConsent movement={movement} summary={summary} onAccepted={onLabeled} onCancel={close}/>)}
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

function PlanGlance({ plan }: { plan: ReturnType<typeof planning> }) {
  if (plan.state !== 'ready') return <section className="card read-plan-glance" aria-labelledby="plan-glance-title">
    <h2 id="plan-glance-title">Your plan</h2>
    <p>{plan.state === 'incomplete' ? 'Set an end date and a reserve to see what’s left to spend each day.' : plan.reason}</p>
    <Link className="button small" href="/plan">{plan.state === 'incomplete' ? 'Start a plan' : 'Open Plan'} <ArrowRight size={14} aria-hidden="true"/></Link>
  </section>;
  return <section className="card read-plan-glance" aria-labelledby="plan-glance-title">
    <h2 id="plan-glance-title">Left to spend</h2>
    <strong className="plan-glance-amount">{exact(plan.discretionary, 6)} <small>USDC</small></strong>
    <p className="muted small-text">{plan.shortfall > 0n ? `Your bills and reserve are ${exact(plan.shortfall, 6)} USDC more than you hold.` : `About ${exact(plan.daily, 6)} USDC a day for the next ${plan.days} days, after ${exact(plan.commitments, 6)} USDC of bills and a ${exact(plan.reserve, 6)} USDC reserve.`}</p>
    <Link className="text-link" href="/plan">Open Plan</Link>
  </section>;
}

export function ReadOnlyWallet({ screen, state, busy, onSync, onAcceptConsent, labels, onLabeled, moves = false, plan = null }: Props) {
  const confirmation = useLabelConfirmation(state, labels, onLabeled);
  const consented = [READ_ONLY_WALLET_CONSENT_VERSION, OPERATOR_MANAGED_CONSENT_VERSION].includes(state.profile.consentVersion ?? '');
  if (!consented) return <ConsentCard busy={busy} onAccept={onAcceptConsent}/>;

  if (screen === 'plan') return <section className="card read-release-card">
    <span className="read-only-label">Personal planning is paused</span>
    <h2>Wallet facts are available. Budget changes are still locked.</h2>
    <p>The balance read has no checkpoint that proves it includes a matched payment. Until Tatum supplies that consistency evidence, this screen won’t calculate a personal spending allowance or release bill reservations.</p>
    <p>Your current balance and imported payments are available in <Link className="text-link" href="/today">Today</Link> and <Link className="text-link" href="/activity">Activity</Link>. {labels ? 'Budget edits stay off in this read-only pilot; payment labels are the only thing it saves.' : 'No budget edits or memory writes are enabled in this read-only pilot.'}</p>
  </section>;

  if (screen === 'send' || screen === 'receive') return <section className="card read-release-card">
    <span className="read-only-label">Sending isn’t switched on yet</span>
    <h2>This wallet is read-only for now.</h2>
    <p>Your balance and payments are in <Link className="text-link" href="/today">Today</Link> and <Link className="text-link" href="/activity">Activity</Link>. To receive, share your address: <code className="read-address">{state.profile.wallet}</code></p>
  </section>;

  if (screen === 'memories' || screen === 'learning') return <section className="card read-release-card">
    <span className="read-only-label">{labels ? 'Walrus Memory · payment labels only' : 'Walrus Memory · no new writes'}</span>
    <h2>{screen === 'memories' ? (labels ? 'Your labels live with your payments.' : 'Memory changes are paused.') : 'Learning updates are paused.'}</h2>
    <p>{labels ? <>In this pilot, the only memories Sui Money saves are the payment labels you confirm. You’ll find each one under its payment in <Link className="text-link" href="/activity">Activity</Link>. Other memory changes and learned budget rules stay paused.</> : 'This live pilot is currently read-only. It does not create or correct Walrus memories. Your onchain balance and activity remain available from Today and Activity.'}</p>
  </section>;

  const balance = state.balance;
  const rows = [...state.movements].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const historyComplete = state.coverage.state === 'complete';
  // A payment stays in the queue until Walrus confirms its label, so pending and failed saves remain visible there.
  const needsLabel = (m: MovementRecord) => labelable(m) && !state.annotations.some(a => a.movementId === m.id);
  const unlabeled = labels ? rows.filter(needsLabel) : [];
  const list = { state, labels, onLabeled, confirmation };
  const importPrompt = !historyComplete && <div className="read-import">
    <p className="read-coverage-line">{state.coverage.reason}</p>
    <button className="button small" onClick={() => onSync('history')} disabled={busy}><RefreshCw size={14} className={busy ? 'spin' : ''}/>{state.coverage.state === 'not_synced' ? 'Import last 30 days' : 'Continue import'}</button>
  </div>;
  const fresh = busy ? 'Refreshing from Tatum…' : balance ? freshness(balance.observedAt, state.now) : 'Not read yet';
  const refresh = <button className="icon-button" onClick={() => onSync('balances')} disabled={busy} aria-label={balance ? 'Refresh balance' : 'Read balance'}><RefreshCw size={17} className={busy ? 'spin' : ''}/></button>;

  if (screen === 'activity') return <div className="read-only-wallet">
    <p className="sr-only" role="status">{confirmation.announcement}</p>
    <div className="read-balance-strip"><span>Balance</span><strong>{balance ? exact(balance.usdc, 6) : '—'} <small>USDC</small></strong><span className="balance-fresh">{fresh}</span>{refresh}</div>
    <ActivityPayments rows={rows} unlabeled={unlabeled} list={list} importPrompt={importPrompt} historyComplete={historyComplete}/>
  </div>;

  return <div className="read-only-wallet">
    <p className="sr-only" role="status">{confirmation.announcement}</p>
    <section className="card read-balance-card" aria-label="Wallet balance from Tatum">
      <div className="balance-head">
        <h2>Your balance</h2>
        <span className={'balance-fresh' + (busy ? ' busy' : '')}>{fresh}</span>
        {refresh}
      </div>
      <strong className="read-balance-amount">{balance ? exact(balance.usdc, 6) : '—'} <small>USDC</small></strong>
      <div className="read-sui-row"><span>SUI for network fees</span><strong>{balance ? exact(balance.sui, 9) : '—'} <small>SUI</small></strong></div>
      {moves && <div className="balance-actions">
        <Link className="button primary" href="/send"><Send size={16} aria-hidden="true"/>Send</Link>
        <Link className="button" href="/receive"><ArrowDownLeft size={16} aria-hidden="true"/>Receive</Link>
      </div>}
      <p className="micro balance-note">{balance ? `Read from Sui Mainnet through Tatum at ${clockLabel(balance.observedAt, state.plan.timezone)}. A payment you just sent can take a moment to show.` : 'Your balance is read from Sui Mainnet through Tatum as soon as this screen opens.'}</p>
      <details className="read-evidence-details"><summary>How Tatum checked these values</summary>
        <p>The server queried the signed-in address through Tatum’s Sui Mainnet gRPC service. It checked the network identity, exact coin type and metadata before saving the result.</p>
        <p>USDC coin type · 6 decimals</p><code>{USDC_TYPE}</code>
        <p>SUI coin type · 9 decimals</p><code>{SUI_TYPE}</code>
        <p className="micro">Tatum does not attach a checkpoint to this balance response. The latest service checkpoint is separate and is not treated as the balance’s checkpoint.</p>
      </details>
    </section>

    {plan && <PlanGlance plan={plan}/>}

    {unlabeled.length > 0 && <section className="card read-activity-card read-queue" aria-labelledby="read-queue-title">
      <div className="section-title"><div><h2 id="read-queue-title">Waiting for a label <span className="read-count">{unlabeled.length}</span></h2><p className="muted small-text">What moved is read from the chain. What it was for comes from you.</p></div></div>
      <PaymentDays rows={unlabeled.slice(0, 5)} {...list}/>
      {unlabeled.length > 5 && <Link className="text-link" href="/activity">See all {unlabeled.length} in Activity</Link>}
    </section>}

    <section className="card read-activity-card" aria-labelledby="read-activity-title">
      <div className="section-title"><div><h2 id="read-activity-title">Latest payments</h2>{unlabeled.length === 0 && <p className="muted small-text">What moved is read from the chain. What it was for comes from you.</p>}</div></div>
      {importPrompt}
      {rows.length ? <PaymentDays rows={rows.slice(0, 3)} {...list}/> : <p className="read-empty">{historyComplete ? 'No USDC or SUI payments in the last 30 days.' : 'Import your last 30 days of payments to see them here.'}</p>}
      {rows.length > 3 && <Link className="text-link" href="/activity">View all {rows.length} payments</Link>}
    </section>
  </div>;
}

type ListProps = { state: AccountState; labels: boolean; onLabeled: () => void; confirmation: ReturnType<typeof useLabelConfirmation> };

function PaymentDays({ rows, state, labels, onLabeled, confirmation }: ListProps & { rows: MovementRecord[] }) {
  const timezone = state.plan.timezone, dayKey = (instant: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(instant));
  const today = dayKey(state.now), yesterday = dayKey(new Date(Date.parse(state.now) - 86400000).toISOString());
  const days = rows.reduce<{ key: string; items: MovementRecord[] }[]>((groups, movement) => {
    const key = dayKey(movement.timestamp), last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(movement); else groups.push({ key, items: [movement] });
    return groups;
  }, []);
  return <>{days.map(day => <div className="pay-day" key={day.key}>
    <h3>{dayHeading(day.key, today, yesterday)}</h3>
    <ul>{day.items.map(movement => <Movement key={movement.id} movement={movement} state={state} labels={labels} onLabeled={onLabeled} stalled={confirmation.stalled} onRetry={confirmation.retry}/>)}</ul>
  </div>)}</>;
}

const PAGE = 25;
type Filter = 'all' | 'unlabeled' | 'received' | 'sent';
function ActivityPayments({ rows, unlabeled, list, importPrompt, historyComplete }: { rows: MovementRecord[]; unlabeled: MovementRecord[]; list: ListProps; importPrompt: ReactNode; historyComplete: boolean }) {
  const [filter, setFilter] = useState<Filter>('all'), [query, setQuery] = useState(''), [limit, setLimit] = useState(PAGE);
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const matches = (m: MovementRecord) => {
    if (!q) return true;
    const a = list.state.annotations.find(x => x.movementId === m.id);
    return [a?.note, a?.category, m.counterparty, m.digest].some(v => v?.toLowerCase().includes(q));
  };
  const filtered = rows.filter(m => (filter === 'all' || (filter === 'unlabeled' ? unlabeled.includes(m) : filter === 'received' ? integer(m.delta) > 0n : integer(m.delta) < 0n)) && matches(m));
  const shown = filtered.slice(0, limit);
  const filters: [Filter, string][] = [['all', 'All'], ...(list.labels ? [['unlabeled', `Needs a label (${unlabeled.length})`] as [Filter, string]] : []), ['received', 'Received'], ['sent', 'Sent']];
  // Label next opens the first payment still waiting for a label, wherever it sits in the list.
  function labelNext() {
    setFilter('unlabeled'); setQuery(''); setLimit(PAGE);
    requestAnimationFrame(() => { const prompt = listRef.current?.querySelector<HTMLButtonElement>('.pay-prompt'); prompt?.scrollIntoView({ block: 'center' }); prompt?.click(); });
  }
  return <section className="card read-activity-card" aria-labelledby="read-activity-title">
    <div className="section-title"><div><h2 id="read-activity-title">Payments</h2><p className="muted small-text">What moved is read from the chain. What it was for comes from you.</p></div>
      {list.labels && unlabeled.length > 0 && <button className="button primary small" onClick={labelNext}><Tag size={14} aria-hidden="true"/>Label next</button>}
    </div>
    {importPrompt}
    <div className="read-tools">
      <div className="read-filters" role="group" aria-label="Show payments">{filters.map(([value, label]) => <button key={value} className={'read-filter' + (filter === value ? ' active' : '')} aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(PAGE); }}>{label}</button>)}</div>
      <label className="read-search"><Search size={15} aria-hidden="true"/><span className="sr-only">Search payments</span><input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE); }} placeholder="Search labels or addresses"/></label>
    </div>
    <div ref={listRef}>
      {shown.length ? <PaymentDays rows={shown} {...list}/> : <p className="read-empty">{rows.length === 0 ? (historyComplete ? 'No USDC or SUI payments in the last 30 days.' : 'Import your last 30 days of payments to see them here.') : filter === 'unlabeled' && !q ? 'Every payment has a label.' : 'No payments match. Try another filter or search.'}</p>}
    </div>
    <div className="read-list-foot">
      <span className="micro">Showing {shown.length} of {filtered.length}</span>
      {filtered.length > shown.length && <button className="button small" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, filtered.length - shown.length)} more</button>}
    </div>
  </section>;
}
