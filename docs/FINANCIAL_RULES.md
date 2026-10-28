# Financial rules

All money at JSON boundaries is a base-unit integer string. Internally, calculations use BigInt. PostgreSQL uses `numeric(78,0)`. User decimal input is validated and never silently rounded: negative amounts, exponent notation, nonfinite values, whitespace, excessive length and more than six USDC decimals are rejected. The adapter verifies actual metadata and exact canonical coin types. Symbols alone cannot identify assets.

Let B be the latest successfully read native-USDC balance of this single wallet; R the virtual reserve; C the unpaid portions of non-cancelled occurrences due before the selected end date, including unresolved overdue obligations; and D the local calendar days until that date, excluding the end date itself.

```text
signed remainder Q = B - R - C
discretionary A = max(0, Q)
shortfall = max(0, -Q)
daily = floor(A / D to a 0.01-USDC display unit)
leftover = A - daily * D
```

The horizon must be future and no more than 90 calendar days. Temporal handles IANA timezones, DST, leap years and date boundaries; days are not inferred from elapsed milliseconds. A user may select a planning end date instead of predictable income. Expected income amounts never increase B or the allowance before settlement. Missing balance means unknown, not zero.

For B=500, R=100, C=200 and D=10, Q=A=200 and daily=20 USDC. For B=100, R=50 and C=80, shortfall=30 and daily=0. Labels identify this as an estimate from the tracked wallet and entered plan, not a guarantee covering unentered bills.

Past expenses are already reflected in B and are never subtracted again. A settled reimbursement is already in B and is never added again. Own transfers still reduce this wallet's balance; classifying one as an own transfer changes consumption reporting only. Other owned wallets' balances are not aggregated.

Successful supported USDC outflows count as gross consumption until explicitly classified otherwise; unexplained outflows remain visible as Unclassified. Failed transfers do not count as successful USDC spending. Unsupported/complex operations are visible review exclusions with an incompleteness warning. Network costs paid by a sponsor are not charged to the tracked wallet; SUI never enters a USDC total.

Confirmed incoming reimbursement allocations reduce the expense-attributed period's net spending, capped by both the receipt and expense capacities. A later receipt can restate an earlier expense period; the receipt timestamp stays visible. Pending allocations reserve capacity but do not change active net spending. Reversal is retained as a correction event. Expense 40 and settled reimbursement 15 produce gross 40, net 25, with no balance change from linking.

Commitment allocation requires an eligible successful outgoing USDC transfer and explicit user confirmation. It remains one spending movement. The paid reservation releases only after a balance watermark includes its checkpoint; otherwise planning is pending. Before B=500/C=200/R=100 gives A=200; after a reflected 50 payment, B=450/C=150/R=100 still gives A=200. A pre-payment balance cannot be paired with a released reservation.

Row locks and database triggers cap both source and target allocation sums across tabs. Stable movement keys deduplicate imports. Occurrence identity is profile/rule/local date; each occurrence is counted once. Weekly recurrence adds seven local days. Monthly recurrence retains the configured day and clamps a short month without permanently changing day 31. Cancellation changes the plan, not cash.

Weekly suggestions require three distinct eligible user-classified transfers with the same exact destination/token/category, successive local gaps of 6–8 days, and amounts within 5% of their exact median. Suggestions alone do not affect the plan. Confirmed association with an existing manual commitment prevents duplicate obligations.

Learning comparisons preserve wallet observations, current explicit plan inputs and horizon. Only selected learned rules are disabled. Reasons reference their actual event/blob evidence when shown as live; fictional replay never claims actual user learning.
