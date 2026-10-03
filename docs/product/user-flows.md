# User Flows

## 1. System Bootstrap (First-Time Setup)

```
System Deployed
    ↓
Default Super Admin account created (seeded)
    ↓
Super Admin logs in
    ↓
Creates first gym (Gym A)
    ↓
Creates HR user
    ↓
Assigns role + permissions to HR user
    ↓
Assigns Gym A access to HR user
    ↓
HR user can now log in and operate
```

---

## 1a. Employee Login (Single Gym vs Two Gyms)

```
Employee enters email + password
    ↓
Credentials validated
    ↓
System checks Employee's UserGymAccess count
    ↓
┌─────────────────────────────┬─────────────────────────────────────┐
│ 1 gym assigned              │ 2 gyms assigned                      │
│ → Session issued, scoped    │ → Gym picker screen shown             │
│   to that gym directly      │   ("Which gym are you signing in     │
│                             │    to today: Gym A / Gym B?")         │
│                             │ → Employee selects one                │
│                             │ → Session issued, scoped to the       │
│                             │   CHOSEN gym only                     │
└─────────────────────────────┴─────────────────────────────────────┘
    ↓
Employee sees the Employee Interface for their (chosen) gym only
    ↓
To work under the other gym, Employee must log out and log back in,
choosing differently — there is no in-session gym switch for Employees
```

---

## 1b. HR Login — Gym Picker (UX only, no session-scope change)

```
HR user logs in
    ↓
System checks UserGymAccess count
    ├── 1 gym  → lands directly on that gym's dashboard
    └── 2+ gyms → gym picker shown as the INITIAL LANDING VIEW
                   ("Which gym do you want to see first?")
    ↓
HR selects a gym → dashboard loads scoped to that gym
    ↓
HR can still switch gyms at any time afterward via the existing
in-app Gym Context Switcher — no re-login, no session-scope change.
This is a nicer starting point only, NOT a new authorization model
(unlike Flow 1a for Employees, which is a genuine session-scope lock).
```

---

## 2. Recruitment → Hiring → Employee

```
HR opens a Vacancy (linked to Gym A, position "Junior Trainer")
    ↓
System generates public application link
    ↓
Candidate opens link → fills application form
    ↓
Candidate Profile created in system (status: Applied)
    ↓
HR sees candidate in pipeline → moves to Screening
    ↓
HR reviews candidate → moves to 1st Interview
    ↓
    ⚠️ If no action taken for X days → Follow-up alert generated
    ↓
HR conducts 1st Interview → records outcome → moves to 2nd Interview
    ↓
HR conducts 2nd Interview → records outcome → Final Decision
    ↓
┌─────────────────────┬──────────────────────┬─────────────────┐
│ Decision: Rejected  │ Decision: Wait List  │ Decision: Hired │
│ → Archived          │ → Parked for later   │ → Continue ↓    │
└─────────────────────┴──────────────────────┴─────────────────┘
    ↓ (Hired)
System creates Employee Account
    ↓
Assigns Gym A + Position (Junior Trainer)
    ↓
Generates login credentials
    ↓
Recruitment history linked to Employee record
    ↓
Employee logs in → sees self-service portal
```

---

## 2a. Branch Manager Requests a Vacancy

```
Branch Manager → Recruitment → "Request Vacancy" (requires `recruitment.vacancy_request.create`)
    ↓
Selects position (from own gym's catalog) + writes justification
    ↓
Submits → VacancyRequest created, Status = Pending
    ↓
HR sees it in their Vacancy Requests review queue (requires `recruitment.vacancy_request.approve`)
    ↓
┌─────────────────────────┬──────────────────────────┐
│ HR Approves              │ HR Rejects                │
│ → HR creates the actual  │ → Request closed with a   │
│   Vacancy (normal flow), │   comment; no Vacancy     │
│   linked back to the     │   created                 │
│   request                │                            │
└─────────────────────────┴──────────────────────────┘
    ↓
Branch Manager notified of the decision
    ↓ (if Approved)
Vacancy now follows the normal Recruitment → Hiring flow (Flow 2)
```

---

## 3. Employee Daily Flow (with Cross-Gym Validation)

```
Employee arrives at a gym
    ↓
Face ID scan at THAT gym's biometric device (device is registered to
this one gym via its DeviceToken — see ADR-004)
    ↓
┌─────────────────────────────────────────────┐
│ Face ID succeeds → event sent to system     │
│ Face ID fails → Manual entry by staff at PC │
│   (terminal is itself tied to this gym)     │
└─────────────────────────────────────────────┘
    ↓
System resolves GymId (from DeviceToken or the manual terminal)
    ↓
CROSS-GYM VALIDATION (runs for every event, biometric or manual):
    ↓
1. Does employee have UserGymAccess to THIS gym?
    ├── No  → REJECTED. No AttendanceRecord created.
    ↓ Yes
2. Does employee have a ShiftAssignment at THIS gym today?
    ├── No (including a scheduled day off) → REJECTED. No AttendanceRecord created.
    ↓ Yes
→ ACCEPTED — proceed below
    ↓
System compares check-in time vs. THIS gym's scheduled shift
    ↓
┌───────────────┬─────────────┬───────────────┐
│ On-time       │ Late        │ No check-in   │
│ → Recorded    │ → Flagged   │ → Absent      │
└───────────────┴─────────────┴───────────────┘
    ↓
Employee works shift
    ↓
Employee checks out (Face ID or manual) → same Cross-Gym Validation applies
    ↓
System compares check-out time vs. scheduled shift end
    ↓
┌───────────────────┬──────────────────────┐
│ Normal checkout   │ Early checkout       │
│ → Recorded        │ → Flagged            │
└───────────────────┴──────────────────────┘
```

