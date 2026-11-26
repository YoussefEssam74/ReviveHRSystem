using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule.Enums;

namespace DomainLayer.Contracts
{
    // ------------------------------------------------------------------
    // Projections returned by the platform read repository.
    // ------------------------------------------------------------------

    /// <summary>Platform-wide user totals, split the way the console's KPI strip renders them.</summary>
    public class PlatformUserTotals
    {
        public int Total { get; set; }

        /// <summary>Users that carry at least one UserGymAccess row.</summary>
        public int GymMembers { get; set; }

        /// <summary>Users with no gym assignment (Top Management, HR Manager).</summary>
        public int PlatformUsers { get; set; }

        public int HrManagers { get; set; }
        public int Hr { get; set; }
        public int BranchManagers { get; set; }
        public int TeamLeaders { get; set; }
        public int Employees { get; set; }
        public int Active { get; set; }
        public int Suspended { get; set; }
        public int AddedThisMonth { get; set; }
    }

    /// <summary>Company status distribution for the dashboard's company tile.</summary>
    public class CompanyStatusTotals
    {
        public int Total { get; set; }
        public int Active { get; set; }
        public int Trial { get; set; }
        public int PaymentOverdue { get; set; }
        public int Suspended { get; set; }
        public int Closed { get; set; }
    }

    /// <summary>Invoice aggregates for one billing period.</summary>
    public class InvoicePeriodTotals
    {
        public decimal Billed { get; set; }
        public decimal Collected { get; set; }
        public decimal Outstanding { get; set; }
        public decimal Overdue { get; set; }
        public int InvoiceCount { get; set; }
        public int PaidCount { get; set; }
        public int OverdueCount { get; set; }
    }

    /// <summary>Seat consumption restricted to capped plans.</summary>
    public class SeatUsageTotals
    {
        public int Used { get; set; }
        public int Capacity { get; set; }
    }

    /// <summary>One company's user count and seat cap, for the account table's usage meter.</summary>
    public class CompanySeatRow
    {
        public int CompanyId { get; set; }
        public int Users { get; set; }
        public int? SeatLimit { get; set; }
    }

