# Super Admin — Role, Features & API Contract

> **Status:** Specification (not yet implemented)
> **Source of truth for UI:** `Mock UI/Super Admin2/` (the `README.md` there is the curated product spec)
> **Related:** [api.md](./api.md) (implemented contract) · [ADR-003](../decisions/ADR-003-authorization.md) (authorization) · [database.md](./database.md)

---

## 0. Decisions locked for this phase

| # | Decision | Value |
|---|---|---|
| 1 | Gym company vs. branch | **New `Company` table above `Gym`.** `Gym` keeps its current meaning = one physical branch. Subscription, seat limits and invoices attach to `Company`. |
| 2 | Commercial scope | **Full** — plans, subscriptions, invoices, payments, revenue analytics. |
| 3 | Impersonation | **Build now**, as a real API. Session stays attributed to **TopManagement** on the audit trail. |
| 4 | Platform-wide HR Manager | Modelled as a new `UserType.HRManager` with all-gym scope but **no** platform administration. |

### Scope-change note

`docs/product/out-of-scope.md` currently excludes *"Multi-company SaaS (this is single-tenant for Revive Solutions)"*. Decision 1 supersedes that entry: the platform is explicitly **multi-company** from this phase onward. That file should be amended when implementation starts so the two documents do not contradict each other.

---

## 1. Role model

Super Admin is a **superset of HR Manager, not a sibling of it**. Inside a gym the Super Admin inherits every HR Manager capability; on top of that sit the platform-only capabilities no gym role can ever reach.

| Role | `UserType` | Data scope | Can reach the platform console? | Platform admin? |
|---|---|---|---|---|
| **Super Admin** | `TopManagement` (1) | Every company / every branch | Yes | Yes — all of it |
| **HR Manager** | `HRManager` (4) — *new* | Every company / every branch | Partially — Users, HR staff assignment, Roles | **No** |
| **HR** | `HR` (2) | Only the branches an HR Manager granted (`UserGymAccess`) | No | No |
| **Branch Manager** | `Employee` (3) + `Role.BranchManager` | Own branch | No | No |
| **Team Leader** | `Employee` (3) + `Role.TeamLeader` | Own team | No | No |
| **Employee** | `Employee` (3) + `Role.Employee` | Own profile | No | No |

### 1.1 What HR Manager can and cannot do

| Capability | HR Manager |
|---|---|
| See every company, every branch, every employee | ✅ |
| Assign / revoke HR staff on any branch | ✅ |
| Create HR and employee accounts, suspend them, reset passwords | ✅ |
| Every in-gym HR action (payroll approve, lock, hire approve, offboard, transfer) | ✅ |
| View / create / edit roles and permission presets | ✅ |
| Create **HR Manager** accounts | ❌ Super Admin only |
| Create / suspend / close companies and branches | ❌ |
| Plans, subscriptions, invoices, payments, revenue | ❌ |
| Platform audit, security policy, feature flags | ❌ |
| Impersonate into a workspace | ❌ |

### 1.2 Assignment model (mirrors the mock)

- An **HR Manager is not attached to a company** — one account covers all of them. No `UserGymAccess` rows are required; scope is derived from `UserType`.
- Only **HR** staff carry explicit assignments, and one HR user can hold several branches at once.
- `UserGymAccess` stays the mechanism for `UserType.HR`. Role grants live in the single **`UserRoles`** table: a row with `GymId` set is a per-gym role, a row with `GymId IS NULL` is a platform-wide one. `RoleName` (a string) is the foreign key to `Roles.Name`, so an assignment reads without a join.

### 1.3 Access-level legend used in §6

| Tag | Meaning |
|---|---|
| `SA` | Super Admin (`TopManagement`) only |
| `SA+HRM` | Super Admin or HR Manager |
| `SA+HRM+HR` | Any of the three, with HR limited to assigned branches |
| `ANY` | Any authenticated user |
| `—` | Not applicable |

Every `SA+HRM` / `SA+HRM+HR` endpoint is enforced by **permission key + scope**, not by the tag alone.

---

## 2. Permission catalog — new `Platform` area

Added to `DevelopmentDataSeeder.PermissionCatalog` (area `Platform`, `IsSystem = true`).

### 2.1 Company & branch

| Key | Description | SA | HRM | HR | BM | TL | EMP |
|---|---|---|---|---|---|---|---|
| `platform.companies.view` | View companies, branches, overview | ✅ | ✅ | — | — | — | — |
| `platform.companies.create` | Provision a new company | ✅ | ❌ | — | — | — | — |
| `platform.companies.edit` | Edit company profile & contact | ✅ | ❌ | — | — | — | — |
| `platform.companies.status` | Suspend / restore / close a company | ✅ | ❌ | — | — | — | — |
| `platform.branches.manage` | Add / edit / archive branches | ✅ | ❌ | — | — | — | — |

### 2.2 Users & access

| Key | Description | SA | HRM | HR | BM | TL | EMP |
|---|---|---|---|---|---|---|---|
| `platform.users.view` | Platform user directory & profile | ✅ | ✅ | ❌ | — | — | — |
| `platform.users.manage` | Create / edit / suspend HR & employee accounts | ✅ | ✅ | ❌ | — | — | — |
| `platform.users.reset_password` | Admin password reset | ✅ | ✅ | ❌ | — | — | — |
| `platform.hr_manager.manage` | Create / suspend **HR Manager** accounts | ✅ | ❌ | ❌ | — | — | — |
| `gym.hr_staff.assign` | Grant / revoke HR access on a branch | ✅ | ✅ | ❌ | — | — | — |

### 2.3 Commercial

| Key | Description | SA | HRM | HR | BM | TL | EMP |
|---|---|---|---|---|---|---|---|
| `platform.plans.view` | View the subscription plan catalogue | ✅ | ❌ | — | — | — | — |
| `platform.plans.manage` | Create / edit / duplicate / archive plans | ✅ | ❌ | — | — | — | — |
| `platform.billing.view` | Invoice ledger & subscription terms | ✅ | ❌ | — | — | — | — |
| `platform.billing.manage` | Issue invoices, record payments, send reminders | ✅ | ❌ | — | — | — | — |
| `platform.revenue.view` | Revenue analytics & breakdowns | ✅ | ❌ | — | — | — | — |

### 2.4 Governance

| Key | Description | SA | HRM | HR | BM | TL | EMP |
|---|---|---|---|---|---|---|---|
| `platform.audit.view` | Platform-wide audit trail | ✅ | ❌ | — | — | — | — |
| `platform.audit.review` | Mark a critical/warning event reviewed | ✅ | ❌ | — | — | — | — |
| `platform.audit.export` | Export audit data | ✅ | ❌ | — | — | — | — |
| `platform.settings.manage` | Security policy & retention | ✅ | ❌ | — | — | — | — |
| `platform.feature_flags.manage` | Feature flags per plan | ✅ | ❌ | — | — | — | — |
| `platform.impersonate` | Enter any branch workspace | ✅ | ❌ | — | — | — | — |

Roles page reuse: `team.view` (read roles) and `team.manage` (write roles) already exist and stay the gate for `/api/roles`. `platform` area keys are **never** assignable to a custom role by an HR Manager — a `Platform`-area key can only be granted to a role whose `Scope = Platform`.

---

## 3. Domain model changes

### 3.1 New entities

#### `Company` — the gym account (tenant)

```csharp
public class Company : BaseEntity<int>
{
    public string Name { get; set; } = string.Empty;          // "Iron House Gym"
    public string Code { get; set; } = string.Empty;          // "IH-AL" (unique)
    public string? City { get; set; }                          // "Alexandria"
    public string? LogoUrl { get; set; }
    public CompanyStatus Status { get; set; } = CompanyStatus.Trial;

    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedByUserId { get; set; }
    public DateTime? ClosedAt { get; set; }

    public virtual ICollection<Gym> Branches { get; set; } = new List<Gym>();
    public virtual CompanySubscription? Subscription { get; set; }
    public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}
```

`CompanyStatus`: `Trial = 1, Active = 2, PaymentOverdue = 3, Suspended = 4, Closed = 5`

#### `Gym` — add the back-pointer (everything else unchanged)

```csharp
public int CompanyId { get; set; }
public virtual Company Company { get; set; } = null!;
```

Migration: create the `Companies` table, seed one `Company` per existing distinct `(Name, Location)` pair, then set `Gym.CompanyId` and make it `NOT NULL`.

#### `SubscriptionPlan`

```csharp
public class SubscriptionPlan : BaseEntity<int>
{
    public string Name { get; set; } = string.Empty;       // "Growth"
    public string Slug { get; set; } = string.Empty;       // "growth"
    public string? Tagline { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = "EGP";
    public int CycleCount { get; set; } = 1;               // free-form: every N …
    public PlanCycleUnit CycleUnit { get; set; } = PlanCycleUnit.Months;
    public TrialMode TrialMode { get; set; } = TrialMode.None;
    public int TrialDays { get; set; }
    public int? SeatLimit { get; set; }                    // null = unlimited
    public int? BranchLimit { get; set; }                  // null = unlimited
    public bool IsHighlighted { get; set; }                // the "Popular" badge
    public bool IsArchived { get; set; }
    public int SortOrder { get; set; }

    public virtual ICollection<PlanFeature> Features { get; set; } = new List<PlanFeature>();
    public virtual ICollection<PlanAddOn> AddOns { get; set; } = new List<PlanAddOn>();
}
```

