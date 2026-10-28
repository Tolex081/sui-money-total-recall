# SUI MONEY: complete implementation brief for Codex

**Working name:** Sui Money. This is a descriptive placeholder, not a checked brand or domain.
**Version:** 2.0, prepared 28 October 2026, Africa/Lagos.
**Builder:** Tolex. **Submission track:** Consumer Finance Apps.
**Event:** Total Recall, Tatum x Walrus Memory Hackathon.
**Deadline:** 10 November 2026, 17:00 UTC / 18:00 Africa/Lagos.
**Internal submission target:** 8 November 2026, leaving time to correct problems.
**Primary award target:** Consumer Finance Apps. **Secondary target:** Best Walrus Memory.

> Build a spending tracker and forward budget for Sui users. Tatum supplies verified wallet facts. Walrus Memory preserves explanations, confirmed habits and corrections that visibly change the next spending summary or plan.

This document replaces the earlier HANDSHAKE brief for product scope, architecture and acceptance criteria. Do not build P2P trading, naira conversion, counterparty reputation or escrow. Preserve the original brief as historical context only. This is an implementation specification, not a claim that live integrations have already passed.

## Contents

1. Authority, scope and agent instructions
2. Official event requirements and evidence
3. Judging strategy and traceability
4. Product definition and boundaries
5. User journeys, access and application modes
6. Required screens and interaction design
7. Exact financial rules
8. Tatum and Sui integration
9. Walrus Memory integration and learning
10. Persistence, records and concurrency
11. Architecture and application API
12. Security, privacy and ownership
13. Dependencies, configuration and deployment
14. Mandatory verification gates and open questions
15. Acceptance tests and quality checks
16. Demo data and Mainnet evidence
17. Delivery sequence and deadline plan
18. Documentation, blog, video and submission
19. Definition of done
20. Sources and provenance
21. Coding-agent kickoff instructions

## 1. Authority, scope and agent instructions

### 1.1 Requirement labels

- **OFFICIAL:** an event condition or published judging criterion, supported by sources in Section 20.
- **PRODUCT MUST:** a non-negotiable requirement of this agreed product. It must pass before calling the build complete, even if the event does not explicitly require it.
- **DESIGN DECISION:** a deliberate implementation choice in this brief, not a discovered API fact or event rule.
- **DOCUMENTED:** checked in official documentation on 28 October 2026; still requires installed-type checks and live proof where relevant.
- **UNVERIFIED:** requires account access, installed SDK inspection, organizer clarification or a real integration test. Never silently promote it to verified.

The user requires strict adherence to major requirements. A blocked requirement is a blocker, not an invitation to replace live functionality with screenshots, fixtures or a weaker product. No exceptions may be self-approved by the coding agent.

### 1.2 Order of authority

1. The user's explicit instructions and agreed product scope.
2. Applicable official event conditions, recorded with exact source and date.
3. This brief's product requirements and acceptance tests.
4. Verified installed SDK types, official API schemas and deployed service behavior.
5. Repository implementation details.

If official requirements conflict with the proposed implementation, report the conflict and block the affected release gate. Do not invent an interpretation that changes eligibility. If installed API shapes differ from examples here, use the verified shape, document the difference, and preserve the product behavior. Continue independent work while a blocker is unresolved.

### 1.3 Required agent behavior

1. Read this entire document before scaffolding. Create `docs/REQUIREMENTS.md`, `docs/VERIFICATION_REPORT.md`, `docs/OPEN_ITEMS.md`, `docs/BUILD_LOG.md` and `docs/EVIDENCE.md` first.
2. Recheck the official rules and event page. Save checked date, source URL, relevant facts and any differences. Do not assume that this document freezes third-party rules or quotas.
3. Never invent package versions, API payloads, endpoint paths, contract identifiers, filters, response fields, explorer URLs or service limits. Inspect official schemas, proto files and installed types.
4. Separate paper verification, local fixture tests, authenticated live tests and deployed tests in the evidence report.
5. Build the mandatory live integration spikes before a polished UI. A successful checkpoint read does not prove wallet history works.
6. No fake success states. Never silently fall back from live mode to mocks. Never describe synthetic payments as the user's real payments.
7. Do not weaken a MUST, omit a test, or mark an external action complete because its draft exists.
8. Keep all money arithmetic deterministic and exact. No LLM may calculate balances, classify payments without confirmation, or approve a commitment.
9. Never log, expose or commit secrets. Scan before each push and inspect the client bundle for accidental secret inclusion.
10. Keep a fresh repository for this build. The event permits materially new progress on existing projects, but a new repository is our evidence and scope choice, not an event eligibility assertion.
11. Use free service tiers only. Do not activate paid plans, attach a billing method, auto-upgrade, fund a wallet or initiate value transfers without the builder's explicit authorization.
12. No paid LLM dependency. The core product works through structured input, exact matching and deterministic suggestions.
13. Log sessions in UTC. Record actual development and learning dates; never backdate work or fabricate usage history.
14. If blocked for 30 minutes, record reproduction steps and the smallest next action. Continue unblocked work. A critical unresolved item still prevents completion.
15. Do not request approval for ordinary reversible implementation work. Ask for missing credentials or decisions only when truly necessary; never ask the builder to paste secrets into chat or commit them.

## 2. Official event requirements and evidence

Sources E1 and E2 were checked on 28 October 2026. Recheck before submission. The following is a concise implementation mapping, not a substitute for reading the rules.

| ID | Classification | Requirement | Required evidence |
| --- | --- | --- | --- |
| H01 | OFFICIAL | Walrus Memory writes on Mainnet. | Real completed writes, blob identifiers, signed recall and deployed proof. |
| H02 | OFFICIAL | Use Tatum for relevant onchain reads; technical judging explicitly names Sui RPC integration. | Deployed Sui Mainnet balance and transaction reads routed through Tatum. |
| H03 | OFFICIAL | Store at least 10 Mainnet memories. | At least 20 distinct product memories targeted, 15 confirmed active memories required by our audit. |
| H04 | OFFICIAL | Publish a blog explaining the app, both integrations and change over time. | Public article URL; claims supported by actual before/after evidence. |
| H05 | OFFICIAL | Provide a working demo and public repository. | Public deployed URL, public repo and reproducible setup. |
| H06 | OFFICIAL | Work must be original or authorized and built or materially advanced within the event period. | Dated commits and build log; attribution and dependency licenses. |
| H07 | OFFICIAL | Submit through the current event form before the deadline. | Submission receipt or confirmation retained by the builder. |
| H08 | OFFICIAL | Event rules list a short demo video, approximately 2–3 minutes. | Publicly accessible video URL, verified in a signed-out browser. |
| H09 | OFFICIAL | Meet eligibility and one-submission-per-person conditions. | Builder verifies eligibility and avoids a second conflicting submission. |
| H10 | PRODUCT MUST | Fit Consumer Finance with ordinary money language and demonstrable memory effects. | Spending and planning flow plus side-by-side learning evidence. |
| H11 | OPTIONAL EVENT BONUS | A public social post can earn bonus consideration. | Draft prepared; public URL recorded if the builder publishes. |

Do not confuse the official minimum of 10 memories with our larger operational target. Administrative health pings do not count as product learning. Seed facts may be synthetic, but their provenance must be visible. The organizer has not separately confirmed a narrower definition of a qualifying memory; confirm if needed and retain individually useful facts rather than padding a count.

### 2.1 Published-source inconsistencies requiring honest handling

- E1 advertises an agent-payment award while E2 currently calls the third special award a mystery bounty. This project does not pursue either. Do not expand scope to resolve an optional award discrepancy.
- E2's introduction contains feedback/form-platform wording, while its later track section expressly includes Consumer Finance. Record this inconsistency. Ask the organizer to clarify if eligibility scope is questioned; do not claim that every sentence of the published rules is unambiguous. Proceed with the explicitly published finance track, but the final rules review must record the builder's resolution or organizer clarification of any material ambiguity.
- The original HANDSHAKE brief treated the video as possibly optional and older SDK details as unknown. For this build, treat video delivery as required and use current installed APIs.

### 2.2 Event timeline

- Build period: 20 October to 10 November 2026.
- Submission closes: 10 November, 17:00 UTC / 18:00 Lagos.
- Review period shown by E1: 11–16 November; results expected 17 November.
- Keep deployment, credentials, memory retention and evidence available through results. Use **30 November 2026** as our retention target, not an official event requirement. Verify actual blob expiry and service operation; do not assume a sponsored write covers this period.

## 3. Judging strategy and traceability

The published scoring allocates 30% to integration, 30% to technical quality, 20% to creativity and 20% to presentation. The memory award emphasizes observable product improvement, not merely saving notes. [E1, E2]

| Criterion | Product demonstration | Evidence |
| --- | --- | --- |
| Integration | Actual balance and payment facts from Tatum; real Walrus recall changes classification explanations and confirmed planning rules. | `docs/INTEGRATION_EVIDENCE.md`, deployed `/proof`, fixtures and live smoke output. |
| Technical quality | Exact arithmetic, complete structured records, correct history coverage, reliable asynchronous memory jobs, isolation and meaningful tests. | CI, adapter tests, financial test vectors, deployed checks. |
| Creativity | One feedback loop connects explanations of past payments to a better next plan. No claim of being the first such app. | Three learning stories, reasons and before/after snapshots. |
| Presentation | A short mobile-friendly journey, honest source labels and a reproducible demo. | README, video, article, public URLs and screenshots. |

**Design objective:** every major number answers “where did this come from?” Every learned behavior answers “what did I confirm, and how do I change it?”

## 4. Product definition and boundaries

### 4.1 One-paragraph specification

