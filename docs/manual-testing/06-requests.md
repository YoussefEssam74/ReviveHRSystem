# 06 — Requests (directory, HR decisions, Branch Queue route)

**Screens:** `requests` **and** `branch-queue` — both routes render the same Requests
screen (`renderRequests`). Directory filters, detail + timeline, HR-created request form,
HR decide / undo / bulk, archive/restore.
**Guards:** reads `requests.view`, decisions `requests.approve` — gym-scoped per request.

**Request types this directory accepts (exact list):**
`Day Off, Sick Leave, Leave Early, Late Arrival, Shift Swap, Resignation`
(case-insensitive on create). Status vocabulary: `Pending, Pending HR Review, Approved,
Rejected, Archived, Decided`.

**Flow note:** requests created through this portal start at **Pending HR Review**
(decidable immediately). Employee self-submitted requests start at **Pending** and cannot
be HR-decided yet (400 "still awaiting the branch manager's decision" — the stage-1
decision has no HTTP route in this build; see cases 6.36–6.37).

---

### GET /api/requests — directory

Query: `?gym=&status=&type=&date=&quick=&ids=&page=1&pageSize=20&sortBy=submitted|requested|employee|status&sortOrder=asc|desc`

| # | Actor | Input | Expected |
|---|---|---|---|
| 6.1 | hrm | `?page=1&pageSize=20` | 200 `{ items, page, pageSize, total, totalPages }`; item `{ id, employee, gym, type, requestedDate, startDate, endDate, days, reason, status, bmDecision, bmComment, payment, submittedDate, urgent }`, newest first |
| 6.2 | hrm | `?status=Pending HR Review` | 200 only HR-review rows (spaces/case insensitive: `pendinghrreview` also works) |
| 6.3 | hrm | `?status=Decided` | 200 Approved + Rejected only |
| 6.4 | hrm | `?status=Bogus` | 400 "status must be Pending, Pending HR Review, Approved, Rejected, Archived, or Decided." |
| 6.5 | hrm | `?type=Day Off` | 200 Day Off rows (exact display match) |
| 6.6 | hrm | `?type=Emergency Leave` | **200 empty list** (type filter is exact-match, no 400 — api.md is stale here) |
| 6.7 | hrm | `?date=2026-10-21` | 200 requests whose `(TargetStartDate ?? RequestDate)…(TargetEndDate ?? RequestDate)` span covers the day |
| 6.8 | hrm | `?date=21-10-2026` | 400 "date must be a valid date (yyyy-MM-dd)." |
| 6.9 | hrm | `?quick=urgent` | 200 resignation/termination rows; `?quick=approved`, `?quick=bmRejected`, `?quick=balance` each work |
| 6.10 | hrm | `?quick=weird` | 400 "quick must be urgent, approved, bmRejected, or balance." |
| 6.11 | hrm | `?ids=1,2,3` | 200 explicit ids only (payroll linked-requests pane) |
| 6.12 | hrm | `?ids=1,abc` | 400 "ids must be a comma-separated list of integers." |
| 6.13 | hrm | `?sortBy=employee&sortOrder=asc` | 200 A→Z by employee |
| 6.14 | hrm | `?gym=1` and `?gym=2` | 200 both (hrm holds both) |
| 6.15 | hr | `?gym=2` | 401 (outside assignment) |
| 6.16 | hr | `?page=1` | 200 gym1-only rows (auto-scoped) |
| 6.17 | emp | `?page=1` | 401 (`requests.view` denial) |
| 6.18 | anon / bad | — | 401 |
| 6.19 | hrm | `?pageSize=1000` | clamped to 100 |

---

### GET /api/requests/{id} — detail + timeline

| # | Actor | Input | Expected |
|---|---|---|---|
| 6.20 | hrm | happy id | 200 `{ data: { …item…, timeline: [{ step, date, done }] } }` — Submitted always done; HR step shows verdict or "Review" |
| 6.21 | hr | gym2 request | 401 |
| 6.22 | emp | another employee's request | 401/404 |
| 6.23 | hrm | 999999 | 404 |

---

### POST /api/requests — create on behalf (directory action)

