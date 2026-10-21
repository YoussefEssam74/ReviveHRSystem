# HR API — Swagger Manual Test Checklist (branch `HR`, sections S1–S4)

Manual test sheet for the HR endpoints added on the `HR` branch.
Source contract: [`docs/architecture/api-spec-from-ui.md`](../architecture/api-spec-from-ui.md) — Section 4 (HR Portal).
Endpoint reference: [`docs/architecture/api.md`](../architecture/api.md).

---

## 0. Setup (do once)

1. Start the app (from repo root):

   ```
   dotnet run --project ReviveHRSystem.Web\ReviveHRSystem.Web.csproj --launch-profile http
   ```

2. Open **http://localhost:5248/swagger** (HTTP profile — this machine has no HTTPS dev cert).
3. **Login** — `POST /api/auth/login` → *Try it out*:

   ```json
   { "email": "admin@revive.hr", "password": "Revive!2026" }
   ```

   Copy `accessToken` from the response.
4. Click **Authorize** (top of page) → enter:

   ```
   Bearer <accessToken>
   ```

   This is the **only header** needed for every HR endpoint below.

**Seeded accounts** (password `Revive!2026`):

| Email | Role |
|---|---|
| admin@revive.hr | TopManagement (bypasses permission checks — use this one) |
| karim@revive.hr | Employee |
| omar@revive.hr | Employee |
| sara@revive.hr | Employee |

**Seeded gyms:** Revive Main Gym (station code 829172), Revive Second Gym (station code 304000).

> **Tip:** run `GET /api/employees` first and note real employee IDs (`id`) and gym IDs — the sample bodies below use placeholders.

---

## 1. Employees (S1) — Swagger group **Employees**

Base route: `/api/employees`

- [ ] **GET /api/employees** — list + filters
  - Query (all optional): `gym`, `search`, `status`, `page=1`, `pageSize=20`, `sortBy`, `sortOrder`
  - Expect **200** with `{ items, page, pageSize, total, totalPages }`
  - Try: `?search=karim`, `?status=Active`, `?gym=1`

- [ ] **POST /api/employees** — create employee
  - Expect **201/200** with `{ data: { id, employeeNumber, name, ... } }`

  ```json
  {
    "firstName": "Test",
    "lastName": "User",
    "email": "test.user@revive.hr",
    "phone": "01000000000",
    "position": "Trainer",
    "level": "Employee",
    "salary": 5000,
    "gym": 1,
    "startDate": "2026-10-01"
  }
  ```

- [ ] **POST /api/employees/bulk-import** — bulk create (CSV/array payload)
- [ ] **GET /api/employees/{id}** — detail → `{ data: { ... } }`
- [ ] **PUT /api/employees/{id}** — partial update

  ```json
  { "name": "Test User Renamed", "position": "Senior Trainer", "status": "Active" }
  ```

- [ ] **POST /api/employees/{id}/status-change** — activate/suspend/offboard

  ```json
  { "status": "Suspended", "note": "Manual swagger test" }
  ```

- [ ] **GET /api/employees/{id}/history** — status/position history
- [ ] **GET /api/employees/{id}/documents** — document list
- [ ] **POST /api/employees/{id}/documents** — upload/register document
- [ ] **GET /api/employees/{id}/leave-balance** — `{ dayOff, sick, unpaid }`
- [ ] **PUT /api/employees/{id}/leave-balance** — set balances

  ```json
  {
    "dayOff": { "used": 1, "total": 5 },
    "sick":   { "used": 0, "total": 7 },
    "unpaid": { "used": 0, "total": 0 }
  }
  ```

- [ ] **GET /api/employees/{id}/requests** — employee's requests *(spec A8)*
- [ ] **GET /api/employees/{id}/attendance** — employee's attendance *(spec A7)*
  - Query: `month=2026-10`, `page`, `pageSize`
  - Expect `{ items, totals: { total, present, late, absent, off, hours, expected } }`
- [ ] **POST /api/employees/{id}/transfer** — branch transfer
- [ ] **POST /api/employees/{id}/position-change**
- [ ] **POST /api/employees/{id}/compensation** — salary change
- [ ] **POST /api/employees/{id}/contract** — contract/level change
- [ ] **POST /api/employees/{id}/role-change** — system role/permissions

---

## 2. Roles & Permissions & Users (S2)

### Roles — Swagger group **Roles**, base route `/api/roles`

- [ ] **GET /api/roles** — list (`?search=`, `page`, `pageSize`) → `{ items, ... }`
- [ ] **POST /api/roles** — create

  ```json
  { "name": "Test Role", "description": "Created from swagger", "permissions": ["attendance.view"] }
  ```

- [ ] **PUT /api/roles/{id}** — update name/description/permissions

  ```json
  { "name": "Test Role Renamed", "description": "updated", "permissions": ["attendance.view"] }
  ```

- [ ] **PUT /api/roles/{id}/permissions** — replace permission set

  ```json
  { "permissions": ["attendance.view", "attendance.correct"] }
  ```

- [ ] **POST /api/roles/{id}/clone** — clone role

  ```json
  { "name": "Test Role Clone" }
  ```

- [ ] **DELETE /api/roles/{id}** — delete (expect 400 if role has users / is preset)

### Permissions — Swagger group **Permissions**

- [ ] **GET /api/permissions** — full permission catalogue → list of permission keys

### Users — Swagger group **Users**, base route `/api/users`

- [ ] **PUT /api/users/{id}/permissions** — assign permissions

  ```json
  { "permissions": ["attendance.view", "employees.view"] }
  ```