Sui Money helps a person using native USDC on Sui understand past spending and plan the balance remaining before their next expected payment. The user authenticates with a Sui wallet, reads supported account activity, explains unfamiliar transactions, links reimbursements, identifies transfers between their own accounts, and enters upcoming USDC commitments and a reserve. Tatum is the source for Sui balance and settlement facts. Walrus Memory stores the context and confirmed rules that survive new sessions. Exact application logic turns those records into an auditable spending summary and a forward estimate. The app never takes custody, moves funds, trades, pays a bill or locks a reserve.

### 4.2 Initial audience and assets

- Users in any country who hold or spend **native USDC on Sui Mainnet**.
- One authenticated primary Sui address per user profile in v1. Switching the authenticated address selects a different profile, not an aggregated portfolio.
- Other addresses may be marked as the user's own destinations for classification. Their balances are **not** included in this profile's budget.
- USDC is the only budget unit. Label amounts `USDC`, not guaranteed fiat dollars.
- SUI is shown in its own unit for balance and network costs. Do not add SUI to USDC or show an unimplemented dollar conversion.
- Match exact coin types, never token symbols. Other assets and bridged lookalikes are excluded from budget totals.
- No bank accounts, cash transactions, naira integration, fiat conversion or off-ramp assumptions.

### 4.3 Mandatory capabilities

| ID | PRODUCT MUST |
| --- | --- |
| P01 | Public, no-wallet demo with synthetic finance data and real Mainnet memory retrieval. |
| P02 | Signed wallet authentication; one wallet profile; server-enforced user isolation. |
| P03 | Live Tatum USDC and SUI balances with timestamps and clear stale/error states. |
| P04 | Supported USDC transfer history with explicit coverage, pagination/resume and idempotent imports. |
| P05 | Activity explanation, category correction and own-transfer classification without altering chain facts. |
| P06 | Link actual incoming reimbursements to expenses with allocation caps. |
| P07 | Enter expected income date, USDC commitments and a virtual reserve. |
| P08 | Calculate the remaining and daily planning estimates exactly under Section 7. |
| P09 | Suggest a recurring weekly payment from eligible history; require confirmation to affect the plan. |
| P10 | Save and recall learned rules through Walrus; corrections and deactivations are retained as new events. |
| P11 | Show a learning comparison and source reasons with before/after numbers. |
| P12 | Durable structured storage, memory job tracking, retry control, export and graceful dependency failures. |
| P13 | Memory inspector and proof page with verifiable integration evidence. |
| P14 | Responsive and accessible interface; tests, CI, documents, video, article and submission preparation. |

### 4.4 Explicitly excluded

Multiple blockchains; arbitrary token support; token prices; swaps; staking; lending; yield; bridges; portfolio investing; bank connections; P2P exchange; escrow; reputation scores; shared pots; a subscription-management module; a freelancer invoicing/cash-flow product; child investing; payment execution; automated wallet signing; transaction approvals; smart contracts; an LLM chat interface; email/inbox access; push notifications; scheduled workers; mobile apps; social leaderboards; paid APIs; operator keys in the browser.

The planner may contain a user's upcoming payment, but do not turn it into a separate subscription watchdog or savings-circle product. The distinction is the combined spending explanation and personal planning loop.

## 5. User journeys, access and application modes

### 5.1 Public demo

1. Open `/demo` without a wallet or sign-in.
2. See a clearly labelled fictional account, a fixed demo date and seeded USDC financial state.
3. Open Activity and inspect an explanation or reimbursement.
4. Open the learning comparison. Recompute both views from the same fictional financial facts, using the stated learned rules in only one view.
5. Open `/proof` to see real Tatum and Walrus evidence, kept separate from fictional balances.

The public demo cannot write, change the shared seed, query other users or consume unlimited external calls. A demonstration of a change is a replay of recorded states, labelled as such. The builder records a real interactive change in their authenticated account for the video and article. Do not fake a save animation over a static seed.

### 5.2 Personal account

1. Connect a supported Sui wallet using current dApp Kit packages. Sign a readable, nonce-bound personal message to sign in. This is authentication, not a payment or token approval.
2. Confirm the wallet address, timezone and supported scope. Obtain consent to store financial context with the stated operator/relayer trust boundary.
3. Fetch balances and import the supported history window through Tatum.
4. Enter next expected income date, reserve and upcoming commitments. Expected income amount is optional and never counted as available money.
5. Review unknown outflows and enter short, non-identifying descriptions.
6. Confirm or reject a recurring suggestion. Wait for the Walrus-backed write to be confirmed before the learned rule becomes active.
7. Return in a new browser session, authenticate again and see the same plan and explanations. Show real recall results in “Why this changed.”

People without a funded wallet can explore the demo. Personal setup must handle zero USDC, zero SUI and no transactions. A read/sign-in flow must not require the user to spend gas. Creating the operator's Walrus account or making evidence transfers is separate setup and may have costs requiring verification and authorization.

### 5.3 Modes

- `APP_MODE=mock`: development/CI only; deterministic fixtures; prominent development indicator.
- `APP_MODE=live`: deployed production and authenticated integration tests. Missing credentials fail explicitly.
- `/demo` is a **dataset choice within live mode**, not a fallback to mock mode. Its fictional finance records and real Mainnet memories must be labelled separately.
- No shared owner passcode as a substitute for multi-user authentication. Operator administration is private and distinct from user sessions.

## 6. Required screens and interaction design

### 6.1 Routes

| Route | Required content |
| --- | --- |
| `/` | One-sentence value, supported assets, Open demo and Connect wallet. |
| `/today` | USDC balance, SUI panel, upcoming obligations, reserve, estimated remainder, daily estimate, sync status and reasons. |
| `/activity` | Paginated activity, date/type/category filters, unknown items, explanations, correction and reimbursement linking. |
| `/plan` | Expected income date, timezone, reserve, commitments, recurrence, suggestion review and payment matching. |
| `/memories` | Current user's learned events, status, versions, evidence references and remembered reasons. Demo version exposes only synthetic context. |
| `/proof` | Sanitized live Tatum checks, Mainnet memory evidence, public seed count, last checked time, links to docs. |
| `/about` | Scope, evidence labels, custody statement, operator ownership, retention and limitations. |
| `/demo/*` | Public read-only versions of the three core screens and learning replay. |

Use Today, Activity and Plan as the primary navigation. Technical evidence belongs in Details, Memories and Proof. Main screens should use language such as “Money remaining after your plan” and “Payment explanation,” rather than protocol jargon.

### 6.2 Today requirements

- Display verified balance and its observation time separately from all derived estimates.
- Show exactly which commitments and reserve were subtracted.
- Keep incoming money that has not settled outside the balance.
- If the plan is incomplete, show what is missing instead of a confident daily figure.
- If commitments exceed the balance, show a shortfall and zero discretionary allowance, not a negative spend recommendation.
- Show USDC and SUI separately. Do not imply a dollar peg eliminates market or redemption differences.
- Surface “Why this changed” and “Compare without learned rules.”

### 6.3 Activity requirements

- For each transaction show direction, exact supported asset amount, status, timestamp, category, explanation provenance and source.
- Chain-derived facts are immutable. User interpretation is editable and explicitly identified.
- Unknown outflows remain visible and counted conservatively; do not hide them from spending just because no category exists.
- Own transfers, payments, reimbursements, other inflows, failures and complex activity have distinct handling.
- Display coverage: fully imported within a stated range, partial, pruned/unavailable or not yet synced.
- Never describe an outgoing transfer as a specific store purchase without the user's explanation.

### 6.4 Plan requirements

- One-time and weekly/monthly commitments. Each recurrence generates uniquely identified occurrences.
- Amount, due date, category, short alias and optional expected destination. Amounts are USDC only.
- Commitment statuses: open, partly settled, settled, cancelled. Overdue is derived from due date plus unpaid amount.
- Settlement requires a verified eligible outgoing payment and a user-confirmed allocation. Suggestions do not settle commitments automatically.
- Reserve is a virtual amount, not an onchain account or locked fund.
- Support changing the income date, reserve, amount, due date or recurrence and deactivating learned rules.

### 6.5 UI quality

Must work at 390 px and 1440 px without horizontal page overflow. Use labelled inputs, keyboard access, visible focus, adequate contrast and non-color-only status indicators. Provide empty, loading, pending-save, stale, unauthorized, unsupported, partial-history, overcommitted and service-down states. Confirm timezone and date interpretations near the inputs. No invented charts, fake testimonials, fake merchant logos, or unsupported financial claims.

## 7. Exact financial rules

All definitions below are **design decisions**. Implement them as pure functions with explicit inputs and stable outputs. A free-text note cannot change a financial value until validated into a structured action.

### 7.1 Units and precision

- Read coin metadata through the verified adapter. Validate supported token identity before interpreting units.
- Use base-unit integer strings at external/JSON boundaries, `BigInt` or an exact decimal implementation internally, and an exact integer database column. Never use floating-point arithmetic for money.
- Reject negative user amounts, nonfinite values, scientific notation, excessive digits and fractional precision exceeding metadata.
- Format display without changing stored values. For a daily allowance displayed to two decimal places, round down and explain the small leftover amount. Reject malformed values; do not silently round user input.
- Integer totals may exceed one transaction's integer size; choose database precision accordingly and test limits.

### 7.2 Current balance is not reconstructed spending

`B` is a successfully read native-USDC balance of the single primary wallet, as of a recorded checkpoint/observation.

