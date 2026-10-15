using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Schedule;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Shifts &amp; schedule (S5, Section 4 S1–S8): the cycle selector, cycle
    /// detail with the weekly roster grid, draft creation, copy-previous,
    /// publish (with employee notifications), conflict detection, the Edit
    /// Shift grid save, and the gym's shift-template legend. Gym scoping and
    /// the schedule.view / schedule.manage keys are enforced here (ADR-003).
    /// S9/S10 are composed from GET /api/attendance and GET /api/requests.
    /// </summary>
    public interface IShiftCycleService
    {
        /// <summary>S1 — all cycles of one gym (newest first) for the selector chips.</summary>
        Task<IReadOnlyList<ShiftCycleListItem>> GetShiftCyclesAsync(int? actorUserId, int gymId, CancellationToken cancellationToken = default);

        /// <summary>
        /// S2 — one cycle with the legend, the per-employee weekly pattern
        /// (days[0 = Mon … 6 = Sun], null = Off), and the current conflicts.
        /// Powers the calendar, roster, day detail, and the employee file's
        /// Schedule tab (A9).
        /// </summary>
        Task<ShiftCycleDetailResponse> GetShiftCycleAsync(int? actorUserId, int cycleId, CancellationToken cancellationToken = default);

        /// <summary>S3 — creates a Draft cycle for the gym → 201 { data }. Dates must not overlap an existing cycle.</summary>
        Task<ShiftCycleDataResponse> CreateShiftCycleAsync(int? actorUserId, int gymId, CreateShiftCycleRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// S4 — copies the previous cycle's weekly pattern onto this cycle's
        /// dates (sourceCycleId omitted = the gym's latest cycle ending before
        /// this one). Target must be Draft. An employee holds one shift per
        /// date system-wide, so overlapping dates are re-parented to this cycle.
        /// </summary>
        Task<CopyShiftCycleResponse> CopyPreviousCycleAsync(int? actorUserId, int cycleId, CopyShiftCycleRequest? request, CancellationToken cancellationToken = default);

        /// <summary>
        /// S5 — publishes a Draft cycle (stamps publisher/time, notifies every
        /// scheduled employee) and warns in the message when conflicts remain.
        /// </summary>
        Task<MessageResponse> PublishShiftCycleAsync(int? actorUserId, int cycleId, CancellationToken cancellationToken = default);

        /// <summary>S6 — conflict list for the toolbar pill and publish warning.</summary>
        Task<ShiftConflictsResponse> GetShiftCycleConflictsAsync(int? actorUserId, int cycleId, CancellationToken cancellationToken = default);

        /// <summary>
        /// S7 — applies the Edit Shift grid: one entry per (employee, weekday)
        /// upserted across every matching date of the cycle; null templateId
        /// writes an explicit Off. Target must be Draft.
        /// </summary>
        Task<MessageResponse> SetShiftAssignmentsAsync(int? actorUserId, int cycleId, SetShiftAssignmentsRequest request, CancellationToken cancellationToken = default);

        /// <summary>S8 — active shift templates of one gym (legend, chips, Edit Shift select).</summary>
        Task<IReadOnlyList<ShiftTemplateItem>> GetShiftTemplatesAsync(int? actorUserId, int gymId, CancellationToken cancellationToken = default);
    }
}
