# Employee Portal Implementation - Progress Tracker

> Companion to `docs/architecture/employee-portal-api-plan.md`. Update after EVERY completed step. "Stop point" = last verified state so work can resume cold.

## STOP POINT (resume here)

- **Last completed:** **ALL SLICES COMPLETE - 153/153 integration tests green**; solution builds clean; suite re-run twice for stability.
  - Slice 0: authorization foundation (per-gym feature x level grants, scope from per-gym role, `/api/me`, `switch-gym`).
  - Slice 1: all 12 self-service areas (profile, documents, attendance, leave balance, schedule, requests, notifications, settings/password, evaluations, history, events, payroll, dashboard).
  - Slice 2: management (employees, request inbox + stage-1, attendance, teams, vacancy requests, offboarding, shift cycles + templates).
  - Slice 3: Branch Actions queue - `POST /api/deduction-candidates`, `/api/warning-notices`, `/api/bonus-proposals`, `GET /api/branch-actions/pending-hr`, `POST /api/branch-reports` (lands in the HR queue as an `EventType.BranchReport` event). New tables `WarningNotices` / `BonusProposals`; `DeductionCandidate` extended (IssuedBy/IssuedAt/Note). `api.md` and `ReviveHRSystem.Web.http` document everything.
- **Remaining follow-ups (not blockers):** HR-portal decision endpoints for the Pending HR queue (deduction/warning/bonus/vacancy decisions) belong to the HR portal work; document/payslip binary download streams need a file-storage service; the mock UI needs re-gating from `hasPermission` to `/api/me` feature levels, and the Team Leader gets the branch nav pool (documented in the plan).
- **Build/test state:** `dotnet build` clean; `dotnet test` **153/153** (72 baseline + 81 new).
- **Blockers:** none. Note: an autonomous file-organizer in this environment periodically refactors/splits files; rebuild once after any surprise before re-editing.

---

## Step log

