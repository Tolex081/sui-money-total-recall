# Requirement-to-evidence matrix

Every mandatory row requires actual evidence. Local fixtures, authenticated-live reads, deployed behavior, publication and submission are separate levels. Artifact paths are relative to `evidence/public/`; their `checkedAt` fields are the actual UTC observations. Baseline commit `70be8b4cb458461302c64b5e95a6f3a21c7c09e5` preceded later working-tree changes. `quality.json` records the tested source fingerprint; deployed evidence must identify its actual revision. Missing revision metadata is not invented.

| ID | Acceptance | Implementation / test | Outcome | UTC / commit / environment / artifact |
|---|---|---|---|---|
| H01 | G06 completed Mainnet job, matching recall, deployed proof | `smoke:live -- --write` (single approved event), exact seed batch, deployed spike | Live/deployed boundary passed | `live-smoke.json`, `seed-mainnet.json`, `deployed-runtime.json`; Mainnet + production Node 24 |
| H02 | G02–G05 production Tatum reads | Authenticated service/coin/balance/history/direct transaction calls; enhanced production probe | Passed at recorded deployment: balances and both transfer directions; final revision separately checked | `transfer-reference.json`, `deployed-runtime.json`; no non-Tatum fallback |
| H03 | ≥15 distinct active stored product memories; target 24 | Exact approved batch + read-only `audit:seed` | Passed: 24 unique active stored/recalled blobs; retention verified | `seed-mainnet.json`, 2026-10-28T16:59:49.123Z |
| H04 | Published article with real learning evidence | `docs/BLOG.md` draft | Pending real learning/publication | No article URL claimed |
| H05 | Signed-out public demo/repo and reproducible README | Public production alias and public repository | Public demo/repository available | `https://sui-money.vercel.app/demo`; release registry controls repo status |
| H06 | Dated authorized work and attribution | Fresh repository, dated build log, MIT and dependency attribution | Public dated commit history and attribution present | `docs/BUILD_LOG.md`, git history, LICENSE |
| H07 | Actual submission receipt before deadline | Builder must submit current form once | Pending | No receipt claimed |
| H08 | Public 2–3 minute video playback | `docs/DEMO_SCRIPT.md` | Local captioned 2–3 minute draft recorded and playback checked; public upload pending | No video URL claimed |
| H09 | Eligibility and single submission confirmed | Builder attestation/current form | Pending | `docs/SUBMISSION_CHECKLIST.md` |
| H10 | Core screens and L1–L3 auditable effects | Public demo, same-fact comparisons, confirmed revisions | Local replay passes; G13 real sessions pending | `learning-replay.json`, tests, `docs/LEARNING_LOG.md` |
| H11 | Optional social post | `docs/SOCIAL_POST.md` draft | Optional; not posted | No unsolicited publication |
| P01 | Read-only synthetic demo + real Mainnet recall | Demo POST 405; cached real signed seed evidence | Implemented; public browser passed | `seed-mainnet.json`, `tests/e2e/demo.spec.ts`; finances remain fictional |
| P02 | Wallet auth, isolation attacks, deployed sign-in | Genuine SDK signatures and durable nonce/session DB tests, scoped routes | Partial: generated-signature browser/resource checks passed in the final isolated CI run; installed-wallet blocked by Slush warning | `db-tests.json`; personal release gated |
| P03 | Verified balances; F12/F21; freshness/errors | Combined native-USDC/SUI Tatum reads, exact amounts, stale/unknown UI | Live balance passes; browser missing-provider and stale-cache fixture flows passed in the final isolated CI run | `live-smoke.json`, `deployed-runtime.json`, financial tests |
| P04 | G03/G04; F13/F22; resumable both-direction history | Affected-address stream, bounded cursor, immutable import, direct re-read | Passed for recorded bounds: actual resumed/repeated pages and explicit local pruning/throttle/interruption transport fixtures | `transfer-reference.json`, `history-recovery.json`, DB rollback and adapter tests |
| P05 | F05/F10/F16/F17; immutable facts + corrections | Activity annotations, separate destination rule, revision projection | Unit/DB checks pass; actual personal learning pending | financial/learning tests, `db-tests.json`; raw facts immutable |
| P06 | F06/F07/F24; real allocation races | Positive receipt/expense links, DB caps and locks, reversal event | Local/real DB races and isolated authenticated-browser linking/caps passed; genuine personal allocation is separate | financial tests, `db-tests.json` |
| P07 | F03/F04/F14/F23; persistent explicit plan | Versioned plan, reserve, dates, edit/cancel occurrences | Optimistic saves and fresh authenticated-browser persistence passed in isolated real DB tests | `db-tests.json`, financial tests |
| P08 | F01/F02/F08/F09/F12; visible formula | Exact formula, cent floor/remainder, no income injection | Local invariant passes; live payment/balance snapshot blocked | `docs/BALANCE_CONSISTENCY.md`; no unproven release of reservations |
| P09 | F14/F15/F16; confirmed recurrence lifecycle | Transparent weekly heuristic, separate confirmation, association, corrections | Implemented/unit tested; actual personal lifecycle pending | recurrence/learning tests; G13 open |
| P10 | G06/G07; F16/F17/F19/F20; signed session recall | Durable jobs, matching envelope/profile/revision, metadata pagination | Mainnet transport + DB timeout passes; fresh personal session pending | `seed-mainnet.json`, `db-tests.json`, learning tests |
| P11 | F18; three same-fact learning comparisons | Fixture own-transfer, recurrence and correction replays | Synthetic evidence only; real story pending | `learning-replay.json`, learning log; no fake session dates |
| P12 | G10; durable jobs/export/dependency failure | PostgreSQL, immutable facts, atomic cursor, unknown submit reconciliation, scoped export | DB boundary and explicit isolated browser failure/recovery scenarios passed in the final isolated CI run; final-source CI tracked separately | `db-tests.json`; request-driven jobs may await next visit |
| P13 | Sanitized proof and scoped memory inspector | Public proof cache, strict synthetic manifest, private profile scoping | Implemented with real seed/reference evidence; current deployment revision remains separately recorded | `/proof`, `/demo/memories`, seed/reference/runtime artifacts |
| P14 | CI/mobile/accessibility/docs/public deliverables | Local suite, responsive CSS, keyboard, axe, CI definition and drafts | Final CI passed; public article/video, submission and genuine wallet remain open | `quality.json`, visual captures, submission checklist |

