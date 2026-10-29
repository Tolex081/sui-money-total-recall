# Prepared submission answers

Draft only. Do not submit until the release audit passes. The current form was inspected on 29 October 2026 by opening **Submit Project** at https://recall-tatum-walrus.vercel.app/ in an isolated browser with all non-GET requests blocked. No values were entered, no terms were accepted and no submission was made. Machine-readable required flags are in `evidence/public/submission-form.json`.

## Exact observed fields

| Label | Field name | Required | Prepared value / builder action |
| --- | --- | --- | --- |
| Email | email | Yes | Builder enters privately. |
| Discord handle | discordId | Yes | Builder enters privately. |
| LinkedIn | linkedinUrl | Yes | Builder enters privately. |
| Telegram ID | telegramId | No | Optional private entry. |
| How did you hear about this event? | howHeard | Yes | Choose Walrus Socials, Tatum Socials, Ads, Hackathon Listings, Friends, Search or Others truthfully. |
| Which community or account did you hear about us through? | heardFromSource | No | Actual source, if applicable. |
| Is this your first Web3 project? | firstWeb3Project | Yes | Builder answers Yes or No truthfully. |
| Tatum ID | tatumAccountId | Yes | Account identifier from My Account → My Account Info; never an API key. |
| SUI address | suiAddress | Yes | Builder's public controlled wallet, not the unrelated reference wallet. |
| Account ID (SUI) | accountId | Yes | Walrus account object ID received after first delegate creation. Keep separate from wallet address. |
| MEMWAL_AGENT_ID | memwalAgentId | Yes | Delegate **Public key** in Walrus dashboard; never delegate secret. |
| Project description | description | Yes | Draft below; retain unresolved limitations until evidence closes them. |
| Short demo video (2 to 3 min) | demoVideoUrl | Yes | Actual public playback URL after recording/upload; no placeholder. |
| GitHub repo | repoUrl | Yes | https://github.com/Tolex081/sui-money-total-recall |
| Additional documentation | additionalDocs | No | Actual published article URL plus evidence docs. The form marks this optional; event rules still require the published article. |
| How was your experience building with Walrus? | walrusExperience | Yes | Draft below. |
| How was your experience building with the Tatum AI Builder? | tatumAiBuilderExperience | Yes | Draft below explicitly states it was not used. |
| One bug or friction point with Walrus Memory | walrusFriction | No | Optional draft below. |
| Social post links | socialPosts | No | Only actual published URLs. No post has been sent. |
| Age and agreements | acceptTerms | Yes | Builder personally verifies age 18+, reads linked rules/terms/privacy and decides whether to accept. Agent does not attest or accept. |

## Project description draft

Sui Money combines native-USDC spending explanations and a forward budget on Sui Mainnet. Today, Activity and Plan connect immutable wallet facts to confirmed context. Tatum supplies verified balance and transfer observations; Walrus Memory stores versioned explanations, preferences, recurring commitments and corrections that activate only after confirmed storage and matching signed recall. USDC arithmetic is exact; SUI remains separate for network costs. The app never takes custody, sends payments, requests spending approvals or connects bank accounts.

Public demo: https://sui-money.vercel.app/demo . Its finances and learning replay are clearly synthetic. Independent proof includes real incoming/outgoing native-USDC references through Tatum, 24 approved synthetic Mainnet memories with signed recall and verified expiry, and a deployed database/runtime probe. Personal access remains gated by an unresolved balance-snapshot contract and a reported Slush security warning. Genuine personal cross-session learning is not yet claimed.

## Walrus experience draft

We integrated the pinned Memory SDK with a durable job ledger: queued, submitting, accepted, stored and matching-recall-confirmed are distinct states. Actual Mainnet storage, registered-delegate signed recall and metadata expiry checks passed for the reviewed 24-record synthetic batch. Versioned envelopes and a complete PostgreSQL ledger let corrections replace active rules without erasing earlier events. We do not use top-K semantic recall as a financial total. The managed relayer and operator-owned account trust boundary are disclosed to users.

## Tatum AI Builder experience draft

We did not use Tatum AI Builder. This is a fresh custom Next.js application. We used Tatum's Sui Mainnet gRPC infrastructure directly and verified its installed generated types and actual responses. Balances, affected-address history, incoming non-sender transactions, cursor resume and successful native-USDC balance changes passed. The unresolved atomic balance watermark is documented; we do not treat a latest-checkpoint header as proof that a balance includes a specific payment.

## Optional Walrus friction draft

The asynchronous storage, indexing and recall stages need distinct user-visible states and durable recovery. A lost submission response cannot safely trigger a blind retry. Complete metadata enumeration and expiry checks are necessary alongside semantic recall. Explicit SDK examples for those combined recovery/retention patterns would help builders avoid stale-rule activation and incomplete ledgers.

## Submission action

After all mandatory gates pass: update the description to the actual release state, fill real contact/public identifiers privately, add the published article and video URLs, review agreements, submit once before 10 November 2026 at 17:00 UTC / 18:00 Lagos, and retain the actual confirmation privately. A draft or filled form is not a receipt.
