# Fix Plan — Section 1: Systemic / Cross-Cutting Architecture (S1–S4)

Source of truth: `backend_logic_audit.md` §1.1 – §1.4.
Scope: **only the four systemic root causes**. They are shared by ~60% of the other 69 findings, so
fixing them correctly removes whole classes of bugs in sections 2–6 without touching those files yet.

Repository: `D:\Youssef\Projects\_Hr System\ReviveHRSystem`
Current branch: `Employee-Frontend-Implementation`
Backend: .NET 8, EF Core, PostgreSQL (Npgsql), xUnit + `Microsoft.AspNetCore.Mvc.Testing`.

---

## The four root causes

| # | Root cause | Cause | Symptom |
|---|-----------|-------|---------|
| S1 | `ResolveGymScopeAsync` returns `[]` for **both** "Top Management / unrestricted" and "user has 0 gyms" | every spec treats `gymIds.Length == 0` as *no filter* | revoking a user's gyms grants org-wide read access |
| S2 | Runtime role writes go to `UserRoles`; authorization reads `UserGymRoles` | only the seeder ever writes `UserGymRoles` | new HR/managers `404`; promotions grant 0 keys; demotions keep powers; cross-gym permission bleed; TopManagement locked out of new gyms |
| S3 | `IsTeamScopedAsync` returns `false` when a `Team Leader` has no `TeamLeaders` row | scope is derived from the team row, not the role | unassigned Team Leader escalates to full gym scope; dual-role BM trapped in one team; 2+ teams → first only |
| S4 | `IsDeleted = true` soft delete + unique indexes without `WHERE "IsDeleted" = FALSE` | unique index still counts deleted rows | re-create after delete fails `23505` → `400 "The record already exists"` |

---

## Design decisions (confirmed with user)

- **D1 — `UserGymRoles` is the authoritative per-gym role store** (single source of truth).
  `UserRoles` is kept as the *global union* of role grants (what it already is in the seeder: Omar
  gets `Branch Manager` + `Team Leader` globally while `UserGymRoles` holds BM@gym1 / TL@gym2).
  Authorization for a gym reads `UserGymRoles`; global `UserRoles` is only a fallback for accounts
  that hold no per-gym role anywhere (legacy HR/TopManagement accounts).
- **D2 — Gym scope is `int[]?`.**
  `null` = unrestricted (Top Management without a gym filter); `[]` = matches nobody.
  Every `gymIds == null || gymIds.Length == 0` predicate becomes `gymIds is null`.
- **D3 — Zero active gyms blocks login** for every user except `TopManagement`.
- **D4 — Uniqueness uses filtered (partial) indexes; soft-deleted rows are preserved.**
  Deleted rows stay in the table for history/audit (`IsDeleted = true`); they are simply excluded
  from the unique constraint with `WHERE "IsDeleted" = FALSE`. **No row is ever hard-deleted.**
  If a duplicate *active* row already exists, the migration fails loudly and names the table so the
  duplicate can be investigated manually — no auto-delete, no merge.
- **D5 — Backfill `UserGymRoles` from `UserRoles` × `UserGymAccess`** in an idempotent migration,
  **only for legacy accounts that hold no per-gym role at all**. Copying the global union into every
  gym would flatten per-gym roles (it made the seeded Branch-Manager-in-gym-1 / Team-Leader-in-gym-2
  account a manager in both). Accounts with an explicit per-gym assignment keep exactly that.
- **D6 — Apply the new migrations to the local dev database** after review
  (`dotnet ef database update`), not only generate them.
- **D7 — Store this plan in the repo** at `docs/implementation/systemic-access-fix-plan.md`
  once implementation starts.
- **D8 — "Gym-wide" roles are `Super Admin`, `HR`, `HR Manager` only.** `Branch Manager` does **not**
  override team scope: a user holding `Branch Manager` + `Team Leader` in the same gym is team-scoped
  (matches the ADR-003 description in `UserGymRole`).
- **D9 — No automatic team assignment.** Creating an employee never sets `TeamId`; HR assigns the team
  afterwards from the team page.
- **D10 — Demotion keeps the `TeamLeaders` row.** HR removes a person from a team manually; role
  changes never delete team rows.
- **D11 — Hiring with an empty System Role assigns the label-only `Employee` role** in the hiring gym
  (mirrors the seeder; the role grants no permissions and only names the account).
