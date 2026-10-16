using Microsoft.AspNetCore.Mvc;
using Presentation.Authorization;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using DomainLayer.Models.UserModule.Enums;

namespace Presentation.Controllers
{
    /// <summary>
    /// Evaluation authoring for managers (mock 14.6/14.7/18.1): the forms a leader may
    /// fill in, submitting and editing evaluations of in-scope employees, and the
    /// team's evaluation history. Gated by the `evaluations` feature; the service
    /// resolves team/gym scope so a Team Leader only touches his own team.
    /// </summary>
    [Route("api/evaluation-forms")]
    public class EvaluationFormsController(IEvaluationManagementService evaluationManagementService) : ApiControllerBase
    {
        /// <summary>Active forms available in the active gym (or global ones).</summary>
        [HttpGet]
        [HasFeatureAccess(Features.Evaluations, AccessLevel.View)]
        public async Task<ActionResult<IReadOnlyList<EvaluationFormDto>>> GetForms(CancellationToken cancellationToken)
        {
            var forms = await evaluationManagementService.GetFormsAsync(
                GetActorUserId(), GetGymIdFromToken(), cancellationToken);
            return Ok(forms);
        }
    }

    /// <summary>Submitting and editing evaluations of in-scope employees.</summary>
    [Route("api/employees/{employeeId}/evaluations")]
    public class EmployeeEvaluationsManagementController(
        IEvaluationManagementService evaluationManagementService) : ApiControllerBase
    {
        /// <summary>Submits an evaluation for an in-scope employee.</summary>
        [HttpPost]
        [HasFeatureAccess(Features.Evaluations, AccessLevel.Edit)]
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
        [HasFeatureAccess(Features.Evaluations, AccessLevel.Edit)]
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
        [HasFeatureAccess(Features.Evaluations, AccessLevel.View)]
        public async Task<ActionResult<IReadOnlyList<EvaluationDto>>> GetTeamEvaluations(
            int teamId, CancellationToken cancellationToken)
        {
            var evaluations = await evaluationManagementService.GetTeamEvaluationsAsync(
                GetActorUserId(), GetGymIdFromToken(), teamId, cancellationToken);
            return Ok(evaluations);
        }
    }
}