`PlanCycleUnit`: `Months = 1, Years = 2`
`TrialMode`: `None = 0, Days = 1, TrialPlan = 2` (a trial plan is never billed)

#### `PlanFeature` / `PlanAddOn`

```csharp
public class PlanFeature : BaseEntity<int>
{
    public int PlanId { get; set; }
    public string Label { get; set; } = string.Empty;   // free text, from the catalog or typed
    public int SortOrder { get; set; }
}

public class PlanAddOn : BaseEntity<int>
{
    public int PlanId { get; set; }
    public string Name { get; set; } = string.Empty;    // "Extra employees"
    public int Quantity { get; set; } = 1;              // per 5 …
    public decimal Price { get; set; }                   // EGP 100
    public int SortOrder { get; set; }
}
```

#### `CompanySubscription`

```csharp
public class CompanySubscription : BaseEntity<int>
{
    public int CompanyId { get; set; }
    public int PlanId { get; set; }
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Trial;

    public DateTime StartedOn { get; set; }
    public DateTime CurrentPeriodStart { get; set; }
    public DateTime CurrentPeriodEnd { get; set; }
    public DateTime? TrialEndsOn { get; set; }
    public DateTime? RenewsOn { get; set; }
    public DateTime? CancelledOn { get; set; }
    public string? CancelReason { get; set; }

    // Snapshots taken when the company changed plan — existing companies keep
    // their old terms until renewal.
    public decimal? PriceOverride { get; set; }
    public int? SeatLimitOverride { get; set; }
    public int? BranchLimitOverride { get; set; }

    public virtual SubscriptionPlan Plan { get; set; } = null!;
}
```

`SubscriptionStatus`: `Trial = 1, Active = 2, PastDue = 3, Cancelled = 4`

Rule: exactly **one active** subscription row per company (filtered unique index on `CompanyId` where `Status <> Cancelled`).

#### `Invoice` / `InvoicePayment`

```csharp
public class Invoice : BaseEntity<int>
{
    public string InvoiceNumber { get; set; } = string.Empty;   // "INV-2026-0418"
    public int CompanyId { get; set; }
    public int? SubscriptionId { get; set; }

    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public string PeriodLabel { get; set; } = string.Empty;      // "Nov 2026"

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EGP";
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Open;

    public DateTime IssuedOn { get; set; }
    public DateTime DueOn { get; set; }                          // IssuedOn + 30 by default
    public DateTime? PaidOn { get; set; }
    public string? Notes { get; set; }

    public virtual ICollection<InvoicePayment> Payments { get; set; } = new List<InvoicePayment>();
}

public class InvoicePayment : BaseEntity<int>
{
    public int InvoiceId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaidOn { get; set; }
    public PaymentMethod Method { get; set; } = PaymentMethod.BankTransfer;
    public string? Reference { get; set; }
    public int? RecordedByUserId { get; set; }
}
```

`InvoiceStatus`: `Draft = 1, Open = 2, Paid = 3, Overdue = 4, Trial = 5, Void = 6`
`PaymentMethod`: `BankTransfer = 1, Card = 2, Cash = 3, Other = 4`

#### `ImpersonationSession`

```csharp
public class ImpersonationSession : BaseEntity<int>
{
    public int ActorUserId { get; set; }              // always a TopManagement user
    public int CompanyId { get; set; }
    public int? BranchId { get; set; }
    public int? EffectiveRoleId { get; set; }         // role the actor "acts as"
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public DateTime ExpiresAt { get; set; }           // StartedAt + 60 min
    public string? IpAddress { get; set; }
    public string? Reason { get; set; }
}
```

#### `PlatformSetting` / `FeatureFlag`

```csharp
public class PlatformSetting : BaseEntity<int>
{
    public string Key { get; set; } = string.Empty;    // "security.passwordRotationDays"
    public string Value { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public int? UpdatedByUserId { get; set; }
}

public class FeatureFlag : BaseEntity<int>
{
    public string Key { get; set; } = string.Empty;    // "biometric.faceid.v2"
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsEnabled { get; set; }
    public FeatureFlagScope Scope { get; set; } = FeatureFlagScope.Global;
    public DateTime UpdatedAt { get; set; }
    public int? UpdatedByUserId { get; set; }
}
```

`FeatureFlagScope`: `Global = 1, Plans = 2, Companies = 3` (targets in `FeatureFlagTarget`).

### 3.2 `AuditLog` — extend

```csharp
public int? CompanyId { get; set; }        // NEW; GymId keeps meaning "branch"
public string? Category { get; set; }      // Access | Billing | Gym | User | Settings | Security | Payroll | Data | Recruitment | Attendance
public string? Severity { get; set; }      // info | warning | critical
public string? ActionLabel { get; set; }   // NEW — human label, e.g. "Suspended company account"
public string? Target { get; set; }        // NEW — "INV-2026-0418 · Flex Factory"
public string? Detail { get; set; }        // NEW — free-text explanation
public int? ImpersonationSessionId { get; set; }  // NEW — set when a Super Admin acted in a workspace
public DateTime? ReviewedAt { get; set; }
public int? ReviewedByUserId { get; set; }
```

> **Why `ActionLabel` and not `Action`:** `Action` already exists and is written by every
> service as `Created` / `Updated` / `Deleted`. Re-purposing it would have silently broken
> existing audit rows and readers, so the console's human-readable label lives in its own
> column while `Action` keeps its original meaning.

The trail stays **append-only**: no update or delete endpoint is exposed for `AuditLog` rows. `ReviewedAt` is the only mutable field.

### 3.3 `UserType` — add `HRManager`

```csharp
public enum UserType
{
    TopManagement = 1,
    HR = 2,
    Employee = 3,
    HRManager = 4      // platform HR lead — all companies, no platform admin
}
```

`EnsureGymScope` and the gym-visibility filters in `GymService` must treat `HRManager` like `TopManagement` (all branches). Platform writes are still blocked by the permission keys in §2.

---

## 4. Conventions

Unchanged from [api.md](./api.md):

- Base path `/api`; JSON in and out.
- Successful responses return the DTO **directly** — there is no `data` wrapper.
- Paginated lists return `{ items, page, pageSize, totalCount, totalPages }` (`PaginationResult<T>`). Inputs are `pageNumber` (default 1) and `pageSize` (default 10, clamped to 100).
- Errors: `{ statusCode, errorMessage, errors[] }`.
- Validation failures: `{ statusCode: 400, errorMessage, validationErrors: [{ field, errors[] }] }`.
- All platform endpoints live under `/api/platform/**` and require a Bearer token. `403` is returned when the caller holds the endpoint's permission but not the required scope; `401` when unauthenticated.

**Paging defaults for platform lists** (higher than the generic default, because the console renders dense tables): `pageSize` default **25**, max **100**.

---

## 5. Endpoint index

| # | Area | Endpoints | Status |
|---|---|---|---|
| 6.1 | Dashboard | 3 | NEW |
| 6.2 | Companies | 10 | NEW |
| 6.3 | Branches | 4 | NEW |
| 6.4 | Platform users | 8 | NEW (wraps existing `/api/users`) |
| 6.5 | HR staff assignment | 3 | NEW |
| 6.6 | Plans | 6 | NEW |
| 6.7 | Billing / invoices | 9 | NEW |
| 6.8 | Revenue analytics | 9 | NEW |
| 6.9 | Roles & permissions | 7 | 5 EXTEND existing · 2 NEW |
| 6.10 | Audit & security | 9 | NEW |
| 6.11 | Settings & feature flags | 7 | NEW |
| 6.12 | Impersonation | 4 | NEW |
| 6.13 | Global search | 1 | NEW |

**Total: 80 endpoints** — 5 extend existing controllers (`/api/roles`, `/api/permissions`), 75 are net-new.

---

## 6. API catalogue

### 6.1 Dashboard

#### `GET /api/platform/dashboard`
**Access:** `SA+HRM` · `platform.companies.view`
KPI strip + summary counts for the landing page.

**Response 200**
```json
{
  "companies": { "total": 6, "active": 4, "trial": 1, "paymentOverdue": 1, "suspended": 0 },
  "users": { "total": 293, "gymMembers": 290, "platformUsers": 3, "hrManagers": 3, "addedThisMonth": 7 },
  "revenue": { "mrr": 95000, "arr": 1140000, "overdue": 8500, "billedThisMonth": 95000, "collectedThisMonth": 86500 },
  "seats": { "used": 293, "capacity": 300, "utilisationPercent": 98 },
  "attention": { "critical": 2, "warnings": 3, "total": 5 }
}
```
`capacity` counts only capped plans; unlimited (Enterprise) companies are excluded from `utilisationPercent`.

#### `GET /api/platform/dashboard/alerts`
**Access:** `SA+HRM` · `platform.companies.view`

**Query:** `severity?` (`critical|warning|info`), `companyId?`

**Response 200**
```json
{
  "items": [
    {
      "id": "invoice-overdue:418",
      "severity": "critical",
      "type": "InvoiceOverdue",
      "title": "Flex Factory invoice overdue",
      "detail": "EGP 8,500 due 12 days ago · payroll blocked",
      "companyId": 6,
      "companyName": "Flex Factory — Mansoura",
      "actionLabel": "Review company",
      "actionTarget": "company-detail",
      "raisedAt": "2026-11-05T00:00:00Z"
    },
    {
      "id": "trial-ending:5",
      "severity": "warning",
      "type": "TrialEnding",
      "title": "Peak Performance trial ends in 10 days",
      "detail": "Growth trial · 31 of 100 seats used",
      "companyId": 5,
      "companyName": "Peak Performance — Sheikh Zayed",
      "actionLabel": "Review company",
      "actionTarget": "company-detail",
      "raisedAt": "2026-11-17T00:00:00Z"
    }
  ],
  "counts": { "critical": 2, "warning": 3, "info": 0, "total": 5 }
}
```

