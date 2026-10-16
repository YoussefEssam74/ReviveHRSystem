using DomainLayer.Models.EmployeeModule.Enums;
using Shared.DataTransferObject;
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

        /// <summary>Official company documents HR published for this employee (mock §3.3).</summary>
        Task<IReadOnlyList<HrDocumentDto>> GetHrDocumentsAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Streams a document of the requested owner. Cross-scope access, another
        /// document's owner, and rows with nothing stored all answer 404 so the API
        /// never confirms a document exists to someone who may not read it.
        /// </summary>
        Task<FileDownload> DownloadAsync(
            int actorUserId, int employeeId, int documentId, DocumentSource source, int? activeGymId,
            CancellationToken cancellationToken = default);

        /// <summary>Replaces the caller's own avatar and returns where it is now served from.</summary>
        Task<PhotoUploadResultDto> UploadPhotoAsync(
            int actorUserId, int employeeId, string fileName, Stream content, CancellationToken cancellationToken = default);

        /// <summary>Streams the avatar, for anyone who may already see this employee.</summary>
        Task<FileDownload> GetPhotoAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);
    }
}
