# Improvement workflow (after judge feedback, Nov 2026)

Two reviewers said the same three things. This page maps each point to a change, in the order we build it.

| # | Feedback | What we change | Where | Done when |
|---|----------|----------------|-------|-----------|
| 1 | "Memory keeps context but doesn't learn. Show remembered context changing a future recommendation." | **Learning layer.** Remembered labels become spending patterns. Patterns change the daily safe-to-spend, check goal pace, and suggest a savings amount. Every recommendation is shown *with memory* and *without memory*, side by side, with the memories that caused the difference. | `src/domain/insights.ts` (pure, tested), `src/components/learned-insights.tsx` on Today | The demo shows a different daily figure with and without memory, and names the remembered labels behind it. |
| 2 | "Warn when a payment goes against a stated goal." | **Payment check before signing.** On Send review: does this payment eat into the goal set-aside or bills, and is it far above what you usually spend in that category? | `checkPayment()` in `insights.ts`, shown in `money-moves.tsx` | Sending more than safe-to-spend shows which goal or bill it would cut into, before the wallet opens. |
| 3 | "Learn from decisions." | Dismissing or accepting an insight is itself remembered on Walrus (`suggestion_decision`), so the same advice never comes back once dismissed. | `POST /api/insights/decision` → `queueEvent` | A dismissed insight stays hidden after reload in personal mode. |
| 4 | "One Walrus account serves all users. The user should own their memory and take it to other apps." | **Bring your own memory account.** The user's wallet creates their own Walrus Memory account on-chain and adds Sui Money as a delegate key. New memories are written to *their* account. They can remove our key at any time from any wallet, and give another app its own key. | `db/migrations/006_memory_owner.sql`, `src/application/memory-account.ts`, `src/components/memory-ownership.tsx` in Settings | A signed-in user can see which account holds their memory (shared operator vs their own) and switch to their own. |
| 5 | "The write path depends on a config flag." | Writes are **on by default** in live mode. `MEMWAL_WRITES_PAUSED=true` is an explicit kill switch. `/api/health` reports `memoryWrites: enabled \| paused`. | `src/adapters/memwal/memory.ts`, `.env.example` | Health shows `enabled` in production with no extra flag. |
| 6 | "No published blog post. README too long, 40+ docs." | One-page README (what, how Tatum + Walrus are used, setup, proof links). `docs/README.md` indexes the rest. Blog post drafted in `docs/BLOG.md` and **published** (owner step). | `README.md`, `docs/README.md` | README fits on one screen-scroll; blog has a public URL on the form. |

## Order

1. Learning layer (1–3) — the core creative gap. Pure domain first, tests, then UI.
2. Write-flag clarity (5) — small, removes a reviewer doubt.
3. Memory ownership (4) — needs Mainnet package and registry IDs (`MEMWAL_PACKAGE_ID`, `MEMWAL_REGISTRY_ID`); the feature stays hidden until both are set.
4. Presentation (6) — last, so it describes what actually shipped.

## How "learning" works (the rule set)

All rules are deterministic and run on confirmed memories only. No model guesses numbers.

- **Routine spending pattern** — a category the user labelled (a remembered label) with spending in at least 3 of the last 4 weeks, not already covered by a bill or commitment of the same category. Its typical weekly spend is the last 4 weeks added up and divided by 4, rounded down to the cent.
- **Learned daily allowance** — `(safe-to-spend − expected routine spend until the end date) ÷ days`. Without memory there are no labels, so no patterns, so the plain daily figure is used. The gap between the two numbers is the point of the feature.
- **Goal pace** — if a savings goal is active and safe-to-spend after expected routine spend is below zero, the goal is at risk. We name the largest flexible category and the weekly cut that would close the gap.
- **Savings suggestion** — with no goal and positive slack after routine spend, suggest saving half the weekly slack, rounded down to the cent.
- **Payment check** — warns when a payment exceeds safe-to-spend (says which goal or bill it cuts into) or is over 1.5× the usual weekly spend for its category.

## What we will not claim

- Memory ownership is wired and tested locally; the on-chain flow needs Mainnet IDs and a real wallet run before we call it verified.
- Insights are rules, not predictions. Each one names the memories and numbers it used.
