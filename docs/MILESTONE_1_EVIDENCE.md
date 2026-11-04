# Milestone 1 evidence: personal memory write, Walrus recall and correction

4 November 2026. Branch `milestone-1-walrus-memory` (local commit only); nothing pushed or deployed.

## What is real and what is mocked

| Check | Kind | Result |
|---|---|---|
| Relayer namespace filtering | **Real, read-only, Mainnet relayer** | Recalling 3 synthetic demo seed event IDs: own namespace returned 20 results each, exactly 1 with the requested event ID; a never-written namespace returned **0 results** for the same queries. Shows the relayer filters recall by namespace for our operator account. Does not show isolation between different MemWal accounts. Script: `evidence/private/relayer-namespace-check.ts` (not committed). |
| Address-balance sends classified as payments | **Real, read-only, Tatum Mainnet** | Both confirmed StarKey SUI sends (`GXmPbrNR…`, `H7kwASEE…`) now classify as `simple_transfer` with a counterparty (were `complex`). The two stored rows stay `complex`: re-importing skips existing rows, so a new transfer is needed (see below). |
| Recall endpoint ownership, exact match, read-only, rate limit | Mocked Walrus, real PostgreSQL | `scripts/db-test.ts` "M1 pilot Walrus recall": pass |
| Label correction lifecycle and Forget | Mocked Walrus, real PostgreSQL | `scripts/db-test.ts` "M1 payment-label correction": pass |
| Verification rules (exact copy, profile, revision, supersession, reordering) | Mocked hits | `tests/memory-verification.test.ts`: 4 pass |
| A real personal memory write, recall, correction and fresh-session recall | **Not run** | Blocked: needs a deploy and production checks (below) |

## Production preflight (4 Nov 2026)

| Setting | Status |
|---|---|
| `APP_MODE=live`; sign-in, read, labels, send, plan flags on | Verified via `/api/health` |
| `DATABASE_URL`, `TATUM_API_KEY`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_NAMESPACE_SECRET`, `APP_ORIGIN` present | Verified via `/api/health` (booleans only) |
| `MEMWAL_FREE_WRITES_CONFIRMED=true` in Vercel | **Unverified** (Vercel CLI token expired) |
| `MEMWAL_SERVER_URL` unset or `https://relayer.memory.walrus.xyz` in Vercel | **Unverified** |
| Sponsored-write quota | **Unverified**: the SDK has no quota call; check the MemWal dashboard |
| Vercel database is the one in `.env.local` | **Unverified** |
| Eligible payment to label in production | **None yet**: the two sends are stored as `complex`. Re-importing does **not** fix them: imports skip rows that already exist (`ON CONFLICT … DO NOTHING`, `src/application/sync.ts:10`). After deploy, one new tiny transfer is needed, or a separately approved correction of the two stored rows. |
| Test database | `TEST_DATABASE_URL` is the same Neon database as production (direct endpoint); tests run in throwaway `test_*` schemas there. Two leftover test schemas (29 Oct, 3 Nov) await an approved cleanup. |

## Procedure for the real test (after approval and deploy)

1. Product owner confirms the four unverified settings above.
2. Make one new tiny transfer with an up-to-date wallet (for example 0.01 SUI to your own second wallet), then sign in, accept consents and run **Import last 30 days**, so that payment shows "What was this for?".
3. Label it `Test label 1`, category `Other`. Wait for "Remembered".
4. Record from the database: event ID, logical key, revision, job states, relayer job ID, blob ID, `recalled_at`, envelope SHA-256.
5. Sign out, close the browser, reopen, sign in, open **Memories → Verify memories from Walrus**. Record the result (expected: "Returned by Walrus · matches", revision 1).
6. **Change** the label to `Groceries`. Wait for "Remembered". Record revision 2 and its blob ID.
7. Fresh session again; **Verify** (expected: revision 2, "replaces revision 1", matches).

## Evidence to fill in

| Item | Value |
|---|---|
| Deployed commit | |
| Revision 1 event ID / blob ID / recall result | |
| Revision 2 event ID / blob ID / recall result | |
| Fresh-session results (both) | |
| Envelope SHA-256 (both) | |
