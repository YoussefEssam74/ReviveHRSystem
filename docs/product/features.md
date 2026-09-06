# Features

## 1. Authentication

### Login
User provides:
- Email or username
- Password

System:
1. Validates credentials
2. Creates JWT access token (short-lived)
3. Creates refresh token (HttpOnly cookie or secure storage)
4. Returns authenticated session
5. Redirects to role-appropriate dashboard

### Logout
1. Invalidates refresh token
2. Clears client session
3. Redirects to login

### Password Reset
1. User requests reset
2. System sends reset link/code (in-app for MVP, email later)
3. User sets new password
4. All existing sessions invalidated

### Account Lifecycle
- Active: can login
- Locked: temporarily blocked (failed attempts)
- Disabled: cannot login (admin action)

---

## 2. Authorization

### Permission Model
- Permissions are granular, per-feature (not role-based tiers)
- Two users with the same role can have completely different permissions
- Roles are permission presets to speed up onboarding — the source of truth is individual permission grants

### Permission Catalog (confirmed areas)

> **Note:** This table is the seeding source of truth. Any new feature that needs permission-gating must add its keys here before implementation.

| Area | Permission Keys |
|------|----------------|
| Employees | `employees.view`, `employees.create`, `employees.edit`, `employees.transfer`, `employees.position.change`, `employees.role.assign`, `employees.status.change`, `employees.compensation.manage`, `employees.contract.manage`, `employees.offboard`, `employees.documents.view`, `employees.documents.manage`, `employees.bulk_import`, `employees.leave_balance.manage` |
| Positions | `positions.view`, `positions.manage` |
| Recruitment | `recruitment.view`, `recruitment.vacancies.manage`, `recruitment.candidates.manage`, `recruitment.hire.approve`, `recruitment.vacancy_request.create`, `recruitment.vacancy_request.approve` |
| Attendance | `attendance.view`, `attendance.edit`, `attendance.manual_entry` |
| Schedule | `schedule.view`, `schedule.manage` |
| Requests | `requests.view`, `requests.approve` |
| Payroll | `payroll.view`, `payroll.edit`, `payroll.approve` |
| Evaluations | `evaluations.view`, `evaluations.manage` |
| Reports | `reports.view` |
| Announcements | `announcements.view`, `announcements.manage` |
| Audit Logs | `audit.view` |
| Teams | `team.view`, `team.manage`, `attendance.view.team`, `schedule.view.team`, `requests.view.team`, `requests.approve.team`, `evaluations.view.team`, `evaluations.manage.team` |

> **Team-scoped keys** (suffixed `.team`) are distinct from their gym-wide counterparts (e.g. `attendance.view.team` vs `attendance.view`). They exist so a Team Leader can be granted visibility/action limited to their own team's members, without touching the existing gym-wide checks used by HR/HR Manager/Branch Manager. See ADR-003-authorization.md for the scope-resolution logic.

> **`attendance.manual_entry`** is separate from `attendance.edit` — manual_entry is for the on-site operator recording a failed Face ID; edit is for HR correcting a past record.

### Gym Access
- A user may be assigned access to specific gyms
- Data queries are always filtered by the user's gym access scope
- Cross-gym data leakage must be impossible at the API level

### Effective Authorization
```
Can user do X on data Y?
= User has permission X
  AND data Y belongs to a gym in user's access scope
```

---

## 3. Gym Management

### Create Gym
Top Management provides:
- Gym name
- Location/address
- Contact information
- Status (active/inactive)

### Gym Configuration
Each gym independently owns:
- **Positions catalog** — the list of job titles/grades (Trainer, Senior Trainer, Front Desk, etc.)
- **Shift templates** — named shifts with start/end times (Morning 8:00–16:00, Evening 16:00–00:00, etc.)
- **Shift cycle length** — configurable (7, 10, 14 days, etc.)
- **Departments** (if applicable)

### Gym Lifecycle
- Active: normal operations
- Inactive/Archived: no new operations, historical data preserved

---

## 4. User Management

