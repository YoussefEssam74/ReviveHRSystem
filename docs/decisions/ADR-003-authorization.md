# ADR-003: Authorization Model

## Status
**Accepted**

**Amended 2026-10-10** — Amendment 1 (below): per-gym **feature × level** grants and scope-from-role supersede the "team scope via distinct `.team` keys" mechanism in the original text. The granular-permission and gym-scope principles remain.

## Decision
**Granular Permission + Gym Access Scope**

The authorization model is: `User Type → Role → Permissions → Gym Access`

### Permission Model
- Permissions are **granular, per-feature** (e.g., `employees.create`, `attendance.edit`)
- Roles are **permission presets** — shortcuts to apply a bundle of permissions
- The source of truth is always the **individual user's permission set**, not the role label
- Two users with the same role CAN have different effective permissions (individual overrides)

### Gym Access Model
- Every user has an explicit list of accessible gyms (`UserGymAccess` table)
- Every data query is filtered by the user's gym access scope
- A user can perform an action only when:
  1. They hold the required permission AND
  2. The target data belongs to a gym in their access scope

### Effective Authorization Calculation
```
EffectivePermissions(user) =
    Union(RolePermissions for each role the user has)
    + UserPermissions (individual grants)

CanPerform(user, action, gymId) =
    action IN EffectivePermissions(user)
    AND gymId IN UserGymAccess(user)
```

### Third Dimension: Team Scope (Team Leader)

Team Leader introduces a permission scope narrower than gym: a subset of
employees within one gym (`Employees.TeamId`, see database.md). Rather than add
conditional logic to existing gym-scoped permissions, **team-scoped
permissions are distinct permission keys** (e.g. `attendance.view.team`
alongside the existing gym-wide `attendance.view`). This keeps the
existing two-dimension check untouched for every other user type, and
adds one additional scope check only for permissions that are
team-scoped by nature:

```
CanPerform(user, action, gymId, targetEmployeeId?) =
    action IN EffectivePermissions(user)
    AND gymId IN UserGymAccess(user)
    AND (
          action is NOT a team-scoped permission
          OR targetEmployeeId IN Employees(TeamId = user's assigned team)
        )
```

The leader's scope is the single `Team` assigned to their employee record.
`TeamLeaders` marks which employees are leaders of their assigned team.

**Team-scoped permissions are granted individually, same as every other
permission** — being a Team Leader does not automatically grant them.
In particular, `requests.approve.team` is commonly reserved for Branch
Manager or HR rather than Team Leader; whether a given Team Leader can
approve requests for their own team depends entirely on whether that
specific permission was granted to them. This is consistent with the
existing "granular over hierarchical" principle: the Team Leader role
preset is a convenience bundle, not an implied capability set.

### UI Impact
- Navigation items render only if the user holds the gating permission
- Action buttons on pages render only if the user holds the specific permission
- Two HR users looking at the same page can see different buttons

## Why
- The business requires that two HR users at different gyms have completely different capabilities
- Fixed role-based tiers (e.g., "HR can do X, Y, Z") are too rigid
- Gym-scope isolation is a hard security requirement

## Consequences
- Permission checks must happen at the service layer, not just the UI
- Every API endpoint must validate both permission and gym scope
- The permission catalog must be seeded and versioned carefully
- Frontend must load the user's permission set and gym access on login

---

## Amendment 1 — 2026-10-10: Per-gym feature × level grants; scope from role

**Context.** Product review of the Employee Portal mock
(`Mock UI/Employee/`) produced two requirements the original model could
not express:

1. **Every feature needs its own access control** — HR may grant an
   employee access to a feature in gym A while the same employee has no
   access to that feature in gym B. Access is therefore per (user,
   feature, gym), not global.
2. **Each feature has exactly three access levels** — none, view-only,
   edit — and the Team Leader must have **the same capabilities as the
   Branch Manager**, limited to his team.

**Decisions:**

1. **Feature = UI area.** The `Permission` table becomes the feature
   catalog: `Key` = feature code (`employees`, `attendance`,
   `schedule`, `requests`, `payroll`, `evaluations`, `recruitment`,
   `offboarding`, `documents`, `reports`, `announcements`, `audit`),
   `Area` = module. Fine-grained keys from the mock UI (e.g.
   `employees.create`, `attendance.edit`) collapse into
   (feature, level): every write key maps to `Edit`.
2. **Three levels.** `AccessLevel { None = 0, View = 1, Edit = 2 }`.
   Read endpoints and page visibility require `View`; create/edit/
   delete/assign/approve/publish/offboard require `Edit`. Edit implies
   View. Super Admin keeps the `*` wildcard bypass.
3. **Grants are per gym.** Two mechanisms, both per gym:
   - `UserGymRole (UserId, GymId, RoleId)` — a role assigned **for one
     gym** ("Branch Manager at gym A, Team Leader at gym B").
   - `UserGymPermission (UserId, GymId, PermissionId, Level)` — an
     individual per-gym grant that **overrides** the role bundle.
   Role bundles carry levels (`RolePermission.Level`); global grants
   (`UserPermission.Level`) remain for TopManagement/HR Manager profiles
   that operate across gyms.
4. **Effective level** for (user, feature, activeGym): Super Admin `*` →
   `Edit`; else per-gym individual grant (authoritative when a row
   exists) → per-gym role bundle → global grant → `None`.
5. **Scope comes from the per-gym role, never from the request.** A
   Branch Manager bundle ⇒ gym scope; a Team Leader bundle ⇒ team scope
   (the leader's `TeamLeaders` row **in the active gym**; teams never
   span gyms); no role ⇒ own data only. Individual grants change the
   level, never the scope. This replaces the distinct-team-key mechanism
   from the original text: `attendance.view.team` and friends remain in
   the mock UI's vocabulary for traceability, but the check is
   (feature, level) + resolved scope.
6. **Team Leader = Branch Manager capability parity.** Both presets hold
   identical feature levels; the only difference is the resolved scope
   (team vs gym). Being a Team Leader no longer implies fewer features.
7. **Enforcement.** APIs apply a `[HasFeatureAccess(feature, level)]`
   policy; the service layer re-checks permission + gym + team scope per
   request (the original "checks at the service layer" rule is retained).
   The SPA receives the effective map for the active gym from
   `GET /api/me` (and on gym switch) and gates navigation/actions on it.

**Consequences.** HR needs an access-management UI (assign per-gym role,
tweak feature levels) — currently planned as part of the HR portal.
Seeding must version the feature catalog and preset bundles carefully.
Endpoint authorization tests must cover the matrix (View/Edit/None ×
team/gym/own) per gym.
