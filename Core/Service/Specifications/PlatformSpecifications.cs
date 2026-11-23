using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.BillingModule;
using DomainLayer.Models.BillingModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.PlatformModule;
using DomainLayer.Models.PlatformModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;

namespace Service.Specifications
{
    // ==================================================================
    // Platform console — company specs
    // ==================================================================

    /// <summary>
    /// Company list: the account table needs the active subscription and its plan on
    /// every row, so both are included. Sorting is applied in memory by the service
    /// because the sort key can be a computed value (seat usage, renewal countdown).
    /// </summary>
    public sealed class CompanyListSpec : BaseSpecification<Company, int>
    {
        public CompanyListSpec(string? search, string? status, int? planId)
        {
            var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

            var parsedStatus = status?.Trim().ToLowerInvariant() switch
            {
                null or "" or "all" => (CompanyStatus?)null,
                "trial" => CompanyStatus.Trial,
                "active" => CompanyStatus.Active,
                "paymentoverdue" => CompanyStatus.PaymentOverdue,
                "suspended" => CompanyStatus.Suspended,
                "closed" => CompanyStatus.Closed,
                _ => throw new BadRequestException($"Unknown company status '{status}'."),
            };

            Criteria = c =>
                (term == null
                    || c.Name.ToLower().Contains(term)
                    || c.Code.ToLower().Contains(term)
                    || (c.City != null && c.City.ToLower().Contains(term)))
                && (parsedStatus == null || c.Status == parsedStatus)
                && (planId == null
                    || c.Subscriptions.Any(s => s.Status != SubscriptionStatus.Cancelled && s.PlanId == planId));

            AddInclude(c => c.Subscriptions);
            AddIncludePath("Subscriptions.Plan");
            ApplyNoTracking();
            OrderBy = c => c.Name;
        }
    }

    /// <summary>Single company with its live subscription (plan included) and its branches.</summary>
    public sealed class CompanyByIdSpec : BaseSpecification<Company, int>
    {
        public CompanyByIdSpec(int companyId)
        {
            Criteria = c => c.Id == companyId;
            AddInclude(c => c.Branches);
            AddIncludePath("Subscriptions.Plan");
            ApplyNoTracking();
        }
    }

    /// <summary>Company by code — used to validate uniqueness on create.</summary>
    public sealed class CompanyByCodeSpec : BaseSpecification<Company, int>
    {
        public CompanyByCodeSpec(string code)
        {
            var normalized = code.Trim().ToLower();
            Criteria = c => c.Code.ToLower() == normalized;
            ApplyNoTracking();
        }
    }

    /// <summary>All companies with subscription + plan; feeds the search index and dropdowns.</summary>
    public sealed class AllCompaniesSpec : BaseSpecification<Company, int>
    {
        public AllCompaniesSpec()
        {
            AddIncludePath("Subscriptions.Plan");
            ApplyNoTracking();
            OrderBy = c => c.Name;
        }
    }

    // ==================================================================
    // Platform console — branch specs
    // ==================================================================

    /// <summary>Every branch of one company, ordered by name.</summary>
    public sealed class BranchesByCompanySpec : BaseSpecification<Gym, int>
    {
        public BranchesByCompanySpec(int companyId)
        {
            Criteria = g => g.CompanyId == companyId;
            ApplyNoTracking();
            OrderBy = g => g.Name;
        }
    }

    /// <summary>One branch, verified to belong to the given company (guards cross-company ids).</summary>
    public sealed class BranchInCompanySpec : BaseSpecification<Gym, int>
    {
        public BranchInCompanySpec(int companyId, int branchId)
        {
            Criteria = g => g.Id == branchId && g.CompanyId == companyId;
            ApplyNoTracking();
        }
    }

    /// <summary>Highest existing branch id within a company — the next code suffix.</summary>
    public sealed class BranchCountInCompanySpec : BaseSpecification<Gym, int>
    {
        public BranchCountInCompanySpec(int companyId)
        {
            Criteria = g => g.CompanyId == companyId;
            ApplyNoTracking();
        }
    }

    // ==================================================================
    // Platform console — subscription specs
    // ==================================================================

    /// <summary>The company's single live agreement, with its plan.</summary>
    public sealed class ActiveSubscriptionByCompanySpec : BaseSpecification<CompanySubscription, int>
    {
        public ActiveSubscriptionByCompanySpec(int companyId)
        {
            Criteria = s => s.CompanyId == companyId && s.Status != SubscriptionStatus.Cancelled;
            AddInclude(s => s.Plan);
            ApplyNoTracking();
        }
    }

