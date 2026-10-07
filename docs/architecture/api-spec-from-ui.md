# API Specification Derived from Mock UI

> Generated 2026-10-07 by full reads of every Mock UI portal (Attendance Station, Employee, HR, Super Admin).
> Every endpoint the UI needs, with its request and response contract, using the exact field names rendered by the UI.
>
> Conventions (per [api.md](./api.md)): base `/api`; pagination `{items,page,pageSize,totalCount,totalPages}`;
> errors `{statusCode,message,errors[]}`; list query params `page,pageSize,searchTerm,sortBy,sortOrder`.
> Status marks: **EXISTING** = contract already documented in api.md (implementation still pending); **NEW** = contract required by the UI but not yet documented.

## Table of Contents

1. [Public Endpoints (no login)](#public-endpoints-no-login)
2. [Attendance Station (Public Kiosk)](#section-2---attendance-station-public-kiosk)
3. [Employee Portal](#section-3---employee-portal)
4. [HR Portal - Dashboard, Employees, Attendance, Schedule, Requests, Branch Queue, HR Team](#section-4---hr-portal---dashboard-employees-attendance-schedule-requests-branch-queue-hr-team)
5. [HR Portal - Recruitment, Hiring Forms, Payroll, Evaluations, Events, Access](#section-5---hr-portal---recruitment-hiring-forms-payroll-evaluations-events-access)
6. [Super Admin Portal](#section-6---super-admin-portal)

## Public Endpoints (no login)

These must be reachable **without a user JWT** (explicit requirement: attendance and the hiring form are public; anyone may apply).

| Endpoint | Auth credential | Purpose |
|---|---|---|
| `POST /api/kiosk/pair` | Public (6-digit code + deviceId) | Attendance kiosk redeems a pairing code for a DeviceToken |
| `POST /api/attendance/events` | Device-token header | Kiosk biometric check-in/out |
| `POST /api/attendance/manual` | Device-token header | Kiosk manual check-in/out |
| `GET /api/attendance/roster` | Device-token header | Kiosk branch roster + today shift |
| `GET /api/attendance?date=` | Device-token header | Kiosk today feed + counters |
| `GET /api/hiring-forms` | Public | List open hiring forms |
| `GET /api/hiring-forms/{id}` | Public | Hiring form definition (questions) for anonymous applicants |
| `POST /api/applications` | Public (rate-limited) | Anonymous application submission |

All other endpoints require the standard Authorization header carrying a user JWT; the required permission is noted per endpoint.

---

## Section 2 - Attendance Station (Public Kiosk)


**Source:** `Mock UI/Attendance Station/index.html` (2,554 lines, read fully)
**Conventions:** `docs/architecture/api.md` — pagination envelope `{items,page,pageSize,totalCount,totalPages}`; error envelope `{statusCode,message,errors[]}`.

### ⚠️ Auth model (critical)

The Attendance Station is a **public, unattended kiosk**. No endpoint used by this UI may require a **user JWT**. The UI itself states: *"Every request to the attendance API requires the secret `DeviceToken` in the HTTP headers… personal mobile phones receive 401 Unauthorized."* Auth model per endpoint type:

| Endpoint group | Auth |
|---|---|
| Pairing (6-digit code exchange) | **Public** — 6-digit code + `deviceId`, no JWT |
| Attendance events / manual / roster / today feed | **Device-token** (header or body `deviceToken`; kiosk stores it in `localStorage.revive_station_token`) |
| Biometric AI service (`Station.biometricUrl`) | **None sent by UI** (separate dedicated service; network-restricted) |
| HR Portal code generation / manager authorization | **User-JWT** (out of kiosk scope — HR/manager side) |

---

### Screen inventory (from the file)

1. **Top bar (always)** — gym name, station status, device ID, biometric status pill, Enroll button, Device-Mgmt button, clock
2. **Unpaired Activation View** (`view-unpaired`) — 6-digit code entry + "HR detected code" banner
3. **Manager Pairing Modal** (`modal-manager-pairing`) — simulated manager app (⚠️ handlers `submitPairingFromManager`, `autoFillPairingCode`, `closeManagerPairingModal` are **referenced but never defined** — dead UI)
4. **Paired Kiosk — Biometric Viewfinder** (left panel) — live camera, auto-scan check-in/out, result/rejection overlays, sign-out confirmation
5. **Manual Fallback Form** (right panel)
6. **Today's Counters + Attendance Feed** (right panel)
7. **Enroll Face Modal** (`modal-enroll`) — roster select, capture, enrolled directory
8. **Device Management & Security Modal** (`modal-device-mgmt`) — token display, broken-PC simulation
9. **Cloud API Config Modal** (`modal-api-config`) — biometric service URL

---

## APIs required, grouped by screen

### 1. Unpaired Activation View — Device Pairing

#### 1.1 `POST /api/kiosk/pair` — **NEW** ✱
*(6-digit code exchange → DeviceToken. Not in api.md today.)*

- **Auth:** Public (the 6-digit code is the credential). No user JWT.
- **Called by:** `connectStationWithCode()` — "Connect & Lock to Gym" button (`btn-connect-kiosk`), and `autoFillDetectedHrCode()` (banner "Use Code" button reading `localStorage.revive_pending_pairing` written by the HR portal).
- **Request JSON body (exact UI fields):**
  ```json
  { "code": "739418", "deviceId": "REV-PC-01" }
  ```
  - `code` — from input `#kiosk-code-input` (6 digits, `/\D/g` stripped)
  - `deviceId` — `Station.deviceId` / `localStorage.revive_station_device_id` (hardware identity, ADR-004)
- **Response 200/201 (fields the UI stores/renders):**
  ```json
  { "deviceToken": "dvt_dtn_7f3a9c8b_...", "gymId": 2, "gymName": "Downtown Gym" }
  ```
  - stored → `localStorage.revive_station_token`, `revive_station_gym_id`, `revive_station_gym_name`, `revive_station_paired=true`
  - `gymName` rendered in header (`hdr-gym-name`), feed title, result overlays; `deviceId` rendered in `hdr-device-id` / `unpaired-device-id`
- **Errors:** 400/404 invalid code; expired code (UI shows *"This 6-digit code has expired!"*). Standard envelope `{statusCode,message,errors[]}` suffices — UI displays `message` in toasts.
- **Note:** the mock generates `newToken` client-side — real backend must issue the token server-side (cf. existing `POST /api/gyms/{gymId}/biometric-devices`, user-JWT, HR/manager side).

#### 1.2 Manager/HR code generation & authorization — **context (user-JWT, HR side)**
The Manager Pairing Modal form fields are `#mgr-select-gym` (`gymId`: 2|3|4), `#mgr-device-label` (`deviceLabel`, e.g. `"REV-PC-01 (Turnstile Kiosk)"`), `#mgr-code-input` (`code`). Code generation lives in the HR Portal (Attendance → Pair Kiosk) — outside this file's scope; the kiosk only consumes the code. (Modal is currently dead code in the mock.)

---

### 2. Paired Kiosk — Biometric Check-in / Check-out

#### 2.1 `POST /api/attendance/events` — **EXISTING** ✅ (with reconciliation notes)
*(UI's `Station.apiPath` declares `/api/attendance/public/events`; api.md documents `/api/attendance/events`. Pick one — recommend keeping the documented path; the `/public/` variant is declared but the mock's `postPublicEvent()` is a local simulation, never actually fetched.)*

- **Auth:** Device-token (**no user JWT**). UI security notice: token in HTTP headers; docs put `deviceToken` in body — header recommended, body acceptable. Missing/invalid → **401** `{ error:"UNAUTHORIZED_DEVICE", message:"Direct URL access denied..." }`.
- **Called by:** `runAttendanceScan()` ← `triggerLiveBiometricScan()` (auto-scan after 1.5 s dwell, latch, 30 s cooldown) and `resolveSignOutConfirm(true)` (early sign-out confirm); `simulateScan()` is mock-only.
- **Request JSON (exact UI fields):**
  ```json
  {
    "employeeId": "EMP-1042",
    "employeeName": "Karim Hassan",
    "type": "IN",
    "method": "Biometric",
    "livenessScore": 0.95,
    "timestamp": "2026-10-07T15:30:00.000Z"
  }
  ```
  - `type`: `"IN" | "OUT"` (docs use `direction: "CheckIn"|"CheckOut"` — **reconcile naming**)
  - `livenessScore`: 0–1; server must reject `< 0.60` (UI message: *"60% needed"*)
  - `method` is always `"Biometric"` on this path
- **Response 201 (fields UI renders):**
  ```json
  {
    "recordId": "ATT-MXXXXXX",
    "employeeId": "EMP-1042", "employeeName": "Karim Hassan",
    "gymId": 2, "gymName": "Downtown Gym",
    "type": "IN", "method": "Biometric",
    "timestamp": "2026-10-07T15:30:00.000Z",
    "shiftComparison": "ON_SCHEDULE"
  }
  ```
  - UI renders `recordId` on the success overlay ("Attendance Record:") and in the feed `detail` (`ATT-… · live 95%`)
- **Error responses (exact codes/fields the UI branches on):**

  | HTTP | `error` | Extra fields rendered | UI display |
  |---|---|---|---|
  | 401 | `UNAUTHORIZED_DEVICE` | `message` | toast |
  | 404 | `EMPLOYEE_NOT_FOUND` | `message` | generic red overlay (`body.message`, `HTTP 404 · EMPLOYEE_NOT_FOUND`) |
  | 403 | `CROSS_GYM_ACCESS_DENIED` | `message`, `assignedGyms` (rendered), `targetGym` | dedicated overlay "Access Denied — Not Assigned to This Gym" |
  | 404 | `SCHEDULED_DAY_OFF` | `message`, `targetGym` | overlay "Check-In Blocked — No Shift Scheduled Today" |
  | 403 | `WRONG_BRANCH_SCHEDULE` | `message`, `scheduledBranch` (rendered), `targetGym` | overlay "Scheduled at Different Branch Today" |
  | 422 | `LIVENESS_FAILED` | `message` | toast only — **never written to feed** |

  Generic shape: `{ "error": "<CODE>", "message": "<human text>" }` (+ per-code extras above). UI also reads `body.error` to compose feed rejections (`detail = "${error}: ${message}"`). ⚠️ This differs from the standard `{statusCode,message,errors[]}` envelope — either embed these fields alongside it or agree on the union shape.
- **Branch isolation:** server resolves gym from `deviceToken`, then cross-checks employee's `UserGymAccess` + today's `ShiftAssignment` **at this gym** (api.md) → drives 403/404 responses above. `livenessScore ≥ 0.60` gate → 422.

#### 2.2 Sign-out confirmation — **client-only, no API**
`promptSignOut()` / `resolveSignOutConfirm(approve)` gates an early `OUT` (shift not over); on approve it issues the same 2.1 call; on decline/cancel (20 s timeout) no request is made.

---

### 3. Manual Fallback Form

#### 3.1 `POST /api/attendance/manual` — **EXISTING** ✅ (field deltas noted)

- **Auth:** Device-token (no user JWT).
- **Called by:** `submitManual()` — form `#manual-form` "Record" button.
- **Request JSON (exact UI fields):**
  ```json
  {
    "employeeId": "EMP-1042",
    "employeeName": "Karim Hassan",
    "type": "IN",
    "method": "Manual",
    "time": "15:30",
    "timestamp": "2026-10-07T15:30:00.000Z"
  }
  ```
  - `employeeId` ← input `#m-emp` (uppercased, ≤12 chars, must exist in roster else client-side toast "Unknown employee ID")
  - `type` ← radio `name="m-type"` (`"IN" | "OUT"`)
  - `time` ← auto `HH:MM` clock (no user time input); rendered as entry time / lateness basis
  - ⚠️ **The UI has NO `reason` field and sends NO `gymId`** (gym derives from device token). api.md's documented body is `{ employeeId, gymId, timestamp, direction, reason }` — **reconcile**: keep `reason` optional server-side, drop required `gymId` in favor of token resolution (or accept both).
- **Response / errors:** identical shape and codes as **2.1** (same `postPublicEvent()` validation path in the mock; same overlays, toasts, feed entries — `method:"Manual"` shown as amber `manual` tag in feed).

---

### 4. Roster / Employee Lookup / Today's Schedule (kiosk data load)

#### 4.1 `GET /api/attendance/roster` — **NEW** ✱
*(Branch-scoped employee roster + today's shift. UI currently hardcodes `ALL_EMPLOYEES` + filters client-side by `assignedGymIds.includes(Station.gymId)`; a real kiosk must fetch it.)*

- **Auth:** Device-token (gym resolved from token → strict branch isolation; never takes `gymId` from the client).
- **Called by:** `refreshGymRoster()` (on pairing/load), feeding three UI surfaces:
  1. **Manual form datalist** `#emp-ids` — option `value=e.id`, `label = "{name} ({position}) — Shift {shiftStart}-{shiftEnd}"` or `"— Day Off"`
  2. **Attendance feed** `#events-list` (`renderEvents()` boxes) — renders `emp.name`, `emp.id`, `emp.shift` (bool), `emp.shiftStart`, `emp.shiftEnd`, `emp.access`
  3. **Enroll modal dropdown** `#enroll-select-emp` — `"{name} ({id} — {position})"`
- **Query params:** none used by UI (optional `page`/`pageSize` per convention; roster is small — UI renders all items).
- **Response:**
  ```json
  {
    "items": [
      {
        "id": "EMP-1042",
        "name": "Karim Hassan",
        "position": "Fitness Trainer",
        "access": true,
        "shift": true,
        "shiftStart": "14:00",
        "shiftEnd": "22:00"
      },
      { "id": "EMP-1051", "name": "Omar Youssef", "position": "Fitness Trainer",
        "access": true, "shift": false, "shiftStart": null, "shiftEnd": null }
    ],
    "page": 1, "pageSize": 100, "totalCount": 5, "totalPages": 1
  }
  ```
  - Exact rendered fields: `id`, `name`, `position`, `access`, `shift`, `shiftStart`, `shiftEnd`
  - `shift:false / shiftStart:null` → "DAY OFF" / "No Shift Today" / "Scheduled Day Off" badges; `shiftStart`/`shiftEnd` drive shift row, "ends in X", "left X early", and **lateness** (`lateMins` = `entryTime − shiftStart`)
  - `position` also rendered on the success overlay (`{position || 'Staff'}`); `access` gates the result overlays (server enforces anyway)
- **Screen/action:** every kiosk surface above; also `stat-expected` (count of `access && shift`).

#### 4.2 Employee lookup/search on kiosk — covered by 4.1
No separate search endpoint is called: datalist is populated from the full branch roster; clicking a feed box calls `fillManualEmp(empId)` which just fills `#m-emp` locally. (A `searchTerm` param exists in the pagination convention but the UI does not use it — not proposed.)

---

### 5. Today's Counters & Attendance Feed

#### 5.1 `GET /api/attendance` — **EXISTING** ✅ *(gym + date filters, per api.md)*

- **Auth:** Device-token (no user JWT); gym from token — filters effectively `?date=YYYY-MM-DD` (today).
- **Called by (needed):** feed + counters after reload / cross-kiosk. The mock persists events per gym in `localStorage` (`revive_attendance_station_events_v1_gym_{id}`, filtered to `day === today`, excluding `LIVENESS_FAILED`/spoof entries) — a real kiosk should hydrate from the server.
- **Query params:** `date=2026-10-07` (today; UI's `todayKey()` = `YYYY-MM-DD`), plus convention `page`/`pageSize`.
- **Response — items must map to the UI's event object (exact rendered fields):**
  ```json
  {
    "items": [
      {
        "recordId": "ATT-MXXXXXX",
        "employeeId": "EMP-1042",
        "employeeName": "Karim Hassan",
        "gymId": 2,
        "type": "IN",
        "method": "Biometric",
        "timestamp": "2026-10-07T14:02:11.000Z",
        "status": "accepted",
        "entryTime": "14:02"
      }
    ],
    "page": 1, "pageSize": 100, "totalCount": 12, "totalPages": 1
  }
  ```
  - UI internals per event: `empId`, `name`, `type` (`IN|OUT`), `method` (`Biometric|Manual`), `status` (`accepted|rejected`), `entryTime` (`HH:MM`), `time` (`HH:MM:SS`), `day`, `gymId`, `detail`, `recordId`
  - Feed rendering uses: latest accepted IN/OUT times (+ `manual` tag when `method==='Manual'`), `recordId` in biometric detail, rejection `detail` (`"ERROR: message"` → "Blocked: …" line), status badges (PRESENT / LEFT / DAY OFF / NOT IN), late chip, "ends in …", "left … early"
  - ⚠️ **Rejected attempts have no server record** (api.md: *"no record is created on reject"*); the mock stores rejections locally only. Cross-reload persistence of rejections would require an extra endpoint — **the UI does not call one**, so none is proposed here.
- **Counters (`renderStats()`):** `stat-present` (accepted IN with no later OUT), `stat-expected` (roster `access && shift`), `att-summary` ("N present today" / "N present · M late") — all computed client-side from 4.1 + 5.1; no dedicated API.
- **"Clear feed" button (`clearEvents()`):** clears **local storage only** — no API.

---

### 6. Enroll Face Modal

Calls the **separate Biometric AI service** (`Station.biometricUrl`, configurable — default `https://revive-hr-biometrics.onrender.com`; **not** the `/api` backend, **no user JWT**, no device token sent):

#### 6.1 `POST {biometricUrl}/enroll_frame` — service API (not in api.md)
- **Auth:** none sent (dedicated service).
- **Called by:** `submitFaceEnrollment()` when a browser frame was captured.
- **Body:** `{ "image": "data:image/jpeg;base64,…", "name": "Karim Hassan", "employee_code": "EMP-1042" }`
  - `name` ← `#enroll-emp-name` (required, else toast); `employee_code` ← `#enroll-emp-id` (uppercased)
- **Response:** `{ "success": true, "message": "…" }` — `message` → toast; on `success:false` → error toast.

#### 6.2 `POST {biometricUrl}/enroll?name=…&employee_code=…` — service API
Fallback (query-string variant) when no frame captured; same `{success, message}` response.

#### 6.3 `GET {biometricUrl}/employees` — service API
- **Called by:** `loadEnrolledEmployees()` (modal open, after enroll/delete, on init).
- **Response:** array of `{ "id", "employee_code", "name", "enrolled_at", "thumb" }` — all rendered in `#enrolled-faces-list` (`name`, `employee_code||id`, `enrolled_at`, `thumb` image) and counts `enroll-list-count` ("N registered") + `enrolled-count-pill` ("N Enrolled"). Merged with `localStorage.revive_enrolled_faces_web`, deduped by `id`.

#### 6.4 `DELETE {biometricUrl}/employees/{id}` — service API
- **Called by:** `deleteEnrolledEmployee(id)` (trash button per row).
- **Response:** `{ "success": true, "message": "…" }`.

---

### 7. Cloud API Config Modal + Biometric Viewfinder (service APIs)

Same dedicated Biometric AI service, **no user JWT**:

| # | Method + path | Called by | Request | Response fields rendered |
|---|---|---|---|---|
| 7.1 | `GET {biometricUrl}/ping` — service API | `testAndSaveApiUrl()` ("Connect" `btn-test-api`) | none | `{ "device", "enrolled_count" }` → "Device: … · Registered: N" |
| 7.2 | `GET {biometricUrl}/status` — service API | `checkBiometricConnection()` (every 5 s) | none | `{ "fps", "total_enrolled", "device" }` → status pill "Face-ID · Online (…)", `enrolled-count-pill` |
| 7.3 | `POST {biometricUrl}/process_frame` — service API | `sendClientFrame()` (every 320 ms) | `{ "image": "<base64 jpeg>" }` | `{ "face_detected", "is_live", "is_match", "recognized_id", "recognized_name", "liveness_score", "similarity", "total_enrolled", "bbox" }` → HUD (MATCHED / SPOOF BLOCKED / UNKNOWN / VERIFYING), dwell & latch logic feeding scan 2.1 |
| 7.4 | `GET {biometricUrl}/video_feed` — service API | fallback MJPEG `<img src>` when browser webcam unavailable | none | multipart stream |

*(7.1–7.4 are outside the Revive `/api` backend and outside `api.md`; listed for completeness because the UI calls them.)*

---

### 8. Device Management & Security Modal — **no API called**

- Displays `mgmt-branch-name` (`"{gymName} (Branch ID: {gymId})"`), `mgmt-device-id`, `mgmt-device-token` — all from localStorage; "Copy" uses clipboard.
- **"Simulate Broken PC / Disconnect"** (`simulateBrokenHardware()`): wipes local pairing state + assigns new random `deviceId` — **local only, zero network calls**. ⚠️ *Gap (not proposed as a required API since the UI never calls one):* a production kiosk would need a token-revocation endpoint (e.g. `DELETE`-style unpair) so the old `DeviceToken` dies server-side.
- ⚠️ *Gap:* on startup the kiosk **never validates** its stored token against the server (renders "Authorized" from localStorage alone). A `GET /api/kiosk/device` self-check would harden this — **not called by the UI, listed as a gap only.**

---

### Summary table — EXISTING vs NEW

| # | Endpoint | Status | Auth | UI screen/action |
|---|---|---|---|---|
| 1 | `POST /api/kiosk/pair` | **NEW** ✱ | Public (6-digit code + `deviceId`) | Unpaired view — "Connect & Lock to Gym" |
| 2 | `POST /api/attendance/events` | **EXISTING** ✅ (`apiPath` alias `/api/attendance/public/events` to reconcile) | Device-token | Biometric viewfinder — auto-scan IN/OUT, sign-out confirm |
| 3 | `POST /api/attendance/manual` | **EXISTING** ✅ (UI omits `reason` & `gymId`; adds `employeeName`,`type`,`method`,`time`) | Device-token | Manual Fallback — "Record" |
| 4 | `GET /api/attendance/roster` | **NEW** ✱ | Device-token | Datalist lookup, feed roster, enroll dropdown, expected count, shift display |
| 5 | `GET /api/attendance?date=` | **EXISTING** ✅ (gym+date filters) | Device-token | Attendance feed + counters hydration |
| 6 | `{biometricUrl}/enroll_frame`, `/enroll`, `/employees` (GET/DELETE), `/status`, `/ping`, `/process_frame`, `/video_feed` | Service APIs (outside `/api`, outside api.md) | None sent | Enroll modal, API config modal, viewfinder |

### Key discrepancies to resolve

1. **Direction naming:** UI `type: "IN"|"OUT"` vs docs `direction: "CheckIn"|"CheckOut"`.
2. **Manual `reason`:** documented as part of the body, but **the UI has no reason input** — must be optional.
3. **`gymId` on manual:** docs require it; UI relies on device-token resolution.
4. **Error shape:** UI reads `body.error` + `body.message` (+ `assignedGyms`, `scheduledBranch`) on non-2xx — must coexist with the `{statusCode,message,errors[]}` envelope.
5. **Rejected punches:** shown only from client-local state (server creates no record on reject) — rejections are ephemeral across devices by design of the current contract.
6. **Pairing token generation** must move server-side (mock mints `dvt_…` in the browser).
7. The Manager Pairing Modal's JS handlers are undefined — dead code; do not derive APIs from it beyond the shared pairing flow.

---

## Section 3 - Employee Portal


**Source scope:** `Mock UI/Employee/` (index.html, app.js, core.js, data.js, pages-employee.js, pages-employee2.js, pages-management.js, roles guide). Fields below are exact UI/mock field names. Conventions: list endpoints use `{items,page,pageSize,totalCount,totalPages}`; errors use `{statusCode,message,errors[]}`. Auth = user JWT everywhere unless noted. Permission keys are the dotted keys the UI gates on (`hasPermission(...)`), mapped to the roles guide.

**Permission vocabulary used below (from UI + guide):** self-service pages = JWT only (own data, guide §2/§3); `team.view`, `attendance.view.team`, `schedule.view.team`, `requests.view.team`, `requests.approve.team`, `evaluations.view.team`, `team.manage` (Team Leader, guide §4); `employees.view/create/edit/status.change/offboard`, `attendance.view/edit`, `schedule.manage`, `requests.view/approve`, `recruitment.vacancy_request.create` (Branch Manager, guide §5); `payroll.view`, `evaluations.manage` (HR, only if granted).

---

### 1. Dashboard (`renderDashboard`)

| # | Method + Path | Auth / Permission | Request | Response (fields UI renders) | Caller | Status |
|---|---|---|---|---|---|---|
| 1.1 | `GET /api/dashboard/employee` | JWT (self) | — | `{ greeting, user:{firstName, position, gym:{name,branch}}, todayShift:{shiftName,startTime,endTime,gym,status}, todayAttendance:{scheduledStart,checkIn,checkOut,status,checkedIn,source}, attendanceSummary:{rate,present,late,absent,earlyCheckout,missingCheckout}, upcomingSchedule:[{date,day,dayNum,shiftName,start,end,isOff,isToday}] (5), pendingRequestCount, latestPayroll:{id,period,status}, recentNotifications:[{id,title,description,date,category,link,read,color}] (3), actionRequired:[{title,detail,link}] (e.g. "Document expiring soon" / "First Aid Certification expires in 14 days.", "New schedule published"), management:{scope:"branch"\|"team", memberCount, presentToday, pendingRequests, absent} }` | Dashboard cards, ACTION REQUIRED box, TEAM/BRANCH OVERVIEW strip | **EXISTING** (path) — response fields listed here are what must be populated |
| 1.2 | `GET /api/notifications?pageSize=3` | JWT | query: `pageSize` | see §11.1 | Recent Notifications card | EXISTING |

---

### 2. My Profile (`renderProfile`, `openEditContact`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 2.1 | `GET /api/employees/{id}` | JWT (own; BM/TL may view subordinate per `employees.view`/`team.view`) | — | `{ id, fullName, initials, position, level, status, employmentType, hireDate, dateOfBirth, nationalId, gender, address, phone, email, gym:{id,name,branch}, emergencyContact:{name,relationship,phone}, baseSalary, permissions:[] }` | Profile header, Personal/Contact/Employment cards, header user menu | EXISTING |
| 2.2 | `PUT /api/employees/{id}/contact` | JWT (own, permitted editable fields per guide §7) | body: `{ phone, email, address }` (labels: Mobile Number, Personal Email, Address) | `{ phone, email, address }` (204-style ok also fine) | "Edit Contact Information" modal → Save | **NEW** |
| 2.3 | `PATCH /api/employees/{id}/emergency-contact` | JWT (own) | body: `{ name, relationship, phone }` (fields as displayed; mock edit button is a toast stub) | same | Emergency Contact "Edit" button | **NEW** |
| 2.4 | `PUT /api/employees/{id}/photo` | JWT (own) | multipart: `file` (avatar camera button, no form in mock) | `{ photoUrl }` | Profile avatar edit button (stub) | **NEW** (stub) |

Personal Info "Edit" and Employment Info are **read-only** (toast "Profile editing is managed by HR", guide §7) → no API.

---

### 3. My Documents (`renderDocuments`, `openDocDetail`, `openUploadModal`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 3.1 | `GET /api/employees/{id}/documents` | JWT (own) | — | paged `{items:[{id,name,category,uploadDate,expiryDate,status,canDownload}]}` — statuses `Valid\|Expiring Soon\|Expired` | "All On-File Documents" table + mobile cards | EXISTING |
| 3.2 | `GET /api/employees/{id}/required-documents` | JWT (own) | — | `{items:[{key,label,docId}]}` — keys `national-id, contract, certificates, bank, graduation, military`; `docId` null until uploaded | "REQUIRED DOCUMENTS · EMPLOYEE UPLOADS" checklist + sidebar badge | **NEW** |
| 3.3 | `GET /api/employees/{id}/hr-documents` | JWT (own) | — | `{items:[{id,name,category,addedDate,size}]}` (`size` e.g. "PDF · 2.1 MB") | "HR UPLOADED · OFFICIAL COMPANY DOCUMENTS" list | **NEW** |
| 3.4 | `POST /api/employees/{id}/documents` | JWT (own) | multipart: `documentType` (select of required-doc labels), `documentName` (text), `file` (PDF/JPG/PNG ≤10MB) | created doc `{id,name,category,uploadDate,expiryDate,status,canDownload}` | Upload modal → Upload (header button + per-row Upload) | EXISTING |
| 3.5 | `GET /api/employees/{id}/documents/{docId}/download` | JWT (own); respect `canDownload` | — | binary stream | Download icons/buttons (toast in mock) | **NEW** |
| 3.6 | `GET /api/employees/{id}/hr-documents/{docId}/download` | JWT (own) | — | binary stream | HR-documents Download button | **NEW** |

Doc detail modal uses only list fields → no extra API. Sidebar "needs attention" badge = 3.1 + 3.2 statuses.

---

### 4. Events (`renderEvents`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 4.1 | `GET /api/events?scope=employee` | JWT (self) | query: `scope=employee` | `{items:[{id,type,category,title,date,detail,action,link,urgent}]}` — `category ∈ Compliance,Benefits,Onboarding,Training,Company Event`; `type ∈ Document Expiry,Contract,Benefits,Onboarding,Training,Company Event` | Events page groups; Dashboard ACTION REQUIRED; sidebar "urgent" badge | EXISTING path — **employee-facing published-event fields are not in docs' HR action-queue contract** (treat payload as extension) |

---

### 5. Employment History (`renderHistory`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 5.1 | `GET /api/employees/{id}/history` | JWT (own) | — | `{items:[{month, events:[{type,icon,from,to,effective,detail,extra:[{label,value}]}]}]}` — `type` values: `Position Changed, Gym Transfer, Role Added, Joined Revive` | Timeline | EXISTING |

---

### 6. My Attendance (`renderAttendance`, `openAttDetail`, `submitLeaveRequest`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 6.1 | `GET /api/employees/{id}/attendance` | JWT (own) | query: `month` (`2026-08`) | `{ summary:{rate,present,late,absent,earlyCheckout,missingCheckout}, today:{shiftName,startTime,endTime,gym,status,scheduledStart,checkIn,checkOut,attendanceStatus,checkedIn,source}, items:[{date,shift,shiftName,checkIn,checkOut,status,source,notes}] }` — `shift` like `08:00–16:00`/`OFF`; `status ∈ On Time,Late,Absent,Early Checkout,Missing Checkout,Off,Present` | Month selector, Today's View, stats row, history table/cards, day-detail drawer (shift, shiftName, checkIn, checkOut, status, source, notes), calendar day attendance | EXISTING |
| 6.2 | `GET /api/employees/{id}/leave-balance` | JWT (own) | — | `{annualTotal,annualUsed,sickTotal,sickUsed,personalTotal,personalUsed,pendingRequests}` | Leave Balance card, annual-leave banner (Requests/Schedule too), Day-Off blocking logic | **NEW** |
| 6.3 | `POST /api/requests` | JWT (self; workflow per guide §7) | body: `{ type:"Day Off", date:"YYYY-MM-DD" (att-date), reason }` | created request `{id,type,submittedDate,requestedDate,status:"Pending",reason,reviewer,reviewerComment,timeline:[{step,date,done}],scheduleContext}` | "Request Day Off" form → Submit Request (routes BM → HR) | EXISTING |
| 6.4 | `GET /api/requests/{id}` | JWT (own) | — | request detail (fields as §10.3) | "Request Correction" button redirects to Requests | EXISTING |

Note: `futureRequests` (statuses `Pending BM / Pending HR`, types `Leave Request, Shift Swap, Permission Request, Schedule Change`) is declared but never rendered → covered by `GET /api/employees/{id}/requests`.

---

### 7. My Schedule (`renderSchedule`, `openDayRequest`, `submitDayRequest`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 7.1 | `GET /api/employees/{id}/schedule` | JWT (self; published-only, guide §7) | query: `month=YYYY-MM` | `{ cycles:[{id,label,status:"Published"}], days:[{date,day,dayNum,shiftName,start,end,isOff,isToday}] }` | Month calendar cells, day-detail panel, mobile day cards, month summary, dashboard "Upcoming Schedule" | **NEW** (employee view of published cycles) |
| 7.2 | `GET /api/request-types` | JWT | — | `{items:[{id,label,fields:[]}]}` — ids: `day-off, leave-early, late-arrival, shift-swap, overtime, document-request, correction` with fields `date,time,date-from,date-to,colleague,time-from,time-to,document-type,correction-type,reason` | New Request modal (calendar modal filters out `document-request`), per-day request modal | **NEW** (configurable per guide §7) |
| 7.3 | `POST /api/requests` | JWT | body by type: `day-off`→`{type,date,reason}`; `leave-early`→`{type,date,time,reason}`; `late-arrival`→`{type,date,time,reason}`; `shift-swap`→`{type,dateFrom,dateTo,colleague,reason}`; `overtime`→`{type,date,timeFrom,timeTo,reason}`; `document-request`→`{type,documentType,reason}`; `correction`→`{type,date,correctionType,reason}` (`Missing Check-in\|Missing Check-out\|Wrong Time`) | created request (as 6.3) | "New Request" modal (header of schedule page + Requests page) and per-day `openDayRequest` modal → Submit | EXISTING |
| 7.4 | `GET /api/employees/{id}/requests` | JWT (own) | — | items as §10.3 | request chips on calendar days (`getDayRequests`) | EXISTING |

---

### 8. My Payroll (`renderPayroll`, `openPayDetail`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 8.1 | `GET /api/employees/{id}/payroll` | JWT (self; `payroll.view` for others) | — | `{items:[{id,period,status:"Processing"\|"Paid",paidDate,visible,baseSalary,annualIncrease,workingDays,workedDays,scheduledWeeklyDays,weeklyPattern,overtimeHours,usedAnnualLeave,paidLeaveDays,remainingAnnualLeave,netSalary,grossEarnings,totalDeductions,items:[{label,amount,type:"earning"\|"deduction",icon,color,isGroup?,subItems:[{label,amount,date,detail,icon}]}]}]}` | Current-period card, contract/leave overview, YTD bento (Earned/Deductions/Net Pay/Avg), monthly history expandable cards, full payslip modal, sidebar `payroll.view` badge | EXISTING |
| 8.2 | `GET /api/payroll-periods` | JWT (`payroll.view`; employee needs own current period) | query: `gymId?` | `{items:[{id,label/start,end,status}]}` | Current Period card ("August 2026 · Processing") | EXISTING |
| 8.3 | `GET /api/employees/{id}/payroll/{periodId}/payslip` | JWT (own; `visible:true` only) | — | PDF stream | Payslip modal → "Download PDF" | **NEW** |
| 8.4 | `GET /api/employees/{id}/leave-balance` | JWT | — | as §6.2 | Payroll page leave cards (used/remaining/paid) | **NEW** |

---

### 9. My Evaluations (`renderEvaluations`, `openEvalDetail`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 9.1 | `GET /api/employees/{id}/evaluations` | JWT (own) | — | `{items:[{id,period,score,maxScore,status,date,reviewer,criteria:[{name,score,comment}],overallComment}]}` | Latest-score card, history list, criteria modal | EXISTING |

---

### 10. My Requests (`renderRequests`, `openNewRequest`, `updateReqForm`, `submitNewRequest`, `openReqDetail`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 10.1 | `GET /api/employees/{id}/requests` | JWT (own) | query: `status` (`Pending\|Approved\|Rejected`, filter pills) | `{items:[{id,type,submittedDate,requestedDate,status,reason,reviewer,reviewerComment,timeline:[{step,date,done}],scheduleContext}], page,pageSize,totalCount,totalPages}` | Filtered table (cols: Request, Type, Date, Submitted, Status) + mobile cards + sidebar pending badge | EXISTING |
| 10.2 | `POST /api/requests` | JWT | body as §7.3 (per selected `requestType.id` + its `fields`) | created request | New Request modal → Submit | EXISTING |
| 10.3 | `GET /api/requests/{id}` | JWT (own) | — | `{id,type,submittedDate,requestedDate,status,reason,scheduleContext,reviewerComment,timeline:[{step,date,done}]}` | Detail drawer (Type, Submitted, Requested Date, Reason, Schedule Impact, Reviewer Comment, Approval Workflow) | EXISTING |
| 10.4 | `POST /api/requests/{id}/cancel` | JWT (own, `status=Pending` only) | — | updated request | Drawer → "Cancel Request" (toast in mock) | **NEW** |
| 10.5 | `GET /api/requests/{id}/attachment` | JWT (own, `status=Approved`) | — | binary stream | Drawer → "Download" on approved request (e.g. Document Request) | **NEW** |

---

### 11. Notifications (header bell + `renderNotifications`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 11.1 | `GET /api/notifications` | JWT | query: `page,pageSize` | `{items:[{id,category,title,description,date,read,color,link}], …pager}` — `category ∈ Requests,Schedule,Payroll,Evaluations,HR Announcements,System`; `color ∈ green,blue,purple,red,yellow` | Bell dropdown, Notifications page, Dashboard recent list | EXISTING |
| 11.2 | `GET /api/notifications/unread-count` | JWT | — | `{count}` | Header bell badge + mobile badge + sidebar badge | EXISTING |
| 11.3 | `PUT /api/notifications/{id}/read` | JWT | — | updated notification | `openNotification(id)` (also navigates to `n.link`) | EXISTING |
| 11.4 | `PUT /api/notifications/read-all` | JWT | — | ok | "Mark all read" (dropdown) + "Mark All Read" (page) | EXISTING |

---

### 12. Settings (`renderSettings`, `openChangePassword`, `handleLogout`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 12.1 | `POST /api/auth/change-password` | JWT | body: `{ currentPassword, newPassword, confirmPassword }` (labels: Current/New/Confirm New Password; min 8, upper+lower+digit per UI hint) | ok / error envelope | Change Password modal | **NEW** (docs only have admin `POST /api/users/{id}/reset-password`) |
| 12.2 | `GET /api/me/settings` | JWT | — | `{emailNotifications,pushNotifications,scheduleNotifications,attendanceNotifications,payrollNotifications,requestNotifications,language}` | 6 notification toggles + Language select | **NEW** |
| 12.3 | `PUT /api/me/settings` | JWT | body: `{emailNotifications,pushNotifications,scheduleNotifications,attendanceNotifications,payrollNotifications,requestNotifications,language}` | same | Toggling a switch / language change | **NEW** |
| 12.4 | `POST /api/auth/logout` | JWT | — | ok | Logout (menu/sidebar/Settings) | EXISTING |

Session hydration: login/refresh (EXISTING) supplies JWT; effective `permissions[]` via `GET /api/users/{id}` (EXISTING, "Get user details + effective permissions") drives nav gating.

---

### 13. My Team (`renderTeam`, `setTeamRequestsTab` tabs, sidebar badges)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 13.1 | `GET /api/teams/my-teams` | JWT | — | `{items:[{id,name,gymId,...}]}` — resolves the user's assigned team(s) (guide §4 scope) | Team scope resolution for all team pages | EXISTING |
| 13.2 | `GET /api/teams/{teamId}/today` | JWT, `team.view` | query: `q` (search team), `month` (select "August 2026"), `date` | `{stats:{total,present,late,absent,pendingRequests,upcomingIssues}, items:[{id,name,position,status,checkIn,initials,shift:{id,name,start,end,isOff,color,bgColor,textColor},checkOut}]}` — `status ∈ Present,Late,Absent` | Stats row, Needs Attention box (Mark Present/Remind/View), desktop table (Employee, Position, Scheduled, Check In, Check Out, Status), mobile cards | **NEW** (aggregate) |
| 13.3 | `POST /api/attendance/manual` | JWT, `attendance.edit`/`attendance.manual_entry` | body: `{employeeId, gymId, timestamp, direction:"CheckIn", reason}` | attendance record | "Mark Present" (attention row + member profile) | EXISTING (docs) |
| 13.4 | `POST /api/teams/members/{id}/reminders` | JWT, `team.manage` | no body fields in mock | ok | "Remind" button | **NEW** |
| 13.5 | `POST /api/teams/follow-ups` | JWT, `team.manage` | body: `{employeeId, action:"Send reminder"\|"Schedule a meeting"\|"Escalate to manager"\|"Mark as resolved", note}` (creates/updates item with `type`, `description`, `severity`) | `{id,employee,type,description,severity,lastAction,note}` | `addTeamFollowUp` modal → Save Action | **NEW** |
| 13.6 | `GET /api/teams/{teamId}/follow-ups` | JWT, `team.view` | — | `{items:[{id,employee,type,description,severity,lastAction,note}]}` | Team Actions page, team sidebar badge | **NEW** |
| 13.7 | `PUT /api/teams/follow-ups/{id}` | JWT, `team.manage` | body: `{action, note}` | updated item | `saveFollowUp` (Team Actions → Action modal) | **NEW** |
| 13.8 | `POST /api/employees/{id}/messages` | JWT, `team.manage` | body: `{message}` (no field captured in mock — toast stub) | ok | "Message" button on member profile | **NEW** (stub) |

---

### 14. Team Member Profile (`renderTeamMemberProfile` + member modals)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 14.1 | `GET /api/employees/{id}` | JWT, `team.view`/`employees.view` (scoped) | — | fields as §2.1 plus `{dateOfBirth,gender,nationalId,address,email,phone,emergencyContact:{name,relationship,phone},hireDate,employmentType,level,baseSalary,gym}` | Profile header + PERSONAL INFO / CONTACT & EMERGENCY / EMPLOYMENT cards | EXISTING |
| 14.2 | `GET /api/employees/{id}/attendance?date=` | JWT, `attendance.view.team` | query: `date` | today's `{scheduledShift,checkIn,checkOut,source}` + history items | TODAY'S ATTENDANCE cards; `openMemberAttendance` modal rows (date, shift, checkIn, checkOut, status) | EXISTING |
| 14.3 | `GET /api/employees/{id}/requests` | JWT, `requests.view.team` | — | as §10.1 (UI uses `{id,type,date,submitted,status,reason,teamApprovedBy}`) | Member REQUESTS card (+ Approve/Reject inline) | EXISTING |
| 14.4 | `GET /api/employees/{id}/evaluations` | JWT, `evaluations.view.team` | — | as §9.1 (list view uses `{id,employee,position,period,score,result,status}`) | Member EVALUATIONS card (+ Edit) | EXISTING |
| 14.5 | Weekly schedule of member | JWT, `schedule.view.team` | — | `{days:[{date,shiftTemplateId}]}` (Mon 25 … Sun 31 in mock) | WEEKLY SCHEDULE card / `openMemberSchedule` modal | covered by §15 roster/assignments (see 15.2) |
| 14.6 | `POST /api/evaluation-forms/{formId}/responses` | JWT, `evaluations.view.team`/`team.manage` | body: `{employeeId, period, score, criteria:[{name,score,comment}], overallComment}` — criteria names fixed list: `Customer Service, Team Collaboration, Punctuality & Attendance, Technical Skills, Initiative`; `result` derived (`≥4 Exceeds, ≥3 Meets, else Below`) | created `{id,employee,position,period,score,result,status:"Completed",criteria,overallComment}` | "Evaluate" button / "New Evaluation" modal → Save | EXISTING (forms from `GET /api/evaluation-forms`) |
| 14.7 | `PUT /api/employees/{id}/evaluations/{evaluationId}` | JWT, `evaluations.manage`/`team.manage` | body: `{period, score, criteria:[{name,score,comment}], overallComment}` | updated evaluation | `openEditTeamEvaluation` → Save Changes | **NEW** |
| 14.8 | `POST /api/requests/{id}/decide` | JWT, `requests.approve.team` | body: `{stage:"BranchManager", decision:"Approved"\|"Rejected", comment?}` | request with `status:"Pending HR"` (approve) or `"Rejected Pending HR"` (reject) | Inline Approve/Reject on member request | EXISTING |

---

### 15. Team/Branch Schedule (`renderTeamSchedule` + paint/create/publish actions)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 15.1 | `GET /api/gyms/{gymId}/shift-cycles` | JWT, `schedule.view.team` | query: `month=YYYY-MM` (Jan–Dec window) | `{items:[{id,start,end,label,days:[{iso,num,dow}],custom:bool,published:bool,employeeCount}]}` — status badge Draft/Published/Custom | Month dropdown, period strip, period stats | EXISTING (path) |
| 15.2 | `GET /api/shift-cycles/{id}` | JWT, `schedule.view.team` | — | `{id,start,end,label,days:[{iso,num,dow}],assignments:{ [employeeId]: [shiftTemplateId per day] },shiftTemplates:[{id,name,start,end,color,bgColor,textColor,isOff}]}` | Roster grid (desktop + mobile), assigned-count stats, member weekly schedule (14.5) | EXISTING |
| 15.3 | `POST /api/gyms/{gymId}/shift-cycles` | JWT, `schedule.manage` | body: `{startDate (cs-start), endDate (cs-end)}` | created cycle (as 15.1 item) | "Create New Schedule" modal → Create Schedule | EXISTING |
| 15.4 | `PUT /api/shift-cycles/{id}/assignments` | JWT, `schedule.manage` | body: `{assignments:[{employeeId,date,shiftTemplateId}]}` (cell paint, drag-paint, Fill row/day/All, Reset → auto-draft, delete → all `st-off`) | updated assignments | paint/fill/reset/delete actions, Shift Management grid cells | EXISTING |
| 15.5 | `POST /api/shift-cycles/{id}/publish` | JWT, `schedule.manage` | — | cycle with `published:true` | Publish button (also from Shift Management header) | EXISTING |
| 15.6 | `DELETE /api/shift-cycles/{id}` | JWT, `schedule.manage` | — | ok | "Delete Schedule" (sets all shifts OFF) | **NEW** |
| 15.7 | `GET /api/teams/{teamId}/unscheduled-count` | JWT, `schedule.view.team` | — | `{count}` (members whose roster is empty/all-OFF) | Team Schedule sidebar badge "unscheduled" | **NEW** (or fold into 13.2) |

---

### 16. Shift Management (`renderShiftManagement`, template modals)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 16.1 | `GET /api/gyms/{gymId}/shift-templates` | JWT, `schedule.view` | — | `{items:[{id,name,start,end,color,bgColor,textColor,isOff}]}` | Palette, grid rendering, stats | EXISTING |
| 16.2 | `POST /api/gyms/{gymId}/shift-templates` | JWT, `schedule.manage` | body: `{name, start, end, color, isOff}` (`bgColor`/`textColor` derived) | created template | "Create Shift Template" modal → Create Template | EXISTING |
| 16.3 | `PUT /api/gyms/{gymId}/shift-templates/{id}` | JWT, `schedule.manage` | body: `{name, start, end, color, isOff}` | updated template | "Edit Shift Template" → Save Changes | **NEW** |
| 16.4 | `DELETE /api/gyms/{gymId}/shift-templates/{id}` | JWT, `schedule.manage` | — | ok (cells reassign to Off Day) | Delete Template → confirm | **NEW** |
| 16.5 | Grid paint / cycle cell | JWT, `schedule.manage` | `PUT /api/shift-cycles/{id}/assignments` body as 15.4 | updated | `paintShift` cell clicks | EXISTING |
| 16.6 | `POST /api/shift-cycles/{id}/copy-previous` | JWT, `schedule.manage` | — | updated assignments | "Copy Previous" quick action | EXISTING |
| 16.7 | `PUT /api/shift-cycles/{id}` (draft) | JWT, `schedule.manage` | body: draft assignments | cycle | "Save Draft" | EXISTING |
| 16.8 | `GET /api/gyms/{gymId}/shift-cycles/{id}/utilization` (or fold into 15.2) | JWT, `schedule.view` | — | `{totalHours, utilization, shiftCounts:{templateId}, offCount, perEmployee:[{employeeId,hours}]}` | CYCLE UTILIZATION stats + per-row hours bars | **NEW** (computable client-side from 15.2 — optional) |

---

### 17. Team Requests / Requests Management (`renderTeamRequests` = `renderRequestsManagement`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 17.1 | `GET /api/requests` | JWT, `requests.view.team` (TL) / `requests.view` (BM) | query: `status, type, dateFrom, dateTo, teamId, page, pageSize` (filters per guide §5) | `{items:[{id,employee,type,date,submitted,status,reason,teamApprovedBy,teamApprovedDate,hrApprovedBy,hrApprovedDate,teamRejectedBy,teamRejectedDate,hrRejectedBy,hrRejectedDate,rejectionReason,rejectionType}], …pager}` — statuses `Pending, Pending HR, Rejected Pending HR, Approved, Rejected` | Tabs NEED ACTION / PENDING HR / APPROVED / REJECTED, rows, sidebar badge | EXISTING (path; team-scoped query is the extension) |
| 17.2 | `POST /api/requests/{id}/decide` | JWT, `requests.approve.team` | body: `{stage:"BranchManager", decision, comment}` — `comment` from "Rejection reason (optional)" textarea | updated request (+ stage fields) | Approve / Reject → "Reject Request" modal | EXISTING |
| 17.3 | `PUT /api/requests/{id}` | JWT, `requests.approve.team` | body: `{type, date, reason}` (edit modal: Type select incl. `Sick Leave`, Date, Reason / Note) | updated request (still needs HR) | Edit → Save Changes | **NEW** |
| 17.4 | `GET /api/requests/{id}` | JWT, requester or approver | — | detail incl. timeline fields above (timeline built from `Submitted / Team Leader Approved\|Rejected / HR Approved\|Rejected / expired` + pending step) | "View" → Request Review modal | EXISTING |
| 17.5 | `POST /api/requests/{id}/comments` | JWT, `requests.view`+ | body: `{comment}` | created comment | Comment modal → Post Comment (`openRequestComment`, dormant in mock) | **NEW** |

---

### 18. Team Performance (`renderTeamPerformance`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 18.1 | `GET /api/teams/{teamId}/evaluations` | JWT, `evaluations.view.team` | query: `period` (`Q2 2026`, `Q1 2026`) | `{items:[{id,employee,position,period,score,result,status}]}` — `result ∈ Exceeds,Meets,Below` | Table (Employee, Period, Score, Result, Status), mobile cards, stats (avg/exceeds/meets/below), sidebar badge (`evaluations.view` on own evals) | **NEW** |
| 18.2 | Create / edit / detail | as 14.6 / 14.7 | — | — | New Evaluation, Detail, Edit modals | see 14.6, 14.7 |

---

### 19. Team Actions / "Team Updates" (`renderTeamUpdates`)

Uses 13.6 (list), 13.7 (Action modal), and the Branch Actions palette (§20). "Take Action" → `openBranchActions()`.

---

### 20. Branch Actions palette (`openBranchActions`, `branchHrQueue`, deduction/warning/bonus/report modals)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 20.1 | `POST /api/deduction-candidates` | JWT, `attendance.edit` | body: `{employee, amount, date, reason, note}` — reason select: `Unapproved absence, Late arrival (30+ min), Early checkout without approval, Damaged equipment / property, Policy violation, Other (see note)`; `issuedBy`,`status:"Pending HR"` server-set | `{id,employee,amount,reason,date,note,issuedBy,status}` | Issue Deduction modal → Send to HR | **NEW** (docs only have list + HR review) |
| 20.2 | `GET /api/deduction-candidates` | JWT, `attendance.edit`/HR `payroll.view` | query: `status` | items as 20.1 | "Awaiting HR" merged queue | EXISTING |
| 20.3 | `POST /api/warning-notices` | JWT, `employees.edit` | body: `{employee, type, date, reason, note}` — `type` select: `Attendance, Conduct, Performance, Safety, Policy violation` | `{id,employee,type,date,reason,note,issuedBy,status:"Pending HR"}` | Issue Warning Notice → Send to HR | **NEW** |
| 20.4 | `GET /api/warning-notices` | JWT, `employees.edit` | query: `status` | items as 20.3 | Awaiting HR queue | **NEW** |
| 20.5 | `POST /api/bonus-proposals` | JWT, `employees.edit` | body: `{employee, type, amount, date, reason, note}` — `type` select: `Performance Bonus, Overtime Pay, Attendance Reward, Referral Bonus, Other` | `{id,employee,type,amount,date,reason,note,issuedBy,status:"Pending HR"}` | Propose Bonus → Send to HR | **NEW** |
| 20.6 | `GET /api/bonus-proposals` | JWT, `employees.edit` | query: `status` | items as 20.5 | Awaiting HR queue | **NEW** |
| 20.7 | `POST /api/branch-reports` | JWT (any employee action `perm:null` in palette) | body: `{period ("August 2026"), type ("Monthly branch summary"\|"Attendance exceptions"\|"Incident report"\|"Request escalations"), message}` | created report | Send Report to HR modal | **NEW** |
| 20.8 | Palette queue badge | JWT | `GET` 20.2/20.4/20.6 filtered `status=Pending HR` | counts | Sidebar "Actions" badge `awaiting HR` | see above |

---

### 21. Employees (`renderEmployees`, CRUD modals)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 21.1 | `GET /api/employees` | JWT, `employees.view` | query: `gymId, q, position, status, page, pageSize` | `{items:[{id,name,position,shift,status,initials,todayShift:{name,start,end,isOff}}], …pager}` — `status ∈ Active, On Leave, Suspended, Terminated`; live badge (`On Shift/Upcoming/Shift Ended/Off/…`) derived client-side from shift + server `now` | Directory table (Employee, Position, Shift (Today), Status), mobile cards, stats, sidebar badge (status ≠ Active) | EXISTING |
| 21.2 | `POST /api/employees` | JWT, `employees.create` | body: `{name, position}` — position select: `Trainer, Receptionist, Cleaner, Maintenance` | created `{id,name,position,status:"Active",initials}` | New Employee modal → Add Employee | EXISTING |
| 21.3 | `PUT /api/employees/{id}` | JWT, `employees.edit` | body: `{name, position, status}` | updated employee | Edit modal → Save Changes | EXISTING |
| 21.4 | `POST /api/employees/{id}/status-change` | JWT, `employees.status.change` | body: `{status, note}` — status select `Active, On Leave, Suspended, Terminated`; note textarea optional | updated + history event | Change Status modal → Update Status | EXISTING |
| 21.5 | `GET /api/employees/{id}` | JWT, `employees.view` | — | §2.1 | Row click → profile (routes to team-member-profile when mapped) | EXISTING |

---

### 22. Attendance Management (`renderAttendanceManagement`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 22.1 | `GET /api/attendance` | JWT, `attendance.view` | query: `gymId, date/range (Today\|This Week\|This Month), status, page, pageSize` | `{items:[{id,name,position,status,checkIn,initials,lateMinutes}], summary:{present,late,absent,...}}` — `status ∈ Present,Late,Absent` | Stats, LATE CHECK-INS list (name, position, checkIn), ABSENT list, sidebar badge | EXISTING |
| 22.2 | "Follow Up" (late row) | JWT, `attendance.edit` | `POST /api/teams/follow-ups` (§13.5) or toast-only | — | Follow Up button (toast in mock) | see 13.5 |
| 22.3 | "Mark Absent" | JWT, `attendance.edit` | `POST /api/attendance/manual` body `{employeeId,gymId,timestamp,reason,direction}` | record | Mark Absent button (toast in mock) | EXISTING (docs) |
| 22.4 | Correct Attendance action | JWT, `attendance.edit` | navigates to this page; actual corrections are `PUT /api/attendance/{id}/correct` (HR) + employee request workflow (§7.3 `correction` type) | — | Branch Actions → Correct Attendance | EXISTING |

---

### 23. Recruitment (`renderRecruitment`, `openRecruitmentDetail`, `openNewRecruitment`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 23.1 | `GET /api/vacancy-requests` | JWT, `recruitment.vacancy_request.create` (own gym) | query: `gymId, status` | `{items:[{id,position,count,urgency,status,date,requestedBy,department,reason,timeline,candidates}]}` — status `Submitted\|Pending\|Approved\|Rejected`; urgency `High\|Medium\|Low` | Stats (Open Positions/Submitted/Pending/Approved), pipeline, request cards, sidebar badge | EXISTING |
| 23.2 | `POST /api/vacancy-requests` | JWT, `recruitment.vacancy_request.create` | body: `{position, count, urgency, department, reason}` — department select `Training, Front Desk, Facilities, Maintenance` | created `{…,status:"Submitted",requestedBy,date,candidates:0}` | New Recruitment Request modal → Submit | EXISTING |
| 23.3 | `GET /api/vacancy-requests/{id}` | JWT | — | as 23.1 item (+ full fields) | Detail modal (Positions, Department, Requested By, Requested On, Reason, Timeline) | **NEW** (no detail route in docs) |

---

### 24. Employee Leaving (`renderLeaving`, `openNewLeaving`)

| # | Method + Path | Auth / Permission | Request | Response | Caller | Status |
|---|---|---|---|---|---|---|
| 24.1 | `GET /api/offboarding-requests` | JWT, `employees.offboard` | query: `gymId, status` | `{items:[{id,employee,position,lastDay,status,reason}]}` — status `Notice Period` (+ `Draft/Cancelled` per badge map) | List cards, sidebar badge (count) | **NEW** |
| 24.2 | `POST /api/employees/{id}/offboard` | JWT, `employees.offboard` | body: `{lastWorkingDay (date), reason (textarea)}`; employee chosen from select (maps to id) | created offboarding request (24.1 item) | Initiate Employee Leaving modal → Initiate Leaving | EXISTING |

---

### Cross-cutting notes

1. **Statuses the backend must emit** (badge map in `core.js`): `On Time, Present, Approved, Valid, Paid, Completed, Published, Late, Pending, Processing, Expiring Soon, Pending HR, Rejected Pending HR, Absent, Rejected, Early Checkout, Off, Cancelled, Submitted, Notice Period, Draft`.
2. **Sidebar/header badges** (`computePendingActions`) are all derivable from: 10.1 (`status=Pending`), 3.1+3.2 (doc statuses), 6.1 (attendance statuses), 4.1 (`urgent`), 11.2, 13.6, 15.7, 17.1, 21.1, 22.1, 8.1 (`Processing`), 9.1/18.1 (`status≠Completed`), 23.1 (`Pending|Submitted`), 24.1, 20.2/20.4/20.6 (`Pending HR`).
3. **Two-stage workflow** (guide §5, UI statuses): employee `POST /api/requests` → TL/BM `POST /api/requests/{id}/decide {stage:"BranchManager"}` → `Pending HR` → HR `decide {stage:"HR"}` final. Deduction/Warning/Bonus/Vacancy follow the same "→ HR" pattern (20.x, 23.2).
4. **NEW endpoints summary (not in docs):** employee contact/emergency/photo updates (2.2–2.4), required-documents & HR-documents lists + downloads (3.2, 3.3, 3.5, 3.6), employee events projection (4.1 payload), leave balance (6.2), employee schedule view (7.1), request-types config (7.2), payslip download (8.3), request cancel/attachment (10.4, 10.5), change-password + settings/preferences (12.1–12.3), team today overview (13.2), reminders/messages/follow-ups (13.4–13.8), team evaluation update (14.7), cycle delete + unscheduled count (15.6, 15.7), shift-template update/delete (16.3, 16.4), utilization (16.8, optional), request PUT/comments (17.3, 17.5), team evaluations list (18.1), deduction/warning/bonus create+list (20.1, 20.3–20.6), branch reports (20.7), vacancy detail (23.3), offboarding list (24.1).
5. **UI-only stubs (no API required / optional):** profile Personal Info edit & Employment Info (read-only), "Copy Previous"-style toast-only buttons beyond 16.6, dormant helpers (`addTeamFollowUp`, `openMemberRequests/Schedule/Attendance`, `openRequestComment`, `renderTeamOverview`, `futureRequests`), prototype role switcher/Show-All toolbar (demo-only).

---

## Section 4 - HR Portal - Dashboard, Employees, Attendance, Schedule, Requests, Branch Queue, HR Team

**Scope:** `Mock UI/HR` — app.js, core.js, data.js, pages-dashboard, pages-employees, pages-attendance, pages-schedule, pages-requests, pages-branch-queue, pages-hr-team, index.html
**Marked against:** `docs/architecture/api.md`

---

### 0. Page / Route Inventory (app.js + core.js + index.html)

| Route id | Renderer | File | Nav permission |
|---|---|---|---|
| dashboard | renderDashboard | pages-dashboard.js | — |
| employees | renderEmployees (directory/profile) | pages-employees.js | `employees.view` |
| terminations | renderTerminations | pages-employees.js | `employees.view` |
| attendance | renderAttendance | pages-attendance.js | `attendance.view` |
| requests | renderRequests | pages-requests.js | `requests.view` |
| branch-queue | renderRequests alias→renderBranchQueue | pages-branch-queue.js | — (badge always shown) |
| hr-team | renderHRTeam | pages-hr-team.js | `team.view` / `team.manage` |
| *(others: recruitment, payroll, evaluations, form-builder, reports, positions, notifications, audit, events, my-access — other agents)* | | | |

**Shell/global UI (index.html, core.js):**
- Gym-picker overlay: per-branch card `{id,name,branch,staffCount}` + "Required Actions" badge (`total`, `summaryText`, tags "N requests/vacancies/events/action requests"); "All Branches Combined" card.
- Header: gym-switcher chip, notification bell + dropdown (`id,title,description,date,read,color,category,link`), user menu (`fullName,email,initials,role,position`), Logout, My Access.
- Nav badges (computePendingActions): employees≠Active, attendance Late/Arrived, requests Pending HR Review, branch-queue pending, recruitment pending vacancies, payroll pending deductions, evaluations in-progress, terminations non-completed, notifications unread, events high-urgency, hr-team suspended.
- Demo role switcher (prototype only — not an API).

#### Global / session APIs

| # | Endpoint | Auth + Permission | Request | Response (fields UI renders) | Called by | Mark |
|---|---|---|---|---|---|---|
| G1 | `GET /api/auth/me` | Bearer, any authenticated | — | `{ id, firstName, lastName, fullName, email, phone, initials, position, level, role, permissions[], gyms:[{id,name,branch}], selectedGym, hireDate, employmentType, status }` | header, sidebar, gym picker, `hasPermission()` | **NEW** (api.md only defines login/refresh/logout; login `user{}` lacks name/gyms/permissions detail needed here) |
| G2 | `POST /api/auth/logout` | Bearer | — | `{ message }` | user menu / sidebar Logout | EXISTING |
| G3 | `GET /api/gyms` | Bearer, gym-scoped | — | items `[{ id, name, branch, employees }]` (staff count per branch) | gym picker, dashboard KPI (totalGyms), gyms-overview modal, branches panel, employee/attendance filters | EXISTING |
| G4 | `GET /api/gyms/{id}/required-actions` | Bearer, `requests.approve`-ish (aggregated) | — | `{ total, requestsCount, vacanciesCount, urgentEventsCount, actionRequestsCount, summaryText }` (mock: `getGymRequiredActions`) | gym picker badges, header chip badge, dashboard branches panel + modal | **NEW** (can alternatively be composed client-side from G5/G6/G7/G8 lists) |
| G5 | `GET /api/notifications` | Bearer, `announcements.view` | query: `page,pageSize,unreadOnly` | items `[{ id, category, title, description, date, read, color, link }]` | bell dropdown | EXISTING |
| G6 | `PUT /api/notifications/{id}/read` | Bearer | — | 200 | bell item click (`notifDdOpenItem`) | EXISTING |
| G7 | `PUT /api/notifications/read-all` | Bearer | — | `{ message }` | bell "show all/read all" | EXISTING |
| G8 | `GET /api/notifications/unread-count` | Bearer | — | `{ count }` | header/nav dot badge | EXISTING |

---

### 1. Dashboard (pages-dashboard.js)

**Screens:** KPI strip (Gym Branches, Total Staff, Pending Requests, Actions Needed), "Actions You Need To Take" panel with filter tabs `All / Requests / Vacancies / Branch` and per-card `Approve / Decline / Review`, Fast Actions grid (Create Account, Change Password, Hiring Form, Evaluation Form, See Requests, Announcement), Branches Overview list (branch, staff count, action badge, click=filter), gym selector, Export CSV button.
**Modals:** Create New Employee Account, Change Password & System Access, Create Hiring/Application Form, Create Evaluation Form, Gyms Overview, Review Vacancy Request, Contract & Level Adjustment, Candidate Interview Dossier.
**Data read:** requests, vacancyRequests, events (`Contract Expiry`,`Document Expiry`,`PayrollApproval`), actionRequests, branch-queue pending, gymList, employees, roleTemplates, candidates/interviews.

| # | Endpoint | Auth + Permission | Request | Response | Called by | Mark |
|---|---|---|---|---|---|---|
| D1 | `GET /api/dashboard/hr` | Bearer, `dashboard.view`/HR | query: `gymId` (`all` or branch id) | `{ totalGyms, totalStaff, pendingRequests, actionsNeeded }` (KPI strip; panel items may be composed from D2–D5 instead) | renderDashboard KPI strip | EXISTING |
| D2 | `GET /api/requests` | Bearer, `requests.view` | query: `status=PendingHRReview`, `gym`, `page,pageSize` | items `[{ id, employee, gym, type, submittedDate, requestedDate, status, bmDecision, bmComment, reason, timeline[{step,date,done}] }]` | dashboard action cards (request type); also Requests page | EXISTING |
| D3 | `GET /api/vacancy-requests` | Bearer, `recruitment.view` | query: `status=Pending`, `gym` | items `[{ id, position, gym, urgency, status, submittedBy, submittedDate, reason, salary, shift, headcount }]` | dashboard vacancy cards, `openVacancyRequestModal` | EXISTING |
| D4 | `PUT /api/vacancy-requests/{id}/decide` | Bearer, `recruitment.vacancy_request.approve` | body `{ decision: "Approved"\|"Rejected", positionId?, headcount?, salary?, shift? }` (approve opens the Vacancy) | `{ message, item, vacancy? }` | `approveVacancyRequest` / `rejectVacancyRequest` / `quickApproveVacancy` | EXISTING |
| D5 | `GET /api/events` | Bearer, `events.view` | query: `gym`, `status=Open` | items `[{ id, tab, type, title, date, urgency, branch, detail, permission, …type-specific: requestId/employee/employeeId/docType/docNo/expiresOn/editableByEmployee, separationId/lastDay/reason/checklistDone/checklistTotal, vacancyRequestId/position/headcount, period/grossTotal/netTotal/pendingDeductions }]` | dashboard expiring contracts + payroll approval cards | EXISTING |
| D6 | `GET /api/employee-action-requests` | Bearer, holder of the mapped perm (e.g. `employees.transfer`, `employees.compensation.manage`, `employees.role.assign`, `employees.offboard`, `employees.bulk_import`) | query: `status=Pending`, `gym` | items `[{ id, employeeId, employee, position, actionType, proposedDetails{fromGym,toGym,effectiveDate\|currentSalary,newSalary,effectiveDate\|systemRole\|lastDay,reason\|source}, justification, requestedBy, status, submittedDate, reviewedBy, reviewedDate, reviewComment }]` | dashboard "action" cards (`pendingActionRequests`) | **NEW** |
| D7 | `POST /api/employee-action-requests/{id}/approve` | Bearer, mapped direct perm | — | `{ message }` (executes transfer/compensation/role/offboard/bulk-import, audit-logged) | `approveActionRequest` (dashboard Review/Approve) | **NEW** |
| D8 | `POST /api/employee-action-requests/{id}/reject` | Bearer, mapped direct perm | body `{ comment }` (required) | `{ message }` | `rejectActionRequest` (dashboard Decline) | **NEW** |
| D9 | `GET /api/branch-submissions` | Bearer, HR | query: `status=PendingHR`, `kind=Deduction\|Warning\|Bonus` | items `[{ id, kind, employee, title, amount, note, issuedBy, gym, date, status, decidedBy, decidedNote }]` | dashboard branch cards (`branchQueuePending`), Branch Queue page | **NEW** |
| D10 | `POST /api/branch-submissions/{id}/decide` | Bearer, `requests.approve` | body `{ decision: "Approved"\|"Rejected", note }` (decline requires note) | `{ message }` — server applies approved deduction/bonus to payroll | `approveBranchItem` / `declineBranchItem` | **NEW** |
| D11 | `POST /api/employees` | Bearer, `employees.create` | body `{ code, name, position, level, phone, email, hireDate, salary, role, branches[] ("all"\|branch names), password, facePhoto (base64 jpeg) }` | `{ data:{ id, name, position, level, gym, status, initials, hireDate, salary, phone, email, role, branches[], facePhoto } }` | `openCreateAccountModal` → `submitNewAccount` | EXISTING (endpoint; `password`,`branches`,`facePhoto` are UI fields the contract must carry) |
| D12 | `POST /api/users/{id}/reset-password` + `PUT /api/users/{id}/permissions` | Bearer, `team.manage`/admin | body `{ newPassword }` / `{ permissions[] }` | `{ message }` | Change Password & Access modal (`submitPasswordChange`), checkboxes: Portal Login Access, Submit Requests, Approve Team Requests, View Attendance Logs | EXISTING |
| D13 | `POST /api/vacancies` (hiring form publish) | Bearer, `recruitment.vacancies.manage` | body `{ position, gym, employmentType, headcount, applicationFields[] }` (fields: Full Name & Phone, CV/Resume Upload, Years of Experience, Expected Salary, Fitness Certifications, Shift Availability) | `{ data:{ id, position, gym, headcount, status:'Open' } }` | `openCreateHiringFormModal` → `submitHiringForm` | EXISTING (endpoint; `employmentType`/`applicationFields` noted as UI-only inputs) |
| D14 | `POST /api/evaluation-forms` | Bearer, `evaluations.manage`/`evaluations.forms.manage` | body `{ title, cycle, role, evaluator, competencies[] }` (`Attendance & Punctuality`, `Job Knowledge & Skills`, `Member Satisfaction & Service`, `Teamwork & Initiative`) | `{ data:{ id, title, status } }` | `openCreateEvaluationFormModal` → `submitEvaluationForm` | EXISTING |
| D15 | `GET /api/candidates` + `GET /api/candidates/{id}` | Bearer, `recruitment.candidates.manage` | query: `stage`, `blocked` | items `[{ id, name, position, stage, rating, phone, appliedDate, blocked, blockReason, form{gymPref,email,expYears,salaryExp,skills[]} }]` | `openCandidateInterviewDossier` (dashboard) | EXISTING |
| D16 | `PUT /api/applications/{id}/stage` | Bearer, `recruitment.candidates.manage` | body `{ stage }` (`Applied→Screening→First Interview→Second Interview→Accepted→Hired`) | `{ message }` | `advanceCandidateStage` (Pass to X) | EXISTING |
| D17 | `POST /api/applications/{id}/hire` | Bearer, `recruitment.hire.approve` | body `{ salary?, gym? }` | `{ data:{ employeeId } }` | `hireCandidateDirectly` (Make Job Offer & Hire) | EXISTING |
| D18 | `POST /api/employees/{id}/position-change` + `POST /api/employees/{id}/compensation` | Bearer, `employees.position.change` / `employees.compensation.manage` | body `{ level }` / `{ salary }` | `{ message }` | Contract & Level Adjustment modal (`applyContractRenewal`) | EXISTING |
| D19 | CSV export (Executive Summary, client-side) | — | — | — | `exportMonthlyHRReport` | no API (browser download) |

---

### 2. Employees (pages-employees.js — directory + profile)

**Directory screen:** filters `search`, `All Gyms` (branch), `All Statuses` (Active/On Leave/Notice Period/Suspended); status pills (Active/Leave/Notice/Suspended); table columns **Employee (name, id, initials) | Position | Level | Gym | Status | ›**; buttons **Bulk Import**, **Add Employee**; mobile cards; "Blocked from hiring" strip (Profile/Restore — recruitment scope); lifecycle footer (Transfer Gym / Compensation / Offboard / Role Assignment or their "Request …" variants).

**Profile screen:** header (name, status, position, level, gym, hireDate) + lifecycle buttons; tabs: Personal Info, Documents, Employment History, Attendance Summary, Current Shift, Requests History, Leave Balance, Evaluations History, Payroll Snapshot.

| # | Endpoint | Auth + Permission | Request | Response | Called by | Mark |
|---|---|---|---|---|---|---|
| E1 | `GET /api/employees` | Bearer, `employees.view`, gym-scoped | query: `searchTerm` (name), `gym` (branch), `status`, `page,pageSize,sortBy,sortOrder` | pagination envelope; items `[{ id, name, position, level, gym, status, initials, hireDate, salary, phone, email, leaveTaken? }]` | directory list, filters, status pills | EXISTING |
| E2 | `POST /api/employees` | Bearer, `employees.create` | body `{ firstName, lastName, email, phone, position, level, salary, gym, startDate }` | `{ data:{ id, name, position, level, gym, status:'Active', initials, hireDate, salary, phone, email } }` | Add Employee modal (`submitAddEmployee`) | EXISTING |
| E3 | `POST /api/employees/bulk-import` | Bearer, `employees.bulk_import` | multipart/form-data `{ file }` — CSV columns `name, email, position, level, gym, salary` | `{ message, added, skipped }` | Bulk Import modal | EXISTING |
| E4 | `GET /api/employees/{id}` | Bearer, `employees.view` | — | `{ data:{ id, name, position, level, gym, status, initials, hireDate, email, phone, salary, systemRole?, branches? } }` | `renderEmployeeProfile` Personal Info | EXISTING |
| E5 | `GET /api/employees/{id}/documents` + `POST /api/employees/{id}/documents` | Bearer, `employees.documents.view` / `.manage` | GET —; POST multipart `{ file, category }` | items `[{ name, category, status }]` (Employment Contract/Identification/Personal Photo/First Aid Certification/Medical Fitness Certificate/Degree Certificate; status `Valid`\|`Expiring Soon`) | Documents tab, Upload Document | EXISTING |
| E6 | `GET /api/employees/{id}/history` | Bearer, `employees.view` | — | items `[{ type, from, to, date, detail }]` (`Position Changed`, `Gym Transfer`, `Joined Revive`) | Employment History tab | EXISTING |
| E7 | `GET /api/employees/{id}/attendance` | Bearer, `attendance.view` | query: `dateFrom,dateTo` (default last 30 days / month) | items `[{ date, shift, checkIn, checkOut, status }]` + `{ rate, present, late, absent }` | Attendance Summary tab (rate 96.4%, Present/Late/Absent, day rows) | EXISTING |
| E8 | `GET /api/employees/{id}/requests` | Bearer, `requests.view` | — | items `[{ id, type, requestedDate, submittedDate, status, reason }]` | Requests History tab | EXISTING |
| E9 | `GET /api/employees/{id}/leave-balance` | Bearer, `employees.view` | — | `{ employeeId, dayOff:{used,total}, sick:{used,total}, unpaid:{used,total} }` | Leave Balance tab (Annual 10/21, Sick 3/10, Unpaid 0/5), view-only without manage | **NEW** |
| E10 | `PUT /api/employees/{id}/leave-balance` | Bearer, `employees.leave_balance.manage` | body `{ dayOff:{used,total}, sick:{used,total}, unpaid:{used,total} }` | `{ message }` | Leave Balance tab "Edit Balance" | **NEW** |
| E11 | `GET /api/employees/{id}/evaluations` | Bearer, `evaluations.view` | — | items `[{ period, score, result }]` (`Q2 2026`,`4.2`,`Exceeds`) | Evaluations History tab | EXISTING |
| E12 | `GET /api/employees/{id}/payroll` | Bearer, `payroll.view` | — | items `[{ period, net }]` (`July 2026`, `12400`) | Payroll Snapshot tab | EXISTING |
| E13 | `GET /api/shift-cycles/{id}` (+ `GET /api/gyms/{gymId}/shift-cycles`) | Bearer, `schedule.view` | — | cycle detail with `assignments[]` + `shiftTemplates[]` — used to render "Current Shift" tab (`Morning · 08:00–16:00`, week Sep 7–13, 7-day pattern) | Current Shift tab | EXISTING (composed; no dedicated per-employee schedule endpoint) |
| E14 | `POST /api/employees/{id}/transfer` | Bearer, `employees.transfer` | body `{ toGym, effectiveDate, reason }` | `{ message }` | profile "Transfer Gym" (simulated today) | EXISTING |
| E15 | `POST /api/employees/{id}/position-change` | Bearer, `employees.position.change` | body `{ position?, level }` | `{ message }` | profile "Change Position" | EXISTING |
| E16 | `POST /api/employees/{id}/role-change` | Bearer, `employees.role.assign` | body `{ systemRole, permissions[] }` (UI: None (Employee)\|Branch Manager\|Team Leader + toggles: view team attendance, approve team requests, manage team schedule, evaluate team members) | `{ message }` | `openChangeRole` | EXISTING |
| E17 | `POST /api/employees/{id}/compensation` | Bearer, `employees.compensation.manage` | body `{ salary, effectiveDate }` | `{ message }` | profile "Manage Compensation" | EXISTING |
| E18 | `POST /api/employees/{id}/contract` | Bearer, `employees.contract.manage` | body `{ level?, salary?, effectiveDate? }` | `{ message }` | profile contract action | EXISTING |
| E19 | `POST /api/employees/{id}/offboard` | Bearer, `employees.offboard` | body `{ lastDay, reason, notes }` | `{ data:{ separationId } }` | "+ Initiate Offboarding" modal (`submitInitiateOffboarding`), profile "Offboard" | EXISTING |
| E20 | `POST /api/employee-action-requests` | Bearer, `employees.request_action` (HR preset) | body `{ employeeId, actionType: "Transfer"\|"CompensationChange"\|"RoleAssign"\|"Offboard"\|"BulkImport", proposedDetails{ fromGym,toGym,effectiveDate \| currentSalary,newSalary,effectiveDate \| systemRole \| lastDay,reason \| source }, justification }` | `{ data:{ id, status:'Pending' } }` | "Request Transfer" / "Request Compensation" / "Request Role" / "Request Offboard" / "Request Bulk Import" (`openActionRequest`, `submitTransferRequest`, `submitBulkImport` request variant) | **NEW** |
| E21 | `GET /api/candidates?blocked=true` | Bearer, `recruitment.candidates.manage` | query `blocked=true` | items `[{ id, name, position, stage, blocked, blockReason }]` | "Blocked from hiring" strip (Profile/Restore) | EXISTING (endpoint; `blocked` filter/restore action belongs to recruitment scope) |

---

### 3. Terminations (renderTerminations / offboarding — inside pages-employees.js)

**Screens:** gym filter pills (`all / Nasr City / Heliopolis / 6th October`), 5 stage stat tiles (Requested, Notice Period, Exit In Progress, Under Review, Completed), kanban of `_sepCard` (employee, position, gym pill, requestedBy/requestedByUser, submittedDate, reason, lastDay, notice days left, checklist progress `done/total` + %, leave-settlement chip, verdict chips, **‹/› move stage**, **Manage · View data**), buttons **+ Request Termination (BM)**, **+ Initiate Offboarding** / **+ Request Offboard**.
**Modal "Leaving — {employee}"** tabs:
- *Exit Workflow*: requester line, notice block (lastDay/daysLeft/reason), 5 checklist toggles (Exit interview scheduled, Handover completed, Uniform returned, Access cards revoked, Final settlement), Exit Verdict form (`sep-v-reason`, `sep-v-settle` none|owedToEmployee|employeeOwes, `sep-v-amount`, `sep-v-settle-note`, `sep-v-rehire` Eligible|Banned, `sep-v-rehire-note`), **Finalize Separation ✓**.
- *Employee Data*: pay statement (editable `gross`, deductions list `{id,date,label,amount,reason,status}`, add/remove deduction, net), requests list, employment history, attendance last-30 (Present/Late/Absent), annual-leave settlement (entitlement 21, accrued, taken, balance).

| # | Endpoint | Auth + Permission | Request | Response | Called by | Mark |
|---|---|---|---|---|---|---|
| T1 | `GET /api/separations` | Bearer, `employees.view`, gym-scoped | query: `gym`, `status`, `page,pageSize` | items `[{ id, employee, position, gym, lastDay, reason, requestedBy, requestedByUser, submittedDate, status, progress, checklist:[[label,done]×5], verdict:{ finalReason, settlement:{direction,amount,note}, rehire:{status,note} }, leaveTaken? }]` | pipeline strip + kanban cards | **NEW** (api.md only has `POST /api/employees/{id}/offboard` — no list/detail) |
| T2 | `POST /api/separations` (BM termination request) | Bearer, Branch Manager (or HR acting for BM) | body `{ employeeId, lastDay, reason, notes }` (reason enum: Performance issues, Attendance violations, Misconduct/policy breach, Contract expiry — not renewing, Restructuring/Redundancy) | `{ data:{ id, status:'Requested' } }` | "+ Request Termination (BM)" (`submitRequestTermination`) | **NEW** (distinct from E19 which is HR-initiated) |
| T3 | `PUT /api/separations/{id}/checklist` | Bearer, `employees.offboard` (or BM-originated handoff) | body `{ index, done }` (or `items:[{index,done}]`) | `{ data:{ progress, status } }` (first tick moves status → `Exit In Progress`) | checklist toggles (`toggleSepChecklist`) | **NEW** |
| T4 | `PUT /api/separations/{id}/stage` | Bearer, `employees.offboard` | body `{ status }` ∈ `Requested\|Notice Period\|Exit In Progress\|Under Review\|Completed` | `{ message }` (Completed ⇒ checklist all true) | ‹/› `moveSeparation` | **NEW** |
| T5 | `PUT /api/separations/{id}/verdict` | Bearer, `employees.offboard` | body `{ finalReason, settlement:{ direction:'none'\|'owedToEmployee'\|'employeeOwes', amount, note }, rehire:{ status:'Eligible'\|'Banned', note } }` | `{ message }` (sets status → `Under Review`) | `saveExitVerdict` | **NEW** |
| T6 | `POST /api/separations/{id}/finalize` | Bearer, `employees.offboard` | — | `{ message }` (requires checklist complete + verdict; archives employee) | `finalizeSeparation` | **NEW** |
| T7 | `PUT /api/employees/{id}/payroll/gross` | Bearer, `payroll.edit` | body `{ gross }` | `{ data:{ gross, deductions, net } }` | `updateSepGross` (Employee Data tab) | **NEW** (api.md has no payroll-line edit beyond deduction-candidate review) |
| T8 | `PUT /api/employees/{id}/payroll/deductions` | Bearer, `payroll.edit` | body `{ op:'add', label, amount, reason }` \| `{ op:'remove', deductionId }` | `{ data:{ deductionLines[], deductions, net } }` (`line: {id,date,label,amount,reason,requestId,status}`) | `addSepDeduction` / `removeSepDeduction` | **NEW** |
| T9 | `GET /api/employees/{id}/requests`, `GET /api/employees/{id}/attendance`, `GET /api/employees/{id}/history` | Bearer | as E6–E8 | as above | Employee Data tab blocks | EXISTING |
| T10 | Resignation-approval hook: approving a `Resignation` request may return `{ offboardingPrompt: true, separationId }` → client then calls T-cascade | `requests.approve` | — | — | `applyRequestDecision` → `triggerOffboardingFromRequest` | uses E19/T2 |

---

### 4. Attendance (pages-attendance.js)

**Screens:** Toolbar (month nav ‹ ›, `Today`, gym select `All Gyms|{branches}`, **Export**, **Pair Kiosk**, **Manual Entry**), day KPI tiles (Present n/total, On Time, Late, Absent, Off Day, Requests, Rate ▲▼), day panel (date header, prev/next day, requests banner, segmented filter `All|Exceptions|With request`, search, table **Employee | Shift | Status(+notes) | Check-in(+Δ late) | Check-out | Hours(+source) | Request (chip + ✓/✕ + Details) | ⋯**, footer Punctuality/Hours logged/Biometric %), month calendar (per-cell present/total bars, late+absent count, request dot, legend), "Repeated issues" list, month foot stats (rate, punctual, late, absent, pending, avg hours).
**Row ⋯ menu:** Correct record…, Mark present, Mark absent, Check out now, Approve/Reject pending request, Open request details.
**Modals:** Attendance Correction, Manual Attendance Entry, Pair Attendance Station (6-digit code), Employee file (Schedule/Attendance/Requests tabs), Late/Absent issues drill-down, plus embedded Request detail/decision modals.

| # | Endpoint | Auth + Permission | Request | Response | Called by | Mark |
|---|---|---|---|---|---|---|
| A1 | `GET /api/attendance` | Bearer, `attendance.view`, gym-scoped | query: `date` (ISO day), `from`,`to` (month range), `gym`/`gymId`, `employeeId`, `status`, `page,pageSize` | items `[{ id, employeeId, name, gym, date, shift, checkIn, checkOut, status: 'On Time'\|'Late'\|'Absent'\|'Early Checkout'\|'Off'\|'Scheduled', source: 'Biometric'\|'Manual', notes, correctedBy?, correctedAt? }]` — client derives `_lateBy`, `_worked`, day/month stats (rate, punctuality, avgHours, per-employee late/absent) | day roster, KPIs, calendar cells, repeated-issues, export | EXISTING |
| A2 | `GET /api/requests?date=` (day requests) | Bearer, `requests.view` | query: `date=YYYY-MM-DD` | items `[{ id, employee, type, requestedDate, status, reason }]` | day panel request banner, Request column chips, conflict flags, month `reqs`/`pending` | EXISTING (endpoint; `date` filter param is what the UI needs) |
| A3 | `POST /api/attendance/manual` | Bearer, `attendance.manual_entry` | body (UI fields) `{ employeeId, date, checkIn, checkOut, status, reason }` (doc contract: `{ employeeId, gymId, timestamp, direction, reason }` — UI needs the check-in/check-out/status form) | 201 `{ data:{ id, ...record } }` | Manual Entry modal (`saveManualEntry`) | EXISTING (note field-shape gap vs api.md) |
| A4 | `PUT /api/attendance/{id}/correct` | Bearer, `attendance.edit` | body `{ checkIn, checkOut, status, reason }` (reason required; `source:'Manual'`, `correctedBy/correctedAt` server-set) | `{ data:{ ...record } }` | Attendance Correction modal (`saveAttendanceCorrection`) | EXISTING (UI adds `status` to body) |
| A5 | Quick marks — `POST /api/attendance/manual` / `PUT /api/attendance/{id}/correct` (reused) | Bearer, `attendance.edit` | `present → { checkIn: shiftStart, status:'On Time', notes:'Marked present manually' }`; `absent → { checkIn:null, checkOut:null, status:'Absent' }`; `checkout → { checkOut: shiftEnd }` + `reason` | as A3/A4 | row menu `attQuickMark` | EXISTING (same endpoints) |
| A6 | `POST /api/requests/{id}/decide` (inline) | Bearer, `requests.approve` | body `{ stage:'HR', decision:'Approved'\|"Rejected", comment }` | `{ message, item }` | inline ✓/✕ in Request cell, row menu approve/reject (`attDecide`) | EXISTING |
| A7 | `GET /api/employees/{id}/attendance` (history tab) | Bearer, `attendance.view` | query `month`, `page` | items `[{ date, shift, checkIn, checkOut, status, notes }]` + totals `{ total,present,late,absent,off,hours,expected }` | Employee file → Attendance tab filters All/Present/Late/Absent/Off | EXISTING |
| A8 | `GET /api/employees/{id}/requests` | Bearer, `requests.view` | — | items `[{ id, type, requestedDate, status, reason, bmComment }]` | Employee file → Requests tab (+ counts pending/approved/rejected) | EXISTING |
| A9 | `GET /api/shift-cycles/{id}` assignments | Bearer, `schedule.view` | — | weekly pattern per employee (7 `shiftTemplateId`s) | Employee file → Schedule tab (week nav, older schedules) | EXISTING (composed) |
| A10 | `POST /api/gyms/{gymId}/biometric-devices/pairing-codes` | Bearer, device admin / `attendance.manual_entry` | body `{ gymId, stationLabel }` | `{ code (6-digit), gymId, gymName, stationLabel, generatedAt, expiresAt }` (valid 10 min; kiosk redeems to bind device → DeviceToken) | Pair Kiosk modal (`generateStationPairingCode`, `copyStationPairingCode`) | **NEW** (doc only registers devices directly, no kiosk pairing-code flow) |
| A11 | Day CSV Export — client-side (`attExportDay`) | — | — | columns: Employee ID, Name, Position, Gym, Shift, Check In, Check Out, Hours, Status, Source, Request | Export button | no API |

---

### 5. Shifts & Schedule (pages-schedule.js)

**Screens:** header (cycle label + status, **New Cycle**, **Copy Previous**, **Publish**), toolbar (cycle selector chips, coverage pills `10/10 Scheduled`, `2 Conflicts`, "Overlapping shifts flagged"), 7 day-cards (Morning/Evening/Night counts, on/off, request badge), day detail panel (per-shift employee rows with In/Out from attendance, Off Day chips, day requests list), legend, All Gyms select, **TEAM ROSTER** table **Employee | Position | Gym | Shift | Hours**.
**Modals:** New Schedule Cycle, Copy Previous Cycle, Publish Schedule, Edit Shift.

| # | Endpoint | Auth + Permission | Request | Response | Called by | Mark |
|---|---|---|---|---|---|---|
| S1 | `GET /api/gyms/{gymId}/shift-cycles` | Bearer, `schedule.view` | — | items `[{ id, label, status:'Draft'\|'Published' }]` | cycle selector chips, header status | EXISTING |
| S2 | `GET /api/shift-cycles/{id}` | Bearer, `schedule.view` | — | `{ id, label, status, shiftTemplates:[{id,name,start,end,color,bgColor,textColor,isOff}], assignments:[{ employeeId, name, position, gym, initials, days:[templateId×7] }], conflicts? }` | calendar, roster, day detail, legend | EXISTING |
| S3 | `POST /api/gyms/{gymId}/shift-cycles` | Bearer, `schedule.manage` | body `{ label, startDate, endDate, gymId }` (UI: "Sep 13 – Sep 22", 2026-09-13, 2026-09-22, gym select) | `{ data:{ id, label, status:'Draft' } }` | New Cycle modal (`openNewCycle` → "Create Draft Cycle") | EXISTING |
| S4 | `POST /api/shift-cycles/{id}/copy-previous` | Bearer, `schedule.manage` | body `{ sourceCycleId? }` | `{ message, copied }` ("Copy 10 employee assignments") | Copy Previous modal | EXISTING |
| S5 | `POST /api/shift-cycles/{id}/publish` | Bearer, `schedule.manage` | — | `{ message }` (warns on unresolved conflicts) | Publish modal ("Publish Now" — notifies employees) | EXISTING |
| S6 | `GET /api/shift-cycles/{id}/conflicts` | Bearer, `schedule.view` | — | `{ conflicts:[{ employeeId, day, message }], count }` | conflict pill "2 Conflicts", publish warning | EXISTING |
| S7 | `PUT /api/shift-cycles/{id}/assignments` | Bearer, `schedule.manage` | body `{ assignments:[{ employeeId, day (0=Mon..6=Sun), shiftTemplateId }] }` | `{ message }` | Edit Shift modal (`editShift` → Save) | EXISTING |
| S8 | `GET /api/gyms/{gymId}/shift-templates` | Bearer, `schedule.view` | — | items `[{ id, name, start, end, color, bgColor, textColor, isOff }]` (Morning/Evening/Night/Off Day) | legend, roster shift chips, Edit Shift select | EXISTING |
| S9 | Day attendance overlay | Bearer, `attendance.view` | `GET /api/attendance?date=` | as A1 | day detail "In/Out" per employee | EXISTING (composed) |
| S10 | Day requests overlay | Bearer, `requests.view` | `GET /api/requests?date=` | as A2 | day detail Requests section, per-day "N req" badge | EXISTING (composed) |

---

### 6. Requests (pages-requests.js)

**Screens:** header + **New Request**; KPI tiles `Urgent — Pending HR`, `Approved (Sept)`, `BM Rejected`, `Balance Alerts` (click = quick filter); type pills (All, Day Off, Sick Leave, Leave Early, Late Arrival, Shift Swap, Resignation, + Deductions/Warnings/Bonuses from branch queue with counts); tabs `Pending HR | Decided | Archived`; **Bulk Approve** button; request cards: avatar+icon, name, status badge, urgency tag (Urgent/Notice Period/BM Rejected/Normal), position·level·gym·tenure, `ID rN` + employee id, rows **Request (type · requestedDate · rel), Reason, BM (decision — comment), Balance (left/total, Paid/Unpaid)**, timeline chips, buttons **Approve / Reject / Undo Decision / Detail / Archive|Restore**; embedded branch-queue cards with Approve/Decline.
**Modals:** Approve/Reject/Undo Decision (payment radio `paid|unpaid`, note textarea, timeline, BM block, balance strip/warn), Request Detail (BM + HR final decision blocks), Bulk Approve balance check, New Request form, offboarding prompt after Resignation approve.

| # | Endpoint | Auth + Permission | Request | Response | Called by | Mark |
|---|---|---|---|---|---|---|
| R1 | `GET /api/requests` | Bearer, `requests.view`, gym-scoped | query: `status=PendingHRReview\|Approved\|Rejected\|Archived`, `type`, `gym`, `date`, `quick=urgent\|bmRejected\|balance`, `page,pageSize,sortBy,sortOrder` | envelope; items `[{ id, employee, gym, type, submittedDate, requestedDate, status:'Pending HR Review'\|'Approved'\|'Rejected'\|'Archived', bmDecision:'Approved'\|'Rejected', bmComment, reason, hrDecision, hrComment, payment:'paid'\|'unpaid', timeline:[{step,date,done}] }]` | list, tabs, KPI counts, type pills | EXISTING |
| R2 | `GET /api/requests/{id}` | Bearer, `requests.view` | — | `{ data: (item as R1, incl. BM-stage decision) }` | `openRequestDetail`, Decision modal, attendance Details | EXISTING |
| R3 | `POST /api/requests/{id}/decide` | Bearer, `requests.approve` | body `{ stage:'HR', decision:'Approved'\|'Rejected', comment, payment:'paid'\|'unpaid' }` (`payment` only for Day Off/Sick Leave when balance exhausted UI forces choice; null otherwise) | `{ message, item }` (Approve on Resignation → `status:'Notice Period'` on employee + returns `offboardingPrompt`) | `applyRequestDecision`, dashboard quick approve/reject, attendance inline | EXISTING (endpoint + `stage/decision/comment`; `payment` is a UI-required addition) |
| R4 | `POST /api/requests/{id}/undo-decision` | Bearer, `requests.approve` | body `{ comment? }` — allowed only while `requestedDate` hasn't passed; reverts to `Pending HR Review`, returns paid balance day | `{ message, item }` | "Undo Decision" (`applyRequestDecision` mode `undo`) | **NEW** (api.md has no undo/revert) |
| R5 | `POST /api/requests/bulk-decide` | Bearer, `requests.approve` | body `{ decision:'Approved', comment:'Bulk approved', requestIds?:[] }` (default = all `Pending HR Review`) + server applies `payment` per balance | `{ message, approved, unpaidApplied }` | `bulkApproveRequests` / `doBulkApprove` | **NEW** |
| R6 | `POST /api/requests/{id}/archive` and `POST /api/requests/{id}/restore` | Bearer, `requests.view`+inbox owner (UI gates only on status) | — | `{ message }` | card Archive / Restore buttons | **NEW** (status `Archived` is rendered but no endpoint mutates it) |
| R7 | `POST /api/requests` | Bearer, HR creating on behalf (or employee) | body `{ employee /*name in UI*/, type, requestedDate, endDate?, reason }` (type ∈ Day Off, Sick Leave, Leave Early, Late Arrival, Shift Swap, Resignation) | `{ data:{ id, status:'Pending HR Review', timeline:[…] } }` | New Request modal (`submitNewRequest`) | EXISTING |
| R8 | `GET /api/employees/{id}/leave-balance` | Bearer, `requests.view` | — | `{ dayOff:{used,total,left,after}, sick:{used,total}, unpaid:{used,total} }` | balance strip/warn/cell, New Request live balance, Bulk Approve alert | **NEW** (mirrors E9; drives paid/unpaid decision) |
| R9 | `PUT /api/employees/{id}/leave-balance` (server-side on approve when `payment='paid'`) | Bearer, implicit via `requests.approve` | server action | — | `adjustLeaveBal` | **NEW** (or automatic side-effect of R3 — implement inside R3) |
| R10 | Branch queue cards inside Requests page | as D9/D10 | `GET /api/branch-submissions`, `POST /api/branch-submissions/{id}/decide` | as D9/D10 | type pills Deduction/Warning/Bonus, merged card list | **NEW** |

---

### 7. Branch Queue (pages-branch-queue.js)

**Screens:** header "Branch Manager Submissions" + waiting count; filter tabs `All | Pending | Deductions | Warnings | Bonuses`; item cards: kind badge, employee, status badge, gym, title + amount (EGP), "Sent by {issuedBy} · date · #id", note, decision line (`Approved by X — note`), buttons **Approve / Decline** (pending only), per-kind footnotes, footer → Payroll link. Cross-portal sync via shared `BranchBridge` store (mock) — backend equivalent below.

| # | Endpoint | Auth + Permission | Request | Response | Called by | Mark |
|---|---|---|---|---|---|---|
| BQ1 | `GET /api/branch-submissions` | Bearer, HR (`requests.approve` or `payroll.view`) | query: `status=PendingHR`, `kind`, `page,pageSize` | items `[{ id, kind:'Deduction'\|'Warning'\|'Bonus', employee, title, amount, note, issuedBy, gym, date, status:'Pending HR'\|'Approved'\|'Rejected', decidedBy, decidedNote }]` | `branchQueueItems`, nav badge, cards | **NEW** |
| BQ2 | `POST /api/branch-submissions/{id}/decide` | Bearer, `requests.approve` | body `{ decision:'Approved'\|'Rejected', note }` (note required for Rejected) | `{ message }`; server side-effects: Approved Deduction → push `{id:'bl-…',date,label:'Branch deduction',amount,reason,source:'manager',branchRef,status:'Accepted'}` into payroll + recalc totals; Approved Bonus → add to `bonus` + `relatedBonusRefs`; Warning → file to employee record; both audited (`Branch {kind} {decision}`) | `applyBranchDecision` | **NEW** |
| BQ3 | `GET /api/payroll-periods/{id}` (payroll linkage after approve) | Bearer, `payroll.view` | — | entry `deductionLines[]`/`bonus` | footer "Payroll →", rehydrate logic | EXISTING |

---

### 8. HR Team Management (pages-hr-team.js)

**Screens:** tabs `HR Team | Role Templates`; KPI tiles (Active HR Staff, Role Templates, Gyms Under You, Suspended); buttons **Create HR Account** (manage only), **New Template**.
**Table:** **HR Staff (avatar, name, email) | Role Template (preset badge) | Gyms | Permissions (progress "N perms") | Status (Active/Suspended) | Last Login | actions (Edit Permissions ✎, Suspend/Reactivate)**; mobile cards.
**Wizard (3 steps):** ① Personal Info (`Full Name*`, `Email*`, `Phone`, `Start Date`); ② Gym Access (branch checkboxes); ③ Permissions — template bar (HR Default/HR-FullAccess/HR-AttendanceOnly/HR-NoPayroll/Blank), grouped checkboxes (HR_PERM_GROUPS: Employees 14 perms, Attendance & Schedule 4, Requests 2, Recruitment 5, Payroll 3, Evaluations 2, Administration 8), live sidebar-page preview, **Save as Template**, **Create Account ✓**.
**Modals:** member detail (perm badges + visible pages), Edit Permissions (template + grouped checkboxes, **Save Permissions**), Suspend/Reactivate (required Reason), New/Edit Role Template (name, description, color, permissions), Template detail.

| # | Endpoint | Auth + Permission | Request | Response | Called by | Mark |
|---|---|---|---|---|---|---|
| H1 | `GET /api/users` | Bearer, `team.view` | query: `role=HR`, `page,pageSize` | envelope; items `[{ id, name, email, phone, initials, role, preset, gyms:[branch names], permissions:[keys], status:'Active'\|'Suspended', lastLogin, hireDate }]` | HR Team table/cards, KPI counts | EXISTING (endpoint; `preset` = applied role-template name the UI renders) |
| H2 | `GET /api/users/{id}` | Bearer, `team.view` | — | `{ data: item + effectivePermissions[] }` | member detail modal (visible pages preview) | EXISTING |
| H3 | `POST /api/users` | Bearer, `team.manage` | body `{ name, email, phone, hireDate /*UI "Start Date"*/, role:'HR' }` (credentials auto-emailed) | `{ data:{ id, ... } }` | Create HR Account wizard (`finalizeHRAccount`) | EXISTING |
| H4 | `PUT /api/users/{id}/gym-access` | Bearer, `team.manage` | body `{ gyms:['Nasr City','Heliopolis',…] }` (min 1) | `{ message }` | wizard step 2 | EXISTING |
| H5 | `PUT /api/users/{id}/permissions` | Bearer, `team.manage` | body `{ permissions:[ 'employees.view', … ] }` (full dotted keys; template optionally recorded as `preset`) | `{ data:{ permissions[], count } }` | wizard step 3, `saveHRMemberEdit` ("Save Permissions") | EXISTING |
| H6 | `PUT /api/users/{id}/status` | Bearer, `team.manage` | body `{ status:'Active'\|'Suspended', reason }` (reason required) | `{ message }` (suspend revokes login immediately; audit `HR Account {status}`) | `toggleHRMemberStatus` / `confirmToggleStatus` | **NEW** (api.md users CRUD has no status/suspend op) |
| H7 | `GET /api/roles` | Bearer, `team.view` | — | items `[{ id, name, description, color:'brand'\|'blue'\|'yellow'\|'purple', permissions[] }]` (HR (Default), HR-FullAccess, HR-AttendanceOnly, HR-NoPayroll) | Role Templates tab cards | EXISTING |
| H8 | `POST /api/roles` | Bearer, `team.manage` | body `{ name, description, color, permissions[] }` | `{ data:{ id, … } }` | New Template modal (`saveNewTemplate`), wizard "Save as Template" (`confirmSaveTemplate`) | EXISTING |
| H9 | `PUT /api/roles/{id}` | Bearer, `team.manage` | body `{ name, permissions[] }` | `{ message }` | Edit Template (`saveEditTpl`) | EXISTING |
| H10 | `PUT /api/roles/{id}/permissions` | Bearer, `team.manage` | body `{ permissions[] }` | `{ message }` | (equivalent path for H9's permission part) | EXISTING |
| H11 | Permission-catalog for the picker | Bearer, `team.manage` | — | items `[{ group, key, label }]` — exact 42 keys in `HR_PERM_GROUPS` (e.g. `employees.view` "View directory & profiles", `attendance.manual_entry`… ) | perm step checkboxes + live page preview (`NAV_PAGE_MAP`) | **NEW** (or served statically; doc exposes no permission catalog endpoint) |

---

### 9. Cross-cutting notes

1. **Pagination/error envelopes:** all list endpoints above use `{items,page,pageSize,totalCount,totalPages}` and errors `{statusCode,message,errors[]}` per conventions.
2. **Branch-gym scoping:** every list is gym-filtered server-side (`selectedGym === 'all'` ⇒ all permitted gyms; otherwise the chosen gym id/branch) — matches api.md's gym-scoped notes.
3. **Client-side derived data (no new endpoint strictly required):** dashboard KPI counts, nav badges, attendance day/month stats, schedule day summaries, request urgency tags — all derivable from the listed list-endpoints; D1/D4-style aggregates are optional optimizations.
4. **UI fields not in current api.md contracts (contract gaps to close):** `payment` on request decide (R3), undo/bulk/archive request ops (R4–R6), leave-balance read/write (E9/E10/R8), separation lifecycle beyond offboard (T1–T6), branch submissions (BQ1/BQ2), employee-action-requests (D6–D8/E20), HR user suspend (H6), kiosk pairing code (A10), payroll line edits during exit (T7/T8), `status`/`checkIn`/`checkOut` on attendance manual/correct (A3/A4).
5. **Existing-but-reused endpoints:** `GET /api/events`, `GET /api/vacancy-requests`, `POST /api/requests/{id}/decide`, `GET/POST /api/requests?date=`, `GET /api/attendance?date=|from=|to=`, cycle detail/assignments — used by multiple pages listed above.
6. **Out of scope / delegated:** recruitment pipeline internals (blocked candidates, hiring forms list), payroll period management, evaluation run page, notifications/announcements composer, audit-log viewer, my-access — referenced only where in-scope pages call them.

---

## Section 5 - HR Portal - Recruitment, Hiring Forms, Payroll, Evaluations, Events, Access


**Scope read:** `pages-recruitment.js` (1232 lines), `pages-payroll.js` (858), `pages-evaluations.js` (657), `pages-events.js` (502), `pages-forms.js` (661), `pages-access.js` (1178), `data.js`, `index.html`, both spec docs, `docs/architecture/api.md`.

### 0. Key findings & conventions

- **PUBLIC application form location:** there is no standalone careers page. The public form is `openHiringFormPreview(formId)` / `submitHiringApplication(formId)` in **`js/pages-forms.js` (lines 587–661)** — explicitly labeled *"Public application form preview — submitting creates a test applicant"*. It is opened from the Hiring-form detail (**"Preview & Apply"** button) and submits anonymously. The generic public submit endpoint `POST /api/applications` already exists in api.md. **It must remain unauthenticated**, plus a public GET to fetch the form definition (see §2).
- Conventions (api.md): lists use `{items, page, pageSize, totalCount, totalPages}`; errors `{statusCode, message, errors[]}`; lists support `page, pageSize, searchTerm, sortBy, sortOrder`.
- Permission keys used by these pages (exact strings from code): `recruitment.view`, `recruitment.vacancies.manage`, `recruitment.candidates.manage`, `recruitment.hire.approve`, `recruitment.vacancy_request.approve`, `payroll.view`, `payroll.edit`, `payroll.approve`, `payroll.export`, `evaluations.view`, `evaluations.manage`, `evaluations.forms.manage`, `evaluations.manage.team`, `evaluations.view.team`, `team.manage`, `events.view`, `announcements.view`, `announcements.manage`, `audit.view`, `reports.view`, `positions.view`, `positions.manage`, `requests.approve`, `employees.transfer`.
- Actions that are `showToast(... "simulated")` with no data mutation (no API needed): vacancy **Filter** button, **Edit vacancy** pencil, **Position New/Edit** (toast only), Reports **Export** toast, **Manage Roles** toast, "New goal created" toast, "Reminder sent"/"Interview feedback logged" toasts are marked below where relevant.

---

### 1. Recruitment & Hiring page — `pages-recruitment.js`

Page tabs: **Candidates · Summary · Interviews · New Comers · Vacancies · Waiting · Vacancy Requests** (`_recTab`). Header KPI line: `openVacancies.length` open · `candidates.length` · `vacancyRequests Pending` · interviews this week (derived — no extra API).

#### 1.1 Vacancies tab (`vacanciesBody`, `openNewVacancy`, `openVacancyDetail`, `openVacancyAction`)

**`GET /api/vacancies`** — EXISTING
- Auth: user JWT + `recruitment.view` (gym-filtered).
- Query: `page, pageSize, searchTerm, status` (`Open|Draft|Closed`), `gym`, `sortBy=createdDate`.
- Response `items[]` (fields rendered by table + detail + action modal): `{ id, position, gym, headcount, urgency: "Low"|"Medium"|"High", status: "Open"|"Draft"|"Closed", createdDate, candidates, requestedBy, salary, shift }` (`candidates` = applicant count shown in "Candidates n / c" cell; `salary`/`shift` shown as "Expected salary"/"Shift" in the action panel).
- Used by: Vacancies table (Position, Gym, Headcount, Urgency, Candidates, Status, Created), Summary "OPEN VACANCIES" list, Waiting-list matching (`_matchingVacancies` filters `status==='Open'`), Reports `open-vacs` panel.

**`POST /api/vacancies`** — EXISTING
- Auth: JWT + `recruitment.vacancies.manage`.
- Body (from `openNewVacancy` form): `{ position, gym, headcountNeeded, urgency, source: "Job board"|"Referral"|"Social media"|"Walk-in", jobDescription }` — api.md notes `headcountNeeded` (int) is the accepted field (UI label "Headcount").
- Response: `201 { data: { id, position, gym, headcount, urgency, status, createdDate, candidates, requestedBy, salary, shift } }`.
- Used by: "Create Vacancy" modal submit ("Vacancy created").

**`PUT /api/vacancies/{id}`** — EXISTING (accepts `headcountNeeded`)
- Auth: JWT + `recruitment.vacancies.manage`. Body = same fields, partial. Used by Edit-vacancy action (currently toast-simulated) and by headcount decrement on hire (server-side).

**`GET /api/vacancies/{id}`** — NEW
- Auth: JWT + `recruitment.view`.
- Response `{ data: { …vacancy fields…, funnel: [{ stage, count }], employeesUnderPosition: [{ id, name, initials, position, gym }], candidates: [{ id, name, initials, position, stage, appliedDate, rating, source, salaryExp, blocked }] } }`.
- Used by: `openVacancyDetail` modal (FUNNEL FOR THIS ROLE bars, EMPLOYEES UNDER THIS POSITION, CANDIDATES UNDER THIS POSITION) and `openVacancyAction` panel (waiting match, matched candidates, "Hire … — Create Account"). *(Funnel/employees/candidates are currently derived client-side from MOCK lists; a detail endpoint or the existing lists both work — listed for completeness.)*

#### 1.2 Vacancy Requests tab (`vacancyRequestsBody`, `reopenVacancyRequest`, Events/Reports call-sites)

**`GET /api/vacancy-requests`** — EXISTING
- Auth: JWT + `recruitment.view` (gym-filtered; queue gated `recruitment.vacancy_request.approve` for decisions).
- Query: `status` (`Pending|Approved|Rejected`, UI tabs pending/approved/rejected/all), `page, pageSize`.
- Response `items[]`: `{ id, position, gym, urgency, status: "Pending"|"Approved"|"Rejected", submittedBy, submittedDate, reason, salary, shift, headcount, decidedBy }`.
- Used by: Vacancy Requests cards (position, gym, submittedBy, submittedDate, urgency, reason, status, decidedBy badge), Reports `vac-reqs` panel, Events vacancies tab (via linked event).

**`POST /api/vacancy-requests`** — EXISTING
- Auth: JWT + Branch Manager `requests`-level submitter (own gym only). Body: `{ position, gym, urgency, reason, salary, shift, headcount }`. Response `201 { data: {...} }`.

**`PUT /api/vacancy-requests/{id}/decide`** — EXISTING
- Auth: JWT + `recruitment.vacancy_request.approve`.
- Body: `{ decision: "Approved"|"Rejected", comment?, positionId?, headcountNeeded?, urgency?, salary?, shift?, jobDescription? }` — api.md: *Approve requires positionId + vacancy details to create the resulting Vacancy* (UI's one-click "Approve → Create Vacancy" sends the request's own fields).
- Response: `{ data: { id, status, decidedBy, vacancyId? } }` (approve also creates the Vacancy: `{ position, gym, headcount, candidates: 0, urgency, salary, shift, requestedBy, createdDate, status: "Open" }`).
- Used by: `approveVacancyRequest` / `rejectVacancyRequest` (Vacancy Requests tab, Events vacancies card, Reports `vac-reqs` panel, Dashboard quick-approve).

**`PUT /api/vacancy-requests/{id}/reopen`** — NEW
- Auth: JWT + `recruitment.vacancy_request.approve`. Body: `{}` (optionally `{ comment }`).
- Response `{ data: { id, status: "Pending", decidedBy: null, vacancyWithdrawn: boolean } }` — server must withdraw the vacancy created by the approval **only if it has no applicants** (mock logic).
- Used by: `reopenVacancyRequest` — "Edit again — re-open" button.

#### 1.3 Candidates tab / Pipeline kanban (`candidatesBody`, `_pipelineCard`, `advanceCandidate`, `_setCandidateBlock`, `openCandidateDetail`)

**`GET /api/candidates`** — EXISTING
- Auth: JWT + `recruitment.view` (gym-scoped).
- Query: `page, pageSize, searchTerm` (matches name/position), `stage` (`Applied|Screening|First Interview|Second Interview|Accepted|Rejected|Hired`), `position`, `view` (`active` = in-process minus blocked | `rejected`), `blocked`, `sortBy, sortOrder`.
- Response `items[]`: `{ id, name, position, stage, appliedDate, phone, rating, blocked, blockReason, hiredDate?, rejectedDate?, rejectedBy?, rejectReason?, form: { email, source, gymPref, expYears, education, skills[], languages[], shift, salaryExp, availability }, screen: { date, by, verdict: "Pass"|"Fail", eval, notes }|null, iv1: { date, by, type: "On-site"|"Video"|"Trial"|"Panel", verdict: "Scheduled"|"Invited"|"Pass"|"Fail", eval, room, notes }|null, iv2: …|null, decision: { by, date, verdict: "Accepted"|"Rejected", note }|null }`.
- Used by: table columns (checkbox, Candidate name/initials/email, Position, Stage, Applied, Rating, Source), kanban board cards (per-stage detail rows), mobile cards, Reports `funnel`/`cand-stage`.

**`GET /api/candidates/{id}`** — EXISTING
- Auth: JWT + `recruitment.view`. Response `{ data: { …all candidate fields above… } }`.
- Used by: `openCandidateDetail` modal — header (name, stage, position, phone, rating), APPLICATION FORM panel (email, source, preferred gym, experience/expYears, education, shift, salary expectation, availability, languages, skills), SCREENING block, FIRST/SECOND INTERVIEW blocks (interviewer, date, type, evaluation, verdict, room, notes, round details), FINAL DECISION block, REJECTED block (rejectReason, rejectedDate, rejectedBy), matching-vacancy banner, ACTIVITY timeline, footer actions (Block / Restore / Hire).

**`PUT /api/applications/{id}/stage`** — EXISTING
- Auth: JWT + `recruitment.candidates.manage`.
- Body: `{ stage: "Applied"|"Screening"|"First Interview"|"Second Interview"|"Accepted"|"Rejected"|"Hired" }` (UI also moves **backward** via `advanceCandidate` — endpoint must accept any valid stage, not only "next").
- Response `{ data: { id, stage, iv2? } }` — when moving to `Second Interview` without an `iv2`, backend creates a scheduled round (mock seeds `{ date, by, type: "Panel", verdict: "Scheduled", eval: null, room }`).
- Used by: kanban ← → arrows, list-view "Advanced to next stage" button, dashboard dossier "Pass to {stage}".

**`PUT /api/candidates/{id}/block`** — NEW
- Auth: JWT + `recruitment.candidates.manage`. Body: `{ blocked: true|false, blockReason? }`.
- Response `{ data: { id, blocked, blockReason } }`.
- Used by: `_setCandidateBlock` — "Block" row/detail button, "Restore to pipeline" footer button (blocks re-applications).

**`GET /api/recruitment/follow-ups`** — EXISTING
- Auth: JWT + `recruitment.view` (gym-scoped). Query: `page, pageSize`.
- Response `items[]` = candidate-shaped objects needing action (stale > 5 days in a non-terminal stage): `{ id, name, position, stage, appliedDate, rating, …candidate shape… }`.
- Used by: pipeline "⚠ Overdue · Next: {action}" flags + next-action labels (`Schedule screening` / `Schedule 1st interview` / `Schedule 2nd interview` / `Make decision` / `Match vacancy / hire`), dashboard stalled-candidate feed.

#### 1.4 Interviews sub-tab (`interviewsBody`, `openNewInterview`, `markInterviewDone`, `openInterviewDetail`)

**`GET /api/interviews`** — NEW
- Auth: JWT + `recruitment.view` (gym-scoped).
- Query: `month` (`YYYY-MM` — `_ivMonth`), `date` (`YYYY-MM-DD` selected day), `status` (`all|pending|completed|cancelled`; pending = `Scheduled|Invited|Draft`), `page, pageSize, sortBy=date, sortOrder`.
- Response `items[]`: `{ id, candidate, position, gym, date, time, type: "On-site"|"Video", interviewer, status: "Scheduled"|"Invited"|"Completed"|"Cancelled"|"Draft", room }`.
- Used by: day-list rows (date/time tile, candidate+rating, position|gym, time|type|interviewer|room, Done button, status badge), calendar dots, UPCOMING/THIS WEEK/NEED ATTENTION tiles, counts.

**`GET /api/interviews/{id}`** — NEW
- Auth: JWT + `recruitment.view`. Response `{ data: { …interview fields… } }`.
- Used by: `openInterviewDetail` modal (Date & time, Format/Location, Interviewer, Status + Send Reminder / Complete buttons).

**`POST /api/interviews`** — NEW
- Auth: JWT + `recruitment.candidates.manage`.
- Body (from `openNewInterview` form): `{ candidate, position, date, time, type: "On-site"|"Video", interviewer, room }` (Location/Link input maps to `room`; `candidate` is `"Name — Position"` in the select, backend should resolve to candidateId).
- Response `201 { data: { id, candidate, position, gym, date, time, type, interviewer, status: "Scheduled", room } }`.
- Used by: "Schedule" button on Interviews tab.

**`PUT /api/interviews/{id}/complete`** — NEW
- Auth: JWT + `recruitment.candidates.manage`. Body: `{}` (mock only flips status; feedback logging is a toast).
- Response `{ data: { id, status: "Completed" } }`. Used by: `markInterviewDone` "✓ Done" button and `openInterviewDetail` "Complete".

**`POST /api/interviews/{id}/reminder`** — NEW *(currently toast-only, but the button exists)*
- Auth: JWT + `recruitment.candidates.manage`. Body `{}` → `200 { message: "Reminder sent." }`. Used by: "Send Reminder" button.

#### 1.5 Waiting tab (`waitingBody`, `waitingMatchHTML`, assign wizard)

**`GET /api/recruitment/waiting-list`** — NEW
- Auth: JWT + `recruitment.view`. Query: `page, pageSize, position`.
- Response `items[]`: `{ id, name, position, skills[], note, since, source, matchingVacancies: [{ id, position, gym, headcount, urgency, candidates }] }` (match is `_matchingVacancies` = open vacancies with partial position match).
- Used by: Waiting cards (name, position, days waiting `since`, skills badges, note, source, "✓ Open position … / No open position…" match block), Summary "WAITING LIST — AWAITING MATCH".

**`POST /api/recruitment/waiting-list/{id}/assign`** — NEW
- Auth: JWT + `recruitment.hire.approve`.
- Body (3-step wizard fields, `confirmWaitingAssign`): `{ vacancyId, position, gym, startDate, salary, annualIncrease, leaveDays, level: "Junior"|"Mid"|"Senior", email, password, role }`.
- Response `201 { data: { employeeId, name, position, level, gym, startDate, waitingListRemoved: true, newComerId } }` — creates employee + onboarding checklist, decrements vacancy headcount, removes from waiting list, audit-logs.
- Used by: `assignWaitingToGym` → steps Assignment (vacancy pick `assign-vac`, `assign-gym`, `assign-start`) → Terms (`wa-salary, wa-increase, wa-leave, wa-level, wa-email, wa-pass, wa-role`) → Confirm ("Confirm Hire & Create Employee").

**`DELETE /api/recruitment/waiting-list/{id}`** — NEW
- Auth: JWT + `recruitment.candidates.manage`. Body `{}` → `204`. Used by: "Remove" button (`showToast('Removed from waiting list')`).

#### 1.6 New Comers tab (`newcomersBody`)

**`GET /api/employees/new-comers`** — EXISTING
- Auth: JWT + `recruitment.view` (gym-scoped).
- Response `items[]`: `{ id, name, position, startDate, progress, checklist: [["ID & contract signed", false], ["Uniform issued", false], ["System access created", false], ["Branch tour completed", false], ["Welcome meeting with BM", false]] }` (tuple `[label, done]` exactly as rendered; `progress` 0–100 %).
- Used by: New Comers cards (initials, name, position, Starts date, progress bar/%, checklist checkboxes).

**`PUT /api/employees/{id}/onboarding-checklist`** — EXISTING
- Auth: JWT + `recruitment.hire.approve` (HR Manager per spec; HR read-only).
- Body: `{ item, done }` (single toggle) or `{ checklist: [[label, done], …] }` for batch.
- Response `{ data: { id, progress, checklist } }`. Used by: checklist checkbox `onchange` ("Checklist updated").

#### 1.7 Hire wizard (`openHireWizard`, `hireWizardRender`, `confirmHireCandidate`, `hireFromVacancy`)

**`POST /api/applications/{id}/hire`** — EXISTING
- Auth: JWT + `recruitment.hire.approve`.
- Body (from wizard step 1–2 + optional vacancy panel): `{ gym, offerLetterNote?, salary, annualIncrease, leaveDays, startDate, contractType: "Full-time"|"Part-time", level: "Junior"|"Mid"|"Senior", email, password, role, vacancyId? }`.
- Response `201 { data: { employeeId, name, position, level, gym, status: "Active", startDate, email, salary, leaveDays, role, newComerId, hiredDate, vacancyHeadcountRemaining } }` — creates employee profile (application+interview data carried), sets candidate `stage: "Hired"`, `hiredDate`, decrements vacancy headcount/closes at 0, starts onboarding checklist, audit-logs ("Employee Hired from Recruitment").
- Used by: Hire wizard (steps **Review** — candidate/position/gym select/phone/offer note; **Offer** — `hw-salary, hw-increase, hw-leave, hw-start, hw-contract, hw-level, hw-email, hw-pass, hw-role`; **Confirm** — "Confirm Hire & Create Employee"), and `hireFromVacancy` from the vacancy action panel ("Hire {name} — Create Account"). When initiated from a candidate whose application belongs to a specific vacancy, same endpoint with `vacancyId`.

**`POST /api/employees`** — EXISTING (alternative direct-create path used by mock's `confirmWaitingAssign`/`hireFromVacancy`; prefer the hire endpoint above so the application→employee link is preserved).

---

### 2. PUBLIC Application Form — `pages-forms.js` (anonymous, NO auth)

**`GET /api/hiring-forms`** — NEW · **Auth: `public`** (anonymous)
- Query: `position`, `gym` (optional).
- Response `items[]` (only `status: "Open"` forms): `{ id, name, position, gym, status: "Open", createdDate, questionList: [{ type: "text"|"checkbox"|"choose", text, options[] }] }`.
- Used by: public careers/apply listing (mock: `MOCK.hiringForms` inside `openHiringFormPreview`).

**`GET /api/hiring-forms/{id}`** — NEW · **Auth: `public`** (anonymous)
- Response `{ data: { id, name, position, gym, status, createdDate, questionList: [{ type, text, options[] }] } }`.
- Used by: rendering the public form (question blocks: textarea for `text`, checkboxes `name="hfcb{i}"`, radios `name="hfq{i}"`).

**`POST /api/applications`** — EXISTING · **Auth: `public` (anonymous, rate-limited)**
- Body (from `submitHiringApplication`): `{ formId, name, email, phone, gym, answers: [{ question, type: "text"|"checkbox"|"choose", answer: string | string[] }] }`. For a full careers application also accepted fields (candidate `form` shape): `{ position, source, gymPref, expYears, education, skills[], languages[], shift, salaryExp, availability }`.
- Response `201 { message: "Application submitted." }` (no auth data leaked).
- Used by: **"Submit Application"** button — the critical anonymous path; creates applicant with `status: "New"`, `appliedDate` (yyyy-mm-dd).

**`GET /api/applications`** — EXISTING (authenticated side of the same resource)
- Auth: JWT + `recruitment.candidates.manage` (gym-filtered).
- Query: `formId` (hiring-form detail "WHO APPLIED"), `status` (`New|In Review|Shortlisted|Rejected|Moved to Pipeline`), `page, pageSize, searchTerm`.
- Response `items[]`: `{ id, name, email, phone, gym, formId, formName, position, appliedDate, status, answers: [{ question, type, answer }] }`.
- Used by: `fbDetailApplicantsHtml` cards (initials, name, position, gym, status badge, appliedDate, answers count, phone) and `viewApplicant` modal (position, preferred branch, status, email, phone, applied, itemized answers).

**`GET /api/applications/{id}`** — NEW (detail with full `answers`; list may already include them)
- Auth: JWT + `recruitment.candidates.manage`. Response `{ data: { …application… } }`. Used by: "View Answers".

**`PUT /api/applications/{id}/reject`** — NEW
- Auth: JWT + `recruitment.candidates.manage`. Body: `{ comment? }`.
- Response `{ data: { id, status: "Rejected" } }`. Used by: **Reject** button on applicant card / modal (`rejectApplicant`).

**`POST /api/candidates`** — NEW *(convert application → pipeline candidate)*
- Auth: JWT + `recruitment.candidates.manage`. Body: `{ applicationId }`.
- Response `201 { data: { id, name, position, stage: "Applied", appliedDate, phone, rating: 0, form: { email, source: "Hiring Form — {formName}", gymPref, expYears: 0, education: "", skills: [], languages: [], shift: "Any", salaryExp: 0, availability: "Immediate" }, screen: null, iv1: null, iv2: null, decision: null }, applicationStatus: "Moved to Pipeline" }`.
- Used by: **Add to Pipeline** button (`moveApplicantToPipeline`); also flips applicant `status` → `Moved to Pipeline` and audit-logs "Candidate Added". Rejected applications must be rejected by the server (UI guards this client-side).

---

### 3. Dynamic Forms / Form Builder — `pages-forms.js` (merged into Evaluations page)

Editor draft fields (`fbBlankDraft`/`fbEditorHtml`): `name` (Form Title*), `kind/type` (`evaluation|hiring`), `position` (Target Role/Position: `Trainer|Receptionist|Cleaner|Maintenance|Branch Manager|All`), `gym` (`All` + gym branches), `status` (evaluation: `Active|Completed|Inactive`; hiring: `Open|Closed`), `questionList: [{ type: "text"|"checkbox"|"choose", text, options[] }]` (min 1 question; non-text min 2 options; reorder supported client-side).

**Evaluation side (EXISTING endpoints, extended body):**
- **`POST /api/evaluation-forms`** — EXISTING · JWT + `evaluations.forms.manage`. Body: `{ name, position, target, gym, status, questionList: [{ type, text, options[] }] }` → `201 { data: { id ("ef-…"), name, position, target, gym, status, questions, questionList, createdDate, lastUsed } }`.
- **`PUT /api/evaluation-forms/{id}`** — EXISTING · same auth/body; response `{ data: { …updated… } }`. Used by **Save Form** (`fbSave`, update branch).
- **`GET /api/evaluation-forms/{id}`** — EXISTING · JWT + `evaluations.view` → `{ data: { …form with questionList… } }`. Used by form detail + run view.

**Evaluation side (NEW):**
- **`DELETE /api/evaluation-forms/{id}`** — NEW · JWT + `evaluations.forms.manage` → `204`. Used by **Delete** (`fbDelete`/`fbDoDelete` + confirm modal).

**Hiring side (NEW resource — mock writes `MOCK.hiringForms`):**
- **`POST /api/hiring-forms`** — NEW · JWT + `evaluations.forms.manage` (form-builder create with kind `hiring`). Body as above with `status: "Open"`, `createdDate` server-set. → `201 { data: { id ("hf-…"), … } }`.
- **`PUT /api/hiring-forms/{id}`** — NEW · same auth → `{ data: { … } }`.
- **`DELETE /api/hiring-forms/{id}`** — NEW · same auth → `204` (applicants remain, unlinked; response may include `{ deletedApplicantLinks }`).
- *(Public GETs are in §2.)*

Form card rendering fields: `{ id, name, position, gym, status, questions, questionList[], createdDate, lastUsed?, submissions|applicants counts }` — counts derive from responses/applicants lists below.

---

### 4. Evaluations page — `pages-evaluations.js`

Page states: forms main (Evaluation/Hiring tabs + My Evaluations inbox + Running/Old forms) → form detail → editor → **Run view** → **History & Trends**.

#### 4.1 Forms list / running cards

**`GET /api/evaluation-forms`** — EXISTING
- Auth: JWT + `evaluations.view` (gym/position filtered). Query: `status` (`Active|Completed|Inactive`), `gym`, `position`, `kind` (`evaluation|hiring` if unified), `page, pageSize`.
- Response `items[]`: `{ id, name, gym, position, target, questions, status, createdDate, lastUsed, questionList: [{ type, text, options[] }] }`.
- Used by: "CURRENT RUNNING FORMS" (`status==='Active'`) + "OLD FORMS" cards (`fbCardHtml`: badge kind/status, name, `N questions`, target, branches, createdDate, first question preview), Hiring tab cards.

#### 4.2 Dispatch (evaluator routing)

**`POST /api/evaluation-forms/{id}/dispatch`** — NEW
- Auth: JWT + `evaluations.manage`.
- Body: `{}` (server derives eligible evaluators = users holding `evaluations.manage` | `evaluations.manage.team` | `evaluations.view.team` | `team.manage`, excluding the caller; subjects = Active employees in evaluator's branch scope matching form `gym`/`position`, excluding self; idempotent).
- Response `{ data: { formId, createdAssignments: [{ id, formId, formName, evaluatorEmail, evaluatorName, subjects[], completedSubjects[], status: "Assigned", dispatchedDate, dispatchedBy }], routedEvaluators, evaluationsAssigned } }` — supports card line "Routed to N evaluators · M evaluations assigned" + audit "Evaluation Dispatched".
- Used by: **Dispatch** button on running-form card.

**`GET /api/evaluation-assignments`** — NEW
- Auth: JWT + (`evaluations.manage` | `evaluations.manage.team` | `evaluations.view.team` | `team.manage`) — returns assignments **for the signed-in user (matched by email)**.
- Query: `formId`, `status` (`Assigned|Completed`), `page, pageSize`.
- Response `items[]`: `{ id, formId, formName, evaluatorEmail, evaluatorName, subjects[], completedSubjects[], status, dispatchedDate, dispatchedBy }`.
- Used by: **MY EVALUATIONS** inbox cards (`assignmentCard`: formName, dispatchedDate, dispatchedBy, status badge, subject chips with ✓, `done/total` progress, **Start/Continue/Review** button).

#### 4.3 Run evaluation (free + assigned modes)

- Form picker: `GET /api/evaluation-forms?status=Active` (EXISTING); employee picker: **`GET /api/employees?status=Active`** — EXISTING, JWT + `evaluations.manage`, filtered server-side by gym scope/form position (mock excludes self, out-of-scope gyms, non-matching position). Response items need `{ id, name, position, level, gym }`.
- Review Period select values (client-supplied): `Q3 2026 | Mid-Year Review 2026 | Probation Review`.

**`POST /api/evaluation-forms/{id}/responses`** — EXISTING
- Auth: JWT + (`evaluations.manage` | assignment holder for assigned mode).
- Body (from `submitEvaluation` + run view): `{ employee, formId, form, period, score, notes, answers: [{ question, type: "text"|"checkbox"|"choose", answer }], assignmentId? }` — `score` = computed percent (`totalPoints / (questions*5) * 100`), `notes` = "Manager Feedback & Development Plan" (`eval-notes`, default `"Evaluation completed with standard scoring."`).
- Response `201 { data: { id, employee, form, formId, period, score, status: "Completed", notes, reviewedBy, reviewedDate, answers, gym }, assignment: { id, completedSubjects[], status }? }` — when `assignmentId` present, server appends the subject to `completedSubjects` and flips assignment to `Completed` when all done (mock does exactly this).
- Used by: **Submit Evaluation ({percent}%) ✓** button (both free-run and assigned flows).

**`POST /api/evaluation-forms/{id}/launch-cycle`** — NEW
- Auth: JWT + `evaluations.manage`. Body: `{ period }` (e.g. `"Q3 2026"`).
- Response `201 { data: { batchId, startedCount, status: "In Progress" } }`.
- Used by: **Launch Cycle for All Eligible (N)** button (`launchBatchCycle` seeds `status: "In Progress"` history entries).

#### 4.4 History & Trends tab

**`GET /api/evaluation-responses`** — NEW *(org-wide history; the per-employee variant already exists)*
- Auth: JWT + `evaluations.view`.
- Query: `employeeId?`, `formId?`, `period?`, `status` (`Completed|In Progress`), `gym`, `page, pageSize`.
- Response `items[]`: `{ id, employee, form, formId, period, score, status, notes, reviewedBy, reviewedDate, answers: [{ question, type, answer }], gym }`.
- Used by: KPI tiles (Avg Score, Completed, In Progress, Below Target `<60`), **AVG SCORE BY FORM** bars, **EVALUATION HISTORY** rows (initials, employee, form, period, score %, status badge, manager note), form-detail **WHO COMPLETED THIS FORM** list (`fbDetailSubmissionsHtml`), `openEvalSubmission` modal (score, status, period, reviewedBy, FORM ANSWERS with per-question type+answer, Manager Feedback).

**`GET /api/evaluation-forms/{id}/responses`** — NEW (optional convenience; same item shape, filtered by form). Used by form detail submissions.

**`GET /api/employees/{id}/evaluations`** — EXISTING · JWT + `evaluations.view`. Response `items[]` (employee profile Evaluations History tab): `{ id, employee, position, period, score, result, status, gym, form, formId }` (mock `MOCK.evaluations` shape).

**`GET /api/performance-cycles`** — NEW · JWT + `evaluations.view`. Response `items[]`: `{ id, name, start, end, status: "Upcoming"|"In Progress"|"Completed" }`. Used by: **PERFORMANCE CYCLES** chips ("Next: Q3 2026 opens Oct 1").

**`GET /api/goals`** — NEW · JWT + `evaluations.view`. Query: `page, pageSize`. Response `items[]`: `{ id, employee, title, status: "On Track"|"At Risk"|"Behind", progress, due, owner }`. Used by: **GOALS & OKRs** cards (title, status tone, employee, owner, Due, progress bar/%).

**`POST /api/goals`** — NEW *(button currently toast-only)* · JWT + `evaluations.manage`. Body: `{ employee, title, due, owner }` → `201 { data: { … } }`. Used by: **+ Add** button.

---

### 5. Payroll page — `pages-payroll.js`

Selectors: **Gym branch** (`Nasr City | Heliopolis | 6th October`) and **Period** (`August 2026 | July 2026 | June 2026`).

**`GET /api/payroll-periods`** — EXISTING
- Auth: JWT + `payroll.view` (gym-filtered). Query: `gym`, `status` (`Open|Partially Published|Published|Paid`), `page, pageSize`.
- Response `items[]`: `{ id, period, status, locked, paidDate, publishedGyms[], totalEmployees, totalGross, totalDeductions, totalNet }`.
- Used by: period selector + Locked/Open header badge ("🔒 Locked" / "🟢 Open for Reconciliation", "Published").

**`GET /api/payroll-periods/{id}`** — EXISTING *(period detail with entries — the core read for this page)*
- Auth: JWT + `payroll.view`. Query: `gym`.
- Response `{ data: { id, period, status, locked, paidDate, publishedGyms[], totalEmployees, totalGross, totalDeductions, totalNet, items: [ …payroll entries… ] } }`.
- Payroll **entry** item fields (exact names rendered): `{ employeeId, name, initials, gym, position, employmentStatus, days, overtime, baseSalary, bonus, gross, deductions, net, status: "Draft"|"Reviewed"|"Approved"|"Locked", reviewed, relatedRequestIds[], deductionLines: [{ id, date, label, reason, source: "biometric"|"manager", amount, status: "Pending"|"Accepted"|"Approved"|"Rejected", attendanceRef, requestId }] }`.
- Derived client-side (must be computable from these fields): OT pay = `(baseSalary/176)*1.5*overtime`; gross = base+bonus+OT; approved deductions = lines with `Accepted|Approved`; net = gross − approved; pending count = lines `Pending`; status badge = `Closed & Settled` | `{n} Actions Needed` | `Ready to Close`.
- Used by: **overview table** columns (Employee initials/name/employeeId, Role/position, Base Salary, OT & Bonus, Deductions, Net Final, Status, Action "Review Sheet →"), 4 stat cards (Total Staff, Settled & Closed %, Pending Review, Net Disbursed + Gross), and the **settlement sheet** (earnings card, deductions list, net strip).

**`PUT /api/payroll-periods/{periodId}/entries/{employeeId}`** — NEW
- Auth: JWT + `payroll.edit` (gym-scoped; rejected when period `locked`).
- Body: `{ bonus }` (only editable field in UI). Response `{ data: { employeeId, bonus, gross, deductions, net } }`.
- Used by: Bonus/Incentive inline input `commitPayrollBonus` ("Bonus updated … Net pay recalculated.").

**`POST /api/payroll-periods/{periodId}/entries/{employeeId}/deductions`** — NEW
- Auth: JWT + `payroll.edit` (period must be open).
- Body (inline Add-Line form): `{ source: "manager"|"biometric", reason, amount }` → server creates `{ id, label: reason, reason, source, date (today), amount, status: "Pending", attendanceRef: source==="biometric" ? "ATT-MANUAL" : "" }`.
- Response `201 { data: { …line…, entry: { gross, deductions, net, pendingCount } } }`. Used by: **+ Add Line** form (`savePayrollDeductionInline`).

**`POST /api/deduction-candidates/{id}/review`** — EXISTING
- Auth: JWT + `payroll.edit` (gym-scoped; period must be open; note: `deduction-candidates` = pending deduction lines).
- Body: `{ decision: "Accepted"|"Rejected" }` (UI actions **Approve** / **Waive**; `decidedAt` set server-side).
- Response `{ data: { id, status, amount, entry: { employeeId, gross, deductions, net, pendingCount } } }`.
- Used by: per-line **Approve** / **Waive** buttons in the settlement sheet, and the same decisions inside Reports `payroll-cost` panel.

**`GET /api/deduction-candidates`** — EXISTING
- Auth: JWT + `payroll.view`/`payroll.edit`. Query: `gym`, `period`, `status=Pending`, `page, pageSize`.
- Response `items[]`: `{ id, employeeId, employeeName, gym, period, date, label, reason, source, amount, status, attendanceRef, requestId }`. Used by: Reports "PENDING DEDUCTIONS" table (Employee, Line, Amount, Accept/Waive actions), settlement-sheet pending badges.

**`POST /api/payroll-periods/{id}/entries/{employeeId}/close`** — NEW
- Auth: JWT + `payroll.edit`; server rejects while `pendingCount > 0` or period locked.
- Body: `{}` → `{ data: { employeeId, status: "Reviewed", reviewed: true, reviewedAt, gross, deductions, net } }`. Used by: **✓ Close & Settle Account** (`acceptPayrollEmployee`).

**`POST /api/payroll-periods/{id}/entries/{employeeId}/reopen`** — NEW
- Auth: JWT + `payroll.edit`; rejected when period locked. Body `{}` → `{ data: { employeeId, status: "Draft", reviewed: false } }`. Used by: **Edit** button on a closed account (`reopenPayrollEmployee`).

**`POST /api/payroll-periods/{id}/approve`** — EXISTING *(publish & lock)*
- Auth: JWT + `payroll.approve`.
- Body: `{ gym }` — the UI locks **per branch** ("Publish & Lock Branch"; period becomes locked only when all gyms in `publishedGyms` are published). Server must verify all entries for that gym are `Reviewed`.
- Response `{ data: { id, status: "Partially Published"|"Published", locked, publishedGyms[], message } }`; entries in that gym become `status: "Locked"`.
- Used by: **✓ Publish & Lock Branch** → confirm modal (Total Employees, All Accounts Settled, Total Net Disbursed) → `confirmPublishPayroll`.

**`GET /api/employees/{id}/payroll`** — EXISTING · JWT + `payroll.view`. Response `items[]` = per-period payroll history for one employee (same entry shape + `period`). Used by: employee profile payroll snapshot / prev-next employee context.

**`GET /api/payroll-periods/{id}/payslips/{employeeId}`** — NEW *(spec §4.7 "Payslip preview per employee"; permission `payroll.view`)*
- Response `{ data: { period, gym, employee: { employeeId, name, position }, baseSalary, overtime, overtimePay, bonus, gross, deductions: [{ label, reason, source, amount, status }], net, days, status } }`. Used by: payslip preview (settlement sheet is the working surface; a print view renders these rows).

**`GET /api/payroll-periods/{id}/export`** — NEW *(spec §4.7 "Export (CSV/PDF)"; permission `payroll.export`)*
- Query: `gym`, `format=csv|pdf`. Response: streamed file (CSV columns = overview table columns). Used by: Export action.

**`GET /api/employees/{id}/attendance`** — EXISTING *(evidence pane)*
- Query: `from`, `to` (period). Response supplies: Days Attended, Weekly Offs, Approved Leaves, Overtime Logged, Late Arrivals, Unexcused Absences (settlement sheet right column).

**`GET /api/attendance/{id}`** — NEW *(biometric punch audit for a referenced record)*
- Auth: JWT + `payroll.view` or `attendance.view`. Response `{ data: { id, date, firstIn, lastOut, device, exception, detail } }`. Used by: **View Log** → `openPayrollAttendanceRef` modal (Record Date, Punch In/Out, Terminal Source, System Exception Notes) for refs like `ATT-2608-0417`.

**`GET /api/requests`** — EXISTING *(linked requests pane)*
- Query: `ids` (from `relatedRequestIds` + `deductionLines[].requestId`) or `employeeId&period`. Response items fields rendered: `{ id, type, status, reason, bmDecision, bmComment }`. Used by: **Linked Employee Requests** cards.

---

### 6. Events page — `pages-events.js`

Tabs (registry `EVENT_TABS` + Escalated): **Documents** (`Document Expiry|Contract Expiry`), **Requests** (`PendingHRReview`), **Leaving** (`Resignation|Termination`), **Transfers** (`TransferRequest`), **Vacancies** (`PendingVacancyRequest`), **Payroll** (`PayrollApproval`), **Escalated** (action requests). Controls: **Gym filter** (`All Gyms` + branch names) and **View resolved (n)** toggle.

**`GET /api/events`** — EXISTING
- Auth: JWT + `events.view` for page; each item additionally carries a `permission` and is filtered server-side (permission-filtered by underlying entity + gym-filtered).
- Query: `gym` (`all` or branch), `type` (`Document Expiry|Contract Expiry|PendingHRReview|Resignation|Termination|TransferRequest|PendingVacancyRequest|PayrollApproval`), `resolved` (`true|false`, default open), `urgency`, `page, pageSize`.
- Response `items[]` — common fields: `{ id, type, title, date, urgency: "high"|"medium"|"low", branch, detail, permission?, resolved, resolvedOn, resolvedBy }` plus per-type payload:
  - **Documents:** `{ employee, employeeId, docType, docNo, expiresOn, editableByEmployee, renewalPath }`
  - **Requests:** `{ requestId, employee, requestType, forDate, submittedOn, reason, bmDecision, bmComment }`
  - **Offboarding:** `{ employee, employeeId, position, lastDay, reason, requestedBy, separationId, checklistDone, checklistTotal }`
  - **Transfers:** `{ employee, employeeId, fromGym, toGym, effectiveDate, raisedBy, justification }`
  - **Vacancies:** `{ vacancyRequestId, position, gym, headcount, vrUrgency, submittedBy, submittedOn, vrReason }`
  - **Payroll:** `{ payrollPeriodId, period, gym, headcount, grossTotal, netTotal, preparedOn, pendingDeductions }`
- Used by: per-tab cards, due labels (`evtDueLabel`), tab counts (open/high/resolved), header "N items hidden by your permissions".

**`GET /api/events/counts`** — NEW *(optional; counts are currently derived from loaded items)*
- Query: `gym`. Response `{ data: { documents: { open, high, resolved }, requests: {…}, offboarding: {…}, transfers: {…}, vacancies: {…}, payroll: {…}, escalations: { open } } }`.

**`PUT /api/events/{id}/resolve`** — EXISTING
- Auth: JWT + the event's `permission` (e.g. `payroll.approve` for payroll, `recruitment.vacancy_request.approve` for vacancy events, `employees.transfer` for transfers, `requests.approve` for request events).
- Body `{}` → `{ data: { id, resolved: true, resolvedOn, resolvedBy } }`. Used by: **Mark resolved** button; audit "Event Resolved".

**`PUT /api/events/{id}/reopen`** — NEW · Auth: JWT + same per-event permission. Body `{}` → `{ data: { id, resolved: false } }`. Used by: `evtReopenEvent` (client helper for moving resolved items back).

**`POST /api/events/{id}/renewal-request`** — NEW · Auth: JWT + event's `permission`. Body `{}` → `201 { data: { notificationId, message } }` — requests a replacement document from the employee (creates a `Document` notification: `{ id, category: "Document", title: "Replacement requested", description, date, read: false, color, link: "events" }`) + audit "Document Renewal Requested". Used by: **Request renewal** button.

**`PUT /api/events/{id}/decide`** — NEW *(transfers tab ticket decision)*
- Auth: JWT + `employees.transfer`. Body: `{ decision: "approve"|"reject", comment? }`.
- Response `{ data: { id, resolved: true, resolvedOn, resolvedBy, employee: { id, gym }? } }` — approve executes the gym transfer (`fromGym → toGym`, effectiveDate honored) and removes the event; reject just resolves it. Audit: "Gym Transfer Executed" / "Transfer Request Rejected". Used by: **Approve transfer** / **Reject** buttons (`evtDecideTransfer`).

**Delegated to existing underlying endpoints (events cards act on the linked record):**
- Requests tab → `GET /api/requests/{id}` (EXISTING) via `openRequestDetail`; **Approve/Reject** → `POST /api/requests/{id}/decide` (EXISTING, body `{ stage: "HR", decision, comment }`) via `applyRequestDecision`.
- Vacancies tab → `PUT /api/vacancy-requests/{id}/decide` (EXISTING) via `rejectVacancyRequest` / `quickApproveVacancy`; **Detail** → `openVacancyRequestModal` reads the request (fields `position, gym, headcount, urgency, submittedBy, submittedDate, reason`) — served by `GET /api/vacancy-requests` or a detail variant.
- Payroll tab → `POST /api/payroll-periods/{id}/approve` (EXISTING, body `{ gym }`) via `evtApprovePayroll` — requires the event to expose `payrollPeriodId`.
- Leaving tab → **Open exit checklist** needs **`GET /api/separations/{id}`** — NEW · JWT + `employees.view` → `{ data: { id, employee, position, gym, lastDay, reason, requestedBy, submittedDate, status, progress, checklist: [[label, done]], verdict } }` (checklist progress `done/total`, remaining items). **Employee profile** → `GET /api/employees/{id}` (EXISTING).
- **Escalated** tab (action requests — see §9.4): `GET /api/action-requests` + approve/reject (NEW).

---

### 7. Notifications & Announcements — `pages-access.js` (`renderNotifications`, `openComposeAnnouncement`)

Tabs: **Notifications** (unread count badge) / **Announcements**.

**`GET /api/notifications`** — EXISTING · JWT (my notifications). Query: `unread`, `category` (`Requests|Recruitment|Document|System|Announcements`), `page, pageSize`.
- Response `items[]`: `{ id, category, title, description, date, read, color: "yellow"|"green"|"blue"|"red"|"purple", link }` (`link` = page id for "Open →").
- Used by: notification rows (title + unread dot, date, description, category badge, Open →), "N unread notifications".

**`PUT /api/notifications/{id}/read`** / **`PUT /api/notifications/read-all`** / **`GET /api/notifications/unread-count`** — EXISTING. Used by: **Mark all read** button + header bell dropdown.

**`GET /api/announcements`** — NEW · JWT + `announcements.view`.
- Query: `gym`, `status`, `page, pageSize`.
- Response `items[]`: `{ id, title, audience, sentDate, status: "Sent", readRate }`.
- Used by: Announcements tab cards (title, status badge, audience, sentDate, read rate % + progress bar).

**`POST /api/announcements`** — NEW · JWT + `announcements.manage`.
- Body (compose modal): `{ title, audience: "All Employees"|"Nasr City"|"Heliopolis"|"6th October"|"Trainers only", type: "Policy Update"|"Event"|"Reminder"|"Recognition", message }`.
- Response `201 { data: { id, title, audience, type, message, sentDate, status: "Sent", readRate: 0 } }`. Used by: **Send Announcement** ("Announcement sent"). *(Spec also allows scheduling/audience variants; edit/retract = `PUT /api/announcements/{id}` — NEW, same permission.)*

---

### 8. Access control — My Access & roles — `pages-access.js` (`renderMyAccess`)

Page sections: **ASSIGNED GYMS**, **PERMISSION SUMMARY**, **PERMISSIONS MATRIX — ROLES × MODULES** (gated `team.manage`), per-module **permission group cards**, wildcard note.

Permission groups rendered (exact keys):
- Employees: `employees.view, employees.create, employees.edit, employees.transfer, employees.position.change, employees.bulk_import, employees.offboard, employees.contract.manage`
- Attendance & Schedule: `attendance.view, attendance.edit, schedule.view, schedule.manage`
- Recruitment: `recruitment.view, recruitment.candidates.manage, recruitment.vacancies.manage, recruitment.hire.approve`
- Payroll: `payroll.view, payroll.edit, payroll.approve, payroll.export`
- Evaluations & Reports: `evaluations.view, evaluations.manage, reports.view`
- Administration: `positions.view, positions.manage, announcements.view, announcements.manage, audit.view, requests.approve`

**`GET /api/users/{id}`** (self) — EXISTING
- Auth: JWT (own id, or admin). Response `{ data: { id, email, role, permissions[], gyms: [{ id, name, branch }] , effectivePermissions } }`.
- Used by: ASSIGNED GYMS (`u.gyms[].name/branch`), PERMISSION SUMMARY (granted/tracked counts, % bar), "You ({role})" matrix row, wildcard `*` note.

**`GET /api/gyms`** — EXISTING · JWT (filtered by user's access). Response `items[]`: `{ id, name, branch }`. Used by: gym list + all gym selectors.

**`GET /api/roles`** — EXISTING · JWT + `team.view` (matrix visible with `team.manage`).
- Response `items[]`: `{ id, name, description, color, permissions[] }`.
- Used by: matrix rows — `HR Manager`, `HR Specialist`, `Branch Manager` with per-dept counts (`Employees, Attendance, Schedule, Requests, Recruitment, Payroll, Evaluations`) and Overall %; **Manage Roles** button (currently toast) routes into role management.

**`GET /api/permissions`** — NEW · JWT + `team.view`.
- Response `{ data: { modules: [{ name: "Employees", permissions: ["employees.view", …] }], totalTracked } }` — needed to group raw permission keys into the 7 matrix departments and compute `n/9` badges + group-card counts.
- Used by: matrix column headers + permission group cards.

**Roles CRUD — EXISTING** (Manage Roles UI / HR Team Management):
- `POST /api/roles` · JWT + `team.manage` · Body `{ name, description, color, permissions[] }` → `201 { data }`.
- `PUT /api/roles/{id}` · same · Body partial role → `{ data }`.
- `PUT /api/roles/{id}/permissions` · same · Body `{ permissions[] }` → `{ data: { id, permissions } }`.
- `POST /api/roles/{id}/clone` · same · Body `{ name }` → `201 { data }`.
- `DELETE /api/roles/{id}` · same (archive) → `204`.
- User-level overrides (api.md, used by hire wizard role assignment + profile edits): `PUT /api/users/{id}/roles`, `PUT /api/users/{id}/permissions`, `PUT /api/users/{id}/gym-access`, `POST /api/users/{id}/reset-password`.

---

### 9. Other screens inside the six in-scope files

#### 9.1 Reports & Analytics (`renderReports` + `REPORT_PANELS`, tabs Overview / Workforce / Attendance & Hiring, period `30d|90d|ytd`)
All panels are **computed client-side from existing lists** (`employees, attendanceRecords, attendanceExceptions, requests, candidates, positions, payrollItems, vacancies, separations, gymList`) — no new read API strictly required. Panel drill-downs call already-listed endpoints (`GET /api/candidates`, `GET /api/vacancies`, `GET /api/vacancy-requests` + decide, deduction review, `openNewVacancy`, `openCandidateDetail`, `openVacancyDetail`).
- **`GET /api/reports/export`** — NEW · JWT + `reports.view` · Query `period, format=csv` → CSV stream (button currently toast "Report exported as CSV").
- Panel-local actions that DO mutate and are already covered: deduction Accept/Waive (§5), vacancy Approve/Decline (§1.2), `resolveReportException` → attendance exception resolve (attendance module, out of scope).

#### 9.2 Positions & Levels (`renderPositions`)
- **`GET /api/positions`** — NEW · JWT + `positions.view` (api.md only has `GET /api/gyms/{gymId}/positions`; the catalog is org-wide). Response `items[]`: `{ id, title, levels[], department, gym, headcount, active }` (+ derived `open`, `fill`).
- **`POST /api/positions`**, **`PUT /api/positions/{id}`** — NEW · JWT + `positions.manage` · Body `{ title, levels[], department, gym, headcount }` (buttons currently toast "Position creation/edited — simulated").

#### 9.3 Activity / Audit Log (`renderAuditLog`)
- **`GET /api/audit-log`** — NEW · JWT + `audit.view`. Query: `action` (`All Actions|Employee|Payroll|Recruitment|Bulk Import`), `gym`, `user`, `from, to`, `page, pageSize`.
- Response `items[]`: `{ id, action, user, target, detail, timestamp, gym }`. Used by: rows (action — target, timestamp, detail, By: user, gym). Read-only.

#### 9.4 Escalated tab / Employee Action Requests (`approveActionRequest`, `rejectActionRequest`)
- **`GET /api/action-requests`** — NEW · JWT (permission-filtered per `ACTION_TYPES` meta perm: `employees.transfer`, `employees.compensation.manage`, `employees.role.assign`, `employees.offboard`, `employees.bulk_import`).
  - Query: `status=Pending`, `actionType`, `gym`, `page, pageSize`.
  - Response `items[]`: `{ id, employeeId, employee, position, actionType: "Transfer"|"CompensationChange"|"RoleAssign"|"Offboard"|"BulkImport", proposedDetails: { fromGym?, toGym?, effectiveDate?, currentSalary?, newSalary?, systemRole?, lastDay?, reason?, source? }, justification, requestedBy, status: "Pending"|"Approved"|"Rejected", submittedDate, reviewedBy?, reviewedDate?, reviewComment? }`.
  - Used by: Escalated cards (employee, meta label, "HR escalated" badge, `actionSummary(a)`, justification, requestedBy, submittedDate) + tab count.
- **`PUT /api/action-requests/{id}/approve`** — NEW · JWT + meta permission. Body `{}` → `{ data: { id, status: "Approved", reviewedBy, reviewedDate, executed: true } }` — server executes the effect (gym transfer / salary update / system-role assign / offboarding with exit checklist / bulk import) + audit entry.
- **`PUT /api/action-requests/{id}/reject`** — NEW · JWT + meta permission. Body `{ comment }` (required) → `{ data: { id, status: "Rejected", reviewedBy, reviewedDate, reviewComment } }` + audit `{ "{Label} Request Rejected" }`.

---

### 10. EXISTING vs NEW summary

| Area | EXISTING (matches api.md) | NEW |
|---|---|---|
| Recruitment | `GET/POST /api/vacancies`, `PUT /api/vacancies/{id}` (headcountNeeded), `GET/POST /api/vacancy-requests`, `PUT …/{id}/decide`, `GET /api/candidates`, `GET /api/candidates/{id}`, `GET /api/applications`, `PUT /api/applications/{id}/stage`, `POST /api/applications/{id}/hire`, `GET /api/recruitment/follow-ups`, `GET /api/employees/new-comers`, `PUT /api/employees/{id}/onboarding-checklist`, `POST /api/employees` | `GET /api/vacancies/{id}`, `PUT /api/vacancy-requests/{id}/reopen`, `PUT /api/candidates/{id}/block`, `GET/POST /api/interviews`, `GET /api/interviews/{id}`, `PUT /api/interviews/{id}/complete`, `POST /api/interviews/{id}/reminder`, `GET /api/recruitment/waiting-list`, `POST …/waiting-list/{id}/assign`, `DELETE …/waiting-list/{id}` |
| Public apply | **`POST /api/applications` (public, no auth)** | `GET /api/hiring-forms` + `GET /api/hiring-forms/{id}` (public), `GET /api/applications/{id}`, `PUT /api/applications/{id}/reject`, `POST /api/candidates` (convert-to-pipeline) |
| Payroll | `GET /api/payroll-periods`, `GET /api/payroll-periods/{id}`, `POST /api/payroll-periods/{id}/approve`, `GET /api/deduction-candidates`, `POST /api/deduction-candidates/{id}/review`, `GET /api/employees/{id}/payroll`, `GET /api/employees/{id}/attendance`, `GET /api/requests` | `PUT …/entries/{employeeId}` (bonus), `POST …/entries/{employeeId}/deductions`, `POST …/entries/{employeeId}/close`, `POST …/entries/{employeeId}/reopen`, `GET …/payslips/{employeeId}`, `GET …/export`, `GET /api/attendance/{id}` |
| Evaluations | `GET/POST /api/evaluation-forms`, `PUT/GET /api/evaluation-forms/{id}`, `POST /api/evaluation-forms/{id}/responses`, `GET /api/employees/{id}/evaluations` | `DELETE /api/evaluation-forms/{id}`, `POST …/dispatch`, `GET /api/evaluation-assignments`, `POST …/launch-cycle`, `GET /api/evaluation-responses`, `GET /api/evaluation-forms/{id}/responses`, `GET /api/performance-cycles`, `GET/POST /api/goals` |
| Hiring forms | — | `POST/PUT/DELETE /api/hiring-forms` (+ public GETs above) |
| Events | `GET /api/events`, `PUT /api/events/{id}/resolve`, plus delegations `POST /api/requests/{id}/decide`, vacancy decide, payroll approve | `PUT /api/events/{id}/reopen`, `POST /api/events/{id}/renewal-request`, `PUT /api/events/{id}/decide`, `GET /api/separations/{id}`, `GET /api/events/counts`, `GET/POST/PUT /api/action-requests` + approve/reject |
| Announcements / notifications | `GET /api/notifications`, `PUT …/{id}/read`, `PUT …/read-all`, `GET …/unread-count` | `GET /api/announcements`, `POST /api/announcements`, `PUT /api/announcements/{id}` |
| Access control | `GET /api/users/{id}`, `GET /api/gyms`, `GET/POST /api/roles`, `PUT /api/roles/{id}`, `PUT /api/roles/{id}/permissions`, `POST /api/roles/{id}/clone`, `DELETE /api/roles/{id}`, `PUT /api/users/{id}/roles|permissions|gym-access` | `GET /api/permissions` |
| Reports / Positions / Audit | — | `GET /api/reports/export`, `GET/POST/PUT /api/positions`, `GET /api/audit-log` |

**Critical constraint honored:** the hiring/application form (`POST /api/applications` + `GET /api/hiring-forms[/{id}]` from `pages-forms.js`) is designed **public — anonymous candidates, no JWT**; everything else requires a user JWT with the inferred permission listed above.

---

## Section 6 - Super Admin Portal


**Source:** `Mock UI/Super Admin/index.html` (3,724 lines, single file) · **Auth for every API:** `Authorization: Bearer <user JWT>` (session user = Top Management / super-admin; `POST /api/auth/login`, `/refresh`, `/logout` = **EXISTING**)
**Conventions:** pagination `{items,page,pageSize,totalCount,totalPages}`; errors `{statusCode,message,errors[]}`; query defaults `page,pageSize,searchTerm,sortBy,sortOrder`.

**Pages (`pageIds`):** dashboard, hierarchy, gyms, gym-detail, users, user-detail, roles, recruitment, health, integrations, billing, reports, audit, settings. **Modals:** create-gym, create-user (4-step), create-vacancy, create-role.

---

### 1. Global Shell (top bar / sidebar)

| Element | Detail |
|---|---|
| Global search | input `Search gyms, users, roles…` |
| Notifications bell | red badge count `3` |
| User footer | Youssef Essam · Top Management · Logout button |

| # | API | Status | Request | Response (UI-rendered fields) | Called by |
|---|---|---|---|---|---|
| 1.1 | `GET /api/search?searchTerm=` | **NEW** | q: `searchTerm` | `{items:[{type:"gym"\|"user"\|"role",id,name,subtitle}]}` | top-bar search |
| 1.2 | `GET /api/notifications/unread-count` | **EXISTING** | — | `{count}` (badge `3`) | bell badge |
| 1.3 | `GET /api/notifications` | **EXISTING** | q: `page,pageSize` | `{items:[{id,title,body,createdAt,isRead}],…}` | bell (dropdown implied) |
| 1.4 | `POST /api/auth/logout` | **EXISTING** | — | `{message}` | sidebar logout |

---

### 2. Dashboard (`page-dashboard`)

**Sections:** header (Create Gym → gyms+modal, Create User → users+modal); KPI strip (5 tiles); Action Required banner; Gyms Overview table; Recent Activity timeline; User Type Distribution chart; Headcount by Gym chart; Platform Health card.

#### 2.1 `GET /api/dashboard/super-admin` — **EXISTING**
- **Auth:** JWT, super-admin
- **Query:** none (org-wide)
- **Response** (exactly what tiles/cards render):
```json
{ "activeGyms": 5, "inactiveGyms": 1,
  "totalEmployees": 312, "newEmployeesThisMonth": 14,
  "hrUsers": 18, "openVacancies": 7,
  "actionRequired": { "count": 4, "items": [ { "message": "2 users with no gym assigned" } ] },
  "recentActivity": [ { "title": "New user created", "detail": "Mariam Youssef — HR (Zamalek)", "timestamp": "2 hours ago" } ],
  "userTypeDistribution": [ { "label": "HR Manager", "count": 10 }, { "label": "HR", "count": 8 }, { "label": "Top Mgmt", "count": 2 } ],
  "headcountByGym": [ { "gymName": "Nasr City", "headcount": 87 } ],
  "platformHealth": { "gymsWithShiftConfig": "4 / 5", "usersWithGymAccess": "16 / 18",
    "rolesWithPermissions": "5 / 6", "activeVacancies": "7 open", "systemStatus": "Operational" } }
```
- Banner items shown: `2 users with no gym assigned`, `1 gym missing shift templates`, `1 role with 0 permissions (empty)`, `Gym "Maadi Branch" — inactive 30 days`. (Dismiss = client-side only.)

#### 2.2 `GET /api/gyms` — **EXISTING** (Gyms Overview table + "View All")
- **Query:** `page,pageSize,searchTerm,status` (filter enum: `Active|Inactive|Archived`), `sortBy,sortOrder`
- **Response items:** `{id,name,location,status("Active"|"Review"|"Inactive"),employees,hrUsers,vacancies}`

---

### 3. Gyms (`page-gyms`)

**Sections:** header `5 gyms · 1 inactive` + Create Gym; filters (`Search gyms…`, status select All/Active/Inactive/Archived); card grid (name, location, status badge, Employees, HR Users, Vacancies, badges `10-day cycle`, `12 positions`, `3 shifts`, Maadi shows `⚠ No shift templates`); Add New Gym card.

| # | API | Status | Request | Response fields |
|---|---|---|---|---|
| 3.1 | `GET /api/gyms` | **EXISTING** | q: `page,pageSize,searchTerm,status` | items: `{id,name,location,status,employees,hrUsers,vacancies,shiftCycleLengthDays,positionsCount,shiftTemplatesCount,hasShiftTemplates}` |
| 3.2 | `POST /api/gyms` (modal-create-gym) | **EXISTING** | body: `{name*,status,address*,phone,email,shiftCycleLengthDays* (7\|10\|14\|custom)}` | `{data:{id,…}}`; on success UI navigates to gym-detail |

---

### 4. Gym Detail (`page-gym-detail`) — `Nasr City HQ`

**Header:** breadcrumb, name, `Nasr City, Cairo · est. Jan 2022`, status badge, buttons **Edit Info**, **Archive Gym**. **KPI strip:** Employees, HR Users, Open Vacancies, Positions, Days Cycle. **Tabs:** Overview · Positions · Shift Templates · HR Users · Departments.

| # | API | Status | Trigger / Request | Response fields |
|---|---|---|---|---|
| 4.1 | `GET /api/gyms/{id}` | **EXISTING** | open page | `{name,location,status,address,phone,email,establishedDate,employees,hrUsers,openVacancies,positionsCount,shiftCycleLengthDays,cycleLength,currentCycle:{from,to},cycleStatus("Published"),nextCycleStatus("Draft")}` |
| 4.2 | `PUT /api/gyms/{id}` | **EXISTING** | **Edit Info** / **Change Cycle Length** — body as 3.2 | `{data}` |
| 4.3 | `DELETE /api/gyms/{id}` | **EXISTING** | **Archive Gym** | 204 / `{message}` |
| 4.4 | `GET /api/gyms/{id}/positions` | **EXISTING** | Positions tab | items: `{id,title,level("Senior"\|"Mid"\|"Junior"\|"Manager"\|"Specialist"),employeesCount}` |
| 4.5 | `POST /api/gyms/{id}/positions` | **EXISTING** | **+ Add Position** — body `{title,level}` | `{data}` |
| 4.6 | `PUT /api/gyms/{id}/positions/{positionId}` | **NEW** | **Edit** row — body `{title,level}` | `{data}` (doc has only GET/POST) |
| 4.7 | `GET /api/gyms/{id}/shift-templates` | **EXISTING** | Shift Templates tab | items: `{id,name,startTime,endTime,duration,color}` (Morning/Evening/Off) |
| 4.8 | `POST /api/gyms/{id}/shift-templates` | **EXISTING** | **+ Add Shift** — body `{name,startTime,endTime,color}` | `{data}` |
| 4.9 | `PUT /api/gyms/{id}/shift-templates/{shiftTemplateId}` | **NEW** | **Edit** row | `{data}` |
| 4.10 | `GET /api/users?gymId={id}` | **EXISTING** | HR Users tab (4 rows) | items: `{id,name,userType,role,email,status}` |
| 4.11 | `GET /api/gyms/{id}/departments` | **NEW** | Departments tab | items: `{id,departmentName,employeesCount}` |
| 4.12 | `POST /api/gyms/{id}/departments` | **NEW** | **+ Add Department** — `{departmentName}` | `{data}` |
| 4.13 | `PUT /api/gyms/{id}/departments/{departmentId}` | **NEW** | **Edit** row | `{data}` |

("Manage Users" only navigates to Users page.)

---

### 5. Users (`page-users`)

**Header:** `User Management`, `20 users · 2 disabled`, **Create User**. **Filters:** `Search by name or email…`; User Type (All / Top Management / HR Manager / HR); Gym (All Gyms / Nasr City HQ / Zamalek / New Cairo / Maadi / Alexandria); Status (All / Active / Disabled / Locked). **Table:** Name (avatar), Email, User Type, Role, Assigned Gyms, Last Login, Status, Actions(View). **Pagination:** `Showing 6 of 20 users` + Prev/1/2/3/Next.

| # | API | Status | Request | Response |
|---|---|---|---|---|
| 5.1 | `GET /api/users` | **EXISTING** | q: `page,pageSize,searchTerm,userType,gymId,status` | items: `{id,name,email,userType,role,gymAccess:["Nasr City","Zamalek"]\|"All Gyms",lastLogin,status("Active"\|"Disabled"\|"Locked"\|"No Access")}` + full pagination envelope |
| 5.2 | `POST /api/users` (modal-create-user, 4-step) | **EXISTING** | body: `{fullName*,email*,nationalId*,phone,jobTitle,accountCategory*("HR Professional (Branch or Regional)"\|"Top Management (Holding Super Admin)"\|"External Auditor (Read-Only Compliance)"),rolePreset*("HR Coordinator"\|"HR Manager"\|"Senior HR"\|"Recruitment HR Specialist"\|"Custom Granular Overrides"),gymAccessScope*("Assigned Gyms Only"\|"All Gym Locations"),gymIds:[],permissions:["employees.view","employees.create","employees.edit","attendance.view","attendance.edit","schedule.manage","requests.approve","payroll.approve","reports.export"]}` | `{data:{id}}`; on finish UI → user-detail |

---

### 6. User Detail (`page-user-detail`)

**Header:** avatar, name, userType badge, email, status; buttons **Reset Password**, **Edit User**, **Disable User**. **Tabs:** Info · Permissions · Gym Access · Activity.

| # | API | Status | Trigger / Request | Response |
|---|---|---|---|---|
| 6.1 | `GET /api/users/{id}` | **EXISTING** | open page | `{fullName,email,phone,createdDate,lastLogin,status,userType,role:"HR Manager (preset)",gymsAssignedCount,gymsAssigned:["Nasr City HQ"],permissionsGrantedCount:28,permissionsTotal:42,effectivePermissions:["employees.view",…]}` |
| 6.2 | `PUT /api/users/{id}` | **EXISTING** | **Edit User** / **Disable User** (`{status:"Disabled"}`) — body as 5.2 | `{data}` |
| 6.3 | `POST /api/users/{id}/reset-password` | **EXISTING** | **Reset Password** | `{message}` |
| 6.4 | `PUT /api/users/{id}/permissions` | **EXISTING** | Permissions tab **Save Changes** — `{permissions:[…]}` full grid (42 keys, areas: Employees, Recruitment, Attendance, Schedule, Requests, Payroll, Reports & Audit, Announcements; keys e.g. `employees.transfer`, `recruitment.vacancy_request.approve`, `requests.approve.branch`, `announcements.manage`) | `{data}` |
| 6.5 | `PUT /api/users/{id}/roles` | **EXISTING** | **Apply Role Preset** — `{rolePreset}`/`{roleId}` | `{data}` |
| 6.6 | `PUT /api/users/{id}/gym-access` | **EXISTING** | Gym Access tab **Save Changes** — `{gymIds:[…]}` (checkbox list: gymName, employees, location, assigned flag) | `{data}` |
| 6.7 | `GET /api/permissions` | **NEW** | permission grid catalog (`28 of 42 permissions granted`, grouped checkboxes) | `{items:[{key,area}]}` |
| 6.8 | `GET /api/audit-logs?userId={id}` | **NEW** | Activity tab (columns Timestamp, Action, Target, Details) | items: `{timestamp,action,target,details}` |

---

### 7. Roles & Permissions (`page-roles`)

**Header:** `6 roles · Roles are permission presets…`, **Create Role**; info banner. **Role cards (6):** HR Manager (32 Perms/10 Users), HR Coordinator (22/6), Senior HR (28/2, "Cloned from HR Manager + extras"), Recruitment HR (8/0), Payroll HR (6/0), New Role Draft (0/0, `⚠ Empty`). Actions per card: **Edit**, **Clone** icon, empty card: **Configure**, **Archive** icon.

| # | API | Status | Trigger / Request | Response items |
|---|---|---|---|---|
| 7.1 | `GET /api/roles` | **EXISTING** | page load | `{id,name,description,status,permissionsCount,usersCount,isEmpty}` + pagination |
| 7.2 | `POST /api/roles` (modal-create-role) | **EXISTING** | **Create Role** — `{name*,cloneFromRoleId?,description,permissions:[keys]}` (grid: Employees/Recruitment/Attendance/Schedule/Requests/Payroll/Reports & Other) | `{data}` |
| 7.3 | `PUT /api/roles/{id}` | **EXISTING** | **Edit** — same body | `{data}` |
| 7.4 | `PUT /api/roles/{id}/permissions` | **EXISTING** | **Configure** — `{permissions:[…]}` | `{data}` |
| 7.5 | `POST /api/roles/{id}/clone` | **EXISTING** | **Clone** icon | `{data}` |
| 7.6 | `DELETE /api/roles/{id}` | **EXISTING** | **Archive** icon | 204 |

---

### 8. Recruitment Governance (`page-recruitment`)

**Header + Create Vacancy** (modal). **KPI strip:** Open Vacancies 7 (`Across 4 gym branches`), Active Applicants 48 (`↑ 12 this week`), Interview Stage 14, Offers Pending 3. **Vacancy table:** filters (gym select: All Gyms/Nasr City HQ/Zamalek/New Cairo/Alex Sporting; `Search vacancies…`); columns Job Title (+ sub-note), Gym Branch, Department, Target HC, Candidates, Pipeline Progress (`4 Screened · 2 Interv.` + bar %), Status (Active/Urgent/Offer Phase), Action **Review**. **Contracts section:** 3 template cards (name, type badge Standard/Hourly-Shift/Full-Time, terms text, `38 Active Staff`, **Preview Terms**), **Add Template**.

| # | API | Status | Trigger / Request | Response |
|---|---|---|---|---|
| 8.1 | `GET /api/vacancies` | **EXISTING** | table + `gymId,searchTerm,page,pageSize` | items: `{id,jobTitle,qualificationNote,gymName,department,headcountNeeded,candidatesCount,pipeline:{screened,interviews,offers,hired},progressPercent,status}` |
| 8.2 | `GET /api/applications?vacancyId=` | **EXISTING** | **Review** (candidates for a vacancy) | items: `{id,candidateName,stage}` |
| 8.3 | `GET /api/recruitment/overview` | **NEW** (or aggregate 8.1+`GET /api/applications`) | KPI strip | `{openVacancies,activeApplicants,activeApplicantsDeltaWeek,interviewStage,offersPending}` |
| 8.4 | `POST /api/vacancies` (modal-create-vacancy) | **EXISTING** | **Publish Vacancy** — `{title*,gymId*,department*,headcountNeeded* (1–10),contractModel,qualifications}` | `{data}`; doc confirms `headcountNeeded` |
| 8.5 | `GET /api/contract-templates` | **NEW** | contracts section | items: `{id,name,type,terms,activeStaffCount}` |
| 8.6 | `POST /api/contract-templates` | **NEW** | **Add Template** — `{name,type,terms}` | `{data}` |

---

### 9. Org Hierarchy (`page-hierarchy`)

**Header:** badge `5 Active Branches · 312 Total Staff`; **Export Chart**. **Cluster chips:** All Regions, Cairo Metro (194), Alexandria (118). **Tree:** HQ (`Revive Gyms Holding HQ` / `Cairo Central Office`, Enterprise HC 312) → 2 regions (Cairo Metro — Lead Karim Tarek, Regional Operations VP, 194/3 branches; Alexandria — Dr. Hany Adel, 118/2 branches) → 5 branches (Nasr City HQ/Flagship/87·4HR/12 Gates; Zamalek/64·3HR/8; New Cairo/43·2HR/6; Alexandria Sporting/76·3HR/8; Smouha/42·2HR/6). **Inspector:** name, type badge, Location, Director/Lead, Assigned HR Users, Active Headcount, Staff Allocation (4 groups w/ count+%), Biometric Endpoints `12/12 Online`, buttons Open Gym Workspace, View Staff Directory.

| # | API | Status | Request | Response |
|---|---|---|---|---|
| 9.1 | `GET /api/org-hierarchy` | **NEW** | — | `{hq:{name,subtitle,headcount},regions:[{id,name,lead,leadRole,headcount,branchCount,cluster}],branches:[{id,name,location,lead,leadRole,headcount,hrCount,type,biometricGates,status}]}` |
| 9.2 | `GET /api/org-hierarchy/nodes/{nodeId}` | **NEW** | node click (`selectTreeNode`) | `{name,location,lead,leadRole,hrCount,headcount,type,staffAllocation:[{label,count,percent}],biometric:{online,total}}` |
| 9.3 | `GET /api/org-hierarchy/export` | **NEW** | **Export Chart** (`…PDF…` alert) | file download |

---

### 10. System Health (`page-health`)

**Header:** `All Systems Operational · 99.98% Uptime`; **Maintenance Mode** toggle. **KPI tiles:** API Response Time `24ms / p95: 41ms`, Cluster CPU Load `18.4% / 8 vCPUs · Peak 29%`, DB Memory Pool `41.2% / 6.6 GB / 16 GB · 0 Slow Qs`, Biometric Punches Today `34,180 / 99.4% auto-verified`. **6 service cards:** Identity & JWT Engine (Port 5001, Latency 11ms, Err Rate 0.00%), PostgreSQL Primary Cluster (Disk 24%, Replica Lag 0.01s, Latency 6ms, pool 34/100), Biometric Device Gateway (36/38 Online, Queue 0, Sync lag 0.8s, 2 Offline), MinIO Document Storage (42.6 GB, 14 MB/s, 12,840 objects), Redis Background Workers (4 Active, Backlog 0, Failed 0 in 24h), WhatsApp & SMS Relay (Delivery 98.7%, Avg 1.8s, Daily 1,420 msgs). **Telemetry table:** Timestamp, Subsystem, Event Description, Severity (Normal/Info/Warning), Latency, Status.

| # | API | Status | Request | Response |
|---|---|---|---|---|
| 10.1 | `GET /api/system/health` | **NEW** | — | `{systemStatus,uptimePercent,api:{latencyMs,p95Ms},cpu:{loadPercent,vCores,peakPercent},db:{memoryUsedGb,memoryTotalGb,slowQueries,diskUsedPercent,replicaLagSec,latencyMs,poolUsed,poolTotal},biometric:{punchesToday,autoVerifiedPercent},gateway:{online,total,queue,syncLagSec,offline},storage:{sizeGb,bandwidthMbps,objects},workers:{active,backlog,failed24h},messaging:{deliveryPercent,avgSec,dailyMessages},telemetry:[{timestamp,subsystem,description,severity,latency,status}]}` |
| 10.2 | `PUT /api/system/maintenance-mode` | **NEW** | `{enabled:true\|false}` (confirm dialog: pauses non-admin writes) | `{message}` |

---

### 11. Integrations & Devices (`page-integrations`)

**Header:** **Sync All Devices**, **Register Device**. **Tabs:** `Biometric Turnstiles (38)` · `Payment & SMS Gateways (4)` · `Accounting & Webhooks (2)`.

**Tab 1 —** summary strip: Total Devices 38, Live Online 36 (94.7%), Offline/Warnings 2, Protocol `ZKTeco Push TCP / Port 4370`. Table (branch filter select): Device Name & ID (+description), Branch, Hardware Model (`ZKTeco SpeedFace-V5L`…), `IP Address : Port`, Firmware, Status (Online/Offline), Last Heartbeat, Actions **Ping/Sync** (offline: **Diagnose/Reboot**).

| # | API | Status | Request | Response |
|---|---|---|---|---|
| 11.1 | `GET /api/biometric-devices?gymId=&page=` | **NEW** (doc only has per-gym `GET /api/gyms/{gymId}/biometric-devices` — **EXISTING** if called per branch) | branch filter | items: `{id,name,locationDescription,gymName,model,ipAddress,port,firmware,status("Online"\|"Offline"),lastHeartbeat}`; plus `{summary:{totalDevices,liveOnline,onlinePercent,offlineWarnings,protocol,port}}` |
| 11.2 | `POST /api/gyms/{gymId}/biometric-devices` | **EXISTING** | **Register Device** — `{name,model,ipAddress,port,locationDescription}` | `{data:{id,deviceToken}}` |
| 11.3 | `POST /api/biometric-devices/{id}/ping` | **NEW** | **Ping** (`Ping response: 18ms`) | `{latencyMs}` |
| 11.4 | `POST /api/biometric-devices/{id}/sync` | **NEW** | **Sync** | `{message}` |
| 11.5 | `POST /api/biometric-devices/sync-all` | **NEW** | **Sync All Devices** (38 terminals) | `{message}` |
| 11.6 | `POST /api/biometric-devices/{id}/diagnose` | **NEW** | **Diagnose** (`Device unreachable…`) | `{reachable,reason}` |
| 11.7 | `POST /api/biometric-devices/{id}/reboot` | **NEW** | **Reboot** | `{message}` |

**Tab 2 —** 4 gateway cards: Paymob (Connected, `Merchant ID: 418290`, **Configure**), WhatsApp Business Cloud API (Active, `Avg Delivery: 1.2s · 99.1%`, **Manage Templates**), Twilio/Infobip SMS Relay (Connected, `Balance: 14,250 SMS Credits`, **Configure**), Stripe Billing (Active, `Card ending 4242`, **View Billing** → billing).

| # | API | Status | Request | Response |
|---|---|---|---|---|
| 11.8 | `GET /api/integrations/gateways` | **NEW** | — | items: `{id,type("paymob"\|"whatsapp"\|"sms"\|"stripe"),name,status,configSummary:{merchantId?,avgDelivery?,deliveryPercent?,smsCredits?,cardLast4?}}` |
| 11.9 | `PUT /api/integrations/gateways/{id}` | **NEW** | **Configure** — `{config:{…}}` | `{data}` |
| 11.10 | `GET /api/integrations/gateways/{id}/templates` (+PUT) | **NEW** | **Manage Templates** (WhatsApp) | `{items:[{id,name,body}]}` |

**Tab 3 —** Odoo ERP card (Sync Enabled, Server URL, Database, Last Sync Cycle); Outbound Webhook Endpoints table: Endpoint URL, Subscribed Events (`attendance.checkin`,`attendance.checkout`), Secret Key (`whsec_…`), Status (Healthy), Actions **Test**; **Add Webhook**.

| # | API | Status | Request | Response |
|---|---|---|---|---|
| 11.11 | `GET /api/integrations/erp` | **NEW** | — | `{status,serverUrl,database,lastSyncCycle}` |
| 11.12 | `GET /api/webhooks` | **NEW** | — | items: `{id,endpointUrl,subscribedEvents:[…],secretKey,status}` |
| 11.13 | `POST /api/webhooks` | **NEW** | **Add Webhook** — `{endpointUrl,subscribedEvents:[…]}` | `{data}` |
| 11.14 | `POST /api/webhooks/{id}/test` | **NEW** | **Test** | `{status:"Healthy"}` |

---

### 12. Billing & Quotas (`page-billing`)

**Header:** **Download Statement**, **Upgrade Quota**. **Plan card:** badge `Active Enterprise Tier`, `Revive Enterprise Multi-Branch Suite`, `Billed annually · Next renewal Oct 15, 2026`, `$12,450 per year (tax incl.)`; quota bars: Gym Branch Licenses `5 of 10 (50%)`, Employee Headcount Seats `312 of 500 (62.4%)`, Biometric Hardware Endpoints `38 of 50 (76%)`, Cloud Document Storage `42.6 GB of 100 GB`. **Payment card:** VISA `Corporate Card ···· 4242`, `Expires 12/2027`, Billing Contact, Tax Registration `EG-492-819-204`, Invoice Email, **Change**. **Invoices table:** Invoice Number, Billing Period, Description, Amount, Status (Paid), Payment Date, Receipt **PDF** (rows INV-2025-004 $12,450.00; INV-2025-003 addon 20× turnstiles $1,200.00; INV-2024-002 $10,800.00).

| # | API | Status | Request | Response |
|---|---|---|---|---|
| 12.1 | `GET /api/billing/subscription` | **NEW** | — | `{tier:"Active Enterprise Tier",planName,billingCycle,nextRenewalDate,price,priceNote,quotas:[{label,used,limit,percent}]}` |
| 12.2 | `GET /api/billing/payment-method` | **NEW** | — | `{cardBrand,cardLast4,expiry,billingContact,taxRegistration,invoiceEmail}` |
| 12.3 | `PUT /api/billing/payment-method` | **NEW** | **Change** — `{cardBrand,cardLast4,expiry,billingContact,taxRegistration,invoiceEmail}` | `{data}` |
| 12.4 | `GET /api/billing/invoices` | **NEW** | q: `page,pageSize` | items: `{invoiceNumber,billingPeriod,description,amount,status,paymentDate}` + pagination |
| 12.5 | `GET /api/billing/invoices/{id}/pdf` | **NEW** | **PDF** button | file download |
| 12.6 | `GET /api/billing/statement` | **NEW** | **Download Statement** | file download |
| 12.7 | `POST /api/billing/upgrade` | **NEW** | **Upgrade Quota** (`Plan upgrade modal`) | `{data}` |

---

### 13. Reports & Analytics (`page-reports`)

**Filters:** gym select (All Gyms/Nasr City HQ/Zamalek/New Cairo), date `from`=`2026-09-01`, date `to`=`2026-09-30`, **Export**. **Tabs:** Headcount · Turnover · Attendance · Recruitment · Requests.

All **NEW** (doc has no report endpoints):

| # | API | Query | Response (exact UI fields) |
|---|---|---|---|
| 13.1 | `GET /api/reports/headcount` | `gymId,from,to` | `{totalEmployees:312,newThisMonth:14,offboarded:3,active:287,byGym:[{gymName,headcount}],detail:[{gymName,active,onLeave,terminated,newHires,turnoverRate}]}` |
| 13.2 | `GET /api/reports/turnover` | `gymId,from,to` | `{avgTurnoverRate,resignations,terminations,highestTurnoverGym,byGym:[{gymName,rate}]}` |
| 13.3 | `GET /api/reports/attendance` | `gymId,from,to` | `{overallAttendanceRate,absences,lateCheckIns,bestGym:{name,rate},byGym:[{gymName,rate}]}` |
| 13.4 | `GET /api/reports/recruitment` | `gymId,from,to` | `{openVacancies,totalApplicants,hired,conversionRate,funnel:[{stage:"Applied"\|"Screening"\|"1st Interview"\|"2nd Interview"\|"Hired",count}]}` |
| 13.5 | `GET /api/reports/requests` | `gymId,from,to` | `{total,approved,rejected,pending,byType:[{type:"Day Off"\|"Leave/Vacation"\|"Sick Leave"\|"Overtime"\|"Other",count}]}` |
| 13.6 | `GET /api/reports/export` | `report,gymId,from,to,format=csv` (**Export** button) | file download |

---

### 14. Audit Logs (`page-audit`)

**Header:** `Complete immutable record of all system actions` + **Export CSV**. **Filters:** `Search actor, action, target…`; Action Type (All / User Management / Gym Management / Permission Change / Attendance Correction / Approval/Rejection / Login/Logout); Gym select; date from/to; **Filter** button. **Table:** Timestamp, Actor (name + role), Action Type badge (`Approval`,`Schedule`,`User Created`,`Vacancy`,`Perm Change`,`Att. Correction`,`User Disabled`,`Gym Created`), Target, Gym, Details. **Pagination:** `Showing 8 of 1,247 log entries`.

| # | API | Status | Request | Response |
|---|---|---|---|---|
| 14.1 | `GET /api/audit-logs` | **NEW** | q: `page,pageSize,searchTerm,actionType,gymId,from,to` | items: `{id,timestamp,actor,actorRole,actionType,target,gym,details}` + pagination envelope |
| 14.2 | `GET /api/audit-logs/export` | **NEW** | same filters, `format=csv` (**Export CSV**) | file download |
| — | `GET /api/audit-logs?userId={id}` | **NEW** | reused by User Detail → Activity tab (`{timestamp,action,target,details}`) | |

**Permission:** `audit.view` (a key visible in the permission grid); export additionally `reports.export`.

---

### 15. Settings (`page-settings`)

**Header:** **Save All Settings**. **Tabs:** Branding & Whitelabel · Security & MFA · Localization & Timezone · Backups & Disaster Recovery.

- **Branding:** `System Portal Name` (=Revive HR System), `Primary Brand Accent Color` (#006c49), `Custom Whitelabel Domain` (portal.revivegyms.com), logo dropzone (PNG/SVG/WEBP ≤2MB)
- **Security:** Enforce MFA (checkbox), SSO Login Only Google/Entra (checkbox), `Password Policy Standard` (Strict/Standard), `Max Failed Login Attempts Before Lockout` (5), `Session Idle Timeout (minutes)` (30), `Concurrent Login Policy` (single/multiple)
- **Localization:** `Default Currency` (EGP/USD/SAR/AED), `Corporate Timezone` (UTC+02:00 Cairo…), `Date Format` (DD/MM/YYYY|MM/DD/YYYY|YYYY-MM-DD), `Primary Portal Language` (English|Arabic)
- **Backups:** Daily Backup Time `03:00 AM Cairo`, Retention `90 Days Offsite Replication`, Encryption `AES-256 GCM`, Last Verified Snapshot, **Trigger Manual Backup Now**; Platform Metadata: Core Engine `v1.2.0`, Database Engine, Active Gym Tenants `5 Branches`, Total Enrolled Staff `312`, Biometric Devices `38`

| # | API | Status | Request | Response |
|---|---|---|---|---|
| 15.1 | `GET /api/settings` | **NEW** | — | `{portalName,brandAccentColor,whitelabelDomain,logoUrl,enforceMfa,ssoLoginOnly,passwordPolicy,maxFailedLoginAttempts,sessionIdleTimeoutMinutes,concurrentLoginPolicy,defaultCurrency,corporateTimezone,dateFormat,primaryPortalLanguage,backup:{dailyBackupTime,retentionWindow,encryption,lastVerifiedSnapshot},platform:{coreEngine,databaseEngine,activeGymTenants,totalEnrolledStaff,biometricDevices}}` |
| 15.2 | `PUT /api/settings` | **NEW** | **Save All Settings** — same body (+`logo` upload multipart) | `{data}` |
| 15.3 | `POST /api/settings/backups/trigger` | **NEW** | **Trigger Manual Backup Now** | `{message,snapshot:{sizeMb,createdAt}}` |

---

### Summary

**EXISTING (match `docs/architecture/api.md`):** auth (login/refresh/logout), `GET/POST /api/gyms`, `GET/PUT/DELETE /api/gyms/{id}`, `GET/POST /api/gyms/{id}/positions`, `GET/POST /api/gyms/{id}/shift-templates`, `GET/POST /api/users`, `GET/PUT /api/users/{id}`, `PUT /api/users/{id}/roles|permissions|gym-access`, `POST /api/users/{id}/reset-password`, `GET/POST /api/roles`, `PUT /api/roles/{id}`, `PUT /api/roles/{id}/permissions`, `POST /api/roles/{id}/clone`, `DELETE /api/roles/{id}`, `GET /api/dashboard/super-admin`, `GET /api/vacancies`, `POST /api/vacancies`, `GET /api/applications`, `POST /api/gyms/{gymId}/biometric-devices`, notifications.

**NEW (~40):** permission catalog; positions/shift-template PUT; departments CRUD; per-user activity; audit-logs (+export); org-hierarchy (+node detail, +export); system health (+maintenance mode); global device list + ping/sync/sync-all/diagnose/reboot; gateways list/update/templates; ERP config; webhooks CRUD+test; billing (subscription, payment-method, invoices+pdf, statement, upgrade); 5 report endpoints + export; recruitment overview; contract templates; settings GET/PUT + backup trigger; global search.

**UI-only (no API):** banner Dismiss, tab/navigation switches, Preview Terms links, breadcrumb navigation.

