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

**What actually differs between the two presets:** the *default bundle*
of permissions applied when each preset is chosen — i.e., which buttons,
sections, and approval powers show up out of the box.

---

## 1. Suggested Default Permission Bundles

| Permission Key | HR Manager (typical) | HR (typical) |
|---|:---:|:---:|
| `employees.view` | ✅ | ✅ |
| `employees.create` | ✅ | ✅ |
| `employees.edit` | ✅ | ✅ |
| `employees.transfer` | ✅ | ❌ |
| `employees.position.change` | ✅ | ✅ |
| `employees.role.assign` | ✅ | ❌ |
| `employees.status.change` | ✅ | ✅ |
| `employees.compensation.manage` | ✅ | ❌ |
| `employees.contract.manage` | ✅ | ✅ |
| `employees.offboard` | ✅ | ❌ |
| `employees.documents.view` | ✅ | ✅ |
| `employees.documents.manage` | ✅ | ✅ |
| `employees.bulk_import` | ✅ | ❌ |
| `employees.leave_balance.manage` | ✅ | ❌ (view-only) |
| `positions.view` / `positions.manage` | ✅ / ✅ | ✅ / ❌ |
| `recruitment.view` | ✅ | ✅ |
| `recruitment.vacancies.manage` | ✅ | ❌ |
| `recruitment.candidates.manage` | ✅ | ✅ |
| `recruitment.hire.approve` | ✅ | ❌ |
| `recruitment.vacancy_request.approve` | ✅ | ❌ |
| `attendance.view` | ✅ | ✅ |
| `attendance.edit` | ✅ | ✅ |
| `schedule.view` / `schedule.manage` | ✅ / ✅ | ✅ / ✅ |
| `requests.view` | ✅ | ✅ |
| `requests.approve` (final decision) | ✅ | ✅ |
| `payroll.view` | ✅ | ✅ |
| `payroll.edit` | ✅ | ❌ |
| `payroll.approve` | ✅ | ❌ |
| `evaluations.view` / `evaluations.manage` | ✅ / ✅ | ✅ / ❌ (view-only) |
| `reports.view` | ✅ | ❌ (typically) |
| `announcements.view` / `announcements.manage` | ✅ / ✅ | ✅ / ❌ |
| `audit.view` | ✅ | ❌ |
| `team.manage` | ✅ | ❌ |

> This table is a **starting point**, not a spec constraint. Nothing in
> the codebase should hard-code "if role == HRManager". Every check is
> `if user has permission X and gym in scope`.

---

## 2. HR Manager

### 2.1 Role Summary
- **Scope:** typically multiple assigned gyms (`UserGymAccess`)
- **Character:** the senior HR operator for their gyms — full lifecycle authority over employees, recruitment governance, payroll sign-off, evaluation program ownership, and reporting/audit visibility
- **Typically the only HR-side role that can:** transfer employees between gyms, change compensation, offboard employees, bulk-import staff, grant/revoke the Branch Manager role, approve payroll runs, view audit logs, and send org-wide announcements

### 2.2 Pages & Features

**1. Dashboard**
- Gym selector / "All my gyms" toggle across every assigned gym
- Full summary cards: total employees, pending requests, open vacancies, today's attendance %, shift cycle status
- Full follow-up/alerts feed: stalled candidates, unresolved attendance issues, requests pending beyond threshold, shift cycles ending soon
- Quick links into every module below

**2. Employees**
- Full directory: gym filter, search, status filter across all assigned gyms
- **Add Employee** and **Bulk Import** (CSV) — both visible
- Full profile access on every tab: Personal Info, Documents (upload/manage, incl. HR-only document types), Employment History, Attendance Summary, Current Shift, Requests History, Leave Balance (editable), Evaluations History, Payroll Snapshot
- **All lifecycle actions available:** Transfer Gym, Change Position/Level, Assign/Change System Role (grant/revoke Branch Manager), Change Status, Manage Compensation, Manage Contract, Offboard (with Exit Form)

**3. Recruitment & Hiring**
- **Vacancy Requests review queue** — Approve/Reject Branch Manager submissions (creates the resulting Vacancy on Approve)
- Full **Vacancy Management** — create/edit/close, set headcount needed
- Candidates/Applications, full Pipeline (Kanban), Waiting List
- **Hire action** — full authority to convert Candidate → Employee
- **New Comers** tab — full visibility and ability to complete onboarding checklist items

**4. Attendance**
- Full gym-scoped attendance table, manual correction with reason (audit-logged)
- Repeated-issue flagging visible

**5. Shifts & Schedule Management**
- Full schedule grid access per gym, cycle creation/editing, shift template management, Copy Previous Cycle, Publish, conflict warnings, history

**6. Requests (two-stage inbox)**
- Full Requests Inbox — sees the Branch Manager's stage-1 decision + reason on every request
- Holds the **final** `requests.approve` authority — approves/rejects regardless of BM's call
- Bulk approve, decided-requests archive

**7. Payroll**
- Full payroll table per gym per period
- **Edit** deduction line items, **Approve/lock** the payroll run
- Payslip preview, export

