<<<<<<< HEAD
## 2026-10-10 (employee portal, continued 3) - All slices complete

- **Branch Actions queue (Slice 3):** `POST /api/deduction-candidates` (attendance Edit), `/api/warning-notices` and `/api/bonus-proposals` (employees Edit) - all created Pending for HR; `GET /api/branch-actions/pending-hr` merges the three kinds into the manager's queue; `POST /api/branch-reports` (any employee) lands in the HR action queue as an `EventType.BranchReport` event. New tables `WarningNotices` / `BonusProposals`; `DeductionCandidate` extended with IssuedBy/IssuedAt/Note.
- **Docs/hand-off:** `api.md` documents every employee-portal endpoint; `ReviveHRSystem.Web.http` now has named logins per role (Employee / Branch Manager / Team Leader / HR) plus a full request walkthrough; plan + tracker mark all slices complete.
- **Verification:** build clean (0 warnings), **153/153 integration tests**, live smoke test in Development (login + select-gym + `/api/me` feature levels + deduction + queue + report).
- **Deferred (documented):** HR-portal decision endpoints for the Pending HR queue (deduction/warning/bonus/vacancy) belong to the HR portal work; document/payslip binary downloads need a file-storage service; the mock UI still needs re-gating from `hasPermission` to `/api/me` levels and the Team Leader branch nav pool.

## 2026-10-10 (employee portal, continued 2) - Management surface complete

