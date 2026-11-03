'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Download, LogOut } from 'lucide-react';
import { api } from './http';
import type { AccountState } from '@/domain/state';
import { READ_ONLY_WALLET_CONSENT_VERSION, OPERATOR_MANAGED_CONSENT_VERSION } from '@/domain/consent';

// Auto-lock, the way wallet extensions do it: after a chosen time without activity the session is signed out and
// the next visit needs a fresh wallet signature. Activity is shared across tabs through localStorage. The server
// separately ends any session idle for 60 minutes and every session after 24 hours.
const LOCK_KEY = 'sm-lock-minutes', ACTIVE_KEY = 'sm-last-active';
export const LOCK_CHOICES = [5, 15, 30, 60] as const;
export function lockMinutes() { try { const v = Number(localStorage.getItem(LOCK_KEY)); return (LOCK_CHOICES as readonly number[]).includes(v) ? v : 15; } catch { return 15; } }
export function markActive() { try { localStorage.setItem(ACTIVE_KEY, String(Date.now())); } catch { /* Private mode: the server's idle limit still applies. */ } }
function lastActive() { try { return Number(localStorage.getItem(ACTIVE_KEY)) || 0; } catch { return 0; } }

export function useAutoLock(active: boolean, onLock: (minutes: number) => void) {
  useEffect(() => {
    if (!active) return;
    const idle = () => { const last = lastActive(), minutes = lockMinutes(); return last > 0 && Date.now() - last > minutes * 60000 ? minutes : 0; };
    // Coming back to a tab (or a restored browser) after the lock time locks at once.
    const opened = idle(); if (opened) { onLock(opened); return; }
    markActive();
    let marked = Date.now();
    const activity = () => { if (Date.now() - marked > 5000) { marked = Date.now(); markActive(); } };
    const check = () => { const minutes = idle(); if (minutes) onLock(minutes); };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, activity, { passive: true }));
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, 15000);
    return () => { events.forEach(e => window.removeEventListener(e, activity)); document.removeEventListener('visibilitychange', check); clearInterval(timer); };
  }, [active, onLock]);
}

type Theme = 'system' | 'light' | 'dark';
function applyTheme(choice: Theme) {
  try { if (choice === 'system') localStorage.removeItem('sm-theme'); else localStorage.setItem('sm-theme', choice); } catch { /* Not remembered, still applied. */ }
  document.documentElement.dataset.theme = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
}
function savedTheme(): Theme { try { const t = localStorage.getItem('sm-theme'); return t === 'light' || t === 'dark' ? t : 'system'; } catch { return 'system'; } }

