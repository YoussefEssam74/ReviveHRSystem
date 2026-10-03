# HR Manager & HR — Role and Page-by-Page Specification

## 0. How to Read This Document

Both **HR Manager** and **HR** are `User Type = HR` in the system — there
is no separate `HRManager` user type. They run on the exact same page
set (see `HR_Role_and_Pages_Spec.md`) and the exact same permission
engine. "HR Manager" and "HR" are **named presets** — convenience
bundles of permissions applied at user-creation time — not hard-coded
tiers. The real source of truth for what any individual can do is
always their own granted permission set (`UserPermission` +
`RolePermission`), which Top Management can freely customize per
person.

So the descriptions below are **typical/suggested** configurations for
each preset, written so you (and Stitch) have a concrete, buildable
picture of "what does a normal HR Manager see" vs. "what does a normal
HR user see" — not a system-enforced wall between the two. Any HR
Manager could be individually granted less, and any HR user could be
individually granted more.

**Shared across both:**

- Gym access: a subset of gyms assigned via `UserGymAccess` (either preset can be given one gym or many — it's not fixed by the preset)
- Same 14-page sitemap
- Same page purposes, layouts, and data
- Same gym-scoped data isolation, audit logging, and permission-gated UI rendering rules

**What actually differs between the two presets:** the _default bundle_
of permissions applied when each preset is chosen — i.e., which buttons,
sections, and approval powers show up out of the box.

---

## 1. Suggested Default Permission Bundles

| Permission Key                                | HR Manager (typical) |               HR (typical)               |
| --------------------------------------------- | :------------------: | :--------------------------------------: |
| `employees.view`                              |          ✅          |                    ✅                    |
| `employees.create`                            |          ✅          |                    ✅                    |
| `employees.edit`                              |          ✅          |                    ✅                    |
| `employees.transfer`                          |          ✅          |   ❌ (can request transfer via ticket)   |
| `employees.position.change`                   |          ✅          |                    ✅                    |
| `employees.role.assign`                       |          ✅          |                    ❌                    |
| `employees.status.change`                     |          ✅          |                    ✅                    |
| `employees.compensation.manage`               |          ✅          |                    ❌                    |
| `employees.contract.manage`                   |          ✅          |                    ✅                    |
| `employees.offboard`                          |          ✅          |                    ❌                    |
| `employees.documents.view`                    |          ✅          |                    ✅                    |
| `employees.documents.manage`                  |          ✅          |                    ✅                    |
| `employees.bulk_import`                       |          ✅          |                    ❌                    |
| `employees.leave_balance.manage`              |          ✅          |              ❌ (view-only)              |
| `employees.transfer.request`                  |          ❌          |  ✅ (can raise transfer request ticket)  |
| `positions.view` / `positions.manage`         |       ✅ / ✅        |                 ✅ / ❌                  |
| `recruitment.view`                            |          ✅          |                    ✅                    |
| `recruitment.vacancies.manage`                |          ✅          |                    ❌                    |
| `recruitment.candidates.manage`               |          ✅          |                    ✅                    |
| `recruitment.hire.approve`                    |          ✅          |                    ❌                    |
| `recruitment.vacancy_request.approve`         |          ✅          |                    ❌                    |
| `attendance.view`                             |          ✅          |                    ✅                    |
| `attendance.edit`                             |          ✅          |                    ✅                    |
| `schedule.view` / `schedule.manage`           |       ✅ / ✅        |                 ✅ / ✅                  |
| `requests.view`                               |          ✅          |                    ✅                    |
| `requests.approve` (final decision)           |          ✅          |                    ✅                    |
| `payroll.view`                                |          ✅          |                    ✅                    |
| `payroll.edit`                                |          ✅          |   ✅ (for own gym-assigned employees)    |
| `payroll.approve`                             |          ✅          |                    ❌                    |
| `evaluations.view` / `evaluations.manage`     |       ✅ / ✅        | ✅ / ✅ (evaluate only, no form builder) |
| `reports.view`                                |          ✅          |              ❌ (typically)              |
| `announcements.view` / `announcements.manage` |       ✅ / ✅        |                 ✅ / ❌                  |
| `audit.view`                                  |          ✅          |                    ❌                    |
| `team.manage`                                 |          ✅          |                    ❌                    |

> This table is a **starting point**, not a spec constraint. Nothing in
> the codebase should hard-code "if role == HRManager". Every check is
> `if user has permission X and gym in scope`.

---

## 2. HR Manager

### 2.1 Role Summary

- **Scope:** typically multiple assigned gyms (`UserGymAccess`)
- **Character:** the senior HR operator for their gyms — full lifecycle authority over employees, recruitment governance (vacancy creation/approval), payroll sign-off, evaluation form builder ownership, and reporting/audit visibility
- **Typically the only HR-side role that can:** create/edit vacancies, approve vacancy requests from Branch Managers, approve hire (Candidate → Employee), transfer employees between gyms, change compensation, offboard employees, bulk-import staff, grant/revoke the Branch Manager role, approve payroll runs, build evaluation forms, view audit logs, and send org-wide announcements
- **Oversight:** sees payroll/attendance/events for HR users under them in their assigned gyms

### 2.2 Pages & Features

**1. Dashboard**

- Gym selector / "All my gyms" toggle across every assigned gym
- Full summary cards: total employees, pending requests, open vacancies, today's attendance %, shift cycle status
- Full follow-up/alerts feed: stalled candidates, unresolved attendance issues, requests pending beyond threshold, shift cycles ending soon
- **Oversight cards**: HR team attendance summary, payroll events for own gyms, document expiry alerts for own gyms, transfer request tickets from HR users
- Quick links into every module below

**2. Employees**

- Full directory: gym filter, search, status filter across all assigned gyms
- **Add Employee** and **Bulk Import** (CSV) — both visible
- Full profile access on every tab: Personal Info, Documents (upload/manage, incl. HR-only document types), Employment History, Attendance Summary, Current Shift, Requests History, Leave Balance (editable), Evaluations History, Payroll Snapshot
- **All lifecycle actions available:** Transfer Gym, Change Position/Level, Assign/Change System Role (grant/revoke Branch Manager), Change Status, Manage Compensation, Manage Contract, Offboard (with Exit Form)
- **Transfer Request Tickets** — views and processes transfer requests raised by HR users

**3. Recruitment & Hiring**

- **Vacancy Requests review queue** — Approve/Reject Branch Manager submissions (creates the resulting Vacancy on Approve)
- Full **Vacancy Management** — create/edit/close, set headcount needed
- Candidates/Applications, full Pipeline (Kanban), Waiting List — **read/oversight only**
- **Hire action** — full authority to convert Candidate → Employee (final step)
- **New Comers** tab — full visibility and ability to complete onboarding checklist items

**4. Attendance**

- Full gym-scoped attendance table, manual correction with reason (audit-logged)
- Repeated-issue flagging visible
- **HR Team Attendance** — can view attendance records for HR users under them in assigned gyms

**5. Shifts & Schedule Management**

- Full schedule grid access per gym, cycle creation/editing, shift template management, Copy Previous Cycle, Publish, conflict warnings, history
- **Creates shifts for HR users** under them in assigned gyms

**6. Requests (two-stage inbox)**

- Full Requests Inbox — sees the Branch Manager's stage-1 decision + reason on every request
- Holds the **final** `requests.approve` authority — approves/rejects regardless of BM's call
- Bulk approve, decided-requests archive

**7. Payroll**

- Full payroll table per gym per period (all employees including HR users under them)
- **Edit** deduction line items, **Approve/lock** the payroll run
- Payslip preview, export

**8. Evaluations**

- Full **Form Builder** — create/edit custom evaluation forms per gym/position (Rating, Multiple Choice, Checkbox questions)
- Run evaluations against any employee in scope (including HR users), view full history/trend

**9. Reports & Analytics**

- Full access: headcount, turnover, attendance trends, recruitment funnel, request volume — gym filter, date range, export

**10. My Access**

- Own gym list + own granted permissions (read-only reference)

**11. Positions & Levels Catalog**

- Full add/edit/retire authority per gym's catalog

**12. Notifications & Announcements**

- View history **and** compose/send new announcements to any audience (gym, department, role, individual)

**13. Activity / Audit Log**

- Full visibility across all assigned gyms — every permission-gated action, filterable

**14. Events**

- Full queue: document/contract expiry, resignation/termination follow-ups, pending vacancy requests, requests pending final HR review, **transfer request tickets from HR users** — across all assigned gyms

---

## 3. HR

### 3.1 Role Summary

- **Scope:** assigned gyms (typically one or a few)
- **Character:** day-to-day HR operator — handles the operational workload: runs interviews, moves candidates through pipeline, manages attendance, builds shifts for own gym, edits payroll for own employees, evaluates employees in own gyms
- **Key differences from HR Manager:** cannot create vacancies, cannot approve hire, cannot transfer employees (but can raise transfer request tickets), cannot change compensation, cannot offboard, cannot bulk-import, cannot build evaluation forms, cannot approve payroll runs, cannot view audit logs
- **Own gym focus:** all actions scoped to their assigned gyms only

### 3.2 Pages & Features (delta from HR Manager)

**1. Dashboard** — same layout; cards/alerts scoped to their assigned gyms. Shows: employee count, pending requests, open vacancies (read-only), today's attendance %, shift cycle status. **Adds**: document expiry alerts for own gyms, payroll events for own gyms, HR attendance overview for own gym.

**2. Employees**

- Directory and profile access as normal (`employees.view`, `employees.edit`)
- **Add Employee** available; **Bulk Import** hidden (`employees.bulk_import` not granted)
- Documents: view/manage available
- **Lifecycle actions available:** Change Position/Level, Change Status, Manage Contract
- **Lifecycle actions hidden:** Transfer Gym (instead: **Request Transfer** button — raises a ticket to HR Manager), Assign/Change System Role, Manage Compensation, Offboard
- Leave Balance tab: **view-only** (no `employees.leave_balance.manage`)
- **Can view terminations** fired by Branch Manager of their gym (read-only access to offboarding records)

**3. Recruitment & Hiring**

- Views open vacancies (read-only), candidates, and pipeline
- **Core responsibility:** manages candidates through stages (`recruitment.candidates.manage`) — conducts interviews, moves candidates Screening → 1st Interview → 2nd Interview → Final Decision → Waiting List
- **Vacancy Requests review queue** hidden (no `recruitment.vacancy_request.approve`) — HR Manager action
- **Vacancy creation/edit/close** hidden (no `recruitment.vacancies.manage`) — HR Manager action
- **Hire action** hidden (no `recruitment.hire.approve`) — HR moves candidate to Waiting List; HR Manager converts to Employee
- **New Comers** tab: visible read-only; onboarding-checklist completion typically HR Manager

**4. Attendance**

- Full gym-scoped attendance table for **employees** in their assigned gyms, manual correction with reason (audit-logged)
- **Can view attendance for HR users** in their assigned gyms (oversight)
- Repeated-issue flagging visible

**5. Shifts & Schedule Management**

- Full schedule grid access per gym (their assigned gyms only), cycle creation/editing, shift template management, Copy Previous Cycle, Publish, conflict warnings, history
- **Builds shifts for employees** in their gyms (not for HR users — HR Manager does that)

**6. Requests (two-stage inbox)**

- Full Requests Inbox visibility, and **does** hold the final `requests.approve` — day-to-day request decisions (Day Off, Leave, Shift Swap, etc.) are exactly the kind of operational call HR is meant to make
- Sees the Branch Manager's stage-1 decision + reason the same as HR Manager

**7. Payroll**

- **Full edit access** for employees in their assigned gyms (`payroll.edit`) — can edit deduction line items for their gym's employees
- **Cannot approve/lock** payroll run (no `payroll.approve`) — HR Manager does final approval
- Payslip preview, export for their gyms

**8. Evaluations**

- **Can evaluate employees** in their assigned gyms (`evaluations.manage` = run evaluations, not build forms)
- **Form Builder hidden** (no form creation/editing) — uses forms created by HR Manager
- Views past responses/history for their gym's employees

**9. Reports & Analytics**

- Typically hidden entirely (no `reports.view`) — analytics/reporting reserved for HR Manager and above

**10. My Access**

- Same as HR Manager — own gyms + own permissions, read-only

**11. Positions & Levels Catalog**

- **View-only** (`positions.view` without `positions.manage`) — sees the catalog when adding/editing employees, can't add/retire catalog entries
- **Can view terminations** fired by Branch Manager of their gym (via employee profile / employment history)

**12. Notifications & Announcements**

- **View-only** (`announcements.view`) — reads announcement history and their own received notifications; cannot compose/send

**13. Activity / Audit Log**

- Typically hidden entirely (no `audit.view`) — stays an HR Manager/Top Management visibility layer

**14. Events**

- Visible, row-level content follows held permissions: document-expiry, `PendingHRReview` requests (since they hold `requests.approve`), payroll events for own gyms
- **Won't see** Vacancy-Request events (lacks `recruitment.vacancy_request.approve`)
- **Won't see** transfer request tickets they didn't raise

---

## 4. Quick Reference — Sidebar Comparison

| Sidebar Item                  |           HR Manager           |                   HR (typical)                    |
| ----------------------------- | :----------------------------: | :-----------------------------------------------: |
| Dashboard                     |       ✅ + HR oversight        |              ✅ + doc/payroll events              |
| Employees                     |       ✅ full lifecycle        |            ✅ edit + request transfer             |
| Recruitment & Hiring          | ✅ vacancy mgmt + hire approve | ✅ pipeline execution (interviews → waiting list) |
| Attendance                    |        ✅ all + HR team        |          ✅ employees + HR users in gym           |
| Shifts & Schedule             |     ✅ creates for HR team     |             ✅ creates for employees              |
| Requests                      |       ✅ final approver        |                 ✅ final approver                 |
| Payroll                       |      ✅ edit/approve all       |          ✅ edit own gym employees only           |
| Evaluations                   |     ✅ form builder + run      |           ✅ run only (no form builder)           |
| Reports & Analytics           |               ✅               |                   ❌ (typical)                    |
| My Access                     |               ✅               |                        ✅                         |
| Positions & Levels            |           ✅ manage            |           ✅ view + see BM terminations           |
| Notifications & Announcements |           ✅ compose           |                   ✅ view-only                    |
| Activity / Audit Log          |               ✅               |                   ❌ (typical)                    |
| Events                        |   ✅ full + transfer tickets   |    ✅ filtered (doc expiry, requests, payroll)    |

---

## 5. Reminder on Governance

Per `ADR-003-authorization.md` and the "granular permissions over role
tiers" principle: nothing above should ever be implemented as
`if (user.Role == "HRManager")`. Every gate in this document maps to a
specific permission key from `features.md`'s Permission Catalog, checked
at the service layer alongside gym scope. Top Management can reshape any
individual HR or HR Manager user's actual access at any time via **User
Management → Preview Access** — these two presets exist only to make
onboarding a new HR hire faster, not to constrain what's possible.