- Do not start with `B` and subtract historical expenses again: those movements are already reflected in `B`.
- Do not add a reimbursement to `B` again: a settled incoming payment is already reflected in `B`.
- A category correction never creates or removes money.
- A transfer to another wallet the user owns still reduces **this tracked wallet's** balance. Excluding it from consumption spending does not put those funds back into the budget.
- Missing or unavailable balance is `unknown`, not zero. Keep any last verified observation with its age and source.

### 7.3 Forward planning horizon

Store UTC instants for chain events and an IANA timezone plus local calendar dates for plans. Use a verified timezone-aware library; never divide milliseconds by 24 hours to infer local date counts.

Let:

- `today` = the current local date in the profile's chosen timezone.
- `payday` = the next expected income date selected by the user.
- `D` = calendar days between `today` and `payday`, excluding the payday itself.
- `R` = nonnegative virtual reserve.
- `C` = sum of unpaid portions of non-cancelled commitment occurrences due before `payday`, including today and unresolved overdue occurrences. Include each occurrence once.
- `Q = B - R - C` = signed remainder.
- `A = max(0, Q)` = discretionary amount under the entered plan.
- `shortfall = max(0, -Q)`.
- For a valid horizon, `daily = floorToDisplayUnit(A / D)`.

Require a future payday and support up to 90 calendar days in v1. If payday is today/past, missing, or beyond the supported horizon, show an explanation and require a date update; do not divide by zero or extend the date automatically. If the user has no predictable payday, allow an explicitly selected planning end date with identical math and different wording.

Unknown bills and future spending are not magically covered by `A`. Show “Estimate based on your tracked wallet and entered plan.” Expected income amount is displayed separately and excluded from `B`, `Q` and `A` until observed onchain. Arrival does not automatically prove it was the expected income; user confirmation links it.

Example fixture: `B=500 USDC`, `R=100`, `C=200`, `D=10` gives `Q=200`, `A=200`, `daily=20 USDC`. With `B=100`, `R=50`, `C=80`, show a `30 USDC` shortfall and `0` discretionary amount.

### 7.4 Lookback spending

- Aggregate each tracked wallet/token balance change once per transaction after normalization.
- An eligible successful USDC outflow is gross spending until explicitly classified as an own transfer or other supported non-spending movement. Unknown spending has its own category.
- Failures do not count as successful USDC spending. SUI network costs may still exist and remain separate.
- Self transfers are excluded from consumption spending after explicit user confirmation. Do not claim onchain proof of real-world ownership of the destination.
- Define `grossSpend` as eligible consumption outflows attributed to the selected expense period.
- Define `reimbursementsAllocated` as confirmed allocations of successful USDC inflows to those expenses, capped by the original eligible expense amounts.
- `netSpend = grossSpend - reimbursementsAllocated`. Never let an expense's net spend go below zero.
- Show the period of expense attribution and the data-as-of time. A reimbursement received later may restate an earlier period's net spending; preserve the correction history and show the reimbursement receipt date. It does not rewrite historical wallet cash movement.
- An ordinary incoming transfer is not automatically salary, profit or a reimbursement.
- An expected refund is not a settled reimbursement and does not reduce net spending.
- Swaps, bridging, staking, complex multi-asset operations and ambiguous transactions are labelled “Needs review / outside spending classification.” Their effect is already in the live balance. Exclude them from classified spending with an incompleteness warning, never silently call them zero activity.

### 7.5 Reimbursements

1. Select a verified incoming native-USDC transfer and one or more eligible expenses.
2. Confirm allocation amounts. Sum of allocations must not exceed the incoming amount or each expense's remaining reimbursable amount.
3. Use database transactions and uniqueness/allocation constraints to prevent two tabs allocating the same amount twice.
4. Reversing an allocation is a new correction event. Never delete chain facts.
5. Example: expense `40`, received reimbursement `15` gives gross `40`, reimbursement `15`, net `25`. Current balance is unchanged by the act of linking them.

### 7.6 Commitment payment matching

- Match suggestions by asset, outgoing amount, optional expected destination and date. User confirms before allocation.
- One verified outflow can be allocated across commitments up to its amount; each commitment can receive partial allocations up to its outstanding amount.
- A commitment-linked payment remains a spending transaction; matching it must not create a second expense row.
- Reject self transfers, failed transfers, unsupported coins and ineligible complex operations as settlement evidence.
- Remove only the allocated paid portion from `C`, and only once the current balance observation includes that payment's checkpoint. If this cannot be established, mark calculation pending and refresh balance. Never free a commitment while using the pre-payment balance.
- Before: `B=500, C=200, R=100` gives `A=200`. After a verified `50` payment reflected in balance: `B=450, C=150, R=100` still gives `A=200`. This is a mandatory test.
- Cancelling an obligation changes the plan; it does not create an incoming payment.
- Repeat occurrences have separate IDs and paid amounts. Paying this week does not mark next week settled.

### 7.7 Recurrence and dates

- Weekly recurrence advances local dates by seven days; monthly recurrence keeps the configured day and clamps to the month's last day when necessary. Do not permanently change a day-31 rule after February.
- Generate occurrences deterministically within the supported horizon. Unique key: `(profile, ruleId, scheduledLocalDate)`.
- Before confirming a learned recurrence, check for an explicit commitment already covering that payment. Offer to associate it with the existing commitment instead of creating another obligation. User-confirmed association is authoritative; matching descriptions alone cannot silently merge bills.
- A recurrence edit has an effective date. Preserve already settled occurrences and explicitly handle open future occurrences without duplicates.
- Open overdue obligations remain included until settled or cancelled. Do not drop them at midnight.
- Changing timezone triggers a visible preview of affected due dates. Preserve local-date intent for commitments and actual UTC event times.

### 7.8 Learning comparison

Use identical wallet facts, observation time, explicit current-plan inputs and date horizon in both views. Disable only the selected **learned** rules in the comparison, not bills the user explicitly entered for the current period. Label the comparison as hypothetical; it does not change the live plan.

- Own-transfer learning may change spending classification, not the live balance.
- A confirmed learned recurrence may add a future occurrence to the memory-enabled plan, decreasing `A` by its outstanding amount.
- A corrected learned amount may change a later plan. Explain exactly which event superseded which.
- “Why” must reference active confirmed event IDs and real blob IDs when shown as live evidence.

## 8. Tatum and Sui integration

### 8.1 Documentation-checked facts

- Tatum publishes a Sui Mainnet gRPC endpoint at `sui-mainnet-grpc.gateway.tatum.io:443`; authentication uses the Tatum key in `x-api-key` metadata. [T1, T2]
- The current method listing includes transaction, balance, metadata and filtered-list services. Names alone do not prove availability, retention or behavior on the builder's plan. [T1]
- Sui's migration docs describe `LedgerService.ListTransactions` as a stream with filters, progress cursors and termination reasons. Exact supported filters and provider behavior require schema and live verification. [S1]
- Use gRPC for the application's Tatum reads. Do not build around deprecated Sui JSON-RPC examples or assume a Tatum Sui GraphQL endpoint exists.
- Native USDC type from Circle [C1]:

```text
0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
```

Do not paste a guessed transaction digest into production code. Do not accept a token because its symbol says USDC.

### 8.2 Required adapter contract

Define application-owned interfaces; these names are **not** assertions about external SDK methods:

```ts
interface ChainPort {
  serviceStatus(): Promise<ServiceObservation>;
  coinMetadata(coinType: string): Promise<CoinMetadata>;
  balances(address: string): Promise<WalletBalanceObservation>;
  transaction(digest: string): Promise<ObservedTransaction>;
  historyPage(input: HistoryRequest): Promise<HistoryPage>;
}
```

`HistoryPage` must include normalized transactions, opaque continuation, queried bounds, scanned bounds and a completion/partial reason. `WalletBalanceObservation` must include per-asset exact amounts, observation time and a checkpoint/watermark if supported. Verify the chain identity from service metadata or another supported method; a URL containing “mainnet” alone is not sufficient proof.

### 8.3 Mandatory first integration spike

Before full UI work, prove all of the following with the actual key and deployed Node runtime:

1. Authenticated service/checkpoint read through Tatum on Sui Mainnet.
2. USDC metadata plus USDC and SUI balances for an authorized reference address, including a legitimate zero balance.
3. One successful reference transfer, one failed or unrelated fixture and a wrong-token fixture.
4. **Incoming and outgoing history for an address**, including an incoming payment where the tracked wallet is not the transaction sender.
5. Pagination/resume across a real supported scan boundary. A no-results scan page with a continuation is not completion.
6. Onchain status, tracked-owner balance changes, timestamp/checkpoint and token type mapping.
7. Balance observation consistent with a matched payment before releasing its commitment reservation.
8. Timeout, unauthenticated, unavailable, rate-limited, not-found and pruned/retention-limited cases.

Inspect the pinned `sui-apis` protos or installed generated types before selecting filters. A sender-only query is insufficient for a money tracker. Do not query Sui with Ethereum wallet-history parameters.

If Tatum's key/plan cannot provide both directions and resumable history, this is a **critical product blocker**. Do not silently replace it with pasted transaction IDs, an explorer scraper, another RPC vendor or a UI labelled automatic. Record the evidence and ask the builder to resolve access or explicitly approve a revised scope. Continue pure domain/UI work against clearly labelled mocks.

### 8.4 History policy

Design target: import the most recent 30 days initially, with explicit load-more/backfill in bounded chunks where the provider supports it. The exact available range is a live-check result, not a promised archival feature.

- Record lower/upper bounds, cursor/filter version, last scanned checkpoint and completion state per user.
- Resume from persisted progress, not an in-memory loop that may die in serverless hosting.
- Store normalized transactions and progress atomically; retry a page without duplication.
- A scan limit or retention gap leaves partial status. Do not display a complete monthly total for incomplete data.
- Manual refresh, bounded request-driven sync and a visible last-synced time are sufficient. No background service or permanent subscription is required.
- Never scan the entire chain from genesis to find one wallet's transfers.
- Preserve unsupported operations as reviewable exclusions; do not fabricate their economic purpose.

