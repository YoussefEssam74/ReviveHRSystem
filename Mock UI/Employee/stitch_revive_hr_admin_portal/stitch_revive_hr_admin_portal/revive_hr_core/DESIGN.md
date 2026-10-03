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
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#555f6f'
  on-secondary: '#ffffff'
  secondary-container: '#d6e0f3'
  on-secondary-container: '#596373'
  tertiary: '#006c49'
  on-tertiary: '#ffffff'
  tertiary-container: '#5db38a'
  on-tertiary-container: '#00422b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#d9e3f6'
  secondary-fixed-dim: '#bdc7d9'
  on-secondary-fixed: '#121c2a'
  on-secondary-fixed-variant: '#3d4756'
  tertiary-fixed: '#9df4c8'
  tertiary-fixed-dim: '#81d8ad'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  border-light: '#e5e7eb'
  status-error: '#ef4444'
  status-warning: '#f59e0b'
  status-info: '#00a4a6'
  surface-white: '#ffffff'
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
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
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
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-mobile: 1rem
  margin-desktop: 2rem
  gutter: 1rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 1.5rem
---

## Brand & Style

The design system establishes a premium, internal-facing environment for the Revive HR Employee Portal. It moves away from high-energy fitness aesthetics toward a **Corporate / Modern** style that emphasizes stability, clarity, and professional trust. The brand personality is efficient and supportive, designed to feel like a high-performance utility rather than a consumer social app.

The visual narrative is built on "Industrial Precision"—using high-contrast typography and structured containers to organize employee data, benefits, and payroll. The interface prioritizes scannability and ease of use for a mobile-first workforce, ensuring that critical HR actions are never more than a thumb-press away.

## Colors

The palette is anchored by **Revive Green (#10b981)**, which serves as the primary action color, signaling progress and health. This is balanced by **Dark Charcoal (#1f2937)** for primary text and navigation elements to ensure WCAG AA accessibility compliance and a grounded, corporate feel.

- **Backgrounds:** Use pure `#FFFFFF` for main content areas and cards to maintain a "clean-room" aesthetic. Use `neutral_color` (#f8fafc) for the underlying application canvas to create subtle contrast.
- **Borders:** Utilize `#e5e7eb` for all structural divisions and card outlines to maintain a light, airy feel.
- **Functional Accents:** Reserve `status-error` and `status-warning` for urgent employee notifications or compliance alerts.

## Typography

The design system uses **Inter** for all roles to leverage its clinical legibility and neutral tone. High contrast is maintained through significant weight shifts between labels and data.

- **Hierarchy:** Headlines are strictly semi-bold to bold to anchor sections. Body text uses a standard weight for maximum readability in long-form policy documents.
- **Specialty Roles:** `tabular-nums` must be used for all payroll, hour tracking, and financial data to ensure vertical alignment.
- **Mobile Adaptivity:** For small screens, top-level headlines scale down to `headline-lg-mobile` to prevent awkward line breaks while maintaining visual impact.

## Layout & Spacing

The design system adopts a **Fixed Grid** approach for desktop and a fluid, single-column approach for mobile. 

- **Desktop (Left Sidebar):** A 280px fixed-width left sidebar contains permission-driven navigation. The main content area sits on a 12-column grid with a 1440px max-width.
- **Mobile (Bottom Nav):** Primary navigation moves to a fixed bottom bar. Content is contained within `margin-mobile` (16px) safe areas.
- **Spacing Rhythm:** Use a 4px-based system. `stack-md` (16px) is the default vertical rhythm for card content, while `stack-lg` (24px) separates distinct dashboard modules.

## Elevation & Depth

To maintain the professional "Enterprise" look, this design system avoids heavy shadows. Instead, it relies on **Tonal Layers** and **Low-contrast outlines**.

- **Surface 0:** Application background using `#f8fafc`.
- **Surface 1:** Cards and containers using pure `#ffffff` with a 1px solid `#e5e7eb` border. 
- **Active State:** On mobile, active cards may use a very soft, ambient shadow (4px blur, 5% opacity charcoal) to indicate they are tappable or currently expanded.
- **Backdrop Blurs:** Used exclusively for mobile modals to maintain context of the background HR dashboard while focusing on a specific task (like clocking in).

## Shapes

The design system uses **Rounded (0.5rem)** as the base shape language to balance corporate structure with modern approachability.

- **Default Elements:** Form inputs and buttons use `rounded` (8px).
- **Dashboard Cards:** Use `rounded-lg` (16px) to create distinct "buckets" of information that feel contained and organized.
- **Interactive Indicators:** Notification badges and status tags use pill-shapes (full rounding) to clearly differentiate them from structural elements.

## Components

### Buttons
- **Primary:** Solid `#10b981` with white text. Full-width on mobile for "Clock In" or "Submit" actions.
- **Secondary:** Outlined with `border-light` and charcoal text for less urgent actions like "View Policy."

### Cards
- **Structure:** White background, 16px corner radius, and 1px border.
- **Header:** Cards should include a `label-bold` sub-header above the main title to categorize data (e.g., "PAYROLL > CURRENT CYCLE").

### Navigation
- **Mobile Bottom Nav:** Use four to five high-priority icons (Dashboard, Schedule, Pay, Profile). Use active green tint for the selected state.
- **Desktop Sidebar:** Dark charcoal background (`secondary_color`) with white text. Group links by permission level (Employee, Manager, Admin).

### Input Fields
- Clear, labeled fields with 8px rounding. The focus state should utilize a 1px `primary_color` border with no glow to maintain a crisp, professional look.

### Chips & Status
- Use light-tint backgrounds (10% opacity of the status color) with high-contrast text for status indicators like "On Leave" or "Active."