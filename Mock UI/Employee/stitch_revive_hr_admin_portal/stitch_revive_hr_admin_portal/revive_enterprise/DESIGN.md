---
name: Revive Enterprise
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#006e2f'
  on-secondary: '#ffffff'
  secondary-container: '#6bff8f'
  on-secondary-container: '#007432'
  tertiary: '#a43a3a'
  on-tertiary: '#ffffff'
  tertiary-container: '#fc7c78'
  on-tertiary-container: '#711419'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  deep-navy: '#000B21'
  surface-gray: '#F8FAFC'
  border-subtle: '#E2E8F0'
  status-error: '#EF4444'
  status-warning: '#F59E0B'
  status-info: '#00A4A6'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  tabular-nums:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  compact: 8px
  default: 16px
  comfortable: 24px
  grid-gutter: 20px
  container-padding: 32px
---

## Brand & Style

The design system is engineered for the high-velocity, high-accountability environment of HR operations. It prioritizes a **Modern Corporate** aesthetic that leans into "Information-First" design—reducing cognitive load while maximizing data density.

The brand personality is **Efficiency-Forward**. Every visual element is designed to answer the user's subconscious question: *"What requires my attention right now?"* This is achieved through a systematic approach to whitespace, a disciplined color application that reserves vibrancy for action/status, and a clear distinction between structural containers and actionable content. 

The style utilizes a **Tonal Layering** approach (Material-inspired) with subtle, low-contrast borders to organize complex workflows like recruitment pipelines and heatmaps without the visual noise of heavy shadows or decorative elements.

## Colors

The color strategy is rooted in "Functional Green." The **Revive Emerald Green (#10B981)** is the primary driver for "success" states and primary calls to action. To maintain a professional enterprise feel, it is paired with **Deep Navy (#000B21)** for high-contrast typography and sidebars.

- **Primary & Secondary:** Reserved for active states, completion buttons, and progress indicators.
- **Surface Strategy:** The system uses `surface-gray` for application backgrounds to reduce eye strain, while cards and data tables sit on pure `#FFFFFF` to "pop" forward.
- **Semantic Colors:** Critical for HR workflows. `status-error` is used for late submissions or compliance issues; `status-warning` for pending approvals; and `status-info` (derived from the original brand teal) for general updates and tooltips.

## Typography

This design system utilizes **Inter** exclusively to take advantage of its exceptional legibility in data-heavy SaaS environments. 

The hierarchy is built for **scannability**:
- **Data Densisty:** Use `body-sm` for secondary table content and meta-data to keep rows compact.
- **Labels:** `label-bold` is the standard for form headers and table columns, utilizing slight letter spacing and uppercase styling to differentiate from dynamic data.
- **Numeric Integrity:** For scheduling heatmaps and payroll figures, utilize `tabular-nums` to ensure columns of figures align vertically for quick comparison.
- **Action Headers:** `headline-md` is used for card titles to clearly demarcate different workflow modules.

## Layout & Spacing

The system follows a **4px baseline grid** to ensure precise alignment of dense data elements. 

- **The Dashboard Grid:** A 12-column fluid grid system with a maximum container width of 1600px. For HR operators, layouts should be "Left-Heavy," placing primary navigation and task lists on the left with data visualization and heatmaps expanding to fill the right.
- **Sectional Density:**
    - **Tables:** 8px (compact) vertical padding for rows to maximize visibility.
    - **Modals/Cards:** 24px (comfortable) padding to provide breathing room for focus-heavy tasks.
- **Breakpoints:** 
    - **Desktop (1280px+):** Full 12-column view.
    - **Tablet (768px - 1279px):** 8-column view, sidebars collapse into icons.
    - **Mobile (<767px):** Single column, data tables switch to card-based list views.

## Elevation & Depth

This design system uses a **Tonal & Border-based** elevation model rather than heavy shadows to maintain a clean, "flat" enterprise look that doesn't feel dated.

1.  **Level 0 (Background):** `surface-gray` (#F8FAFC). Used for the canvas behind the UI.
2.  **Level 1 (Default Surface):** Pure White (#FFFFFF) with a 1px solid border (`border-subtle`). Used for the main body of data tables and content cards.
3.  **Level 2 (Active/Floating):** Use a very soft, ambient shadow (0px 4px 12px rgba(0, 11, 33, 0.05)) for dropdowns, tooltips, and modals to signify they are above the workflow.
4.  **Interactive States:** Elements should not lift on hover; instead, they should shift background color (e.g., a table row changing to a very light green tint) to indicate interactivity without disrupting the grid.

## Shapes

The shape language is **Soft (0.25rem)**. This provides a subtle modern touch that softens the "clinical" feel of enterprise software while maintaining the structural rigidity required for complex grids and heatmaps.

- **Standard Elements:** Buttons, input fields, and checkboxes use `rounded` (4px).
- **Large Containers:** Dashboard cards and modals use `rounded-lg` (8px).
- **Status Badges:** Use `rounded-xl` (12px) or full pill shapes to distinguish them from interactive buttons.
- **The Heatmap Grid:** Individual cells in the Schedule Planner should remain sharp (0px) to prevent visual gaps in continuous data blocks.

## Components

### Buttons
- **Primary:** Solid `primary_color` with white text. High contrast, reserved for final actions (e.g., "Approve Schedule").
- **Secondary:** Outlined with `primary_color` and a 1px border. Used for "Add New" or "Export" actions.
- **Ghost:** No background or border, `neutral_color` text. Used for "Cancel" or "Dismiss."

### Status Badges (Chips)
- **Structure:** Small text, semi-bold, with a light-tint background and dark-tint text of the same hue (e.g., Pending = Light Amber background + Dark Amber text).
- **States:** `Pending`, `Approved`, `Late`, `On Leave`, `Interviewing`.

### Data Tables
- **Header:** Sticky headers with `border-subtle` bottom stroke. Use `label-bold` for titles.
- **Rows:** Alternating "Zebra" striping is discouraged; use 1px bottom borders instead. High-priority rows (e.g., "Late") can have a 2px left-border accent in `status-error`.

### Schedule Planner Grid
- **The Heatmap:** Use a color scale from `surface-gray` (0 hours) to `primary_color` (full capacity). Over-capacity states should shift to `status-error`.
- **Interactivity:** Cells should show a detailed "Shift Tooltip" on hover, using Level 2 elevation.

### Input Fields
- **Default:** White background, `border-subtle` stroke. On focus, the border should change to `primary_color` with a 2px outer glow (ring) of the same color at 20% opacity.