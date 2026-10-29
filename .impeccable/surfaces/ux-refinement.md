# Complete UI/UX refinement

User request, 29 October 2026: apply Impeccable and Anthropic's frontend-design skill to make the existing product more beautiful and usable while completing the build.

## Existing authority

Retain Sui Money's recognizable Walrus/Tatum artwork, cream/mint/deep-green identity, exact financial semantics and source labels. This expands and polishes the established system; it is not a new visual-world exercise. Product truth is in PRODUCT.md; current tokens are in DESIGN.md. No new financial or endorsement claims.

## Compact design plan

- Ink #202a27, forest #244e3c, canvas #f7f9f5, paper #ffffff, memory mint #e4f4ec, warning #934d3e on #fff0eb.
- Figtree for task UI, forms, data and prose; Bricolage Grotesque for the landing's display voice and restrained brand headings. Self-host official OFL fonts through Next's local font loader.
- Left-aligned financial workspace with a strong amount hierarchy, readable 12–14px labels/prose, consistent spacing, and 44px primary touch controls. Main numbers and source status remain immediately distinguishable.
- The mascot remains the single expressive element. Use tonal layering and precise typography rather than decorative effects. Remove ornamental uppercase headings and redundant labels.
- Repair mobile navigation as a native modal drawer with a close control, Escape/focus handling and automatic close on navigation. Preserve standard browser controls.
- Make the paused account state one clear explanation with demo/proof recovery links. Distinguish an intentional release gate from a dependency failure.
- Proof should summarize source/state/time first and disclose raw JSON on demand, rather than forcing an approximately 20,000px data dump into the reading path.

## Brief check

A generic finance template would add graphs, gradient decoration and many interchangeable cards. This pass instead makes the existing fact/context split legible: Tatum beside observations, Walrus beside confirmed context, and the exact plan formula beside its inputs. Existing images, data, routes and security boundaries remain authoritative. The custom font pairing addresses the prior default typography without borrowing a new unrelated theme.

## Representative composition

```text
Desktop: sidebar | page title + current mode
                 | planning amount       | observed wallet / Tatum
                 | exact inputs          | remembered context / Walrus
                 | upcoming commitments  | activity

Mobile: menu + page identity
        explicit demo or account state
        planning amount / source
        observed wallet
        inputs and remembered context
        commitments, activity
```

## Verification contract

Inspect 390, 768 and 1440px; keyboard drawer open/close/Escape and focus return; meaningful action/error/disabled states; real font/image loading; no horizontal overflow at normal and 200% zoom; serious/critical axe checks. Run the current source detector once after the pass, the appropriate application suite and production build, then independent finish review and current token documentation. Do not bypass the Slush warning, enable personal access, publish external materials or claim genuine learning.