- **D12 — `EnsureCanAccessAsync` stays self-only.** The Top Management bypass belongs on
  `EnsureCanAccessCoveredGymAsync`/`CoversGymAsync`, never on the self-only guard: the access matrix
  (`tests/security/access-matrix.json` row 35) documents that even Top Management gets `401/404` on
  another employee's payslip.

---

## Implementation status

| Workstream | Status | Notes |
|---|---|---|
| W1 — gym scope | ✅ done | `int[]?` contract, alias-free predicates, login gate, `CoversGymAsync` |
| W2 — role storage | ✅ done | `UserGymRoles` written by create-user / role endpoints / employee role change / hire; backfill inside the W4 migration; `CountUsersWithRoleAsync` unions both tables; `SystemRole` populated |
| W3 — team scope | ✅ done | role-based `IsTeamScopedAsync`, `GetLedTeamIdsAsync`, `LeadsTeamAsync`, 17 call sites, `EmployeesByTeamsSpec` |
| W4 — soft-delete indexes | ✅ done | 18 unique indexes rebuilt with `WHERE "IsDeleted" = FALSE`; migration `20261118214342_UniqueIndexesIgnoreSoftDeleted` applied to the local dev DB |
| Tests | ✅ done | `Tests/ReviveHRSystem.IntegrationTests/SystemicAccessTests.cs` (10 tests, all green) |
| Regression | ✅/⚠️ | No net-new failures vs the pre-change baseline. 11 integration tests and 98 security-matrix rows fail **identically before and after** this work (pre-existing), plus one integration test broken by the in-flight request-type-alias WIP (`GetRequests_TypeFilter_ReturnsOnlyMatchingType`). |

### Corrections found by live testing (2026-11-19)

- Backfill narrowed to legacy accounts (D5) — the first version duplicated every global role into
  every accessible gym.
- `DevelopmentDataSeeder.EnsureUserGymRoleAsync` now normalises a user's rows in a gym, so re-seeding
  repairs role drift.
- Revoking gym access keeps the per-gym role row (inert without `UserGymAccess`); deleting it lost the
  assignment and a re-grant returned the account role-less.

---

## Workstream W1 — Gym scope contract (fixes §1.1)

### W1.1 Central resolver
- `Core/Service/Services/HrPortalHelpers.cs` → `ResolveGymScopeAsync` returns `Task<int[]?>`
  - `TopManagement` + filter → `[id]`; `TopManagement` without filter → `null`
  - other user + filter not allowed → `UnAuthorizedException`
  - other user + filter allowed → `[id]`
  - other user without filter → `allowedIds.ToArray()` (may be `[]`, meaning *nobody*)
- `Core/Service/Services/RecruitmentService.cs` → delete the duplicated private
  `ResolveGymScopeAsync` (lines ~1495) and call `HrPortalHelpers.ResolveGymScopeAsync`.
- Update the XML doc comment on both to state the real contract (`null` = unrestricted).

### W1.2 Flip the "empty = all" predicates
Change every `gymIds == null || gymIds.Length == 0` to `gymIds is null`:

- `Core/Service/Specifications/`
  - `RoleSpecifications.cs` (1), `NotificationSpecifications.cs` (1), `PayrollSpecifications.cs` (2),
    `ReportingSpecifications.cs` (2), `RecruitmentSpecifications.cs` (9), `EventsSpecifications.cs` (2),
    `EvaluationSpecifications.cs` (4), `BranchActionsSpecifications.cs` (2)
- Service-level lambdas:
  - `ReportingService.cs` — 2 × `Func<int,bool> inScope = scope.Length == 0 ? _ => true : …`
  - `DashboardService.cs` — `bool InScope(int gymId) => inScope.Length == 0 || …`
  - `EventsService.cs` — 2 × `bool InScope(Event e) => scope.Length == 0 || …`
  - `PayrollService.cs` — `.Where(e => scope.Length == 0 || scope.Contains(…))`
  - `RecruitmentService.cs` — `gymIds.Length == 0` guards (verify each keeps the TM case)
- Review (do **not** blindly change — these build employee-id lists, not gym scope):
  `RequestService.cs`, `EmployeeService.cs`, `AttendanceManagementService.cs`.

**Gate:** after the change, `grep -rn "gymIds.Length == 0\|scope.Length == 0\|inScope.Length == 0"`
must return only places that intentionally mean "no gyms available".