### 8.5 Normalization rules

Store full immutable provenance privately: chain, digest, checkpoint, actual event time, execution result, owner address, canonical coin type, signed base-unit balance delta and verified source.

- Normalize/canonicalize addresses using verified Sui utilities.
- Aggregate repeated balance-change entries for the same tracked address and coin before deriving a movement. Use a stable unique key that does not depend on response-array order.
- Do not equate transaction sender with token recipient or payer identity. Consider sponsored transactions and multiple recipients.
- A successful simple transfer must pass a conservative supported-operation check. If the parser cannot establish the type, leave it unclassified/complex.
- Separate SUI gas from USDC movement. Derive actual fee and payer using verified fields; do not charge the user for gas paid by a sponsor.
- Preserve exact raw-field provenance in a sanitized fixture. Do not expose API credentials or unrelated sensitive response data.

### 8.6 Resource controls

The Tatum plan guide currently advertises 100,000 free credits and 3 requests/second, subject to dashboard confirmation and method restrictions. [T3, T4] Implement conservative global and per-user throttling, bounded batches, caching, explicit refresh cooldown, retry with jitter and a request budget. Verify gRPC streaming charges and selected-method access; never translate REST plan wording into an assumed unlimited stream.

Production must not silently direct SDK or dApp Kit chain reads to a public fallback node. All application onchain reads covered by this product go through the verified Tatum adapter. Wallet-internal network behavior is outside the app's control and must not be claimed as Tatum traffic.

## 9. Walrus Memory integration and learning

### 9.1 Role and trust boundary

Walrus is the durable memory layer for confirmed personal context. It is not an arithmetic engine or a guarantee of complete query results. Structured storage holds the complete transaction ledger, plan records and validated projections for exact calculations.

DESIGN DECISION: use the documented server-managed multi-tenant pattern: one operator-owned MemWal account, server-only delegate key, a stable opaque namespace per authenticated profile and a separate public synthetic-demo namespace. [W3]

Consequences:

- The operator owns the shared Walrus account. Do **not** claim each end user independently owns these blobs or can revoke the operator's access.
- Namespace selection is server-derived from the authenticated profile. Namespaces organize records; they do not provide authorization by themselves.
- Use random stable identifiers or a secret-key HMAC mapping. Do not put wallet addresses, real names or payment aliases in public namespace names.
- Never give a shared delegate key or unrestricted MCP access to end users.
- Provide a user-scoped JSON export. Native user-owned accounts and cross-app migration are future work, not shipped claims.

### 9.2 Documentation-checked capabilities

Current docs list `remember`, job-status methods, `recall` and metadata listing methods. Writes are asynchronous. Semantic recall is bounded and relevance-ranked; even recent ordering is not an exhaustive enumeration. Metadata listing supports counting but does not return every memory's plaintext. Verify the installed package before calling any method. [W1]

The hosted relayer processes plaintext to generate embeddings/encryption. Storage is encrypted, but the operator and processing service are within the trust boundary. Sponsored storage does not imply permanent retention or an SLA. Check expiry and quota before relying on persistence. [W2, W4, W5]

### 9.3 Learned event types

Use a versioned application envelope plus a short natural-language sentence. The schema below is application-owned, not the MemWal wire schema:

```ts
type LearnedEventKind =
  | 'payment_explanation'
  | 'category_rule'
  | 'own_destination_rule'
  | 'reimbursement_link'
  | 'recurrence_confirmation'
  | 'suggestion_decision'
  | 'planning_preference'
  | 'correction'
  | 'deactivation';

interface LearnedEventEnvelope {
  schemaVersion: 1;
  eventId: string;
  logicalKey: string;
  revision: number;
  kind: LearnedEventKind;
  recordedAt: string;
  effectiveFrom: string;
  provenance: 'user_confirmed' | 'synthetic_demo';
  sourceRecordIds: string[];
  supersedesEventId?: string;
  payload: unknown; // replaced by a validated discriminated union in code
}
```

Use opaque source IDs and short non-identifying descriptions in memory text. Raw addresses/digests required for accounting remain privately in the ledger; memory can reference their opaque IDs. Do not upload complete wallets, raw RPC responses or every transaction as a memory. Validate bounded size and accepted fields on both sides.

### 9.4 Write lifecycle and idempotency

1. A structured user action is validated and stored with an immutable event ID, expected revision and a durable outbox entry in one database transaction.
2. The server submits that exact event to Walrus and persists the returned job identifier promptly.
3. Short authenticated polling requests advance status. No request waits unboundedly or relies on code running after the HTTP response ends.
4. Pending states distinguish queued, submitting, accepted, saved, recall-confirmed, failed and submission-outcome-unknown.
5. Poll the existing job before retrying. A network timeout after sending a request may still have created a job. Do not submit again blindly.
6. If submission outcome is unknown and no job ID was returned, reconcile by event ID using verified metadata/recall methods. If absence cannot be established, show uncertainty and block automatic duplicate submissions.
7. Apply the learned projection only after a completed write and a matching valid recall are confirmed. Pending changes may have an explicit preview but must not masquerade as an active remembered rule.
8. Use the event ID inside the memory to collapse duplicate submissions logically. Remote duplicate blobs must be reported; they do not become extra logical learning events or inflated evidence counts.
9. Use a per-logical-key pending lock and optimistic concurrency. A new correction cannot race an unresolved earlier revision into contradictory active rules.

The outbox is driven by authenticated client polls and operator CLI recovery; no paid queue or scheduled worker is required. Limit each request's work. A closed browser may leave a job pending until the next visit; report that limitation honestly.

### 9.4a Activation boundaries

Do not leave the builder to guess whether a pending memory changes a displayed amount:

| Action | Activation rule |
| --- | --- |
| Chain import or refreshed balance | Active after verified read and atomic database persistence; no memory write required for every imported transaction. |
| Explicit current-plan date, reserve or manually entered commitment | Active after its validated database save; it is an explicit plan input, not a learned inference. |
| Verified commitment-payment allocation | Active after atomic allocation and balance/checkpoint consistency; memory may retain context but cannot substitute for chain evidence. |
| Payment explanation, category correction, own-destination rule, reimbursement interpretation or learned recurrence | Store a pending structured event, show a clearly labelled preview, and activate its interpretation/projection only after completed Walrus write and matching recall. |
| Correction or deactivation of learned context | Keep the existing active revision until the replacement is confirmed, while clearly displaying the pending requested change. Never pretend an old rule was already removed. |

Pending reimbursement allocations reserve their proposed allocation capacity so concurrent requests cannot over-allocate while waiting. Failed/cancelled pending actions release capacity atomically. Permanent chain facts never wait for semantic memory processing. A financial plan depending on an unsettled interpretation must show that limitation rather than presenting a misleading completed save.

### 9.5 Recall and completeness

- At session start, recall relevant active preferences and context, then validate event identity, schema, profile, revision and status against the complete structured event log.
- Only the highest valid active revision of a logical key can affect the product. Never let an older semantic match revive a superseded rule.
- Reasons cite actual recalled text/event/blob associations. If cached, show the last verified time and mark it cached.
- All financial calculations use the complete validated projection, not a top-K query. A top-100 result is not proof that a namespace contains only 100 records.
- Use exhaustive supported metadata pagination for evidence counts. Follow `has_more`, even when namespace-filtered pages are empty; handle cursor invalidation and resync.
- Do not promise reconstruction of the whole ledger from Walrus alone. The ledger and structured event log require their own backup/export.
- If Walrus is unavailable, show previously verified projection as cached, stop activating new learned rules and retain pending writes. Base wallet facts and explicit plans can still render if available.
- Expired/deleted memory evidence is marked unavailable. Do not count it as active Mainnet evidence. Keep an audit of the last verified state; require explicit re-confirmation/reseeding where necessary, not silent resurrection.

### 9.6 Required learning behaviors

**L1: Remember a destination classification.** The user corrects an outflow to own transfer and explicitly chooses to use that rule for future eligible payments to that destination. A later matching transfer receives that classification with an explanation and an override option. The rule does not prove destination ownership.

**L2: Confirm a recurring expense.** Suggest a weekly payment only when at least three distinct eligible, user-classified historical transfers share the same exact counterparty/token/category, consecutive local-date gaps are 6–8 days and amounts are within 5% of their median. These are transparent heuristic design thresholds, not fraud or financial risk scores. The user chooses amount, next due date and recurrence before saving. Rejection is remembered and suppresses the same unchanged suggestion. Monthly recurrence may be entered manually; automatic monthly detection is not required.

**L3: Correct remembered planning context.** The user changes a learned recurrence amount or disables a rule. The next plan uses the active revision, old memories remain visible as superseded and the “Why” panel identifies the change.

Category default rules require explicit confirmation. A one-off note must not silently become a rule. Similarity search can surface context but cannot authorize classification or payment matching.

### 9.7 Resource policy

The current relayer guide describes weighted requests and account/delegate quotas. [W2] Verify actual hosted settings. Pace seed writes conservatively (initial target four per minute), honor rate-limit responses, and persist progress between requests. Do not put a numeric quota in user-facing copy unless it is observed and current. Shared-account limits affect all users; enforce global as well as per-user write limits.

## 10. Persistence, records and concurrency

### 10.1 Storage decision

Use a durable PostgreSQL database on a verified free plan, with Neon Free as the default proposed provider. Its current official plans include a free tier; actual builder access, connection pooling, limits and deployment connectivity remain mandatory setup checks. [D1]

