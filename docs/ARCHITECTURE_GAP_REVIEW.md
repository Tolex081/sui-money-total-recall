# Architecture gap review

3 November 2026. Investigation only: no application code, configuration, Mainnet memory or commit was changed.
Labels: **[Fact]** read from code, SDK type definitions, the database or the live site · **[Assumption]** not checked · **[Recommendation]** proposed, not done.

## 1. Uncommitted changes on `main`

Files: `src/components/memories-live.tsx` (new), `src/components/dashboard.tsx`, `src/components/read-only-wallet.tsx`, `src/app/api/[...path]/route.ts`, `src/app/theme.css` (+20 lines), `src/app/theme-dark.css` (line endings only, no content change). Also new and untracked: `docs/PROJECT_AUDIT.md`, `docs/IMPLEMENTATION_STATUS.md`, this file.

| # | Change | Where it shows | Risk or gap | Recommendation |
|---|---|---|---|---|
| 1 | `route.ts:62` allows `POST memories/:id/deactivate` when labels are on | Live pilot | Requires memory consent (`route.ts` CONSENT_VERSION check). The pending-write lock (`001_initial.sql:56`) makes Forget fail with "VERSION_CONFLICT" while a save for the same memory is pending; the message is technical. | **Keep** |
| 2 | `memories-live.tsx`: plain list of remembered labels and plan rules with Forget | Live pilot `/memories` (replaces the "paused" card) | With `PERSONAL_PLAN_ENABLED` off, the API sends only `payment_explanation` memories (`route.ts`, read-pilot state branch), so a pending Forget is invisible until confirmed. Without Walrus keys locally, Forget stays "Forgetting…" (it cannot confirm). Real Walrus confirmation not exercised. | **Keep**, after a real confirmation test |
| 3 | `read-only-wallet.tsx`: payment row shows "Forgetting this label…"; confirmation hook names forgotten labels | Live pilot Today/Activity | `labelPayload` on a deactivation event falls back to "your label"; handled by the new branch. | **Keep** |
| 4 | Health category removed (`read-only-wallet.tsx:26`, `dashboard.tsx:29`) | Live pilot and full-access/demo forms | Existing labels with "Health" still display (category is free text server-side). | **Keep** |
| 5 | "Compare without what you taught it" on Today's plan card, opening the existing `Learning` comparison | Live pilot (only when a memory is confirmed) | Wording differs from the demo's "Compare without learned rules". The comparison reuses full-access code untested with real memories. | **Modify** wording to match the demo, then keep |
| 6 | Reimbursement card and dialog in Activity (`AllocationForm kind="reimbursement"`) | Live pilot when planning is on | Dialog is the older full-access form: dense, technical language; not exercised with real data. | **Modify** (simplify copy) or defer |
| 7 | Proof notice and About text now describe sending and Walrus saves | All modes | Accurate today; About still states "USDC is the only budget unit" elsewhere in the brief, not in the page. | **Keep** |

Verification of these changes: `tsc`, ESLint, unit tests and build pass; local preview showed Memories, Forget being recorded (`learned_events` gained a `deactivation` row), the comparison link, the reimbursement dialog and the About text.

## 2. Walrus Memory

### 2.1 Production path for one personal memory **[Fact]**

