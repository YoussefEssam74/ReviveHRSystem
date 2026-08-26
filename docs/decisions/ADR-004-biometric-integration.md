# ADR-004: Biometric Attendance Integration

## Status
**Proposed** — vendor not yet confirmed

## Context
Attendance check-in/check-out should use Face ID biometric devices installed at each gym. When Face ID fails, manual entry is required by whoever is at the computer.

## Decision
**Integration Boundary Pattern**

### Architecture
```
Biometric Device (Face ID)
    ↓ (push event or poll)
Integration Adapter (vendor-specific)
    ↓
Attendance Domain Event (vendor-agnostic)
    ↓
AttendanceService.RecordCheckIn/CheckOut()
    ↓
Schedule Comparison → Status Determination
```

### Key Principles
1. **Vendor Isolation**: The attendance domain does NOT depend on any specific Face ID vendor
2. **Adapter Pattern**: A thin adapter translates vendor-specific events into domain events
3. **Manual Fallback**: When Face ID fails, the system provides a manual check-in/check-out form
4. **Method Tracking**: Each attendance record stores the method (Biometric vs Manual)

### Manual Entry Flow
- Computer operator at the gym can manually enter check-in/check-out
- Requires: employee selection, time, reason for manual entry
- Logged as `Method = Manual` in the attendance record
- Does NOT require `attendance.edit` permission (that's for corrections)
- Requires a separate `attendance.manual_entry` permission (or similar)

## Open Questions
- **Vendor**: Which Face ID device brand/model will be used?
- **Protocol**: Does the device push events via API, or does the system poll?
- **Employee Enrollment**: How are employees registered on the Face ID device? (separate process or integrated?)
- **Offline Handling**: What happens if the device loses network connectivity?

## Consequences
- The integration adapter is the ONLY code that knows the vendor's API
- Switching vendors requires only a new adapter, not domain changes
- MVP can start with manual-only attendance if the device isn't ready
- The attendance domain works identically regardless of check-in method