    // ==================================================================
    // Platform console — user specs
    // ==================================================================

    /// <summary>
    /// Platform user directory. <paramref name="companyIds"/> scopes the result to the
    /// branches the caller may see; null means platform-wide (Top Management / HR Manager).
    /// </summary>
    public sealed class PlatformUserListSpec : BaseSpecification<User, int>
    {
        public PlatformUserListSpec(
            string? search,
            string? userType,
            string? status,
            IReadOnlyCollection<int>? companyIds,
            int skip,
            int take)
        {
            var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

            UserType? parsedType = userType?.Trim().ToLowerInvariant() switch
            {
                null or "" or "all" => null,
                "superadmin" or "topmanagement" => UserType.TopManagement,
                "hrmanager" => UserType.HRManager,
                "hr" => UserType.HR,
                "employee" or "branchmanager" or "teamleader" => UserType.Employee,
                _ => throw new BadRequestException($"Unknown user role '{userType}'."),
            };

            // "Active" / "Suspended" mirror the console badge; invited/locked accounts are
            // still IsActive = false in the identity table.
            var activeFilter = status?.Trim().ToLowerInvariant() switch
            {
                null or "" or "all" => (bool?)null,
                "active" => true,
                "suspended" or "inactive" => false,
                _ => null,
            };

            var companyIdList = companyIds?.ToList();

            // Platform owners are not manageable accounts: the directory lists what the
            // console administers, so the Super Admin never sees their own row here.
            Criteria = u =>
                u.UserType != UserType.TopManagement
                && (term == null || u.UserName.ToLower().Contains(term) || u.Email.ToLower().Contains(term))
                && (parsedType == null || u.UserType == parsedType)
                && (activeFilter == null || u.IsActive == activeFilter)
                && (companyIdList == null
                    || u.UserType == UserType.HRManager
                    || u.UserGymAccesses.Any(a => companyIdList.Contains(a.Gym.CompanyId))
                    || (u.EmployeeProfile != null && companyIdList.Contains(u.EmployeeProfile.Gym.CompanyId)));

            AddInclude(u => u.UserRoles);
            AddInclude(u => u.UserGymAccesses);
            AddIncludePath("UserGymAccesses.Gym");
            ApplyNoTracking();
            OrderBy = u => u.UserName;
            ApplyPaging(skip, take);
        }
    }

    /// <summary>Count companion for <see cref="PlatformUserListSpec"/> (same filters, no paging).</summary>
    public sealed class PlatformUserCountSpec : BaseSpecification<User, int>
    {
        public PlatformUserCountSpec(string? search, string? userType, string? status, IReadOnlyCollection<int>? companyIds)
        {
            var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

            UserType? parsedType = userType?.Trim().ToLowerInvariant() switch
            {
                null or "" or "all" => null,
                "superadmin" or "topmanagement" => UserType.TopManagement,
                "hrmanager" => UserType.HRManager,
                "hr" => UserType.HR,
                "employee" or "branchmanager" or "teamleader" => UserType.Employee,
                _ => throw new BadRequestException($"Unknown user role '{userType}'."),
            };

            var activeFilter = status?.Trim().ToLowerInvariant() switch
            {
                null or "" or "all" => (bool?)null,
                "active" => true,
                "suspended" or "inactive" => false,
                _ => null,
            };

            var companyIdList = companyIds?.ToList();

            Criteria = u =>
                u.UserType != UserType.TopManagement
                && (term == null || u.UserName.ToLower().Contains(term) || u.Email.ToLower().Contains(term))
                && (parsedType == null || u.UserType == parsedType)
                && (activeFilter == null || u.IsActive == activeFilter)
                && (companyIdList == null
                    || u.UserType == UserType.HRManager
                    || u.UserGymAccesses.Any(a => companyIdList.Contains(a.Gym.CompanyId))
                    || (u.EmployeeProfile != null && companyIdList.Contains(u.EmployeeProfile.Gym.CompanyId)));

            ApplyNoTracking();
        }
    }

