import { integer, sum, USDC_TYPE } from './money';
import type { Allocation, Annotation, Coverage, Movement } from './types';
export function eligibleExpense(m: Movement, annotations: Annotation[]) {
  return m.coinType === USDC_TYPE && m.status === 'success' && m.operation === 'simple_transfer' && integer(m.delta) < 0n && !annotations.find(a => a.movementId === m.id)?.ownTransfer;
}
export function validateAllocation(input: { source: Movement; targetAmount: string; existingSource: string[]; existingTarget: string[]; amount: string; kind: 'reimbursement' | 'commitment'; annotations: Annotation[] }) {
  const { source, amount, kind } = input;
  const n = integer(amount);
  if (n <= 0n || source.coinType !== USDC_TYPE || source.status !== 'success' || source.operation !== 'simple_transfer') throw new Error('Allocation requires an eligible verified native-USDC payment and positive amount.');
  if (kind === 'reimbursement' ? integer(source.delta) <= 0n : !eligibleExpense(source, input.annotations)) throw new Error('Ineligible allocation direction or own transfer.');
  const capacity = integer(source.delta) < 0n ? -integer(source.delta) : integer(source.delta);
  if (n + sum(input.existingSource.map(integer)) > capacity || n + sum(input.existingTarget.map(integer)) > integer(input.targetAmount)) throw new Error('Allocation exceeds available payment or outstanding amount.');
}
export function spending(movements: Movement[], annotations: Annotation[], allocations: Allocation[], period: { from: string; to: string }, coverage: Coverage) {
  const unique = [...new Map(movements.map(m => [m.id, m])).values()];
  const expenses = unique.filter(m => m.timestamp >= period.from && m.timestamp < period.to && eligibleExpense(m, annotations));
  const rows = expenses.map(m => {
    const reimbursements = allocations.filter(a => a.targetId === m.id && a.state === 'active');
    const gross = -integer(m.delta), refunded = sum(reimbursements.map(a => integer(a.amount)));
    if (refunded > gross) throw new Error('Expense reimbursement cap exceeded.');
    return { movement: m, category: annotations.find(a => a.movementId === m.id)?.category ?? 'Unclassified', gross, reimbursed: refunded, net: gross - refunded, receipts: reimbursements.map(a => a.receiptDate) };
  });
  const exclusions=unique.filter(m=>m.operation==='complex'&&m.timestamp>=period.from&&m.timestamp<period.to).length;
  const coversPeriod=coverage.state==='complete'&&coverage.from!==null&&coverage.to!==null&&Date.parse(coverage.from)<=Date.parse(period.from)&&Date.parse(coverage.to)>=Date.parse(period.to);
  return {gross:sum(rows.map(r=>r.gross)),reimbursed:sum(rows.map(r=>r.reimbursed)),net:sum(rows.map(r=>r.net)),rows,period,complete:coversPeriod&&exclusions===0,exclusions};
}
