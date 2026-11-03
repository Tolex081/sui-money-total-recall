import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, transaction } from '@/adapters/postgres/client';
import { AppError } from '@/lib/security';
import { units } from '@/domain/money';
import { safeText } from '@/domain/learning';
import { localToday } from '@/domain/planning';
import type { SuiBudget } from '@/domain/sui-budget';
import type { Profile } from './auth';

// The SUI budget is stored in the profile's database only. Unlike USDC rules it is not written to Walrus Memory.
const suiAmount = z.string().max(40).transform((s, ctx) => { try { return units(s.trim(), 9).toString(); } catch (e) { ctx.addIssue({ code: 'custom', message: (e as Error).message }); return z.NEVER; } });
const reserveInput = z.object({ reserve: suiAmount, version: z.number().int().nonnegative() }).strict();
const billInput = z.object({ alias: safeText, amount: suiAmount, startDate: z.iso.date(), frequency: z.enum(['once', 'weekly', 'monthly']) }).strict();
const paidInput = z.object({ date: z.iso.date() }).strict();

export async function suiBudget(profileId: string): Promise<SuiBudget> {
  const db = database();
  const row = (await db.query('SELECT reserve,version FROM sui_budgets WHERE profile_id=$1', [profileId])).rows[0];
  const bills = (await db.query('SELECT id,alias,amount,start_date,frequency,paid_dates FROM sui_bills WHERE profile_id=$1 AND NOT removed ORDER BY start_date,created_at', [profileId])).rows
    .map(r => ({ id: r.id as string, alias: r.alias as string, amount: String(r.amount), startDate: new Date(r.start_date).toISOString().slice(0, 10), frequency: r.frequency, paidDates: r.paid_dates as string[] }));
  return { reserve: row ? String(row.reserve) : '0', version: row?.version ?? 0, bills };
}

export async function saveSuiReserve(profile: Profile, raw: unknown) {
  const data = reserveInput.parse(raw);
  const saved = await database().query(`INSERT INTO sui_budgets(profile_id,reserve,version) VALUES($1,$2,1) ON CONFLICT(profile_id) DO UPDATE SET reserve=$2,version=sui_budgets.version+1,updated_at=now() WHERE sui_budgets.version=$3 RETURNING version`, [profile.id, data.reserve, data.version]);
  if (!saved.rowCount) throw new AppError('VERSION_CONFLICT', 409, 'Your SUI reserve changed in another tab. Refresh and try again.');
  return { saved: true };
}

export async function addSuiBill(profile: Profile, raw: unknown) {
  const data = billInput.parse(raw);
  if (BigInt(data.amount) <= 0n) throw new AppError('INVALID_AMOUNT', 400, 'Bills need an amount above zero.');
  if (data.startDate < localToday(new Date().toISOString(), profile.timezone)) throw new AppError('INVALID_DATE', 400, 'Choose today or a later date for the first payment.');
  const count = (await database().query('SELECT count(*)::int AS n FROM sui_bills WHERE profile_id=$1 AND NOT removed', [profile.id])).rows[0].n;
  if (count >= 50) throw new AppError('TOO_MANY_BILLS', 400, 'You can track up to 50 SUI bills.');
  const id = randomUUID();
  await database().query('INSERT INTO sui_bills(profile_id,id,alias,amount,start_date,frequency) VALUES($1,$2,$3,$4,$5,$6)', [profile.id, id, data.alias, data.amount, data.startDate, data.frequency]);
  return { id };
}

export async function removeSuiBill(profile: Profile, id: string) {
  const updated = await database().query('UPDATE sui_bills SET removed=true WHERE profile_id=$1 AND id::text=$2 AND NOT removed', [profile.id, id]);
  if (!updated.rowCount) throw new AppError('NOT_FOUND', 404, 'Bill not found.');
  return { removed: true };
}

export async function markSuiBillPaid(profile: Profile, id: string, raw: unknown) {
  const { date } = paidInput.parse(raw);
  return transaction(async db => {
    const bill = (await db.query('SELECT paid_dates FROM sui_bills WHERE profile_id=$1 AND id::text=$2 AND NOT removed FOR UPDATE', [profile.id, id])).rows[0];
    if (!bill) throw new AppError('NOT_FOUND', 404, 'Bill not found.');
    const paid = [...new Set([...(bill.paid_dates as string[]), date])].slice(-200);
    await db.query('UPDATE sui_bills SET paid_dates=$3 WHERE profile_id=$1 AND id::text=$2', [profile.id, id, JSON.stringify(paid)]);
    return { paid: true };
  });
}
