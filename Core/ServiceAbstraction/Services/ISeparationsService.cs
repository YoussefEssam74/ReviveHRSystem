using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Separation;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Separations / exit lifecycle (api-spec-from-ui.md §5.6, T1–T6 + E19).
    /// A case starts Requested (BM termination request) or Notice Period (HR-initiated
    /// offboard), walks the five exit-checklist steps, records the HR exit verdict,
    /// and finalizes by archiving the employee record.
    /// </summary>
    public interface ISeparationsService
    {
        /// <summary>T1 — GET /api/separations: paged pipeline, gym/status/type filtered (employees.view).</summary>
        Task<SeparationListResponse> GetSeparationsAsync(int? actorUserId, SeparationListQuery query, CancellationToken cancellationToken = default);

        /// <summary>T1 detail — GET /api/separations/{id} (employees.view, gym-gated).</summary>
        Task<SeparationDataResponse> GetSeparationAsync(int? actorUserId, int separationId, CancellationToken cancellationToken = default);

        /// <summary>T2 — POST /api/separations: Branch-Manager termination request (closed reason vocabulary).</summary>
        Task<SeparationDataResponse> RequestSeparationAsync(int? actorUserId, CreateSeparationRequest request, CancellationToken cancellationToken = default);

        /// <summary>E19 — POST /api/employees/{id}/offboard: HR-initiated offboarding (creates the case + moves the employee to Notice Period).</summary>
        Task<OffboardResponse> OffboardEmployeeAsync(int? actorUserId, int employeeId, OffboardEmployeeRequest request, CancellationToken cancellationToken = default);

        /// <summary>T3 — PUT /api/separations/{id}/checklist: toggle one exit step (first tick moves Requested/Notice Period → Exit In Progress).</summary>
        Task<SeparationChecklistDataResponse> UpdateChecklistAsync(int? actorUserId, int separationId, SeparationChecklistRequest request, CancellationToken cancellationToken = default);

        /// <summary>T4 — PUT /api/separations/{id}/stage: move along Requested → Notice Period → Exit In Progress → Under Review → Completed.</summary>
        Task<MessageResponse> UpdateStageAsync(int? actorUserId, int separationId, SeparationStageRequest request, CancellationToken cancellationToken = default);

        /// <summary>T5 — PUT /api/separations/{id}/verdict: store final reason + settlement + rehire; status → Under Review.</summary>
        Task<MessageResponse> SaveVerdictAsync(int? actorUserId, int separationId, SeparationVerdictRequest request, CancellationToken cancellationToken = default);

        /// <summary>T6 — POST /api/separations/{id}/finalize: requires a complete checklist + verdict; archives the employee.</summary>
        Task<MessageResponse> FinalizeAsync(int? actorUserId, int separationId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Shared case-creation core (T2/E19 and approving an Offboard action request all
        /// land here): employees.offboard on the employee's gym, one open case per employee,
        /// the five exit tasks pre-seeded. Returns the new separation id.
        /// initialStatus: "Requested" (BM termination request) | "Notice Period" (HR-initiated).
        /// </summary>
        Task<int> CreateOffboardingCaseAsync(int? actorUserId, int employeeId, DateOnly lastDay, string reason, string? notes, string separationType, string initialStatus, CancellationToken cancellationToken = default);
    }
}