**Two-gym example:** Employee is assigned to Gym A and Gym B, and is
scheduled to work at Gym A today. If he's scanned at Gym B's device
today, the event is rejected outright (fails check 2 — no shift at Gym B
today) even though he genuinely has `UserGymAccess` to Gym B. Access
alone never grants attendance credit; the day's actual `ShiftAssignment`
at that specific gym does.

---

## 4. Employee Submit Request (Two-Stage: Branch Manager → HR)

```
Employee → My Requests
    ↓
Selects request type (e.g., Day Off, Overtime, Resignation — ALL types
follow this same two-stage flow)
    ↓
Fills required fields (date, reason, etc.)
    ↓
Submits request → Status = Pending
    ↓
Employee has an assigned Branch Manager?
    ↓
┌───────────────────────────────┬──────────────────────────────────┐
│ Yes                            │ No                                │
│ → BM notified, opens his       │ → skip straight to HR review      │
│   Requests view                │   (same as single-stage below)    │
│ → Reviews request + context    │                                    │
│   (e.g. shift conflict?)       │                                    │
│ → Approves or Rejects, with    │                                    │
│   a reason                     │                                    │
│ → Status = PendingHRReview     │                                    │
└───────────────────────────────┴──────────────────────────────────┘
    ↓
HR opens Requests Inbox (or the Events queue, if it surfaced there)
    ↓
Sees: employee's request + BM's decision + BM's reason as context
    ↓
HR makes the FINAL decision
    ↓
┌─────────────────────┬──────────────────────┐
│ Approve             │ Reject               │
│ → with comment      │ → with reason        │
└─────────────────────┴──────────────────────┘
    ↓
Status = Approved / Rejected (final — HR's call, regardless of BM's)
    ↓
Notification sent to employee AND to the Branch Manager (if one acted)
    ↓
If approved Day Off → reflected in schedule
    (shift conflict warning if already assigned)
If approved Overtime → contributes to employee's Payroll Overtime figure
```

---

## 5. Shift Schedule Creation

```
HR selects Gym A (mandatory single-gym selector)
    ↓
Views current cycle (e.g., Aug 18 – Aug 27)
    ↓
Clicks "Create Next Cycle"
    ↓
System asks: start date, end date (configurable per gym)
    ↓
Option: "Copy Previous Cycle" → pre-fills the grid
    ↓
HR adjusts the schedule grid:
    - Rows = employees at Gym A
    - Columns = each day in the new cycle
    - Click cell → select shift template (Morning/Evening/Off)
    ↓
System shows real-time conflict warnings:
    ⚠️ Employee has approved Day Off on Aug 22 but assigned Morning shift
    ⚠️ Only 1 employee scheduled for Aug 23 (understaffed)
    ⚠️ Employee X is double-booked
    ↓
HR resolves conflicts
    ↓
Clicks "Publish"
    ↓
Schedule goes live → visible in employees' "My Schedule"
    ↓
Notification sent to affected employees
```

---

## 6. Attendance Correction

```
HR/Branch Manager views Attendance page for Gym A
    ↓
Notices: Employee X marked "Absent" on Aug 20
    ↓
Employee was actually present (biometric device was down)
    ↓
HR clicks "Correct" on the attendance record
    ↓
Modal: enter actual check-in/out times + reason for correction
    ↓
Submits correction
    ↓
System records:
    - Original value (Absent)
    - New value (On-time, 8:05 AM – 4:02 PM)
    - Corrected by: [HR user name]
    - Timestamp: [when correction was made]
    - Reason: "Biometric device offline"
    ↓
Attendance status updated
    ↓
If this was flagged as a deduction candidate → deduction reversed
```

---

## 7. Employee Transfer Between Gyms

```
HR opens Employee X's profile
    ↓
Clicks "Transfer Gym" (requires `employees.transfer` permission)
    ↓
Selects new gym (Gym B) + effective date
    ↓
System:
    1. Revokes Gym A access from Employee X
    2. Grants Gym B access to Employee X
    3. Creates Employment History entry:
       "Transferred from Gym A to Gym B, effective [date]"
    4. Employee's schedule at Gym A ends
    5. Employee needs new schedule assignment at Gym B
    ↓
Employee's profile now shows Gym B
    ↓
Employment History tab shows the full trail
```

---

## 8. Employee Promotion

