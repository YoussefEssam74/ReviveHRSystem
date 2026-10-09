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
