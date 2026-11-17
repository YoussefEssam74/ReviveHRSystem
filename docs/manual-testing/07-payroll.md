# 07 — Payroll (settlement sheet, deductions, publish, payslips, export)

**Screen:** `payroll` — Settlement sheet (period → entry rows), Add deduction line,
Approve/Publish, Payslip drill-down, Export, Deductions review queue.
**Guards:** reads `payroll.view`; settlement writes `payroll.edit`; publish
`payroll.approve`; CSV `payroll.export` — writes enforce access to the **period's gym**.

**Seed fixture (DevelopmentDataSeeder):** one **Open** period for the current month per
gym with Draft entries (gym1: Karim + Omar · gym2: Sara), `BaseSalary 8000`,
`DaysWorked 21`. No HTTP endpoint creates periods — if your DB predates the payroll
seed, wipe it and let the seeder re-run.

**Money rules (always recomputed):** gross = base + bonus + OT pay where
OT pay = (base/176) × 1.5 × hours · deductions = lines with status `Accepted|Approved`
(`Pending` excluded) · net = gross − deductions.
Entry statuses: `Draft → Reviewed (close) → Locked (publish)`; period derives
`Open | Partially Published | Published | Paid`.

Happy-path order: 7.1 → 7.2 → 7.8 → 7.9 → 7.11 → 7.13 → 7.14 → 7.16 → 7.19 → 7.20.

---

### GET /api/payroll-periods — period list

Query: `?gym=&status=Open|Partially Published|Published|Paid&page=1&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.1 | hrm | `?page=1` | 200 `{ items, page, pageSize, total, totalPages }`; item `{ id, period ("October 2026"), status, locked, paidDate, publishedGyms[], totalEmployees, totalGross, totalDeductions, totalNet }`, newest month first |
| 7.2 | hrm | — | Seeded period present: `status: "Open"`, `locked: false`, `totalEmployees` = that gym's active employees |
| 7.3 | hrm | `?status=Open` | 200 only Open rows; `?status=Published` empty until 7.16 |
| 7.4 | hrm | `?status=Bogus` | 200 empty **or** 400 — filter is a display-string compare; record actual |
| 7.5 | hrm | `?gym=1` / `?gym=2` | 200 each gym's period (hrm scoped to both) |
| 7.6 | hr | `?gym=2` | 401 (outside assignment) |
| 7.7 | emp | `?page=1` | 401 (`payroll.view` denial) · `anon` → 401 · `bad` → 401 |

---

### GET /api/payroll-periods/{id} — settlement sheet

Query: `?gym=` (must match the period's branch when given)

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.8 | hrm | happy period id | 200 `{ data: { …period…, items: [...] } }` ordered by employee name; entry `{ employeeId, name, initials, gym, position, employmentStatus, days, overtime, baseSalary, bonus, gross, deductions, net, status, reviewed, relatedRequestIds[], deductionLines: [{ id, date, label, reason, source, amount, status, attendanceRef, requestId }] }` |
| 7.9 | hrm | — | Seeded rows show `baseSalary: 8000`, `status: "Draft"`, `gross == 8000`, `net == 8000` |
| 7.10 | hrm | `?gym=<other gym's id>` | 404 (gym mismatch) |
| 7.11 | hr | period of gym2 | 401 |
| 7.12 | hrm | unknown id | 404 · `emp` → 401 |

---

### PUT /api/payroll-periods/{periodId}/entries/{employeeId} — bonus edit

