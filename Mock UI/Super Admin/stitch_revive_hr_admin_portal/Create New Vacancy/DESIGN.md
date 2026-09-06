---
name: Revive HR System
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#3d4a3d'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#6d7b6c'
  outline-variant: '#bccbb9'
  surface-tint: '#006e2f'
  primary: '#006e2f'
  on-primary: '#ffffff'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#4ae176'
  secondary: '#1f6c3a'
  on-secondary: '#ffffff'
  secondary-container: '#a4f1b2'
  on-secondary-container: '#24703e'
  tertiary: '#486554'
  on-tertiary: '#ffffff'
  tertiary-container: '#95b3a0'
  on-tertiary-container: '#2a4637'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#a6f4b5'
  secondary-fixed-dim: '#8bd79b'
  on-secondary-fixed: '#00210b'
  on-secondary-fixed-variant: '#005226'
  tertiary-fixed: '#caead6'
  tertiary-fixed-dim: '#afceba'
  on-tertiary-fixed: '#042014'
  on-tertiary-fixed-variant: '#314d3e'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
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
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 32px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  section-gap: 48px
---

## Brand & Style

The design system for this platform is built on the principles of **Modern Enterprise Minimalism**. It prioritizes clarity, efficiency, and a sense of "organizational breathing room" to reduce the cognitive load inherent in HR management tasks. 

The aesthetic is characterized by high-quality whitespace, a disciplined color palette, and subtle depth. It moves away from the coldness of traditional enterprise software toward a more "Human-Centric Professional" tone—evoking feelings of growth, stability, and approachability. The UI relies on precision typography and a structured hierarchy to guide users through complex data without visual clutter.

## Colors

The palette is rooted in a spectrum of greens to symbolize growth and vitality within the workforce.

- **Primary (#22C55E):** Used for primary actions, success states, and key brand moments.
- **Secondary (#166534):** Reserved for deep navigation elements, high-contrast text on light backgrounds, and "stable" brand anchors.
- **Accent (#DCFCE7):** Utilized for soft backgrounds, highlighted states, and subtle grouping of related items.
- **Neutral Palette:** The background uses a very light gray (`#F9FAFB`) to differentiate surfaces from pure white (`#FFFFFF`) card containers. Borders use a subtle gray (`#E5E7EB`) to define structure without creating visual "noise."

## Typography

This design system utilizes **Inter** for its exceptional legibility and systematic weights. 

- **Hierarchy:** Use `Display` and `Headline` sizes for dashboard overviews. `Title-lg` is the standard for card headers.
- **Body Text:** `Body-md` (14px) is the workhorse for data tables and form labels to maintain high information density without sacrificing readability.
- **Labels:** Small caps or medium-weight labels should be used for metadata and eyebrow text to provide contrast against body copy.
- **Scaling:** On mobile, top-level headlines scale down to `headline-lg-mobile` to prevent excessive line wrapping.

## Layout & Spacing

The layout follows a **12-column fluid grid** for the main content area, anchored by a fixed-width left navigation sidebar (256px). 

- **Rhythm:** A base 4px unit governs all spacing.
- **Margins:** Large container margins (32px) ensure the content feels expansive and premium.
- **Stacking:** Use `stack-lg` (24px) for spacing between major dashboard cards. Use `stack-sm` (8px) for internal card elements like titles and subtitles.
- **Adaptation:** On tablet, margins reduce to 24px. On mobile, the grid collapses to a single column with 16px horizontal margins.

## Elevation & Depth

To maintain a clean, professional aesthetic, this design system uses **Tonal Layers** combined with **Ambient Shadows**.

- **Surface Levels:** The base background is the lowest level (`#F9FAFB`). Interactive components and cards sit on the "Surface" level (`#FFFFFF`).
- **Shadows:** We use a custom "Elegant Shadow" for cards. It is a dual-layered shadow:
    - *Layer 1:* 0px 1px 2px rgba(0, 0, 0, 0.05) (sharp definition).
    - *Layer 2:* 0px 10px 15px -3px rgba(0, 0, 0, 0.03) (soft ambient spread).
- **Interactions:** On hover, primary cards should slightly increase their shadow spread and move -2px on the Y-axis to provide tactile feedback.

## Shapes

The shape language is consistently **Rounded**, promoting a friendly and modern workspace environment.

- **Standard Radius:** 8px (`0.5rem`) for inputs, buttons, and small widgets.
- **Card Radius:** 12px (`0.75rem`) for main dashboard containers to create a distinct, soft container logic.
- **Large Elements:** Use `rounded-xl` (24px) for featured promotional banners or large empty-state illustrations.
- **Icons:** Should feature slightly rounded terminals to match the UI's geometry.

## Components

- **Buttons:** 
    - *Primary:* Solid `#22C55E` with white text. 
    - *Secondary:* Soft accent background `#DCFCE7` with `#166534` text.
    - *Ghost:* No background, border-only or text-only for low-priority actions.
- **Cards:** White background, 12px border-radius, elegant ambient shadow, and 24px internal padding. Card headers should use a subtle bottom border (`1px solid #E5E7EB`) when separating title from content.
- **Inputs:** 8px radius, `#F9FAFB` background, and a `1px solid #E5E7EB` border. On focus, the border transitions to Primary Green with a soft 3px outer glow.
- **Chips/Badges:** Used for "Status" (e.g., Active, Onboarding, Terminated). Use high-clearance pill shapes with `label-md` typography.
- **Data Tables:** Row-based with subtle hover states (`#F9FAFB`). Avoid vertical borders; use horizontal lines only to maintain a clean horizontal flow.
- **Side Navigation:** Uses `Secondary Green` for the active state indicator (a vertical 4px pill on the left) and a slightly darker text color for the active label.