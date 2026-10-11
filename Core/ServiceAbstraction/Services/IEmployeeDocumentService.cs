using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Employee documents (mock §3): the on-file vault, the required-document
    /// checklist and uploads. Status (Valid / Expiring Soon / Expired) is derived
    /// from the expiry date; HR-published official documents are listed separately.
    /// </summary>
    public interface IEmployeeDocumentService
    {
        Task<IReadOnlyList<EmployeeDocumentDto>> GetDocumentsAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<RequiredDocumentDto>> GetRequiredDocumentsAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        Task<EmployeeDocumentDto> UploadAsync(
            int actorUserId, int employeeId, UploadDocumentRequestDto request, CancellationToken cancellationToken = default);
    }
}