Alert types are **derived**, never stored — resolving the cause clears the alert:

| Type | Derived when |
|---|---|
| `InvoiceOverdue` | an invoice has `Status = Overdue` |
| `TrialEnding` | company status is `Trial` and `RenewsOn` is within 14 days |
| `SeatQuotaNearLimit` | `seatsUsed / seatLimit >= 0.75` on a capped plan |
| `PayrollAwaitingApproval` | the company's current payroll period is `PendingApproval` |
| `FailedSignInBurst` | ≥ 5 failed sign-ins for one account in 15 minutes |

#### `GET /api/platform/dashboard/user-growth`
**Access:** `SA+HRM` · `platform.companies.view`

**Query:** `months` (default 12, max 24)

**Response 200**
```json
{ "series": [ { "label": "Dec", "period": "2025-12", "users": 168 }, { "label": "Nov", "period": "2026-11", "users": 293 } ] }
```

---

### 6.2 Companies (gym accounts)

#### `GET /api/platform/companies`
**Access:** `SA+HRM` · `platform.companies.view`

**Query**
| Param | Type | Notes |
|---|---|---|
| `search` | string? | matches name, code, city |
| `status` | string? | `Trial\|Active\|PaymentOverdue\|Suspended\|Closed` |
| `planId` | int? | |
| `sortBy` | string? | `name\|plan\|branches\|users\|seats\|mrr\|renewsOn\|status` (default `name`) |
| `sortDir` | string? | `asc\|desc` (default `asc`) |
| `pageNumber` | int | default 1 |
| `pageSize` | int | default 25, max 100 |

**Response 200**
```json
{
  "items": [
    {
      "id": 4,
      "code": "IH-AL",
      "name": "Iron House Gym",
      "city": "Alexandria",
      "logoUrl": null,
      "status": "Active",
      "plan": { "id": 3, "name": "Enterprise" },
      "branchCount": 4,
      "userCount": 96,
      "seatLimit": null,
      "seatUsagePercent": null,
      "mrr": 42000,
      "billingCycle": "Monthly",
      "subscribedOn": "2023-11-04",
      "renewsOn": "2026-12-03",
      "renewalDaysRemaining": 16,
      "payrollStatus": "Locked · Nov 2026"
    }
  ],
  "page": 1, "pageSize": 25, "totalCount": 6, "totalPages": 1
}
```

#### `POST /api/platform/companies`
**Access:** `SA` · `platform.companies.create`
Provisions a company, its first branch, its subscription and (optionally) HR assignments in **one transaction** (the 4-step wizard).

**Request**
```json
{
  "name": "Peak Performance",
  "code": "PP-GZ",
  "city": "Giza",
  "logoUrl": null,
  "primaryBranch": { "name": "Sheikh Zayed Club", "area": "Beverly Hills", "address": "7 Beverly Hills Gate 2", "phone": "+20 103 444 5501" },
  "contact": { "name": "Nour Shehata", "email": "hello@peakperformance.com", "phone": "+20 103 444 5566" },
  "subscription": { "planId": 2, "startTrial": true },
  "hrStaffIds": [12, 15],
  "assignHrLater": false
}
```
Rules: `name` + `contact.email` required; `code` is optional — omit it and the API derives a unique code from the name (initials, plus a numeric suffix when taken), so the console never asks the operator for one; `code` unique (case-insensitive) when supplied; `logoUrl` accepts an absolute URL or a data URL (the console uploads a downscaled data URL); `startTrial` only allowed when the plan's `TrialMode != None`; `hrStaffIds` and `assignHrLater = true` are mutually exclusive.

**Response 201**
```json
{
  "id": 7,
  "code": "PP-GZ",
  "name": "Peak Performance",
  "status": "Trial",
  "primaryBranchId": 15,
  "subscription": { "planId": 2, "planName": "Growth", "status": "Trial", "trialEndsOn": "2026-12-01", "seatLimit": 100, "branchLimit": 3, "mrr": 0 },
  "assignedHrStaffCount": 2,
  "createdAt": "2026-11-17T16:15:00Z"
}
```
**Errors:** 400 (validation, duplicate code, trial not allowed), 401, 403.

**Audit:** one `Gym / info / "Created company account"` event, plus one `User / info / "Assigned HR to company"` event per assigned HR user.

#### `GET /api/platform/companies/{id}`
**Access:** `SA+HRM` · `platform.companies.view`

**Response 200**
```json
{
  "id": 4,
  "code": "IH-AL",
  "name": "Iron House Gym",
  "city": "Alexandria",
  "logoUrl": null,
  "status": "Active",
  "contact": { "name": "Hany Darwish", "email": "admin@ironhouse.com", "phone": "+20 102 333 4455" },
  "createdAt": "2023-11-04T00:00:00Z",
  "subscription": {
    "id": 4, "planId": 3, "planName": "Enterprise", "status": "Active",
    "price": 42000, "cycleCount": 1, "cycleUnit": "Years",
    "seatLimit": null, "branchLimit": null,
    "startedOn": "2023-11-04", "currentPeriodStart": "2026-11-04", "currentPeriodEnd": "2027-11-03", "renewsOn": "2026-12-03"
  },
  "counts": { "branches": 4, "users": 96, "hrStaff": 3, "invoices": 5, "auditEvents": 12 },
  "health": { "score": 97, "lastActivityAt": "2026-11-17T15:48:00Z", "attendanceRate30d": 95 },
  "payrollStatus": "Locked · Nov 2026",
  "blocking": { "payrollBlocked": false, "reason": null }
}
```
**Errors:** 401, 403, 404.

#### `PUT /api/platform/companies/{id}`
**Access:** `SA` · `platform.companies.edit`

**Request**
```json
{ "name": "Iron House Gym", "city": "Alexandria", "logoUrl": null, "contact": { "name": "Hany Darwish", "email": "admin@ironhouse.com", "phone": "+20 102 333 4455" } }
```
`code` is immutable after creation (it prefixes every branch code). **Response 200** = the `GET` shape. **Errors:** 400, 401, 403, 404.

#### `PUT /api/platform/companies/{id}/status`
**Access:** `SA` · `platform.companies.status`
Suspend, restore or close. Suspend blocks **sign-in and payroll** but deletes nothing.

**Request**
```json
{ "status": "Suspended", "reason": "Invoice INV-2026-0418 is 12 days overdue." }
```
`status` ∈ `Suspended | Active | Closed`. `Closed` requires `confirmCode` matching the company code. Transitioning `Suspended → Active` requires `reason` to be omitted.

**Response 200**
```json
{ "id": 6, "status": "Suspended", "payrollBlocked": true, "signInBlocked": true, "sessionsRevoked": 4, "changedAt": "2026-11-17T12:40:00Z" }
```
**Errors:** 400 (invalid transition, missing/incorrect `confirmCode`), 403, 404.
**Audit:** `Gym / warning / "Suspended company account"` (or `info / "Restored company account"`).

#### `GET /api/platform/companies/{id}/overview`
**Access:** `SA+HRM` · `platform.companies.view`
Card data for the Overview tab (kept separate so the detail call stays small).

**Response 200**
```json
{
  "roleBreakdown": { "hr": 3, "branchManager": 3, "teamLeader": 6, "employee": 84, "total": 96 },
  "attendanceTrend14d": [38, 44, 41, 49, 45, 53, 48, 57, 52, 61, 56, 64, 59, 68],
  "attendanceTotal14d": 731,
  "accountFacts": {
    "planName": "Enterprise", "billingCycle": "Monthly", "subscribedOn": "2023-11-04",
    "renewsOn": "2026-12-03", "monthlyValue": 42000, "payrollStatus": "Locked · Nov 2026",
    "lastActivityAt": "2026-11-17T15:48:00Z"
  }
}
```

#### `GET /api/platform/companies/{id}/employees`
**Access:** `SA+HRM+HR` · `platform.companies.view` (HR restricted to assigned branches)

**Query:** `search?`, `role?` (`HR|BranchManager|TeamLeader|Employee`), `branchId?`, `status?`, `pageNumber`, `pageSize`

**Response 200**
```json
{
  "items": [
    {
      "userId": 118,
      "employeeId": 96,
      "name": "Omar Youssef",
      "email": "omar.youssef@ironhouse.com",
      "initials": "OY",
      "role": "Team Leader",
      "roleId": 5,
      "branchId": 4,
      "branchName": "Smouha",
      "branchCode": "IH-AL-1",
      "status": "Active",
      "lastLoginAt": "2026-11-17T06:32:00Z",
      "joinedOn": "2025-03-11"
    }
  ],
  "page": 1, "pageSize": 25, "totalCount": 96, "totalPages": 4
}
```

#### `GET /api/platform/companies/{id}/billing`
**Access:** `SA` · `platform.billing.view`
Billing tab: subscription card + seat meter + this company's invoices.

**Response 200**
```json
{
  "plan": { "id": 3, "name": "Enterprise", "price": 42000, "cycleCount": 1, "cycleUnit": "Years", "features": ["Unlimited seats & branches", "Platform audit export"] },
  "seats": { "used": 96, "limit": null, "remaining": null },
  "invoices": [
    { "id": 5, "invoiceNumber": "INV-2026-0417", "periodLabel": "Nov 2026", "amount": 42000, "status": "Paid", "issuedOn": "2026-11-01", "paidOn": "2026-11-02" }
  ]
}
```

