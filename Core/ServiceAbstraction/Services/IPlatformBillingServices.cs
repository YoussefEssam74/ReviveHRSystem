using Shared.DataTransferObject.Platform;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// The subscription plan catalogue the Super Admin sells from. Plans are matched by
    /// slug for uniqueness, and only one may be flagged as highlighted at a time.
    /// </summary>
    public interface IPlanService
    {
        Task<PlansListResponse> GetPlansAsync(int? actorUserId, PlanListQuery query, CancellationToken cancellationToken = default);

        Task<PlanListItem> GetPlanAsync(int? actorUserId, int planId, CancellationToken cancellationToken = default);

        Task<PlanListItem> CreatePlanAsync(int? actorUserId, PlanUpsertRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Applies the change to the catalogue only. Existing companies keep the terms they
        /// were sold (their subscription snapshots the price), so nothing is repriced
        /// mid-period.
        /// </summary>
        Task<PlanListItem> UpdatePlanAsync(int? actorUserId, int planId, PlanUpsertRequest request, CancellationToken cancellationToken = default);

        Task<PlanListItem> DuplicatePlanAsync(int? actorUserId, int planId, DuplicatePlanRequest request, CancellationToken cancellationToken = default);

        /// <summary>Archives the plan; refused while a live subscription still references it.</summary>
        Task ArchivePlanAsync(int? actorUserId, int planId, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// The invoice ledger: issuing, recording payments, reminders, voiding and the two
    /// document exports. Invoice numbers follow INV-{yyyy}-{seq:D4} and are never reused.
    /// </summary>
    public interface IInvoiceService
    {
        Task<InvoicesListResponse> GetInvoicesAsync(int? actorUserId, InvoiceListQuery query, CancellationToken cancellationToken = default);

        Task<InvoiceDetailResponse> GetInvoiceAsync(int? actorUserId, int invoiceId, CancellationToken cancellationToken = default);

        Task<InvoiceDetailResponse> CreateInvoiceAsync(int? actorUserId, CreateInvoiceRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Records a (possibly partial) payment. A fully settled invoice flips to Paid and,
        /// when it was the company's last overdue invoice, restores the account and lifts
        /// the payroll block.
        /// </summary>
        Task<RecordPaymentResponse> RecordPaymentAsync(int? actorUserId, int invoiceId, RecordPaymentRequest request, CancellationToken cancellationToken = default);

        Task<SendReminderResponse> SendReminderAsync(int? actorUserId, int invoiceId, SendReminderRequest request, CancellationToken cancellationToken = default);

        Task<BulkReminderResponse> SendBulkRemindersAsync(int? actorUserId, CancellationToken cancellationToken = default);

        Task<VoidInvoiceResponse> VoidInvoiceAsync(int? actorUserId, int invoiceId, VoidInvoiceRequest request, CancellationToken cancellationToken = default);

        Task<(string FileName, byte[] Content)> GetInvoicePdfAsync(int? actorUserId, int invoiceId, CancellationToken cancellationToken = default);

        Task<(string FileName, byte[] Content)> ExportInvoicesAsync(int? actorUserId, InvoiceListQuery query, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Revenue analytics. Every method resolves a reporting period ("Nov 2026"), defaulting
    /// to the newest period on record, and compares against the one before it.
    /// </summary>
    public interface IRevenueService
    {
        Task<RevenuePeriodsResponse> GetPeriodsAsync(int? actorUserId, CancellationToken cancellationToken = default);

        Task<RevenueSummaryResponse> GetSummaryAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default);

        Task<RevenueTrendResponse> GetTrendAsync(int? actorUserId, int months, CancellationToken cancellationToken = default);

        Task<RevenuePerCompanyResponse> GetPerCompanyAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default);

        Task<MrrBreakdownResponse> GetMrrBreakdownAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default);

        Task<GrossBreakdownResponse> GetGrossBreakdownAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default);

        Task<CollectionsResponse> GetCollectionsAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default);

        Task<OutstandingResponse> GetOutstandingAsync(int? actorUserId, string? period, CancellationToken cancellationToken = default);

        Task<(string FileName, byte[] Content)> ExportAsync(int? actorUserId, RevenueExportQuery query, CancellationToken cancellationToken = default);
    }
}
