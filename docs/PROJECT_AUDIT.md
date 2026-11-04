# Sui Money: project audit

Audit date: 3 November 2026. Commit audited: `4039450` (main), plus the uncommitted working-tree changes listed in §0.
Method: source read, real-database tests, unit tests, type check, production build, read-only counts from the database configured in `.env.local` (it holds migrations 1–5 and the live profile, so it is treated as production; the Vercel database setting itself was not inspected), and earlier recorded evidence in `evidence/public/`.

Evidence levels used below:
- **Verified live**: shown working against the real service (Tatum Mainnet, Walrus Mainnet, production) with recorded evidence.
- **Verified with fixtures**: automated tests or local preview against a real PostgreSQL schema, with external services stubbed or empty wallets.
- **Built, not verified**: code exists and compiles; never exercised end to end.
- **Missing**: not implemented.

## 0. Working tree at audit time

`main` has uncommitted changes from work in progress when the audit was requested. They are preserved, not committed:

| File | Change |
|---|---|
| `src/components/memories-live.tsx` (new) | Plain-language Memories screen with **Forget** (deactivation) |
| `src/components/dashboard.tsx` | Renders it; "Compare without what you taught it" link; reimbursement card in Activity; About and Proof wording; removes the Health category |
| `src/components/read-only-wallet.tsx` | Forget states on payment rows; Health removed; comparison link |
| `src/app/api/[...path]/route.ts` | Allows `POST memories/:id/deactivate` when labels are enabled |
| `src/app/theme.css`, `theme-dark.css` | Styles for the above |

These typecheck, lint, build and were exercised in a local preview, but are not reviewed, committed or deployed.

## 1. Architecture

| Layer | What is there |
|---|---|
| Framework | Next.js 16.4.3 (App Router, Turbopack), React 19.3, TypeScript 6, Node 24 on Vercel |
| Pages | One catch-all route `src/app/[...screen]/page.tsx` renders `components/dashboard.tsx` (a ~150-line file of very long single-line components) for Today, Activity, Plan, Send, Receive, Settings, Memories, Proof, About and `/demo/*`. Landing page `src/app/page.tsx`. |
| API | One hand-written router `src/app/api/[...path]/route.ts` (~165 lines) plus `api/internal/spike` (admin-secret probe). |
| Domain (pure) | `src/domain/*`: exact bigint money maths, planning, spending, recurrence, learning events, SUI budget. |
| Application | `src/application/*`: auth, consent, sync, state assembly, commands, activity, memory jobs, transfers, SUI budget. |
| Adapters | `adapters/tatum` (Sui gRPC), `adapters/memwal` (Walrus Memory SDK), `adapters/postgres`, `adapters/mock/demo.ts` (synthetic demo dataset). |
| Database | PostgreSQL (Neon) via `pg`. Migrations `db/migrations/001–005`. Ledger, plans, commitments, allocations, learned events, memory jobs, sessions, transfers, SUI budget. |
| Wallet | `@mysten/dapp-kit-react` 2.1.43, Wallet Standard picker (Suiet first, Slush wallet disabled). The browser client's network `fetch` is deliberately disabled: every chain read and write goes through the server and Tatum. |
| Auth | Readable personal-message challenge → signature verified server-side → random session token (stored hashed) in an httpOnly browser-session cookie; CSRF header; same-origin check; connected-wallet header must match the session. Sessions end after 60 idle minutes and 24 hours. |
| Release flags | `WALLET_SIGNIN_ENABLED`, `PERSONAL_READ_ENABLED`, `PERSONAL_LABELS_ENABLED`, `PERSONAL_SEND_ENABLED`, `PERSONAL_PLAN_ENABLED` (all on in production), `PERSONAL_ACCESS_ENABLED` (older all-in-one mode, off). |
| CI | GitHub Actions `verify:quality`: lint, typecheck, unit, real-DB, demo browser, build, authenticated browser, secret scan, evidence check. |

Two parallel UIs exist: the **live pilot** (`read-only-wallet.tsx`, `money-moves.tsx`, `plan-editor.tsx`, `sui-budget-panel.tsx`, `settings.tsx`) used in production, and the older **full-access** screens inside `dashboard.tsx` (used by `/demo` and when `PERSONAL_ACCESS_ENABLED=true`). Plan reuses the full-access `PlanScreen`.

## 2. Features found and how far each is proven

