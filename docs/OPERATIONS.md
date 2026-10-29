# Operations

The fresh Vercel project is `sui-money` on the verified Hobby team. Neon resource `sui-money-ledger` was provisioned with the explicit `free_v3` plan after builder acceptance of marketplace terms. No paid upgrade, billing attachment or funds transfer is authorized.

Configure credentials privately in `.env.local`. Tatum uses the Mainnet gRPC target and `x-api-key` metadata. MemWal uses a registered delegate and account object ID; never the owner key. Confirm the actual account uses sponsored writes before setting `MEMWAL_FREE_WRITES_CONFIRMED=true`. The builder explicitly approved only the exact 24-event batch in SEED_REVIEW.md, in addition to the single completed smoke event.

`scripts/configure-local.mjs` merges missing provisioned database settings from an ignored `.env.vercel.local` file. It generates random application secrets without displaying values. Do not overwrite `.env.local` with a fresh hosting pull; use a separate ignored destination and merge deliberately. `.env.example` must contain no credentials.

`npm run db:migrate` applies versioned migrations. The application uses pooled PostgreSQL with a small connection pool, statement deadlines and explicit transactions. `test:db` uses the unpooled URL in TEST_DATABASE_URL for an isolated disposable schema because Neon's pooler rejects search_path startup parameters. CI uses a local PostgreSQL service. Never point cleanup at the application schema.

Run `smoke:live` for read evidence. `--write` is an explicit separate synthetic write and should not be repeated to pad counts. Retain its returned job ID before waiting. `seed:mainnet -- --write` resumes the exact approved deterministic seed IDs, submits at most four per durable minute window, polls accepted jobs and records matching recalls/metadata. If interrupted while submitting, reconcile outcome; never blindly reset to queued.

Pending personal jobs advance through authenticated client requests or operator recovery. A closed browser may leave jobs pending until the next visit. GET status is not permission to activate; only matching confirmed evidence activates an interpretation. Known remote duplicates must be reported and count once logically.

Mainnet retention target is 30 November 2026. Inspect actual `expires_at`/`end_epoch`; absent metadata is unknown. No paid renewal or new payloads are authorized. If expiry does not cover judging, report the exact gap and obtain builder authorization for a concrete available resolution. Hiding context is not permanent deletion from storage/backups.

Rotation: replace compromised Tatum/delegate/database credentials in their dashboards and hosting Secrets, then private local configuration. Preserve existing namespace mappings when rotating the namespace HMAC secret. Session-token hashes can be revoked database-side. Use a fresh delegate, never an owner private key, for server recovery.

Backups: export user-scoped JSON for portability and take a provider-supported database backup before schema changes. Keep private exports outside git. Walrus semantic recall alone is not a ledger backup. Rollback is migration-specific: stop personal writes, restore a verified backup/previous deployment, and keep immutable chain facts and correction history. Do not run destructive down migrations against real data without a reviewed backup and explicit authorization.

Deployment secrets are sent via CLI stdin by `runtime-env.mjs`; never put values in shell arguments or logs. Production requires APP_MODE=live. Personal accounts remain release-gated until the acceptance matrix passes. Preview deployments must not receive production user data or write to production namespaces. `/api/internal/spike` is private and exercises actual Node runtime reads plus a sanitized PostgreSQL write/read.

Before push/deploy: lint, types, domain/adapter tests, DB tests, browser checks, build, source/client secret scan, evidence review. After deploy: inspect real function logs, run the bounded runtime spike, check public pages signed out, then verify actual wallet compatibility. Build success alone proves none of those boundaries.

Tatum read recovery is bounded to two attempts for RESOURCE_EXHAUSTED, UNAVAILABLE and DEADLINE_EXCEEDED, with 250–499ms jitter before the one retry. Every attempt uses the read-budget callback; local budget rejection never retries itself. The installed native transport has a 12-second per-call timeout. Authentication and NOT_FOUND/OUT_OF_RANGE errors do not retry. These read retries never wrap memory submissions, database mutations, wallet signing or value transfers.

History buffers a complete stream page until both its query termination and final RPC status pass. Interruption discards that attempt's movements and cursor; the next attempt starts at the original durable frontier. Empty SCAN_LIMIT pages may advance a real cursor while remaining partial. A stalled cursor fails explicitly. Provider retention/unavailability does not advance saved coverage. `npm run verify:history` performs only authenticated reads of the documented unrelated public reference, using its frozen bounds, at most four pages plus a repeated first page and at most 16 total provider attempts. Its report distinguishes real Mainnet resume from explicit local error fixtures.
