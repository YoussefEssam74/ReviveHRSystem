using System.Net.Http.Headers;
using System.Net.Http.Json;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Support;
using ReviveHRSystem.Web.DataSeed;
using ServiceAbstraction.Services;
using Shared.Authorization;

namespace ReviveHRSystem.SecurityTests.Support
{
    /// <summary>One login-capable identity used by the matrix theories.</summary>
    public sealed record SecurityUserIdentity(
        string Key,
        string Email,
        string Password,
        int GymId,
        int? LedTeamId = null);

    /// <summary>
    /// The identity + resource catalog the matrix rows target. Provisioned once per
    /// run by <see cref="SecurityProvisioning"/>.
    /// </summary>
    public sealed class SecurityContext
    {
        public int GymAId { get; init; }
        public int GymBId { get; init; }

        /// <summary>Tenant that owns gym A / gym B (seeded one-company-per-gym).</summary>
        public int CompanyAId { get; init; }
        public int CompanyBId { get; init; }

        /// <summary>The seeded HR account — the subject of the platform user-administration rows.</summary>
        public int HrUserId { get; init; }

        /// <summary>
        /// A dedicated HR account created only for the platform user-administration rows.
        /// It is never used as a login identity, so suspending / resetting / re-assigning it
        /// cannot destabilise the the `hr` identity that dozens of other rows depend on.
        /// </summary>
        public int PlatformProbeUserId { get; init; }

        /// <summary>The seeded Growth plan (allows a trial) — target for the create-company probe.</summary>
        public int GrowthPlanId { get; init; }

        /// <summary>A throwaway plan for the plan catalogue's read/update/duplicate rows.</summary>
        public int PlanProbeId { get; init; }

        /// <summary>A plan with no live subscription, safe for the archive row.</summary>
        public int PlanArchiveProbeId { get; init; }

        /// <summary>Open invoice with no payments — the detail and PDF rows.</summary>
        public int InvoiceProbeId { get; init; }

        /// <summary>Open invoice dedicated to the record-payment row.</summary>
        public int InvoicePaymentProbeId { get; init; }

        /// <summary>Overdue invoice dedicated to the reminder row.</summary>
        public int InvoiceOverdueProbeId { get; init; }

        /// <summary>Open invoice with no payments, dedicated to the void row.</summary>
        public int InvoiceVoidProbeId { get; init; }

        /// <summary>A throwaway feature flag for the flag catalogue's update row.</summary>
        public int FeatureFlagProbeId { get; init; }

        /// <summary>The probe flag's immutable key — the update payload must echo it back.</summary>
        public string FeatureFlagProbeKey { get; init; } = string.Empty;

        /// <summary>
        /// A SEPARATE flag for the delete row. Sharing one flag between the update and delete rows
        /// let the delete run first and turn the update into a 404.
        /// </summary>
        public int FeatureFlagDeleteProbeId { get; init; }

        public string FeatureFlagDeleteProbeKey { get; init; } = string.Empty;

        /// <summary>An existing audit row — the detail/review rows address it.</summary>
        public int AuditProbeId { get; init; }

        // Matrix identities. Mains are homed in gym A (single-gym access each);
        // twins hold the same role but only gym B access, so every gym-A target
        // is out of scope for them.
        public required SecurityUserIdentity EmployeeSelf { get; init; }        // karim (seeded)
        public required SecurityUserIdentity EmployeeOther { get; init; }       // plain employee, gym A, not in the team
        public required SecurityUserIdentity EmployeeTwin { get; init; }        // sara (seeded, gym B)
        public required SecurityUserIdentity TeamLeader { get; init; }          // owns the gym-A team; karim is a member
        public required SecurityUserIdentity TeamLeaderTwin { get; init; }
        public required SecurityUserIdentity BranchManager { get; init; }
        public required SecurityUserIdentity BranchManagerTwin { get; init; }
        public required SecurityUserIdentity Hr { get; init; }                  // hr@revive.hr (seeded)
        public required SecurityUserIdentity HrTwin { get; init; }
        public required SecurityUserIdentity HrManager { get; init; }
        public required SecurityUserIdentity HrManagerTwin { get; init; }
        public required SecurityUserIdentity TopManagement { get; init; }       // admin@revive.hr (seeded)

