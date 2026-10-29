# Sui Money

Understand what you spent. Make room for what is coming.

A fresh Sui Mainnet application combining native-USDC spending explanations and forward budgeting. SUI balances and network costs stay separate. Today, Activity and Plan are the core screens. No custody, transfers, bank integration, token pricing or multiple chains.

**Status: built and deployed for public review; personal release and submission remain gated.** [Open the demo](https://sui-money.vercel.app/demo) or [inspect proof](https://sui-money.vercel.app/proof). Actual Tatum Mainnet native-USDC incoming/outgoing transactions, pagination and balances are verified. All 24 approved synthetic Mainnet memories are stored and recall-confirmed, with expiry covering 30 November 2026. The deployed Node 24 runtime passed Tatum, signed MemWal recall and PostgreSQL write/read. Exact financial, real database and public-demo browser checks have passed; final-source results are in `evidence/public/quality.json`. Genuine installed-wallet/cross-session learning and the [live balance snapshot contract](docs/BALANCE_CONSISTENCY.md) remain open. Article/video are drafts; no submission receipt is claimed. See [verification](docs/VERIFICATION_REPORT.md), [open items](docs/OPEN_ITEMS.md) and the [requirement matrix](docs/EVIDENCE.md).

## Explore

1. Open `/demo` for Today and its exact formula.
2. Open Activity to inspect a fictional explanation and reimbursement.
3. Open Plan and compare without selected learned rules.

Demo finances are fictional, fixed at 28 October 2026. Learning interactions are read-only replays; no fake saves occur. Mainnet seed evidence is recorded separately. `/proof` reports sanitized actual integration evidence. Personal production accounts remain release-gated while critical verification is unfinished.

The interface uses official Walrus/Tatum event artwork and source-role labels; see [asset attribution](docs/BRAND_ASSETS.md). Slush extension 26.21.6 (e2be7f2) has displayed a malicious-site warning to the builder. **Do not bypass it or sign on the flagged origin.** Wallet sign-in is being paused pending official review; [review request](docs/SLUSH_REVIEW_REQUEST.md) and [real preference guide](docs/REAL_PREFERENCE_GUIDE.md) track the next steps. This warning is unresolved, not declared a false positive.

## Run locally

Node 24 and npm are the deployment/CI target. Initial local checks also ran on Node 22.17.1. Use `npm.cmd` on Windows if PowerShell blocks npm.ps1.

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
npm run verify:quality
npm run smoke:live
npm run audit:seed
npm run verify:evidence
npm run snapshot:learning
npm run audit:submission
```

`test:db` uses `TEST_DATABASE_URL` (unpooled) or a local test PostgreSQL URL and a disposable isolated schema, removed afterward. It never drops the application schema. `smoke:live` is read-only by default; its `--write` flag would create another event and is not a routine verification command. The exact [reviewed 24-event batch](docs/SEED_REVIEW.md) is complete. Refresh it through read-only `audit:seed`; do not change/repeat payloads, create extra records, renew storage or transfer funds without separate explicit authorization.

## Architecture

Next.js App Router / React / strict TypeScript; pure BigInt and Temporal domain functions; Tatum native gRPC via installed Mysten generated types; asynchronous MemWal jobs with matching recall before activation; PostgreSQL transactions, row locks, immutable facts and durable cursors. Secrets stay on the server. See [architecture](docs/ARCHITECTURE.md) and [financial rules](docs/FINANCIAL_RULES.md).

The operator owns the shared Walrus account. The hosted relayer processes plaintext context. Namespaces group records; signed server authorization isolates profiles. Hiding a rule is not permanent erasure. Export is user scoped, and the complete ledger cannot be reconstructed from bounded semantic recall alone.

## Delivery and attribution

Builder: Tolex. Track: Consumer Finance Apps, Total Recall (Tatum x Walrus Memory), 20 October–10 November 2026. The working name is not a checked brand. This repository starts from the v2.0 [product brief](docs/SUI_MONEY_BUILD_BRIEF.md); Handshake references are historical context only.

Uses the officially published Next.js, Mysten, Tatum, Walrus and Neon interfaces; dependencies retain their original licenses. Icons: Lucide (ISC). No third-party merchant marks or invented testimonials. [Submission checklist](docs/SUBMISSION_CHECKLIST.md) records public URL and builder-action status. Article/video/social drafts are not publication. No final submission is claimed without a receipt.
