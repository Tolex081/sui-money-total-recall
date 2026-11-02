---
name: Sui Money
description: A calm, cool-blue wallet workspace that separates verified Sui facts from confirmed planning context.
colors:
  ink: "#15243b"
  muted: "#53627a"
  canvas: "#f4f7ff"
  paper: "#ffffff"
  line: "#dfe7f3"
  blue: "#2863e8"
  blue-hover: "#1f53cf"
  blue-pressed: "#1945ad"
  blue-tint: "#eaf1ff"
  memory: "#eaf3ff"
  memory-border: "#d5e5f7"
  positive: "#216a43"
  positive-soft: "#e8f5ed"
  warning: "#8a5a12"
  warning-soft: "#fff7e8"
  negative: "#934d3e"
  negative-soft: "#fff0eb"
  focus: "#2863e8"
  link: "#2456b6"
  link-hover: "#173f90"
  border-strong: "#b8cae9"
  control-border: "#d7e1f0"
typography:
  body:
    fontFamily: "Figtree, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  display:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "clamp(46px, 5.25vw, 76px)"
    fontWeight: 650
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  app-title:
    fontFamily: "Figtree, sans-serif"
    fontSize: "clamp(24px, 2vw, 28px)"
    fontWeight: 600
    lineHeight: 1.2
  amount:
    fontFamily: "Figtree, sans-serif"
    fontSize: "38px–46px"
    fontWeight: 600
    lineHeight: 1.1
    fontVariantNumeric: tabular-nums
  label:
    fontFamily: "Figtree, sans-serif"
    fontSize: "12px–14px"
    lineHeight: 1.5
  caption:
    fontFamily: "Figtree, sans-serif"
    fontSize: "12px"
    lineHeight: 1.6
  small:
    fontFamily: "Figtree, sans-serif"
    fontSize: "13px"
    lineHeight: 1.6
  body-large:
    fontFamily: "Figtree, sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  subhead:
    fontFamily: "Figtree, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  subhead-large:
    fontFamily: "Figtree, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
  card-title:
    fontFamily: "Figtree, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
  section-title:
    fontFamily: "Figtree, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  card: "16px"
  inner-panel: "12px"
  tile: "10px"
  button: "9px"
  input: "8px"
  pill: "6px"
spacing:
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "32": "32px"
components:
  primary-button:
    backgroundColor: "{colors.blue}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    minHeight: "44px"
  panel:
    backgroundColor: "{colors.paper}"
    borderColor: "{colors.line}"
    rounded: "{rounded.card}"
  memory-panel:
    backgroundColor: "{colors.memory}"
    borderColor: "{colors.memory-border}"
---

# Sui Money design system

## Creative direction

**A clear view of what moved, what remains, and what comes next.** The user's supplied SaaS reference sets the cool, airy palette: an ice-blue canvas, white work surfaces, dark readable ink, and a cobalt action colour. The Sui Money version uses that visual clarity around two distinct sources: Tatum verifies wallet observations; Walrus Memory keeps only user-confirmed context.

The taste skill's finance draw selected **Pastel consumer** (`pastel-consumer`, seed `637074719`). It supplies pale blue tints, quiet money polarity and compact wallet surfaces. The drawn icon rail was declined: the product has six destinations, and its three core tasks need visible labels for people using the wallet for the first time. The labelled sidebar is kept.

## Colour

The background stays predominantly pale blue-white. White panels use a light blue-gray border, not a resting shadow. Cobalt is reserved for the main action, focus, active navigation and a small number of important data marks. Incoming money uses dark green with a plus sign; ordinary spending stays in ink. Errors keep the accessible warm warning colour. Tatum and Walrus logos retain their official artwork on a dark navy backing.

Do not add decorative gradients, glows, blurred glass, or fake financial data. Pale blue surfaces group related information; they never imply that an amount is verified. Demo labels and source status stay visible next to the values they describe.

## Dark theme

The dark theme is the same world at night: a deep navy canvas (`#0b1220`), navy paper panels (`#131c2e`), cool light ink (`#e3e9f4`) and muted text (`#9eabc2`). Cobalt fills (`#3d6fe6`) keep white text at AA; wherever blue is used as text or an icon it switches to the lighter link blue (`#8fb1ff`). Green, warning and negative colours lighten and their soft surfaces darken. Every token's dark value lives in `scripts/generate-dark-theme.mjs`.

The theme follows the system setting until the person chooses one with the sun/moon toggle; the choice is stored in `localStorage` (`sm-theme`) and applied by an inline script before first paint, so there is no flash. `src/app/theme-dark.css` is generated: after changing a colour in `globals.css` or `theme.css`, run `npm run theme:dark`. The generator remaps only hard-coded colours that win the cascade, wraps its selectors in `:where()` so light-theme precedence still holds, and leaves component-scoped custom properties alone.

## Typography and data

Figtree is self-hosted and used for navigation, forms, amounts, labels and body copy. Bricolage Grotesque is used for the wordmark and large landing headline only. Amounts use tabular figures and remain with their unit, source, time window and estimate qualifier. App headings stay in the 24–28px range; account values stay below 48px. The font files and OFL licences remain in `public/fonts`.

## Layout and behavior

The desktop workspace keeps a readable, labelled sidebar beside a fluid content area. Today, Activity and Plan remain the primary navigation. The landing uses a left-aligned explanation with the real Walrus/Tatum mascot artwork beside it, then an explicit integration-role strip and a clearly fictional product preview. Ordinary panels are flat; shadows belong to actual overlays only.

At tablet and phone widths, the desktop sidebar folds into the existing native dialog drawer. It closes with Escape or navigation and returns focus to the menu button. Forms, filters and wallet actions retain visible labels, minimum touch targets, keyboard focus and disabled/error/loading states. Reduced-motion settings are respected.

## Product-specific rules

- Tatum labels verified Sui Mainnet observations. Walrus labels confirmed context and corrections. Neither mark implies sponsor endorsement.
- Native USDC is the budget unit. SUI stays separate for wallet balances and network costs.
- Fictional demo data never becomes personal evidence. The wallet gate and financial release checks remain unchanged by the visual redesign.
- Use the local, attributable Walrus/Tatum assets at their real proportions. Keep mascots clear of amounts, controls and security messages.
- A payment row has two layers: the Tatum fact (direction, counterparty, time, amount) on top, and beneath it either the confirmed label on the memory tint, a dashed "waiting for Walrus to confirm" chip, or a dashed "What was this for?" prompt. This is the screen's one signature element; keep everything around it quiet.
- Amounts are exact but unpadded: at least two decimals, more only when the value needs them.
- Explain uncertainty beside the affected result. Never style a pending balance, unverified memory, missing history or release gate as successful live data.