- **Attendance management** (`GET /api/attendance` day view with late/absent/no-show split, `POST /api/attendance/mark-attendance` audited manual entry reusing the ADR-004 validation).
- **Team overview** (`GET /api/teams/my-teams`, `GET /api/teams/{teamId}/today`: members, shifts, live status, pending requests).
- **Vacancy requests** (gym-scoped list + create; the mock's count/urgency/department fields have no domain home, so the contract follows VacancyRequest) and **offboarding** (scoped list + initiate, duplicate-case guard, Offboard history event).
- **Shift management**: gym cycles (create/read/assignment upserts/publish/delete) and shift templates CRUD; publishing is what makes a cycle visible to employees through the Slice 1 schedule endpoint; template deletion turns its cells into Off days.
- Tests: **144 passing** (was 138): attendance day view, team scope isolation, vacancy gym isolation, offboarding duplicate/cross-gym, cycle publish visibility, template CRUD + cleanup, 403 matrix.

## 2026-10-10 (employee portal, continued) - Self-service surface complete + management start

- **Slice 1 finished** (all 12 self-service areas): evaluations (own), employment history (month-grouped), events feed (gym-scoped), payroll (open periods hidden), and the `GET /api/dashboard/employee` aggregate (today shift/attendance, upcoming schedule, pending requests, latest payroll, recent notifications, required actions, team/gym overview strip scoped by role). New: `Event.CreatedAt` (migration `Add_EventCreatedAt`).
- **Slice 2 started** with the feature gates now exercised by real endpoints: employee management (`GET/POST /api/employees`, `PUT /api/employees/{id}`, `POST .../{id}/status-change` â€” status changes append to the history timeline) and the request inbox (`GET /api/requests`, `POST .../{id}/decide` stage-1 approveâ†’PendingHRReview / rejectâ†’releases leave, `PUT .../{id}`). Employee creation provisions the 1:1 login account (the domain requires the Userâ†”Employee link) with a random temporary password.
- **Domain constraints discovered while testing:** `Employee.TeamId` is FK-anchored to the team's gym (teams cannot span gyms) and `TeamLeaders.EmployeeId` is unique (one team per leader) â€” team scope therefore applies only in a user's primary gym; per-gym team membership needs a schema change.
- Tests: **131 passing** (was 72): +9 Slice 1g, +13 Slice 2 (authorization matrix 403, cross-team/cross-gym 404, leave release on rejection, timeline history records).

## 2026-10-10 (employee portal) - Authorization model + employee self-service APIs

- **Docs first:** `docs/architecture/employee-portal-api-plan.md` (full plan), `docs/implementation/employee-portal-progress.md` (step tracker), `api-spec-from-ui.md` Â§3 refreshed to the current mock (feature gates, stub markings, TL/BM parity, multi-gym), ADR-002 Amendment 1 (N gyms, in-session switch, one account), ADR-003 Amendment 1 (per-gym feature Ã— level grants, scope from per-gym role), roles guide updated.
- **Authorization foundation (Slice 0):** migration `Add_FeatureLevelAuthorization` (Level columns on RolePermission/UserPermission, new UserGymRoles/UserGymPermissions tables), 12-feature permission catalog + 6 preset role bundles seeded (TL = BM parity), `IPermissionService`/`ITeamScopeService`, `[HasFeatureAccess]` policies, `GET /api/me` and `POST /api/auth/switch-gym`. Single-gym users of any user type now get a gym-scoped token at login. Fixed during the slice: handler registered scoped (was singleton; would have crashed the Development host).
- **Self-service APIs (Slice 1, partial):** employee profile + contact/emergency edits, documents (+ `UploadedAt`), attendance month view, leave balance with reserve/release on Day Off create/cancel (+ `RequestStatus.Cancelled`, `EmployeeRequest.SubmittedAt`), published schedule, requests (list/create/detail/cancel) + request-type catalog, notifications, settings + change-password. `api.md` documents every new endpoint.
- Tests: **109 passing** (was 72) - authorization matrix, per-gym isolation, override precedence, team scope, IDOR (cross-team/cross-gym 404), leave-balance workflow, switch-gym lifecycle.
- **Next (tracker has the exact stop point):** evaluations/history/events/payroll/dashboard for Slice 1, then Slice 2 management endpoints (TL team-scope / BM gym-scope) and Slice 3 HR hand-off contracts.
## 2026-10-15 - Events queue, separations & escalated requests (api-spec-from-ui.md §5.6 + §9.4)

- **Final batch of Section 5**: the events/separations queue (§5.6) and the Events page's Escalated tab (§9.4) end-to-end — backend only, the frontend comes later. §5.1–§5.9 are now fully implemented.
- **Sync-on-read events queue**: `GET /api/events` derives the org-wide set (documents & contracts expiring within 45 days, requests pending HR review, resignation/termination cases, transfer tickets, open vacancy requests, unpublished payroll periods) and upserts `Events` rows keyed by a unique `(Type, EntityType, EntityId)` index — insert/refresh/prune on every read, then gym-scope + per-type permission filter in memory, due-date ASC, paginate, and batch payloads for the page only. Envelope carries the mock's tab `counts` plus a `hidden` counter (in-scope but not permitted). Urgency ≤7d high / ≤14d medium / else low; resignations always high; vacancies age-based (≥14d high, ≥7d medium). `GET /api/events/counts` backs the tab badges; resolve/reopen/renewal-request/decide round out the page — renewal is documents-only (Notification + "Document Renewal Requested" audit), decide is transfer-tickets-only and executes/records against the underlying `ActionRequest`.
- **Separations pipeline**: one shared case core — E19 (`POST /api/employees/{id}/offboard`, 201, `Notice Period`, employee parked in Notice Period) and T2 (`POST /api/separations`, `Requested`, closed termination-reason vocabulary) both create an `OffboardingCase` with the five-task exit checklist (one open case per employee). T3 checklist toggle (first tick → Exit In Progress), T4 stage moves (Completed auto-ticks), T5 verdict (Under Review), T6 finalize. Reads need `employees.view`, every mutation `employees.offboard`.
- **Escalated action requests**: `GET /api/action-requests` is OR-gated (`events.view` or any ACTION_TYPES meta key) and filtered per held action type + gym; approve executes the proposed effect (gym move / compensation / role assign / offboard case / import audit) and marks the row **Approved** — a deliberate fix of the mock, which leaves it pending after a successful approval; reject requires a comment and audits `{Label} Request Rejected`. No create endpoint (E20 out of scope — tests seed via TestDataBuilder).
- **Documented deviations**: finalize sets the employee **Terminated** (mock: Suspended) and deactivates the login; `requestedBy` is the caller's role label (mock hard-codes "Branch Manager"); reason/notes stored separately (mock concatenates); BulkImport approve is audit-only for label-like sources; destination-gym access on transfer approve is enforced by the transfer action itself (ADR-003).
- **Model/infra**: `OffboardingCase` verdict columns (finalReason, notes, settlement direction/amount/note, rehire status/note, completedAt) + unique `Events` index, migration `AddSeparationVerdictFields`; `EventsService`/`SeparationsService`/`ActionRequestService` + specs, three controllers, DI in Program.cs; `PayrollService` gross/net/period helpers and `EmployeeService.NewHistory`/`StatusDisplay` made internal for reuse.
- **Gotchas hit**: PostgreSQL `timestamptz` rejects `DateTimeKind=Unspecified` — `DateOnly.ToDateTime` results are now wrapped `DateTime.SpecifyKind(…, Utc)` before persistence (500s "An error occurred while saving the entity changes" otherwise); and the integration-test `Db` resolves through the root provider shared with TestDataBuilder, so assertions on API-written rows must use `.AsNoTracking()` or they read stale tracked values.
- **Tests**: 48 new integration tests (`EventsControllerTests`, `SeparationsControllerTests`, `ActionRequestControllerTests`) covering derivation payloads/windows/urgency, type+gym+urgency filters and the hidden count, resolve/reopen/renewal/decide round-trips with audits, the whole T1–T6 + E19 lifecycle incl. every gate and the finalize effects (Terminated + login cut + history + audit), and the action-request read gate, per-type visibility, all five approve effects, and the reject contract. Full suite 401/401 green (Release).

## 2026-10-15 - Public hiring forms & applicant pipeline (api-spec-from-ui.md §5.2)

- **Fifth batch of Section 5**: the anonymous careers experience end-to-end — the public form catalogue/detail, form submission, the HR applicant pane, and the Add-to-Pipeline conversion. The events/separations queue (§5.6) remains.
- **Dual-mode hiring-forms GETs**: `GET /api/hiring-forms` and the new `GET /api/hiring-forms/{id}` are `[AllowAnonymous]` — a Bearer token keeps the §5.3 admin behaviour (`evaluations.view`, gym scope), no token returns **Open** forms only (the status query is forced to Open, gym matched by branch name or id, unknown gym = empty list, closed/unknown id → 404). The service branches on `actorUserId == null` and never touches the actor resolver anonymously (`GetActorUserId()` throws unauthenticated).
- **Public submission**: `POST /api/applications` (`[AllowAnonymous]` + new `public-forms` per-IP fixed-window policy — `RateLimiting:PublicFormPermits`, default 30/min, raised in Testing) validates form exists + Open, name, email contains "@", and the §5.1.3 blocked-email gate; answers are JSON-encoded camelCase, careers extras go to `careersJson` (typed `Position` column added), `form.lastUsed` is stamped, and the response is 201 `{ message: "Application submitted." }`. Careers `gymPref` wins over the simple form's `gym`.
- **Applicant pane**: `GET /api/applications` (filters `formId`/`status`/`searchTerm` — status is an exact match so unknown values list nothing), `GET /api/applications/{id}` (full answers + reject comment), `PUT /api/applications/{id}/reject` — all `recruitment.candidates.manage`, gym-scoped by the **typed preferred-branch name** (rows without a branch are org-wide); reject on a converted row → 400.
- **Conversion**: `POST /api/candidates { applicationId }` creates the Candidate + a **vacancy-less pipeline Application** (`VacancyId = null`, `PositionTitle` = typed ?? form position, `Source` = careers `source` ?? "Hiring Form — {form name}" em dash, defaults expYears 0 / education "" / languages [] / shift "Any" / salaryExp 0 / availability "Immediate", preferred branch carried), flips the row to `Moved to Pipeline`, and returns 201 `{ data: <candidate card, rating coerced to 0>, applicationStatus }`; the card lists like any other candidate. Double-convert → 400; the same gate blocks a later reject.
- **Model/infra**: `HiringFormApplication.Position`/`CareersJson`, `Application.VacancyId` → nullable + `PositionTitle`, migration `AddPublicHiringFormApplications`; the pipeline/waiting/stale/interview specs each gained a `gymNames` scope so vacancy-less applications match on preferred-branch name (position/search filters also check `PositionTitle`); hire and gym-permission gates resolve `Vacancy?.GymId ?? preferred branch` (unknown branch = org-wide); new `"public-forms"` rate-limiter policy in Program.cs.
- **Tests**: 14 new integration tests (`HiringFormApplicationsControllerTests`) covering the public catalogue/detail Open-only + gym/position filters, submission record + lastUsed + answer echo, every validation + the blocked gate, admin status/search/paging filters, permission and cross-branch IDOR gates, the reject lifecycle, and both conversions (careers echo + spec defaults + double-convert 400 + pipeline visibility). Full suite 353/353 green (Release).

## 2026-10-15 - Evaluations & form builder (api-spec-from-ui.md §5.3–§5.4)

- **Fourth batch of Section 5**: the form builder and evaluations page end-to-end on the Batch A entities (EvaluationForm/Question/Response/Answer/Assignment, Goal, PerformanceCycle — no schema change needed). Public hiring forms (§5.2) and the events queue (§5.6) remain.
- **Form builder (§5.3)**: two resources instead of the spec's speculative `kind=` union — evaluation templates (`/api/evaluation-forms`, question **rows**, dispatchable) and hiring forms (`/api/hiring-forms`, question **JSON**, published by §5.2), each with full CRUD. All ids are plain integers (the mock's `ef-…`/`hf-…` prefixes dropped); question type map text→Rating5 / choose→MultipleChoice / checkbox→Checkbox with ≥ 1 question and ≥ 2 options for choices; form status `Active | Completed | Inactive` stays synced to `IsActive`, hiring status `Open | Closed`. Update replaces the whole question list; delete is blocked with 400 once responses (evaluation) / applications (hiring) exist — deliberate documented deviation from the mock's silent delete because both FKs are required. Gym-less forms ("All") are visible under every scope.
- **Dispatch (§5.4)**: `POST /api/evaluation-forms/{id}/dispatch` fans an Active form out to every eligible evaluator (active user holding any of `evaluations.manage | .manage.team | .view.team | team.manage`, plus TopManagement; the caller excluded) with subjects = Active employees in the evaluator's gym scope matching the form's gym/position, excluding the evaluator themself. Rows are keyed (form, subject, evaluator) with a filtered unique index — re-dispatch is idempotent, returns 0 new, and a `Evaluation Dispatched` audit row lands in §5.9 when anything was created. `createdAssignments[]` groups use the lowest row id, the same id the inbox later shows.
- **Inbox**: `GET /api/evaluation-assignments` is OR-permission (any of the four keys) and grouped per form — subjects[], completedSubjects[], card status Assigned | Completed, dispatchedBy/evaluatorEmail — filterable by formId and card status.
- **Submissions**: `POST /api/evaluation-forms/{id}/responses` accepts `evaluations.manage` **or** any assignment holder for the form (keyless evaluators can submit their own reviews); subject resolves by unique active name or id (ambiguous/unknown → 400, out-of-scope gym → 401), score 0–100, free-run defaults notes to the standard scoring line, answers match the form's questions by text and echo back. With `assignmentId` the caller's row flips to `Completed` and returns the assignment echo — the card completes when all rows are Completed.
- **Launch cycle + reads**: `POST …/launch-cycle` seeds `In Progress` rows (no score) for all eligible subjects, skipping anyone already In Progress/Completed for the same (form, period) — relaunch returns `startedCount: 0` and the same `batchId`, which is the found-or-created `PerformanceCycle` chip named after the period. History reads (`GET /api/evaluation-responses`, the per-form convenience list, `GET /api/employees/{id}/evaluations` with derived `result` Pass ≥ 60 / Below Target < 60 / Pending) batch-load answers; goals CRUD + performance-cycle chips complete the History & Trends tab.
- **Gotchas hit**: `EvaluationAnswers.AnswerValueJson` is PostgreSQL `jsonb` — raw answer text 500s with "invalid input syntax for type jsonb", so answers are `JsonSerializer.Serialize`d on write and unwrapped on read; and the dispatch counters can't be asserted exactly across suites because `AccessControlServiceTests` seeds an extra TopManagement user (scope-unrestricted → eligible evaluator), so the test pins our evaluator's card instead.
- **Tests**: 24 new integration tests (`EvaluationControllerTests`) covering both CRUDs incl. every validation/delete gate, dispatch idempotency + audit + edge cases, inbox filters, all three submission modes (free-run, assigned flip, keyless holder) plus error paths, launch-cycle seeding/idempotency/chip, history filters + paging, the profile tab's result derivation, and goals. Full suite 339/339 green (Release).

