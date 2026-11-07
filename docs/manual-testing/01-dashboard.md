# 01 — Dashboard

**Screen:** `dashboard` (`renderDashboard`) · **Guard:** JWT; cards are permission-gated.
Primary actor: `hrm`. Endpoint: `GET /api/dashboard/hr`.

---

### GET /api/dashboard/hr

No query/body. Response `{ greeting, userName, kpis { totalGyms, totalStaff, totalPendingRequests, actionsNeeded }, actions: [ { id, kind, badge, title, subtitle, detail, date, gymId, gym } ], branches: [ { gymId, name, location, headcount, … } ] }`.

Card `kind` vocabulary: `request | vacancy | deduction | warning | bonus | contract | payroll`.

| # | Actor | Input | Expected |
|---|---|---|---|
| 1.1 | hrm | — | 200 — `kpis.totalGyms == 2`, `totalStaff ≥` seeded active staff, `branches` contains gym1 **and** gym2 rows |
| 1.2 | hrm | — | `actions[]` includes at least one `kind:"warning"` card while a Pending warning exists (seed via 08) — `actionsNeeded ≥ 1` |
| 1.3 | hr | — | 200 — `branches` contains **only gym1** (gym2 row absent; hr is gym1-scoped) |
| 1.4 | hr | — | `actions` only reference `gymId: 1` cards (gym2 pending items hidden) |
| 1.5 | admin | — | 200 — all gyms, all cards (TopManagement bypass) |
| 1.6 | emp | — | 200 but `kpis.actionsNeeded == 0` — dashboard is open, but **every card is permission-gated**; an employee holds none (verified by integration test) |
| 1.7 | hrm after temporarily removing `requests.view` (case 14.9) | — | `actionsNeeded` drops — warning/bonus/deduction cards vanish while `requests.view` is missing; restore the key afterwards |
| 1.8 | anon | — | 401 |
| 1.9 | bad | — | 401 |
| 1.10 | hrm | — | Consistency: `kpis.totalPendingRequests` equals `GET /api/requests?status=Pending` `total` for the same scope (see 06) |
| 1.11 | hrm | — | Card gating matrix: remove `payroll.approve` → no `payroll` card; remove `recruitment.vacancy_request.approve` → no `vacancy` card; remove `employees.contract.manage` → no `contract` card (restore each key after) |
| 1.12 | hrm | — | `branches[].headcount` matches `GET /api/positions` active counts / directory headcount for the branch |

---

### GET /api/teams/my-teams · GET /api/teams/{teamId}/today · GET /api/teams/{teamId}/unscheduled-count

Supporting widgets (feature `employees` ≥ View). `my-teams` returns the teams the caller leads/belongs to in the active gym.

| # | Actor | Input | Expected |
|---|---|---|---|
| 1.13 | bm (Team Leader in gym2) | `GET /api/teams/my-teams` | 200 — his led/belonged teams only |
| 1.14 | bm | `GET /api/teams/{ledTeamId}/today` | 200 `{ teamId, teamName, stats { total, present, late, absent, pendingRequests }, members: [...] }` |
| 1.15 | bm | `GET /api/teams/{ledTeamId}/unscheduled-count` | 200 count of members with no published assignment |
| 1.16 | bm | `GET /api/teams/{otherTeamId}/today` (not his) | 404 (no existence leak) |
| 1.17 | hrm | `GET /api/teams/my-teams` | 200 (may be empty — HR is not a member; empty ≠ error) |
| 1.18 | anon | — | 401 |