#### `GET /api/platform/companies/{id}/audit`
**Access:** `SA` · `platform.audit.view`
**Query:** `category?`, `severity?`, `search?`, `pageNumber`, `pageSize`
**Response 200** — same row shape as §6.10.

#### `DELETE /api/platform/companies/{id}`
**Access:** `SA` · `platform.companies.status`
Soft-close only (sets `Status = Closed`, `ClosedAt`). Hard delete is **not** exposed — financial and audit history must survive. **Response 204.** **Errors:** 400 (already closed, open invoices), 403, 404.

---

### 6.3 Branches

#### `GET /api/platform/companies/{companyId}/branches`
**Access:** `SA+HRM` · `platform.companies.view`

**Response 200**
```json
{
  "items": [
    {
      "id": 4, "code": "IH-AL-1", "name": "Smouha", "area": "Smouha",
      "address": "18 Victor Emanuel St, Smouha", "phone": "+20 102 333 4401",
      "managerName": "Hany Darwish", "status": "Active",
      "staffCount": 34, "employeeCount": 28, "teamLeaderCount": 4, "branchManagerCount": 2
    }
  ],
  "branchLimit": null,
  "branchLimitReached": false
}
```
`branchLimit` comes from the plan (or the subscription override); `branchLimitReached` drives the Add-branch guard.

#### `POST /api/platform/companies/{companyId}/branches`
**Access:** `SA` · `platform.branches.manage`

**Request**
```json
{ "name": "Gleem", "area": "Gleem", "address": "27 El-Nasr St, Gleem", "phone": "+20 102 333 4404", "managerEmployeeId": null }
```
Rules: `name` unique within the company; blocked with **409** when `branchLimitReached`; `code` is generated as `{companyCode}-{n}` server-side.

**Response 201**
```json
{ "id": 12, "code": "IH-AL-5", "name": "Gleem", "area": "Gleem", "address": "27 El-Nasr St, Gleem", "phone": "+20 102 333 4404", "managerName": "Unassigned", "status": "Active", "staffCount": 0 }
```
**Errors:** 400, 409 (limit reached / duplicate name), 403, 404.
**Audit:** `Gym / info / "Added branch"`.

#### `PUT /api/platform/companies/{companyId}/branches/{branchId}`
**Access:** `SA` · `platform.branches.manage`
**Request:** same fields as create (all optional except `name`); **Response 200** = the branch row.

#### `DELETE /api/platform/companies/{companyId}/branches/{branchId}`
**Access:** `SA` · `platform.branches.manage`
Archives the branch (`Gym.Status = Archived`). **409** when the branch still has active staff. **Response 204.**

---

### 6.4 Platform users

> These wrap the existing `/api/users` service, but must be reachable by HR Manager and return the platform-wide shape (role, gyms, branch, counters). Implement as a thin `PlatformUsersController` that delegates to `IRoleService` plus a platform scope filter — do **not** loosen the existing `/api/users` guards.

#### `GET /api/platform/users`
**Access:** `SA+HRM` · `platform.users.view`

**Query:** `search?`, `companyId?` (`platform` for users with no company), `role?` (`SuperAdmin|HRManager|HR|BranchManager|TeamLeader|Employee`), `status?` (`Active|Invited|OnLeave|Suspended`), `pageNumber`, `pageSize`

**Response 200**
```json
{
  "items": [
    {
      "id": 3, "name": "Rania Adel", "email": "rania.adel@revivehr.com", "initials": "RA",
      "userType": "HRManager", "role": "HR Manager", "roleId": 2,
      "scope": "AllCompanies",
      "companies": [],
      "branch": null, "branchCode": null,
      "status": "Active", "lastLoginAt": "2026-11-17T07:40:00Z", "createdOn": "2024-08-02",
      "createdBy": "Super Admin", "permissionCount": 45
    }
  ],
  "counts": { "total": 293, "hrManagers": 3, "hr": 12, "branchManagers": 7, "teamLeaders": 14, "employees": 257, "active": 271, "suspended": 6 },
  "page": 1, "pageSize": 25, "totalCount": 293, "totalPages": 12
}
```

#### `GET /api/platform/users/{id}`
**Access:** `SA+HRM` · `platform.users.view`

**Response 200**
```json
{
  "id": 118, "name": "Omar Youssef", "email": "omar.youssef@ironhouse.com", "phone": "+20 102 123 4567",
  "initialStatus": "OY", "userType": "Employee", "role": "Team Leader", "roleId": 5,
  "roleType": "System", "roleScope": "One team",
  "status": "Active",
  "company": { "id": 4, "name": "Iron House Gym", "city": "Alexandria" },
  "branch": { "id": 4, "name": "Smouha", "code": "IH-AL-1" },
  "companies": [ { "id": 4, "name": "Iron House Gym — Alexandria" } ],
  "preset": "Standard Team Leader",
  "joinedOn": "2025-03-11",
  "createdBy": "HR Manager",
  "lastLoginAt": "2026-11-17T06:32:00Z",
  "permissions": { "total": 12, "groups": { "Employee records": 2, "Attendance & scheduling": 3, "Requests & approvals": 2 } },
  "recentAudit": [
    { "id": 10285, "action": "Changed a user role", "target": "Omar Youssef · Team Leader → Branch Manager", "severity": "warning", "occurredAt": "2026-11-17T09:40:00Z" }
  ]
}
```

#### `POST /api/platform/users/hr-managers`
**Access:** `SA` · `platform.hr_manager.manage`
Creates a **platform-wide HR Manager** — no company assignment is stored.

**Request**
```json
{ "fullName": "Hoda Kamel", "email": "hoda.kamel@revivehr.com", "phone": "+20 112 777 8899", "presetRoleId": 2, "sendInvite": true }
```
**Response 201**
```json
{ "id": 301, "fullName": "Hoda Kamel", "email": "hoda.kamel@revivehr.com", "userType": "HRManager", "status": "Invited", "scope": "AllCompanies", "inviteSent": true }
```
**Errors:** 400 (validation, duplicate email), 401, 403.
**Audit:** `User / info / "Created HR Manager account"`.

#### `POST /api/platform/users`
**Access:** `SA+HRM` · `platform.users.manage`
Creates an **HR** or **Employee** account (HR Manager cannot mint another HR Manager).

**Request**
```json
{
  "fullName": "Mona Said", "email": "mona.said@ironhouse.com", "phone": "+20 102 000 1111",
  "userType": "HR",
  "companyIds": [4],
  "roleId": 3,
  "permissionKeys": ["employees.view", "attendance.view"],
  "sendInvite": true
}
```
`userType` ∈ `HR | Employee`. `companyIds` is **required for HR** and optional for Employee (Employee is bound by its `Employee` record). **Response 201** = the `GET /api/platform/users/{id}` shape.

#### `PUT /api/platform/users/{id}/status`
**Access:** `SA+HRM` · `platform.users.manage`
Reuses the existing suspend/reactivate semantics.

**Request**
```json
{ "status": "Suspended", "reason": "Customer reported a lost device." }
```
**Response 200**
```json
{ "id": 118, "status": "Suspended", "sessionsRevoked": 2, "changedAt": "2026-11-17T10:05:00Z" }
```
Self-suspend is refused (**400**). Suspending an HR Manager requires `platform.hr_manager.manage` (**403** for HRM).
**Audit:** `Access / warning / "Suspended user account"`.

#### `POST /api/platform/users/{id}/reset-password`
**Access:** `SA+HRM` · `platform.users.reset_password`

**Request**
```json
{ "revokeSessions": true }
```
Issues a one-time reset link. The new password is **never** returned in the response.

**Response 200**
```json
{ "userId": 118, "email": "omar.youssef@ironhouse.com", "resetLinkSent": true, "sessionsRevoked": 2 }
```
**Audit:** `Access / warning / "Reset user password"`.

#### `POST /api/platform/users/{id}/revoke-sessions`
**Access:** `SA+HRM` · `platform.users.manage`
**Request:** `{ "reason": "Lost device" }` · **Response 200:** `{ "userId": 118, "sessionsRevoked": 3 }`

#### `PUT /api/platform/users/{id}/gym-access`
**Access:** `SA+HRM` · `gym.hr_staff.assign`
Replaces the user's branch assignments wholesale (empty array revokes all). Applies to `UserType.HR` only — passing an HR Manager or Employee returns **400**.

**Request**
```json
{ "branchIds": [4, 5, 7] }
```
**Response 200**
```json
{ "userId": 118, "branchIds": [4, 5, 7], "added": [5, 7], "removed": [] }
```
**Audit:** one event per added/removed branch.

---

### 6.5 HR staff assignment (per company)

#### `GET /api/platform/companies/{companyId}/hr-staff`
**Access:** `SA+HRM` · `gym.hr_staff.assign`

**Response 200**
```json
{
  "items": [
    {
      "userId": 12, "name": "Sara Hassan", "email": "sara.hassan@ironhouse.com", "initials": "SH",
      "assignedCompanies": [ { "id": 4, "name": "Iron House Gym — Alexandria" }, { "id": 1, "name": "Revive Gym — Nasr City" } ],
      "assignedCompanyCount": 2,
      "primaryBranch": "Smouha",
      "status": "Active", "lastLoginAt": "2026-11-17T05:12:00Z"
    }
  ]
}
```

