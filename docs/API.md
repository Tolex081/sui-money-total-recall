# Internal API

All handlers run in Node. Bodies are strict Zod-validated JSON, bounded to 16 KB. Personal endpoints derive profile and namespace from a hashed durable session, never client-supplied ownership. State-changing requests require the configured same origin and session CSRF token. Errors contain a code, readable message, retryability and request ID; no stack, secret or other-user existence is returned.

| Method / route | Input / result |
|---|---|
| POST /api/auth/challenge | `{wallet}` → nonce-bound readable message and five-minute expiry |
| POST /api/auth/verify | `{id,wallet,signature}` → verified profile and CSRF; secure HTTP-only session cookie on HTTPS |
| POST /api/auth/logout | Revoke hashed session; clear cookies |
| GET /api/account | Current wallet, timezone and consent version |
| GET /api/state | Complete current profile state for the core UI |
| GET /api/today | Exact planning/spending calculations with provenance |
| GET /api/balances | Latest verified observation or unknown |
| GET /api/activity?offset= | Page of 25 movements, annotations and coverage |
| GET /api/plan | Explicit plan, rules, occurrences and allocations |
| POST /api/plan | End date/kind, decimal reserve, optional expected income, timezone, expected version and consent; preview acknowledgement for timezone change |
| POST /api/commitments | Alias, decimal amount, category, start local date, recurrence; optional ID/version for edits |
| POST /api/preferences/reserve | Decimal reserve and expected memory revision; queues a preference; never silently overwrites an explicit plan |
| POST /api/commitment-allocations/:id/reverse | Scoped reversal; restores the obligation without changing wallet facts |
| POST /api/sync | `{kind: "balances" | "history"}`; bounded work and persisted progress |
| POST /api/activity/:id/annotation | Category/note/own-transfer interpretation, expected revision and superseded ID; queues memory |
| POST /api/destination-rules | Explicit own/category default confirmed separately from a note |
| POST /api/reimbursements | `{sourceId,targetId,amount}`; atomic pending capacity reservation and memory event |
| POST /api/commitments/:occurrenceId/allocate | Verified source movement plus decimal amount; settlement reservation remains pending if balance consistency is unproven |
| GET /api/suggestions | Transparent weekly patterns, excluding unchanged confirmed rejections |
| POST /api/suggestions/:id/decision | Confirm/reject; confirmation includes user-selected amount/date/alias and optional explicit association |
| GET /api/memory-jobs/:id | Scoped outbox/job status and provenance |
| POST /api/memory-jobs/advance | Advance one bounded job step; no unawaited work after response |
| POST /api/memories/recall | Enumerates scoped storage availability/expiry, then signed recall; validates identities against structured records |
| GET /api/memories | Complete profile event history and cached/verified status |
| POST /api/memories/:id/deactivate | Expected revision plus reason; prior rule stays active while pending |
| POST /api/memories/:id/correct | Confirmed recurrence amount/date/frequency correction, or explicit reimbursement reversal; new revision waits for storage/recall |
| GET /api/learning-comparison | Hypothetical same-input comparison |
| GET /api/export | Versioned user-only JSON; no signatures, nonces, credentials or session tokens |
| GET /api/demo/* | Public read-only fictional data; no public writes or on-demand external scans |
| GET /api/health | Configuration presence only; never a claim of authenticated integration |
| GET /api/proof | Cached sanitized evidence from approved public checks |
| POST /api/internal/spike | Private admin-header endpoint for bounded Tatum/recall/PostgreSQL runtime proof; no chain or memory writes |

Release gating is separate from authentication: `PERSONAL_ACCESS_ENABLED=false` blocks personal production use while integration acceptance is unfinished. Public demo writes always fail. A gate cannot satisfy a missing mandatory feature or acceptance test.

Known gaps and pending route-level attack coverage are recorded in OPEN_ITEMS.md; the table describes implemented endpoints, not a blanket claim that every acceptance is passed.
