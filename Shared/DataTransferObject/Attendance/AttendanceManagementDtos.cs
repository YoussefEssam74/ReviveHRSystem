namespace Shared.DataTransferObject.Attendance
{
    // ------------------------------------------------------------------
    // HR attendance management (S4, Section 4 A1/A3/A4/A5/A7/A10): contracts
    // for the attendance directory grid, the manual-entry / quick-mark form,
    // corrections, the employee-file attendance history, and the biometric
    // pairing-code modal. Shapes mirror the mock UI's HR pages: rows carry
    // display strings ('On Time', '08:00', 'Manual'), and envelopes follow
    // the house conventions ({items,page,pageSize,total,totalPages} for lists,
    // {data:...} for single records).
    // ------------------------------------------------------------------

    /// <summary>
    /// Query for GET /api/attendance (A1). Accepts a single date or a from/to
    /// range (defaults to today), the gym filter (gym or gymId — Top Management
    /// may omit it to see all gyms), an employeeId, and the display status the
    /// UI filter tabs send ('On Time', 'Late', 'Absent', 'Early Checkout',
    /// 'Off', 'Scheduled').
    /// </summary>
    public class AttendanceListQuery
    {
        public string? Date { get; init; }
        public string? From { get; init; }
        public string? To { get; init; }
        public int? Gym { get; init; }
        public int? GymId { get; init; }
        public int? EmployeeId { get; init; }
        public string? Status { get; init; }
        public int Page { get; init; } = 1;
        public int PageSize { get; init; } = 20;
    }

    /// <summary>
    /// One grid row (A1/A3/A4/A5). Id is null for synthesized roster rows (Off /
    /// Scheduled / Absent days with no stored record); checkIn/checkOut are
    /// 'HH:mm' display strings; correctedBy/correctedAt come from the record's
    /// latest audit correction.
    /// </summary>
    public class AttendanceListItem
    {
        public int? Id { get; init; }
        public int EmployeeId { get; init; }
        public required string Name { get; init; }
        public required string Gym { get; init; }
        public required string Date { get; init; }
        public string Shift { get; init; } = string.Empty;
        public string? CheckIn { get; init; }
        public string? CheckOut { get; init; }
        public required string Status { get; init; }
        public string Source { get; init; } = string.Empty;
        public string? Notes { get; init; }
        public string? CorrectedBy { get; init; }
        public string? CorrectedAt { get; init; }
    }

    /// <summary>Paged envelope for GET /api/attendance (A1).</summary>
    public class AttendanceListResponse
    {
        public List<AttendanceListItem> Items { get; init; } = [];
        public int Page { get; init; }
        public int PageSize { get; init; }
        public int Total { get; init; }
        public int TotalPages { get; init; }
    }

    /// <summary>
    /// Manual-entry form (A3/A5 — the Manual Entry modal and quick marks): writes
    /// the full day record for one employee. Status accepts the display values the
    /// modal offers ('On Time', 'Late', 'Absent', 'Early Checkout', 'Off');
    /// 'Scheduled' is rejected (it is a derived UI-only state).
    /// </summary>
    public class HrManualAttendanceRequest
    {
        public required string EmployeeId { get; init; }
        public required string Date { get; init; }
        public string? CheckIn { get; init; }
        public string? CheckOut { get; init; }
        public required string Status { get; init; }
        public required string Reason { get; init; }
    }

    /// <summary>
    /// Correction body (A4 — the Correction modal, also used by quick marks):
    /// reason is mandatory and the audit trail (correctedBy/correctedAt) is
    /// stamped server-side.
    /// </summary>
    public class AttendanceCorrectionRequest
    {
        public string? CheckIn { get; init; }
        public string? CheckOut { get; init; }
        public required string Status { get; init; }
        public required string Reason { get; init; }
    }

    /// <summary>{ data: ... } envelope for the A3/A4 record responses.</summary>
    public class HrAttendanceRecordResponse
    {
        public required AttendanceListItem Data { get; init; }
    }

    /// <summary>Query for GET /api/employees/{id}/attendance (A7): month 'yyyy-MM' (default current), paged newest-first.</summary>
    public class EmployeeAttendanceQuery
    {
        public string? Month { get; init; }
        public int Page { get; init; } = 1;
        public int PageSize { get; init; } = 31;
    }

    /// <summary>One day row of the employee attendance history (A7).</summary>
    public class EmployeeAttendanceItem
    {
        public required string Date { get; init; }
        public string Shift { get; init; } = string.Empty;
        public string? CheckIn { get; init; }
        public string? CheckOut { get; init; }
        public required string Status { get; init; }
        public string? Notes { get; init; }
    }

    /// <summary>
    /// Month totals for the employee history (A7): present = On Time + Late +
    /// Early Checkout (+ Missing Checkout); hours = summed worked time; expected
    /// = summed scheduled shift duration. Future days are excluded, matching the
    /// mock UI.
    /// </summary>
    public class EmployeeAttendanceTotals
    {
        public int Total { get; init; }
        public int Present { get; init; }
        public int Late { get; init; }
        public int Early { get; init; }
        public int Absent { get; init; }
        public int Off { get; init; }
        public decimal Hours { get; init; }
        public decimal Expected { get; init; }
    }

    /// <summary>Response for GET /api/employees/{id}/attendance (A7).</summary>
    public class EmployeeAttendanceResponse
    {
        public List<EmployeeAttendanceItem> Items { get; init; } = [];
        public required EmployeeAttendanceTotals Totals { get; init; }
        public int Page { get; init; }
        public int PageSize { get; init; }
        public int Total { get; init; }
        public int TotalPages { get; init; }
    }

    /// <summary>Pairing-code request (A10 — the Pair Biometric Device modal).</summary>
    public class BiometricPairingCodeRequest
    {
        public required string StationLabel { get; init; }
    }

    /// <summary>
    /// Pairing-code response (A10): the one-time 6-digit code a kiosk redeems at
    /// POST /api/kiosk/login to obtain a station session. Echoes the station
    /// label the HR user typed, plus the code's real lifetime.
    /// </summary>
    public class BiometricPairingCodeResponse
    {
        public required string Code { get; init; }
        public int GymId { get; init; }
        public required string GymName { get; init; }
        public required string StationLabel { get; init; }
        public DateTime GeneratedAt { get; init; }
        public DateTime? ExpiresAt { get; init; }
    }
}
