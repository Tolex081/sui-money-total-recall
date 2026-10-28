export const USDC_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
export const SUI_TYPE = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
export const USDC_DECIMALS = 6; // Expected metadata; live adapter must validate this, never infer by symbol.
export function units(value: string, decimals = USDC_DECIMALS): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value) || value.length > 78) throw new Error('Enter a nonnegative plain decimal amount.');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error(`Use at most ${decimals} decimal places.`);
  const amount = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (amount.toString().length > 78) throw new Error('Amount exceeds supported precision.');
  return amount;
}
export function integer(value: string): bigint {
  if (!/^-?(0|[1-9]\d*)$/.test(value) || value.length > 79) throw new Error('Invalid base-unit integer.');
  return BigInt(value);
}
export function amount(value: bigint | string, decimals = USDC_DECIMALS, display = 2): string {
  const raw = typeof value === 'string' ? integer(value) : value;
  const sign = raw < 0n ? '−' : '';
  const abs = raw < 0n ? -raw : raw;
  const scale = 10n ** BigInt(decimals);
  const whole = (abs / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (abs % scale).toString().padStart(decimals, '0');
  return sign + whole + (display ? '.' + fraction.slice(0, display).padEnd(display, '0') : '');
}
export const max = (a: bigint, b: bigint) => a > b ? a : b;
export const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);
