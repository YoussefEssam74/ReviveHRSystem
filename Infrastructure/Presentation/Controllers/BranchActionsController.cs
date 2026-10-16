using Microsoft.AspNetCore.Mvc;
using Presentation.Authorization;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using DomainLayer.Models.UserModule.Enums;

namespace Presentation.Controllers
{
    /// <summary>
    /// Branch Actions queue (mock §20): deductions, warning notices and bonus
    /// proposals raised by a Branch/Team Leader for HR. Deductions ride on the
    /// attendance feature (like attendance corrections), warnings and bonuses on the
    /// employees feature; the service enforces team/gym scope on the target.
    /// </summary>
    /// <summary>Branch-raised deduction candidate (attendance Edit → HR review).</summary>
    [Route("api/deduction-candidates")]
    public class BranchDeductionController(IBranchActionsService branchActionsService) : ApiControllerBase
    {
        [HttpPost]
        [HasFeatureAccess(Features.Attendance, AccessLevel.Edit)]
        public async Task<ActionResult<DeductionCandidateDto>> Issue(
            CreateDeductionCandidateDto request, CancellationToken cancellationToken)
        {
            var created = await branchActionsService.IssueDeductionAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/deduction-candidates/{created.Id}", created);
        }
    }

    /// <summary>Warning notices raised for HR to file.</summary>
    [Route("api/warning-notices")]
    public class WarningNoticesController(IBranchActionsService branchActionsService) : ApiControllerBase
    {
        [HttpPost]
        [HasFeatureAccess(Features.Employees, AccessLevel.Edit)]
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
        [HttpPost]
        [HasFeatureAccess(Features.Employees, AccessLevel.Edit)]
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
        [HasFeatureAccess(Features.Attendance, AccessLevel.View)]
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