- [ ] **PUT /api/users/{id}/roles** — assign role (by id or preset)

  ```json
  { "roleId": 2 }
  ```

  or

  ```json
  { "rolePreset": "BranchManager" }
  ```

- [ ] **PUT /api/users/{id}/gym-access** — grant gym access

  ```json
  { "gymIds": [1, 2] }
  ```

- [ ] Verify via `GET /api/roles` that `usersCount` / `permissionsCount` changed.

---

## 3. Requests (S3) — Swagger group **Requests**

Base route: `/api/requests`

- [ ] **GET /api/requests** — list + filters
  - Query: `status`, `type`, `gym`, `date` *(spec A2)*, `quick`, `page`, `pageSize`, `sortBy`, `sortOrder`
  - Try: `?status=Pending`, `?type=Leave`, `?date=2026-10-12`
  - Expect `{ items, page, pageSize, total, totalPages }` with timeline in each item
- [ ] **GET /api/requests/{id}** — detail → `{ data: { ... } }`
- [ ] **POST /api/requests** — create (HR on behalf of employee)

  ```json
  {
    "employee": "karim@revive.hr",
    "type": "Leave",
    "requestedDate": "2026-10-20",
    "endDate": "2026-10-21",
    "reason": "Vacation"
  }
  ```

  Expect `{ data: { id, status, timeline } }` — note the new `id` for the next steps.

- [ ] **POST /api/requests/{id}/decide** — approve/reject *(spec A6)*

  ```json
  { "stage": "hr", "decision": "approve", "comment": "ok" }
  ```

  - Try a reject too: `{"stage":"hr","decision":"reject","comment":"not ok"}`
- [ ] **POST /api/requests/{id}/undo-decision** — revert a decision

  ```json
  { "comment": "undo test" }
  ```

- [ ] **POST /api/requests/bulk-decide** — approve/reject many

  ```json
  { "decision": "approve", "comment": "bulk", "requestIds": [1, 2, 3] }
  ```

  Expect `{ message, approved, unpaidApplied }`
- [ ] **POST /api/requests/{id}/archive** — archive
- [ ] **POST /api/requests/{id}/restore** — restore

---

## 4. Attendance management (S4) — Swagger group **Attendance**

Base route: `/api/attendance`

- [ ] **GET /api/attendance** *(spec A1)* — HR attendance table
  - Query: `date`, `from`, `to`, `gym`, `employeeId`, `status`, `page`, `pageSize`
  - Try: `?date=2026-10-12`, `?status=Late`, `?from=2026-10-01&to=2026-10-12`
  - Expect `{ items, page, pageSize, total, totalPages }` — items include `notes`, `correctedBy`, `correctedAt`

- [ ] **POST /api/attendance/manual** *(spec A4)* — HR manual entry (HR form shape)

  ```json
  {
    "employeeId": "2",
    "date": "2026-10-12",
    "checkIn": "09:00",
    "checkOut": "17:00",
    "status": "Present",
    "reason": "Forgot to check in"
  }
  ```

  - Then confirm it shows in **GET /api/attendance?date=2026-10-12**

- [ ] **PUT /api/attendance/{id}/correct** *(spec A5)* — correct a record
  - Take an `id` from the list above

  ```json
  { "checkIn": "08:55", "checkOut": "17:30", "status": "Present", "reason": "Device was offline" }
  ```

  - Confirm `correctedBy` / `correctedAt` are populated in GET

### Related S4 items in other groups

- [ ] **Attendance → GET /api/employees/{id}/attendance** *(A7)* — see Employees section above
- [ ] **Requests → GET /api/requests?date=...** *(A2 filter)* — see Requests section above
- [ ] **StationCodes → POST /api/gyms/{gymId}/biometric-devices/pairing-codes** *(A10)*

  ```json
  { "stationLabel": "Front Desk Scanner" }
  ```

  Expect `{ code, gymId, gymName, stationLabel, generatedAt, expiresAt }`
  (e.g. `/api/gyms/1/biometric-devices/pairing-codes`)

- [ ] *(Not built — S5)* A9 shift-cycles endpoints do not exist yet; skip.

---

## 5. Groups NOT part of this review (pre-existing — skip)

| Group | Reason |
|---|---|
| **Auth** | Pre-existing — only used to get the token (`POST /api/auth/login`) |
| **Gyms** | Pre-existing module |
| **Kiosk** | Pre-existing module (station kiosk, uses `X-Station-Token`) |
| Attendance → `POST /events`, `POST /face-scan`, `GET /station-summary` | Pre-existing kiosk/station endpoints, not S4 |

---

## 6. Expected results summary

| Check | Expected |
|---|---|
| Any HR endpoint without token | **401** |
| Valid token, good payload | **200/201** with `{ data }` or `{ items, ... }` pagination envelope |
| Validation failure (e.g. missing required field) | **400** with problem details |
| Non-existing id | **404** |
| Deleting a role that has users / is preset | **400** with message |

## 7. Automated equivalent

All of the above are covered by the automated suite (107 tests for S1–S4, 193 total):

```powershell
dotnet test --filter "FullyQualifiedName~EmployeesControllerTests|FullyQualifiedName~RolesControllerTests|FullyQualifiedName~RequestsControllerTests|FullyQualifiedName~AttendanceManagementControllerTests"
```

---

*Checklist written 2026-10-12. Sections S5–S9 (Schedule, Terminations, Branch Queue, Dashboard, HR Team) are not yet implemented.*