### Create User
Top Management provides:
- Full name, email, contact
- User Type (Top Management / HR Manager / HR)
- Role assignment (from available roles)
- Permission grants (individually selectable)
- Gym access assignment (one or more gyms)

### Role Management
- Create named roles (e.g., "HR Coordinator", "HR Manager")
- Each role = a preset bundle of permissions
- Assigning a role applies its permissions as a starting point
- Individual permissions can be added/removed after role assignment
- Clone role, archive role

### Access Preview
- For any user, show: their assigned gyms + their effective permissions = what they can actually do and where

---

## 5. Recruitment & Hiring

### Vacancy Requests (Branch Manager → HR) — §5a
- A Branch Manager (or any user with `recruitment.vacancy_request.create`) can request a new vacancy for their gym without being able to open one directly
- Request captures: gym (locked to their own), position, justification
- Appears in an HR review queue, gated by `recruitment.vacancy_request.approve`
- HR **Approve** → HR then creates the actual Vacancy through the normal Vacancy Management flow below, linked back to the originating request
- HR **Reject** → request closed with a comment, no Vacancy is created
- This does NOT bypass Super Admin/HR governance over vacancies (see `Revive_Super_Admin_Module_Specification.md`) — it's an intake mechanism, not a shortcut to publishing

### Vacancy Management
- Create vacancy: gym, position, requirements, description
- Public application link generated per vacancy
- Close/archive vacancy
- Future: Google Forms integration (behind abstraction boundary)

### Candidate Profile
Collected at application:
- Full name, contact details
- Personal information (DOB, national ID)
- CV / resume (file upload)
- Education history
- Work experience
- Skills
- Relevant professional information

### Recruitment Pipeline
Kanban stages:
1. **Applied** — application received
2. **Screening** — initial review
3. **1st Interview** — first round
4. **2nd Interview** — second round
5. **Final Decision** — hiring decision
6. **Waiting List** — accepted, no current vacancy
7. **Hired** — creates employee account

Each candidate card shows:
- Current Stage
- Required Next Action
- Days since last action
- Visual flag if overdue

### Follow-Up Engine
Core principle: **No candidate should remain in the pipeline without a required action or clear final status.**

System detects:
- Candidates stuck at a stage with no next action scheduled
- Overdue actions (configurable threshold)
- Generates in-app notifications to responsible HR user

### Hire Action
1. HR selects "Hire" on an approved candidate
2. System creates Employee account
3. Assigns gym + position
4. Generates login credentials
5. Links recruitment history to employee record
6. Candidate data preserved, not deleted

---

## 6. Employee Module

### Employee Profile (Tabbed)
- **Personal & Employment Info** — name, contact, position, level, gym, hire date
- **Documents** — uploaded files (contract, ID, certifications), expiry tracking
- **Employment History** — chronological timeline of all changes
- **Attendance Summary** — recent check-in/out, link to full attendance
- **Current Shift Assignment** — this cycle's schedule
- **Requests History** — all past requests
- **Evaluations History** — score trend, past reviews
- **Payroll Snapshot** — visible only with `payroll.view`

### Employee Directory
- Gym filter, search bar, status filter
- Table: name, gym, position, level, hire date, status
- "Add Employee" button (manual creation, separate from recruitment)
- "Bulk Import" button (CSV upload for pilot rollout)

### Lifecycle Actions
Each is a separate permission-gated button on the employee profile:

| Action | Permission | What Happens |
|--------|-----------|--------------|
| Transfer Gym | `employees.transfer` | Move to different gym, old access revoked, history logged |
| Change Position/Level | `employees.position.change` | Promotion/demotion within gym's catalog, effective date |
| Assign/Change Role | `employees.role.assign` | Grant/revoke Branch Manager or other roles |
| Change Status | `employees.status.change` | Active / On Leave / Suspended / Terminated + reason |
| Manage Compensation | `employees.compensation.manage` | Record salary changes, history preserved |
| Manage Contract | `employees.contract.manage` | Contract type, dates, expiry alerts |
| Offboard | `employees.offboard` | Guided end-of-service process |

---

## 7. Scheduling