1. **Sign-in:** `auth.ts:21–41` verifies the personal-message signature and finds or creates the profile.
2. **Consent:** `POST /consent` (wallet data), then `POST /consent/memory` (`application/consent.ts:18–24`) sets `consent_version='operator-managed-v1'`.
3. **The payment must already be imported:** `annotate()` (`application/activity.ts:13–22`) loads the movement from `chain_movements`; it must be a successful simple USDC or SUI transfer. Production currently has **0** imported movements, so step 3 needs `Import last 30 days` first.
4. **Event queued:** `newEvent()` (`commands.ts:71–73`) builds the envelope `{schemaVersion, eventId, profileId, logicalKey:"annotation:<movementId>", revision, kind:"payment_explanation", payload:{movementId, category, note, ownTransfer}, …}`. `queueEvent()` (`commands.ts:60–69`) checks the expected revision and inserts `learned_events` + `memory_jobs(state='queued')` in one transaction.
5. **Write:** the browser calls `POST /memory-jobs/advance` every 7 s, up to 12 times (`read-only-wallet.tsx`, `useLabelConfirmation`). `advanceMemoryJob()` (`memory-jobs.ts:66–98`):
   - Claims the job (`submitting`).
   - `WalrusMemory.submit()` (`adapters/memwal/memory.ts:13–16`) **refuses unless `MEMWAL_FREE_WRITES_CONFIRMED === 'true'`**; otherwise the job goes back to `queued` with `FREE_WRITE_ENTITLEMENT_UNCONFIRMED` and nothing reaches Walrus.
   - `remember(JSON envelope, namespace, {idempotencyKey: eventId, dedupe: true})`, then the job moves to `accepted` with the relayer job ID.
6. **Confirm:** next advance: `getRememberStatus` → `done` + `blob_id` → namespace check → `saved` → `recallEvent()` (`memory.ts:18–21`: `recall({query: eventId, limit: 20})`, keeping only results whose JSON is byte-identical to the stored envelope and whose `profileId` matches, `domain/learning.ts:39–41`).
7. **Activate:** `applyEvent()` (`memory-jobs.ts:15–64`) re-checks the revision, writes `payment_annotations`, sets `activated_at` and `memory_jobs.state='recall_confirmed'` with `blob_id` and `recalled_at`.
8. **Failure handling:** a crash during submission becomes `submission_outcome_unknown` after 60 s and is reconciled by recall, never resubmitted (`memory-jobs.ts:70, 82–86`).

### 2.2 Configuration needed for a real personal write

| Setting | Required value | Status |
|---|---|---|
| `APP_MODE` | `live` | **[Fact]** live (enforced for production in `lib/config.ts:9`) |
| `WALLET_SIGNIN_ENABLED`, `PERSONAL_READ_ENABLED`, `PERSONAL_LABELS_ENABLED` | `true` | **[Fact]** true (`/api/health`) |
| `DATABASE_URL`, `TATUM_API_KEY`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_NAMESPACE_SECRET`, `APP_ORIGIN` | set | **[Fact]** present (`/api/health` `dependencies`, booleans only) |
| `MEMWAL_SERVER_URL` | unset, or exactly `https://relayer.memory.walrus.xyz` | **Unverified** (any other value throws, `memory.ts:5–6`) |
| `MEMWAL_FREE_WRITES_CONFIRMED` | `true` | **Unverified in Vercel.** **[Fact]** not `true` in local `.env.local` |
| Sponsored write quota on the MemWal account | available | **[Assumption]** (`docs/OPEN_ITEMS.md` O06 says "Sponsored MemWal confirmed") |

Rate limits that apply: 4 writes/min globally, 3/min per profile, 10 polls/min per profile (`memory-jobs.ts:67, 74`).

### 2.3 Retrieval and user association **[Fact]**

- **One owner:** every memory belongs to the single operator account (`MEMWAL_ACCOUNT_ID`) and is encrypted with the operator's delegate key (SDK `restore` docs: "SEAL-decrypts them with the delegate key").
- **Per-user namespace:** each user's memories sit under `profiles.namespace` = `'sm-' + HMAC-SHA256(MEMWAL_NAMESPACE_SECRET, profileId)[0..40]` (`lib/security.ts`, `namespaceFor`). It's computed once at profile creation (`auth.ts:34`) and stored in `profiles.namespace UNIQUE` (`001_initial.sql:5`).
- **Matching recalls to users:** happens at two levels. The query targets the user's namespace, and each result must parse as an envelope with the user's `profileId` and match the stored record exactly.
- **Isolation is enforced by our server, not by Walrus.** The operator key can list every namespace: the SDK's `listMemories` filters namespaces client-side (`memwal.d.ts`, `listMemories` docs).
- **Normal reads come from PostgreSQL.** `accountState()` (`application/state.ts`) loads `learned_events` + `memory_jobs`. Walrus is read only while confirming a write. `refreshRecall()` (`memory-jobs.ts:105+`) exists, but `POST /memories/recall` is **not in the pilot's allowed requests** (`route.ts:59–68`), so production returns `RELEASE_GATE` for it.

