# ADR-002: Authentication Strategy

## Status
**Proposed** — needs confirmation before implementation
**Amended 2026-10-10** — see Amendment 1 (multi-gym, in-session switch, single account). Note: the access-token-only decision from `docs/progress.md` (refresh tokens removed, `RefreshTokens` table dropped) supersedes the Refresh Token section above.

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
- **Rotation grace window (60s):** re-presenting a token that was rotated moments
  ago is treated as a concurrent refresh from another tab, not as theft — the
  caller is refused but the chain is not revoked. Revoking on that race signed
  every tab out mid-session. A rotated token presented *outside* the window still
  trips reuse detection and revokes the whole chain.
- Access tokens are renewed silently on **every** authenticated call, binary
  downloads included: an expired access token never ends a session by itself.

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

---

## Amendment 1 — 2026-10-10: Multi-gym employees (N gyms), in-session switch, one account

**Context.** The original decision described the multi-gym case as "two
gyms" and prohibited an in-session gym switch for Employees. Product
review confirmed: gym assignments are **not capped at two** — an employee
can be assigned to 3+ gyms, and staff rotating across gyms need to change
the active gym without logging out. The backend already matched the new
requirement (`AuthService.LoginAsync` triggers the selection challenge at
`gymAccess.Count >= 2`; `UserGymAccess` is N:M) — only this ADR and the
roles guide described a 2-gym cap.

**Decisions:**

1. **Gym count is unbounded.** `POST /api/auth/login` returns
   `{ requiresGymSelection: true, gyms: [...] }` whenever the employee
   holds **≥ 2** active gyms (the response already carries the full gym
   list, so 3+ needs no contract change); a single-gym employee gets a
   token scoped to that gym. Login-time selection is the default flow.
2. **In-session gym switch is allowed for all user types**, including
   Employees: `POST /api/auth/switch-gym { gymId }` validates that the
   gym is in the caller's `UserGymAccess` and active, then returns a new
   access token scoped to that gym (same shape as `select-gym`). The
   gym claim in the token is authoritative; every API derives the active
   gym from the token (`ApiControllerBase.GetGymIdFromToken`), never from
   the request body. Gym switching does **not** grant cross-gym data:
   queries are always filtered to the active gym.
3. **One account per employee.** `User.EmployeeProfile` is 1:1 with
   `Employee`; `Employee.GymId` is the primary/contract gym, and
   additional working gyms are `UserGymAccess` rows — never a second
   employee account or a second login. Employment history, documents,
   leave balance and evaluations belong to the single employee record
   and follow the user across gym contexts.

**Consequences.** The SPA needs a gym switcher in the header for
employees (previously HR-only) and must refetch per-gym feature levels
on switch (`GET /api/me` semantics). Tokens stay short-lived; a stolen
switch-gym response only ever exposes one gym's data.

---

## Amendment 2 — 2026-11-09: Silent renewal is a session-level, cross-tab operation

**Context.** Users reported being signed out 15–30 minutes after sign-in — i.e.
exactly when the access token (15 min configured, 30 min default) expires. The
API was behaving as designed; the SPA was destroying the session. Three
client-side defects compounded:

1. The shared silent refresh (`tryRefreshSession`) inherited the `AbortSignal` of
   whichever request happened to trigger it. When that request was cancelled —
   dev StrictMode remounting query observers, a route change, or a page unload —
   the refresh `fetch` was aborted **after** the server had already rotated the
   credential. The rotated token was discarded.
2. Any `401`/`403` from `/api/auth/refresh` was treated as proof that the refresh
   credential was dead, so the client called `clearSession()` — wiping the shared
   `localStorage` session and bouncing every tab to `/login`. That is precisely
   the "rotation grace" answer the server gives for a *benign* re-presentation,
   which does **not** revoke the chain.
3. Two tabs refreshing at the same moment both presented the same refresh token;
   the loser received that same grace `401` and signed the user out. Measured at
   4 of 6 runs before the fix.

**Decisions (client only — the API contract below is unchanged):**

1. **The silent refresh is never bound to a caller's abort signal.** It runs under
   its own timeout and, because it mints the session's next credential and is
   shared by every waiting request, a cancelled request must never cancel it.
   The successful result is persisted even if the originating request is gone.
2. **Refreshes are serialised across tabs** with the Web Locks API
   (`navigator.locks`, lock name `revive.session.refresh`). A tab that waits for
   the lock re-reads storage first and adopts the winner's rotated session
   instead of presenting a spent token.
3. **A `401`/`403` from the refresh endpoint ends the session only if the
   presented credential is still the stored one.** Storage is re-read before that
   conclusion; a newer session written by a sibling tab is adopted and the
   request is retried with it.
4. The server keeps rotation, the 60-second rotation grace, and the
   single-live-chain sweep exactly as described above; nothing in this amendment
   weakens refresh-token reuse detection.

**Consequences.** No cancellation-driven path can discard a rotated credential or
clear the session any more, and concurrent tabs converge on one live chain.
Residual: if the browser loses the refresh response entirely (tab killed or a
full document unload while the request is in flight), the client cannot recover
the successor token without weakening reuse detection, and the user signs in
again. `Client/e2e/ui/session-expiry-renewal.spec.ts` covers the slow-renewal,
two-tab, and dead-credential cases.
