# Verification report

User-facing work date: 2026-10-28 (Africa/Lagos). Execution timestamps are recorded in UTC without backdating.

## Workspace

Empty workspace inspected before scaffolding. No repository application or AGENTS.md found. Node v22.17.1; Git 2.49.0.windows.1. PowerShell blocks npm.ps1; use npm.cmd without changing execution policy. No Tatum/MemWal/database application environment variables were present (names inspected, no values printed).

## Implementation and evidence levels

The app has Today, Activity, Plan, memory inspection, learning comparison, proof and privacy screens. BigInt/Temporal domain functions, native Tatum gRPC, PostgreSQL transactions, signed wallet sessions and verified asynchronous MemWal jobs are implemented. New commitment edit/cancel, recurrence correction, reimbursement reversal, wallet-change invalidation and sign-out controls require the final suite and redeployment before their end-to-end status is passed.

| Boundary | Actual result | Public-safe artifact and limitation |
|---|---|---|
| Documentation / installed SDK | Current official references, pinned generated Sui types, masks, numeric shapes and real responses inspected | `INTEGRATION_EVIDENCE.md`, `package-lock.json`; no invented proto contract. |
| Tatum Mainnet / coins | Mainnet identity, exact native-USDC type/6 decimals and SUI/9 verified | `live-smoke.json`; zero USDC is a valid observation. |
| Public ordinary USDC history | Incoming +0.000050 USDC and outgoing −60 USDC, successful and directly re-read through Tatum | `transfer-reference.json`; incoming sender differs from reference wallet; separate from builder wallet and synthetic finances. |
| Pagination | 30-record ITEM_LIMIT page followed by 19-record CHECKPOINT_BOUND page with distinct resume | Same artifact. Complete only for recorded bounds. Complex reference history also has three distinct cursors. |
| Walrus lifecycle | One completed synthetic Mainnet smoke write and exact matching signed recall | `live-smoke.json`: job `7c602459-5474-4e9c-8ff2-6c9e4b567702`, blob `J7WMooZiPKy0q9BGM5IPfyeBqOYhgpWH_ECfws3Zs-Q`. |
| Approved synthetic product seed | 24 distinct active stored blobs, matching signed recalls, every expiry covers 30 November 2026 | `seed-mainnet.json`, read-only audit at 2026-10-28T16:59:49.123Z. No extra records or renewals. |
| Real PostgreSQL | 15 isolated-schema DB/auth/concurrency tests passed | `db-tests.json` at 2026-10-28T17:02:43.705Z; tests include allocation races, immutable facts, cursor rollback, wallet-switch and durable unknown-write no-resubmit. Final migrations/tests supersede this run. |
| Local unit/property | 24 financial and learning tests passed | Named F01–F24 cases in `tests/`; local fixture evidence does not prove real personal sessions. |
| Public demo browser | Four earlier tests passed: journey, 390/1440 overflow/keyboard, access controls and no serious/critical axe violations | Historical public-demo evidence. Final suite and visual captures are separate checks. |
| Deployed runtime | Actual Node v24.21.0 Linux x64: Tatum balance, signed MemWal recall and PostgreSQL write/read passed | `deployed-runtime.json` at 2026-10-28T16:58:16.443Z; empty commit is not a source-revision claim. Enhanced transaction probe needs rerun after final deploy. |
| Signed-out access | Production health returned HTTP 200 without authentication | `https://sui-money.vercel.app`; immutable protected URLs may still need Vercel access. |
| Published/submitted | App deployed; repository/article/video/receipt tracked separately | `evidence/release.json` and `SUBMISSION_CHECKLIST.md` are authoritative. Drafts are not publication. |

Artifacts above are under `evidence/public/`; JSON timestamps identify each actual run. Baseline commit: `70be8b4cb458461302c64b5e95a6f3a21c7c09e5`. Later code/evidence was initially uncommitted. The final quality runner records a source fingerprint, so an earlier result is not silently attributed to a later commit.

## Unclosed acceptance

F01–F24 have named local coverage. F07 additionally has real PostgreSQL allocation races; F19 additionally has durable unknown-submission/no-resubmit testing. F08/F09 live acceptance remains blocked by the absent atomic balance checkpoint contract; see `BALANCE_CONSISTENCY.md`. Matching remains pending rather than releasing an unproven reservation.

Genuine installed-wallet sign-in, actual cross-session recurrence/correction learning, complete route-level resource injection and each dependency-down browser flow remain separate mandatory checks. Synthetic replay, generated test wallets and public reference transfers cannot replace them.

Personal production accounts remain release-gated. `npm run audit:submission` must fail while any mandatory evidence, public article/video, eligibility/form inspection or receipt is absent. See `EVIDENCE.md` for individual H/P/F/G outcomes and `OPEN_ITEMS.md` for exact remaining actions. No completed or submitted entry is claimed.

Never infer wallet history from a checkpoint read, authenticated recall from public health, durable storage from filesystem state, or deployment compatibility from a local build.
