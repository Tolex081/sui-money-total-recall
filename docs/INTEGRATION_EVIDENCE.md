# Integration evidence

Checked during this build on 28 October 2026. Exact UTC observations and payloads are in the linked public-safe JSON artifacts. No private credential, owner key or personal export belongs here.

| Boundary | Actual evidence | Status / limit |
|---|---|---|
| Tatum Mainnet identity | `evidence/public/live-smoke.json`: chain name and genesis chain ID returned by GetServiceInfo | Authenticated live pass |
| Native-USDC/SUI metadata | Same report: exact canonical types, USDC 6 decimals and SUI 9 | Authenticated live pass |
| Balances | Same report: legitimate zero USDC distinguished from unavailable; SUI separate | Authenticated live pass; financial snapshot watermark still under review |
| History stream | Same report: bounded affected-address query and terminal CHECKPOINT_BOUND | Transport pass; initial query had zero movements |
| Populated native-USDC history | `evidence/public/reference-history.json`: real signed deltas in both directions and three ITEM_LIMIT pages with different resume cursors | Authenticated live pass for complex review operations; not ordinary-payment classification proof |
| Ordinary incoming/outgoing transfer | `evidence/public/transfer-reference.json` | Passed: successful +50 and −60000000 native-USDC base units; exact type, direct transaction re-read and two-page resume. Incoming sender differs from reference wallet. |
| Signed MemWal recall | `evidence/public/live-smoke.json` | Authenticated access pass; public health alone was not counted |
| Mainnet write and matching recall | Same report: completed job `7c602459-5474-4e9c-8ff2-6c9e4b567702`, blob `J7WMooZiPKy0q9BGM5IPfyeBqOYhgpWH_ECfws3Zs-Q` | One synthetic lifecycle passed; not a personal learning story |
| Product seed | `evidence/public/seed-mainnet.json` | All 24 approved events stored and matching signed recall confirmed. Read-only audit verifies active metadata and every expiry beyond 30 November 2026. |
| PostgreSQL | `evidence/public/db-tests.json`, versioned migrations | Real isolated-schema migration/auth/allocation-race tests passed |
| Node deployment | `evidence/public/deployed-runtime.json`, private `/api/internal/spike` | Actual Node v24.21.0 Linux x64 passed Tatum, signed MemWal recall and PostgreSQL write/read. Enhanced production transaction probe requires final redeploy/rerun. |

Public reference addresses/transactions discovered through Tatum are unrelated to the builder's own wallet and the fictional financial dataset. Explorer links are for inspection; status and amounts must be established independently through actual Tatum responses. Complex operations are explicitly outside supported spending classification.

Current official documentation: https://docs.tatum.io/reference/sui-grpc (the brief's `/oa/reference/sui-grpc` URL returned 404), https://docs.tatum.io/reference/rpc-sui, https://www.docs.sui.io/develop/accessing-data/grpc/using-grpc and https://docs.wal.app/walrus-memory/sdk/api-reference. Native USDC identity was checked against Circle's current contract-address page.

The installed Sui SDK exposes an affected-address predicate, DNF terms, progress watermarks and explicit QueryEnd reasons. Live filters require full canonical package addresses; a short `0x2` Move-call path was rejected with INVALID_ARGUMENT and corrected. Metadata enumeration follows `has_more` even for empty namespace-filtered pages. The final read-only audit verified all 24 active seed records, matching recalls and May 2027 expiry metadata; retention covers the required 30 November 2026 target.

Public reference: `0x6d292ddc95b7d4c2e9d3d920091e1afe064ef1b62277dd36261a2e192881d8af`. Incoming [GR7GQ1heAEa7bh1eyg6KVhVo87Y35VPR52gZt2gyLLUm](https://suiscan.xyz/mainnet/tx/GR7GQ1heAEa7bh1eyg6KVhVo87Y35VPR52gZt2gyLLUm) is **0.000050 USDC**, not 50 USDC; outgoing [Gau4YSCsJZssVNTEE9jL8q8dxUDLq8fJBcdfYvseDwcG](https://suiscan.xyz/mainnet/tx/Gau4YSCsJZssVNTEE9jL8q8dxUDLq8fJBcdfYvseDwcG) is 60 USDC. These links provide public inspection sources. Success, type, delta and operation classification were established independently through Tatum, not explorer labels. The verified wallet/digests are configured in ignored `.env.local`.

Live financial limitation: GetBalance has no proven atomic checkpoint. See `BALANCE_CONSISTENCY.md` for the inspected official implementation and the exact provider-contract blocker. Current official combined-balance guidance: https://www.docs.sui.io/onchain-finance/asset-custody/address-balances/using-address-balances and https://www.docs.sui.io/onchain-finance/asset-custody/address-balances/migrate-address-balances. Coin-object totals alone would omit address-held balances; the adapter reads the combined balance.

Normalization contract: the official [Sui balance derivation at the observed revision](https://github.com/MystenLabs/sui/blob/485613f749ed/crates/sui-types/src/balance_change.rs) aggregates coin-object and address-accumulator changes in a map keyed by `(address, coin_type)`. The adapter treats each returned entry as that net change. Repeated identical transport entries are deduplicated; conflicting net values for the same pair fail closed. Installed generated protobuf fixtures in `tests/tatum-adapter.test.ts` exercise duplicates, response ordering, multi-recipient transactions, bridged lookalikes, arbitrary Move calls, failed execution and sponsor-paid gas. These are explicitly synthetic adapter tests; actual public Tatum transaction evidence is recorded separately.