        // Resource ids substituted into the matrix route templates.
        public int KarimEmployeeId { get; init; }
        public int KarimUserId { get; init; }            // karim's USER id (JWT sub/uid)
        public int TopManagementUserId { get; init; }    // admin's USER id
        public int TeamId { get; init; }
        public int TeamLeadEmployeeId { get; init; }
        public int OutsiderEmployeeId { get; init; }        // karim -> outsider is the employeeOther pair
        public int ProbeEmployeeId { get; init; }           // dedicated target for mutating rows
        public string ProbeEmployeeNumber { get; init; } = "";
        public int KarimEmployeeDocumentId { get; init; }   // Source=Employee
        public int KarimHrDocumentId { get; init; }         // Source=Hr
        public int KarimPendingRequestId { get; init; }     // cancel row
        public int KarimAttachedRequestId { get; init; }    // attachment download row
        public int KarimStage1DecidedTlRequestId { get; init; }   // undo row: TL's own decided target
        public int KarimStage1DecidedBmRequestId { get; init; }   // undo row: BM's own decided target
        public int KarimStage1DecidedTopRequestId { get; init; }  // undo row: Top Management's target
        public int KarimEvaluationId { get; init; }         // evaluation edit row
        public int EvaluationFormId { get; init; }
        public int EvaluationQuestionId { get; init; }
        public int PayrollPeriodId { get; init; }
        public int PayrollEntryId { get; init; }            // payroll sheets / payslip rows
    }

    /// <summary>
    /// One-time data provisioning for the security run. No application code or
    /// configuration is touched — the suite only creates data on the dedicated
    /// throwaway database so the API behaviors can be asserted for real.
    /// </summary>
    public static class SecurityProvisioning
    {
        private const string KarimEmail = "karim@revive.hr";

        /// <summary>
        /// Permission keys the matrix assigns to the HR and HR Manager roles. In a real
        /// deployment these arrive via the Roles &amp; Permissions page; granting them here
        /// lets the HR-allowed rows exercise the intended access rules instead of
        /// failing on missing role-bundle configuration (that gap is reported separately).
        /// Convergence decisions: HR and HRM both hold the operations keys; the five
        /// sensitive HR-mutation keys (transfer/position/compensation/contract/role)
        /// belong to the HR MANAGER ONLY (matrix rows 8-12 deny them to HR by design).
        /// </summary>
        private static readonly string[] HrMatrixKeys =
        [
            "employees.view", "employees.create", "employees.edit", "employees.status.change",
            "employees.bulk_import", "employees.documents.view", "employees.documents.manage",
            "employees.leave_balance.manage", "employees.offboard", "payroll.view",
            "recruitment.view", "recruitment.hire.approve", "requests.view", "attendance.view",
            "evaluations.view",
        ];

        private static readonly string[] HrManagerMatrixKeys =
        [
            .. HrMatrixKeys,
            "employees.transfer", "employees.position.change", "employees.compensation.manage",
            "employees.contract.manage", "employees.role.assign",
            // Platform-console keys an HR Manager legitimately holds: it is the platform HR
            // lead, so it sees every company and administers HR/employee accounts. It does
            // NOT hold platform.companies.create/edit/status, platform.branches.manage,
            // platform.plans.*, platform.billing.*, platform.revenue.view,
            // platform.audit.*, platform.settings.manage, platform.feature_flags.manage,
            // platform.hr_manager.manage or platform.impersonate.
            "platform.companies.view",
            "platform.users.view", "platform.users.manage", "platform.users.reset_password",
            "gym.hr_staff.assign",
        ];

        public static async Task<SecurityContext> ProvisionAsync(
            IServiceProvider services, HttpClient client)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var fileStorage = scope.ServiceProvider.GetRequiredService<IFileStorage>();
            var builder = new TestDataBuilder(services);

            var gymA = await db.Gyms.FirstAsync(g => g.Name == DevelopmentDataSeeder.Gym1Name);
            var gymB = await db.Gyms.FirstAsync(g => g.Name == DevelopmentDataSeeder.Gym2Name);
            var gymARecord = new TestGym(gymA.Id, "", gymA.Name);
            var gymBRecord = new TestGym(gymB.Id, "", gymB.Name);

