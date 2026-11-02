# Sui Money

Understand what you spent. Make room for what is coming.

Sui Money reads a Sui Mainnet wallet through Tatum and lets you say what each native-USDC payment was for. Those labels are stored with Walrus Memory, confirmed by recall, and come back the next time you sign in. SUI is shown separately for network fees. You can also send native USDC from the same wallet: Sui Money prepares the transfer through Tatum, your own wallet approves it, and it lands in your history. There is no custody, no bank connection, no token pricing and only one chain.

Built for **Total Recall (Tatum × Walrus Memory)**, Consumer Finance Apps track, 20 October to 10 November 2026.

**Live app:** https://sui-money.vercel.app · **Fictional demo:** https://sui-money.vercel.app/demo · **Integration proof:** https://sui-money.vercel.app/proof

## What is live

| | Status |
|---|---|
| Wallet sign-in | **Live.** Connect through the Wallet Standard picker (Suiet is listed first) and sign a readable personal message. No gas, no payment approval. |
| Balance | **Live, read-only.** Native USDC and SUI read from Sui Mainnet through Tatum, refreshed automatically when the saved reading is over two minutes old, with the time it was checked. |
| Payment history | **Live, read-only.** The last 30 days of native-USDC and SUI movements, imported through Tatum with resumable cursors. |
| Payment labels | **Live, after a separate consent.** Answer "What was this for?" on any settled native-USDC transfer. The label is written to Walrus Mainnet and only shows as remembered after a matching recall confirms it. Pending, unconfirmed and failed saves stay visible on the payment, with a retry. |
| Today and Activity | **Live.** Today is your balance, the payments still waiting for a label, and the latest three. Activity is the full list with filters, search, "Label next" and paging. |
| Send and Receive | **Built, behind `PERSONAL_SEND_ENABLED`.** Send builds a native-USDC transfer through Tatum, your wallet signs it (no key reaches the server), the server submits it through Tatum and confirms it by reading the digest back into Activity. An optional "What's it for?" label is saved the same way as any other label. Receive shows your address and QR code and watches for incoming payments for ten minutes while open. Tested against Tatum with an empty throwaway wallet only; no real send has been made yet. |
| Budgeting (Plan, commitments, reserve, reimbursements, recurring suggestions) | **Built for real wallets, behind `PERSONAL_PLAN_ENABLED`.** Uses the memory consent labels use. Balance reads now carry the service checkpoint read just before them as a lower bound; see [balance consistency](docs/BALANCE_CONSISTENCY.md) for the remaining risk. |

Production flags: `WALLET_SIGNIN_ENABLED`, `PERSONAL_READ_ENABLED` and `PERSONAL_LABELS_ENABLED` are on. `PERSONAL_SEND_ENABLED` (send/receive) and `PERSONAL_PLAN_ENABLED` (Plan) are new and must be turned on, and migration 004 applied, before they work in production. `PERSONAL_ACCESS_ENABLED` (the older all-in-one access mode) stays off.

## Try it

**With your own wallet** (Chrome + Suiet):

1. Open `/today` and choose **Connect Wallet**, then sign the readable message.
2. Agree to read-only access. Your balance loads.
3. **Import last 30 days**, then answer **What was this for?** on a payment. The first time, Sui Money explains exactly what Walrus will store and asks for consent.
4. Sign out, sign back in: the confirmed label is still on the payment.

**Without a wallet:** `/demo` is a fixed, fictional account (28 October 2026). It shows the full loop the paused budgeting adds: Today's remaining amount and its formula, explained payments and a reimbursement in Activity, and Plan compared with and without remembered rules. Its learning interactions are read-only replays; nothing is saved.

## Walrus and Tatum

