using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Recruitment;

namespace Presentation.Controllers
{
    /// <summary>
    /// Vacancy requests (api-spec-from-ui.md §5.1.2): the Branch-Manager requisition
    /// queue — submit, approve (creates the vacancy), reject, and re-open.
    /// </summary>
    [Route("api/vacancy-requests")]
    [Authorize]
    public class VacancyRequestsController(IRecruitmentService _service) : ApiControllerBase
    {
        /// <summary>GET /api/vacancy-requests — paged queue, filterable by status tab (recruitment.view).</summary>
        [HttpGet]
        public async Task<ActionResult<VacancyRequestListResponse>> GetVacancyRequests([FromQuery] VacancyRequestListQuery query, CancellationToken ct)
            => Ok(await _service.GetVacancyRequestsAsync(GetActorUserId(), query, ct));

        /// <summary>POST /api/vacancy-requests — submit a headcount requisition for own gym (recruitment.vacancy_request.create).</summary>
        [HttpPost]
        public async Task<ActionResult<VacancyRequestDataResponse>> CreateVacancyRequest([FromBody] CreateVacancyRequestBody request, CancellationToken ct)
        {
            var response = await _service.CreateVacancyRequestAsync(GetActorUserId(), request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>PUT /api/vacancy-requests/{id}/decide — approve (creates the resulting Vacancy) or reject (recruitment.vacancy_request.approve).</summary>
        [HttpPut("{id:int}/decide")]
        public async Task<ActionResult<VacancyRequestDecisionResponse>> DecideVacancyRequest(int id, [FromBody] DecideVacancyRequestRequest request, CancellationToken ct)
            => Ok(await _service.DecideVacancyRequestAsync(GetActorUserId(), id, request, ct));

        /// <summary>PUT /api/vacancy-requests/{id}/reopen — back to Pending; withdraws the created vacancy only while it has no applicants (recruitment.vacancy_request.approve).</summary>
        [HttpPut("{id:int}/reopen")]
        public async Task<ActionResult<ReopenVacancyRequestResponse>> ReopenVacancyRequest(int id, CancellationToken ct)
            => Ok(await _service.ReopenVacancyRequestAsync(GetActorUserId(), id, ct));
    }
}
