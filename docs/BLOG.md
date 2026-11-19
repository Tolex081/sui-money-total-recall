# A budget that learns from what you tell it

A wallet can tell you how much USDC it holds. It can't tell you that the 18.50 you sent this morning was lunch, that you eat out most weeks, or that at this pace you won't reach the 700 you're saving for a laptop. That knowledge lives in your head, or in a chat that's gone next session.

Most "memory" in apps just keeps context: it stores your notes and shows them back. Sui Money goes one step further. It remembers what you confirm on Walrus, and then **uses that memory to change its advice**.

## The idea in one table

Here is the public demo account on 28 October 2026, worked out twice: once with no memory, once with what it remembers.

| | Without memory | With memory |
|---|---|---|
| Bills set aside | Rent, internet | Also weekly groceries and transport, which you confirmed from past payments |
| Habits expected | None | Eating out, about 30.75 USDC a week, learned from 5 payments you labelled |
| **Safe to spend** | **66.59 USDC a day** | **50.01 USDC a day** |

Without memory, the app would happily tell you 66.59 a day is free. With memory, it knows you'll spend about 48 USDC on eating out before your plan ends, because you've done it four weeks running, so it doesn't promise you that money. Sui Money shows both figures side by side, with the memories behind the difference, on the Today screen.

## What it learns, and what it does with it

Every rule is fixed and tested, with no model guessing. Each piece of advice names the memories it came from.

- **Habits from labels.** When you label a payment ("Food — eating out"), that label is remembered on Walrus. A category you've labelled in at least 3 of the last 4 weeks, and that no bill already covers, becomes a habit. Its weekly amount is the last four weeks added up and divided by four.
- **A daily figure that accounts for your habits.** Expected habit spending until your plan ends comes off what's safe to spend before the daily amount is worked out.
- **A goal check.** If you're saving towards something and your usual spending would leave it short, Sui Money says so, by how much, and which weekly cut in one category would close the gap. If there's room, it says your goal is on track.
- **A savings suggestion.** With no goal and money left after your habits, it suggests saving half of the spare amount each week and keeping the rest as a cushion.
- **A check before you pay.** On the Send screen, before your wallet opens, Sui Money tells you whether the payment would take money set aside for your goal or a later bill, and whether it's far above what you usually spend in that category ("about 2.6× what you usually spend on Food in a week").
- **It learns from your decisions too.** Dismiss a piece of advice and the dismissal is itself remembered on Walrus, so the same advice doesn't come back on any device.

Labelling a payment used to be bookkeeping. Now it teaches the budget something.

## Your memory, in your account

By default, each wallet's memories live in their own private space inside Sui Money's Walrus Memory account. That works, but it means the app holds your financial memory, not you.

So Sui Money now lets you move it. In Settings → *Who owns your memory*, your wallet creates your own Walrus Memory account on Sui and adds Sui Money as a delegate key. From then on, new memories are written to the account you own. You can remove Sui Money's key with your wallet at any time and give another app its own key. Your spending context goes with you.

Both steps are ordinary Sui transactions: Sui Money builds them through Tatum, and only your wallet signs them. Sui Money's copy of its delegate key is encrypted, and each memory is always checked against the account it was written to.

## How it uses Tatum

Every wallet fact comes from Tatum's Sui Mainnet gRPC service: balances, coin details, checkpoints and history. Sui Money matches coin types exactly instead of trusting token symbols, and keeps a zero balance distinct from a failed read. History imports resume from saved positions, because an empty page doesn't prove the scan is finished. Every transaction your wallet signs, whether a USDC send or the memory-account setup, is built through Tatum and submitted through Tatum.

One thing Tatum can't yet tell us is exactly which point on the chain a balance was read at. So when you match a payment to a bill, Sui Money keeps that bill's money held until it can prove the balance already includes the payment. The numbers can be cautious; they're never counted twice.

## How it uses Walrus Memory

Labels, bills, savings goals, preferences and now your decisions on advice each become a versioned record:

1. **Saved.** The screen says "Saving to Walrus."
2. **Stored.** The record goes through the Walrus Memory relayer to Mainnet.
3. **Confirmed.** Sui Money reads the record back and checks it matches. Only then does it count, and only then can it teach the budget anything.

A write whose outcome is unknown is read back before anything is retried, so nothing is stored twice. A correction is a new version; the old one stays in history, marked replaced. Memory writes are on by default in production.

## What actually happened on Mainnet

On 4 and 5 November 2026, in production, with a real wallet signed in through Suiet:

- **A payment label, corrected twice.** A real payment got a label, then a corrected category (version 2), then a corrected note (version 3). After signing out and back in, the current version came back from Walrus and matched.
- **A savings goal that survived a fresh session.** "Laptop, 500 USDC, weekly" was saved and confirmed by Walrus. After a full sign-out and sign-in, "Verify memories from Walrus" returned it: *Revision 1, returned by Walrus, matches*.
- **A correction that changed the plan.** The target went up to 700. Until Walrus confirmed it, the 500 version stayed in use; then the plan switched to 50.00 USDC a week. Walrus returned *Revision 2, replaces revision 1, matches*.

By 5 November that one real account held 13 records on Walrus Mainnet, every one stored and read back. The public demo holds 24 more: reviewed, fictional records, each confirmed by read-back.

## Honest limits

- The learning features are new. The figures in the table above come from the public demo's fictional data; they haven't yet been shown on a real wallet's history.
- Moving your memory to your own account is built and tested, but hasn't yet been run end to end on Mainnet. Memories saved before you move stay in the shared account for now; copying them across is next.
- The balance proof from Tatum is still open, so matched bills stay held.
- "Saved so far" on a goal is a number you type, not a reading of your wallet.

## Try it

- Demo with fictional data, no wallet needed: https://sui-money.vercel.app/demo (the "What memory changed" card is on Today)
- Live app: https://sui-money.vercel.app (sign in with Suiet)
- Integration proof: https://sui-money.vercel.app/proof
- Source: https://github.com/Tolex081/sui-money-total-recall

Built for Total Recall, the Tatum × Walrus Memory hackathon, in the Consumer Finance Apps track.
