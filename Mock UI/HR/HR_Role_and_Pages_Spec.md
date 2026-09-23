# HR Role & Page-by-Page UI Specification — Revive HR System
 
---
 
## 1. HR Role — Summary
 
- **User Type:** `HR` (distinct from `Employee`, per your architecture doc)
- **Access scope:** a subset of gyms, assigned individually (`UserGymAccess` table) — one HR might have Gym A+B+C, another Gym D+E
- **Permission model:** fully granular, per-feature (not fixed tiers). Two HR users can have completely different page/button visibility depending on what's been individually granted to them. "HR Manager" / "HR Coordinator" are just optional presets to speed up onboarding — the real source of truth is always the individual's permission grants.
- **Core responsibility areas:**
  1. Recruitment intake — moving candidates through the hiring pipeline to Employee
  2. Employee lifecycle management — profiles, documents, offboarding
  3. Attendance oversight — monitoring and correcting check-in/out
  4. Shift & schedule management — building rotating, gym-specific shift cycles
  5. Employee request handling — approving/rejecting the 9 self-service request types
  6. Payroll oversight
  7. Evaluations
  8. Reporting
Every page and every action inside every page is gated by a specific permission key. Nothing is gated by "being HR" alone — being HR just makes you *eligible* to be granted these permissions, and gives you gym-scoped access.
 
**On Branch Manager:** Branch Manager (`User Type = Employee`, `Role = Branch Manager`) runs on this exact same permission engine and reuses this exact same page set — the only differences are (1) his gym access is locked to one gym, not a chosen subset, and (2) his permission set comes from an auto-assigned preset rather than being individually configured. He is not a separate UI to design; he's an HR user whose scope happens to be pre-narrowed.

**On Team Leader:** Team Leader (`User Type = Employee`, `Role = Team Leader`) is **not** part of this HR page set at all — he uses the base **Employee self-service interface** (see `Regular_Employee_rtf.doc`), with an additional "My Team" section layered on top, scoped to the member(s) of whichever team(s) he leads. His scope is narrower than Branch Manager's (a team within a gym, not the whole gym), and a leader may lead more than one team. Team-scoped permissions (`attendance.view.team`, `requests.view.team`, `requests.approve.team`, `evaluations.view.team`/`.manage.team`, `team.view`) gate what he sees — see `features.md` §16 and `ADR-003-authorization.md`. Do not design Team Leader pages as a subset of this HR spec; they belong to the Employee interface spec instead.

**On "Employee Leaving" — no separate sidebar page:** There is deliberately no standalone "Employee Leaving" page for Branch Manager. It splits into two existing surfaces instead: (1) offboarding a subordinate stays an "Offboard" button inside that employee's profile (Section 4.2), gated by `employees.offboard`, no separate approval; (2) a Branch Manager resigning *himself* uses the existing self-service "My Requests" flow (Resignation request type, features.md §9) exactly like any other employee. This avoids building a third, redundant surface for something the Requests Inbox and Employee Profile already cover.
 
---
 
## 2. Global UI Concepts (apply across every HR page)
 
