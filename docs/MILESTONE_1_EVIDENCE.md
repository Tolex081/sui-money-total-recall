# Milestone 1 evidence: personal memory write, Walrus recall and correction

Updated 4 November 2026. PR #5 merged into `main` as `549eb1f` and deployed to production. Owner-reported: Preview deployments have no production database or MemWal credentials; do not use previews for real memory writes.

## Scope of this PR

In: read-only Walrus recall (`POST /memories/recall`), Verify and Change on Memories, the Memories/Forget screen and one-box label picker they build on, Health category removed, database-test guard.

Out: the `coin::redeem_funds` payment classification (PR #7, merged), the wallet-picker change (PR #6, merged), and the live reimbursement card (preserved as a patch file outside the PR, `evidence/private/preserved/`).

## What is real and what is mocked

| Check | Kind | Result |
|---|---|---|
| Relayer filters recall by namespace | **Real, read-only, Mainnet relayer** | Recalling 3 synthetic demo seed event IDs: own namespace returned 20 results each, exactly 1 with the requested event ID; a never-written namespace returned **0 results**. Shows namespace filtering for our operator account only, not isolation between different MemWal accounts. |
| Recall: ownership, exact match, cross-profile rejection, read-only snapshot, rate limit, time budget | Mocked Walrus, real PostgreSQL | `scripts/db-test.ts` "M1 pilot Walrus recall" |
| Recall route: feature flags (`RELEASE_GATE`), no session (401), no memory consent (`CONSENT_REQUIRED`), missing Walrus configuration fails closed with no data change | Mocked/absent Walrus, real PostgreSQL | same test |
| Label correction lifecycle and Forget | Mocked Walrus, real PostgreSQL | `scripts/db-test.ts` "M1 payment-label correction" |
| Verification rules (exact copy, profile, revision, supersession, reordering) | Mocked hits | `tests/memory-verification.test.ts` |
| Test-database guard | Unit | `tests/test-database.test.ts` |
| A real personal memory write, recall, correction and fresh-session recall | **Real, production, Mainnet relayer** (4 Nov 2026) | Passed: see "Real test results" below |

## Test database

Database tests now fail closed (`scripts/test-database.ts`): `TEST_DATABASE_URL` is required with no fallback to `DATABASE_URL`; a remote server is refused unless `TEST_DATABASE_ALLOW_REMOTE=true`, and always refused when it is the same server and database as `DATABASE_URL` or `PRODUCTION_DATABASE_URL` (pooled and direct endpoints count as the same). CI runs them against its own throwaway Postgres service. The local `TEST_DATABASE_URL` points at the production Neon database, so on this machine they now refuse to run. Two leftover `test_*` schemas from earlier runs (29 Oct, 3 Nov) remain in the production database pending a separate decision.

## Recall time budget

Recalls run sequentially, each with an 8 s timeout; no new recall starts after 25 s and remaining memories are reported as "not checked". Worst case about 33 s. Vercel's documented limits (24 Aug 2026): 300 s default with Fluid compute (on by default); 60 s maximum on Hobby without it. Whether this project has Fluid compute on is unverified.

## Production preflight (4 Nov 2026)

"Owner-reported" means the product owner checked it in the Vercel or MemWal dashboard; it was not read by the agent.

| Setting | Status |
|---|---|
| `APP_MODE=live`; sign-in, read, labels, send, plan flags on | Verified via `/api/health` |
| `DATABASE_URL`, `TATUM_API_KEY`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_NAMESPACE_SECRET`, `APP_ORIGIN` present | Verified via `/api/health` (booleans only) |
| `MEMWAL_FREE_WRITES_CONFIRMED=true` in Vercel | Owner-reported: present, value hidden (sensitive). Fails closed: if it is not exactly `true`, a label save reports "Confirm free sponsored writes in setup" and nothing is sent to Walrus (`src/adapters/memwal/memory.ts:13`). The first label save confirms it. |
| `MEMWAL_SERVER_URL` unset or `https://relayer.memory.walrus.xyz` in Vercel | Owner-reported: present, value hidden (sensitive). Fails closed: any other value stops every Walrus call (`src/adapters/memwal/memory.ts:5–6`). |
| Sponsored-write quota | Owner-reported: available (MemWal dashboard). The test needs about 3 writes. |
| Vercel database is the one in `.env.local` | Verified indirectly: labels saved through the production app appear in the `.env.local` database. |
| Fluid compute on for this project | Owner-reported: on; default max duration 300 s. Recall worst case is about 33 s. |
| Preview deployments can reach production data | Owner-reported: no. `DATABASE_URL`, `MEMWAL_PRIVATE_KEY` and `MEMWAL_ACCOUNT_ID` are set for Production only. |
| Eligible payment to label in production | Resolved. PR #7 (`coin::redeem_funds` classification) merged and deployed; the owner then sent 0.01 SUI to their own second wallet, imported it, and it showed "What was this for?". The two earlier sends remain stored as `complex`. |

## Procedure for the real test (only after approval, deploy and an eligible payment)

1. An eligible payment exists in production and shows "What was this for?" in Activity. From this wallet that required the `coin::redeem_funds` classification (PR #7, now merged and deployed).
2. Sign in, accept consents and run **Import last 30 days**, so the eligible payment shows "What was this for?".
3. Label it `Test label 1`, category `Other`. Wait for "Remembered".
4. Record from the database: event ID, logical key, revision, job states, relayer job ID, blob ID, `recalled_at`, envelope SHA-256.
5. Sign out, close the browser, reopen, sign in, open **Memories → Verify memories from Walrus**. Expected: "Returned by Walrus · matches", revision 1.
6. **Change** the label to `Groceries`. Wait for "Remembered". Record revision 2 and its blob ID.
7. Fresh session again; **Verify**. Expected: revision 2, "replaces revision 1", matches.

## Real test results (4 Nov 2026)

How it was run, compared with the procedure above:
- **Writes:** done by the owner in the production app, deployed from `main` at `adcc02c` (#6 and #7 merged; #5 not deployed). Main already has the label save and the history screen's **Edit**, which saves a new revision with `expectedRevision` and `supersedesEventId`. These paths are the same in #5.
- **Recall:** PR #5's `verifyMemoriesFromWalrus` (branch at `f57d97e`), run by the agent from a new local process for each check against the production database and the Mainnet relayer (a local script, `evidence/private/m1-verify.ts`, kept out of git because that folder is ignored; it only imports the PR's `verifyMemoriesFromWalrus`). The profile was loaded from the database and its namespace re-derived on the server (`namespaceFor(profile.id)` matched). The only write was the rate-limit counter. The Memories → Verify button itself was not used because #5 is not deployed.
- **Label text:** `Test Label 1` with category Food, then changed to Groceries (revision 2), then the owner also edited the text to `version 2` (revision 3). "Moved to another wallet of mine" was ticked, which is accurate for this payment.

Payment logical key `annotation:mov_0be1d03d25ddbf120a0ced091ff8daf4e4de1529`.

| Revision | Label | Event ID | Blob ID | Saved / recall confirmed by app (UTC) | Envelope SHA-256 |
|---|---|---|---|---|---|
| 1 | Test Label 1 · Food | `50d15864-1dd3-4dc9-96f7-35da81ec3672` | `0zgIg0guC4rZQfXk1rELLw8uPISkk5iXDmi2ovkUa-E` | 14:35:28 / 14:36:05 | `dd6ae8092425aa518d7f6e8d31c4f13e81fab2dfa853cc42ea6b1d37ab174245` |
| 2 | Test Label 1 · Groceries, replaces rev 1 | `721e7274-e4c4-4124-afc0-eefac4cfe09f` | `k5AO7K2jnjQZsF7y6GFLOJZs38ONTEu2AVB2ib658u0` | 14:40:46 / 14:41:31 | `138454752a5dfd60e1f680ef65c3c77eff1ac7e4544df1912917d57c6c5b5079` |
| 3 | version 2 · Groceries, replaces rev 2 | `8df34485-8688-4025-8f38-5ba5f793cce1` | `UXhzz37J9I1bxNnsIzPtXvqUpTHk_36JyfjKOzRRuRk` | 14:42:42 / 14:43:36 | `1caa2e17d58f4ecb462cf40ac56495ff39a2f84ed147653d061261a90ae91b8a` |

Envelope SHA-256 is computed over `JSON.stringify` of the stored envelope. Memory type for all three: `payment_explanation`.

| Revision | Memory job ID | Relayer job ID | Final state | Attempts | Error |
|---|---|---|---|---|---|
| 1 | `431de321-7e89-403a-b75b-10e9db26641f` | `1db0e2e4-f712-4b86-9ed1-0064ed737dca` | `recall_confirmed` | 1 | none |
| 2 | `a133c565-74bd-4253-86cf-fbd049f639a1` | `02885586-a365-4703-bf57-ff3bce577a6b` | `recall_confirmed` | 1 | none |
| 3 | `e863f266-e470-4817-9f19-c8f902ef0dbe` | `b16acfa6-89ad-4c30-84f7-c111ae02ba36` | `recall_confirmed` | 1 | none |

Job state progression: `memory_jobs` stores only the current state, not a history. The code path (`src/application/memory-jobs.ts`) is `queued → submitting → accepted` (relayer job ID stored) `→ saved` (blob ID stored) `→ recall_confirmed` (exact recall matched, then activated). Each job holding a relayer job ID, a blob ID, `recall_confirmed`, one attempt and no error code is consistent with that path; the intermediate timestamps were not recorded.

No public Walrus explorer link is given: none was established for these blob IDs.

| Fresh-process check (UTC) | Active revisions | Result |
|---|---|---|
| 14:38:59 (after rev 1) | 1 (rev 1) | **matched**, same blob; Walrus returned Test Label 1 · Food |
| 14:42:40 (after rev 2) | 1 (rev 2) | **matched**, same blob; Walrus returned Test Label 1 · Groceries; replaces rev 1, supersession consistent |
| 14:44:21 (after rev 3) | 1 (rev 3) | **matched**, same blob; Walrus returned version 2 · Groceries; replaces rev 2, supersession consistent |

Each check found exactly one active revision, so older revisions were not reported as current.

### Deployed Verify button after sign-out / sign-in (4 Nov 2026)
After #5 was deployed, the owner signed out, signed back in, opened **Memories** and pressed **Verify memories from Walrus**. Owner-reported: the screen showed the label returned by Walrus and matching. The database backs this up (read-only check by the agent):
- the previous session was revoked at 14:58:30 UTC, and a new session was created at 15:23:44 UTC;
- the profile's recall rate-limit bucket (`memory:recall:<profile>`) was opened at 15:43:24 UTC, after the agent's last local check (14:44), so this recall came from the deployed endpoint;
- `learned_events` still holds 3 rows, so Verify wrote no memory.

Not covered: recall isolation between different MemWal accounts (only namespace filtering within our operator account was shown).

## Milestone 1 acceptance checklist (4 Nov 2026)

**Real** = production app, production database and the Mainnet MemWal relayer. **Mocked** = Walrus replaced by a test double; real PostgreSQL in CI. Mocked results are not evidence of Walrus behaviour.

### User journey (brief §1)
| # | Step | Result | Kind |
|---|---|---|---|
| 1 | Create a memory from an existing transaction | Passed: label on a real 0.01 SUI payment | Real |
| 2 | Written and confirmed on Walrus through MemWal | Passed: relayer job ID, blob ID, `recall_confirmed` | Real |
| 3 | Sign out, fresh session | Passed: session revoked 14:58, new session 15:23 | Real |
| 4 | Retrieve and verify from Walrus | Passed: exact match for every revision; deployed Verify button after sign-in | Real |
| 5 | Correct the memory | Passed: Food → Groceries (rev 2), then text edit (rev 3) | Real |
| 6 | Corrected revision written to Walrus | Passed: new blob IDs, `recall_confirmed` | Real |
| 7 | Fresh session, retrieve the correction | Passed: fresh-process checks and the deployed Verify button | Real |
| 8 | Outdated revision no longer active | Passed: exactly one active revision in every check | Real |

### Automated tests (brief §10 A)
All 16 items are covered: unit tests (`tests/memory-verification.test.ts`, `tests/test-database.test.ts`) and the CI database suite (`scripts/db-test.ts`: "M1 pilot Walrus recall (mocked Walrus)", "M1 payment-label correction", "HTTP handlers reject cross-profile resource IDs, namespace injection and export leakage", "F19 unknown memory submission…", and the existing Forget tests). Kind: mocked Walrus, real PostgreSQL. Passing in CI on every PR since #5.

### Regression checks (brief §10 B)
TypeScript, ESLint (0 errors; 1 pre-existing warning), 58/58 unit tests, CI database suites, production build: **Passed**.

### Real Walrus integration (brief §10 C)
Write, confirmed response, valid blob ID, exact-envelope recall, corrected write, recall of the correction: **Passed** (tables above).

### Fresh-session sequence (brief §10 D)
**Passed, with one difference in how it was run.** The final step (sign out, close the browser, sign in, Verify from Walrus, corrected revision active) used the deployed app. The earlier checks of revisions 1 and 2 were fresh server processes running the same verification function, not browser sign-out cycles, because #5 was not deployed yet.

### Ownership (brief §10 E)
| Check | Result | Kind |
|---|---|---|
| A second profile cannot retrieve the first profile's memory | Passed | Mocked, synthetic profiles |
| A forged request cannot change the namespace | Passed (request namespace ignored; profile-derived namespace only) | Mocked + route test |
| A mismatched profile ID in a returned envelope is rejected | Passed (`failed_verification`) | Mocked |
| No namespace listings or other users' metadata exposed | Passed | Mocked |
| Relayer filters recall by namespace | Passed for our operator account (own namespace returns the record; never-written namespace returns 0) | Real, read-only |
| Isolation between different MemWal accounts | **Not tested** | — |

### Not claimed
Complete account recovery from Walrus; client-side namespace isolation; user-owned MemWal accounts; full production readiness of all Tatum operations.

### Outstanding
- Cross-account MemWal isolation: not tested (needs a second MemWal account; outside this milestone's setup).
- Two leftover `test_*` schemas (29 Oct, 3 Nov) in the production database: cleanup awaits a product-owner decision.
