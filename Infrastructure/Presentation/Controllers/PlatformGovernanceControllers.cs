using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Presentation.Controllers
{
    /// <summary>
    /// Platform-wide audit trail: the full log, the review queue, the KPI strip, the
    /// impersonation ledger, export packages and the retention policy.
    ///
    /// The trail is append-only. The review stamp is the single mutation any row accepts, and it
    /// is recorded as its own event rather than by rewriting the original narrative.
    /// </summary>
    [Route("api/platform/audit")]
    [Authorize]
    public class PlatformAuditController(IPlatformAuditService _service) : ApiControllerBase
    {
        /// <summary>GET — paged trail with severity/company/category/date filters and the summary counts.</summary>
        [HttpGet]
        public async Task<ActionResult<PlatformAuditListResponse>> GetAudit([FromQuery] PlatformAuditQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetAuditAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /review-queue — unreviewed critical and warning events, most severe first.</summary>
        [HttpGet("review-queue")]
        public async Task<ActionResult<PlatformAuditReviewQueueResponse>> GetReviewQueue(CancellationToken cancellationToken)
        {
            var result = await _service.GetReviewQueueAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /summary — KPI strip for the Security &amp; audit page.</summary>
        [HttpGet("summary")]
        public async Task<ActionResult<PlatformAuditSummaryResponse>> GetSummary(CancellationToken cancellationToken)
        {
            var result = await _service.GetSummaryAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /impersonations — the act-as session ledger (platform.audit.view).</summary>
        [HttpGet("impersonations")]
        public async Task<ActionResult<ImpersonationSessionsResponse>> GetImpersonations(
            [FromQuery] ImpersonationSessionsQuery query,
            CancellationToken cancellationToken)
        {
            var result = await _service.GetImpersonationSessionsAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /export — renders a snapshot package (platform.audit.export) → 202.</summary>
        [HttpPost("export")]
        public async Task<ActionResult<CreateAuditExportResponse>> CreateExport(
            [FromBody] CreateAuditExportRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _service.CreateExportAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status202Accepted, result);
        }

        /// <summary>GET /exports/{exportId} — polling endpoint; returns the download URL once ready.</summary>
        [HttpGet("exports/{exportId}")]
        public async Task<ActionResult<AuditExportStatusResponse>> GetExport(string exportId, CancellationToken cancellationToken)
        {
            var result = await _service.GetExportAsync(GetActorUserId(), exportId, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /exports/{exportId}/download — the stored snapshot, byte-identical to what was generated.</summary>
        [HttpGet("exports/{exportId}/download")]
        public async Task<IActionResult> DownloadExport(string exportId, CancellationToken cancellationToken)
        {
            var (fileName, content, contentType) = await _service.DownloadExportAsync(GetActorUserId(), exportId, cancellationToken);
            return File(content, contentType, fileName);
        }

        /// <summary>GET /retention-policy — the retention windows (platform.settings.manage).</summary>
        [HttpGet("retention-policy")]
        public async Task<ActionResult<AuditRetentionPolicyDto>> GetRetentionPolicy(CancellationToken cancellationToken)
        {
            var result = await _service.GetRetentionPolicyAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /retention-policy — changes the windows; the trail itself stays append-only.</summary>
        [HttpPut("retention-policy")]
        public async Task<ActionResult<AuditRetentionPolicyDto>> UpdateRetentionPolicy(
            [FromBody] UpdateAuditRetentionPolicyRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _service.UpdateRetentionPolicyAsync(GetActorUserId(), request, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /{id} — one event with its before/after payloads and review stamp.</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<PlatformAuditDetailResponse>> GetEvent(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetEventAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /{id}/review — the only mutation an audit row accepts (platform.audit.review).</summary>
        [HttpPost("{id:int}/review")]
        public async Task<ActionResult<ReviewAuditEventResponse>> Review(
            int id,
            [FromBody] ReviewAuditEventRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _service.ReviewAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }
    }

    /// <summary>
    /// Platform configuration and the feature-flag catalogue.
    ///
    /// <c>GET /feature-flags/effective</c> is deliberately readable by any authenticated user:
    /// the SPA and the in-gym portal gate their UI on that map.
    /// </summary>
    [Route("api/platform/settings")]
    [Authorize]
    public class PlatformSettingsController(IPlatformSettingsService _service) : ApiControllerBase
    {
        /// <summary>GET — security, localization, branding, billing and audit settings.</summary>
        [HttpGet]
        public async Task<ActionResult<PlatformSettingsResponse>> GetSettings(CancellationToken cancellationToken)
        {
            var result = await _service.GetSettingsAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT — partial update; omitted sections keep their stored value (platform.settings.manage).</summary>
        [HttpPut]
        public async Task<ActionResult<PlatformSettingsResponse>> UpdateSettings(
            [FromBody] UpdatePlatformSettingsRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _service.UpdateSettingsAsync(GetActorUserId(), request, cancellationToken);
            return Ok(result);
        }
    }

    /// <summary>Feature flags per plan or company (platform.feature_flags.manage).</summary>
    [Route("api/platform/feature-flags")]
    [Authorize]
    public class PlatformFeatureFlagsController(IPlatformSettingsService _service) : ApiControllerBase
    {
        /// <summary>GET — the flag catalogue with its targets.</summary>
        [HttpGet]
        public async Task<ActionResult<FeatureFlagsListResponse>> GetFlags(CancellationToken cancellationToken)
        {
            var result = await _service.GetFeatureFlagsAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>POST — creates a flag; the key must be unique and dotted → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<FeatureFlagItem>> CreateFlag([FromBody] FeatureFlagUpsertRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateFeatureFlagAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>
        /// GET /effective — the flags in force for the caller.
        /// Any authenticated user may read this; it is what the UI gates itself on.
        /// </summary>
        [HttpGet("effective")]
        public async Task<ActionResult<EffectiveFeatureFlagsResponse>> GetEffectiveFlags(CancellationToken cancellationToken)
        {
            var result = await _service.GetEffectiveFlagsAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /{id} — updates name, description, state and targets; the key is immutable.</summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<FeatureFlagItem>> UpdateFlag(int id, [FromBody] FeatureFlagUpsertRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.UpdateFeatureFlagAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>DELETE /{id} — removes the flag and all of its targets.</summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteFlag(int id, CancellationToken cancellationToken)
        {
            await _service.DeleteFeatureFlagAsync(GetActorUserId(), id, cancellationToken);
            return NoContent();
        }
    }

    /// <summary>
    /// Act-as sessions. Starting one returns a token that keeps the actor's real
    /// <c>userType</c>; the guard middleware refuses to let that token reach any
    /// <c>platform.*</c> endpoint, which is what stops a workspace session from being used to
    /// escalate back into platform administration.
    /// </summary>
    [Route("api/platform/impersonation")]
    [Authorize]
    public class ImpersonationController(
        IImpersonationService _service,
        IPlatformAuditService _auditService) : ApiControllerBase
    {
        /// <summary>POST /start — opens a workspace session and returns its token → 201.</summary>
        [HttpPost("start")]
        public async Task<ActionResult<StartImpersonationResponse>> Start(
            [FromBody] StartImpersonationRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _service.StartAsync(
                GetActorUserId(), request, HttpContext.Connection.RemoteIpAddress?.ToString(), cancellationToken);

            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>POST /end — closes the caller's own session.</summary>
        [HttpPost("end")]
        public async Task<ActionResult<EndImpersonationResponse>> End(
            [FromBody] EndImpersonationRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _service.EndAsync(GetActorUserId(), request.SessionId, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// GET /current — the session the caller's token is acting under.
        /// Reports <c>active: false</c> when the token is not an act-as token, or its session has
        /// ended or expired, so the client can drop the workspace banner.
        /// </summary>
        [HttpGet("current")]
        public async Task<ActionResult<CurrentImpersonationResponse>> GetCurrent(CancellationToken cancellationToken)
        {
            var sessionId = int.TryParse(User.FindFirst("actSessionId")?.Value, out var parsed) ? parsed : (int?)null;
            var result = await _service.GetCurrentAsync(GetActorUserId(), sessionId, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /sessions — the session ledger (same payload as the audit page's panel).</summary>
        [HttpGet("sessions")]
        public async Task<ActionResult<ImpersonationSessionsResponse>> GetSessions(
            [FromQuery] ImpersonationSessionsQuery query,
            CancellationToken cancellationToken)
        {
            var result = await _auditService.GetImpersonationSessionsAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /roles — the "Act as" options for the workspace launcher.</summary>
        [HttpGet("roles")]
        public async Task<ActionResult<LauncherRoleOptionsResponse>> GetRoles(CancellationToken cancellationToken)
        {
            var result = await _service.GetLauncherRolesAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }
    }
}
