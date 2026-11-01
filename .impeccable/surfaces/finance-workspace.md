# Finance workspace — design inventory

## Product objects and source

- One authenticated Sui Mainnet wallet; public address and signed-message session identify the account.
- Native USDC balance and movements use the exact native coin type and six decimal places.
- SUI balance and network costs have a separate row and never enter USDC budget arithmetic.
- Incoming and outgoing Tatum events carry their verified transaction facts and status.
- Payment explanations and user confirmations are separate from immutable wallet observations.
- Walrus memories carry confirmed context, user preferences, corrections and a visible recall state.
- Plan inputs are future commitments and a virtual reserve; they do not move or earmark assets.
- The remaining amount is a deterministic estimate from current native-USDC balance and supported plan inputs.
- Public demo values are fictional and remain labelled; reference transactions and synthetic memory evidence have distinct provenance.
- A signed-out or release-gated account shows wallet identity and recovery actions without suggesting that finance data is live.

## Screen questions and next actions

- **Today:** What remains after the tracked native-USDC balance and confirmed plan inputs? Next action: connect a wallet or refresh the checked balance.
- **Activity:** Which supported wallet payments occurred, and what context has the user confirmed? Next action: inspect and explain an eligible event.
- **Plan:** What must be reserved before the next income date? Next action: add or correct a commitment and review its effect on the estimate.

The first-screen signature is the two-source relationship: Tatum beside chain observations, Walrus beside confirmed context. The brand face is the real local Walrus mascot holding the Tatum mark on the landing and memory surface. Both stay away from the key amount and its action.

## Drawn style and shell choice

Taste direction: `pastel-consumer`, seed `637074719`, light mode. Its pale blue surfaces and quiet money polarity fit a daily wallet glance. The drawn icon rail was declined because the product exposes six destinations and needs readable labels; the existing labelled sidebar remains. Keep Figtree on working data, retain Bricolage for display, and keep tabular financial figures.

## Responsive frame

Desktop keeps a labelled sidebar and a fluid content area with one consistent 20–24px working gap. Tablet folds navigation into the native dialog drawer. At 390px, the main balance, action, source and demo/gate status remain visible without horizontal scrolling; list rows preserve their secondary details.
