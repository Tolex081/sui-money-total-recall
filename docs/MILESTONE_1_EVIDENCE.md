# Milestone 1 evidence: personal memory write, Walrus recall and correction

Updated 4 November 2026. Branch `milestone-1-walrus-memory`, pushed to GitHub and open as **draft PR #5** against `main` (not merged). Vercel builds an automatic **preview** deployment for the PR; there is no production deployment. Preview environment variables were not inspected, so the preview must not be used for real memory writes until they are checked.

## Scope of this PR

In: read-only Walrus recall (`POST /memories/recall`), Verify and Change on Memories, the Memories/Forget screen and one-box label picker they build on, Health category removed, database-test guard.

Out (preserved as patch files outside the PR, `evidence/private/preserved/`): the `coin::redeem_funds` payment classification and its tests, and the live reimbursement card. The wallet-picker change is PR #6.

## What is real and what is mocked

| Check | Kind | Result |
|---|---|---|
| Relayer filters recall by namespace | **Real, read-only, Mainnet relayer** | Recalling 3 synthetic demo seed event IDs: own namespace returned 20 results each, exactly 1 with the requested event ID; a never-written namespace returned **0 results**. Shows namespace filtering for our operator account only, not isolation between different MemWal accounts. |
| Recall: ownership, exact match, cross-profile rejection, read-only snapshot, rate limit, time budget | Mocked Walrus, real PostgreSQL | `scripts/db-test.ts` "M1 pilot Walrus recall" |
| Recall route: feature flags (`RELEASE_GATE`), no session (401), no memory consent (`CONSENT_REQUIRED`), missing Walrus configuration fails closed with no data change | Mocked/absent Walrus, real PostgreSQL | same test |
| Label correction lifecycle and Forget | Mocked Walrus, real PostgreSQL | `scripts/db-test.ts` "M1 payment-label correction" |
| Verification rules (exact copy, profile, revision, supersession, reordering) | Mocked hits | `tests/memory-verification.test.ts` |
| Test-database guard | Unit | `tests/test-database.test.ts` |
| A real personal memory write, recall, correction and fresh-session recall | **Not run** | Blocked (below) |

## Test database

Database tests now fail closed (`scripts/test-database.ts`): `TEST_DATABASE_URL` is required with no fallback to `DATABASE_URL`; a remote server is refused unless `TEST_DATABASE_ALLOW_REMOTE=true`, and always refused when it is the same server and database as `DATABASE_URL` or `PRODUCTION_DATABASE_URL` (pooled and direct endpoints count as the same). CI runs them against its own throwaway Postgres service. The local `TEST_DATABASE_URL` points at the production Neon database, so on this machine they now refuse to run. Two leftover `test_*` schemas from earlier runs (29 Oct, 3 Nov) remain in the production database pending a separate decision.

## Recall time budget

Recalls run sequentially, each with an 8 s timeout; no new recall starts after 25 s and remaining memories are reported as "not checked". Worst case about 33 s. Vercel's documented limits (24 Aug 2026): 300 s default with Fluid compute (on by default); 60 s maximum on Hobby without it. Whether this project has Fluid compute on is unverified.

## Production preflight (4 Nov 2026)

| Setting | Status |
|---|---|
| `APP_MODE=live`; sign-in, read, labels, send, plan flags on | Verified via `/api/health` |
| `DATABASE_URL`, `TATUM_API_KEY`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_NAMESPACE_SECRET`, `APP_ORIGIN` present | Verified via `/api/health` (booleans only) |
| `MEMWAL_FREE_WRITES_CONFIRMED=true` in Vercel | **Unverified** |
| `MEMWAL_SERVER_URL` unset or `https://relayer.memory.walrus.xyz` in Vercel | **Unverified** |
| Sponsored-write quota | **Unverified**: the SDK has no quota call; check the MemWal dashboard |
| Vercel database is the one in `.env.local` | **Unverified** |
| Fluid compute on for this project | **Unverified** |
| Eligible payment to label in production | **None.** The only production movements are two SUI sends stored as `complex`, which cannot be labelled, and re-importing does not change stored rows. How to obtain an eligible payment is a separate decision: no blockchain transaction may be made for test data without separate approval. |

## Procedure for the real test (only after approval, deploy and an eligible payment)

1. Product owner confirms the unverified settings above and decides how an eligible payment is obtained.
2. Sign in, accept consents and run **Import last 30 days**, so the eligible payment shows "What was this for?".
3. Label it `Test label 1`, category `Other`. Wait for "Remembered".
4. Record from the database: event ID, logical key, revision, job states, relayer job ID, blob ID, `recalled_at`, envelope SHA-256.
5. Sign out, close the browser, reopen, sign in, open **Memories → Verify memories from Walrus**. Expected: "Returned by Walrus · matches", revision 1.
6. **Change** the label to `Groceries`. Wait for "Remembered". Record revision 2 and its blob ID.
7. Fresh session again; **Verify**. Expected: revision 2, "replaces revision 1", matches.

## Evidence to fill in

| Item | Value |
|---|---|
| Deployed commit | |
| Revision 1 event ID / blob ID / recall result | |
| Revision 2 event ID / blob ID / recall result | |
| Fresh-session results (both) | |
| Envelope SHA-256 (both) | |
