# Integration evidence

Checked during this build on 28 October 2026. Exact UTC observations and payloads are in the linked public-safe JSON artifacts. No private credential, owner key or personal export belongs here.

| Boundary | Actual evidence | Status / limit |
|---|---|---|
| Tatum Mainnet identity | `evidence/public/live-smoke.json`: chain name and genesis chain ID returned by GetServiceInfo | Authenticated live pass |
| Native-USDC/SUI metadata | Same report: exact canonical types, USDC 6 decimals and SUI 9 | Authenticated live pass |
| Balances | Same report: legitimate zero USDC distinguished from unavailable; SUI separate | Authenticated live pass; financial snapshot watermark still under review |
| History stream | Same report: bounded affected-address query and terminal CHECKPOINT_BOUND | Transport pass; initial query had zero movements |
| Populated native-USDC history | `evidence/public/reference-history.json`: real signed deltas in both directions and three ITEM_LIMIT pages with different resume cursors | Authenticated live pass for complex review operations; not ordinary-payment classification proof |
| Ordinary incoming/outgoing transfer | `evidence/public/transfer-reference.json` | Investigation result is authoritative; never replace an unproven result with an invented digest |
| Signed MemWal recall | `evidence/public/live-smoke.json` | Authenticated access pass; public health alone was not counted |
| Mainnet write and matching recall | Same report: completed job `7c602459-5474-4e9c-8ff2-6c9e4b567702`, blob `J7WMooZiPKy0q9BGM5IPfyeBqOYhgpWH_ECfws3Zs-Q` | One synthetic lifecycle passed; not a personal learning story |
| Product seed | `evidence/public/seed-mainnet.json` | Exact approved 24-event batch in progress; count only recall-confirmed available stored unique blobs |
| PostgreSQL | `evidence/public/db-tests.json`, versioned migrations | Real isolated-schema migration/auth/allocation-race tests passed |
| Node deployment | `/api/internal/spike` prepared | Not yet deployed/tested; local build is not deployed proof |

Public reference addresses/transactions discovered through Tatum are unrelated to the builder's own wallet and the fictional financial dataset. Explorer links are for inspection; status and amounts must be established independently through actual Tatum responses. Complex operations are explicitly outside supported spending classification.

Current official documentation: https://docs.tatum.io/reference/sui-grpc (the brief's `/oa/reference/sui-grpc` URL returned 404), https://docs.tatum.io/reference/rpc-sui, https://www.docs.sui.io/develop/accessing-data/grpc/using-grpc and https://docs.wal.app/walrus-memory/sdk/api-reference. Native USDC identity was checked against Circle's current contract-address page.

The installed Sui SDK exposes an affected-address predicate, DNF terms, progress watermarks and explicit QueryEnd reasons. Live filters require full canonical package addresses; a short `0x2` Move-call path was rejected with INVALID_ARGUMENT and corrected. Metadata enumeration follows `has_more` even for empty namespace-filtered pages. Actual seed metadata has reported active records with an expiry in May 2027; retention is not certified until the full approved manifest is verified.