## 2026-10-15 - Payroll page (api-spec-from-ui.md §5.5)

- **Third batch of Section 5**: the payroll module end-to-end on top of the existing `PayrollPeriod`/`PayrollEntry`/`PayrollEntryLineItem` entities (no schema change needed — Batch A had already added `PaidDate`, `Status`/`ReviewedAt` on entries, and line statuses/review stamps). Notifications/My Access/support screens (§5.7–§5.9) landed earlier today; evaluations/form builder (§5.3–§5.4), public hiring forms (§5.2), and the events queue (§5.6) remain.
- **Periods + settlement sheet (§5.5)**: `GET /api/payroll-periods` (derived UI statuses Open | Partially Published | Published | Paid from the Open→Locked lifecycle + `PaidDate`, with per-period totals) and `GET /api/payroll-periods/{id}` (entry sheets with initials/position/employment status, related request ids, and deduction lines with `attendanceRef` = `ATT-{recordId}` / `ATT-MANUAL`). Money is recomputed on every read/write: gross = base + bonus + OT pay ((base/176)×1.5×hours), deductions = Accepted|Approved lines only, net = gross − deductions.
- **Settlement actions**: bonus edit (`PUT …/entries/{employeeId}` — the only editable field), inline Add-Line (`POST …/deductions` → a `Pending` line that does not touch the approved total), close (refused while lines are pending) and reopen — all `payroll.edit`, all 400 on a locked period.
- **Publish & lock**: `POST /api/payroll-periods/{id}/approve` (`payroll.approve`) verifies the branch and that every sheet is `Reviewed`, then locks the period + entries, stamps approver, and writes a `Payroll Published` audit row (visible in §5.9's audit log); wrong branch / already published / unsettled sheets → 400.
- **Deduction candidates**: `GET /api/deduction-candidates` (pending lines, `payroll.view` **or** `payroll.edit`; filter by gym, period id or month label, status) + `POST /api/deduction-candidates/{id}/review` (Accepted = Approve / Rejected = Waive → recompute the entry). Payslip preview (`GET …/payslips/{employeeId}`), per-employee history (`GET /api/employees/{id}/payroll`), and the CSV export (`GET …/export?format=csv`, `payroll.export`, `pdf` → honest 400) round out the page; `GET /api/attendance/{id}` (punch audit for `ATT-` refs, `payroll.view` or `attendance.view`) backs the biometric line links.
- **`GET /api/requests?ids=`**: new comma-separated id filter (the settlement sheet's linked-requests pane) threaded through `RequestListQuery`/`RequestDirectorySpec`; malformed ids → 400.
- **Tests**: 30 new integration tests (`PayrollControllerTests`) — totals derivation incl. OT math, line statuses/refs, close/reopen gating, publish/lock incl. wrong-branch and double-publish 400s, review recomputation, payslip/export/attendance-ref contracts, and every permission gate. Full suite 315/315 green (Release).

## 2026-10-15 - Notifications, My Access & support screens (api-spec-from-ui.md §5.7–§5.9)

- **Second batch of Section 5**: the foundations batch (HiringForm, HiringFormApplication, Goal, PerformanceCycle, ActionRequest entities; EvaluationForm/EvaluationResponse/PayrollEntry/PayrollPeriod/OffboardingCase/Event column additions; migration `AddHiringFormsEvaluationsPayrollEvents`) landed first, then §5.7–§5.9 end-to-end. Payroll (§5.5), evaluations/form builder (§5.3–4), public hiring forms (§5.2), and the events queue (§5.6) remain.
- **Notifications & announcements (§5.7)**: the signed-in user's inbox (`GET /api/notifications` with unread/category filters, `unread-count`, single `read`, `read-all` — JWT only, rows are user-scoped) plus the announcement history (`GET/POST/PUT /api/announcements`, `announcements.view` / `announcements.manage`). Composing fans out one `Announcement: {title}` notification per targeted user (a branch name targets that gym's members; "All Employees" fans out to everyone active); `readRate` = percent of those fan-out rows read, and retracting with `status: "Cancelled"` deletes the fan-out so delivery stops.
- **My Access profile (§5.8)**: `GET /api/users/{id}` returns `{ data: { id, email, role, permissions[], gyms: [{ id, name, branch }], effectivePermissions[], grantedCount, trackedCount } }` — self-service always, another user's card requires `team.view`; `role` falls back to the user-type label when role-less.
- **Positions catalog (§9.2)**: org-wide `GET /api/positions` (+ `gym`/`searchTerm`/`active` filters) with `levels[]` split from the stored level string, `active` = active employees holding the row, derived `open`/`fill`; `POST`/`PUT` gated `positions.manage` (department auto-created at the gym by name; `levels[]` re-joined on write).
- **Audit log (§9.3)**: read-only `GET /api/audit-log` (`audit.view`) with the UI's category selector mapped onto entity types (Employee | Payroll | Recruitment | Bulk Import), acting-user, gym and date filters, and the `{ id, action, user, target, detail, timestamp, gym }` row contract (`detail` = truncated new-values digest; org-wide rows show "All Gyms" and stay visible to every audited reader).
- **Report export (§9.1)**: `GET /api/reports/export?period=30d|90d|ytd&format=csv` streams a `Section,Metric,Value` CSV (Workforce / Attendance / Requests / Hiring / Positions / Payroll / Separations for the window), `reports.view`, scoped to the actor's gyms.
- **Model/infra changes**: `Position.Headcount` + `AuditLog.GymId` (nullable — org-wide actions stay untagged), migration `AddPositionHeadcountAuditGym`; `ReportingService`/`IReportingService` + `ReportingSpecifications`; `IRoleService.GetUserAccessProfileAsync`; `INotificationService` registered in Program.cs. Controllers: Notifications (+Announcements), Users (`GET {id}`), Positions, AuditLog, Reports.
- **Tests**: 28 new integration tests (`NotificationsControllerTests`, `ReportingControllerTests`) covering fan-out/read-rate/retract, permission denials on every new gate, the access-profile self/other/team.view paths, position create/update + fill derivation from a held position, audit category/user/gym filters, and the CSV stream headers. Full suite 285/285 green (Release — the dev server holds the Debug output locks).

## 2026-10-14 - Recruitment & hiring module (api-spec-from-ui.md §5.1)

- **First slice of Section 5 (HR Portal)**, ordered by dependency: foundations first — the seeder gained `payroll.export`, `events.view`, and `evaluations.forms.manage` (50 tracked keys / 13 areas) for the slices that follow — then recruitment end-to-end. Public hiring forms, the form builder/evaluations, payroll, the events queue, announcements, and reports/positions/audit remain.
- **Vacancies + vacancy requests (§5.1.1–2)**: paged/gym-scoped list with the detail modal's funnel/employees/candidates (`GET/POST/PUT /api/vacancies`), the Branch-Manager requisition queue, decide (approval creates the resulting public Vacancy from the request's fields; already-decided = 400), and reopen (withdraws the applicant-less vacancy, keeps one that has applicants).
- **Candidate pipeline (§5.1.3)**: one card per Application with stage/position/view/blocked/search filters, full detail (form/screen/iv1/iv2/decision blocks hydrated with reviewer display names), block/restore, and stage moves recorded as PipelineStage rows (entering Second Interview auto-schedules the round). **Hired is only reachable through the hire wizard** — a stage move to Hired 400s — so Candidate → Employee happens atomically: User account + Employee profile (EMP-####, CandidateId link) + gym access + Compensation + history + five-item onboarding checklist + "Employee Hired from Recruitment" audit row; the vacancy headcount decrements and the vacancy closes at zero.
- **Interviews, follow-ups, waiting list, New Comers (§5.1.4–6)**: calendar CRUD (month/date/status filters, complete, interviewer reminder notification), the >5-day staleness feed, waiting-list assign (same hire transition) and removal, and the onboarding checklist toggle/batch endpoints feeding the New Comers progress cards.
- **Model/infra changes**: new columns on Vacancy (Urgency, Salary, Shift, Source, RequestedBy, CreatedDate), VacancyRequest (Urgency, Salary, Shift, Headcount, SubmittedDate), Application (form + decision + terminal-outcome fields, LastActivityAt), Candidate (Rating, Blocked, BlockReason), Interview (Type, Room, Status, Verdict, Evaluation, CompletedAt, InterviewerName), PipelineStage (ByUserId); `VacancyStatus` gained Draft and `PipelineStageType` gained Accepted/Rejected/Hired. Migration `AddRecruitmentUiFields`. No HiringForm entity yet — it ships with the public hiring-forms slice.
- **Contract gotchas pinned down (each cost real debugging)**: the mock's `totalCount` stays normalized to `total` (the Requests precedent); C# value tuples do NOT survive System.Text.Json, so the checklist `[[label,done]]` contract uses an explicit `ChecklistEntry` + JSON converter; Npgsql rejects `Kind=Unspecified` for timestamptz (scheduled-interview datetimes and month filters are SpecifyKind'd to UTC); expression-based includes cannot reach `Applications.Candidate` in one hop, so vacancy detail loads applications through their own spec; and the live error envelope is `{ statusCode, errorMessage, errors }` — `errorMessage`, not the `message` some docs mention.
- **Tests**: 41 new integration tests (`RecruitmentControllerTests`) covering every endpoint, permission denials, gym isolation, the hire wizard end-to-end (the fresh account logs in), and the error paths. Full suite 257/257 green (Release — the dev server holds the Debug output locks).
>>>>>>> f3f4a831fd41c23fa14f912d21014c76ea9dbc5e