This deliberately replaces the old brief's no-database approach. Financial totals need exhaustive records, uniqueness constraints, transactions and durable cursors. Do not substitute Vercel filesystem storage, process memory or browser local storage as the production source of truth.

Required state separation:

| State | Authoritative source |
| --- | --- |
| Onchain balance and execution facts | Sui observations obtained through Tatum; database caches retain provenance. |
| Imported activity and coverage | Complete normalized database records and sync progress. |
| Explicit current plan | Validated, versioned database records. |
| Learned events | Immutable application event records with completed Walrus write/recall evidence. |
| Active learned behavior | Deterministic projection of confirmed events, never bare semantic results. |
| Suggested patterns | Recomputable heuristics with source records; no authority until confirmed. |

### 10.2 Minimum logical tables

Names are internal design choices. Supply versioned migrations, indexes, foreign keys and rollback guidance.

- `profiles`: normalized wallet address, timezone, consent version, stable namespace mapping.
- `auth_challenges`: nonce hash, wallet, domain, message hash, issue/expiry, used time.
- `sessions`: hashed random session token, profile, expiry, revocation.
- `balance_observations`: exact USDC/SUI values, metadata version, source, observation/checkpoint and error state.
- `chain_movements`: immutable normalized facts, stable key, digest, asset, direction/delta, checkpoint/status and supported-operation classification.
- `sync_progress`: profile/filter version, cursor, bounded history coverage, termination reason and last successful scan.
- `payment_annotations`: versioned category and context referencing immutable chain facts.
- `reimbursement_allocations`: incoming movement, expense movement, exact amount and revision trail.
- `plans`: selected planning end/income date, reserve and version.
- `commitment_rules` and `commitment_occurrences`: recurrence definition, effective dates, due dates, open amount/status and provenance.
- `commitment_allocations`: outgoing movement, occurrence and exact amount.
- `learned_events`: validated envelope, logical key/revision, supersession, activation and source IDs.
- `memory_jobs`: outbox state, event ID, remote job/blob identifiers, retries, errors and verified expiry metadata.
- `learning_snapshots`: before/after outputs, fixed input observation IDs, active event IDs, date and provenance.
- `rate_limit_buckets`: durable app-wide and user-specific controls, or a verified equivalent.

Do not duplicate full raw RPC responses unnecessarily. Store the fields required for reconciliation and tests. Keep demo and real-user rows separate and explicitly keyed.

### 10.3 Required constraints

- Unique profile wallet, stable chain movement key and event ID.
- Unique logical-key/revision and recurring occurrence key.
- Positive allocation amounts, no over-allocation and referential integrity.
- Every user-owned row carries a profile ID; all reads/writes filter by server-authenticated profile.
- Row locking or serializable transactions protect reimbursement and commitment allocation sums.
- Optimistic versions reject stale edits with a clear conflict response.
- Applying a confirmed event and its projection is atomic. Restarting projection replay yields the same result without extra expenses or obligations.
- Persist a sync page and its cursor together. Interrupted imports are resumable.
- Keep cached balance freshness independent from historical coverage completeness.

### 10.4 Export and retention

Provide authenticated JSON export of the user's plan, normalized ledger, coverage, annotations and learned-event provenance, using integer strings and schema version. Exclude credentials, signatures, session tokens, nonces and unrelated users. Never describe export as a fully implemented native Walrus account transfer.

For the hackathon, avoid unnecessary sensitive notes and support disabling a rule or hiding context from product use. Hiding is not permanent deletion from backups or Walrus. Publish the actual retention/deletion limitations. Do not advertise immediate account-wide erasure unless an end-to-end deletion flow is implemented and verified.

## 11. Architecture and application API

### 11.1 Recommended stack

DESIGN DECISION: Next.js App Router, TypeScript strict mode, React, Tailwind, Zod, Vitest, Playwright, PostgreSQL, a lightweight typed database/migration library, current Mysten dApp Kit and MemWal SDK. Choose mutually compatible stable versions by checking their official docs and installed types, then commit one lockfile. Do not copy package versions from an old example.

Use `@mysten/dapp-kit-react` / the current supported dApp Kit packages, not the deprecated JSON-RPC-only legacy package. [S3] For server gRPC, choose the official supported Sui client or `@grpc/grpc-js` plus generated/loaded verified protos, based on actual Tatum authentication and streaming tests. Keep transport inside one adapter. Pin proto source commit and include all required dependency files if using proto loading.

### 11.2 Directory plan

```text
src/
  app/                    routes, pages, API handlers
  components/             accessible UI and evidence panels
  domain/
    money.ts              exact amounts and formatting
    normalize.ts          movement normalization and exclusions
    spending.ts           gross/net spending and reimbursements
    planning.ts           horizon, commitments, reserve, remainder
    recurrence.ts         occurrence generation and suggestion heuristic
    learning.ts           event validation, supersession, projection
    comparison.ts         identical-input learning comparison
  application/            use cases, authorization, sync and job advancement
  ports/                  chain, memory, ledger, clock and session interfaces
  adapters/
    tatum/                verified Sui gRPC transport
    memwal/               memory jobs, recall and metadata pagination
    postgres/             repositories and atomic operations
    mock/                 deterministic test adapters
  lib/                    config, auth, privacy, logging, rate limits
db/migrations/
scripts/
tests/fixtures/
tests/e2e/
docs/
evidence/public/          synthetic or explicitly public reference evidence only
```

Domain modules have no network or framework imports. Use an injectable clock and timezone inputs. No external SDK response type should leak into financial rules.

### 11.3 Internal HTTP API design

These are routes to implement, not third-party endpoint assertions. Refine exact payloads with shared Zod schemas and document them in `docs/API.md`.

| Route group | Responsibility |
| --- | --- |
| `POST /api/auth/challenge`, `/verify`, `/logout` | Nonce issuance, signature verification, session creation/revocation. |
| `GET /api/account` | Current authenticated profile, supported scope and consent state. |
| `POST /api/sync` | Bounded Tatum import/refresh with resumable state. |
| `GET /api/balances`, `/activity`, `/today`, `/plan` | Profile-scoped reads with provenance and freshness. |
| `POST /api/activity/:id/annotation` | Validated versioned interpretation; optional explicit learned rule. |
| `POST /api/reimbursements` | Atomic allocation or correction. |
| `POST /api/plan`, `/commitments`, `/commitments/:id/allocate` | Plan edits, recurrence and verified payment matching. |
| `POST /api/suggestions/:id/decision` | Confirm/reject with user-selected details and revision checks. |
| `GET /api/memory-jobs/:id`, `POST /api/memory-jobs/advance` | Authenticated bounded processing and status. |
| `GET /api/memories`, `/learning-comparison`, `/export` | Scoped provenance, hypothetical comparison and export. |
| `GET /api/demo/*` | Read-only synthetic dataset and its real memory evidence. |
| `GET /api/health`, `/api/proof` | Sanitized dependency checks and public seed/reference evidence. |

Authenticate every personal endpoint, validate body/query/IDs, enforce object ownership and return typed errors. Use request IDs and structured errors with retryability, without leaking secrets, stack traces or other users' existence. Public health is cached/rate-limited and cannot trigger writes. User sync and memory advancement have explicit time/work limits and idempotency keys where appropriate.

## 12. Security, privacy and ownership

### 12.1 Authentication

- Use wallet personal-message signing and server verification from the current Mysten SDK. [S2, S3]
- Challenge binds app domain/origin, Sui Mainnet intent, wallet address, random nonce, issue time and expiration. Use a five-minute challenge lifetime as a design decision.
- Store nonce state durably and consume atomically once. Reject replay, expiration, wrong address/domain, altered message and unsupported signature schemes gracefully.
- Derive verified signer address with SDK verification; a submitted public key or frontend connected-wallet object is not authentication.
- Issue a random session token in an `httpOnly`, `secure`, `sameSite=lax` cookie on HTTPS. Store only its hash, rotate on sign-in, revoke on logout and enforce expiration. Use seven days as the initial session lifetime, documented as a design choice.
- Protect state-changing requests with same-origin checks and a CSRF token or a verified equivalent. Do not rely on cookie flags alone.
- Wallet disconnect/account switch clears the client cache and revokes/changes the application session as appropriate. Never show wallet A's data while wallet B is connected.
- Do not request seed phrases, private keys, spending approvals or transaction signing for this read/planning product.

### 12.2 Authorization and data exposure

Server derives profile and namespace from the session. Reject arbitrary profile/namespace substitutions. Test direct-object-reference attacks across every resource type. Public demo and proof endpoints may expose only approved synthetic records and public reference transactions. Never publish real user's wallet balances, context, namespaces, exported records or memory IDs in shared proof output.

The operator's memory delegate may access the operator account's namespaces. State this accurately. The default relayer processes context plaintext. Do not use claims such as only-you access, absolute privacy, user-owned blobs or guaranteed permanent storage in this server-managed version.

### 12.3 Input and operational security

- Use aliases, category labels and minimal notes. Warn against names, phone numbers, account numbers and confidential information.
- Reject obvious private-key/seed material and common PII patterns in free-text fields. Apply field-specific validation: wallet and digest fields need Sui validation, not a blanket long-number ban.
- Render memory and user text as untrusted text. No raw HTML, instruction execution, dynamic code or LLM prompt authority.
- Server-only Tatum, MemWal and database secrets. No secret in `NEXT_PUBLIC_*`, logs, URLs, public evidence or client bundles.
- Add secure headers, a practical CSP, content-type protection, request/body size limits and redacted structured logging.
- Use durable quotas for shared services. A per-process in-memory limiter is not a production isolation mechanism.
- Use synthetic demo data. Employer documents, contact lists, internal processes and third-party personal data are outside scope.
- Include credential rotation/revocation instructions. The owner wallet private key never belongs on the application server.
- Public production must not ship test auth bypasses, mock write routes, debug keys, permissive CORS or unauthenticated seed endpoints.

