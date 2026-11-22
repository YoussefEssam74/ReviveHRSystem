using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Presentation.Controllers
{
    /// <summary>
    /// Gym company (tenant) administration — the Super Admin console's account table and
    /// the six tabs of a company record. Every action is JWT-authenticated; the permission
    /// and scope guards run inside <see cref="ICompanyService"/> (ADR-003).
    /// </summary>
    [Route("api/platform/companies")]
    [Authorize]
    public class PlatformCompaniesController(ICompanyService _service) : ApiControllerBase
    {
        /// <summary>GET /api/platform/companies — paged, filtered, sortable account table (platform.companies.view).</summary>
        [HttpGet]
        public async Task<ActionResult<CompanyListResponse>> GetCompanies([FromQuery] CompanyListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetCompaniesAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/platform/companies — provisions company + branch + subscription + HR grants (platform.companies.create) → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<CreateCompanyResponse>> CreateCompany([FromBody] CreateCompanyRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateCompanyAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>GET /api/platform/companies/{id} — account header, subscription, counters and health (platform.companies.view).</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<CompanyDetailResponse>> GetCompany(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetCompanyAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/platform/companies/{id} — profile and billing contact; the code is immutable (platform.companies.edit).</summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<CompanyDetailResponse>> UpdateCompany(int id, [FromBody] UpdateCompanyRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.UpdateCompanyAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/platform/companies/{id}/status — suspend, restore or close (platform.companies.status).</summary>
        [HttpPut("{id:int}/status")]
        public async Task<ActionResult<CompanyStatusChangeResponse>> ChangeStatus(int id, [FromBody] UpdateCompanyStatusRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ChangeStatusAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/platform/companies/{id}/overview — role breakdown, attendance trend, account facts.</summary>
        [HttpGet("{id:int}/overview")]
        public async Task<ActionResult<CompanyOverviewResponse>> GetOverview(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetOverviewAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/platform/companies/{id}/employees — Employees tab, filterable by branch/role/status.</summary>
        [HttpGet("{id:int}/employees")]
        public async Task<ActionResult<CompanyEmployeesResponse>> GetEmployees(int id, [FromQuery] CompanyEmployeeQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetEmployeesAsync(GetActorUserId(), id, query, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/platform/companies/{id}/billing — plan card, seat meter and invoice ledger (platform.billing.view).</summary>
        [HttpGet("{id:int}/billing")]
        public async Task<ActionResult<CompanyBillingResponse>> GetBilling(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetBillingAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/platform/companies/{id}/audit — this account's audit trail (platform.audit.view).</summary>
        [HttpGet("{id:int}/audit")]
        public async Task<ActionResult<PlatformAuditListResponse>> GetAudit(int id, [FromQuery] PlatformAuditQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetAuditAsync(GetActorUserId(), id, query, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// DELETE /api/platform/companies/{id} — soft-closes the account. Hard delete is never
        /// exposed: financial and audit history must survive (platform.companies.status).
        /// </summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> CloseCompany(int id, [FromQuery] string? confirmCode, CancellationToken cancellationToken)
        {
            await _service.ChangeStatusAsync(
                GetActorUserId(),
                id,
                new UpdateCompanyStatusRequest { Status = "Closed", ConfirmCode = confirmCode },
                cancellationToken);

            return NoContent();
        }
    }
}