## 2026-10-10 (follow-up 4) - Live liveness HUD + silent "already complete"

- **face-scan now returns an outcome for every frame** instead of throwing on
  frame-level states: 200 with an `outcome` discriminator (no_face, low_liveness,
  unrecognized, already_complete, rejected, pending_checkout) and 201 only when a
  punch was actually written. 400 is reserved for a frame that cannot be decoded
  as an image; 401 stays for a real station/auth failure. The kiosk drives its
  status strip from the discriminator instead of string-matching error text, so
  `TRANSIENT_FRAME_ERRORS` is gone (the same fragile pattern behind the earlier
  liveness-marker bug).
- **The viewfinder strip shows a live liveness percentage** (red below the 0.70
  attendance gate, green at or above) on every frame where a face was detected,
  and names the employee - "Karim Hassan (EMP-1042)" - whenever a face matches.
- **An employee who already completed attendance today is no longer nagged**: that
  scan returns the silent `already_complete` outcome, so the HUD shows their name
  and ID and the loop keeps running - no red card, no pause, no buzz.
- New `Biometrics:ScanLivenessThreshold` (0.70) gates in the face pipeline *before*
  recognition, so a low-score frame reports a measured `low_liveness` outcome with
  the number attached instead of dying later in the events pipeline. `LivenessThreshold`
  (0.60) remains the enrollment gate; `AttendanceService`'s 0.70 still guards
  caller-supplied scores on /events.
