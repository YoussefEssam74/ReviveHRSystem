# 05 — Attendance (roster, manual entry, corrections, policy, pairing, history)

**Screen:** `attendance` — sub-views: roster grid, Manual Entry form, Corrections,
Attendance Policy, Pair Biometric Device modal, employee Attendance History (file tab).
**Guards:** reads `attendance.view`; day-write `attendance.manual_entry`;
correction `attendance.edit`; policy Edit-level `attendance.view/edit`;
pairing = HR assigned to the gym (or TopManagement).
Actors: `hrm`, `hr` (gym1), `emp` (negative), `admin`.

Grid composition rule: one row per (employee, day) — **stored record wins**, otherwise
derived (future → `Scheduled`, scheduled-off/approved Day Off/on leave → `Off`,
else `Absent`). Punches display as 12-hour `h:mm AM/PM` in `Attendance:TimeZoneId` (Africa/Cairo).

---

### GET /api/attendance — roster grid (A1)

Query: `?date=yyyy-MM-dd` **or** `?from=&to=` (≤ 62 days) `&gym=&employeeId=&status=&page=&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 5.1 | hrm | (empty) | 200 today's grid `{ items, page, pageSize, total, totalPages }`; item `{ id (null for derived days), employeeId, name, gym, date, shift, checkIn, checkOut, status, source, notes, correctedBy, correctedAt }` |
| 5.2 | hrm | `?from=2026-10-01&to=2026-10-31` | 200 all October rows, grouped per employee then chronological |
| 5.3 | hrm | `?from=2026-01-01&to=2026-12-31` | **400** "The requested range is too large (max 62 days)." (365 > 62) |
| 5.4 | hrm | `?from=2026-10-01&to=2026-11-30` (61 days) | 200 (within bound) |
| 5.5 | hrm | `?from=2026-11-01&to=2026-10-01` | 400 "The 'to' date must not be before the 'from' date." |
| 5.6 | hrm | `?date=2026-10-21` | 200 single-day grid |
| 5.7 | hrm | `?date=21-10-2026` | 400 (yyyy-MM-dd) |
| 5.8 | hrm | `?status=Late` | 200 only Late rows (display strings: `On Time, Late, Absent, Early Checkout, Missing Checkout, Off, Scheduled`) |
| 5.9 | hrm | `?employeeId=999999` | 404 unknown employee |
| 5.10 | hrm | `?gym=1` / `?gym=2` | 200 both (hrm scoped to both) |
| 5.11 | hr | `?gym=2` | 401 (outside assignment) |
| 5.12 | hr | (empty) | 200 gym1 rows only (auto-scoped) |
| 5.13 | emp | (empty) | 401 (`attendance.view` denial) |
| 5.14 | anon / bad | — | 401 |
| 5.15 | hrm | `?page=1&pageSize=200` | 200 (pageSize max 200) |

---

### POST /api/attendance/manual — HR day-write form (A3/A5)

```json
{
  "employeeId": "EMP-1001",
  "date": "2026-10-20",
  "checkIn": "08:05",
  "checkOut": "16:00",
  "status": "Late",
  "reason": "Face ID terminal offline — entered by HR."
}
```
`employeeId` accepts a numeric id **or** an EMP- number, as JSON number or string.

| # | Actor | Input | Expected |
|---|---|---|---|
| 5.16 | hrm | happy body | 201 `{ data: <grid row> }` — row now has a real `id`, `source: "Manual"` |
| 5.17 | hrm | `"status": "Absent"` with no punches | 201 — punches cleared |
| 5.18 | hrm | `"status": "Scheduled"` | 400 (derived-only status rejected on writes) |
| 5.19 | hrm | `"reason": "no"` (< 3 chars) | 400 |
| 5.20 | hrm | `"checkIn": "25:00"` | 400 (HH:mm) |
| 5.21 | hrm | `"date": "2026-13-45"` | 400 |
| 5.22 | hrm | terminated employee | 400 |
| 5.23 | hrm | `employeeId: 999999` | 404 |
| 5.24 | hr | employee in gym2 | 401 (`attendance.manual_entry` scoped) |
| 5.25 | emp | — | 401 |
| 5.26 | hrm | repeat 5.16 same day | 201 upsert — one row per (employee, day), not a duplicate |

---

### PUT /api/attendance/{id}/correct — correction with audit trail (A4)

```json
{ "checkIn": "08:00", "checkOut": "16:30", "status": "On Time", "reason": "Terminal clock was 7 min fast." }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 5.27 | hrm | happy body on a stored record (id from 5.16) | 200 `{ data: <row with correctedBy/correctedAt> }` — `correctedBy` = editor's full name; notes prefixed `Corrected:` |
| 5.28 | hrm | GET grid after | `correctedBy`/`correctedAt` reflect the latest correction; original preserved in `AttendanceCorrection` |
| 5.29 | hrm | `"reason": "ok"` (< 3 chars) | 400 |
| 5.30 | hrm | `"status": "Scheduled"` | 400 |
| 5.31 | hrm | unknown record id | 404 |
| 5.32 | hr | record in gym2 | 401 (`attendance.edit` scoped) |
| 5.33 | emp | — | 401 |