### 2.4 Can `restore` rebuild PostgreSQL after data loss? **No, not on its own.** **[Fact]** from `memwal.d.ts` (`restore` docs) and `types.d.ts`

- `restore(namespace, limit)` rebuilds the **relayer's search index** for that namespace from Walrus. It returns counts only, defaults to 10 blobs, has no cursor, and the docs warn that full recovery is not guaranteed once a per-owner cap is hit.
- `listMemories` returns **metadata only** (`memory_id`, `namespace_id`, `blob_id`, `status`, `expires_at`), no content.
- Content is only available through semantic `recall`, which caps at 100 results per query. That's a nearest-match search, not a full enumeration.
- After losing PostgreSQL, we could find namespaces (via `listMemories`), run `restore`, then recall broadly and parse the envelopes. That would recover **some** `learned_events` (they contain `profileId`, `logicalKey`, `revision`, `payload`).
- Some things **cannot** be recovered from Walrus:
  - **Not stored there at all:** the wallet ↔ profile mapping, explicit USDC plans, commitments entered without "remember", the SUI budget and sessions.
  - **Re-readable from Tatum instead:** chain history.
- **[Recommendation]**
  - Rely on Neon's point-in-time backups for PostgreSQL, and treat Walrus as the verifiable user-context store.
  - If recovery from Walrus matters, write a small per-profile index memory, and record a wallet hash in the envelope only if that is acceptable for privacy.

### 2.5 Corrected, deactivated or superseded memories **[Fact]**

- **Every change is a new event:** revision N+1 with `supersedesEventId` pointing at the previous one (`commands.ts:60–66`). It's rejected if another tab changed it first, and only one write per memory can be pending at a time (`001_initial.sql:56`).
- **Until the new event is recall-confirmed, the old one stays in force** (`activeEvents`, `domain/learning.ts:29–38`: newest confirmed revision wins; deactivations are dropped).
- **When a deactivation is confirmed** (`memory-jobs.ts:53–60`):
  - the label row is deleted from `payment_annotations`;
  - linked recurring rules end and their future unpaid bills are cancelled;
  - linked reimbursements are reversed.
- **What stays:** old blobs remain on Walrus and can still be recalled. The app ignores them because a newer revision exists. There is no deletion API in the SDK (methods: remember*, recall*, listMemories, listNamespaces, restore, analyze, embed, health).
- **If a correction fails,** the previous revision stays active and the row offers "Try again".

### 2.6 Minimum safe procedure for the first personal memory **[Recommendation]**

1. **Before anything, check Vercel** (builder, signed in): confirm `MEMWAL_FREE_WRITES_CONFIRMED=true` and `MEMWAL_SERVER_URL` unset or exact, and check the MemWal dashboard quota. No change needed if already right.
   - Safe fallback: if the flag isn't `true`, the first advance returns "Confirm free sponsored writes in setup." **before** anything is sent to Walrus (`memory.ts:13`).
2. **Use a wallet with at least one simple USDC or SUI transfer in the last 30 days.** Sign in, accept wallet consent, then run **Import last 30 days** to completion.
3. **Label exactly one payment** with neutral text, e.g. note `Test label 1`, category `Other`. No names, no personal details. Accept the memory consent shown.
4. **Leave the page open** until the row shows the label without "Waiting…". This takes up to about 84 s, driven by the page.
5. **Stop.** One memory is enough to prove the path. Don't add more until the evidence (§5) is captured.

