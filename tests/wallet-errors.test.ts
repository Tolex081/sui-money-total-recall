import { it, expect } from 'vitest';
import { walletMessage, WALLET_TOO_OLD } from '@/components/wallet-errors';

it('rewords only the observed address-balance failure', () => {
  // Exact message Suiet returned on Mainnet for a transaction spending an address balance.
  expect(walletMessage(new Error('Invalid type: Expected Object but received Object'))).toBe(WALLET_TOO_OLD);
});
it('keeps every other error as it is', () => {
  for (const other of ['Invalid type: Expected string but received number', 'Expected Uint8Array but received Object', 'Feature not supported by this wallet', 'Unsupported network', 'Insufficient gas', 'Invalid type: Expected Object but received Object at path inputs[1]'])
    expect(walletMessage(new Error(other))).toBe(other);
});
it('reports a cancellation as nothing sent', () => {
  expect(walletMessage(new Error('User rejected the request'))).toBe('You cancelled in your wallet. Nothing was sent.');
  expect(walletMessage('Request denied')).toBe('You cancelled in your wallet. Nothing was sent.');
});
