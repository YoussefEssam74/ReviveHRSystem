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
| HR Manager | One gym — the account owner | No |
| HR | One gym, operational (no approvals, payroll lock or audit) | No |
| Branch Manager | One branch | No |
| Team Leader | One team | No |
| Employee | Own profile and records | No |

Inside a gym, the Super Admin inherits every HR Manager permission. On top of that sit
ten platform-only capabilities that no gym role can ever reach. System roles are fixed;
custom roles are created on **Roles & permissions** and can be assigned to staff.

## Pages

| Page | What it answers |
| --- | --- |
| **Dashboard** | Four numbers that matter — gyms, users, revenue, seat utilisation — plus the gym table and the decisions waiting on you. |
| **Gym accounts** | A sortable table of every subscribed gym: plan, branches, MRR, renewal and status. `Open` goes to the full account. |
| **Gym detail** | Everything about one account across six tabs: overview, **branches**, **employees** (filterable per branch), HR managers, **billing**, audit. |
| **Users** | Who is on the platform. Gym chips double as the per-gym count **and** the filter, then narrow by role, status or search. |
| **User profile** | A full page per person — employment record, permissions from their role, access details and their own audit trail. |
| **HR managers** | The accounts you provisioned, as a table: owner, gym, preset, status, last sign-in — plus the workspace launcher to enter any gym as any role. |
| **Billing & quotas** | Platform revenue **and the plans you sell**: MRR/ARR, the plan table (price, cycle, trial, limits), the invoice ledger with issue→paid ranges and aging buckets, seat consumption per gym. |
| **Roles & permissions** | The role catalog. Create a role, tick its permissions grouped by module, edit or duplicate existing roles. |
| **Security & audit** | The exceptions first: a review queue of critical and warning events, your own impersonation sessions, then the complete immutable trail. |

## Design rules applied

- **Dashboard:** four KPIs, one gym table, one attention queue. Nothing else.
- **List views are tables**, not cards: many records compared at once, sortable
  headers, row-level actions, and a footer that states exactly what is shown.
- **Every page fits the viewport.** The shell never scrolls: each page is a fixed
  flex column and the only thing that scrolls is the table body inside its card.
  (Below 1024px the shell falls back to normal page scrolling.)
- **Toolbars follow one pattern**: filters are labelled dropdowns grouped at the left
  edge of the row and the text search is pinned to the right edge of the same row.
  Counts live inside the option labels (`All gyms (293)`), not in a row of chips.
- **Detail is a page, not a popup.** Users and gyms open their own route with tabs.
- **One source of truth per number.** An invoice's `paid` flag drives the status badge,
  the aging bucket, the gym's Active flag and the overdue alert together.
- **Every write is audited** — creating a role, editing a plan, adding a branch,
  recording a payment and suspending an account all append to the trail.

## Key flows

1. **Create gym account** — four-step wizard: gym details → subscription plan →
   HR Manager account → review. Writes a `Gym` and a `User` event, then opens the
   new account.
2. **Create HR manager account** — from the dashboard, the gym detail page or the
   HR managers page. Seat-limit and duplicate-email guards run inline.
3. **Add branch** — from a gym's Branches tab, bounded by the plan's branch limit.
   Staff are scoped to a branch and the Employees tab can be filtered by it.
4. **Create or edit a role** — Roles & permissions → Create role (or Duplicate on a
   system role), tick permissions per module, save. The role then appears in the
   workspace launcher.
5. **Create or edit a plan** — Billing & quotas → plans table → Create plan / Edit
   plan. Set the price, the **billing cycle** (monthly, every 3 months or yearly),
   the **trial model** (none, a free trial of *n* days, or a plan that is itself a
   trial and never billed), the seat and branch limits, and the included features —
   tick from the catalogue or type your own and press Add.
6. **Record a payment** — the invoice flips to Paid, the gym returns to Active, its
   payroll block clears and the overdue alert disappears. `Remind all overdue` sends
   bulk reminders.
7. **Review an audit event** — Security & audit → mark a critical or warning event as
   reviewed; it leaves the queue and is tagged `reviewed` in the full trail.
8. **Enter gym workspace** — pick a gym and a role; the HR portal opens in a new tab
   and the session is recorded as an `Access` event.

## Mock data

`js/data.js` is the single source of truth:

- Six gym tenants with **11 physical branches**, three plans, and **293 users**
  reconciled against each gym's declared seat counts (58 / 45 / 39 / 96 / 31 / 24).
- Every user carries a branch and branch code.
- Eighteen invoices across three billing months, 32 seeded audit events, the
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
                    hr-managers, billing, access, audit)
js/app.js           bootstrap
```
