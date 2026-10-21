# Implemented API Contract

This document describes the endpoints currently implemented by the backend. The UI endpoint inventory in [api-spec-from-ui.md](./api-spec-from-ui.md) is a product roadmap; entries there are not live unless they also appear below and in generated OpenAPI.

## Conventions

- Base path: /api; requests and responses use JSON.
- Successful responses return the endpoint DTO directly (there is no data wrapper).
- **List endpoints are paginated** and return the envelope `{ items, page, pageSize, totalCount, totalPages }` (`PaginationResult<T>`), never a bare array. `page` is 1-based; `totalPages` is at least 1 even when `totalCount` is 0. Paging inputs arrive as `pageNumber` (default 1, floored to 1) and `pageSize` (default 10, clamped to 100); a `pageSize` below 1 falls back to the default.
- Errors returned by the exception middleware use { statusCode, errorMessage, errors }. errorMessage is the human-readable message; errors is an array of strings carrying extra per-field detail when a BadRequestException supplies it (empty otherwise).
- Invalid request bodies return 400 with { statusCode: 400, errorMessage, validationErrors } where validationErrors is an array of { field, errors[] }; rate limits return 429 with RATE_LIMITED. Unexpected errors return a generic 500 body.
- Cross-origin browser calls are off by default: an empty Cors:AllowedOrigins yields no CORS headers (same-origin deployments and the Vite dev proxy are unaffected). Populating the list enables the SPA to call the API from another origin.
- Requests are cancellation-aware through controller, service, repository, and save operations.

## Authentication

### POST /api/auth/login

Request: { email, password }.

A completed session returns 200 with accessToken, expiresInSeconds, requiresGymSelection=false, and user. A multi-gym employee instead receives requiresGymSelection=true, gyms, and tempSessionToken; fields for the completed session are omitted. Invalid, unknown, and disabled accounts all return 401 with errorMessage "Invalid email or password.".

### POST /api/auth/login/select-gym

Request: { gymId, tempSessionToken }. Returns the completed session shape above; the token must be valid and the user must have access to the selected gym. Possible errors: 400, 401, or 429.

<<<<<<< HEAD
### POST /api/auth/logout

Records the caller's logout and returns 204. Auth is access-token-only with no refresh tokens (ADR-002), so there is no server-side session to revoke: the client discards its token and the token's own lifetime ends the session. The endpoint is idempotent and always writes an `AuditLog` entry ({ action: "Logout", entityType: "User" }); a missing/invalid token is answered 401 by the framework before the handler runs.

### GET /api/attendance (range bound)

A single request may cover at most 92 days (`AttendanceQueryParams.MaxRangeDays`); a wider window returns 400. Paging does not bound this, because the roster is built before it is sliced.

## Employee portal (self-service)

Every endpoint below requires a Bearer access token. Self reads/writes act on the caller's own employee profile; reading another employee's data additionally requires the `employees` feature at `View` level in the gym the token is scoped to, plus the caller's resolved scope (team for Team Leaders, gym for Branch Managers) — cross-scope reads return 404. Employment and compensation fields are HR-controlled: salary appears only on the owner's own profile.

### GET /api/employees/{id}

Profile of the employee (self, or with the `employees` grant): { id, fullName, position, status, employmentType, hireDate, dateOfBirth, nationalId, gender, address, phone, email, gym: { id, name, branch }, emergencyContact: { name, relationship, phone }, baseSalary }. Errors: 404.

### PUT /api/employees/{id}/contact

Self-only. Body: { phone, address }. Returns the updated profile. 404 when the id is not the caller's own employee.

### PATCH /api/employees/{id}/emergency-contact

Self-only. Body: { name, relationship, phone }. Returns the updated profile.

### GET /api/employees/{id}/photo · PUT /api/employees/{id}/photo

