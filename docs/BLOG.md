# What a wallet balance cannot tell you

> **Article draft — not published.** Before publishing, replace every `[FILL IN: …]` with what actually happened in your own session (real dates, real labels), or delete that paragraph. Do not publish a placeholder or describe a session that did not happen. Keep the limits section unless new evidence replaces it.

A wallet can tell you how much native USDC it holds. It cannot tell you that the 18.50 you sent this morning was lunch, that last Tuesday's 120 went to another wallet you own, or that the 600 that arrived yesterday was a freelance invoice. That meaning lives in your head, and it is gone the next time you look.

Sui Money is a small bet that a money app should remember what you tell it.

## What it does

Connect a Sui wallet and sign a readable message: no gas, no approval. Sui Money reads your native-USDC and SUI balances from Sui Mainnet, imports the last 30 days of payments, and puts each one in a two-layer row. On top is the fact the chain recorded: sent or received, to or from which address, when, and the exact amount. Underneath is what it was for, in your words.

The first time you answer "What was this for?", Sui Money tells you exactly what will be remembered and asks for consent. After that, labelling a payment takes a note and a category. Today shows the payments still waiting for a label; Activity has the full list with filters, search and a "Label next" button for working through a backlog.

There is no custody and no sending. You pay from your own wallet, then come back and explain the payment.

## How it uses Tatum

Every fact on screen comes from Tatum's Sui Mainnet gRPC service. Sui Money matches coin types exactly instead of trusting token symbols, checks coin metadata, and keeps a zero balance distinct from a failed read. History is imported with an affected-address filter, because an incoming payment matters even when your wallet did not submit the transaction, and resumes from durable cursors, because an empty page is not proof that a scan is finished.

The balance refreshes automatically when the saved reading is more than two minutes old and always shows when it was checked. A payment you just sent can take a moment to appear, and the screen says so.

Tatum was verified against a public reference wallet with real incoming and outgoing native-USDC transfers, including an incoming transfer sent by someone else: 60 USDC out and 50 base units (0.000050 USDC) in, confirmed by two resumed history pages and direct transaction reads rather than explorer labels.

## How it uses Walrus Memory

A label is not just a database row. It becomes a versioned event with a durable job:

1. **Saved.** The label form closes at once and the payment shows "Saved. Waiting for Walrus to confirm."
2. **Stored.** The event is submitted through the Walrus Memory relayer to Mainnet.
3. **Confirmed.** Sui Money asks Walrus to recall the event and checks that the same event, profile and revision come back. Only then does the label become active on the payment.

If storage fails, the payment says so ("Walrus didn't store 'Bus pass'") and offers to try again with the same note. If the outcome of a submission is unknown, Sui Money reconciles it by recall instead of writing twice. A correction is a new revision; earlier ones stay stored. PostgreSQL keeps the complete, structured ledger; semantic recall is never used to total money.

Each label stores the note, its category and whether it was a transfer to your own wallet, linked to the payment's transaction ID and your wallet address. Walrus storage cannot be erased on request, so the consent screen asks for short aliases like "Rent" or "Landlord" and never names, phone numbers or keys. The operator runs one shared Walrus account; every profile has its own namespace and the server enforces access.

## How it learned over time

Twenty-four reviewed, synthetic demo memories were written to Walrus Mainnet and each one was confirmed by recall, with storage expiry covering 30 November 2026. They power the public demo, where you can see the same fixed, fictional wallet with and without remembered rules: 1,240.50 USDC held, 328 of explicit bills and a 180 reserve leave 732.50; adding remembered weekly groceries and transport (134) leaves 598.50. The wallet observation is identical in both views; only the remembered context changes the plan.

[FILL IN: your real session. On <date>, I connected my own wallet with Suiet, imported my last 30 days and labelled <n> payments, for example "<label>" on a <amount> USDC payment. The label showed "Waiting for Walrus to confirm" for about <time>, then settled. On <later date>, I signed in again from a fresh session and the labels were back on the same payments. Include one screenshot of a confirmed label before and after signing back in.]

[FILL IN, optional: anything you corrected, such as relabelling a payment, and what the app showed while the new revision was confirmed.]

## What is deliberately paused

Sui Money was designed to turn those remembered explanations into a forward budget: commitments, a virtual reserve, reimbursements and weekly recurring suggestions that only count once you confirm them. All of that is built and tested, and the demo shows it. For real wallets it is switched off, for one reason: Tatum's balance response has no proven checkpoint telling us whether it already includes a payment you just matched to a bill. Releasing a reservation against a balance that might not include the payment would count money twice, so the app refuses to calculate a personal budget until that can be proven.

Building it this way meant BigInt amounts, local calendar dates, database row locks and explicit provenance on every number, and a test suite that covers the failure paths as well as the happy ones: unit and property tests, real-database tests in disposable schemas, and public and signed-in browser tests on every push.

## Try it

- Live app: https://sui-money.vercel.app (connect with Suiet)
- Fictional demo, no wallet needed: https://sui-money.vercel.app/demo
- Integration proof: https://sui-money.vercel.app/proof
- Source: https://github.com/Tolex081/sui-money-total-recall

[FILL IN: link to the demo video once it is uploaded.]

Built for Total Recall, the Tatum × Walrus Memory hackathon, in the Consumer Finance Apps track.