## 13. Dependencies, configuration and deployment

### 13.1 Environment variables

These are application configuration names. Do not confuse them with undocumented third-party SDK configuration fields. Provide `.env.example` with names and safe placeholders only.

```dotenv
APP_MODE=mock
APP_ORIGIN=
DATABASE_URL=
TATUM_API_KEY=
TATUM_GRPC_TARGET=sui-mainnet-grpc.gateway.tatum.io:443
MEMWAL_PRIVATE_KEY=
MEMWAL_ACCOUNT_ID=
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
MEMWAL_NAMESPACE_DEMO=suimoney-demo-v1
MEMWAL_NAMESPACE_SECRET=
SESSION_SECRET=
INTERNAL_ADMIN_SECRET=
REFERENCE_SUI_ADDRESS=
REFERENCE_TRANSACTION_DIGESTS=
```

Generate high-entropy secrets using a cryptographically secure generator. Document effects of rotating the namespace secret: mappings already persisted must remain stable. Use secure server-generated session tokens; the session secret is not a replacement for token randomness. The reference address/digests are public chain references, never invented and never described as user funds unless they are genuinely the builder's.

Public client configuration may include only non-secret app network/UI settings. MemWal account ID and delegate public key are submission metadata, but the delegate private key is always secret. Do not create an owner-private-key environment variable.

### 13.2 Production requirements

- Default target: Vercel with Node runtime for Tatum/MemWal/database handlers. gRPC is not assumed to work in Edge runtime.
- Verify the builder's free-tier eligibility, function duration, outbound gRPC support, package bundling, region connectivity and database connection pooling. Do not hard-code a guessed Vercel duration allowance.
- Deploy an early endpoint exercising real Tatum, signed MemWal recall and PostgreSQL reads/writes before completing the UI.
- No long-running subscriptions, filesystem persistence or unawaited background jobs. Bounded stream processing returns durable continuation state.
- CI runs without live credentials against fixtures/local test database. Live smoke tests are separate, explicit commands.
- Separate production/demo namespaces and data from local/dev. Preview deployments cannot accidentally seed or alter production memories.
- Keep the live app and secrets active during judging. Deploy success is not proof that the end-to-end flow works.

### 13.3 Setup prerequisites and cost truth

Required: Tatum account/key, Walrus account plus registered delegate, a durable free database, hosting account, public GitHub repository and a wallet capable of signing personal messages. Creating credentials and accounts may require builder interaction. Sponsorship of hosted memory writes does not establish that account setup and every optional onchain action are free.

This brief authorizes no paid purchase and no transfer of the builder's funds. Use public reference transactions for read evidence when possible and label them. If fresh tiny transfers are necessary, prepare the exact amount/network/action for explicit authorization, let the builder sign in their wallet, and record only the public resulting digest. Never ask for wallet secrets.

## 14. Mandatory verification gates and open questions

Create an open-item row with owner, source, verification method, status, impact and resolution evidence. No critical row may be left as “probably works.”

| Gate | Must establish | Failure consequence |
| --- | --- | --- |
| G01 | Current event checklist, video/form requirements, eligibility and material published-source ambiguities reviewed. | Cannot claim submission compliance. |
| G02 | Actual Tatum key can read Mainnet USDC/SUI balances and reference transactions. | Cannot claim live integration. |
| G03 | Address history finds incoming and outgoing transfers, paginates/resumes and exposes real coverage/retention. | Blocks P04 and complete product release; no silent paste-only fallback. |
| G04 | Installed transport, proto/client versions, auth metadata, masks, numeric shapes and timestamp/checkpoint fields verified. | Block affected adapter, keep pure code independent. |
| G05 | Deployed Node runtime executes Tatum, MemWal and PostgreSQL operations. | Resolve deployment; no local-only completion. |
| G06 | Walrus Mainnet write, job polling, matching recall, list pagination and expiry metadata actually work. | Blocks H01/H03 and learned-rule activation. |
| G07 | Registered delegate belongs to the correct account; health and authenticated access both pass. | Do not mistake public health for valid auth. |
| G08 | Free quotas, charges, storage retention and account setup constraints verified in actual dashboards. | No paid upgrade or funding assumption. |
| G09 | Wallet signatures are verified server-side; cross-user attack tests pass. | No personal live launch. |
| G10 | Durable DB migrations, connection pooling, allocation locking and sync recovery work. | No complete financial calculations in production. |
| G11 | Current form inspected by builder; public IDs and every required URL supplied correctly. | Submission remains incomplete. |
| G12 | Memories remain available through judging/results; renewal/reseed route verified if needed. | Cannot claim retained Mainnet evidence. |
| G13 | At least one real correction and confirmed recurring-rule story recorded across actual sessions. | Learning story incomplete; synthetic replay is insufficient alone. |

Additional checks: canonical native-USDC identity and metadata; SUI canonical type and fee fields; third-party wallet compatibility; receipt timestamp semantics; provider scan limits; user locale/timezone behavior; explorer link formats if used; blog platform requirements; deploy URL access without authentication; package licenses and security audit findings.

Do not use `LedgerService/GetLatestCheckpoint` merely because the old brief mentioned it. Select currently supported service/checkpoint operations from actual schemas and live endpoint discovery. Likewise, do not assume MemWal method availability from a remembered beta package.

## 15. Acceptance tests and quality checks

Every H/P requirement gets a row in `docs/EVIDENCE.md`: requirement ID, test/command, actual outcome, UTC date, commit, environment and public-safe artifact. A checklist without evidence is not completion.

### 15.0 Requirement-to-acceptance map

This is the minimum traceability map to copy into the repository. Tests supplement one another; passing a unit test never substitutes for a live/deployed gate.

| Requirement | Minimum passing acceptance |
| --- | --- |
| H01 | G06 plus a completed Mainnet job, matching recall and deployed access evidence. |
| H02 | G02–G05 plus actual production requests routed through Tatum. |
| H03 | Evidence enumeration confirms at least 15 distinct active stored product memories; seed manifest agrees. |
| H04 | Published public article explains both integrations and a supported real learning change. |
| H05 | Demo and repo accessible signed out; README setup and judge journey work. |
| H06 | Dated commits/build log and attribution establish authorized work during the build period. |
| H07 | Builder supplies actual final submission confirmation before the deadline. |
| H08 | Signed-out video playback works; 2–3 minute content demonstrates the actual product. |
| H09 | Builder verifies eligibility, agreements and absence of a second conflicting submission. |
| H10 | Today, Activity and Plan work; L1–L3 have auditable input/output differences. |
| H11 | Bonus is explicitly optional; retain a draft or actual public post URL without pretending publication. |
| P01 | Browser journey 1 plus live synthetic-memory recall and zero public write capability. |
| P02 | G09, all authentication/authorization attack tests and genuine deployed-wallet sign-in. |
| P03 | G02/G05, F12/F21 and explicit observed/stale/error UI checks. |
| P04 | G03/G04, F13/F22 and interrupted/repeated incoming/outgoing sync tests. |
| P05 | F05/F10/F16/F17, immutable chain fields and active correction/version evidence. |
| P06 | F06/F07/F24 and real database allocation-race tests. |
| P07 | F03/F04/F14/F23 and persisted plan edits across a fresh session. |
| P08 | F01/F02/F08/F09/F12 and visible formula inputs/source timestamps. |
| P09 | F14/F15/F16, actual confirmation lifecycle and no duplicate learned/manual occurrence. |
| P10 | G06/G07, F16/F17/F19/F20 and fresh-session signed recall. |
| P11 | F18 plus three before/after learning stories with source IDs and unchanged underlying facts. |
| P12 | G10, DB/job recovery, user-scoped export and each dependency-down browser case. |
| P13 | Sanitized proof and memory inspector agree with real evidence and authorization checks. |
| P14 | CI green, 390 px/keyboard checks, required docs and H04/H05/H07/H08 complete. |

### 15.1 Mandatory unit/property cases

| Test ID | Scenario and required result |
| --- | --- |
| F01 | `500-100-200`, ten local days => remainder 200 and daily 20 USDC. |
| F02 | Plan exceeds balance => correct shortfall; discretionary/daily never negative. |
| F03 | Missing/zero/past payday, supported-horizon overflow, no income date and explicit end-date alternative handled. |
| F04 | DST, year boundary, leap year, timezone change and monthly day-31 clamp generate correct local dates. |
| F05 | Own transfer classification lowers consumption spending, leaves verified wallet balance unchanged and does not re-add external-wallet funds. |
| F06 | Expense 40, actual reimbursement 15 => net 25; linking does not increase current balance. |
| F07 | Over-allocation, concurrent allocation and duplicate import cannot inflate reimbursements or settle a bill twice. |
| F08 | Payment 50 changes `B=500,C=200` to `B=450,C=150`; remainder unchanged at 200 with reserve 100. |
| F09 | Pre-payment balance plus post-payment commitment state is refused/pending until refreshed. |
| F10 | Unknown successful outflow is visible as unclassified spending; simple unrelated inflow is not auto-income. |
| F11 | Failed tx, wrong token, bridged lookalike, complex swap, sponsor-paid gas and multi-recipient transaction get conservative results. |
| F12 | Base-unit values above JS safe integer range remain exact; invalid precision/notation rejected. |
| F13 | Partial history never produces a falsely complete period summary; duplicate/out-of-order pages deduplicate. |
| F14 | Recurring occurrences are unique, partial payment works and next occurrence remains unpaid. |
| F15 | Three qualifying weekly transfers produce a suggestion; two do not; rejected/changed history behaves deterministically. |
| F16 | Suggestion alone does not change budget. Confirmed and recall-verified rule does; correction/deactivation supersedes it. |
| F17 | Old recalled revision, malformed memory and cross-user event are rejected. |
| F18 | Memory-off comparison uses identical raw facts and explicit plan inputs; no balance or cash creation. |
| F19 | Write timeout/unknown outcome does not cause blind duplicate submit; retry is idempotent. |
| F20 | Empty filtered metadata page with `has_more=true` continues enumeration; cursor resync and expired records handled. |
| F21 | Zero balance is distinguished from failed balance read; stale cached facts are visibly marked. |
| F22 | Same economic movement appearing twice in raw change arrays is normalized once per wallet/token/digest. |
| F23 | Cancelled obligation affects plan only; projected expected income never increases available balance. |
| F24 | Gross/net expense reporting preserves reimbursement receipt date and expense-attribution period. |

