# Backend Architecture — ASP.NET Core 8

## Layer Responsibilities

### DomainLayer (Core/DomainLayer)
- **Entities**: Business objects with identity (Employee, Gym, Candidate, etc.)
- **Value Objects**: Immutable types without identity (Address, DateRange, Money)
- **Enums**: Domain enumerations (UserType, EmployeeStatus, PipelineStage, AttendanceStatus)
- **Business Rules**: Domain validation logic that belongs to the entity
- **No dependencies** on any other layer, framework, or infrastructure

### ServiceAbstraction (Core/ServiceAbstraction)
- **Service Interfaces**: Contracts that define what the application can do
- **Repository Interfaces**: Data access contracts (IEmployeeRepository, IGymRepository, etc.)
- **Unit of Work Interface**: Transaction boundary contract
- **Specification Interfaces**: Query specification contracts
- Depends only on DomainLayer

### Service (Core/Service)
- **Service Implementations**: Business logic orchestration
- **Authorization enforcement**: Validates permissions + gym scope before executing
- **Validation**: Input validation, business rule enforcement
- **Mapping**: Entity ↔ DTO transformations
- Depends on DomainLayer + ServiceAbstraction

### Persistence (Infrastructure/Persistence)
- **DbContext**: EF Core database context (PostgreSQL via Npgsql)
- **Entity Configurations**: Fluent API (IEntityTypeConfiguration<T>)
- **Repository Implementations**: Data access patterns
- **Unit of Work Implementation**: Transaction management
- **Migrations**: Database schema versioning
- **Seeding**: Initial data (default Super Admin, permission catalog)
- Depends on DomainLayer + ServiceAbstraction

### Presentation (Infrastructure/Presentation)
- **API Configuration**: Swagger, CORS, JSON serialization
- **Filters**: Exception handling, validation filters
- **Middleware**: Authentication, authorization, gym-scope, localization
- Depends on ServiceAbstraction

### ReviveHRSystem.Web (Composition Root)
- **Program.cs**: DI container setup, middleware pipeline
- **Controllers**: Thin — receive request, call service, return result
- **DI Registration**: Extension methods per layer
- References all layers for wiring

### Shared
- **DTOs**: Data Transfer Objects for API contracts
- **Result Types**: Standardized success/failure responses
- **Pagination**: PagedResult<T> envelope
- **Constants**: Application-wide constants
- No domain dependencies

## Domain Model (Key Entities)

```
Identity & Access
├── User (Id, Email, PasswordHash, UserType, IsActive)
├── Role (Id, Name, Description, IsPreset)
├── Permission (Id, Key, Area, Description)
├── UserRole (UserId, RoleId)
├── RolePermission (RoleId, PermissionId)
├── UserPermission (UserId, PermissionId) — individual overrides
└── UserGymAccess (UserId, GymId)

Organization
├── Gym (Id, Name, Location, Status, ShiftCycleLengthDays)
├── Department (Id, GymId, Name)
└── Position (Id, GymId, Title, Level, IsActive)

Recruitment
├── Vacancy (Id, GymId, PositionId, Title, Description, Status)
├── Candidate (Id, FullName, Email, Phone, PersonalInfo, CVPath)
├── Application (Id, VacancyId, CandidateId, AppliedDate, Status)
├── PipelineStage (ApplicationId, Stage, EnteredDate, RequiredAction, CompletedDate)
└── Interview (Id, ApplicationId, Stage, ScheduledDate, Outcome, Notes)

Employee
├── Employee (Id, UserId, GymId, PositionId, HireDate, Status, CandidateId?)
├── EmploymentHistory (Id, EmployeeId, ChangeType, OldValue, NewValue, EffectiveDate, ChangedBy)
├── EmployeeDocument (Id, EmployeeId, Type, FilePath, ExpiryDate)
└── Compensation (Id, EmployeeId, Amount, Currency, EffectiveDate, ChangedBy)

Scheduling
├── ShiftTemplate (Id, GymId, Name, StartTime, EndTime)
├── ShiftCycle (Id, GymId, StartDate, EndDate, Status [Draft/Published])
└── ShiftAssignment (Id, ShiftCycleId, EmployeeId, Date, ShiftTemplateId)

Attendance
├── AttendanceRecord (Id, EmployeeId, GymId, Date, CheckIn, CheckOut, Method, Status)
└── AttendanceCorrection (Id, AttendanceRecordId, OriginalCheckIn, OriginalCheckOut,
                          CorrectedCheckIn, CorrectedCheckOut, Reason, CorrectedBy, CorrectedAt)

Requests
├── EmployeeRequest (Id, EmployeeId, Type, RequestDate, TargetDate(s), Details, Status)
└── RequestDecision (Id, RequestId, Decision, Comment, DecidedBy, DecidedAt)

Payroll
├── PayrollPeriod (Id, GymId, StartDate, EndDate, Status)
├── PayrollEntry (Id, PayrollPeriodId, EmployeeId, BaseSalary, Deductions, Bonuses, NetPay)
└── DeductionCandidate (Id, EmployeeId, AttendanceRecordId, Amount, Reason, Status, ReviewedBy)

Notifications
└── Notification (Id, UserId, Title, Message, Type, IsRead, CreatedAt, LinkTo)

Audit
└── AuditLog (Id, UserId, Action, EntityType, EntityId, OldValues, NewValues, Timestamp, IpAddress)
```

## Authentication & Authorization

### JWT Strategy
- Access tokens: short-lived (15–30 minutes)
- Refresh tokens: longer-lived, rotated on each use
- Token storage strategy: TBD (see ADR-002)

### Authorization Pipeline
```
Request arrives
    → JWT middleware extracts user identity
    → Controller receives request
    → Service layer checks:
        1. Does user have the required permission? (e.g., employees.create)
        2. Does the target data belong to a gym in the user's access scope?
        3. If both pass → execute operation
        4. If either fails → return 403
```

### Gym-Scope Enforcement
- Every service method that touches gym-scoped data must include gym filtering
- The current user's accessible gym IDs are loaded from UserGymAccess
- Queries are filtered: `WHERE GymId IN (user's accessible gyms)`
- This is enforced at the service/repository level, never at the controller level

## API Conventions

See [api.md](api.md) for full API contract details.

## Error Handling

- Centralized exception handling middleware
- Standardized error envelope:
```json
{
  "statusCode": 403,
  "message": "You do not have permission to perform this action.",
  "errors": []
}
```

## Localization

- Support for English and Arabic (RTL)
- Resource files or JSON-based translation
- Accept-Language header for API responses
- Frontend handles UI directionality
