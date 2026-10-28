# Balance/payment consistency gate

The mandatory invariant is that paying a 50-USDC commitment changes B=500,C=200 to B=450,C=150 without changing Q=B−R−C. Releasing C against a pre-payment B would inflate Q. F08/F09 exercise this invariant with explicit fixture checkpoints; a fixture checkpoint is not evidence that the provider supplies one.

The installed Sui SDK GetBalance response provides amounts but no checkpoint tying those amounts to an atomic ledger snapshot. The adapter deliberately sets `Balance.checkpoint=null`. A match can be durably recorded, but the plan returns `pending_balance` and releases no reservation while its snapshot is unproven. Refreshing the same unsupported contract cannot by itself close this gate.

The actual Tatum service identified Sui server `1.82.4-485613f749ed`. Official Sui source at that revision was inspected:

- [GetBalance implementation](https://github.com/MystenLabs/sui/blob/485613f749ed/crates/sui-rpc-api/src/grpc/v2/state_service/get_balance.rs): owner balance is read through account indexes; no matching checkpoint is attached. Reviewed source blob SHA: `e8f6d87357fe54c5d29dfe6e0e706b3750acfbd0`.
- [Response headers](https://github.com/MystenLabs/sui/blob/485613f749ed/crates/sui-rpc-api/src/response.rs): `append_info_headers` independently obtains the latest checkpoint after the response operation. The `x-sui-checkpoint-height` header therefore cannot safely be treated as the atomic checkpoint of the earlier balance read.

These are source observations, not an assertion of undocumented hosted-index guarantees. Resolution requires a documented and actually tested Tatum snapshot/index-watermark contract, or another supported Tatum read proving the owner/token balance at a specified checkpoint. Verify installed types and real responses; then test delayed indexing, pre-payment observations, failed refresh and concurrent matching.

Do not infer correctness from wall-clock time, transaction finality alone, two equal balance reads, explorer labels or the latest-checkpoint header. No funds should be moved merely to investigate this. The read-only synthetic demo uses labelled fixture checkpoints and does not close the live contract gap. Personal accounts remain release-gated.