```json
{ "bonus": 1200 }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.13 | hrm | happy body (gym1 entry) | 200 `{ data: { employeeId, bonus, gross, deductions, net } }` — `gross: 9200` (8000 + 1200), `net` follows |
| 7.14 | hrm | `{ "bonus": 0 }` | 200 — gross back to 8000 |
| 7.15 | hrm | `{ "bonus": -50 }` | 400 (≥ 0) |
| 7.16 | hrm | `{}` missing bonus | 400 |
| 7.17 | hrm | unknown employeeId / wrong gym entry | 404 |
| 7.18 | hrm | entry after the period is published (7.16) | 400 locked period |
| 7.19 | bm | (holds only `payroll.view`) | 401 (`payroll.edit` denial) |
| 7.20 | emp | — | 401 · `anon` → 401 |

---

### POST /api/payroll-periods/{periodId}/entries/{employeeId}/deductions — Add Line

```json
{ "source": "manager", "reason": "Unapproved absence on Oct 14.", "amount": 250 }
```
`source`: `manager | biometric` · `amount` > 0 · `reason` required.

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.21 | hrm | happy body | **201** `{ data: { id, date, label, reason, source, amount, status: "Pending", attendanceRef, requestId, entry: { gross, deductions, net, pendingCount } } }` — `attendanceRef: "ATT-MANUAL"` for biometric |
| 7.22 | hrm | — | Pending line does **not** move `entry.deductions`/`net` yet; `pendingCount: 1` |
| 7.23 | hrm | `{ "source": "biometric", "reason": "Late arrival (30+ min).", "amount": 100 }` | 201 second line |
| 7.24 | hrm | `"amount": 0` / negative | 400 |
| 7.25 | hrm | missing `reason` | 400 |
| 7.26 | hrm | `"source": "guess"` | 400 (only manager/biometric) |
| 7.27 | hrm | after publish (7.16) | 400 locked period |
| 7.28 | hr | gym2 period | 401 · `emp` → 401 |

---

### GET /api/deduction-candidates — pending-lines review queue

Query: `?gym=&period=<id or month label>&status=Pending|Accepted|Approved|Rejected&page=1&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.29 | hrm | `?status=Pending` | 200 `{ items, page, pageSize, total, totalPages }`; item `{ id, employeeId, employeeName, gym, period, date, label, reason, source, amount, status, attendanceRef, requestId }` — newest line first; contains the 7.21/7.23 lines |
| 7.30 | hrm | `?period=<current month label e.g. "October 2026">` | 200 lines of that period (label accepted alongside numeric id) |
| 7.31 | hrm | `?period=Nonsense` | 200 empty (unknown label → empty, no error) |
| 7.32 | hr | `?gym=2` | 401 outside assignment |
| 7.33 | bm | (holds `payroll.view`) | 200 — view OR edit both allowed (queue is readable with either) |
| 7.34 | emp | — | 401 · `anon` → 401 |

---

### POST /api/deduction-candidates/{id}/review — Approve / Waive a line

```json
{ "decision": "Accepted" }
```
`decision`: `Accepted` (Approve) · `Rejected` (Waive) — anything else → 400.

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.35 | hrm | `{"decision":"Accepted"}` on the 7.21 line | 200 `{ data: { id, status: "Accepted", amount, entry: { employeeId, gross, deductions, net, pendingCount } } }` — `entry.deductions` now includes the amount, `net` drops, `pendingCount` decrements |
| 7.36 | hrm | `{"decision":"Rejected"}` on the 7.23 line | 200 `status: "Rejected"` — amount excluded from `net` forever |
| 7.37 | hrm | `{"decision":"Approved"}` | 400 (only Accepted/Rejected) |
| 7.38 | hrm | review the same line again | 400 / or second decision overwrites — record actual; stamped `reviewedBy`/`reviewedAt` must not double-stamp silently |
| 7.39 | hrm | review after the period is published | 400 (period must be open) |
| 7.40 | hr | line of gym2 period | 401 |
| 7.41 | bm | (only `payroll.view`) | 401 (`payroll.edit` denial) |
| 7.42 | emp | — | 401 |

---

