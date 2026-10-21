using Shared.DataTransferObject.Reporting;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Reports &amp; analytics support screens (api-spec-from-ui.md §5.9): the
    /// org-wide positions catalog (read + create/edit), the read-only audit log
    /// with its category/user/date filters, and the overview CSV export.
    /// </summary>
    public interface IReportingService
    {
        /// <summary>Org-wide positions catalog with headcount/fill derivation (positions.view).</summary>
        Task<PositionCatalogResponse> GetPositionsAsync(int? actorUserId, PositionCatalogQuery query, CancellationToken cancellationToken = default);

        /// <summary>Creates a position row (positions.manage) → 201.</summary>
        Task<PositionDataResponse> CreatePositionAsync(int? actorUserId, UpsertPositionRequest request, CancellationToken cancellationToken = default);

        /// <summary>Updates a position row (positions.manage).</summary>
        Task<PositionDataResponse> UpdatePositionAsync(int? actorUserId, int positionId, UpsertPositionRequest request, CancellationToken cancellationToken = default);

        /// <summary>Audit log rows, filtered by category/gym/user/date (audit.view).</summary>
        Task<AuditLogListResponse> GetAuditLogAsync(int? actorUserId, AuditLogListQuery query, CancellationToken cancellationToken = default);

        /// <summary>Overview metrics as a CSV stream for the requested period (reports.view).</summary>
        Task<(string FileName, byte[] Content)> ExportReportAsync(int? actorUserId, ReportExportQuery query, CancellationToken cancellationToken = default);
    }
}