#### `POST /api/platform/companies/{companyId}/hr-staff`
**Access:** `SA+HRM` · `gym.hr_staff.assign`
Grant access to everybody named in the list (idempotent — already-assigned ids are skipped).

**Request**
```json
{ "userIds": [12, 15], "branchId": null }
```
`branchId` scopes the grant to a single branch; `null` grants the whole company.

**Response 200**
```json
{ "companyId": 4, "added": [15], "alreadyAssigned": [12], "assignedTotal": 3 }
```
**Errors:** 400 (user is not `UserType.HR`), 403, 404.

#### `DELETE /api/platform/companies/{companyId}/hr-staff/{userId}`
**Access:** `SA+HRM` · `gym.hr_staff.assign`
Revokes **this company only**; the user's other companies are untouched. **Response 200:** `{ "companyId": 4, "userId": 12, "remainingCompanyCount": 1 }` · **404** when not assigned.

---

### 6.6 Subscription plans

#### `GET /api/platform/plans`
**Access:** `SA` · `platform.plans.view`

**Query:** `includeArchived?` (default `false`)

**Response 200**
```json
{
  "items": [
    {
      "id": 2, "name": "Growth", "slug": "growth", "tagline": "Multi-branch fitness clubs",
      "price": 18000, "currency": "EGP", "cycleCount": 1, "cycleUnit": "Months", "cycleLabel": "Monthly",
      "trialMode": "Days", "trialDays": 14,
      "seatLimit": 100, "branchLimit": 3,
      "isHighlighted": false, "isArchived": false, "sortOrder": 2,
      "features": ["Everything in Starter", "Multi-branch scoping & transfers"],
      "addOns": [ { "name": "Extra employees", "quantity": 5, "price": 75 } ],
      "companiesOnPlan": 3, "mrr": 54000, "mrrSharePercent": 57
    }
  ]
}
```
`companiesOnPlan`, `mrr` and `mrrSharePercent` are computed, not stored.

#### `GET /api/platform/plans/{id}`
**Access:** `SA` · `platform.plans.view` — **Response 200** = one item from the list shape.

#### `POST /api/platform/plans`
**Access:** `SA` · `platform.plans.manage`

**Request**
```json
{
  "name": "Scale",
  "tagline": "Regional chains ready to grow",
  "price": 26000,
  "cycleCount": 1,
  "cycleUnit": "Months",
  "trialMode": "Days",
  "trialDays": 14,
  "seatLimit": 200,
  "branchLimit": 6,
  "isHighlighted": false,
  "features": ["Everything in Growth", "Priority support"],
  "addOns": [ { "name": "Extra employees", "quantity": 5, "price": 60 }, { "name": "Extra branch", "quantity": 1, "price": 1200 } ]
}
```
Rules: `name` unique (case-insensitive); `price > 0`; ≥ 1 feature; `trialDays` required and `> 0` when `trialMode = Days`; `seatLimit`/`branchLimit` `null` = unlimited; only **one** plan may be highlighted (setting it clears the others).

**Response 201** = the plan shape. **Errors:** 400, 403.
**Audit:** `Settings / info / "Created subscription plan"`.

#### `PUT /api/platform/plans/{id}`
**Access:** `SA` · `platform.plans.manage`
Body = create body. Changes apply to **new sign-ups only**; existing companies keep their snapshot until renewal. **Response 200** = the plan shape. **Audit:** `Settings / warning / "Updated subscription plan"`.

#### `POST /api/platform/plans/{id}/duplicate`
**Access:** `SA` · `platform.plans.manage`

**Request**
```json
{ "name": "Growth copy" }
```
**Response 201** = the new plan shape (features and add-ons copied).

#### `DELETE /api/platform/plans/{id}`
**Access:** `SA` · `platform.plans.manage`
Archives the plan (`IsArchived = true`). **409** when any active subscription still references it. **Response 204.**

---

### 6.7 Billing & invoices

#### `GET /api/platform/invoices`
**Access:** `SA` · `platform.billing.view`

**Query:** `status?` (`Draft|Open|Paid|Overdue|Trial|Void`), `companyId?`, `period?` (`Nov 2026`), `from?`, `to?`, `search?` (invoice number / period), `pageNumber`, `pageSize`

**Response 200**
```json
{
  "items": [
    {
      "id": 418, "invoiceNumber": "INV-2026-0418",
      "company": { "id": 6, "name": "Flex Factory", "city": "Mansoura" },
      "periodLabel": "Nov 2026",
      "plan": { "id": 1, "name": "Starter", "cycleLabel": "Monthly" },
      "amount": 8500, "currency": "EGP",
      "status": "Overdue",
      "issuedOn": "2026-11-05", "dueOn": "2026-12-05", "paidOn": null,
      "daysOverdue": 12,
      "periodStart": "2025-06-19", "periodEnd": "2026-12-19"
    }
  ],
  "summary": { "billed": 95000, "collected": 86500, "outstanding": 8500, "openInvoices": 1, "overdueInvoices": 1 },
  "page": 1, "pageSize": 25, "totalCount": 18, "totalPages": 1
}
```

#### `GET /api/platform/invoices/{id}`
**Access:** `SA` · `platform.billing.view`

**Response 200**
```json
{
  "id": 418, "invoiceNumber": "INV-2026-0418", "status": "Overdue",
  "company": { "id": 6, "name": "Flex Factory", "city": "Mansoura", "contactEmail": "accounts@flexfactory.com" },
  "periodLabel": "Nov 2026", "periodStart": "2026-11-01", "periodEnd": "2026-11-30",
  "amount": 8500, "currency": "EGP",
  "issuedOn": "2026-11-05", "dueOn": "2026-12-05", "paidOn": null, "daysOverdue": 12,
  "lineItems": [ { "description": "Starter plan · Monthly", "quantity": 1, "unitPrice": 8500, "amount": 8500 } ],
  "payments": [],
  "notes": null
}
```

#### `POST /api/platform/invoices`
**Access:** `SA` · `platform.billing.manage`
Manually issues an invoice (the scheduled job in §8 generates the recurring ones).

**Request**
```json
{
  "companyId": 6,
  "periodStart": "2026-12-01",
  "periodEnd": "2026-12-31",
  "amount": 8500,
  "issuedOn": "2026-12-01",
  "dueOn": "2026-12-31",
  "notes": "Renewal for December."
}
```
When `amount` is omitted it is derived from the active subscription (plan price or `PriceOverride`, plus applicable seat overage). `invoiceNumber` is generated as `INV-{year}-{sequence:D4}`.

**Response 201** = the `GET` detail shape. **Errors:** 400 (company suspended/closed, period overlap), 403, 404.

#### `POST /api/platform/invoices/{id}/payments`
**Access:** `SA` · `platform.billing.manage`
Records a payment; flips the invoice to `Paid` when fully settled and restores company status when the overdue block clears.

**Request**
```json
{ "amount": 8500, "paidOn": "2026-11-20", "method": "BankTransfer", "reference": "BT-2026-0418" }
```
**Response 200**
```json
{
  "invoiceId": 418, "status": "Paid", "paidOn": "2026-11-20",
  "amountPaid": 8500, "amountRemaining": 0,
  "companyStatus": "Active", "payrollBlocked": false
}
```
Partial payments keep the status `Open`/`Overdue` and return `amountRemaining > 0`.
**Errors:** 400 (amount ≤ 0, exceeds remaining, invoice void/trial), 403, 404.
**Audit:** `Billing / info / "Recorded payment"`.

#### `POST /api/platform/invoices/{id}/reminders`
**Access:** `SA` · `platform.billing.manage`
**Request:** `{ "channel": "Email" }` · **Response 200:** `{ "invoiceId": 418, "sentTo": "accounts@flexfactory.com", "sentAt": "2026-11-17T12:00:00Z" }` · **400** when the invoice is not overdue.
**Audit:** `Billing / warning / "Sent payment reminder"`.

#### `POST /api/platform/invoices/reminders/bulk`
**Access:** `SA` · `platform.billing.manage`
Sends a reminder for **every** overdue invoice.

**Response 200**
```json
{ "requested": 1, "sent": 1, "failed": [], "invoiceIds": [418] }
```

#### `POST /api/platform/invoices/{id}/void`
**Access:** `SA` · `platform.billing.manage`
**Request:** `{ "reason": "Duplicate issue" }` · **Response 200:** `{ "id": 418, "status": "Void", "voidedAt": "..." }` · **400** when the invoice already has payments.
**Audit:** `Billing / warning / "Voided invoice"`.

#### `GET /api/platform/invoices/{id}/pdf`
**Access:** `SA` · `platform.billing.view`
**Response 200** — `application/pdf` stream with `Content-Disposition: attachment; filename="INV-2026-0418.pdf"`. **404** when the invoice does not exist.

#### `GET /api/platform/invoices/export`
**Access:** `SA` · `platform.billing.view`
Same filters as the list. **Response 200** — `text/csv` stream.

---

### 6.8 Revenue analytics

All revenue endpoints accept `period` in the form `"Nov 2026"`; omitting it selects the newest period on record.

#### `GET /api/platform/revenue/periods`
**Access:** `SA` · `platform.revenue.view`
**Response 200:** `{ "periods": ["Nov 2026", "Oct 2026", "Sep 2026", "Aug 2026"], "current": "Nov 2026" }`

#### `GET /api/platform/revenue/summary`
**Access:** `SA` · `platform.revenue.view`

**Query:** `period?`