---

### GET /api/attendance/{id} — punch audit (payroll sheet drill-down)

`{id}` is an attendance ref (`"ATT-123"`) or a bare record id. Permission: `payroll.view`
**or** `attendance.view`.

| # | Actor | Input | Expected |
|---|---|---|---|
| 5.34 | hrm | `GET /api/attendance/ATT-<recordId>` | 200 `{ data: { id: "ATT-…", date, firstIn, lastOut, device, exception, detail } }` — `device` Biometric/Manual, `exception` display status |
| 5.35 | hrm | bare numeric id | 200, `id` normalized to `ATT-{id}` |
| 5.36 | hrm | `ATT-0` / unknown | 404 |
| 5.37 | hrm | `ATT-abc` | 404 (non-numeric ref) |
| 5.38 | hr | record in gym2 | 401 |
| 5.39 | emp | — | 401 (no payroll.view/attendance.view … unless self scope — record actual) |

---

### GET /api/gyms/{gymId}/attendance-policy · PUT — Attendance Policy

GET: `{ gymId, gymName, excusedLateHoursCapPerMonth }` ·
PUT body: `{ "excusedLateHoursCapPerMonth": 6 }`

| # | Actor | Input | Expected |
|---|---|---|---|
| 5.40 | hrm | `GET /api/gyms/1/attendance-policy` | 200 — default cap 4 |
| 5.41 | hrm | PUT `{"excusedLateHoursCapPerMonth": 6}` | 200 updated policy; GET echoes 6 |
| 5.42 | hrm | PUT `{"excusedLateHoursCapPerMonth": 201}` | 400 (valid 0–200) |
| 5.43 | hrm | PUT `-1` | 400 |
| 5.44 | hr | `GET/PUT /api/gyms/2/attendance-policy` | 401 (route gym must match token access) |
| 5.45 | emp | PUT | 401 (needs attendance Edit) |
| 5.46 | hrm | — | Cross-effect: raise cap to 6, then an early-leave request consuming ≤ 6 h/month passes (see 06 / self-service rules) |
| 5.47 | hrm | — | Restore cap to 4 after testing |

---

### POST /api/gyms/{gymId}/biometric-devices/pairing-codes — Pair Biometric Device (A10)

```json
{ "stationLabel": "Front-desk kiosk" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 5.48 | hrm | `POST /api/gyms/1/biometric-devices/pairing-codes` happy body | 200 `{ code, gymId, gymName, stationLabel, generatedAt, expiresAt }` — 6-digit code, valid until `StationCode:ExpirationMinutes` elapses |
| 5.49 | hrm | rotate twice | each call returns a **new** code; the old one stops redeeming at `POST /api/kiosk/login` (kiosk scope — verify indirectly or skip) |
| 5.50 | hr | gym2 pairing | 401 (not assigned) |
| 5.51 | admin | any gym | 200 (TopManagement) |
| 5.52 | emp | — | 401 (employees denied even with gym access) |
| 5.53 | hrm | unknown gym id | 404 |

---

### GET /api/employees/{id}/attendance — employee Attendance History (file tab)

Covered in [02-employees.md](02-employees.md) §2.95–2.100 — month totals
(`present/late/absent/off/hours/expected`), future days omitted. Cross-check here that
rows in a stored month match this guide's grid (5.2) for the same employee/dates:

| # | Actor | Input | Expected |
|---|---|---|---|
| 5.54 | hrm | month of 5.16 record | history item `status`/`checkIn`/`checkOut` equal the grid row |
| 5.55 | hrm | after 5.27 correction | history shows the **corrected** values |
| 5.56 | hr | gym2 employee | 401 |
