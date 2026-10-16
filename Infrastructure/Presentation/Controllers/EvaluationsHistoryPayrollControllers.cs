using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>Employee dashboard aggregate (mock §1).</summary>
    [Route("api/dashboard/employee")]
    public class DashboardController(IDashboardService dashboardService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<EmployeeDashboardDto>> GetDashboard(CancellationToken cancellationToken)
        {
            var dashboard = await dashboardService.GetDashboardAsync(GetActorUserId(), GetGymIdFromToken(), cancellationToken);
            return Ok(dashboard);
        }
    }
}
