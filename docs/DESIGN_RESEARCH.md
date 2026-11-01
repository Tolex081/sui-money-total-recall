# Design research

Reviewed 1 November 2026 on Pinterest (searches: crypto wallet budget app UI; spending tracker categories; transaction details with note/category) against the current screens in `.impeccable/review/ux/`.

## What strong finance apps do

| Pattern | Seen in | Apply to Sui Money |
| --- | --- | --- |
| One hero number with a single supporting line | Most wallet/budget shots | Today already does this (remaining after plan). Keep the green card; make the wallet balance the second hero after connect. |
| Balance card with quick actions row (Send / Receive / More) | Crypto wallet concepts | No in-app send. Use the row for **Refresh balance**, **Copy address**, **Open in wallet** and **Label payments**. |
| "Needs attention" count or badge | Spending dashboards | Show "3 payments need a label" on Today, linking to Activity filtered to unclassified. |
| Category list with icon, name, transaction count, amount and a thin progress bar | KOHO-style categories, KeepCoin, "Spending" breakdowns | Replace the plain number tiles on Activity with a category breakdown (USDC only). |
| Transactions grouped under date headers ("Today", "Yesterday", "28 Oct") | Recent-transactions lists | Group Activity and Recent activity by local date instead of repeating the date on each row. |
| Transaction detail sheet: big amount, status chip, counterparty, then editable Category / Note fields | Transaction detail concepts | The labeling flow: a bottom sheet on mobile with the amount, recipient (short address + "Name this address"), category chips and a "What was this for?" note. Save shows a Walrus "saving… / remembered" state. |
| Recipient chips with avatars or initials | Recipients screens | Saved counterparties ("Landlord", "Mum") as chips once named, so later payments are labeled from memory. Visible proof that memory changes the product. |
| Pending → success state with clear wording | Pending status UI shots | Reuse for the memory job lifecycle (queued → saved → remembered). |
| Before/after comparison card | "Before / After" finance shot | Keep the existing learning comparison; give it this visual treatment. |

## Avoid

- Portfolio charts, token tickers, price change percentages and fiat totals. These are out of scope (brief §4.4) and would read as a trading app.
- Neon-on-black crypto styling. The current calm light/green palette is more distinctive for consumer finance and matches DESIGN.md.
- Donut charts with many slices. A ranked category list with bars is easier to read at 390px.

## Priorities for the redesign

1. After connect: a wallet balance card with source label (Tatum), observed time, lag caveat and refresh.
2. "Needs a label" prompt plus a transaction detail sheet with a category and note.
3. Remembered counterparties shown as chips, which demonstrates Walrus learning (the Best Walrus Memory award criterion: memories that visibly change the product).
4. Activity grouped by date with a category breakdown.
