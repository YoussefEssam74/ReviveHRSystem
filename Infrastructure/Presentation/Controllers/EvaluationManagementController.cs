using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>Submitting and editing evaluations of in-scope employees.</summary>
    [Route("api/employees/{employeeId}/evaluations")]
    public class EmployeeEvaluationsManagementController(
        IEvaluationManagementService evaluationManagementService) : ApiControllerBase
    {
        /// <summary>Submits an evaluation for an in-scope employee.</summary>
        [HttpPost]
        public async Task<ActionResult<EvaluationDto>> Create(
            int employeeId, CreateEvaluationResponseDto request, CancellationToken cancellationToken)
        {
            var created = await evaluationManagementService.CreateAsync(
                GetActorUserId(), employeeId, GetGymIdFromToken(), request, cancellationToken);
            return Created($"/api/employees/{employeeId}/evaluations/{created.Id}", created);
        }
    }

    /// <summary>Single evaluation operations: edit.</summary>
    [Route("api/employees/{employeeId}/evaluations/{evaluationId}")]
    public class EvaluationDetailController(IEvaluationManagementService evaluationManagementService) : ApiControllerBase
    {
        /// <summary>Edits the answers of an in-scope evaluation.</summary>
        [HttpPut]
        public async Task<ActionResult<EvaluationDto>> Update(
            int employeeId, int evaluationId, UpdateEvaluationDto request, CancellationToken cancellationToken)
        {
            var updated = await evaluationManagementService.UpdateAsync(
                GetActorUserId(), employeeId, evaluationId, GetGymIdFromToken(), request, cancellationToken);
            return Ok(updated);
        }
    }

    /// <summary>Team evaluation history (mock 18.1 Team Performance).</summary>
    [Route("api/teams/{teamId}/evaluations")]
    public class TeamEvaluationsController(IEvaluationManagementService evaluationManagementService) : ApiControllerBase
    {
        /// <summary>Evaluations of the team's members, newest first.</summary>
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EvaluationDto>>> GetTeamEvaluations(
            int teamId, CancellationToken cancellationToken)
        {
            var evaluations = await evaluationManagementService.GetTeamEvaluationsAsync(
                GetActorUserId(), GetGymIdFromToken(), teamId, cancellationToken);
            return Ok(evaluations);
        }
    }
}
