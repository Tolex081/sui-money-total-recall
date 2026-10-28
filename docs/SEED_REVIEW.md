# Mainnet seed batch for explicit approval

Prepared payload: `src/domain/seed.ts`; deterministic IDs prefixed `sm-demo-v1-`. Exactly **24 synthetic product events** in the configured `MEMWAL_NAMESPACE_DEMO`, using the existing registered delegate. The script targets only the managed Mainnet relayer and refuses operation unless free sponsored writes are confirmed. No funds, transactions or account funding are requested. Existing completed IDs are not resubmitted. At most four new writes per minute; pending remote jobs are resumed.

These are persistent encrypted Walrus records processed in plaintext by the operator/relayer. Actual expiry is recorded from metadata; retention through 30 November is a verification target, not an authorized paid renewal. No real people, wallet addresses, chain digests or personal notes are included. Financial records are explicitly fictional.

| # | Event | Synthetic context / effect |
|---|---|---|
| 1 | explanation-lunch | Food; lunch with a friend |
| 2 | explanation-groceries | Groceries; shared grocery shop |
| 3 | explanation-book | Learning; a new book |
| 4 | explanation-transport-1 | First weekly transport payment |
| 5 | explanation-transport-2 | Second weekly transport payment |
| 6 | explanation-transport-3 | Third weekly transport payment |
| 7 | category-market | Confirm Groceries as a fictional destination default |
| 8 | category-transport | Confirm Transport as a fictional destination default |
| 9 | category-cafe | Confirm Food as a fictional destination default |
| 10 | own-destination | Fictional second-wallet destination is user-classified own transfer |
| 11 | reimbursement-one | Link fictional incoming reimbursement to a 10-USDC allocation |
| 12 | reimbursement-two | Link the same fictional receipt to a separate capped 5-USDC allocation |
| 13 | recurring-groceries | Weekly 45-USDC groceries, next due 30 October |
| 14 | recurring-transport | Weekly 25-USDC transport, next due 29 October |
| 15 | recurring-book | Tentative confirmed weekly 12-USDC learning commitment |
| 16 | preference-reserve | Keep a virtual reserve of 180 USDC |
| 17 | preference-horizon | Plan until expected income date |
| 18 | preference-category | Keep unknown spending visible |
| 19 | correct-category | Supersede the book explanation with a learning category and revised note |
| 20 | correct-transport | Supersede transport recurrence with 22 USDC weekly |
| 21 | correct-note | Supersede lunch note to mark it one-time |
| 22 | correct-allocation | Reverse the fictional 5-USDC allocation with correction history |
| 23 | disable-category-cafe | Stop applying a category rule inferred from one lunch |
| 24 | disable-recurring-book | Stop treating a one-time book as a weekly obligation |

Seed records illustrate valid supersession/deactivation. Stored blob count differs from active logical rule count. The public replay must label its fixed states; these are not real personal learning sessions. The real cross-session requirement remains separate.

Approval status: explicitly approved by the builder in chat on 28 October 2026. Approval covers exactly this reviewed 24-event batch at no more than four writes per minute, with successful storage/recall evidence required. No transfers, paid renewals, additional records or changed payloads are authorized. Automatic approval review had rejected the initial attempted batch; no seed submission occurred from that rejected command.
