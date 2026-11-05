# What a wallet balance cannot tell you

A wallet can tell you how much USDC it holds. It cannot tell you that the 18.50 you sent this morning was lunch, that last Tuesday's 120 went to another wallet you own, or that you are saving 700 for a laptop by February. That meaning lives in your head, or in a chat that is gone next session.

Sui Money is a bet that a money app should remember what you tell it, prove where it kept it, and plan with it.

## What it does

Connect a Sui wallet and sign a readable message: no gas, no approval. Sui Money reads your native-USDC and SUI balances from Sui Mainnet and imports your recent payments.

- **Today** answers one question: what can I spend? One sentence and one figure, with a timeline that steps down as each bill falls due.
- **Activity** puts every payment in two layers. On top is what the chain recorded: sent or received, when, the exact amount. Underneath is what it was for, in your words, or a dashed "What was this for?" prompt.
- **Plan** holds your bills, a reserve and a savings goal.
- **Memories** lists everything Sui Money remembers, its status, its earlier versions and its Walrus proof.
- **Ask** (the walrus button, bottom right) answers questions about your money and labels every answer by where it came from.

Sui Money never holds your keys. When you send USDC, the transaction is built on the server through Tatum and signed only in your own wallet. A savings goal never moves or locks money: it only sets aside part of what you can spend, on paper.

## How it uses Tatum

Every wallet fact comes from Tatum's Sui Mainnet gRPC service. Sui Money matches coin types exactly instead of trusting token symbols, checks the decimals, and keeps a zero balance distinct from a failed read. History is imported with an affected-address filter, because an incoming payment matters even when your wallet did not submit the transaction, and it resumes from durable cursors, because an empty page is not proof that a scan is finished. Every balance on screen says "Read from Sui Mainnet through Tatum" and when.

Tatum was verified against a public reference wallet with real incoming and outgoing native-USDC transfers, confirmed by resumed history pages and direct transaction reads rather than explorer labels.

One thing Tatum cannot yet tell us is exactly which point on the chain a balance was read at. So when you match a payment to a bill, Sui Money keeps that bill's money held until it can prove the balance already includes the payment. The numbers can be cautious; they are never counted twice.

## How it uses Walrus Memory

A remembered thing is not just a database row. Labels, recurring bills, planning preferences and savings goals each become a versioned record with a durable job:

1. **Saved.** The screen closes at once and says "Saving to Walrus."
2. **Stored.** The record goes through the Walrus Memory relayer to Mainnet.
3. **Confirmed.** Sui Money reads the record back from Walrus and checks that the same record, profile and version return. Only then does it count in your plan.

If storage fails, the screen says so and the previous version stays in use. If the outcome of a write is unknown, Sui Money reads back before it decides to write again, so nothing is stored twice. A correction is a new version that replaces the old one; the old one stays in history, marked replaced. PostgreSQL keeps the structured ledger; similarity search is never used to total money.

Each wallet's records live in their own space inside Sui Money's Walrus account, and the server decides who can read them. Walrus storage cannot be erased on request, so Sui Money asks for short descriptions and never names, phone numbers or keys.

## What actually happened

This is not a mock-up. On 4 and 5 November 2026, in production, with a real wallet signed in through Suiet:

- **A payment label, corrected twice.** A real 0.01 SUI payment got a label, then a corrected category (version 2), then a corrected note (version 3). After signing out and back in, the current version came back from Walrus and matched; the earlier ones stayed in history.
- **A savings goal that survived a fresh session.** "Laptop, 500 USDC, weekly, by 4 February 2027" was saved and confirmed by Walrus, with a suggested 35.72 USDC a week. The wallet signed out completely and signed back in. "Verify memories from Walrus" returned the goal: *Revision 1, returned by Walrus, matches*.
- **A correction that changed the plan.** The target was raised to 700. Until Walrus confirmed it, the 500 version stayed in use; then the card switched to 700.00 USDC and 50.00 USDC a week. Walrus returned *Revision 2, replaces revision 1, matches*.
- **Ask answering from memory.** "What am I saving towards?" came back as 700 for a laptop, labelled *Walrus Memory, version 2*. "What was my previous target?" listed version 2 in use and version 1 (500) replaced. "How much should I contribute weekly?" gave 50.00, labelled *Calculated*. "Increase my goal to 1,000 USDC" produced a proposal; we pressed "No, keep it" and it said "Kept as it is. Nothing was saved."

By 5 November that one real account held 13 records on Walrus Mainnet, every one stored and read back. The public demo holds 24 more: reviewed, fictional records, each confirmed by read-back and kept until at least 30 November 2026.

## Ask is not an AI model

Ask answers from fixed rules over your own data, so it never guesses a number. Every answer carries one of three labels: **Walrus Memory** (what you confirmed), **Sui blockchain** (what Tatum read), or **Calculated** (Sui Money's arithmetic on the two). It can propose a change to your goal, but nothing is saved until you press "Yes".

## Honest limits

- Isolation between separate Walrus accounts has not been tested; namespace separation was shown inside one operator account.
- The balance-inclusion proof from Tatum is still open, so matched bills stay held, as described above.
- "Saved so far" on a goal is a number you type, not a reading of your wallet.
- The public demo uses fictional finances, clearly marked on every screen.

Building it this way meant exact integer amounts, local calendar dates, database row locks, a source on every number, and tests for the failure paths as well as the happy ones: unit tests, real-database tests, and public and signed-in browser tests on every push.

## Try it

- Live app: https://sui-money.vercel.app (sign in with Suiet)
- Demo with fictional data, no wallet needed: https://sui-money.vercel.app/demo
- Integration proof: https://sui-money.vercel.app/proof
- Source: https://github.com/Tolex081/sui-money-total-recall

Built for Total Recall, the Tatum × Walrus Memory hackathon, in the Consumer Finance Apps track.
