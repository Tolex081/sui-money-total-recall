'use client';
import { useCallback, useEffect, useState } from 'react';
import { DAppKitProvider, useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { KeyRound, ShieldCheck, Users } from 'lucide-react';
import { api } from './http';
import { dAppKit } from './wallet';
import { walletMessage } from './wallet-errors';

type Ownership = { mode: 'operator' | 'pending' | 'user'; accountId: string | null; delegatePublicKey: string | null; available: boolean; namespace: string; memoriesInOperatorAccount: number; memoriesInOwnAccount: number };
const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-6)}`;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export function MemoryOwnership() {
  return <DAppKitProvider dAppKit={dAppKit}><OwnershipPanel/></DAppKitProvider>;
}

// Where this user's memory lives, and moving it into a Walrus Memory account their own wallet owns.
function OwnershipPanel() {
  const account = useCurrentAccount(), kit = useDAppKit(dAppKit);
  const [status, setStatus] = useState<Ownership | null>(null), [step, setStep] = useState(''), [error, setError] = useState(''), [existing, setExisting] = useState(''), [choosing, setChoosing] = useState(false);
  const load = useCallback(async () => { try { setStatus(await api<Ownership>('/memory-account')); } catch (e) { setError((e as Error).message); } }, []);
  useEffect(() => {
    let live = true;
    api<Ownership>('/memory-account').then(s => { if (live) setStatus(s); }).catch(e => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, []);

  async function signStep(action: 'create' | 'add_key', accountId?: string) {
    const prepared = await api<{ transaction: string }>('/memory-account/transaction', action === 'create' ? { action } : { action, accountId });
    let signed: { bytes: string; signature: string };
    try { signed = await kit.signTransaction({ transaction: prepared.transaction }); } catch (e) { throw new Error(walletMessage(e)); }
    return api<{ accountId: string | null; digest: string }>('/memory-account/submit', { action, ...signed });
  }

  async function move(existingId: string | null) {
    setError('');
    try {
      setStep('Making a key for Sui Money…'); await api('/memory-account/start', {});
      let accountId = existingId;
      if (!accountId) { setStep('Approve creating your memory account in your wallet…'); accountId = (await signStep('create')).accountId; }
      if (!accountId) throw new Error('Your account was created, but its ID wasn’t returned. Find it in your wallet’s objects and use “I already have one”.');
      setStep('Approve adding Sui Money’s key in your wallet…'); await signStep('add_key', accountId);
      setStep('Checking Walrus Memory accepts the key…');
      for (let i = 0; ; i++) {
        try { setStatus(await api<Ownership>('/memory-account/confirm', { accountId })); break; }
        catch (e) { if (i >= 5) throw e; await wait(4000); }
      }
      setChoosing(false);
    } catch (e) { setError((e as Error).message); void load(); } finally { setStep(''); }
  }

  async function leave() {
    setError(''); setStep('Switching back…');
    try { setStatus(await api<Ownership>('/memory-account/leave', {})); } catch (e) { setError((e as Error).message); } finally { setStep(''); }
  }

  if (!status) return <p className="micro">{error || 'Checking where your memory lives…'}</p>;
  const own = status.mode === 'user' && status.accountId;
  return <div className="ownership">
    <div className={'ownership-now' + (own ? ' owned' : '')}>
      {own ? <ShieldCheck size={20} aria-hidden="true"/> : <Users size={20} aria-hidden="true"/>}
      <div>
        <p><b>{own ? 'Your own Walrus Memory account' : 'Sui Money’s shared account'}</b></p>
        <p className="micro">{own
          ? <>Account <code title={status.accountId!}>{short(status.accountId!)}</code>, owned by your wallet. New memories are written here. Remove Sui Money’s key from it with your wallet at any time, and give other apps their own keys.</>
          : <>Your memories sit in a private namespace (<code>{status.namespace.slice(0, 12)}…</code>) inside an account Sui Money holds. Sui Money can read them; you can’t take them to another app.</>}</p>
        <p className="micro">{status.memoriesInOwnAccount} {status.memoriesInOwnAccount === 1 ? 'memory' : 'memories'} in your account · {status.memoriesInOperatorAccount} in the shared account</p>
      </div>
    </div>
    {error && <p className="read-inline-error" role="alert">{error}</p>}
    {step && <p className="micro" role="status">{step}</p>}
    {!status.available && !own && <p className="micro">Moving to your own account isn’t switched on for this app yet.</p>}
    {status.available && !own && !step && (!choosing
      ? <div className="move-actions"><button className="button primary" disabled={!account} title={account ? undefined : 'Connect your wallet first'} onClick={() => setChoosing(true)}><KeyRound size={15} aria-hidden="true"/>Move to my own account</button></div>
      : <div className="ownership-choice">
          <p className="micro">Two wallet approvals with a small SUI network fee: create your account, then add Sui Money’s key. Memories already saved stay readable where they are.</p>
          <div className="move-actions">
            <button className="button primary" onClick={() => void move(null)}>Create my account</button>
            <button className="button" onClick={() => setChoosing(false)}>Cancel</button>
          </div>
          <form className="ownership-existing" onSubmit={e => { e.preventDefault(); void move(existing.trim()); }}>
            <label><span>I already have one: account ID</span><input value={existing} onChange={e => setExisting(e.target.value)} placeholder="0x…" spellCheck={false}/></label>
            <button className="button" type="submit" disabled={!/^0x[0-9a-fA-F]{64}$/.test(existing.trim())}>Use this account</button>
          </form>
        </div>)}
    {own && !step && <div className="move-actions"><button className="button" onClick={() => void leave()}>Stop using my account</button></div>}
  </div>;
}
