# ADR-004: Biometric Attendance Integration

## Status
**Amended 2026-10-07** — the per-device `DeviceToken`/`deviceId` model was replaced by a
**6-digit station code** (see "Station Credential"): a broken device must never be able
to break the integration, so no device-bound secret exists anywhere in the flow.

## Context
Attendance check-in/check-out should use Face ID biometric devices installed at each gym. When Face ID fails, manual entry is required by whoever is at the computer.

## Decision
**Integration Boundary Pattern + Per-Gym 6-Digit Station Code**

### Station Credential (replaces the former DeviceToken design)
```
Attendance Station (any PC at the gym)
    ↓ (station login + every attendance request — body carries ONLY the 6-digit code)
Resolve GymId from the code (StationCodes table, one active code per gym)
    ↓
Attendance Domain Event (vendor-agnostic): { EmployeeId, GymId, Timestamp }
    ↓
AttendanceService.RecordCheckIn/CheckOut()
    ↓
Cross-Gym Validation (see below) → Schedule Comparison → Status Determination
```

### Key Principles
1. **Vendor Isolation**: The attendance domain does NOT depend on any specific Face ID vendor
2. **Adapter Pattern**: A thin adapter translates vendor-specific events into domain events
3. **Manual Fallback**: When Face ID fails, the system provides a manual check-in/check-out form, scoped to whichever gym the operator's terminal belongs to
4. **Method Tracking**: Each attendance record stores the method (Biometric vs Manual)
5. **Gym-Anchored Station Code**: every gym holds exactly one active 6-digit
   `StationCode` (`StationCodes` table). Stations log in with the code
   (`POST /api/kiosk/login`) and repeat it on every attendance request; the system
   resolves the gym from the code. There is deliberately **no deviceId and no device
   token** — replacing broken hardware only requires re-entering the same code, so a
   hardware failure can never invalidate the integration. HR rotates the code from the
   gym's station-code endpoint; rotation immediately invalidates the old code.
   (`BiometricDevices.DeviceToken` remains in the schema but is no longer used to
   authenticate any endpoint in this flow.)

### Cross-Gym Check-In Validation (critical)

An employee can be assigned to **up to two gyms** at once
(`UserGymAccess`). Without a validation rule, someone could physically
walk into a gym they're not scheduled to work at and pick up an
attendance record there. Every check-in/check-out event — biometric or
manual — is validated as follows, against the gym the EVENT came from
(not any other gym the employee happens to also have access to):

```
Event arrives → GymId resolved from the 6-digit station code
    ↓
1. Does the employee have UserGymAccess to this GymId?
    → No  → REJECT (403 CROSS_GYM_ACCESS_DENIED). No AttendanceRecord created.
    ↓ Yes
2. Does the employee have a ShiftAssignment (real shift, not a day off) at THIS GymId for today's date?
    → No shift anywhere today     → REJECT (404 SCHEDULED_DAY_OFF)
    → Shift at a different branch → REJECT (403 WRONG_BRANCH_SCHEDULE)
    ↓ Yes
→ ACCEPT. Record AttendanceRecord against this GymId, evaluate vs. this shift.
```

This means an employee assigned to Gym A and Gym B who is scheduled to
work at Gym A today gets **rejected** if scanned at Gym B's device that
day, even though he technically has `UserGymAccess` to both — access
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
- **Employee Enrollment**: How are employees registered on the Face ID device? (separate process or integrated?) — note this is enrollment on the DEVICE (so it can recognize the face), a separate concern from the device's own `DeviceToken` gym registration in the system.
- **Offline Handling**: What happens if the device loses network connectivity?
- **Rejected-event visibility**: should a rejected check-in (wrong gym / no shift today) surface anything to the employee at the device (e.g. an on-screen message), or fail silently from the employee's perspective with only an HR-side log entry? Recommend at minimum an Event (features.md §18) so HR can see repeated mismatches (e.g. a shift wasn't published correctly).

## Consequences
- The integration adapter is the ONLY code that knows the vendor's API
- Switching vendors requires only a new adapter, not domain changes
- MVP can start with manual-only attendance if the device isn't ready
- The attendance domain works identically regardless of check-in method
