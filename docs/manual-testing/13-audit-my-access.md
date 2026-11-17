# 13 — Audit Log & My Access

**Screens:** `audit` (`renderAuditLog` — activity log table with category/gym/user/date
filters) and `my-access` (`renderMyAccess` — the signed-in user's permission matrix).
**Guards:** audit reads `audit.view`; My Access opens for **any own-id** request, and for
other users' ids only with `team.view`.
Actors: `hrm`, `hr`, `admin`, `emp`, `anon`.

---

### GET /api/audit-log — activity log

Query: `?action=&gym=<id>&user=<id>&from=<yyyy-MM-dd>&to=<yyyy-MM-dd>&page=1&pageSize=20`

`action` buckets: `All Actions` (blank) | `Employee` | `Payroll` | `Recruitment` | `Bulk Import`.
Row shape: `{ id, action ("Employee Updated" style), user ("By: …"), target ("Candidate #12"), detail, timestamp, gym }`.

| # | Actor | Input | Expected |
|---|---|---|---|
| 13.1 | hrm | `?page=1` | 200 `{ items, page, pageSize, total, totalPages }` newest first |
| 13.2 | hrm | — | **Seed check (run actions first, then re-GET):** approve a request (6.34) → row; create an employee (2.13) → `Employee Created`-style row; publish payroll (7.51) → `Payroll Published` row; hire a candidate (4.84) → recruitment row; logout (0.31) → `Logout` row |
| 13.3 | hrm | `?action=Employee` | 200 employee-scoped rows only |
| 13.4 | hrm | `?action=Bogus` | 200 empty or 400 — record actual |
| 13.5 | hrm | `?gym=1` | 200 gym1 rows only |
| 13.6 | hrm | `?user=<hrm's id>` | 200 rows authored by that user only |
| 13.7 | hrm | `?from=2026-10-01&to=2026-10-31` | 200 rows inside the window |
| 13.8 | hrm | `?from=2026-11-01&to=2026-10-01` | 400/200-empty (inverted window) — record actual |
| 13.9 | hr | `?gym=2` | 401 (outside assignment) |
| 13.10 | hr | `?page=1` | 200 gym1-only rows (auto-scoped) |
| 13.11 | admin | `?page=1` | 200 org-wide |
| 13.12 | emp | — | 401 (`audit.view` denial) |
| 13.13 | anon / bad | — | 401 |
| 13.14 | hrm | — | **No-leak check:** audit `detail` never contains salary values or tokens |

---

### GET /api/users/{id} — My Access card

| # | Actor | Input | Expected |
|---|---|---|---|
| 13.15 | hrm | `GET /api/users/{own userId}` | 200 access profile: own id, role, gyms, **direct** permission keys and **effective** permissions (direct + role-inherited) — mirrors the My Access matrix |
| 13.16 | admin | `GET /api/users/{hrm's id}` | 200 (admin holds `team.view`) — shows hrm's seeded direct keys (all portal keys) |
| 13.17 | hrm | `GET /api/users/{karim's id}` | 200 or 401 — record actual (needs `team.view`; hrm holds it → expect 200) |
| 13.18 | emp | `GET /api/users/{own}` | 200 own card (self read always allowed) — `permissions` may be empty (feature roles don't populate the list) |
| 13.19 | emp | `GET /api/users/{karim+1}` | 401/404 (not own, no team.view) |
| 13.20 | anon | — | 401 |
| 13.21 | hrm | — | **Cross-check with 14:** after `PUT /api/users/{id}/permissions` (14.18), re-GET this endpoint — the direct list matches exactly; `effectivePermissions` also contains the role's bundle |
| 13.22 | hrm | — | **Cross-check:** after removing a key (14.19), the dashboard action card gated by it disappears (1.7) — effective access is the single source of truth |