### W1.3 Login gate
- `Core/Service/Services/AuthService.cs` → `LoginAsync`: replace
  `if (user.UserType == UserType.Employee && gymAccess.Count == 0)` with
  `if (user.UserType != UserType.TopManagement && gymAccess.Count == 0)` and message
  `"This account has no active gym access."`
- `SelectGymAsync` already re-checks membership; no change.

### W1.4 Top Management coverage
- Add `Task<bool> CoversGymAsync(int userId, int gymId, ct)` to `IUserAccessRepository`
  (`Presistence/Repository/UserAccessRepository.cs`): true when the user is `TopManagement`
  **or** has `UserGymAccess` to the gym.
- Replace `HasGymAccessAsync` with `CoversGymAsync` in:
  `EmployeeAccessService.cs` (`EnsureCanAccessCoveredGymAsync`), `SessionContextService.cs`
  (`SwitchGymAsync`), `HrPortalHelpers.ResolveGymAsync`, `AccessControlService.EnsureGymAccessAsync`,
  `AccessControlService.EnsurePermissionForGymAsync`, `EmployeeService.cs`, `EmployeeDocumentService.cs`,
  `BranchActionsService.cs`, `StationCodeService.cs`, `FaceBiometricService.cs`.
- Keep `HasGymAccessAsync` for places that must test a *literal* assignment
  (`ShiftCycleService` syncing access, `AddGymAccessAsync` dedupe, `NotificationService` fan-out).

### W1.5 Tests
New `Tests/ReviveHRSystem.IntegrationTests/GymScopeTests.cs` (or extend `TenantIsolationIdorTests`):
1. HR user with one gym → `PUT /api/users/{id}/gym-access` `{"gymIds":[]}` → the same token's
   `GET /api/employees`, `/api/payrolls`, `/api/requests`, `/api/events`, `/api/reports/overview`
   return **0 rows** (never another gym).
2. HR whose only gym is deactivated → login returns `401`.
3. `TopManagement` with no gym filter → sees all gyms.
4. `TopManagement` can open profile/documents of an employee in a gym created after seeding.
5. Non-TM user requesting a gym they are not assigned to → `401`.

---

## Workstream W2 — Role storage & permission resolution (fixes §1.2)

### W2.1 Repository surface
`Core/DomainLayer/Constants/IUserAccessRepository.cs` + `Infrastructure/Persistence/Repository/UserAccessRepository.cs`:
- `Task<IReadOnlyList<int>> GetUserGymRoleIdsAsync(int userId, int gymId, ct)`
- `Task ReplaceUserGymRolesAsync(int userId, int gymId, IReadOnlyCollection<int> roleIds, ct)`
- `Task ReplaceUserGymRolesForGymsAsync(int userId, IReadOnlyCollection<int> gymIds, IReadOnlyCollection<int> roleIds, ct)`
- `CountUsersWithRoleAsync` → count distinct users across `UserRoles` **∪** `UserGymRoles`.
- `GetPermissionKeysForGymAsync` fallback: use global `UserRoles` only when the user has **no
  `UserGymRoles` row in any gym** (today it falls back per-gym, which lets a Gym-2 employee borrow
  Gym-1 manager keys).

### W2.2 Write paths
| Entry point | Change |
|---|---|
| `RoleService.CreateUserAsync` | after `ReplaceUserRolesAsync`, also `ReplaceUserGymRolesForGymsAsync(user.Id, gymIds, roleIds)` |
| `RoleService.ReplaceUserRolesAsync` (`PUT /api/users/{id}/roles`) | fan out to every gym in `UserGymAccess` |
| `EmployeeService.ChangeEmployeeRoleAsync` | write `UserGymRoles` for **`employee.GymId` only** (do not wipe roles in the other gym) and keep `UserRoles` as the union |
| `RecruitmentService.HireCoreAsync` | write `UserGymRoles` for the hired gym |
| `RoleService.ChangeUserStatusAsync` / gym-access revocation | remove `UserGymRoles` rows for gyms no longer accessible (avoid orphan scope) |

### W2.3 Permission resolution
- `Core/Service/Services/AccessControlService.cs`:
  - add `int? gymId` to `EnsurePermissionAsync` (overload) and delegate to
    `GetPermissionKeysForGymAsync` when a gym is known;
  - update callers that already hold a gym (`EmployeeService`, `BranchActionsService`, `ShiftCycleService`,
    `AttendanceManagementService`, `PayrollService`, `EvaluationService`).
  - Keep the gym-less overload for platform-level operations (`users`, `roles`) — target-scope isolation
    is §2.1 and explicitly out of scope here.