            // ----------------------------------------------------------- seeded
            var karimEmployee = await db.Employees.Include(e => e.User)
                .FirstAsync(e => e.User!.Email == KarimEmail);
            var saraEmployee = await db.Employees.Include(e => e.User)
                .FirstAsync(e => e.User!.Email == "sara@revive.hr");
            var hrUser = await db.Users.FirstAsync(u => u.Email == DevelopmentDataSeeder.HrEmail);
            var adminUser = await db.Users.FirstAsync(u => u.Email == DevelopmentDataSeeder.AdminEmail);

            // ----------------------------------------------------------- created

            // Team Leader main + his team; karim is INSIDE that team.
            var tlEmployee = await builder.CreateEmployeeAsync(gymARecord);
            await AssignGymRoleAsync(db, tlEmployee.UserId, gymA.Id, RoleNames.TeamLeader);

            var team = new Team
            {
                GymId = gymA.Id,
                Name = $"Sec Team {Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                IsActive = true
            };
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            db.TeamLeaders.Add(new TeamLeader { TeamId = team.Id, EmployeeId = tlEmployee.EmployeeId });
            karimEmployee.TeamId = team.Id;
            await db.SaveChangesAsync();

            // Branch Manager main (gym A only — the seeded omar is dual-gym).
            var bmMain = await builder.CreateEmployeeAsync(gymARecord);
            await AssignGymRoleAsync(db, bmMain.UserId, gymA.Id, RoleNames.BranchManager);

            // HR main (seeded hr@ is single-gym already) and HR Manager main (gym A only).
            await GrantKeysAsync(builder, hrUser.Id, HrMatrixKeys);

            // Dedicated target for the platform console's user-administration rows (suspend,
            // reset, revoke, re-assign). It is never used to log in, so mutating it cannot
            // change the permission surface of any identity other rows rely on.
            var platformProbe = await builder.CreateUserAsync(UserType.HR, [gymARecord]);
            await GrantKeysAsync(builder, platformProbe.UserId, HrMatrixKeys);

            // Billing probes. Each mutating row gets its own record so parallel execution can
            // never make one row's side effect change another row's expected status.
            var (planProbe, planArchiveProbe, invoiceProbe, invoicePaymentProbe, invoiceOverdueProbe, invoiceVoidProbe) =
                await ProvisionBillingProbesAsync(db, gymA.CompanyId);

            var featureFlagProbe = await ProvisionFeatureFlagProbeAsync(db, "probe");
            var featureFlagDeleteProbe = await ProvisionFeatureFlagProbeAsync(db, "delete");
            var auditProbeId = await ProvisionAuditProbeAsync(db);
            var hrmMainUser = await builder.CreateUserAsync(UserType.HR, [gymARecord]);
            await AssignGymRoleAsync(db, hrmMainUser.UserId, gymA.Id, RoleNames.HrManager);
            await GrantKeysAsync(builder, hrmMainUser.UserId, HrManagerMatrixKeys);
            // HR/HRM hold employee profiles of their own — the actor-based contact
            // writes (matrix row 22) and every "own record" self-service surface
            // depend on the caller having a profile.
            _ = await builder.AttachEmployeeProfileAsync(hrmMainUser, gymARecord, "Security HR Manager");

            // outsider (karim's IDOR counterpart, not in the team) + probe employee
            // (mutating rows target it; it is a second member of the TL's team so the
            // team-scope reads behave exactly as designed).
            var outsider = await builder.CreateEmployeeAsync(gymARecord);
            var probe = await builder.CreateEmployeeAsync(gymARecord);
            var probeEntity = await db.Employees.FirstAsync(e => e.Id == probe.EmployeeId);
            probeEntity.TeamId = team.Id;
            await db.SaveChangesAsync();

