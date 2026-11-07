# 02 — Employees (directory, profile tabs, lifecycle modals)

**Screens:** `employees` — directory grid, employee detail with **9 tabs**
(Personal Info, Documents, Employment History, Attendance Summary, Current Shift,
Requests History, Leave Balance, Evaluations History, Payroll Snapshot) and the
lifecycle modals (create, edit, status, transfer, position, compensation, contract,
role, leave balance, bulk import).
**Guards:** `employees.*`, `requests.view`, `attendance.view`, `payroll.view`,
`evaluations.view` per endpoint — all gym-scoped (ADR-003).

Use `sara@revive.hr` as "target employee of gym1" in cases; create fresh employees
in the create cases and reuse their `id`.

---

### GET /api/employees — directory grid

Query: `?gym=&search=&status=&page=1&pageSize=20&sortBy=name|hireDate|status&sortOrder=asc|desc`

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.1 | hrm | `?page=1&pageSize=20` | 200 `{ items, page, pageSize, total, totalPages }`; item = `{ id, employeeNumber, name, position, level, gymId, gym, status, initials, hireDate, salary, phone, email }` |
| 2.2 | hrm | `?search=karim` | 200 only matching names (case-insensitive substring) |
| 2.3 | hrm | `?status=Active` | 200 only Active rows; `total` reflects the filtered set |
| 2.4 | hrm | `?status=Bogus` | 400 |
| 2.5 | hrm | `?sortBy=hireDate&sortOrder=desc` | 200 newest hire first; stable ordering (pages don't overlap) |
| 2.6 | hrm | `?page=1&pageSize=100` | 200; `pageSize` max 100 (200 → clamped/400 per validation) |
| 2.7 | hrm | `?gym=1` | 200 gym1 rows only |
| 2.8 | hr | `?gym=2` | 401 (gym outside hr's assignment) |
| 2.9 | hr | `?page=1` | 200 — **only gym1** rows even without the filter (auto-scoped) |
| 2.10 | admin | `?page=1` | 200 all gyms (TopManagement bypass) |
| 2.11 | emp | `?page=1` | 401 (`employees.view` missing → permission denial is 401, not 403) |
| 2.12 | anon / bad | `?page=1` | 401 |

---

### POST /api/employees — create (modal)

```json
{
  "firstName": "Manual",
  "lastName": "Tester",
  "email": "manual.tester@revive.hr",
  "phone": "01011112222",
  "position": "Front Desk",
  "level": "Junior",
  "salary": 7500,
  "gym": 1,
  "startDate": "2026-10-01"
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.13 | hrm | happy body (gym 1) | 200 `{ data: <profile> }` — login account created (temp password `Revive!2026`), `employeeNumber` = EMP-#### (≥ 1001), history "Joined Revive" |
| 2.14 | hrm | same email again | 400 duplicate email |
| 2.15 | hrm | `"gym": 999` | 400 unknown/inactive gym |
| 2.16 | hr | `"gym": 2` | 401 (no access to target gym) |
| 2.17 | hrm | missing `position` / `email` | 400 validation |
| 2.18 | hrm | `"startDate": "not-a-date"` | 400 (DateOnly parse) |
| 2.19 | emp | happy body | 401 (`employees.create`) |
| 2.20 | hrm | — | Follow-up: `GET /api/employees?search=Tester` shows the new row; login with the email + `Revive!2026` works |

---

### POST /api/employees/bulk-import — CSV upload

Multipart field `file` (.csv only, ≤ 5 MB), header row `name,email,position,level,gym,salary`.

```csv
name,email,position,level,gym,salary
Bulk One,bulk.one@revive.hr,Cleaner,Junior,Revive Gym - Main,5000
Bulk Two,bulk.two@revive.hr,Trainer,Senior,Revive Gym - Main,9000
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.21 | hrm | valid CSV above | 200 `{ message, added: 2, skipped: 0 }` — rows imported independently |
| 2.22 | hrm | CSV with one duplicate email + one unknown gym | 200 `added: …, skipped: 2` — batch does **not** fail |
| 2.23 | hrm | `.txt` file | 400 "Only .csv files are accepted." |
| 2.24 | hrm | empty file | 400 "A non-empty CSV file is required." |
| 2.25 | hr | CSV importing into an unassigned gym | 200 with that row skipped (outside access) |
| 2.26 | emp | any CSV | 401 (`employees.bulk_import`) |

---

### GET /api/employees/{id} — profile detail (Personal tab)

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.27 | hrm | `{id}` of gym1 employee | 200 `{ data: { id, employeeNumber, name, position, level, gymId, gym, status, initials, hireDate, email, phone, salary, systemRole, branches: [...] } }` |
| 2.28 | hr | `{id}` of gym2 employee | 401 (other gym — permission-style denial) |
| 2.29 | hr | `{id}` = 999999 | 404 |
| 2.30 | emp | own id | 200 (self read) |
| 2.31 | emp | another employee's id | 401/404 (no `employees.view`) |
| 2.32 | anon | — | 401 |

---

### PUT /api/employees/{id} — edit modal

```json
{ "name": "Sara Ahmed (Edited)", "position": "Trainer", "status": "Active" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.33 | hrm | happy body | 200 updated profile **without** `{ data }` wrapper (deviation: only create/detail wrap) |
| 2.34 | hrm | `"status": "Bogus"` | 400 |
| 2.35 | hrm | `{}` (all optional) | 200 no-op update |
| 2.36 | hr | target in gym2 | 401 |
| 2.37 | emp | — | 401 (`employees.edit`) |
| 2.38 | hrm | unknown id | 404 |

---

### POST /api/employees/{id}/status-change — status modal

```json
{ "status": "OnLeave", "note": "Approved medical leave" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.39 | hrm | `{"status":"OnLeave","note":"…"}` | 200 profile with `status: "On Leave"` + history row `Status Changed: Active → On Leave` |
| 2.40 | hrm | `{"status":"On Leave"}` | 200 — spaces ignored, enum-name and display form both parse |
| 2.41 | hrm | same status as current | 400 "Employee is already …" |
| 2.42 | hrm | `{"status":"Zzz"}` | 400 "Status must be Active, On Leave, Notice Period, Suspended, or Terminated." |
| 2.43 | hrm | set `Terminated` | 200 — history updated but **login still works** (`User.IsActive` untouched — deliberate) |
| 2.44 | hr | target in gym2 | 401 (`employees.status.change`) |
| 2.45 | emp | — | 401 |

---

### GET /api/employees/{id}/history — Employment History tab

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.46 | hrm | employee exercised in 2.13–2.43 | 200 `[{ type, from, to, date, detail }]` newest first; contains `Joined Revive`, `Status Changed` |
| 2.47 | hrm | after 2.52/2.55/2.58 | also contains `Gym Transfer`, `Position Changed`, `Salary Changed`, `Contract Updated`, `Role Changed` |
| 2.48 | hr | gym2 employee | 401 |
| 2.49 | anon | — | 401 |

---

### GET /api/employees/{id}/leave-balance · PUT — Leave Balance tab

```json
{ "dayOff": { "used": 4, "total": 21 }, "sick": { "used": 1, "total": 10 }, "unpaid": { "used": 0, "total": 5 } }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.50 | hrm | GET | 200 `{ employeeId, dayOff: { used, total }, sick: {…}, unpaid: {…} }`; missing rows read as zeros |
| 2.51 | hrm | PUT happy body | 200 `{ message }`; GET now echoes the new totals |
| 2.52 | hrm | PUT `total: 999` | 400 (0–365 range) |
| 2.53 | hrm | PUT `used > total` | 400 (or accepted per rule — verify `errors` payload) |
| 2.54 | hr | PUT gym2 employee | 401 (`employees.leave_balance.manage`) |
| 2.55 | emp | PUT own | 401 (self may read, not manage) |

---

### POST /api/employees/{id}/transfer — transfer modal

```json
{ "toGym": "Revive Gym - North", "effectiveDate": "2026-11-01", "reason": "Branch coverage" }
```

(`toGym` accepts a branch **name**; target must be an active gym.)

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.56 | hrm | gym1 → gym2 (name) | 200 `{ message }`; profile `gymId` changes; history `Gym Transfer`; `UserGymAccess` re-pointed |
| 2.57 | hrm | same gym as current | 400 |
| 2.58 | hrm | `"toGym": "Nowhere"` | 400 unknown target |
| 2.59 | hr | transferring **out of** gym1 (needs access to both gyms) | 401 (`employees.transfer` on both) |
| 2.60 | emp | — | 401 |
| 2.61 | hrm | transfer back (2.56 reversed) | 200 — keeps later cases on gym1 |

---

### POST /api/employees/{id}/position-change — position modal

```json
{ "position": "Senior Trainer", "level": "Senior" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.62 | hrm | new position (not in catalog) | 200 `{ message }` — position **created at level 1** in the gym catalog; history `Position Changed` |
| 2.63 | hrm | same position + same level as current | 400 "already on this position and level" |
| 2.64 | hrm | `{ "level": "" }` | 200 — blank level falls back to the current level |
| 2.65 | hr | gym2 target | 401 (`employees.position.change`) |
| 2.66 | emp | — | 401 |

---

### POST /api/employees/{id}/compensation — compensation modal

```json
{ "salary": 9500, "effectiveDate": "2026-11-01" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.67 | hrm | happy body | 200 `{ message }`; history `Salary Changed`; profile `salary` now 9500 |
| 2.68 | hrm | `"salary": -1` | 400 (below 0) |
| 2.69 | hrm | `"salary": 0` | 200 (0 allowed) or 400 per validation — record actual |
| 2.70 | hr | gym2 target | 401 (`employees.compensation.manage`) |
| 2.71 | emp | — | 401 |
| 2.72 | hrm | — | Read-guard check: employee **salary never appears** for `emp` in 2.31 (compensation fields HR-controlled) |

---

### POST /api/employees/{id}/contract — contract modal

```json
{ "level": "Lead", "salary": 11000, "effectiveDate": "2026-12-01" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.73 | hrm | any subset (e.g. only `level`) | 200 `{ message }`; history `Contract Updated` records what changed |
| 2.74 | hrm | `{}` nothing to change | 400 |
| 2.75 | hr | gym2 target | 401 (`employees.contract.manage`) |
| 2.76 | emp | — | 401 |

---

### POST /api/employees/{id}/role-change — role & team-permissions block

```json
{ "systemRole": "Branch Manager", "permissions": ["employees.view", "requests.view"] }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.77 | hrm | create role first (14.5), then this body | 200 `{ message: "Role changed." }`; history `Role Changed`; profile `systemRole` set |
| 2.78 | hrm | `"systemRole": "Nonexistent Role"` | 400 "Unknown system role 'X'. Create it under Roles & Permissions first." |
| 2.79 | hrm | `"systemRole": "None (Employee)"` | 200 clears the role |
| 2.80 | hrm | `"permissions": ["bogus.key"]` | 400 unknown key |
| 2.81 | hrm | `"permissions": null` | 200 — direct overrides untouched (null ≠ clear) |
| 2.82 | hr | gym2 target | 401 (`employees.role.assign`) |
| 2.83 | hrm | offboarded employee (no user account) | 404 |

---

### GET /api/employees/{id}/documents · POST — Documents tab (HR vault)

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.84 | hrm | GET | 200 `[{ name, category, status }]` — categories `Employment Contract \| Identification \| Certification \| Other`; `Valid` vs `Expiring Soon` |
| 2.85 | hrm | POST multipart: `file` (PDF ≤ 10 MB), `category: "Employment Contract"`, `expiryDate: "2027-12-31"` | 200 `{ name, category, status }` |
| 2.86 | hrm | POST `category: "Weird"` | 400 invalid category |
| 2.87 | hrm | POST `.exe` file | 400 wrong type |
| 2.88 | hrm | POST `expiryDate: "31-12-2027"` | 400 (yyyy-MM-dd) |
| 2.89 | hr | gym2 employee GET/POST | 401 |
| 2.90 | emp | POST own documents | 401/403 per `employees.documents.manage` — the HR vault upload is HR-side (self uploads use the self-service route) |

---

### GET /api/employees/{id}/hr-documents — HR-published documents

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.91 | hrm | GET | 200 `[{ id, name, category, addedDate, size, sizeBytes }]` — `size` like `"PDF · 2.1 MB"` |
| 2.92 | hrm | GET | List is **disjoint** from the vault: employee uploads never appear here |
| 2.93 | hr | gym2 employee | 401 |
| 2.94 | anon | — | 401 |

---

### GET /api/employees/{id}/attendance — Attendance Summary tab

Query: `?month=yyyy-MM&page=&pageSize=` (defaults: current month, 31)

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.95 | hrm | `?month=2026-10` | 200 `{ items: [{ date, shift, checkIn, checkOut, status, notes }], totals: { total, present, late, absent, off, hours, expected }, page, pageSize, total, totalPages }` |
| 2.96 | hrm | `?month=2026-10` | **future days omitted** (not `Scheduled`); `present` = On Time + Late + Early Checkout + Missing Checkout |
| 2.97 | hrm | `?month=2026-11` (future month) | 200 with empty `items` (or only elapsed days) |
| 2.98 | hrm | `?month=garbage` | 400 |
| 2.99 | hr | gym2 employee | 401 (`attendance.view` on the employee's gym) |
| 2.100 | emp | another employee | 401/404 |

---

### GET /api/employees/{id}/schedule — Current Shift tab

Query: `?month=yyyy-MM`

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.101 | hrm | `?month=2026-10` | 200 `{ month, cycles: [{ id, start, end, status }], days: [{ date, dayName, shiftName, start, end, isOff, isToday }] }` — **published cycles only** (a Draft cycle contributes no days) |
| 2.102 | hrm | employee with no published cycle | 200 with empty `cycles`/`days` (not an error) |
| 2.103 | hr | gym2 employee | 401/404 |
| 2.104 | anon | — | 401 |

---

### GET /api/employees/{id}/requests — Requests History tab

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.105 | hrm | `{id}` of employee with requests | 200 **plain array** (no envelope) of `{ id, employee, gym, type, requestedDate, startDate, endDate, days, reason, status, bmDecision, bmComment, payment, submittedDate, urgent }`, newest first |
| 2.106 | hr | gym2 employee | 401 (`requests.view` on the employee's gym) |
| 2.107 | emp | another employee | 401/404 |
| 2.108 | hrm | — | Cross-check: rows match `GET /api/requests` filtered to this employee (06) |

---

### GET /api/employees/{id}/leave-balance (read), GET /api/employees/{id}/evaluations — Evaluations History tab, GET /api/employees/{id}/payroll — Payroll Snapshot tab

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.109 | hrm | `GET /api/employees/{id}/evaluations` | 200 `[{ id, employee, position, period, score, result, status, gym, form, formId }]` — `result`: score ≥ 60 → `Pass`, < 60 → `Below Target`, none → `Pending` |
| 2.110 | hrm | `GET /api/employees/{id}/payroll` | 200 `items: [ …entry + period label… ]`, newest month first |
| 2.111 | hr | gym2 employee on either | 401 (`evaluations.view` / `payroll.view`) |
| 2.112 | emp | other employee | 401/404 |
| 2.113 | anon | — | 401 |

---

### Self-service edges worth one pass (profile photo/contact — read-only from HR side)

| # | Actor | Input | Expected |
|---|---|---|---|
| 2.114 | emp | `GET /api/employees/{id}/photo` own | 200 image stream (or 404 when none uploaded) |
| 2.115 | hrm | `PUT /api/employees/{id}/contact` for another employee | 404 — contact/emergency/photo **writes are self-only** |
| 2.116 | emp | `PUT /api/employees/{own}/contact` `{"phone":"01000000000","address":"Cairo"}` | 200 updated profile |