```json
{
  "employee": "Karim Hassan",
  "type": "Day Off",
  "requestedDate": "2026-11-05",
  "endDate": "2026-11-07",
  "reason": "Family event."
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 6.24 | hrm | happy body (exact unique employee name in scope) | **201** `{ data: { id, status: "Pending HR Review", timeline } }` |
| 6.25 | hrm | `type` lower-case `day off` | 201 (case-insensitive match) |
| 6.26 | hrm | `"employee": "Nobody Here"` | 400 `No employee named "…" was found in your gyms.` |
| 6.27 | hrm | ambiguous name (two employees share it) | 400 `Multiple employees are named "…" — open the request from an employee file instead.` |
| 6.28 | hrm | `"type": "Emergency Leave"` | 400 "type must be one of: Day Off, Sick Leave, Leave Early, Late Arrival, Shift Swap, Resignation." |
| 6.29 | hrm | missing `requestedDate` | 400 "requestedDate must be a valid date (yyyy-MM-dd)." |
| 6.30 | hrm | `endDate` < `requestedDate` | 400 "endDate must be on or after requestedDate." |
| 6.31 | hrm | missing `employee` | 400 "Employee is required." |
| 6.32 | hr | employee in gym2 | 401 (`requests.view` scope resolution) |
| 6.33 | emp | — | 401 |

---

### POST /api/requests/{id}/decide — HR verdict (R3/A6)

```json
{ "stage": "HR", "decision": "Approved", "comment": "No scheduling conflict.", "payment": "paid" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 6.34 | hrm | approve a **Pending HR Review** Day Off (from 6.24), `payment: "paid"` | 200 `{ message: "Request approved · paid (balance deducted)", item }` — balance `used` +3 (inclusive days), item status `Approved`, payment `Paid` |
| 6.35 | hrm | same, `"payment"` omitted | 200 — payment **derived** from the current-year balance: remaining > 0 → paid, else unpaid (message follows) |
| 6.36 | hrm | approve a **Pending** (self-submitted) request | 400 "This request is still awaiting the branch manager's decision." (known gap: no stage-1 route exists in this build) |
| 6.37 | hrm | `{ "stage": "BranchManager", ... }` | 400 "This endpoint records the HR stage decision only." (stage omitted → HR) |
| 6.38 | hrm | reject: `{ "decision": "Rejected" }` no comment | 400 "A rejection comment is required." |
| 6.39 | hrm | reject with comment | 200 "Request rejected · employee notified"; reserved leave days released |
| 6.40 | hrm | decide an already-Approved request | 400 "This request has already been decided. Use undo-decision to reopen it." |
| 6.41 | hrm | `{"decision":"Maybe"}` | 400 "decision must be Approved or Rejected." |
| 6.42 | hrm | approve a **Resignation** request | 200 + `offboardingPrompt: true` — employee status → `Notice Period`; board 03 now shows the case path |
| 6.43 | hrm | approve Day Off with `payment: "unpaid"` when balance remains | 200 — explicit value wins; balance untouched |
| 6.44 | hrm | approve Day Off with `payment: "paid"` after balance exhausted | balance row created with zero entitlement; paid still applies (deducts below zero? record actual — floored at 0 on undo) |
| 6.45 | hr | gym2 request | 401 (`requests.approve` scoped) |
| 6.46 | bm | — | 401 — `bm` holds `requests.approve.branch`, **not** `requests.approve` (verify: if 200, his key set includes it) |
| 6.47 | emp | — | 401 |
| 6.48 | hrm | decide an **Archived** request | 400 "Archived requests cannot be decided. Restore the request first." |

---

### POST /api/requests/{id}/undo-decision — R4

```json
{ "comment": "Correcting payment classification." }
```
(body optional)

| # | Actor | Input | Expected |
|---|---|---|---|
| 6.49 | hrm | undo the 6.34 approval | 200 `{ message: "Decision undone · returned to Pending HR Review", item }` — payment cleared, balance deduction returned (floored at 0) |
| 6.50 | hrm | undo an approved **Resignation** | 200 — employee reverted from `Notice Period` to `Active` |
| 6.51 | hrm | undo a `Pending`/`Pending HR Review` request | 400 (only Approved/Rejected qualify) |
| 6.52 | hrm | undo with a **past** `requestedDate` | 400 "This request's date has already passed" |
| 6.53 | hr | gym2 request | 401 |
| 6.54 | emp | — | 401 |

---

### POST /api/requests/bulk-decide

```json
{ "decision": "Approved", "requestIds": [101, 102, 103] }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 6.55 | hrm | ids of 2–3 Pending HR Review requests | 200 `{ message: "Bulk approved", approved: n, unpaidApplied: m }` — each derives its own payment |
| 6.56 | hrm | `{"decision":"Approved"}` (no ids) | 200 — approves **every** Pending HR Review request in scope |
| 6.57 | hrm | `{"decision":"Rejected"}` | 400 (bulk is approve-only) |
| 6.58 | hrm | ids containing an unknown id | 404 |
| 6.59 | hrm | ids containing an already-decided request | 400 |
| 6.60 | hr | ids of gym2 requests | 404/401 (out of scope) |
| 6.61 | emp | — | 401 |

---

### POST /api/requests/{id}/archive · POST /api/requests/{id}/restore

| # | Actor | Input | Expected |
|---|---|---|---|
| 6.62 | hrm | archive any decided request | 200 `{ message }` — status `Archived`; hidden from default list, visible under `?status=Archived` |
| 6.63 | hrm | restore it | 200 — status derived from decisions: HR decision → Approved/Rejected, else BM decision → Pending HR Review, else Pending |
| 6.64 | hrm | archive → decide (6.34 flow) | 400 with the archive message (6.48) — restore first |
| 6.65 | hr | gym2 request archive | 401 (`requests.view` gate) |
| 6.66 | emp | — | 401 |

---

### GET /api/employees/{id}/requests — employee-file Requests tab

Covered in [02-employees.md](02-employees.md) §2.105–2.108 (plain array, `requests.view`
on the employee's gym). Cross-check:

| # | Actor | Input | Expected |
|---|---|---|---|
| 6.67 | hrm | employee used above | array rows match the directory (6.1) filtered to that employee — statuses/payment identical |

---

### Adjacent management-surface routes (optional pass)

Owned by the Branch-Manager surface but reachable from Swagger; run once for completeness.

| # | Actor | Input | Expected |
|---|---|---|---|
| 6.68 | bm | `PUT /api/requests/{pending id}` `{"type":"Day Off","reason":"..."}` (feature `requests` Edit) | 204 edit of a pending request |
| 6.69 | bm | `POST /api/requests/{id}/comments` `{"comment":"Please attach the certificate."}` | 201 `{ id, author, body, date }` |
| 6.70 | bm | comment `{"comment":" "}` | 400 empty comment |
| 6.71 | bm | comment on out-of-scope request | 404 |
