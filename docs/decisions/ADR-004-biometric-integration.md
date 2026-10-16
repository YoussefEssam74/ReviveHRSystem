# ADR-004: Biometric Attendance Integration

## Status
**Amended 2026-10-07** â€” the per-device `DeviceToken`/`deviceId` model was replaced by a
**6-digit station code** (see "Station Credential"): a broken device must never be able
to break the integration, so no device-bound secret exists anywhere in the flow.

**Amended 2026-10-10 (station sessions)** - the 6-digit station code is now an
**enrollment** credential: redeeming it once at `POST /api/kiosk/login` mints an
**opaque, DB-backed station session** (`StationSessions`), and every attendance request
authenticates with that session via the `X-Station-Token` header. GymId is read from the
validated session record - never from the request body - and every attendance record
stores both `GymId` and the `StationSessionId` that issued it.

## ContextAttendance check-in/check-out should use Face ID biometric devices installed at each gym. When Face ID fails, manual entry is required by whoever is at the computer.

## Decision
**Integration Boundary Pattern + Per-Gym 6-Digit Station Code**

### Station Credential (enrollment code + DB-backed session)
```
Attendance Station (any PC at the gym)
    -> POST /api/kiosk/login  { code }           (public, rate limited per IP)
Validate code: active AND not expired (StationCodes, one active code per gym)
    -> mint opaque session token (shown once) + persist only its SHA-256 hash
Every attendance request
    -> X-Station-Token: <session token>         (no station code in the body)
Validate session: hash lookup, not revoked, not expired, gym active
    -> GymId comes from the session record - never from client input
    ->
Attendance Domain Event (vendor-agnostic): { EmployeeId, GymId, Timestamp }
    ->
AttendanceService.RecordCheckIn/CheckOut()     (stores StationSessionId + GymId)
    ->
Cross-Gym Validation (see below) -> Schedule Comparison -> Status Determination
```

### Key Principles
1. **Vendor Isolation**: The attendance domain does NOT depend on any specific Face ID vendor
2. **Adapter Pattern**: A thin adapter translates vendor-specific events into domain events
3. **Manual Fallback**: When Face ID fails, the system provides a manual check-in/check-out form, scoped to whichever gym the operator's terminal belongs to
4. **Method Tracking**: Each attendance record stores the method (Biometric vs Manual)
5. **Gym-Anchored Station Credential**: every gym holds exactly one active 6-digit
   `StationCode` (`StationCodes` table), valid for `StationCode:ExpirationMinutes`
   (5 minutes by default) from the moment HR rotates it. Redeeming that code once at
   `POST /api/kiosk/login` creates a `StationSession` and returns an opaque,
   cryptographically random **session token** - only its SHA-256 hash is stored, and
   the plaintext is shown exactly once and is also set as an HttpOnly `StationSession` cookie (SameSite=Lax, Secure on HTTPS, Path=/) so a rebooted browser kiosk reattaches without re-enrolling; the SPA restores via `GET /api/kiosk/session` and disconnects via `POST /api/kiosk/logout`. Attendance requests present the token via that cookie or the `X-Station-Token` header for non-browser clients; no station code appears in any attendance request body,
   and the GymId is always derived from the validated session, so no client-supplied
   value can influence the gym binding. There is deliberately **no deviceId, no device
   token, no MAC or IP binding** - replacing broken hardware only requires redeeming a
   fresh code, so a hardware failure can never invalidate the integration. Sessions live
   for `StationSession:LifetimeHours` (720 = 30 days), can be revoked by HR (which does
   not touch the codes), and expire on their own. Rotating a code invalidates it only for
   *new* enrollments - stations already enrolled keep working until their session expires
   or is revoked. Every `AttendanceRecord` stores `GymId` plus the `StationSessionId`
   that issued it (the audit trail of "where was attendance taken"), and the plaintext
   code is never stored on a record.
   (`BiometricDevices.DeviceToken` remains in the schema but is no longer used to
   authenticate any endpoint in this flow.)

### Cross-Gym Check-In Validation (critical)

An employee can be assigned to **up to two gyms** at once
(`UserGymAccess`). Without a validation rule, someone could physically
walk into a gym they're not scheduled to work at and pick up an
attendance record there. Every check-in/check-out event â€” biometric or
manual â€” is validated as follows, against the gym the EVENT came from
(not any other gym the employee happens to also have access to):

```
Event arrives â†’ GymId resolved from the validated station session
    â†“
1. Does the employee have UserGymAccess to this GymId?
    â†’ No  â†’ REJECT (403 CROSS_GYM_ACCESS_DENIED). No AttendanceRecord created.
    â†“ Yes
2. Does the employee have a ShiftAssignment (real shift, not a day off) at THIS GymId for today's date?
    â†’ No shift anywhere today     â†’ REJECT (404 SCHEDULED_DAY_OFF)
    â†’ Shift at a different branch â†’ REJECT (403 WRONG_BRANCH_SCHEDULE)
    â†“ Yes
â†’ ACCEPT. Record AttendanceRecord against this GymId, evaluate vs. this shift.
```

This means an employee assigned to Gym A and Gym B who is scheduled to
work at Gym A today gets **rejected** if scanned at Gym B's device that
day, even though he technically has `UserGymAccess` to both â€” access
alone is not sufficient, the day's actual schedule decides which single
gym a check-in can land against.

### Manual Entry Flow
- Computer operator at the gym can manually enter check-in/check-out
- Requires: employee selection, time, reason for manual entry
- Logged as `Method = Manual` in the attendance record
- Does NOT require `attendance.edit` permission (that's for corrections)
- Requires a separate `attendance.manual_entry` permission (or similar)

## Open Questions
- **Vendor**: Which Face ID device brand/model will be used?
- **Protocol**: Does the device push events via API, or does the system poll?
- **Employee Enrollment**: How are employees registered on the Face ID device? (separate process or integrated?) â€” note this is enrollment on the DEVICE (so it can recognize the face), a separate concern from the device's own `DeviceToken` gym registration in the system.
- **Offline Handling**: What happens if the device loses network connectivity?
- **Rejected-event visibility**: should a rejected check-in (wrong gym / no shift today) surface anything to the employee at the device (e.g. an on-screen message), or fail silently from the employee's perspective with only an HR-side log entry? Recommend at minimum an Event (features.md Â§18) so HR can see repeated mismatches (e.g. a shift wasn't published correctly).

## Consequences
- The integration adapter is the ONLY code that knows the vendor's API
- Switching vendors requires only a new adapter, not domain changes
- MVP can start with manual-only attendance if the device isn't ready
- The attendance domain works identically regardless of check-in method