```
HR opens Employee X's profile
    ↓
Clicks "Change Position/Level" (requires `employees.position.change`)
    ↓
Selects new position from Gym A's position catalog
    (e.g., "Trainer" → "Senior Trainer")
    ↓
Sets effective date
    ↓
System:
    1. Updates current position
    2. Creates Employment History entry:
       "Position changed from Trainer to Senior Trainer, effective [date]"
    ↓
Optionally: HR also clicks "Manage Compensation" to record a raise
    ↓
Both changes appear in Employment History timeline
```

---

## 9. Branch Manager Assignment

```
HR opens Employee X's profile
    ↓
Clicks "Assign/Change System Role" (requires `employees.role.assign`)
    ↓
Selects "Branch Manager" role
    ↓
System:
    1. Employee's User Type remains "Employee"
    2. Role is set to "Branch Manager"
    3. Branch Manager permission preset is applied
    4. Access scope = Employee's own gym
    5. Employment History entry logged
    ↓
Employee X now sees additional navigation items
    (Team Requests, Schedule Management, etc. — based on granted permissions)
```

---

## 9a. Team Creation & Team Leader Assignment

```
HR or Branch Manager (requires `team.manage`) → Teams → "Create Team"
    ↓
Selects gym (team belongs to exactly one gym)
    ↓
Names the team (e.g. "Morning Floor Team")
    ↓
Adds members from that gym's employee list
    (an employee may already belong to another team — allowed)
    ↓
Assigns one or more Team Leaders from the team's members
    (an employee may already lead another team — allowed)
    ↓
System:
    1. Team row created (Teams)
    2. TeamMembers rows created for each selected employee
    3. TeamLeaders rows created for each selected leader
    4. Team Leader's effective scope = union of all teams they lead
    ↓
Assigned Team Leader(s) now see "My Team" in their sidebar
    ↓
Separately: HR/Branch Manager may grant team-scoped permissions
    (`attendance.view.team`, `requests.approve.team`, etc.) to the
    Team Leader — team membership alone grants no capabilities,
    permissions are still individually assigned per the granular model
```

---

## 10. Payroll Deduction Flow

```
Attendance system records: Employee X was late 3 times this cycle
    ↓
System auto-generates deduction candidates:
    - Late penalty: 3 × [deduction rule amount]
    ↓
HR opens Payroll → sees deduction candidates for review
    ↓
┌─────────────────────┬──────────────────────┐
│ Approve deduction   │ Reject deduction     │
│ → Finalized         │ → Removed, with note │
└─────────────────────┴──────────────────────┘
    ↓
Approved deductions appear in employee's payroll history
    ↓
Employee sees in "My Payroll":
    Base Salary: 5,000
    Deductions: -150 (3× late penalty)
    Net: 4,850
```

---

## 11. Employee Offboarding

```
HR, or a Branch Manager holding `employees.offboard`, opens Employee X's profile
    ↓
Clicks "Offboard" (requires `employees.offboard` — no separate approval
step; whoever holds the permission can start this directly, same pattern
as every other lifecycle action)
    ↓
Offboarding wizard:
    1. Set last working day
    2. Exit checklist (return keys, equipment, etc.)
    3. Final settlement handoff to Payroll
    4. Confirm
    ↓
System:
    1. Employee status → "Terminated"
    2. Employee account disabled
    3. All active schedule assignments ended
    4. Employment History: "Offboarded on [date], reason: [reason]"
    5. Employee data preserved (not deleted)
```

**Note — relationship to self-service Resignation requests:** An
employee submitting a "Resignation" request (Request type #10, see
features.md §9) does NOT automatically trigger this flow. HR (or a
Branch Manager) reviews the Resignation request through the normal
Requests Inbox, and — once ready — separately clicks "Offboard" on that
employee's profile to run this wizard. The two are related in practice
but are deliberately two independent actions with no automatic hand-off,
so a Resignation can be discussed/withdrawn before Offboarding is ever
started.

**Exit Form (new, added to this wizard — HR only fills it out):**
As part of step 2 ("Exit checklist") above, HR completes an Exit Form
directly on this wizard (no separate entity):
- Reason for leaving
- Rehire-eligibility: Yes / No (a stored note only — does NOT block or
  flag the person if HR later tries to hire them again; no system
  enforcement)
- Exit evaluation (brief notes from the exit appointment)

A Branch-Manager-initiated termination routes to HR as an **Event**
(features.md §18) so HR can schedule the exit appointment and run this
wizard — the Branch Manager himself does not fill out the Exit Form.

---

## 12. Super Admin Creates a New Gym

```
Super Admin → Gym Management → "Create Gym"
    ↓
Fills: name, location, contact info
    ↓
Gym created (status: Active)
    ↓
Configures gym:
    - Defines positions (Trainer, Senior Trainer, Front Desk, etc.)
    - Defines shift templates (Morning 8-4, Evening 4-12, Off)
    - Sets shift cycle length (e.g., 10 days)
    ↓
Assigns HR users to this gym
    ↓
Gym is operational → HR can start recruiting, adding employees
```