type Props = { state: AccountState; features: { labels: boolean; moves: boolean; planning: boolean }; onSignOut: () => void; onSignOutEverywhere: () => void };
export function Settings({ state, features, onSignOut, onSignOutEverywhere }: Props) {
  // Settings only renders in the browser after the account loads, so local choices can be read on first render.
  const [minutes, setMinutes] = useState(lockMinutes), [theme, setTheme] = useState<Theme>(savedTheme), [copied, setCopied] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const consent = state.profile.consentVersion;
  const walletAccess = consent === READ_ONLY_WALLET_CONSENT_VERSION || consent === OPERATOR_MANAGED_CONSENT_VERSION, memory = consent === OPERATOR_MANAGED_CONSENT_VERSION;

  function chooseLock(value: number) { setMinutes(value); try { localStorage.setItem(LOCK_KEY, String(value)); } catch { /* Falls back to 15 minutes. */ } markActive(); }
  async function copy() { try { await navigator.clipboard.writeText(state.profile.wallet); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setError('Couldn’t copy automatically. Select the address and copy it.'); } }
  async function download() {
    setBusy('export'); setError('');
    try {
      const data = await api('/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `sui-money-${state.profile.wallet.slice(0, 8)}-${state.today}.json`; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }

  return <div className="settings">
    {error && <p className="read-inline-error" role="alert">{error}</p>}
    <section className="settings-row" aria-labelledby="settings-wallet">
      <div className="settings-label"><h2 id="settings-wallet">Wallet</h2><p>The wallet you signed in with. Every send is approved in this wallet; Sui Money never holds its keys.</p></div>
      <div className="card settings-panel">
        <div className="move-copy"><code>{state.profile.wallet}</code><button className="button" onClick={copy}>{copied ? <Check size={15} aria-hidden="true"/> : <Copy size={15} aria-hidden="true"/>}{copied ? 'Copied' : 'Copy'}</button></div>
        <dl className="settings-facts"><div><dt>Network</dt><dd>Sui Mainnet</dd></div><div><dt>Time zone</dt><dd>{state.profile.timezone} <Link className="text-link" href="/plan">Change in Plan</Link></dd></div></dl>
      </div>
    </section>

    <section className="settings-row" aria-labelledby="settings-security">
      <div className="settings-label"><h2 id="settings-security">Security</h2><p>Like a wallet, Sui Money locks itself. Signing back in takes one wallet signature, with no fee.</p></div>
      <div className="card settings-panel">
        <fieldset className="settings-choice"><legend>Lock after no activity for</legend>
          <div className="read-filters" role="group" aria-label="Auto-lock time">{LOCK_CHOICES.map(m => <button key={m} type="button" className={'read-filter' + (minutes === m ? ' active' : '')} aria-pressed={minutes === m} onClick={() => chooseLock(m)}>{m === 60 ? '1 hour' : `${m} min`}</button>)}</div>
        </fieldset>
        <ul className="settings-notes"><li>Closing the browser signs you out.</li><li>Switching or disconnecting your wallet signs you out.</li><li>Every sign-in ends after 24 hours, even while in use.</li></ul>
        <div className="move-actions">
          <button className="button" onClick={onSignOut}><LogOut size={15} aria-hidden="true"/>Sign out</button>
          <button className="button" disabled={busy === 'all'} onClick={() => { setBusy('all'); onSignOutEverywhere(); }}>{busy === 'all' ? 'Signing out…' : 'Sign out on every device'}</button>
        </div>
      </div>
    </section>

    <section className="settings-row" aria-labelledby="settings-appearance">
      <div className="settings-label"><h2 id="settings-appearance">Appearance</h2><p>Saved on this device.</p></div>
      <div className="card settings-panel">
        <fieldset className="settings-choice"><legend>Theme</legend>
          <div className="read-filters" role="group" aria-label="Theme">{(['system', 'light', 'dark'] as Theme[]).map(t => <button key={t} type="button" className={'read-filter' + (theme === t ? ' active' : '')} aria-pressed={theme === t} onClick={() => { setTheme(t); applyTheme(t); }}>{t === 'system' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}</button>)}</div>
        </fieldset>
      </div>
    </section>

    <section className="settings-row" aria-labelledby="settings-data">
      <div className="settings-label"><h2 id="settings-data">Data and privacy</h2><p>What you’ve agreed to, and a copy of everything Sui Money keeps for this wallet.</p></div>
      <div className="card settings-panel">
        <dl className="settings-facts">
          <div><dt>Wallet data access</dt><dd><span className={'move-state ' + (walletAccess ? 'confirmed' : '')}>{walletAccess ? 'Agreed' : 'Not yet'}</span></dd></div>
          <div><dt>Walrus Memory for labels{features.planning ? ' and plans' : ''}</dt><dd><span className={'move-state ' + (memory ? 'confirmed' : '')}>{memory ? 'Agreed' : 'Not yet'}</span></dd></div>
          <div><dt>Features on for this app</dt><dd>{['Balance and activity', features.labels && 'Labels', features.moves && 'Send and receive', features.planning && 'Plan'].filter(Boolean).join(', ')}</dd></div>
        </dl>
        <p className="micro">Walrus storage can’t be erased on request. Changes are saved as new versions.</p>
        <div className="move-actions">
          <button className="button" disabled={busy === 'export'} onClick={() => void download()}><Download size={15} aria-hidden="true"/>{busy === 'export' ? 'Preparing…' : 'Download my data'}</button>
          <Link className="button" href="/about">About and privacy</Link>
        </div>
      </div>
    </section>
  </div>;
}
