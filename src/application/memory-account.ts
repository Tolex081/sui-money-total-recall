import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { database, transaction } from '@/adapters/postgres/client';
import { WalrusMemory, type MemoryCredentials } from '@/adapters/memwal/memory';
import { AppError } from '@/lib/security';
import { TatumChain } from '@/adapters/tatum/chain';
import { chainReadBudget } from '@/lib/rate-limit';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, normalizeSuiAddress, toBase64 } from '@mysten/sui/utils';
import type { Profile } from './auth';

// Bring your own memory account.
//
// Default: memories live in Sui Money's operator Walrus Memory account, one namespace per profile. That means the
// app, not the user, holds the account. Here the user's own wallet creates a Walrus Memory account on-chain (they
// own the object) and adds a delegate key that Sui Money generated for them. From then on new memories are written
// to the user's account. The user can remove Sui Money's key from that account with their wallet at any time, and
// give any other app its own key: the memory is theirs and portable.
//
// The delegate private key is encrypted at rest (AES-256-GCM) and never leaves the server. Each memory job records
// which account it was written to, so it is always verified against that same account.

export type OwnerMode = 'operator' | 'pending' | 'user';
type OwnerRow = { memory_owner: OwnerMode; memory_account_id: string | null; memory_delegate_public: string | null; memory_delegate_secret: string | null; memory_owner_changed_at: string | null };

export function ownershipConfig() {
  const packageId = process.env.MEMWAL_PACKAGE_ID?.trim(), registryId = process.env.MEMWAL_REGISTRY_ID?.trim(), secret = process.env.MEMWAL_DELEGATE_ENCRYPTION_SECRET?.trim();
  return { enabled: !!packageId && !!registryId && !!secret && secret.length >= 32, packageId: packageId ?? null, registryId: registryId ?? null };
}

