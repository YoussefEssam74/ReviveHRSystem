# Super Admin Console — prototype

Static, dependency-free mock of the platform-owner experience for ReviveHR.
Open `index.html` in a browser (no build step, no server). Tailwind is loaded from
the CDN, so the prototype needs a network connection for styling.

## Role model

The console is built around one rule: **Super Admin is a superset of HR Manager, not
a sibling of it.**

| Role | Scope | Can reach the console? |
| --- | --- | --- |
| Super Admin | Every gym account, plus platform settings | Yes |
| HR Manager | **Every gym account** — a platform-wide HR lead | No |
| HR | The gym accounts they are assigned to — one or many | No |
| Branch Manager | One branch | No |
| Team Leader | One team | No |
| Employee | Own profile and records | No |

Inside a gym, the Super Admin inherits every HR Manager permission. On top of that sit
ten platform-only capabilities that no gym role can ever reach. System roles are fixed;
custom roles are created on **Roles & permissions** and can be assigned to staff.

**Assignment model:** an HR Manager is *not* attached to a gym — one account covers all
of them. Only **HR** staff carry gym assignments, and an HR user can hold several gyms
at once. Assign or revoke that access from a gym's **HR staff** tab, or while creating
the gym in the wizard.

## Pages

| Page | What it answers |
| --- | --- |
| **Dashboard** | Four numbers that matter — gyms, users, revenue, seat utilisation — plus the gym table and the decisions waiting on you. |
| **Gym accounts** | A sortable table of every subscribed gym: plan, branches, MRR, renewal and status. `Open` goes to the full account. |
| **Gym detail** | Everything about one account across six tabs: overview, **branches**, **employees** (filterable per branch), **HR staff** assigned to it, **billing**, audit. |
| **Users** | Who is on the platform. Gym dropdown doubles as the per-gym count **and** the filter, then narrow by role, status or search. |
| **User profile** | A full page per person — employment record, permissions from their role, access details and their own audit trail. |
| **HR managers** | The platform HR accounts: every one of them reaches all gym accounts. Create, suspend or reset.
| **Billing & quotas** | The operations desk: a summary strip (billed, collected, still owed, seats used), the invoice ledger with filters, issue→paid ranges and its payment actions, and the **plan catalogue in a side rail** — price, cycle, limits, trial, gyms and MRR per plan, with create / edit / duplicate. Revenue *analysis* lives on its own page. |
| **Revenue analyzes** | Nested under Billing & quotas. Answers the money question in four numbers plus one trend line — MRR, gross revenue, collected, outstanding — then opens a dedicated breakdown page per number; gross splits the billings by plan. |
| **Roles & permissions** | The role catalog. Create a role, tick its permissions grouped by module, edit or duplicate existing roles. |

## Design rules applied

- **Dashboard:** four KPIs, one gym table, one attention queue. Nothing else.
- **List views are tables**, not cards: many records compared at once, sortable
  headers, row-level actions, and a footer that states exactly what is shown.
- **Every page fits the viewport.** The shell never scrolls: each page is a
  flex column and the only thing that scrolls is the table body inside its card.
  A table always keeps a usable floor, so if the window is genuinely too short
  the page scrolls a little instead of crushing the table to nothing.
  (Below 1280px the panels stack, so the page falls back to normal scrolling.)
- **Toolbars follow one pattern**: filters are labelled dropdowns grouped at the left
  edge of the row and the text search is pinned to the right edge of the same row.
  Counts live inside the option labels (`All gyms (293)`), not in a row of chips.
- **Detail is a page, not a popup.** Users, gyms and every revenue metric open their
  own route with tabs or a breakdown table.
- **Summarise, then let people drill in.** A page states the answer; the evidence
  behind each headline number lives one click away instead of being stacked on the
  same screen. The Revenue analyzes headline cards are buttons, not dead panels.
