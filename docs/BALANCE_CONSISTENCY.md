# Balance/payment consistency gate

The mandatory invariant is that paying a 50-USDC commitment changes B=500,C=200 to B=450,C=150 without changing Q=B−R−C. Releasing C against a pre-payment B would inflate Q. F08/F09 exercise this invariant with explicit fixture checkpoints; a fixture checkpoint is not evidence that the provider supplies one.

The installed Sui SDK GetBalance response provides amounts but no checkpoint tying those amounts to an atomic ledger snapshot. The adapter deliberately sets `Balance.checkpoint=null`. A match can be durably recorded, but the plan returns `pending_balance` and releases no reservation while its snapshot is unproven. Refreshing the same unsupported contract cannot by itself close this gate.

The actual Tatum service identified Sui server `1.82.4-485613f749ed`. Official Sui source at that revision was inspected:

- [GetBalance implementation](https://github.com/MystenLabs/sui/blob/485613f749ed/crates/sui-rpc-api/src/grpc/v2/state_service/get_balance.rs): owner balance is read through account indexes; no matching checkpoint is attached. Reviewed source blob SHA: `e8f6d87357fe54c5d29dfe6e0e706b3750acfbd0`.
- [Response headers](https://github.com/MystenLabs/sui/blob/485613f749ed/crates/sui-rpc-api/src/response.rs): `append_info_headers` independently obtains the latest checkpoint after the response operation. The `x-sui-checkpoint-height` header therefore cannot safely be treated as the atomic checkpoint of the earlier balance read.

These are source observations, not an assertion of undocumented hosted-index guarantees. Resolution requires a documented and actually tested Tatum snapshot/index-watermark contract, or another supported Tatum read proving the owner/token balance at a specified checkpoint. Verify installed types and real responses; then test delayed indexing, pre-payment observations, failed refresh and concurrent matching.

Do not infer correctness from wall-clock time, transaction finality alone, two equal balance reads, explorer labels or the latest-checkpoint header. No funds should be moved merely to investigate this. The read-only synthetic demo uses labelled fixture checkpoints and does not close the live contract gap. Personal accounts remain release-gated.

## 2 November 2026: planning enabled with a lower bound

At the owner's request, Plan is now available to real wallets behind `PERSONAL_PLAN_ENABLED`. Each balance observation records the Tatum service checkpoint read immediately *before* the GetBalance calls, as `Balance.checkpoint`. A matched payment at or below that checkpoint is treated as included and its reservation is released.

This is a lower bound, not the atomic snapshot described above. If the owner-balance index lagged behind the reported checkpoint at read time, a just-matched payment could be released against a balance that does not yet include it, overstating the remaining amount until the next refresh. The window is the indexing lag; refreshing the balance closes it. The original gate (a documented Tatum snapshot contract) is still the proper fix.

**Withdrawn 4 November 2026.** Investigation showed the lower bound is not supported by the service's source (below), so the release rule was removed.

## 4 November 2026: conservative allowance (current)

**Evidence.**
- Live service: a read-only GetServiceInfo call returned `server: sui-node/1.82.4-485613f749ed`.
- Installed `@mysten/sui@2.38.0`: `GetBalanceResponse` carries only `balance`, `coinBalance` and `addressBalance`. `ListBalances` is the same. The `ListTransactions` watermark describes a transaction scan, not a balance.
- Sui source at that revision:
  - [`read_store.rs`](https://github.com/MystenLabs/sui/blob/485613f749ed/crates/sui-rpc-store/src/reader/read_store.rs): `get_latest_checkpoint`, which backs GetServiceInfo `checkpoint_height` and `x-sui-checkpoint-height`, returns the highest committed checkpoint summary. Its comment: there is "no ambient 'min watermark across pipelines' guarantee".
  - `sui-rpc-store`: balances are a separate, asynchronously indexed pipeline with their own watermark (`get_highest_live_indexed_checkpoint_seq_number`).
  - [`health.rs`](https://github.com/MystenLabs/sui/blob/485613f749ed/crates/sui-rpc-api/src/service/health.rs) uses that watermark only internally and treats a lag of up to 60 checkpoints as healthy. It is not exposed over gRPC.
- No Tatum or Sui document gives GetBalance a snapshot or consistency guarantee.
- A read-only probe of 18 checkpoint observations around GetBalance saw no backward step. That cannot show whether the gateway routes all calls to one node.

**Rule now.**
- `Balance.checkpoint` means a *proven* inclusion checkpoint. It is `null` for every live Tatum balance.
- The height read before GetBalance is kept as `observedTip` and is never used for release. Stored rows keep it in the `checkpoint` column, read back as `observedTip`; no migration.
- A matched payment releases its reservation only when `balance.checkpoint` proves inclusion. Otherwise its amount stays reserved and is reported as `held`.
- If the balance already includes the payment, left to spend is understated by `held`. If not, it is exact. It is never overstated.
- The plan shows the number with a note instead of blocking (`src/domain/planning.ts`, `tests/balance-inclusion.test.ts`, including a property test of the never-overstates rule).

**Impact before the fix:** none. Production had 0 commitment allocations, 0 plans with an end date and 0 commitment rules on 4 Nov 2026, so no reservation was ever released under the lower bound.

**Still open (O04):** a provider contract proving inclusion, for example an exposed live-index watermark with sticky routing, or a checkpoint-scoped balance read. Until then held payments stay held.
