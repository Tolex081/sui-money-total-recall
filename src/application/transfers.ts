import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Transaction, TransactionDataBuilder } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { database, transaction } from '@/adapters/postgres/client';
import { TatumChain, canonicalAddress } from '@/adapters/tatum/chain';
import { chainReadBudget, consumeLimits } from '@/lib/rate-limit';
import { AppError, hash } from '@/lib/security';
import { units, USDC_TYPE } from '@/domain/money';
import { saveMovements } from './sync';
import type { Profile } from './auth';

// A send has four states the user can see: prepared (built, waiting for the wallet), submitted (signed and handed
// to Sui), confirmed (read back from the chain and added to history) or failed. The server never holds a key:
// it builds through Tatum, the user's wallet signs, and the server submits the signed bytes through Tatum.
const PREPARED_TTL_MS = 10 * 60 * 1000;
const prepareInput = z.object({ recipient: z.string().trim().max(80), amount: z.string().trim().max(40) }).strict();
const submitInput = z.object({ bytes: z.string().max(20000), signature: z.string().max(12000) }).strict();
export type TransferView = { id: string; recipient: string; amount: string; state: string; digest: string | null; errorCode: string | null; createdAt: string };
const view = (r: Record<string, unknown>): TransferView => ({ id: r.id as string, recipient: r.recipient as string, amount: String(r.amount), state: r.state as string, digest: (r.digest as string | null) ?? null, errorCode: (r.error_code as string | null) ?? null, createdAt: new Date(r.created_at as string).toISOString() });
const chainFor = (profile: Profile) => new TatumChain(async () => { await chainReadBudget(profile.id); });

function friendlyBuildError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const text = error instanceof Error ? error.message : String(error);
  if (/insufficient|not enough|balance/i.test(text) && /gas|sui/i.test(text)) throw new AppError('INSUFFICIENT_GAS', 400, 'You need a little SUI in this wallet to pay the network fee.');
  if (/insufficient|not enough|balance/i.test(text)) throw new AppError('INSUFFICIENT_FUNDS', 400, 'This wallet doesn’t hold enough USDC for that amount.');
  throw new AppError('TRANSFER_BUILD_FAILED', 503, 'Sui Money couldn’t prepare this send right now. Nothing was sent; try again shortly.', true);
}

export async function prepareTransfer(profile: Profile, input: unknown) {
  const data = prepareInput.parse(input);
  let recipient: string;
  try { recipient = canonicalAddress(data.recipient); } catch { throw new AppError('RECIPIENT_INVALID', 400, 'That isn’t a valid Sui address. Check it and paste it again.'); }
  if (recipient === profile.wallet) throw new AppError('RECIPIENT_SELF', 400, 'That’s this wallet’s own address. Enter the address you want to pay.');
  let amount: bigint;
  try { amount = units(data.amount); } catch (e) { throw new AppError('AMOUNT_INVALID', 400, (e as Error).message); }
  if (amount <= 0n) throw new AppError('AMOUNT_INVALID', 400, 'Enter an amount above zero.');
  await consumeLimits([{ key: `transfer:prepare:${profile.id}`, max: 6, seconds: 60 }]);
  const chain = chainFor(profile);
  try {
    const built = await chain.buildUsdcTransfer(profile.wallet, recipient, amount).catch(friendlyBuildError);
    const id = randomUUID();
    await database().query('INSERT INTO transfers(profile_id,id,recipient,amount,coin_type,tx_bytes_hash,tx_json,state) VALUES($1,$2,$3,$4,$5,$6,$7,\'prepared\')', [profile.id, id, recipient, amount.toString(), USDC_TYPE, hash(toBase64(built.bytes)), built.json]);
    return { id, recipient, amount: amount.toString(), transaction: built.json, gasBudget: built.gasBudget };
  } finally { chain.close(); }
}

// The wallet may re-serialize the transaction it was given. Accept that only when everything except the gas
// payment is unchanged, so the signed transaction still sends the prepared amount to the prepared address.
function sameIntent(preparedJson: string, signedBytes: Uint8Array) {
  const prepared = Transaction.from(preparedJson).getData(), signed = Transaction.from(signedBytes).getData();
  const intent = (d: typeof prepared) => JSON.stringify({ sender: d.sender, inputs: d.inputs, commands: d.commands, expiration: d.expiration }, (_, v) => typeof v === 'bigint' ? v.toString() : v);
  return intent(prepared) === intent(signed);
}

