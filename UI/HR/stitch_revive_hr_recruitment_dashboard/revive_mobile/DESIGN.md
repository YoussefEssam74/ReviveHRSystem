---
name: Revive Mobile
colors:
  surface: '#f8f9ff'
  surface-dim: '#d8dae0'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f9'
  surface-container: '#E5EEFF'
  surface-container-high: '#e7e8ee'
  surface-container-highest: '#e1e2e8'
  on-surface: '#0B1C30'
  on-surface-variant: '#3e4a3d'
  inverse-surface: '#2e3135'
  inverse-on-surface: '#eff0f6'
  outline: '#6e7b6c'
  outline-variant: '#bdcaba'
  surface-tint: '#006e2d'
  primary: '#006b2c'
  on-primary: '#ffffff'
  primary-container: '#00873a'
  on-primary-container: '#f7fff2'
  inverse-primary: '#62df7d'
  secondary: '#545f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f9'
  on-secondary-container: '#586378'
  tertiary: '#006b2c'
  on-tertiary: '#ffffff'
  tertiary-container: '#2a8542'
  on-tertiary-container: '#f7fff2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7ffc97'
  primary-fixed-dim: '#62df7d'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#d8e3fc'
  secondary-fixed-dim: '#bcc7df'
  on-secondary-fixed: '#101c2e'
  on-secondary-fixed-variant: '#3c475b'
  tertiary-fixed: '#9cf7a7'
  tertiary-fixed-dim: '#80da8d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#f8f9ff'
  on-background: '#191c20'
  surface-variant: '#e1e2e8'
  status-active-bg: '#DCFCE7'
  status-active-text: '#166534'
typography:
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
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
  button-text:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-mobile: 16px
  gutter-mobile: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  touch-target-min: 48px
---

## Brand & Style
The mobile extension of the design system adapts the **Corporate / Modern** aesthetic into a high-utility, "on-the-floor" tool for gym-level employees. The personality is focused, efficient, and reliable, prioritizing "thumb-first" ergonomics for workers who manage shifts between active tasks.

The visual style remains clean and professional, utilizing **Minimalism** to reduce cognitive load while introducing **Tactile** cues for interactive elements to ensure they are easily identifiable in fast-paced environments. The interface evokes a sense of "active professionalism"—it is a tool for movement, not just desk work.

**Design Principles:**
- **Action-at-a-Glance:** Critical info (next shift, clock-in status) is always primary.
- **Thumb-Zone Optimization:** Interactive elements are concentrated in the lower two-thirds of the screen.
- **High-Contrast Readiness:** Increased contrast for legibility under bright gym lighting.

## Colors
The color palette maintains the "Success Green" as the primary driver for action, but utilizes a more robust neutral scale to handle mobile layering.

- **Primary (#16A34A):** Core brand color for primary buttons, active bottom bar icons, and clock-in actions.
- **Secondary (#515C71):** A professional slate used for secondary navigation and utility icons.
- **Tertiary (#006B2C):** A darker green used for text links or high-emphasis states within green containers to ensure WCAG compliance.
- **Neutral (#F8F9FF):** The foundation for the app surface, providing a cool, clean backdrop.

The "Surface Container" (#E5EEFF) is specifically used for card grouping and list item backgrounds to distinguish content modules from the base background.

## Typography
The system uses **Inter** exclusively for its systematic clarity. For mobile, the scale is tightened to maximize information density without sacrificing touch-target readability.

- **Mobile Headers:** `headline-lg-mobile` is the standard for view titles.
- **Body Text:** Standardized at 16px (`body-lg`) for all user-generated content and shift details to ensure legibility while moving. 14px (`body-md`) is reserved for secondary metadata.
- **Interactive Text:** All buttons use a semi-bold 16px weight to clearly signal interactivity.
- **Micro-copy:** `label-sm` is used for status tags and table headers, utilizing uppercase tracking to create a distinct visual layer.

## Layout & Spacing
The layout follows a **Fluid Grid** logic optimized for narrow viewports.

- **Grid:** A 4-column fluid grid with 16px outer margins and 12px gutters.
- **Touch Targets:** All interactive elements (buttons, list items, checkboxes) must maintain a minimum height of 48px to accommodate one-handed thumb interaction.
- **Vertical Rhythm:** A strict 8px baseline is used. Sections are separated by 24px (`stack-lg`), while elements within a card are separated by 8px or 12px.
- **Bottom Navigation:** A fixed bottom bar (56px height) houses the primary app destinations, ensuring they remain within the "natural" thumb zone.

## Elevation & Depth
Mobile depth relies on **Tonal Layers** to maintain performance while providing clear hierarchy.

- **Base Layer:** `#F8F9FF` background.
- **Card Layer:** White containers with a 1px `#E5E7EB` border. Shadows are avoided for primary cards to keep the UI feeling "flat" and fast.
- **Action Layer (Bottom Sheets):** Surfaces that slide up from the bottom utilize a soft ambient shadow (0px -4px 12px rgba(0,0,0,0.08)) and a backdrop blur to focus the user on the task (e.g., requesting a shift swap).
- **Floating Action Button (FAB):** Uses a high-contrast primary shadow to indicate its position at the top of the visual stack.

## Shapes
The shape language is **Rounded**, balancing a friendly feel with professional structure.

- **Cards & Bottom Sheets:** 16px (`rounded-lg`) to create a soft, modern container.
- **Buttons & Inputs:** 8px (`standard`) for a precise, "clickable" look.
- **Status Badges:** Full-pill shape to differentiate them from buttons.
- **Active Indicators:** 4px radius for small indicators like "currently clocked in" pips.

## Components

**Primary Mobile Components:**
- **The "Pulse" Card:** A prominent top-level card for Clock In/Out. It uses a primary green tint background and a large 56px circular button.
- **Bottom Navigation:** 4-5 icons max. Active state uses primary green; inactive uses secondary slate. Icons are accompanied by `label-md` text.
- **Shift List Items:** 64px minimum height. Features a vertical color-coded bar (primary for "Own Shift", tertiary for "Available") on the left edge.
- **Bottom Sheets:** Replacing desktop modals. Triggered for shift details or leave requests. Must include a "grab handle" at the top center.
- **Selection Controls:** Checkboxes and radio buttons are scaled to 24x24px within a 48px touch container.
- **Input Fields:** Use a "filled" style with a bottom border for mobile, providing a larger tap area than outlined boxes.

**Contextual Actions:**
- Use **Swipe Actions** in lists for quick approvals or shift claims (Swipe Left = Decline, Swipe Right = Accept).