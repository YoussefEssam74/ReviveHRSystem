# 03 — Terminations (5-stage separation board + modal)

**Screen:** `terminations` (`renderTerminations` in `pages-employees.js`) — stage strip +
5 columns (Requested → Notice Period → Exit In Progress → Under Review → Completed),
gym filter, `+ Request Termination (BM)` and `+ Initiate Offboarding` buttons, and the
per-card **Manage · View data** modal (checklist, verdict, finalize).
**Guards:** reads `employees.view`; every write `employees.offboard` — gym-scoped.
Actors: `hrm`/`hr` (hold `employees.offboard`), `bm` (no offboard key → negatives), `emp`.

One open case per employee — run the happy path end-to-end on **one** employee, then
use a **second** employee for the negative cases.

---

### GET /api/separations — board data

Query: `?gym=<id or name>&status=Requested|Notice Period|Exit In Progress|Under Review|Completed&type=Resignation|Termination&page=&pageSize=`

| # | Actor | Input | Expected |
|---|---|---|---|
| 3.1 | hrm | `?page=1&pageSize=20` | 200 `{ items, page, pageSize, total, totalPages }`; item = `{ id, employee, employeeId, position, gym, lastDay, reason, requestedBy, requestedByUser, submittedDate, status, separationType, progress, checklist: [[label,done]×5], verdict, leaveTaken }` |
| 3.2 | hrm | — | `status` values drive the 5 columns exactly: `Requested \| Notice Period \| Exit In Progress \| Under Review \| Completed` |
| 3.3 | hrm | `?status=Requested` | 200 only Requested rows; `total` filtered |
| 3.4 | hrm | `?type=Termination` | 200 only terminations |
| 3.5 | hrm | `?gym=999` | 400 "Gym not found." |
| 3.6 | hr | `?gym=<gym2>` | 401 (outside hr's assignment) |
| 3.7 | hr | `?page=1` | 200 gym1-only rows (auto-scoped) |
| 3.8 | emp | — | 401 (`employees.view` denial) |
| 3.9 | anon / bad | — | 401 |

---

### POST /api/separations — "+ Request Termination (BM)" (T2)

```json
{
  "employeeId": 42,
  "lastDay": "2026-11-15",
  "reason": "Performance issues",
  "notes": "Documented in Q3 review."
}
```

Closed `reason` vocabulary (case-insensitive): `Performance issues`, `Attendance violations`,
`Misconduct / policy breach`, `Contract expiry — not renewing`, `Restructuring / redundancy`.

| # | Actor | Input | Expected |
|---|---|---|---|
| 3.10 | bm | happy body (his own gym, employee not already in a case) | 200 `{ data: <separation> }` with `status: "Requested"`, `separationType: "Termination"`, 5 unchecked tasks; employee standing **unchanged** |
| 3.11 | hrm | happy body on 2nd employee | 200 (HR may also submit) |
| 3.12 | hrm | `"reason": "Because I said so"` | 400 (closed vocabulary) |
| 3.13 | hrm | second case for the **same** employee | 400 (one open case per employee) |
| 3.14 | hrm | missing `lastDay` / `reason` / `employeeId` | 400 validation |
| 3.15 | hr | target employee in gym2 | 401 (`employees.offboard` scoped) |
| 3.16 | emp | — | 401 |

---

### POST /api/employees/{id}/offboard — "+ Initiate Offboarding" (E19)

```json
{ "lastDay": "2026-11-30", "reason": "Resignation — personal reasons", "notes": "Handover done" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 3.17 | hrm | reason containing "resign" | **201** `{ data: { separationId } }` — case starts at `Notice Period`, `separationType: "Resignation"`, employee parked in Notice Period (history row) |
| 3.18 | hrm | reason "Contract expiry — not renewing", no `separationType` | 201 — derived type `Termination` (contains "terminat"/"performance"/"attendance" heuristics apply) |
| 3.19 | hrm | `"separationType": "Resignation"` with a termination-only reason | 400 (non-Resignation type must justify Termination) |
| 3.20 | hrm | missing `lastDay` | 400 |
| 3.21 | hrm | employee already in a case (3.10 target) | 400 duplicate open case |
| 3.22 | bm | — | 401 (`employees.offboard` not in the branch-manager key set) |
| 3.23 | hrm | unknown employee id | 404 |

---

### PUT /api/separations/{id}/checklist — modal task ticks (T3)

```json
{ "index": 0, "done": true }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 3.24 | hrm | tick index 0 on a `Requested` case | 200 `{ data: { id, progress, status, checklist } }` — `status` advanced to `Exit In Progress`, `progress` 20 |
| 3.25 | hrm | tick 1–4 sequentially | 200 each; progress 40/60/80/100 |
| 3.26 | hrm | untick index 0 | 200 progress drops, but **stage never regresses** |
| 3.27 | hrm | `{ "index": 9, "done": true }` | 400 unknown index |
| 3.28 | hrm | `{ "index": 0 }` missing `done` | 400 validation |
| 3.29 | hr | case in gym2 | 401 |
| 3.30 | bm | — | 401 |

---

### PUT /api/separations/{id}/stage — board move buttons (T4)

```json
{ "status": "Under Review" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 3.31 | hrm | `{"status":"Exit In Progress"}` | 200 `{ message }` — card moves column |
| 3.32 | hrm | `{"status":"Completed"}` | 200 — **auto-ticks the whole checklist** and stamps completion; idempotent when already Completed |
| 3.33 | hrm | `{"status":"Archived"}` | 400 (only the 5 vocabulary words) |
| 3.34 | hrm | move backward `{"status":"Requested"}` | 200 (backward allowed — mock's move-back button) |
| 3.35 | hr | case in gym2 | 401 |
| 3.36 | bm | — | 401 |

---

### PUT /api/separations/{id}/verdict — modal verdict (T5)

```json
{
  "finalReason": "Mutual agreement — performance plan not met.",
  "settlement": { "direction": "owedToEmployee", "amount": 4200, "note": "Pro-rata leave + final dues" },
  "rehire": { "status": "Eligible", "note": "Eligible after 12 months" }
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 3.37 | hrm | happy body | 200 `{ message: "Exit verdict saved." }` — case → `Under Review`; card shows settlement + rehire chips |
| 3.38 | hrm | `"settlement": { "direction": "owe", … }` | 400 (only `none \| owedToEmployee \| employeeOwes`) |
| 3.39 | hrm | `"rehire": { "status": "Maybe" }` | 400 (only `Eligible \| Banned`) |
| 3.40 | hrm | missing `finalReason` | 400 |
| 3.41 | hrm | verdict on a `Completed` case | 200 — status stays Completed (verdict does not regress) |
| 3.42 | hr | case in gym2 | 401 |

---

### POST /api/separations/{id}/finalize — modal "Complete separation" (T6)

Empty body.

| # | Actor | Input | Expected |
|---|---|---|---|
| 3.43 | hrm | case with verdict but **not** all tasks ticked | 400 (checklist gate) |
| 3.44 | hrm | all tasks ticked but **no verdict** | 400 (verdict gate) |
| 3.45 | hrm | all ticked + verdict (happy path from 3.25+3.37) | 200 `{ message: "Separation completed for <name>." }` — employee `Terminated`, history `Offboarded`, **login deactivated** |
| 3.46 | hrm | call again | 400 (case already completed) |
| 3.47 | emp | finalize own case | 401 |
| 3.48 | hrm | — | Verify deactivation: `POST /api/auth/login` with the finalized employee's email → 401 "Invalid email or password." |

---

### Cross-checks & edges

| # | Actor | Input | Expected |
|---|---|---|---|
| 3.49 | hrm | `GET /api/separations/{id}` (finalized case) | 200 with `verdict.finalReason`, `settlement`, `rehire` echoed |
| 3.50 | hr | `GET /api/separations/{gym2 case id}` | 401 (another branch → denial, not leak) |
| 3.51 | hrm | unknown id | 404 |
| 3.52 | hrm | — | Board strip counts (3.1 `total` per status) equal the mock's 5 column headers |
| 3.53 | hrm | approving an **Immediate Termination** request in 06 first | Its employee shows in the board; `offboardingPrompt` flow links back to this screen |
