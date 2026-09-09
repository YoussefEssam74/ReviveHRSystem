---
name: Revive HR System
colors:
  surface: "#f9f9ff"
  surface-dim: "#cfdaf2"
  surface-bright: "#f9f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f0f3ff"
  surface-container: "#e7eeff"
  surface-container-high: "#dee8ff"
  surface-container-highest: "#d8e3fb"
  on-surface: "#111c2d"
  on-surface-variant: "#3c4a42"
  inverse-surface: "#263143"
  inverse-on-surface: "#ecf1ff"
  outline: "#6c7a71"
  outline-variant: "#bbcabf"
  surface-tint: "#006c49"
  primary: "#006c49"
  on-primary: "#ffffff"
  primary-container: "#10b981"
  on-primary-container: "#00422b"
  inverse-primary: "#4edea3"
  secondary: "#2b6954"
  on-secondary: "#ffffff"
  secondary-container: "#adedd3"
  on-secondary-container: "#306d58"
  tertiary: "#55615a"
  on-tertiary: "#ffffff"
  tertiary-container: "#99a69e"
  on-tertiary-container: "#303c36"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#6ffbbe"
  primary-fixed-dim: "#4edea3"
  on-primary-fixed: "#002113"
  on-primary-fixed-variant: "#005236"
  secondary-fixed: "#b0f0d6"
  secondary-fixed-dim: "#95d3ba"
  on-secondary-fixed: "#002117"
  on-secondary-fixed-variant: "#0b513d"
  tertiary-fixed: "#d9e6dd"
  tertiary-fixed-dim: "#bdcac1"
  on-tertiary-fixed: "#131e19"
  on-tertiary-fixed-variant: "#3e4943"
  background: "#f9f9ff"
  on-background: "#111c2d"
  surface-variant: "#d8e3fb"
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: "700"
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: "600"
    lineHeight: 24px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: "500"
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  section-gap: 32px
  element-tight: 8px
  element-loose: 12px
---

## Brand & Style

The design system is engineered for high-performance enterprise HR environments. It balances the vitality of human-centric management with the precision of data-heavy administrative tools. The brand personality is professional, growth-oriented, and highly reliable.

The design style is **Corporate / Modern** with a focus on high-density information architecture. It utilizes a "Clean Slate" approach: heavy reliance on white space, meticulous alignment, and a restrained color palette to reduce cognitive load during complex tasks like payroll processing or organizational mapping.

The aesthetic is characterized by:

- **Functional Clarity:** Every element serves a navigational or informational purpose.
- **Precision Engineering:** Subtle borders and strict grid adherence over heavy shadows.
- **Human Vitality:** Use of emerald tones to evoke a sense of growth and health within the workforce.

## Colors

This design system uses a refreshing yet authoritative "Emerald & Slate" palette designed for long-duration desktop usage.

- **Primary (Emerald):** Used for primary actions, progress indicators, and active states. It represents growth and "go" states.
- **Secondary (Dark Green):** Reserved for high-level headings and brand touchpoints to provide grounding and authority.
- **Neutral (Slate):** Used for body text and secondary UI elements to ensure high legibility and a modern feel.
- **Backgrounds:** A tiered system using Pure White (`#ffffff`) for primary workspace areas and Mint Green (`#f0fdf4`) for subtle grouping or sidebar backgrounds.
- **Borders:** A consistent light Slate (`#f1f5f9`) is used for all structural containment to maintain a "soft-grid" look without the heaviness of dark lines.

## Typography

The design system utilizes **Inter** for all roles to leverage its exceptional legibility in data-heavy environments.

- **Scale:** The system leans into a smaller base size (14px for standard body) to accommodate dense HR tables and dashboards.
- **Hierarchy:** High contrast in weight (Bold 700 vs Regular 400) is used to differentiate between labels and data values.
- **Data Display:** For numerical values in tables, use tabular lining figures to ensure columns of numbers align perfectly for visual scanning.
- **Labels:** Uppercase labels with slight letter spacing are reserved for category headers or table column titles.

## Layout & Spacing

This design system follows a **Fixed Grid** philosophy for desktop layouts to ensure consistency across varying enterprise monitor sizes.

- **Grid:** A 12-column grid with a 1200px max-width for primary content. Gutters are fixed at 16px.
- **Density:** To handle high-volume HR data, the spacing rhythm is built on a 4px scale. "Compact" modes for tables should reduce vertical cell padding to 8px, while "Standard" modes use 12px.
- **Desktop-First:** Sidebars are persistent (240px or 280px width) to allow for deep navigation.
- **Mobile Adaptivity:** On mobile devices, the 12-column grid collapses to a single column with 16px side margins. Multi-step forms should transition from horizontal steppers to vertical or simplified progress bars.

## Elevation & Depth

To maintain a professional and "flat" enterprise aesthetic, the design system avoids heavy shadows.

- **Low-Contrast Outlines:** Depth is primarily communicated through borders (`#f1f5f9`). Every card, input field, and section divider uses this subtle line to define boundaries.
- **Surface Layering:**
  - **Level 0 (Background):** Pure White or Mint Green.
  - **Level 1 (Cards):** Pure White with a 1px Slate border.
  - **Level 2 (Dropdowns/Modals):** Pure White with a slightly more pronounced shadow (e.g., `0 4px 6px -1px rgb(0 0 0 / 0.1)`) to indicate temporary overlay.
- **Interactive States:** On hover, cards may transition to a slightly darker border color (`#e2e8f0`) rather than lifting with a shadow.

## Shapes

The design system adopts a **Rounded (8px)** corner strategy to soften the industrial nature of HR data without appearing overly casual or "bubbly."

- **Standard Elements:** Buttons, Input Fields, and Checkboxes utilize the `rounded` (8px) token.
- **Large Containers:** Cards and Modals use the `rounded-lg` (16px) token to provide a clear frame for content.
- **Indicator Elements:** Badges and Chips use the `rounded-xl` (24px) token to create a "pill" look, helping them stand out as discrete status markers.

## Components

### Data Tables

Tables are the core of the HR system. Use a fixed header for long lists. Column headers use `label-md` with `neutral_color_hex`. Row hover states should use a background tint of `tertiary_color_hex`.

### Buttons

- **Primary:** Emerald Green background with White text. No shadow.
- **Secondary:** Transparent background with Emerald Green border and text.
- **Ghost:** No background or border; uses Primary color for text. Used for less prominent actions within tables.

### Multi-Step Forms

Horizontal steppers should use a "Completed / Active / Upcoming" visual logic. Completed steps show an Emerald Green checkmark; Active steps show a Primary border; Upcoming steps use a Slate border.

### Permission Selectors

Use a nested list structure with checkboxes. Use a "Mixed" state (dash icon) for parent categories when only some child permissions are selected.

### Input Fields

Standard height of 40px. Use `border_color_hex` for the default state and `primary_color_hex` for the focus state. Placeholder text should be `body-sm` in a light grey.

### Icons

Use **Lucide-style** outline icons with a 1.5px or 2px stroke weight. Icons should always be accompanied by labels in primary navigation to ensure accessibility.
