// O04: a matched bill payment may release its reservation only when the balance is PROVEN to include it.
// Tatum's GetBalance has no proof, so live balances carry checkpoint=null and the payment stays held. Held amounts
// make "left to spend" conservative: never higher than the true value, whether or not the balance includes the payment.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { units } from '@/domain/money';
import { planning } from '@/domain/planning';
import type { Allocation, Balance, Occurrence, Plan } from '@/domain/types';

const plan: Plan = { endDate: '2026-11-07', endKind: 'income', reserve: units('100').toString(), expectedIncome: null, timezone: 'Africa/Lagos', version: 1 };
const bill = (amount = '200', id = 'bill'): Occurrence => ({ id, ruleId: 'rule', dueDate: '2026-11-01', amount: units(amount).toString(), alias: 'Bill', category: 'Home', cancelled: false });
const live = (usdc: string, tip = '500'): Balance => ({ usdc: units(usdc).toString(), sui: '0', observedAt: '2026-10-28T12:00:00Z', checkpoint: null, observedTip: tip, source: 'tatum', stale: false });
const proven = (usdc: string, checkpoint: string): Balance => ({ ...live(usdc), checkpoint, source: 'synthetic' });
const paid = (amount: string, checkpoint: string | undefined = '101', target = 'bill', id = 'p1'): Allocation => ({ id, sourceId: 'tx-' + id, targetId: target, amount: units(amount).toString(), state: 'active', checkpoint });
const run = (balance: Balance | null, allocations: Allocation[], occurrences = [bill()]) => planning({ balance, plan, today: '2026-10-28', occurrences, allocations });
const ready = (r: ReturnType<typeof planning>) => { if (r.state !== 'ready') throw new Error('expected ready, got ' + r.state); return r; };

describe('O04 balance inclusion (unit, no provider)', () => {
  it('payment inclusion: a proven checkpoint at or above the payment releases it exactly', () => {
    const r = ready(run(proven('450', '101'), [paid('50', '101')]));
    expect(r.remainder).toBe(units('200')); expect(r.held).toBe(0n); expect(r.conservative).toBe(false);
  });
  it('live Tatum balance (no proof) holds the payment even when its observed tip is far past the payment', () => {
    const r = ready(run(live('450', '999999'), [paid('50', '101')]));
    expect(r.held).toBe(units('50')); expect(r.conservative).toBe(true);
    expect(r.remainder).toBe(units('150')); // understated by the held 50, never overstated
  });
  it('stale snapshot: a proven balance from before the payment does not release it', () => {
    const r = ready(run(proven('500', '100'), [paid('50', '101')]));
    expect(r.held).toBe(units('50')); expect(r.remainder).toBe(units('200'));
  });
  it('a payment allocation without a checkpoint is never released', () => {
    const noCheckpoint: Allocation = { id: 'p1', sourceId: 'tx-p1', targetId: 'bill', amount: units('50').toString(), state: 'active' };
    expect(ready(run(proven('450', '200'), [noCheckpoint])).held).toBe(units('50'));
  });
  it('pending and reversed allocations neither release nor hold', () => {
    const r = ready(run(proven('500', '200'), [{ ...paid('50'), state: 'pending' }, { ...paid('30', '101', 'bill', 'p2'), state: 'reversed' }]));
    expect(r.held).toBe(0n); expect(r.commitments).toBe(units('200'));
  });
  it('partial proof: only proven payments release; the rest stay held', () => {
    const r = ready(run(proven('400', '150'), [paid('50', '120', 'bill', 'a'), paid('50', '180', 'bill', 'b')]));
    expect(r.commitments).toBe(units('150')); expect(r.held).toBe(units('50'));
  });
  it('failure conditions: no balance is unknown, never zero; over-allocation still throws', () => {
    expect(run(null, [paid('50')]).state).toBe('unknown_balance');
    expect(() => run(live('500'), [paid('150', '101', 'bill', 'a'), paid('60', '101', 'bill', 'b')])).toThrow('Commitment over-allocation.');
  });
  it('duplicate allocation rows for one payment cannot release more than the bill', () => {
    expect(() => run(proven('300', '200'), [paid('120', '101', 'bill', 'dup'), paid('120', '101', 'bill', 'dup2')])).toThrow('Commitment over-allocation.');
  });
  it('a stale live balance stays flagged stale', () => {
    expect(ready(run({ ...live('500'), stale: true }, [])).stale).toBe(true);
  });
  it('never overstates: for any bill, payment and balance, the unproven result is <= the true result', () => {
    fc.assert(fc.property(fc.bigInt({ min: 0n, max: 10n ** 20n }), fc.bigInt({ min: 1n, max: 10n ** 12n }), fc.bigInt({ min: 0n, max: 10n ** 12n }), fc.boolean(), (after, billAmount, rawPay, included) => {
      const pay = rawPay % (billAmount + 1n);
      const before = after + pay; // balance before the payment; `after` once it is included
      const occ: Occurrence = { ...bill(), amount: billAmount.toString() };
      const allocation: Allocation = { ...paid('0'), amount: pay.toString() };
      const truth = ready(planning({ balance: { ...proven('0', '101'), usdc: after.toString() }, plan, today: '2026-10-28', occurrences: [occ], allocations: [allocation] }));
      const observed = ready(planning({ balance: { ...live('0'), usdc: (included ? after : before).toString() }, plan, today: '2026-10-28', occurrences: [occ], allocations: [allocation] }));
      expect(observed.remainder <= truth.remainder).toBe(true);
      if (!included) expect(observed.remainder).toBe(truth.remainder);
      expect(observed.held).toBe(pay);
    }));
  });
});
