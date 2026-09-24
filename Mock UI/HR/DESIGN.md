---
name: Revive HR System
colors:
  primary: "#006c49"
  primary-hover: "#005236"
  brand-50: "#f0fdf4"
  brand-100: "#dcfce7"
  brand-200: "#bbf7d0"
  brand-300: "#86efac"
  brand-400: "#4ade80"
  brand-500: "#10b981"
  brand-600: "#006c49"
  brand-700: "#005236"
  brand-800: "#00422b"
  brand-900: "#002113"
  charcoal-50: "#f9f9ff"
  charcoal-100: "#f1f3f5"
  charcoal-200: "#e9ecef"
  charcoal-300: "#dee2e6"
  charcoal-400: "#adb5bd"
  charcoal-500: "#6c7a71"
  charcoal-600: "#495057"
  charcoal-700: "#343a40"
  charcoal-800: "#111c2d"
  charcoal-900: "#212529"
  surface: "#f9f9ff"
  on-surface: "#111c2d"
  success: "#16a34a"
  danger: "#dc2626"
  warning: "#d97706"
  info: "#2563eb"
typography:
  page-title:
    fontSize: 20px
    fontWeight: "700"
    lineHeight: 28px
  card-title:
    fontSize: 14px
    fontWeight: "600"
    lineHeight: 20px
  table-header:
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 16px
    textTransform: uppercase
    letterSpacing: 0.03em
  table-body:
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
  button:
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 1
  button-sm:
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 1
  stat-value:
    fontSize: 18px
    fontWeight: "700"
    lineHeight: 1.25
  stat-label:
    fontSize: 10px
    fontWeight: "400"
    lineHeight: 1.25
  bento-label:
    fontSize: 11px
    fontWeight: "600"
    lineHeight: 16px
    textTransform: uppercase
    letterSpacing: 0.05em
  form-label:
    fontSize: 13px
    fontWeight: "500"
    lineHeight: 18px
  form-input:
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
rounded:
  button: 8px
  card: 12px
  stat-tile: 12px
  small-chip: 4px
  pill: 9999px
spacing:
  unit: 4px
  stat-tile-padding: 12px
  card-header-padding: "16px 10px"
  table-cell-padding: "12px 16px"
  table-header-padding: "10px 16px"
  btn-height: 40px
  btn-sm-height: 36px
  btn-md-height: 40px
  btn-icon-size: "36px x 36px"
  gutter: 8px
---

## Brand & Style

The design system is engineered for high-performance enterprise HR environments. It balances the vitality of human-centric management with the precision of data-heavy administrative tools. The brand personality is professional, growth-oriented, and highly reliable.

The design style is **Corporate / Modern** with a focus on high-density information architecture. It utilizes a "Clean Slate" approach: heavy reliance on white space, meticulous alignment, and a restrained color palette.

The aesthetic is characterized by:

- **Functional Clarity:** Every element serves a navigational or informational purpose.
- **Precision Engineering:** Subtle borders and strict grid adherence over heavy shadows.
- **Human Vitality:** Use of emerald tones to evoke a sense of growth and health within the workforce.

## Colors

A refreshing yet authoritative **"Emerald & Slate"** palette designed for long-duration desktop usage.