## Mandatory gates

| Gate | Evidence | Result / remaining limit |
|---|---|---|
| G01 | Current event landing/rules re-opened; inconsistencies recorded | Current form schema inspected read-only; builder eligibility/attestations remain pending. |
| G02 | `live-smoke.json`, `transfer-reference.json` | Authenticated Mainnet balance and transaction reads passed. |
| G03 | `transfer-reference.json`, `reference-history.json` | Both directions, incoming non-sender and real resume/repeat passed within documented bounds; local fixtures cover pruning/throttle/interruption, not induced live outages. |
| G04 | Pinned Sui 2.38.0/grpc-js/protobuf transport, installed generated masks/types, real shapes | Adapter contract verified for used calls; atomic balance watermark remains unknown. |
| G05 | `deployed-runtime.json` | Passed on source bdace24: balances, direct transactions, two streamed history pages/both directions, signed Walrus recall and PostgreSQL roundtrip. |
| G06 | Smoke job + 24 seed jobs, matching recall, metadata enumeration | Mainnet lifecycle, stored count and expiry passed; empty/resync pagination additionally fixture-tested. |
| G07 | Signed registered delegate recall and actual write success | Authenticated pass; public health was not substituted. |
| G08 | Builder confirmed free sponsored writes; Neon Free + Vercel Hobby verified | Partial: actual Tatum quota/charge dashboard evidence still missing; no paid upgrade authorized. |
| G09 | Real cryptographic signatures + durable attack tests | Generated SDK signatures, complete isolated browser/resource checks pass in the final isolated CI run; genuine installed-wallet blocked by reported Slush warning. |
| G10 | Versioned migrations, isolated PostgreSQL races/rollback/recovery | Real DB and isolated fresh-browser/recovery scenarios passed in the final isolated CI run; exact current-source CI evidence is required. |
| G11 | `submission-form.json`: current dialog fields/required flags inspected read-only | Form schema verified; builder public IDs, contact/legal attestations and publication URLs remain pending. |
| G12 | `seed-mainnet.json`, all 24 expiry values | Passed through 30 November 2026; no renewal needed/authorized. |
| G13 | Synthetic replay clearly labelled | Pending actual recurring confirmation and correction across real sessions. |

## Mandatory F cases