    /// <summary>One user with the identity graph the profile screen renders.</summary>
    public sealed class PlatformUserByIdSpec : BaseSpecification<User, int>
    {
        public PlatformUserByIdSpec(int userId)
        {
            Criteria = u => u.Id == userId;
            AddInclude(u => u.UserRoles);
            AddInclude(u => u.UserGymAccesses);
            AddIncludePath("UserGymAccesses.Gym");
            ApplyNoTracking();
        }
    }

    /// <summary>Users inside one company (via grant or employment) for the Employees tab.</summary>
    public sealed class CompanyUsersSpec : BaseSpecification<User, int>
    {
        public CompanyUsersSpec(int companyId)
        {
            Criteria = u =>
                u.UserGymAccesses.Any(a => a.Gym.CompanyId == companyId)
                || (u.EmployeeProfile != null && u.EmployeeProfile.Gym.CompanyId == companyId);

            AddInclude(u => u.UserRoles);
            AddInclude(u => u.UserGymAccesses);
            AddIncludePath("UserGymAccesses.Gym");
            ApplyNoTracking();
            OrderBy = u => u.UserName;
        }
    }

    /// <summary>HR users granted a specific company — the HR staff tab.</summary>
    public sealed class CompanyHrStaffSpec : BaseSpecification<User, int>
    {
        public CompanyHrStaffSpec(int companyId)
        {
            Criteria = u => u.UserType == UserType.HR
                            && u.UserGymAccesses.Any(a => a.Gym.CompanyId == companyId);
            AddInclude(u => u.UserGymAccesses);
            AddIncludePath("UserGymAccesses.Gym");
            ApplyNoTracking();
            OrderBy = u => u.UserName;
        }
    }

    /// <summary>Every HR account on the platform — the candidate list when assigning staff.</summary>
    public sealed class AllHrUsersSpec : BaseSpecification<User, int>
    {
        public AllHrUsersSpec()
        {
            Criteria = u => u.UserType == UserType.HR;
            AddInclude(u => u.UserGymAccesses);
            AddIncludePath("UserGymAccesses.Gym");
            ApplyNoTracking();
            OrderBy = u => u.UserName;
        }
    }

    /// <summary>Platform-wide accounts (Top Management + HR Manager) — no company binding.</summary>
    public sealed class PlatformWideUsersSpec : BaseSpecification<User, int>
    {
        public PlatformWideUsersSpec()
        {
            Criteria = u => u.UserType == UserType.TopManagement || u.UserType == UserType.HRManager;
            AddInclude(u => u.UserRoles);
            ApplyNoTracking();
            OrderBy = u => u.UserName;
        }
    }

    // ==================================================================
    // Platform console — company tab specs
    // ==================================================================

    /// <summary>Newest payroll run across every branch of one company.</summary>
    public sealed class LatestPayrollPeriodForCompanySpec : BaseSpecification<DomainLayer.Models.PayrollModule.PayrollPeriod, int>
    {
        public LatestPayrollPeriodForCompanySpec(int companyId)
        {
            Criteria = p => p.Gym.CompanyId == companyId;
            ApplyNoTracking();
            OrderByDescending = p => p.StartDate;
            ApplyPaging(0, 1);
        }
    }

    /// <summary>Invoices of one company, newest period first (Billing tab).</summary>
    public sealed class InvoicesByCompanySpec : BaseSpecification<Invoice, int>
    {
        public InvoicesByCompanySpec(int companyId)
        {
            Criteria = i => i.CompanyId == companyId && i.Status != InvoiceStatus.Void;
            ApplyNoTracking();
            OrderByDescending = i => i.IssuedOn;
        }
    }

    /// <summary>Audit rows of one company, newest first (Audit tab).</summary>
    public sealed class AuditByCompanySpec : BaseSpecification<DomainLayer.Models.AuditModule.AuditLog, int>
    {
        public AuditByCompanySpec(int companyId)
        {
            Criteria = a => a.CompanyId == companyId;
            ApplyNoTracking();
            OrderByDescending = a => a.Timestamp;
        }
    }

    /// <summary>Audit rows whose CompanyId is null (platform-wide actions).</summary>
    public sealed class PlatformOnlyAuditSpec : BaseSpecification<DomainLayer.Models.AuditModule.AuditLog, int>
    {
        public PlatformOnlyAuditSpec()
        {
            Criteria = a => a.CompanyId == null;
            ApplyNoTracking();
            OrderByDescending = a => a.Timestamp;
        }
    }