| Feature | Where | Level | Evidence / gap |
|---|---|---|---|
| Wallet connect + signed sign-in | `wallet.tsx`, `application/auth.ts` | **Verified live** | Production DB: 1 profile with consent `operator-managed-v1`. Real-DB tests cover signature, CSRF, revocation, isolation. |
| USDC and SUI balances via Tatum | `adapters/tatum/chain.ts` `balances()` | **Verified live** | Production DB: 7 Tatum balance reads saved. Earlier reference-address check in `evidence/public/tatum-address-check.json`. |
| Transaction history (USDC and SUI) | `application/sync.ts`, `chain.ts` `historyPage()` | Verified live for a **public reference address** only | `evidence/public/reference-history.json`, `transfer-reference.json`. Production DB has **0 imported movements**: never run for a real user wallet. |
| Live incoming detection (`sync recent`) | `sync.ts` `syncRecent()` | Built, not verified | Needs an imported history; none in production. |
| Send USDC / Send SUI | `application/transfers.ts`, `money-moves.tsx` | Build step **verified live** (real Tatum refused empty throwaway wallets with the right error). Signing, submission and confirmation **not verified**. | Production `transfers` table is empty: no real send has happened. |
| Receive (address, QR, watch) | `money-moves.tsx` | Display verified locally; live watch not verified | As above. |
| Payment labels saved to Walrus | `activity.ts` `annotate()`, `memory-jobs.ts` | Verified with fixtures | Production `learned_events` is **empty**: no personal Walrus write has ever happened. |
| 24 synthetic seed memories on Walrus Mainnet | `scripts/seed-mainnet.ts`, `docs/SEED_REVIEW.md` | **Verified live** (28 Oct) | Recorded in `public_proof` (`seed`, checked 2026-10-28). These are demo data, not user memories. |
| USDC plan (date, reserve, commitments, matching, reimbursements, suggestions) | `domain/planning.ts`, `commands.ts`, `plan-editor.tsx`, `PlanScreen` | Verified with fixtures (unit, real-DB, authenticated browser in CI) | Production: 0 plans, 0 commitments. |
| SUI budget (reserve, bills, left to spend, spending) | `domain/sui-budget.ts`, `application/sui-budget.ts` | Verified with fixtures (unit tests, local preview) | Stored in PostgreSQL only, not Walrus. Production: 0 bills. |
| Settings, auto-lock, sign out everywhere, data export | `settings.tsx`, `auth.ts` | Verified with fixtures (local preview: idle lock → server 401) | |
| Memories screen with Forget | `memories-live.tsx` | Built, uncommitted (§0) | Production shows "Learning updates are paused" for Memories today. |
| Learning comparison ("compare without learned rules") | `Learning` in `dashboard.tsx` | Demo only in production; live link uncommitted | |
| Public demo `/demo` | `adapters/mock/demo.ts` | Working; clearly labelled fictional data | |
| Proof page | `dashboard.tsx` `Proof`, `api/proof` | Working; shows recorded evidence from `public_proof` | Last integration probe 29 Oct; wording outdated (fixed in §0). |
| Savings goals, goal progress, collision detection, what-if simulator, accountability | none | **Missing** | |
| AI financial assistant | none | **Missing** | No LLM dependency or key in the project. |
| Memory categories GOAL / PREFERENCE / COMMITMENT / … as in the new brief | `domain/learning.ts` | Partial | Existing kinds: payment_explanation, category_rule, own_destination_rule, reimbursement_link, recurrence_confirmation, suggestion_decision, planning_preference (reserve only), correction, deactivation. No goal kind. |

## 3. Tatum integration (actual)

- **Transport:** Sui **gRPC**, not JSON-RPC: `sui-mainnet-grpc.gateway.tatum.io:443`, TLS, API key sent as `x-api-key` gRPC metadata from the server only (`TATUM_API_KEY`). The target is pinned in code; any other host throws.
- **Calls used:** `LedgerService.GetServiceInfo` (network identity, checkpoint height), `StateService.GetCoinInfo` (exact coin type and decimals), `StateService.GetBalance`, `LedgerService.GetTransaction`, `LedgerService.GetCheckpoint`, `LedgerService.ListTransactions` (server stream filtered by affected address, cursor paging), and for sends `Transaction.build` (coin selection and simulation through the same client) and `TransactionExecutionService.ExecuteTransaction` (via `client.core.executeTransaction`).
- **Asset identity:** USDC `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC`, SUI `0x2::sui::SUI`. Coin type and decimals (6 / 9) are checked against `GetCoinInfo` on every balance read; matching is by exact type, never symbol. Not re-checked against Circle's published list during this audit.
- **Errors:** `readTatum()` retries once on UNAVAILABLE / RESOURCE_EXHAUSTED / DEADLINE_EXCEEDED, maps auth, not-found and rate-limit errors to clear messages, and never substitutes demo data. A missing key returns `CONFIGURATION_REQUIRED`. Budget limiter: 2 reads/s and 1,200 reads/day globally, 40/min per profile.
- **Conflict with the new brief:** the brief asks for Sui JSON-RPC methods. The code uses Tatum's Sui gRPC gateway. Confirming which Tatum interface to standardise on is the first Phase One decision.