## 3. Account identity and Google sign-in

### 3.1 Current behaviour **[Fact]**

| Question | Answer | Code |
|---|---|---|
| How is `profileId` made? | `randomUUID()` the first time a wallet passes signature verification | `auth.ts:33–34` |
| Tied to a wallet permanently? | Yes. `profiles.wallet` is `UNIQUE NOT NULL`, and a profile is looked up by wallet | `001_initial.sql:4`, `auth.ts:33` |
| Wallet disconnects? | The browser calls `/auth/logout` when the connected address changes or disappears (`wallet.tsx:22`). The server also rejects requests whose `X-Wallet-Address` differs from the session's wallet (`auth.ts:53–54`). The profile and its data remain. | |
| Connect another wallet? | Signing in with another wallet creates or opens **a different profile** with a different namespace. Nothing is shared. | `auth.ts:33–34` |
| Several wallets per profile? | Not supported | schema |
| Walrus link | Namespace derived from `profileId` at creation and stored on the profile; envelopes carry `profileId` | `auth.ts:34`, `commands.ts:72` |
| Code that assumes one wallet per profile | `profile.wallet` is used for sign-in, chain reads (`sync.ts`), the send sender (`transfers.ts`), the connected-wallet check (`auth.ts`) and movement IDs (which include the owner address, `chain.ts`) | |

### 3.2 Target architecture **[Recommendation]**

Four separate records, with the existing profile ID kept as the account ID:

| Record | Purpose | Key rules |
|---|---|---|
| **Account** (`accounts.id`) | The Sui Money identity: plans, labels, memories, settings | Created from today's `profiles.id` so nothing moves |
| **Login identity** (`auth_identities`: provider, provider subject, account_id) | How someone signs in: `google` or `sui_wallet` | Unique on (provider, subject). Google is keyed by its stable `sub`, **never by email**. ID token verified server-side (issuer, audience, expiry, nonce). |
| **Linked wallet** (`wallet_links`: account_id, address, verified_at, status) | Wallets whose balances and history the account may read and send from | Unique on address (one account per wallet). Added only after a **fresh wallet signature on a link message** naming the account, origin and nonce. A Google login never proves wallet ownership. |
| **Memory space** (`memory_spaces`: account_id, namespace, owner) | Where Walrus memories live and who holds the key | Namespace taken from the account, never from the request. Owner is "operator" today, optionally "user-owned MemWal account" later. |

Safety rules:
- **Signing in:** either a Google login or a wallet signature opens an account. Every send still needs the wallet's own approval, so a Google session alone can never move funds.
- **Linking:** linking a wallet to a Google account needs both proofs in the same session: a Google sign-in from the last few minutes plus a fresh wallet signature. If the wallet is already linked to another account, refuse and offer a merge flow that needs both accounts' proofs. That prevents duplicates and takeover by linking.
- **Unlinking** requires a recent sign-in, revokes the sessions involved and keeps memories with the account.
- **Cross-user access:** every query is scoped by the session's account. Recall checks `profileId` (account ID) in the envelope. `listMemories` output is never sent to the browser.
- **Existing wallet-only users:** each profile becomes an account with the same ID, plus one `sui_wallet` identity and one wallet link. Namespaces and envelopes are unchanged, so **no memory is lost or rewritten**. Users can later add Google from Settings.
- **Ownership (feedback item):** the SDK has `createAccount`, `addDelegateKey`, `removeDelegateKey` and `generateDelegateKey` (`account.d.ts`).
  - Wallet users could create their own MemWal account (an on-chain transaction that costs gas) and add Sui Money's key, which they can remove later.
  - Google-only users have no wallet to sign that, so they would stay in the operator's space until they link a wallet.
  - Existing memories cannot be moved between accounts; they would have to be rewritten as new blobs.
  - **[Assumption]** zkLogin or other Google-to-Sui options were not investigated.