- **Tatum** supplies every on-chain fact through Sui Mainnet native gRPC: balances, coin metadata, checkpoints and transaction history. Coin types are matched exactly, never by symbol, and a zero balance is kept distinct from a failed read.
- **Walrus Memory** stores what you confirm. A label becomes a versioned event and a durable job; it is submitted, stored, then activated only after a signed recall returns the same event. A crash after submission is never retried blindly. Corrections are new revisions, not edits.
- **What a label stores:** your note, its category and whether it was a transfer to your own wallet, linked to the payment's transaction ID and your wallet address. Walrus storage cannot be erased on request. The operator runs one shared Walrus account; each profile has its own namespace and the server enforces access.
- **Mainnet evidence so far:** 24 reviewed, synthetic demo records stored and recall-confirmed, with expiry covering 30 November 2026 (see [seed review](docs/SEED_REVIEW.md)). A real wallet's labels are written through the same path; a recorded real session is still to come.

## Run locally

Node 24 and npm are the deployment and CI target. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

```text
npm ci
```

Copy `.env.example` to `.env.local` **privately**. Configure Tatum, a pooled PostgreSQL connection and a registered MemWal delegate and account ID. Never use an owner wallet private key, put secrets in `NEXT_PUBLIC_*`, paste secrets into chat or commit environment files. [Operations](docs/OPERATIONS.md) covers setup, rotation and recovery.

```text
npm run db:migrate
npm run dev
```

Use `APP_MODE=mock` only for local fixtures and CI; production requires `APP_MODE=live`. A missing live dependency returns an error and never falls back to fictional data. `/demo` stays an explicitly synthetic dataset in live mode.

## Verification

```text
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:e2e
npm run build
npm run scan:secrets
npm run verify:quality
```

`test:db` uses `TEST_DATABASE_URL` (unpooled) and a disposable schema that is removed afterwards. CI runs lint, types, unit and property tests, real-database tests, public and authenticated browser tests, the build, a secret scan and evidence checks on every push. Read-only provider checks: `npm run smoke:live`, `npm run audit:seed`, `npm run verify:evidence`. Do not repeat or extend the reviewed seed batch, renew storage or move funds without explicit authorization.

## Design

Cool-blue workspace, self-hosted Figtree and Bricolage Grotesque, flat panels, and one signature element: each payment shows the chain fact on top and your remembered label (or the prompt for one) beneath it. The design system is in [DESIGN.md](DESIGN.md); the wallet screens were reviewed with Impeccable's audit and critique (reports in `.impeccable/critique/`).

## Known limits

- **Plan uses a checkpoint lower bound,** not a proven balance snapshot ([open item O04](docs/OPEN_ITEMS.md)).
- **Live updates are polled, not pushed.** Receive checks every 15 seconds for ten minutes; Today and Activity check once per visit. Each check costs two Tatum reads against the shared daily budget.
- **No recorded real-wallet session yet.** The Suiet sign-in, label and recall path is live and tested with fixtures and real-database tests, but has not yet been exercised end to end by the builder's own wallet (O05).
- **Slush extension warning.** Slush extension 26.21.6 (e2be7f2) showed the builder a malicious-site warning for this origin. It is unresolved and not declared a false positive: do not bypass it or sign on a flagged origin. Use Suiet. See [review request](docs/SLUSH_REVIEW_REQUEST.md).

More detail: [architecture](docs/ARCHITECTURE.md), [financial rules](docs/FINANCIAL_RULES.md), [verification report](docs/VERIFICATION_REPORT.md), [requirement matrix](docs/EVIDENCE.md), [open items](docs/OPEN_ITEMS.md).

## Attribution

Builder: Tolex. This repository starts from the v2.0 [product brief](docs/SUI_MONEY_BUILD_BRIEF.md). Uses the published Next.js, Mysten, Tatum, Walrus and Neon interfaces; dependencies keep their own licences. Icons: Lucide (ISC). Walrus and Tatum artwork is used with attribution and does not imply endorsement ([brand assets](docs/BRAND_ASSETS.md)). No third-party merchant marks or invented testimonials. The article, video and social post are drafts until published; no submission is claimed without a receipt ([submission checklist](docs/SUBMISSION_CHECKLIST.md)).
