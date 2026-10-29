# Real planning preference across sessions

This remains a real acceptance task, separate from the approved fictional recurring-payment replay. The earlier `10000` input is unassigned and will not be interpreted as an amount.

1. Wait until the Slush warning is resolved and personal access gates are cleared. Do not bypass the warning or move funds for a test.
2. In Plan, choose an actual reserve amount in **USDC**, an end date and your timezone. A reserve is virtual and does not lock funds. Saving the explicit plan persists it in the database.
3. Choose “Also remember this reserve for future plan choices” only for an amount you actually want remembered. This prepares a separate pending memory. Review its exact event and payload in Memories before any Mainnet submission. Assistant-operated additional writes require separate approval of the exact payload; the 24-record synthetic approval does not cover it.
4. After an authorized write, wait for confirmed storage and matching signed recall. Pending, failed or unknown jobs do not activate the preference; do not blindly resubmit an unknown job.
5. Return in an actual later browser session, authenticate, open Memories and refresh recall. Inspect the same preference and its blob evidence. In Plan, “Use remembered reserve” fills the field; saving explicitly applies it. Recall never silently overwrites your current plan.
6. If your real preference changes, enter the genuinely desired new amount and remember it as a new revision. Review/authorize the exact new payload before submission. The previous revision remains active until the new write and matching recall pass; earlier events stay visible.
7. Retain redacted before/after results, actual session dates, event revisions and blob evidence. Avoid publishing private wallet or authentication metadata.

A reserve preference can demonstrate genuine cross-session recall and correction. It does not replace the brief's separate recurrence/history acceptance requirements. If no genuine correction is wanted, record that fact and leave the correction gate open.
