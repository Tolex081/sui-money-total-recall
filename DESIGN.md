---
name: Sui Money
description: The incumbent cream, mint, and deep-green interface for wallet facts and remembered context.
colors:
  ink: "#202a27"
  muted: "#596950"
  line: "#e8ece7"
  paper: "#fff"
  canvas: "#f7f9f5"
  green: "#244e3c"
  green-hover: "#346349"
  green-active: "#1c402f"
  selection: "#c4e5cb"
  remainder: "#274c3b"
  memory: "#e4f4ec"
  memory-border: "#cfe6da"
  pill: "#f2f5ee"
  warning-bg: "#fff0eb"
  warning-border: "#efd6cc"
  warning-text: "#934d3e"
  focus: "#327c52"
typography:
  display:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "clamp(54px, 5.5vw, 80px)"
    fontWeight: 650
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Figtree, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  landing-body:
    fontFamily: "Figtree, sans-serif"
    fontSize: "17px"
    lineHeight: 1.75
  page-heading:
    fontFamily: "Figtree, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Figtree, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  amount:
    fontFamily: "Figtree, sans-serif"
    fontSize: "64px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  label:
    fontFamily: "Figtree, sans-serif"
    fontSize: "12px"
  button:
    fontFamily: "Figtree, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  badge: "6px"
  provider: "7px"
  field: "8px"
  button: "10px"
  inset: "12px"
  card: "16px"
spacing:
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "22": "22px"
  "24": "24px"
  "30": "30px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  button-primary-hover:
    backgroundColor: "{colors.green-hover}"
  button-primary-active:
    backgroundColor: "{colors.green-active}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "#33483b"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "#405536"
    rounded: "{rounded.field}"
    padding: "11px 12px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  pill:
    backgroundColor: "{colors.pill}"
    textColor: "#61715f"
    rounded: "{rounded.badge}"
    padding: "6px 9px"
  provider-identity:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.provider}"
    padding: "10px 13px"
---

# Design System: Sui Money

## Overview

**Creative North Star: "Wallet facts. Remembered context."**

This phrase comes from the implemented landing illustration caption. It describes the established identity: pale cream-green canvas, white working surfaces, deep-green financial emphasis, and a mint memory surface. A spacious landing introduces a denser account workspace. Self-hosted Figtree supports everyday tasks; Bricolage Grotesque gives the landing and wordmark a distinct voice.

Official event artwork adds personality without competing with amounts or warnings. Tatum identifies wallet observations; Walrus identifies confirmed context. Provider marks communicate provenance, not endorsement or live verification of the fictional demo. Asset provenance and ownership are recorded in `docs/BRAND_ASSETS.md`.

**Key Characteristics:**

- Pale tonal surfaces and fine borders establish grouping.
- Large amounts lead; their units and source remain adjacent.
- Dark backings preserve the unchanged white provider wordmarks.
- The mascot accompanies explanations and leaves controls clear.

## Colors

The palette is a low-saturation cream-green foundation with darker green emphasis and a distinct mint memory surface. The frontmatter records effective values after CSS overrides, rather than earlier declarations in the stylesheet.

### Primary

- **Deep Green** (`green`): primary actions and memory headings; `green-hover` and `green-active` communicate pointer states.
- **Remainder Green** (`remainder`): the principal planning amount panel, with light text and subdued internal dividers.
- **Selection Green** (`selection`): text selection highlight.

### Secondary

- **Memory Mint** (`memory`, `memory-border`): remembered-context card and its enclosing stroke. Sponsor artwork retains its original colors rather than being recolored to match the application.

### Neutral

- **Ink** (`ink`): primary text and the dark backing for white provider marks.
- **Muted Olive** (`muted`): supporting copy and navigation text.
- **Paper**, **Canvas**, and **Line** (`paper`, `canvas`, `line`): working surfaces, page foundation, and structural dividers. The landing uses a closely related existing cream-green surface rather than an additional global theme.
- **Pill** (`pill`): quiet status-label backing. Context-specific demo and amber statuses have their existing local variants.

