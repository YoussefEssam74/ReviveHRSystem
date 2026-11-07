# 12 — Notifications, Announcements & Events (+ Escalated queue)

**Screens:** `notifications` (inbox + announcements tabs + compose modal), `events`
(action queue: Renewals / Requests / Offboarding / Transfers / Vacancies / Payroll +
**Escalated requests** tab), and the unread bell everywhere.
**Guards:** the **inbox** needs only a JWT (rows are user-scoped); announcements
`announcements.view` / `announcements.manage`; events `events.view` (+ each card's own
permission key, carried on the item); action-request decisions team-scoped.
Actors: `hrm`, `hr`, `bm`, `emp`, `anon`.

---

## Notifications inbox

### GET /api/notifications — my inbox

Query: `?page=1&pageSize=20&unread=true|false&category=Requests|Recruitment|Document|System|Announcements`

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.1 | hrm | `?page=1` | 200 `{ items, page, pageSize, total, totalPages }`; item `{ id, category, title, description, date, read, color, link }`, newest first — **only the caller's rows** |
| 12.2 | hrm | `?unread=true` | 200 only `read: false` |
| 12.3 | hrm | `?category=Requests` | 200 category-scoped |
| 12.4 | hrm | `?category=Bogus` | 200 empty (unknown category = no match) |
| 12.5 | hrm | — | Seed check: run 6.34 (request approved) → the employee's inbox (`karim`) gains a Requests notification; 4.116 (interview reminder) → RecruitmentFollowUp row |
| 12.6 | emp | `?page=1` | 200 **karim's own** rows only (inbox is per-user, no extra key) |
| 12.7 | anon / bad | — | 401 |

### GET /api/notifications/unread-count · PUT /api/notifications/{id}/read · PUT /api/notifications/read-all

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.8 | hrm | `GET /api/notifications/unread-count` | 200 `{ count }` — matches `?unread=true` `total` |
| 12.9 | hrm | `PUT /api/notifications/{id}/read` | 200 `{ data }` with `read: true`; unread-count drops by 1 |
| 12.10 | hrm | repeat the same PUT | 200 idempotent (count unchanged) |
| 12.11 | hrm | PUT another user's id | 404 (rows are user-scoped) |
| 12.12 | hrm | `PUT /api/notifications/read-all` | 200 `{ message }`; unread-count → 0 |
| 12.13 | anon | read-all | 401 |

---

## Announcements (compose modal)

### GET /api/announcements — broadcast history

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.14 | hrm | `?page=1` | 200 history cards `{ id, title, audience, type, message, status: "Sent", sentAt/by, readCount, audienceCount, readRate }` newest first |
| 12.15 | emp | — | 401 (`announcements.view`) · `anon` → 401 |

### POST /api/announcements — compose

```json
{ "title": "Locker maintenance Friday", "audience": "All Employees", "type": "Reminder", "message": "Lockers 1-20 serviced 2-4 PM Friday." }
```
`type`: `Policy Update | Event | Reminder | Recognition` · `audience`: `All Employees` | a branch name | a segment label.

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.16 | hrm | happy body | **201** `{ data }` — fans out one notification per in-scope user (check 12.1 as karim) |
| 12.17 | hrm | `audience: "<gym1 branch name>"` | 201 — only gym1 users receive it |
| 12.18 | hrm | missing `title`/`message` | 400 |
| 12.19 | hrm | `"type": "Poem"` | 400 (closed vocabulary) |
| 12.20 | hr | audience gym2 | 401/400 (outside scope) |
| 12.21 | emp / bm | — | 401 (`announcements.manage`) |

### PUT /api/announcements/{id} — edit / retract

