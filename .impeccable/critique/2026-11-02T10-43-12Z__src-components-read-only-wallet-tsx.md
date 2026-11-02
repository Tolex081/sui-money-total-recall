---
target: read-only wallet screens
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\HELLO\\Documents\\sui-money\\src\\components\\read-only-wallet.tsx"
target_fingerprint: "sha256:4ff93f273edd920de866351da2dd0f9a1e806b7512649f0c761a8e0a57d5d7c7"
target_path: "C:\\Users\\HELLO\\Documents\\sui-money\\src\\components\\read-only-wallet.tsx"
timestamp: 2026-11-02T10-43-12Z
slug: src-components-read-only-wallet-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Freshness and pending states clear; "Remembered." is cleared the instant the form closes; up to 84s save wait with no progress |
| 2 | Match System / Real World | 3 | "Sent to / What was this for?" plain; connect copy is jargon-dense; payees only as hex |
| 3 | User Control and Freedom | 2 | Label form has no Cancel or Esc; a pending save cannot be abandoned |
| 4 | Consistency and Standards | 2 | Off-system black dapp-kit Connect button; signed-out state styled as error alert; 32px Edit vs 44px buttons |
| 5 | Error Prevention | 3 | Consent, required note, maxLength; no permanence reminder at Save; category silently defaults to Other |
| 6 | Recognition Rather Than Recall | 3 | Labels inline; but payee is hex only and labels never reused for the same address |
| 7 | Flexibility and Efficiency | 1 | No filter, search, needs-label view, paging past 25, or label-next flow |
| 8 | Aesthetic and Minimalist Design | 3 | Calm; Tatum provenance stated 3x above the fold; rows ~1000px wide at 1440 |
| 9 | Error Recovery | 2 | Raw error messages, shown twice (page and card); no retry for stuck pending labels |
| 10 | Help and Documentation | 2 | Tatum disclosure and consent copy exist; no Walrus explanation at the labeling moment |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict

LLM assessment: partly authored. The two-layer payment row (chain fact above; confirmed / pending / prompt memory states below) and the provenance copy are specific to Sui Money. The shell (sidebar, breadcrumb, white cards, big-number card) and especially the connect screen are category-interchangeable. Brand brief asks for visible Walrus/Tatum; only a sidebar Walrus logo appears on these screens, and its "A plan that remembers" copy promotes paused planning.

Deterministic scan: read-only-wallet.tsx and dashboard.tsx: 0 findings. src/components + src/app: 307 advisories, all CSS (globals.css 242, theme.css 65): 132 off-token colours, 152 off-ramp font sizes, 23 off-scale radii. Most come from the minified legacy globals.css layer that theme.css overrides by variable only. Font-size hits partly false positive (12-13px labels and the 38-46px amount clamp are within DESIGN.md ranges). Live: /today and /demo/activity: 11px sidebar micro text and 11px table heading (below the 12px floor), icon-tile-over-heading on the connect card, ~91-char lines in the connect paragraph. All verified real.

Visual overlays: not available. Injection succeeded mechanically but detect.js was blocked by the site's CSP (script-src 'self' 'unsafe-inline').

## Priority Issues

- [P1] Connect screen hierarchy inverted and main control off-system (dashboard.tsx:51, wallet.tsx:25). Fix: theme the dapp-kit button (cobalt, Figtree, 44px, 9px radius) as the only primary; demote demo/proof; treat 401 as a state, not an alert; one-sentence copy capped near 65ch. /impeccable clarify
- [P1] Label save payoff lost, blocking, no exit (read-only-wallet.tsx:66-81, :123). Fix: close on POST success, confirm in background, announce "Remembered: <note>" once in a list-level live region, add Cancel/Esc with focus return, permanence line at Save. /impeccable harden
- [P2] Today and Activity are the same screen (:158-202). Fix: Today = balance + needs-label queue + 3 latest; Activity = full list with filter chips and paging; tappable needs-label banner. /impeccable layout
- [P2] Mobile top bar truncates the wallet ID (globals.css:10 max-width:65px rule catches .wallet-id). /impeccable adapt
- [P2] Row-level accessibility and targets: 32px Edit, 12px inline "View transaction" over the chip, duplicate accessible names per row, several competing role=status regions. /impeccable audit

## Persona Red Flags

Alex: one-at-a-time labeling with up to 84s lock; no needs-label filter, search, paging, shortcuts or Esc; labels not reused per payee.
Sam: error alert announced on signed-out load; repeated identical control names; multiple live regions incl. self-updating "Checked 1 min ago"; no focus management on the label form; Connect button focus ring unverified (shadow DOM).
Casey: wallet ID clipped; 32px Edit; "View transaction" stacked on the prompt chip; non-tappable banner that looks tappable; leaving the app stops page-driven polling with no retry.

## Minor Observations

Page title "Your wallet, clearly." vs nav "Today"; document title promotes planning; outgoing arrows in cobalt (reserved for actions); rows and balance card too wide at 1440 (cap ~800px); U+2212 minus renders with a gap; 12px muted day headings weak; "Consent version" strings user-facing; sidebar Walrus card dead-ends at a read-only Memories page; the timeout status message is also cleared immediately; 11px text below the documented floor; theme.css hover/border shades undocumented in DESIGN.md.

## Questions to Consider

- What if Today were a label inbox ("2 payments need a story") instead of a shorter Activity list?
- Why watch a disabled form for 84 seconds when the row already shows an honest pending state?
- Should the brightest button on the signed-out screen take people away from their own wallet?
