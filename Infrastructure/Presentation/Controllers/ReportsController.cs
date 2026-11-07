using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Reporting;

namespace Presentation.Controllers
{
    /// <summary>Reports &amp; analytics export (api-spec-from-ui.md §9.1).</summary>
    [Route("api/reports")]
    [Authorize]
    public class ReportsController(IReportingService _service) : ApiControllerBase
    {
        /// <summary>GET /api/reports/export?period=30d|90d|ytd&amp;format=csv — overview metrics CSV (reports.view).</summary>
        [HttpGet("export")]
        public async Task<IActionResult> ExportReport([FromQuery] ReportExportQuery query, CancellationToken ct)
        {
            var (fileName, content) = await _service.ExportReportAsync(GetActorUserId(), query, ct);
            return File(content, "text/csv", fileName);
        }

        /// <summary>GET /api/reports/overview?period=30d|90d|ytd — Reports page metric cards (reports.view).</summary>
        [HttpGet("overview")]
        public async Task<ActionResult<ReportsOverviewDto>> GetOverview([FromQuery] ReportsOverviewQuery query, CancellationToken ct)
        {
            var overview = await _service.GetOverviewAsync(GetActorUserId(), query, ct);
            return Ok(overview);
        }
    }
}
