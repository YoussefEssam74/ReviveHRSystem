using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Recruitment;

namespace Presentation.Controllers
{
    /// <summary>Vacancies (api-spec-from-ui.md §5.1.1): list/create/update + funnel detail.</summary>
    [Route("api/vacancies")]
    [Authorize]
    public class VacanciesController(IRecruitmentService _service) : ApiControllerBase
    {
        /// <summary>GET /api/vacancies — paged, gym-scoped vacancy list (recruitment.view).</summary>
        [HttpGet]
        public async Task<ActionResult<VacancyListResponse>> GetVacancies([FromQuery] VacancyListQuery query, CancellationToken ct)
            => Ok(await _service.GetVacanciesAsync(GetActorUserId(), query, ct));

        /// <summary>GET /api/vacancies/{id} — one vacancy with funnel, employees under the position, and candidates (recruitment.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<VacancyDetailResponse>> GetVacancy(int id, CancellationToken ct)
            => Ok(await _service.GetVacancyAsync(GetActorUserId(), id, ct));
        /// <summary>POST /api/vacancies — open (or draft) a vacancy (recruitment.vacancies.manage).</summary>
        [HttpPost]
        public async Task<ActionResult<VacancyDataResponse>> CreateVacancy([FromBody] CreateVacancyRequest request, CancellationToken ct)
        {
            var response = await _service.CreateVacancyAsync(GetActorUserId(), request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>PUT /api/vacancies/{id} — partial update; accepts headcountNeeded (recruitment.vacancies.manage).</summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<VacancyDataResponse>> UpdateVacancy(int id, [FromBody] UpdateVacancyRequest request, CancellationToken ct)
            => Ok(await _service.UpdateVacancyAsync(GetActorUserId(), id, request, ct));
    }
}
