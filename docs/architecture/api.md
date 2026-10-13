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

Returns { year, balances: { Annual: { total, used, pending, remaining }, Sick: ..., Emergency: ..., Unpaid: ... } } — only types with a row are present. Submitting a Day Off request reserves days in `pending`; cancelling releases them; approval consumes them (management side).

### GET /api/employees/{id}/schedule

Published schedule. Query: month (YYYY-MM). Returns { month, cycles: [{ id, start, end, status }], days: [{ date, dayName, shiftName, start, end, isOff, isToday }] }. Published cycles only (roles guide).

### GET /api/employees/{id}/requests · POST /api/employees/{id}/requests

List filters by optional `status` (Pending | PendingHRReview | Approved | Rejected | Cancelled). Create body: { type, requestDate, endDate?, requestTime?, endTime?, swapWithEmployeeId?, overtimeHours?, documentCategory?, reason } where `type` is a request-type id or label (see GET /api/request-types). Returns 201 with the request. 400 for missing type/reason. Day Off requests reserve annual leave days.

### GET /api/requests/{id}

Detail with the approval timeline: [{ step, date, done }]. 404 for another employee's request.

### POST /api/requests/{id}/cancel

Self-only, Pending requests only. 204; 400 for non-pending requests; releases reserved leave days.

### GET /api/request-types

Configurable catalog: [{ id, label, fields }] — day-off, leave-early, late-arrival, shift-swap, overtime, document-request, correction. Authentication required; not user data.

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

Edits type/dates/reason of a pending request on behalf of an in-scope employee. 204. Feature: requests Edit.

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

Authenticated with `X-Station-Token` (or a gym-scoped Bearer token). Same event fields except no liveness score and with a required reason (3-500 characters); the reason is audited with the attendance change in one database transaction, together with the issuing StationSessionId.

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

## OpenAPI

The generated OpenAPI document is available at /swagger/v1/swagger.json in Development. Controller response metadata lists success and expected error statuses; DTO source files define request validation and response fields.