    /// <summary>Single audit row by id, with nothing else loaded (detail dialog).</summary>
    public sealed class AuditLogByIdSpec : BaseSpecification<DomainLayer.Models.AuditModule.AuditLog, int>
    {
        public AuditLogByIdSpec(int id)
        {
            Criteria = a => a.Id == id;
            ApplyNoTracking();
        }
    }

    /// <summary>Plan by id with its feature and add-on lists (billing tab card).</summary>
    public sealed class PlanDetailSpec : BaseSpecification<SubscriptionPlan, int>
    {
        public PlanDetailSpec(int planId)
        {
            Criteria = p => p.Id == planId;
            AddInclude(p => p.Features);
            AddInclude(p => p.AddOns);
            ApplyNoTracking();
        }
    }

    /// <summary>Every branch of the company, with trackable state (used by create/update/archive).</summary>
    public sealed class BranchesByCompanyTrackedSpec : BaseSpecification<Gym, int>
    {
        public BranchesByCompanyTrackedSpec(int companyId)
        {
            Criteria = g => g.CompanyId == companyId;
            ApplyTracking();
            OrderBy = g => g.Name;
        }
    }

    /// <summary>One branch with tracking, so updates persist through the repository.</summary>
    public sealed class BranchByIdTrackedSpec : BaseSpecification<Gym, int>
    {
        public BranchByIdTrackedSpec(int branchId)
        {
            Criteria = g => g.Id == branchId;
            ApplyTracking();
        }
    }

    /// <summary>Users holding a given role platform-wide, with tracking (role re-assignment flows).</summary>
    public sealed class UsersWithRoleSpec : BaseSpecification<User, int>
    {
        public UsersWithRoleSpec(string roleName)
        {
            Criteria = u => u.UserRoles.Any(ur => ur.GymId == null && ur.RoleName == roleName);
            AddInclude(u => u.UserRoles);
            ApplyNoTracking();
        }
    }

    /// <summary>Companies under a set of ids — labels for user rows in one round trip.</summary>
    public sealed class CompaniesByIdsSpec : BaseSpecification<Company, int>
    {
        public CompaniesByIdsSpec(IReadOnlyCollection<int> ids)
        {
            var list = ids.ToList();
            Criteria = c => list.Contains(c.Id);
            ApplyNoTracking();
            OrderBy = c => c.Name;
        }
    }

    /// <summary>Employee records belonging to one branch (used to guard branch archival).</summary>
    public sealed class EmployeesInBranchSpec : BaseSpecification<DomainLayer.Models.EmployeeModule.Employee, int>
    {
        public EmployeesInBranchSpec(int branchId)
        {
            Criteria = e => e.GymId == branchId;
            ApplyNoTracking();
        }
    }

    // ==================================================================
    // Platform console — plan specs
    // ==================================================================

    /// <summary>Every plan with its features and add-ons, ordered for the catalogue rail.</summary>
    public sealed class AllPlansSpec : BaseSpecification<SubscriptionPlan, int>
    {
        public AllPlansSpec(bool includeArchived)
        {
            Criteria = p => includeArchived || !p.IsArchived;
            AddInclude(p => p.Features);
            AddInclude(p => p.AddOns);
            ApplyNoTracking();
            OrderBy = p => p.SortOrder;
        }
    }

    /// <summary>Case-insensitive plan name lookup — uniqueness checks.</summary>
    public sealed class PlanByNameSpec : BaseSpecification<SubscriptionPlan, int>
    {
        public PlanByNameSpec(string name)
        {
            var normalized = name.Trim().ToLower();
            Criteria = p => p.Name.ToLower() == normalized;
            ApplyNoTracking();
        }
    }

    /// <summary>The plans currently carrying the highlight flag, optionally excluding one.</summary>
    public sealed class HighlightedPlansSpec : BaseSpecification<SubscriptionPlan, int>
    {
        public HighlightedPlansSpec(int? exceptPlanId)
        {
            Criteria = p => p.IsHighlighted && (exceptPlanId == null || p.Id != exceptPlanId);
            ApplyTracking();
        }
    }

    /// <summary>Live (non-cancelled) subscriptions referencing a plan — guards archiving.</summary>
    public sealed class LiveSubscriptionsByPlanSpec : BaseSpecification<CompanySubscription, int>
    {
        public LiveSubscriptionsByPlanSpec(int planId)
        {
            Criteria = s => s.PlanId == planId && s.Status != SubscriptionStatus.Cancelled;
            ApplyNoTracking();
        }
    }