function key() {
  const secret = process.env.MEMWAL_DELEGATE_ENCRYPTION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new AppError('MEMORY_OWNERSHIP_DISABLED', 503, 'Own memory accounts are not switched on for this app yet.');
  return createHash('sha256').update('sui-money/delegate-key/v1\0' + secret).digest();
}
export function sealSecret(plain: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(b => b.toString('base64url')).join('.');
}
export function openSecret(sealed: string) {
  const [iv, tag, body] = sealed.split('.').map(s => Buffer.from(s, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

async function ownerRow(profileId: string): Promise<OwnerRow> {
  const row = (await database().query<OwnerRow>('SELECT memory_owner,memory_account_id,memory_delegate_public,memory_delegate_secret,memory_owner_changed_at FROM profiles WHERE id=$1', [profileId])).rows[0];
  if (!row) throw new AppError('NOT_FOUND', 404, 'Profile not found.');
  return row;
}

// What the browser may see: never the secret.
export async function memoryOwnership(profile: Profile) {
  const row = await ownerRow(profile.id), config = ownershipConfig();
  const counts = (await database().query<{ operator: string; own: string }>("SELECT count(*) FILTER (WHERE account_id IS NULL) AS operator, count(*) FILTER (WHERE account_id IS NOT NULL) AS own FROM memory_jobs WHERE profile_id=$1 AND state='recall_confirmed'", [profile.id])).rows[0];
  return { mode: row.memory_owner, accountId: row.memory_account_id, delegatePublicKey: row.memory_owner === 'operator' ? null : row.memory_delegate_public, changedAt: row.memory_owner_changed_at, available: config.enabled, packageId: config.packageId, registryId: config.registryId, namespace: profile.namespace, memoriesInOperatorAccount: Number(counts?.operator ?? 0), memoriesInOwnAccount: Number(counts?.own ?? 0) };
}

// Step 1: Sui Money makes a fresh delegate key for this user. The browser receives only its public half, to add to
// the user's account in a transaction their wallet signs.
export async function startOwnership(profile: Profile) {
  const config = ownershipConfig();
  if (!config.enabled) throw new AppError('MEMORY_OWNERSHIP_DISABLED', 503, 'Own memory accounts are not switched on for this app yet.');
  const { generateDelegateKey } = await import('@mysten-incubation/memwal/account');
  const delegate = await generateDelegateKey();
  const publicKey = Buffer.from(delegate.publicKey).toString('hex');
  await transaction(async db => {
    const row = (await db.query<OwnerRow>('SELECT memory_owner FROM profiles WHERE id=$1 FOR UPDATE', [profile.id])).rows[0];
    if (row?.memory_owner === 'user') throw new AppError('ALREADY_OWNED', 409, 'Your memory already lives in your own account.');
    await db.query("UPDATE profiles SET memory_owner='pending',memory_delegate_public=$2,memory_delegate_secret=$3,memory_owner_changed_at=now() WHERE id=$1", [profile.id, publicKey, sealSecret(delegate.privateKey)]);
  });
  return { publicKey, delegateAddress: delegate.suiAddress, packageId: config.packageId, registryId: config.registryId, label: 'Sui Money' };
}

// Step 2: the user says which account they added the key to. We prove the key works there by making an
// authenticated read with it; the relayer only answers for a delegate key registered on that account. Only this
// signed-in user ever received the public key, so only the owner of that account could have registered it.
export const confirmInput = z.object({ accountId: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Enter the 0x… ID of your Walrus Memory account.') }).strict();
export async function confirmOwnership(profile: Profile, raw: unknown, probe: (memory: WalrusMemory) => Promise<unknown> = m => m.metadataPage()) {
  const { accountId } = confirmInput.parse(raw);
  const row = await ownerRow(profile.id);
  if (row.memory_owner !== 'pending' || !row.memory_delegate_secret) throw new AppError('NOT_PENDING', 409, 'Start again: create a new key first.');
  const credentials: MemoryCredentials = { accountId: accountId.toLowerCase(), delegateKey: openSecret(row.memory_delegate_secret) };
  try { await probe(new WalrusMemory(profile.namespace, credentials)); }
  catch { throw new AppError('DELEGATE_NOT_AUTHORIZED', 409, 'Walrus Memory did not accept Sui Money’s key for that account yet. Check the key was added, then try again in a minute.', true); }
  await database().query("UPDATE profiles SET memory_owner='user',memory_account_id=$2,memory_owner_changed_at=now() WHERE id=$1 AND memory_owner='pending'", [profile.id, credentials.accountId]);
  return memoryOwnership(profile);
}

// Going back to the shared account. Memories already written to the user's account stay there, in their account;
// Sui Money forgets its key, so it can no longer read them. The user should also remove the key on-chain.
export async function leaveOwnership(profile: Profile) {
  await database().query("UPDATE profiles SET memory_owner='operator',memory_delegate_secret=NULL,memory_owner_changed_at=now() WHERE id=$1", [profile.id]);
  return memoryOwnership(profile);
}

// The on-chain steps, built on the server through Tatum (the browser never reads the chain) and signed by the
// user's own wallet, exactly like a send: 'create' makes the user's Walrus Memory account (one per address), and
// 'add_key' adds Sui Money's delegate key to it.
const SUI_CLOCK = '0x6';
const accountTxInput = z.discriminatedUnion('action', [z.object({ action: z.literal('create') }).strict(), z.object({ action: z.literal('add_key'), accountId: confirmInput.shape.accountId }).strict()]);
export async function prepareAccountTransaction(profile: Profile, raw: unknown) {
  const input = accountTxInput.parse(raw), config = ownershipConfig();
  if (!config.enabled) throw new AppError('MEMORY_OWNERSHIP_DISABLED', 503, 'Own memory accounts are not switched on for this app yet.');
  const row = await ownerRow(profile.id);
  if (input.action === 'add_key' && (row.memory_owner !== 'pending' || !row.memory_delegate_public)) throw new AppError('NOT_PENDING', 409, 'Start again: create a new key first.');
  const chain = new TatumChain(async () => { await chainReadBudget(profile.id); });
  try {
    const built = await chain.buildCall(profile.wallet, tx => {
      if (input.action === 'create') tx.moveCall({ target: `${config.packageId}::account::create_account`, arguments: [tx.object(config.registryId!), tx.object(SUI_CLOCK)] });
      else tx.moveCall({ target: `${config.packageId}::account::add_delegate_key`, arguments: [tx.object(input.accountId), tx.object(config.registryId!), tx.pure.vector('u8', [...Buffer.from(row.memory_delegate_public!, 'hex')]), tx.pure.string('Sui Money'), tx.object(SUI_CLOCK)] });
    }).catch(() => { throw new AppError('ACCOUNT_TX_BUILD_FAILED', 503, 'Couldn’t prepare this step right now. Nothing was changed; try again shortly. You need a little SUI for the network fee.', true); });
    return { action: input.action, transaction: built.json };
  } finally { chain.close(); }
}

// The signed transaction must be exactly one call to the expected Walrus Memory function, sent by this wallet,
// and (for add_key) carry Sui Money's public key for this user. Anything else is refused before it reaches Sui.
const submitAccountInput = z.object({ action: z.enum(['create', 'add_key']), bytes: z.string().max(20000), signature: z.string().max(12000) }).strict();
export async function submitAccountTransaction(profile: Profile, raw: unknown) {
  const input = submitAccountInput.parse(raw), config = ownershipConfig();
  if (!config.enabled) throw new AppError('MEMORY_OWNERSHIP_DISABLED', 503, 'Own memory accounts are not switched on for this app yet.');
  const bytes = fromBase64(input.bytes), data = Transaction.from(bytes).getData();
  const call = data.commands.length === 1 ? data.commands[0].MoveCall : null;
  const fn = input.action === 'create' ? 'create_account' : 'add_delegate_key';
  const ok = !!call && data.sender && normalizeSuiAddress(data.sender) === normalizeSuiAddress(profile.wallet) && normalizeSuiAddress(call.package) === normalizeSuiAddress(config.packageId!) && call.module === 'account' && call.function === fn;
  const row = await ownerRow(profile.id);
  const expectedKey = input.action === 'add_key' && row.memory_delegate_public ? toBase64(Uint8Array.from([32, ...Buffer.from(row.memory_delegate_public, 'hex')])) : null;
  if (!ok || (expectedKey && !data.inputs.some(i => i.Pure?.bytes === expectedKey))) throw new AppError('ACCOUNT_TX_MISMATCH', 400, 'Your wallet signed a different transaction from the one prepared. Nothing was changed.');
  const chain = new TatumChain(async () => { await chainReadBudget(profile.id); });
  try {
    const result = await chain.executeCreating(bytes, input.signature, '::account::MemWalAccount');
    if (!result.success) throw new AppError('ACCOUNT_TX_FAILED', 409, input.action === 'create' ? 'Sui rejected this. Each wallet can create one Walrus Memory account; if you already have one, use its ID instead.' : 'Sui rejected adding the key. Nothing was changed.');
    return { action: input.action, digest: result.digest, accountId: input.action === 'create' ? result.created[0] ?? null : null };
  } finally { chain.close(); }
}

// The account a NEW memory is written to.
export async function walrusForWrite(profile: Profile) {
  const row = await ownerRow(profile.id);
  if (row.memory_owner === 'user' && row.memory_account_id && row.memory_delegate_secret) return new WalrusMemory(profile.namespace, { accountId: row.memory_account_id, delegateKey: openSecret(row.memory_delegate_secret) });
  return new WalrusMemory(profile.namespace);
}

// The account an EXISTING memory was written to (null: the operator account).
export async function walrusForAccount(profile: Profile, accountId: string | null) {
  if (!accountId) return new WalrusMemory(profile.namespace);
  const row = await ownerRow(profile.id);
  if (row.memory_account_id !== accountId || !row.memory_delegate_secret) throw new AppError('MEMORY_ACCOUNT_DISCONNECTED', 409, 'This memory is in your own Walrus Memory account, which Sui Money is no longer connected to.');
  return new WalrusMemory(profile.namespace, { accountId, delegateKey: openSecret(row.memory_delegate_secret) });
}