## 4. Walrus Memory integration (actual)

- **SDK:** `@mysten-incubation/memwal` 0.1.11, managed relayer `https://relayer.memory.walrus.xyz` (pinned; other URLs throw).
- **Identity:** one **operator** account (`MEMWAL_ACCOUNT_ID`) with one server-held delegate key (`MEMWAL_PRIVATE_KEY`). The agent identity is that delegate's public key. Each user gets a namespace `sm-` + HMAC(`MEMWAL_NAMESPACE_SECRET`, profileId). Users do not own their memories; isolation is enforced by the server, not by Walrus.
- **Write:** an event (JSON envelope with eventId, profileId, logicalKey, revision, kind, payload) is stored in PostgreSQL as a job → `remember(text, namespace, {idempotencyKey: eventId, dedupe: true})` → `getRememberStatus` until a blob ID → `recall({query: eventId})` must return byte-identical JSON → only then is the event activated. A lost response becomes `submission_outcome_unknown` and is reconciled by recall, never resubmitted. Writes are refused unless `MEMWAL_FREE_WRITES_CONFIRMED=true`.
- **Read in normal use:** from **PostgreSQL** (`learned_events` + `memory_jobs`), not from Walrus. `refreshRecall()` re-checks availability with `listMemories` and semantic `recall`, but only the older full-access Memories screen calls it.
- **Correction:** immutable records; a correction or deactivation is a new revision under the same logical key, and the newest confirmed revision wins (`activeEvents`). The SDK has no delete or forget method (available: remember*, recall*, listMemories, listNamespaces, restore, analyze, embed, health), so deactivation only hides a memory from the app.
- **Cross-session:** works today because PostgreSQL persists the activated events; a new session does not read Walrus. There is no rebuild-from-Walrus path if the database is lost.
- **Production use so far:** 0 personal memories written. The only Mainnet memories are the 24 synthetic seed records.

## 5. What is missing for genuine Walrus persistence

1. A first real personal write and recall in production (none so far). Confirm `MEMWAL_FREE_WRITES_CONFIRMED=true` in Vercel. Its value there is unknown.
2. Recall from Walrus as part of a new session (at minimum on sign-in or on the Memories screen), so cross-session recall is shown from Walrus rather than only from the cache.
3. A restore path from Walrus into PostgreSQL (the SDK has `restore` and `listMemories`).
4. Goal and preference memory kinds and the Session A–D experiment from the brief (goal → fresh session recall → correction → fresh session shows the corrected goal).
5. A visible memory timeline (what was learned, when, confirmation, superseded, which recommendation it changed).
6. Optional, for the ownership feedback: per-user MemWal accounts with a revocable delegate key (`addDelegateKey` / `removeDelegateKey` exist in `account.d.ts`). Not built.

## 6. Mocked or demo-only functionality

- `/demo` uses a fixed fictional dataset (`adapters/mock/demo.ts`) with a "Read-only demo" banner. Its Mainnet memory panel reads real recorded seed evidence.
- `APP_MODE=mock` only shows a "Development preview" banner. No code path was found that swaps live Tatum or Walrus data for fixtures; missing credentials produce explicit errors.
- Unit and real-DB tests stub Walrus (`providedMemory`) and use empty or throwaway wallets for Tatum. These are clearly test-only.
- The learning comparison in production is demo-only (live version uncommitted, §0).

## 7. Security review

