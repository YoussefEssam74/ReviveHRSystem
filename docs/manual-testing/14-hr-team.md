# 14 — HR Team (member list, roles & permissions, assignment wizard)

**Screen:** `hr-team` (`renderHRTeam`) — member table + the add-member wizard
(employees → role → gym access → permissions), Roles & Permissions admin (create /
edit / configure / clone / archive), and the assignment grid.
**Guards:** lists `team.view` · every write `team.manage`.
Actors: `hrm` (all keys), `admin` (TopManagement), `emp` (negatives).

**Wizard flow to run end-to-end:** 14.1 → 14.7 → 14.13 → 14.15 → 14.17 → 14.19 → verify 13.21.

---

### GET /api/users — HR Team member list (Phase 1 endpoint)

Query: `?gym=<id or name>&type=staff|hr|topmanagement|employee|all&search=<substring>&status=Active|Suspended&page=1&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.1 | hrm | `?page=1` | 200 `{ items, page, pageSize, total, totalPages }`; item (verified live) `{ id, name, email, initials, role, roles[], gyms[], permissionsCount, permissions[], status, lastLoginAt }` — default `type=staff` returns the 3 staff members (admin, hr, hrmanager…); `permissions: ["*"]` marks the Super Admin |
| 14.1b | hrm | `?type=all` | 200 every account (staff + employees) |
| 14.2 | hrm | `?search=karim` | 200 substring of name/email/username |
| 14.3 | hrm | `?type=staff` / `?status=Active` | 200 filtered sets; `total` reflects the filter |
| 14.4 | hrm | `?gym=2` | 200 members with gym2 access |
| 14.5 | hr | `?gym=2` | 401 (outside assignment) |
| 14.6 | emp | `?page=1` | 401 (`team.view` denial) · `anon`/`bad` → 401 |

---

## Roles & Permissions admin

### GET /api/roles

Query: `?search=<substring>&page=1&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.7 | hrm | `?page=1` | 200 `{ items, page, pageSize, total, totalPages }`; item `{ id, name, description?, permissionCount, users }` |
| 14.8 | hrm | `?search=branch` | 200 name/description substring |
| 14.9 | emp | — | 401 (`team.view`) · `anon` → 401 |

### POST /api/roles — create

