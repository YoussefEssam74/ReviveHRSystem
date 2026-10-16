# Employee Portal — API Implementation Plan (v2 FINAL)

> Status: **ACTIVE PLAN** — companion tracker: `docs/implementation/employee-portal-progress.md`
> Source of truth: `Mock UI/Employee/` (index.html, core.js, data.js, app.js, pages-employee.js, pages-employee2.js, pages-management.js, roles guide)

## 0. Mock UI analysis (what exists today)

One prototype SPA = **one portal for three employee-level roles** (+ HR / HR Manager / Super Admin previews). `js/app.js` routes **27 pages**; `js/core.js` builds nav from 4 permission-gated pools (`navItems` core, `extraPages` self-service, `teamItems`, `branchItems`); `js/data.js` holds `MOCK` (36 entities) and `DEMO_USERS` (6 roles).

### Roles & permission keys (verified in data.js DEMO_USERS)

| Role | Keys | Scope |
|---|---|---|
| Employee | 0 | own data |
| Team Leader | 8 | own + assigned team |
| Branch Manager | 15 | own + assigned gym |
| HR / HR Manager / Super Admin | 25 / 45 / `*` | HR scope |

**Portal rules from the roles guide:** permission-driven nav; own-data / team / gym scopes; published schedules only; two-stage request workflow (TL/BM stage 1 → HR final); gym chosen at login = active context; HR-controlled fields read-only; corrections via workflow, never direct edits; history preserved; configurable request types / document categories / evaluation criteria / payroll line items / shift names & cycles; no cross-gym leakage.

### Page inventory (route → data → actions)

**Self-service (all employee roles):**

| Page | Renderer | Core data (MOCK keys) | Key actions |
|---|---|---|---|
| Dashboard | `renderDashboard` | currentUser, todayShift, todayAttendance, attendanceSummary, scheduleData['c3'], payroll[0], notifications(3), teamStats/branchEmployees | nav cards; role-aware overview strip (`hasMgmt`, `employees.view`) |
| My Profile | `renderProfile` | currentUser (personal/contact/emergency/employment) | Edit Contact modal (phone/email/address); personal+employment read-only (HR-managed) |
| My Documents | `renderDocuments` | requiredDocs, documents, hrDocuments | Upload modal (documentType/documentName/file), doc detail + download |
| Events | `renderEvents` | events (Compliance/Benefits/Onboarding/Training/Company Event) | action button → deep link |
| Employment History | `renderHistory` | employmentHistory (month → events, from/to, extra[]) | read-only timeline |
| My Attendance | `renderAttendance` | attendanceSummary, todayShift/Attendance, attendanceRecords, leaveBalance | day-off form (type/date/reason) → create request; day drawer → "Request Correction" → Requests |
| My Schedule | `renderSchedule` | scheduleCycles + scheduleData, attendanceRecords (day shift/att), requests (chips), leaveBalance, requestTypes | month nav, day select, per-day New Request modal |
| My Payroll | `renderPayroll` | payroll (visible/items/subItems) | expand card, payslip modal (earnings/deductions), Download PDF (stub) |
| My Evaluations | `renderEvaluations` | evaluations (criteria, overallComment) | detail modal |
| My Requests | `renderRequests` | requests, requestTypes | status filter pills, New Request modal (7 types, dynamic fields), detail drawer (timeline, cancel, download) |
| Notifications | `core.js` + `renderNotifications` | notifications | bell dropdown, mark-all-read, deep links |
| Settings | `renderSettings` | settings (6 toggles) | change password modal, logout; toggles/language unwired in mock |

**Team Leader pages (permission-gated):** My Team (`renderTeam`: stats, needs-attention Mark Present/Remind/View, search) · Team Member Profile (`renderTeamMemberProfile`: profile, requests approve/reject/edit, evaluations edit, weekly schedule, follow-up modal) · Team Schedule (`renderTeamSchedule`: 12-month window, period strip, paint grid w/ drag, fill row/day/all, create custom period, publish, reset, delete) · Team Requests (`renderTeamRequests`: NEED ACTION / PENDING HR / APPROVED / REJECTED tabs, approve/reject/edit/review) · Team Performance (`renderTeamPerformance`: stats, evaluation CRUD with 5 criteria) · Team Actions (`renderTeamUpdates`: follow-up list + action modal → palette).

