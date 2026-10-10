# Implemented API Contract

This document describes the endpoints currently implemented by the backend. The UI endpoint inventory in [api-spec-from-ui.md](./api-spec-from-ui.md) is a product roadmap; entries there are not live unless they also appear below and in generated OpenAPI.

## Conventions

- Base path: /api; requests and responses use JSON.
- Successful responses return the endpoint DTO directly (there is no data wrapper).
- Errors returned by the exception middleware use { statusCode, errorMessage, errors }. errorMessage is the human-readable message; errors is an array of strings carrying extra per-field detail when a BadRequestException supplies it (empty otherwise).
- Invalid request bodies return 400 with { statusCode: 400, errorMessage, validationErrors } where validationErrors is an array of { field, errors[] }; rate limits return 429 with RATE_LIMITED. Unexpected errors return a generic 500 body.
- Cross-origin browser calls are off by default: an empty Cors:AllowedOrigins yields no CORS headers (same-origin deployments and the Vite dev proxy are unaffected). Populating the list enables the SPA to call the API from another origin.
- Requests are cancellation-aware through controller, service, repository, and save operations.

## Authentication

### POST /api/auth/login

Request: { email, password }.

A completed session returns 200 with accessToken, expiresInSeconds, requiresGymSelection=false, and user. A multi-gym employee instead receives requiresGymSelection=true, gyms, and tempSessionToken; fields for the completed session are omitted. Invalid, unknown, and disabled accounts all return 401 with errorMessage "Invalid email or password.".

### POST /api/auth/login/select-gym

Request: { gymId, tempSessionToken }. Returns the completed session shape above; the token must be valid and the user must have access to the selected gym. Possible errors: 400, 401, or 429.

## Attendance station

Kiosk enrollment is public and rate-limited. `POST /api/kiosk/login` redeems the gym's current six-digit enrollment code - codes are generated server-side (never hardcoded; fetch or rotate them via GET/POST /api/gyms/{gymId}/station-codes) and expire after `StationCode:ExpirationMinutes` (5 minutes). A successful redemption creates a DB-backed station session, returns an opaque session token shown exactly once, and sets that token as an HttpOnly `StationSession` cookie (SameSite=Lax, Secure on HTTPS, Path=/, expiring with the session) - browser kiosks authenticate with the cookie alone and the React SPA never reads or stores the token, while non-browser clients use the `X-Station-Token` header. `GET /api/kiosk/session` restores an enrolled kiosk (401 = not enrolled) and `POST /api/kiosk/logout` revokes the session and clears the cookie; because SameSite=Lax cookies are sent only same-site, production must serve the SPA and API from one site (dev Vite proxy; reverse proxy otherwise) with CORS on explicit origins + credentials. Every subsequent attendance request presents that token via cookie or header (never a station code in the body); the server validates the session (hash lookup, not revoked, not expired, gym active) and derives the GymId from the stored session - never from client input. Attendance records store GymId plus the StationSessionId that issued them.

### POST /api/kiosk/login

Request: { code: "<six-digit enrollment code>" }. Returns 200 { gymId, gymName, token, sessionExpiresAtUtc } and sets the `StationSession` HttpOnly cookie; the token field remains for non-browser clients and is also accepted as `X-Station-Token: <token>`. Unknown, rotated, or expired code: 401 with errorMessage "Invalid or expired station code."; malformed code: 400.

### GET /api/kiosk/session

Restores the kiosk from the `StationSession` cookie or `X-Station-Token` header. Returns 200 { gymId, gymName, sessionExpiresAtUtc } for a live session; 401 when there is no valid session - the station must re-enroll with a code.

### POST /api/kiosk/logout

Revokes the presented session (cookie or header), clears the `StationSession` cookie, and always returns 204, even for an already-invalid session, so a stale cookie can always be removed.

### POST /api/attendance/events

