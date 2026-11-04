'use client';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { DAppKitProvider, useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import qrcode from 'qrcode-generator';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Check, Copy, RefreshCw } from 'lucide-react';
import { api, ApiError } from './http';
import { dAppKit, walletOrder } from './wallet';
import { walletMessage } from './wallet-errors';
import { LabelPicker } from './label-picker';
import type { AccountState } from '@/domain/state';
import { amount, integer, units, SUI_TYPE, USDC_TYPE } from '@/domain/money';
import { OPERATOR_MANAGED_CONSENT_VERSION } from '@/domain/consent';

type Props = { state: AccountState; labels: boolean; onChanged: () => void };
const exact = (value: string | bigint, decimals = 6) => amount(value, decimals, decimals).replace(/(\.\d{2}\d*?)0+$/, '$1');
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const suiscan = (digest: string) => `https://suiscan.xyz/mainnet/tx/${digest}`;

export default function MoneyMoves({ screen, ...props }: Props & { screen: 'send' | 'receive' }) {
  return <DAppKitProvider dAppKit={dAppKit}>{screen === 'send' ? <Send {...props}/> : <Receive {...props}/>}</DAppKitProvider>;
}

function BalanceAside({ state }: { state: AccountState }) {
  const b = state.balance;
  return <dl className="move-balances">
    <div><dt>USDC available</dt><dd>{b ? exact(b.usdc) : '—'} <small>USDC</small></dd></div>
    <div><dt>SUI for network fees</dt><dd>{b ? exact(b.sui, 9) : '—'} <small>SUI</small></dd></div>
  </dl>;
}

type Coin = 'USDC' | 'SUI';
const DECIMALS: Record<Coin, number> = { USDC: 6, SUI: 9 };
// Sending all of a wallet's SUI would leave nothing for the network fee, so Send all keeps this much back.
const SUI_FEE_RESERVE = 10_000_000n;
type Prepared = { id: string; recipient: string; amount: string; coin: Coin; transaction: string; gasBudget: string | null };
type Phase = 'form' | 'review' | 'signing' | 'submitting' | 'confirming' | 'done' | 'failed';

