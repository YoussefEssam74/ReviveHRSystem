using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Self-service requests (mock §10 My Requests): create, list, detail, cancel.
    /// Leave-type requests reserve annual leave on submit (PendingDays) and consume it
    /// on approval; the two-stage workflow (TL/BM stage → HR final) is applied by the
    /// management side. Types are configurable (roles guide §7).
    /// </summary>
    public interface IEmployeeRequestService
    {
        Task<IReadOnlyList<EmployeeRequestDto>> GetRequestsAsync(
            int actorUserId, int employeeId, string? status, int? activeGymId, CancellationToken cancellationToken = default);

        Task<EmployeeRequestDto> GetRequestAsync(
            int actorUserId, int requestId, int? activeGymId, CancellationToken cancellationToken = default);

        Task<EmployeeRequestDto> CreateAsync(
            int actorUserId, int employeeId, CreateEmployeeRequestDto request, CancellationToken cancellationToken = default);

        Task CancelAsync(int actorUserId, int requestId, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<RequestTypeDto>> GetRequestTypesAsync(CancellationToken cancellationToken = default);
    }
}