```json
{ "message": "Lockers 1-20 serviced 1-3 PM Friday (updated).", "status": "Cancelled" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.22 | hrm | edit the message | 200 `{ data }` — content updated, `status: "Sent"` kept |
| 12.23 | hrm | `{ "status": "Cancelled" }` | 200 — **retract**: card shows Cancelled; already-delivered notifications are NOT recalled (open karim's inbox — row persists; record as observed) |
| 12.24 | hrm | `{}` (empty partial) | 200 no-op |
| 12.25 | hrm | unknown id | 404 |
| 12.26 | emp | — | 401 |

---

## Events queue

`GET /api/events` **re-derives the queue on every read** (pending payroll periods,
expiring certifications/contracts ≤ 30 days, approved-transfer escalations, approved
vacancy requests, branch reports) and materializes stable rows with a resolved overlay.
Query: `?gym=&type=&status=Open|Resolved&resolved=true|false&urgency=&page=1&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.27 | hrm | `?page=1` | 200 `{ items, page, pageSize, total, totalPages }`; item `{ id, type, tab, title, date, urgency, branch, detail, permission, resolved, resolvedOn, resolvedBy, …per-type payload }` |
| 12.28 | hrm | — | **Sync check:** approve a vacancy request (4.31) → a Vacancy Approval card appears; publish payroll (7.51) → the Payroll card disappears; submit a branch report (8.48) → a Branch Report card appears |
| 12.29 | hrm | `?status=Resolved` | 200 resolved cards with `resolvedOn`/`resolvedBy` |
| 12.30 | hrm | `?urgency=high` | 200 high-urgency only |
| 12.31 | hrm | `?type=<e.g. Payroll Approval>` | 200 one tab's cards (note the exact `type`/`tab` vocabulary from 12.27 and reuse it here) |
| 12.32 | hr | `?gym=2` | 401 (outside assignment) |
| 12.33 | emp | — | 401 (`events.view`) · `anon` → 401 |
| 12.34 | hrm | — | Each card carries `permission` — the key its action needs; a card whose key the actor lacks renders read-only |

### GET /api/events/counts

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.35 | hrm | — | 200 per-tab `{ open, high, resolved }` + `escalations.open` — equals 12.27 groupings |
| 12.36 | emp | — | 401 · `anon` → 401 |

### PUT /api/events/{id}/resolve · PUT /api/events/{id}/reopen

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.37 | hrm | resolve a card | 200 `{ data }` — audit row `Event Resolved`; card leaves the open list |
| 12.38 | hrm | resolve again | 200 idempotent |
| 12.39 | hrm | reopen it | 200 — back on the open queue; reopen again idempotent |
| 12.40 | hrm | unknown id | 404 |
| 12.41 | hr | gym2 card | 404 · `emp` → 401 |

### POST /api/events/{id}/renewal-request — document expiry card

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.42 | hrm | a Certification/Contract Renewal card (seed an expiring document via 2.85 with a near expiry) | **201** `{ data }` — employee receives a Renewal Request notification, audit `Document Renewal Requested` |
| 12.43 | hrm | repeat | 201/400 already-requested — record actual |
| 12.44 | hrm | a non-renewal card type | 400 |
| 12.45 | emp | — | 401 |

### PUT /api/events/{id}/decide — transfer ticket

```json
{ "decision": "approve", "comment": "Approved for North branch coverage." }
```
`decision`: `approve | reject` (lowercase).

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.46 | hrm | approve a Transfer card (seed: bm approves a Transfer action request, 12.55) | 200 `{ data }` — **the gym move executes**: employee `gymId` + `UserGymAccess` re-pointed (verify via 2.27), history `Gym Transfer` |
| 12.47 | hrm | reject with comment | 200 — ticket closed, employee stays put |
| 12.48 | hrm | `{ "decision": "Maybe" }` | 400 |
| 12.49 | hrm | decide the same ticket again | 400 already decided |
| 12.50 | hrm | a non-transfer card | 400 (decide is transfer-only) |
| 12.51 | hr | gym2 ticket | 404/401 |
| 12.52 | emp | — | 401 |

---

## Escalated requests tab (action requests)

`GET /api/action-requests` · `PUT /api/action-requests/{id}/approve` · `PUT /api/action-requests/{id}/reject`
— the employee-side "Request Action" escalations (Transfer / Compensation / Offboard).

| # | Actor | Input | Expected |
|---|---|---|---|
| 12.53 | hrm | `GET /api/action-requests?status=Pending` | 200 pending escalations `{ id, kind, employee, position, date, status, … }` newest first |
| 12.54 | hrm | `PUT …/{id}/approve` (Compensation) | 200 — salary change applied (verify 2.67-style history row) |
| 12.55 | hrm | `PUT …/{id}/approve` (Transfer) | 200 — escalates into a Transfer ticket card in the Events queue (12.46 decides it) |
| 12.56 | hrm | `PUT …/{id}/approve` (Offboard) | 200 — a separation case appears on the Terminations board (03) |
| 12.57 | hrm | `PUT …/{id}/reject` `{ "comment": "Not budgeted." }` | 200 rejected |
| 12.58 | hrm | reject without comment | 400/204 — record actual |
| 12.59 | hrm | decide twice | 400 already decided |
| 12.60 | bm | — | 401 (team-scoped gate) · `emp` → 401 · `anon` → 401 |
