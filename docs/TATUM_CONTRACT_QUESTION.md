# Prepared provider question: atomic balance checkpoint

Draft only. No external message has been sent. A builder or authorized contact can send this through Tatum support without sharing any API key, private wallet data or credentials.

We use Sui Mainnet through `sui-mainnet-grpc.gateway.tatum.io`, installed `@mysten/sui@2.38.0` with the generated v2 StateService.GetBalance contract. We read the combined balance (coin objects plus address-held funds) for the exact native-USDC type and separately for SUI.

Our budgeting invariant requires proof that a current balance includes a particular successful payment checkpoint before releasing the matching bill reservation. The GetBalance response has amounts but no matching atomic checkpoint. The Sui implementation observed on this service reports `1.82.4-485613f749ed`; its response-info headers obtain the latest checkpoint independently after the balance operation.

Which supported Tatum API/field or documented consistency guarantee proves the owner/token balance at a given checkpoint, or provides an index watermark guaranteed to apply to that exact returned balance? Is there a supported snapshot read or other atomic alternative that includes address-held funds as well as coin objects?

Please identify exact request/response fields and any indexing-lag/finality conditions. A latest-chain-height observation alone is insufficient. We will verify the answer against installed types and actual responses before enabling payment-reservation release.

Public examples available for reproduction (unrelated to our builder or demo): reference `0x6d292ddc95b7d4c2e9d3d920091e1afe064ef1b62277dd36261a2e192881d8af`; outgoing `Gau4YSCsJZssVNTEE9jL8q8dxUDLq8fJBcdfYvseDwcG`, checkpoint `339116349`. No new transfer, funding or paid service is requested.