- `Core/Service/Services/EmployeeAccessService.cs` → `EnsureGymScopeAsync`:
  - allow `TopManagement` (already covered by `CoversGymAsync` on the caller path);
  - resolve role names as `per-gym ∪ (global only when the user has no per-gym role anywhere)`.
- `Core/Service/Services/SessionContextService.cs` → `BuildMeAsync`: same fallback so the SPA's
  `RoleInActiveGym` matches the API guard.

### W2.4 `EmployeeDetailResponse.SystemRole`
`EmployeeService.cs` line ~1233 `SystemRole = null, // populated when roles ship (S2)` → populate from
`GetUserGymRoleIdsAsync(userId, employee.GymId)`.

### W2.5 Backfill migration (idempotent)
```sql
INSERT INTO "UserGymRoles" ("UserId", "GymId", "RoleId", "AssignedAt")
SELECT DISTINCT ur."UserId", uga."GymId", ur."RoleId", now()
FROM "UserRoles" ur
JOIN "UserGymAccess" uga ON uga."UserId" = ur."UserId"
WHERE NOT EXISTS (
    SELECT 1 FROM "UserGymRoles" r
    WHERE r."UserId" = ur."UserId" AND r."GymId" = uga."GymId" AND r."RoleId" = ur."RoleId"
);
```
- Exclude archived roles/users (`Roles.IsDeleted = FALSE`, `Users.IsDeleted = FALSE`).
- Add the equivalent `Down()` = delete only the rows this migration would have created (track by a
  temporary marker column is not possible; document that `Down()` is a no-op to avoid destroying
  pre-existing assignments).

### W2.6 Tests
- `RolesControllerTests` / `UserAccountManagementTests`:
  1. `POST /api/users` → the new HR user gets `200` on `GET /api/employees/{id}/profile` and
     `/hr-documents` (no `404`).
  2. `POST /api/applications/{id}/hire` with a role → same.
  3. Promote an employee with an existing `"Employee"` `UserGymRole` row → `GET /api/me` shows the new
     role and the new permission key.
  4. Demote (role = `None (Employee)`) → old permission keys gone, old gym scope gone.
  5. Multi-gym: role change in Gym 1 does not change the Gym 2 role.
  6. `CountUsersWithRoleAsync` counts a user who only has a `UserGymRole`.
- New `TeamScopeTests`/`MultiGymRoleTests` in integration tests.

---

## Workstream W3 — Team scope (fixes §1.3)

### W3.1 `TeamScopeService`
`Core/Service/Services/TeamScopeService.cs` + `Core/ServiceAbstraction/Services/ITeamScopeService.cs`:
- `GetLedTeamIdsAsync(userId, gymId)` → all `TeamLeaders` rows (no `FirstOrDefault`).
- `IsTeamScopedAsync` → `holds TeamLeader in this gym` **AND** `holds none of`
  `Super Admin / HR / HR Manager / Branch Manager` in this gym. **No dependency on a team row.**
- `LeadsTeamAsync(userId, gymId, teamId)` → `Any(t => t.TeamId == teamId)`.
- Keep `GetLedTeamIdAsync` as a display helper (`FirstOrDefault`) for `SessionContextService.LedTeamId`
  and `DashboardService`; mark it "display only — never use for authorization".

### W3.2 Call sites
Replace `ledTeamId` equality checks with `LeadsTeamAsync` / set membership in:
`EmployeeAccessService.cs`, `EmployeeService.cs` (3 sites), `EmployeeManagementService.cs` (3),
`AttendanceManagementService.cs` (3), `RequestService.cs` (2), `RequestManagementService.cs`,
`BranchActionsService.cs`, `OffboardingService` (in `AttendanceTeamRecruitmentOffboardingServices.cs`),
`ShiftCycleService.cs`, `ShiftManagementService.cs`, `EvaluationService.cs`, `PayrollService.cs`,
`DashboardService.cs`, `SessionContextService.cs`, `EmployeeRequestService.cs`.

Because `IsTeamScopedAsync` no longer returns `false` for a teamless Team Leader, existing
`if (IsTeamScoped) { ledTeamId is null → 404 }` blocks now **deny** instead of escalate.

### W3.3 Hygiene
- `EmployeeService.ChangeEmployeeRoleAsync`: when the new role is **not** `Team Leader`, soft-delete the
  user's `TeamLeaders` rows in that gym (prevents stale rows re-activating on a later promotion).