- **Charts never distort.** Trend geometry is the only thing inside the SVG — it
  stretches to any card width. Axis labels and data points are HTML, so text stays
  crisp and dots stay round at 1200px and 1920px alike.
- **One source of truth per number.** An invoice's `paid` flag drives the status badge,
  the aging bucket, the gym's Active flag and the overdue alert together.
- **Every write is audited** — creating a role, editing a plan, adding a branch,
  recording a payment and suspending an account all append to the trail.

## Key flows

1. **Create gym account** — four-step wizard: gym details (with logo upload) →
   subscription (14-day trial) → assign HR staff → review. Writes a `Gym` event plus one
   `User` event per assigned HR member, then opens the new account.
2. **Create HR manager account** — a platform account that instantly reaches every gym.
3. **Assign HR staff to a gym** — from the gym's HR staff tab or the creation wizard.
   Removing someone revokes that gym only; their other gyms are untouched.
3. **Add branch** — from a gym's Branches tab, bounded by the plan's branch limit.
   Staff are scoped to a branch and the Employees tab can be filtered by it.
4. **Create or edit a role** — Roles & permissions → Create role (or Duplicate on a
   system role), tick permissions per module, save. The role then appears in the
   workspace launcher.
5. **Create or edit a plan** — Billing & quotas → the plan rail on the right → **+ New**,
   or **Edit** on any plan. Set the price, the **billing cadence** (every *n* months or
   every *n* years — any number, not a fixed list), the **trial model** (none, a free
   trial of *n* days, or a plan that is itself a trial), the seat and branch limits, the
   included features (tick from the catalogue or type your own), and the **add-ons &
   overage** — priced lines like *extra 5 employees for EGP 100* that charge beyond the
   plan's allowance. **Duplicate** from inside the editor; the rail shows each plan's
   gyms, MRR share and add-on count.
6. **Record a payment** — the invoice flips to Paid, the gym returns to Active, its
   payroll block clears and the overdue alert disappears. `Remind all overdue` sends
   bulk reminders.
7. **Analyse revenue** — Revenue analyzes → switch the reporting period, then click any
   headline card (MRR, gross, collected, outstanding) to open its breakdown page:
   plan mix and revenue per seat, month-over-month billings **and which plan produced
   them**, payment timing, or the ageing of unpaid money with reminder and record
   actions.
8. **Review an audit event** — open a gym account's Audit tab (or a user profile's
   Recent activity) and mark an event as reviewed from its detail dialog.
9. **Enter gym workspace** — pick a gym and a role; the HR portal opens in a new tab
   and the session is recorded as an `Access` event.

## Mock data

`js/data.js` is the single source of truth:

- Six gym tenants with **11 physical branches**, three plans, and **293 users**
  reconciled against each gym's declared seat counts (58 / 45 / 39 / 96 / 31 / 24).
- Every user carries a branch and branch code.
- Eighteen invoices across four billing months, 32 seeded audit events, the
  45-permission matrix, the role catalog and the platform-capability list.

User records are generated deterministically from a fixed seed, so the prototype
renders identical data on every load. Interactive actions mutate the in-memory
arrays only — a reload resets them.

## Conventions

Design tokens, typography and component shapes follow
[`../HR/DESIGN.md`](../HR/DESIGN.md): emerald `#006c49` primary, charcoal neutrals,
Inter, 12px cards on 1px borders, flat elevation. The console adds a violet accent
reserved for platform-only, Super-Admin-exclusive concepts.

Files:

```
index.html          shell, navigation, header, modal + toast hosts
styles.css          design tokens and component classes
js/data.js          gyms, branches, users, plans, roles, audit, invoices
js/core.js          state, routing, formatting, modal/toast, derived data
js/pages-*.js       one file per page (dashboard, gyms, users, user-detail,
                    hr-managers, billing, revenue, access)
js/audit-log.js     the audit table + event detail dialog, used inside gym and
                    user records
js/app.js           bootstrap
```
