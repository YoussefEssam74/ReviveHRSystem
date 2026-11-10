# Mobile & Responsive Standard

Applies to the React SPA in `Client/`. The kiosk (`/attendance`) is **desktop
only** and is out of scope (see the last section).

## Breakpoints

Tailwind defaults; do not add custom ones.

| Token | Width | Target |
|---|---|---|
| — | < 640px | Phones (design at **390×844**) |
| `sm:` | ≥ 640px | Large phones landscape / small tablets |
| `md:` | ≥ 768px | Tablets |
| `lg:` | ≥ 1024px | Desktop — the point where sidebars become permanent |

The employee portal is the mobile-first surface. The HR console must remain
functional at 390px but is optimised for desktop.

## Layout rules per surface

| Surface | < `lg` | ≥ `lg` |
|---|---|---|
| Employee portal (`/employee/*`) | Drawer nav + fixed 4-item bottom nav | Permanent 224px sidebar |

The portal header keeps the gym switcher, alerts and account menu only —
each page renders its own `<h1>`, so the header title is `hidden sm:block`.
Below `lg` the alerts bell opens the full `/employee/notifications` page
instead of a dropdown that would cover the page.
| HR console (`/console/*`) | Drawer nav from the header | Permanent 256px sidebar |
| App shell (`/`, `/login`, `/enrollment`, `/station-code`, `/dashboard`) | Single scrolling header row | Same |
| Kiosk (`/attendance`) | Unsupported | 1080p terminal |

- Bottom nav height is `min-h-14` + `env(safe-area-inset-bottom)`. Page content
  keeps `pb-24` so nothing hides behind it.
- Drawers never exceed `85vw`; the backdrop always closes them.

## Components

### Overlays (`Dialog`, `Modal`, `Drawer`)

- Bottom sheet below `sm` (rounded top corners), centered card above.
- `max-height: 92dvh` via `.overlay-panel`; the **body scrolls**, the footer
  stays pinned.
- `.safe-bottom` on the panel so the last input/button clears the home
  indicator.
- Always go through `useOverlay(open, onClose, ref)` — it handles Escape, the
  Tab trap, initial focus, focus restore, and `overflow: hidden` on `<body>`.
  Feature components must not add their own Escape listeners.
- Never nest a `Modal` inside a `Dialog`; use `ConfirmDialog` for confirmation.

### Buttons and touch targets

- Minimum hit area on touch: **44×44px**.
- `.btn-sm` / `.btn-md` are widened automatically under `@media (pointer: coarse)`.
- Icon-only buttons must add `.touch-target` **and** an `aria-label`.
- Do not put two primary actions side by side in a mobile footer — they should
  be full-width or wrap (`flex-wrap`).

### Forms

- Controls are ≥16px on coarse pointers (global rule + `.form-*`), which stops
  iOS from zooming the page on focus. Do not override with `text-xs` on a real
  input; use the label for small text instead.
- One field per row below `sm` for forms with more than three fields; two
  columns are acceptable for short paired values (date + amount).
- Labels sit above the field. Errors use `role="alert"` and never rely on
  colour alone.
- Prefer `type="tel"`, `inputMode="numeric"`, and `autoComplete` so the right
  keyboard appears.

### Tables and lists

- Tables are desktop-only on the portal: wrap in a container with
  `hidden lg:block` and provide a card/grid equivalent below `lg`.
- Any table that must exist on mobile goes inside `.table-responsive`
  (horizontal scroll with momentum). Never let a table scroll the whole page.
- **Shift grids are the exception**: the Branch/Team Schedule keeps rows =
  employees and columns = days at every width. Below `lg` it renders a
  `grid` (not a `<table>`) with a sticky first column (`8.5rem`), `3.25rem`
  day columns and compact `7a–3p` labels, inside `.table-responsive`.
  Horizontal scroll is the week navigation — never restack the days.
- Dense tables use `.data-table-compact`; body text stays at 12px minimum.

### Calendars

- A month must stay a 7-column grid on phones (one square cell per day,
  ~46px at 390px wide) with a shift bar and an attendance dot per cell.
- Tapping a day reveals its detail *below* the grid — never replace the
  month with a scrolling list of days.

### Typography

- Body copy floor: **12px** (`text-xs`). Avoid `text-[10px]` / `text-[11px]` for
  anything the user must read; 11px is acceptable only for uppercase table
  headers and metadata chips.
- Line length: keep prose under ~70 characters (`max-w-prose` or a card width).

### Toasts and feedback

- Toasts anchor at `top-[4.5rem]` below `sm` so they clear the 64px sticky
  header, then move to `top-4` on larger screens.
- One toast stack per surface. Never anchor to the bottom on the portal — the
  bottom nav owns that space.

### Safe areas and scrolling

- `viewport-fit=cover` is set in `index.html`; use `.safe-bottom` / `.safe-top`
  rather than hard-coded padding on fixed elements.
- Avoid `100vh` in new code — use `100dvh` (or `.overlay-panel`) so mobile
  browser toolbars never clip content.
- Avoid `bg-fixed` below `sm` (iOS Safari repaints/scrolls it incorrectly).
- Modals and drawers lock body scroll; nothing else should.

## Accessibility checklist

- [ ] Every icon-only control has an `aria-label`.
- [ ] Overlays use `role="dialog"` + `aria-modal` and go through `useOverlay`.
- [ ] Focus is visible (global `:focus-visible` ring) — never `outline: none`.
- [ ] Async status is announced (`role="status"` / `aria-live="polite"`).
- [ ] Errors are announced and described, not only colour-coded.
- [ ] Animations respect `prefers-reduced-motion`.
- [ ] Touch targets ≥ 44px (`.touch-target`, `.btn-*` coarse rules).
- [ ] Text ≥ 12px for body copy; body copy contrast ≥ 4.5:1.

## Kiosk (`/attendance`)

Desktop-only by decision.

- Target hardware: a 1080p (or larger) attendance station with a fixed
  browser window. `KioskLayout` uses `100vh` with `overflow-hidden` and
  assumes the camera feed and controls all fit.
- No drawer, bottom nav, or responsive table work is required.
- If the kiosk ever ships on a tablet, replace `h-screen` with `h-dvh`, allow
  vertical scrolling, and re-check the camera viewfinder aspect ratio first.
