---
target: read-only wallet screens
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\HELLO\\Documents\\sui-money\\src\\components\\read-only-wallet.tsx"
target_fingerprint: "sha256:dba9fba08bfb651b199a1a1e724879d72ac5e80e6e1f4332f385ab099c49e602"
target_path: "C:\\Users\\HELLO\\Documents\\sui-money\\src\\components\\read-only-wallet.tsx"
timestamp: 2026-11-02T11-29-19Z
slug: src-components-read-only-wallet-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | A failed Walrus write is announced only to screen readers; visually the row silently reverts to the prompt |
| 2 | Match System / Real World | 2 | Provider jargon on the main path ("through Tatum", "Consent version", "not a lifetime wallet export"); hex-only payees |
| 3 | User Control and Freedom | 2 | Esc/Cancel now work, but a pending label cannot be edited or withdrawn and the Walrus consent has no Cancel |
| 4 | Consistency and Standards | 2 | Today equals Activity; label categories differ from the app's list; copy advertises paused budgets and plans |
| 5 | Error Prevention | 3 | Permanence note tied by aria-describedby; category silently defaults to Other |
| 6 | Recognition Rather Than Recall | 3 | Inline prompts and count; stall reason hidden in a title tooltip |
| 7 | Flexibility and Efficiency | 1 | No search, filter, label-next or paging past 25 |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and on-brief; balance card repeated on Activity; freshness stated twice |
| 9 | Error Recovery | 1 | Failure message not visible; stall detail only on hover; Check again does not say what it does |
| 10 | Help and Documentation | 2 | Technical Tatum disclosure; nothing explains Walrus confirmation or how long it takes |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

LLM assessment: mostly authored around one real signature, the two-layer payment row and its "What moved is read from the chain. What it was for comes from you." thesis. Surroundings (balance card, panels, sidebar) remain category-interchangeable; Walrus and Tatum appear as copy, not as identity near the values they vouch for.

Deterministic scan: read-only-wallet.tsx and dashboard.tsx 0 findings. Wider scan 195 advisories (was 308): 112 colour, 70 font-size, 13 radius; globals.css 154, theme.css 41. Live /today 1 finding (was 3): a one-word straggler line in the account-scope paragraph. Live /demo/activity 0 (was 2): the 11px text findings are gone. New real finding: theme.css:303 `.pay-value small` is 11px. False positives: clamp bounds inside documented ranges; dead `.read-movement*` / `.read-live-banner` CSS in globals.css.

Visual overlays: not available; the live site's CSP blocks the injected detector script.

## Priority Issues

- [P1] Failed and stalled labels: failure only reaches screen readers; `stalled` is one global value so every pending chip (including fresh saves) flips to "Not confirmed yet"; reason only in a title tooltip. Track per event, show a visible inline failure with retry using the same note, show the reason as text. /impeccable harden
- [P1] Today and Activity are the same screen. Today: balance + needs-label queue + last 3; Activity: no balance card, filters, search, paging, label-next. /impeccable layout
- [P1] Walrus consent and save under-reassure; focus drops to body after save because the opener ref points at an unmounted prompt. State exactly what is stored, add Cancel and About link, keep the payment summary visible, focus the new pending chip. /impeccable clarify
- [P2] Sign-in hierarchy: page h1 plus card h2 compete; mobile demo button full-width outweighs Connect Wallet (globals.css:150); Explore demo twice; scope line and sidebar note advertise paused features. /impeccable distill
- [P2] Row targets and type: 18px-tall "View transaction", 32px Edit/Check again, 11px USDC unit, clipped mobile wallet id. /impeccable adapt

## Persona Red Flags

Alex: five open-select-save cycles for five payments; category resets to Other; no search/filter/paging; Activity duplicates Today; two clicks to sign in.
Sam: focus lost after save; failure heard but no visible retry control; stall reason in title; pending chip has no announcement; one landmark region per day group.
Casey: label backlog below the first viewport; small digest link under the counterparty; 32px controls; chip text wraps; client-driven confirmation stops when leaving with no resume hint.

## Minor Observations

"Checked just now" never ticks; Activity subtitle says "successful" though failed rows can render; dead legacy `.read-*` CSS; "Consent version" strings visible; loading text mentions a paused plan; needs-label banner not clickable; straggler word in the scope paragraph.

## Questions to Consider

- If labeling is the only thing this pilot saves, why is the balance the hero of both screens?
- What if the confirmed-label moment were the visible peak, not a silent tint change?
- Should Activity exist until it does something Today cannot?
