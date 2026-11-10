'use client';
import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

export type Receipt = { digest: string; direction: 'sent' | 'received'; amount: string; unit: string; date: string };
const suiscan = (digest: string) => `https://suiscan.xyz/mainnet/tx/${digest}`;
// Only what the chain already shows publicly: direction, amount, date and the transaction link. Never the label,
// the other party's address, or the wallet's own address in the text.
const receiptText = (r: Receipt) => `${r.direction === 'sent' ? 'Sent' : 'Received'} ${r.amount} ${r.unit} on Sui · ${r.date} · confirmed on Mainnet. Receipt via Sui Money:`;

// Share a payment receipt: on X, through the device's own share sheet, or by copying it.
export function ShareReceipt({ receipt }: { receipt: Receipt }) {
  const [copied, setCopied] = useState(false), [error, setError] = useState('');
  const url = suiscan(receipt.digest), text = receiptText(receipt);
  const xHref = 'https://x.com/intent/post?' + new URLSearchParams({ text, url }).toString();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  async function copy() {
    try { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setError(''); setTimeout(() => setCopied(false), 2500); }
    catch { setError('Couldn’t copy. Select the link and copy it yourself.'); }
  }
  async function nativeShare() { try { await navigator.share({ title: 'Sui Money receipt', text, url }); } catch { /* closed by the person: nothing to do */ } }
  return <details className="share-receipt">
    <summary><Share2 size={14} aria-hidden="true"/>Share receipt</summary>
    <div className="share-receipt-body">
      <p className="share-receipt-preview">{text} <span className="break-all">{url}</span></p>
      <div className="share-receipt-actions">
        <a className="button small" href={xHref} target="_blank" rel="noreferrer">Share on X<span className="sr-only"> (opens in a new tab)</span></a>
        {canShare && <button type="button" className="button small" onClick={() => void nativeShare()}>More apps…</button>}
        <button type="button" className="button small" onClick={() => void copy()}>{copied ? <><Check size={14} aria-hidden="true"/>Copied</> : <><Copy size={14} aria-hidden="true"/>Copy</>}</button>
      </div>
      <p className="micro">The link opens this transaction on Suiscan, where the amount and both wallet addresses are public. Your label isn’t shared.</p>
      {error && <p className="read-inline-error" role="alert">{error}</p>}
      <span className="sr-only" role="status">{copied ? 'Receipt copied.' : ''}</span>
    </div>
  </details>;
}