| # | Finding | Severity |
|---|---|---|
| S1 | All users' memories live in one operator MemWal account; the relayer processes plaintext. Users get no ownership or portability. Disclosed on About and in consent. | High for the Walrus story, medium for security |
| S2 | Walrus storage cannot be erased; Forget only hides. Consent text says so. Health category removed (uncommitted). | Medium |
| S3 | Balance "checkpoint" is a lower bound read before the balance, not an atomic snapshot (`docs/BALANCE_CONSISTENCY.md`). A just-paid bill can be released early until the next refresh. | Medium (financial correctness) |
| S4 | Send relays wallet-signed bytes; the server checks sender and that the signed intent equals the prepared one, claims the send before submitting and stores the digest first. Not exercised with real funds. | Medium until live-tested |
| S5 | CSP allows `'unsafe-inline'` scripts (needed by the theme bootstrap script). | Low |
| S6 | `SESSION_SECRET` is listed as required but unused (sessions are random tokens stored as SHA-256). Harmless but misleading. | Low |
| S7 | Global Tatum budget of 1,200 reads/day can be exhausted by many users or one open Receive page per user (≈2 reads per 15 s for 10 min). | Medium (availability) |
| S8 | Local `.env.local` holds production database and provider secrets; migrations are run from a developer machine. Gitignored; secret scan in CI. | Low–medium (operational) |
| S9 | Slush extension warning for this origin is unresolved (O09). Suiet is used instead. | Open |
| S10 | Label text is filtered for keys, emails, phone numbers and long text (`safeText`). Good. | — |

No private keys, seed phrases or browser-exposed API keys were found. No `NEXT_PUBLIC_*` secrets.

## 8. Technical debt

- `dashboard.tsx` holds most screens as very long single-line components; hard to review and the reason edits needed scripted patches.
- One large hand-written API router; feature flags are checked inline.
- Two UIs (live pilot vs full-access) for the same features.
- `docs/OPEN_ITEMS.md`, `EVIDENCE.md`, `VERIFICATION_REPORT.md` and the v2.0 build brief predate sending, SUI budgets, settings and planning for real wallets, and contradict them (the brief excludes payment execution and an LLM chat; the new master brief requires both).
- The authenticated browser test waits 5 s; it fails locally against the remote Neon test database (~4.2 s per state load) and passes in CI.
- The demo Playwright suite starts `next dev`, which timed out locally in this audit.

## 9. Tests run in this audit

| Check | Result |
|---|---|
| `tsc --noEmit` | Pass |
| ESLint (`src`, `scripts`, `tests`) | 0 errors, 2 warnings (errors exist only in the installed skill's own scripts under `.claude/`) |
| `npm test` (Vitest) | 43 / 43 pass (4 files) |
| `npm run test:db` (real PostgreSQL, disposable schema) | 19 / 19 pass |
| `npm run build` | Pass |
| `npm run test:e2e` (demo browser) | Not run locally: dev server start timed out at 90 s. Passed in CI on PR #4. |
| `npm run test:e2e:personal` | Not rerun in this audit; fails locally on the 5 s wait (§8); passed in CI on PR #4. |

## 10. Critical release blockers (deadline 10 Nov 2026, 17:00 UTC)

1. **No real personal Walrus memory yet.** The submission's main claim (memory that changes the product across sessions) has only synthetic evidence.
2. **No real send or receive yet.** Send/Receive are advertised but unproven with real funds.
3. **No real-wallet history import yet** in production.
4. **AI assistant and goals do not exist.** The new brief makes them central.
5. **Blog, video and form submission are not done**, and existing drafts describe the old read-only app.
6. **Docs contradict the product** (§8).

## 11. Recommended implementation order

1. Decide on the uncommitted §0 changes (review → commit, or discard).
2. **Real-wallet smoke test in production (builder):** sign in, import history, label one payment (first personal Walrus write), make one tiny send and receive. Check `MEMWAL_FREE_WRITES_CONFIRMED` in Vercel first.
3. **Phase One, Tatum verification** (read-only script and `docs/TATUM_VERIFICATION.md`); decide gRPC vs JSON-RPC.
4. **Phase Two, Walrus verification:** add a goal/preference memory kind, read memories from Walrus on a fresh session, run the Session A–D experiment, write `docs/WALRUS_MEMORY_VERIFICATION.md`.
5. **Goals plus memory timeline** (extend the new Memories screen); goal progress from real balances.
6. **Assistant:** answers computed deterministically from balances, plans and active memories; a language model, if used, only turns a sentence into a proposed change that the user confirms. Needs a provider decision and key.
7. Blog, video, docs, submission. Collision detection and the what-if simulator only if time remains.