function Send({ state, labels, onChanged }: Props) {
  const account = useCurrentAccount(), kit = useDAppKit(dAppKit);
  const [recipient, setRecipient] = useState(''), [value, setValue] = useState(''), [note, setNote] = useState(''), [category, setCategory] = useState('Other');
  const [coin, setCoin] = useState<Coin>('USDC'), [memoryOk, setMemoryOk] = useState(false);
  const [phase, setPhase] = useState<Phase>('form'), [prepared, setPrepared] = useState<Prepared | null>(null), [digest, setDigest] = useState(''), [failure, setFailure] = useState(''), [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const memoryAgreed = state.profile.consentVersion === OPERATOR_MANAGED_CONSENT_VERSION;
  const balance = state.balance, held = balance ? integer(coin === 'SUI' ? balance.sui : balance.usdc) : null, decimals = DECIMALS[coin];
  const sendable = held === null ? null : coin === 'SUI' ? (held > SUI_FEE_RESERVE ? held - SUI_FEE_RESERVE : 0n) : held;
  const wrongWallet = account && account.address !== state.profile.wallet;
  useEffect(() => { if (phase !== 'form') heading.current?.focus(); }, [phase]);

  let requested: bigint | null = null, valueError = '';
  if (value.trim()) { try { requested = units(value.trim(), decimals); } catch (e) { valueError = (e as Error).message; } }
  if (requested !== null && held !== null && requested > held) valueError = `That’s more than the ${exact(held, decimals)} ${coin} in this wallet.`;
  else if (requested !== null && sendable !== null && coin === 'SUI' && requested > sendable) valueError = `Leave about ${exact(SUI_FEE_RESERVE, 9)} SUI for the network fee. You can send up to ${exact(sendable, 9)} SUI.`;
  if (requested === 0n) valueError = 'Enter an amount above zero.';

  async function review(event: FormEvent) {
    event.preventDefault(); if (valueError) return;
    setBusy(true); setFailure('');
    try { setPrepared(await api<Prepared>('/transfers', { recipient: recipient.trim(), amount: value.trim(), coin })); setPhase('review'); }
    catch (e) { setFailure((e as Error).message); } finally { setBusy(false); }
  }

  async function confirm() {
    if (!prepared) return;
    setFailure(''); setPhase('signing');
    let signed: { bytes: string; signature: string };
    try { signed = await kit.signTransaction({ transaction: prepared.transaction }); }
    catch (e) { setFailure(walletMessage(e)); setPhase('review'); return; }
    setPhase('submitting');
    let submitted: { digest: string; state: string; outcomeUnknown?: boolean };
    try { submitted = await api('/transfers/' + prepared.id + '/submit', signed); }
    catch (e) { setFailure((e as Error).message); setPhase(e instanceof ApiError && e.code === 'TRANSFER_EXPIRED' ? 'form' : 'failed'); return; }
    setDigest(submitted.digest);
    if (submitted.state === 'failed') { setFailure(`Sui rejected this transaction, so no ${prepared.coin} moved. The network fee may still have been charged.`); setPhase('failed'); onChanged(); return; }
    setPhase('confirming');
    for (let attempt = 0; attempt < 20; attempt++) {
      await wait(attempt === 0 ? 1500 : 3000);
      try {
        const result = await api<{ state: string; movementId?: string | null }>('/transfers/' + prepared.id + '/confirm', {});
        if (result.state === 'confirmed') { await saveLabel(result.movementId ?? null); setPhase('done'); onChanged(); return; }
        if (result.state === 'failed') { setFailure(`Sui recorded this transaction as failed, so no ${prepared.coin} moved. The network fee may still have been charged.`); setPhase('failed'); onChanged(); return; }
      } catch { /* A busy provider is not a failed send; keep checking. */ }
    }
    setOutcome('Sui accepted your send but it hasn’t shown in a checkpoint yet. It will appear in Activity once it does.'); setPhase('done'); onChanged();
  }

  async function saveLabel(movementId: string | null) {
    if (!note.trim() || !labels || !movementId) return;
    try {
      if (!memoryAgreed) { if (!memoryOk) return; await api('/consent/memory', { accepted: true }); }
      await api('/activity/' + encodeURIComponent(movementId) + '/annotation', { category, note: note.trim(), ownTransfer: false, rememberDestination: false, expectedRevision: 0 });
    } catch (e) { setOutcome(`Sent. Your label wasn’t saved: ${(e as Error).message} You can add it in Activity.`); }
  }

  function reset() { setPhase('form'); setPrepared(null); setDigest(''); setFailure(''); setOutcome(''); setRecipient(''); setValue(''); setNote(''); setCategory('Other'); }

  const fee = prepared?.gasBudget ? exact(prepared.gasBudget, 9) : null;
  const sendingTo = prepared ? short(prepared.recipient) : '';
  const steps: [Phase, string][] = [['signing', 'Approve in your wallet'], ['submitting', 'Sending to Sui'], ['confirming', 'Confirming on chain']];
  const stepIndex = steps.findIndex(([p]) => p === phase);

  return <div className="move-layout">
    <section className="card move-card" aria-labelledby="send-title">
      <h2 id="send-title" ref={heading} tabIndex={-1}>{phase === 'done' ? 'Sent' : phase === 'failed' ? 'Send didn’t go through' : phase === 'form' ? 'Who and how much' : 'Review and approve'}</h2>
      {!account ? <div className="move-connect">
        <p>Connect the wallet you signed in with ({short(state.profile.wallet)}). It approves the send; Sui Money never holds your keys.</p>
        <ConnectButton modalOptions={{ sortFn: walletOrder }}/>
        <p className="micro">Use an up-to-date Sui wallet. Suiet has ended development and its service stops after 14 November 2026, and it can’t send from newer Sui balances.</p>
      </div> : wrongWallet ? <p className="read-inline-error" role="alert">Your wallet is on {short(account.address)}, but you signed in as {short(state.profile.wallet)}. Switch accounts in your wallet to send from this one.</p>
      : phase === 'form' ? <form className="move-form" onSubmit={review} noValidate>
        <fieldset className="move-coin">
          <legend>Send</legend>
          <div className="read-filters" role="group" aria-label="Coin to send">{(['USDC', 'SUI'] as Coin[]).map(c => <button key={c} type="button" aria-pressed={coin === c} className={'read-filter' + (coin === c ? ' active' : '')} onClick={() => { setCoin(c); setValue(''); }}>{c}</button>)}</div>
        </fieldset>
        <label>To<input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} required aria-describedby="recipient-help"/></label>
        <p className="micro" id="recipient-help">A Sui Mainnet address. Sends can’t be reversed, so check it matches.</p>
        <label>Amount
          <span className="move-amount"><input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(',', '.'))} placeholder="0.00" required aria-invalid={!!valueError} aria-describedby="amount-help"/><span aria-hidden="true">{coin}</span></span>
        </label>
        <p className={valueError ? 'read-inline-error' : 'micro'} id="amount-help" role={valueError ? 'alert' : undefined}>{valueError || (held !== null && sendable !== null ? <>You have {exact(held, decimals)} {coin}{coin === 'SUI' ? ', and the network fee comes out of it too' : ''}. {sendable > 0n && <button type="button" className="text-button" onClick={() => setValue(exact(sendable, decimals).replaceAll(',', ''))}>Send all</button>}</> : 'Your balance hasn’t been read yet.')}</p>
        {labels && <fieldset className="move-label">
          <LabelPicker id="send-label" label="What’s it for? (optional)" note={note} category={category} onChange={(nextNote, nextCategory) => { setNote(nextNote); setCategory(nextCategory); }}/>
          {note.trim() && !memoryAgreed && <label className="read-consent-check"><input type="checkbox" checked={memoryOk} onChange={e => setMemoryOk(e.target.checked)}/><span>Save this label to operator-managed Walrus Memory. It can’t be erased later, so use a short alias, not a name.</span></label>}
        </fieldset>}
        {failure && <p className="read-inline-error" role="alert">{failure}</p>}
        <div className="move-actions"><button className="button primary" disabled={busy || !recipient.trim() || !value.trim() || !!valueError}>{busy ? 'Preparing…' : 'Review send'}</button></div>
      </form>
      : phase === 'done' ? <div className="move-result" role="status">
        <p className="move-result-amount"><Check size={20} aria-hidden="true"/>{prepared && exact(prepared.amount, DECIMALS[prepared.coin])} <small>{prepared?.coin}</small> to {sendingTo}</p>
        {outcome ? <p>{outcome}</p> : <p>Confirmed on Sui Mainnet and added to your Activity{note.trim() && labels ? ', with your label' : ''}.</p>}
        <div className="move-actions">{digest && <a className="button" href={suiscan(digest)} target="_blank" rel="noreferrer">View on Suiscan <ArrowUpRight size={15} aria-hidden="true"/><span className="sr-only"> (opens in a new tab)</span></a>}<Link className="button" href="/activity">See Activity</Link><button className="button primary" onClick={reset}>Send again</button></div>
      </div>
      : <div className="move-review">
        <dl className="move-summary">
          <div><dt>To</dt><dd title={prepared?.recipient}><code>{prepared?.recipient}</code></dd></div>
          <div><dt>Amount</dt><dd><strong>{prepared && exact(prepared.amount, DECIMALS[prepared.coin])}</strong> {prepared?.coin}</dd></div>
          <div><dt>Network fee</dt><dd>{fee ? `Up to ${fee} SUI` : 'Paid in SUI'}</dd></div>
          {labels && note.trim() && <div><dt>Label</dt><dd>{note.trim()} · {category}{!memoryAgreed && !memoryOk ? ' (not saved)' : ''}</dd></div>}
        </dl>
        {phase === 'review' || phase === 'failed' ? <>
          {failure && <p className="read-inline-error" role="alert"><AlertCircle size={15} aria-hidden="true"/> {failure}{digest && <> <a className="text-link" href={suiscan(digest)} target="_blank" rel="noreferrer">Check on Suiscan</a></>}</p>}
          <div className="move-actions">
            {phase === 'review' && <button className="button primary" onClick={() => void confirm()}>Approve in wallet</button>}
            <button className="button" onClick={phase === 'failed' ? reset : () => { setPhase('form'); setFailure(''); }}>{phase === 'failed' ? 'Start again' : 'Edit'}</button>
          </div>
          {phase === 'review' && <p className="micro">Your wallet shows the same amount and address before you approve. Sends can’t be reversed.</p>}
        </> : <ol className="move-steps" aria-live="polite">{steps.map(([p, label], i) => <li key={p} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}>{i < stepIndex ? <Check size={15} aria-hidden="true"/> : i === stepIndex ? <RefreshCw size={15} className="spin" aria-hidden="true"/> : <span className="move-step-dot" aria-hidden="true"/>}{label}{i === stepIndex && <span className="sr-only"> (in progress)</span>}</li>)}</ol>}
      </div>}
    </section>
    <aside className="card move-side" aria-labelledby="send-side-title">
      <h2 id="send-side-title">This wallet</h2>
      <BalanceAside state={state}/>
      <RecentSends state={state}/>
    </aside>
  </div>;
}

