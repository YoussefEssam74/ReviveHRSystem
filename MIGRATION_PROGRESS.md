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
| 6 | Requests `/console/requests` | `HR\js\pages-requests.js` | ⬜ | ⬜ | — | — |
| 7 | Branch queue `/console/branch-queue` | `HR\js\pages-branch-queue.js` | ⬜ | ⬜ | — | — |
| 8 | Payroll `/console/payroll` | `HR\js\pages-payroll.js` | ⬜ | ⬜ | — | — |
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