### POST /api/payroll-periods/{periodId}/entries/{employeeId}/close · …/reopen

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.43 | hrm | close an entry that still has a `Pending` line | **400** (unsettled — decide the line in 7.35 first) |
| 7.44 | hrm | close a clean entry (all lines decided) | 200 `{ data: { employeeId, status: "Reviewed", reviewed: true, reviewedAt, gross, deductions, net } }` |
| 7.45 | hrm | close the second entry too | 200 — both entries now `Reviewed` (required for publish) |
| 7.46 | hrm | `POST …/reopen` on a closed entry | 200 — back to `Draft`, `reviewedAt` omitted |
| 7.47 | hrm | close again after reopen | 200 Reviewed |
| 7.48 | hrm | close/reopen after publish | 400 (locked period) |
| 7.49 | hr | gym2 period entry | 401 · `emp` → 401 |

---

### POST /api/payroll-periods/{id}/approve — publish & lock

```json
{ "gym": 1 }
```
(`gym` = branch name or id — must be the period's gym.)

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.50 | hrm | publish with one entry still `Draft` | **400** with the unsettled-sheet count |
| 7.51 | hrm | all entries Reviewed (7.44+7.45), `{"gym": 1}` | 200 `{ data: { id, status: "Published", locked: true, publishedGyms: [...], message } }` — period `Locked`, entries `Locked`, audit row `Payroll Published` |
| 7.52 | hrm | publish again | 400 already published |
| 7.53 | hrm | `{"gym": 2}` on the gym1 period | 400 (wrong branch) |
| 7.54 | hrm | `{"gym": 999}` | 400 unknown gym |
| 7.55 | hrm | — | List (7.1) now shows derived `status: "Published"`, `locked: true`, `publishedGyms` contains the branch |
| 7.56 | bm / emp | — | 401 (`payroll.approve`) |
| 7.57 | hrm | — | Now the locked-period guards fire: bonus edit (7.18), add line (7.27), review (7.39), close (7.48) all → 400 |

---

### GET /api/payroll-periods/{id}/payslips/{employeeId} — payslip drill-down

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.58 | hrm | happy ids | 200 `{ data: { period, gym, employee: { employeeId, name, position }, baseSalary, overtime, overtimePay, bonus, gross, deductions: [{ label, reason, source, amount, status }], net, days, status } }` |
| 7.59 | hrm | — | `deductions` lists **all** lines with statuses; `net` counts only `Accepted|Approved` |
| 7.60 | hrm | — | `gross == baseSalary + bonus + overtimePay`; with the 7.13 bonus: `8000+1200` (bonus must be reset in 7.14 before close, or reflect whatever was last written) |
| 7.61 | hr | gym2 period/employee | 401 |
| 7.62 | hrm | unknown ids | 404 · `emp` → 401 |

---

### GET /api/payroll-periods/{id}/export — CSV

Query: `?gym=&format=csv` (default `csv`)

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.63 | hrm | `?format=csv` | 200 `text/csv` — header `Employee, Employee ID, Position, Base Salary, OT Hours, OT Pay, Bonus, Gross, Deductions, Net, Status`, one row per entry; file `payroll-{month}-{branch}.csv` |
| 7.64 | hrm | `?format=pdf` | **400** (pdf unsupported) |
| 7.65 | hrm | `?gym=<mismatched>` | 404/400 (must match when given) |
| 7.66 | hr | gym2 period | 401 (`payroll.export`) |
| 7.67 | bm / emp | — | 401 (bm holds `payroll.view` but **not** `payroll.export`) |

---

### GET /api/employees/{id}/payroll — employee-file Payroll Snapshot tab

| # | Actor | Input | Expected |
|---|---|---|---|
| 7.68 | hrm | employee with seeded entry | 200 `{ items: [ …entry + period label… ] }` newest month first — matches the settlement sheet row |
| 7.69 | hrm | after 7.51 | the period row now reads Locked/Published consistently |
| 7.70 | hr | gym2 employee | 401 · `emp` other employee → 401/404 · `anon` → 401 |
