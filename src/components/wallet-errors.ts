// What to tell someone when their wallet refuses to sign. Only the specific failure observed on Mainnet is reworded:
// a wallet built before Sui address balances rejects a transaction that spends one with this raw validation error,
// before showing any approval window. Every other error keeps its own message, so unrelated problems aren't
// mistaken for an outdated wallet.
export const WALLET_TOO_OLD = 'Your wallet couldn’t read this transaction. Your funds are held as a Sui address balance, a newer Sui feature this wallet version doesn’t support. Nothing was sent. Try an up-to-date Sui wallet.';
const CANCELLED = 'You cancelled in your wallet. Nothing was sent.';
const ADDRESS_BALANCE_UNREADABLE = /^Invalid type: Expected Object but received Object$/;

export function walletMessage(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).trim();
  if (/reject|denied|cancel/i.test(message)) return CANCELLED;
  if (ADDRESS_BALANCE_UNREADABLE.test(message)) return WALLET_TOO_OLD;
  return message;
}
