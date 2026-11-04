# Implementation status

Updated 3 November 2026 from the audit in `PROJECT_AUDIT.md`; memory rows updated 4 November 2026 after the real Milestone 1 test. **VERIFIED** means shown working against the real service or production with recorded evidence; automated tests with stubs or empty wallets count as **IMPLEMENTED**.

| Feature | Status | Evidence or blocker |
|---|---|---|
| Wallet connect and signed sign-in | VERIFIED | Production DB: 1 consented profile; real-DB auth tests |
| USDC and SUI balances through Tatum | VERIFIED | Production DB: 7 Tatum balance reads; `evidence/public/tatum-address-check.json` |
| Transaction history import (USDC, SUI) | IMPLEMENTED | Verified for a public reference address only (`evidence/public/reference-history.json`); 0 movements for real users |
| Plain SUI payments recognised in history | IMPLEMENTED | Unit tests only |
| Live incoming payment detection | IMPLEMENTED | Not exercised in production |
| Send USDC | IMPLEMENTED | Build step returns correct errors against real Tatum; no real send yet |
| Send SUI | IMPLEMENTED | As above |
| Receive USDC and SUI | IMPLEMENTED | Address and QR shown; live watch not exercised |
| Payment labels written to Walrus | VERIFIED | 4 Nov 2026: owner labelled a real 0.01 SUI payment in production; written to Walrus and confirmed (`MILESTONE_1_EVIDENCE.md`) |
| Synthetic seed memories on Walrus Mainnet (24) | VERIFIED | `docs/SEED_REVIEW.md`, `public_proof` seed checked 2026-10-28 |
| Cross-session memory recall from Walrus | VERIFIED | All 3 revisions matched when recalled from fresh local processes against production and the Mainnet relayer; the deployed Verify button also worked after sign-out/sign-in (owner-reported, backed by session and rate-limit records). See `MILESTONE_1_EVIDENCE.md`. Isolation between different MemWal accounts not verified |
| Memory correction (new revision) | VERIFIED | 4 Nov 2026: two real corrections in production; each new revision replaced the previous one and was the only active revision when recalled from Walrus |
| Memory forget (deactivation) in the live app | IMPLEMENTED | PR #5 (draft); mocked-Walrus real-DB test |
| USDC plan: date, reserve, commitments | IMPLEMENTED | CI browser and real-DB tests; 0 plans in production |
| Commitment payment matching, reimbursements | IMPLEMENTED | Real-DB tests; a reimbursement button for live users is not in PR #5 (preserved separately) |
| Recurring suggestions | IMPLEMENTED | Unit tests |
| Live plan editor ("left to spend" as you type) | IMPLEMENTED | Local preview; deployed |
| SUI budget | IMPLEMENTED | Unit tests, local preview; stored in PostgreSQL only |
| Learning comparison (with vs without learned rules) | IN PROGRESS | Demo only in production; live link in PR #5 (draft) |
| Settings, auto-lock, sign out everywhere, export | IMPLEMENTED | Local preview (idle lock → 401) |
| Favicon, home-screen icon, share image | VERIFIED | Served by production (`/icon.svg`, `/apple-icon`, `/opengraph-image`) |
| Savings goals and progress | NOT STARTED | |
| Goal collision detection | NOT STARTED | |
| What-if simulator | NOT STARTED | |
| Accountability (missed contributions, revised schedules) | NOT STARTED | |
| AI financial assistant | NOT STARTED | Needs a provider decision and API key |
| Memory timeline | NOT STARTED | |
| Per-user Walrus ownership (revocable delegate key) | NOT STARTED | SDK supports delegate keys; design decision needed |
| `docs/TATUM_VERIFICATION.md` | NOT STARTED | |
| `docs/WALRUS_MEMORY_VERIFICATION.md` | NOT STARTED | |
| Blog article | BLOCKED | Draft describes the old app; needs real learning evidence |
| Demo video | BLOCKED | Draft shows the old app |
| Submission form | NOT STARTED | Builder only; deadline 10 Nov 2026, 17:00 UTC |
