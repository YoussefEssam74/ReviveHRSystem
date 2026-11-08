using DomainLayer.Models.EmployeeModule.Enums;

namespace Service.Services
{
    /// <summary>
    /// One request type the employee can submit (product spec: the catalog agreed
    /// with the product owner). The flags carry the submission rules so both the
    /// service (validation) and the client (form rendering and inline warnings)
    /// read the same definition.
    /// </summary>
    public sealed record RequestTypeDefinition(
        string Id,
        string Label,
        IReadOnlyList<string> Fields,
        LeaveType? ConsumesLeave,
        bool RequiresAttachment,
        bool RequiresColleague,
        bool RequiresAmount,
        bool LimitedByMonthlyExcusedHours,
        bool RequiresTargetDate);

    /// <summary>
    /// The catalog of employee request types. Types are configuration, not personal
    /// data (roles guide §7); resolution accepts either the id or the label so the
    /// stored <c>Type</c> label always maps back to its rules.
    /// </summary>
    public static class RequestTypeCatalog
    {
        public const string AnnualLeaveId = "annual-leave";
        public const string SickLeaveId = "sick-leave";
        public const string LateAttendanceId = "late-attendance";
        public const string EarlyLeaveId = "early-leave";
        public const string ShiftSwapId = "shift-swap";
        public const string WeeklyOffSwapId = "weekly-off-swap";
        public const string CheckInCorrectionId = "check-in-correction";
        public const string SalaryAdvanceId = "salary-advance";
        public const string PaidHolidayId = "paid-holiday";
        public const string DeductionCorrectionId = "deduction-correction";

        /// <summary>Stored request rows carry the label, not the id — this one is matched by label.</summary>
        public const string DeductionCorrectionLabel = "Deduction Correction";

        private static readonly IReadOnlyList<RequestTypeDefinition> Types = new[]
        {
            new RequestTypeDefinition(
                AnnualLeaveId, "Annual Leave",
                new[] { "date-from", "date-to", "reason" },
                LeaveType.Annual, false, false, false, false, false),
            new RequestTypeDefinition(
                SickLeaveId, "Sick Leave",
                new[] { "date-from", "date-to", "reason", "certificate" },
                LeaveType.Sick, true, false, false, false, false),
            new RequestTypeDefinition(
                LateAttendanceId, "Late Attendance",
                new[] { "date", "time", "reason" },
                null, false, false, false, true, false),
            new RequestTypeDefinition(
                EarlyLeaveId, "Early Leave",
                new[] { "date", "time", "reason" },
                null, false, false, false, true, false),
            new RequestTypeDefinition(
                ShiftSwapId, "Shift Swap",
                new[] { "date-from", "date-to", "colleague", "reason" },
                null, false, true, false, false, false),
            new RequestTypeDefinition(
                WeeklyOffSwapId, "Weekly Off Swap",
                new[] { "date", "target-date", "colleague", "reason" },
                null, false, true, false, false, true),
            new RequestTypeDefinition(
                CheckInCorrectionId, "Check-in Correction",
                new[] { "date", "time", "reason" },
                null, false, false, false, false, false),
            new RequestTypeDefinition(
                SalaryAdvanceId, "Salary Advance",
                new[] { "amount", "reason" },
                null, false, false, true, false, false),
            new RequestTypeDefinition(
                PaidHolidayId, "Paid Holiday",
                new[] { "date", "reason" },
                null, false, false, false, false, false),
            new RequestTypeDefinition(
                DeductionCorrectionId, DeductionCorrectionLabel,
                new[] { "date", "reason" },
                null, false, false, false, false, false)
        };

        public static IReadOnlyList<RequestTypeDefinition> All => Types;

        /// <summary>Resolves a submitted type (id or label) to its definition.</summary>
        public static RequestTypeDefinition? Find(string? type)
        {
            if (string.IsNullOrWhiteSpace(type))
            {
                return null;
            }

            var trimmed = type.Trim();
            return Types.FirstOrDefault(t =>
                t.Id.Equals(trimmed, StringComparison.OrdinalIgnoreCase)
                || t.Label.Equals(trimmed, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>Resolves the definition of a stored request row by its label.</summary>
        public static RequestTypeDefinition? FindByLabel(string? label) => Find(label);

        /// <summary>Leave type a request consumes, or null when it consumes none.</summary>
        public static LeaveType? LeaveTypeFor(string? type) => Find(type)?.ConsumesLeave;

        /// <summary>Types whose hours count against the gym's monthly excused-hours cap.</summary>
        public static bool CountsAgainstExcusedHoursCap(string? type) =>
            Find(type)?.LimitedByMonthlyExcusedHours ?? false;
    }
}
