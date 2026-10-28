# Sui Money

Understand what you spent. Make room for what is coming.

A fresh Sui Mainnet application combining native-USDC spending explanations and forward budgeting. SUI balances and network costs stay separate. Today, Activity and Plan are the core screens. No custody, transfers, bank integration, token pricing or multiple chains.

**Status: implementation and verification in progress; not a completed or submitted hackathon entry.** The local production build, exact-arithmetic tests and real PostgreSQL allocation/authentication tests have passed. Tatum Mainnet identity, coin metadata, a reference balance (including zero USDC), bounded history transport and signed MemWal recall have passed. One synthetic Mainnet memory write completed with matching recall. Incoming/outgoing populated history, real scan resume, production runtime and genuine deployed-wallet sign-in still need evidence. See [verification](docs/VERIFICATION_REPORT.md), [open items](docs/OPEN_ITEMS.md) and the [requirement matrix](docs/EVIDENCE.md).

## Explore

1. Open `/demo` for Today and its exact formula.
2. Open Activity to inspect a fictional explanation and reimbursement.
3. Open Plan and compare without selected learned rules.

Demo finances are fictional, fixed at 28 October 2026. Learning interactions are read-only replays; no fake saves occur. Mainnet seed evidence is recorded separately. `/proof` reports sanitized actual integration evidence. Personal production accounts remain release-gated while critical verification is unfinished.

## Run locally

Node 22.17+ and npm are required. Use `npm.cmd` on Windows if PowerShell blocks npm.ps1.

```text
npm ci
```

Copy `.env.example` to `.env.local` **privately**. Configure Tatum, a pooled PostgreSQL connection and a registered MemWal delegate/account ID. Never use an owner wallet private key, put secrets in `NEXT_PUBLIC_*`, paste secrets into chat or commit environment files. [Operations](docs/OPERATIONS.md) describes setup, rotation and recovery. Hosted Neon uses its Free plan; acceptance of provider terms is a builder action. Do not attach billing or upgrade.

```text
npm run db:migrate
npm run dev
```

Use `APP_MODE=mock` only for local fixtures/CI. `APP_MODE=live` is required in production. A missing live dependency returns an error and never falls back to fictional data. `/demo` remains an explicitly synthetic dataset inside live mode.

## Verification commands

```text
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:e2e
npm run build
npm run scan:secrets
npm run smoke:live
npm run smoke:live -- --write
npm run seed:mainnet -- --write
npm run verify:evidence
npm run snapshot:learning
npm run audit:submission
```

`test:db` uses `TEST_DATABASE_URL` (unpooled) or a local test PostgreSQL URL and a disposable isolated schema, removed afterward. It never drops the application schema. `smoke:live` is read-only by default. Its write flag is a separately authorized single synthetic event. The exact reviewed 24-event Mainnet batch is documented in [seed review](docs/SEED_REVIEW.md); it is resumable, capped at four writes per minute and cannot duplicate a completed deterministic ID. Never repeat writes to inflate counts.

## Architecture

Next.js App Router / React / strict TypeScript; pure BigInt and Temporal domain functions; Tatum native gRPC via installed Mysten generated types; asynchronous MemWal jobs with matching recall before activation; PostgreSQL transactions, row locks, immutable facts and durable cursors. Secrets stay on the server. See [architecture](docs/ARCHITECTURE.md) and [financial rules](docs/FINANCIAL_RULES.md).

The operator owns the shared Walrus account. The hosted relayer processes plaintext context. Namespaces group records; signed server authorization isolates profiles. Hiding a rule is not permanent erasure. Export is user scoped, and the complete ledger cannot be reconstructed from bounded semantic recall alone.

## Delivery and attribution

Builder: Tolex. Track: Consumer Finance Apps, Total Recall (Tatum x Walrus Memory), 20 October–10 November 2026. The working name is not a checked brand. This repository starts from the v2.0 [product brief](docs/SUI_MONEY_BUILD_BRIEF.md); Handshake references are historical context only.

Uses the officially published Next.js, Mysten, Tatum, Walrus and Neon interfaces; dependencies retain their original licenses. Icons: Lucide (ISC). No third-party merchant marks or invented testimonials. [Submission checklist](docs/SUBMISSION_CHECKLIST.md) records public URL and builder-action status. Article/video/social drafts are not publication. No final submission is claimed without a receipt.
