using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Presentation.Controllers
{
    /// <summary>
    /// Branches of a gym company (Branches tab). Branch codes are generated server-side and
    /// the plan's branch limit is enforced in the service, so the client never has to
    /// re-derive either.
    /// </summary>
    [Route("api/platform/companies/{companyId:int}/branches")]
    [Authorize]
    public class PlatformBranchesController(ICompanyService _service) : ApiControllerBase
    {
        /// <summary>GET — every branch plus the plan's cap (platform.companies.view).</summary>
        [HttpGet]
        public async Task<ActionResult<BranchListResponse>> GetBranches(int companyId, CancellationToken cancellationToken)
        {
            var result = await _service.GetBranchesAsync(GetActorUserId(), companyId, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST — adds a branch, refused at the plan's limit (platform.branches.manage) → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<BranchListItem>> CreateBranch(int companyId, [FromBody] BranchUpsertRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateBranchAsync(GetActorUserId(), companyId, request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>PUT /{branchId} — renames or re-details a branch (platform.branches.manage).</summary>
        [HttpPut("{branchId:int}")]
        public async Task<ActionResult<BranchListItem>> UpdateBranch(int companyId, int branchId, [FromBody] BranchUpsertRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.UpdateBranchAsync(GetActorUserId(), companyId, branchId, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>DELETE /{branchId} — archives the branch; refused while it still has a roster.</summary>
        [HttpDelete("{branchId:int}")]
        public async Task<IActionResult> ArchiveBranch(int companyId, int branchId, CancellationToken cancellationToken)
        {
            await _service.ArchiveBranchAsync(GetActorUserId(), companyId, branchId, cancellationToken);
            return NoContent();
        }
    }

    /// <summary>
    /// HR staff assigned to a gym company (HR staff tab). Only HR accounts carry branch
    /// assignments; an HR Manager reaches every company without one.
    /// </summary>
    [Route("api/platform/companies/{companyId:int}/hr-staff")]
    [Authorize]
    public class PlatformHrStaffController(ICompanyService _service) : ApiControllerBase
    {
        /// <summary>GET — HR users with access to this company (gym.hr_staff.assign).</summary>
        [HttpGet]
        public async Task<ActionResult<HrStaffListResponse>> GetHrStaff(int companyId, CancellationToken cancellationToken)
        {
            var result = await _service.GetHrStaffAsync(GetActorUserId(), companyId, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST — grants access to the named HR users (idempotent) (gym.hr_staff.assign).</summary>
        [HttpPost]
        public async Task<ActionResult<AssignHrStaffResponse>> Assign(int companyId, [FromBody] AssignHrStaffRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.AssignHrStaffAsync(GetActorUserId(), companyId, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>DELETE /{userId} — revokes this company only; other companies are untouched.</summary>
        [HttpDelete("{userId:int}")]
        public async Task<ActionResult<RevokeHrStaffResponse>> Revoke(int companyId, int userId, CancellationToken cancellationToken)
        {
            var result = await _service.RevokeHrStaffAsync(GetActorUserId(), companyId, userId, cancellationToken);
            return Ok(result);
        }
    }
}
