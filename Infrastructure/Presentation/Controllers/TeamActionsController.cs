using Microsoft.AspNetCore.Mvc;
using Presentation.Authorization;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using DomainLayer.Models.UserModule.Enums;

namespace Presentation.Controllers
{
    /// <summary>
    /// Team Actions (mock 19 Team Updates / 13.5-13.8): follow-ups raised about team
    /// members, the "Remind" shortcut and one-to-one messages. Gated by the
    /// `employees` feature; the service resolves the caller's team so a Team Leader
    /// only ever touches his own team and cross-scope answers 404.
    /// </summary>
    [Route("api/teams")]
    public class TeamFollowUpsController(ITeamActionsService teamActionsService) : ApiControllerBase
    {
        /// <summary>Follow-ups of the caller's scope, newest activity first.</summary>
        [HttpGet("follow-ups")]
        [HasFeatureAccess(Features.Employees, AccessLevel.View)]
        public async Task<ActionResult<IReadOnlyList<TeamFollowUpDto>>> GetFollowUps(
            [FromQuery] int? teamId, CancellationToken cancellationToken)
        {
            var followUps = await teamActionsService.GetFollowUpsAsync(
                GetActorUserId(), GetGymIdFromToken(), teamId, cancellationToken);
            return Ok(followUps);
        }

        /// <summary>Raises a follow-up about one of the caller's team members.</summary>
        [HttpPost("follow-ups")]
        [HasFeatureAccess(Features.Employees, AccessLevel.Edit)]
        public async Task<ActionResult<TeamFollowUpDto>> Create(
            CreateTeamFollowUpDto request, CancellationToken cancellationToken)
        {
            var created = await teamActionsService.CreateFollowUpAsync(
                GetActorUserId(), GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/teams/follow-ups/{created.Id}", created);
        }
    }

    /// <summary>Actions on an existing follow-up, and the member shortcuts.</summary>
    [Route("api/teams/follow-ups")]
    public class TeamFollowUpDetailController(ITeamActionsService teamActionsService) : ApiControllerBase
    {
        /// <summary>Records an action (reminder / meeting / escalation / resolution).</summary>
        [HttpPut("{id}")]
        [HasFeatureAccess(Features.Employees, AccessLevel.Edit)]
        public async Task<ActionResult<TeamFollowUpDto>> Update(
            int id, UpdateTeamFollowUpDto request, CancellationToken cancellationToken)
        {
            var updated = await teamActionsService.UpdateFollowUpAsync(
                GetActorUserId(), id, GetGymIdFromToken(), request, cancellationToken);
            return Ok(updated);
        }
    }

    /// <summary>Member shortcuts on the team screens: "Remind" and "Message".</summary>
    [Route("api")]
    public class TeamMemberActionsController(ITeamActionsService teamActionsService) : ApiControllerBase
    {
        /// <summary>Sends a reminder to an in-scope team member.</summary>
        [HttpPost("teams/members/{employeeId}/reminders")]
        [HasFeatureAccess(Features.Employees, AccessLevel.Edit)]
        public async Task<IActionResult> Remind(int employeeId, CancellationToken cancellationToken)
        {
            await teamActionsService.SendReminderAsync(
                GetActorUserId(), employeeId, GetGymIdFromToken(), cancellationToken);
            return NoContent();
        }

        /// <summary>Sends a one-to-one message to an in-scope team member.</summary>
        [HttpPost("employees/{employeeId}/messages")]
        [HasFeatureAccess(Features.Employees, AccessLevel.Edit)]
        public async Task<IActionResult> Message(
            int employeeId, SendTeamMessageDto request, CancellationToken cancellationToken)
        {
            await teamActionsService.SendMessageAsync(
                GetActorUserId(), employeeId, GetGymIdFromToken(), request, cancellationToken);
            return NoContent();
        }
    }
}