Warnings use the warm `warning-bg`, `warning-border`, and `warning-text` triplet; keyboard focus uses `focus`.

**The Provenance Rule.** Provider identity describes the source of facts or context. A provider mark must not turn synthetic finance into verified personal evidence.

## Typography

**Display Font:** Bricolage Grotesque, sans-serif, for the landing headline, preview heading, and wordmark.
**Body Font:** Figtree, sans-serif, for task headings, amounts, forms, navigation, and prose. Both variable fonts are self-hosted through Next's local font loader, with `swap` loading behavior. The small italic brand initial retains Georgia as a logo detail, not a display role. License and source records accompany the local font files in `public/fonts`.

The hierarchy combines closely tracked display type with a readable task scale; it is not a fixed-ratio type ramp. The frontmatter records desktop defaults. The landing display becomes 56px below 760px and 48px below 540px. Its preview heading is 38px, then 34px below 760px. Page headings use `page-heading` and become 30px below 760px. Ordinary card titles use `title`; the memory card has a 25px, weight-550 title with a 1.22 line-height and narrow-screen variants.

Financial hero figures use `amount` and tabular numerals. They become 48px below 980px, 58px below 760px, and 52px below 380px. Wallet totals normally use 37px and weight 550. Operational prose is 13–14px, source explanations 12px, and the base label token is 12px. Page descriptions are constrained to 65ch and prose to 70ch. Status chips and compact footer metadata have contextual 11px treatments; these do not establish a general prose scale. Buttons use the `button` role with small and large variants.

**The Amount and Unit Rule.** Keep the amount visually dominant while retaining its unit, provenance, and estimate qualifier in the same reading group.

The old system display face and ornamental uppercase headings are superseded. Residual metadata wrappers named `eyebrow` in the learning comparison and memory events are not a reusable eyebrow pattern; future surfaces should use direct, semantic labels.

## Layout

The account workspace has a fixed left sidebar (224px) and a fluid content column, with content capped at 1400px. Default content padding is 26px at the top, 22px at the bottom, and 43px horizontally. The principal Today and middle grids use a 1.55:1 split and a 22px gap; lower cards use equal columns. Cards normally carry 24px padding and 20px bottom separation, with explicit component and breakpoint variants. At 1190px the effective desktop sidebar is 208px and horizontal content padding becomes 24px.

The landing is capped at 1440px with 70px side gutters. Its hero places text and artwork in a 1.4:1 grid; the preview is a two-column surface. At 1190px gutters and grid gaps tighten. At 1000px account navigation becomes a native modal drawer, while middle and lower account grids stack. At 980px secondary grids, proof, and plan summaries collapse. The Today pair remains two columns until 540px. At 760px the topbar becomes sticky and the landing hero stacks. Mobile content gutters become 20px, then 18px below 540px; landing gutters become 22px below 540px. Additional 420px and 380px refinements protect artwork and compact controls.

Spacing is a practical set of reused steps in the frontmatter, not a strict modular scale. Preserve wrapping and the `minmax(0, …)`/`min-width: 0` behavior that keeps long content inside the available width.

## Elevation & Depth

Working cards and the landing preview are flat at rest. Pale fills, thin borders, and the dark amount panel create separation. The preview's earlier shadow and rotation are explicitly overridden in the final cascade. Actual elevation is reserved for the modal dialog and native mobile navigation drawer; their exact shadows and backdrop treatment are recorded in the sidecar. The drawer uses a solid dimmed backdrop; the content dialog also blurs its backdrop.

**The Tonal Surface Rule.** Use tonal grouping and fine borders for ordinary cards. Preserve elevated treatment for overlays.

## Shapes