**Response 200**
```json
{
  "period": "Nov 2026",
  "previousPeriod": "Oct 2026",
  "mrr": { "value": 95000, "changePercent": 0, "payingCompanies": 5, "totalCompanies": 6, "averagePerCompany": 19000, "arr": 1140000 },
  "gross": { "value": 95000, "changePercent": 0, "invoiceCount": 5, "averageInvoice": 19000 },
  "collected": { "value": 86500, "changePercent": 3.6, "collectionRatePercent": 91, "invoicesPaid": 4 },
  "outstanding": { "value": 8500, "changePercent": -50, "shareOfBilledPercent": 9, "oldestDaysLate": 12 }
}
```

#### `GET /api/platform/revenue/trend`
**Access:** `SA` · `platform.revenue.view`
**Query:** `months` (default 12, max 24)
**Response 200:** `{ "series": [ { "label": "Dec", "period": "2025-12", "mrr": 34500 }, { "label": "Nov", "period": "2026-11", "mrr": 95000 } ], "changePercent": 175.4 }`

#### `GET /api/platform/revenue/per-company`
**Access:** `SA` · `platform.revenue.view`
**Query:** `period?`

**Response 200**
```json
{
  "period": "Nov 2026",
  "items": [
    {
      "companyId": 4, "companyName": "Iron House Gym", "city": "Alexandria", "code": "IH-AL",
      "planName": "Enterprise", "cycleLabel": "Monthly",
      "mrr": 42000, "mrrSharePercent": 44,
      "billed": 42000, "collected": 42000, "outstanding": 0,
      "renewsOn": "2026-12-03", "billingCycle": "Monthly",
      "settlementStatus": "Settled"
    }
  ]
}
```
`settlementStatus` ∈ `Settled | PartPaid | Overdue | Trial`.

#### `GET /api/platform/revenue/mrr-breakdown`
**Access:** `SA` · `platform.revenue.view`

**Response 200**
```json
{
  "period": "Nov 2026",
  "mrr": 95000, "arr": 1140000, "payingCompanies": 5, "averagePerCompany": 19000,
  "byPlan": [ { "planId": 3, "planName": "Enterprise", "companies": 1, "mrr": 42000 } ],
  "perCompany": [
    { "companyId": 4, "companyName": "Iron House Gym", "planName": "Enterprise", "cycleLabel": "Monthly", "seatsUsed": 96, "seatLimit": null, "revenuePerSeat": null, "mrr": 42000, "sharePercent": 44 }
  ]
}
```

#### `GET /api/platform/revenue/gross-breakdown`
**Access:** `SA` · `platform.revenue.view`

**Response 200**
```json
{
  "period": "Nov 2026",
  "gross": 95000, "previousPeriod": "Oct 2026", "previousGross": 95000,
  "change": 0, "changePercent": 0, "averageInvoice": 19000,
  "byMonth": [ { "period": "Aug 2026", "billed": 68500 }, { "period": "Nov 2026", "billed": 95000 } ],
  "byPlan": [
    { "planId": 2, "planName": "Growth", "companies": 3, "invoices": 3, "billed": 54000, "shareOfGrossPercent": 57, "previousBilled": 52000, "changePercent": 3.8, "collected": 54000, "collectionRatePercent": 100, "revenuePerCompany": 18000, "paidCompanies": 3 }
  ]
}
```

#### `GET /api/platform/revenue/collections`
**Access:** `SA` · `platform.revenue.view`

**Response 200**
```json
{
  "period": "Nov 2026",
  "collected": 86500, "collectionRatePercent": 91, "invoicesPaid": 4, "invoiceCount": 5,
  "averageDaysToPay": 4.5,
  "items": [
    { "invoiceId": 421, "invoiceNumber": "INV-2026-0421", "companyId": 1, "companyName": "Revive Gym", "amount": 18000, "issuedOn": "2026-11-01", "paidOn": "2026-11-03", "daysToPay": 2 }
  ]
}
```

#### `GET /api/platform/revenue/outstanding`
**Access:** `SA` · `platform.revenue.view`

**Response 200**
```json
{
  "period": "Nov 2026",
  "outstanding": 8500, "shareOfBilledPercent": 9, "oldestDaysLate": 12,
  "buckets": [ { "key": "current", "label": "Current", "count": 0, "amount": 0 }, { "key": "1-30", "label": "1–30 days late", "count": 1, "amount": 8500 }, { "key": "30+", "label": "30+ days late", "count": 0, "amount": 0 } ],
  "items": [
    { "invoiceId": 418, "invoiceNumber": "INV-2026-0418", "companyId": 6, "companyName": "Flex Factory", "planName": "Starter", "amount": 8500, "issuedOn": "2026-11-05", "dueOn": "2026-12-05", "daysLate": 12 }
  ]
}
```

#### `GET /api/platform/revenue/export`
**Access:** `SA` · `platform.revenue.view`
**Query:** `period?`, `metric` (`mrr|gross|collected|outstanding`) · **Response 200** — `text/csv`.

---

### 6.9 Roles & permissions

Extend the **existing** `/api/roles` endpoints with a `platform` scope indicator rather than duplicating them.

#### `GET /api/roles` — *already exists*
Add to `RoleListItem`: `Type` (`System|Custom`) and `Scope` (`Platform|AllCompanies|AssignedCompanies|OneBranch|OneTeam|OwnProfile`), plus `MembersCount`.

#### `POST /api/roles` — *already exists*
`CreateRoleRequest` already supports `CloneFromRoleId` + `Permissions` — this covers the mock's Create/Duplicate flows.

#### `GET /api/permissions` — *already exists*
Already returns `{ items, modules, totalTracked }`. Extend each item with `area` and a `platformOnly` flag so the UI can render the purple platform badge.

#### `PUT /api/roles/{id}/permissions` — *already exists*
**Rule to add:** a role whose `Scope` is not `Platform` may not receive any `platform.*` key → **400** `"Platform permissions require a platform-scoped role."`

