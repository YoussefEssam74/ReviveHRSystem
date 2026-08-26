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
