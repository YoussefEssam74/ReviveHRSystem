using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Payroll;

namespace Presentation.Controllers
{
    /// <summary>
    /// Payroll page (api-spec-from-ui.md §5.5): period directory + detail with entry
    /// sheets, the settlement actions (bonus, add line, close/reopen), publish &amp; lock,
    /// payslips and the CSV export. Periods are per-gym rows (ADR-003).
    /// </summary>
    [Route("api/payroll-periods")]
    [Authorize]
    public class PayrollPeriodsController(IPayrollService _service) : ApiControllerBase
    {
        /// <summary>GET /api/payroll-periods — period directory with totals (payroll.view).</summary>
        [HttpGet]
        public async Task<ActionResult<PayrollPeriodListResponse>> GetPeriods([FromQuery] PayrollPeriodListQuery query, CancellationToken ct)
            => Ok(await _service.GetPeriodsAsync(GetActorUserId(), query, ct));

        /// <summary>GET /api/payroll-periods/{id} — one period with its entry sheets (payroll.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<PayrollPeriodDetailResponse>> GetPeriod(int id, [FromQuery] int? gym, CancellationToken ct)
            => Ok(await _service.GetPeriodAsync(GetActorUserId(), id, gym, ct));

        /// <summary>PUT /api/payroll-periods/{periodId}/entries/{employeeId} — set the bonus (payroll.edit).</summary>
        [HttpPut("{periodId:int}/entries/{employeeId:int}")]
        public async Task<ActionResult<EntryTotalsResponse>> UpdateBonus(int periodId, int employeeId, [FromBody] UpdateBonusRequest request, CancellationToken ct)
            => Ok(await _service.UpdateBonusAsync(GetActorUserId(), periodId, employeeId, request, ct));

        /// <summary>POST /api/payroll-periods/{periodId}/entries/{employeeId}/deductions — inline Add-Line form (payroll.edit) → 201.</summary>
        [HttpPost("{periodId:int}/entries/{employeeId:int}/deductions")]
        public async Task<ActionResult<CreateDeductionResponse>> AddDeduction(int periodId, int employeeId, [FromBody] CreateDeductionRequest request, CancellationToken ct)
        {
            var response = await _service.AddDeductionAsync(GetActorUserId(), periodId, employeeId, request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>POST /api/payroll-periods/{periodId}/entries/{employeeId}/close — settle &amp; close the sheet (payroll.edit).</summary>
        [HttpPost("{periodId:int}/entries/{employeeId:int}/close")]
        public async Task<ActionResult<CloseEntryResponse>> CloseEntry(int periodId, int employeeId, CancellationToken ct)
            => Ok(await _service.CloseEntryAsync(GetActorUserId(), periodId, employeeId, ct));

        /// <summary>POST /api/payroll-periods/{periodId}/entries/{employeeId}/reopen — back to Draft (payroll.edit).</summary>
        [HttpPost("{periodId:int}/entries/{employeeId:int}/reopen")]
        public async Task<ActionResult<ReopenEntryResponse>> ReopenEntry(int periodId, int employeeId, CancellationToken ct)
            => Ok(await _service.ReopenEntryAsync(GetActorUserId(), periodId, employeeId, ct));

        /// <summary>POST /api/payroll-periods/{id}/approve — publish &amp; lock the branch (payroll.approve).</summary>
        [HttpPost("{id:int}/approve")]
        public async Task<ActionResult<ApprovePeriodResponse>> ApprovePeriod(int id, [FromBody] ApprovePeriodRequest request, CancellationToken ct)
            => Ok(await _service.ApprovePeriodAsync(GetActorUserId(), id, request, ct));

        /// <summary>GET /api/payroll-periods/{id}/payslips/{employeeId} — payslip preview (payroll.view).</summary>
        [HttpGet("{id:int}/payslips/{employeeId:int}")]
        public async Task<ActionResult<PayslipResponse>> GetPayslip(int id, int employeeId, CancellationToken ct)
            => Ok(await _service.GetPayslipAsync(GetActorUserId(), id, employeeId, ct));

        /// <summary>GET /api/payroll-periods/{id}/export — period CSV stream (payroll.export).</summary>
        [HttpGet("{id:int}/export")]
        public async Task<IActionResult> ExportPeriod(int id, [FromQuery] int? gym, [FromQuery] string? format, CancellationToken ct)
        {
            var (fileName, content) = await _service.ExportPeriodAsync(GetActorUserId(), id, gym, format, ct);
            return File(content, "text/csv", fileName);
        }
    }
}
