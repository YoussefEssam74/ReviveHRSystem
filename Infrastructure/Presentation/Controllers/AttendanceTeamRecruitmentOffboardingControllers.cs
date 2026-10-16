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
