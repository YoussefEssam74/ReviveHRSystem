using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Reporting;

namespace Presentation.Controllers
{
    /// <summary>Read-only activity / audit log (api-spec-from-ui.md §9.3).</summary>
    [Route("api/audit-log")]
    [Authorize]
    public class AuditLogController(IReportingService _service) : ApiControllerBase
    {
        /// <summary>GET /api/audit-log — paged, filtered audit rows (audit.view).</summary>
        [HttpGet]
        public async Task<ActionResult<AuditLogListResponse>> GetAuditLog([FromQuery] AuditLogListQuery query, CancellationToken ct)
            => Ok(await _service.GetAuditLogAsync(GetActorUserId(), query, ct));
    }
}