export async function submitTransfer(profile: Profile, id: string, input: unknown) {
  const data = submitInput.parse(input);
  let bytes: Uint8Array;
  try { bytes = fromBase64(data.bytes); } catch { throw new AppError('SIGNED_BYTES_INVALID', 400, 'The wallet returned an unreadable transaction. Nothing was sent.'); }
  const digest = TransactionDataBuilder.getDigestFromBytes(bytes);
  // Claim the send before submitting it, so a double click or a second tab can never submit it twice.
  const row = await transaction(async db => {
    const current = (await db.query('SELECT * FROM transfers WHERE profile_id=$1 AND id::text=$2 FOR UPDATE', [profile.id, id])).rows[0];
    if (!current) throw new AppError('NOT_FOUND', 404, 'Send not found.');
    if (current.state !== 'prepared') throw new AppError('TRANSFER_ALREADY_SUBMITTED', 409, 'This send was already submitted. Check its status instead.');
    if (Date.now() - new Date(current.created_at).getTime() > PREPARED_TTL_MS) { await db.query('UPDATE transfers SET state=\'expired\',updated_at=now() WHERE profile_id=$1 AND id=$2', [profile.id, current.id]); throw new AppError('TRANSFER_EXPIRED', 409, 'This send expired before it was signed. Nothing was sent; start again.'); }
    let matches = hash(data.bytes) === current.tx_bytes_hash;
    try { matches ||= sameIntent(current.tx_json, bytes); } catch { matches = false; }
    if (!matches) throw new AppError('TRANSFER_MISMATCH', 400, 'Your wallet signed a different transaction from the one prepared. Nothing was sent.');
    await db.query('UPDATE transfers SET state=\'submitted\',digest=$3,updated_at=now() WHERE profile_id=$1 AND id=$2', [profile.id, current.id, digest]);
    return current;
  });
  const chain = chainFor(profile);
  try {
    const result = await chain.execute(bytes, data.signature);
    if (!result.success) await database().query('UPDATE transfers SET state=\'failed\',error_code=\'EXECUTION_FAILED\',updated_at=now() WHERE profile_id=$1 AND id=$2', [profile.id, row.id]);
    return { id: row.id, digest, state: result.success ? 'submitted' : 'failed' };
  } catch {
    // The outcome is unknown: Sui may still have accepted it. Keep it submitted; confirm reads the digest.
    await database().query('UPDATE transfers SET error_code=\'SUBMISSION_OUTCOME_UNKNOWN\',updated_at=now() WHERE profile_id=$1 AND id=$2', [profile.id, row.id]);
    return { id: row.id, digest, state: 'submitted', outcomeUnknown: true };
  } finally { chain.close(); }
}

// Reads the submitted digest back through Tatum. Once it is in a checkpoint, its movements join the wallet history.
export async function confirmTransfer(profile: Profile, id: string) {
  const row = (await database().query('SELECT * FROM transfers WHERE profile_id=$1 AND id::text=$2', [profile.id, id])).rows[0];
  if (!row) throw new AppError('NOT_FOUND', 404, 'Send not found.');
  if (row.state !== 'submitted' || !row.digest) return view(row);
  const chain = chainFor(profile);
  try {
    let movements;
    try { movements = await chain.transaction(row.digest, profile.wallet); }
    catch (e) { if (e instanceof AppError && e.code === 'TATUM_RECORD_UNAVAILABLE' || (e as Error).message === 'TATUM_NOT_FOUND' || /TATUM_SHAPE:transaction/.test((e as Error).message)) return view(row); throw e; }
    await saveMovements(profile.id, movements);
    const failed = movements.some(m => m.status === 'failed');
    const updated = (await database().query('UPDATE transfers SET state=$3,error_code=$4,updated_at=now() WHERE profile_id=$1 AND id=$2 RETURNING *', [profile.id, row.id, failed ? 'failed' : 'confirmed', failed ? 'EXECUTION_FAILED' : null])).rows[0];
    const usdc = movements.find(m => m.coinType === USDC_TYPE);
    return { ...view(updated), movementId: usdc?.id ?? null };
  } finally { chain.close(); }
}

export async function recentTransfers(profile: Profile) {
  return (await database().query('SELECT * FROM transfers WHERE profile_id=$1 AND state<>\'prepared\' ORDER BY created_at DESC LIMIT 20', [profile.id])).rows.map(view);
}
