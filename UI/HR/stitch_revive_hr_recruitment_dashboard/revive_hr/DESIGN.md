---
name: Revive HR
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
  on-surface-variant: '#3e4a3d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7b6c'
  outline-variant: '#bdcaba'
  surface-tint: '#006e2d'
  primary: '#006b2c'
  on-primary: '#ffffff'
  primary-container: '#00873a'
  on-primary-container: '#f7fff2'
  inverse-primary: '#62df7d'
  secondary: '#5c5f60'
  on-secondary: '#ffffff'
  secondary-container: '#dee0e2'
  on-secondary-container: '#606365'
  tertiary: '#515c71'
  on-tertiary: '#ffffff'
  tertiary-container: '#6a758a'
  on-tertiary-container: '#fefcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7ffc97'
  primary-fixed-dim: '#62df7d'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#e1e2e4'
  secondary-fixed-dim: '#c5c6c8'
  on-secondary-fixed: '#191c1e'
  on-secondary-fixed-variant: '#444749'
  tertiary-fixed: '#d8e3fb'
  tertiary-fixed-dim: '#bcc7de'
  on-tertiary-fixed: '#111c2d'
  on-tertiary-fixed-variant: '#3c475a'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
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
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1440px
---

## Brand & Style
The design system for this HR Management System prioritizes clarity, efficiency, and professional warmth. It adopts a **Corporate / Modern** aesthetic with subtle **Material Design** influences, specifically focusing on the evolution toward flatter surfaces and intentional white space.

The target audience consists of HR administrators and employees who require a high-utility environment that reduces cognitive load during complex operations. The UI evokes a sense of reliability and growth through a structured grid and a fresh, nature-inspired primary palette.

**Design Principles:**
- **Clarity over Decoration:** Every element serves a functional purpose; decorative flourishes are minimized to keep the focus on workforce data.
- **Human-Centric Professionalism:** While the system handles data-heavy tasks, the use of soft corners and generous padding prevents the interface from feeling cold or intimidating.
- **Operational Efficiency:** High-contrast primary actions and clear hierarchy ensure that common tasks—like payroll approval or time-off requests—are frictionless.

## Colors
The color palette is anchored by a vibrant, "Success Green" primary color, symbolizing growth and organizational health. 

- **Primary (#16A34A):** Used for primary call-to-actions, active states, and brand highlights.
- **Secondary/Surface (#F3F4F6):** A light gray used for page backgrounds, card grouping, and input field fills to provide subtle contrast against the white base.
- **Tertiary/Text (#1E293B):** A deep slate used for high-emphasis text and headers to ensure maximum readability.
- **Neutral (#64748B):** Used for secondary text, icons, and borders.

The system uses a pure white (#FFFFFF) background for main content containers to maintain a clean, "breathable" workspace.

## Typography
The typography system utilizes **Inter** for its exceptional legibility on digital screens and its neutral, systematic character. 

- **Headlines:** Use semi-bold weights with tight letter-spacing to create a strong visual anchor for page titles and section headers.
- **Body:** Standardized at 14px and 16px to balance information density with readability. Line heights are kept generous (1.4x - 1.5x) to aid in scanning long lists or employee profiles.
- **Labels:** Used for metadata, table headers, and form captions. The `label-sm` role utilizes uppercase styling to provide a distinct visual layer for non-interactive data labels.

## Layout & Spacing
This design system employs a **Fluid Grid** model with a strictly defined 8px spacing scale. 

**Desktop Layout:**
- A 12-column grid system with 24px gutters.
- Standardized page margins of 32px.
- Side navigation is fixed at 280px, with the main content area expanding to a maximum of 1440px.

**Mobile/Tablet Layout:**
- Mobile utilizes a 4-column grid with 16px margins.
- Tablets utilize an 8-column grid with 24px margins.
- Spacing between cards and sections reduces from `2xl` to `lg` on mobile devices to preserve vertical space.

**Rhythm:**
Vertical rhythm is maintained by ensuring all component heights and margins are multiples of 4px, with 8px and 16px being the primary increments for internal padding.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Ambient Shadows**, moving away from heavy, high-contrast shadows in favor of a "soft-stack" approach.

- **Level 0 (Base):** The main background using `#F3F4F6`.
- **Level 1 (Cards):** White surfaces (`#FFFFFF`) with a very soft, diffused shadow (0px 1px 3px rgba(0,0,0,0.05)). This is the primary container for data.
- **Level 2 (Dropdowns/Modals):** Floating elements with a more pronounced shadow (0px 10px 15px -3px rgba(0,0,0,0.1)) to indicate clear separation from the workspace.

Outlines are used sparingly, primarily to define form boundaries or to separate table rows, using a 1px border of `#E5E7EB`.

## Shapes
The shape language is defined as **Rounded**, creating a modern and approachable feel that avoids the rigidity of sharp corners while remaining professional.

- **Standard (8px):** Applied to buttons, input fields, and small UI widgets.
- **Large (16px):** Applied to primary content cards and dashboard modules.
- **Extra Large (24px):** Applied to large modals and bottom sheets.
- **Full (Pill):** Used exclusively for status badges (tags) and search bars to differentiate them from actionable buttons.

## Components

**Buttons:**
- **Primary:** Solid `#16A34A` with white text. High-contrast.
- **Secondary:** Surface `#F3F4F6` with text `#1E293B`. For low-priority actions.
- **Ghost:** Transparent background with `#16A34A` text. Used for navigation or utility actions within cards.

**Data Cards:**
- White background, 16px rounded corners, and Level 1 elevation.
- Internal padding should be a minimum of 24px (`lg`) to ensure data doesn't feel cramped.

**Inputs:**
- Background should be `#FFFFFF` with a 1px border of `#D1D5DB`.
- On focus, the border transitions to 2px primary green with a soft green outer glow.

**Status Chips:**
- Use a "tinted" background (10% opacity of the status color) with a high-contrast text color (e.g., Light Green background with Dark Green text for "Active").

**Lists & Tables:**
- Clean, borderless rows separated by 1px `#F3F4F6` dividers.
- Header row uses `label-sm` typography with a subtle background fill of `#F9FAFB`.

**Additional Components:**
- **Employee Avatar:** Circular with a 2px white border when overlapping.
- **Progress Bars:** Thin 8px height with rounded caps, using primary green for completion.