    /// <summary>Every subscription for one company with its plan, newest first.</summary>
    public sealed class SubscriptionsByCompanySpec : BaseSpecification<CompanySubscription, int>
    {
        public SubscriptionsByCompanySpec(int companyId)
        {
            Criteria = s => s.CompanyId == companyId;
            AddIncludePath("Plan");
            ApplyNoTracking();
            OrderByDescending = s => s.StartedOn;
        }
    }

    // ==================================================================
    // Platform console — invoice specs
    // ==================================================================

    /// <summary>One invoice with its company (labels for the detail view and reminders).</summary>
    public sealed class InvoiceByIdSpec : BaseSpecification<Invoice, int>
    {
        public InvoiceByIdSpec(int invoiceId)
        {
            Criteria = i => i.Id == invoiceId;
            AddInclude(i => i.Company);
            ApplyTracking();
        }
    }

    /// <summary>A subscription with its plan — used to describe the billed line.</summary>
    public sealed class SubscriptionWithPlanSpec : BaseSpecification<CompanySubscription, int>
    {
        public SubscriptionWithPlanSpec(int subscriptionId)
        {
            Criteria = s => s.Id == subscriptionId;
            AddInclude(s => s.Plan);
            ApplyNoTracking();
        }
    }

    /// <summary>Non-void invoices of a company whose period starts on the given day.</summary>
    public sealed class InvoiceForPeriodSpec : BaseSpecification<Invoice, int>
    {
        public InvoiceForPeriodSpec(int companyId, DateTime periodStart)
        {
            Criteria = i => i.CompanyId == companyId
                            && i.PeriodStart == periodStart
                            && i.Status != InvoiceStatus.Void;
            ApplyNoTracking();
        }
    }

    /// <summary>Invoices issued in one calendar year — the number-sequence window.</summary>
    public sealed class InvoicesByYearSpec : BaseSpecification<Invoice, int>
    {
        public InvoicesByYearSpec(int year)
        {
            var from = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var to = from.AddYears(1);
            Criteria = i => i.IssuedOn >= from && i.IssuedOn < to;
            ApplyNoTracking();
        }
    }

    /// <summary>Overdue invoices of one company (blocks the account while any remain).</summary>
    public sealed class OverdueInvoicesForCompanySpec : BaseSpecification<Invoice, int>
    {
        public OverdueInvoicesForCompanySpec(int companyId)
        {
            Criteria = i => i.CompanyId == companyId && i.Status == InvoiceStatus.Overdue;
            ApplyNoTracking();
        }
    }

    /// <summary>Every overdue invoice across the platform — the bulk-reminder target.</summary>
    public sealed class OverdueInvoicesSpec : BaseSpecification<Invoice, int>
    {
        public OverdueInvoicesSpec()
        {
            Criteria = i => i.Status == InvoiceStatus.Overdue;
            AddInclude(i => i.Company);
            ApplyTracking();
        }
    }

    /// <summary>Payments recorded against one invoice, oldest first.</summary>
    public sealed class PaymentsByInvoiceSpec : BaseSpecification<InvoicePayment, int>
    {
        public PaymentsByInvoiceSpec(int invoiceId)
        {
            Criteria = p => p.InvoiceId == invoiceId;
            ApplyNoTracking();
            OrderBy = p => p.PaidOn;
        }
    }

    // ==================================================================
    // Platform console — governance specs
    // ==================================================================

    /// <summary>Every audit row, newest first — the platform trail's source set.</summary>
    public sealed class AllAuditLogsSpec : BaseSpecification<DomainLayer.Models.AuditModule.AuditLog, int>
    {
        public AllAuditLogsSpec()
        {
            ApplyNoTracking();
            OrderByDescending = a => a.Timestamp;
        }
    }

    /// <summary>One audit row with tracking, so the review stamp can be persisted.</summary>
    public sealed class AuditLogTrackedByIdSpec : BaseSpecification<DomainLayer.Models.AuditModule.AuditLog, int>
    {
        public AuditLogTrackedByIdSpec(int auditId)
        {
            Criteria = a => a.Id == auditId;
            ApplyTracking();
        }
    }

