using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Presentation.Controllers
{
    /// <summary>
    /// Platform-wide user directory and account lifecycle. Distinct from <c>/api/users</c>
    /// (the gym-scoped HR Team admin): this surface is the Super Admin console's, returns
    /// the platform shape (role, companies, permission counters) and lets an HR Manager
    /// administer HR/employee accounts without ever minting another HR Manager.
    /// </summary>
    [Route("api/platform/users")]
    [Authorize]
    public class PlatformUsersController(IPlatformUserService _service) : ApiControllerBase
    {
        /// <summary>GET — paged directory with role/status/company filters and KPI counts (platform.users.view).</summary>
        [HttpGet]
        public async Task<ActionResult<PlatformUsersResponse>> GetUsers([FromQuery] PlatformUserListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetUsersAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST — creates an HR or employee account; HR Manager is refused here (platform.users.manage) → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<PlatformUserDetailResponse>> CreateUser([FromBody] CreatePlatformUserRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateUserAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>POST /hr-managers — creates a platform-wide HR Manager account (platform.hr_manager.manage) → 201.</summary>
        [HttpPost("hr-managers")]
        public async Task<ActionResult<CreateHrManagerResponse>> CreateHrManager([FromBody] CreateHrManagerRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateHrManagerAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>GET /{id} — full profile: employment record, permissions, access and recent activity.</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<PlatformUserDetailResponse>> GetUser(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetUserAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /{id}/status — suspend or restore; self-suspend is refused (platform.users.manage).</summary>
        [HttpPut("{id:int}/status")]
        public async Task<ActionResult<ChangePlatformUserStatusResponse>> ChangeStatus(int id, [FromBody] ChangePlatformUserStatusRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ChangeStatusAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /{id}/reset-password — issues a reset; the password is never echoed (platform.users.reset_password).</summary>
        [HttpPost("{id:int}/reset-password")]
        public async Task<ActionResult<ResetPlatformUserPasswordResponse>> ResetPassword(int id, [FromBody] ResetPlatformUserPasswordRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ResetPasswordAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /{id}/revoke-sessions — drops every active refresh token (platform.users.manage).</summary>
        [HttpPost("{id:int}/revoke-sessions")]
        public async Task<ActionResult<RevokeSessionsResponse>> RevokeSessions(int id, [FromBody] RevokeSessionsRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.RevokeSessionsAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /{id}/gym-access — replaces the HR user's branch assignments wholesale (gym.hr_staff.assign).</summary>
        [HttpPut("{id:int}/gym-access")]
        public async Task<ActionResult<ReplaceGymAccessResponse>> ReplaceGymAccess(int id, [FromBody] ReplaceGymAccessRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ReplaceGymAccessAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }
    }

    /// <summary>
    /// The console's landing page: KPI strip, derived attention queue, user-growth trend and
    /// the header search. Every number is computed at read time, so resolving an issue
    /// clears its alert without any cleanup step.
    /// </summary>
    [Route("api/platform/dashboard")]
    [Authorize]
    public class PlatformDashboardController(IPlatformDashboardService _service) : ApiControllerBase
    {
        /// <summary>GET — companies, users, revenue, seats and the attention counter (platform.companies.view).</summary>
        [HttpGet]
        public async Task<ActionResult<PlatformDashboardResponse>> GetDashboard(CancellationToken cancellationToken)
        {
            var result = await _service.GetDashboardAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /alerts — the derived attention queue, highest severity first.</summary>
        [HttpGet("alerts")]
        public async Task<ActionResult<PlatformAlertListResponse>> GetAlerts([FromQuery] PlatformAlertQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetAlertsAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /user-growth — monthly user totals for the trend line (1–24 months).</summary>
        [HttpGet("user-growth")]
        public async Task<ActionResult<UserGrowthResponse>> GetUserGrowth([FromQuery] int months, CancellationToken cancellationToken)
        {
            var result = await _service.GetUserGrowthAsync(GetActorUserId(), months <= 0 ? 12 : months, cancellationToken);
            return Ok(result);
        }
    }

    /// <summary>
    /// Header search across companies, users and invoices. Deliberately one endpoint: the
    /// console shows a combined dropdown and lets the user jump straight to the record.
    /// </summary>
    [Route("api/platform/search")]
    [Authorize]
    public class PlatformSearchController(IPlatformDashboardService _service) : ApiControllerBase
    {
        /// <summary>GET ?q=&amp;limit= — needs at least two characters (platform.companies.view).</summary>
        [HttpGet]
        public async Task<ActionResult<PlatformSearchResponse>> Search(
            [FromQuery] string? q,
            [FromQuery] int limit,
            CancellationToken cancellationToken)
        {
            var result = await _service.SearchAsync(GetActorUserId(), q ?? string.Empty, limit <= 0 ? 10 : limit, cancellationToken);
            return Ok(result);
        }
    }
}
