# HR Portal — Manual Swagger Test Guides

Paste-ready test cases for **every API behind the HR portal screens and subscreens**
(HR + HR-Manager roles), organised screen by screen. Each case is a single row:
who signs in, what to paste into Swagger "Try it out", and the exact expected result.

Scope is grounded in the portal router (`Mock UI/HR/js/app.js` → `pageRenderers`,
17 routes) and the server contract (`docs/architecture/api.md` + the controllers).

## How to run a case

1. Start the app in **Development** (default): `dotnet run --project ReviveHRSystem.Web`.
   Swagger UI → `http://localhost:<port>/swagger` (dev-only; 404 in Production).
2. `POST /api/auth/login` with one of the seed accounts below, copy `accessToken`.
3. Click **Authorize** (padlock) → `BearerAuth` → paste the token → **Authorize**.
4. Open the operation → **Try it out** → paste the query string / JSON body from the
   case → **Execute**.
5. Request bodies arrive **pre-filled with a valid example** (custom
   `Swagger/RequestExampleOperationFilter`) — edit only the fields a case calls out.

## Seed accounts (DevelopmentDataSeeder, password `Revive!2026`)

| Login | Role | Gyms | Purpose in testing |
|---|---|---|---|
| `hrmanager@revive.hr` | HR Manager | gym1 + gym2 | **Primary actor** — full HR-portal permission keys on both gyms |
| `hr@revive.hr` | HR | gym1 only | Gym-scoping checks (cross-gym rows must 401/404) |
| `admin@revive.hr` | Super Admin | unscoped | TopManagement bypass (no permission keys needed) |
| `omar@revive.hr` | Branch Manager (gym1) + Team Leader (gym2) | gym1 + gym2 | Stage-1 decisions, branch-proposal creation, out-of-scope negatives |
| `karim@revive.hr` | Employee | gym1 | Self-service negatives — every HR endpoint must reject him |
| `sara@revive.hr` | Employee | gym1 | Second employee for ambiguous-name / colleague cases |

> The seeder grants `hr@` and `hrmanager@` **all tracked portal permission keys**
> (direct `UserPermissions` rows) and `omar@` the branch-level subset — because the
> endpoint guards read tracked keys, not the per-gym feature roles. Re-run the app
> against a fresh/Development DB so the grants apply.

## Status-code contract (read before testing)

| Code | Means |
|---|---|
| **401** | Not just "no token" — **this code is also used for permission denials and out-of-scope gyms** (`UnAuthorizedException`). A 403 never appears in this codebase. |
| **400** | Validation/business-rule failure (`{ statusCode, errorMessage, errors }`) |
| **404** | Unknown id **or** a valid id outside your gym scope (no existence leak) |
| **429** | Rate-limited operations (login, `public-forms` application form, `[EnableRateLimiting]` actions) |

List envelopes: HR directory endpoints return `{ items, page, pageSize, total, totalPages }`
(`page`/`pageSize` in, `total` is the filtered count). Creates return `201 { data: … }`
unless noted. Errors return `{ statusCode, errorMessage, errors }`.

## Guides

| File | Screen(s) covered |
|---|---|
| [00-auth-session.md](00-auth-session.md) | Login, gym selection/switch, `me`, logout, password, settings |
| [01-dashboard.md](01-dashboard.md) | HR dashboard (KPIs, permission-gated action cards, branches) |
| [02-employees.md](02-employees.md) | Directory + employee profile (9 tabs) + lifecycle modals (create, status, transfer, position, compensation, contract, role, leave balance, bulk import, documents) |
| [03-terminations.md](03-terminations.md) | 5-stage separation board (T2–T6, E19) + escalated action requests |
| [04-recruitment.md](04-recruitment.md) | 7 tabs: vacancies, vacancy requests, pipeline/candidate sub-tabs, applications, interviews, follow-ups, waiting list, hire wizard, new-comers |
| [05-attendance.md](05-attendance.md) | Roster grid, manual day-write, corrections, punch audit, attendance policy, device pairing, per-employee history |
| [06-requests.md](06-requests.md) | Directory + HR decide/undo/bulk/archive/restore + Branch Queue route |
| [07-payroll.md](07-payroll.md) | Settlement sheet, entry bonus, deduction lines, close/reopen, publish, payslips, export, deduction review queue |
| [08-branch-actions.md](08-branch-actions.md) | Warnings & bonuses queue + HR review (approve/decline), pending-HR, branch reports |
| [09-evaluations-forms.md](09-evaluations-forms.md) | Evaluation forms CRUD, dispatch, run view, inbox, responses, cycles, goals, hiring forms |
| [10-reports.md](10-reports.md) | Overview KPIs, CSV export, drill-down panels + in-panel actions |
| [11-positions.md](11-positions.md) | Positions catalog CRUD |
| [12-notifications-events.md](12-notifications-events.md) | Inbox, announcements compose/retract, events queue + resolve/decide |
| [13-audit-my-access.md](13-audit-my-access.md) | Audit log filters, My Access card |
| [14-hr-team.md](14-hr-team.md) | HR Team wizard: members list, roles CRUD, permissions, user role/permission/gym assignment |

## Conventions used in the case tables

- **Actor** is a login shorthand: `hrm` = hrmanager@revive.hr, `hr` = hr@revive.hr,
  `admin` = admin@revive.hr, `bm` = omar@revive.hr, `emp` = karim@revive.hr,
  `anon` = no Authorization header, `bad` = `Bearer garbage.token.here`.
- Query strings are pasted after the path in Swagger's **Execute** request field.
- `{id}` means "an id you obtained from an earlier happy-path case in this guide".
- Cases are ordered **happy path first**, then 401s, 400s, 404/out-of-scope, then edge cases.

## Out of scope (verified not part of the HR portal)

- Kiosk/station + face-biometrics endpoints (`/api/kiosk/*`, `/api/attendance/events`,
  `/api/attendance/face-scan`, `/api/employees/face/*`, station codes) — station UI, not HR.
- Dead JS never routed by `pageRenderers`: `pages-schedule.js#renderSchedule`,
  `pages-branch-queue.js#renderBranchQueue` (the `branch-queue` **route** renders the
  Requests screen — covered in [06-requests.md](06-requests.md)).
- Employee self-service portal surfaces (contact/emergency/photo uploads, self request
  submission) — they are the employee app, not the HR portal.
