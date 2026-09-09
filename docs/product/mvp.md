# MVP Definition

## Objective

Prove the core business lifecycle (Recruitment → Hiring → Employee → Scheduling → Attendance) and the authorization architecture (User Type → Role → Permissions → Gym Access) in a production-ready, multi-gym environment.

The MVP is **functionally complete** when a real end-to-end hiring and employee scenario can be executed securely across multiple gyms with enforced permission and gym-scope isolation.

---

## MVP Users

### Top Management (Super Admin)

Can:
- Access all gyms and the central platform
- Create and manage gyms, departments
- Create and manage users (HR, HR Manager, Branch Manager)
- Create, clone, and archive roles
- Assign/revoke permissions for any user
- Assign/revoke gym access for any user
- View organization-wide dashboards and reports
- Create/edit/archive vacancies (governance, not operations)
- View audit logs and system activity
- Manage system settings

### HR Manager

Can:
- Work across assigned gyms (multi-gym scope)
- Perform any HR function for which they hold the specific permission
- This is NOT a fixed capability set — two HR Managers can have completely different permissions
- Typical areas: recruitment, employee management, attendance, schedules, requests, payroll oversight

### HR

Can:
- Work across assigned gyms (multi-gym scope)
- Perform HR operations for which they hold the specific permission
- Similar to HR Manager but typically fewer permissions (configurable, not assumed)

### Branch Manager (Employee + Role)