**8. Evaluations**
- Full **Form Builder** — create/edit custom evaluation forms per gym/position (Rating, Multiple Choice, Checkbox questions)
- Run evaluations against any employee in scope, view full history/trend

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
- Full queue: document/contract expiry, resignation/termination follow-ups, pending vacancy requests, requests pending final HR review — across all assigned gyms

---

## 3. HR

### 3.1 Role Summary
- **Scope:** typically fewer assigned gyms than an HR Manager (could still be one or several)
- **Character:** day-to-day HR operator — handles the operational workload (attendance, scheduling, requests, recruitment intake, basic employee edits) without the higher-trust/financial/governance actions reserved for HR Manager
- **Typically cannot:** transfer employees between gyms, change compensation, offboard employees, bulk-import staff, grant/revoke Branch Manager role, edit or approve payroll, manage the evaluation form builder, view audit logs, or send announcements

### 3.2 Pages & Features (delta from HR Manager)

**1. Dashboard** — same layout; cards/alerts scoped to their (typically fewer) assigned gyms. Any card tied to a permission they lack (e.g. payroll) simply doesn't render.

**2. Employees**
- Directory and profile access as normal (`employees.view`, `employees.edit`)
- **Add Employee** available; **Bulk Import** typically hidden (`employees.bulk_import` not granted)
- Documents: view/manage available
- **Lifecycle actions available:** Change Position/Level, Change Status, Manage Contract
- **Lifecycle actions typically hidden:** Transfer Gym, Assign/Change System Role, Manage Compensation, Offboard
- Leave Balance tab: **view-only** (no `employees.leave_balance.manage`)

**3. Recruitment & Hiring**
- Views open vacancies, candidates, and pipeline; can manage candidates through stages (`recruitment.candidates.manage`)
- **Vacancy Requests review queue** typically hidden (no `recruitment.vacancy_request.approve`) — this stays an HR Manager action
- **Vacancy creation/edit/close** typically hidden (no `recruitment.vacancies.manage`)
- **Hire action** typically hidden (no `recruitment.hire.approve`) — HR flags a candidate as ready; HR Manager converts to Employee
- **New Comers** tab: visible read-only if `employees.view` covers it; onboarding-checklist completion is typically an HR Manager action

**4. Attendance**
- Same as HR Manager — full view + manual correction, since this is core day-to-day operational work

**5. Shifts & Schedule Management**
- Same as HR Manager — full schedule building, since this is core day-to-day operational work

**6. Requests (two-stage inbox)**
- Full Requests Inbox visibility, and typically **does** hold the final `requests.approve` — day-to-day request decisions (Day Off, Leave, Shift Swap, etc.) are exactly the kind of operational call HR is meant to make
- Sees the Branch Manager's stage-1 decision + reason the same as HR Manager

**7. Payroll**
- **View-only** (`payroll.view`) — sees the table, deduction line items, payslip preview, export
- Cannot edit deduction amounts or approve/lock a payroll run

**8. Evaluations**
- **View-only** (`evaluations.view`) — can see forms and past responses/history
- Cannot build/edit forms or run new evaluation cycles (that's `evaluations.manage`, typically HR Manager)

**9. Reports & Analytics**
- Typically hidden entirely (no `reports.view`) — analytics/reporting is usually reserved for HR Manager and above

**10. My Access**
- Same as HR Manager — own gyms + own permissions, read-only

**11. Positions & Levels Catalog**
- Typically **view-only** (`positions.view` without `positions.manage`) — sees the catalog when adding/editing employees, can't add/retire catalog entries

**12. Notifications & Announcements**
- **View-only** (`announcements.view`) — reads announcement history and their own received notifications; cannot compose/send

**13. Activity / Audit Log**
- Typically hidden entirely (no `audit.view`) — this stays an HR Manager/Top Management visibility layer

**14. Events**
- Visible, but row-level content follows whatever underlying permissions HR actually holds — e.g. they'll see document-expiry and `PendingHRReview` request events (since they hold `requests.approve`), but won't see Vacancy-Request events if they lack `recruitment.vacancy_request.approve`

---

## 4. Quick Reference — Sidebar Comparison

| Sidebar Item | HR Manager | HR (typical) |
|---|:---:|:---:|
| Dashboard | ✅ | ✅ |
| Employees | ✅ full lifecycle | ✅ partial lifecycle |
| Recruitment & Hiring | ✅ full | ✅ intake/pipeline only |
| Attendance | ✅ | ✅ |
| Shifts & Schedule | ✅ | ✅ |
| Requests | ✅ final approver | ✅ final approver |
| Payroll | ✅ edit/approve | ✅ view-only |
| Evaluations | ✅ build/run | ✅ view-only |
| Reports & Analytics | ✅ | ❌ (typical) |
| My Access | ✅ | ✅ |
| Positions & Levels | ✅ manage | ✅ view-only |
| Notifications & Announcements | ✅ compose | ✅ view-only |
| Activity / Audit Log | ✅ | ❌ (typical) |
| Events | ✅ full | ✅ filtered to held permissions |

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
