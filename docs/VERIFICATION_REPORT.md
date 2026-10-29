# Verification report

Reviewed 29 October 2026, Africa/Lagos. Artifact timestamps are actual UTC observations. Work and sessions are never backdated.

## Delivered implementation

Today, Activity, Plan, Memories, same-fact learning comparisons, Proof and privacy screens are implemented and deployed at https://sui-money.vercel.app . The public repository is https://github.com/Tolex081/sui-money-total-recall . Native-USDC arithmetic uses BigInt and Temporal; SUI remains separate. PostgreSQL stores the ledger, signed sessions, immutable facts and durable jobs. Learned interpretations activate only after completed storage and matching signed recall.

The UI refinement applies Impeccable and Anthropic frontend-design: self-hosted Figtree and Bricolage Grotesque, attributable Walrus/Tatum artwork, readable financial hierarchy, tablet layout, native modal navigation, clear paused-account recovery, and source/state/recorded time before collapsed raw proof. DESIGN.md and its sidecar document the implemented system. Independent review scope and disposition are in .impeccable/critique/ux-final-review.md; it is not security clearance.

## Exact tested and deployed source

Implementation revision: `bdace2432d83f680af0c678c2f7dc5f40d59b5d0`. [CI passed](https://github.com/Tolex081/sui-money-total-recall/actions/runs/40940787576) all nine required checks on v24.22.1 Linux with an unchanged source fingerprint, including public binary assets. Results: **38 unit/adapter/property tests, 18 real PostgreSQL tests, seven public browser tests and 13 authenticated browser checks**, plus lint, TypeScript, production build, secret scan and requirement traceability. The authenticated cases use disposable SDK-signed test wallets and explicit fixtures; they do not prove installed-wallet compatibility or personal Mainnet learning. No Mainnet writes occur in CI.

Deployment `dpl_9FpwHJVnS3SLFp5qXRdaYqkMygYq` is READY at the canonical public alias. The actual Node v24.21.0 Linux runtime probe at 2026-10-29T19:47:18.767Z identifies this same source and passed Tatum metadata/balances, direct public transactions, two streamed history pages with both directions, signed Walrus recall and PostgreSQL write/read. The runtime probe performs no new Walrus write.

| Boundary | Actual evidence | Practical limit |
| --- | --- | --- |
| Tatum identity and balances | Authenticated Mainnet genesis, exact native-USDC/6 decimals and SUI/9 decimals, combined balances; live-smoke.json and deployed-runtime.json | Missing balance is unknown, never zero. Balance has no atomic checkpoint. |
| Public reference history | Incoming +0.000050 USDC and outgoing −60 USDC, success/exact type/net delta directly verified; transfer-reference.json | Unrelated public wallet, separate from builder and synthetic demo. |
| Pagination/recovery | history-recovery.json: 30 ITEM_LIMIT +19 CHECKPOINT_BOUND, 49 transactions/93 movements, both directions, stable repeated first page; production also streams both pages | Frozen bounds only. Throttle, interruption, pruning and stalled cursor scenarios are local transport/protobuf fixtures, not induced live outages. |
| Walrus Mainnet | Approved smoke event plus exact approved 24-event synthetic batch, completed jobs, distinct active blobs and matching signed recalls | No extra personal writes or paid renewal authorized. All seed expiries cover 30 November 2026. |
| Durable storage/auth | db-tests.json and personal-browser.json: migrations1–3, races/caps, immutability, cursor rollback, nonce/CSRF/session isolation/export, persisted new session, dependency failures and demo/account navigation | Real isolated PostgreSQL in CI; SDK test signatures are not genuine installed-wallet acceptance. |
| UI and accessibility | ux-checks.json: 21 route/width checks at390/768/1440, no overflow/broken images/serious-critical axe findings; drawer is a separate 22nd visual capture | 12 extra CSS reflow checks at720/320, not physical zoom/device testing. Seven browser tests include keyboard drawer/Escape/route/resize and fonts. |
| Production presentation | The new deployment is READY; its runtime probe passed. Current source local production captures passed and were independently reviewed. Earlier deployed visual-checks.json identifies its older source. | New deployed capture timed out on network-idle; permission review timed out twice before the corrected capture could start. Fresh deployed screenshot evidence is incomplete. No Slush safety verdict. |
| Submission material | BLOG.md, DEMO_SCRIPT.md, SOCIAL_POST.md, SUBMISSION_FORM_PREPARED.md; local captioned video and video-draft.json | Drafts are not published/submitted. No article/video URL or receipt exists. |

Earlier CI failures and external database DNS/connection failures are retained under diagnostics. A Windows public-browser run passed all seven cases but its dev-server teardown stalled and was interrupted; successful full CI is the authoritative final process result. A sandbox TSX invocation failed before scanning due to uv_os_get_passwd; the permitted rerun completed. The first broad finish reviewer hit a usage limit; its once replacement performed the final review. The design detector ran once, exit0, with truncated advisory output against then-stale DESIGN; no clean-detector claim is made.

## Remaining mandatory acceptance

Wallet sign-in and personal finance are **disabled in production**. The builder reported a malicious-site warning in Chrome's Slush PC extension26.21.6(e2be7f2); exact flagged hostname remains unconfirmed. Do not bypass it or use another hostname to evade it. docs/SLUSH_REVIEW_REQUEST.md is a prepared, unsent official review request. No genuine installed-wallet success is claimed.

F08/F09 remain blocked: GetBalance has no verified atomic checkpoint/index watermark proving the returned balance includes a matched payment. The separately appended latest-checkpoint header is insufficient. Balance.checkpoint remains null and allocations cannot release an unproven reservation. See BALANCE_CONSISTENCY.md and the unsent TATUM_CONTRACT_QUESTION.md.

G13 remains pending: actual recurring confirmation and correction across genuine later sessions. The user explicitly labelled the recurring scenario synthetic; unconfirmed 10000 remains unassigned. REAL_PREFERENCE_GUIDE.md prepares a separate genuine reserve preference, which does not replace recurrence acceptance. Exact new personal payloads require separate review/authorization before Mainnet storage.

Builder eligibility, public account identifiers, actual Tatum quota/charge evidence, published article/video URLs and the submission receipt remain missing. The live public form was inspected read-only:20 visible fields,15 required, no entered values, accepted agreements or submission. audit:submission must fail while these mandatory requirements remain unproven. The software build/public review deployment is delivered; a personal release or completed submission is not claimed.