- **Gym Context Switcher** — since one HR can be responsible for multiple gyms, and every gym runs its own shift pattern, staff count, and rhythm, almost every data page needs a gym selector at the top. Two acceptable patterns:
  - A dropdown defaulting to "All my gyms" for list/summary views (Dashboard, Employees, Requests)
  - A **mandatory single-gym selector** for anything gym-specific by nature (Shifts, since one gym's calendar can't be merged with another's)
- **Permission-driven navigation** — sidebar items and in-page action buttons render only if the logged-in user holds the gating permission. Two HR users looking at the same Payroll page can see a different set of buttons.
- **Audit trail** — any edit/approval action (attendance correction, shift change, payroll override, request decision) should show a "last changed by / when" trail on that record.
---
 
## 3. Full HR Sitemap
 
1. Dashboard
2. Employees (List + Profile)
3. Recruitment & Hiring (includes New Comers)
4. Attendance
5. Shifts & Schedule Management
6. Requests (Employee Requests Inbox — two-stage: Branch Manager → HR)
7. Payroll
8. Evaluations (custom form builder)
9. Reports & Analytics
10. My Access (HR's own scope/settings)
11. Positions & Levels Catalog
12. Notifications & Announcements
13. Activity / Audit Log
14. Events (HR action queue)
---
 
## 4. Page-by-Page Detail
 
### 4.1 Dashboard
**Purpose:** landing page — a pulse check across every gym this HR has access to.
**Gated by:** always visible once logged in as HR; the *content inside* adapts to individual permissions (e.g. no payroll card if no `payroll.view`).
 
**Sections:**
- Gym selector / "All my gyms" toggle
- Summary cards: total employees, pending requests count, open vacancies, today's attendance %, days remaining in current shift cycle
- Follow-up / alerts feed:
  - Candidates stuck in the pipeline without a next action (per your Recruitment follow-up logic)
  - Attendance issues unresolved for X days
  - Requests pending approval beyond a threshold
  - Shift cycle ending soon with no next cycle created yet
- Quick links into each module
---
 
### 4.2 Employees
**Purpose:** central employee directory, profile management, and the **full employee lifecycle** — not just viewing, but creating, transferring, promoting, and changing status.
**Gated by:** `employees.view`, `employees.create`, `employees.edit`, `employees.transfer`, `employees.position.change`, `employees.role.assign`, `employees.status.change`, `employees.compensation.manage`, `employees.contract.manage`, `employees.offboard`, `employees.documents.view`, `employees.documents.manage`, `employees.bulk_import`, `employees.leave_balance.manage`
 
**List view:**
- Gym filter, search bar, status filter (active / on leave / suspended / terminated)
- Table columns: name, gym, position, level/grade, hire date, status
- **"Add Employee" button** (top of page, if `employees.create`) — manual account creation, separate from the Recruitment→Hire flow. Needed for onboarding existing staff during pilot rollout, rehires, or any case that didn't go through the pipeline.
- **"Bulk Import" button** (if `employees.bulk_import`) — CSV upload to onboard many employees at once; critical for the 2–3 gym pilot phase so HR isn't adding staff one-by-one
- Bulk actions (only rendered if permission allows — e.g. bulk export)
**"Add Employee" flow (modal/wizard):**
1. Personal info (name, contact, ID)
2. Assign gym
3. Assign position/level (picked from the **Positions & Levels Catalog**, see Section 4.11)
4. Set employment type, start date, base compensation
5. System generates login credentials → Employee Account Created
**Profile view (per employee), tabbed:**
- **Personal & Employment Info** — contact details, position, level/grade, hire date, gym assignment
- **Documents** — uploaded files (contract, ID, certifications), with expiry tracking/alerts for anything time-limited. Each document Type is marked `EmployeeEditable`: HR-only types (e.g. Contract, National ID) can never be uploaded/replaced by the employee; employee-editable types (e.g. Certification) can be self-uploaded from the employee's own My Documents tab. Expiring documents also raise an **Event** (Section 4.14) for HR follow-up.
- **Employment History** — full timeline: gym transfers, position/level changes, role changes, compensation changes, status changes — one chronological log
- **Attendance summary** — recent check-in/out snapshot, link to full Attendance page filtered to this employee
- **Current Shift Assignment** — this cycle's schedule for this employee, link to Shifts page
- **Requests History** — all past requests from this employee
- **Leave Balance** — remaining days per leave type (e.g. Annual: 14/21 used, Sick: 2/10 used); adjustable manually (with reason, logged) if `employees.leave_balance.manage`
- **Evaluations History** — score trend, past reviews
- **Payroll Snapshot** — visible only if `payroll.view`
**Management Actions (buttons on the profile, each independently permission-gated):**
- **Transfer Gym** (`employees.transfer`) — move employee to a different gym; pick new gym + effective date; old gym access is revoked, new gym access granted; logged to Employment History
- **Change Position/Level** (`employees.position.change`) — job grade progression within the same track (e.g. Trainer → Senior Trainer); pick new position from catalog + effective date
- **Assign/Change System Role** (`employees.role.assign`) — separate action from the above; this is what grants `Role = Branch Manager` (or revokes it back to plain Employee); triggers the permission-preset assignment described in Section 1. Purely permission-gated like every other action — no separate approval workflow: whoever holds `employees.role.assign` (an HR user or Top Management) can do it directly.
- **Change Status** (`employees.status.change`) — Active / On Leave / Suspended / Terminated, with reason + effective date
- **Manage Compensation** (`employees.compensation.manage`) — record salary changes/raises; feeds the Payroll module; history preserved, not overwritten
- **Manage Contract** (`employees.contract.manage`) — contract type, start/end date; system should flag contracts nearing expiry (ties into the Dashboard follow-up feed)
- **Offboard** (`employees.offboard`) — starts the end-of-service flow (distinct from "Terminated" status — offboarding is a guided process: last working day, exit checklist, final settlement handoff to Payroll)
---
 
### 4.3 Recruitment & Hiring
**Purpose:** manage the hiring pipeline exactly as scoped in your doc — Vacancy → Candidate → Pipeline → Hired → Employee.
**Gated by:** `recruitment.view`, `recruitment.vacancies.manage`, `recruitment.candidates.manage`, `recruitment.hire.approve`, `recruitment.vacancy_request.approve`
 
**Sections:**
- **Vacancy Requests (review queue)** — Branch Manager-submitted requests for a new position, gated by `recruitment.vacancy_request.approve`. Approve → HR creates the actual Vacancy below, linked to the request. Reject → closed with a comment. This is HR's side of Branch Manager's "Request Vacancy" action (see `Regular_Employee.rtf` / features.md §5a); it does not appear on the Branch Manager's own interface beyond his own submitted list. A pending Vacancy Request also raises an **Event** (Section 4.14).
- **Open Vacancies** — gym-scoped list; create/edit/close (if `recruitment.vacancies.manage`); each vacancy now has a **headcount needed** field (e.g. 20), and the sidebar shows applicant/hired progress against it (e.g. "Trainer — 12/20")
- **Candidates / Applications** — full list of everyone who applied
- **Recruitment Pipeline** — kanban board: Screening → 1st Interview → 2nd Interview → Final Decision → (Hired / Waiting List / Rejected)
  - Each candidate card shows: **Current Stage → Required Next Action → days since last action** (this is the follow-up/self-monitoring logic from your doc — cards overdue for action are visually flagged)
- **Waiting List** — accepted candidates with no open vacancy currently
- **Hire action** — triggers Employee Account creation, gym/position assignment; this is the exact moment `Candidate → Employee` happens. If the hire came from a Branch Manager's Vacancy Request, that Branch Manager is notified of the outcome.
- **New Comers** — a dedicated tab/view (separate from the main Employee Directory) listing employees hired but not yet past onboarding. Exit condition: an onboarding checklist (documents collected, system access granted, first shift assigned) — once complete, the employee moves into the normal Employee Directory like anyone else. *(Flagged in the integration notes as HR's call if a different exit condition is preferred.)*
---
 
### 4.4 Attendance
**Purpose:** monitor and correct daily check-in/check-out records.
**Gated by:** `attendance.view`, `attendance.edit`
 
**Sections:**
- Gym selector, date range picker
- Table: employee, check-in time, check-out time, status (on-time / late / absent / missing checkout)
- Manual correction modal (only if `attendance.edit`) — requires a reason, logged to audit trail
- Repeated-issue flagging (e.g. 3+ lates this cycle) surfaced visually
---
 
### 4.5 Shifts & Schedule Management ⭐ (needs the most care)
**Purpose:** build and smoothly edit each gym's shift schedule, where the pattern **rotates roughly every 10 days** and **every gym's pattern is independent** of every other gym's.
**Gated by:** `schedule.view`, `schedule.manage`
 
**Design implications from what you described:**
- This is **not** a fixed weekly template repeated forever — it's a **cycle-based** system. Each cycle has a start/end date (~10 days), and a brand-new cycle has to be planned before the old one runs out.
- **Cycle length is configurable per gym** — not a fixed system-wide 10 days. Each gym's cycle length (7, 10, 14 days, etc.) is a gym-level setting shown and editable right on this page.
- Since gyms differ, this page is **single-gym-at-a-time** — no merged multi-gym view. Switching gyms should feel like switching to a completely separate calendar.
- "Smooth editing" implies inline, low-friction interaction (not form-per-shift) — a grid/calendar the HR can click through quickly.
- **Shift templates are fully custom per gym** — each gym builds its own list from scratch (no shared/global base set imposed by the system).
**Sections:**
- **Gym selector** (mandatory, single selection)
- **Cycle selector/header** — shows current cycle's date range (e.g. "Aug 18 – Aug 27") and this gym's cycle length (editable, e.g. "10 days ▾" if `schedule.manage`), with a **"Create Next Cycle"** action
- **Schedule Grid** — rows = employees at this gym, columns = each day in the cycle; each cell = assigned shift (e.g. Morning / Evening / Off), click-to-edit inline (dropdown or quick-tap cycle through shift options)
- **"Copy Previous Cycle"** — one click duplicates the last cycle's full pattern into the new one as a starting point, so HR only adjusts what's different rather than rebuilding from scratch
- **Shift Templates (per gym)** — a small manageable list built by each gym from scratch (no imposed base set) — e.g. "Morning 8:00–16:00", "Evening 16:00–00:00", "Off"; add/edit/delete templates here, scoped to the currently selected gym only
- **Conflict warnings** — inline flags when: an employee is double-booked, a day is understaffed, or an employee has an *approved* day-off/leave request that overlaps a shift they're assigned to (cross-checked against the Requests module)
- **Publish action** — finalizes the cycle and pushes it live to employees' "My Schedule" self-service view; until published, edits are draft-only
- **History** — read-only view of past cycles, for reference/disputes
---
 
### 4.6 Requests (Employee Requests Inbox)
**Purpose:** review and act on the employee self-service requests — this is now the **second and final stage** of a two-stage flow: the employee's Branch Manager (if assigned) reviews first, then HR makes the final call.
**Gated by:** `requests.view`, `requests.approve` (final HR decision — distinct from the Branch Manager's `requests.approve.branch` stage-1 decision)

Confirmed 11 request types (see features.md §9 for full field list):
Leave/Vacation, Leave Early, Day Off, Sick Leave, Late Arrival Permission,
Shift Swap, Emergency Leave, Document Request, General Inquiry/Complaint,
Resignation, **Overtime**.

**Two-Stage Flow (recap):**
```
Employee submits → Pending → Branch Manager decides (if assigned) →
PendingHRReview → HR makes the FINAL decision → Approved/Rejected
```
If the employee has no Branch Manager, the request arrives at this HR
inbox directly as `Pending`. A request sitting in `PendingHRReview` also
raises an **Event** (Section 4.14) so it isn't missed.

**Sections:**
- **Default filter/sort order:** Pending (with Branch Manager) → Pending (with HR, i.e. `PendingHRReview`) → Final status (Approved/Rejected). Additional filters: gym, request type, date range.
- List/table: employee, type, submitted date, requested date(s), **Branch Manager's decision + reason** (if applicable), current status
- Detail panel per request: reason/notes from employee, the Branch Manager's decision and comment shown as context (if a BM stage occurred), relevant context (e.g. does this day-off request conflict with an already-published shift?), **remaining leave balance for the relevant type shown inline** (so HR isn't approving blind — e.g. "Annual: 5 days remaining"), Approve/Reject with HR comment — this is always the FINAL decision regardless of what the Branch Manager decided
- Bulk approve (only if permission allows)
- Decided-requests history/archive (shows both the BM-stage and HR-stage decisions, if both occurred)
---
 
### 4.7 Payroll
**Purpose:** view and manage payroll per gym per pay period.
**Gated by:** `payroll.view`, `payroll.edit`, `payroll.approve`
 
**Sections:**
- Gym + pay period selector
- Table: employee, base salary, deductions (auto-linked to attendance/leave exceptions), bonuses, net pay
- Deduction detail view — auto-calculated line items, manual override only if `payroll.edit`. Manager-issued (non-attendance) deductions require a reason + date; the employee-facing view never shows which Branch Manager issued it, only the reason/date/amount.
- **Approve payroll run** — only if `payroll.approve`; locks the period once approved
- Payslip preview per employee
- Export (CSV/PDF)

**Note — Employee's own view is richer than this HR table.** The employee self-service Payroll tab additionally shows: Annual Increase (auto-applied from the gym's configured `AnnualIncreasePercent`/anchor date), Scheduled Work Days, Scheduled Weekly Off-Days, Actual Attendance Days, Overtime Hours (from Approved Overtime requests), and Annual Leave Used/Remaining. See features.md §10 for the full field list — this HR page itself doesn't need new columns for these.
---
 
### 4.8 Evaluations
**Purpose:** build custom evaluation forms and run evaluation cycles — not a fixed criteria/score template.
**Gated by:** `evaluations.view`, `evaluations.manage`
 
**Sections:**
- **Form Builder** — HR creates a form scoped to a **Gym and/or Position** (different gyms/positions can have entirely different forms). Add/reorder/remove questions, each typed as:
  - **Rating (1–5)**
  - **Multiple Choice** (single answer from defined options)
  - **Checkbox** (multiple answers from defined options)
- Gym + evaluation period selector, employee list to run against
- **Run Evaluation** — select employee, pick the form matching their gym/position, fill it out → saved as an `EvaluationResponse`
- Per-employee evaluation history/trend (past responses, viewable read-only)
- ⚠️ Open item: whether older fixed-format evaluation history (if any exists) needs to display alongside new custom-form responses, or this is a clean cutover, is still pending confirmation.
---
 
### 4.9 Reports & Analytics
**Purpose:** gym-level HR reporting.
**Gated by:** `reports.view`
 
**Sections:**
- Report type selector: Headcount, Turnover, Attendance trends, Recruitment funnel conversion, Request volume by type
- Gym filter, date range
- Chart view + export
---
 
### 4.10 My Access (HR's own settings)
**Purpose:** lets the HR user see their own scope — helpful for a system where permissions are fully individualized and not obvious from a role label alone.
 
**Sections:**
- List of gyms they currently have access to
- Read-only list of their own granted permissions (so they understand what they can/can't do, and know who to ask if they need more)
- Basic profile settings (password, notification preferences)
---
 
### 4.11 Positions & Levels Catalog
**Purpose:** manage the master list of positions/grades (e.g. Trainer, Senior Trainer, Front Desk, Branch Manager-eligible tracks) that HR picks from in "Add Employee" and "Change Position/Level." Not exclusive to one side of the org — ownership follows the same permission model as everything else.
**Gated by:** `positions.view`, `positions.manage` — either an HR user or a Top Management user can hold these; whoever has `positions.manage` can add/edit/retire catalog entries.
 
**Sections:**
- List of all positions/levels: name, track/department, order within its progression (e.g. Trainer → Senior Trainer → Lead Trainer)
- Add/Edit position (if `positions.manage`): name, description, track, sort order
- Retire position (soft-delete — keeps historical assignments intact, just hides it from future "Add Employee"/"Change Position" dropdowns)
- *(Open question: is this catalog global across all 15 gyms, or can individual gyms add their own gym-specific positions? Default assumption below is a single global catalog — flag if you want per-gym customization here too.)*
---
 
### 4.12 Notifications & Announcements
**Purpose:** lets HR broadcast messages to employees — the outbound counterpart to the Dashboard's inbound alerts feed.
**Gated by:** `announcements.view`, `announcements.manage`
 
**Sections:**
- Gym filter (send to one gym, several, or "all my gyms")
- Compose new announcement (if `announcements.manage`): title, body, target gym(s), optional target audience (all employees / specific position / specific status), schedule now or later
- Sent history — list of past announcements: title, sent by, sent date, reach (gym/audience), delivery status
- Edit/retract a scheduled-but-not-yet-sent announcement
---
 
### 4.13 Activity / Audit Log
**Purpose:** a single page to review every permission-gated action taken across the gyms this HR has access to — the aggregate view, complementing the per-record "last changed by/when" trails already embedded on individual records (Employee Profile, Payroll, Shifts, etc.).
**Gated by:** `audit.view`
 
**Sections:**
- Filters: gym, action type (employee edit, transfer, role change, payroll edit, shift edit, request decision, etc.), performed-by user, date range
- Table: timestamp, actor, action, affected record (linked — clicking jumps to that record), gym
- Read-only — this page never allows editing, only reviewing
---
 
### 4.14 Events (HR Action Queue)
**Purpose:** a single working queue of items that need HR to actually act — distinct from the purely informational Notification bell.
**Gated by:** not separately permission-gated as a page; each row's visibility follows the permission of its underlying entity.
 
**What appears here:**
- Documents/contracts nearing or past expiry
- A Resignation request or a Branch-Manager-initiated termination needing HR follow-up (schedule exit appointment, run Offboarding)
- A pending Vacancy Request awaiting Approve/Reject
- A request now sitting in `PendingHRReview` after the Branch Manager's stage-1 decision (Section 4.6)
 
**Sections:**
- Default view: all Open events across the HR user's accessible gyms, each row linking directly to the underlying record
- Mark **Resolved** once actioned; resolved items drop into a separate archive/filter view
- Gym filter
---
 
## 5. Open Items — Status
 
| # | Item | Status |
|---|---|---|
| 1 | Exact list of the 9 employee request types | **Pending** — Youssef will provide later. Requests page (4.6) keeps the current 9-item placeholder table purely as a structural stand-in until the real list arrives. |
| 2 | Shift templates fully custom vs shared base | ✅ Settled — fully custom per gym, no imposed base set |
| 3 | Shift cycle length fixed vs configurable | ✅ Settled — configurable per gym |
| 4 | Position/level catalog ownership | ✅ Settled — permission-gated (`positions.manage`). **Per-gym catalog** — each gym defines its own positions independently (e.g., Gym A can have "Senior Trainer" while Gym B does not). There is no shared global catalog. This is confirmed in the project plan and reflected in the database schema (`Positions.GymId FK`). The earlier "assumed global" note is superseded by this decision. |
| 5 | Branch Manager role assignment approval | ✅ Settled — plain permission (`employees.role.assign`), no separate approval workflow; holder (HR or Top Management) can grant/revoke directly |
| 6 | Leave/vacation balance tracking | ✅ Settled — added to Employee Profile (4.2) and surfaced inline on Requests detail panel (4.6) |
| 7 | Notifications/Announcements | ✅ Settled — added as new page (4.12) |
| 8 | Dedicated Activity/Audit Log page | ✅ Settled — added as new page (4.13) |
| 9 | Two-stage Requests approval (Branch Manager → HR) | ✅ Settled — added as new flow in 4.6 |
| 10 | Events (HR action queue) | ✅ Settled — added as new page (4.14) |
| 11 | Evaluations custom form builder | ✅ Settled — 4.8 rewritten; open sub-item: legacy evaluation data coexistence (pending) |
| 12 | Employee Documents access matrix (which types employee can self-upload) | ⚠️ Pattern settled (per-type gating), exact type-by-type list still pending |
| 13 | New Comers tab exit condition | ⚠️ Recommended: onboarding checklist — pending final sign-off |
| 14 | Vacancy headcount field | ✅ Settled — added to 4.3 |
| 15 | "Paid Leave" on employee Payroll view — distinct type or just a label for Annual Leave | ⚠️ Pending |
 
---
 
## 6. Confirmed Full Employee Lifecycle (for reference)
 
```
Candidate → Hired → Employee Account Created (via Recruitment)
        or  Employee Account Created directly by HR (manual / bulk import)
                ↓
        Assigned to Gym + Position/Level
                ↓
        Active Employee
                ↓
   ┌────────────┼────────────┬────────────┬─────────────┐
Transfer      Position/Level  Role Change  Status Change  Compensation
to another    Change (promo/  (e.g. grant  (Active/Leave/  Change (raise)
gym           demotion)       Branch Mgr)  Suspended)
   └────────────┴────────────┴────────────┴─────────────┘
                ↓
        Offboarding (end-of-service)
```
 
Every one of these transitions is a permission-gated action on the Employee Profile, and every one writes an entry into that employee's Employment History tab — so nothing changes silently.