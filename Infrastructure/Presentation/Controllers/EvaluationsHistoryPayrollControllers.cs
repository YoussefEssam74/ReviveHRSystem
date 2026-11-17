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

    /// <summary>HR portal dashboard aggregate (mock §1 HR): KPI strip, actions, branches.</summary>
    [Route("api/dashboard/hr")]
    public class HrDashboardController(IDashboardService dashboardService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<HrDashboardDto>> GetHrDashboard(CancellationToken cancellationToken)
        {
            var dashboard = await dashboardService.GetHrDashboardAsync(GetActorUserId(), GetGymIdFromToken(), cancellationToken);
            return Ok(dashboard);
        }
    }
}
