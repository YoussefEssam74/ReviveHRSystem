using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Request;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// HR requests module (S3, Section 4 R1–R7 + A2/A6/A8): the paged inbox with the
    /// UI's filter vocabulary, request detail, on-behalf creation, the HR decision
    /// stage (approve/reject with the Day Off / Sick Leave payment handling),
    /// decision undo, bulk approve, archive/restore, and the per-employee requests
    /// tab. Every method runs the ADR-003 guard (permission key + gym scope).
    /// </summary>
    public interface IRequestService
    {
        /// <summary>Paged, gym-scoped requests inbox (R1) — status/type/gym/date/quick filters and sorting.</summary>
        Task<RequestListResponse> GetRequestsAsync(int? actorUserId, RequestListQuery query, CancellationToken cancellationToken = default);

        /// <summary>One request with its decision trail (R2).</summary>
        Task<RequestDetailResponse> GetRequestAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default);

        /// <summary>HR submits a request on an employee's behalf, by employee name (R7).</summary>
        Task<CreateRequestResponse> CreateRequestAsync(int? actorUserId, CreateRequestRequest request, CancellationToken cancellationToken = default);

        /// <summary>HR approves or rejects a pending request (R3, A6) — sets payment and the resignation offboarding prompt.</summary>
        Task<RequestDecisionResponse> DecideRequestAsync(int? actorUserId, int requestId, DecideRequestRequest request, CancellationToken cancellationToken = default);

        /// <summary>Reverts an HR decision while the requested date is still ahead (R4).</summary>
        Task<RequestDecisionResponse> UndoDecisionAsync(int? actorUserId, int requestId, UndoDecisionRequest request, CancellationToken cancellationToken = default);

        /// <summary>Approves pending requests in bulk, deriving each payment from the leave balance (R5).</summary>
        Task<BulkDecideResponse> BulkDecideAsync(int? actorUserId, BulkDecideRequest request, CancellationToken cancellationToken = default);

        /// <summary>Moves a request to the Archived tab (R6).</summary>
        Task<MessageResponse> ArchiveRequestAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default);

        /// <summary>Restores an archived request to its derived pre-archive status (R6).</summary>
        Task<MessageResponse> RestoreRequestAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default);

        /// <summary>The employee's own requests for the file's Requests tab (A8).</summary>
        Task<IReadOnlyList<EmployeeRequestItem>> GetEmployeeRequestsAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default);
    }
}