    /// <summary>Every act-as session, newest first, with its actor and company.</summary>
    public sealed class ImpersonationSessionsSpec : BaseSpecification<ImpersonationSession, int>
    {
        public ImpersonationSessionsSpec()
        {
            AddInclude(s => s.ActorUser);
            AddInclude(s => s.Company);
            AddIncludePath("EffectiveRole");
            ApplyNoTracking();
            OrderByDescending = s => s.StartedAt;
        }
    }

    /// <summary>The caller's open act-as sessions (at most one, but the query is explicit).</summary>
    public sealed class OpenImpersonationSessionsForActorSpec : BaseSpecification<ImpersonationSession, int>
    {
        public OpenImpersonationSessionsForActorSpec(int actorUserId)
        {
            Criteria = s => s.ActorUserId == actorUserId && s.EndedAt == null;
            AddInclude(s => s.Company);
            AddIncludePath("EffectiveRole");
            ApplyTracking();
        }
    }

    /// <summary>One act-as session by id.</summary>
    public sealed class ImpersonationSessionByIdSpec : BaseSpecification<ImpersonationSession, int>
    {
        public ImpersonationSessionByIdSpec(int sessionId)
        {
            Criteria = s => s.Id == sessionId;
            AddInclude(s => s.Company);
            AddInclude(s => s.ActorUser);
            AddIncludePath("EffectiveRole");
            ApplyTracking();
        }
    }

    /// <summary>Every feature flag with its targets.</summary>
    public sealed class AllFeatureFlagsSpec : BaseSpecification<FeatureFlag, int>
    {
        public AllFeatureFlagsSpec()
        {
            AddInclude(f => f.Targets);
            ApplyNoTracking();
            OrderBy = f => f.Key;
        }
    }

    /// <summary>One feature flag with its targets, tracked for update/delete.</summary>
    public sealed class FeatureFlagTrackedByIdSpec : BaseSpecification<FeatureFlag, int>
    {
        public FeatureFlagTrackedByIdSpec(int flagId)
        {
            Criteria = f => f.Id == flagId;
            AddInclude(f => f.Targets);
            ApplyTracking();
        }
    }

    /// <summary>Feature flag by key — uniqueness check on create.</summary>
    public sealed class FeatureFlagByKeySpec : BaseSpecification<FeatureFlag, int>
    {
        public FeatureFlagByKeySpec(string key)
        {
            var normalized = key.Trim().ToLowerInvariant();
            Criteria = f => f.Key == normalized;
            ApplyNoTracking();
        }
    }

    /// <summary>Export package by its public identifier.</summary>
    public sealed class AuditExportByPublicIdSpec : BaseSpecification<AuditExportPackage, int>
    {
        public AuditExportByPublicIdSpec(string exportId)
        {
            var normalized = exportId.Trim();
            Criteria = p => p.ExportId == normalized;
            ApplyNoTracking();
        }
    }

    /// <summary>Export packages issued in one calendar year — the number sequence window.</summary>
    public sealed class AuditExportsByYearSpec : BaseSpecification<AuditExportPackage, int>
    {
        public AuditExportsByYearSpec(int year)
        {
            var prefix = $"EXP-{year}-";
            Criteria = p => p.ExportId.StartsWith(prefix);
            ApplyNoTracking();
        }
    }

    /// <summary>Export packages past their expiry — the cleanup target.</summary>
    public sealed class ExpiredAuditExportsSpec : BaseSpecification<AuditExportPackage, int>
    {
        public ExpiredAuditExportsSpec(DateTime now)
        {
            Criteria = p => p.ExpiresAt < now;
            ApplyTracking();
        }
    }

    /// <summary>Every platform setting row, read-only.</summary>
    public sealed class AllPlatformSettingsSpec : BaseSpecification<PlatformSetting, int>
    {
        public AllPlatformSettingsSpec()
        {
            ApplyNoTracking();
        }
    }

    /// <summary>Every platform setting row with tracking, so upserts persist.</summary>
    public sealed class AllPlatformSettingsTrackedSpec : BaseSpecification<PlatformSetting, int>
    {
        public AllPlatformSettingsTrackedSpec()
        {
            ApplyTracking();
        }
    }

    /// <summary>Live (non-cancelled) subscriptions — used to resolve a caller's plan for flags.</summary>
    public sealed class LiveSubscriptionsSpec : BaseSpecification<CompanySubscription, int>
    {
        public LiveSubscriptionsSpec()
        {
            Criteria = s => s.Status != SubscriptionStatus.Cancelled;
            ApplyNoTracking();
        }
    }
}
