using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Reporting;

namespace Presentation.Controllers
{
    /// <summary>Positions &amp; levels catalog (api-spec-from-ui.md §9.2): org-wide list + create/edit.</summary>
    [Route("api/positions")]
    [Authorize]
    public class PositionsController(IReportingService _service) : ApiControllerBase
    {
        /// <summary>GET /api/positions — org-wide catalog with headcount/open/fill derivation (positions.view).</summary>
        [HttpGet]
        public async Task<ActionResult<PositionCatalogResponse>> GetPositions([FromQuery] PositionCatalogQuery query, CancellationToken ct)
            => Ok(await _service.GetPositionsAsync(GetActorUserId(), query, ct));

        /// <summary>POST /api/positions — create a position row (positions.manage).</summary>
        [HttpPost]
        public async Task<ActionResult<PositionDataResponse>> CreatePosition([FromBody] UpsertPositionRequest request, CancellationToken ct)
        {
            var response = await _service.CreatePositionAsync(GetActorUserId(), request, ct);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        /// <summary>PUT /api/positions/{id} — update a position row (positions.manage).</summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<PositionDataResponse>> UpdatePosition(int id, [FromBody] UpsertPositionRequest request, CancellationToken ct)
            => Ok(await _service.UpdatePositionAsync(GetActorUserId(), id, request, ct));
    }
}
