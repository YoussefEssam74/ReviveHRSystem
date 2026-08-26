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

## 3. Employee Daily Flow

```
Employee arrives at gym
    ↓
Face ID scan at biometric device
    ↓
┌─────────────────────────────────────────────┐
│ Face ID succeeds → Check-in recorded        │
│ Face ID fails → Manual entry by staff at PC │
└─────────────────────────────────────────────┘
    ↓
System compares check-in time vs. scheduled shift
    ↓
┌───────────────┬─────────────┬───────────────┐
│ On-time       │ Late        │ No check-in   │
│ → Recorded    │ → Flagged   │ → Absent      │
└───────────────┴─────────────┴───────────────┘
    ↓
Employee works shift
    ↓
Employee checks out (Face ID or manual)
    ↓
System compares check-out time vs. scheduled shift end
    ↓
┌───────────────────┬──────────────────────┐
│ Normal checkout   │ Early checkout       │
│ → Recorded        │ → Flagged            │
└───────────────────┴──────────────────────┘
```

---

## 4. Employee Submit Request

```
Employee → My Requests
    ↓
Selects request type (e.g., Day Off)
    ↓
Fills required fields (date, reason)
    ↓
Submits request → status = Pending
    ↓
Notification sent to authorized reviewer (HR / Branch Manager)
    ↓
Reviewer opens Requests Inbox
    ↓
Reviews request details + context
    (e.g., does this day conflict with a published shift?)
    ↓
┌─────────────────────┬──────────────────────┐
│ Approve             │ Reject               │
│ → with comment      │ → with reason        │
└─────────────────────┴──────────────────────┘
    ↓
Notification sent to employee
    ↓
If approved Day Off → reflected in schedule
    (shift conflict warning if already assigned)
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
HR opens Employee X's profile
    ↓
Clicks "Offboard" (requires `employees.offboard`)
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
