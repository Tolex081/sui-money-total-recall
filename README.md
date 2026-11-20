# Sui Money

A budget for a Sui wallet that **learns from what you tell it**. Label a payment once; Sui Money remembers it on Walrus, spots your habits, and changes its advice: how much is safe to spend each day, whether your savings goal is on track, and whether a payment you're about to make cuts into a bill or goal.

Built for **Total Recall (Tatum × Walrus Memory)**, Consumer Finance track.

**Live app:** https://sui-money.vercel.app · **Fictional demo (no wallet):** https://sui-money.vercel.app/demo · **Integration proof:** https://sui-money.vercel.app/proof · **Blog post:** _link once published_

## What it does

1. **Reads your wallet through Tatum.** Native USDC and SUI balances and history from Sui Mainnet. Keys never leave your wallet.
2. **Remembers what you confirm on Walrus Memory.** Payment labels, bills, goals and your decisions. Nothing counts until Walrus reads it back and it matches. Corrections are new versions; history is kept.
3. **Learns from that memory.** Labels become spending patterns. Patterns change the plan, and every figure is shown **with memory and without memory**, side by side, naming the memories that made the difference.
4. **Checks a payment before you sign it.** If it eats into a goal or a later bill, or is far above your usual spend in that category, you see it before the wallet opens.
5. **Lets you own your memory.** Move it into a Walrus Memory account your own wallet owns, add Sui Money as a revocable delegate, and take the memory to any other app.

## Memory that changes the recommendation (demo, 28 Oct 2026)

| | Without memory | With memory |
|---|---|---|
| Bills reserved | Rent, internet | + weekly groceries and transport, confirmed from past payments |
| Habits expected | none | Eating out, ~30.75 USDC a week, learned from 5 remembered labels |
| **Safe to spend** | **66.59 USDC a day** | **50.01 USDC a day** |

The same engine warns when your usual spending puts a savings goal at risk and names the weekly cut that closes the gap, or suggests a savings amount when there's room. Dismissed advice is itself remembered, so it doesn't come back. Rules are deterministic and tested: [`src/domain/insights.ts`](src/domain/insights.ts), [`tests/insights.test.ts`](tests/insights.test.ts).

## How Tatum and Walrus are used

- **Tatum** (Sui Mainnet gRPC) supplies every chain fact: balances, coin metadata, checkpoints, history, and builds and submits every transaction your wallet signs (sends, and the memory-account setup). Coin types match exactly, never by symbol.
- **Walrus Memory** stores every learned event as a versioned record. Each write moves `queued → stored → read back`; a write whose outcome is unknown is never retried blindly. Memory writes are **on by default** in production (`MEMWAL_WRITES_PAUSED=true` is the only off switch; `/api/health` reports `memoryWrites`).
- **Who owns the memory:** by default, a private namespace in Sui Money's account. In Settings → *Who owns your memory*, your wallet creates your own Walrus Memory account and adds Sui Money's delegate key. New memories go to your account; each memory is always verified against the account it was written to. Remove the key from any wallet to cut Sui Money off.

## Run it

```text
npm ci
cp .env.example .env.local   # fill in privately: Tatum, Postgres, MemWal delegate + account
npm run db:migrate
npm run dev
```

`APP_MODE=mock` for local fixtures; production needs `APP_MODE=live`. Own memory accounts switch on when `MEMWAL_PACKAGE_ID`, `MEMWAL_REGISTRY_ID` and `MEMWAL_DELEGATE_ENCRYPTION_SECRET` are set.

Checks: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run build`.

## Proof

- Live integration status: [/proof](https://sui-money.vercel.app/proof)
- Walrus write, recall and correction on Mainnet: [docs/WALRUS_MEMORY_VERIFICATION.md](docs/WALRUS_MEMORY_VERIFICATION.md)
- Everything else (architecture, financial rules, security, evidence): [docs/README.md](docs/README.md)

## Known limits

- The own-memory-account flow is built and unit-tested; it has not yet been run end to end on Mainnet with a real wallet.
- Memories saved before moving to your own account stay in the shared account; copying them across is the next step.
- Balance reads carry a checkpoint lower bound, not a proven snapshot ([O04](docs/OPEN_ITEMS.md)).

Builder: Tolex. Icons: Lucide (ISC). Walrus and Tatum artwork used with attribution ([brand assets](docs/BRAND_ASSETS.md)).
