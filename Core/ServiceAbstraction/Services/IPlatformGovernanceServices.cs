using Shared.DataTransferObject.Platform;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// The platform-wide audit trail, its review workflow, the retention policy and the
    /// export packages. The trail is append-only: <see cref="ReviewAsync"/> sets the review
    /// stamp and is the only mutation any row accepts.
    /// </summary>
    public interface IPlatformAuditService
    {
        Task<PlatformAuditListResponse> GetAuditAsync(int? actorUserId, PlatformAuditQuery query, CancellationToken cancellationToken = default);

        Task<PlatformAuditDetailResponse> GetEventAsync(int? actorUserId, int auditId, CancellationToken cancellationToken = default);

        /// <summary>Marks a critical/warning event reviewed. Refused when it already is.</summary>
        Task<ReviewAuditEventResponse> ReviewAsync(int? actorUserId, int auditId, ReviewAuditEventRequest request, CancellationToken cancellationToken = default);

        Task<PlatformAuditReviewQueueResponse> GetReviewQueueAsync(int? actorUserId, CancellationToken cancellationToken = default);

        Task<PlatformAuditSummaryResponse> GetSummaryAsync(int? actorUserId, CancellationToken cancellationToken = default);

        Task<ImpersonationSessionsResponse> GetImpersonationSessionsAsync(int? actorUserId, ImpersonationSessionsQuery query, CancellationToken cancellationToken = default);

        /// <summary>
        /// Renders the requested slice to a package. The snapshot is stored with the row so a
        /// re-download returns identical bytes even as the trail keeps growing.
        /// </summary>
        Task<CreateAuditExportResponse> CreateExportAsync(int? actorUserId, CreateAuditExportRequest request, CancellationToken cancellationToken = default);

        Task<AuditExportStatusResponse> GetExportAsync(int? actorUserId, string exportId, CancellationToken cancellationToken = default);

        Task<(string FileName, byte[] Content, string ContentType)> DownloadExportAsync(int? actorUserId, string exportId, CancellationToken cancellationToken = default);

        Task<AuditRetentionPolicyDto> GetRetentionPolicyAsync(int? actorUserId, CancellationToken cancellationToken = default);

        Task<AuditRetentionPolicyDto> UpdateRetentionPolicyAsync(int? actorUserId, UpdateAuditRetentionPolicyRequest request, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Platform configuration (security, localization, branding, billing, audit) and the
    /// feature-flag catalogue. Settings are stored as dotted key/value rows with typed
    /// defaults, so a fresh database still answers with a complete object.
    /// </summary>
    public interface IPlatformSettingsService
    {
        Task<PlatformSettingsResponse> GetSettingsAsync(int? actorUserId, CancellationToken cancellationToken = default);

        /// <summary>Partial update: omitted sections and null fields keep their stored value.</summary>
        Task<PlatformSettingsResponse> UpdateSettingsAsync(int? actorUserId, UpdatePlatformSettingsRequest request, CancellationToken cancellationToken = default);

        Task<FeatureFlagsListResponse> GetFeatureFlagsAsync(int? actorUserId, CancellationToken cancellationToken = default);

        Task<FeatureFlagItem> CreateFeatureFlagAsync(int? actorUserId, FeatureFlagUpsertRequest request, CancellationToken cancellationToken = default);

        Task<FeatureFlagItem> UpdateFeatureFlagAsync(int? actorUserId, int flagId, FeatureFlagUpsertRequest request, CancellationToken cancellationToken = default);

        Task DeleteFeatureFlagAsync(int? actorUserId, int flagId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Flags in force for the caller. Unlike the rest of the surface this is readable by any
        /// authenticated user — the SPA and the in-gym portal both gate UI on it.
        /// </summary>
        Task<EffectiveFeatureFlagsResponse> GetEffectiveFlagsAsync(int? actorUserId, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Act-as sessions ("Enter gym workspace").
    ///
    /// Security contract: an act-as token may never call a <c>platform.*</c> endpoint. That is
    /// enforced centrally in middleware (not per controller) so a future endpoint cannot
    /// forget it; this service only manages the session lifecycle and issues the token.
    /// </summary>
    public interface IImpersonationService
    {
        /// <summary>Opens a session (auto-ending the actor's previous one) and returns its token.</summary>
        Task<StartImpersonationResponse> StartAsync(int? actorUserId, StartImpersonationRequest request, string? ipAddress, CancellationToken cancellationToken = default);

        Task<EndImpersonationResponse> EndAsync(int? actorUserId, int sessionId, CancellationToken cancellationToken = default);

        /// <summary>The session the caller's token is acting under, or inactive when it is not one.</summary>
        Task<CurrentImpersonationResponse> GetCurrentAsync(int? actorUserId, int? sessionId, CancellationToken cancellationToken = default);

        /// <summary>Roles the "Act as" picker offers.</summary>
        Task<LauncherRoleOptionsResponse> GetLauncherRolesAsync(int? actorUserId, CancellationToken cancellationToken = default);
    }
}