- `EmployeeService.ChangeEmployeeRoleAsync`: when assigning `Team Leader` with no `TeamLeaders` row, the
  user sees nothing until HR assigns a team (fail closed) — document in the response message.

### W3.4 Tests
1. Team Leader role with **no** `TeamLeaders` row → `GET /api/employees/{otherId}` → `404`
   (previously returned another team's employee).
2. Branch Manager + Team Leader (both roles) → gym-wide access (previously trapped in one team).
3. Team Leader of two teams → can read employees of **both** teams.
4. Team Leader of Team A → `GET /api/requests?status=Pending` returns only Team A.

---

## Workstream W4 — Soft delete vs unique indexes (fixes §1.4)

### W4.1 Index configuration
Add `.HasFilter("\"IsDeleted\" = FALSE")` (PostgreSQL syntax, match the existing
`ShiftAssignmentUniqueIndexIgnoresSoftDeleted` migration) to every unique index on a soft-deletable entity:

| File | Index |
|---|---|
| `CommunicationAndEvaluationConfigurations.cs` | `Events(Type, EntityType, EntityId)`; `EvaluationAnswers(EvaluationResponseId, EvaluationQuestionId)` |
| `EmployeeModuleConfigurations.cs` | `Employees(EmployeeNumber)`, `Employees(UserId)`, `LeaveBalances(EmployeeId, LeaveType, Year)`, onboarding checklist `(EmployeeId, SortOrder)`, offboarding checklist `(OffboardingCaseId, SortOrder)` |
| `FaceEmbeddingConfiguration.cs` | `FaceEmbeddings(EmployeeId)` |
| `OrganizationModuleConfigurations.cs` | `Departments(GymId, Name)`, `Positions(GymId, Title, Level)`, `Teams(GymId, Name)` |
| `RecruitmentModuleConfigurations.cs` | `Vacancies(PublicLinkToken)` |
| `RequestAndPayrollConfigurations.cs` | `RequestDecisions(RequestId, Stage)`, `PayrollEntries(PayrollPeriodId, EmployeeId)`, `DeductionCandidates(EmployeeId, DeductionDate)` |
| `UserModuleConfigurations.cs` | `Users(Email)`, `Users(UserName)`, `Roles(Name)`, `Permissions(Key)`, `RefreshTokens(TokenHash)` |
| `SchedulingAndAttendanceConfigurations.cs` | `AttendanceRecords(EmployeeId, Date)`, `StationCodes(Code)`, `BiometricDevices(DeviceToken)`, `StationSessions(TokenHash)` |

Already filtered, leave as-is: `ShiftAssignments(EmployeeId, Date)`, `TeamLeaders(EmployeeId)`,
`EvaluationAssignments(EvaluationFormId, EmployeeId, EvaluatorUserId)`.

### W4.2 Migration
`dotnet ef migrations add UniqueIndexesIgnoreSoftDeleted --project Infrastructure/Persistence/Persistence.csproj --startup-project ReviveHRSystem.Web/ReviveHRSystem.Web.csproj`
- `Up()`: drop + recreate each index with `filter: "\"IsDeleted\" = FALSE"`.
- `Down()`: drop + recreate without filter.
- **Soft-deleted rows are retained.** The index is *partial*, so a deleted row and a new active row with
  the same key coexist; the deleted row stays queryable for history. Nothing is hard-deleted by this
  migration or by `UnitOfWork.StampRecordMetadata()`.
- If the migration fails on a duplicate **active** row, stop and report the offending table —
  no automatic deletes (D4).

### W4.3 Pre-flight SQL (run before applying to any shared DB)
One query per unique index, e.g.:
```sql
SELECT "EmployeeNumber", COUNT(*) FROM "Employees"
WHERE "IsDeleted" = FALSE GROUP BY "EmployeeNumber" HAVING COUNT(*) > 1;
```

### W4.4 Tests
1. Enroll face → `DELETE /api/employees/face/{id}` → re-enroll succeeds.
2. Create + archive a role → create the same role name succeeds.
3. `GET /api/events` after a contract/document leaves and re-enters the derivation window → `200`.
4. Soft-delete a user (or employee) → re-create with the same email → succeeds.
5. Attendance record re-create after deleting the day's record → succeeds.

---

## Execution order & dependencies

| Phase | Work | Why this order |
|---|---|---|
| 0 | Baseline: `dotnet build` + both test projects green; record pre-existing failures | need a clean reference |
| 1 | **W1** (gym scope + login gate + `CoversGymAsync`) | highest severity; stops cross-gym data leak |
| 2 | **W3** (team scope) | small, contained; stops Team Leader escalation |
| 3 | **W2** (role storage + backfill migration + permission resolution) | largest; depends on W1's `CoversGymAsync` and W3's team-aware roles |
| 4 | **W4** (filtered unique indexes) | independent; can run in parallel with 1–3 |
| 5 | Full regression + manual smoke of the four scenarios in the audit; copy this plan to `docs/implementation/systemic-access-fix-plan.md` | confirm no behavior loss, keep the plan in the repo |

W4 is independent and can be developed in parallel; do not merge both migrations in one PR if the
team prefers one migration per concern.

---

## Validation commands

```powershell
cd 'D:\Youssef\Projects\_Hr System\ReviveHRSystem'
dotnet build ReviveHRSystem.Web.sln

# integration suite (drops/recreates ReviveHrSystemDb_IntegrationTests on local PostgreSQL)
dotnet test Tests\ReviveHRSystem.IntegrationTests\ReviveHRSystem.IntegrationTests.csproj

# security suite
dotnet test Tests\ReviveHRSystem.SecurityTests\ReviveHRSystem.SecurityTests.csproj

# migration generation (do not apply automatically)
dotnet ef migrations add UniqueIndexesIgnoreSoftDeleted `
  --project Infrastructure\Persistence\Persistence.csproj `
  --startup-project ReviveHRSystem.Web\ReviveHRSystem.Web.csproj

# apply to the LOCAL dev database only, after review
dotnet ef database update `
  --project Infrastructure\Persistence\Persistence.csproj `
  --startup-project ReviveHRSystem.Web\ReviveHRSystem.Web.csproj
```

Targeted runs while iterating:
```powershell
dotnet test Tests\ReviveHRSystem.IntegrationTests --filter "FullyQualifiedName~GymScopeTests|FullyQualifiedName~TeamScopeTests|FullyQualifiedName~RolesControllerTests|FullyQualifiedName~TenantIsolationIdorTests"
```

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Missing a `[]`-means-all predicate → silent over-permission | grep gate in W1.2 + integration matrix test per module |
| Zero-gym login block surprises existing HR accounts | pre-flight query listing users with `UserGymAccess` count 0; assign or disable before deploy |
| Team Leader without a team now gets `404` instead of gym-wide data | intentional fail-closed; brief HR (assign a team after promotion) |
| `UserGymRoles` backfill creates unintended roles for multi-gym users | backfill only role × existing `UserGymAccess` pairs; verified by a count-diff report |
| Filtered index creation fails on duplicate active rows | pre-flight SQL, fail loud, manual cleanup; soft-deleted history rows are never touched |
| Role change in one gym wipes another gym's role | `ChangeEmployeeRoleAsync` writes only `employee.GymId`; test 5 in W2.6 |
| `UserRoles` legacy fallback masks missing per-gym rows | fallback narrowed to "no per-gym role anywhere"; add a startup warning/log when it triggers |

---

## Out of scope (explicit)

- §2.1 target-user scope/ceiling checks in `UsersController`/`RoleService` (separate workstream).
- §2.3–§2.5 refresh-token rotation and lockout fixes.
- §2.6 preset-role rename/archive guard.
- §3.x attendance/biometrics/kiosk, §4.x payroll/leave, §5.x recruitment/offboarding, §6.x reports.
- §6.3 `BranchReport` event identity (`EntityId = 0`) — the W4 filter fixes the *soft-delete* failure but
  a second live branch report still collides; that design change belongs to §6.3.

---

## Definition of done

- `dotnet build ReviveHRSystem.Web.sln` → 0 errors, no new warnings.
- Both test projects green, including the new tests above.
- The five manual scenarios pass:
  1. revoke an HR user's gyms → they see nothing (not everything);
  2. create/hire an HR or manager → no `404`;
  3. promote then demote → permissions gained then lost;
  4. teamless Team Leader → sees only their team (nothing);
  5. delete then recreate a face/role/event → succeeds.
- Audit §1.1–§1.4 marked fixed with the commit / PR reference.
- No soft-deleted row was removed by any migration (verified by a before/after `COUNT(*) WHERE "IsDeleted" = TRUE` per affected table).