**Branch Manager pages:** Employees (`renderEmployees`: directory, today-shift badge, new/edit/status-change) · Attendance Management (`renderAttendanceManagement`: late/absent lists) · Shift Management (`renderShiftManagement`: template palette + grid, template CRUD + color picker, publish/save draft/copy previous/bulk assign) · Recruitment (`renderRecruitment`: vacancy requests list/create/detail) · Employee Leaving (`renderLeaving`: offboarding list + initiate) · Branch Actions palette (`openBranchActions`: deduction/warning/bonus → HR, review requests, correct attendance, request vacancy, publish schedule, change status, offboard, send report).

**Toast-only stubs in the mock (no data written):** profile edits, document upload, payslip download, request cancel, notifications mark-read, settings toggles, change password, follow-up saves, leaving form, report form, Shift Mgmt draft/copy/bulk. The API must make these real.

## 1. Decisions (locked with product owner)

1. **Team Leader = full BM capability parity, team-scoped.** TL preset = BM preset (same features/levels); scope is server-resolved: leader's `TeamLeaders` row in the active gym → team filter. Client never sends scope.
2. **Per-gym feature access.** HR grants feature access per gym (access in gym A does not apply in gym B). Active gym comes from the login/JWT.
3. **Multi-gym is unbounded** (3+). `AuthService.LoginAsync` already triggers selection at `>= 2` gyms; `UserGymAccess` is N:M. One account per employee (`User.EmployeeProfile` 1:1; `Employee.GymId` = primary gym; extra gyms via `UserGymAccess`).
4. **In-session gym switcher** added: `POST /api/auth/switch-gym`.
5. **Access model: feature × level × gym.** ~12 features (UI areas), 3 levels (`None=0, View=1, Edit=2`, Edit implies View), granted per gym via individual rows or a per-gym role bundle.

## 2. Authorization model (Slice 0)

**Schema changes (one migration):**
- `Permission` reused as the **feature catalog** (12 rows; `Key` = feature code, `Area` = module).
- `RolePermission.Level` (new) — role bundles are (feature → level) pairs.
- `UserPermission.Level` (new) — global grants (TopManagement / HR Manager profiles).
- **`UserGymRole`** (UserId, GymId, RoleId) — role assigned per gym.
- **`UserGymPermission`** (UserId, GymId, PermissionId, Level) — individual per-gym grant, overrides the role bundle.

**Effective level for (user, feature, activeGym):**
`Super Admin (*)` → Edit → per-gym individual grant (wins if row exists) → per-gym role bundle → global grant → None.

**Scope from the per-gym role:** BM bundle ⇒ gym scope; TL bundle ⇒ team scope; no role ⇒ own data only. Levels never widen scope.

**Seeded role bundles (12 features: employees, attendance, schedule, requests, payroll, evaluations, recruitment, offboarding, documents, reports, announcements, audit):**

| Feature | Employee | Team Leader = Branch Manager | HR | HR Manager |
|---|---|---|---|---|
| employees / attendance / schedule / requests / recruitment / offboarding | None | Edit | Edit | Edit |
| evaluations | View (own) | View | Edit | Edit |
| payroll / documents / reports / announcements / audit | None | None | View / Edit / View / Edit / View | Edit (all) |

evaluations stays View for TL/BM (stage-1 approval rides on `requests` Edit); payroll/documents/announcements/audit are HR-side. Super Admin = wildcard.

**API enforcement:** `[HasFeatureAccess("employees", AccessLevel.View|Edit)]` attribute + handler → `IPermissionService`; service layer re-checks permission + gym + team scope (ADR-003). `/api/me` returns `{ user, activeGym, gyms[], roleInActiveGym, featureLevels }`; `switch-gym` returns the same shape. SPA gates nav/buttons on `featureLevels`.

