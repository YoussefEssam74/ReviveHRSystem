# HR Portal API — Manual Test Checklist (spec Sections 4 & 5)

Manual Swagger test sheet for every implemented HR Portal endpoint.
Source contract: [`docs/architecture/api-spec-from-ui.md`](../architecture/api-spec-from-ui.md) — Section 4 (HR Portal: Dashboard, Employees, Attendance, Schedule, Requests, Branch Queue, HR Team) and Section 5 (Recruitment, Hiring Forms, Payroll, Evaluations, Events, Access).
Endpoint reference: [`docs/architecture/api.md`](../architecture/api.md).

- **Part A** = spec Section 4 (Employees, Roles/Permissions/Users, Requests, Attendance management — the implemented sub-areas).
- **Part B** = spec Section 5 (Recruitment §5.1, Public forms §5.2, Form builder & Evaluations §5.3–§5.4, Payroll §5.5, Events & Separations §5.6, Notifications §5.7, My Access §5.8, Reports/Positions/Audit §5.9, Escalated requests §9.4).
- **Not built (skip)**: Section 4's Dashboard, Schedule & Shifts, Branch Queue actions (deduction/warning/bonus), and HR Team screens have no endpoints yet — frontend comes later.

---

## 0. Setup (do once)

1. Start the app (from repo root):

   ```
   dotnet run --project ReviveHRSystem.Web\ReviveHRSystem.Web.csproj --launch-profile http
   ```

2. Open **http://localhost:5248/swagger**.
3. **Login** — `POST /api/auth/login` → *Try it out*:

   ```json
   { "email": "admin@revive.hr", "password": "Revive!2026" }
   ```

   Copy `accessToken` from the response.
4. Click **Authorize** (top of page) → enter:

   ```
   Bearer <accessToken>
   ```

**Seeded accounts** (password `Revive!2026`):

| Email | Role |
|---|---|
| admin@revive.hr | TopManagement — **bypasses all permission checks; use this for happy paths** |
| karim@revive.hr | Employee |
| omar@revive.hr | Employee |
| sara@revive.hr | Employee |

**Seeded gyms:** Revive Main Gym, Revive Second Gym (station codes seeded at startup).

**Conventions used by every endpoint below:**

| Situation | Expected |
|---|---|
| No/invalid token, or missing permission | **401** (this codebase uses 401, never 403) |
| Validation failure / business rule | **400** with `{ statusCode, errorMessage, errors[] }` — read `errorMessage` |
| Unknown id | **404** with the same envelope |
| List endpoints | `{ items, page, pageSize, total, totalPages }` — note `total`, not the mock's stale `totalCount` |
| Create / detail | `{ data: … }`; most actions return `{ message }` |

> **Tip:** run `GET /api/employees` first and note real employee ids / gym ids — the bodies below use placeholders. To test **permission denials (401)**, create a scoped HR user (Part A2) with a single permission key and log in as them.

---

# Part A — Section 4: HR Portal core

## A1. Employees — Swagger group **Employees**, base `/api/employees`

- [ ] **GET /api/employees** — directory
  - Query (all optional): `gym`, `search`, `status` (Active | On Leave | Suspended | Terminated — invalid → 400), `page=1`, `pageSize=20`, `sortBy` (name | hireDate | status), `sortOrder` (asc | desc)
  - Expect **200** `{ items: [{ id, employeeNumber, name, position, level, gymId, gym, status, initials, hireDate, salary, phone, email }], page, pageSize, total, totalPages }`
  - Try `?search=karim`, `?status=Active`

- [ ] **POST /api/employees** — create (permission `employees.create`)

  ```json
  {
    "firstName": "Test",
    "lastName": "User",
    "email": "test.user@revive.hr",
    "phone": "01000000000",
    "position": "Trainer",
    "level": "Employee",
    "salary": 5000,
    "gym": 1,
    "startDate": "2026-10-01"
  }
  ```

  - Expect **200** `{ data: { id, employeeNumber: "EMP-1001", … } }`; duplicate email → 400

- [ ] **POST /api/employees/bulk-import** — multipart `.csv` upload (max 5 MB; columns name,email,position,level,gym,salary)
  - Expect `{ message, added, skipped }` — rows are imported/skipped individually

- [ ] **GET /api/employees/{id}** — detail → **200** `{ data: { …profile…, systemRole, branches: [{ id, name, branch }] } }`
- [ ] **PUT /api/employees/{id}** — partial update (permission `employees.edit`)

  ```json
  { "name": "Test User Renamed", "position": "Senior Trainer", "status": "Active" }
  ```

  - Returns the profile **unwrapped** (no `{ data }`)