```json
{ "name": "Front Desk Lead", "description": "Reception supervision.", "permissions": ["employees.view", "requests.view", "requests.approve"] }
```
Clone-on-create: `"cloneFromRoleId": <existing id>` (copies that role's permission set; own `permissions` wins when both given).

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.10 | hrm | happy body | **201** `{ data: <role> }` — `permissionCount: 3` |
| 14.11 | hrm | `{"name": "X", "cloneFromRoleId": <id>}` | 201 — cloned permission set |
| 14.12 | hrm | `{"name": "HR Manager"}` (existing) | 400 duplicate name |
| 14.13 | hrm | `{"name": ""}` / missing name | 400 |
| 14.14 | hrm | `{"name": "Y", "permissions": ["bogus.key"]}` | 400 unknown key (validated against the catalog) |
| 14.15 | emp | — | 401 (`team.manage`) |

### PUT /api/roles/{id} · PUT /api/roles/{id}/permissions

```json
{ "name": "Front Desk Lead", "description": "Reception + closing.", "permissions": ["employees.view", "requests.view"] }
```
configure: `{ "permissions": ["employees.view", "requests.view", "attendance.view"] }`

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.16 | hrm | PUT happy body | 200 `{ data }` — rename + permission replacement in one call |
| 14.17 | hrm | PUT permissions configure | 200 `{ data: { id, permissions } }` — **wholesale replace**; GET role shows the new count; assigned users' `effectivePermissions` shift accordingly |
| 14.18 | hrm | `{}` empty update | 400 (name required) |
| 14.19 | hrm | unknown id | 404 · `emp` → 401 |

### POST /api/roles/{id}/clone · DELETE /api/roles/{id}

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.20 | hrm | `POST /api/roles/{id}/clone` `{"name": "Front Desk Lead (Copy)"}` | **201** `{ data }` — same permission set, new name |
| 14.21 | hrm | clone to an existing name | 400 |
| 14.22 | hrm | `DELETE /api/roles/{role with no assignees}` | **204** archived |
| 14.23 | hrm | `DELETE /api/roles/{assigned role}` (e.g. Employee) | **400** (assigned roles rejected — unassign first via 14.28) |
| 14.24 | emp | clone/delete | 401 |

---

### GET /api/permissions — catalog (14.2 + My Access denominator)

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.25 | hrm | — | 200 `{ data: { items: [{ key, area, description }], modules: [{ name, permissions[] }], totalTracked } }` — items ordered by area then key; `modules` grouped per area |
| 14.26 | hrm | — | `totalTracked ≥ 47` (47 catalog keys + test additions); `items.length == totalTracked` |
| 14.27 | emp | — | 401 (`team.view`) |

---

## User assignment (wizard steps 3–4 + the grid)

### PUT /api/users/{id}/permissions — assignment grid

```json
{ "permissions": ["employees.view", "requests.view", "requests.approve", "attendance.view"] }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.28 | hrm | happy body on karim's id | 200 `{ data: { userId, roleId, rolePreset, permissions, effectivePermissions, count, gymIds } }` — `permissions` = the 4 direct keys, `effectivePermissions` adds role-inherited ones |
| 14.29 | hrm | same body again | 200 idempotent |
| 14.30 | hrm | `{ "permissions": [] }` | 200 — **wholesale replace**: karim's direct keys cleared (`count: 0`); verify 13.18 |
| 14.31 | hrm | `{ "permissions": ["not.a.key"] }` | 400 unknown key validated against the catalog |
| 14.32 | hrm | unknown user id | 404 |
| 14.33 | hr | — | 200/401 per `team.manage` — hr holds it → expect 200 |
| 14.34 | emp | — | 401 |
| 14.35 | hrm | — | **Effective-access check:** with `requests.approve` granted (14.28), karim can now `POST /api/requests/{id}/decide` (6.34) — without it (after 14.30) → 401 |

### PUT /api/users/{id}/roles — wizard step 2 / Apply Role Preset

```json
{ "rolePreset": "Front Desk Lead" }
```
by id: `{ "roleId": 5 }` · clear: `{}` (both null).

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.36 | hrm | `{"rolePreset": "Front Desk Lead"}` (14.10's role) | 200 `{ data }` — `roleId` set; user's `effectivePermissions` now include the role bundle |
| 14.37 | hrm | `{"roleId": <real id>}` | 200 same effect by id |
| 14.38 | hrm | `{"rolePreset": "No Such Role"}` | 400/404 unknown preset — record actual |
| 14.39 | hrm | `{"roleId": 999999}` | 404 unknown role |
| 14.40 | hrm | `{}` | 200 — clears the role (`roleId: null`) |
| 14.41 | hrm | unknown user id | 404 |
| 14.42 | emp | — | 401 |

### PUT /api/users/{id}/gym-access — wizard step 3

```json
{ "gymIds": [1] }
```
by names (hire-wizard style): `{ "gyms": ["Revive Gym - Main"] }` · revoke all: `{}`.

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.43 | hrm | `{"gymIds": [1, 2]}` on karim | 200 `{ data }` — `gymIds` echoed; karim can now log in on both gyms and switch-gym works (0.25) |
| 14.44 | hrm | `{"gyms": ["<gym1 name>"]}` | 200 — name addressing works identically |
| 14.45 | hrm | `{"gymIds": [999]}` | 400 unknown gym |
| 14.46 | hrm | `{}` | 200 — **revokes all**: user's `gymIds` empty; karim's next `POST /api/requests`/directory call → 401 (restore with 14.43!) |
| 14.47 | hrm | unknown user id | 404 |
| 14.48 | emp | — | 401 |

---

### Wizard end-to-end acceptance

| # | Actor | Input | Expected |
|---|---|---|---|
| 14.49 | hrm | Create employee via 2.13 → assign role 14.36 → gym access 14.43 → permissions 14.28, then log in as that employee | login 200; `GET /api/me` `featureLevels` shows the granted features; `GET /api/requests` 200; revoke via 14.30/14.40 → the same call 401 |
| 14.50 | hrm | — | After every assignment change, `GET /api/users/{id}` (13.21) and the dashboard cards (01) agree with the new effective access |