- New `AttendanceAlreadyCompleteException : BadRequestException` lets the face
  pipeline tell "day already closed" from other refusals without sniffing message
  text. The exception middleware still maps it to 400 by base type, so /events and
  manual entry keep their exact current contracts.
- **Fixed**: an employee scheduled at a *different branch* (or with no shift today)
  surfaced from the face path as HTTP 401/404, which the kiosk misread as a dead
  station session and dropped back to the code screen. Both are now ordinary
  `rejected` outcomes; only a genuine station/auth failure stops the loop.
- Tests: 72 passing (was 71) - black-frame face-scan tests flip to 200/no_face,
  plus `AutoScan_AfterDayComplete_ThrowsAlreadyComplete`. Docs in api.md.

## 2026-10-10 (follow-up 3) - Silent liveness + ask-before-checkout

- **Low liveness no longer shows a red rejection card**: the kiosk treated the
  server message "Liveness score must be at least 70%." as a hard error because it
  only matched the pipeline wording ("Liveness check failed"). The client's
  transient-frame marker is now simply "Liveness" (covers both), so a sleepy or
  badly-lit frame just keeps scanning with the status HUD hint - no card, no buzz.
- **Face scans now ASK before recording a check-out**: an AUTO face scan that
  would close today's open record returns 200 with requiresCheckoutConfirmation
  (nothing written); the kiosk shows an amber "Check out now?" card inside the
  viewfinder with the employee's name, and only Confirm re-sends the same frame
  with confirmCheckout: true to record the OUT. "Not yet" (or a 30s timeout) keeps
  the day open and scanning resumes.
