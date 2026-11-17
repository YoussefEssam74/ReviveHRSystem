using Shared.DataTransferObject.Attendance;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// HR attendance management (S4, Section 4 A1/A3/A4/A5/A7): the attendance
    /// directory grid, the manual-entry / quick-mark day write, corrections with
    /// their audit trail, and the employee-file attendance history. Gym scoping
    /// and the attendance.view / attendance.manual_entry / attendance.edit keys
    /// are enforced here (ADR-003), separate from the kiosk punch flow in
    /// <see cref="IAttendanceService"/>.
    /// </summary>
    public interface IAttendanceManagementService
    {
        /// <summary>
        /// A1 — the attendance directory. Composes one row per (employee, day):
        /// stored records plus derived Off / Scheduled / Absent days from the
        /// shift assignments and approved Day Off requests. Query supports a
        /// single date or a from/to range (default today), the gym filter,
        /// employeeId, the display status, and paging.
        /// </summary>
        Task<AttendanceListResponse> GetAttendanceAsync(int? actorUserId, AttendanceListQuery query, int? activeGymId = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// A3/A5 — manual entry / quick marks: upserts the full-day record for
        /// one employee (check-in, check-out, status, notes = the audited
        /// reason). Requires attendance.manual_entry on the employee's gym.
        /// </summary>
        Task<HrAttendanceRecordResponse> RecordManualEntryAsync(int? actorUserId, HrManualAttendanceRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// A4 — corrects an existing record: applies the new times/status and
        /// writes an AttendanceCorrection audit row (reason required, editor +
        /// timestamp server-stamped). Requires attendance.edit on the record's gym.
        /// </summary>
        Task<HrAttendanceRecordResponse> CorrectRecordAsync(int? actorUserId, int recordId, AttendanceCorrectionRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// A7 — the employee file's attendance history: one composed row per past
        /// or current day of the month (newest first) plus the month totals
        /// (present/late/absent/off/hours/expected). Requires attendance.view on
        /// the employee's gym.
        /// </summary>
        Task<EmployeeAttendanceResponse> GetEmployeeAttendanceAsync(int? actorUserId, int employeeId, EmployeeAttendanceQuery query, CancellationToken cancellationToken = default);
    }
}