            // Cross-tenant twins: same roles, gym B only.
            var tlTwinUser = await builder.CreateUserAsync(UserType.HR, [gymBRecord]);
            await AssignGymRoleAsync(db, tlTwinUser.UserId, gymB.Id, RoleNames.TeamLeader);
            var bmTwinUser = await builder.CreateUserAsync(UserType.HR, [gymBRecord]);
            await AssignGymRoleAsync(db, bmTwinUser.UserId, gymB.Id, RoleNames.BranchManager);
            var hrTwinUser = await builder.CreateUserAsync(UserType.HR, [gymBRecord]);
            await AssignGymRoleAsync(db, hrTwinUser.UserId, gymB.Id, RoleNames.Hr);
            var hrmTwinUser = await builder.CreateUserAsync(UserType.HR, [gymBRecord]);
            await AssignGymRoleAsync(db, hrmTwinUser.UserId, gymB.Id, RoleNames.HrManager);

            // ----------------------------------------------------------- resources

            var karimId = karimEmployee.Id;

            var karimEmpDoc = await CreateEmployeeSourceDocumentAsync(db, fileStorage, karimId);
            var karimHrDoc = await CreateHrSourceDocumentAsync(db, fileStorage, karimId);

            var pendingRequest = new EmployeeRequest
            {
                EmployeeId = karimId,
                Type = "annual-leave",
                RequestDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14)),
                TargetStartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14)),
                Details = "Security provisioning: family event",
                Status = RequestStatus.Pending
            };
            db.EmployeeRequests.Add(pendingRequest);
            await db.SaveChangesAsync();

            // Stage-1 decided annual-leave requests for the undo row. One decided
            // BranchManager-stage target per allowed identity (Team Leader, Branch
            // Manager, Top Management): an undo flips its target back to Pending, so
            // parallel-success must never share one request id.
            var undoTargets = new List<EmployeeRequest>();
            foreach (var targetKey in new[] { "teamLeader", "branchManager", "topManagement" })
            {
                undoTargets.Add(new EmployeeRequest
                {
                    EmployeeId = karimId,
                    Type = "annual-leave",
                    RequestDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(21)),
                    TargetStartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(21)),
                    Details = $"Security provisioning: stage-1 decided (undo target {targetKey})",
                    Status = RequestStatus.PendingHRReview
                });
            }
            db.EmployeeRequests.AddRange(undoTargets);
            await db.SaveChangesAsync();
            foreach (var decidedRequest in undoTargets)
            {
                db.RequestDecisions.Add(new RequestDecision
                {
                    RequestId = decidedRequest.Id,
                    Stage = ApprovalStage.BranchManager,
                    Decision = DecisionOutcome.Approved,
                    DecidedBy = bmMain.UserId,
                    Comment = "Security provisioning stage-1 approve"
                });
            }
            await db.SaveChangesAsync();

            // Sick-leave request WITH a real stored attachment, created through the
            // API so the download row exercises the real storage service.
            var karimToken = await LoginAsync(client, KarimEmail);
            var attachedRequestId = await CreateAttachedSickRequestAsync(client, karimToken, karimId);

            // Karim's avatar (readers of GET photo then receive 200, not 404-no-file).
            await UploadPhotoAsync(client, karimToken, karimId);

            // Evaluation form + question in gym A; one submitted evaluation on KARIM
            // (the evaluation-edit row must target an existing evaluation).
            var form = new EvaluationForm
            {
                GymId = gymA.Id,
                Name = $"Sec Matrix {Guid.NewGuid().ToString("N")[..8]}",
                Status = "Active",
                Target = "All"
            };
            var question = new EvaluationQuestion
            {
                QuestionText = "Punctuality",
                SortOrder = 1
            };
            form.Questions.Add(question);
            db.EvaluationForms.Add(form);
            await db.SaveChangesAsync();

            var karimEvaluationId = await SeedEvaluationResponseAsync(db, karimId, form.Id, question.Id, hrUser.Id);

            // Locked + paid mirrors a closed payroll cycle: the sheets/payslip read
            // rows must see real data (an Open period would read as "no entries").
            var periodId = await builder.CreatePayrollPeriodAsync(
                gymA.Id,
                DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
                DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3)),
                DomainLayer.Models.PayrollModule.Enums.PayrollPeriodStatus.Locked,
                DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)));
            var entryId = await builder.CreatePayrollEntryAsync(periodId, karimId, baseSalary: 4200);

            // Export the provisioned role credentials for the host-side toolchain
            // (Schemathesis scans, ZAP sessions) WITHOUT leaking them to the console.
            var identitiesFile = FindReportFile("security-test-identities.json");
            var identities = new
            {
                employee = new { email = karimEmployee.User!.Email, password = DevelopmentDataSeeder.EmployeePassword, employeeId = karimId },
                teamLeader = new { email = tlEmployee.Email, password = DevelopmentDataSeeder.EmployeePassword },
                branchManager = new { email = bmMain.Email, password = DevelopmentDataSeeder.EmployeePassword },
                hr = new { email = hrUser.Email, password = DevelopmentDataSeeder.EmployeePassword },
                hrManager = new { email = hrmMainUser.Email, password = DevelopmentDataSeeder.EmployeePassword },
                topManagement = new { email = adminUser.Email, password = DevelopmentDataSeeder.EmployeePassword },
            };
            System.IO.File.WriteAllText(
                identitiesFile,
                System.Text.Json.JsonSerializer.Serialize(identities, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));

            return new SecurityContext
            {
                GymAId = gymA.Id,
                GymBId = gymB.Id,
                CompanyAId = gymA.CompanyId,
                CompanyBId = gymB.CompanyId,
                HrUserId = hrUser.Id,
                PlatformProbeUserId = platformProbe.UserId,
                PlanProbeId = planProbe.Id,
                PlanArchiveProbeId = planArchiveProbe.Id,
                InvoiceProbeId = invoiceProbe.Id,
                InvoicePaymentProbeId = invoicePaymentProbe.Id,
                InvoiceOverdueProbeId = invoiceOverdueProbe.Id,
                InvoiceVoidProbeId = invoiceVoidProbe.Id,
                FeatureFlagProbeId = featureFlagProbe.Id,
                FeatureFlagProbeKey = featureFlagProbe.Key,
                FeatureFlagDeleteProbeId = featureFlagDeleteProbe.Id,
                FeatureFlagDeleteProbeKey = featureFlagDeleteProbe.Key,
                AuditProbeId = auditProbeId,
                GrowthPlanId = await db.SubscriptionPlans
                    .Where(p => p.Slug == "growth")
                    .Select(p => p.Id)
                    .FirstAsync(),
                EmployeeSelf = Id("employeeSelf", karimEmployee.User!.Email!, gymA.Id),
                EmployeeOther = Id("employeeOther", outsider.Email, gymA.Id),
                EmployeeTwin = Id("employeeTwin", saraEmployee.User!.Email!, gymB.Id),
                TeamLeader = Id("teamLeader", tlEmployee.Email, gymA.Id, team.Id),
                TeamLeaderTwin = Id("teamLeaderTwin", tlTwinUser.Email, gymB.Id),
                BranchManager = Id("branchManager", bmMain.Email, gymA.Id),
                BranchManagerTwin = Id("branchManagerTwin", bmTwinUser.Email, gymB.Id),
                Hr = Id("hr", hrUser.Email, gymA.Id),
                HrTwin = Id("hrTwin", hrTwinUser.Email, gymB.Id),
                HrManager = Id("hrManager", hrmMainUser.Email, gymA.Id),
                HrManagerTwin = Id("hrManagerTwin", hrmTwinUser.Email, gymB.Id),
                TopManagement = Id("topManagement", adminUser.Email, gymA.Id),
                KarimEmployeeId = karimId,
                KarimUserId = karimEmployee.User!.Id,
                TopManagementUserId = adminUser.Id,
                TeamId = team.Id,
                TeamLeadEmployeeId = tlEmployee.EmployeeId,
                OutsiderEmployeeId = outsider.EmployeeId,
                ProbeEmployeeId = probe.EmployeeId,
                ProbeEmployeeNumber = probe.EmployeeNumber,
                KarimEmployeeDocumentId = karimEmpDoc,
                KarimHrDocumentId = karimHrDoc,
                KarimPendingRequestId = pendingRequest.Id,
                KarimAttachedRequestId = attachedRequestId,
                KarimStage1DecidedTlRequestId = undoTargets[0].Id,
                KarimStage1DecidedBmRequestId = undoTargets[1].Id,
                KarimStage1DecidedTopRequestId = undoTargets[2].Id,
                KarimEvaluationId = karimEvaluationId,
                EvaluationFormId = form.Id,
                EvaluationQuestionId = question.Id,
                PayrollPeriodId = periodId,
                PayrollEntryId = entryId,
            };
        }

        // ------------------------------------------------------------------ helpers

        private static SecurityUserIdentity Id(string key, string email, int gymId, int? ledTeamId = null) =>
            new(key, email, DevelopmentDataSeeder.EmployeePassword, gymId, ledTeamId);

        /// <summary>
        /// Reports directory next to the solution (sibling of Tests/ and Core/),
        /// resolved without printing any content.
        /// </summary>
        private static string FindReportFile(string fileName)
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null && directory.GetDirectories("ReviveHRSystem.Web").Length == 0)
            {
                directory = directory.Parent;
            }

            if (directory is null)
            {
                throw new InvalidOperationException("Could not locate the solution root from the test bin directory.");
            }

            var reports = Path.Combine(directory.FullName, "reports");
            Directory.CreateDirectory(reports);
            return Path.Combine(reports, fileName);
        }

        /// <summary>
        /// Creates the plan and invoice records the billing rows address. Every mutating row
        /// owns a distinct record, so the matrix theory can run in parallel without one row's
        /// side effect flipping another's expected status.
        /// </summary>
        private static async Task<(
            DomainLayer.Models.BillingModule.SubscriptionPlan PlanProbe,
            DomainLayer.Models.BillingModule.SubscriptionPlan PlanArchiveProbe,
            DomainLayer.Models.BillingModule.Invoice InvoiceProbe,
            DomainLayer.Models.BillingModule.Invoice InvoicePaymentProbe,
            DomainLayer.Models.BillingModule.Invoice InvoiceOverdueProbe,
            DomainLayer.Models.BillingModule.Invoice InvoiceVoidProbe)> ProvisionBillingProbesAsync(
            ReviveHrDbContext db,
            int companyId)
        {
            var suffix = Guid.NewGuid().ToString("N")[..8];

            DomainLayer.Models.BillingModule.SubscriptionPlan NewPlan(string name) => new()
            {
                Name = name,
                Slug = name.ToLowerInvariant().Replace(' ', '-'),
                Price = 1000m,
                Currency = "EGP",
                CycleCount = 1,
                CycleUnit = DomainLayer.Models.BillingModule.Enums.PlanCycleUnit.Months,
                TrialMode = DomainLayer.Models.BillingModule.Enums.TrialMode.None,
                Features = [new DomainLayer.Models.BillingModule.PlanFeature { Label = "Security matrix probe", SortOrder = 1 }],
            };

            // The read/update/duplicate rows share one plan; the archive row needs a plan with
            // no live subscription, so it gets its own.
            var planProbe = NewPlan($"Matrix Plan {suffix}");
            var planArchiveProbe = NewPlan($"Matrix Archive {suffix}");
            db.SubscriptionPlans.AddRange(planProbe, planArchiveProbe);
            await db.SaveChangesAsync();

            DomainLayer.Models.BillingModule.Invoice NewInvoice(
                string number,
                DomainLayer.Models.BillingModule.Enums.InvoiceStatus status,
                DateTime dueOn,
                int daysAgo) => new()
                {
                    InvoiceNumber = number,
                    CompanyId = companyId,
                    PeriodStart = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(-daysAgo), DateTimeKind.Utc),
                    PeriodEnd = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(-daysAgo).AddMonths(1).AddDays(-1), DateTimeKind.Utc),
                    PeriodLabel = DateTime.UtcNow.AddDays(-daysAgo).ToString("MMM yyyy"),
                    Amount = 1000m,
                    Currency = "EGP",
                    Status = status,
                    IssuedOn = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(-daysAgo), DateTimeKind.Utc),
                    DueOn = DateTime.SpecifyKind(dueOn, DateTimeKind.Utc),
                };

            var invoiceProbe = NewInvoice($"INV-MX{suffix}-1", DomainLayer.Models.BillingModule.Enums.InvoiceStatus.Open, DateTime.UtcNow.AddDays(30), 1);
            var invoicePaymentProbe = NewInvoice($"INV-MX{suffix}-2", DomainLayer.Models.BillingModule.Enums.InvoiceStatus.Open, DateTime.UtcNow.AddDays(30), 2);
            var invoiceOverdueProbe = NewInvoice($"INV-MX{suffix}-3", DomainLayer.Models.BillingModule.Enums.InvoiceStatus.Overdue, DateTime.UtcNow.AddDays(-10), 40);
            var invoiceVoidProbe = NewInvoice($"INV-MX{suffix}-4", DomainLayer.Models.BillingModule.Enums.InvoiceStatus.Open, DateTime.UtcNow.AddDays(30), 3);

            db.Invoices.AddRange(invoiceProbe, invoicePaymentProbe, invoiceOverdueProbe, invoiceVoidProbe);
            await db.SaveChangesAsync();

            return (planProbe, planArchiveProbe, invoiceProbe, invoicePaymentProbe, invoiceOverdueProbe, invoiceVoidProbe);
        }

        /// <summary>
        /// A throwaway feature flag. Each mutating row gets its own, so the delete row can never
        /// remove the flag the update row is working on.
        /// </summary>
        private static async Task<DomainLayer.Models.PlatformModule.FeatureFlag> ProvisionFeatureFlagProbeAsync(
            ReviveHrDbContext db,
            string purpose)
        {
            var flag = new DomainLayer.Models.PlatformModule.FeatureFlag
            {
                Key = $"matrix.{purpose}.{Guid.NewGuid():N}"[..24].ToLowerInvariant(),
                Name = $"Security matrix {purpose} probe",
                Description = "Created by the access-matrix fixture.",
                IsEnabled = false,
                Scope = DomainLayer.Models.PlatformModule.Enums.FeatureFlagScope.Global,
            };

            db.FeatureFlags.Add(flag);
            await db.SaveChangesAsync();
            return flag;
        }

        /// <summary>
        /// A single unreviewed warning event for the audit detail/review rows. It is created
        /// explicitly because the trail is empty at provisioning time — there is nothing to
        /// "pick an existing row" from.
        /// </summary>
        private static async Task<int> ProvisionAuditProbeAsync(ReviveHrDbContext db)
        {
            var probe = new DomainLayer.Models.AuditModule.AuditLog
            {
                Action = "Updated",
                ActionLabel = "Security matrix probe event",
                Category = "Settings",
                Severity = "warning",
                EntityType = "SecurityTest",
                EntityId = 0,
                Target = "Access matrix fixture",
                Detail = "Synthetic event created so the audit detail and review rows have a stable target.",
                Timestamp = DateTime.UtcNow.AddMinutes(-1),
            };

            db.AuditLogs.Add(probe);
            await db.SaveChangesAsync();
            return probe.Id;
        }

        private static async Task GrantKeysAsync(TestDataBuilder builder, int userId, string[] keys)        {            foreach (var key in keys)
            {
                await builder.GrantPermissionAsync(userId, key, "security-test");
            }
        }

        private static async Task<string> LoginAsync(HttpClient client, string email)
        {
            var response = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email,
                password = DevelopmentDataSeeder.EmployeePassword
            });
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
            return json.GetProperty("accessToken").GetString()
                ?? throw new InvalidOperationException("Security provisioning login returned no accessToken.");
        }

        private static async Task UploadPhotoAsync(HttpClient client, string token, int karimId)
        {
            using var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(
                [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG signature + noise
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            content.Add(fileContent, "file", "security-avatar.png");

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/employees/{karimId}/photo") { Content = content };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var response = await client.SendAsync(request);
            response.EnsureSuccessStatusCode();
        }

        private static async Task<int> CreateAttachedSickRequestAsync(HttpClient client, string token, int karimId)
        {
            using var content = new MultipartFormDataContent();
            content.Add(new StringContent("sick-leave"), "type");
            content.Add(new StringContent(DateTime.UtcNow.ToString("yyyy-MM-dd")), "requestDate");
            content.Add(new StringContent("Security provisioning: flu"), "reason");
            var pdf = System.Text.Encoding.ASCII.GetBytes("%PDF-1.4 fake medical certificate");
            var fileContent = new ByteArrayContent(pdf);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            content.Add(fileContent, "attachment", "certificate.pdf");

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/employees/{karimId}/requests") { Content = content };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var response = await client.SendAsync(request);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
            return json.GetProperty("id").GetInt32();
        }

        /// <summary>
        /// Documents must reference paths the real <see cref="IFileStorage"/> can open:
        /// both employees and hr documents are written through the service so the
        /// matrix's 200-download rows verify an actual storage read, not a 404 the
        /// seed's synthetic path would produce.
        /// </summary>
        private static async Task<int> CreateEmployeeSourceDocumentAsync(
            ReviveHrDbContext db, IFileStorage fileStorage, int employeeId)
        {
            await using var pdf = new MemoryStream([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // "%PDF-1.4"
            var stored = await fileStorage.SaveAsync("documents", "security-id-card.pdf", pdf);

            var document = new DomainLayer.Models.EmployeeModule.EmployeeDocument
            {
                EmployeeId = employeeId,
                Type = DomainLayer.Models.EmployeeModule.Enums.DocumentType.NationalId,
                FileName = "security-id-card.pdf",
                FilePath = stored.RelativePath,
                Source = DomainLayer.Models.EmployeeModule.Enums.DocumentSource.Employee,
                SizeBytes = stored.SizeBytes,
                ExpiryDate = null,
            };
            db.EmployeeDocuments.Add(document);
            await db.SaveChangesAsync();
            return document.Id;
        }

        private static async Task<int> CreateHrSourceDocumentAsync(
            ReviveHrDbContext db, IFileStorage fileStorage, int employeeId)
        {
            await using var pdf = new MemoryStream([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // "%PDF-1.4"
            var stored = await fileStorage.SaveAsync("hr-documents", "security-hr-contract.pdf", pdf);

            var document = new DomainLayer.Models.EmployeeModule.EmployeeDocument
            {
                EmployeeId = employeeId,
                Type = DomainLayer.Models.EmployeeModule.Enums.DocumentType.Contract,
                FileName = "security-hr-contract.pdf",
                FilePath = stored.RelativePath,
                Source = DomainLayer.Models.EmployeeModule.Enums.DocumentSource.Hr,
                SizeBytes = stored.SizeBytes,
                ExpiryDate = null,
            };
            db.EmployeeDocuments.Add(document);
            await db.SaveChangesAsync();
            return document.Id;
        }

        private static async Task<int> SeedEvaluationResponseAsync(
            ReviveHrDbContext db, int employeeId, int formId, int questionId, int evaluatorId)
        {
            var response = new EvaluationResponse
            {
                EvaluationFormId = formId,
                EmployeeId = employeeId,
                EvaluatedBy = evaluatorId,
                SubmittedAt = DateTime.UtcNow
            };
            db.EvaluationResponses.Add(response);
            await db.SaveChangesAsync();

            db.EvaluationAnswers.Add(new EvaluationAnswer
            {
                EvaluationResponseId = response.Id,
                EvaluationQuestionId = questionId,
                AnswerValueJson = System.Text.Json.JsonSerializer.Serialize(new { score = 4 })
            });
            await db.SaveChangesAsync();
            return response.Id;
        }

        private static async Task AssignGymRoleAsync(ReviveHrDbContext db, int userId, int gymId, string roleName)
        {
            var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == roleName)
                ?? throw new InvalidOperationException($"Role '{roleName}' is not seeded.");

            if (!await db.UserRoles.AnyAsync(
                    ur => ur.UserId == userId && ur.GymId == gymId && ur.RoleName == role.Name))
            {
                db.UserRoles.Add(new UserRole { UserId = userId, GymId = gymId, RoleName = role.Name });
            }

            if (!await db.UserGymAccesses.AnyAsync(a => a.UserId == userId && a.GymId == gymId))
            {
                db.UserGymAccesses.Add(new UserGymAccess { UserId = userId, GymId = gymId });
            }

            await db.SaveChangesAsync();
        }
    }
}
