# ADR-002: Authentication Strategy

## Status
**Proposed** — needs confirmation before implementation

## Context
The system needs secure authentication for multiple user types (Top Management, HR, Branch Manager, Employee) accessing the same web application. Deployed on-premises.

## Decision
**JWT Access Token + Refresh Token**

### Access Token
- Short-lived (15–30 minutes)
- Contains: userId, userType, email
- Does NOT contain permissions (too many, token would be huge)
- Permissions are loaded server-side on each request from cache

### Refresh Token
- Longer-lived (7 days)
- Rotated on each use (old token invalidated)
- Stored server-side in database for validation and revocation

### Token Storage (Frontend)
- Access token: kept in memory (not localStorage, not sessionStorage)
- Refresh token: HttpOnly Secure cookie (prevents XSS access)

## Why
- Memory-only access tokens prevent XSS theft
- HttpOnly cookies for refresh tokens prevent JavaScript access
- Token rotation detects stolen refresh tokens
- Server-side refresh token storage enables forced logout / session revocation

## Login-Time Gym Selection (Employees with 2 Gyms)

Most users (Top Management, HR, HR Manager) authenticate once and operate
across their full `UserGymAccess` scope within a session, switching gyms
via the in-app Gym Context Switcher.

Employees are a deliberate exception: an Employee normally has one
`UserGymAccess` row, but may have two (genuinely working shifts across two
physical gyms). The login flow changes for this case only:

```
POST /api/auth/login  (email, password)
    → credentials validated
    → system checks UserGymAccess count for this user
        1 gym  → proceed normally, issue tokens scoped to that gym
        2 gyms → return { requiresGymSelection: true, gyms: [...] }
    → Frontend shows a gym picker screen
    → User selects a gym
    → POST /api/auth/login/select-gym (gymId, tempSessionToken)
    → System issues access + refresh tokens scoped to the CHOSEN gym only
```

The resulting session (and JWT) is scoped to a single gym for that
login. Switching to the other gym requires logging out and back in and
choosing differently — there is no in-session gym switch for Employees
(unlike HR/Top Management, who use the in-app switcher without
re-authenticating). This keeps gym-scope enforcement simple: an
Employee's session always maps to exactly one active gym.

## Consequences
- Page refresh requires a refresh token call to get a new access token
- Logout must invalidate the refresh token server-side
- The API must handle concurrent refresh requests gracefully (race condition)
- Employee logins require an extra UserGymAccess-count check and, when
  count = 2, an extra gym-selection round trip before tokens are issued

## Open Questions
- Exact access token lifetime (15 min vs 30 min)
- Maximum concurrent sessions per user
- Failed login lockout policy (5 attempts → lock for 15 min?)
