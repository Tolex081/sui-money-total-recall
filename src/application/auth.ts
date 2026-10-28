import { randomUUID } from 'node:crypto';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { parseSerializedSignature } from '@mysten/sui/cryptography';
import { database, transaction } from '@/adapters/postgres/client';
import { canonicalAddress } from '@/adapters/tatum/chain';
import { AppError, hash, namespaceFor, token, equalSecret } from '@/lib/security';
import { required } from '@/lib/config';
export const CONSENT_VERSION = 'operator-managed-v1';
export type Profile = { id: string; wallet: string; namespace: string; timezone: string; consent_version: string | null };
export function challengeMessage(input: { origin: string; wallet: string; nonce: string; issued: string; expires: string }) {
  return ['Sign in to Sui Money',`Origin: ${input.origin}`, 'Network: Sui Mainnet', `Wallet: ${input.wallet}`,`Nonce: ${input.nonce}`,`Issued: ${input.issued}`,`Expires: ${input.expires}`,'This verifies your identity. It does not authorize a payment or transaction.'].join('\n');
}
export async function issueChallenge(walletInput: string) {
  const wallet = canonicalAddress(walletInput), nonce = token(), id = randomUUID(), origin = new URL(required('APP_ORIGIN')).origin;
  const issued = new Date(), expires = new Date(issued.getTime()+300000);
  const message = challengeMessage({ origin,wallet,nonce,issued:issued.toISOString(),expires:expires.toISOString() });
  await database().query('INSERT INTO auth_challenges(id,wallet,nonce_hash,origin,message,message_hash,issued_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,wallet,hash(nonce),origin,message,hash(message),issued,expires]);
  return { id, message, expiresAt: expires.toISOString() };
}
export async function verifyChallenge(input: { id: string; wallet: string; signature: string }, oldToken?: string) {
  const wallet = canonicalAddress(input.wallet);
  return transaction(async db => {
    const result = await db.query('SELECT * FROM auth_challenges WHERE id=$1 FOR UPDATE',[input.id]);
    const challenge = result.rows[0];
    if (!challenge || challenge.used_at || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.wallet !== wallet || challenge.origin !== new URL(required('APP_ORIGIN')).origin || hash(challenge.message) !== challenge.message_hash) throw new AppError('CHALLENGE_INVALID',401,'Sign-in challenge is invalid or expired. Start again.');
    let scheme:string;
    try{scheme=parseSerializedSignature(input.signature).signatureScheme;}catch{throw new AppError('SIGNATURE_INVALID',401,'Malformed wallet signature.');}
    if(!['ED25519','Secp256k1','Secp256r1','Passkey'].includes(scheme))throw new AppError('SIGNATURE_SCHEME_UNSUPPORTED',400,'This signature scheme is not enabled yet. Use a supported personal-message signing account.');
    try { const publicKey = await verifyPersonalMessageSignature(new TextEncoder().encode(challenge.message),input.signature,{address:wallet}); if (canonicalAddress(publicKey.toSuiAddress()) !== wallet) throw new Error('Signer mismatch'); }
    catch { throw new AppError('SIGNATURE_INVALID',401,'The signature could not be verified for this wallet.'); }
    await db.query('UPDATE auth_challenges SET used_at=now() WHERE id=$1',[input.id]);
    let profile = (await db.query<Profile>('SELECT * FROM profiles WHERE wallet=$1',[wallet])).rows[0];
    if (!profile) { const profileId=randomUUID(); profile=(await db.query<Profile>('INSERT INTO profiles(id,wallet,namespace) VALUES($1,$2,$3) ON CONFLICT(wallet) DO UPDATE SET wallet=EXCLUDED.wallet RETURNING *',[profileId,wallet,namespaceFor(profileId)])).rows[0]; }
    if (oldToken) await db.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1',[hash(oldToken)]);
    const sessionToken = token(), csrf = token();
    await db.query('INSERT INTO sessions(token_hash,profile_id,csrf_hash,expires_at) VALUES($1,$2,$3,now()+interval \'7 days\')',[hash(sessionToken),profile.id,hash(csrf)]);
    return { profile, sessionToken, csrf };
  });
}
function cookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
}
export const sessionCookie = (request: Request) => cookie(request,'sm_session');
export async function authenticate(request: Request, mutating=false, allowWalletMismatch=false) {
  const raw = sessionCookie(request);
  if (!raw || raw.length>100) throw new AppError('UNAUTHORIZED',401,'Connect your wallet and sign in to open your account.');
  const {rows} = await database().query<Profile & {csrf_hash:string}>(`SELECT p.*,s.csrf_hash FROM sessions s JOIN profiles p ON p.id=s.profile_id WHERE s.token_hash=$1 AND s.expires_at>now() AND s.revoked_at IS NULL`,[hash(raw)]);
  const profile = rows[0];
  if (!profile) throw new AppError('UNAUTHORIZED',401,'Your session has expired. Sign in again.');
  const connected=request.headers.get('x-wallet-address');
  if(!allowWalletMismatch&&connected&&canonicalAddress(connected)!==profile.wallet)throw new AppError('WALLET_CHANGED',401,'Your connected wallet changed. Sign in again for the selected wallet.');
  if (mutating && (!request.headers.get('x-csrf-token') || !equalSecret(hash(request.headers.get('x-csrf-token')!),profile.csrf_hash))) throw new AppError('CSRF_REJECTED',403,'Refresh this page and try again.');
  return profile;
}
export async function revoke(request: Request) { const raw = sessionCookie(request); if(raw) await database().query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1',[hash(raw)]); }