Authenticated with `X-Station-Token` (station session) or a gym-scoped Bearer token. Request fields: employeeId, type (IN or OUT; CHECKIN/CHECKOUT aliases are accepted, and AUTO lets the server pick the direction from the employee's own state - what the always-on kiosk camera sends), livenessScore (0-1, at least 0.70), and optional ISO 8601 timestamp. If omitted, server time is used. Timestamps without an offset are interpreted as UTC. Shift comparisons use the explicitly configured Attendance:TimeZoneId (Africa/Cairo in appsettings), not the host machine timezone. The liveness score must be produced by a trusted biometric verifier; a caller-provided score alone is not biometric proof.

Returns 201 with { recordId, employeeId, employeeName, gymId, gymName, type, method, timestamp, attendanceStatus, shiftComparison }; timestamp is UTC. attendanceStatus reports the persisted status (ONTIME, LATE, or EARLYCHECKOUT). Common errors: 400 validation, type, liveness, future timestamp, or duplicate/invalid attendance transition; 401 expired/revoked/missing station session or gym binding, or gym/schedule mismatch; 404 employee or shift not found; and 429 rate limited.

### POST /api/attendance/manual

Authenticated with `X-Station-Token` (or a gym-scoped Bearer token). Same event fields except no liveness score and with a required reason (3-500 characters); the reason is audited with the attendance change in one database transaction, together with the issuing StationSessionId.

### GET /api/attendance/station-summary

Authenticated with `X-Station-Token` (station session) or a gym-scoped Bearer token. Today's counters and the most recent events for the station's gym - the kiosk dashboard data. Returns 200 { presentCount, scheduledTodayCount, records: [{ recordId, employeeId, employeeName, status (PRESENT/LEFT/DAY_OFF), lastEventType, lastEventTime, attendanceStatus, method }] }. 401 without a valid, gym-bound credential.

### DELETE /api/gyms/{gymId}/station-sessions

Requires a Bearer access token (TopManagement, or HR assigned to the gym). Revokes every live station session for the gym - enrolled kiosks fall back to the enrollment screen and must redeem a fresh code. Enrollment codes themselves are untouched. Returns 200 { revokedCount }.

## Station-code management

Routes require a Bearer access token. TopManagement can manage codes for any gym. HR can manage codes only for gyms assigned to them. Employees and other users are denied even if they have gym access.

### GET /api/gyms/{gymId}/station-codes

Returns 200 { gymId, gymName, code, generatedAt, expiresAtUtc, generatedBy }. `expiresAtUtc` is when the code stops being accepted (`StationCode:ExpirationMinutes` after rotation; null for development seeds). Inactive gyms return 400; if no code is active, returns 404.

### POST /api/gyms/{gymId}/station-codes

Rotates the code and immediately invalidates the old code - live station sessions keep working until they expire or are revoked. Returns 200 with the same DTO. Possible errors: 400 (inactive gym, validation, or unique-code failure), 401, or 404 (gym not found).

## Face biometrics

Recognition runs in-process inside the API (YuNet detection → Silent-Face anti-spoofing → SFace embedding, all ONNX); there is no external biometric service.

### POST /api/attendance/face-scan

Station-authenticated (`X-Station-Token`, or a gym-scoped Bearer token with the same gym binding as `/events`). Request: { type (IN/OUT/AUTO), image (base64 or data URL), optional timestamp, optional confirmCheckout } - no station code in the body. The frame is detected, liveness-checked and matched against employees with access to the station's gym only; a recognized face is then recorded through the exact `/events` pipeline, so every ADR-004 check applies.

**Every frame-level state is a 200 with an `outcome` discriminator** - 400 is reserved for a frame that cannot be decoded as an image, and 401 for a missing/invalid station session. This lets the station drive a live HUD (liveness percentage, matched name and ID) and tell a silent outcome from one that deserves a card:

| outcome | meaning | kiosk behaviour |
| --- | --- | --- |
| `no_face` | nothing detected in the frame | keep scanning, no card |
| `low_liveness` | face detected, below `Biometrics:ScanLivenessThreshold` (0.70) | keep scanning, no card; `livenessScore` carries the measured value |
| `unrecognized` | live face, no match above `MatchThreshold` (0.50) | keep scanning, no card |
| `already_complete` | recognized, but the day is already closed | **silent** - name/ID in the HUD, no card, loop keeps running |
| `rejected` | recognized but refused (day off, wrong branch, ...) | rejection card; `message` explains why |
| `recorded` | punch written (HTTP **201**) | success card; `attendance` carries it |
| `pending_checkout` | AUTO resolved to check-out; nothing recorded | "Check out now?" prompt |

`employeeId`/`employeeName` are set whenever a face was recognized; `livenessScore` and `similarity` are set on every frame where they were measured. Errors: 400 (undecodable image only), 401 (missing/invalid station session), 429.

**AUTO check-out confirmation**: an AUTO scan that would close the employee's open record returns `pending_checkout` (nothing recorded) unless the request carries `confirmCheckout: true`. The kiosk asks the employee ("check out now?") and re-sends the same frame with the flag; only then is the check-out written. Explicit IN/OUT types and the `/events` integration endpoint (which always passes confirmCheckout=true internally) are never gated.

The liveness score reported here is measured server-side by the anti-spoofing ensemble — unlike `/events`, where a caller-supplied score is trusted only as far as the 0.70 minimum (see the note on that endpoint).

### POST /api/employees/face/enroll

HR-side administration. Requires a Bearer access token; TopManagement may enroll any employee, HR only employees at gyms they are assigned to. Station tokens and employee sessions are rejected with 401. Request: { employeeNumber, image }. One embedding is stored per employee — re-enrolling replaces it. Enrollment liveness must be at least `Biometrics:LivenessThreshold` (0.60 by default). Returns 201 with { employeeId, employeeNumber, fullName, enrolledAt }; 400 (bad image, no face, failed liveness), 401 (role/gym denied), 404 (unknown employee).

### DELETE /api/employees/face/{employeeReference}

Removes the employee's stored embedding. Same authorization as enrollment. Returns 204, or 404 when no embedding exists.

## OpenAPI

The generated OpenAPI document is available at /swagger/v1/swagger.json in Development. Controller response metadata lists success and expected error statuses; DTO source files define request validation and response fields.
