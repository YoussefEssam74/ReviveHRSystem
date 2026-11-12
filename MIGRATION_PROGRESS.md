# Mock-UI → React Migration Progress

Source of truth: the `Mock UI\` portals (`Mock UI\HR` for the `/console` back office).
Each React page is updated to visually match its mock reference while staying fully wired
to real backend APIs. Work proceeds **one page at a time**; a page is only reported
"done" after a build passes and the flow is manually exercised.

## Reference files

| Portal | Files |
|---|---|
| HR back office (`/console/*`) | `Mock UI\HR\index.html`, `styles.css`, `js\*.js` |
| Super Admin | `Mock UI\Super Admin\index.html` |
| Employee self-service | `Mock UI\Employee\index.html`, `js\*.js` |
| Attendance station (kiosk) | `Mock UI\Attendance Station\index.html` |

## Shared groundwork (once)

| Item | Status |
|---|---|
| `MIGRATION_PROGRESS.md` | ✅ created |
| Brand/charcoal token scales added to `Client/src/index.css` `@theme` (exact mock hexes) | ✅ |
| `Button` gained the mock's `btn-success` variant (#06b664) | ✅ |
| Mock badge palette helper (`queueBadgeClass`) in `lib/format.ts` | ✅ |
| `apiDownload` in `lib/api-client.ts` (binary/CSV GETs, same auth conventions) | ✅ |

## Page-by-page status

| # | Console page | Mock reference | UI updated | API integration | Missing APIs | Tested |
|---|---|---|---|---|---|---|
| 1 | HR Dashboard `/console/dashboard` | `HR\js\pages-dashboard.js` | ✅ | ✅ (see notes) | none — all endpoints existed | ✅ build + manual |
| 2 | Employees + profile `/console/employees` | `HR\js\pages-employees.js` | ⬜ | ⬜ | — | — |
| 3 | Terminations `/console/terminations` | `HR\js\pages-employees.js` (renderTerminations/Offboarding) | ⬜ | ⬜ | — | — |
| 4 | Recruitment `/console/recruitment` | `HR\js\pages-recruitment.js` | ⬜ | ⬜ | — | — |
| 5 | Attendance `/console/attendance` | `HR\js\pages-attendance.js` | ⬜ | ⬜ | — | — |
| 6 | Requests `/console/requests` | `HR\js\pages-requests.js` | ✅ | ✅ | `GET /api/requests/summary` + list-item identity/balance fields (added) | ✅ build + type-check |
| 7 | Branch queue `/console/branch-queue` | `HR\js\pages-branch-queue.js` | ⬜ | ⬜ | — | — |
| 8 | Payroll `/console/payroll` | `HR\js\pages-payroll.js` | ✅ | ✅ | period `gymId/gym` + entry `employeeNumber`/`attendance` (added) | ✅ build + type-check |
| 9 | Evaluations `/console/evaluations` | `HR\js\pages-evaluations.js`, `pages-forms.js` | ⬜ | ⬜ | — | — |
| 10 | Schedule `/console/schedule` | `HR\js\pages-schedule.js` | ⬜ | ⬜ | — | — |
| 11 | Events `/console/events` | `HR\js\pages-events.js` | ⬜ | ⬜ | — | — |
| 12 | Reports `/console/reports` | `HR\js\pages-access.js` (renderReports) | ⬜ | ⬜ | — | — |
| 13 | Positions `/console/positions` | `HR\js\pages-access.js` (renderPositions) | ⬜ | ⬜ | — | — |
| 14 | HR Team `/console/hr-team` | `HR\js\pages-hr-team.js` | ⬜ | ⬜ | — | — |
| 15 | My Access `/console/my-access` | `HR\js\pages-access.js` (renderMyAccess) | ⬜ | ⬜ | — | — |
| 16 | Notifications `/console/notifications` | `HR\js\pages-access.js` (renderNotifications) | ⬜ | ⬜ | — | — |
| 17 | Audit `/console/audit` | `HR\js\pages-access.js` (renderAudit) | ⬜ | ⬜ | — | — |

Also in scope (mock portals outside this console): Employee self-service pages,
Super Admin pages, Attendance Station kiosk — queued after the HR console.

## Page 1 — HR Dashboard (completed)

### UI changes
- Rebuilt `features/dashboard/pages/HrDashboardPage.tsx` to the "HR command center" mock:
  compact greeting header w/ role chip + date, **gym branch selector**, **Export** button,
  4-tile KPI strip (Gym Branches / Total Staff / Pending Requests / amber Actions Needed),
  7-5 split workspace: **"Actions You Need To Take"** panel (scrolled decision cards with
  Approve / Decline / Review + All·Requests·Vacancies·Branch tabs) and right column with
  **Fast Actions** (Create Account, Change Password, Hiring Form, Evaluation Form,
  See Requests w/ badge, Announcement) + **Branches Overview** rows — exact mock spacing,
  colors, badge palette, and hover states (brand/charcoal tokens).
- New dashboard dialogs (`features/dashboard/components/`): CreateEmployeeDialog (with
  real webcam face capture), PasswordAccessDialog, CreateHiringFormDialog,
  CreateEvaluationFormDialog, GymsOverviewDialog, VacancyRequestDialog (approve + decline
  reason step), ContractRenewalDialog. A `useMockToast` (bottom-right, mock styles).

### API integrations (all real)
| Mock element | Endpoint |
|---|---|
| KPIs / decision cards / branch rows | `GET /api/dashboard/hr` (unchanged) |
| Request card Approve/Decline | `POST /api/requests/{id}/decide` (stage HR) — added |
| Vacancy card Approve/Decline (+ reason) | `PUT /api/vacancy-requests/{id}/decide` |
| Branch deduction/warning/bonus cards | `POST /api/deduction-candidates/{id}/review`, `/api/warning-notices/{id}/review`, `/api/bonus-proposals/{id}/review` |
| Contract cards | `POST /api/employees/{id}/contract` (level/salary/effective date) |
| Payroll card | navigate → `/console/payroll` |
| Create Account fast action | `POST /api/employees` (+ optional `POST /api/employees/{id}/role-change`, `POST /api/employees/face/enroll`) |
| Change Password fast action | `POST /api/users/{id}/reset-password` (user resolved from the employee's email) |
| Hiring Form fast action | `POST /api/hiring-forms` |
| Evaluation Form fast action | `POST /api/evaluation-forms` → `POST /{id}/launch-cycle` → `POST /{id}/dispatch` |
| Announcement fast action | `POST /api/announcements` |
| Export | `GET /api/reports/export?format=csv&period=ytd` (download) |
| Gym selector | `POST /api/auth/switch-gym` via `MeContext.switchGym` |
| Gyms overview modal | `GET /api/dashboard/hr` branches + `GET /api/vacancies?status=Open&pageSize=100` |

### Honest deviations from the mock (API-contract driven, reported)
- Create Account: backend stores **one home gym** per employee (`Gym: int`) → branch grid
  is single-select and the "All Branches" tile was removed; employee code is auto-generated
  server-side (`EMP-####`), read-only; initial password is the system default `Revive!2026`
  (displayed, not editable — the create API takes no password).
- Password & Access dialog: the mock's four employee "access permission" checkboxes have no
  backend — replaced with the real system-role select (`POST /{id}/role-change`) next to the
  password reset.
- Hiring-form modal's "Required Application Fields" are server-fixed (always collected) →
  rendered as locked-checked chips; employment type became a real `choose` question;
  headcount is folded into the form name (hiring forms have no headcount field).
- Evaluation-form modal routes evaluators server-side (`/{id}/dispatch`); the evaluator
  select is display-only (real users holding evaluation permissions) with a routing note.

### Remaining issues
- None blocking. Face enrollment requires a live camera; failure keeps the dialog open
  with a warning (no test in CI).

## Two-sided flows: employee ⇄ HR (Requests, Payroll, Create Account)

### Requests — one pipeline visible from both sides
- `GET /api/requests?status=Pending HR Review` now also returns stage-1 `Pending` rows
  (`awaitingManager: true`); `GET /api/requests/summary` counts them in `pending` and
  exposes the `awaitingManager` subset.
- `POST /api/requests/{id}/decide` accepts a stage-1 request. When no manager decision
  exists, a `BranchManager` row is recorded with the comment
  `"Manager stage skipped — advanced by HR."`, so the timeline reads
  *Submitted → Manager stage skipped → HR Approved* instead of claiming a manager acted.
- **Balance correctness**: self-service submissions reserve `PendingDays`. Every HR outcome
  now releases that reservation (`MoveBalanceDaysAsync`, one tracked save), a paid approval
  moves the days into `UsedDays`, and undo restores both buckets — no more double counting
  and no leaked reservations. HR-filed requests never reserved, so nothing is released.
- Manager-less gyms: `EmployeeRequestService` checks
  `IUserAccessRepository.HasActiveGymDeskAsync(gym, actorUser)` and auto-advances to
  `Pending HR Review` with the marker `"Auto-advanced to HR — no branch manager assigned to
  this gym."`.
- Bulk approve covers the stage-1 queue too (tracked query + per-bucket cache, so two
  requests of one employee no longer collide).
- Employee portal: status reads **Awaiting Manager** for stage-1 rows; the detail drawer
  shows a **Final decision** panel (Approved/Rejected + Paid/Unpaid).

### Payroll — current-month provisioning
- `POST /api/payroll-periods/ensure?gym=` (payroll.edit): creates the current month's run
  when missing and adds a `Draft` sheet for every active employee without one (base = latest
  compensation, days = attendance punches, OT 0). Idempotent; locked/paid runs untouched.
- Payroll page calls it on load (once per gym) and refreshes, so new hires appear in the
  ledger and in their own *My Payroll* immediately.
- Dev seeder: generated sheets now use the employee's latest compensation and real
  attendance days instead of the hard-coded 8000 / 21 that contradicted the employee file.

### Create Account → usable login
- Success step shows a **credentials panel** (login email, temporary password, copy +
  copy-both) with the employee code, plus any role/Face-ID warnings.
- Email auto-generation trims stray dots (`"Flow Check 1211"` → `flow.check@revive.com`).
- `EmployeeService`: `HireDate` now honours the form's hire date.
- `GET /api/employees/{id}/leave-balance` reports the type's default entitlement when no row
  exists (21 annual / 10 sick), matching the submission rule — a brand-new employee can
  request leave instead of seeing "0 of 0 days".

### Session UX
- HR sessions sign in without a gym scope, which made every console page read "no access".
  `MeContext` now scopes a non-TopManagement user to their first gym once after login (the
  header switcher still changes it); TopManagement keeps its cross-gym scope.

## Shared: `/api/me` now returns `featureLevels` (blocker fix)

The SPA gates every console page on `me.featureLevels`, but `MeResponse` never carried the
field (the API docs promised it), so every gated page rendered "no access". It is now
computed from the active gym's permission keys — `{feature}.view` → 1, any other action
(`.edit`/`.manage`/`.approve`) → 2 — and returned by both `GET /api/me` and
`POST /api/auth/switch-gym`.

Also fixed while wiring these pages: `BulkDecideAsync` 500'd whenever two pending requests
belonged to the same employee (`RequestByIdsSpec` now tracks, so the follow-up `Update` no
longer re-attaches a duplicate `Employee` graph).

## Shared: HR design tokens

`Client/src/index.css` now declares a `.hr-portal` scope that redeclares the brand scale with
the **HR** mock hexes (`brand-600 #006c49`, `brand-500 #10b981`, `brand-50 #f0fdf4`, …) and the
violet-tinted charcoal stops (`charcoal-50 #f9f9ff`, `400 #adb5bd`, `500 #6c7a71`,
`800 #111c2d`, `900 #212529`), plus the `badge-emerald/brand/success` tones. Tailwind v4
utilities read `var(--color-*)`, so the override is subtree-local: `ConsoleLayout` carries the
class and the Employee portal palette is untouched. Dark mode keeps the same scope with
lightened text stops.

## Page 6 — Requests (completed)

### UI changes
`features/requests/pages/RequestsPage.tsx` rebuilt to the mock: header + **New Request**,
four clickable KPI tiles (Urgent/Pending, Approved (month), BM Rejected, Balance Alerts),
type pills with counts (every request type + Deductions/Warnings/Bonuses from the branch
queue), `Pending HR | Decided | Archived` segmented tabs with badges, quick-filter chip,
**Bulk Approve**, and the full request card (avatar + type glyph, status/urgency tags,
position · level · gym · tenure, `ID R{id}` + employee number, Request/Reason/BM/Balance rows,
timeline chips, Approve/Reject/Undo/Detail/Archive|Restore). Modals: Decide (payment radio,
balance strip/warning, BM block, timeline, rule hints), Detail, Bulk Approve balance check,
New Request with live balance preview, and the resignation → offboarding prompt.

### API integrations
| Mock element | Endpoint |
|---|---|
| List + tabs + type/quick filters | `GET /api/requests` |
| KPI tiles / tab badges / type pills | `GET /api/requests/summary` **(new)** |
| Decide / Undo / Bulk / Archive / Restore | `POST /api/requests/{id}/decide`, `/undo-decision`, `/bulk-decide`, `/{id}/archive`, `/{id}/restore` |
| New Request + live balance | `GET /api/employees` + `GET /api/employees/{id}/leave-balance` + `POST /api/requests` |
| Branch submissions merged into the list | `GET /api/deduction-candidates`, `/api/warning-notices/queue`, `/api/bonus-proposals/queue` + their `/review` |

### Honest deviations
- The mock has no pagination; the React page keeps the shared `Pagination` when a tab
  exceeds one page (the API is paged).
- Escalated action-requests (`GET /api/action-requests`) keep their API helpers but are no
  longer listed here — the mock's inbox is employee requests only; the Events module owns
  the escalated queue.

## Page 8 — Payroll (completed)

### UI changes
`features/payroll/pages/PayrollPage.tsx` is the branch ledger: title + Open/Locked chip,
branch + period selectors, Export CSV, publish gating (`Publish (n pending)` until every
sheet is closed, then `✓ Publish & Lock Branch`), the four stat tiles (Total Staff,
Settled & Closed + %, Pending Review, Net Disbursed + Gross) and the eight-column table
(Employee initials/name/number, Role, Base Salary, OT & Bonus, Deductions, Net Final,
status badge, `Review Sheet →`).
`components/SettlementSheet.tsx` is the compact sheet: header bar (back, ‹ ›, employee
dropdown with live status, status badge, Net Final Pay, Close & Settle / Reopen /
`Resolve n Actions First`), 7-5 workspace — left: earnings & additions (editable bonus,
OT hours+pay) and deductions & recoveries (inline add form, per-line Approve/Waive, net
strip); right: Work Days & Attendance Log, Biometric Punch Proof (View Log → punch audit),
Linked Employee Requests. Publish confirm and payslip dialogs wired.

### API integrations
| Mock element | Endpoint |
|---|---|
| Branch/period selectors + totals | `GET /api/payroll-periods?gym=…` |
| Ledger rows + settlement sheet + evidence | `GET /api/payroll-periods/{id}?gym=…` (entry `attendance` block **new**) |
| Bonus / Add line / Remove line | `PUT …/entries/{employeeId}`, `POST`+`DELETE …/deductions` |
| Line Approve / Waive | `POST /api/deduction-candidates/{id}/review` |
| Close / Reopen / Publish & lock | `POST …/close`, `…/reopen`, `POST /api/payroll-periods/{id}/approve` |
| Punch audit | `GET /api/attendance/{ref}` |
| Linked requests | `GET /api/requests?ids=…` |
| Export / Payslip | `GET /api/payroll-periods/{id}/export`, `GET …/payslips/{employeeId}` |

### Attendance corrections on the settlement sheet
- `PUT /api/payroll-periods/{id}/entries/{employeeId}/attendance` (payroll.edit, open period)
  updates all six counters. `DaysWorked`/`OvertimeHours` are edited in place (OT reprices
  the gross); the four record-derived counters (weekly offs, approved leaves, late
  arrivals, unexcused absences) are stored as `*Override` columns so the raw punch log
  stays untouched as evidence. `AttendanceAdjustedAt`/`AttendanceAdjustedBy` stamp who
  corrected the sheet, and the card shows an **Adjusted** chip.
- Migration `20261112015000_AddPayrollAttendanceOverrides` (six nullable columns).
- UI: the *Work Days & Attendance Log* card gains an **Edit** button (hidden when the sheet
  is closed/locked or the user lacks payroll edit) that swaps the six rows for number
  inputs with Save/Cancel.

### Attendance drill-down (added on request)
Every row of *Work Days & Attendance Log* is now a button with a chevron. It opens
`components/AttendanceDaysDialog.tsx`: the day-by-day log behind that counter (date +
weekday, shift window, in → out, worked hours, OT, status badge, note) with the six
counters as switchable chips, and a **Punch** button per day that opens the biometric
audit. The log rides the period detail (`attendance.days[]`), so there is no extra request;
the empty state explains when the sheet's count has no day-level records yet (seeded runs).

### Honest deviations
- `payroll.approve` is not a separate feature level in the token model (features are
  view/edit), so the Publish button is shown for `payroll` Edit and the server's 403 is
  surfaced as a toast when the caller may edit but not sign off.
- The mock's single-screen `h-full` layout is rendered as a normal scrolling page.
- "Overtime" has no per-day source of truth: the sheet stores the month's logged hours, so
  the dialog filters days whose punch ran past the scheduled shift end and labels the
  remainder as sheet-logged.
