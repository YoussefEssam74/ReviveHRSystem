using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;
namespace Presentation.Controllers
{
    /// <summary>Team overview for the signed-in user (mock §13 My Team).</summary>
    [Route("api/teams")]
    public class TeamOverviewController(ITeamOverviewService teamOverviewService) : ApiControllerBase
    {
        /// <summary>The teams the caller leads or belongs to in the active gym.</summary>
        [HttpGet("my-teams")]
        public async Task<ActionResult<IReadOnlyList<TeamDto>>> GetMyTeams(CancellationToken cancellationToken)
        {
            var teams = await teamOverviewService.GetMyTeamsAsync(
                GetActorUserId(), GetGymIdFromToken(), cancellationToken);
            return Ok(teams);
        }

        /// <summary>Team-day overview: members, shifts, live status and pending requests.</summary>
        [HttpGet("{teamId}/today")]
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
        public async Task<ActionResult<object>> GetUnscheduledCount(
            int teamId, CancellationToken cancellationToken)
        {
            var count = await teamOverviewService.GetUnscheduledCountAsync(
                GetActorUserId(), teamId, GetGymIdFromToken(), cancellationToken);
            return Ok(new { count });
        }
    }

    /// <summary>Employee leaving / offboarding cases (mock §24).</summary>
    [Route("api/offboarding-requests")]
    public class OffboardingController(IOffboardingService offboardingService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<PaginationResult<OffboardingCaseDto>>> GetCases(
            [FromQuery] OffboardingQueryParams query, CancellationToken cancellationToken)
        {
            var cases = await offboardingService.GetCasesAsync(
                GetActorUserId(), GetGymIdFromToken(), query, cancellationToken);
            return Ok(cases);
        }

        /// <summary>Initiates a leaving process for an in-scope employee.</summary>
        [HttpPost]
        public async Task<ActionResult<OffboardingCaseDto>> Initiate(
            InitiateOffboardingDto request, CancellationToken cancellationToken)
        {
            var created = await offboardingService.InitiateAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/offboarding-requests/{created.Id}", created);
        }

        /// <summary>Moves the last working day of an in-flight leaving process.</summary>
        /// <response code="200">The rescheduled case.</response>
        /// <response code="400">The case is no longer in flight (Completed/Cancelled).</response>
        /// <response code="404">The case is outside the caller's scope.</response>
        [HttpPut("{id:int}/last-day")]
        public async Task<ActionResult<OffboardingCaseDto>> UpdateLastDay(
            int id, [FromBody] UpdateOffboardingLastDayDto request, CancellationToken cancellationToken)
        {
            var updated = await offboardingService.UpdateLastDayAsync(
                GetActorUserId(), GetGymIdFromToken(), id, request, cancellationToken);
            return Ok(updated);
        }

        /// <summary>Closes an in-flight leaving process — employment continues and a new process may start later.</summary>
        /// <response code="200">The closed case.</response>
        /// <response code="400">The case is no longer in flight (Completed/Cancelled).</response>
        /// <response code="404">The case is outside the caller's scope.</response>
        [HttpPost("{id:int}/close")]
        public async Task<ActionResult<OffboardingCaseDto>> Close(int id, CancellationToken cancellationToken)
        {
            var closed = await offboardingService.CloseAsync(
                GetActorUserId(), GetGymIdFromToken(), id, cancellationToken);
            return Ok(closed);
        }
    }
}