type TransferRow = { id: string; recipient: string; amount: string; coin: Coin; state: string; digest: string | null; createdAt: string };
function RecentSends({ state }: { state: AccountState }) {
  const [rows, setRows] = useState<TransferRow[] | null>(null), [error, setError] = useState('');
  useEffect(() => { api<{ transfers: TransferRow[] }>('/transfers').then(r => setRows(r.transfers)).catch(e => setError((e as Error).message)); }, [state]);
  const label: Record<string, string> = { submitted: 'Confirming', confirmed: 'Confirmed', failed: 'Failed', expired: 'Expired' };
  return <div className="move-recent">
    <h3>Sent from Sui Money</h3>
    {error ? <p className="micro">{error}</p> : rows === null ? <p className="micro">Loading…</p> : rows.length === 0 ? <p className="micro">Nothing sent from here yet. Every send also appears in Activity.</p>
    : <ul>{rows.slice(0, 5).map(r => <li key={r.id}>
      <span><strong>{exact(r.amount, DECIMALS[r.coin])} {r.coin}</strong> to {short(r.recipient)}</span>
      <span className={'move-state ' + r.state}>{r.digest ? <a href={suiscan(r.digest)} target="_blank" rel="noreferrer">{label[r.state] ?? r.state}<span className="sr-only"> on Suiscan (opens in a new tab)</span></a> : label[r.state] ?? r.state}</span>
    </li>)}</ul>}
  </div>;
}

