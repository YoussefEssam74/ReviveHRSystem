using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Presentation.Authorization;
using ServiceAbstraction.Services;
using Shared;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;
using DomainLayer.Models.UserModule.Enums;

namespace Presentation.Controllers
{
    /// <summary>
    /// Employee management (mock Â§21). Every action is gated by the `employees`
    /// feature at the required level in the token's gym ([HasFeatureAccess]); the
    /// service layer additionally resolves the team/gym scope so a Team Leader only
    /// ever sees his own team.
    /// </summary>
    [Route("api/employees")]
    public class EmployeeManagementController(IEmployeeManagementService employeeManagementService) : ApiControllerBase
    {
        /// <summary>Directory: the caller's team (Team Leader) or the gym (Branch Manager).</summary>
        [HttpGet]
        [HasFeatureAccess(Features.Employees, AccessLevel.View)]
        public async Task<ActionResult<PaginationResult<EmployeeSummaryDto>>> GetDirectory(
            [FromQuery] EmployeeQueryParams query, CancellationToken cancellationToken)
        {
            var employees = await employeeManagementService.GetDirectoryAsync(
                GetActorUserId(), GetGymIdFromToken(), query, cancellationToken);
            return Ok(employees);
        }

        /// <summary>Creates an employee in the active gym (team members for team leaders).</summary>
        [HttpPost]
        [HasFeatureAccess(Features.Employees, AccessLevel.Edit)]
        public async Task<ActionResult<EmployeeSummaryDto>> Create(
            CreateEmployeeDto request, CancellationToken cancellationToken)
        {
            var created = await employeeManagementService.CreateAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/employees/{created.Id}", created);
        }

        /// <summary>Updates name, position and status of an in-scope employee.</summary>
        [HttpPut("{id}")]
        [HasFeatureAccess(Features.Employees, AccessLevel.Edit)]
        public async Task<ActionResult<EmployeeSummaryDto>> Update(
            int id, UpdateEmployeeDto request, CancellationToken cancellationToken)
        {
            var updated = await employeeManagementService.UpdateAsync(
                GetActorUserId(), id, GetGymIdFromToken(), request, cancellationToken);
            return Ok(updated);
        }

        /// <summary>Employment status change; recorded on the employment history timeline.</summary>
        [HttpPost("{id}/status-change")]
        [HasFeatureAccess(Features.Employees, AccessLevel.Edit)]
        public async Task<IActionResult> ChangeStatus(
            int id, ChangeEmployeeStatusDto request, CancellationToken cancellationToken)
        {
            await employeeManagementService.ChangeStatusAsync(
                GetActorUserId(), id, GetGymIdFromToken(), request, cancellationToken);
            return NoContent();
        }
    }
}
