# ADR-003: Authorization Model

## Status
**Accepted**

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
employees within one gym (`TeamMembers`, see database.md). Rather than add
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
          OR targetEmployeeId IN TeamMembers(AllTeamsLedBy(user))
        )
```

`AllTeamsLedBy(user)` is the union of every `Team` where the user appears
in `TeamLeaders` — a leader may lead multiple teams, and their effective
team scope is the union of all their teams' members.

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
- Gym-scoped isolation is a hard security requirement

## Consequences
- Permission checks must happen at the service layer, not just the UI
- Every API endpoint must validate both permission and gym scope
- The permission catalog must be seeded and versioned carefully
- Frontend must load the user's permission set and gym access on login
