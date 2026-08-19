---
name: Revive HR System
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
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001a42'
  on-tertiary-container: '#3980f4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
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
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
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
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
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
  gutter: 24px
  margin-page: 32px
  card-padding: 20px
  table-cell-padding: 12px 16px
---

## Brand & Style
The design system is engineered for high-stakes enterprise HR environments, prioritizing clarity, trust, and rapid information processing. The aesthetic combines **Minimalism** with **Corporate Modern** sensibilities, emphasizing a "data-first" interface that reduces cognitive load through structured hierarchy and generous functional whitespace.

The visual language communicates authority and reliability. It utilizes a desktop-first approach to accommodate complex data tables and multi-step administrative workflows, while maintaining a refined, premium feel through subtle border treatments and a sophisticated, dark-themed navigation structure.

## Colors
The palette is rooted in a deep "Slate" foundation to provide a stable, professional environment. 

- **Primary (#0F172A):** Reserved for high-level structural elements like the sidebar, ensuring the brand identity feels grounded and permanent.
- **Secondary (#64748B):** Used for meta-data, icons, and non-interactive borders to keep the UI clean and unobtrusive.
- **Background & Surface:** A crisp distinction between the workspace (#F8FAFC) and elevated cards (#FFFFFF) creates a clear mental model of "the desk" versus "the document."
- **Accents:** Semantic colors follow industry standards for immediate recognition of status (Success, Warning, Error, Info).

## Typography
This design system utilizes **Inter** exclusively to leverage its exceptional legibility in data-heavy contexts. 

- **Headlines:** Use Bold (700) or Semi-Bold (600) weights with slight negative letter-spacing for a modern, "tight" look.
- **Body Text:** Standard body text is set at 14px (`body-md`) to optimize information density without sacrificing readability.
- **Labels:** Small, uppercase labels are used for category headers and table column titles to differentiate them from interactive data.
- **Data Display:** For numerical values in KPI cards, use `headline-lg` with a slightly increased font weight to emphasize performance metrics.

## Layout & Spacing
The layout follows a **Fixed-Fluid hybrid grid**. The sidebar remains at a fixed width (280px), while the main content area expands to fill the viewport, maxing out at 1600px to prevent excessive line lengths.

- **Spacing Rhythm:** Based on a 4px scale. Most components use 16px (4 units) or 24px (6 units) of internal padding.
- **Density:** To achieve high information density, vertical rhythm in tables is kept tight (12px padding), while dashboard widgets use 24px spacing to allow data to "breathe."
- **Responsiveness:** On tablets, the sidebar collapses into an icon-only rail or a hidden drawer. On mobile, the multi-column tables transition into card-based list views.

## Elevation & Depth
Depth is signaled through **Tonal Layering** and **Ambient Shadows** rather than heavy gradients.

- **Level 0 (Background):** #F8FAFC. No shadow.
- **Level 1 (Cards/Tables):** White background with a 1px border (#E2E8F0) and a very soft, diffused shadow (0px 1px 3px rgba(0,0,0,0.05)).
- **Level 2 (Dropdowns/Popovers):** Higher contrast shadow (0px 10px 15px -3px rgba(0,0,0,0.1)) to indicate temporary interaction.
- **Level 3 (Modals/Drawers):** Large blur radius (20px-40px) with a semi-transparent dark backdrop (60% opacity) to isolate the workflow.

## Shapes
The shape language is professional and balanced. 

- **Standard Elements:** Buttons, input fields, and small cards use a **8px (0.5rem)** radius to feel modern but not overly playful.
- **Containers:** Larger dashboard sections and modals use **12px (0.75rem)** to provide a softer frame for dense information.
- **Status Badges:** Use a fully rounded pill shape (999px) to distinguish them from interactive buttons.
- **Borders:** All borders are kept at a subtle 1px width, using #E2E8F0 for light surfaces and #1E293B for dark sidebar elements.

## Components
- **Sidebar:** Dark theme (#0F172A) with a top section for the Gym Logo and Name. Active states use a left-edge accent border (3px, #3B82F6) and a subtle background highlight. Nested items are indented with a reduced font weight.
- **Data Tables:** Zebra-striping is avoided; instead, use subtle hover rows. Status badges use low-saturation background tints (e.g., Success Green at 10% opacity) with high-contrast text.
- **Wizards:** A horizontal progress tracker at the top of the workspace. Completed steps show a green checkmark, active steps use Primary Blue.
- **KPI Cards:** Feature a large "Value" display, a secondary "Trend" indicator (percentage up/down), and a bottom-aligned "Context" label.
- **Inputs:** Clean, outlined boxes. Focus state uses a 2px Primary Blue border. Error states replace the border with Error Red and include a trailing icon.
- **Header:** Contains breadcrumbs for navigation, a gym-switcher dropdown, and a profile section with a 32px circular avatar.