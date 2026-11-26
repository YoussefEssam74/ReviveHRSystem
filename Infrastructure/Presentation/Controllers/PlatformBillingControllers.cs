using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Presentation.Controllers
{
    /// <summary>
    /// Subscription plan catalogue — the commercial tiers the platform sells. Every action is
    /// JWT-authenticated; the permission guards run inside <see cref="IPlanService"/>.
    /// </summary>
    [Route("api/platform/plans")]
    [Authorize]
    public class PlatformPlansController(IPlanService _service) : ApiControllerBase
    {
        /// <summary>GET — the plan catalogue with each plan's live company count and MRR (platform.plans.view).</summary>
        [HttpGet]
        public async Task<ActionResult<PlansListResponse>> GetPlans([FromQuery] PlanListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetPlansAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST — creates a plan (platform.plans.manage) → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<PlanListItem>> CreatePlan([FromBody] PlanUpsertRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreatePlanAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>GET /{id} — one plan (platform.plans.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<PlanListItem>> GetPlan(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetPlanAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// PUT /{id} — edits the catalogue. Existing companies keep the terms they were sold,
        /// so nothing is repriced mid-period (platform.plans.manage).
        /// </summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<PlanListItem>> UpdatePlan(int id, [FromBody] PlanUpsertRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.UpdatePlanAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /{id}/duplicate — copies features and add-ons under a new name → 201.</summary>
        [HttpPost("{id:int}/duplicate")]
        public async Task<ActionResult<PlanListItem>> DuplicatePlan(int id, [FromBody] DuplicatePlanRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.DuplicatePlanAsync(GetActorUserId(), id, request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>DELETE /{id} — archives the plan; refused while a live subscription uses it.</summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> ArchivePlan(int id, CancellationToken cancellationToken)
        {
            await _service.ArchivePlanAsync(GetActorUserId(), id, cancellationToken);
            return NoContent();
        }
    }

    /// <summary>
    /// The invoice ledger: issue, pay, chase, void and export. Recurring invoices are raised
    /// by the scheduled job; this surface covers manual issue and everything after it.
    /// </summary>
    [Route("api/platform/invoices")]
    [Authorize]
    public class PlatformInvoicesController(IInvoiceService _service) : ApiControllerBase
    {
        /// <summary>GET — paged ledger with a summary strip (platform.billing.view).</summary>
        [HttpGet]
        public async Task<ActionResult<InvoicesListResponse>> GetInvoices([FromQuery] InvoiceListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetInvoicesAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST — issues an invoice manually (platform.billing.manage) → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<InvoiceDetailResponse>> CreateInvoice([FromBody] CreateInvoiceRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateInvoiceAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>GET /export — the ledger as CSV (same filters as the list).</summary>
        [HttpGet("export")]
        public async Task<IActionResult> ExportInvoices([FromQuery] InvoiceListQuery query, CancellationToken cancellationToken)
        {
            var (fileName, content) = await _service.ExportInvoicesAsync(GetActorUserId(), query, cancellationToken);
            return File(content, "text/csv", fileName);
        }

        /// <summary>POST /reminders/bulk — chases every overdue invoice.</summary>
        [HttpPost("reminders/bulk")]
        public async Task<ActionResult<BulkReminderResponse>> SendBulkReminders(CancellationToken cancellationToken)
        {
            var result = await _service.SendBulkRemindersAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /{id} — invoice detail with its line items and payments (platform.billing.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<InvoiceDetailResponse>> GetInvoice(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetInvoiceAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /{id}/pdf — the invoice statement as a PDF stream.</summary>
        [HttpGet("{id:int}/pdf")]
        public async Task<IActionResult> GetInvoicePdf(int id, CancellationToken cancellationToken)
        {
            var (fileName, content) = await _service.GetInvoicePdfAsync(GetActorUserId(), id, cancellationToken);
            return File(content, "application/pdf", fileName);
        }

        /// <summary>POST /{id}/payments — records a full or partial payment (platform.billing.manage).</summary>
        [HttpPost("{id:int}/payments")]
        public async Task<ActionResult<RecordPaymentResponse>> RecordPayment(int id, [FromBody] RecordPaymentRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.RecordPaymentAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /{id}/reminders — chases one overdue invoice.</summary>
        [HttpPost("{id:int}/reminders")]
        public async Task<ActionResult<SendReminderResponse>> SendReminder(int id, [FromBody] SendReminderRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.SendReminderAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /{id}/void — voids an unpaid invoice; its number is not reused.</summary>
        [HttpPost("{id:int}/void")]
        public async Task<ActionResult<VoidInvoiceResponse>> VoidInvoice(int id, [FromBody] VoidInvoiceRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.VoidInvoiceAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }
    }

    /// <summary>
    /// Revenue analytics: four headline numbers plus a dedicated breakdown for each, and a
    /// CSV export per metric.
    /// </summary>
    [Route("api/platform/revenue")]
    [Authorize]
    public class PlatformRevenueController(IRevenueService _service) : ApiControllerBase
    {
        /// <summary>GET /periods — billing periods present in the ledger, newest first.</summary>
        [HttpGet("periods")]
        public async Task<ActionResult<RevenuePeriodsResponse>> GetPeriods(CancellationToken cancellationToken)
        {
            var result = await _service.GetPeriodsAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /summary — MRR, gross, collected and outstanding with period-on-period deltas.</summary>
        [HttpGet("summary")]
        public async Task<ActionResult<RevenueSummaryResponse>> GetSummary([FromQuery] RevenuePeriodQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetSummaryAsync(GetActorUserId(), query.Period, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /trend — monthly billed revenue for the trend line (1–24 months).</summary>
        [HttpGet("trend")]
        public async Task<ActionResult<RevenueTrendResponse>> GetTrend([FromQuery] int months, CancellationToken cancellationToken)
        {
            var result = await _service.GetTrendAsync(GetActorUserId(), months <= 0 ? 12 : months, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /per-company — revenue per gym account for the period.</summary>
        [HttpGet("per-company")]
        public async Task<ActionResult<RevenuePerCompanyResponse>> GetPerCompany([FromQuery] RevenuePeriodQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetPerCompanyAsync(GetActorUserId(), query.Period, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /mrr-breakdown — what the recurring revenue is made of, by plan and by company.</summary>
        [HttpGet("mrr-breakdown")]
        public async Task<ActionResult<MrrBreakdownResponse>> GetMrrBreakdown([FromQuery] RevenuePeriodQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetMrrBreakdownAsync(GetActorUserId(), query.Period, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /gross-breakdown — billed per month and per plan, with the month-on-month move.</summary>
        [HttpGet("gross-breakdown")]
        public async Task<ActionResult<GrossBreakdownResponse>> GetGrossBreakdown([FromQuery] RevenuePeriodQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetGrossBreakdownAsync(GetActorUserId(), query.Period, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /collections — the cash that arrived, with average time to pay.</summary>
        [HttpGet("collections")]
        public async Task<ActionResult<CollectionsResponse>> GetCollections([FromQuery] RevenuePeriodQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetCollectionsAsync(GetActorUserId(), query.Period, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /outstanding — unpaid money aged into current / 1–30 / 30+ buckets.</summary>
        [HttpGet("outstanding")]
        public async Task<ActionResult<OutstandingResponse>> GetOutstanding([FromQuery] RevenuePeriodQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetOutstandingAsync(GetActorUserId(), query.Period, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /export — one metric's breakdown as CSV.</summary>
        [HttpGet("export")]
        public async Task<IActionResult> Export([FromQuery] RevenueExportQuery query, CancellationToken cancellationToken)
        {
            var (fileName, content) = await _service.ExportAsync(GetActorUserId(), query, cancellationToken);
            return File(content, "text/csv", fileName);
        }
    }
}
