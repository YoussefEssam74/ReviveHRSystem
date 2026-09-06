# API Contract & Conventions

## Source of Truth

The generated OpenAPI specification is authoritative for all API types and contracts.

### Rules
- Never duplicate DTOs manually — generate from OpenAPI spec
- Never invent endpoints that don't exist in the backend
- Never invent request/response fields
- If functionality requires an API that doesn't exist, identify the backend change required first

## Base URL

```
Development: https://localhost:5001/api
Production:  https://{server-ip}/api
```

## Authentication

### Login
```
POST /api/auth/login
Body: { email, password }
Response: { accessToken, refreshToken, user: { id, email, userType, permissions[], gymAccess[] } }
```

### Refresh Token
```
POST /api/auth/refresh
Body: { refreshToken }
Response: { accessToken, refreshToken }
```

### Logout
```
POST /api/auth/logout
Headers: Authorization: Bearer {accessToken}
```

## Request/Response Conventions

### Headers
```
Authorization: Bearer {accessToken}
Content-Type: application/json
Accept-Language: en | ar
```

### Pagination (all list endpoints)
```
Query Parameters:
  page=1           (1-indexed)
  pageSize=20      (default 20, max 100)
  searchTerm=      (optional, server-side search)
  sortBy=          (column name)
  sortOrder=asc    (asc | desc)

Response envelope:
{
  "items": [...],
  "page": 1,
  "pageSize": 20,
  "totalCount": 150,
  "totalPages": 8
}
```

### Success Responses
```json
// Single item
{ "data": { ... } }

// List
{ "items": [...], "page": 1, "pageSize": 20, "totalCount": 150 }

// Action result
{ "message": "Employee transferred successfully." }
```

### Error Responses
```json
{
  "statusCode": 400,
  "message": "Validation failed.",
  "errors": [
    { "field": "email", "message": "Email is required." }
  ]
}
```

### HTTP Status Codes
| Code | Usage |
|------|-------|
| 200 | Success (GET, PUT) |
| 201 | Created (POST) |
| 204 | No content (DELETE) |
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Not authorized (missing permission or gym access) |
| 404 | Resource not found |
| 409 | Conflict (duplicate, concurrent edit) |
| 500 | Server error |

## Core API Endpoints

### Gyms
```
GET    /api/gyms                    → List gyms (filtered by user's access)
GET    /api/gyms/{id}               → Get gym details
POST   /api/gyms                    → Create gym
PUT    /api/gyms/{id}               → Update gym
DELETE /api/gyms/{id}               → Archive gym
GET    /api/gyms/{id}/positions     → List positions for a gym
POST   /api/gyms/{id}/positions     → Create position for a gym
GET    /api/gyms/{id}/shift-templates → List shift templates for a gym
POST   /api/gyms/{id}/shift-templates → Create shift template for a gym
```

### Users
```
GET    /api/users                   → List users
GET    /api/users/{id}              → Get user details + effective permissions
POST   /api/users                   → Create user
PUT    /api/users/{id}              → Update user
PUT    /api/users/{id}/roles        → Assign roles
PUT    /api/users/{id}/permissions  → Set individual permissions
PUT    /api/users/{id}/gym-access   → Assign gym access
POST   /api/users/{id}/reset-password → Reset password
```

### Roles
```
GET    /api/roles                   → List roles
POST   /api/roles                   → Create role
PUT    /api/roles/{id}              → Update role
PUT    /api/roles/{id}/permissions  → Set role permissions
POST   /api/roles/{id}/clone       → Clone role
DELETE /api/roles/{id}              → Archive role
```

