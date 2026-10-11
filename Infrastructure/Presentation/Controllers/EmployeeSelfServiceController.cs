using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>
    /// Employee self-service surface (mock §§3, 6, 7, 10): documents, attendance,
    /// leave balance, published schedule and requests. Reads of another employee's
    /// data require the [employees] feature level in the active gym with matching
    /// scope; writes (documents, requests) are self-only and enforced in services.
    /// </summary>
    [Route("api/employees/{id}/documents")]
    public class EmployeeDocumentsController(
        IEmployeeDocumentService documentService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EmployeeDocumentDto>>> GetDocuments(
            int id, CancellationToken cancellationToken)
        {
            var documents = await documentService.GetDocumentsAsync(GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(documents);
        }

        [HttpGet("~/api/employees/{id}/required-documents")]
        public async Task<ActionResult<IReadOnlyList<RequiredDocumentDto>>> GetRequiredDocuments(
            int id, CancellationToken cancellationToken)
        {
            var documents = await documentService.GetRequiredDocumentsAsync(GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(documents);
        }

        [HttpPost]
        public async Task<ActionResult<EmployeeDocumentDto>> Upload(
            int id, UploadDocumentRequestDto request, CancellationToken cancellationToken)
        {
            var document = await documentService.UploadAsync(GetActorUserId(), id, request, cancellationToken);
            return CreatedAtAction(nameof(GetDocuments), new { id }, document);
        }
    }

    /// <summary>Attendance and leave balance for one employee (mock §6).</summary>
    [Route("api/employees/{id}/attendance")]
    public class EmployeeAttendanceController(
        IAttendanceSelfService attendanceService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<AttendanceOverviewDto>> GetAttendance(
            int id, [FromQuery] string? month, CancellationToken cancellationToken)
        {
            var overview = await attendanceService.GetAttendanceAsync(
                GetActorUserId(), id, month, GetGymIdFromToken(), cancellationToken);
            return Ok(overview);
        }
    }

    /// <summary>Leave balance for one employee (mock §6 leave card).</summary>
    [Route("api/employees/{id}/leave-balance")]
    public class EmployeeLeaveBalanceController(
        IAttendanceSelfService attendanceService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<LeaveBalanceOverviewDto>> GetLeaveBalance(
            int id, CancellationToken cancellationToken)
        {
            var overview = await attendanceService.GetLeaveBalanceAsync(
                GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(overview);
        }
    }

    /// <summary>Published schedule for one employee (mock §7; published cycles only).</summary>
    [Route("api/employees/{id}/schedule")]
    public class EmployeeScheduleController(
        IScheduleSelfService scheduleService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<EmployeeScheduleDto>> GetSchedule(
            int id, [FromQuery] string? month, CancellationToken cancellationToken)
        {
            var schedule = await scheduleService.GetScheduleAsync(
                GetActorUserId(), id, month, GetGymIdFromToken(), cancellationToken);
            return Ok(schedule);
        }
    }

    /// <summary>Self-service requests (mock §10) and the configurable request types.</summary>
    [Route("api/employees/{id}/requests")]
    public class EmployeeRequestsController(
        IEmployeeRequestService requestService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EmployeeRequestDto>>> GetRequests(
            int id, [FromQuery] string? status, CancellationToken cancellationToken)
        {
            var requests = await requestService.GetRequestsAsync(
                GetActorUserId(), id, status, GetGymIdFromToken(), cancellationToken);
            return Ok(requests);
        }

        [HttpPost]
        public async Task<ActionResult<EmployeeRequestDto>> Create(
            int id, CreateEmployeeRequestDto request, CancellationToken cancellationToken)
        {
            var created = await requestService.CreateAsync(GetActorUserId(), id, request, cancellationToken);
            return Created($"/api/requests/{created.Id}", created);
        }
    }

    /// <summary>Single request operations: detail, cancel; plus the request-type catalog.</summary>
    [Route("api/requests")]
    public class EmployeeRequestDetailController(
        IEmployeeRequestService requestService) : ApiControllerBase
    {
        [HttpGet("~/api/requests/{id}")]
        public async Task<ActionResult<EmployeeRequestDto>> GetRequest(
            int id, CancellationToken cancellationToken)
        {
            var request = await requestService.GetRequestAsync(GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(request);
        }

        [HttpPost("~/api/requests/{id}/cancel")]
        public async Task<IActionResult> Cancel(int id, CancellationToken cancellationToken)
        {
            await requestService.CancelAsync(GetActorUserId(), id, cancellationToken);
            return NoContent();
        }

        [HttpGet("~/api/request-types")]
        public async Task<ActionResult<IReadOnlyList<RequestTypeDto>>> GetRequestTypes(CancellationToken cancellationToken)
        {
            var types = await requestService.GetRequestTypesAsync(cancellationToken);
            return Ok(types);
        }
    }
}