    /// <summary>A monthly bucket of the user-growth trend.</summary>
    public class UserGrowthBucket
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public int Users { get; set; }
    }

    /// <summary>Invoice row that is overdue, for the attention queue.</summary>
    public class OverdueInvoiceRow
    {
        public int InvoiceId { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime DueOn { get; set; }
        public int DaysOverdue { get; set; }
    }

    /// <summary>Company whose trial is close to ending, for the attention queue.</summary>
    public class TrialEndingRow
    {
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public string PlanName { get; set; } = string.Empty;
        public DateTime TrialEndsOn { get; set; }
        public int DaysRemaining { get; set; }
        public int Users { get; set; }
        public int? SeatLimit { get; set; }
    }

    /// <summary>Company approaching or past its seat quota, for the attention queue.</summary>
    public class SeatPressureRow
    {
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public int Users { get; set; }
        public int SeatLimit { get; set; }
        public int UsagePercent { get; set; }
    }

    /// <summary>Accounts that failed to sign in repeatedly inside one window, for the attention queue.</summary>
    public class FailedSignInRow
    {
        public int UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public int Attempts { get; set; }
        public DateTime LastAttemptAt { get; set; }
        public string? IpAddress { get; set; }
    }

    /// <summary>
    /// Flat invoice projection used by the ledger and every revenue breakdown. One query
    /// feeds the whole analysis page, so the period maths stays in the service where it can
    /// be unit-reasoned about instead of spread across a dozen database round trips.
    /// </summary>
    public class InvoiceSnapshotRow
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public string? CompanyCity { get; set; }
        public string? CompanyContactEmail { get; set; }
        public int? PlanId { get; set; }
        public string? PlanName { get; set; }
        public decimal Amount { get; set; }
        public decimal AmountPaid { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Currency { get; set; } = "EGP";
        public string PeriodLabel { get; set; } = string.Empty;
        public DateTime PeriodStart { get; set; }
        public DateTime PeriodEnd { get; set; }
        public DateTime IssuedOn { get; set; }
        public DateTime DueOn { get; set; }
        public DateTime? PaidOn { get; set; }
        public int? SubscriptionId { get; set; }
    }

    /// <summary>One plan's commercial footprint, computed from live subscriptions.</summary>
    public class PlanFootprintRow
    {
        public int PlanId { get; set; }
        public int Companies { get; set; }
        public decimal Mrr { get; set; }
    }

    /// <summary>
    /// Read model over the platform's cross-entity aggregates.
    ///
    /// The generic repository (IGenaricRepository) is specification-driven and cannot
    /// express GROUP BY / SUM / DISTINCT projections, which is exactly what the console's
    /// KPI strip, account table and attention queue are built from. Like
    /// <see cref="IUserAccessRepository"/>, this is a purpose-built read contract rather
    /// than a leaky IQueryable escape hatch: every method returns a shaped projection and
    /// nothing here writes. Implemented in Infrastructure/Persistence.
    /// </summary>
    public interface IPlatformReadRepository
    {
        // ----- dashboard -----

        /// <summary>Company counts by lifecycle state.</summary>
        Task<CompanyStatusTotals> GetCompanyStatusTotalsAsync(CancellationToken cancellationToken = default);

        /// <summary>Platform-wide user totals and role/status breakdown.</summary>
        Task<PlatformUserTotals> GetUserTotalsAsync(CancellationToken cancellationToken = default);

        /// <summary>Invoice totals for the period containing <paramref name="monthStart"/>.</summary>
        Task<InvoicePeriodTotals> GetInvoiceTotalsAsync(DateTime monthStart, CancellationToken cancellationToken = default);

        /// <summary>Seat usage across companies on capped plans.</summary>
        Task<SeatUsageTotals> GetSeatUsageAsync(CancellationToken cancellationToken = default);

        /// <summary>Users created per month over the last <paramref name="months"/> months, oldest first.</summary>
        Task<IReadOnlyList<UserGrowthBucket>> GetUserGrowthAsync(int months, CancellationToken cancellationToken = default);

        // ----- companies -----

        /// <summary>Branch count per company id.</summary>
        Task<IReadOnlyDictionary<int, int>> GetBranchCountsAsync(CancellationToken cancellationToken = default);

        /// <summary>User count and seat cap per company, for the seat meter.</summary>
        Task<IReadOnlyList<CompanySeatRow>> GetCompanySeatRowsAsync(CancellationToken cancellationToken = default);

        /// <summary>Distinct users reachable in each company (via branch assignment or employment).</summary>
        Task<IReadOnlyDictionary<int, int>> GetUserCountsByCompanyAsync(CancellationToken cancellationToken = default);

        /// <summary>Role breakdown of one company: HR, Branch Manager, Team Leader, Employee.</summary>
        Task<PlatformUserTotals> GetCompanyRoleBreakdownAsync(int companyId, CancellationToken cancellationToken = default);

        /// <summary>Check-ins per day for the last <paramref name="days"/> days, oldest first.</summary>
        Task<IReadOnlyList<int>> GetAttendanceTrendAsync(int companyId, int days, CancellationToken cancellationToken = default);

        // ----- attention queue -----

        Task<IReadOnlyList<OverdueInvoiceRow>> GetOverdueInvoicesAsync(CancellationToken cancellationToken = default);

        Task<IReadOnlyList<TrialEndingRow>> GetTrialsEndingAsync(int withinDays, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<SeatPressureRow>> GetSeatPressureAsync(int thresholdPercent, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<FailedSignInRow>> GetFailedSignInBurstsAsync(int minimumAttempts, int withinMinutes, CancellationToken cancellationToken = default);

        // ----- lookups -----

        /// <summary>Company ids and names, keyed by id — used to label user rows.</summary>
        Task<IReadOnlyDictionary<int, string>> GetCompanyNamesAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Company ids each user can reach, keyed by user id. Platform-wide roles are
        /// mapped to every company id so the caller needs no special-casing.
        /// </summary>
        Task<IReadOnlyDictionary<int, IReadOnlyList<int>>> GetUserCompanyMapAsync(CancellationToken cancellationToken = default);

        /// <summary>Effective permission key count per user (direct ∪ role grants).</summary>
        Task<IReadOnlyDictionary<int, int>> GetUserPermissionCountsAsync(CancellationToken cancellationToken = default);

        /// <summary>Number of users holding each role id.</summary>
        Task<IReadOnlyDictionary<int, int>> GetRoleMemberCountsAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Each user's display role name — their per-gym role when they hold one, otherwise the
        /// label of their user type. UserRole is not a BaseEntity, so the audit trail's actor
        /// labels come from here rather than the generic repository.
        /// </summary>
        Task<IReadOnlyDictionary<int, string>> GetUserRoleLabelsAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Per-gym role ids held by each user inside one company, keyed by user id.
        /// UserRole is not a BaseEntity so it cannot go through the generic repository.
        /// </summary>
        Task<IReadOnlyDictionary<int, int>> GetUserRoleIdsInCompanyAsync(int companyId, CancellationToken cancellationToken = default);

        // ----- billing / revenue -----

        /// <summary>
        /// Every non-void invoice as a flat row (company + plan labels included), newest
        /// period first. Revenue analytics and the ledger filter this in memory.
        /// </summary>
        Task<IReadOnlyList<InvoiceSnapshotRow>> GetInvoiceSnapshotAsync(CancellationToken cancellationToken = default);

        /// <summary>Distinct billing periods present in the ledger, newest first ("Nov 2026").</summary>
        Task<IReadOnlyList<string>> GetInvoicePeriodsAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Monthly recurring revenue per plan across live, non-trial subscriptions,
        /// applying any price override and normalising the cadence to a month.
        /// </summary>
        Task<IReadOnlyList<PlanFootprintRow>> GetPlanFootprintsAsync(CancellationToken cancellationToken = default);
    }
}
