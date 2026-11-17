# 11 — Positions & Levels (catalog)

**Screen:** `positions` — catalog rows with derived headcount/open/fill + add/edit modal.
**Guards:** reads `positions.view`, writes `positions.manage` — gym-scoped.
Actors: `hrm`, `hr` (gym1), `emp` (negative).

---

### GET /api/positions — catalog

Query: `?gym=<id>&searchTerm=<substring>&active=true|false`

| # | Actor | Input | Expected |
|---|---|---|---|
| 11.1 | hrm | (empty) | 200 `{ items, total }` (flat catalog — `total` is the full list length, **no pager**); item `{ id, title, levels[], department, gym, headcount, active, open, fill }` |
| 11.2 | hrm | — | Derived fields: `open == max(headcount − active, 0)`, `fill` = percent of headcount filled (0–100) |
| 11.3 | hrm | `?gym=1` | 200 gym1 rows only |
| 11.4 | hrm | `?searchTerm=trainer` | 200 case-insensitive title substring |
| 11.5 | hrm | `?active=true` | 200 only `active: true` rows |
| 11.6 | hr | `?gym=2` | 401 (outside assignment) |
| 11.7 | hr | (empty) | 200 gym1 rows only (auto-scoped) |
| 11.8 | admin | (empty) | 200 org-wide (TopManagement) |
| 11.9 | emp | — | 401 (`positions.view` denial) |
| 11.10 | anon / bad | — | 401 |
| 11.11 | hrm | — | Cross-check: creating a position via the employee **position-change** modal (2.62) adds a catalog row here |

---

### POST /api/positions — add modal

```json
{
  "title": "Membership Consultant",
  "levels": ["Junior", "Mid"],
  "department": "Sales",
  "gym": 1,
  "headcount": 4,
  "active": true
}
```
(`gym` accepts a name or send `gymId`; department optional.)

| # | Actor | Input | Expected |
|---|---|---|---|
| 11.12 | hrm | happy body | **201** `{ data: <catalog item> }` — `levels` echoed, `open: 4`, `fill: 0` |
| 11.13 | hrm | omit `headcount` | 201 with `headcount: 0` (or 400 — record actual) |
| 11.14 | hrm | `{"title": ""}` | 400 (title required) |
| 11.15 | hrm | duplicate title **+ level** in the same gym | 400 (a new level for an existing title updates the row instead of creating a duplicate) |
| 11.16 | hrm | existing title + **new** level | 201 — creates/merges a catalog row carrying the level chip |
| 11.17 | hrm | `{"title": "X", "gymId": 999}` | 400 unknown gym |
| 11.18 | hr | `{"title": "Y", "gym": 2}` | 401 (not assigned) |
| 11.19 | emp | — | 401 (`positions.manage`) |

---

### PUT /api/positions/{id} — edit modal

```json
{ "title": "Membership Consultant", "levels": ["Senior"], "department": "Sales", "gym": 1, "headcount": 5, "active": true }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 11.20 | hrm | happy body (raise headcount) | 200 `{ data }` — `open`/`fill` recompute; employees holding the title are **not** moved |
| 11.21 | hrm | `{ "active": false }` | 200 — row drops out of `?active=true` lists but stays on existing employees |
| 11.22 | hrm | `{}` (empty) | 200 no-op (or 400 title required — record actual) |
| 11.23 | hrm | unknown id | 404 |
| 11.24 | hr | gym2 position | 401 |
| 11.25 | emp | — | 401 |
| 11.26 | hrm | — | Cross-check: 2.62's created position and 4.11's vacancy position appear with sensible `active` counts |