Add property tests for exact allocation conservation, idempotent import/projection and nonnegative outstanding amounts. Test actual business invariants, not snapshots that merely mirror implementation.

### 15.2 Adapter and persistence tests

- Recorded sanitized real Tatum responses, including an incoming transfer not sent by the tracked address.
- Multi-page/stream-end/cursor test, empty scan continuation, pruning, throttling and interruption.
- Live coin metadata checked against exact supported type; wrong type cannot become USDC by symbol.
- MemWal accepted, pending, saved, recall-confirmed, failed, expired, duplicate and unknown-submission outcomes.
- Complete ledger reads unaffected by semantic recall truncation.
- Database migrations on an empty database, uniqueness constraints, allocation races, interrupted sync and two concurrent revision updates.
- Fresh process and new authenticated browser session retrieve persisted state.

### 15.3 Authentication and abuse tests

Valid signature; invalid signature; expired/used nonce; wrong domain/address; concurrent nonce use; CSRF; logout/revocation; wallet switch; missing session; cross-profile row IDs, job IDs and namespace injection; public demo write attempts; export leakage; excessive sync and write requests. Verify user A cannot inspect user B's records through any route.

### 15.4 End-to-end browser tests

1. Signed-out visitor opens demo, sees provenance labels, compares learning and opens proof.
2. Test wallet authentication follows the actual signature-verification path in isolated test mode, not a production bypass.
3. User sees balance, imports activity, labels an outflow, saves a rule, waits for confirmation and revisits in a new session.
4. User creates a plan, confirms a recurrence and sees a correct changed estimate with source reasons.
5. User links a reimbursement and a commitment payment without double counting.
6. Simulate each unavailable dependency; no silent mock fallback, lost edit or false saved state.
7. At 390 px: navigate by keyboard, submit forms, inspect errors and read the full formula explanation.

A genuine installed-wallet sign-in must also be manually checked in the deployed environment. Automated mocks do not establish real wallet compatibility.

### 15.5 Required scripts and CI

Implement and document these repository-owned commands:

```text
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:e2e
npm run build
npm run smoke:live
npm run smoke:live -- --write
npm run seed:mainnet -- --write
npm run verify:evidence
npm run snapshot:learning
npm run audit:submission
```

Read-only smoke is default. Write flags are explicit and target only configured namespaces. CI runs lint, typecheck, domain/adapter/DB tests, mocked end-to-end checks and a production build without live secrets. The submission audit fails for missing required evidence, fewer than 15 confirmed active demo memories, missing published URLs, failed quality gates, placeholder IDs or critical unresolved items. Do not set a global skip flag to make CI green.

## 16. Demo data and Mainnet evidence

### 16.1 Dataset separation

- Public financial dataset: fictional wallet/person, fixed demo date, supported exact units, marked synthetic.
- Public learning dataset: synthetic context actually stored and recalled from Walrus Mainnet.
- Public Tatum evidence: real reference address/transactions read live, labelled reference data. Do not imply that these generated the fictional spending history.
- Real personal learning: builder's minimal consented data, redacted before publication. Do not expose the builder's private notes or entire wallet export in the repo.

### 16.2 Seed specification

Seed at least 20 individually useful learned events, with deterministic IDs and source records. Target **24** for margin:

| Events | Count | Story |
| --- | --- | --- |
| Payment explanations | 6 | Explain eligible fictional outflows under simple aliases. |
| Category rules | 3 | Confirm defaults for recurring destinations. |
| Own-destination rule | 1 | Exclude a fictional own transfer from consumption, not wallet outflow. |
| Reimbursement links | 2 | Reduce net expense using two actual-in-fixture incoming transfers. |
| Confirmed recurrence rules | 3 | Future occurrences affect the planner after confirmation. |
| Planning preferences | 3 | Preserve user-confirmed reserve/category behavior and horizon preference. |
| Corrections | 4 | Fix a category, recurrence amount, note and an allocation. |
| Deactivations | 2 | Disable a mistaken rule and an obsolete recurrence. |
| **Total** | **24** | Seeded history includes valid supersession and reasons. |

The seed script must validate the complete fictional finance fixture first, obtain memory write confirmation, wait for recall evidence, list/count active stored blobs and emit a manifest. A correction may supersede a rule while its blob still exists: distinguish active stored blob count from active product rule count. Never inflate counts with transport retries or duplicates.

Use one namespace such as `suimoney-demo-v1`, synthetic provenance on every event, no real names/phones/payment accounts, and no fabricated chain digest on fictional transactions. Mark fixture movement IDs as synthetic. Real reference digests live only in the separately labelled evidence set.

The seed runs only with `--write`, refuses to duplicate a completed seed, persists progress and resumes accepted jobs. No unauthenticated web endpoint can seed or reset Mainnet data.

### 16.3 Required evidence stories

1. **Spending correction:** reclassify an own transfer; gross consumption drops by the exact amount; current balance is unchanged.
2. **Planning improvement:** confirm a recurring obligation; available planning amount decreases by its unpaid occurrence amount.
3. **Learning correction:** update that rule; future estimate changes by the exact difference and cites the superseding event.
4. **Cash conservation:** reimbursement linking and commitment matching do not double-count money.

For each story capture inputs, before/after outputs, event/blob IDs, UTC observation time, fixed comparison date and real/synthetic provenance. At least one real correction and one real confirmation must span actual sessions before submission. Do not claim multi-week learning from a two-day build; fictional backdated event dates remain fictional.

### 16.4 Proof page contents

Application mode, app commit/build time, Sui network verification, Tatum read result and observation time, supported coin metadata, one explicitly public reference transaction, signed Walrus recall status, confirmed demo memory count, expiry/retention status and public evidence/document links. Redact keys, server environment values and private user identifiers. Distinguish cached checks from newly executed ones. Health alone is not proof of authenticated memory access.

## 17. Delivery sequence and deadline plan

The earlier brief mentioned two days of coding-agent access. That access limit has not been re-confirmed. Front-load live risks into the first two focused build days; do not promise an unverified two-day completion or sacrifice requirements to fit it.

### Phase A: verify before polishing

Read rules, install verified dependencies, initialize evidence, configure test database, prove Tatum service/balance/history in both directions, complete one Mainnet memory lifecycle, implement wallet signature verification and deploy an integration spike. Finish G02–G07 before treating the architecture as validated.

If a gate fails, write the exact issue. Continue independent pure domain, schemas and labelled demo UI. A core feature must not be quietly downgraded.

### Phase B: complete the vertical slice

Migrations and repositories; exact arithmetic; real authenticated profile; resumable wallet sync; Today derived from live balance; Activity annotation; one commitment; one confirmed Walrus-backed rule; new-session recall. Run financial and isolation tests immediately.

### Phase C: finish product behavior

Reimbursement allocation; commitment matching; recurrence generation/suggestions; corrections/deactivation; comparison; memories/proof; export; responsive/error states; quota and outbox recovery. Run DB, concurrency, browser and deployment checks.

### Phase D: learning, evidence and submission

Seed Mainnet safely, verify count and retention, record real personal learning, finish README/blog/video, inspect current submission form, verify every public URL signed out, run the release audit and submit ahead of the hard deadline. Leave time after deployment for actual cross-session learning rather than inventing it at the end.

Daily: append the build log, run changed-area tests, capture learning snapshots when state changes, scan before push and update the requirement matrix. Do not repeatedly run write smoke tests just to fill memory counts.

## 18. Documentation, blog, video and submission

### 18.1 Required repository deliverables

1. `README.md`: pitch; exact scope; screenshots; three-click demo; honest live/synthetic distinction; setup; supported assets; commands; architecture; limitations; contribution/attribution; public demo, video and blog links.
2. `docs/REQUIREMENTS.md`: H/P IDs mapped to implementation, tests, status and evidence.
3. `docs/ARCHITECTURE.md`: source-of-truth boundaries, data flow, adapters, namespaces, ownership and job lifecycle. Include a compact Mermaid diagram.
4. `docs/FINANCIAL_RULES.md`: Section 7's definitions, examples, exclusions, precision and allocation invariants.
5. `docs/VERIFICATION_REPORT.md`: checked sources/dates, actual package versions, pinned proto commit, live key permissions, response shapes, history coverage and deployment results.
6. `docs/OPEN_ITEMS.md`: unresolved facts, severity, owner, impact, next action and resolution.
7. `docs/BUILD_LOG.md`: dated work sessions, independent work and meaningful changes.
8. `docs/EVIDENCE.md` and `docs/INTEGRATION_EVIDENCE.md`: requirement proof and sanitized live checks.
9. `docs/LEARNING_LOG.md`: truthful before/after stories, provenance, event IDs and session dates.
10. `docs/API.md`, `docs/SECURITY.md`, `docs/OPERATIONS.md`: internal schemas, auth/isolation, quotas, retention, recovery, credential rotation, database backup and rollback.
11. `docs/BLOG.md`: complete article draft based on actual evidence; publish and record its public URL.
12. `docs/DEMO_SCRIPT.md`: a rehearsed 2–3 minute script.
13. `docs/SOCIAL_POST.md`: optional bonus draft; no external posting without builder instruction.
14. `docs/SUBMISSION_CHECKLIST.md`: exact current form fields, URLs, public account identifiers, builder-only actions and submission confirmation status.
15. `evidence/public/seed-mainnet.json`, public-safe learning snapshots and sanitized fixtures. Keep private records outside git.
16. `.env.example`, migrations, lockfile, CI configuration, scripts and license/attributions.

