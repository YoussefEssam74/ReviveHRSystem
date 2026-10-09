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

All station endpoints are rate-limited. Each attendance request must include the current six-digit station code — codes are generated server-side (never hardcoded; fetch via GET /api/gyms/{gymId}/station-codes) — plus the gym-bound station token returned by the kiosk login. The code resolves the gym server-side; no user JWT or device token is used.

### POST /api/kiosk/login

Request: { code: "<six-digit station code>" }. Returns 200 { gymId, gymName, token }, where token is a gym-bound station JWT that must be sent as `Authorization: Bearer <token>` on subsequent attendance requests. Invalid code: 401 with errorMessage "Invalid or expired station code."; malformed code: 400.

### POST /api/attendance/events

Request fields: code, employeeId, type (IN or OUT; legacy check-in/out aliases are accepted), livenessScore (0–1, at least 0.70), and optional ISO 8601 timestamp. If omitted, server time is used. Timestamps without an offset are interpreted as UTC. Shift comparisons use the explicitly configured Attendance:TimeZoneId (Africa/Cairo in appsettings), not the host machine timezone. The liveness score must be produced by a trusted biometric verifier; a caller-provided score alone is not biometric proof.

Returns 201 with { recordId, employeeId, employeeName, gymId, gymName, type, method, timestamp, attendanceStatus, shiftComparison }; timestamp is UTC. attendanceStatus reports the persisted status (ONTIME, LATE, or EARLYCHECKOUT). Common errors: 400 validation, type, liveness, future timestamp, or duplicate/invalid attendance transition; 401 invalid station code, missing/mismatched station token, or gym/schedule mismatch; 404 employee or shift not found; and 429 rate limited.

### POST /api/attendance/manual

Same event fields except no liveness score; reason is required (3–500 characters) and audited with the attendance change in one database transaction. Returns the same 201 response with method=Manual. If recording the attendance or its audit entry fails, both changes roll back.

## Station-code management

Routes require a Bearer access token. TopManagement can manage codes for any gym. HR can manage codes only for gyms assigned to them. Employees and other users are denied even if they have gym access.

### GET /api/gyms/{gymId}/station-codes

Returns 200 { gymId, gymName, code, generatedAt, generatedBy }. Inactive gyms return 400; if no code is active, returns 404.

### POST /api/gyms/{gymId}/station-codes

Rotates the code and immediately invalidates the old code. Returns 200 with the same DTO. Possible errors: 400 (inactive gym, validation, or unique-code failure), 401, or 404 (gym not found).

## Face biometrics

Recognition runs in-process inside the API (YuNet detection → Silent-Face anti-spoofing → SFace embedding, all ONNX); there is no external biometric service.

### POST /api/attendance/face-scan

Station-authenticated (Bearer station token, same gym binding as `/events`). Request: { code, type (IN/OUT), image (base64 or data URL), optional timestamp }. The frame is detected, liveness-checked and matched against employees with access to the station's gym only; a recognized face is then recorded through the exact `/events` pipeline, so every ADR-004 check applies. Returns 201 with the attendance response plus { similarity, livenessScore }. Errors: 400 (undecodable image, no face, failed liveness, unrecognized face), 401 (station token/gym mismatch), 429.

The liveness score reported here is measured server-side by the anti-spoofing ensemble — unlike `/events`, where a caller-supplied score is trusted only as far as the 0.70 minimum (see the note on that endpoint).

### POST /api/employees/face/enroll

HR-side administration. Requires a Bearer access token; TopManagement may enroll any employee, HR only employees at gyms they are assigned to. Station tokens and employee sessions are rejected with 401. Request: { employeeNumber, image }. One embedding is stored per employee — re-enrolling replaces it. Enrollment liveness must be at least `Biometrics:LivenessThreshold` (0.60 by default). Returns 201 with { employeeId, employeeNumber, fullName, enrolledAt }; 400 (bad image, no face, failed liveness), 401 (role/gym denied), 404 (unknown employee).

### DELETE /api/employees/face/{employeeReference}

Removes the employee's stored embedding. Same authorization as enrollment. Returns 204, or 404 when no embedding exists.

## OpenAPI

The generated OpenAPI document is available at /swagger/v1/swagger.json in Development. Controller response metadata lists success and expected error statuses; DTO source files define request validation and response fields.
