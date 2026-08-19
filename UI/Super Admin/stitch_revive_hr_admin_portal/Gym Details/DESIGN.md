---
name: Revive HR Core
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3e4a3d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6e7b6c'
  outline-variant: '#bdcaba'
  surface-tint: '#006e2d'
  primary: '#006b2c'
  on-primary: '#ffffff'
  primary-container: '#00873a'
  on-primary-container: '#f7fff2'
  inverse-primary: '#62df7d'
  secondary: '#006d30'
  on-secondary: '#ffffff'
  secondary-container: '#92f5a4'
  on-secondary-container: '#007233'
  tertiary: '#1c6938'
  on-tertiary: '#ffffff'
  tertiary-container: '#39834e'
  on-tertiary-container: '#f6fff3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7ffc97'
  primary-fixed-dim: '#62df7d'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#95f8a7'
  secondary-fixed-dim: '#79db8d'
  on-secondary-fixed: '#00210a'
  on-secondary-fixed-variant: '#005323'
  tertiary-fixed: '#a6f4b5'
  tertiary-fixed-dim: '#8bd79b'
  on-tertiary-fixed: '#00210b'
  on-tertiary-fixed-variant: '#005226'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  kpi-stat:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
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
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system is engineered for a premium HR administration experience, blending the clinical precision of healthcare with the energetic vitality of fitness. The aesthetic is **Modern Corporate Minimalism**, characterized by expansive white space, a strictly disciplined green palette, and high-legibility typography. 

The UI should evoke a sense of professional renewal and organizational health. By utilizing a "White-on-White" layering technique—placing white cards on a subtly off-white background—the system achieves a sophisticated depth that feels airy yet structured. The visual language avoids all unnecessary decorative elements, focusing entirely on data clarity and administrative efficiency.

## Colors
This design system utilizes a monochromatic green progression to maintain a high-end, focused atmosphere. 

- **Primary Canvas:** The main workspace uses `#F8FAFC` to provide a soft contrast against the pure `#FFFFFF` of containers and sidebars.
- **The Green Scale:** `#16A34A` serves as the primary action color. Use `#DCFCE7` and `#F0FDF4` for large surface areas like tinted backgrounds or hover states to maintain a "fresh" feel without overwhelming the user.
- **Functional Neutrals:** Text utilizes `#111827` for high-contrast headers and `#6B7280` for secondary metadata. Borders are kept strictly at `#E5E7EB` to ensure they remain architectural rather than decorative.

## Typography
The system relies exclusively on **Inter** to project a modern, systematic character. 

- **Headings & KPIs:** Use Bold (700) for high-level dashboard metrics and Semibold (600) for page titles. Tighten letter spacing on larger sizes to maintain a premium "editorial" look.
- **Body Content:** Standardize on 14px for data tables and 16px for prose.
- **Labels:** Use uppercase with slight letter spacing for small metadata labels to distinguish them from interactive body text.

## Layout & Spacing
The layout follows a **fluid-to-fixed** hybrid model. The sidebar remains fixed at 280px, while the main content area expands to fill the viewport, capped at 1600px for maximum readability.

- **Grid:** Use a 12-column grid for dashboard widgets.
- **Rhythm:** All spacing must be a multiple of the 8px base unit. 
- **The Sidebar:** Pure white (`#FFFFFF`) with a 1px right border in `#E5E7EB`. No heavy shadows on the sidebar; use spacing to define the boundary.
- **Padding:** Apply generous internal padding (24px) to cards to reinforce the premium, "un-crowded" feel.

## Elevation & Depth
Depth is achieved through **Tonal Layering** combined with high-diffusion shadows. 

- **Level 0 (Background):** `#F8FAFC` — The lowest layer.
- **Level 1 (Cards/Sidebar):** `#FFFFFF` — The primary surface.
- **Shadow Profile:** Use a very soft, "ambient" shadow for cards: `0px 1px 3px rgba(0,0,0,0.05), 0px 10px 15px -5px rgba(0,0,0,0.03)`. 
- **Interactions:** On hover, a card may lift slightly (move -2px Y-axis) and the shadow opacity may increase by 2%. Avoid heavy blurs or dark shadows to maintain the "Healthcare/Clean" look.

## Shapes
The shape language is **Soft and Professional**. 

- **Standard Radius:** 0.25rem (4px) for small elements like checkboxes and input fields.
- **Component Radius:** 0.5rem (8px) for buttons and standard cards.
- **Container Radius:** 0.75rem (12px) for large modal overlays or primary dashboard sections.
- **Pill:** Use fully rounded corners (999px) strictly for badges and status indicators to differentiate them from interactive buttons.

## Components

### Buttons
- **Primary:** Background `#16A34A`, White text. High-contrast, no gradient.
- **Secondary:** White background, `#16A34A` border (1px), `#16A34A` text.
- **Tertiary:** No background or border. `#16A34A` text. Use for less frequent actions like "Cancel" or "Export."

### Status Badges (Pill-shaped)
- **Success/Active:** Background `#DCFCE7`, Text `#166534`.
- **Warning/Pending:** Background `#FEF3C7`, Text `#92400E`.
- **Inactive/Neutral:** Background `#F3F4F6`, Text `#4B5563`.

### Input Fields
- **Default:** White background, 1px border `#E5E7EB`.
- **Focus:** 1px border `#16A34A` with a subtle green outer glow (2px spread, 10% opacity).
- **Icons:** Use 20px line icons in `#16A34A` for prefix/suffix positions.

### Cards & Data Tables
- **Cards:** Use a 1px border in `#E5E7EB` combined with the "Level 1" shadow. Headers within cards should have a subtle bottom border.
- **Tables:** Use a "Ghost" style. No vertical borders; only 1px horizontal dividers in `#F1F5F9`. Header row should be `#F8FAFC` with `#6B7280` bold text.

### Navigation
- **Sidebar Items:** Clear state should be `#6B7280` text/icon. Active state should have a `#F0FDF4` background, `#16A34A` text, and a 3px vertical green indicator on the left edge.