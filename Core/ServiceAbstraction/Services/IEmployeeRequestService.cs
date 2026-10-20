using Shared.DataTransferObject;
using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Self-service requests (mock §10 My Requests): create, list, detail, cancel.
    ///
    /// Submission rules live per request type (the 9-type catalog): annual/sick leave
    /// draw from the leave balance and refuse to exceed it; late attendance/early leave
    /// are capped by the gym's monthly excused-hours budget (shared) with the hours derived
    /// from the employee's published schedule; sick leave carries its medical certificate
    /// with the request. The two-stage workflow (TL/BM stage → HR final) is applied by the
    /// management side: approval consumes reserved leave days, rejection releases them.
    /// </summary>
    public interface IEmployeeRequestService
    {
        Task<IReadOnlyList<EmployeeRequestDto>> GetRequestsAsync(
            int actorUserId, int employeeId, string? status, int? activeGymId, CancellationToken cancellationToken = default);

        Task<EmployeeRequestDto> GetRequestAsync(
            int actorUserId, int requestId, int? activeGymId, CancellationToken cancellationToken = default);

        Task<EmployeeRequestDto> CreateAsync(
            int actorUserId, int employeeId, CreateEmployeeRequestDto request,
            AttachmentUpload? attachment = default, CancellationToken cancellationToken = default);

        Task CancelAsync(int actorUserId, int requestId, CancellationToken cancellationToken = default);

        /// <summary>Streams the file riding with a request (the sick-leave medical certificate).</summary>
        Task<FileDownload> DownloadAttachmentAsync(
            int actorUserId, int requestId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Monthly excused-hours budget (late attendance / early leave) of one employee.</summary>
        Task<ExcusedHoursBudgetDto> GetExcusedHoursBudgetAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Active employees of the caller's own gym (id + name) for the shift-swap
        /// colleague pickers. Self-service: only the swap requester needs it.
        /// </summary>
        Task<IReadOnlyList<EmployeeColleagueDto>> GetColleaguesAsync(
            int actorUserId, int employeeId, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<RequestTypeDto>> GetRequestTypesAsync(CancellationToken cancellationToken = default);
    }
}