Can:
- Manage team within their own gym only
- Review/approve employee requests (if permitted)
- Manage schedules (if permitted)
- Follow up on attendance issues (if permitted)
- **Request** a new vacancy for their gym (creates a Vacancy Request that HR must approve — the Branch Manager cannot open a vacancy directly; see features.md §5a)
- **Offboard** a subordinate directly if granted `employees.offboard` (no separate approval step — same as HR's offboarding action)
- Submit their own **Resignation** as a self-service request (they are also an Employee), routed to HR like any other request
- **Cannot** do anything beyond their granted permissions

### Team Leader (Employee + Role)

Can:
- Everything a Regular Employee can do for themselves, plus:
- View their team's roster, attendance, and schedule (if permitted)
- Follow up on team requests, and approve/reject them only if explicitly granted `requests.approve.team` (in practice this is more often reserved for Branch Manager or HR)
- View/manage team evaluations (if permitted)
- **Cannot** act on employees outside the team(s) they lead
- May lead more than one team, and an employee may belong to more than one team

### Employee

Can:
- View own profile, employment info, and documents
- View own attendance history and current schedule
- View own payroll history
- View own evaluations
- Submit requests (9 types, as enabled)
- Receive notifications
- If assigned to two gyms, choose which gym's account to sign into at login (see ADR-002-authentication.md)

---

## MVP Modules

### 1. Authentication (Critical)
- Login with email/username + password
- JWT access tokens + refresh token rotation
- Logout / session invalidation
- Password reset
- Account lifecycle (active, locked, disabled)

### 2. Authorization (Critical)
- User Type → Role → Permission → Gym Access model
- Granular, per-feature permissions (not role-based shortcuts)
- Gym-scoped data isolation
- Permission-driven UI rendering (navigation, buttons, actions)
- Effective authorization = intersection of permissions + gym access

### 3. Gym Management (Critical)
- Create/edit/archive gyms
- Assign HR users to gyms
- Each gym defines its own:
  - Positions/levels (independent catalog per gym)
  - Shift templates and times
  - Shift cycle length (configurable: 7, 10, 14 days, etc.)

### 4. User Management (Critical)
- Create/edit/disable users
- Reset passwords
- Assign roles and permissions
- Assign gym access
- Preview effective access for any user

### 5. Recruitment & Hiring (Critical)
- **Vacancy Requests**: Branch Manager (or any user with `recruitment.vacancy_request.create`) requests a new position for their gym; HR approves/rejects; only Approve leads to an actual Vacancy being created (see features.md §5a)
- **Vacancies**: gym-scoped, create/edit/close, with a **headcount needed** field (e.g. "20 Trainers") so the sidebar can show applicant/hired progress per role
- **Candidates/Applications**: public application link, candidate profiles
- **Recruitment Pipeline**: Kanban — Applied → Screening → 1st Interview → 2nd Interview → Final Decision → (Hired / Waiting List / Rejected)
- **Follow-up Engine**: every active candidate must have a current stage + required next action; system detects stalled candidates and generates alerts
- **Waiting List**: accepted candidates with no current vacancy
- **Hire Action**: Candidate → Employee transition with linked history; originating Branch Manager notified if hire came from his Vacancy Request; new hire lands in a **New Comers** tab (dedicated view in HR Operations) until an onboarding checklist is complete

### 6. Employee Module (Critical)
- Profile management (personal + employment info)
- Documents (upload, expiry tracking)
- Employment history timeline (transfers, promotions, role changes, compensation changes)
- Manual employee creation (for existing staff migration, rehires)
- Bulk import via CSV

### 7. Employee Lifecycle Actions (Critical)
Each action is independently permission-gated:
- **Transfer Gym** — move employee between gyms, preserving history
- **Change Position/Level** — promotion/demotion within gym's catalog
- **Assign/Change System Role** — e.g., grant Branch Manager role
- **Change Status** — Active / On Leave / Suspended / Terminated
- **Manage Compensation** — salary changes, history preserved
- **Manage Contract** — contract type, start/end, expiry alerts
- **Offboard** — guided end-of-service process

### 8. Scheduling (Critical)
- **Cycle-based** system (NOT weekly templates)
- Configurable cycle length per gym
- Schedule grid: employees × days in cycle, each cell = shift assignment
- Fully custom shift templates per gym (e.g., Morning 8:00–16:00, Evening 16:00–00:00, Off)
- Copy previous cycle as starting point
- Conflict warnings (double-booked, understaffed, overlaps with approved leave)
- Publish action (draft → live)
- Past cycle history

### 9. Attendance (Critical)
- **Face ID biometric integration** for check-in/check-out
- Manual fallback when Face ID fails (whoever is at the computer can enter)
- Attendance evaluated against effective schedule
- Statuses: On-time, Late, Absent, Early checkout, Missing checkout
- Manual correction by authorized users (reason required, audit trail)
- Repeated-issue flagging (e.g., 3+ lates in a cycle)

### 10. Employee Requests (High)
11 request types — **⚠️ DRAFT, subject to final business confirmation before seeding**:

| # | Type | Key Fields |
|---|------|------------|
| 1 | Leave / Vacation | Date range |
| 2 | Leave Early | Specific time |
| 3 | Day Off | Single date |
| 4 | Sick Leave | Date(s), optional document upload |
| 5 | Late Arrival Permission | Time |
| 6 | Shift Swap | Swap with named colleague |
| 7 | Emergency Leave | Date, reason (required) |
| 8 | Document Request | e.g., salary certificate |
| 9 | General Inquiry / Complaint | Free text |
| 10 | Resignation / Employee Leaving | Intended last working day, reason — self-initiated, any employee including Branch Manager (see features.md §9) |
| 11 | Overtime | Date, hours requested, reason — only counts toward Payroll once Approved |

> **Implementation note:** Store `Type` as a string/varchar, NOT a C# enum, until the list is finalized.

**Two-stage approval (all types):** Employee → Submit → `Pending` →
Branch Manager decides (if assigned; requires `requests.approve.branch`)
→ `PendingHRReview` → HR makes the FINAL decision (requires
`requests.approve`) → Approved/Rejected → Notification to employee and
BM → History. If no BM is assigned, the request skips straight to HR.

### 11. Employee Self-Service Portal (High)
- My Profile
- My Documents
- Employment History
- My Attendance
- My Schedule
- My Payroll
- My Evaluations
- My Notifications
- My Requests

### 12. Payroll History (Medium)
- View-only payroll per gym per pay period
- Base salary, auto-calculated deductions (linked to attendance), bonuses, net pay
- HR-approved deduction flow: Attendance → Deduction Candidate → HR Review → Approve/Reject → Payroll History
- Payslip preview per employee
- Export (CSV/PDF)
- **NOT a full payroll calculation engine** — that's post-MVP

### 13. Notifications (High)
- **System-triggered, per-user** notifications only (in-app, MVP)
- Recruitment follow-up alerts
- Request status updates
- Attendance issues
- Contract expiry warnings
- Shift cycle ending warnings
- Announcement delivery (see module 16)

### 14. Audit & Activity Logs (High)
- Every permission/access change logged
- Every employee lifecycle action logged
- Every attendance correction logged
- Every approval/rejection logged with actor + timestamp
- Viewable by Top Management and any user with `audit.view` permission

### 15. Leave Balance (High)
- Per-employee, per-leave-type balance tracking (Annual, Sick, Emergency)
- Balance shown on employee self-service profile (Leave Balance tab)
- Balance shown inline when employee submits a leave request
- Balance shown on HR's request detail panel (context for approval decision)
- HR can edit `TotalEntitlement` with `employees.leave_balance.manage` permission
- Used/Pending days updated automatically on request submission/decision

### 16. Teams & Team Leader (Critical — MVP)
- Sub-gym `Team` grouping of employees within a gym
- HR/Branch Manager compose teams and assign one or more Team Leaders per team (`team.manage`)
- Team Leader role preset (Employee + Role, same pattern as Branch Manager)
- Team-scoped permission variants (`attendance.view.team`, `schedule.view.team`, `requests.view.team`, `requests.approve.team`, `evaluations.view.team`, `evaluations.manage.team`) — individually granted, not implied by the role
- "My Team" dashboard widget + sidebar entry for Team Leaders
- A leader can lead multiple teams; an employee can belong to multiple teams; effective team scope is the union across all teams led

### 17. Announcements — HR Broadcasts (Medium)
- HR authors broadcast messages to a defined audience (gym, department, role, or individual)
- Supports immediate send or scheduled delivery
- Delivered as a Notification to each matched recipient
- HR can view announcement history (who authored, when sent, audience, status)
- Employees can read announcements in their notification inbox
- Gated by `announcements.manage` (create/send) and `announcements.view` (history)

---

### 18. Events — HR Action Queue (High)
- New sidebar page: a single queue of Open items needing HR action (distinct from the informational Notification bell)
- Triggers: document/contract expiry, Resignation/BM-initiated termination needing HR follow-up, pending Vacancy Requests, requests sitting in `PendingHRReview` after BM's stage-1 decision
- Row-level visibility follows the permission of the underlying entity; HR marks items Resolved

### 19. Evaluations — Custom Form Builder (Medium)
- Replaces a fixed criteria/score template with HR-authored forms
- Question types: Rating (1–5), Multiple Choice, Checkbox
- Different forms per Gym and/or Position
- Gated by `evaluations.manage` (build + run) / `evaluations.view` (read-only)

### 20. UX Additions (Medium)
- **HR login gym picker**: HR users with 2+ gyms see a gym picker as their starting view after login; the existing in-app Gym Context Switcher still works afterward — no session lock, no re-login required to switch
- **Dashboard redesign**: visual/UX pass on HR and Employee-based dashboards for clearer hierarchy and faster access to action items — no AI/ML, no new backend logic
- **Notifications dropdown redesign**: visual refresh only, stays a dropdown (Events, above, is the separate actionable surface)

## Out of Scope (NOT in MVP)

See [out-of-scope.md](out-of-scope.md) for the full list. Key exclusions:

- Full payroll calculation engine
- Advanced performance/evaluation workflows
- Advanced analytics and BI dashboards
- Multiple biometric hardware vendors
- Email/SMS notification channels
- Complex end-of-service automation
- Large-scale workflow designer
- Advanced recruitment analytics
- Mobile native app
- Multi-company SaaS (this is single-tenant for Revive Solutions)