- [ ] **POST /api/employees/{id}/status-change** — working status (does **not** touch the login)

  ```json
  { "status": "Suspended", "note": "Manual swagger test" }
  ```

  - Statuses: Active | On Leave | Suspended | Terminated (invalid → 400); check `GET /api/employees/{id}/history` shows "Status Changed"

- [ ] **GET /api/employees/{id}/history** — `[{ type, from, to, date, detail }]` newest first
- [ ] **GET /api/employees/{id}/leave-balance** — `{ employeeId, dayOff: { used, total }, sick: {…}, unpaid: {…} }`
- [ ] **PUT /api/employees/{id}/leave-balance** — upsert (permission `employees.leave_balance.manage`)

  ```json
  {
    "dayOff": { "used": 1, "total": 5 },
    "sick":   { "used": 0, "total": 7 },
    "unpaid": { "used": 0, "total": 0 }
  }
  ```

- [ ] **POST /api/employees/{id}/transfer** — branch transfer (needs `employees.transfer` on **both** gyms)

  ```json
  { "toGym": 2, "effectiveDate": "2026-11-01", "reason": "Branch rebalancing" }
  ```

  - Same gym → 400; confirm `gym` changed in the detail view

- [ ] **POST /api/employees/{id}/position-change**

  ```json
  { "position": "Head Trainer", "level": "Senior" }
  ```

  - Already on this position+level → 400

- [ ] **POST /api/employees/{id}/compensation** — salary change

  ```json
  { "salary": 7500, "effectiveDate": "2026-11-01" }
  ```

  - Detail view's `salary` should now show the new amount

- [ ] **POST /api/employees/{id}/contract** — any subset of `{ level?, salary?, effectiveDate? }`; nothing to change → 400
- [ ] **POST /api/employees/{id}/role-change** — system role + direct overrides (permission `employees.role.assign`)

  ```json
  { "systemRole": "Team Leader", "permissions": ["requests.approve"] }
  ```

  - Unknown role name → 400 ("Create it under Roles & Permissions first" — create it in A2 first); `"None (Employee)"` clears the role

- [ ] **GET /api/employees/{id}/documents** — `[{ name, category, status: Valid | Expiring Soon }]`
- [ ] **POST /api/employees/{id}/documents** — multipart upload: `file` (PDF/PNG/JPG/…, ≤ 10 MB), `category` (Employment Contract | Identification | Personal Photo | First Aid | Medical Fitness | Degree Certificate | Other), `expiryDate?` (`yyyy-MM-dd`)
  - Bad category/empty file → 400; set `expiryDate` a week out → status **Expiring Soon**

## A2. Roles, Permissions & Users — base `/api/roles`, `/api/users`

- [ ] **GET /api/roles** — `?search=`, `page`, `pageSize` → `{ items: [{ id, name, description, status, permissionsCount, usersCount, isEmpty, isPreset, permissions[] }], … }`
- [ ] **POST /api/roles** — create (permission `team.manage`)

  ```json
  { "name": "Test Role", "description": "Swagger test", "permissions": ["attendance.view", "employees.view"] }
  ```

  - Expect **201** `{ data: <role> }`; duplicate name → 400, unknown permission key → 400

- [ ] **PUT /api/roles/{id}** — update

  ```json
  { "name": "Test Role Renamed", "description": "updated", "permissions": ["attendance.view"] }
  ```

- [ ] **PUT /api/roles/{id}/permissions** — replace the whole set (Configure)

  ```json
  { "permissions": ["attendance.view", "attendance.correct"] }
  ```

- [ ] **POST /api/roles/{id}/clone**

  ```json
  { "name": "Test Role Clone" }
  ```

- [ ] **DELETE /api/roles/{id}** — **204**; assigned to a user → **400** ("reassign them before archiving")
- [ ] **GET /api/permissions** — catalog → **200** `{ data: { items: [{ key, area, description }], modules: […], totalTracked } }`
- [ ] **PUT /api/users/{id}/permissions** — direct overrides (replace wholesale)

  ```json
  { "permissions": ["attendance.view", "employees.view"] }
  ```

  - Response echoes `effectivePermissions` (direct ∪ role)

- [ ] **PUT /api/users/{id}/roles** — single role by id or preset name

  ```json
  { "roleId": 2 }
  ```

  or `{ "rolePreset": "Team Leader" }` (unknown preset → 400; both → 400; empty → clears)

- [ ] **PUT /api/users/{id}/gym-access** — replacement set

  ```json
  { "gymIds": [1, 2] }
  ```

  - Unknown id → 400; verify via `GET /api/users/{id}` (B9) that `gyms[]` changed

## A3. Requests — Swagger group **Requests**, base `/api/requests`