- **Primary (Emerald #006c49):** Primary actions, progress indicators, active states, focus rings, and the "go" state.
- **Brand scale:** 50 `#f0fdf4` (mint tint backgrounds) → 500 `#10b981` (accent green) → 600 `#006c49` (primary) → 700 `#005236` (hover) → 900 `#002113`.
- **Charcoal/Slate scale:** 100 `#f1f3f5` (hover fills), 200 `#e9ecef` (card borders, dividers), 300 `#dee2e6` (input borders), 400 `#adb5bd` (placeholder/subcopy), 500 `#6c7a71` (secondary text), 800 `#111c2d` (headings), 900 `#212529` (body text).
- **Surface:** `#f9f9ff` (page/app background, charcoal-50). Cards are pure white.
- **Semantic:** success `#16a34a`, danger `#dc2626`, warning `#d97706`, info `#2563eb` — used for badges, KPI color accents, and status pills.

## Typography

**Inter** is used for all roles.

- Page titles: 20px Bold.
- Card titles / table body: 14px.
- Table headers: 12px SemiBold, uppercased with slight tracking.
- Buttons: 14px medium (`.btn`); compact buttons 14px (`.btn-sm`).
- Stat values 18px Bold; stat labels 10px.
- Section/card headers (`.bento-label`): 11px SemiBold, uppercase, 0.05em tracking.
- Form labels 13px medium; form input text 14px.
- Labels and metadata throughout lean on the 10px size (`text-[10px]`).

## Layout & Spacing

- Spacing scales on a **4px unit**.
- Stat tiles and cards use **12px inner padding** (`p-3`).
- Card headers use `16px × 10px` padding with a subtle bottom border.
- Table cells: 12px vertical × 16px horizontal; headers 10px × 16px.
- KPI strips are `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2` (dashboard/access use 5 columns).
- Main content area uses uniform `p-4` (16px) padding (no `lg:p-6`).
- Shell chrome: top header `h-16` (64px, cap 56–64px), sidebar `w-64` with brand block `h-16`; sidebar nav rows ~36px tall, `gap 10px`, `py-3` container padding.
- **Desktop-first** with sidebar navigation; mobile collapses to card/row layouts already implemented.

## Elevation & Depth

Kept flat — depth is communicated through 1px borders, not shadows.

- **Cards/Tiles:** Pure white, 1px `#e9ecef` border, radius 12px. Optional accent: 4px brand left border on the first tile of a strip (`.stat-tile-accent`).
- **Hover:** cards shift border color rather than lift; buttons darken their background on hover.
- **Modals:** white with a stronger shadow to indicate a temporary overlay; scale-in animation.

## Shapes

- **Buttons & inputs:** 8px radius.
- **Cards & stat tiles:** 12px radius.
- **Badges, pills, avatars:** full pill (9999px).
- **Small chips inside tables/cards:** 4px radius.

## Components

### Buttons

- Base `.btn`: 14px medium, 8px radius, inline-flex centered, **40px tall**.
- `.btn-sm`: **36px tall**, 14px text.
- `.btn-md`: **40px tall**, 14px text.
- `.btn-icon`: **36px × 36px square**, padding 0, content centered — used for compact icon-only actions (e.g. kanban move arrows, "View" on pipeline cards).
- Height is enforced via the CSS `height` property with `box-sizing: border-box` — do not override with ad-hoc `text-[Npx]` utilities.
- Variants: `.btn-primary` (emerald bg, white text), `.btn-secondary` (white bg, slate text, 1px border), `.btn-ghost` (transparent), `.btn-danger`, `.btn-danger-outline`, `.btn-success`, `.btn-disabled`, `.btn-link`.

### Stat Tiles (page-level KPI strips)

The standard tile on page-level KPI strips:

- Container: `.stat-tile` — white, 1px `#e9ecef` border, 12px radius, 12px padding. First tile in a strip uses `.stat-tile-accent` (4px brand left border).
- Value: `.stat-value` — 18px Bold `#111c2d`.
- Label: `.stat-label` — 10px `#6c7a71`.
- Optional `.text-[9px]` sub-line under the label for secondary copy (e.g. trend deltas).

### Secondary Scale (nested card stats)

Nested statistics **inside** profiles, positions, and detail cards intentionally use a smaller/alternate scale and are **not** stat tiles:

- **Profile summary "hero" metric** (e.g. attendance rate in an employee profile): value up to 24px Bold (`text-2xl`) for a single highlighted percentage.
- **Profile summary line values** (e.g. shift window): 20px Bold (`text-xl`) when the "value" is descriptive text rather than a bare number.
- **Compact position slivers** (Created / Filled / Open inside a position card): 14px Bold value (`text-sm`) with a 9px label, rendered inline without icons.

Treat these as deliberate exceptions — do not convert them to `.stat-tile`.

### Cards

- White, 1px `#e9ecef` border, 12px radius (Tailwind `rounded-xl border border-charcoal-200`).
- Header row: `px-4 py-2.5` with `.bento-label` title and optional action button.

### Data Tables

- Header: 12px SemiBold uppercase, `#6c7a71`, padding 10px × 16px.
- Body: 14px `#343a40`, padding 12px × 16px, row hover `#f8f9fa`.

### Input Fields

- 14px text, padding `8px 12px`, 1px `#dee2e6` border, 8px radius → ~36px rendered height.
- Focus: 1px `#006c49` border + 3px emerald-tinted ring.

### Multi-Step Forms

Horizontal steppers use a "Completed / Active / Upcoming" logic (emerald checkmark / primary border / slate border).

### Icons

Lucide-style outline icons, 1.5px–2px stroke. Icons in primary navigation always paired with labels.