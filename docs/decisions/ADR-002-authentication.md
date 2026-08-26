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

## Consequences
- Page refresh requires a refresh token call to get a new access token
- Logout must invalidate the refresh token server-side
- The API must handle concurrent refresh requests gracefully (race condition)

## Open Questions
- Exact access token lifetime (15 min vs 30 min)
- Maximum concurrent sessions per user
- Failed login lockout policy (5 attempts → lock for 15 min?)
