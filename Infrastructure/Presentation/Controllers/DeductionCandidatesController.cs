using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Payroll;

namespace Presentation.Controllers
{
    /// <summary>
    /// Deduction candidates (api-spec-from-ui.md §5.5): the pending deduction lines
    /// awaiting review — read with payroll.view or payroll.edit, decisions need payroll.edit.
    /// </summary>
    [Route("api/deduction-candidates")]
    [Authorize]
    public class DeductionCandidatesController(IPayrollService _service) : ApiControllerBase
    {
        /// <summary>GET /api/deduction-candidates — review queue (payroll.view | payroll.edit).</summary>
        [HttpGet]
        public async Task<ActionResult<DeductionCandidateListResponse>> GetCandidates([FromQuery] DeductionCandidateListQuery query, CancellationToken ct)
            => Ok(await _service.GetDeductionCandidatesAsync(GetActorUserId(), query, ct));

        /// <summary>POST /api/deduction-candidates/{id}/review — Approve (Accepted) / Waive (Rejected) (payroll.edit).</summary>
        [HttpPost("{id:int}/review")]
        public async Task<ActionResult<ReviewDeductionResponse>> ReviewCandidate(int id, [FromBody] ReviewDeductionRequest request, CancellationToken ct)
            => Ok(await _service.ReviewDeductionAsync(GetActorUserId(), id, request, ct));
    }
}
