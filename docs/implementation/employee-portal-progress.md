# Employee Portal Implementation - Progress Tracker

> Companion to `docs/architecture/employee-portal-api-plan.md`. Update after EVERY completed step. "Stop point" = last verified state so work can resume cold.

## STOP POINT (resume here)

- **Last completed:** **Employee request types — final 9-type catalog implemented** (product owner supplied the definitive list; unblocks Open Item #1 in the HR spec). All rules enforced server-side and covered by `RequestRulesTests` (27 tests). Solution builds clean; **238/238** integration tests green (211 baseline + 27 new), suite re-run twice for stability.
  - **Catalog** (`RequestTypeCatalog` + `GET /api/request-types` with rule flags): annual-leave, sick-leave, late-attendance, early-leave, shift-swap, weekly-off-swap, check-in-correction, salary-advance, paid-holiday. Resolution accepts id or label; unknown types are refused (400) at creation and at manager edit.
  - **Annual / Sick leave** draw from `LeaveBalance` (default entitlements 21 / 10, emergency 6) — submission refuses to exceed the remaining balance and reserves pending days; cancel and a stage-1 rejection release them through the shared `LeaveBalanceReservation` helper (also used by `RequestManagementService`, which previously hardcoded "Day Off").
  - **Sick leave** requires the medical certificate with the request: `POST /api/employees/{id}/requests` is now multipart (form fields + optional `attachment` file, stored through `IFileStorage` under the new `request-attachments` category). `GET /api/requests/{id}/attachment` streams it back (self, or employee-scoped access; 404 cross-scope).
  - **Late Attendance / Early Leave** (no submission window): excused hours are derived from the employee's *published* schedule (late = arrival − shift start; early = shift end − departure, midnight-crossing shifts handled) and stored on `EmployeeRequest.RequestedHours`. They share one monthly budget per gym: `Gym.ExcusedLateHoursCapPerMonth` (HR-set, static for all employees, default 4) — pending and approved requests both hold their hours, so several small requests cannot outrun the cap. `GET /api/employees/{id}/excused-hours` exposes { capHours, usedHours, remainingHours, month } for the form.
  - **Swaps** name a colleague (active, same gym, not the requester); **weekly off swap** also takes the target off day. **Check-in correction** takes the corrected time. **Salary advance** takes a positive amount (`RequestedAmount`, no automatic limit — approval is the gate). **Paid holiday** requests working a paid holiday (e.g. Eid) for double day pay; payroll effect rides on HR approval (HR portal).
  - **New endpoints:** `GET /api/employees/{id}/excused-hours`, `GET /api/requests/{id}/attachment`, `GET/PUT /api/gyms/{gymId}/attendance-policy` (HR sets the cap; attendance View/Edit; route gym must match the token's active gym).
  - **Migration** `Add_EmployeeRequestRules` — additive only: `EmployeeRequests.RequestedHours/RequestedAmount` (nullable), `Gyms.ExcusedLateHoursCapPerMonth` (default 4).
  - EmployeeRequestDto gained targetDate/hours/amount/swapWith*/hasAttachment; `RequestDate` now maps from the RequestDate column (weekly-off-swap distinguishes the given-up day from the taken day).
- **Remaining follow-ups (not blockers):** HR-portal decision endpoints for the Pending HR queue (deduction/warning/bonus/vacancy decisions) still land the final approval that consumes reserved leave days into `UsedDays` — the mapping is ready via `LeaveBalanceReservation`; `GET /api/employees/{id}/payroll/{periodId}/payslip` still needs a PDF generator; `POST /api/employees/{id}/documents` still records metadata only; mock UI re-gating from `hasPermission` to `/api/me` feature levels.
- **Build/test state:** `dotnet build` clean; `dotnet test` **238/238** (211 baseline + 27 new).
- **Blockers:** none.
- **Last completed:** **Employee API completion plan — Slices A, B, C, D, E, F implemented: 211/211 integration tests green**; solution builds clean (10 pre-existing warnings, none introduced); suite re-run twice for stability.
  - **Slice A — Pagination foundation.** `PaginationResult<T>` reshaped to the documented `{ items, page, pageSize, totalCount, totalPages }` envelope (was dead code with a conflicting shape); new `PaginationParams` base + `EmployeeQueryParams`, `RequestQueryParams`, `AttendanceQueryParams`, `NotificationQueryParams`, `VacancyQueryParams`, `OffboardingQueryParams` in `Shared/DataTransferObject/QueryParams`. Six list endpoints paged (employees, requests, attendance, notifications, vacancy-requests, offboarding-requests) plus the new teams/{id}/evaluations. `EmployeeQueryParams.SortBy` added so paging is stable.
  - **Slice B — Team Actions.** `TeamFollowUp` + `FollowUpActionType` / `FollowUpSeverity`, `TeamMessage` entities; migration `Add_TeamActions` (2 tables, additive). `ITeamActionsService` / `TeamActionsService`; 5 endpoints (follow-ups list/create, follow-up update, reminders, messages). `TeamActionsTests`.
  - **Slice C — Evaluation authoring.** `IEvaluationManagementService` / `EvaluationManagementService`; forms list, create, update, team evaluations. Reuses `EvaluationResponse`/`EvaluationAnswer`. `EvaluationResponse.OverallComment` added (migration `Add_EvaluationOverallComment`, additive). `EvaluationManagementTests`.
  - **Slice D — Contract completion.** `RequestDecisionDto.Stage` (defaults to BranchManager, refuses "HR" so a stage-1 caller cannot forge an HR approval), `RequestComment` entity + migration `Add_RequestComments` (additive), `POST /api/requests/{id}/comments`, `GET /api/vacancy-requests/{id}`, `GET /api/teams/{teamId}/unscheduled-count`, new attendance filters (range/employeeId/status).
  - **Slice F — Logout.** `POST /api/auth/logout` writing an `AuditLog` entry; idempotent 204.
  - **Slice E — Documents, avatar, downloads.** `IFileStorage` abstraction in ServiceAbstraction + `LocalFileStorage` in the new `Infrastructure/Storage` project (root/size from the `Storage` config section); shared `FileContentTypes` extension→media-type map so a file's stored type and its served type can never disagree. Additive migration `Add_EmployeePhotoAndDocumentSource` (`Employees.PhotoPath`, `EmployeeDocuments.SizeBytes`/`ContentType`/`Source`). New enum `DocumentSource { Employee, Hr }` (default 0 keeps pre-existing rows correctly in the employee vault). New endpoints: `GET`/`PUT /api/employees/{id}/photo` (PUT multipart, self-only), `GET /api/employees/{id}/hr-documents`, `GET /api/employees/{id}/documents/{docId}/download`, `GET /api/employees/{id}/hr-documents/{docId}/download`. `EmployeeProfileDto.PhotoUrl` added. `DocumentStorageTests` (12), including path-traversal and supersede/reap regression tests.
  - **Security pass (subagent review) — all findings fixed and regression-tested:** attendance date range capped at 92 days; Team Actions + evaluation edit now bind the token's active gym instead of the target's (cross-gym 404); `Skip` computed in long and saturated so an extreme pageNumber yields an empty page instead of a 500; `Enum.IsDefined` guards on all parsed enums; length checks on every user-supplied text vs its column max; evaluation scores bounded 0-5; the evaluation route's `employeeId` validated against the evaluation's own employee; `OverallComment` now actually stored and returned.
- **Latent bugs fixed along the way (worth remembering):** three services used `Task.WhenAll` to run queries concurrently on one scoped `DbContext` (`EmployeeProfileService.GetProfileAsync`, `EmployeeAccessService.EnsureCanAccessAsync`, `AttendanceService.GetStationSummaryAsync`). They passed while the model was small and started throwing `InvalidOperationException` as soon as the model grew. All three are now sequential. **Do not reintroduce parallel queries on a shared scoped context.**
- **Remaining follow-ups (not blockers):**
  - **Downloads still missing two streams:** `GET /api/employees/{id}/payroll/{periodId}/payslip` (needs a PDF generator — none in the solution) and `GET /api/requests/{id}/attachment`. Both ride on the now-existing `IFileStorage` + `FileDownload` plumbing, so they are additive work only.
  - **`POST /api/employees/{id}/documents` still records metadata only** (JSON body, no bytes), so rows created through it report `canDownload: false` and their download route answers 404. The spec (§3.4) wants multipart here; converting it means changing a working endpoint's contract and its tests. `PUT /photo` shows the multipart shape to copy.
  - `GET /api/employees/{id}/documents` still returns a bare array while spec §3.1 shows a paged envelope — deliberately left (Slice A scoped six other endpoints); revisit with the mock UI's paging.
  - HR-portal decision endpoints for the Pending HR queue (deduction/warning/bonus/vacancy decisions).
  - Mock UI re-gating from `hasPermission` to `/api/me` feature levels, and the Team Leader branch nav pool.
  - **Authorization-model decision on record:** TL/BM hold `evaluations` at *View*, so evaluation authoring is HR-only (or per-gym granted). The seeder was left unchanged — do not flip it without a product decision.
  - Team Actions currently requires the caller to belong to/lead a team (no gym-wide fallback), despite the class doc's wording. It fails closed, so this is a functional gap for team-less BMs, not a security one.
- **Build/test state:** `dotnet build` clean; `dotnet test` **211/211** (153 baseline + 58 new).
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
- [x] Branch Actions queue: deduction/warning/bonus candidates + branch reports — **delivered in Slice 3 below** (the same items are re-listed there with their tables and endpoints).

### Slice 3 (hand-off + wrap-up) - COMPLETE
- [x] Deduction candidates (attendance Edit), warning notices + bonus proposals (employees Edit), all created Pending for HR.
- [x] Manager "Awaiting HR" queue (`GET /api/branch-actions/pending-hr`) merging all three kinds.
- [x] Branch reports (`POST /api/branch-reports`, any employee -> HR queue as a BranchReport event).
- [x] New tables `WarningNotices` / `BonusProposals` (migration `Add_BranchActionsProposals`), `DeductionCandidate` extended.
- [x] HR-side decision contracts documented in `api.md` (Pending HR consumption by the HR portal).
- [x] `ReviveHRSystem.Web.http` updated with named logins per role + the full request walkthrough.
- [x] Full verification ladder run; `progress.md` checkpoints written.

---

### 2026-10-11/12  Employee API completion plan (Slices A-F)  COMPLETE (211/211 tests)

Plan: `C:\Users\eyous\.opencode\plan\employee-api-completion-plan.md` (decisions D1-D5).

- [x] **Slice A — Pagination.** `PaginationResult<T>` reshaped to `{ items, page, pageSize, totalCount, totalPages }`; `PaginationParams` base + 6 query-param classes; six list endpoints paged with filters; `PaginationTests` (10).
- [x] **Slice B — Team Actions.** `TeamFollowUp`, `TeamMessage`, `FollowUpActionType`/`FollowUpSeverity`; migration `Add_TeamActions`; 5 endpoints; `TeamActionsTests` (8).
- [x] **Slice C — Evaluation authoring.** `EvaluationManagementService` (in `EvaluationsHistoryPayrollServices.cs`) + `EvaluationManagementController`; `EvaluationResponse.OverallComment`; migration `Add_EvaluationOverallComment`; `EvaluationManagementTests` (8).
- [x] **Slice D — Contract completion.** `RequestDecisionDto.Stage` (refuses "HR"), `RequestComment` + migration `Add_RequestComments`, request comments/vacancy detail/unscheduled-count endpoints, attendance range filters; `RequestManagementTests` additions.
- [x] **Slice E — Documents, avatar, downloads.** `IFileStorage` + `LocalFileStorage` (new `Infrastructure/Storage` project), `FileContentTypes`, `DocumentSource` enum, migration `Add_EmployeePhotoAndDocumentSource`; photo GET/PUT, hr-documents, two download streams; `DocumentStorageTests` (12).
- [x] **Slice F — Logout.** `POST /api/auth/logout` writing an `AuditLog` entry; `AuthControllerTests` additions.
- [x] **Security pass** (independent review, all findings fixed + regression-tested): 92-day attendance range cap; token-gym binding on Team Actions and evaluation edit (cross-gym 404); saturating `Skip`; `Enum.IsDefined` guards; column-max length checks; evaluation scores bounded 0-5; route `employeeId` vs evaluation employee; `OverallComment` stored; stage forging refused. Also three latent `Task.WhenAll`-on-one-`DbContext` bugs converted to sequential awaits.
- [x] `api.md`, this tracker and `ReviveHRSystem.Web.http` updated per slice.

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
| 2026-10-11 | - | **163** | Completion plan Slice A (pagination): +10 |
| 2026-10-11 | - | **171** | Slice B (team actions): +8 |
| 2026-10-11 | - | **179** | Slice C (evaluation authoring): +8 |
| 2026-10-11 | - | **191** | Slice D (contract completion) + Slice F (logout) + security regressions: +12 |
| 2026-10-12 | - | **199** | Security pass findings fixed + regression tests: +8 |
| 2026-10-12 | - | **211** | Slice E (avatar, hr-documents, downloads, traversal, size cap): +12 |
| 2026-10-14 | - | **238** | Request types: final 9-type catalog + rules (balances, certificate, excused-hours budget, HR attendance policy): +27 |

## Non-blocking decisions taken

- Feature catalog reuses the `Permission` table (Key = feature code) rather than a new `Feature` entity, to avoid a parallel catalog.
- `UserPermission` kept for global grants (TopManagement/HR Manager); employee-type grants are per-gym.
- Team scope resolves from the per-gym role (TL bundle  team); individual grants never widen scope.
- AccessToken keeps only `uid`/`gymId` claims; feature levels are served per active gym by `/api/me` and on `switch-gym` (SPA caches per gym).
- Cross-scope employee reads/writes answer 404 (not 403) so the API never confirms another gym's data exists.
- Domain gaps fixed while implementing: `EmployeeDocument.UploadedAt`, `EmployeeRequest.SubmittedAt`, `Event.CreatedAt` (all migrated), `RequestStatus.Cancelled` (int-stored, no migration).
- Self-service write endpoints validate the route id equals the caller's own employee (self-only writes); managers editing others is Slice 2.
- Upload/download started life as metadata + path contracts; **Slice E closed that gap** — `IFileStorage` + `LocalFileStorage` now store real bytes under `App_Data/storage/` (git-ignored), and the two document download streams read them back. `POST /api/employees/{id}/documents` still records metadata only (see follow-ups); payslip and request-attachment streams are the two remaining consumers of the same plumbing.
- The running dev server on :5248 was stopped at the start of the session (build locks) with the user's approval.
- **Domain constraint discovered (affects future work):** `Employee.TeamId` has a composite FK to the team's gym, and `TeamLeaders.EmployeeId` has a unique index. Consequences: teams contain only employees anchored to the team's gym, and an employee leads at most one team. So a multi-gym user's team scope applies only in his primary gym; per-gym team membership would require a schema change (employeeteam join table)  raise with the product owner before attempting.
- Employee creation provisions the 1:1 login account with a random temporary password (never stored/returned); a credential-delivery flow belongs to the account lifecycle (later phase).
- Evaluation score = mean of numeric answers (answers are JSONB); criteria come from the form's questions.
- Mock recruitment fields `count`, `urgency`, `department` have no domain home (VacancyRequest ties to a gym Position)  the API contract follows the domain; note for the UI mapping when that page is built.