## 3. Endpoint surface (~90) — feature gates in brackets

### Slice 1 — Self-service (JWT = own data; no feature level)
`GET /api/dashboard/employee` · `GET/PUT /api/employees/{id}` + `.../contact`, `.../emergency-contact`, `.../photo` · `GET .../documents`, `.../required-documents`, `.../hr-documents`, `POST .../documents`, downloads · `GET /api/events?scope=employee` · `GET .../history` · `GET .../attendance?month=`, `GET .../leave-balance` · `GET .../schedule?month=`, `GET /api/request-types` · `GET .../payroll` + payslip PDF · `GET .../evaluations` · `GET .../requests`, `POST /api/requests`, `GET /api/requests/{id}`, `.../cancel`, `.../attachment` · notifications (list, unread-count, read, read-all) · `GET/PUT /api/me/settings`, `POST /api/auth/change-password`, `POST /api/auth/logout`.

### Slice 2 — Management (TL team-scope · BM gym-scope; reads = [feature:View], writes = [feature:Edit])
- employees: `GET /api/employees`, `GET/PUT /api/employees/{id}`, `POST /api/employees`, `POST .../{id}/status-change`
- attendance: `GET /api/attendance`, `POST /api/attendance/manual`
- schedule: `GET /api/gyms/{gymId}/shift-cycles`, `GET /api/shift-cycles/{id}`, `POST /api/gyms/{gymId}/shift-cycles`, `PUT /api/shift-cycles/{id}/assignments`, `POST .../publish`, `DELETE ...`; templates `GET/POST/PUT/DELETE /api/gyms/{gymId}/shift-templates`
- requests: `GET /api/requests`, `POST /api/requests/{id}/decide`, `PUT /api/requests/{id}`, `POST .../comments`
- team: `GET /api/teams/my-teams`, `GET /api/teams/{teamId}/today`, follow-ups (POST/GET/PUT), `POST /api/teams/members/{id}/reminders`, `POST /api/employees/{id}/messages`
- evaluations: `POST /api/evaluation-forms/{formId}/responses`, `PUT .../evaluations/{evalId}`, `GET /api/teams/{teamId}/evaluations`
- recruitment: `GET/POST /api/vacancy-requests`, `GET /api/vacancy-requests/{id}`
- offboarding: `GET /api/offboarding-requests`, `POST /api/employees/{id}/offboard`
- HR hand-off: `POST/GET /api/deduction-candidates`, `.../warning-notices`, `.../bonus-proposals`, `POST /api/branch-reports`

### Slice 3 — hand-off contracts
HR portal consumes `Pending HR` deduction/warning/bonus/vacancy decisions (documented in `api.md`; employee-portal side creates/lists only).

## 4. Execution order (vertical slices; keep solution compiling between slices)

1. **Docs first** (this file + tracker + spec ref? + ADR amends + roles guide).
2. **Slice 0 — foundation**: migration → catalog/bundle seed → `IPermissionService` / `ITeamScopeService` + `[HasFeatureAccess]` → `GET /api/me` + `POST /api/auth/switch-gym` → tests (per-gym matrix, override precedence, 3-gym login + switch, team-scope isolation).
3. **Slice 1 — self-service** (12 page areas) → tests incl. IDOR on `/api/employees/{id}` variants.
4. **Slice 2 — management** → tests: authorization matrix per feature, TL team-scope, BM gym-scope, request two-stage lifecycle, leave-balance workflow.
5. **Slice 3 — HR hand-off + reports.**
6. Per slice: `dotnet build`, `dotnet test`, Swagger; update `api.md` (implemented-only contract) + `progress.md` + tracker.

## 5. Verification ladder (per slice)

`dotnet build` (zero errors/new warnings) → `dotnet test` (unit/integration counts reported) → `ReviveHRSystem.Web.http` entries → Swagger → security spot-check (policies applied, IDOR matrix, no PII leaks) → tracker update.

Baseline before starting: **72 integration tests green** (`dotnet test` on Tests/ReviveHRSystem.IntegrationTests).