### 18.2 Demo video sequence

- 0:00–0:20: the everyday problem and one-sentence product.
- 0:20–0:45: Today with real supported scope and a brief formula explanation.
- 0:45–1:15: Activity explanation/correction and its exact effect; show unchanged balance.
- 1:15–1:50: confirmed recurring payment and changed future plan; show reasons from Walrus.
- 1:50–2:15: new session recall and memory comparison.
- 2:15–2:40: proof page, actual Tatum Sui read and Mainnet memory evidence.
- Final seconds: scope and honest limitations; demo/repo/article links.

Show actual behavior. If a real write takes time, make a clearly disclosed edit in the video rather than pretending asynchronous storage is instant. Check playback permissions signed out.

### 18.3 Article requirements

Explain the user problem, supported scope, Tatum's role, Walrus's role, exact learning loop, real before/after numbers, stored-memory evidence, privacy/ownership boundary and limitations. Include live app and repo links. Do not claim predictive intelligence, automatic bank access, multi-chain coverage, sole-user ownership, permanent storage or weeks of real usage unless demonstrated.

The reviewed event materials require a published post but do not establish a compulsory publishing platform. Verify the current form before choosing. A Markdown draft in the repo does not satisfy publication.

### 18.4 Form preparation

E2 currently lists these categories of fields: builder contact/profile details; discovery/experience questions; Tatum ID; Sui address and account identifiers; `MEMWAL_AGENT_ID`; project description; short video; repository; and feedback on the sponsor tools. The live form is authoritative for its actual fields and required flags. Record them at submission time; do not invent hidden form fields or omit a newly required item.

From E1, the Tatum submission identifier is the dashboard **account ID**, not the private API key. `MEMWAL_AGENT_ID` is the delegate **public key** displayed in the Walrus dashboard, not the private delegate secret. Confirm the form's Sui address/account-ID labels so a wallet address, MemWal object ID and Tatum account ID are not interchanged.

Builder-only inputs/actions: eligibility confirmation; contact/profile details; service/account setup when needed; authorization/signing of any value transfer; public article publication; video upload; final form submission and receipt. The coding agent prepares everything it can and marks the exact remaining action. It must not claim these happened without evidence or send/post externally without authorization.

## 19. Definition of done

The build is complete only when all applicable lines are true and have evidence. No skipped mandatory tests, hidden substitutes or unresolved critical gates.

- [ ] Current rules, checklist and material ambiguities reviewed; selected track recorded.
- [ ] H01–H09 official conditions met, including published article and accessible short video.
- [ ] P01–P14 behaviors implemented and acceptance evidence recorded.
- [ ] Real Tatum Sui Mainnet balances and transactions work from production.
- [ ] Incoming and outgoing history, coverage, pagination and recovery are verified.
- [ ] Only native USDC drives budgets; SUI is separate; unsupported activity is visible and excluded honestly.
- [ ] Exact financial invariants pass, especially balance/expense separation and allocation conservation.
- [ ] Signed authentication, durable sessions and cross-user isolation pass.
- [ ] Durable database, atomic cursors, migrations, concurrency and export work.
- [ ] Walrus Mainnet writes, polling and matching recall work with real job/blob evidence.
- [ ] At least 15 confirmed active stored demo memories exist, with 24 targeted and duplicates excluded.
- [ ] At least one real cross-session correction and confirmation visibly change the product.
- [ ] Comparison uses identical underlying facts and cites valid active rules.
- [ ] Expiry/retention through judging is checked and documented.
- [ ] Pending/failed jobs, dependency outages, stale balances and partial history are handled honestly.
- [ ] Lint, types, unit/property, database, adapter, end-to-end and production-build checks pass.
- [ ] Mobile/keyboard manual checks and real deployed wallet sign-in pass.
- [ ] Secrets, PII exposure and client-bundle scans pass; no public auth bypass exists.
- [ ] Public demo, repository, video and article URLs work signed out.
- [ ] Requirement matrix, docs, setup, learning log and public-safe evidence are complete.
- [ ] `npm run audit:submission` passes without bypasses.
- [ ] Submission form has correct public identifiers; builder retains confirmation before deadline.

### 19.1 Stop conditions

Stop the affected action, report clearly and continue independent work if: a key leaks; paid usage or a value transfer is required; provider history cannot satisfy P04; authentication/isolation fails; exact money calculations fail; critical evidence is missing; or an official requirement is materially ambiguous. Do not announce a ready submission while any of these remains unresolved.

## 20. Sources and provenance

The documentation and event claims above were checked against official pages on **28 October 2026**. The source list also includes the proto repository that the coding agent must inspect and pin during implementation; its exact current schema has not been certified by this brief. Documentation checks are not tests with the builder's credentials. URLs can redirect or change; record the final resolved URL and commit/version during implementation. No unauthenticated source establishes the user's actual account entitlement.

| ID | Source | Used for |
| --- | --- | --- |
| E1 | https://recall-tatum-walrus.vercel.app/ | Event landing page, checklist, judging, identifiers, timeline and FAQ. |
| E1a | https://tatum.io/hackathon/total-recall | Sponsor's official event entry linking to E1. |
| E2 | https://thewalrussessions.wal.app/tatum-total-recall | Event rules, eligibility, listed form fields, video and requirements. |
| T1 | https://docs.tatum.io/reference/rpc-sui | Current Sui endpoint/method listing. |
| T2 | https://docs.tatum.io/oa/reference/sui-grpc | gRPC transport/authentication and schema setup. |
| T3 | https://docs.tatum.io/docs/plans-limits | Advertised plan limits; dashboard confirmation required. |
| T4 | https://docs.tatum.io/docs/gateway-limits | Method access/range restrictions. |
| T5 | https://docs.tatum.io/reference/blockchain-data-api | General Data API coverage; not evidence that generic endpoints support Sui. |
| S1 | https://www.docs.sui.io/develop/accessing-data/grpc/grpc-migration-cookbook | Current streaming list/query semantics and migration. |
| S1a | https://www.docs.sui.io/develop/accessing-data/grpc/using-grpc | Masks, transaction fields and query examples. |
| S1b | https://github.com/MystenLabs/sui-apis/tree/main/proto | Schema source to inspect and pin before implementation. |
| S2 | https://sdk.mystenlabs.com/sui/cryptography | Personal-message signing and verification. |
| S3 | https://sdk.mystenlabs.com/dapp-kit | Current supported wallet integration packages. |
| C1 | https://developers.circle.com/stablecoins/usdc-contract-addresses | Native USDC identity on Sui Mainnet. |
| W1 | https://docs.wal.app/walrus-memory/sdk/api-reference | Memory job, recall and metadata listing behavior. |
| W2 | https://docs.wal.app/walrus-memory/relayer/overview | Processing trust boundary and relayer behavior. |
| W2a | https://docs.wal.app/walrus-memory/relayer/self-hosting | Published quota defaults; hosted behavior must be confirmed. |
| W3 | https://docs.wal.app/walrus-memory/sdk/cookbook-multi-tenant | Operator-owned multi-user pattern and authorization caveats. |
| W4 | https://docs.wal.app/walrus-memory/guides/manage-your-memory | Retention, expiry, renewal and restore limitations. |
| W5 | https://docs.wal.app/walrus-memory/troubleshooting/overview | Async indexing, retries and authenticated-access failures. |
| D1 | https://neon.com/docs/introduction/plans | Existence of a free durable PostgreSQL tier; verify actual entitlement. |

Source facts, project choices and verification tasks have deliberately been separated. The builder must not treat the original brief's old method names, “verified” labels or infrastructure assumptions as stronger evidence than current schemas and successful live tests.

## 21. Coding-agent kickoff instructions

When this file is uploaded to Codex, begin with the following work, not another idea brainstorm:

1. Read the whole brief, inspect the workspace and applicable repository instructions, and create the requirements/evidence/open-item documents.
2. Report the exact agreed scope: Sui Mainnet; native USDC budget; separate SUI display; Today, Activity, Plan; real Walrus-backed learning; no custody or payments.
3. Verify sources and dependencies, then run the early Tatum history/balance, MemWal write/recall, auth and deployed-database spikes.
4. Ask only for actual missing prerequisites through secure configuration paths. Do not ask the builder to choose routine implementation details already decided here.
5. Build the complete vertical slice, pass the financial and isolation tests, then finish the remaining MUSTs and evidence.
6. Prepare every external deliverable and builder-only step concretely. Record what is actually complete and what remains pending. Do not claim a perfect, compliant or submitted result without proof.

**Final implementation standard:** the app must correctly explain supported spending, conservatively plan actual USDC already held, remember confirmed context across sessions, show how that memory changes the next result, and prove both sponsor integrations in the deployed build.
