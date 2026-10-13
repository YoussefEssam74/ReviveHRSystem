using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Employee management (mock Â§21): directory scoped to the caller's team/gym,
    /// create, edit and employment-status changes. Status changes are recorded on the
    /// employment-history timeline (history is preserved, never overwritten).
    /// </summary>
    public interface IEmployeeManagementService
    {
        Task<PaginationResult<EmployeeSummaryDto>> GetDirectoryAsync(
            int actorUserId, int? activeGymId, EmployeeQueryParams query, CancellationToken cancellationToken = default);

        Task<EmployeeSummaryDto> CreateAsync(
            int actorUserId, int? activeGymId, CreateEmployeeDto request, CancellationToken cancellationToken = default);

        Task<EmployeeSummaryDto> UpdateAsync(
            int actorUserId, int employeeId, int? activeGymId, UpdateEmployeeDto request, CancellationToken cancellationToken = default);

        Task ChangeStatusAsync(
            int actorUserId, int employeeId, int? activeGymId, ChangeEmployeeStatusDto request, CancellationToken cancellationToken = default);
    }
}
