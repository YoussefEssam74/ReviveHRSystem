# 10 — Reports & Analytics (overview, export, drill-down panels)

**Screen:** `reports` (`renderReports` in `pages-access.js`) — KPI cards + bar lists with
**drill-down panels** whose in-panel actions are real endpoints.
**Guard:** `reports.view` for every read; the panel *actions* additionally need the
underlying feature keys (`requests.approve`, `payroll.edit`, `attendance.manual_entry`,
`recruitment.vacancies.manage`).
Actors: `hrm` (both gyms), `hr` (gym1), `emp`/`anon` (negatives).

Overview endpoint: `GET /api/reports/overview?period=30d|90d|ytd&gym=<id or name>`

---

### GET /api/reports/overview — metric cards

Verified section shapes (live):

- `workforce` `{ totalEmployees, active, onLeave, noticePeriod, suspended, terminated, newHiresInPeriod, byStatus: [{label,value}], byTenure: [{label,value}], avgTenureMonths }`
- `attendance` `{ recordsInPeriod, onTime, late, absent, missingCheckout, onTimeRate }`
- `requests` `{ requestsInPeriod, approved, rejected, pending, approvalRate, byType: [{label,value}] }`
- `recruiting` `{ applicationsInPipeline, hiredInPeriod, openVacancies, openSlots }`
- `payroll` `{ entries, totalNetPay }`
- `offboarding` `{ separationsInPeriod, openChecklists }`

| # | Actor | Input | Expected |
|---|---|---|---|
| 10.1 | hrm | `?period=30d` | 200 full payload — verified live: `workforce.totalEmployees` = directory count for both gyms (4 on a fresh seed), all six sections present |
| 10.2 | hrm | `?period=90d` / `?period=ytd` | 200 — period-bound sections (attendance/recruiting/requests/offboarding) widen; `workforce` unchanged |
| 10.3 | hrm | `?period=30d` (default, no param) | 200 — same as 10.1 (30d is the default) |
| 10.4 | hrm | `?period=7d` | 400 (only 30d/90d/ytd) |
| 10.5 | hrm | `?gym=1` | 200 — every scoped section counts gym1 only (verified live: gym filter resolves through the same scope helper as the lists) |
| 10.6 | hr | `?gym=2` | 401 (outside assignment) |
| 10.7 | hr | `?period=30d` | 200 gym1-only numbers (auto-scoped) |
| 10.8 | admin | `?period=ytd` | 200 both gyms (TopManagement) |
| 10.9 | emp | — | 401 (`reports.view` denial) |
| 10.10 | anon / bad | — | 401 |
| 10.11 | hrm | — | Consistency: `workforce.byStatus` buckets sum to `totalEmployees`; `requests.approved + rejected ≤ requestsInPeriod`; `payroll.totalNetPay` matches the settlement-sheet net sum (07) |
| 10.12 | hrm | — after running 06/07 cases | numbers move: approve a request (6.34) then re-GET — `requests.pending` drops by 1; publish payroll (7.51) then re-GET — `payroll` reflects the published period |

---

### GET /api/reports/export — overview CSV

Query: `?period=30d|90d|ytd&format=csv&gym=` (format defaults to csv)

| # | Actor | Input | Expected |
|---|---|---|---|
| 10.13 | hrm | `?period=30d&format=csv` | 200 `text/csv` (verified live) — header `Section,Metric,Value`, quoted rows (`"Workforce","Total employees","4"`, …); same numbers as the overview; filename `reports-{period}-{yyyy-MM-dd}.csv` |
| 10.14 | hrm | `?period=ytd&format=csv` | 200 ytd rows |
| 10.15 | hrm | `?period=7d` | 400 |
| 10.16 | hrm | `?format=pdf` | 400 (CSV only) |
| 10.17 | hr | `?gym=2` | 401 |
| 10.18 | emp | — | 401 (`reports.view`) |

---

### Drill-down panels + in-panel actions

Each card/bar opens a panel (`REPORT_PANELS`); panels either **navigate** to the owning
screen or run an **inline action** against the same endpoint the owning screen uses.
Run one panel per row; the "action" column is the real endpoint to exercise from there.

| Panel (card/bar) | Panel content source | Nav / in-panel action endpoint | Cases |
|---|---|---|---|
| Headcount by Gym | `workforce` + directory | nav → `GET /api/employees` (02) | 10.19 |
| Attendance Trend | `attendance` buckets | nav → `GET /api/attendance` (05); **Manual Entry button** → `POST /api/attendance/manual` (5.16) | 10.20 |
| Request Volume | `requests` buckets | nav → `GET /api/requests` (06); **inline Review** → `POST /api/requests/{id}/decide` (6.34) | 10.21 |
| Recruitment Funnel | `recruiting.pipeline` | nav → `GET /api/candidates` (04); **New Vacancy** → `POST /api/vacancies` (4.11) | 10.22 |
| Department Mix | directory roll-up | nav → `GET /api/positions` (11) | 10.23 |
| Payroll Cost | `payroll` + pending lines | nav → `GET /api/payroll-periods` (07); **inline Approve/Waive** → `POST /api/deduction-candidates/{id}/review` (7.35/7.36) | 10.24 |
| Separations / offboarding panel | `offboarding` | nav → `GET /api/separations` (03) | 10.25 |
| Expiry / renewal cards (certifications & contracts) | expiry scan | nav → employee file documents (2.84) | 10.26 |

| # | Actor | Input | Expected |
|---|---|---|---|
| 10.19 | hrm | open Headcount panel | panel lists gyms + headcount; `View employees` navigates to the directory pre-filtered to the gym |
| 10.20 | hrm | open Attendance Trend, press **Manual Entry** | opens the manual form; submit (5.16 body) → 201, grid row appears |
| 10.21 | hrm | open Request Volume, **Review** a pending row, approve | `POST /api/requests/{id}/decide` 200 (6.34 rules apply — rejection still needs a comment) |
| 10.22 | hrm | open Funnel, **New Vacancy** | `POST /api/vacancies` 201 (4.11 rules apply); funnel counters update on next open |
| 10.23 | hrm | open Department Mix | per-department headcount matches `GET /api/positions` roll-up |
| 10.24 | hrm | open Payroll Cost, **Approve** a pending line | 200 — `entry.net` drops by the amount; **Waive** → amount excluded (7.35/7.36) |
| 10.25 | hrm | open Separations panel | counts equal `GET /api/separations` per-status totals (3.52) |
| 10.26 | hrm | open expiry panel | expiring documents = vault rows with `Expiring Soon` (2.84) |
| 10.27 | emp | open any panel action | 401 on the underlying endpoint |
| 10.28 | hr | panels | only gym1 data; inline Review of a gym2 request → 401/404 |
