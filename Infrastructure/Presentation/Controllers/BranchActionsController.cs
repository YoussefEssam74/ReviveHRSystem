using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>
    /// Branch Actions queue (mock §20): deductions, warning notices and bonus
    /// proposals raised by in-gym management for HR. The service enforces the
    /// acting-manager role (Team Leader within his team, Branch Manager gym-wide)
    /// so a plain employee cannot reach the queue.
    /// </summary>
    /// <summary>Branch-raised deduction candidate (attendance Edit → HR review).</summary>
    [Route("api/deduction-candidates")]
    public class BranchDeductionController(IBranchActionsService branchActionsService) : ApiControllerBase
    {
        [HttpPost]
        public async Task<ActionResult<DeductionCandidateDto>> Issue(
            CreateDeductionCandidateDto request, CancellationToken cancellationToken)
        {
            var created = await branchActionsService.IssueDeductionAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/deduction-candidates/{created.Id}", created);
        }

        /// <summary>
        /// GET /api/deduction-candidates/branch - the branch-facings list behind the
        /// Employees Performance deductions tab and the Actions palette history:
        /// the caller's team (Team Leader) or gym (Branch Manager), newest first,
        /// in every HR decision state. The separate GET /api/deduction-candidates
        /// route keeps its HR-queue semantics (payroll key).
        /// </summary>
        [HttpGet("branch")]
        public async Task<ActionResult<IReadOnlyList<DeductionCandidateDto>>> GetBranch(
            [FromQuery] int? employeeId, CancellationToken cancellationToken)
            => Ok(await branchActionsService.GetDeductionsAsync(
                GetActorUserId(), employeeId, GetGymIdFromToken(), cancellationToken));
    }

    /// <summary>Warning notices raised for HR to file.</summary>
    [Route("api/warning-notices")]
    public class WarningNoticesController(IBranchActionsService branchActionsService) : ApiControllerBase
    {
        /// <summary>GET /api/warning-notices - the caller's team/gym scope, newest first (employees.performance tabs).</summary>
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<WarningNoticeDto>>> GetWarnings(
            [FromQuery] int? employeeId, CancellationToken cancellationToken)
            => Ok(await branchActionsService.GetWarningsAsync(
                GetActorUserId(), employeeId, GetGymIdFromToken(), cancellationToken));

        [HttpPost]
        public async Task<ActionResult<WarningNoticeDto>> Issue(
            CreateWarningNoticeDto request, CancellationToken cancellationToken)
        {
            var created = await branchActionsService.IssueWarningAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/warning-notices/{created.Id}", created);
        }
    }

    /// <summary>Bonus proposals awaiting HR approval.</summary>
    [Route("api/bonus-proposals")]
    public class BonusProposalsController(IBranchActionsService branchActionsService) : ApiControllerBase
    {
        /// <summary>GET /api/bonus-proposals - the caller's team/gym scope, newest first (employees.performance tabs).</summary>
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<BonusProposalDto>>> GetBonuses(
            [FromQuery] int? employeeId, CancellationToken cancellationToken)
            => Ok(await branchActionsService.GetBonusesAsync(
                GetActorUserId(), employeeId, GetGymIdFromToken(), cancellationToken));

        [HttpPost]
        public async Task<ActionResult<BonusProposalDto>> Propose(
            CreateBonusProposalDto request, CancellationToken cancellationToken)
        {
            var created = await branchActionsService.ProposeBonusAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/bonus-proposals/{created.Id}", created);
        }
    }

    /// <summary>
    /// The manager's "Awaiting HR" queue: everything the caller raised in the active
    /// gym that HR has not decided yet. Feature-gated like the actions it reports.
    /// </summary>
    [Route("api/branch-actions/pending-hr")]
    public class BranchActionsQueueController(IBranchActionsService branchActionsService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<BranchQueueItemDto>>> GetPending(CancellationToken cancellationToken)
        {
            var items = await branchActionsService.GetPendingForHrAsync(
                GetActorUserId(), GetGymIdFromToken(), cancellationToken);
            return Ok(items);
        }
    }

    /// <summary>
    /// Free-form report from a branch to HR (mock §20 Send Report to HR). Any
    /// authenticated employee may report; it lands in the HR action queue.
    /// </summary>
    [Route("api/branch-reports")]
    public class BranchReportsController(IBranchActionsService branchActionsService) : ApiControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> Send(CreateBranchReportDto request, CancellationToken cancellationToken)
        {
            await branchActionsService.SendReportAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return NoContent();
        }
    }
}