- **Open decision:** with several wallets on one account, should balances and plans be per wallet or combined? Today's plan maths assumes one wallet.

## 4. Tatum

- **Why gRPC [Fact]:** the v2.0 brief required it: "Use gRPC for the application's Tatum reads. Do not build around deprecated Sui JSON-RPC examples" (`docs/SUI_MONEY_BUILD_BRIEF.md:345–348`), citing Tatum's Sui gRPC reference and Sui's gRPC migration guide (`:1015–1020`). The SDK used (`@mysten/sui` 2.38) is gRPC-first, and `docs/INTEGRATION_EVIDENCE.md:22` lists the documentation checked.
- **Verified against Tatum Mainnet [Fact]**, with evidence in `evidence/public/`:
  - network identity and chain ID: `live-smoke.json`, `tatum-address-check.json` (31 Oct);
  - exact USDC and SUI coin types and decimals: `tatum-address-check.json`, and Circle's address page per `INTEGRATION_EVIDENCE.md:22`;
  - balances for a user-supplied address: `tatum-address-check.json`;
  - two real USDC transfers, incoming 0.000050 and outgoing 60, read directly: `transfer-reference.json`;
  - bounded paged history with cursor resume and repeat: `reference-history.json`, `history-recovery.json`;
  - a production probe on 29 Oct: `deployed-runtime.json`;
  - 7 real balance reads in production (database count).
- **Not yet tested [Fact]:**
  - history import for a real user wallet (0 rows in production);
  - the live `recent` sync;
  - the new rule recognising plain SUI payments, against a real SUI transfer;
  - for sends, only the build step has run (it stopped at "insufficient funds" for empty wallets); wallet signing, `ExecuteTransaction`, the follow-up `GetTransaction` confirmation and the unknown-outcome path have never run live;
  - behaviour under Tatum's real rate limits.
- **[Recommendation] Keep gRPC.** It's verified, it's the direction Sui documents, and switching would discard tested code. Update the new master brief, which asks for JSON-RPC, to say gRPC. **[Assumption]** Tatum's current documentation was not re-read today.

## 5. Production verification

| Item | Status |
|---|---|
| Flags (sign-in, read, labels, send, plan) | **[Fact]** on, via `/api/health` |
| Credentials present (7 listed) | **[Fact]** present, booleans only |
| `APP_ORIGIN` correct | **[Fact]** indirect: share-image URL is `https://sui-money.vercel.app/...` |
| Database migration level | **[Fact]** version 5 in the database configured locally (assumed to be production) |
| `MEMWAL_FREE_WRITES_CONFIRMED` | **Not verified.** The Vercel page needs sign-in in this browser and the CLI token has expired. Check it in Vercel → Settings → Environment Variables. |
| `MEMWAL_SERVER_URL`, `TATUM_GRPC_TARGET`, `INTERNAL_ADMIN_SECRET` | Not verified (same reason) |
| Which database Vercel uses | **[Assumption]** the same as `.env.local`; confirm the host in Vercel matches |

**Evidence to capture for the first personal memory** (no secrets, wallet address shortened):

1. Time of each step and the deployed commit.
2. From the database: `eventId`, `logicalKey`, `revision`, `kind`, the job state sequence (queued → submitting → accepted → saved → recall_confirmed), the relayer job ID, `blob_id`, `recalled_at` and `expires_at`.
3. A Walrus explorer link for the `blob_id`.
4. A SHA-256 of the stored envelope, and confirmation that the recalled text matched it exactly.
5. Screenshots of the payment row before, while waiting and after.
6. **Fresh-session check:** sign out, close the browser, reopen, sign in, and show the label again.
   - Today that reappearance comes from PostgreSQL. For proof that it comes back **from Walrus** in a new session, a read-only recall must be added or allowed: either `POST /memories/recall` for the pilot, or an operator script that runs `recall` on that namespace and compares it with the stored envelope.
   - **[Recommendation]** Add that read path before recording the demo; it's a small change and writes nothing.
