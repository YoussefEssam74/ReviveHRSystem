namespace Shared.DataTransferObject.Schedule
{
    /// <summary>S1 — one cycle selector chip: id, label, status.</summary>
    public class ShiftCycleListItem
    {
        public int Id { get; init; }

        public required string Label { get; init; }

        /// <summary>'Draft' | 'Published' | 'Archived'.</summary>
        public required string Status { get; init; }
    }

    /// <summary>S3 — the { data } envelope returned by create.</summary>
    public class ShiftCycleDataResponse
    {
        public required ShiftCycleListItem Data { get; init; }
    }

    /// <summary>
    /// S3 — create draft body. The UI sends label + dates + gymId; the route's
    /// gymId is the source of truth when both are present. Label is optional
    /// (server derives "Sep 13 – Sep 22" from the dates when omitted).
    /// </summary>
    public class CreateShiftCycleRequest
    {
        public string? Label { get; init; }

        /// <summary>Cycle start, yyyy-MM-dd.</summary>
        public required string StartDate { get; init; }

        /// <summary>Cycle end (inclusive), yyyy-MM-dd.</summary>
        public required string EndDate { get; init; }

        public int? GymId { get; init; }
    }

    /// <summary>S8 — one legend / Edit-Shift entry. Colors are server-derived presentation hints.</summary>
    public class ShiftTemplateItem
    {
        public int Id { get; init; }

        public required string Name { get; init; }

        /// <summary>Start time, HH:mm.</summary>
        public required string Start { get; init; }

        /// <summary>End time, HH:mm (00:00 for overnight shifts).</summary>
        public required string End { get; init; }

        public required string Color { get; init; }

        public required string BgColor { get; init; }

        public required string TextColor { get; init; }

        public bool IsOff { get; init; }
    }

    /// <summary>
    /// S2 — one employee's weekly pattern row. days[0 = Monday … 6 = Sunday]
    /// holds the shiftTemplateId scheduled that weekday, or null for Off.
    /// </summary>
    public class ShiftAssignmentRow
    {
        public int EmployeeId { get; init; }

        public required string Name { get; init; }

        public required string Position { get; init; }

        public required string Gym { get; init; }

        public required string Initials { get; init; }

        public List<int?> Days { get; init; } = [];
    }

    /// <summary>S6 — one conflict flag for the toolbar pill / publish warning.</summary>
    public class ShiftConflictItem
    {
        public int EmployeeId { get; init; }

        /// <summary>Weekday of the offending assignment, 0 = Monday … 6 = Sunday.</summary>
        public int Day { get; init; }

        public required string Message { get; init; }
    }

    /// <summary>S6 — { conflicts, count }.</summary>
    public class ShiftConflictsResponse
    {
        public List<ShiftConflictItem> Conflicts { get; init; } = [];

        public int Count => Conflicts.Count;
    }

    /// <summary>S2 — cycle detail: legend, roster rows, and current conflicts.</summary>
    public class ShiftCycleDetailResponse
    {
        public int Id { get; init; }

        public required string Label { get; init; }

        public required string Status { get; init; }

        public List<ShiftTemplateItem> ShiftTemplates { get; init; } = [];

        public List<ShiftAssignmentRow> Assignments { get; init; } = [];

        public List<ShiftConflictItem> Conflicts { get; init; } = [];
    }

    /// <summary>S4 — copy-previous body; sourceCycleId omitted picks the gym's latest earlier cycle.</summary>
    public class CopyShiftCycleRequest
    {
        public int? SourceCycleId { get; init; }
    }

    /// <summary>S4 — { message, copied }.</summary>
    public class CopyShiftCycleResponse
    {
        public required string Message { get; init; }

        public int Copied { get; init; }
    }

    /// <summary>S7 — Edit Shift save body.</summary>
    public class SetShiftAssignmentsRequest
    {
        public List<ShiftAssignmentInput> Assignments { get; init; } = [];
    }

    public class ShiftAssignmentInput
    {
        public int EmployeeId { get; init; }

        /// <summary>Weekday, 0 = Monday … 6 = Sunday.</summary>
        public int Day { get; init; }

        /// <summary>Shift template id, or null for Off.</summary>
        public int? ShiftTemplateId { get; init; }
    }
}
