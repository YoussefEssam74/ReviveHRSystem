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

## Current State: **Login + Attendance APIs implemented**

Web login (email/password → access token), station login (6-digit code → gym), and
attendance events/manual (6-digit code auth, ADR-004 validation) are implemented,
secured (rate limits, gym-scoped station codes, security headers), documented, and
covered by 44 integration tests. See handoff notes in the 2026-10-07 session summary.

**Key decisions applied 2026-10-07:**
- Attendance/station auth depends ONLY on the 6-digit station code — no deviceId, no device token (ADR-004 amended)
- Access-token-only login (no refresh tokens — RefreshTokens table was removed)
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
- [x] Domain entities defined (DomainLayer) — all module entities exist
- [x] EF Core entity configurations (Persistence)
- [x] PostgreSQL DbContext configured
- [x] Initial migration created + applied (AlignHrSchema … Add_StationCodes, Fix_TeamLeader_Composite_Fk)
- [ ] Permission catalog seeded
- [x] Default Super Admin seeded (Development seeder: admin@revive.hr + 2 gyms + station codes + 3 test employees)

## Phase 3: Authentication
- [x] Login endpoint (POST /api/auth/login + login/select-gym for 2-gym employees)
- [x] JWT token generation (access-token-only)
- [ ] Refresh token rotation — **removed by decision** (RefreshTokens table dropped; revisit only if sessions need extending)
- [ ] Logout endpoint
- [ ] Password reset
- [ ] Account lockout — mitigated for now by auth-login rate limiting (10/min/IP)

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
- [ ] Candidate → Employee conversion
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
- [x] Biometric integration boundary — station login + events API (6-digit station code auth, no device token)
- [x] Manual check-in/check-out (POST /api/attendance/manual, reason audited, method=Manual)
- [x] Basic schedule comparison at event time (OnTime / Late / EarlyCheckout vs shift template)
- [ ] Full status engine (Absent, MissingCheckout sweeps — scheduled job)
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
- [x] Integration test suite — 44 tests: login/kiosk/attendance/station-code coverage matrix + IDOR (gym-scope) + rate-limit regressions + face-enrollment authorization (Tests/ReviveHRSystem.IntegrationTests)
- [ ] Authorization tests (permission system — pending Phase 4)
- [x] Cross-gym isolation tests (CROSS_GYM_ACCESS_DENIED, WRONG_BRANCH_SCHEDULE, SCHEDULED_DAY_OFF, GYM_ACCESS_DENIED)
- [ ] Workflow integration tests
- [ ] Audit log verification (manual-entry reason audit covered by test)
- [ ] Security review — 2026-10-07 pass on the login/attendance surface (IDOR + brute-force + headers fixed; see session report)

## Phase 16: Deployment
- [ ] Docker containerization
- [ ] PostgreSQL production setup
- [ ] Backup strategy
- [ ] SSL/TLS configuration
- [ ] Monitoring setup
