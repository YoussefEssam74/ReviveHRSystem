using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Presentation.Authorization;
using ServiceAbstraction.Services;
using Shared;
using Shared.Authorization;
using Shared.DataTransferObject.Attendance;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;
using DomainLayer.Models.UserModule.Enums;
namespace Presentation.Controllers
{
    /// <summary>
    /// Branch/team attendance management (mock §22): the day view (late / absent /
    /// missing checkout) and the audited manual entry ("Mark Present"/"Mark Absent").
    /// Scope: team for Team Leaders, gym for Branch Managers.
    /// </summary>
    [Route("api/attendance")]
    public class AttendanceManagementController(
        IAttendanceManagementService attendanceManagementService,
        IAttendanceService attendanceService) : ApiControllerBase
    {
        /// <summary>Day view of in-scope attendance. Query: date or from/to range, employeeId, status.</summary>
        [HttpGet]
        [HasFeatureAccess(Features.Attendance, AccessLevel.View)]
        public async Task<ActionResult<AttendanceManagementDto>> GetDay(
            [FromQuery] AttendanceQueryParams query, CancellationToken cancellationToken)
        {
            var day = await attendanceManagementService.GetDayAsync(
                GetActorUserId(), GetGymIdFromToken(), query, cancellationToken);
            return Ok(day);
        }

        /// <summary>
        /// Management manual entry (audited): records a check-in/out for an in-scope
        /// employee in the active gym, with a mandatory reason (ADR-004 validation).
        /// </summary>
        [HttpPost("mark-attendance")]
        [HasFeatureAccess(Features.Attendance, AccessLevel.Edit)]
        public async Task<ActionResult<AttendanceResponse>> MarkAttendance(
            ManualAttendanceRequest request, CancellationToken cancellationToken)
        {
            var response = await attendanceService.RecordManualEntryAsync(
                request,
                GetGymIdFromToken(),
                stationSessionId: null,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                cancellationToken);
            return StatusCode(StatusCodes.Status201Created, response);
        }
    }

    /// <summary>Team overview for the signed-in user (mock §13 My Team).</summary>
    [Route("api/teams")]
    public class TeamOverviewController(ITeamOverviewService teamOverviewService) : ApiControllerBase
    {
        /// <summary>The teams the caller leads or belongs to in the active gym.</summary>
        [HttpGet("my-teams")]
        [HasFeatureAccess(Features.Employees, AccessLevel.View)]
        public async Task<ActionResult<IReadOnlyList<TeamDto>>> GetMyTeams(CancellationToken cancellationToken)
        {
            var teams = await teamOverviewService.GetMyTeamsAsync(
                GetActorUserId(), GetGymIdFromToken(), cancellationToken);
            return Ok(teams);
        }

        /// <summary>Team-day overview: members, shifts, live status and pending requests.</summary>
        [HttpGet("{teamId}/today")]
        [HasFeatureAccess(Features.Employees, AccessLevel.View)]
        public async Task<ActionResult<TeamTodayDto>> GetTeamToday(
            int teamId, [FromQuery] DateOnly? date, CancellationToken cancellationToken)
        {
            var team = await teamOverviewService.GetTeamTodayAsync(
                GetActorUserId(), teamId, GetGymIdFromToken(), date, cancellationToken);
            return Ok(team);
        }

        /// <summary>
        /// Members of the team with no published assignment (all Off / empty) — the
        /// Team Schedule sidebar's "unscheduled" badge.
        /// </summary>
        [HttpGet("{teamId}/unscheduled-count")]
        [HasFeatureAccess(Features.Employees, AccessLevel.View)]
        public async Task<ActionResult<object>> GetUnscheduledCount(
            int teamId, CancellationToken cancellationToken)
        {
            var count = await teamOverviewService.GetUnscheduledCountAsync(
                GetActorUserId(), teamId, GetGymIdFromToken(), cancellationToken);
            return Ok(new { count });
        }
    }

    /// <summary>Branch vacancy requests (mock §23 Recruitment).</summary>
    [Route("api/vacancy-requests")]
    public class VacancyRequestsController(IVacancyRequestService vacancyRequestService) : ApiControllerBase
    {
        [HttpGet]
        [HasFeatureAccess(Features.Recruitment, AccessLevel.View)]
        public async Task<ActionResult<PaginationResult<VacancyRequestDto>>> GetRequests(
            [FromQuery] VacancyQueryParams query, CancellationToken cancellationToken)
        {
            var requests = await vacancyRequestService.GetRequestsAsync(
                GetActorUserId(), GetGymIdFromToken(), query, cancellationToken);
            return Ok(requests);
        }

        /// <summary>Detail of one gym vacancy request (mock §23.3 detail modal).</summary>
        [HttpGet("{id}")]
        [HasFeatureAccess(Features.Recruitment, AccessLevel.View)]
        public async Task<ActionResult<VacancyRequestDto>> GetRequest(int id, CancellationToken cancellationToken)
        {
            var request = await vacancyRequestService.GetRequestAsync(
                GetActorUserId(), GetGymIdFromToken(), id, cancellationToken);
            return Ok(request);
        }

        [HttpPost]
        [HasFeatureAccess(Features.Recruitment, AccessLevel.Edit)]
        public async Task<ActionResult<VacancyRequestDto>> Create(
            CreateVacancyRequestDto request, CancellationToken cancellationToken)
        {
            var created = await vacancyRequestService.CreateAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/vacancy-requests/{created.Id}", created);
        }
    }

    /// <summary>Employee leaving / offboarding cases (mock §24).</summary>
    [Route("api/offboarding-requests")]
    public class OffboardingController(IOffboardingService offboardingService) : ApiControllerBase
    {
        [HttpGet]
        [HasFeatureAccess(Features.Offboarding, AccessLevel.View)]
        public async Task<ActionResult<PaginationResult<OffboardingCaseDto>>> GetCases(
            [FromQuery] OffboardingQueryParams query, CancellationToken cancellationToken)
        {
            var cases = await offboardingService.GetCasesAsync(
                GetActorUserId(), GetGymIdFromToken(), query, cancellationToken);
            return Ok(cases);
        }

        /// <summary>Initiates a leaving process for an in-scope employee.</summary>
        [HttpPost]
        [HasFeatureAccess(Features.Offboarding, AccessLevel.Edit)]
        public async Task<ActionResult<OffboardingCaseDto>> Initiate(
            InitiateOffboardingDto request, CancellationToken cancellationToken)
        {
            var created = await offboardingService.InitiateAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/offboarding-requests/{created.Id}", created);
        }
    }
}