- Backend: FaceScanRequest.ConfirmCheckout; FaceScanResponse.Attendance is now
  nullable with pending fields; IAttendanceService/AttendanceService gained a
  confirmCheckout flag (AUTO->OUT gate only; explicit IN/OUT and the /events
  integration endpoint - which passes true - are never gated; manual stays null);
  FaceBiometricService forwards the flag and builds the pending response;
  AttendanceController returns 200 for pending, 201 only when a punch was created.
- Client: attendance.api.ts types, useKioskScanner pending state + confirm/cancel
  (camera loop pauses while the prompt is up), new CheckoutConfirmCard in
  KioskPanels rendered inside the viewfinder frame.
- Tests: 71 passing (was 66) - new service-level
  AutoCheckOut_BiometricWithoutConfirmation_IsPending_ThenRecordsWhenConfirmed.
  API note in docs/architecture/api.md.

## 2026-10-10 (follow-up 2) - Kiosk fits the viewport like the Mock UI

- `KioskLayout` is now a bare viewport frame (`h-screen overflow-hidden`, light
  bg-gray-50): the duplicate dark header and outer padding that made the page
  taller than the window are gone; the kiosk page owns the single header.
- Connected grid is exactly the Mock UI main (`p-3 lg:p-4 overflow-hidden`,
  `[1fr_370px]`), so camera panel + aside are height-constrained - no scrolling.
