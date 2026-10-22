using Shared.DataTransferObject.Employee;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Employee directory and lifecycle operations (S1): the directory list, create
    /// (plus CSV bulk import), profile reads/edits, status changes, employment
    /// history, documents, leave balances, and the transfer / position /
    /// compensation / contract actions. Every method runs through the ADR-003 guard
    /// (permission key + gym scope) before touching data.
    /// </summary>
    public interface IEmployeeService
    {
        /// <summary>Paged, gym-scoped, filterable employee directory.</summary>
        Task<EmployeeListResponse> GetEmployeesAsync(int? actorUserId, EmployeeListQuery query, int? activeGymId = null, CancellationToken cancellationToken = default);

        /// <summary>Onboards a new employee (user account + profile + hire history).</summary>
        Task<EmployeeDataResponse> CreateEmployeeAsync(int? actorUserId, CreateEmployeeRequest request, CancellationToken cancellationToken = default);

        /// <summary>Onboards employees from a CSV document (name, email, position, level, gym, salary).</summary>
        Task<BulkImportResultResponse> BulkImportAsync(int? actorUserId, string csvContent, CancellationToken cancellationToken = default);

        /// <summary>One employee's full profile.</summary>
        Task<EmployeeDataResponse> GetEmployeeAsync(int? actorUserId, int employeeId, int? activeGymId = null, CancellationToken cancellationToken = default);

        /// <summary>Applies edit-modal fields (name, position, status) to an employee.</summary>
        Task<EmployeeDetailResponse> UpdateEmployeeAsync(int? actorUserId, int employeeId, UpdateEmployeeRequest request, CancellationToken cancellationToken = default);

        /// <summary>Changes the employment standing and records the change in history.</summary>
        Task<EmployeeDetailResponse> ChangeStatusAsync(int? actorUserId, int employeeId, ChangeEmployeeStatusRequest request, CancellationToken cancellationToken = default);

        /// <summary>The employee's career timeline (transfers, position, salary, status…).</summary>
        Task<IReadOnlyList<EmployeeHistoryItem>> GetHistoryAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default);

        /// <summary>The employee's uploaded documents.</summary>
        Task<IReadOnlyList<EmployeeDocumentItem>> GetDocumentsAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default);

        /// <summary>Registers an uploaded document (the controller has stored the file).</summary>
        Task<EmployeeDocumentItem> AddDocumentAsync(int? actorUserId, int employeeId, EmployeeDocumentUpload upload, CancellationToken cancellationToken = default);

        /// <summary>Current-year leave balances (annual/sick/unpaid).</summary>
        Task<LeaveBalanceResponse> GetLeaveBalanceAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default);

        /// <summary>Updates the current-year leave balances.</summary>
        Task<MessageResponse> UpdateLeaveBalanceAsync(int? actorUserId, int employeeId, UpdateLeaveBalanceRequest request, CancellationToken cancellationToken = default);

        /// <summary>Moves the employee to another gym and records the transfer.</summary>
        Task<MessageResponse> TransferAsync(int? actorUserId, int employeeId, TransferEmployeeRequest request, CancellationToken cancellationToken = default);

        /// <summary>Re-anchors the employee to another position/level in their gym.</summary>
        Task<MessageResponse> ChangePositionAsync(int? actorUserId, int employeeId, PositionChangeRequest request, CancellationToken cancellationToken = default);

        /// <summary>Records a new compensation amount effective from the given date.</summary>
        Task<MessageResponse> AddCompensationAsync(int? actorUserId, int employeeId, CompensationRequest request, CancellationToken cancellationToken = default);

        /// <summary>Applies contract changes (level, salary, start date).</summary>
        Task<MessageResponse> ChangeContractAsync(int? actorUserId, int employeeId, ContractChangeRequest request, CancellationToken cancellationToken = default);

        /// <summary>Sets/clears the employee's system role and direct team permissions (E16), recorded in history.</summary>
        Task<MessageResponse> ChangeEmployeeRoleAsync(int? actorUserId, int employeeId, RoleChangeRequest request, CancellationToken cancellationToken = default);
    }
}
