'use client';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Movement } from '@/domain/types';
import { api } from './http';

type Proof = { checkedAt: string; digest: string; tatum: { checkpoint: string; status: string } | null; verdict: 'matches' | 'differs' | 'not_found'; differences: string[] };

// Per-payment Tatum proof, the counterpart of a memory's Walrus proof: what Sui Money saved from Tatum, and a button
// that asks Tatum's Sui Mainnet gateway for the same transaction again and compares the two. Read-only.
export function TatumProof({ movement, timezone }: { movement: Movement; timezone: string }) {
  const [proof, setProof] = useState<Proof | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!movement.digest) return null;
  const time = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: timezone }).format(new Date(iso)).replace('Sept', 'Sep');
  async function check() {
    setBusy(true); setError('');
    try { setProof(await api<Proof>('/activity/' + encodeURIComponent(movement.id) + '/tatum-proof', {})); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <details className="tatum-proof">
    <summary>Tatum proof</summary>
    <dl>
      <div><dt>Read from</dt><dd>Tatum · Sui Mainnet gateway</dd></div>
      <div><dt>Transaction</dt><dd className="break-all"><a className="text-link" href={`https://suiscan.xyz/mainnet/tx/${movement.digest}`} target="_blank" rel="noreferrer">{movement.digest.slice(0, 10)}…{movement.digest.slice(-6)}<span className="sr-only"> on Suiscan (opens in a new tab)</span></a></dd></div>
      <div><dt>Checkpoint</dt><dd>{movement.checkpoint}</dd></div>
      <div><dt>Result</dt><dd>{movement.status === 'success' ? 'Confirmed on Sui' : 'Failed, no money moved'}</dd></div>
    </dl>
    <div className="tatum-proof-actions">
      <button type="button" className="button small" disabled={busy} onClick={() => void check()}><ShieldCheck size={14} aria-hidden="true"/>{busy ? 'Asking Tatum…' : 'Check with Tatum'}</button>
      <span role="status" className={'tatum-proof-result ' + (proof?.verdict ?? '')}>
        {proof && (proof.verdict === 'matches'
          ? `Confirmed by Tatum at ${time(proof.checkedAt)} · checkpoint ${proof.tatum?.checkpoint} · matches`
          : proof.verdict === 'not_found' ? 'Tatum did not return this transaction.' : `Tatum's answer differs: ${proof.differences.join('; ')}`)}
      </span>
    </div>
    {error && <p className="read-inline-error" role="alert">{error}</p>}
  </details>;
}