The avatar, replacing the initials placeholder. GET streams the stored image (media type from the file's extension) and answers 404 when no photo has been uploaded; anyone who may already see that employee may read it, so a team screen can render the same URL. PUT is self-only and multipart (`file`), accepts PDF/PNG/JPG/WEBP/GIF up to 10 MB, and returns `{ photoUrl }` pointing back at the GET route — the physical storage path never leaves the server. 400 for a missing or unsupported file; 404 when the route's id is not the caller's own employee. `EmployeeProfileDto.PhotoUrl` carries the same URL so clients need only one round trip.

### GET /api/employees/{id}/documents

Vault of the employee: [{ id, name, category, uploadDate, expiryDate, status (Valid | Expiring Soon | Expired), canDownload }].

### GET /api/employees/{id}/required-documents

Checklist: [{ key, label, documentId (null until uploaded) }] — one entry per document category of the catalog.

### POST /api/employees/{id}/documents

Self-only upload. Body: { category (Contract | NationalId | Certification | Other), fileName, filePath?, expiryDate? }. Returns 201 with the created document; 400 on unknown category or missing file name. This records the document's *metadata*; rows with no stored file report `canDownload: false` and their download route answers 404.

### GET /api/employees/{id}/hr-documents

The official company documents published by HR for this employee (mock §3.3): [{ id, name, category, addedDate, size, sizeBytes }]. `size` is the display string the mock shows ("PDF · 2.1 MB"), labelled from the stored extension; `sizeBytes` is exact. Same access rule as the vault, and the two lists are disjoint — an employee upload never appears here and an HR document never appears in the vault.

### GET /api/employees/{id}/documents/{docId}/download · GET /api/employees/{id}/hr-documents/{docId}/download

Binary streams for a document of the matching owner. Every miss answers the same 404 — an out-of-scope employee, a document belonging to the other owner's list, an unknown id, or a row with nothing stored — so the route never confirms which document ids exist. Feature/visibility is the employee read rule already applied to the lists above.

### File storage

Binaries live behind `IFileStorage` (an interface in ServiceAbstraction) with a local-disk provider, configured by the `Storage` section: `RootPath` (relative values resolve against the host's base directory) and `MaxUploadBytes` (default 10 MB). Only the *relative* path is ever persisted or returned; the provider generates the on-disk name and derives the media type from the extension, re-checks every read against the root so a stored path cannot be turned into a traversal, and refuses anything that resolves outside it. A write that fails or overruns the cap is cleaned up, so no partial file is ever left behind for a row that was never created. `App_Data/storage/` is git-ignored.

### GET /api/employees/{id}/attendance

Month view. Query: month (YYYY-MM; defaults to the current month). Returns { summary: { rate, present, late, absent, earlyCheckout, missingCheckout }, today, records: [{ date, shift, shiftName, checkIn, checkOut, status, source }] }. Statuses: On Time, Late, Absent, Early Checkout, Missing Checkout. Attendance corrections are workflow requests, not direct edits.

### GET /api/employees/{id}/leave-balance

Returns { year, balances: { Annual: { total, used, pending, remaining }, Sick: ..., Emergency: ..., Unpaid: ... } } — only types with a row are present. Submitting an Annual Leave / Sick Leave request reserves days in `pending`; cancelling releases them; approval consumes them (management side). Default entitlements for a fresh year: Annual 21, Sick 10, Emergency 6 — HR edits the entitlement per employee (HR portal).

### GET /api/employees/{id}/schedule

Published schedule. Query: month (YYYY-MM). Returns { month, cycles: [{ id, start, end, status }], days: [{ date, dayName, shiftName, start, end, isOff, isToday }] }. Published cycles only (roles guide).

### GET /api/employees/{id}/requests · POST /api/employees/{id}/requests

List filters by optional `status` (Pending | PendingHRReview | Approved | Rejected | Cancelled).

Create is **multipart/form-data** because a file can ride with it (the sick-leave medical certificate). Fields: { type, requestDate, endDate?, targetDate?, requestTime?, swapWithEmployeeId?, amount?, reason } plus an optional `attachment` file. `type` is a request-type id or label (see GET /api/request-types). Which fields matter is per type:

| Type | Fields used | Rules |
|---|---|---|
| annual-leave | requestDate → endDate, reason | balance-checked: 400 when the days exceed the remaining Annual balance (21 default); submits reserve pending days |
| sick-leave | requestDate → endDate, reason, attachment | same balance check against Sick (10 default) **and the medical certificate is required** (400 without it) |
| late-attendance | requestDate, requestTime, reason | no submission window; excused hours = arrival − scheduled shift start (from the *published* schedule, 400 without one); hours + pending + approved hours of the month must stay within the gym's cap |
| early-leave | requestDate, requestTime, reason | same, hours = scheduled shift end − departure (midnight-crossing shifts handled) |
| shift-swap | requestDate → endDate, swapWithEmployeeId, reason | colleague must be an active employee of the same gym, not the requester |
| weekly-off-swap | requestDate (off day given up), targetDate (off day taken in exchange), swapWithEmployeeId, reason | same colleague rule; the two dates must differ |
| check-in-correction | requestDate, requestTime (corrected time), reason | |
| salary-advance | amount, reason | amount > 0; no automatic limit — approval is the gate |
| paid-holiday | requestDate, reason | request to work a paid holiday (e.g. Eid) for double day pay; HR decides on approval |

400 for an unknown type, a missing reason, a missing date (advances default to today), an end date before the start, a non-positive amount, or any violated rule above; 404 when posting for another employee. Returns 201 with the request.

### GET /api/employees/{id}/excused-hours

Monthly excused-hours budget of one employee: { capHours, usedHours, remainingHours, month }. `capHours` is the gym's HR-set cap (default 4); `usedHours` counts this calendar month's pending + approved late-attendance and early-leave hours. Self or employee-scoped access (404 cross-scope).

### GET /api/requests/{id}

Detail with the approval timeline: [{ step, date, done }]. Also returns the type-specific fields (targetDate, hours, amount, swapWithEmployeeId/Name, hasAttachment). 404 for another employee's request.

### GET /api/requests/{id}/attachment

Streams the file riding with a request (the sick-leave medical certificate). The requester always gets his own; anyone else needs employee-scoped access in the request's gym. 404 when nothing is stored.

### POST /api/requests/{id}/cancel

Self-only, Pending requests only. 204; 400 for non-pending requests; releases reserved leave days.

### GET /api/request-types

Configurable catalog: [{ id, label, fields, consumesLeave, requiresAttachment, requiresColleague, requiresAmount, limitedByMonthlyExcusedHours, requiresTargetDate }] — the final 9 types: annual-leave, sick-leave, late-attendance, early-leave, shift-swap, weekly-off-swap, check-in-correction, salary-advance, paid-holiday. The flags mirror the server-side rules so the client renders the right fields and blocks impossible submissions. Authentication required; not user data.

### GET /api/notifications · GET /api/notifications/unread-count · PUT /api/notifications/{id}/read · PUT /api/notifications/read-all

Inbox for the caller: [{ id, category, title, description, date, read, link }], the bell badge count, and the two mark-read operations (204). Marking a foreign notification returns 404.

### GET /api/me/settings · PUT /api/me/settings · POST /api/auth/change-password

Preferences: { requests, attendance, recruitment, management, announcements } (defaults are all true). Change password: { currentPassword, newPassword } (min 8 characters); 401 for a wrong current password, 400 for a short new password, 204 on success.

## Employee portal (management surface)

Every endpoint below requires a Bearer access token with a gym-scoped token: `[HasFeatureAccess]` gates the feature (`employees`, `requests`) at the required level (View/Edit) **in the token's gym**, and the service layer resolves the scope — a Team Leader sees his team, a Branch Manager sees the gym. Callers without the feature get 403; out-of-scope targets get 404 (no existence leak); a token without a gym context gets 403 on management endpoints.

### GET /api/employees

Paged directory. Query: q (name substring), status, positionId, sortBy (name | status), pageNumber, pageSize. Returns the paged envelope of `{ id, name, position, status, initials, todayShiftName, todayShiftStart, todayShiftEnd }` — the caller's team for Team Leaders, the gym for Branch Managers. Ordering is stable (name by default) so pages do not overlap when rows shift between requests. Feature: employees View.

### POST /api/employees

Body: { fullName, positionId (position of the active gym) }. Creates the employee AND his single login account (the domain requires the 1:1 User ↔ Employee link), with a random temporary password that is never stored or returned. Team-scoped leaders create members of their own team. 201. Feature: employees Edit.

### PUT /api/employees/{id}

Body: { fullName, positionId, status }. 400 for a position outside the employee's gym; 404 cross-scope. Feature: employees Edit.

### POST /api/employees/{id}/status-change

Body: { status (Active | OnLeave | Suspended | Terminated), note }. Every change is appended to the employment-history timeline (history is preserved, never overwritten). 204. Feature: employees Edit.

### GET /api/requests

Paged management inbox for in-scope employees. Query: status (Pending | PendingHRReview | Approved | Rejected | Cancelled), type (request-type id or label), dateFrom, dateTo (inclusive bounds on the requested date), pageNumber, pageSize. There is deliberately no `teamId` parameter — scope is resolved server-side from the caller's role in the token's gym, so a client can never widen its own scope. Paging applies after filtering, so `totalCount` reflects the filtered set. Feature: requests View.

### POST /api/requests/{id}/decide

Stage-1 (BranchManager) decision. Body: { stage? ("BranchManager"; defaults to it, and "HR" is refused with 400 — recording an HR approval from a stage-1 caller would forge a record attributed to a stage the caller does not hold), decision: "Approved" | "Rejected", comment? }. Approved moves the request to PendingHRReview (HR's final decision lives in the HR portal); Rejected closes it and releases the leave days it had reserved. 400 for a non-pending request, an unknown decision, or an unknown/rejected stage; 404 cross-scope. Feature: requests Edit.

### PUT /api/requests/{id}

Edits type/dates/reason of a pending request on behalf of an in-scope employee. The type must be one of the catalog (400 otherwise), so the request keeps its rules. 204. Feature: requests Edit.

### GET /api/attendance

Management day view. Query: date (YYYY-MM-DD), or dateFrom/dateTo for an inclusive range of at most 92 days, plus employeeId and status filters, plus pageNumber/pageSize. Returns { date, dateFrom, dateTo, summary: { present, late, absent, missingCheckout }, late: [...], absent: [...], missingCheckout: [...], roster } for the caller's team (Team Leader) or gym (Branch Manager). `late`/`absent`/`missingCheckout` cover the whole window; `roster` is the paged envelope of every in-scope person-day row `{ employeeId, name, position, date, status, checkIn, lateMinutes }`. An employee scheduled with a real shift and without any record counts as absent (no-show). Feature: attendance View.

### POST /api/attendance/mark-attendance

Management manual entry (audited). Body: { employeeId (employee number), type (IN or OUT), timestamp?, reason }. Gym comes from the token; ADR-004 cross-gym validation applies. 201. Feature: attendance Edit. (The kiosk's `POST /api/attendance/manual` stays station-authenticated and is unchanged.)

### GET /api/teams/my-teams · GET /api/teams/{teamId}/today · GET /api/teams/{teamId}/unscheduled-count

The teams the caller leads or belongs to in the active gym, the team-day view: { teamId, teamName, stats: { total, present, late, absent, pendingRequests }, members: [{ employeeId, name, position, status (Present | Late | Absent | Off), checkIn, initials, shiftName, shiftStart, shiftEnd, isOff }] }, and the count of members with no published assignment. Teams of another gym, or teams the caller neither leads nor belongs to, return 404. Feature: employees View.

### GET /api/notifications (paged)

Query: pageNumber, pageSize, unreadOnly. Returns the paged envelope of `{ id, category, title, description, date, read, link }` for the caller, newest first. `unreadOnly=true` drives the bell badge.

### POST /api/requests/{id}/comments

Body: { comment }. Posts a comment on an in-scope request. Comments are a collaboration trail only: they never change the request's status. 201 with `{ id, author, body, date }`; 400 for an empty comment; 404 cross-scope. Feature: requests View.

### GET /api/vacancy-requests · POST /api/vacancy-requests · GET /api/vacancy-requests/{id}

Paged gym-scoped vacancy requests: `{ id, position, status, date, requestedBy, justification }`. Create body: { positionId (of the active gym), justification }. 400 for a position outside the gym or a missing justification; the detail route returns 404 for a request outside the active gym. Feature: recruitment View / Edit.

### GET /api/offboarding-requests · POST /api/offboarding-requests

Paged gym-scoped leaving cases: `{ id, employeeId, employee, position, lastWorkingDate, status, reason }`. Create body: { employeeId (in-scope employee), lastWorkingDate, reason }; the case is recorded as "Notice Period" and an Offboard event is appended to the employment-history timeline. 400 for an employee who already has an open case, 404 cross-scope. Feature: offboarding View / Edit.

### GET /api/gyms/{gymId}/shift-cycles · POST /api/gyms/{gymId}/shift-cycles

Cycle list (query: month YYYY-MM) and creation (body: { startDate, endDate } -> Draft). Cycles are gym-scoped; the grid endpoints below carry the gymId in the path. Feature: schedule View / Edit.

### GET /api/gyms/{gymId}/shift-cycles/{cycleId}

Cycle detail: { id, start, end, status, days, assignments: [{ employeeId, name, shiftTemplateIds (per day, null = Off day)] }] - scoped to the caller's team (Team Leader) or the gym. Feature: schedule View.

### PUT /api/gyms/{gymId}/shift-cycles/{cycleId}/assignments

Upserts (body: { assignments: [{ employeeId, date, shiftTemplateId (null = Off day)] } }). One shift per employee per day (domain rule); targets outside the caller's scope or outside the cycle get 400; archived cycles are read-only. Feature: schedule Edit.

### POST /api/gyms/{gymId}/shift-cycles/{cycleId}/publish

Publishes the cycle; only published cycles appear in employees' schedule views. Feature: schedule Edit.

### DELETE /api/gyms/{gymId}/shift-cycles/{cycleId}

Deletes the cycle and its assignments. Feature: schedule Edit.

### GET/POST/PUT/DELETE /api/gyms/{gymId}/shift-templates

Reusable shift templates of the gym: [{ id, name, start, end }]. Create/update bodies: { name, start, end } (400 when end is not after start). Deleting a template turns its assigned cells into Off days (null template) so schedules stay valid. Feature: schedule View / Edit.

### GET/PUT /api/gyms/{gymId}/attendance-policy

HR-editable attendance policy: { gymId, gymName, excusedLateHoursCapPerMonth }. The cap is the monthly budget of excused Late Attendance / Early Leave hours — HR decides the number once and it is static for every employee of the gym (default 4, valid 0–200). PUT body: { excusedLateHoursCapPerMonth } → 200 with the updated policy; 400 for an out-of-range cap. The route gym must match the token's active gym (401 otherwise). Feature: attendance View / Edit.

### POST /api/deduction-candidates

Body: { employeeId (in-scope), amount > 0, reason (Unapproved absence | Late arrival (30+ min) | Early checkout without approval | Damaged equipment / property | Policy violation | Other (see note)), note? }. Created with status Pending for HR review; 404 for an out-of-scope employee. Feature: attendance Edit.

### POST /api/warning-notices

Body: { employeeId, type (Attendance | Conduct | Performance | Safety | Policy violation), reason, note? }. The employee does not see the notice until HR approves and files it. Feature: employees Edit.

### POST /api/bonus-proposals

Body: { employeeId, type (Performance Bonus | Overtime Pay | Attendance Reward | Referral Bonus | Other), amount > 0, reason, note? }. Approved proposals become payroll line items (HR side). Feature: employees Edit.

### GET /api/branch-actions/pending-hr

The manager's "Awaiting HR" queue for the active gym/team: [{ id, kind (Deduction | Warning | Bonus), employee, detail, date, status: "Pending HR" }]. Feature: attendance View.

### POST /api/branch-reports

Free-form report to HR. Body: { period?, type (Monthly branch summary | Attendance exceptions | Incident report | Request escalations), message }. Lands in the HR action queue as a BranchReport event; any authenticated employee may report. 400 for an unknown type or an empty message; 204 on success.

## Team Actions

Follow-ups raised about team members, plus the "Remind" and "Message" shortcuts (mock 13.4-13.8 / 19). Every route is gated by the `employees` feature (View to read, Edit to write) and the service resolves the caller's team so a Team Leader only ever touches his own team; out-of-scope targets and other teams' follow-ups return 404 (no existence leak).

### GET /api/teams/follow-ups · POST /api/teams/follow-ups

List the follow-ups of the caller's scope (newest activity first), or raise one. Body: { employeeId (in-scope member), action (Reminder | Meeting | Escalation | Resolution), severity? (Low | Medium | High, default Medium), description, note? }. Returns `[{ id, employeeId, employee, teamId, actionType, description, severity, lastAction, note, isResolved }]`; creating with action Resolution closes the item immediately. 400 for an unknown action/severity or a missing description. Feature: employees View / Edit.

### PUT /api/teams/follow-ups/{id}

Records an action on an existing follow-up. Body: { action (Reminder | Meeting | Escalation | Resolution), note? }. Updates `lastAction`/`note`; a Resolution closes the item and any other action reopens a closed one. 404 for another team's follow-up. Feature: employees Edit.

### POST /api/teams/members/{employeeId}/reminders

Sends a reminder to an in-scope team member. Records a resolved Reminder follow-up and delivers a Notification to the member's own inbox. 204. Feature: employees Edit.

### POST /api/employees/{employeeId}/messages

Body: { message }. Persists a `TeamMessage` (audit trail of what was sent, by whom) and delivers a Notification to the recipient. 400 for an empty message; 204 on success. Feature: employees Edit.

## Evaluation authoring

Evaluation forms are HR artefacts; running an evaluation (filling one in for an employee) is gated by the `evaluations` feature at Edit, so whoever is granted that level per gym may evaluate. Team Leaders and Branch Managers hold evaluations at View per the locked role table — they read evaluations but do not author them until granted Edit (individual per-gym grant or role bundle).

### GET /api/evaluation-forms

Active forms available in the active gym, plus global ones: `[{ id, name, questions: [{ id, text, type (Rating5 | MultipleChoice | Checkbox) }] }]`. Feature: evaluations View.

### POST /api/employees/{employeeId}/evaluations

Body: { evaluationFormId, answers: [{ questionId, score, comment? }], overallComment? }. Every answer must belong to the selected form and the form must be active and in scope; scores are bounded 0-5. Returns 201 with the created evaluation; score is the mean of the numeric answers, exactly as the self-service read computes it. 400 for an empty answer set, a foreign question, an unavailable form, or an out-of-range score; 404 cross-scope. Feature: evaluations Edit.

### PUT /api/employees/{employeeId}/evaluations/{evaluationId}

The path's `employeeId` must be the evaluation's own employee (404 otherwise). Body: { answers: [{ questionId, score, comment? }], overallComment? }. Edits the answers of an in-scope evaluation and re-scores it. Feature: evaluations Edit.

### GET /api/teams/{teamId}/evaluations

Evaluations of the team's members, newest first, in the same shape as the self-service read. 404 for a team the caller neither leads nor belongs to. Feature: evaluations View.

## Session & gym context

Gym assignments are not capped (three or more `UserGymAccess` rows are supported) and every employee has exactly one account: the employee's primary gym plus access rows for any additional gyms. A user with exactly one gym gets a token scoped to that gym at login; users with more than one gym either choose at login (`select-gym`) or switch later (`switch-gym`). The `gymId` claim is the authoritative active gym for the whole session, and in-session switching changes that context without re-authenticating (ADR-002 Amendment 1).

### GET /api/me

Requires a Bearer access token. Returns 200 with the caller's session context: { userId, email, userName, userType, activeGym: { gymId, gymName } | null, gyms: [{ gymId, gymName }], roleInActiveGym, ledTeamId, featureLevels }. `gyms` drives the gym switcher. `roleInActiveGym` is the role the user holds in the active gym (null when unscoped or unassigned); `ledTeamId` is the team the user leads in that gym (Team Leader sessions). `featureLevels` maps feature code to effective level for the active gym (0 = None, 1 = View, 2 = Edit), resolved per ADR-003 Amendment 1: Super Admin wildcard, then per-gym individual grant, then per-gym role bundle, then global grant; Super Admin sessions see Edit on every feature. Feature codes: employees, attendance, schedule, requests, payroll, evaluations, recruitment, offboarding, documents, reports, announcements, audit. Absent features mean None. Errors: 401.

### POST /api/auth/switch-gym

Requires a Bearer access token. Request: { gymId }. Returns 200 { accessToken, expiresInSeconds, me } where `me` is the /api/me payload for the new gym (feature levels are per gym, so clients re-gate navigation on every switch). The gym must be active and in the caller's UserGymAccess; unknown or inaccessible gyms both return 401 with errorMessage "You do not have access to the selected gym." Possible errors: 401 or 429.
### GET /api/auth/me

Authenticated with a ****** Returns the signed-in user's portal profile: { id, firstName, lastName, fullName, email, phone, initials, position, level, role, permissions[], gyms: [{ id, name, branch }], selectedGym, hireDate, employmentType, status }. Derivations: fullName is the employee profile's full name, falling back to the user name when no profile exists (seeded admin); firstName/lastName/initials are derived from that name; branch is the gym's location (Gym.Location); role is the account's user type (TopManagement, HR, Employee); selectedGym echoes the token's gymId claim (null for unscoped tokens, e.g. admin); permissions lists granted keys and is legitimately empty for TopManagement, which bypasses permission checks (ADR-003). Gyms lists every assigned gym regardless of the token's scope. Errors: 401 (missing, invalid, or inactive account).

## Gyms

### GET /api/gyms

Authenticated with a ****** No permission key required. Returns the gyms visible to the signed-in user - every active gym for TopManagement, the assigned gyms otherwise - as [{ id, name, branch, employees }], ordered by name. branch is Gym.Location; employees is the gym's active staff count. The list is not narrowed by the token's selected gym: it is the full set the user may switch between. Errors: 401 (missing, invalid, or inactive account).

## Employees

HR module (S1). All endpoints require a Bearer token; permission keys are checked per gym (TopManagement bypasses permission checks but is still scoped by nothing — it sees everything; HR users are limited to their assigned gyms, and employee-scoped actions 401 when the target employee belongs to a gym the actor cannot access). New accounts created through these endpoints get the shared temp password `Revive!2026` (mirrors the development seeder; rotate on first login is a UI concern).

Deviations from the no-wrapper convention: create and detail return `{ data: <profile> }` because the UI spec (E2/E4) wraps them; every other endpoint returns the DTO directly. Status-change does not deactivate the login account — it only changes the employee's working status (User.IsActive is untouched).

### GET /api/employees

Permission: `employees.view` (gym-scoped). Query: `gym` (optional; HR may only pass assigned gyms, TopManagement may filter any or omit for all), `search` (name/email substring), `status` (Active | On Leave | Suspended | Terminated; invalid → 400), `page`, `pageSize` (default 20, max 100), `sortBy` (name | hireDate | status), `sortOrder` (asc | desc). Returns 200 { items: [{ id, employeeNumber, name, position, level, gymId, gym, status, initials, hireDate, salary, phone, email }], page, pageSize, total, totalPages }. HR with no gym assignments gets an empty list, never the global directory. Errors: 401.

### POST /api/employees

Permission: `employees.create` on the target gym. Request: { firstName, lastName, email, phone?, position, level, salary?, gym, startDate }. Creates the login account (UserType Employee, active), the employee profile, an optional starting Compensation, the UserGymAccess row, an EMP-#### number (highest existing suffix + 1, floored at 1001), and a "Joined Revive" history entry. Returns 200 { data: <profile> }. Errors: 400 (duplicate email, inactive/unknown gym), 401 (no access to the gym).

### POST /api/employees/bulk-import

Permission: `employees.bulk_import`. Multipart file upload (.csv only, max 5 MB) with columns name, email, position, level, gym (name), salary; the first row is skipped as a header when its email cell lacks '@'. Each row is imported or skipped independently (bad email, unknown gym, gym outside the actor's access, duplicate email, unparseable salary) and the response reports counts instead of failing the batch. Returns 200 { message, added, skipped }. Errors: 400 (missing file, wrong extension), 401.

### GET /api/employees/{id}

Permission: `employees.view` on the employee's gym. Returns 200 { data: <profile> } where profile is { id, employeeNumber, name, position, level, gymId, gym, status, initials, hireDate, email, phone, salary (latest), systemRole, branches: [{ id, name, branch }] } — branches lists the gyms the employee's user account may access (gym switcher data). Errors: 401 (other gym), 404 (unknown id).

### PUT /api/employees/{id}

Permission: `employees.edit` on the employee's gym. Request: { name?, position?, status? } — position resolves against the gym's catalog (creates it when missing, level preserved from the current position). Returns 200 <profile> (no wrapper). Errors: 400 (invalid status), 401, 404.

### POST /api/employees/{id}/status-change

Permission: `employees.status.change`. Request: { status, note? }; status is Active | On Leave | Suspended | Terminated (invalid → 400). Writes a "Status Changed" history entry (old → new, note as detail). Does not touch User.IsActive. Returns 200 <profile>. Errors: 400, 401, 404.

### GET /api/employees/{id}/history

Permission: `employees.view`. Returns 200 [{ type, from, to, date, detail }] ordered newest first; type is the display label (Joined Revive, Status Changed, Gym Transfer, Position Changed, Salary Changed, Contract Updated, Role Changed, Offboarded). from/to are the human-readable old/new values; detail is the change note. Errors: 401, 404.

### GET /api/employees/{id}/leave-balance

Permission: `employees.view`. Returns 200 { employeeId, dayOff: { used, total }, sick: { used, total }, unpaid: { used, total } } for the current year; missing rows read as zeros. Errors: 401, 404.

### PUT /api/employees/{id}/leave-balance

Permission: `employees.leave_balance.manage`. Request: { dayOff: { used, total }, sick: { used, total }, unpaid: { used, total } } (0–365 each; pending days are preserved). Upserts the current-year rows. Returns 200 { message }. Errors: 400 (out of range), 401, 404.

### POST /api/employees/{id}/transfer

Permission: `employees.transfer` on both the current and target gyms. Request: { toGym, effectiveDate, reason }. Moves the employee's GymId and re-points the UserGymAccess rows; writes a "Gym Transfer" history entry. Returns 200 { message }. Errors: 400 (same gym, unknown target), 401 (no access to either gym), 404.

### POST /api/employees/{id}/position-change

Permission: `employees.position.change`. Request: { position?, level } — resolves in the gym's catalog, creating the position when missing; a blank level falls back to the employee's current level, and the shared catalog row is never mutated. Writes a "Position Changed" history entry. Returns 200 { message }. Errors: 400 (already on this position and level), 401, 404.

### POST /api/employees/{id}/compensation

Permission: `employees.compensation.manage`. Request: { salary, effectiveDate }. Appends a Compensation row (currency EGP) and a "Salary Changed" history entry; the detail view's salary is the latest effective row. Returns 200 { message }. Errors: 400 (salary below 0), 401, 404.

### POST /api/employees/{id}/contract

Permission: `employees.contract.manage`. Request: { level?, salary?, effectiveDate? } — any subset; level updates the position, salary appends a Compensation, and a "Contract Updated" history entry records what changed. Returns 200 { message }. Errors: 400 (nothing to change), 401, 404.

### GET /api/employees/{id}/documents

Permission: `employees.documents.view`. Returns 200 [{ name, category, status }] — category is the display label (Employment Contract, Identification, Certification, Other) and status is Valid (no expiry, or expiring more than 30 days out) or Expiring Soon. Errors: 401, 404.

### POST /api/employees/{id}/documents

Permission: `employees.documents.manage`. Multipart upload: file (PDF/PNG/JPG/JPEG/WEBP/DOC/DOCX, max 10 MB), category (Employment Contract | Identification | Personal Photo | First Aid | Medical Fitness | Degree Certificate | Other; invalid → 400), expiryDate? (yyyy-MM-dd). Bytes are stored under App_Data/EmployeeDocuments/{id}/ (orphaned files are removed when the row insert fails); expiry drives the Valid/Expiring Soon status. Returns 200 { name, category, status }. Errors: 400 (empty file, wrong type, bad category/expiry), 401, 404.

## Roles & Permissions

HR module (S2). Roles are named permission presets (Role rows with RolePermission joins) managed on the Roles & Permissions admin page; every user carries direct permission overrides (UserPermission) plus everything inherited from their single assigned role (UserRole). All endpoints require a ******; admin actions check the portal-wide keys `team.view` (reads) or `team.manage` (writes), with TopManagement bypassing permission checks (ADR-003). None of these endpoints are gym-scoped — assignment is portal-wide, and gym reach is governed separately by gym access (6.6).

Deviations from the no-wrapper convention (the UI spec wraps these payloads): role create/update/clone return `{ data: <role> }`, Configure returns `{ data: { id, permissions } }`, the catalog and the user-assignment endpoints return `{ data: … }`. The roles list and the role-change message are unwrapped. Created roles are never preset (`isPreset=false`); the system ships no seeded preset roles — Branch Manager / Team Leader etc. are created through 7.2 first (E16 rejects unknown names with 400).

The permission catalog is seeded idempotently by DevelopmentDataSeeder (Development/Testing only): 47 keys across 12 areas from features.md, inserted with isSystem=true when missing and never overwritten. Production deployments must insert the same rows through a migration or deployment script — the catalog endpoint is empty until then. (The UI mock's "42" total is stale; the live denominator is the tracked-catalog count, ≥ 47.)

### GET /api/roles

Permission: `team.view`. Query: `search` (case-insensitive substring of name or description), `page`, `pageSize` (default 20, clamp 1–100). Returns 200 { items: [{ id, name, description, status, permissionsCount, usersCount, isEmpty, isPreset, permissions[] }], page, pageSize, total, totalPages }, ordered by name; status is always "Active" (archived roles are filtered out everywhere), isEmpty marks roles with zero permissions (the "New Role Draft" badge), and permissions lists the role's keys sorted. usersCount is the number of distinct assigned users. Errors: 401.

### POST /api/roles

Permission: `team.manage`. Request: { name, description?, cloneFromRoleId?, permissions? }. Name is required and unique (case-insensitive → 400). cloneFromRoleId copies the source role's permission set (unknown → 404); an explicit permissions array (keys validated against the catalog; unknown keys → 400 listing them) overrides the cloned set; neither produces an empty draft role. Returns 201 { data: <role> }. Errors: 400 (blank/duplicate name, unknown key), 401, 404 (missing clone source).

### PUT /api/roles/{id}

Permission: `team.manage`. Request: { name, description?, permissions? } — keeping the role's own name is allowed, another role's name is a 400. permissions, when present (not null), replaces the whole set (stale joins removed, new keys added). Returns 200 { data: <role> }. Errors: 400, 401, 404.

### PUT /api/roles/{id}/permissions

Permission: `team.manage`. The Configure action: request { permissions: [keys] } replaces the set wholesale (not a merge); keys are validated against the catalog (unknown → 400). Returns 200 { data: { id, permissions } } with the resulting sorted keys. Errors: 400, 401, 404.

### POST /api/roles/{id}/clone

Permission: `team.manage`. Request: { name } (required, unique). Copies the source role's permissions and description into a new non-preset role — the Clone Role modal. Returns 201 { data: <role> }. Errors: 400 (duplicate name), 401, 404.

### DELETE /api/roles/{id}

Permission: `team.manage`. Archives the role (shadow IsDeleted flip; referencing join rows are untouched, and global query filters hide the role from listings and permission resolution alike). Guard: a role assigned to any user is rejected with 400 "Role 'X' is assigned to N user(s). Reassign them before archiving." — archiving must not silently strip access. Returns 204. Errors: 401, 404.

### GET /api/permissions

Permission: `team.view`. One payload, two views: { data: { items: [{ key, area, description }], modules: [{ name, permissions[] }], totalTracked } }. items is the flat catalog for the super-admin grid (ordered by area then key); modules is the same data grouped by area for the My Access matrix; totalTracked is the catalog size (the "28 of 47" denominator; ≥ 47 because tests may add keys). Errors: 401.

### PUT /api/users/{id}/permissions

Permission: `team.manage`. The D12/H5 assignment grid: request { permissions: [keys] } replaces the user's direct overrides wholesale; keys are validated against the catalog (unknown → 400). Returns 200 { data: { userId, roleId, rolePreset, permissions, effectivePermissions, count, gymIds } } — permissions are the direct keys, effectivePermissions adds everything inherited from the assigned role. Errors: 400, 401, 404 (unknown user).

### PUT /api/users/{id}/roles

Permission: `team.manage`. Single-role assignment: request { roleId?, rolePreset? } — roleId assigns that role by id (unknown → 404), rolePreset assigns by name (the wizard's preset dropdown; unknown → 400), and both non-null → 400 ("not both"). Both null — or the wizard's clearing labels "None"/"Custom Granular Overrides" — clears all roles. Returns 200 { data: <assignment> } (shape above). Errors: 400, 401, 404.

### PUT /api/users/{id}/gym-access

Permission: `team.manage`. The H4 replacement set: request { gymIds?: [int], gyms?: [names] } — the union of both addressings becomes the full new access set (the hire wizard sends names, admin tabs send ids); unknown ids or names (not active) → 400, an empty set revokes all access (the wizard enforces its own minimum of one). Rows for gyms that later become suspended are left untouched (only active gyms are addressable). Returns 200 { data: <assignment > gymIds is the resulting set }. Errors: 400, 401, 404.

### POST /api/employees/{id}/role-change

Permission: `employees.role.assign` on the employee's gym (E16 — the employee modal's role & team-permissions block). Request: { systemRole?, permissions? }. systemRole resolves an existing role by exact name; null, blank, or "None (Employee)" clears the role; an unknown name → 400 "Unknown system role 'X'. Create it under Roles & Permissions first." (no preset seeding — create the role via 7.2 first). permissions, when present, replaces the user's direct overrides (keys validated; unknown → 400); null leaves them untouched. Writes a "Role Changed" history entry (from = previous role names or "None (Employee)", to = new role or "None (Employee)", reason "Role change"). The target employee must have a linked user account (404 otherwise — e.g. offboarded). Returns 200 { message: "Role changed." }. Errors: 400, 401 (no permission or other gym), 404.

## Requests

HR module (S3). The request directory and HR decision workflow — the Requests page, the employee-file requests tab, and the HR side of branch approvals. All endpoints require a ******; list/detail/create/archive/restore and the employee tab check `requests.view`, while decide/undo/bulk check `requests.approve` (each validated per request gym, TopManagement bypassing permission checks per ADR-003). Gym scoping mirrors the Employees module: TopManagement sees everything (or may filter by any gym), HR is limited to assigned gyms, and a user with no gyms matches nobody (empty list, never global). Deviations from the no-wrapper convention: list returns `{ items, page, pageSize, total, totalPages }` (the directory envelope; `total` not the mock's stale `totalCount`), create returns 201 `{ data: { id, status, timeline } }`, decide returns `{ message, item, offboardingPrompt? }`, and undo/bulk/archive/restore return `{ message }` (+ counts for bulk). The employee tab returns a plain array. Request rows carry the shadow `CreatedAt` (stamped by metadata) and a nullable `Payment` column.

### GET /api/requests

Permission: `requests.view` (gym-scoped). Query: `gym`, `status` (Pending | Pending HR Review | Approved | Rejected | Archived | Decided; invalid → 400), `type` (the six request types; invalid → 400), `date` (yyyy-MM-dd; matches requests whose span `(TargetStartDate ?? RequestDate)` .. `(TargetEndDate ?? RequestDate)` covers the day), `quick` (urgent | approved | bmRejected | balance; invalid → 400 — urgent flags Resignation/Immediate Termination, approved/bmRejected mirror the branch-manager verdict, balance flags Day Off/Sick with an exhausted current-year balance), `ids` (comma-separated explicit ids — the payroll settlement sheet's linked-requests pane; non-numeric → 400), `page`, `pageSize` (default 20, max 100), `sortBy` (submitted | requested | employee | status; default submitted), `sortOrder` (asc | desc). Returns items `[{ id, employee, gym, type, requestedDate, startDate, endDate, days, reason, status, bmDecision, bmComment, payment, submittedDate, urgent }]` newest-first; status/payment/bmDecision are display strings. Errors: 400 (bad filters), 401.

### GET /api/requests/{id}

Permission: `requests.view` on the request's gym. Returns 200 `{ data: { …list item…, timeline: [{ step, date, done }] } }` — Submitted always done; Branch Manager shows the BM verdict (done) or "Review" pending; HR shows the HR verdict (done) or "Review" pending while the request is awaiting HR. Errors: 401, 404.

### POST /api/requests

Permission: `requests.view` on the resolved employee's gym (creation is a directory action). Request: { employee (exact full name, resolved within the actor's gym scope; 0 or >1 matches → 400), type (Day Off | Sick Leave | Emergency Leave | Unpaid Leave | Resignation | Immediate Termination; invalid → 400), requestedDate (yyyy-MM-dd, required), endDate?, reason? }. Creates the request at Pending HR Review (the HR-created path — no BM stage) and returns 201 `{ data: { id, status, timeline } }`. Errors: 400 (unknown/ambiguous employee, bad type/date), 401.

### POST /api/requests/{id}/decide

Permission: `requests.approve` on the request's gym. The HR verdict (R3/A6). Request: { stage: "HR" (other → 400), decision: "Approved" | "Rejected", comment? (required on reject → 400), payment?: "paid" | "unpaid" }. The request must be Pending HR Review (otherwise 400 with a contextual message). Payment applies only to Day Off/Sick Leave: an explicit value wins; otherwise it is derived from the current-year balance (remaining > 0 → paid, else unpaid). paid deducts the leave span (inclusive days) from the balance row (created with zero entitlement when missing); unpaid leaves it. Approving Resignation sets the employee to Notice Period and returns `offboardingPrompt: true`; approving Immediate Termination does the same with `separationId: null` until the Terminations module (S6) exists. The HR decision row is recorded (branch decisions are untouched). Returns 200 `{ message, item, offboardingPrompt? }` mirroring the mock toasts ("Request approved · paid (balance deducted)"). Errors: 400 (wrong stage/status, reject without comment), 401, 404.

### POST /api/requests/{id}/undo-decision

Permission: `requests.approve`. Request may be empty. Undoes the HR decision (R4): only Approved/Rejected requests qualify (400 otherwise; a past requested date is also rejected — "This request's date has already passed"), the HR decision rows are removed, a paid balance deduction is returned (floored at zero), Resignation + Notice Period reverts the employee to Active, and the request returns to Pending HR Review with its payment cleared. Returns 200 `{ message: "Decision undone · returned to Pending HR Review", item }`. Errors: 400, 401, 404.

### POST /api/requests/bulk-decide

Permission: `requests.approve`. Request: { decision: "Approved" (Rejected → 400), requestIds?: [ids] }. With ids, every request must exist within the actor's scope and be Pending HR Review (404/400 otherwise); without ids it approves every Pending HR Review request in scope. Each request derives its payment per the decide rules (exhausted balances fall to unpaid). Returns 200 `{ message: "Bulk approved", approved, unpaidApplied }`. Errors: 400, 401, 404.

### POST /api/requests/{id}/archive · POST /api/requests/{id}/restore

Permission: `requests.view`. Archive sets the request to Archived; restore derives the pre-archive status from recorded decisions (HR decision → Approved/Rejected, else BM decision → Pending HR Review, else Pending). Returns 200 `{ message }`. Errors: 401, 404.

### GET /api/employees/{id}/requests

Permission: `requests.view` on the employee's gym (A8 — the employee-file requests tab). Returns 200 a plain array of `{ id, employee, gym, type, requestedDate, startDate, endDate, days, reason, status, bmDecision, bmComment, payment, submittedDate, urgent }`, newest-first. Errors: 401, 404.

## Attendance station

Kiosk enrollment is public and rate-limited. `POST /api/kiosk/login` redeems the gym's current six-digit enrollment code - codes are generated server-side (never hardcoded; fetch or rotate them via GET/POST /api/gyms/{gymId}/station-codes) and expire after `StationCode:ExpirationMinutes` (5 minutes). A successful redemption creates a DB-backed station session, returns an opaque session token shown exactly once, and sets that token as an HttpOnly `StationSession` cookie (SameSite=Lax, Secure on HTTPS, Path=/, expiring with the session) - browser kiosks authenticate with the cookie alone and the React SPA never reads or stores the token, while non-browser clients use the `X-Station-Token` header. `GET /api/kiosk/session` restores an enrolled kiosk (401 = not enrolled) and `POST /api/kiosk/logout` revokes the session and clears the cookie; because SameSite=Lax cookies are sent only same-site, production must serve the SPA and API from one site (dev Vite proxy; reverse proxy otherwise) with CORS on explicit origins + credentials. Every subsequent attendance request presents that token via cookie or header (never a station code in the body); the server validates the session (hash lookup, not revoked, not expired, gym active) and derives the GymId from the stored session - never from client input. Attendance records store GymId plus the StationSessionId that issued them.

### POST /api/kiosk/login

Request: { code: "<six-digit enrollment code>" }. Returns 200 { gymId, gymName, token, sessionExpiresAtUtc } and sets the `StationSession` HttpOnly cookie; the token field remains for non-browser clients and is also accepted as `X-Station-Token: <token>`. Unknown, rotated, or expired code: 401 with errorMessage "Invalid or expired station code."; malformed code: 400.

### GET /api/kiosk/session

Restores the kiosk from the `StationSession` cookie or `X-Station-Token` header. Returns 200 { gymId, gymName, sessionExpiresAtUtc } for a live session; 401 when there is no valid session - the station must re-enroll with a code.

### POST /api/kiosk/logout

Revokes the presented session (cookie or header), clears the `StationSession` cookie, and always returns 204, even for an already-invalid session, so a stale cookie can always be removed.

### POST /api/attendance/events

Authenticated with `X-Station-Token` (station session) or a gym-scoped Bearer token. Request fields: employeeId, type (IN or OUT; CHECKIN/CHECKOUT aliases are accepted, and AUTO lets the server pick the direction from the employee's own state - what the always-on kiosk camera sends), livenessScore (0-1, at least 0.70), and optional ISO 8601 timestamp. If omitted, server time is used. Timestamps without an offset are interpreted as UTC. Shift comparisons use the explicitly configured Attendance:TimeZoneId (Africa/Cairo in appsettings), not the host machine timezone. The liveness score must be produced by a trusted biometric verifier; a caller-provided score alone is not biometric proof.

Returns 201 with { recordId, employeeId, employeeName, gymId, gymName, type, method, timestamp, attendanceStatus, shiftComparison }; timestamp is UTC. attendanceStatus reports the persisted status (ONTIME, LATE, or EARLYCHECKOUT). Common errors: 400 validation, type, liveness, future timestamp, or duplicate/invalid attendance transition; 401 expired/revoked/missing station session or gym binding, or gym/schedule mismatch; 404 employee or shift not found; and 429 rate limited.

### POST /api/attendance/manual

Authenticated with `X-Station-Token` (or a gym-scoped Bearer token). Same event fields except no liveness score and with a required reason (3-500 characters); the reason is audited with the attendance change in one database transaction, together with the issuing StationSessionId. The HR-portal day-write form shares this route — a payload carrying `date`/`status`/`checkIn`/`checkOut` is treated as the HR form instead (see **Attendance management (HR)** below).

### GET /api/attendance/station-summary

Authenticated with `X-Station-Token` (station session) or a gym-scoped Bearer token. Today's counters and the most recent events for the station's gym - the kiosk dashboard data. Returns 200 { presentCount, scheduledTodayCount, records: [{ recordId, employeeId, employeeName, status (PRESENT/LEFT/DAY_OFF), lastEventType, lastEventTime, attendanceStatus, method }] }. 401 without a valid, gym-bound credential.

### DELETE /api/gyms/{gymId}/station-sessions

Requires a Bearer access token (TopManagement, or HR assigned to the gym). Revokes every live station session for the gym - enrolled kiosks fall back to the enrollment screen and must redeem a fresh code. Enrollment codes themselves are untouched. Returns 200 { revokedCount }.

## Station-code management

Routes require a Bearer access token. TopManagement can manage codes for any gym. HR can manage codes only for gyms assigned to them. Employees and other users are denied even if they have gym access.

### GET /api/gyms/{gymId}/station-codes

Returns 200 { gymId, gymName, code, generatedAt, expiresAtUtc, generatedBy }. `expiresAtUtc` is when the code stops being accepted (`StationCode:ExpirationMinutes` after rotation; null for development seeds). Inactive gyms return 400; if no code is active, returns 404.

### POST /api/gyms/{gymId}/station-codes

Rotates the code and immediately invalidates the old code - live station sessions keep working until they expire or are revoked. Returns 200 with the same DTO. Possible errors: 400 (inactive gym, validation, or unique-code failure), 401, or 404 (gym not found).

## Face biometrics

Recognition runs in-process inside the API (YuNet detection → Silent-Face anti-spoofing → SFace embedding, all ONNX); there is no external biometric service.

### POST /api/attendance/face-scan

Station-authenticated (`X-Station-Token`, or a gym-scoped Bearer token with the same gym binding as `/events`). Request: { type (IN/OUT/AUTO), image (base64 or data URL), optional timestamp, optional confirmCheckout } - no station code in the body. The frame is detected, liveness-checked and matched against employees with access to the station's gym only; a recognized face is then recorded through the exact `/events` pipeline, so every ADR-004 check applies.

**Every frame-level state is a 200 with an `outcome` discriminator** - 400 is reserved for a frame that cannot be decoded as an image, and 401 for a missing/invalid station session. This lets the station drive a live HUD (liveness percentage, matched name and ID) and tell a silent outcome from one that deserves a card:

| outcome | meaning | kiosk behaviour |
| --- | --- | --- |
| `no_face` | nothing detected in the frame | keep scanning, no card |
| `low_liveness` | face detected, below `Biometrics:ScanLivenessThreshold` (0.70) | keep scanning, no card; `livenessScore` carries the measured value |
| `unrecognized` | live face, no match above `MatchThreshold` (0.50) | keep scanning, no card |
| `already_complete` | recognized, but the day is already closed | **silent** - name/ID in the HUD, no card, loop keeps running |
| `rejected` | recognized but refused (day off, wrong branch, ...) | rejection card; `message` explains why |
| `recorded` | punch written (HTTP **201**) | success card; `attendance` carries it |
| `pending_checkout` | AUTO resolved to check-out; nothing recorded | "Check out now?" prompt |

`employeeId`/`employeeName` are set whenever a face was recognized; `livenessScore` and `similarity` are set on every frame where they were measured. Errors: 400 (undecodable image only), 401 (missing/invalid station session), 429.

**AUTO check-out confirmation**: an AUTO scan that would close the employee's open record returns `pending_checkout` (nothing recorded) unless the request carries `confirmCheckout: true`. The kiosk asks the employee ("check out now?") and re-sends the same frame with the flag; only then is the check-out written. Explicit IN/OUT types and the `/events` integration endpoint (which always passes confirmCheckout=true internally) are never gated.

The liveness score reported here is measured server-side by the anti-spoofing ensemble — unlike `/events`, where a caller-supplied score is trusted only as far as the 0.70 minimum (see the note on that endpoint).

### POST /api/employees/face/enroll

HR-side administration. Requires a Bearer access token; TopManagement may enroll any employee, HR only employees at gyms they are assigned to. Station tokens and employee sessions are rejected with 401. Request: { employeeNumber, image }. One embedding is stored per employee — re-enrolling replaces it. Enrollment liveness must be at least `Biometrics:LivenessThreshold` (0.60 by default). Returns 201 with { employeeId, employeeNumber, fullName, enrolledAt }; 400 (bad image, no face, failed liveness), 401 (role/gym denied), 404 (unknown employee).

### DELETE /api/employees/face/{employeeReference}

Removes the employee's stored embedding. Same authorization as enrollment. Returns 204, or 404 when no embedding exists.

## Attendance management (HR)

The HR pages (directory grid, manual entry, corrections, employee file attendance tab) are composed server-side from stored `AttendanceRecord` rows plus shift assignments, approved Day Off requests, and employment status — mirroring the mock UI's client-side generator. Every row merges one (employee, day): a stored record wins; otherwise the day derives as Suspended → Absent, future → Scheduled, scheduled-off → Off, approved Day Off span → Off, on leave → Off, else Absent. Display statuses: `On Time`, `Late`, `Absent`, `Early Checkout`, `Missing Checkout`, `Off`, and (derived-only, rejected on writes) `Scheduled`. Punches are stored in UTC and displayed as `HH:mm` in the configured `Attendance:TimeZoneId`. Permission keys per ADR-003: `attendance.view`, `attendance.manual_entry`, `attendance.edit`.

### GET /api/attendance

Permission: `attendance.view` (A1 — the directory grid). Query: `date` **or** `from`/`to` (`yyyy-MM-dd`; defaults to today; at most 62 days), `gym`/`gymId` (TopManagement may omit → all gyms; every other role is auto-scoped to its assigned gyms and may request only those), `employeeId`, `status` (display string filter), `page`/`pageSize` (default 20, max 200). Returns 200 `{ items, page, pageSize, total, totalPages }`; each item: `{ id (null for synthesized Off/Scheduled/Absent days), employeeId, name, gym, date, shift, checkIn, checkOut, status, source, notes, correctedBy, correctedAt }` — `correctedBy`/`correctedAt` reflect the record's latest audit correction, `source` is `Manual`/`Biometric` for stored records. Errors: 400 (bad dates, `to` before `from`, range over 62 days), 401 (missing token, no permission, gym outside scope), 404 (`employeeId` unknown).

### POST /api/attendance/manual (HR day-write form)

The route is shared with the station punch form (above); the payload discriminates them — when `date`/`status`/`checkIn`/`checkOut` is present, the HR day-write form (A3/A5) is taken: user token plus `attendance.manual_entry` on the employee's gym. Request: `{ employeeId (id or EMP-number, JSON number or string), date ("yyyy-MM-dd"), checkIn?, checkOut? ("HH:mm"), status (On Time / Late / Absent / Early Checkout / Missing Checkout / Off), reason (3-500 chars) }`. Upserts the (employee, day) record — Absent/Off clear the punches — and returns 201 `{ data: {...grid row...} }`. Errors: 400 (bad date/time/status, short reason, terminated employee, `Scheduled` status), 401 (no permission), 404 (unknown employee).

### PUT /api/attendance/{id}/correct

Permission: `attendance.edit` on the record's gym (A4 — correction with audit trail). Request: `{ checkIn?, checkOut?, status, reason }` (reason ≥ 3 chars). Before the record changes, an `AttendanceCorrection` row preserves the original punches/status plus the editing user and a UTC `correctedAt`; the record then takes the new values with `notes` prefixed `Corrected:`. Returns 200 `{ data: {...grid row with correctedBy/correctedAt...} }` (the editor's profile full name, falling back to the username). Errors: 400 (short reason, bad status/time), 401, 404 (unknown record).

### GET /api/attendance/{id}

Permission: `payroll.view` **or** `attendance.view` (§5.5 — the punch audit behind an attendance ref on the payroll settlement sheet). The `{id}` is an attendance ref (`"ATT-123"`) or a bare record id. Returns 200 `{ data: { id, date, firstIn, lastOut, device, exception, detail } }` — `id` normalized to `ATT-{recordId}`, `device` the terminal source (Biometric | Manual), `exception` the display status (On Time | Late | Absent | Early Checkout | Missing Checkout), `detail` the record notes. Errors: 401 (no permission / wrong gym), 404 (unknown or non-numeric ref).

### GET /api/employees/{id}/attendance

Permission: `attendance.view` on the employee's gym (A7 — the employee file's Attendance tab). Query: `month` (`yyyy-MM`, defaults to the current month), `page`/`pageSize` (default 31). Only elapsed days are returned (future days are omitted, not shown as Scheduled). Returns 200 `{ items: [{ date, shift, checkIn, checkOut, status, notes }], totals: { total, present, late, absent, off, hours, expected }, page, pageSize, total, totalPages }` — `present` counts On Time + Late + Early Checkout + Missing Checkout; `hours` is summed worked time and `expected` summed scheduled shift duration (both to 2 decimals; overnight spans roll past midnight). Errors: 401, 404 (unknown employee).

### POST /api/gyms/{gymId}/biometric-devices/pairing-codes

Same authorization as station-code management (A10 — the Pair Biometric Device modal): TopManagement any gym, HR only assigned gyms. Request: `{ stationLabel }` (echoed back). Rotates the gym's six-digit enrollment code (invalidating the old one — identical to `POST /api/gyms/{gymId}/station-codes`) and returns 200 `{ code, gymId, gymName, stationLabel, generatedAt, expiresAt }`; the code is valid for `StationCode:ExpirationMinutes` (10 minutes) and is redeemed by the kiosk at `POST /api/kiosk/login`. Errors: 400 (inactive gym), 401, 404 (gym).

## Recruitment & hiring

HR module (S5.1). Vacancies, vacancy requests, the candidate pipeline, interviews, the waiting list, the hire wizard, and the New Comers onboarding checklist. All endpoints require a Bearer token and are gym-scoped per ADR-003 (TopManagement bypasses permission checks and sees everything; every other role is intersected with its assigned gyms — an empty scope lists nobody, never everybody). Permission keys: `recruitment.view` (reads), `recruitment.vacancies.manage` (vacancy create/update), `recruitment.candidates.manage` (stages, block, interviews, waiting-list removal, the §5.2 applicant pane + conversion), `recruitment.vacancy_request.create` (Branch-Manager submit), `recruitment.vacancy_request.approve` (decide/reopen), `recruitment.hire.approve` (hire, waiting-list assign, onboarding checklist). §5.2 adds an anonymous public route on this resource (`POST /api/applications`), per-IP rate-limited by the `public-forms` policy.

Model notes: the pipeline is one card per Application (the normal case is one application per candidate; candidate detail resolves the latest application). Stage moves are recorded as PipelineStage rows and bump the application's last-activity clock, which drives follow-ups (stale = no movement for over 5 days in a non-terminal stage). **Hired is only reachable through the hire wizard** — moving a stage to Hired returns 400 — so a Candidate becomes an Employee (account + profile + onboarding checklist + history + audit row) atomically with the Hired transition (PROJECT.md rule 6). Hired decrements the vacancy headcount and closes the vacancy at zero. Deviations from the no-wrapper convention: list envelopes use `{ items, page, pageSize, total, totalPages }` (the directory envelope used by Employees/Requests — `total`, not the mock's stale `totalCount`); creates return 201 `{ data: ... }`; stage/block/complete/decide echo `{ data: ... }`.

### GET /api/vacancies

Permission: `recruitment.view`. Query: `gym` (optional), `status` (Open | Draft | Closed), `searchTerm` (title/position/gym substring), `page`, `pageSize` (default 20, max 100), `sortBy` (createdDate [default, newest first] | position | headcount), `sortOrder` (asc | desc). Returns 200 `{ items: [{ id, positionId, position, gymId, gym, headcount, urgency, status, createdDate, candidates, requestedBy, salary, shift, source, description, requirements }], page, pageSize, total, totalPages }`. `candidates` counts non-rejected applications; `requestedBy` is the opening user's display name. Errors: 401.

### GET /api/vacancies/{id}

Permission: `recruitment.view` on the vacancy's gym. Returns 200 `{ data: <vacancy>, funnel: [{ stage, count }], employeesUnderPosition: [{ id, name, initials, position, gym }], candidates: [<candidate card>] }` — the detail modal's data. Errors: 401, 404.

### POST /api/vacancies

Permission: `recruitment.vacancies.manage` on the target gym. Request: `{ position, gym | gymId (name or id; resolved within the actor's accessible gyms), headcountNeeded?, urgency? (Low | Medium | High), source?, jobDescription?, requirements?, salary?, shift?, status? (Open [default] | Draft) }`. The position resolves against the gym's catalog (created at level 1 when missing). Returns 201 `{ data: <vacancy> }` with a fresh public-link token. Errors: 400 (missing position, unknown gym/urgency/status), 401.

### PUT /api/vacancies/{id}

Permission: `recruitment.vacancies.manage` on the vacancy's gym. Partial update — same fields as create, all optional (moving `gym` re-resolves the position there). Returns 200 `{ data: <vacancy> }`. Errors: 400, 401, 404.

### GET /api/vacancy-requests

Permission: `recruitment.view`. Query: `status` (Pending | Approved | Rejected), `gym`, `page`, `pageSize`. Returns 200 `{ items: [{ id, positionId, position, gymId, gym, urgency, status, submittedBy, submittedDate, reason, salary, shift, headcount, decidedBy, vacancyId }], page, pageSize, total, totalPages }`, newest first. Errors: 401.

### POST /api/vacancy-requests

Permission: `recruitment.vacancy_request.create` on the actor's gym (the Branch-Manager submit). Request: `{ position, gym | gymId, urgency?, reason, salary?, shift?, headcount? }`. Returns 201 `{ data: <request> }` with status Pending. Errors: 400, 401.

### PUT /api/vacancy-requests/{id}/decide

Permission: `recruitment.vacancy_request.approve`. Request: `{ decision: Approved | Rejected, comment?, positionId?, headcountNeeded?, urgency?, salary?, shift?, jobDescription? }`. Approval creates the resulting public Vacancy from the request's fields (the decide body may override headcount/urgency/salary/shift/description; `source` is "Vacancy Request") and links it as `vacancyId`. Returns 200 `{ data: <request with status + decidedBy + vacancyId> }`. Errors: 400 (already decided, unknown position, invalid decision), 401, 404.

### PUT /api/vacancy-requests/{id}/reopen

Permission: `recruitment.vacancy_request.approve`. Returns the request to Pending (clears decidedBy/at/comment) and withdraws the vacancy created by the approval **only while it has no applicants**. Returns 200 `{ id, status: "Pending", decidedBy: null, vacancyWithdrawn }`. Errors: 400 (already pending), 401, 404.

### GET /api/candidates

Permission: `recruitment.view`. Query: `searchTerm` (name/email/phone/position), `stage` (Applied | Screening | First Interview | Second Interview | Accepted | Rejected | Hired), `position`, `view` (active = in-process, non-blocked | rejected), `blocked` (true | false), `page`, `pageSize`, `sortBy` (applied [default] | name), `sortOrder`. Returns 200 `{ items: [<candidate card>], page, pageSize, total, totalPages }` where a card is `{ id, applicationId, name, initials, position, stage, appliedDate, phone, rating, blocked, blockReason, hiredDate, rejectedDate, rejectedBy, rejectReason, form: { email, source, gymPref, expYears, education, skills[], languages[], shift, salaryExp, availability }, screen, iv1, iv2: { date, by, verdict, eval, type, room, notes } | null, decision: { by, date, verdict, note } | null }`. Errors: 401.

### GET /api/candidates/{id}

Permission: `recruitment.view` on the candidate's latest application gym. Returns 200 `{ data: <candidate card> }`. Errors: 401, 404 (unknown candidate, or candidate with no applications).

### PUT /api/candidates/{id}/block

Permission: `recruitment.candidates.manage`. Request: `{ blocked, blockReason? }` — blocked candidates are excluded from the active pipeline and cannot be re-applied/hired. Returns 200 `{ id, blocked, blockReason }`. Errors: 401, 404.

### POST /api/candidates

Permission: `recruitment.candidates.manage` on the applicant's preferred branch (org-wide when none typed). The §5.2 **"Add to Pipeline" conversion**: request `{ applicationId }`. Creates the Candidate (name/email/phone from the submission; `skills` from the careers payload) plus a **vacancy-less pipeline Application** (`VacancyId = null`, `position` = typed position ?? the form's, `source` = careers `source` ?? `"Hiring Form — {form name}"` em dash, careers fields carried with defaults expYears 0 / education `""` / languages `[]` / shift "Any" / salaryExp 0 / availability "Immediate", preferred branch = the typed `gym`), then flips the applicant row to `Moved to Pipeline`. Returns 201 `{ data: <candidate card — stage Applied, rating coerced to 0, screen/iv1/iv2/decision null>, applicationStatus: "Moved to Pipeline" }`. The vacancy-less card appears in `GET /api/candidates` like any other. Errors: 400 (missing applicationId, already converted), 401, 404.

### GET /api/applications

Permission: `recruitment.candidates.manage`; rows are gym-filtered by the typed preferred-branch name (rows with no branch are org-wide). Query: `formId`, `status` (New | In Review | Shortlisted | Rejected | Moved to Pipeline — exact match, unknown value = empty), `searchTerm` (name/email/phone substring), `page`, `pageSize` (default 20, max 100). Returns 200 `{ items: [{ id, name, email, phone, gym, formId, formName, position, appliedDate, status, rejectComment, answers: [{ question, type, answer (string | string[] | null) }] }], page, pageSize, total, totalPages }`, newest first. Errors: 401.

### GET /api/applications/{id}

Permission: `recruitment.candidates.manage` on the preferred branch (org-wide when the applicant typed none). Returns 200 `{ data: <applicant> }` — full answer structure + reject comment + position/branch/status. Errors: 401, 404.

### PUT /api/applications/{id}/reject

Permission: same gate as the detail. Request `{ comment? }`. Marks the applicant `Rejected` (idempotent) and stores the comment. Returns 200 `{ data: { id, status: "Rejected" } }`. An already-converted row is 400 ("already in the pipeline"). Errors: 400, 401, 404.

### POST /api/applications

**Anonymous** — the public hiring-form submission (§5.2), `[AllowAnonymous]` + per-IP rate limit (`public-forms` policy, `RateLimiting:PublicFormPermits`, default 30/min → 429). Request `{ formId (required), name (required), email (required, must contain "@"), phone?, gym? (simple form) | gymPref? (careers form — wins over gym), position?, answers?: [{ question, type, answer? (string | string[]) }], source?, expYears?, education?, skills[]?, languages[]?, shift?, salaryExp?, availability? }`. The form must exist and be **Open**; blocked-candidate emails are refused (§5.1.3 gate). Creates the applicant row (`Status = "New"`, answers JSON-stored, careers extras in `careersJson`) and bumps the form's `lastUsed`. Returns 201 `{ message: "Application submitted." }`. Errors: 400 (missing formId/name/email, invalid email, closed form, blocked email), 404 (unknown form), 429.

### PUT /api/applications/{id}/stage

Permission: `recruitment.candidates.manage` on the vacancy's gym. Request: `{ stage }` — any valid stage, forward or backward; each move is recorded as a PipelineStage row and refreshes the follow-up clock. Entering Rejected stamps rejectedAt/by; entering Accepted stamps the decision. Entering Second Interview without one auto-schedules a Panel round (returned as `iv2`). Hired returns 400 pointing at the hire wizard. Returns 200 `{ id, stage, iv2 }`. Errors: 400 (unknown stage, Hired), 401, 404.

### POST /api/applications/{id}/hire

Permission: `recruitment.hire.approve`. The Hired transition. Request: `{ gym | gymId? (defaults to the vacancy's gym), offerLetterNote?, salary?, annualIncrease?, leaveDays?, startDate?, contractType?, level?, email? (defaults to the candidate's), password? (defaults to the shared temp password), role? (system role name — unknown name = 400), vacancyId? }`. Creates the User account (must have a unique email), the Employee profile (application/interview data carried, EMP-#### number, CandidateId link), the gym-access row, an optional Compensation, the employment-history entry, the five-item onboarding checklist, and an "Employee Hired from Recruitment" audit row; flips the application to Hired (stage + hiredDate), decrements the vacancy headcount (closing the vacancy at zero), and assigns the system role when given. Returns 201 `{ data: { employeeId, name, position, level, gym, status, startDate, email, salary, leaveDays, role, newComerId, hiredDate, vacancyHeadcountRemaining } }`. Errors: 400 (already hired, blocked candidate, duplicate email, unknown role/gym), 401, 404.

### GET /api/recruitment/follow-ups

Permission: `recruitment.view`. Query: `page`, `pageSize`. Returns 200 `{ items: [<candidate card>], page, pageSize, total, totalPages }` — in-process applications with no stage activity for more than 5 days (oldest first). Errors: 401.

### GET /api/recruitment/waiting-list

Permission: `recruitment.view`. Query: `position`, `page`, `pageSize`. Returns 200 `{ items: [{ id (application id), candidateId, name, position, skills[], note, since, source, matchingVacancies: [{ id, position, gym, headcount, urgency, candidates }] }], page, pageSize, total, totalPages }` — applications parked with WaitingList status; matches are open vacancies with a partial position match (either direction). Errors: 401.

### POST /api/recruitment/waiting-list/{id}/assign

Permission: `recruitment.hire.approve`. The 3-step assign wizard: Request `{ vacancyId?, position?, gym | gymId?, startDate?, salary?, annualIncrease?, leaveDays?, level?, email?, password?, role? }`. Runs the same hire transition as POST /applications/{id}/hire (the entry leaves the list because it is now Hired). Returns 201 `{ data: { employeeId, name, position, level, gym, startDate, waitingListRemoved: true, newComerId } }`. Errors: 400 (not waiting, already hired, duplicate email), 401, 404.

### DELETE /api/recruitment/waiting-list/{id}

Permission: `recruitment.candidates.manage`. Removes the entry from the waiting list (soft delete). Returns 204. Errors: 400 (not waiting), 401, 404.

### GET /api/interviews

Permission: `recruitment.view`. Query: `month` (`yyyy-MM`) or `date` (`yyyy-MM-dd`), `status` (all [default] | pending | completed | cancelled), `candidateId`, `page`, `pageSize` (default 50), `sortBy` (scheduledDate default), `sortOrder`. Returns 200 `{ items: [{ id, candidateId, candidate, position, gym, date ("yyyy-MM-dd"), time ("HH:mm"), scheduledDate, type, interviewer, status, room, verdict, evaluation }], page, pageSize, total, totalPages }`, chronological. Errors: 401.

### GET /api/interviews/{id}

Permission: `recruitment.view` on the interview's gym. Returns 200 `{ data: <interview> }`. Errors: 401, 404.

### POST /api/interviews

Permission: `recruitment.candidates.manage` on the candidate's application gym. Request: `{ candidateId | candidate ("Name — Position" label), position?, date ("yyyy-MM-dd"; defaults today), time ("HH:mm"; defaults 10:00), type? (On-site | Video | Trial | Panel), interviewer? (user email/username — resolved to the account when possible, otherwise kept as a display name), room? }`. The round defaults to First Interview, or Second Interview when a first round already exists. Returns 201 `{ data: <interview> }` with status Scheduled. Errors: 400 (unknown candidate), 401.

### PUT /api/interviews/{id}/complete

Permission: `recruitment.candidates.manage`. Marks the interview Completed (first completion stamps `completedAt`) and refreshes the application's follow-up clock. Returns 200 `{ data: <interview> }`. Errors: 401, 404.

### POST /api/interviews/{id}/reminder

Permission: `recruitment.candidates.manage`. Sends the interviewer a RecruitmentFollowUp notification when the interviewer is a system user. Returns 200 `{ message: "Reminder sent." }`. Errors: 401, 404.

### GET /api/employees/new-comers

Permission: `recruitment.view`. Returns 200 `{ items: [{ id, name, initials, position, startDate, progress, checklist: [[label, done], …] }] }` — employees hired within the last 30 days or still carrying an incomplete onboarding checklist, at the actor's gyms; `progress` is percent complete. The checklist ships five seeded items (ID & contract signed, Uniform issued, System access created, Branch tour completed, Welcome meeting with BM). Errors: 401.

### PUT /api/employees/{id}/onboarding-checklist

Permission: `recruitment.hire.approve` on the employee's gym. Request: either a single toggle `{ item, done? }` (unknown label = 400) or a batch `{ checklist: [[label, done], …] }` (labels not yet on the checklist are appended). Returns 200 `{ data: { id, progress, checklist: [[label, done], …] } }`. Errors: 400, 401, 404.

## Notifications & announcements

HR module (S5.7). The inbox is strictly the signed-in user's own rows (a JWT is enough — no permission key); announcements are gated and gym-scoped per ADR-003. Composing fans out one notification per targeted user titled `Announcement: {title}` — those fan-outs are both the delivery mechanism and the read-rate denominator, and retracting (status `Cancelled`) deletes them.

### GET /api/notifications

Query: `unread` (true = only unread), `category` (Requests | Recruitment | Document | System | Announcements), `page`, `pageSize` (default 20, max 100). Returns 200 `{ items: [{ id, category, title, description, date, read, color, link }], page, pageSize, total, totalPages }`, newest first; `color` is the badge tone (yellow | green | blue | red | purple) and `link` the page id for "Open →". Errors: 401.

### GET /api/notifications/unread-count

Returns 200 `{ count }` — the header bell badge. Errors: 401.

### PUT /api/notifications/read-all

Marks every unread notification read. Returns 200 `{ message }`. Errors: 401.

### PUT /api/notifications/{id}/read

Marks one owned notification read (another user's row → 404). Returns 200 `{ id, category, title, description, date, read, color, link }`. Errors: 401, 404.

### GET /api/announcements

Permission: `announcements.view`. Query: `gym`, `status` (Draft | Scheduled | Sent | Cancelled), `page`, `pageSize`. Returns 200 `{ items: [{ id, title, audience, sentDate, status, readRate, message }], page, pageSize, total, totalPages }`, newest first; `readRate` is the percent of the fan-out rows already read (0–100, one decimal). Errors: 401.

### POST /api/announcements

Permission: `announcements.manage`. Request: `{ title (required), audience ("All Employees" [default] | branch name | any label), type? (Policy Update | Event | Reminder | Recognition [default]), message (required) }`. A branch name targets that gym's members; other labels preserve the card label and fan out to every active user. Returns 201 `{ data: { id, title, audience, type, message, sentDate, status: "Sent", readRate: 0 } }`. Errors: 400 (missing title/message), 401.

### PUT /api/announcements/{id}

Permission: `announcements.manage`. Partial update — `{ title?, audience?, type?, message?, status? (Sent | Cancelled) }`. `status: "Cancelled"` retracts the announcement and deletes its fan-out notifications (delivery stops, the read-rate denominator drops). Returns 200 `{ data: <announcement card> }`. Errors: 401, 404.

## My Access profile

### GET /api/users/{id}

Auth: a JWT — a user's own id always, another user's id requires `team.view`. Returns 200 `{ data: { id, email, role, permissions[], gyms: [{ id, name, branch }], effectivePermissions[], grantedCount, trackedCount } }` — the My Access card: direct permission keys, assigned gyms (name + location as branch), direct ∪ role permissions for the matrix, and the granted-vs-tracked counters behind the summary bar. `role` is the primary role name, falling back to the user-type label when role-less. Errors: 401, 404.

## Reports, positions & audit

HR module (S5.9). Three support screens: the overview CSV export, the org-wide positions catalog, and the read-only activity log — all gym-scoped per ADR-003 with TopManagement unrestricted.

### GET /api/reports/export

Permission: `reports.view`. Query: `period` (30d [default] | 90d | ytd), `format` (`csv` [default]). Returns 200 `text/csv` stream (`Section,Metric,Value` rows covering Workforce, Attendance, Requests, Hiring, Positions, Payroll, Separations for the window) with a `revive-reports-{period}-{stamp}.csv` file name. Errors: 401.

### GET /api/positions

Permission: `positions.view`. Query: `gym`, `searchTerm` (title substring), `active` (true = only active rows). Returns 200 `{ items: [{ id, title, levels[], department, gym, headcount, active, open, fill }], total }` — the catalog is one row per Position; `levels` splits the stored level string, `active` is the number of active employees holding the row, `open = max(headcount − active, 0)` and `fill` is the percent filled (0 when headcount is 0). Errors: 401.

### POST /api/positions

Permission: `positions.manage`. Request: `{ title (required), levels[] (chips; defaults to ["Junior"]), department? (created at the gym when missing), gym | gymId (required), headcount?, active? (default true) }`. Returns 201 `{ data: <position> }`. Errors: 400 (missing title, unknown gym), 401.

### PUT /api/positions/{id}

Permission: `positions.manage`. Partial update — `{ title?, levels[]?, department?, gym | gymId?, headcount?, active? }`. Returns 200 `{ data: <position> }`. Errors: 400, 401, 404.

### GET /api/audit-log

Permission: `audit.view`. Query: `action` (All Actions [default] | Employee | Payroll | Recruitment | Bulk Import — mapped onto the recorded entity types), `gym`, `user` (acting user id), `from`, `to` (ISO timestamps), `page`, `pageSize` (default 20, max 100). Returns 200 `{ items: [{ id, action, user, target, detail, timestamp, gym }], page, pageSize, total, totalPages }`, newest first: `user` is the actor's display name, `target` the `Entity #id` label, `detail` a truncated digest of the new-values snapshot, `gym` the tagged gym (or "All Gyms" for org-wide rows, which stay visible to every audited reader). Read-only. Errors: 401.

## Payroll

HR module (S5.5). Periods are per-gym rows (one branch × one month); the UI status vocabulary derives from the entity lifecycle — `Open` stays Open, publish & lock moves the period to `Locked` → "Published", and a set `paidDate` shows "Paid". Money is always recomputed server-side: gross = base + bonus + OT pay where OT pay = (base/176)×1.5×hours, deductions = lines with status Accepted|Approved (Pending excluded), net = gross − deductions. Permission keys: `payroll.view` (reads), `payroll.edit` (settlement writes + line review), `payroll.approve` (publish & lock), `payroll.export` (CSV). Reads resolve the actor's gym scope; writes enforce access to the period's gym (ADR-003, TopManagement unrestricted).

### GET /api/payroll-periods

Permission: `payroll.view`. Query: `gym`, `status` (Open | Partially Published | Published | Paid — the derived status), `page`, `pageSize` (default 20, max 100). Returns 200 `{ items: [{ id, period, status, locked, paidDate, publishedGyms[], totalEmployees, totalGross, totalDeductions, totalNet }], page, pageSize, total, totalPages }`, newest month first; `period` is the month label (`"August 2026"`), `publishedGyms` lists the branch once published, and the totals sum the period's entries. Errors: 401.

### GET /api/payroll-periods/{id}

Permission: `payroll.view`. Query: `gym` (must match the period's branch when given). Returns 200 `{ data: { …period…, items: [ …entry sheets… ] } }`, ordered by employee name. Entry item: `{ employeeId, name, initials, gym, position, employmentStatus, days, overtime, baseSalary, bonus, gross, deductions, net, status (Draft | Reviewed | Locked), reviewed, relatedRequestIds[], deductionLines: [{ id, date, label, reason, source (biometric | manager), amount, status (Pending | Accepted | Approved | Rejected), attendanceRef, requestId }] }`. `attendanceRef` is `ATT-{recordId}` for stored punches, `ATT-MANUAL` for ad-hoc biometric lines, else `""`. Errors: 401, 404.

### PUT /api/payroll-periods/{periodId}/entries/{employeeId}

Permission: `payroll.edit` on the period's gym; the only editable field while the period is open. Request: `{ bonus }` (required, ≥ 0). Returns 200 `{ data: { employeeId, bonus, gross, deductions, net } }`. Errors: 400 (locked period, missing/negative bonus), 401, 404 (unknown entry).

### POST /api/payroll-periods/{periodId}/entries/{employeeId}/deductions

Permission: `payroll.edit`; the inline Add-Line form on an open period. Request: `{ source ("manager" | "biometric"), reason (required), amount (required, > 0) }`. Creates a `Pending` line dated today (`attendanceRef` `ATT-MANUAL` for biometric). Returns 201 `{ data: { id, date, label, reason, source, amount, status: "Pending", attendanceRef, requestId, entry: { gross, deductions, net, pendingCount } } }` — pending lines do not yet count toward deductions/net. Errors: 400 (locked period, bad source/amount, missing reason), 401, 404.

### POST /api/payroll-periods/{periodId}/entries/{employeeId}/close · …/reopen

Permission: `payroll.edit`. Close settles one sheet — refused (400) while any line is still `Pending` — setting status `Reviewed` + `reviewedAt`; reopen returns it to `Draft` (rejected on a locked period). Returns 200 `{ data: { employeeId, status, reviewed, reviewedAt?, gross, deductions, net } }` (reopen omits `reviewedAt`). Errors: 400 (pending lines / locked), 401, 404.

### POST /api/payroll-periods/{id}/approve

Permission: `payroll.approve`. Request: `{ gym }` (branch name or `gymId`) — must be the period's gym. Publishes & locks the branch: every entry must be `Reviewed` (otherwise 400 with the unsettled count), then the period becomes `Locked`, entries become `Locked`, and an audit row (`Payroll Published`) is written. Returns 200 `{ data: { id, status: "Published", locked: true, publishedGyms: [gym], message } }`. Errors: 400 (wrong branch, already published, nothing to publish, unsettled sheets), 401, 404.

### GET /api/payroll-periods/{id}/payslips/{employeeId}

Permission: `payroll.view` on the period's gym. Returns 200 `{ data: { period, gym, employee: { employeeId, name, position }, baseSalary, overtime, overtimePay, bonus, gross, deductions: [{ label, reason, source, amount, status }], net, days, status } }` — all lines listed with statuses; `net` only counts Accepted|Approved. Errors: 401, 404.

### GET /api/payroll-periods/{id}/export

Permission: `payroll.export`. Query: `gym` (must match when given), `format` (`csv` [default]; `pdf` → 400 — not supported). Returns 200 `text/csv` (`Employee, Employee ID, Position, Base Salary, OT Hours, OT Pay, Bonus, Gross, Deductions, Net, Status` rows, one per entry) as `payroll-{month}-{branch}.csv`. Errors: 400, 401, 404.

### GET /api/deduction-candidates

Permission: `payroll.view` **or** `payroll.edit` — the pending-lines review queue (every `PayrollEntryLineItem`, not a separate table). Query: `gym`, `period` (period id **or** month label — unknown label → empty), `status` (Pending | Accepted | Approved | Rejected; blank = all), `page`, `pageSize` (default 20, max 100). Returns 200 `{ items: [{ id, employeeId, employeeName, gym, period, date, label, reason, source, amount, status, attendanceRef, requestId }], page, pageSize, total, totalPages }`, newest line first. Errors: 401.

### POST /api/deduction-candidates/{id}/review

Permission: `payroll.edit`; the period must still be open. Request: `{ decision }` — `"Accepted"` (Approve) or `"Rejected"` (Waive); anything else → 400. The line takes the decision, `reviewedBy`/`reviewedAt` are stamped, and the entry's totals recompute. Returns 200 `{ data: { id, status, amount, entry: { employeeId, gross, deductions, net, pendingCount } } }`. Errors: 400 (locked period, bad decision), 401, 404.

### GET /api/employees/{id}/payroll

Permission: `payroll.view` (entries limited to the actor's gym scope). Returns 200 `{ items: [ …entry shape + period label… ] }` — one sheet per period, newest month first. Errors: 401, 404 (unknown employee).

## Evaluations & form builder

HR module (S5.3 + S5.4). The form builder handles both kinds of forms but as **two resources**: evaluation templates (`/api/evaluation-forms`, question rows, dispatchable) and hiring forms (`/api/hiring-forms`, question JSON, published publicly by §2) — there is no `kind=` union. All ids are plain integers (the mock's `ef-…`/`hf-…` string prefixes are not used). Question type map: UI `text` → `Rating5` (no options), `choose` → `MultipleChoice` (≥ 2 options), `checkbox` → `Checkbox` (≥ 2 options); form status vocabulary `Active | Completed | Inactive` stays synced to `IsActive`, hiring status `Open | Closed`. Permission keys: `evaluations.view` (all reads), `evaluations.forms.manage` (form CRUD), `evaluations.manage` (dispatch, launch, free-run submit, goal create). Lists resolve the actor's gym scope (ADR-003); forms with no gym ("All") are visible under every scope.

### GET /api/evaluation-forms

Permission: `evaluations.view`. Query: `gym`, `status` (Active | Completed | Inactive), `position` (matches the `target` title, case-insensitive), `page`, `pageSize` (default 20, max 100). Returns 200 `{ items: [{ id, name, position, target?, gym, status, questions, questionList: [{ type, text, options[] }], createdDate, lastUsed?, submissions }], page, pageSize, total, totalPages }`, newest form first. Errors: 401.

### POST /api/evaluation-forms

Permission: `evaluations.forms.manage`. Body: `{ name (required), position?, gym? (name or gymId; "All" → null), status? (default "Active"), questionList: [{ type?, text (required), options[] }? ] (≥ 1) }`. Returns 201 `{ data: { …form card… } }` with the question rows echoed. Errors: 400 (missing name/unknown status, no questions, empty question text, unknown type, choice question with < 2 options, unknown gym), 401.

### GET /api/evaluation-forms/{id}

Permission: `evaluations.view`. Returns 200 `{ data: { …form with questionList… } }`. Errors: 401, 404.

### PUT /api/evaluation-forms/{id}

Permission: `evaluations.forms.manage`. Same body as POST; **replaces** the whole question list (old rows are deleted). Returns 200 `{ data: { …form… } }`. Errors: 400, 401, 404.

### DELETE /api/evaluation-forms/{id}

Permission: `evaluations.forms.manage`. Returns 204. Blocked with 400 once any evaluation response exists — "set its status to Inactive instead" (deviation from the mock's silent delete: responses keep a non-nullable FK to the form). Questions and assignments are removed with the form. Errors: 400, 401, 404.

### GET /api/hiring-forms

Dual-mode (§5.2 public careers view). **Authenticated** (`evaluations.view`): the admin card list as before, gym scope per ADR-003. **Anonymous** (no token): Open forms only (the `status` query is forced to `Open` — `status=Closed` cannot opt in), unscoped, `gym` matched by branch name or id (unknown gym = empty list, no error). Query: `gym` (id or name), `status` (Open | Closed — admin only), `position` (exact, case-insensitive), `page`, `pageSize`. Returns 200 `{ items: [{ id, name, position, gym, status, questions, questionList[], createdDate, lastUsed?, applicants }], … }` — `applicants` counts rows in `HiringFormApplications`. Errors: 401 (authenticated without the permission).

### GET /api/hiring-forms/{id}

Same dual mode: anonymous visitors only ever see **Open** forms (404 otherwise); authenticated (`evaluations.view`) sees any status. Returns 200 `{ data: <form with questionList> }`. Errors: 401, 404.

### POST /api/hiring-forms · PUT /api/hiring-forms/{id}

Permission: `evaluations.forms.manage`. Body: `{ name (required), position?, gym?, status? ("Open" default), questionList (≥ 1, same validation as evaluation forms) }`. Returns 201 `{ data: { … } }` / 200 `{ data: { … } }`. Errors: 400, 401, 404 (PUT).

### DELETE /api/hiring-forms/{id}

Permission: `evaluations.forms.manage`. Returns 204 — blocked with 400 while applications exist ("close it instead of deleting it"; deviation from the spec's "applicants remain unlinked": `HiringFormApplication.HiringFormId` is a required FK). Errors: 400, 401, 404.

### POST /api/evaluation-forms/{id}/dispatch

Permission: `evaluations.manage`. Routes a running form to every **eligible evaluator**: active users (other than the caller) holding any of `evaluations.manage | evaluations.manage.team | evaluations.view.team | team.manage`, or TopManagement. Subjects are Active employees in the evaluator's gym scope matching the form's gym (null = all branches) and target position (null/"All" = any), excluding the evaluator themself; existing (form, subject, evaluator) rows are skipped, so dispatch is idempotent. Only `Active` forms dispatch (400 otherwise). Writes an `Evaluation Dispatched` audit row when anything was created. Returns 200 `{ data: { formId, createdAssignments: [{ id, formId, formName, evaluatorEmail, evaluatorName, subjects[], completedSubjects[], status, dispatchedDate, dispatchedBy }], routedEvaluators, evaluationsAssigned } }` where the group `id` is the lowest assignment-row id (the same id the inbox shows) and the counters cover this dispatch only. Errors: 400, 401, 404.

### GET /api/evaluation-assignments

Permission: **any of** the four evaluator keys above (or TopManagement) — the signed-in evaluator's `MY EVALUATIONS` inbox. Query: `formId`, `status` (Assigned | Completed — the card status), `page`, `pageSize`. Returns 200 `{ items: [ …assignment card shape above… ], … }` grouped per form (one card per form, newest dispatch first); `subjects` lists all assigned names, `completedSubjects` those whose rows are `Completed`, and `evaluatorEmail` is the caller's. Errors: 401.

### POST /api/evaluation-forms/{id}/responses

Permission: `evaluations.manage` **or** the caller holds an assignment row for this form (the assigned-holder path lets keyless evaluators submit their own reviews). Body: `{ employee (unique active name) | employeeId, formId?, form?, period?, score? (0–100), notes?, assignmentId?, answers: [{ question, type?, answer }?] }` — answers are matched to the form's questions **by text** and stored JSON-encoded (the `jsonb` column); unknown texts are skipped. Free-run defaults `notes` to "Evaluation completed with standard scoring."; unknown/inactive employees → 400, out-of-range score → 400, subject outside the actor's gym scope → 401. With `assignmentId`, the caller's row for that subject flips to `Completed` and links the response — the card completes when every row is `Completed`. Returns 201 `{ data: { id, employee, form, formId, period, score, status: "Completed", notes, reviewedBy, reviewedDate, answers[], gym }, assignment: { id, completedSubjects[], status } | null }`. Errors: 400, 401, 404.

### POST /api/evaluation-forms/{id}/launch-cycle

Permission: `evaluations.manage`; the `Launch Cycle for All Eligible` action (only `Active` forms). Request: `{ period (required, e.g. "Q3 2026") }`. Seeds one `In Progress` response (no score) per eligible subject — Active employees matching the form's gym/position within the actor's scope — skipping subjects that already have an `In Progress`/`Completed` row for the same (form, period), so relaunching is idempotent. Finds-or-creates one `PerformanceCycle` chip named after the period (status `In Progress`). Returns 201 `{ data: { batchId, startedCount, status: "In Progress" } }`. Errors: 400 (missing period / non-active form), 401, 404.

### GET /api/evaluation-responses

Permission: `evaluations.view`. Query: `gym`, `employeeId`, `formId`, `period`, `status` (Completed | In Progress), `page`, `pageSize`. Returns 200 `{ items: [{ id, employee, form, formId, period?, score?, status, notes?, reviewedBy, reviewedDate, answers: [{ question, type, answer }], gym }], … }`, newest submission first; answers are batch-loaded for the page and decode to plain text. Errors: 401.

### GET /api/evaluation-forms/{id}/responses

Permission: `evaluations.view` — same shape with `formId` forced to the route id. Errors: 401, 404 (unknown form).

### GET /api/employees/{id}/evaluations

Permission: `evaluations.view` (employee must be inside the actor's gym scope). Returns 200 `{ items: [{ id, employee, position, period?, score?, result, status, gym, form, formId }] }` — `result` is derived: score ≥ 60 → `"Pass"`, < 60 → `"Below Target"`, no score → `"Pending"`. Errors: 401, 404.

### GET /api/performance-cycles

Permission: `evaluations.view`. Returns 200 `{ items: [{ id, name, start, end, status }] }` (DateOnly ISO dates), newest start first. Errors: 401.

### GET /api/goals

Permission: `evaluations.view`. Query: `page`, `pageSize`. Returns 200 `{ items: [{ id, employee, title, status ("On Track"), progress, due?, owner }], … }`, newest first. Errors: 401.

### POST /api/goals

Permission: `evaluations.manage`. Body: `{ title (required), employee?, due? (yyyy-MM-dd), owner? }` — `employee` is a display name resolved to `employeeId` when exactly one employee matches (otherwise kept verbatim); `owner` defaults to the actor's display name. Returns 201 `{ data: { …goal… } }` with `status: "On Track"`, `progress: 0`. Errors: 400 (missing title, unparsable due), 401.

## Events queue, separations & escalated requests

HR module (S5.6 + S9.4). One **sync-on-read queue**: every `GET /api/events` derives the org-wide set from its sources (expiring documents & contracts within 45 days, requests pending HR review, resignation/termination cases, transfer tickets awaiting a decision, open vacancy requests, unpublished payroll periods), then upserts `Events` rows keyed by the unique `(Type, EntityType, EntityId)` triple — new rows are inserted, changed titles/dates refreshed, vanished sources pruned. Rows are then gym-scoped + per-type permission-filtered **in memory** and ordered by due date ASC. The list envelope carries the mock's tab `counts` and a `hidden` counter (in-scope events the caller may not see). Urgency derives from days-to-due: ≤ 7 high, ≤ 14 medium, else low; resignation requests are always high, vacancy requests age-based (≥ 14 days open → high, ≥ 7 → medium). Per-type governing permission: DocumentExpiry → `employees.documents.manage`, ContractExpiry → `employees.contract.manage`, RequestPendingHRReview → `requests.approve`, Resignation/Termination → `employees.offboard`, TransferRequest → `employees.transfer`, VacancyRequestPending → `recruitment.vacancy_request.approve`, PayrollApproval → `payroll.approve` (TopManagement bypasses). Separations share one case core: E19 (offboard action) and T2 (Branch-Manager termination request) both create an `OffboardingCase` with the five-task exit checklist — one open case per employee. Action requests are the `ActionRequest` rows the Escalated tab renders; approve **executes the proposed effect** and marks the row `Approved` (deliberate fix of the mock, which leaves it pending after a successful approval). Deviations from the mock, all documented: finalize sets the employee to **Terminated** (mock: Suspended) and **deactivates their login**, `requestedBy` is the caller's role label (mock hard-codes "Branch Manager" for T2), termination `reason` and `notes` are stored separately (mock concatenates them), and a `BulkImport` request with a label-like source only audits (only CSV-newline payloads import).

### GET /api/events

Permission: `events.view` (gym scope per ADR-003). Query: `gym` (`all` [default] | branch id | branch name — unknown name/id → 400 "Gym not found."), `type` (comma-separated tab words: `Document Expiry, Contract Expiry, Requests, Leaving, Transfer Tickets, Vacancy Requests, Payroll Approval` — unknown tokens match nothing), `urgency` (high | medium | low), `resolved` / `state` (`true`/"Resolved" = the "View resolved (n)" list, default open only), `page`, `pageSize` (default 20, max 100). Returns 200 `{ items: [<batch payload>…], counts: { documents, contracts, requests, leaving, transfers, vacancies, payroll: { open, resolved } }, hidden, page, pageSize, total, totalPages }`. Batch payloads share `{ id, type, tab, urgency, permission, raisedBy, dueDate, resolved, gym, employee, employeeId, position }` plus per-type extras: documents `[{ title, docType, docNo, expiresOn, daysLeft, editableByEmployee, detail }]`, contracts `[{ title, expiresOn, detail }]`, requests `[{ title, detail, submittedOn, vrUrgency? }]` (`vrUrgency` only on resignation/termination cards — that card's `tab` is "leaving"), transfers `[{ title, actionRequestId, fromGym, toGym, proposedOn }]`, vacancies `[{ title, position, headcount, gym, submittedOn, detail }]`, payroll `[{ title, period, grossTotal, preparedOn (null — periods carry no creation date), detail }]`. `raisedBy` is the requesting user's display name. The queue is refreshed on every read — `total` is the in-scope visible count; `hidden` counts filtered-out rows for the tab badge. Errors: 400 (unknown gym), 401.

### GET /api/events/counts

Permission: `events.view`. Returns 200 `{ data: { documents, contracts, requests, leaving, transfers, vacancies, payroll: { open, resolved } } }` — open events per tab for the actor's gym scope (or the `gym` query, same vocabulary as the list), resolved counts from the stored overlay. Errors: 400, 401.

### POST /api/events/{id}/resolve · POST /api/events/{id}/reopen

Permission: `events.view` **and** the event type's governing key on its gym. Resolve stamps `ResolvedBy/ResolvedAt` and syncs the per-tab resolved count; reopen clears both (idempotent). Returns 200 `{ data: { id, type, resolved, resolvedBy, resolvedAt } }`. Errors: 401 (either gate), 404.

### POST /api/events/{id}/renewal-request

Permission: the DocumentExpiry governing key (`employees.documents.manage`). **Documents only** (contract expiry → 400 — renew a contract through the employee's contract action). Notifies the employee (renewal-request category) and audits "Document Renewal Requested". Returns 201 `{ data: { id, notifiedUserId, notificationId } }`. Errors: 400 (wrong type), 401, 404.

### POST /api/events/{id}/decide

Permission: `employees.transfer` (transfer tickets only — any other event type → 400 "Only transfer tickets accept a decision — use resolve for the other queues."). Request `{ decision: "approve" | "reject", comment?, targetGym? }` — approve moves the employee via the transfer action (destination resolved by branch **name** from `targetGym`, falling back to the payload's `toGym`; unknown → 400) and writes the "Gym Transfer Executed" audit; the destination-gym access rule belongs to the transfer action itself. Reject stores `comment` (required). Both mark the underlying `ActionRequest` `Approved`/`Rejected` and resolve the event row; an already-decided request → 400. Returns 200 `{ data: { id, eventId, decision, status, actionRequestId, employeeId, gym } }`. Errors: 400 (wrong type, bad decision, unknown gym, already decided), 401, 404.

### GET /api/separations

Permission: `employees.view` (gym scope). Query: `gym` (id or name — unknown → 400), `status` (Requested | Notice Period | Exit In Progress | Under Review | Completed), `type` (Resignation | Termination), `page`, `pageSize` (default 20). Returns 200 `{ items: [{ id, employee, employeeId, position, gym, lastDay, reason, requestedBy (role label: HR Manager | Branch Manager | Top Management), requestedByUser (display name), submittedDate, status, separationType, progress (percent of the checklist), checklist: [[label, done]…] (five exit tasks), verdict (null until T5), leaveTaken }], page, pageSize, total, totalPages }`. Errors: 400 (unknown gym), 401.

### GET /api/separations/{id}

Permission: `employees.view` on the case's gym (another branch → 401). Returns 200 `{ data: <separation> }` with the T5 verdict shape `{ finalReason, settlement: { direction (none | owedToEmployee | employeeOwes), amount, note }, rehire: { status (Eligible | Banned), note } }`. Errors: 401, 404.

### POST /api/separations

Permission: `employees.offboard` — T2, the Branch-Manager termination request. Request `{ employeeId (required), lastDay (required), reason (required — closed vocabulary, case-insensitive: Performance issues, Attendance violations, Misconduct / policy breach, Contract expiry — not renewing, Restructuring / redundancy), notes? }` (reason and notes stored separately). Creates the case as `Requested`/`Termination` with the five-task checklist; the employee's standing does **not** change yet (one open case per employee → 400). Returns 200 `{ data: <separation — status "Requested"> }`. Errors: 400 (bad vocabulary, duplicate open case), 401, 404.

### POST /api/employees/{id}/offboard

Permission: `employees.offboard` — E19, the mock's `submitInitiateOffboarding`. Request `{ lastDay (required), reason (required), notes?, separationType? ("Resignation" [default] | "Termination" — derived from the reason when omitted: any reason containing "resign" → Resignation, containing "terminat"/"performance"/"attendance" → Termination; a non-Resignation type must be justified as Termination) }`. Creates the case as `Notice Period` and parks the employee in Notice Period (employment-history row). Returns **201** `{ data: { separationId } }`. Errors: 400 (invalid type/reason), 401, 404.

### PUT /api/separations/{id}/checklist

Permission: `employees.offboard` — T3. Request `{ index (0–4), done }`. Ticking moves a `Requested`/`Notice Period` case to `Exit In Progress` (unticking never regresses the stage); unknown index → 400. Returns 200 `{ data: { id, progress, status, checklist } }`. Errors: 400, 401, 404.

### PUT /api/separations/{id}/stage

Permission: `employees.offboard` — T4. Request `{ status }` — one of the five vocabulary words (anything else → 400); `Completed` auto-ticks the whole checklist and stamps the completion date (idempotent when already Completed). Returns 200 `{ message }`. Errors: 400, 401, 404.

### PUT /api/separations/{id}/verdict

Permission: `employees.offboard` — T5. Request `{ finalReason (required), settlement: { direction, amount, note? }, rehire: { status, note? } }` — direction must be `none | owedToEmployee | employeeOwes`, rehire `Eligible | Banned` (else 400). Moves the case to `Under Review` (a `Completed` case keeps its status). Returns 200 `{ message: "Exit verdict saved." }`. Errors: 400, 401, 404.

### POST /api/separations/{id}/finalize

Permission: `employees.offboard` — T6. Gates: the whole checklist must be done (else 400) and a verdict must exist (else 400). Archives the employee: status `Terminated` (deliberate deviation — the mock sets Suspended), an `Offboard` employment-history row, and the **login is deactivated** (`isActive = false`). Returns 200 `{ message: "Separation completed for {employee}." }`. Errors: 400 (gates), 401, 404.

### GET /api/action-requests

Permission: `events.view` **or** any of the ACTION_TYPES meta keys (`employees.transfer`, `employees.compensation.manage`, `employees.role.assign`, `employees.offboard`, `employees.bulk_import`) — rows are then filtered to the action types the caller actually holds (plus gym scope; TopManagement sees all). Query: `gym` (id or name — unknown → 400), `status` (Pending | Approved | Rejected), `actionType` (Transfer | CompensationChange | RoleAssign | Offboard | BulkImport), `page`, `pageSize` (default 20). Returns 200 `{ items: [{ id, employeeId, employee, position, ActionType, proposedDetails: { fromGym, toGym (branch NAMES — approve resolves the destination to an id), effectiveDate, currentSalary, newSalary, systemRole, lastDay, reason, source }, justification, requestedById, requestedBy (display name), status, submittedDate, reviewedById, reviewedBy, reviewedDate, reviewComment }], page, pageSize, total, totalPages }`. There is no create endpoint (E20 out of scope). Errors: 400 (unknown gym), 401.

### PUT /api/action-requests/{id}/approve

Permission: the row's own action-type key on its gym. Executes the proposed effect — Transfer → gym move + "Gym Transfer Executed" audit, CompensationChange → new compensation + "Compensation Updated", RoleAssign → system role (must already exist; "System Role Assigned"), Offboard → `Notice Period` separation case + employee parked in Notice Period ("Offboarding Initiated"), BulkImport → CSV payloads (`\n` + `,`) import via the bulk-import action, label-like sources audit "Bulk Import Executed" only, blank source → 400. Marks the row `Approved` (an already-decided row → 400). Returns 200 `{ data: { id, status: "Approved", reviewedBy, reviewedDate, executed, reviewComment? } }`. Errors: 400 (already decided, blank source), 401 (wrong action key / unknown destination), 404.

### PUT /api/action-requests/{id}/reject

Permission: same gate as approve. Request `{ comment (required) }` — no comment → 400. Marks the row `Rejected` **without executing anything** and audits `{Label} Request Rejected` (Transfer Gym | Compensation Change | Role Assign | Offboard | Bulk Import) with the summary + comment in the detail. Returns 200 `{ data: { id, status: "Rejected", reviewedBy, reviewedDate, executed: false, reviewComment } }`. Errors: 400 (missing comment, already decided), 401, 404.

## OpenAPI

The generated OpenAPI document is available at /swagger/v1/swagger.json in Development. Controller response metadata lists success and expected error statuses; DTO source files define request validation and response fields.
