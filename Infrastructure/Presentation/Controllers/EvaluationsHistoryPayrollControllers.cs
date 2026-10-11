using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>Own evaluations (mock §9 My Evaluations; primarily read-only).</summary>
    [Route("api/employees/{id}/evaluations")]
    public class EmployeeEvaluationsController(IEvaluationSelfService evaluationService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EvaluationDto>>> GetEvaluations(
            int id, CancellationToken cancellationToken)
        {
            var evaluations = await evaluationService.GetEvaluationsAsync(
                GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(evaluations);
        }
    }

    /// <summary>Employment history timeline (mock §5; read-only).</summary>
    [Route("api/employees/{id}/history")]
    public class EmploymentHistoryController(IEmploymentHistoryService historyService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EmploymentHistoryMonthDto>>> GetHistory(
            int id, CancellationToken cancellationToken)
        {
            var history = await historyService.GetHistoryAsync(
                GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(history);
        }
    }

    /// <summary>Employee-facing events and announcements (mock §4 Events).</summary>
    [Route("api/events")]
    public class EmployeeEventsController(IEmployeeEventService eventService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EmployeeEventDto>>> GetEvents(
            [FromQuery] string? scope, CancellationToken cancellationToken)
        {
            var events = await eventService.GetEventsAsync(
                GetActorUserId(), GetGymIdFromToken(), null, cancellationToken);
            return Ok(events);
        }
    }

    /// <summary>Own payroll periods and payslip contents (mock §8 My Payroll).</summary>
    [Route("api/employees/{id}/payroll")]
    public class EmployeePayrollController(IPayrollSelfService payrollService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<PayrollEntryDto>>> GetPayroll(
            int id, CancellationToken cancellationToken)
        {
            var payroll = await payrollService.GetPayrollAsync(
                GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(payroll);
        }
    }

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
