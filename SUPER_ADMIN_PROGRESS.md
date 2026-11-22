# Super Admin — Build Progress

Tracks the platform-owner console: what exists, how it was produced, and what is left.

| | |
|---|---|
| **Specification** | [docs/architecture/super-admin-api.md](docs/architecture/super-admin-api.md) |
| **UI reference** | `Mock UI/Super Admin2/` (README there is the curated product spec) |
| **Started** | 2026-11-20 |
| **Last updated** | 2026-11-21 |
| **Current phase** | **P4 complete — P5 (React console) not started** |

> **Outstanding work lives in [§9 Missing & incomplete](#9-missing--incomplete).** That section is the
> single source of truth for everything not yet done; the sections above it record what shipped.

### Status legend

| Mark | Meaning |
|---|---|
| ✅ | Done and verified |
| 🔄 | In progress |
| ⬜ | Not started |
| ⛔ | Blocked (reason given) |
| ➖ | Not applicable / deliberately out of scope |

---

## 1. Phase board

| Phase | Scope | Status | Progress |
|---|---|---|---|
| **P0** | Analysis + specification | ✅ Complete | 1 / 1 |
| **P1** | Foundation — schema, enums, permissions, migration | ✅ Complete | 16 / 16 |
| **P2** | Platform core — dashboard, companies, branches, HR staff, roles | ✅ Complete | 9 / 9 |
| **P3** | Commercial — plans, invoices, revenue, background jobs | ✅ Complete | 4 / 4 |
| **P4** | Governance — audit, settings, feature flags, impersonation, search | ✅ Complete | 5 / 5 |
| **P5** | React console (`/platform/*`) | ✅ Complete | 10 / 10 pages |

**Net-new backend endpoints: 79** (plus 5 existing role/permission endpoints extended) — **79 implemented**. All five phases are built; see §9 for what remains inside them.

---

## 2. What has been built (P0)

### 2.1 Artifacts produced

| File | Change | Size |
|---|---|---|
| `docs/architecture/super-admin-api.md` | **Created** — full role model, permission catalogue, domain changes, 80 endpoint contracts, business rules, audit catalogue, phased build order | ~1,640 lines |
| `docs/architecture/api.md` | **Edited** — 1 paragraph pointing to the new spec and stating those endpoints are not live yet | +2 lines |
| `PROJECT.md` | **Edited** — 1 entry added to the Architecture doc list | +1 line |
| `SUPER_ADMIN_PROGRESS.md` | **Created** — this file | — |

**No application code was written.** No entity, DTO, service, controller, migration, seeder change or React component exists for the Super Admin yet.

### 2.2 How the specification was produced

**Step 1 — read the mock UI in full.** All 13 JS files (≈4,500 lines) plus the README and shell, not just the screens:

| File | Lines | Extracted |
|---|---|---|
| `js/data.js` | 516 | Data shapes: companies, branches, users, plans, invoices, 32 audit events, 45-permission matrix, 8 roles |
| `js/core.js` | 680 | Derived totals (`platformTotals`, `revenueTotals`), state shape, modal/wizard plumbing, `logAudit`, workspace handoff |
| `js/pages-gyms.js` | 1,036 | Company list/detail, 6 tabs, branch editor, HR assignment, plan change, reset password, 4-step create wizard |
| `js/pages-billing.js` | 509 | Invoice ledger, filters, plan rail, plan editor, payment/reminder actions |
| `js/pages-revenue.js` | 619 | MRR / gross / collected / outstanding metrics and their 4 breakdown pages |
| `js/pages-access.js` | 238 | Role catalogue, role editor, duplicate/delete, workspace launcher |
| `js/pages-audit.js` | 285 | Security & audit page (present in the repo but **not wired** into `index.html` or `NAV`) |
| `js/audit-log.js` | 96 | Shared audit table + event detail modal |
| `js/pages-users.js` · `pages-user-detail.js` · `pages-hr-managers.js` · `pages-dashboard.js` | 517 | User directory, user profile, HR manager accounts, dashboard KPIs |

**Step 2 — mapped the real backend** so the contract follows existing patterns instead of inventing new ones:

- Every domain model under `Core/DomainLayer/Models/**` (9 modules, 65 files)
- `ReviveHrDbContext` + the 10 configuration files
- All 45 controllers in `Infrastructure/Presentation/Controllers/`
- Auth: `Program.cs` policies, `ApiControllerBase.GetActorUserId/EnsureGymScope`, JWT claim shape
- Conventions: `PaginationResult<T>`, `ErrorToReturn`, `ValidationErrorToReturn`, the `Platform` area rules in `DevelopmentDataSeeder`
- ADR-003 (granular permission + gym scope), `docs/product/out-of-scope.md`

**Step 3 — reconciled the two and resolved conflicts.** Five real mismatches surfaced and were either decided or documented:

| # | Conflict | Resolution |
|---|---|---|
| 1 | Mock's "gym account" owns branches; backend `Gym` **is** a branch | **You chose option A** — new `Company` table above `Gym` |
| 2 | HR Manager reaches every gym; backend only bypasses scope for `TopManagement` | New `UserType.HRManager = 4` (appended so `1/2/3` stay stable); fallback documented in §11 |
| 3 | Mock role list has 6 fixed roles; backend models BM/TL as `Employee` + role | Kept the backend model (ADR-003), mapped in §1 |
| 4 | No subscription/billing entities exist at all | Full commercial schema specified (§3.1), per your "full_billing" choice |
| 5 | `out-of-scope.md` excludes multi-company SaaS | Flagged in §0 — spec supersedes it; file needs amending when P1 starts |

**Step 4 — self-checked the spec.** Counted endpoints programmatically (78 heading blocks / 80 distinct endpoints) and corrected the index table, which had three wrong tallies.

### 2.3 Decisions you confirmed

| Question | Answer |
|---|---|
| Company vs. branch | **A** — new `Company` table above `Gym`; `Gym` = branch |
| Commercial scope | **Full** — plans, subscriptions, invoices, payments, revenue analytics |
| Impersonation | **Build now**, as a real API, attributed to **TopManagement** |
| HR Manager scope | All gyms + all HR + all employees; assigns HR to gyms; **no** platform admin |
| HR scope | Only the gyms an HR Manager granted |
| Employee | 3 kinds — Employee, Branch Manager, Team Leader |
| Spec path | `docs/architecture/super-admin-api.md` |

### 2.4 P1 as-built (2026-11-20)

**New domain types — 18 files**

| Module | Files |
|---|---|
| `PlatformModule` | `Company`, `ImpersonationSession`, `PlatformSetting`, `FeatureFlag`, `FeatureFlagTarget` + enums `CompanyStatus`, `FeatureFlagScope` |
| `BillingModule` | `SubscriptionPlan`, `PlanFeature`, `PlanAddOn`, `CompanySubscription`, `Invoice`, `InvoicePayment` + enums `PlanCycleUnit`, `TrialMode`, `SubscriptionStatus`, `InvoiceStatus`, `PaymentMethod` |

**Modified domain types**

| File | Change |
|---|---|
| `Gym.cs` | `+ int CompanyId`, `+ Company Company` navigation |
| `Enums/UserType.cs` | `+ HRManager = 4` (appended, so `1/2/3` stay stable) |
| `AuditLog.cs` | `+ CompanyId, Category, Severity, ActionLabel, Target, Detail, ImpersonationSessionId, ReviewedAt, ReviewedByUserId` |

> `ActionLabel` is a **new** column rather than re-purposing `Action`. `Action` is written by every existing service as `Created`/`Updated`/`Deleted`; overloading it would have silently corrupted the meaning of every historical audit row.

**Persistence**

| File | Change |
|---|---|
| `Data/Configurations/PlatformModuleConfigurations.cs` | **New** — Company, ImpersonationSession, PlatformSetting, FeatureFlag, FeatureFlagTarget (+ check constraint: a flag target points at exactly one plan or company) |
| `Data/Configurations/BillingModuleConfigurations.cs` | **New** — plan/feature/add-on/subscription/invoice/payment, with filtered unique indexes |
| `Data/RevivHrDbContext.cs` | 11 new `DbSet`s |
| `Data/Migrations/20261120171346_AddPlatformBillingSchema.cs` | **New**, hand-edited (see below) |

**Migration — the backfill**

EF generated `AddColumn<Gym.CompanyId>(nullable: false, defaultValue: 0)`, which would have created a dangling FK. It was rewritten as three steps:

1. add `Gyms.CompanyId` **nullable**
2. insert one `Company` per existing `Gym` (code `GYM-{id}`), then `UPDATE "Gyms"` to point at it
3. `ALTER COLUMN … SET NOT NULL`, then add the FK

Step 3 is itself the proof the backfill is complete — it would have aborted on any orphan row. `GymStatus` maps to `CompanyStatus` as `Active → Active(2)`, `Inactive → Suspended(4)`, `Archived → Closed(5)`.

**Seeding**

- 21 `Platform`-area permission keys added to `PermissionCatalog`.
- They are deliberately **excluded** from `AllPortalPermissionKeys`, so HR / Branch Manager / Team Leader bundles can never inherit platform admin.
- `PresetRolePermissionKeys[HR Manager]` gained exactly 4 keys: `platform.users.view`, `platform.users.manage`, `platform.users.reset_password`, `gym.hr_staff.assign`.
- New `EnsureCompanyAsync` helper so seeded gyms get an owning company.

**Authorization — "all gyms" vs "all permissions"**

The critical distinction: **HR Manager bypasses the gym-scope check only, never the permission check.**

| File | Change |
|---|---|
| `AccessControlService.cs` | New `HasAllGymScope()` = `TopManagement or HRManager`, applied to the *scope* half of each check; the permission half still reads the role's keys. `EnsurePermissionAsync` keeps the TopManagement-only wildcard. |
| `ApiControllerBase.cs` | `EnsureGymScope` allows `HRManager` through |
| `GymService.cs` | `GET /api/gyms` returns every active gym to `HRManager` |
| `RoleSpecifications.cs` | user-type filter accepts `"hrmanager"` |
| `EventsService.cs` | `RequesterRoleLabel` maps `HRManager → "HR Manager"` |
| `AttendanceSpecifications.cs` | management roster spec includes `HRManager` (written with `==`, not `is … or …`, because EF expression trees reject pattern matching) |

**Verification**

| Check | Result |
|---|---|
| `dotnet build ReviveHRSystem.Web.sln` | ✅ 0 errors |
| `dotnet ef database update` on the dev DB | ✅ applied; `SET NOT NULL` succeeded |
| Integration tests — `AccessControlServiceTests` + `TenantIsolationIdorTests` | ✅ 10/10 |
| Full integration suite | 690 / 701 — the 11 failures are **pre-existing** (see below) |
| Full security suite | 453 / 551 — the 98 failures are **pre-existing** (see below) |

Post-P2 status (2026-11-21): **integration 11 failures · security 98 failures — both identical to the baseline, with zero new failures.** The 29 new platform routes are fully classified in the matrix.

**Pre-existing test failures — verified against the baseline, not assumed**

An isolated `git worktree` at commit `a578445` (the state before P1) was built and run against a freshly recreated test database:

| Suite | Baseline failures | After P1 | Verdict |
|---|---|---|---|
| Integration | 11 — identical test names | 11 — identical test names | **no regression** |
| Security | 98 — all in `AccessMatrixTests` + `EndpointEnumerationTests` | 98 — same two classes | **no regression** |

Their causes are unrelated to this work:

- `EndpointEnumerationTests` — `GET api/employees/leave-defaults` and `GET api/requests/summary` are missing from `access-matrix.json` (a classification gap in the security suite, and P1 added no routes).
- `AccessMatrixTests` rows 47–58 — `EndpointPayloads.Build` has no payload for `POST /api/requests/{p}/decide|undo-decision|comments`, so the theory throws before it can assert.
- The 11 integration failures are payroll/shift arithmetic assertions (`Expected: 260, Actual: 780.00`; `Expected: 1, Actual: 0`; `Expected: BadRequest, Actual: NoContent`).

**A real regression the tests did catch:** `TestDataBuilder.CreateGymWithStationAsync` (and the dev seeder) created `Gym` rows without a company, violating the new NOT NULL FK. Both were fixed — a reminder that any future gym-creation path must supply `CompanyId`.

---

### 2.5 P2 as-built (2026-11-21)

**29 endpoints across 5 controllers**

| Controller | Route prefix | Endpoints |
|---|---|---|
| `PlatformDashboardController` | `api/platform/dashboard` | 3 |
| `PlatformSearchController` | `api/platform/search` | 1 |
| `PlatformCompaniesController` | `api/platform/companies` | 10 |
| `PlatformBranchesController` | `api/platform/companies/{companyId}/branches` | 4 |
| `PlatformHrStaffController` | `api/platform/companies/{companyId}/hr-staff` | 3 |
| `PlatformUsersController` | `api/platform/users` | 8 |

**New files**

| Layer | Files |
|---|---|
| DTOs | `Shared/DataTransferObject/Platform/` — `CompanyDtos`, `BranchAndHrStaffDtos`, `PlatformUserDtos`, `PlatformDashboardDtos`, `PlatformAuditDtos` |
| Read model | `Core/DomainLayer/Constants/IPlatformReadRepository.cs` + `Infrastructure/Persistence/Repository/PlatformReadRepository.cs` |
| Specifications | `Core/Service/Specifications/PlatformSpecifications.cs` |
| Services | `ICompanyService` / `CompanyService`, `IPlatformUserService` / `PlatformUserService`, `IPlatformDashboardService` / `PlatformDashboardService`, plus `PlatformHelpers` and `PlatformAuditFilter` |

**Why a dedicated read repository**

`IGenaricRepository` is specification-driven and cannot express `GROUP BY` / `SUM` / `DISTINCT` projections — exactly what the KPI strip, account table and attention queue are built from. `IPlatformReadRepository` follows the existing `IUserAccessRepository` precedent: a purpose-built read contract returning shaped projections, with no `IQueryable` leak and no writes.

**Attention queue is fully derived.** No alert row is stored: `InvoiceOverdue`, `TrialEnding`, `SeatQuotaNearLimit`, `PayrollAwaitingApproval` and `FailedSignInBurst` are computed per request, so resolving the cause clears the alert with no cleanup step.

**`ThenInclude` support added to the specification contract**

`ISpecification` only carried `Expression<Func<TEntity, object>>` includes, which cannot express a second-level include. Three endpoints returned **500** because `subscription.Plan` and `userGymAccess.Gym` were null:

- `ISpecification` + `BaseSpecification` gained `IncludePaths` / `AddIncludePath(string)`
- `SpecificationEvaluator` applies each as a dotted `Include(path)`
- Applied to `CompanyListSpec`, `CompanyByIdSpec`, `AllCompaniesSpec`, `CompanyHrStaffSpec`, `AllHrUsersSpec`, `PlatformUserListSpec`, `PlatformUserByIdSpec`, `CompanyUsersSpec`

This also fixed the company list, which would have rendered `—` instead of the plan name.

**Seeding**

- 3 subscription plans (Starter / Growth / Enterprise) matched by slug, idempotent.
- Every seeded company now gets an Active subscription — without it the billing tab, seat meter and MRR tile render as empty shells (and `GET …/billing` answered 400).
- `platform.companies.view` added to the HR Manager key set (it was missing from the P1 seed, contradicting spec §2.1).

**Authorization: "all gyms" vs "all permissions", verified**

| Identity | `platform.companies.view` | `platform.users.manage` | `platform.billing.view` | `platform.hr_manager.manage` |
|---|---|---|---|---|
| Super Admin | ✅ (wildcard) | ✅ | ✅ | ✅ |
| HR Manager | ✅ | ✅ | ❌ 401 | ❌ 401 |
| HR / BM / TL / Employee | ❌ 401 | ❌ 401 | ❌ 401 | ❌ 401 |

**Security matrix extended: rows 62–90**

All 29 routes classified across the suite's 8 identities. Three hazards surfaced and were fixed:

1. **Route substitution** — `SubstituteRoute` rewrites `{id}` to an *employee* id, which would have pointed company routes at nonsense. Added `SubstitutePlatformRoute`, resolving `companies → CompanyAId`, `branches → GymAId`, `users`/`hr-staff → PlatformProbeUserId`.
2. **Fixtures lacked the platform keys** — the suite's `hrManager` identity is a `UserType.HR` account holding the HR Manager preset; `HrManagerMatrixKeys` gained the 5 platform keys it legitimately holds.
3. **Matrix rows mutated real identities** — the revoke/reset rows initially targeted the live `hr` account, so rows 5 and 18 intermittently 401'd when the revoke ran first. A dedicated `PlatformProbeUserId` (never used to log in) now absorbs every user-administration row.

**Verification**

| Check | Result |
|---|---|
| `dotnet build ReviveHRSystem.Web.sln` | ✅ 0 errors |
| `dotnet ef migrations has-pending-model-changes` | ✅ none (the `Company.CreatedAt` CLR property maps to the existing column) |
| Security suite | **98 failures — identical to baseline, 0 new** |
| Integration suite | see §6 |

---

### 2.6 P3 as-built (2026-11-21)

**24 endpoints across 3 controllers**

| Controller | Route prefix | Endpoints |
|---|---|---|
| `PlatformPlansController` | `api/platform/plans` | 6 |
| `PlatformInvoicesController` | `api/platform/invoices` | 9 |
| `PlatformRevenueController` | `api/platform/revenue` | 9 |

**New files**

| Layer | Files |
|---|---|
| DTOs | `Shared/DataTransferObject/Platform/` — `PlanDtos`, `InvoiceDtos`, `RevenueDtos` |
| Services | `IPlanService`/`PlanService`, `IInvoiceService`/`InvoiceService`, `IRevenueService`/`RevenueService`, `MinimalPdfWriter` |
| Scheduled work | `ReviveHRSystem.Web/BackgroundJobs/PlatformBillingJobs.cs` |
| Tests | `Tests/ReviveHRSystem.IntegrationTests/MinimalPdfWriterTests.cs` (4 cases) |

**Invoice numbering is concurrency-safe**

`INV-{yyyy}-{seq:D4}` is allocated inside `ExecuteInTransactionAsync` **after** `AcquireTransactionLockAsync` — a PostgreSQL advisory lock. Two simultaneous issues therefore cannot read the same max sequence and produce a duplicate. Voided numbers are never reused: the sequence scans all rows for the year, not just live ones.

**Payments settle the account, not just the invoice**

A payment that reaches the invoice total flips it to `Paid`. If that was the company's last overdue invoice it also returns the company to `Active` and lifts the payroll block — the same chain the mock's "record payment" flow performs. A partial payment leaves the status alone and reports `amountRemaining`.

**The PDF has no dependency**

Rather than adding a layout library for one document, `MinimalPdfWriter` emits a valid PDF 1.4 by hand: catalog, page tree, one page, a content stream and a correct xref offset table. `MinimalPdfWriterTests` asserts the envelope, that **every xref offset actually points at its object header**, that the declared `/Length` equals the real stream length, and that `(`/`)`/`\` are escaped while non-WinAnsi characters fold to `?` (the content stream is ASCII, so an Arabic glyph would corrupt the offset table).

**Revenue is derived, never stored**

MRR comes from live subscriptions (honouring `PriceOverride` and normalising any cadence to a month); billed / collected / outstanding come from the invoice ledger. A single `GetInvoiceSnapshotAsync` projection feeds every breakdown, so the period arithmetic lives in the service instead of being spread across a dozen round trips. Resolving a payment is reflected immediately with no rollup to lag behind.

**Scheduled jobs are off by default**

`PlatformBillingJobs` implements recurring invoice generation, the overdue sweep, trial expiry and impersonation-session expiry. `PlatformJobs:Enabled` defaults to **`false`**: a worker that issues real invoices, flips companies to `PaymentOverdue` and blocks payroll is too destructive to switch on by surprise in a development database. Each job runs at most once per day behind an hourly poll, is idempotent, and writes its own audit rows through the `DbContext` rather than reaching into the service layer's internal helper.

**Reminders report the truth about email**

No mail transport is wired up yet, so `SendReminderAsync` records the attempt on the audit trail and returns `mailConfigured: false` instead of pretending to have delivered — the behaviour §11 item 6 asked for.

**Security matrix extended: rows 91–114**

All 24 routes classified. Each mutating row got its **own probe record** created in `SecurityProvisioning` (two plans, four invoices) so parallel theory execution can never let one row's side effect change another row's expected status — the same hazard that bit the P2 revoke rows.

**Verification**

| Check | Result |
|---|---|
| `dotnet build ReviveHRSystem.Web.sln` | ✅ 0 errors, 0 warnings |
| `MinimalPdfWriterTests` | ✅ 4 / 4 |
| Security suite | **98 failures — identical to baseline, 0 new** |
| Integration suite | see §6 |

---

### 2.7 P4 as-built (2026-11-21)

**26 endpoints across 3 controllers**

| Controller | Route prefix | Endpoints |
|---|---|---|
| `PlatformAuditController` | `api/platform/audit` | 11 |
| `PlatformSettingsController` | `api/platform/settings` | 2 |
| `PlatformFeatureFlagsController` | `api/platform/feature-flags` | 5 |
| `ImpersonationController` | `api/platform/impersonation` | 5 |

**New files**

| Layer | Files |
|---|---|
| DTOs | `PlatformAuditTrailDtos`, `PlatformSettingsDtos`, `ImpersonationDtos` |
| Entity | `PlatformModule/AuditExportPackage` + EF config + migration `20261121162236_AddAuditExportPackages` |
| Services | `IPlatformAuditService`/`PlatformAuditService`, `IPlatformSettingsService`/`PlatformSettingsService`, `IImpersonationService`/`ImpersonationService`, `PlatformSettingsStore` |
| Security | `ReviveHRSystem.Web/Middleware/ImpersonationGuardMiddleware.cs` |
| Token | `ITokenService.CreateImpersonationToken` |
| Tests | `ImpersonationGuardTests` (4 cases) |

**The act-as guard is the centrepiece**

A Super Admin entering a workspace gets a token whose `userType` is still `TopManagement`. That is deliberate — nothing downstream should mistake the actor for the role they are acting as — but it also means the token would pass every `platform.*` permission check.

`ImpersonationGuardMiddleware` closes that hole centrally: any request to `/api/platform/**` carrying `act=true` is refused with **403**, except the two endpoints that must remain reachable (`impersonation/current` so the banner can ask whether the session is still open, and `impersonation/end` so it can close itself).

It lives in middleware rather than in each controller precisely because a per-endpoint check is the thing a future endpoint forgets. **Adding a new `/api/platform/**` route is now protected by default.** `ImpersonationGuardTests` asserts the block across 9 representative endpoints and confirms both exemptions still work.

**Why the audit export stores its content**

An export is a snapshot, not a query. Re-running the filter later would return a *different* answer — new events, newly reviewed rows — so a package handed to an auditor could change under them. `AuditExportPackage` therefore persists the rendered bytes and serves a re-download from them. Packages expire per the retention window and are hard-deleted by the cleanup job (soft-deleting would keep the content alive and defeat the retention period).

**Settings are overrides, not rows**

Every value has a default in code; `PlatformSetting` rows are overrides. A fresh database therefore answers a complete settings object without a seed step, and the seed never has to be kept in sync with the code. Range validation runs before anything is written, so a bad value cannot reach the table.

**`GET /feature-flags/effective` is readable by any authenticated user**

Deliberate, and flagged as such in the matrix: the SPA and the in-gym portal gate their own UI on that map, so requiring a permission would contradict its purpose. Only anonymous is refused.

**Feature-flag keys are immutable**

Renaming `payroll.export.pdf` would silently break every consumer that looks it up, so `UpdateFeatureFlagAsync` treats a different key as a conflict and tells the caller to create a new flag.

**Security matrix extended: rows 115–137**

All 26 routes classified. Two hazards surfaced:

1. **The audit table is empty at provisioning time** — `FirstAsync` on `AuditLogs` threw and failed *every* row (1,235 failures). Fixed by creating a dedicated probe event rather than picking an existing row.
2. **The delete row removed the flag the update row was using** — the third time this exact cross-contamination pattern appeared. Fixed by giving each mutating row its own probe flag, and by threading the HTTP method into `SubstituteRoute` so PUT and DELETE target different records.

**Verification**

| Check | Result |
|---|---|
| `dotnet build ReviveHRSystem.Web.sln` | ✅ 0 errors |
| `dotnet ef database update` | ✅ applied |
| `ImpersonationGuardTests` | ✅ 4 / 4 |
| Security suite | **98 failures — identical to baseline, 0 new** |
| Integration suite | see §6 |

---

### 2.8 P5 as-built (2026-11-21)

**The React console — 13 components/pages under `Client/src/features/platform/`**

| File | Role |
|---|---|
| `api/platform.api.ts` | 900-line typed client: every request/response body from §6 of the spec, plus `apiRequest`/`apiDownload` bindings |
| `hooks/usePlatform.ts` | React Query bindings — all reads as `useQuery`, all writes as `useMutation`, keys namespaced `['platform', …]` and one `useInvalidatePlatform()` that flushes the namespace |
| `components/platform-nav.ts` | Sidebar catalogue with `superAdminOnly` flags |
| `components/PlatformLayout.tsx` | Shell (sidebar + header + account menu) **and** `PlatformGuard` |
| `components/WorkspaceBanner.tsx` | Sticky banner while an impersonation session is live |
| `pages/PlatformDashboardPage.tsx` | KPI grid + alerts + revenue sparkline |
| `pages/PlatformCompaniesPage.tsx` | Company directory with status/plan filters |
| `pages/PlatformCompanyDetailPage.tsx` | Drill-down with overview / branches / employees / HR staff / billing tabs |
| `pages/PlatformUsersPage.tsx` | Platform-wide directory; `pinnedRole="HRManager"` renders the HR-manager view |
| `pages/PlatformUserDetailPage.tsx` | Identity, permission groups, recent audit, reset-password + revoke-sessions |
| `pages/PlatformBillingPage.tsx` | Invoice ledger, record-payment / remind / void / PDF / CSV |
| `pages/PlatformRevenuePage.tsx` | Period summary, 12-month MRR bars, per-company split, arrears buckets + CSV |
| `pages/PlatformPlansPage.tsx` | Plan catalogue with live MRR footprint |
| `pages/PlatformRolesPage.tsx` | Read-only role catalogue (authoring stays in `/console/hr-team`) |
| `pages/PlatformAuditPage.tsx` | Audit trail + review queue + impersonation ledger + export |
| `pages/PlatformSettingsPage.tsx` | Settings form (partial PUT of changed keys) + feature-flag toggles |
| `lib/download.ts` | Blob→file save helper |

**Route block** — `Client/src/app/router.tsx` gains a `/platform` block mirroring `/console`: lazy imports, index→`dashboard`, `*`→`dashboard`. `PlatformLayout` carries its own guard, so the only wrapper is the shared `RequireAuth` + `Suspense`.

**Design choices worth knowing**

| Decision | Why |
|---|---|
| `PlatformGuard` checks `TopManagement` **or** `HRManager` | Matches the backend: an HR Manager legitimately reads the account surface. Commercial and governance nav items are hidden from them via `superAdminOnly`, so the UI never links to a page that would only produce 401s. |
| `/platform/hr-managers` = `<PlatformUsersPage pinnedRole="HRManager" />` | Same table, same endpoint, one filter. A second page would have been a copy. |
| Roles page reads `GET /api/roles` (the existing endpoint) | No platform-specific role endpoint exists in the spec, and duplicating role authoring would have been scope creep. |
| Revenue chart is hand-rolled divs | The console ships no charting dependency and one bar chart does not justify adding one. |
| Settings form PUTs only changed keys | The API accepts partial bodies; sending everything would risk clobbering a concurrent edit. |

**Verification**

| Check | Result |
|---|---|
| `npx tsc -b` | ✅ 0 errors |
| `npm run build` | ✅ built in 10.27 s; every page emitted as its own lazy chunk |
| `npm run lint` | ✅ 0 errors (2 warnings, both matching pre-existing repo patterns) |
| Live API, 17 read endpoints | ✅ 200 with a real Super Admin token (dashboard, alerts, search, companies, company detail + 5 sub-tabs, users, user detail, plans, invoices, 5 revenue views, 5 audit views, settings, flags, impersonation) |
| Live API, 9 write routes | ✅ reachable — each answers 404/400 from the service rather than a missing route |
| Settings round-trip | ✅ `PUT` nested body persists and echoes (`maxFailedSignIns` 5 → 7 → 4) |
| Company billing | ✅ 200 for both seeded companies after the seeder fix (MRR 36,000 / 2 paying) |

`dotnet build` — 0 errors, 41 warnings (the CS4014 block in `PlatformBillingJobs` is pre-existing P3 code, listed in §8).

### 2.9 Role model — one table, string keys (2026-11-22)

**Why the two tables became one**

`UserRoles` (UserId, RoleId) held platform-wide grants; `UserGymRoles` (UserId, GymId, RoleId) held per-gym ones. They were not duplicated data — they were two *different reaches* — but nothing kept the two resolution paths in agreement, and `hrmanager@revive.hr` fell through the gap: it carried its HR Manager role only per-gym, so `EnsurePermissionAsync` (which reads the platform-wide half) answered 401 on every `/api/platform/**` call.

**Now** one table, keyed by the role's name:

```sql
"UserRoles" (
  "Id"         integer  identity  primary key,
  "UserId"     integer  not null  → "Users"("Id"),
  "GymId"      integer  null      → "Gyms"("Id"),   -- NULL = platform-wide
  "RoleName"   varchar(100) not null → "Roles"("Name") ON UPDATE CASCADE,
  "AssignedAt" timestamptz not null
)
```

Two partial unique indexes replace the composite key (`GymId` is nullable, and PostgreSQL treats NULLs as distinct):

| Index | Columns | Filter |
|---|---|---|
| `UX_UserRoles_PlatformWide` | (UserId, RoleName) | `"GymId" IS NULL` |
| `UX_UserRoles_PerGym` | (UserId, GymId, RoleName) | `"GymId" IS NOT NULL` |

**Consequences that needed code changes**

| Change | File |
|---|---|
| Permission resolution reads the one table, scoped by `GymId IS NULL` vs `GymId = @gym` | `UserAccessRepository` |
| Read-model aggregates use `RoleName` instead of joining `Roles` | `PlatformReadRepository` |
| Seeder writes `RoleName`; a global grant and a per-gym grant are the same insert with a different `GymId` | `DevelopmentDataSeeder` |
| `ISpecification` gained `IgnoreQueryFilters` so a name check can see archived roles | `ISpecification`, `BaseSpecification`, `SpecificationEvaluator` |
| Role rename runs as SQL (`ON UPDATE CASCADE` rewrites the assignments) — EF refuses to modify a key property on a tracked entity | `UserAccessRepository.RenameRoleAsync`, `RoleService` |
| Reusing an archived role's name is refused with a clear message instead of a FK error | `RoleService.EnsureNameAvailableAsync` + `ArchivedRoleByNameSpec` |

**Access-level fix (Super Admin)**

| Before | After |
|---|---|
| `TopManagement` → `/dashboard/top-management` → `/console/dashboard` (HR back office) | `TopManagement` → `/platform/dashboard` (Super Admin console) |
| `PickPrimaryRole` ranked `Super Admin` **below** Branch Manager, Team Leader, HR Manager and HR | `Super Admin` ranks first |

**Migration** `20261121205856_MergeUserRolesAndUseRoleNames` — order matters: per-gym rows are copied in **before** `UserGymRoles` is dropped. `RoleId` is relaxed to nullable for the duration of the copy (the new rows have no integer id) and dropped at the end. `IX_Roles_Name` (filtered to `IsDeleted = false`) is replaced by the unfiltered `AK_Roles_Name`, after de-duplicating names that had only been kept apart by the filter.

**Verification**

| Check | Result |
|---|---|
| `dotnet build ReviveHRSystem.Web.sln` | ✅ 0 errors |
| `dotnet ef database update` | ✅ applied; 24 assignments (3 platform-wide + 21 per-gym) preserved from 3 + 21 |
| Orphaned assignments after migration | ✅ 0 |
| Role rename `Team Leader` → `Squad Lead` → back | ✅ 200 both ways; per-gym rows follow the rename; 0 orphans |
| Live access matrix | ✅ `admin` platform 200 / HR features 200; `hr` platform 401 / HR features 200; `karim` all 401 |
| Security suite | **98 failures — identical to baseline, 0 new** |
| Integration suite | **11 failures — identical to baseline, 0 new** |
| Client | ✅ `tsc -b` 0 errors, `npm run build` clean, `oxlint` 0 errors |

---

## 3. What is still missing

### 3.1 P1 — Foundation (backend schema) — ✅ DONE

All 16 items shipped on 2026-11-20. See [§2.4](#24-p1-as-built-2026-11-20) for the as-built record, the backfill design and the verification evidence.

| # | Item | Landed at |
|---|---|---|
| 1 | `Company` entity | `Core/DomainLayer/Models/PlatformModule/Company.cs` |
| 2 | `CompanyStatus` enum | `Core/DomainLayer/Models/PlatformModule/Enums/CompanyStatus.cs` |
| 3 | `Gym.CompanyId` + navigation | `Core/DomainLayer/Models/OrganizationModule/Gym.cs` |
| 4 | `SubscriptionPlan` + `PlanCycleUnit` + `TrialMode` | `Core/DomainLayer/Models/BillingModule/` |
| 5 | `PlanFeature`, `PlanAddOn` | `Core/DomainLayer/Models/BillingModule/` |
| 6 | `CompanySubscription` + `SubscriptionStatus` | `Core/DomainLayer/Models/BillingModule/` |
| 7 | `Invoice`, `InvoicePayment` + `InvoiceStatus`, `PaymentMethod` | `Core/DomainLayer/Models/BillingModule/` |
| 8 | `ImpersonationSession`, `PlatformSetting`, `FeatureFlag`, `FeatureFlagTarget` + `FeatureFlagScope` | `Core/DomainLayer/Models/PlatformModule/` |
| 9 | `AuditLog` + 9 new columns | `Core/DomainLayer/Models/AuditModule/AuditLog.cs` |
| 10 | `UserType.HRManager = 4` | `Core/DomainLayer/Models/UserModule/Enums/UserType.cs` |
| 11 | EF configurations | `.../Configurations/PlatformModuleConfigurations.cs` + `BillingModuleConfigurations.cs` |
| 12 | `DbSet<>` registrations | `Infrastructure/Persistence/Data/RevivHrDbContext.cs` |
| 13 | Migration `20261120171346_AddPlatformBillingSchema` + backfill | `Infrastructure/Persistence/Data/Migrations/` |
| 14 | 21 `platform.*` permission keys seeded | `ReviveHRSystem.Web/DataSeed/DevelopmentDataSeeder.cs` |
| 15 | HR Manager preset gained 4 platform keys | same |
| 16 | `HRManager` accepted by the scope layer | `ApiControllerBase.cs`, `GymService.cs`, `AccessControlService.cs`, `RoleSpecifications.cs`, `EventsService.cs`, `AttendanceSpecifications.cs` |

> Count correction: the spec's §2 lists **21** permission keys, not 22 — the earlier progress note said 22 in error.


### 3.2 P2 — Platform core — ✅ DONE

All 9 items shipped on 2026-11-21. See [§2.5](#25-p2-as-built-2026-11-21) for the as-built record.

| # | Item | Landed at |
|---|---|---|
| 1 | Company DTOs | `Shared/DataTransferObject/Platform/CompanyDtos.cs` |
| 2 | Branch / HR-staff DTOs | `Shared/DataTransferObject/Platform/BranchAndHrStaffDtos.cs` |
| 3 | Platform user DTOs | `Shared/DataTransferObject/Platform/PlatformUserDtos.cs` |
| 4 | Dashboard / search / audit DTOs | `.../PlatformDashboardDtos.cs`, `.../PlatformAuditDtos.cs` |
| 5 | Cross-entity read model | `IPlatformReadRepository` + `PlatformReadRepository` |
| 6 | Company service + controller | `ICompanyService`/`CompanyService`, `PlatformCompaniesController`, `PlatformBranchesController`, `PlatformHrStaffController` |
| 7 | Platform user service + controller | `IPlatformUserService`/`PlatformUserService`, `PlatformUsersController` |
| 8 | Dashboard service + controllers | `IPlatformDashboardService`/`PlatformDashboardService`, `PlatformDashboardController`, `PlatformSearchController` |
| 9 | Specification `ThenInclude` support | `ISpecification`, `BaseSpecification`, `SpecificationEvaluator` |

> Role/permission DTO extensions (`Type`, `Scope`, `MembersCount`, `platformOnly`) were **not** needed: the existing `RoleListItem` already carries `IsPreset` and `Permissions`, and the launcher/matrix endpoints belong to P4's governance scope. Left as is rather than adding unused fields.

### 3.3 P3 — Commercial — ✅ DONE

All 4 items shipped on 2026-11-21. See [§2.6](#26-p3-as-built-2026-11-21).

| # | Item | Landed at |
|---|---|---|
| 1 | Plan service + controller (6 endpoints) | `IPlanService`/`PlanService`, `PlatformPlansController` |
| 2 | Invoice service + controller (9 endpoints, incl. PDF + CSV) | `IInvoiceService`/`InvoiceService`, `PlatformInvoicesController` |
| 3 | Revenue service + controller (9 endpoints) | `IRevenueService`/`RevenueService`, `PlatformRevenueController` |
| 4 | Scheduled jobs | `ReviveHRSystem.Web/BackgroundJobs/PlatformBillingJobs.cs` |

> The "audit export cleanup" job from §8 is intentionally **not** implemented: audit export packages arrive with P4's `POST /api/platform/audit/export`, so there is nothing to purge yet. Listed for P4.

### 3.4 P4 — Governance — ✅ DONE

All 5 items shipped on 2026-11-21. See [§2.7](#27-p4-as-built-2026-11-21).

| # | Item | Landed at |
|---|---|---|
| 1 | Platform audit service + controller (11 endpoints) | `IPlatformAuditService`/`PlatformAuditService`, `PlatformAuditController` |
| 2 | Settings persistence + controller | `IPlatformSettingsService`, `PlatformSettingsController`, `PlatformSettingsStore` |
| 3 | Feature flags + effective resolution | `PlatformFeatureFlagsController` |
| 4 | Impersonation service + controller + act-as token | `IImpersonationService`/`ImpersonationService`, `ImpersonationController`, `CreateImpersonationToken` |
| 5 | `act` claim guard (central) | `ReviveHRSystem.Web/Middleware/ImpersonationGuardMiddleware.cs` |

### 3.5 P5 — React console — ✅ DONE

All 10 pages shipped on 2026-11-21. See [§2.8](#28-p5-as-built-2026-11-21) for the file map, the design choices and the verification evidence.

| # | Page | Route | Mock source | Status |
|---|---|---|---|---|
| 1 | Dashboard | `/platform/dashboard` | `pages-dashboard.js` | ✅ |
| 2 | Companies list | `/platform/companies` | `pages-gyms.js` (`renderGyms`) | ✅ |
| 3 | Company detail (6 tabs) | `/platform/companies/:id` | `pages-gyms.js` (`renderGymDetail`) | ✅ 5 of 6 tabs |
| 4 | Users | `/platform/users` | `pages-users.js` | ✅ |
| 5 | User profile | `/platform/users/:id` | `pages-user-detail.js` | ✅ |
| 6 | HR managers | `/platform/hr-managers` | `pages-hr-managers.js` | ✅ own page: platform scope, preset, reset/suspend, create |
| 7 | Billing & quotas | `/platform/billing` | `pages-billing.js` | ✅ |
| 8 | Revenue analyzes + 4 breakdowns | `/platform/revenue` | `pages-revenue.js` | ✅ summary + 3 of 4 breakdowns, one route |
| 9 | Roles & permissions | `/platform/roles` | `pages-access.js` | ✅ read-only |
| 10 | Security & audit | `/platform/audit` | `pages-audit.js` (**never wired in the mock**) | ✅ |

Client scaffolding also shipped: `features/platform/api/` (typed client), `features/platform/hooks/` (React Query), `PlatformLayout` with the four sidebar groups, the `TopManagement | HRManager` route guard, and the impersonation workspace banner. Remaining gaps are listed in §9.1.

**Visual rebuild (2026-11-22):** the console now matches `Mock UI/Super Admin2` density instead of the roomier HR-portal scale. The shell is a 232px sidebar + 48px header that never scrolls the document; each page is a flex column (`PlatformPage`) where only a table body scrolls. The styles are scoped in `index.css` under `.platform-console` (`pc-*` classes, 10px-radius cards, 10-12px type, 32px controls) and wrapped by `features/platform/components/platform-ui.tsx`, so no HR-portal surface changed.

Data and layout corrections from the same pass:

| Fix | Where | Why |
|---|---|---|
| Sign-in stamping | `AuthService.IssueTokensAsync` | Only the two-gym and select-gym paths wrote `LastLoginAt`; platform and single-gym accounts never recorded a sign-in, so every console row read "Invited" / "Never". |
| Demo sign-in backfill | `DevelopmentDataSeeder` | Seeds a plausible `LastLoginAt` for accounts that have never signed in, so the console shows a working week of activity instead of a wall of "Invited". |
| Platform HR Manager accounts | `DevelopmentDataSeeder` | `UserType.HRManager` accounts (Mona El-Sayed, Hoda Kamel, Rania Adel) with the global HR Manager role — nothing was seeded before, so the HR managers page was always empty. |
| Role breakdown | `PlatformReadRepository.GetCompanyRoleBreakdownAsync` | "HR staff" counted every user with gym access, reporting the whole gym as HR and zero employees. Desk roles now come from the per-gym role assignment. |
| `Preset` on the user list | `PlatformUserListItem` | The mock's HR manager table shows a preset badge; the list DTO did not expose it. |
| Plans merged into Billing | `/platform/billing` | The plan catalogue is Billing's side rail (mock parity); `/platform/plans` redirects and the nav entry is gone. |
| Revenue breakdowns | `/platform/revenue/:metric` | Each headline figure is a link to its own page (mock `metricCard`): MRR, gross, collected, outstanding. The overview keeps one "Revenue per gym" table with the mock's eight columns; arrears moved to the outstanding page. |
| Security & audit removed | nav + `/platform/audit` | The mock has no standalone audit page. The client API/hooks that only served it are gone; the backend endpoints stay because the user-confirmed access matrix and `ImpersonationGuardTests` assert them. |
| Platform settings → Security | `/platform/settings` | Only the security section changes real behaviour (password rotation, session lifetime, lockout, MFA), so the page is now just that. |
| Workspace launcher | `/platform/hr-managers` | The mock's "Enter a gym workspace" card, wired to `POST /api/platform/impersonation/start`: parks the console token, swaps in the gym-scoped token, and the HR console shows a "Return to console" banner that ends the session and restores the token. |
| Plan editor | `/platform/billing` rail | `+ New` / `Edit` on the plan catalogue using the plan endpoints the API already exposed (`POST` / `PUT /api/platform/plans`). |
| Seeded invoices | `DevelopmentDataSeeder` | Twelve monthly invoices per company (older months settled, newest open or overdue) so the ledger, arrears buckets, 12-month MRR trend and the overdue alert all have data. |
| Sidebar account menu | `PlatformLayout` | Language + dark-mode toggles, matching the employee portal's sidebar footer. |
| Company record | `/platform/companies/:id` | Rebuilt to the mock's identity card + counted tabs + overview (stat tiles, users-by-role bars, 14-day attendance, account facts, health, actions). |
| User profile | `/platform/users/:id` | Rebuilt to the mock's profile page: identity card with the account actions, four KPI tiles, employment record, permissions-by-area, access details and the user's own audit slice. Users and HR-manager rows open it on row click. |
| Invoice term columns | `InvoiceService` + seeder | The ledger's Period column split into Plan / Start / End, so `InvoiceListItem` now carries `SubscriptionStart` / `SubscriptionEnd` and the seeder rolls stale subscription terms forward. |
| Attention strips | `components/AttentionStrip.tsx` | Every console page now surfaces the alerts it can act on (overdue invoices on Billing/Revenue, seat pressure and sign-in bursts on Users/HR managers, everything company-scoped on Gym accounts and on a gym record), each linking to its fix. The queue is still derived server-side, so an item disappears when its cause is fixed. |
| Create gym account | `CreateGymModal` + `POST /api/platform/companies` | The dashboard's primary action is now a real create flow: company, plan subscription, contact and every branch (two by default) in one pass. The gym list header carries the same button. |
| Create HR manager | dashboard → `/platform/hr-managers?new=1` | The dashboard's second action opens the HR-manager dialog instead of navigating to billing. |
| Plan editor | `/platform/billing` rail | Rebuilt to the mock: no tagline field, features are the mock's checkbox catalogue plus an "Add another feature" line, and "Add-ons & overage" rows (name · per N · EGP) persist through `PlanAddOn`. The rail shows each plan's add-on count. |
| Gym record overview | `/platform/companies/:id` | "Account health" and the 14-day attendance chart are gone; the record now shows **Plan limits** (seat and branch pressure against the plan caps, linking to Billing) and **Recent activity** (the gym's own audit trail via `/companies/{id}/audit`). |
| Workspace launcher | `/platform/users/:id` | Removed from the HR-managers page; it lives on a user's profile, where the reason is pre-filled so the primary action is never silently disabled. |
| Ledger actions | `/platform/billing` | Every row button is wired (PDF, reminder, record payment, void) and the void dialog explains what voiding does — it retires the number, keeps the row on the ledger and stops it counting towards outstanding revenue. |
| Revenue Analytics | nav + `/platform/revenue` | The sidebar entry, page title and breadcrumb read "Revenue Analytics", and the gross metric is now "Revenue growth" (change vs last month in the sub-line, "Revenue growth" as its breakdown title). |
| Month chart | `components/MonthChart.tsx` | Both revenue charts (recurring revenue on the overview, billed per month on the growth breakdown) share one column chart with a value axis, gridlines, per-month figures and a total/average footer — a flat ledger used to render as an empty block. |

### 3.6 Endpoint tracker

Per-endpoint request/response contracts are in [super-admin-api.md](docs/architecture/super-admin-api.md) §6.

| Area | Endpoints | Implemented |
|---|---|---|
| Dashboard | 3 | ✅ 3 |
| Search | 1 | ✅ 1 |
| Companies | 10 | ✅ 10 |
| Branches | 4 | ✅ 4 |
| HR staff | 3 | ✅ 3 |
| Platform users | 8 | ✅ 8 |
| Plans | 6 | ✅ 6 |
| Billing / invoices | 9 | ✅ 9 |
| Revenue analytics | 9 | ✅ 9 |
| Audit & security | 11 | ✅ 11 |
| Settings & feature flags | 7 | ✅ 7 |
| Impersonation | 5 | ✅ 5 |
| Roles & permissions | 7 (5 extend existing) | 5 existing; see §8 for the gap |
| **Total** | **84** | **79 net-new** |

---

## 4. Deliberately deferred

These appear in the mock's capability list but are **not** in the API spec, because the mock itself does not implement them:

| Item | Why deferred |
|---|---|
| Security & audit page UI polish | `pages-audit.js` exists but was never wired into `index.html`/`NAV`; the API contract is specced, the UI needs a design decision |
| Email transport (invites, reminders, reset links) | Assumed external. Endpoints should return a `MailNotConfigured` warning rather than fail — confirm in P3 |
| SMS / multi-currency / SSO / SCIM | Advertising copy on the Enterprise plan only |
| Live "health score" algorithm | The mock hard-codes a number; no formula is defined |

---

## 5. Verification plan

Per phase, before moving on:

1. **Build** — `dotnet build ReviveHRSystem.Web.sln` must stay green.
2. **Migration** — apply against a fresh database *and* against a database seeded with the existing 2-gym development data (proves the backfill works).
3. **Permission matrix** — for each new endpoint, an integration test asserting Super Admin = 200, HR Manager = 200 or 403 (per §2), HR = 403.
4. **Scope isolation** — an HR user assigned to gym A must get 403/404 for gym B on every platform-adjacent endpoint.
5. **Audit** — every write endpoint appends exactly one `AuditLog` row with the expected `Category`/`Severity`/`Action` from §9.
6. **Impersonation** — an act-as token must be rejected (403) by every `platform.*` endpoint.
7. **Client** — `npm run build` in `Client/` plus a manual pass of each page against its mock.

---

## 6. Changelog

| Date | Change |
|---|---|
| 2026-11-22 | **Role model simplified: one table, names instead of ids.** `UserRoles` and `UserGymRoles` are merged into a single `UserRoles` (Id, UserId, GymId?, RoleName, AssignedAt) where `GymId IS NULL` marks a platform-wide grant — the two tables were two permission-resolution paths that could disagree, and `hrmanager` fell through the gap (401 on every `/api/platform/**` call). `RoleName` is now the foreign key to `Roles.Name`, so assignments read without a join. `Role` gained `AK_Roles_Name` (unfiltered — the old `IX_Roles_Name` was filtered to `IsDeleted = false`, which let archived roles share a name) and the FK carries `ON UPDATE CASCADE` so renaming a role rewrites its assignments atomically. Historical duplicate names were de-duplicated by the migration. Also fixed: **Super Admin now lands in `/platform/dashboard`** instead of the HR console, `PickPrimaryRole` ranks `Super Admin` first (it was *below* Branch Manager), and `RoleService` blocks reusing an archived role's name (it would violate the new principal key). Verified: security 98 = baseline (0 new), integration 11 = baseline (0 new), client build + lint clean. |
| 2026-11-21 | **Runtime verification of P5 against a live API — three defects found and fixed.** Started the API in Development and drove every console endpoint with a real Super Admin token. (1) `PUT /api/platform/settings` expects **nested** sections, so the console's flattened `section.key` patch was silently discarded — the settings form now folds the draft back into `{ security: { … } }` before sending. (2) The same endpoint read the settings back **before** `SaveChangesAsync`, so a successful write returned the pre-save values; the flush now happens first. (3) On an upgraded dev database neither seeded company had a subscription — the migration backfill creates companies, but only `EnsureCompanyAsync` attaches a plan — so the company billing tab answered 400; the seeder now sweeps every company without a live subscription, and it anchors the seeded period to today instead of the subscription start date. Verified live: 17 read endpoints 200, 9 write routes reachable, settings PUT round-trips (`maxFailedSignIns` 5→7→4), company billing 200 for both companies, MRR 36,000 across 2 paying companies. |
| 2026-11-21 | **P5 complete — console shipped.** 14 new files under `Client/src/features/platform/` (typed API client, React Query hooks, nav, shell + guard, workspace banner, 10 pages, blob-save helper) and a `/platform` route block in `router.tsx`. `PlatformGuard` admits `TopManagement` and `HRManager` and hides commercial/governance nav from the latter, matching what the API actually grants. `/platform/hr-managers` reuses the users page via `pinnedRole`, and `/platform/roles` reads the existing `GET /api/roles` rather than inventing an endpoint. Records payments, sends reminders, voids invoices, downloads PDF/CSV, exports the audit trail and toggles feature flags — all wired to the endpoints built in P2–P4. Verified: `tsc -b` 0 errors, `npm run build` succeeded with every page in its own lazy chunk, `oxlint` 0 errors. |
| 2026-11-21 | **P4 complete — backend finished.** 26 endpoints across 3 controllers (audit, settings, feature flags, impersonation). Added `AuditExportPackage` (+ migration) so an export is a stored snapshot rather than a re-runnable query. Added `ImpersonationGuardMiddleware`, which refuses any `/api/platform/**` request carrying `act=true` except `impersonation/current` and `impersonation/end` — the control that stops a workspace token from laundering privilege back into platform admin. Settings are code defaults plus stored overrides, so a fresh database still answers completely. Added `ImpersonationGuardTests` (4 cases) asserting the block across 9 endpoints plus both exemptions. Matrix rows 115–137: caught an empty-audit-table provisioning bug (1,235 false failures) and the flag delete/update cross-contamination. Verified: security 98 = baseline (0 new), guard tests 4/4. |
| 2026-11-21 | **P3 complete.** 24 endpoints across 3 controllers (plans, invoices, revenue). Invoice numbers are allocated under a PostgreSQL advisory lock inside a transaction, so concurrent issues cannot collide. Payments settle the invoice and, when it was the last overdue one, restore the company and lift the payroll block. Added `MinimalPdfWriter` — a dependency-free PDF 1.4 writer with a verified xref table (4 unit tests). Revenue is fully derived from the ledger plus live subscriptions; one snapshot projection feeds every breakdown. Added `PlatformBillingJobs` (recurring invoices, overdue sweep, trial expiry, impersonation expiry) behind `PlatformJobs:Enabled`, **default false**. Extended the security matrix with rows 91–114; each mutating row got its own probe plan/invoice so parallel execution cannot cross-contaminate. Verified: security suite 98 = baseline (0 new), PDF tests 4/4. |
| 2026-11-21 | **P2 complete.** 29 endpoints across 5 controllers (dashboard, search, companies, branches, HR staff, platform users). Added `IPlatformReadRepository` for the GROUP BY / SUM aggregates that specifications cannot express. Added `ThenInclude` support (`IncludePaths`) to `ISpecification` after three endpoints returned 500 on a null `subscription.Plan` / `userGymAccess.Gym`. Seeded the three subscription plans and an Active subscription per seeded company. Fixed a P1 gap: `platform.companies.view` was missing from the HR Manager key set. Extended the security matrix with rows 62–90 and added `SubstitutePlatformRoute`; the revoke/reset rows initially raced the live `hr` identity, so a throwaway `PlatformProbeUserId` now absorbs them. Verified: security suite 98 failures = baseline exactly (0 new), integration suite 11 = baseline exactly (0 new). |
| 2026-11-20 | **P1 complete.** Built the platform/billing schema: 18 new domain files (11 entities + 7 enums), `Gym.CompanyId`, `UserType.HRManager = 4`, 9 new `AuditLog` columns, 2 EF configuration files, 11 `DbSet`s, and migration `20261120171346_AddPlatformBillingSchema` with a hand-written nullable→backfill→NOT NULL sequence (one company per existing gym). Seeded 21 `platform.*` permission keys — deliberately outside `AllPortalPermissionKeys` — and gave the HR Manager preset exactly 4 of them. Split "all gyms" from "all permissions" in `AccessControlService` so HR Manager bypasses gym scope but never permission checks. Fixed the two gym-creation paths the NOT NULL FK broke (dev seeder + `TestDataBuilder`). Verified against an isolated baseline worktree at `a578445`: both suites fail identically before and after — 11 integration, 98 security — so no regressions. |
| 2026-11-20 | **P0 complete.** Read all 13 mock UI JS files (≈4,500 lines) and mapped the backend (65 domain files, 45 controllers, auth/ADR-003). Resolved 5 mock↔backend conflicts with the project owner. Wrote `docs/architecture/super-admin-api.md` (80 endpoints, 21 new permission keys, 12 new entities, 5 background jobs, 31 audit events, 4-phase build order). Linked it from `PROJECT.md` and `api.md`. Corrected three endpoint tallies in the spec index. Created this progress file. |

---

## 7. How to keep this file current

- Update the **phase board** and the matching checklist in §3 whenever an item ships.
- Only move an item to ✅ after its verification step in §5 passes — not when the code is merely written.
- Add one **changelog** row per working session, naming the files touched.
- If a decision in the spec changes, record it in the spec's §0 table **and** in the changelog here, so the two documents never disagree.
- Keep **[§9 Missing & incomplete](#9-missing--incomplete)** accurate: it is the first place anyone should look for outstanding work.

---

## 8. Problems found but not fixed

These were discovered during the build and left alone deliberately — none are caused by the Super
Admin work, and fixing them would have meant touching unrelated code.

| # | Problem | Where | Impact |
|---|---|---|---|
| 1 | 11 integration tests fail on `main` before any Super Admin work | payroll/shift arithmetic tests | Pre-existing. Verified against an isolated worktree at `a578445`. |
| 2 | 98 security-matrix tests fail on `main` before any Super Admin work | `AccessMatrixTests`, `EndpointEnumerationTests` | Pre-existing. Rows 47–58 have no `EndpointPayloads` entry; two HR routes are missing from `access-matrix.json`. |
| 3 | `RequestRulesTests.ShiftSwap_ColleagueOfAnotherGym_Returns400` is order-sensitive | `Tests/ReviveHRSystem.IntegrationTests/RequestRulesTests.cs` | Passes in isolation; fails intermittently in the full run once extra tests shift scheduling. Not caused by P1–P4 (no request route was touched), but it is now more visible. |
| 4 | `PlatformAuditService` loads the whole audit table into memory per request | `LoadRowsAsync` | Fine for the current volume; will need server-side paging before the trail reaches six figures. Grouping/`SUM` belongs in `IPlatformReadRepository`. |

---

## 9. Missing & incomplete

Everything still outstanding, ordered by what blocks the most.

### 9.1 P5 — React console (built; these are the gaps inside it)

All 10 pages exist and build. What is *not* finished:

| # | Gap | Impact | Where it would go |
|---|---|---|---|
| 1 | **No Arabic translations for the console** | Every string renders in English even when the UI is Arabic (the documented `fallbackLng: 'en'` behaviour). ~200 keys. | new `Client/src/i18n/locales/ar/platform.ts`, spread in `ar.ts` |
| 2 | **No impersonation launcher UI** | The operator must call `POST /api/platform/impersonation/start` by hand. The banner and `POST …/end` are wired, the "enter a workspace" picker is not. | `PlatformCompanyDetailPage` action + a `StartWorkspaceModal` |
| 3 | **Revenue has one route, not `/platform/revenue/:metric`** | The mock had four drill-ins; the console shows summary + trend + per-company + arrears on one page, which covers the same data. A deep-linkable metric view is cosmetic. | `PlatformRevenuePage` sub-route |
| 4 | **Company detail ships 5 of 6 mock tabs** | The mock's sixth tab (per-branch seat breakdown) has no endpoint — `seatLimit` is company-level only. | needs a backend field first |
| 5 | **HR-managers page has no "create HR manager" form** | `POST /api/platform/users/hr-managers` is implemented and `useCreateHrManager()` exists, but no button uses it because the preset-role picker needs a role list the console does not surface. | `PlatformUsersPage` when `pinnedRole === 'HRManager'` |
| 6 | **Currencies are hard-coded in three selects** | The settings page offers EGP/USD/SAR/AED; a fourth currency needs a code change. | derive from `GET /api/platform/settings` |
| 7 | **`/platform/roles` is read-only** | By design — authoring lives in `/console/hr-team`. If the Super Admin should own role authoring, this page needs the create/clone/permission editor. | `PlatformRolesPage` |

### 9.2 Endpoints in the spec that were deliberately not implemented

| # | Item | Why | Where it would live |
|---|---|---|---|
| 1 | `GET /api/platform/roles/launcher-options` (spec §6.9) | Superseded: the launcher dropdown is served by `GET /api/platform/impersonation/roles`, which already excludes Super Admin and platform scopes. | — (done differently) |
| 2 | `GET /api/platform/permissions/matrix` (spec §6.9) | The six-column comparison grid. `GET /api/permissions` already returns `{ items, modules, totalTracked }`; the matrix is a *view* over it. Deferred until P5 proves the shape is actually needed. | `/api/platform/permissions/matrix` |
| 3 | Role DTO extensions `Type` / `Scope` / `MembersCount` / `platformOnly` (spec §6.9) | `RoleListItem` already carries `IsPreset` and `Permissions`; `MembersCount` is available from `GetRoleMemberCountsAsync`. Adding unused fields would be speculative. | `RoleService` |
| 4 | `platformOnly` flag on the permission catalogue | The `Platform` area already identifies them; a boolean would duplicate that. | — (not needed) |

### 9.3 Functional gaps inside implemented endpoints

| # | Gap | Current behaviour | What is needed |
|---|---|---|---|
| 1 | **Seat overage is not billed** | `POST /invoices` falls back to the plan price (honouring `PriceOverride`) but ignores `PlanAddOn`. | A decision on the overage formula, then addition of priced add-on lines to `Invoice.LineItems`. The `PlanAddOn` model and its DTOs are already in place. |
| 2 | **No email transport** | Reminders, invites and password resets are recorded on the audit trail and return `mailConfigured: false` instead of pretending to deliver. | Wire an `IEmailSender`. Until then the console should surface the "not configured" state so operators know nothing was sent. |
| 2b | **HR Manager has no platform access** (left as-is at your request) | `hrmanager@revive.hr` is seeded as `UserType.HR` and carries its role per-gym only, so every `/api/platform/**` call answers 401. Its console nav items are Super-Admin-only, so this only matters if an HR Manager should reach the platform console. | Two lines: seed `UserType.HRManager`, and give it a platform-wide role row (`GymId IS NULL`). |
| 2c | **Archived test roles left in the dev database** | The security suite creates `ZZ Probe Role …` rows and only soft-deletes them; two shared a name (the old filtered index allowed it) and the merge migration renamed the second to `ZZ Probe Role … #8`. Harmless — archived roles are filtered everywhere — but they reserve their names. | Delete them, and have the security fixture clean up after itself. |
| 3 | **Password reset sets a fixed temporary password** | `ResetPlatformUserPasswordAsync` hashes `DefaultNewAccountPassword` (`Revive!2026`), matching the existing `RoleService` behaviour, and flags a forced change. | True one-time reset links once email exists. |
| 4 | **Impersonated writes are not stamped with the session id** | `AuditLog.ImpersonationSessionId` exists and is populated by nothing. An act-as write is still attributed to the Super Admin's `UserId`, so it is traceable — just not session-linked. | Thread `actSessionId` from the token into `PlatformHelpers.WriteAuditAsync` (and the other services' audit helpers). |
| 5 | **Act-as scope is not narrowed by the assumed role** | An act-as token keeps `TopManagement` type, so `AccessControlService` still grants the Super Admin's full permission set inside the workspace. | Evaluate `actRoleId` in `AccessControlService` so a session acting as Team Leader is actually limited to team scope. This is the largest remaining security gap. |
| 6 | **`CompanySubscription.RenewsOn` is not advanced by any job** | The invoice job raises invoices per period but never rolls `CurrentPeriodStart/End` forward. The dev seeder now anchors the seeded period to *today* (it previously anchored it to the subscription's start date, so a monthly plan seeded "3 months ago" printed a renewal in the past), but nothing advances it after that. | A period-roll step in `PlatformBillingJobs.GenerateRecurringInvoicesAsync`. |
| 7 | **Audit retention policy is configuration only** | `PUT /audit/retention-policy` validates and stores the windows; nothing purges audit rows by age. | A purge job — only if you actually want rows deleted; the trail is otherwise append-only by design. |
| 8 | **`GET /platform/companies/{id}/employees` returns `joinedOn: null` and per-branch counts as 0** | The tab renders correctly but those two columns are empty. | Join `Employee.HireDate` and count staff per branch in `GetEmployeesAsync` / `GetBranchesAsync`. |
| 9 | **`PlatformAuditService` filters in memory** | Loads all audit rows per request. | Move filtering and paging into a read-repository projection (see §8 item 4). |

### 9.4 Decisions still needed from you

| # | Question | Blocks |
|---|---|---|
| 1 | **Multi-branch grouping** — the migration created one company per gym (`GYM-{id}`). If customers actually run several branches as one account, they need merging. | Nothing; but the account table stays wrong until it is answered. |
| 2 | **Trial length** — the mock hard-codes 14 days; plans carry their own `TrialDays`. Which wins? | P1 seed / the create-company wizard copy. |
| 3 | **Invoice numbering** — `INV-{year}-{seq:D4}` is assumed. Is a legal series prefix required? | Would change `NextInvoiceNumberAsync` in two places. |
| 4 | **Currency** — EGP is assumed platform-wide. | Multi-currency is out of scope for these endpoints. |
| 5 | **Seat overage formula** — per block of 5 at a fixed price, or pro-rata per seat? | §9.3 item 1. |

### 9.5 Documentation still to update

| # | Item | Status |
|---|---|---|
| 1 | `docs/product/out-of-scope.md` still says *"Multi-company SaaS (this is single-tenant)"* | ⬜ Superseded by the `Company` entity; the line now contradicts the code and should be amended. |
| 2 | `docs/architecture/api.md` lists only implemented endpoints | ⬜ The 79 platform endpoints should move there from `super-admin-api.md` now that they are live. |
| 3 | `docs/architecture/database.md` | ⬜ The 12 new tables and 9 new `AuditLog` columns are undocumented. |
| 4 | `docs/decisions/` — no ADR for the `Company`/tenant split | ⬜ Worth one: it changes the tenancy model the rest of the docs assume. |

### 9.6 Deliberately deferred (no action planned)

| Item | Why |
|---|---|
| Security & audit page visual design | `pages-audit.js` was never wired into the mock; the API contract is complete, the design is not. |
| Live health-score formula | The mock hard-codes a number. `ComputeHealth` uses an explainable 0–100 deduction model instead; product may want a different formula. |
| SMS, SSO/SCIM, multi-currency | Advertising copy on the Enterprise plan only. |
| Feature flags actually gating behaviour | The catalogue, targets and `effective` resolution are built and correct; no existing feature consults them yet. |