function QrCode({ text }: { text: string }) {
  const cells = useMemo(() => { const qr = qrcode(0, 'M'); qr.addData(text); qr.make(); const n = qr.getModuleCount(); const d: string[] = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d.push(`M${c} ${r}h1v1h-1z`); return { n, path: d.join('') }; }, [text]);
  return <svg className="move-qr" viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`} role="img" aria-label="QR code of your wallet address" shapeRendering="crispEdges"><rect x={-2} y={-2} width={cells.n + 4} height={cells.n + 4} fill="#ffffff"/><path d={cells.path} fill="#15243b"/></svg>;
}

const WATCH_MS = 10 * 60 * 1000, TICK_MS = 15000;
function Receive({ state, onChanged }: Props) {
  const address = state.profile.wallet;
  const [copied, setCopied] = useState(false);
  const [watch, setWatch] = useState<'watching' | 'paused' | 'needs_import' | 'importing'>('watching'), [checkedAt, setCheckedAt] = useState<number | null>(null), [note, setNote] = useState('');
  const [seen, setSeen] = useState<string[]>([]), [now, setNow] = useState(() => Date.now());
  const reload = useRef(onChanged);
  useEffect(() => { reload.current = onChanged; }, [onChanged]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (watch !== 'watching') return;
    let cancelled = false; const started = Date.now();
    (async () => {
      while (!cancelled && Date.now() - started < WATCH_MS) {
        if (document.visibilityState === 'visible') {
          try {
            const result = await api<{ state: string; imported: number; movementIds?: string[] }>('/sync', { kind: 'recent' });
            if (cancelled) return;
            if (result.state === 'needs_import') { setWatch('needs_import'); return; }
            setCheckedAt(Date.now()); setNote('');
            if (result.imported && result.movementIds) { setSeen(current => [...new Set([...current, ...result.movementIds!])]); reload.current(); }
          } catch (e) { if (!cancelled && !(e instanceof ApiError && e.retryable)) setNote((e as Error).message); }
        }
        await wait(TICK_MS);
      }
      if (!cancelled) setWatch('paused');
    })();
    return () => { cancelled = true; };
  }, [watch]);

  async function importThenWatch() {
    setWatch('importing'); setNote('');
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const r = await api<{ state?: string; coverage?: { state: string } }>('/sync', { kind: 'history' });
        if (r.coverage?.state === 'complete' || r.state === 'complete') { reload.current(); setWatch('watching'); return; }
      } catch (e) { if (!(e instanceof ApiError && e.retryable)) { setNote((e as Error).message); setWatch('needs_import'); return; } }
      await wait(4500);
    }
    setNote('The import is taking a while. Its progress is saved; start again to continue.'); setWatch('needs_import');
  }

  async function copy() { try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setNote('Couldn’t copy automatically. Select the address and copy it.'); } }
  const arrivals = state.movements.filter(m => seen.includes(m.id) && integer(m.delta) > 0n);
  const ago = checkedAt === null ? null : Math.max(0, Math.round((now - checkedAt) / 1000));

  return <div className="move-layout">
    <section className="card move-card" aria-labelledby="receive-title">
      <h2 id="receive-title">Your address</h2>
      <div className="move-receive">
        <QrCode text={address}/>
        <div className="move-address">
          <p>Share this address, or let the sender scan the code. It’s the wallet you signed in with.</p>
          <div className="move-copy"><code>{address}</code><button className="button" onClick={copy}>{copied ? <Check size={15} aria-hidden="true"/> : <Copy size={15} aria-hidden="true"/>}{copied ? 'Copied' : 'Copy'}</button></div>
          <p className="move-warning"><AlertCircle size={15} aria-hidden="true"/><span>Send only <b>native USDC or SUI on Sui Mainnet</b> here. USDC sent from another network, such as Ethereum or Solana, won’t arrive.</span></p>
        </div>
      </div>
    </section>
    <aside className="card move-side" aria-labelledby="receive-live-title">
      <h2 id="receive-live-title">Incoming</h2>
      <p className="move-live" role="status">
        <span className={'move-live-dot ' + watch} aria-hidden="true"/>
        {watch === 'watching' ? (ago === null ? 'Checking Sui Mainnet…' : `Watching · checked ${ago < 5 ? 'just now' : ago + ' s ago'}`) : watch === 'paused' ? 'Paused after 10 minutes.' : watch === 'importing' ? 'Importing your last 30 days first…' : 'Import your history to start watching.'}
      </p>
      {(watch === 'paused' || watch === 'needs_import') && <button className="button small" onClick={() => watch === 'paused' ? setWatch('watching') : void importThenWatch()}><RefreshCw size={14} aria-hidden="true"/>{watch === 'paused' ? 'Keep watching' : 'Import and watch'}</button>}
      {note && <p className="read-inline-error" role="alert">{note}</p>}
      {arrivals.length ? <ul className="move-arrivals">{arrivals.map(m => <li key={m.id}><ArrowDownLeft size={16} aria-hidden="true"/><span><strong>+{exact(m.delta, m.coinType === SUI_TYPE ? 9 : 6)} {m.coinType === USDC_TYPE ? 'USDC' : 'SUI'}</strong>{m.counterparty ? ` from ${short(m.counterparty)}` : ''}</span></li>)}</ul>
      : <p className="micro">Payments that arrive while this page is open appear here and in Activity, and your balance updates.</p>}
      <BalanceAside state={state}/>
    </aside>
  </div>;
}