All rows below refer to named local tests. A local pass is not a declaration that its corresponding live acceptance is complete.

| Case | Actual test / evidence | Result and limitation |
|---|---|---|
| F01 | financial: exact 500−100−200 / ten days | Pass: remainder 200, daily 20. |
| F02 | financial: overcommitted plan | Pass: shortfall exact; allowance nonnegative. |
| F03 | financial: missing/today/past/>90-day horizon | Pass; explicit planning end kind implemented. |
| F04 | financial: DST/year/leap/monthly31 | Pass using Temporal calendar dates. |
| F05 | financial: own-transfer comparison | Pass; balance unchanged, 120 removed from consumption. |
| F06 | financial: 40 expense / 15 receipt | Pass; net25, no balance increase. |
| F07 | financial + real DB races/immutable imports | Pass; concurrent caps enforced. |
| F08 | financial: payment lowers B and C equally | Fixture pass; live snapshot contract open. |
| F09 | financial: older/missing balance checkpoint | Pass: pending state; live adapter intentionally null. |
| F10 | financial: unknown outflow / unrelated inflow | Pass; unknown consumption visible; no auto salary. |
| F11 | financial + conservative Tatum command parser | Local/protobuf adapter cases cover fail, lookalike, complex/multiple-recipient, sponsored gas and duplicate/conflicting net changes; fixtures remain distinct from live calls. |
| F12 | financial: >safe integer / malformed notation | Pass with BigInt base units. |
| F13 | financial partial summary + DB cursor rollback + public resumed pages | Pass at recorded bounds; no full-life coverage claim. |
| F14 | financial unique/partial/overdue occurrences | Local and isolated authenticated-browser persisted edit/cancel checks passed. |
| F15 | financial: three eligible weekly / two / variable amounts | Pass; pattern identity deterministic; persisted rejection path implemented. |
| F16 | learning highest confirmed revision / pending / deactivation | Local pass; real personal confirmation/correction pending. |
| F17 | learning malformed/cross-profile/old recall | Pass; strict envelope matching. |
| F18 | financial same-fact comparison | Pass; 134 obligation difference, identical balance/time/horizon/explicit bills. |
| F19 | learning state guard + DB lost-response simulation | Pass; unknown outcome persists, submit called once, no blind retry. |
| F20 | learning empty filtered page/resync/stalled cursor/expired revision | Pass; actual seed audit also follows metadata pages. |
| F21 | financial zero versus unavailable / stale flag | Actual zero balance verified; local missing-provider, real missing-DB server, stale-cache and simulated-save-failure browser cases passed. |
| F22 | financial duplicate change entry/order + live stable normalized IDs | Pass; one wallet/token/digest movement identity. |
| F23 | financial cancellation / projected income exclusion | Local pass; no expected income added to B. |
| F24 | financial expense attribution + receipt timestamp | Fixture timestamp attribution and isolated authenticated-browser reversal passed. |

No blanket release-pass flag is set. `audit:submission` remains blocked by the exact open requirements rather than skipping them.

## 29 October branding and safety refinement

Official event mascot and wordmarks now identify Walrus remembered context and Tatum wallet facts. `brand-checks.json` records six local production 390/1440 captures with no overflow or serious/critical axe findings, plus disabled sign-in and a rejected challenge. Impeccable review resolved its one SUI glyph-icon finding. This is scoped visual evidence, not a security clearance. Slush PC extension 26.21.6 (e2be7f2) still reports a malicious-site warning; genuine sign-in must wait for official review. See `SLUSH_REVIEW_REQUEST.md`.


Final implementation `bdace2432d83f680af0c678c2f7dc5f40d59b5d0`: [all nine CI checks passed](https://github.com/Tolex081/sui-money-total-recall/actions/runs/40940787576), including 38 unit/adapter/property,18 real PostgreSQL,7 public browser and13 authenticated browser cases. quality.json matches current source. Production probe 2026-10-29T19:47:18.767Z records the same revision. ux-checks.json records21 local route/width checks plus12 CSS reflow checks. New-source visual-checks.json records 18 passing deployed checks at 390/768/1440, disabled sign-in and challenge rejection; root visually inspected two deployed samples. Earlier capture/review timeouts were resolved after explicit user approval. See the independent review report and current DESIGN.md. Article/video publication, real wallet/learning, atomic balance consistency and builder attestations remain unproven.