- [ ] **GET /api/requests** — directory
  - Query: `status` (Pending | Pending HR Review | Approved | Rejected | Archived | Decided), `type`, `gym`, `date` (`yyyy-MM-dd`), `quick` (urgent | approved | bmRejected | balance), `ids` (comma-separated), `page`, `pageSize`, `sortBy`, `sortOrder` — invalid `status`/`type`/`quick` → 400
  - Each item carries `bmDecision`, `payment`, `submittedDate`, `urgent`
- [ ] **GET /api/requests/{id}** — detail → `{ data: { …item…, timeline: [{ step, date, done }] } }`
- [ ] **POST /api/requests** — create on behalf of an employee

  ```json
  {
    "employee": "karim",  
    "type": "Day Off",
    "requestedDate": "2026-10-20",
    "endDate": "2026-10-21",
    "reason": "Family trip"
  }
  ```

  - `employee` must resolve to exactly one employee (ambiguous/unknown → 400); types: Day Off | Sick Leave | Emergency Leave | Unpaid Leave | Resignation | Immediate Termination
  - Expect **201** `{ data: { id, status: "Pending HR Review", timeline } }` — note the `id`

- [ ] **POST /api/requests/{id}/decide** — the HR verdict

  ```json
  { "stage": "HR", "decision": "Approved", "comment": "ok", "payment": "paid" }
  ```

  - Reject must carry a comment: `{ "stage": "HR", "decision": "Rejected", "comment": "not ok" }` → 400 without it
  - Wrong `stage` → 400; not Pending HR Review → 400; approving a **Resignation** returns `offboardingPrompt: true` and moves the employee to Notice Period
  - Paid Day Off deducts from the leave balance (check A1's balance endpoint)

- [ ] **POST /api/requests/{id}/undo-decision** — `{ "comment": "undo test" }` → back to Pending HR Review; a past date → 400
- [ ] **POST /api/requests/bulk-decide**

  ```json
  { "decision": "Approved", "comment": "bulk", "requestIds": [1, 2] }
  ```

  - Expect `{ message: "Bulk approved", approved, unpaidApplied }`; `Rejected` → 400

- [ ] **POST /api/requests/{id}/archive** · **POST /api/requests/{id}/restore** — `{ message }`
- [ ] **GET /api/employees/{id}/requests** — the employee-file tab → plain array

## A4. Attendance management — Swagger group **Attendance**, base `/api/attendance`

- [ ] **GET /api/attendance** — the directory grid
  - Query: `date` **or** `from`/`to` (≤ 62 days), `gym`, `employeeId`, `status` (On Time | Late | Absent | Early Checkout | Missing Checkout | Off), `page`, `pageSize` (max 200)
  - Items include `notes`, `correctedBy`, `correctedAt`; synthesized days have `id: null`

- [ ] **POST /api/attendance/manual** — HR day-write (permission `attendance.manual_entry`)

  ```json
  {
    "employeeId": "2",
    "date": "2026-10-12",
    "checkIn": "09:00",
    "checkOut": "17:00",
    "status": "On Time",
    "reason": "Forgot to check in"
  }
  ```

  - `Scheduled` status is rejected (derived-only); reason must be 3–500 chars; upserts the day — confirm it appears in `GET /api/attendance?date=2026-10-12`

- [ ] **PUT /api/attendance/{id}/correct** — correction with audit (permission `attendance.edit`)

  ```json
  { "checkIn": "08:55", "checkOut": "17:30", "status": "On Time", "reason": "Device was offline" }
  ```

  - Confirm `correctedBy` / `correctedAt` populate in the GET list

- [ ] **GET /api/attendance/{id}** — punch audit by ref (payroll links): use `ATT-{recordId}` or the bare id → `{ data: { id, date, firstIn, lastOut, device, exception, detail } }`
- [ ] **GET /api/employees/{id}/attendance** — employee file tab
  - Query: `month=2026-10`, `page`, `pageSize` → `{ items: [{ date, shift, checkIn, checkOut, status, notes }], totals: { total, present, late, absent, off, hours, expected } }` (elapsed days only)
- [ ] **POST /api/gyms/{gymId}/biometric-devices/pairing-codes** — Pair Biometric Device modal

  ```json
  { "stationLabel": "Front Desk Scanner" }
  ```

  - Expect `{ code, gymId, gymName, stationLabel, generatedAt, expiresAt }` (a fresh 6-digit kiosk code — the old one stops working)

---

# Part B — Section 5: HR Portal pages

## B1. Recruitment & hiring (§5.1) — Swagger group **Recruitment** / **Vacancies** / **Candidates** / **Interviews**

- [ ] **GET /api/vacancies** — Query: `gym`, `status` (Open | Draft | Closed), `searchTerm`, `page`, `pageSize`, `sortBy` (createdDate | position | headcount), `sortOrder`
- [ ] **POST /api/vacancies** — create (permission `recruitment.vacancies.manage`)

  ```json
  {
    "position": "Personal Trainer",
    "gym": "Revive Main Gym",
    "headcountNeeded": 2,
    "urgency": "High",
    "source": "Walk-in",
    "jobDescription": "Floor trainer",
    "salary": 9000,
    "shift": "Morning Shift"
  }
  ```

  - Expect **201** `{ data: <vacancy> }` with a public-link token; unknown gym/urgency → 400

- [ ] **GET /api/vacancies/{id}** — detail modal → `{ data: <vacancy>, funnel: [{ stage, count }], employeesUnderPosition: […], candidates: […] }`
- [ ] **PUT /api/vacancies/{id}** — partial update (e.g. `{ "headcountNeeded": 3 }`)
- [ ] **GET /api/vacancy-requests** — `?status=Pending`, `?gym=`
- [ ] **POST /api/vacancy-requests** — Branch-Manager submit (permission `recruitment.vacancy_request.create`)

  ```json
  { "position": "Nutritionist", "gym": 1, "urgency": "Medium", "reason": "New clients", "headcount": 1 }
  ```

- [ ] **PUT /api/vacancy-requests/{id}/decide** — approval creates the vacancy

  ```json
  { "decision": "Approved", "comment": "agreed", "headcountNeeded": 1 }
  ```

  - Then confirm `vacancyId` is set and `GET /api/vacancies` lists it; already-decided → 400; try `{ "decision": "Rejected", "comment": "budget" }` on another
- [ ] **PUT /api/vacancy-requests/{id}/reopen** — a decided request back to Pending
- [ ] **GET /api/candidates** — pipeline cards (`?stage=`, `?vacancyId=`, `?searchTerm=`)
- [ ] **GET /api/candidates/{id}** — detail (latest application + interviews)
- [ ] **PUT /api/candidates/{id}/block** — block a candidate (blocked emails can't be hired or apply publicly)
- [ ] **POST /api/candidates** — the §5.2 conversion: `{ "applicationId": <id> }` → **201** `{ data: <candidate card>, applicationStatus: "Moved to Pipeline" }` (double-convert → 400)
- [ ] **GET /api/applications** — `?formId=`, `?status=` (New | In Review | Shortlisted | Rejected | Moved to Pipeline), `?searchTerm=`
- [ ] **GET /api/applications/{id}** — full answers + reject comment
- [ ] **PUT /api/applications/{id}/reject** — `{ "comment": "not the right fit" }` (idempotent; already-converted → 400)
- [ ] **PUT /api/applications/{id}/stage** — `{ "stage": "Second Interview" }` (any stage, forward or backward; `Hired` → **400** — use the hire wizard)
- [ ] **POST /api/applications/{id}/hire** — the Hired transition

  ```json
  { "gym": "Revive Main Gym", "salary": 8000, "startDate": "2026-11-01", "level": "Employee" }
  ```

  - Expect **201** `{ data: { employeeId, name, gym, status, vacancyHeadcountRemaining, … } }` — a User account + Employee profile are created (password defaults to the shared temp password) and the vacancy headcount drops; already-hired → 400

- [ ] **GET /api/interviews** — `?month=2026-10` or `?date=`, `?status=pending|completed|cancelled`, `?candidateId=`
- [ ] **POST /api/interviews** — schedule a round

  ```json
  { "candidateId": 1, "date": "2026-10-25", "time": "11:00", "type": "On-site", "interviewer": "admin@revive.hr", "room": "Office 1" }
  ```

  - Round defaults to First Interview, or Second Interview when one exists

- [ ] **GET /api/interviews/{id}** · **PUT /api/interviews/{id}/complete** · **POST /api/interviews/{id}/reminder** (`{ message: "Reminder sent." }`)
- [ ] **GET /api/recruitment/follow-ups** — no stage activity for 5+ days
- [ ] **GET /api/recruitment/waiting-list** — parked entries + `matchingVacancies[]`
- [ ] **POST /api/recruitment/waiting-list/{id}/assign** — 3-step assign wizard (`{ vacancyId?, position?, gym?, startDate?, salary?, … }`) → **201** `{ data: { employeeId, …, waitingListRemoved: true } }`
- [ ] **DELETE /api/recruitment/waiting-list/{id}** — **204** (not waiting → 400)
- [ ] **GET /api/employees/new-comers** — hired ≤ 30 days ago or incomplete checklist → `{ items: [{ id, name, position, startDate, progress, checklist: [[label, done], …] }] }`
- [ ] **PUT /api/employees/{id}/onboarding-checklist** — `{ "item": "Uniform issued", "done": true }` (unknown label → 400) or a batch `{ "checklist": [[label, done], …] }` → `{ data: { id, progress, checklist } }`

## B2. Public application forms (§5.2) — anonymous

- [ ] **GET /api/hiring-forms** — **with no Authorization**: Open forms only
- [ ] **GET /api/hiring-forms/{id}** — same, anonymous: the form definition (questions); a Closed form → 404
- [ ] **POST /api/applications** — **anonymous**, per-IP rate limited (30/min → **429**)

  ```json
  {
    "formId": 1,
    "name": "Public Applicant",
    "email": "applicant@example.com",
    "phone": "01111111111",
    "gym": "Revive Main Gym",
    "position": "Trainer",
    "answers": [
      { "question": "Why Revive?", "type": "text", "answer": "Love the gyms" },
      { "question": "Available shifts", "type": "checkbox", "answer": ["Morning", "Evening"] }
    ],
    "source": "Careers page"
  }
  ```

  - Expect **201** `{ message: "Application submitted." }`; the row then appears in `GET /api/applications` (B1)
  - Missing name/email → 400; email without "@" → 400; a **blocked candidate's** email → 400; closed form → 400

## B3. Form builder & Evaluations (§5.3–§5.4) — base `/api/evaluation-forms`, `/api/hiring-forms`

- [ ] **GET /api/evaluation-forms** — `?gym=`, `?status=` (Active | Completed | Inactive), `?position=`
- [ ] **POST /api/evaluation-forms** — create a template (permission `evaluations.forms.manage`)

  ```json
  {
    "name": "Q4 Trainer Review",
    "position": "Trainer",
    "gym": "Revive Main Gym",
    "status": "Active",
    "questionList": [
      { "type": "text", "text": "Biggest win this quarter?" },
      { "type": "choose", "text": "Overall rating", "options": ["Excellent", "Good", "Needs work"] },
      { "type": "checkbox", "text": "Completed trainings", "options": ["Safety", "Nutrition"] }
    ]
  }
  ```

  - Expect **201** `{ data: <form> }` with `questions` (count) echoed; no questions → 400; a choice question with < 2 options → 400; unknown type → 400

- [ ] **GET /api/evaluation-forms/{id}** — `{ data: <form with questionList> }`
- [ ] **PUT /api/evaluation-forms/{id}** — **replaces** the whole question list
- [ ] **DELETE /api/evaluation-forms/{id}** — **204**; with existing responses → **400** ("set its status to Inactive instead")
- [ ] **GET /api/hiring-forms** / **POST /api/hiring-forms** / **PUT /api/hiring-forms/{id}** / **DELETE /api/hiring-forms/{id}** — same contract, `status` is Open | Closed (delete blocked with 400 while applications exist)
- [ ] **POST /api/evaluation-forms/{id}/dispatch** — route to eligible evaluators (empty body; only Active forms — else 400)
  - Expect `{ data: { formId, createdAssignments: [{ id, formId, evaluatorEmail, subjects[], … }], routedEvaluators, evaluationsAssigned } }`
  - **Run it twice** — second time `createdAssignments` is empty and counters are 0 (idempotent); an `Evaluation Dispatched` audit row lands in B10
- [ ] **GET /api/evaluation-assignments** — the evaluator's `MY EVALUATIONS` inbox (grouped per form)
- [ ] **POST /api/evaluation-forms/{id}/responses** — submit a review

  ```json
  {
    "employee": "karim",
    "score": 85,
    "notes": "Strong quarter",
    "answers": [
      { "question": "Biggest win this quarter?", "type": "text", "answer": "Retention up 12%" },
      { "question": "Overall rating", "type": "choose", "answer": "Excellent" }
    ]
  }
  ```

  - Expect **201** `{ data: { id, score, status: "Completed", … }, assignment: {…} | null }`; score out of 0–100 → 400; with `assignmentId`, that assignment flips to Completed

- [ ] **POST /api/evaluation-forms/{id}/launch-cycle** — `{ "period": "Q4 2026" }` → `{ data: { batchId, startedCount, status: "In Progress" } }`; re-run → `startedCount: 0`, same `batchId`
- [ ] **GET /api/evaluation-responses** — history (`?gym=`, `?employeeId=`, `?formId=`, `?period=`)
- [ ] **GET /api/evaluation-forms/{id}/responses** — same shape, formId pinned
- [ ] **GET /api/employees/{id}/evaluations** — profile tab with derived `result` (Pass ≥ 60 | Below Target | Pending)
- [ ] **GET /api/performance-cycles** — `{ items: [{ id, name, start, end, status }] }`
- [ ] **GET /api/goals** · **POST /api/goals** — `{ "title": "Improve class attendance", "employee": "karim", "due": "2026-12-31" }` → status "On Track", progress 0

## B4. Payroll (§5.5) — base `/api/payroll-periods`

> The seeded database has no payroll periods. Create one directly in the DB (or via the API of your choice) before the first two checks, or simply confirm an empty list returns `{ items: [], total: 0 }`.

- [ ] **GET /api/payroll-periods** — derived statuses Open | Partially Published | Published | Paid; per-period totals
- [ ] **GET /api/payroll-periods/{id}** — entry sheets with `deductionLines[]` (`attendanceRef` = `ATT-{recordId}` / `ATT-MANUAL`), `relatedRequestIds[]`
- [ ] **PUT /api/payroll-periods/{periodId}/entries/{employeeId}** — `{ "bonus": 500 }` → `{ data: { employeeId, bonus, gross, deductions, net } }` (locked period → 400)
- [ ] **POST /api/payroll-periods/{periodId}/entries/{employeeId}/deductions** — inline Add-Line

  ```json
  { "source": "manager", "reason": "Damaged equipment", "amount": 250 }
  ```

  - Returns the line as `Pending` — note the line `id`; pending lines don't count toward `deductions`/`net` yet

- [ ] **POST /api/payroll-periods/{periodId}/entries/{employeeId}/close** — **400 while a line is Pending** ("settle the lines first"); review the line (next item) then close → status `Reviewed`
- [ ] **POST /api/deduction-candidates/{id}/review** — `{ "decision": "Accepted" }` (or `"Rejected"` to waive) → the entry's `deductions`/`net` recompute; bad decision → 400
- [ ] **POST /api/payroll-periods/{periodId}/entries/{employeeId}/reopen** — back to Draft
- [ ] **POST /api/payroll-periods/{id}/approve** — publish & lock

  ```json
  { "gym": "Revive Main Gym" }
  ```

  - Unsettled sheets → 400; wrong branch → 400; all Reviewed → period Locked/"Published" + `Payroll Published` audit row (check B10); repeat → 400

- [ ] **GET /api/payroll-periods/{id}/payslips/{employeeId}** — payslip preview (net counts Accepted|Approved only)
- [ ] **GET /api/payroll-periods/{id}/export?format=csv** — CSV stream (`payroll-{month}-{branch}.csv`); `format=pdf` → 400
- [ ] **GET /api/deduction-candidates** — the review queue (`?gym=`, `?period=`, `?status=Pending`)
- [ ] **GET /api/employees/{id}/payroll** — per-employee history

## B5. Events queue (§5.6) — Swagger group **Events**, base `/api/events`

> The queue is derived on read: to see anything, first create a source — e.g. upload a document expiring next week (A1), set `ContractEndDate` on an employee, create a request left Pending HR Review, open a vacancy request, or leave a payroll period unpublished.

- [ ] **GET /api/events** — the page
  - Query: `gym` (`all` [default] | id | name — unknown → **400 "Gym not found."**), `type` (comma-separated: `Document Expiry, Contract Expiry, Requests, Leaving, Transfer Tickets, Vacancy Requests, Payroll Approval`), `urgency` (high | medium | low), `resolved` (true = "View resolved (n)"), `page`, `pageSize`
  - Expect `{ items: [<batch payload>…], counts: { documents, contracts, requests, leaving, transfers, vacancies, payroll: { open, resolved } }, hidden, page, pageSize, total, totalPages }`
  - Urgency check: a document expiring in ≤ 7 days → `high`, 8–14 days → `medium`, later → `low`; a Resignation card is always `high`

- [ ] **GET /api/events/counts** — `{ data: { documents, contracts, requests, leaving, transfers, vacancies, payroll } }`
- [ ] **POST /api/events/{id}/resolve** — stamps resolved + bumps the tab's resolved count; **POST /api/events/{id}/reopen** — clears it (both idempotent)
- [ ] **POST /api/events/{id}/renewal-request** — **documents only** (empty body)
  - Expect **201** `{ data: { id, notifiedUserId, notificationId } }`; the employee gets a "Replacement requested" notification and a "Document Renewal Requested" audit row lands
  - Try it on a **Contract Expiry** card → **400**

- [ ] **POST /api/events/{id}/decide** — **Transfer Tickets only**

  ```json
  { "decision": "approve", "comment": "approved via escalations", "targetGym": "Revive Second Gym" }
  ```

  - Approve moves the employee, resolves the ticket, audits "Gym Transfer Executed"; `{ "decision": "reject", "comment": "…" }` stores the comment without moving anyone
  - Unknown `targetGym` → 400; decide on any other card type → 400 ("Only transfer tickets accept a decision"); decide twice → 400

## B6. Separations / exit lifecycle (§5.6) — Swagger group **Separations**

- [ ] **POST /api/employees/{id}/offboard** — E19, HR-initiated offboarding

  ```json
  { "lastDay": "2026-11-15", "reason": "Relocation", "notes": "Moving abroad" }
  ```

  - Expect **201** `{ data: { separationId } }`; the employee moves to **Notice Period**; a reason containing "Termination"/"Performance"/"Attendance" derives `separationType: "Termination"`; a second open case → **400** ("already has an exit in progress")

- [ ] **GET /api/separations** — pipeline (`?gym=`, `?status=` Requested | Notice Period | Exit In Progress | Under Review | Completed, `?type=` Resignation | Termination) → items carry `progress`, the 5-item `checklist: [[label, done], …]`, `verdict`, `leaveTaken`, `requestedBy`
- [ ] **GET /api/separations/{id}** — detail (verdict is `null` until T5); another branch's case → 401
- [ ] **POST /api/separations** — T2, the Branch-Manager termination request

  ```json
  {
    "employeeId": 2,
    "lastDay": "2026-11-30",
    "reason": "Misconduct / policy breach",
    "notes": "Second warning logged"
  }
  ```

  - Reason vocabulary (case-insensitive): Performance issues · Attendance violations · Misconduct / policy breach · Contract expiry — not renewing · Restructuring / redundancy — anything else → **400** listing them
  - Creates the case as `Requested`/`Termination` — the employee's status does **not** change yet

- [ ] **PUT /api/separations/{id}/checklist** — T3

  ```json
  { "index": 0, "done": true }
  ```

  - First tick moves `Requested`/`Notice Period` → **Exit In Progress** and `progress` → 20; unknown index → 400

- [ ] **PUT /api/separations/{id}/stage** — T4

  ```json
  { "status": "Under Review" }
  ```

  - Unknown status → 400 (vocabulary above); `{ "status": "Completed" }` auto-ticks the whole checklist (idempotent)

- [ ] **PUT /api/separations/{id}/verdict** — T5

  ```json
  {
    "finalReason": "Mutual agreement",
    "settlement": { "direction": "owedToEmployee", "amount": 1500, "note": "Unused leave" },
    "rehire": { "status": "Eligible", "note": "Reapply after relocation" }
  }
  ```

  - Direction must be `none | owedToEmployee | employeeOwes`, rehire `Eligible | Banned` (else 400); returns `{ message: "Exit verdict saved." }` and the case moves to Under Review

- [ ] **POST /api/separations/{id}/finalize** — T6 (empty body)
  - Checklist incomplete → **400** ("Complete the exit checklist"); no verdict → **400** ("Save the exit verdict")
  - Tick all five (`index` 0–4), save a verdict, then finalize → **200** `{ message: "Separation completed for {name}." }`
  - Verify the archive effects: employee status **Terminated** (A1), the login disabled (that user's `POST /api/auth/login` → 401), an `Offboard` history row (A1 history), and an "Employee Offboarded" audit row (B10)

## B7. Escalated action requests (§9.4) — Swagger group **ActionRequests**, base `/api/action-requests`

> No create endpoint (E20 is out of scope) — rows come from the Escalated tab's sources. To see rows you must hold the matching meta key (`employees.transfer`, `employees.compensation.manage`, `employees.role.assign`, `employees.offboard`, `employees.bulk_import`) or `events.view`.

- [ ] **GET /api/action-requests** — `?status=Pending`, `?actionType=` (Transfer | CompensationChange | RoleAssign | Offboard | BulkImport), `?gym=` — items carry `proposedDetails` (gym **names**), `justification`, `requestedBy`
- [ ] **PUT /api/action-requests/{id}/approve** — executes the effect and marks the row **Approved**
  - Transfer → employee moves and "Gym Transfer Executed" audits; CompensationChange → "Compensation Updated"; RoleAssign → "System Role Assigned" (the role name must already exist — create it in A2); Offboard → a `Notice Period` separation case appears in B6 + "Offboarding Initiated"; BulkImport → "Bulk Import Executed"
  - Approve twice → **400** ("already been decided"); approve with the wrong meta key → 401
- [ ] **PUT /api/action-requests/{id}/reject**

  ```json
  { "comment": "Hold until the Q1 budget clears" }
  ```

  - No comment → **400**; expect `{ data: { status: "Rejected", executed: false, reviewComment: … } }` and a "Transfer Gym Request Rejected" audit row (label varies by action type); the effect is **not** executed

## B8. Notifications & announcements (§5.7) — base `/api/notifications`, `/api/announcements`

- [ ] **GET /api/notifications** — the signed-in user's inbox (JWT only, no permission key)
  - Query: `unread=true`, `category=` (Requests | Recruitment | Document | System | Announcements), `page`, `pageSize`
  - Items: `{ id, category, title, description, date, read, color, link }`
- [ ] **GET /api/notifications/unread-count** — `{ count }` (the header bell)
- [ ] **PUT /api/notifications/{id}/read** — another user's row → 404
- [ ] **PUT /api/notifications/read-all** — `{ message }`
- [ ] **GET /api/announcements** — `?gym=`, `?status=` (Draft | Scheduled | Sent | Cancelled); items carry `readRate`
- [ ] **POST /api/announcements** — compose (permission `announcements.manage`)

  ```json
  { "title": "Locker maintenance", "audience": "Revive Main Gym", "type": "Reminder", "message": "Lockers will be cleared Friday." }
  ```

  - Expect **201** `{ data: { …, status: "Sent", readRate: 0 } }`; targeted users each get an `Announcement: …` notification (check with another login)
- [ ] **PUT /api/announcements/{id}** — `{ "status": "Cancelled" }` retracts (fan-out notifications deleted, delivery stops)

## B9. My Access profile (§5.8)

- [ ] **GET /api/users/{id}** — self always; another user needs `team.view`
  - Expect `{ data: { id, email, role, permissions[], gyms: [{ id, name, branch }], effectivePermissions[], grantedCount, trackedCount } }`
  - Cross-check against A2: after `PUT /api/users/{id}/permissions`, `permissions[]` and `effectivePermissions[]` change; after `gym-access`, `gyms[]` changes

## B10. Reports, positions & audit (§5.9) — base `/api/reports`, `/api/positions`, `/api/audit-log`

- [ ] **GET /api/reports/export?period=30d&format=csv** — streams `Section,Metric,Value` CSV (Workforce / Attendance / Requests / Hiring / Positions / Payroll / Separations); try `period=90d`, `period=ytd`
- [ ] **GET /api/positions** — `?gym=`, `?searchTerm=`, `?active=true` → `{ items: [{ id, title, levels[], department, gym, headcount, active, open, fill }], total }`
- [ ] **POST /api/positions** — catalog write (permission `positions.manage`)

  ```json
  { "title": "Front Desk", "levels": ["Junior", "Senior"], "gym": 1, "headcount": 3 }
  ```

  - Expect **201** `{ data: <position> }`; unknown gym → 400

- [ ] **PUT /api/positions/{id}** — e.g. `{ "headcount": 5 }` → `open`/`fill` recompute
- [ ] **GET /api/audit-log** — the read-only activity log (permission `audit.view`)
  - Query: `action=` (All Actions | Employee | Payroll | Recruitment | Bulk Import), `gym`, `user` (id), `from`, `to`, `page`, `pageSize`
  - Confirm rows written by earlier steps: "Offboarding Initiated", "Gym Transfer Executed", "Payroll Published", "Document Renewal Requested", "Transfer Gym Request Rejected"

---

## Expected results summary

| Check | Expected |
|---|---|
| Any endpoint without a token | **401** |
| Missing permission key (try with a scoped user) | **401** (never 403) |
| HR user touching another branch's row | **401** |
| Valid token, good payload | **200/201** with `{ data }`, `{ message }`, or the `{ items, …, total }` envelope |
| Missing/invalid field or business rule | **400** with `errorMessage` explaining it |
| Non-existing id | **404** |
| Public form submissions over ~30/min per IP | **429** |

## Automated equivalent

Every checklist item is covered by the integration suite (401 tests, Release):

```powershell
dotnet test Tests\ReviveHRSystem.IntegrationTests\ReviveHRSystem.IntegrationTests.csproj -c Release
```

Key suites per area:

| Area | Suite |
|---|---|
| A1 Employees | `EmployeesControllerTests` |
| A2 Roles/Permissions/Users | `RolesControllerTests` |
| A3 Requests | `RequestsControllerTests` |
| A4 Attendance | `AttendanceManagementControllerTests` |
| B1 Recruitment | `RecruitmentControllerTests` |
| B2 Public forms | `HiringFormApplicationsControllerTests` |
| B3 Evaluations & forms | `EvaluationControllerTests` |
| B4 Payroll | `PayrollControllerTests` |
| B5 Events | `EventsControllerTests` |
| B6 Separations | `SeparationsControllerTests` |
| B7 Action requests | `ActionRequestControllerTests` |
| B8 Notifications | `NotificationsControllerTests` |
| B9/B10 Access & reports | `ReportingControllerTests` |

---

*Checklist written 2026-10-15. Section 4's Dashboard, Schedule & Shifts, Branch Queue actions, and HR Team screens have no endpoints yet (frontend built later); Section 5 is fully implemented.*