- Camera error card and success/rejection cards are now rendered INSIDE the
  viewfinder frame (mock: #vf-offline / #vf-result), same overlay design.
- Fixed broken `.scanline` CSS (was animation-only; now has the mock's
  absolute positioning + green gradient sweep).
- Removed light-on-light text (restoring state) and the mojibake CSS comment.
## 2026-10-10 (follow-up) - Kiosk UI matches the Mock UI, station dashboard

- **Attendance page rebuilt to the mock layout** (production wiring, no prototype
  behaviour): header with branch + live clock, dark activation view for the 6-digit
  enrollment code, viewfinder with reticle corners, scanline and live status HUD,
  right rail with today counters, manual fallback (audited reason) and the gym feed.
- **New `GET /api/attendance/station-summary`** (station-session authenticated):
  present/scheduled counters plus the 10 most recent events for the station's gym,
  so the kiosk dashboard shows real data instead of localStorage fixtures.
- Camera now streams for the whole session (also while the manual panel is open); the
  scan LOOP is gated by the auto-scan toggle, and "Scan now" drives single captures
  when auto-scan is off. Sound alerts are opt-in (WebAudio, no assets).
- Removed the mock-only surfaces that have real homes now: biometric URL config
  modal, manager pairing modal, device-token modal (device tokens are gone), enroll
  modal (lives at /enrollment).
- Tests: 66 passing (was 61) - new `StationSummaryControllerTests`.
## 2026-10-10 - Station sessions (attendance station production readiness)

- **Station credential reworked**: the 6-digit enrollment code is short-lived
  (`StationCode:ExpirationMinutes`, default 5) and is redeemed once at
  `POST /api/kiosk/login`, which mints an opaque, DB-backed station session. Only the
  SHA-256 hash of the session token is stored; the plaintext is shown exactly once.
- **All attendance requests authenticate with `X-Station-Token`** (new
  `StationSession` authentication scheme alongside JwtBearer). GymId is always derived
  from the validated session record, never from the request body; the station code was
  removed from every attendance DTO.
- **Traceability**: `AttendanceRecords` now store `StationSessionId` in addition to
  `GymId` (manual audit entries record it too); the plaintext code is never stored on a
  record. New `StationSessions` table + `Add_StationSessionCredential` migration.
- **Session lifecycle**: 30-day lifetime (720h, `StationSession:LifetimeHours`), HR can revoke all
  of a gym's sessions (`DELETE /api/gyms/{gymId}/station-sessions`), rotation only kills
  the code for *new* enrollments (already-enrolled kiosks keep working).
- **Kiosk camera is always on** (production attendance page): new `useKioskScanner` hook
  streams frames automatically with `type: AUTO` (server decides IN/OUT), pauses for
  result/rejection cards, retries transient errors, and stops on session 401. Manual
  fallback now uses the audited `/api/attendance/manual` endpoint with a reason.
- **Public kiosk shell**: `/attendance` moved out of `AppLayout` into a standalone
  `KioskLayout` (no nav, no sign-in/sign-out). The station session lives in an HttpOnly
  cookie (React never touches the token): `POST /api/kiosk/login` sets it, the SPA
  restores itself on load via `GET /api/kiosk/session`, and `POST /api/kiosk/logout`
  revokes and clears it, so a rebooted kiosk reattaches automatically for 30 days.
- Removed dead code: `TokenService.CreateStationToken`, `Jwt:StationTokenMinutes`,
  client `biometric-config.ts`, `useFaceScanner`/`FaceScanPanel`/`AttendanceEventForm`
  (replaced), `useAttendanceStation`.
- Tests: 61 passing (was 46) - new `StationSessionControllerTests` (expiry, revocation,
  rotation-keeps-sessions, re-enrollment, revoke authorization) plus session/audit
  assertions in the attendance suites.
# Development Progress

> Last updated: 2026-10-07

## Current State: **Login + Attendance + Employee Portal APIs implemented**

Web login (email/password -> access token), station login (6-digit code -> gym), attendance events/manual, station-summary, station codes, face biometrics, and the full Employee Portal surface (session context + gym switching, self-service, permission-gated management for Team Leaders/Branch Managers) are implemented, secured, documented, and covered by 153 integration tests. See the handoff notes in the 2026-10-10 employee portal entries and `docs/architecture/employee-portal-api-plan.md`.

**Key decisions applied 2026-10-07 through 2026-10-10:**
- Attendance/station auth depends ONLY on the 6-digit station code â€” no deviceId, no device token (ADR-004 amended)
- Access-token-only login (no refresh tokens â€” RefreshTokens table was removed)
- Model fix: (Id, TeamId) alternate key + composite TeamLeaders FK dropped (blocked all employee inserts)
- Authorization is per-gym feature x level (ADR-003 Amendment 1); Team Leader = Branch Manager capability parity with team scope; gym count unbounded with login-time selection + in-session switch (ADR-002 Amendment 1)

**Key decisions applied 2026-10-07:**
- Attendance/station auth depends ONLY on the 6-digit station code â€” no deviceId, no device token (ADR-004 amended)
- Access-token-only login (no refresh tokens â€” RefreshTokens table was removed)
- Model fix: (Id, TeamId) alternate key + composite TeamLeaders FK dropped (blocked all employee inserts)

---

## Phase 1: Foundation

### Project Structure
- [x] Solution created (ReviveHRSystem.Web.sln)
- [x] DomainLayer project created
- [x] ServiceAbstraction project created
- [x] Service project created
- [x] Persistence project created
- [x] Presentation project created
- [x] Shared project created
- [x] Web entry point (Program.cs) with Swagger
- [x] Project references configured correctly
- [x] NuGet packages installed (Npgsql, EF Core, JWT, etc.)

### Project Documentation
- [x] PROJECT.md (agent entry point)
- [x] docs/product/mvp.md
- [x] docs/product/features.md
- [x] docs/product/user-flows.md
- [x] docs/product/out-of-scope.md
- [x] docs/architecture/architecture.md
- [x] docs/architecture/backend.md
- [x] docs/architecture/frontend.md
- [x] docs/architecture/database.md
- [x] docs/architecture/api.md
- [x] docs/decisions/ADR-001-database.md
- [x] docs/decisions/ADR-002-authentication.md
- [x] docs/decisions/ADR-003-authorization.md
- [x] docs/decisions/ADR-004-biometric-integration.md
- [x] Design system (DESIGN.md)

---

### Phase 2: Domain & Database Design
- [x] Domain entities defined (DomainLayer) â€” all module entities exist
- [x] EF Core entity configurations (Persistence)
- [x] PostgreSQL DbContext configured
- [x] Initial migration created + applied (AlignHrSchema â€¦ Add_StationCodes, Fix_TeamLeader_Composite_Fk)
- [ ] Permission catalog seeded
- [x] Default Super Admin seeded (Development seeder: admin@revive.hr + 2 gyms + station codes + 3 test employees)

## Phase 3: Authentication
- [x] Login endpoint (POST /api/auth/login + login/select-gym for 2-gym employees)
- [x] JWT token generation (access-token-only)
- [ ] Refresh token rotation â€” **removed by decision** (RefreshTokens table dropped; revisit only if sessions need extending)
- [ ] Logout endpoint
- [ ] Password reset
- [ ] Account lockout â€” mitigated for now by auth-login rate limiting (10/min/IP)

## Phase 4: Authorization
- [ ] Permission checking service
- [ ] Gym-scope filtering
- [ ] Role management endpoints
- [ ] Permission assignment endpoints
- [ ] Gym access assignment endpoints

## Phase 5: Gym & User Management
- [ ] Gym CRUD endpoints
- [ ] Position management (per gym)
- [ ] Shift template management (per gym)
- [ ] User CRUD endpoints
- [ ] Role assignment
- [ ] Permission assignment
- [ ] Gym access assignment

## Phase 6: Recruitment
- [ ] Vacancy management
- [ ] Public application link/page
- [ ] Candidate profiles
- [ ] Pipeline kanban stages
- [ ] Interview recording
- [ ] Follow-up engine
- [ ] Waiting list

## Phase 7: Hiring Transition
- [ ] Candidate â†’ Employee conversion
- [ ] Employee account creation
- [ ] Gym + position assignment
- [ ] Credential generation
- [ ] Recruitment history linking

## Phase 8: Employee Module
- [ ] Employee profile (tabbed)
- [ ] Employee directory (list view)
- [ ] Manual employee creation
- [ ] CSV bulk import
- [ ] Transfer gym
- [ ] Change position/level
- [ ] Assign/change role
- [ ] Change status
- [ ] Manage compensation
- [ ] Manage contract
- [ ] Offboarding
- [ ] Document management
- [ ] Employment history timeline

## Phase 9: Scheduling
- [ ] Shift cycle CRUD
- [ ] Schedule grid UI
- [ ] Shift assignment management
- [ ] Copy previous cycle
- [ ] Conflict detection
- [ ] Publish cycle

## Phase 10: Attendance
- [x] Biometric integration boundary â€” station login + events API (6-digit station code auth, no device token)
- [x] Manual check-in/check-out (POST /api/attendance/manual, reason audited, method=Manual)
- [x] Basic schedule comparison at event time (OnTime / Late / EarlyCheckout vs shift template)
- [ ] Full status engine (Absent, MissingCheckout sweeps â€” scheduled job)
- [ ] Manual correction (HR, attendance.edit)
- [ ] Repeated-issue flagging

## Phase 11: Requests & Approvals
- [ ] 9 request types
- [ ] Request submission (employee)
- [ ] Request inbox (HR/Branch Manager)
- [ ] Approve/reject with comment
- [ ] Cross-module integration (schedule conflicts)

## Phase 12: Payroll History
- [ ] Payroll period management
- [ ] Deduction candidate generation
- [ ] Deduction review/approval
- [ ] Payroll entry display
- [ ] Payslip preview
- [ ] Export

## Phase 13: Notifications & Announcements
- [ ] In-app notification system
- [ ] Notification triggers (recruitment, requests, attendance, etc.)
- [ ] Read/unread management
- [ ] Bell badge count
- [ ] Announcement compose (title, body, target audience, schedule)
- [ ] Announcement delivery (fan-out to Notifications on send)
- [ ] Announcement history for HR
- [ ] Announcement inbox for employees

## Phase 14: Leave Balance
- [ ] LeaveBalances table migration
- [ ] Auto-increment pending days on request submit
- [ ] Auto-increment used days on request approve
- [ ] Auto-decrement pending days on request reject
- [ ] Leave Balance tab on employee self-service profile
- [ ] Balance shown inline on request submission form
- [ ] Balance shown on HR request detail panel
- [ ] HR can edit TotalEntitlement with permission

## Phase 14: Frontend (React SPA)
- [x] Vite + React + TypeScript project setup (Client/)
- [ ] Tailwind + shadcn/ui configuration
- [ ] Auth flow (login, token management)
- [ ] Permission-driven navigation
- [ ] Gym context switcher
- [ ] RTL/i18n setup
- [ ] Super Admin pages
- [ ] HR pages
- [ ] Employee self-service pages
- [ ] Public application page

## Phase 15: QA & Security
- [x] Integration test suite â€” 44 tests: login/kiosk/attendance/station-code coverage matrix + IDOR (gym-scope) + rate-limit regressions + face-enrollment authorization (Tests/ReviveHRSystem.IntegrationTests)
- [ ] Authorization tests (permission system â€” pending Phase 4)
- [x] Cross-gym isolation tests (CROSS_GYM_ACCESS_DENIED, WRONG_BRANCH_SCHEDULE, SCHEDULED_DAY_OFF, GYM_ACCESS_DENIED)
- [ ] Workflow integration tests
- [ ] Audit log verification (manual-entry reason audit covered by test)
- [ ] Security review â€” 2026-10-07 pass on the login/attendance surface (IDOR + brute-force + headers fixed; see session report)

## Phase 16: Deployment
- [ ] Docker containerization
- [ ] PostgreSQL production setup
- [ ] Backup strategy
- [ ] SSL/TLS configuration
- [ ] Monitoring setup