### 2026-10-10  Docs phase
- [x] `docs/architecture/employee-portal-api-plan.md` created (full plan v2).
- [x] This tracker created.
- [x] `docs/architecture/api-spec-from-ui.md` 3 refreshed against current mock (feature"level gates, toast-only stubs marked, TL/BM parity, multi-gym, slice mapping).
- [x] `docs/decisions/ADR-002-authentication.md` amended (N gyms, switch-gym, one-account).
- [x] `docs/decisions/ADR-003-authorization.md` amended (feature " level " gym model).
- [x] `Mock UI/Employee/Revive_HR_Employee_Roles_and_Permissions_Guide.md` updated (N gyms; TL = BM parity).

### 2026-10-10  Slice 0 (authorization foundation)  COMPLETE (87/87 tests)
- [x] Migration: `RolePermission.Level`, `UserPermission.Level`, `UserGymRole`, `UserGymPermission` (+ EF configurations). Migration `Add_FeatureLevelAuthorization`  additive only, safety-checked.
- [x] Seed: 12-feature permission catalog + 6 role bundles in `FeatureAccessSeeder` (wired into `DevelopmentDataSeeder`).
- [x] `IPermissionService` (effective levels, wildcard expansion) / `ITeamScopeService` (team scope per gym) + `TeamLeaderByUserAndGymSpec` + DI.
- [x] `[HasFeatureAccess]` attribute + `FeatureAccessHandler` + 24 policy registrations in Program.cs.
- [x] `GET /api/me` (identity, gyms, per-gym role, led team, feature levels).
- [x] `POST /api/auth/switch-gym` (validate UserGymAccess + gym active  token scoped to new gym).
- [x] Behavior change: single-gym users of any user type are auto-scoped at login (AuthService.IssueTokensAsync).
- [x] Tests: `MeControllerTests` (6), `SwitchGymTests` (4), `PermissionResolutionTests` (5  gym grant override, per-gym isolation, global grant, wildcard, team scope by role).
- [x] `api.md` updated for `/api/me` + `/api/auth/switch-gym` + gym-context section.

### Slice 1 (self-service  12 areas)
- [x] Domain/persistence gaps closed: `EmployeeDocument.UploadedAt`, `EmployeeRequest.SubmittedAt` (+ migrations), `RequestStatus.Cancelled`, `Event.CreatedAt` (+ migration `Add_EventCreatedAt`).
- [x] Profile: `GET /api/employees/{id}` (+ `employees.view` scoping, self-only salary), `PUT .../contact`, `PATCH .../emergency-contact`.
- [x] Documents: list, required checklist, upload (self-only).
- [x] Attendance: month view + summary; leave balance with reserve/release on Day Off create/cancel.
- [x] Schedule: published cycles for the employee's gym.
- [x] Requests: list/create/detail/cancel + `GET /api/request-types` catalog.
- [x] Notifications: list, unread-count, read, read-all.
- [x] Settings: `GET/PUT /api/me/settings`, `POST /api/auth/change-password`.
- [x] Evaluations (own, from EvaluationAnswer grouping), employment history (month-grouped, JSON values unwrapped), events feed (gym-scoped open Events + sent Announcements), payroll (open periods hidden), dashboard aggregate (team/gym overview strip).
- [x] `api.md` documents all Slice 1 endpoints.

### Slice 2 (management  TL team-scope / BM gym-scope)
- [x] Employees: directory (scoped), create (provisions the 1:1 login account), edit, status-change (+ history records). `EmployeeManagementTests` (7).
- [x] Requests inbox: scoped list, stage-1 decide (approve  PendingHRReview / reject  releases leave), edit. `RequestManagementTests` (6).
- [x] Attendance management: `GET /api/attendance` (team/gym, late/absent/no-show) + `POST /api/attendance/mark-attendance` (audited manual entry, ADR-004 validation).
- [x] Team today overview: `GET /api/teams/my-teams`, `GET /api/teams/{teamId}/today`.
- [x] Vacancy requests (gym-scoped list/create) + offboarding (scoped list/initiate, duplicate guard, history event).
- [x] Shift cycles + templates CRUD (create/assignments/publish/delete; off-day = null template). `ShiftManagementTests` (6).
- [ ] Branch Actions queue: deduction/warning/bonus candidates + branch reports.

### Slice 2 (management  TL team-scope / BM gym-scope)
- [ ] Employees (list/create/edit/status-change) + Attendance (+manual entry).
- [ ] Schedule: cycles (list/detail/create/assign/publish/delete) + shift templates CRUD.
- [ ] Requests inbox (decide stage "BranchManager"/edit/comment) + team today/follow-ups/reminders/messages.
- [ ] Team evaluations (create/edit/detail) + vacancy requests (list/create/detail) + offboarding (list/initiate).
- [ ] Branch Actions HR queue: deduction/warning/bonus candidates + branch reports.
- [ ] Tests: authorization matrix per feature (View/Edit/None), TL team-scope, BM gym-scope, two-stage request lifecycle.
- [ ] `api.md` updated.

### Slice 3 (hand-off + wrap-up) - COMPLETE
- [x] Deduction candidates (attendance Edit), warning notices + bonus proposals (employees Edit), all created Pending for HR.
- [x] Manager "Awaiting HR" queue (`GET /api/branch-actions/pending-hr`) merging all three kinds.
- [x] Branch reports (`POST /api/branch-reports`, any employee -> HR queue as a BranchReport event).
- [x] New tables `WarningNotices` / `BonusProposals` (migration `Add_BranchActionsProposals`), `DeductionCandidate` extended.
- [x] HR-side decision contracts documented in `api.md` (Pending HR consumption by the HR portal).
- [x] `ReviveHRSystem.Web.http` updated with named logins per role + the full request walkthrough.
- [x] Full verification ladder run; `progress.md` checkpoints written.

---

## Test count log

| Date | Unit | Integration | Notes |
|---|---|---|---|
| baseline | - | 72 | before any change (per docs/progress.md) |
| 2026-10-10 | - | 87 | Slice 0 complete: +15 (MeController 6, SwitchGym 4, PermissionResolution 5) |
| 2026-10-10 | - | 103 | Slice 1a-1e: +16 (EmployeeProfile 8, EmployeeSelfService 8) |
| 2026-10-10 | - | **109** | Slice 1f (notifications/settings/password): +6 |
| 2026-10-10 | - | **118** | Slice 1g (evaluations/history/events/payroll/dashboard): +9 |
| 2026-10-10 | - | **131** | Slice 2 part 1-2 (employee management + request inbox): +13 |
| 2026-10-10 | - | **138** | Slice 2 part 3 (attendance mgmt, team overview, vacancy, offboarding): +7 |
| 2026-10-10 | - | **144** | Slice 2 part 4 (shift cycles + templates): +6 |
| 2026-10-10 | - | **153** | Slice 3 (Branch Actions: deduction/warning/bonus/reports): +9 |

## Non-blocking decisions taken

- Feature catalog reuses the `Permission` table (Key = feature code) rather than a new `Feature` entity, to avoid a parallel catalog.
- `UserPermission` kept for global grants (TopManagement/HR Manager); employee-type grants are per-gym.
- Team scope resolves from the per-gym role (TL bundle  team); individual grants never widen scope.
- AccessToken keeps only `uid`/`gymId` claims; feature levels are served per active gym by `/api/me` and on `switch-gym` (SPA caches per gym).
- Cross-scope employee reads/writes answer 404 (not 403) so the API never confirms another gym's data exists.
- Domain gaps fixed while implementing: `EmployeeDocument.UploadedAt`, `EmployeeRequest.SubmittedAt`, `Event.CreatedAt` (all migrated), `RequestStatus.Cancelled` (int-stored, no migration).
- Self-service write endpoints validate the route id equals the caller's own employee (self-only writes); managers editing others is Slice 2.
- Upload/download are metadata + path contracts for now (no binary storage service yet)  download streams are deferred to the storage service when file storage is chosen.
- The running dev server on :5248 was stopped at the start of the session (build locks) with the user's approval.
- **Domain constraint discovered (affects future work):** `Employee.TeamId` has a composite FK to the team's gym, and `TeamLeaders.EmployeeId` has a unique index. Consequences: teams contain only employees anchored to the team's gym, and an employee leads at most one team. So a multi-gym user's team scope applies only in his primary gym; per-gym team membership would require a schema change (employeeteam join table)  raise with the product owner before attempting.
- Employee creation provisions the 1:1 login account with a random temporary password (never stored/returned); a credential-delivery flow belongs to the account lifecycle (later phase).
- Evaluation score = mean of numeric answers (answers are JSONB); criteria come from the form's questions.
- Mock recruitment fields `count`, `urgency`, `department` have no domain home (VacancyRequest ties to a gym Position)  the API contract follows the domain; note for the UI mapping when that page is built.