#### `DELETE /api/roles/{id}` — *already exists*
Already rejects assigned roles with **400**. Keep that behaviour (the mock's "delete anyway" wording should be changed to the server rule).

#### `GET /api/platform/roles/launcher-options`
**Access:** `SA` · `team.view`
Powers the "Enter a company workspace → Act as …" strip.

**Response 200**
```json
{ "items": [ { "roleId": 1, "name": "HR Manager", "type": "System", "scope": "AllCompanies" }, { "roleId": 3, "name": "HR", "type": "System", "scope": "AssignedCompanies" } ] }
```

#### `GET /api/platform/permissions/matrix`
**Access:** `SA` · `team.view`
The read-only six-column comparison matrix (`page-access` grid).

**Response 200**
```json
{
  "columns": [ { "key": "sa", "label": "Super Admin" }, { "key": "hrm", "label": "HR Manager" }, { "key": "hr", "label": "HR" }, { "key": "bm", "label": "Branch Manager" }, { "key": "tl", "label": "Team Leader" }, { "key": "emp", "label": "Employee" } ],
  "groups": [
    {
      "name": "Employee records",
      "platformOnly": false,
      "rows": [
        { "key": "employees.view", "label": "View employee directory", "sa": "full", "hrm": "full", "hr": "full", "bm": "full", "tl": "full", "emp": "limited", "note": "Employees only see their own profile." }
      ]
    }
  ]
}
```
Level values: `full | limited | false`.

---

### 6.10 Audit & security

#### `GET /api/platform/audit`
**Access:** `SA` · `platform.audit.view`

**Query:** `severity?`, `companyId?` (or `platform` for company-less rows), `category?`, `action?`, `actorId?`, `from?`, `to?`, `search?` (action/actor/target/IP), `pageNumber`, `pageSize`

**Response 200**
```json
{
  "items": [
    {
      "id": 10288,
      "occurredAt": "2026-11-17T12:40:00Z",
      "actor": { "userId": 1, "name": "Youssef Essam", "initials": "YE", "role": "Super Admin" },
      "company": { "id": 6, "name": "Flex Factory", "city": "Mansoura" },
      "category": "Billing",
      "severity": "critical",
      "action": "Suspended payroll access",
      "target": "Flex Factory — Mansoura",
      "ipAddress": "156.204.11.8",
      "reviewed": false
    }
  ],
  "counts": { "total": 32, "critical": 2, "warning": 7, "info": 23, "awaitingReview": 9 },
  "page": 1, "pageSize": 25, "totalCount": 32, "totalPages": 2
}
```

#### `GET /api/platform/audit/{id}`
**Access:** `SA` · `platform.audit.view`

**Response 200**
```json
{
  "id": 10288, "occurredAt": "2026-11-17T12:40:00Z",
  "actor": { "userId": 1, "name": "Youssef Essam", "initials": "YE", "role": "Super Admin", "ipAddress": "156.204.11.8" },
  "company": { "id": 6, "name": "Flex Factory", "city": "Mansoura" },
  "branch": null,
  "category": "Billing", "severity": "critical",
  "action": "Suspended payroll access",
  "target": "Flex Factory — Mansoura",
  "detail": "Invoice INV-2026-0418 is 12 days overdue (EGP 8,500). Payroll module blocked until payment clears.",
  "oldValues": null, "newValues": null,
  "reviewed": false, "reviewedAt": null, "reviewedBy": null,
  "immutable": true
}
```

#### `POST /api/platform/audit/{id}/review`
**Access:** `SA` · `platform.audit.review`
The **only** mutation an audit row accepts.

**Request:** `{ "note": "Confirmed with finance — reminder sent." }`
**Response 200:** `{ "id": 10288, "reviewed": true, "reviewedAt": "2026-11-17T13:00:00Z", "reviewedBy": { "userId": 1, "name": "Youssef Essam" } }`
**Errors:** 400 (already reviewed), 403, 404.

#### `GET /api/platform/audit/review-queue`
**Access:** `SA` · `platform.audit.view`
**Response 200:** `{ "items": [ /* same row shape, severity ≠ info, reviewed = false, ordered severity then newest */ ], "total": 9 }`

#### `GET /api/platform/audit/summary`
**Access:** `SA` · `platform.audit.view`
KPI strip for the Security & audit page.

**Response 200**
```json
{ "awaitingReview": 9, "criticalTotal": 2, "impersonationSessions": 4, "failedSignIns": 2, "dataExports": 2, "totalEvents": 32, "oldestUnreviewedAt": "2026-11-13T15:35:00Z" }
```

#### `GET /api/platform/audit/impersonations`
**Access:** `SA` · `platform.audit.view`
**Query:** `from?`, `to?`, `actorId?`, `pageNumber`, `pageSize`

**Response 200**
```json
{
  "items": [
    { "sessionId": 41, "actorUserId": 1, "actorName": "Youssef Essam", "companyId": 4, "companyName": "Iron House Gym", "branchName": null, "effectiveRole": "HR Manager", "startedAt": "2026-11-17T15:34:00Z", "endedAt": "2026-11-17T15:48:00Z", "durationMinutes": 14, "ipAddress": "156.204.11.8", "reason": "Review November payroll lock status" }
  ],
  "page": 1, "pageSize": 25, "totalCount": 4, "totalPages": 1
}
```

#### `POST /api/platform/audit/export`
**Access:** `SA` · `platform.audit.export`
**Request:** `{ "format": "Csv", "from": "2026-11-01", "to": "2026-11-30", "severity": null, "companyId": null }`
**Response 202**
```json
{ "exportId": "EXP-2026-0042", "status": "Queued", "format": "Csv", "estimatedRows": 32, "expiresAt": "2026-11-20T12:00:00Z" }
```
`GET /api/platform/audit/exports/{exportId}` returns `{ exportId, status, downloadUrl, expiresAt }` once ready. Export packages are retained 90 days.

#### `GET /api/platform/audit/retention-policy` · `PUT /api/platform/audit/retention-policy`
**Access:** `SA` · `platform.settings.manage`

**Response 200**
```json
{ "platformEventsYears": 7, "companyEventsYears": 3, "impersonationYears": 7, "exportRetentionDays": 90, "deletable": false, "updatedAt": "2026-11-13T15:35:00Z" }
```
`deletable` is always `false` — the trail is append-only. **Audit:** `Settings / info / "Updated audit retention policy"`.

---

### 6.11 Platform settings & feature flags

#### `GET /api/platform/stations`
**Access:** `SA` only
Every gym with the station sessions that are live right now. Enrollment codes are **never returned here**: a code is a one-time secret shown only to the operator who generated it, valid for five minutes and retired the first time a station redeems it. The per-gym rotate/revoke routes (`POST /api/gyms/{gymId}/station-codes`, `DELETE /api/gyms/{gymId}/station-sessions`) already accept Top Management and are what the console's Settings page calls.

**Response 200**
```json
{
  "items": [
    {
      "gymId": 4,
      "gymName": "Revive Nasr City",
      "companyId": 1,
      "companyName": "Revive Main Gym",
      "city": "Cairo",
      "lastConnectedAt": "2026-11-23T09:14:02Z",
      "sessions": [
        {
          "id": 31,
          "createdAtUtc": "2026-11-23T09:14:02Z",
          "expiresAtUtc": "2026-11-30T09:14:02Z",
          "ipAddress": "192.168.1.24",
          "deviceInfo": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) …",
          "latitude": 30.04442,
          "longitude": 31.23571,
          "locationAccuracyMeters": 25
        }
      ]
    }
  ]
}
```
**Errors:** 401 (not a Super Admin).

#### `GET /api/platform/settings`
**Access:** `SA` · `platform.settings.manage`

**Response 200**
```json
{
  "security": { "passwordRotationDays": 60, "sessionLifetimeMinutes": 480, "maxFailedSignIns": 5, "lockoutMinutes": 15, "requireMfa": false },
  "localization": { "defaultLanguage": "en", "supportedLanguages": ["en", "ar"], "defaultTimeZone": "Africa/Cairo" },
  "branding": { "platformName": "ReviveHR", "primaryColor": "#006c49", "supportEmail": "support@revivehr.com" },
  "billing": { "currency": "EGP", "invoiceDueDays": 30, "legalName": "ReviveHR Technologies Ltd.", "taxRegistration": "EG-492-819-204", "billingEmail": "billing@revivehr.com" },
  "audit": { "platformEventsYears": 7, "companyEventsYears": 3, "exportRetentionDays": 90 }
}
```

#### `PUT /api/platform/settings`
**Access:** `SA` · `platform.settings.manage`
Partial update — send only the sections being changed; omitted sections are left untouched.

**Request**
```json
{ "security": { "passwordRotationDays": 60, "sessionLifetimeMinutes": 480 } }
```
**Response 200** = the full settings object. **Errors:** 400 (`passwordRotationDays` 30–365, `sessionLifetimeMinutes` 30–1440, `maxFailedSignIns` 3–10), 403.
**Audit:** `Settings / info / "Updated security policy"` with `oldValues`/`newValues`.

#### `GET /api/platform/feature-flags`
**Access:** `SA` · `platform.feature_flags.manage`

**Response 200**
```json
{
  "items": [
    { "id": 1, "key": "biometric.faceid.v2", "name": "Face ID v2", "description": "Second-generation kiosk matching", "isEnabled": true, "scope": "Plans", "targets": [ { "planId": 2 }, { "planId": 3 } ], "updatedAt": "2026-11-11T09:05:00Z" }
  ]
}
```

#### `POST /api/platform/feature-flags`
**Access:** `SA` · `platform.feature_flags.manage`
**Request**

```json
{ "key": "payroll.export.pdf", "name": "PDF payroll export", "description": "Adds PDF output to the payroll export", "isEnabled": false, "scope": "Plans", "targets": [ { "planId": 3 } ] }
```
`key` must be unique and match `^[a-z0-9]+(\.[a-z0-9]+)+$`. **Response 201** = the flag shape.

#### `PUT /api/platform/feature-flags/{id}` · `DELETE /api/platform/feature-flags/{id}`
**Access:** `SA` · `platform.feature_flags.manage`
Update returns the flag; delete returns **204**.
**Audit (all three):** `Settings / info / "Enabled feature flag"` / `"Updated feature flag"` / `"Deleted feature flag"`.

#### `GET /api/platform/feature-flags/effective`
**Access:** `ANY`
The flags in force for the caller, used by the SPA and the in-gym portal.

**Response 200**
```json
{ "flags": { "biometric.faceid.v2": true, "payroll.export.pdf": false } }
```

---

### 6.12 Impersonation ("Enter workspace")

A real, audited act-as session. The token's **`userType` claim stays `TopManagement`** so nothing downstream can mistake the actor for a real HR Manager; a separate `actCompanyId` / `actRoleId` pair carries the assumed scope.

#### `POST /api/platform/impersonation/start`
**Access:** `SA` · `platform.impersonate`

**Request**
```json
{ "companyId": 4, "branchId": null, "effectiveRoleId": 2, "reason": "Review November payroll lock status" }
```
`reason` is **required** (min 5 chars). Starting a session while another is open for the same actor auto-ends the previous one. `effectiveRoleId` is validated against the roles returned by §6.9's `launcher-options`.

**Response 201**
```json
{
  "sessionId": 41,
  "accessToken": "eyJhbGciOi…",
  "expiresInSeconds": 3600,
  "company": { "id": 4, "name": "Iron House Gym", "city": "Alexandria" },
  "branch": null,
  "effectiveRole": { "id": 2, "name": "HR Manager" },
  "actor": { "userId": 1, "name": "Youssef Essam", "userType": "TopManagement" },
  "startedAt": "2026-11-17T15:34:00Z",
  "expiresAt": "2026-11-17T16:34:00Z"
}
```
The issued token contains: `uid` = actor, `userType` = `TopManagement`, `gymId` = the branch (or company's first branch), `actSessionId`, `actCompanyId`, `actRoleId`, `act` = `true`.

**Errors:** 400 (missing reason, invalid role, company suspended/closed), 403, 404.
**Audit:** `Access / info / "Entered gym workspace"` + one `ImpersonationSession` row.

#### `POST /api/platform/impersonation/end`
**Access:** `ANY` (must hold `act = true`)
**Request:** `{ "sessionId": 41 }`
**Response 200:** `{ "sessionId": 41, "endedAt": "2026-11-17T15:48:00Z", "durationMinutes": 14 }`
**Errors:** 400 (already ended), 403 (not your session), 404.

#### `GET /api/platform/impersonation/current`
**Access:** `ANY`
**Response 200**
```json
{ "active": true, "sessionId": 41, "companyId": 4, "companyName": "Iron House Gym", "effectiveRole": "HR Manager", "actorName": "Youssef Essam", "startedAt": "2026-11-17T15:34:00Z", "expiresAt": "2026-11-17T16:34:00Z" }
```
Returns `{ "active": false }` when no session is open.

#### `GET /api/platform/impersonation/sessions`
**Access:** `SA` · `platform.audit.view` — same payload as §6.10 `/audit/impersonations`.

> **Security requirements**
> 1. An impersonation token may **never** call a `platform.*` endpoint (guard checks `act`). This prevents privilege laundering through a workspace session.
> 2. Every write performed inside the session is stamped with `actorUserId` = the Super Admin **and** `impersonationSessionId`, so the trail never attributes the action to the assumed role.
> 3. Session lifetime is capped at 60 minutes; expiry forces a return to the console.
> 4. Ending the session (or expiry) writes a closing audit event.

---

### 6.13 Global search

#### `GET /api/platform/search`
**Access:** `SA+HRM` · `platform.companies.view`

**Query:** `q` (min 2 chars), `limit` (default 10, max 25)

**Response 200**
```json
{
  "companies": [ { "id": 4, "name": "Iron House Gym", "city": "Alexandria", "code": "IH-AL" } ],
  "users": [ { "id": 118, "name": "Omar Youssef", "email": "omar.youssef@ironhouse.com", "companyName": "Iron House Gym" } ],
  "invoices": []
}
```

---

## 7. Business rules

### 7.1 Company lifecycle

```
                 ┌──────────── trial ────────────┐
   (create) ───► │ Trial                          │
                 └───────────────┬────────────────┘
                                 │ trial ends / converts
                                 ▼
   (create) ───────────────► Active ◄──────────┐
                                 │             │ payment recorded
                 invoice overdue │             │
                                 ▼             │
                          PaymentOverdue ──────┘
                                 │
        Super Admin suspends     │
                                 ▼
                            Suspended ──── restore ──► Active
                                 │
                                 ▼
                              Closed (terminal, soft)
```

- `Trial` and `PaymentOverdue` are **derived states** written by the invoice job; `Suspended` and `Closed` are explicit Super Admin actions.
- Suspending a company revokes every active session of its users and blocks sign-in **and** payroll.
- Restoring a company does not clear `PaymentOverdue` if the invoice is still unpaid — the next job run sets it back.
- `Closed` is terminal; the company can never be restored through the API.

### 7.2 Seat & branch limits

- Effective limit = `SeatLimitOverride` on the subscription, else the plan's `SeatLimit`. `null` means unlimited.
- Creating a user in a company at/over its seat limit returns **409** `"Seat limit reached (100/100). Upgrade the plan before adding users."`
- Adding a branch at `BranchLimit` returns **409** with the same shape.
- `SeatQuotaNearLimit` alerts fire at ≥ 75 %; the UI turns amber at 90 %.

### 7.3 Invoicing

- One invoice per company per billing period; a second attempt returns **400** `"An invoice already exists for this period."`
- `invoiceNumber` format `INV-{yyyy}-{seq:D4}`, sequence global per year, never reused.
- `DueOn` defaults to `IssuedOn + settings.billing.invoiceDueDays` (30).
- Status transitions: `Draft → Open → Paid | Overdue | Void`; `Overdue → Paid | Void`; `Trial` is terminal (amount 0, never payable).
- `Void` requires zero payments.
- When an overdue invoice is fully paid: invoice → `Paid`, company `PaymentOverdue` → `Active`, payroll block lifts, overdue alert disappears.

### 7.4 Plan changes

- Changing a company's plan writes the new `PlanId` and snapshots `PriceOverride` / `SeatLimitOverride` / `BranchLimitOverride` from the **old** plan, so an in-flight period is not repriced.
- At renewal the overrides are cleared and the new plan's live values apply.
- Downgrading below current usage is **allowed** but returns `warnings[]` in the response (e.g. `"97 users exceed the Starter limit of 50; extra seats will be billed as overage."`).

### 7.5 Roles

- `Role.IsPreset = true` rows are **system** roles — editable permissions are refused (**400** `"System role permissions are fixed."`). They may be **duplicated** into a custom role.
- A custom role may only carry `platform.*` keys when its `Scope = Platform`.
- Deleting a role that is still assigned returns **400** listing the member count.

### 7.6 Audit

- Every write endpoint in §6 appends exactly one `AuditLog` row (the multi-row exceptions are called out inline: company creation, HR assignment, bulk reminders).
- `AuditLog` rows are never updated or deleted; only `ReviewedAt` / `ReviewedByUserId` are set, once.
- Impersonated writes stamp **both** the Super Admin `UserId` and the `ImpersonationSessionId`.

---

## 8. Background jobs

| Job | Cadence | Effect |
|---|---|---|
| **Invoice generation** | daily 02:00 | Issues an invoice for every subscription whose `CurrentPeriodStart` has arrived; rolls the period forward |
| **Overdue sweep** | daily 03:00 | `Open` invoices past `DueOn` → `Overdue`; overdue invoices → company `PaymentOverdue` + payroll block |
| **Trial expiry** | daily 04:00 | `Trial` companies whose `TrialEndsOn` has passed → `PaymentOverdue` (or `Suspended` per policy) |
| **Audit export cleanup** | daily 05:00 | Deletes export packages older than `exportRetentionDays` |
| **Impersonation expiry** | hourly | Closes sessions past `ExpiresAt` and writes the closing audit event |

---

## 9. Audit event catalogue

| Category | Action | Severity | Written by |
|---|---|---|---|
| Gym | Created company account | info | `POST /companies` |
| Gym | Updated company profile | info | `PUT /companies/{id}` |
| Gym | Suspended company account | warning | `PUT /companies/{id}/status` |
| Gym | Restored company account | info | `PUT /companies/{id}/status` |
| Gym | Closed company account | critical | `PUT /companies/{id}/status` |
| Gym | Added branch | info | `POST /companies/{id}/branches` |
| Gym | Archived branch | warning | `DELETE .../branches/{id}` |
| User | Created HR Manager account | info | `POST /users/hr-managers` |
| User | Created user account | info | `POST /users` |
| User | Assigned HR to company | info | `POST /companies/{id}/hr-staff` |
| User | Removed HR from company | warning | `DELETE .../hr-staff/{userId}` |
| Access | Suspended user account | warning | `PUT /users/{id}/status` |
| Access | Restored user account | info | `PUT /users/{id}/status` |
| Access | Reset user password | warning | `POST /users/{id}/reset-password` |
| Access | Revoked user sessions | warning | `POST /users/{id}/revoke-sessions` |
| Access | Entered gym workspace | info | `POST /impersonation/start` |
| Access | Left gym workspace | info | `POST /impersonation/end` |
| Access | Blocked sign-in attempt | critical | Auth |
| Billing | Changed subscription plan | info | plan change |
| Billing | Issued invoice | info | `POST /invoices` |
| Billing | Recorded payment | info | `POST /invoices/{id}/payments` |
| Billing | Sent payment reminder | warning | `POST /invoices/{id}/reminders` |
| Billing | Voided invoice | warning | `POST /invoices/{id}/void` |
| Settings | Created subscription plan | info | `POST /plans` |
| Settings | Updated subscription plan | warning | `PUT /plans/{id}` |
| Settings | Created role | info | `POST /roles` |
| Settings | Updated role permissions | warning | `PUT /roles/{id}/permissions` |
| Settings | Deleted role | warning | `DELETE /roles/{id}` |
| Settings | Updated security policy | info | `PUT /settings` |
| Settings | Enabled / updated / deleted feature flag | info | `/feature-flags` |
| Settings | Updated audit retention policy | info | `PUT /audit/retention-policy` |

---

## 10. Build order

| Phase | Scope | Delivers |
|---|---|---|
| **P1 — Foundation** | `Company` + `Gym.CompanyId`, `PlanFeature`, `PlanAddOn`, `SubscriptionPlan`, `CompanySubscription`, `UserType.HRManager`, `AuditLog` extensions, `Platform` permission seed, migration + backfill | Schema ready; nothing in the UI works yet |
| **P2 — Platform core** | §6.1 Dashboard, §6.2 Companies, §6.3 Branches, §6.5 HR staff, §6.9 roles additions | Gym accounts + users pages live |
| **P3 — Commercial** | §6.6 Plans, §6.7 Invoices, §6.8 Revenue, §8 jobs | Billing & Revenue pages live |
| **P4 — Governance** | §6.10 Audit, §6.11 Settings/Flags, §6.12 Impersonation, §6.13 Search | Full console |

Each phase must ship with integration tests covering the permission matrix (SA vs HRM vs HR) and the scope guards (cross-company access → 403/404).

---

## 11. Open items to confirm before P1

1. ~~**Existing `Gym` data** — how should the backfill group today's `Gym` rows into companies?~~ **Decided 2026-11-20:** one company per gym (lossless, reversible). Baked into the migration as `GYM-{id}` codes with a comment explaining how to merge branches later. Rename the codes from the console once P2 ships.
2. ~~**`UserType.HRManager` vs. a role preset**~~ **Built as `UserType.HRManager = 4`.** It bypasses the *gym scope* check only; every capability still comes from the HR Manager preset role, so platform keys are never inherited by accident.
3. **Trial default** — the mock hard-codes a 14-day trial in the wizard; the plan's `TrialDays` is the proposed source of truth.
4. **Currency** — EGP is assumed platform-wide; multi-currency is out of scope for these endpoints.
5. **Invoice numbering** — `INV-{year}-{seq:D4}` is assumed; confirm if a legal series prefix is required.
6. **Email delivery** — reminders, invites and reset links all assume an email transport exists. It is not part of this spec; if it is not built, those endpoints should return a `MailNotConfigured` warning rather than failing.