### Shift Cycle System
- Each gym operates on independent cycles
- Cycle length is configurable per gym (7, 10, 14 days, etc.)
- Each cycle has a start date and end date
- A new cycle must be planned before the current one expires

### Schedule Grid
- Single gym view (mandatory gym selector)
- Rows = employees at this gym
- Columns = each day in the cycle
- Each cell = assigned shift (from gym's shift templates)
- Click-to-edit inline (dropdown or quick-tap)

### Shift Templates (Per Gym)
Each gym defines its own:
- Name (e.g., "Morning", "Evening", "Night", "Off")
- Start time and end time
- Gyms can have completely different shift structures

### Key Features
- **Copy Previous Cycle** — duplicate last cycle's pattern, then adjust
- **Conflict Warnings**: employee double-booked, day understaffed, approved leave overlaps
- **Publish** — finalizes draft → pushes live to employees' "My Schedule"
- **History** — read-only archive of past cycles

---

## 8. Attendance

### Check-In / Check-Out
- **Primary method**: Face ID biometric device at gym entrance
- **Fallback**: Manual entry by whoever is at the computer (when Face ID fails)
- System records: employee ID, timestamp, method (biometric/manual), gym

### Schedule Evaluation
Each attendance event is compared against the employee's effective schedule:
- **On-time**: within tolerance window
- **Late**: check-in after scheduled start
- **Absent**: no check-in for scheduled shift
- **Early checkout**: check-out before scheduled end
- **Missing checkout**: check-in exists, no check-out

### Manual Correction
- Only by authorized users (`attendance.edit`)
- Requires reason text
- Audit trail: original value, new value, corrector, timestamp, reason

### Flagging
- Repeated issues (e.g., 3+ lates in a cycle) visually highlighted
- Surfaced on dashboard alerts

---

## 9. Employee Requests

### Request Types

| # | Type | Fields | Notes |
|---|------|--------|-------|
| 1 | Leave / Vacation | Date range | May have balance tracking later |
| 2 | Leave Early | Date + specific time | Cross-checks with shift |
| 3 | Day Off | Single date | Cross-checks with shift |
| 4 | Sick Leave | Date(s), optional document upload | |
| 5 | Late Arrival Permission | Date + time | |
| 6 | Shift Swap | Date + named colleague | Both employees affected |
| 7 | Emergency Leave | Date + reason (required) | |
| 8 | Document Request | Type of document requested | e.g., salary certificate |
| 9 | General Inquiry / Complaint | Free text | |
| 10 | Resignation / Employee Leaving | Intended last working day, reason | Self-initiated by ANY employee (including a Branch Manager acting as an employee about themselves) — see distinction below |

> **Note:** This list is confirmed directionally but may change before finalization.

### Resignation vs. Offboarding — Important Distinction
These are two separate, independently-triggered flows that both end up affecting the same employee record:

| | Resignation (Request type #10) | Offboarding (`employees.offboard`) |
|---|---|---|
| Who initiates | The employee themselves, about themselves (self-service) | HR, or a Branch Manager with `employees.offboard`, about a subordinate |
| Where | My Requests (self-service), routes to standard HR Requests Inbox | Employee profile → "Offboard" button (management action) |
| Approval | Standard request Approve/Reject like any other request type | No separate approval — starts the guided offboarding wizard directly once the button is clicked, since it's already permission-gated |
| Typical relationship | HR reviewing an approved Resignation request will usually then trigger Offboarding on that employee | Independent — Offboarding can be started without a prior Resignation request (e.g. termination) |

A Branch Manager is both an Employee and a manager: he can submit
Resignation about *himself* via My Requests (goes straight to HR, same as
any employee), and separately can click Offboard on one of *his team's*
employees if he holds `employees.offboard` (no approval step, per the
existing lifecycle-actions model).

### Request Lifecycle
```
Employee → Submit Request → Pending
    → Authorized Reviewer sees in inbox
    → Approve / Reject (with comment)
    → Notification sent to employee
    → History preserved
```

### Cross-Module Integration
- Approved Day Off / Leave → reflected in Shift Schedule (conflict warnings)
- Shift Swap → updates both employees' schedules upon approval
- Approved Resignation → does NOT automatically trigger Offboarding; HR/Branch Manager still separately clicks "Offboard" on the employee profile when ready

---

## 10. Payroll (MVP Scope = History + Deductions)

### What MVP Includes
- View payroll per gym per pay period
- Employee row: base salary, deductions, bonuses, net pay
- Deductions auto-linked to attendance/leave exceptions
- HR approval flow for deductions before they become visible to employees
- Payslip preview per employee
- Export (CSV/PDF)

### What MVP Does NOT Include
- Full payroll calculation engine
- Tax calculations
- Bank integration
- Salary disbursement

### Deduction Flow
```
Attendance Exception (late/absent/early)
    → Deduction Candidate (auto-generated)
    → HR Review
    → Approve / Reject
    → Finalized in Payroll History
    → Visible to Employee
```

---

## 11. Notifications (In-App)

### Notification Triggers
- Recruitment: candidate needs action, overdue follow-up
- Requests: new request pending, request approved/rejected
- Attendance: manual correction made, repeated issues
- Schedule: new cycle published, cycle ending soon
- Employee: contract expiring, document expiring
- Payroll: deduction approved/rejected

### Architecture
- In-app notification bell (MVP)
- Notification abstraction layer for future email/SMS channels
- Read/unread state
- Link to relevant page/record

---

## 12. Reports & Analytics (MVP)

### Available Reports
- Headcount by gym
- Turnover rate
- Attendance trends
- Recruitment funnel conversion
- Request volume by type

### Features
- Gym filter, date range picker
- Chart view + data export
- Permission-gated (`reports.view`)

---

## 13. Dashboard (Per User Type)

### Super Admin Dashboard
- Organization-wide KPIs
- Total gyms, total employees, total active vacancies
- Quick actions: create gym, create user
- Recent activity feed

### HR Dashboard
- Gym selector ("All my gyms" or specific)
- Summary cards: total employees, pending requests, open vacancies, today's attendance %, shift cycle status
- Follow-up alerts feed:
  - Candidates stuck in pipeline
  - Unresolved attendance issues
  - Requests pending beyond threshold
  - Shift cycle ending soon with no next cycle
- Quick links to each module

### Employee Dashboard
- My upcoming schedule
- My attendance summary
- My pending requests
- My notifications
- Quick links to self-service areas

### Design Principle: Action-Oriented, Not Just Reporting
Every dashboard (Super Admin, HR, and every Employee-based dashboard
below) follows the same rule: anything that needs the viewer to actually
do something is surfaced as an explicit **"Action Required"** flag/badge,
not buried as a plain number or stat. A dashboard is a to-do surface
first, a reporting surface second.

### Team Leader Dashboard (Employee dashboard + additive widgets)
Base Employee Dashboard (above) **plus**:
- **My Team** widget: member count (across every team led), team attendance status (present/absent/late today), pending team actions (requests awaiting review, only if `requests.approve.team` granted), required follow-ups

### Branch Manager Dashboard (Employee dashboard + additive widgets)
Base Employee Dashboard (above) **plus**, each block only rendered if the
underlying permission is granted:
- **Branch Overview** — total employees, present / absent / late / missing-checkout counts, pending requests count, count of items needing action
- **Team Follow-up** — employees requiring attention, pending approvals, attendance issues, recent employee updates
- **Recruitment** — open vacancies, candidates requiring action, hiring follow-ups, status of the Branch Manager's own Vacancy Requests (§5a)
- **Employee Actions** shortcuts — New Employee, Employee Updates, Shift Changes, Employee Leaving (jumps to the relevant employee's profile action, per §9's Resignation-vs-Offboarding distinction)

---

## 14. Leave Balance Management

> **Gated by:** `employees.leave_balance.manage` (HR), visible read-only to Employee on their own profile

### What It Tracks
For each employee, per leave type, per year:
- **Total Entitlement** — days granted for the year (set/edited by HR with permission)
- **Used Days** — automatically incremented when a leave request is approved
- **Pending Days** — automatically incremented when a leave request is submitted (pending), decremented when decided
- **Remaining** — computed: Total - Used - Pending

### Leave Types That Consume Balance
- Annual / Vacation Leave
- Sick Leave
- Emergency Leave

### Leave Types That Do NOT Consume Balance
- Day Off, Leave Early, Late Arrival, Shift Swap, Document Request, General Inquiry

### HR Actions
- View balance for any employee in their accessible gyms
- Edit `TotalEntitlement` (e.g., grant extra annual leave days)
- View consumption history

### Employee Visibility
- **Leave Balance tab** on employee self-service profile
- Balance shown inline on the Request submission form (so employee knows how many days remain before submitting)
- Balance shown on HR's Request detail panel (context when reviewing)

---

## 15. Announcements (HR-authored Broadcasts)

> **Gated by:** `announcements.manage` (create/edit/send), `announcements.view` (read-only history)

### What It Is
HR (or Branch Manager with permission) composes a message and broadcasts it to a defined audience. Unlike system Notifications (which are triggered automatically), Announcements are human-authored.

### Compose Announcement
- Title
- Body text
- Target audience:
  - All employees in a specific gym
  - Specific department within a gym
  - Specific role (e.g., all Trainers)
  - Specific individual
- Schedule: send immediately or at a future date/time

### Delivery
- When sent, one Notification is created per matched recipient (Type = Announcement)
- Recipient sees it in their notification bell like any other notification
- Announcement links to a detail page with the full message body

### Announcement History
- HR can view all past announcements: who authored them, when sent, audience, status (Draft / Scheduled / Sent / Cancelled)
- Employees can view a read-only archive of announcements they received

---

## 16. Teams & Team Leader (MVP)

> **User Type:** `Employee`, **Role:** `Team Leader` (preset, same "preset only" philosophy as HR Manager/HR Coordinator/Branch Manager — the individual's granted permissions are the source of truth)

### What It Is
A **Team** is a sub-gym grouping of employees, used to give a Team Leader
a scope narrower than a full gym (which is Branch Manager's scope) or a
single self (Regular Employee's scope). Teams belong to exactly one gym
and never span gyms.

### Team Composition
- `team.manage` (typically held by HR or Branch Manager) creates teams within a gym, assigns members, and assigns one or more Team Leaders per team
- An employee can be a Team Leader for more than one team
- An employee can be a member of more than one team
- A team's effective roster for authorization purposes is the union of all its `TeamMembers`; a Team Leader's effective scope is the union of every team they lead

### Team Leader Capabilities (all individually permission-gated)
| Feature | Permission | Scope |
|---------|-----------|-------|
| View team roster | `team.view` | Teams the user leads |
| View team attendance | `attendance.view.team` | Members of teams the user leads |
| View team schedule | `schedule.view.team` | Members of teams the user leads |
| View team requests | `requests.view.team` | Requests submitted by team members |
| Approve/reject team requests | `requests.approve.team` | Only if explicitly granted — in practice this is usually held by Branch Manager or HR rather than Team Leader; a Team Leader only gets it if the business decides to delegate that far |
| View team evaluations | `evaluations.view.team` | Members of teams the user leads |
| Manage team evaluations | `evaluations.manage.team` | Members of teams the user leads |

### Team Leader Dashboard (additive to base Employee Dashboard)
On top of the standard Regular Employee dashboard (My Attendance, My Schedule, My Requests, My Payroll, My Notifications, My Performance), a Team Leader sees a **My Team** widget block:
- Number of team members (across all teams they lead)
- Team attendance status (present/absent/late today)
- Pending team actions (requests awaiting review, if `requests.approve.team` granted)
- Required follow-ups

### Sidebar
Base Employee sidebar + **My Team** (shown only if `team.view` is granted).

### Relationship to Branch Manager
Team Leader and Branch Manager are both `Employee`-typed roles that add
features to the same base Employee interface (see
`Regular_Employee_rtf.doc` and `HR_Role_and_Pages_Spec.md` §1). Branch
Manager's scope is the whole gym; Team Leader's scope is narrower — one
or more teams within that gym. The two roles can be combined on the same
user if the business wants a Branch Manager who is also personally
leading a specific team, since permissions are additive and individually granted.