Cards share the effective `card` radius. Fields, buttons, compact badges, and provider backings use the smaller roles in the frontmatter. The preview's inner paper has the `inset` radius. Modal and paused-account containers retain their existing 18px corners; the navigation drawer meets the viewport edge squarely. Fine one-pixel borders carry most structural edges; rounded icon tiles and status dots support compact information groups.

## Components

### Buttons

Rounded actions use the `button-primary` and `button-secondary` variants. The default minimum height is 44px. Primary hover and active states darken the fill; secondary hover shifts to a pale green fill and a stronger border. Large landing actions have 16px × 24px padding and a 52px minimum height, with responsive overrides. Small actions use 10px × 13px padding and a 40px minimum height. Icon controls normally occupy 44px square, with compact activity-row exceptions. Disabled buttons use reduced opacity and the not-allowed cursor.

All interactive controls retain a visible focus outline (3px with 5px offset). Color transitions last 150ms; reduced-motion mode removes transitions and animations. These extension properties live in the sidecar rather than unsupported frontmatter fields.

### Chips

Status pills are compact filled rectangles with the `badge` radius. Their visible text must communicate the state; a dot or fill alone does not communicate provenance. The demo pill remains explicitly labeled as read-only fictional data.

### Cards / Containers

The default `card` is paper on canvas with a fine green-gray border. The dark remainder panel emphasizes the estimate; the mint memory card separates remembered explanations. Do not copy its reserved illustration space into generic cards. At narrow widths the memory illustration shrinks and its text area retains explicit clearance.

### Inputs / Fields

Form fields are white, softly rounded, and lightly stroked, with a 46px minimum height and 14px text. Activity filter inputs and selects have a 44px minimum height. Search is a bordered wrapper around an unbordered input; it uses a 2px focus-within outline. Labels remain visible outside the field. The shared focus treatment also applies to selects, links, summaries, and buttons.

### Navigation

Primary account navigation uses 14px text, 46px minimum-height rounded rows, and 13px secondary navigation. The current route has a pale green backing, darker text, and weight 600; hover adds a quieter pale fill. At 1000px and below a labeled menu control opens a native modal dialog drawer, up to 310px wide. It includes a 44px close control, native focus containment and return, Escape handling, and closes after navigation or when the viewport becomes wider than 1000px.

### Provider identity and mascot

Unchanged white Tatum and Walrus wordmarks sit on the dark `provider-identity` backing. Their proportions are retained; the normal visible mark height is 18px, with smaller contextual variants. The event mascot is served locally and is descriptive on the landing, decorative when repeated beside memory copy. Use the existing integration components and assets rather than inventing a Tatum mascot or rebuilding a wordmark. Official asset ownership remains separate from the application's license.

### Notices

Notices pair an icon with readable text, a pale fill, and a fine stroke. Security and gating messages use the warning treatment and remain serious. The Slush warning is unresolved and wallet sign-in remains paused; visual refinement does not change that state.

### Evidence disclosure

Proof cards present provider/source, recorded state, and checked time before technical payloads. Raw public JSON is collapsed in a semantic details disclosure, scrolls within a capped region when expanded, and has a separate download action. This pattern keeps provenance inspectable without making raw data the default reading path. The paused-account panel has one explanation and recovery links to the demo and integration proof.

## Do's and Don'ts

### Do:

- **Do** use tonal surfaces and fine borders for ordinary cards.
- **Do** retain adjacent units, source labels, and planning qualifiers around financial amounts.
- **Do** use the existing local provider assets with their unchanged proportions and readable dark backing.
- **Do** preserve keyboard focus, reduced-motion behavior, and mascot clearance at mobile widths.

### Don't:

- **Don't** imply sponsor endorsement or give synthetic finance a live-verification badge.
- **Don't** let artwork obscure amounts, controls, provenance, or security warnings.
- **Don't** reproduce legacy eyebrows or substitute text glyphs for interface icons on new surfaces.
- **Don't** extend compact 11px metadata styling into financial explanations, forms, or general prose.