### Recruitment
```
GET    /api/vacancy-requests             → List vacancy requests (gym-filtered; HR review queue)
POST   /api/vacancy-requests             → Create vacancy request (Branch Manager, own gym only)
PUT    /api/vacancy-requests/{id}/decide → HR Approve/Reject; Approve requires positionId + vacancy details to create the resulting Vacancy
GET    /api/vacancies               → List vacancies (gym-filtered)
POST   /api/vacancies               → Create vacancy
PUT    /api/vacancies/{id}          → Update vacancy
GET    /api/candidates              → List candidates
GET    /api/candidates/{id}         → Candidate detail
POST   /api/applications            → Submit application (public endpoint, no auth)
GET    /api/applications            → List applications (gym-filtered)
PUT    /api/applications/{id}/stage → Move to next pipeline stage
POST   /api/applications/{id}/hire  → Hire candidate → create employee
GET    /api/recruitment/follow-ups  → Candidates needing action
```

### Teams
```
GET    /api/teams                   → List teams (gym-filtered)
POST   /api/teams                   → Create team (requires `team.manage`)
PUT    /api/teams/{id}/members      → Set team members
PUT    /api/teams/{id}/leaders      → Set team leader(s)
GET    /api/teams/my-teams          → Teams the current user leads (for Team Leader "My Team")
```

### Employees
```
GET    /api/employees               → List employees (gym-filtered)
GET    /api/employees/{id}          → Employee profile
POST   /api/employees               → Create employee (manual)
PUT    /api/employees/{id}          → Update employee info
POST   /api/employees/bulk-import   → CSV bulk import
POST   /api/employees/{id}/transfer → Transfer gym
POST   /api/employees/{id}/position-change → Change position/level
POST   /api/employees/{id}/role-change → Assign/change role
POST   /api/employees/{id}/status-change → Change status
POST   /api/employees/{id}/compensation → Update compensation
POST   /api/employees/{id}/contract → Update contract
POST   /api/employees/{id}/offboard → Start offboarding
GET    /api/employees/{id}/history  → Employment history timeline
GET    /api/employees/{id}/documents → List documents
POST   /api/employees/{id}/documents → Upload document
```

### Scheduling
```
GET    /api/gyms/{gymId}/shift-cycles           → List cycles for a gym
GET    /api/shift-cycles/{id}                    → Cycle detail with assignments
POST   /api/gyms/{gymId}/shift-cycles           → Create new cycle
PUT    /api/shift-cycles/{id}                    → Update cycle (draft only)
POST   /api/shift-cycles/{id}/copy-previous     → Copy from previous cycle
PUT    /api/shift-cycles/{id}/assignments        → Bulk update assignments
POST   /api/shift-cycles/{id}/publish           → Publish cycle
GET    /api/shift-cycles/{id}/conflicts          → Check for conflicts
```

### Attendance
```
GET    /api/attendance                           → List attendance (gym + date filters)
POST   /api/attendance                           → Record attendance event (biometric/manual)
PUT    /api/attendance/{id}/correct              → Manual correction
GET    /api/employees/{id}/attendance            → Employee's attendance history
```

### Requests
```
GET    /api/requests                             → List requests (HR inbox, gym-filtered)
POST   /api/requests                             → Submit request (employee)
GET    /api/requests/{id}                        → Request detail
POST   /api/requests/{id}/decide                → Approve/reject
GET    /api/employees/{id}/requests             → Employee's request history
```

### Payroll
```
GET    /api/payroll-periods                      → List periods (gym-filtered)
GET    /api/payroll-periods/{id}                 → Period detail with entries
POST   /api/payroll-periods/{id}/approve         → Approve/lock period
GET    /api/deduction-candidates                 → Pending deductions for review
POST   /api/deduction-candidates/{id}/review     → Approve/reject deduction
GET    /api/employees/{id}/payroll               → Employee's payroll history
```

### Notifications
```
GET    /api/notifications                        → My notifications
PUT    /api/notifications/{id}/read             → Mark as read
PUT    /api/notifications/read-all              → Mark all as read
GET    /api/notifications/unread-count           → Badge count
```

### Dashboard
```
GET    /api/dashboard/super-admin                → Organization-wide KPIs
GET    /api/dashboard/hr                         → HR dashboard data (gym-scoped)
GET    /api/dashboard/employee                   → Employee dashboard data
```
