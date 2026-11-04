# Walrus Memory verification: savings goal (Session A–D)

Run on 4 November 2026 against production (https://sui-money.vercel.app, `main` at `281d8fd`) and the Walrus Memory Mainnet relayer. It is the master brief's required experiment: save "500 USDC for a laptop, weekly", retrieve it in a fresh session, change the target to 700, and retrieve 700 (not 500) in another fresh session. The payment-label version of the same proof is in [MILESTONE_1_EVIDENCE.md](MILESTONE_1_EVIDENCE.md).

**Real** means the production app, the production database and the Mainnet relayer. The owner did every write through the app. The agent's checks were read-only, apart from the shared recall rate-limit counter. No private keys, seed phrases or wallet addresses appear here.

## Mainnet configuration
- **SDK:** `@mysten-incubation/memwal` 0.1.11, through `src/adapters/memwal/memory.ts`.
- **Relayer:** fixed to `https://relayer.memory.walrus.xyz`. Any other `MEMWAL_SERVER_URL` stops every Walrus call (fail closed). Writes also require `MEMWAL_FREE_WRITES_CONFIRMED=true`.
- **Production settings** (feature switches and the presence of required secrets) are verified via `/api/health`, which reports booleans only. Values were not read.

## Agent identity and ownership
- **One operator account:** a single operator-managed MemWal account (`MEMWAL_ACCOUNT_ID`, held server-side) writes for every user.
- **Per-profile namespace:** each profile gets its own namespace, `sm-` + HMAC(`MEMWAL_NAMESPACE_SECRET`, profile ID). It's derived on the server from the signed-in profile; nothing in a request can choose it.
- **Checked for this run:** the stored namespace equals the re-derived one.
- **Not claimed:** user-owned MemWal accounts, client-side namespace isolation, or isolation between different MemWal accounts.

## Write operation
1. The user fills in the Savings goal form on Plan and confirms a review step. `POST /goals` (or `POST /goals/:id` to change a goal) then validates the input and stores an immutable `savings_goal` event with logical key `goal:<id>` and a queued memory job, in one transaction (`src/application/commands.ts` `saveGoal`).
2. The job is submitted to the relayer (`remember`), and the relayer's job ID is stored. The status is polled until a blob ID is returned.
3. The event is recalled from Walrus by its event ID. It is activated (`recall_confirmed`) only if the recalled text is an exact copy of the stored envelope.

Only an activated revision affects the plan (`activeEvents`, `goalOccurrences`).

## Retrieval operation
**Memories → Verify memories from Walrus** (`POST /memories/recall`, `src/application/memory-recall.ts`):
- recalls each active memory by event ID in the profile's namespace;
- checks profile, event, key, revision, the revision it replaces, and content against the saved copy;
- shows values taken from Walrus' answer, never from the database copy.

## Correction mechanism
Walrus memories are immutable, so a change is a new revision under the same logical key that names the revision it replaces (`supersedesEventId`):
- **Until confirmed:** the previous revision stays in use until the new one is confirmed. A failed change keeps it, and the user can retry.
- **One change at a time:** a database lock (`pending_logical_lock`) allows only one unsettled revision per goal.
- **Stale changes:** a change based on an old revision is refused (`VERSION_CONFLICT`).
- **No deletion:** nothing is physically overwritten or deleted.

## Cross-session test (all times UTC, 4 Nov 2026)

| Session | What happened | Evidence |
|---|---|---|
| A | Owner saved "Laptop", 500 USDC, weekly, by 4 Feb 2027 | Revision 1 recorded 21:48:32, `recall_confirmed` 21:49:13, first attempt, no error |
| B | Signed out (session revoked 21:50:37), signed in again (21:51:51), Verify from Walrus | Recall request 21:52:29 from the deployed endpoint |
| C | Signed out and in (21:54:10 / 21:54:31), changed to "Laptop MAc", 700 USDC | Revision 2 recorded 21:55:43, replaces revision 1, `recall_confirmed` 21:56:22, first attempt, no error |
| D | Saved a plan ending 2 Feb 2027, signed out (22:06:01), signed in (22:06:41), Verify from Walrus | Recall request 22:06:58 from the deployed endpoint |
| Agent check | Fresh process, PR #5's verification function against production and the relayer | 22:08:25: revision 2 **matched**, same blob, replaces revision 1 (supersession consistent). Walrus returned "Laptop MAc · 700 USDC · weekly · by 2027-02-04". It is the only active goal revision. |

"Owner-reported" steps (what the screen showed) are backed by the session, job and rate-limit records above.

### Memory identifiers

| Revision | Event ID | Relayer job ID | Walrus blob ID | Envelope SHA-256 |
|---|---|---|---|---|
| 1 (500) | `1330bee3-98da-43ee-809c-5337b0eb0f5f` | `e7dffc38-282c-487c-8140-2d7ab2510f1d` | `2lDhpDNBhgDYPzeNYM-W5Qa62wmLh_kbp4LXTUPTpFY` | `d132ea83c5a75b12640c4947b25d68abe4913808c8a9631dcf876e493168f4f5` |
| 2 (700) | `271a7b24-d004-42da-9014-fc5e4bd82d92` | `f44ae448-5662-40dc-b3aa-695c445d0c09` | `_MMDd_8p-3Wmt56JcSCOLVQu3bQp3nYjVSD9QFGx18g` | `4e2e7fad7aab3b555179ef0e84313df89992d9d6698c6b8f6061acffab57d7c0` |

Logical key: `goal:fa323987-f6a1-4d65-b95b-d866f5938099`. The SHA-256 is computed over `JSON.stringify` of the stored envelope. No public Walrus explorer link is given, because none was established for these blob IDs.

### The correction changes the recommendation
The live plan was computed read-only with the app's own `summarize()`, and compared with the same state if revision 2 were absent:

| | Revision 2 active (700): live | Revision 1 active (500): counterfactual |
|---|---|---|
| Suggested contribution | **50.00 USDC / week** | 35.72 USDC / week |
| Contributions before the plan end (2 Feb 2027) | 13 | 13 |
| Set aside from left to spend | **650.00 USDC** | 464.36 USDC |

The wallet held 0 USDC at the time, so "left to spend" is 0 in both cases and the plan shows a shortfall. The suggestion, the set-aside amount and the shortfall all follow the corrected goal.

## Error handling
- **Configuration:** a missing or unexpected relayer configuration, or unconfirmed free writes, fails closed. No write is sent.
- **Failed write:** a failed relayer write marks the job `failed`, and the previous revision stays active. Covered by the database test "M2 savings goal (mocked Walrus)".
- **Uncertain outcome:** a write whose outcome is uncertain is held as `submission_outcome_unknown` and never resubmitted blindly.
- **Verification verdicts:** matched / not returned / failed verification / unavailable / not checked. Each recall times out at 8 s, no new recall starts after 25 s, and calls are rate limited to 3/min per profile and 12/min globally.
- **Route checks** (CI and local Postgres): signed out 401, feature switch 503 `RELEASE_GATE`, missing memory consent 409 `CONSENT_REQUIRED`, another profile's goal 404, a goal ID in the body never overrides the path or ownership, owner/namespace fields 400, and a stacked change refused by the pending lock.

## Limitations
- **Isolation:** isolation between different MemWal accounts is not tested. Namespace filtering was shown only within the operator account.
- **"Saved so far"** is entered by the user, not derived from chain data.
- **One goal at a time.** No collision detection, what-if simulator or AI assistant.
- **Recovery:** account recovery from Walrus alone is not claimed. The database holds the structured event log, and Walrus is checked against it.
- **Balance consistency:** O04 (balance inclusion proof) remains open. Matched bill payments stay reserved until proven (`BALANCE_CONSISTENCY.md`). Goal contributions are never matched to payments.
