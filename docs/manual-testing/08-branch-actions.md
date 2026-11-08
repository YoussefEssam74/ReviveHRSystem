# 08 — Branch Actions (warnings & bonuses HR review, queue, reports)

**Screen content:** the HR side of the Branch-Manager palette — Warnings review,
Bonuses review (Approve / Decline-with-reason), the BM "Awaiting HR" queue, deduction
proposals (they land in the payroll review queue, 07), and free-form branch reports.
**Guards:** lists `requests.view` · review `requests.approve` · BM creates use the
**feature** gate (`employees` Edit for warnings/bonuses, `attendance` Edit for deductions)
— all gym-scoped.
Actors: `bm` (creates proposals at gym1), `hrm`/`hr` (review), `emp` (negatives).

Both review endpoints were built with: decline **requires** a reason, double-decide → 400,
out-of-scope → 404, and stamped `reviewedBy` / `reviewedAt` / `reviewNote`.

---

### POST /api/warning-notices — BM raises a warning (setup)

```json
{ "employeeId": 42, "type": "Attendance", "reason": "Three unexcused absences in October.", "note": "Shift log attached." }
```
`type`: `Attendance | Conduct | Performance | Safety | Policy violation`

| # | Actor | Input | Expected |
|---|---|---|---|
| 8.1 | bm | happy body (gym1 employee — e.g. Karim's id) | **201** `{ id, employeeId, employee, type, reason, note, status: "Pending", issuedAt, issuedBy }` — no `reviewedBy` yet; employee does **not** see it until filed |
| 8.2 | hrm | same body (HR may also raise) | 201 |
| 8.3 | bm | `"type": "Whatever"` | 400 (closed vocabulary) or stored verbatim — record actual |
| 8.4 | bm | missing `reason` | 400 |
| 8.5 | bm | `employeeId` of a gym2 employee | 401/404 (feature gate + scope) |
| 8.6 | emp | — | 401 (no `employees` Edit feature) |

---

### GET /api/warning-notices/queue — HR review queue

Query: `?status=Pending|Approved|Rejected&gym=<id or name>&page=1&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 8.7 | hrm | `?status=Pending` | 200 `{ items, page, pageSize, total, totalPages }` — item includes `status`, `issuedBy`, and (once decided) `reviewedBy`, `reviewedAt`, `reviewNote` |
| 8.8 | hrm | (no filter) | 200 all statuses in scope, newest first |
| 8.9 | hr | `?gym=2` | 401 (outside assignment) |
| 8.10 | hr | (no filter) | 200 gym1 rows only |
| 8.11 | bm | `?status=Pending` | **200** gym1 rows only — bm's seeded keys include `requests.view`, so the list gate passes; rows outside his gyms stay hidden |
| 8.12 | emp | — | 401 · `anon` → 401 · `bad` → 401 |

---

### POST /api/warning-notices/{id}/review — File / Decline

```json
{ "decision": "Approved", "note": "Filed to the employee record." }
```
Decline: `{ "decision": "Rejected", "note": "Declined — first occurrence, coaching given." }` — **note required on Rejected**.

| # | Actor | Input | Expected |
|---|---|---|---|
| 8.13 | hrm | approve a Pending notice | 200 `{ data: <notice> }` — `status: "Approved"`, `reviewedBy` = HR name, `reviewedAt` set, `reviewNote` (optional reason) |
| 8.14 | hrm | decline a Pending notice **without** `note` | **400** (decline requires a reason) |
| 8.15 | hrm | decline with `note` | 200 `status: "Rejected"`, `reviewNote` = the reason |
| 8.16 | hrm | review the same id again (approve → decline) | **400** double-decide (verified by integration test) |
| 8.17 | hrm | `{"decision":"Maybe"}` | 400 (only Approved/Rejected) |
| 8.18 | hrm | `{"decision":"Approved"}` | works **without** note (reason only mandatory on decline) |
| 8.19 | hr | gym2 notice id | 404 (out-of-scope target) |
| 8.20 | bm | — | 401 — bm holds `requests.approve.branch`, **not** `requests.approve` (integration test asserts 401 for `requests.view`-only tokens) |
| 8.21 | emp | — | 401 |
| 8.22 | hrm | unknown id | 404 |

---

### POST /api/bonus-proposals — BM proposes a bonus (setup)

```json
{ "employeeId": 42, "type": "Performance Bonus", "amount": 1500, "reason": "Q3 sales target beaten.", "note": "Team lead endorsed." }
```
`type`: `Performance Bonus | Overtime Pay | Attendance Reward | Referral Bonus | Other` · `amount` > 0

| # | Actor | Input | Expected |
|---|---|---|---|
| 8.23 | bm | happy body (gym1 employee) | **201** proposal with `status: "Pending"` |
| 8.24 | bm | `"amount": 0` / negative | 400 |
| 8.25 | bm | missing `reason` | 400 |
| 8.26 | emp | — | 401 |
| 8.27 | bm | gym2 employee | 401/404 |

---

### GET /api/bonus-proposals/queue — HR review queue

Query: `?status=&gym=&page=&pageSize=` (same shape as warnings)

| # | Actor | Input | Expected |
|---|---|---|---|
| 8.28 | hrm | `?status=Pending` | 200 — the 8.23 proposal listed (integration test asserts the Pending filter) |
| 8.29 | hrm | — | 200 items carry `amount`, `issuedBy`, `reviewedBy`, `reviewedAt`, `reviewNote` |
| 8.30 | hr | `?gym=2` | 401 |
| 8.31 | emp | — | 401 · `anon` → 401 |

---

### POST /api/bonus-proposals/{id}/review — Approve / Decline

```json
{ "decision": "Rejected", "note": "Outside budget this quarter." }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 8.32 | hrm | `{"decision":"Approved","note":"Approved — flows to payroll."}` | 200 `{ data }` — `status: "Approved"`, reviewer stamped; approved proposals become payroll line items (cross-check 07 queue/entry bonus) |
| 8.33 | hrm | decline with reason | 200 `status: "Rejected"`, `reviewNote` echoed (integration test) |
| 8.34 | hrm | decline **without** `note` | **400** |
| 8.35 | hrm | second review of the same id | **400** (double-decide) |
| 8.36 | hr | gym2 proposal | 404 |
| 8.37 | bm | — | 401 (no `requests.approve`) |
| 8.38 | emp | — | 401 |

---

### GET /api/branch-actions/pending-hr — BM "Awaiting HR" queue

| # | Actor | Input | Expected |
|---|---|---|---|
| 8.39 | bm | — | 200 `[{ id, kind: "Deduction|Warning|Bonus", employee, detail, date, status: "Pending HR" }]` for his gym/team — contains 8.1/8.23/8.45 once created |
| 8.40 | hrm | — | 200 (HR sees own scope too) or empty — record actual |
| 8.41 | bm | after 8.13 + 8.32 | decided items drop out (`status` no longer Pending HR) |
| 8.42 | emp | — | 401 (`attendance` View gate) · `anon` → 401 |

---

### POST /api/deduction-candidates — BM raises a deduction (setup for 07)

```json
{ "employeeId": 42, "amount": 300, "reason": "Unapproved absence", "note": "Oct 14, no notice." }
```
`reason`: `Unapproved absence | Late arrival (30+ min) | Early checkout without approval | Damaged equipment / property | Policy violation | Other` · `amount` > 0 · created `Pending`.

| # | Actor | Input | Expected |
|---|---|---|---|
| 8.43 | bm | happy body (gym1) | **201** `{ id, employeeId, employee, amount, reason, note, status: "Pending", issuedAt, issuedBy }` |
| 8.44 | bm | `"amount": -10` | 400 |
| 8.45 | bm | out-of-scope employee | 404 (per api.md) / 401 — record actual |
| 8.46 | hrm | — | Cross-link: the payroll review queue (`GET /api/deduction-candidates`, §07) lists **settlement-sheet line items**, a different table from this proposal — the BM proposal appears in `GET /api/branch-actions/pending-hr` (8.39) but **not** in the payroll queue. Record this as observed: this build has no endpoint that promotes a proposal into a payroll line |
| 8.47 | emp | — | 401 |

---

### POST /api/branch-reports — free-form report to HR

```json
{ "period": "October 2026", "type": "Incident report", "message": "Locker room altercation on Oct 12 — statements filed." }
```
`type`: `Monthly branch summary | Attendance exceptions | Incident report | Request escalations`

| # | Actor | Input | Expected |
|---|---|---|---|
| 8.48 | bm | happy body | **204** — lands in the HR action queue as a `BranchReport` event (verify under 12: `GET /api/events` after a refresh) |
| 8.49 | emp | happy body | 204 (any authenticated employee may report) |
| 8.50 | bm | missing/empty `message` | 400 |
| 8.51 | bm | `"type": "Poem"` | 400 (unknown type) |
| 8.52 | anon | — | 401 |
