using System.Linq;
using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.SchedulingModule;

namespace Service.Specifications
{
    /// <summary>Finds an active station code by its 6-digit value, including its gym.</summary>
    public class StationCodeByCodeSpec : BaseSpecification<StationCode, int>
    {
        public StationCodeByCodeSpec(string code)
        {
            var normalized = code.Trim();
            Criteria = sc => sc.Code == normalized && sc.IsActive;
            AddInclude(sc => sc.Gym);
        }
    }

    /// <summary>Finds any station code (active or not) by value — uniqueness checks.</summary>
    public class StationCodeExactSpec : BaseSpecification<StationCode, int>
    {
        public StationCodeExactSpec(string code)
        {
            var normalized = code.Trim();
            Criteria = sc => sc.Code == normalized;
        }
    }

    /// <summary>The gym's current active station code (includes its gym).</summary>
    public class ActiveStationCodeByGymSpec : BaseSpecification<StationCode, int>
    {
        public ActiveStationCodeByGymSpec(int gymId)
        {
            Criteria = sc => sc.GymId == gymId && sc.IsActive;
            AddInclude(sc => sc.Gym);
        }
    }

    /// <summary>
    /// Looks up a station session by the SHA-256 hash of its opaque token, including
    /// the gym — the hot path every station-authenticated attendance request takes.
    /// </summary>
    public class StationSessionByTokenHashSpec : BaseSpecification<StationSession, int>
    {
        public StationSessionByTokenHashSpec(string tokenHash)
        {
            Criteria = ss => ss.TokenHash == tokenHash;
            AddInclude(ss => ss.Gym);
        }
    }

    /// <summary>Finds a station session by its id, including the gym (revoke on kiosk logout).</summary>
    public class StationSessionByIdSpec : BaseSpecification<StationSession, int>
    {
        public StationSessionByIdSpec(int stationSessionId)
        {
            Criteria = ss => ss.Id == stationSessionId;
            AddInclude(ss => ss.Gym);
        }
    }

    /// <summary>Live (unrevoked, unexpired) sessions of one gym, newest first.</summary>
    public class LiveStationSessionsByGymSpec : BaseSpecification<StationSession, int>
    {
        public LiveStationSessionsByGymSpec(int gymId, DateTime nowUtc)
        {
            Criteria = ss => ss.GymId == gymId
                && ss.RevokedAtUtc == null
                && ss.ExpiresAtUtc > nowUtc;
            OrderByDescending = ss => ss.CreatedAtUtc;
        }
    }

    /// <summary>
    /// Every attendance record of one gym on one date, including the employee —
    /// the kiosk dashboard feed.
    /// </summary>
    public class AttendanceRecordsByGymDateSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceRecordsByGymDateSpec(int gymId, DateOnly date)
        {
            Criteria = ar => ar.GymId == gymId && ar.Date == date;
            AddInclude(ar => ar.Employee);
        }
    }

    /// <summary>
    /// The 10 most-recent attendance records of one gym on one date (kiosk recent-events
    /// feed). Ordering and capping happen in the database --- no full table scan in memory.
    /// </summary>
    public class RecentAttendanceRecordsByGymDateSpec : BaseSpecification<AttendanceRecord, int>
    {
        public RecentAttendanceRecordsByGymDateSpec(int gymId, DateOnly date)
        {
            Criteria = ar => ar.GymId == gymId && ar.Date == date;
            AddInclude(ar => ar.Employee);
            // EF Core translates the nullable coalesce as COALESCE(CheckOutTime, CheckInTime) DESC.
            OrderByDescending = ar => (object)(ar.CheckOutTime ?? ar.CheckInTime ?? DateTime.MinValue);
            Take = 10;
            IsPaginated = true;
        }
    }

    /// <summary>
    /// COUNT of employees who have checked in at one gym on one date (PresentCount).<br/>
    /// Used instead of loading all records into memory and calling .Count(r => r.CheckInTime is not null).<br/>
    /// </summary>
    public class CheckedInCountByGymDateSpec : BaseSpecification<AttendanceRecord, int>
    {
        public CheckedInCountByGymDateSpec(int gymId, DateOnly date)
        {
            Criteria = ar => ar.GymId == gymId && ar.Date == date && ar.CheckInTime != null;
        }
    }

    /// <summary>
    /// Real shifts (not days off) scheduled at one gym on one date — the kiosk
    /// dashboard's "scheduled today" count.
    /// </summary>
    public class ShiftAssignmentsByGymDateSpec : BaseSpecification<ShiftAssignment, int>
    {
        public ShiftAssignmentsByGymDateSpec(int gymId, DateOnly date)
        {
            Criteria = sa => sa.ShiftCycle.GymId == gymId
                && sa.Date == date
                && sa.ShiftTemplateId != null;
        }
    }

    /// <summary>
    /// Resolves an employee by numeric id or by employee number (e.g. "EMP-1042").
    /// </summary>
    public class EmployeeLookupSpec : BaseSpecification<Employee, int>
    {
        public EmployeeLookupSpec(string employeeReference)
        {
            var reference = employeeReference.Trim();
            int? numericId = int.TryParse(reference, out int parsed) ? parsed : null;
            Criteria = e => (numericId.HasValue && e.Id == numericId.Value) || e.EmployeeNumber == reference;
        }
    }

    /// <summary>Finds records for the event date and the previous date for overnight shifts.</summary>
    public class AttendanceRecordByEmployeeDatesSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceRecordByEmployeeDatesSpec(int employeeId, DateOnly eventDate)
        {
            var previousDate = eventDate.AddDays(-1);
            Criteria = ar => ar.EmployeeId == employeeId && (ar.Date == eventDate || ar.Date == previousDate);
            AddInclude(ar => ar.ScheduledShiftTemplate!);
        }
    }

    /// <summary>Finds assignments for the event date and previous date for overnight shifts.</summary>
    public class ShiftAssignmentsForAttendanceSpec : BaseSpecification<ShiftAssignment, int>
    {
        public ShiftAssignmentsForAttendanceSpec(int employeeId, DateOnly eventDate)
        {
            var previousDate = eventDate.AddDays(-1);
            Criteria = sa => sa.EmployeeId == employeeId && (sa.Date == eventDate || sa.Date == previousDate);
            AddInclude(sa => sa.ShiftCycle.Gym);
            AddInclude(sa => sa.ShiftTemplate!);
        }
    }

    /// <summary>
    /// Attendance records of one employee in one calendar month, with the scheduled
    /// shift template loaded (records are rendered against the shift they worked).
    /// </summary>
    public class AttendanceByEmployeeSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceByEmployeeSpec(int employeeId, DateOnly monthStart)
        {
            var monthEnd = monthStart.AddMonths(1);
            Criteria = r => r.EmployeeId == employeeId && r.Date >= monthStart && r.Date < monthEnd;
            AddInclude(r => r.ScheduledShiftTemplate!);
            OrderByDescending = r => r.Date;
        }
    }

    /// <summary>Attendance records of one employee on a single date.</summary>
    public class AttendanceByEmployeeDateSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceByEmployeeDateSpec(int employeeId, DateOnly date)
        {
            Criteria = r => r.EmployeeId == employeeId && r.Date == date;
        }
    }

    // ------------------------------------------------------------------
    // S4 — HR attendance management (A1/A3/A4/A7)
    // ------------------------------------------------------------------

    /// <summary>
    /// Roster employees for the attendance directory: everyone except terminated,
    /// scoped to the caller's gyms (null = all gyms, Top Management).
    /// </summary>
    public class EmployeesForRosterSpec : BaseSpecification<Employee, int>
    {
        public EmployeesForRosterSpec(int[]? gymIds)
        {
            Criteria = e => e.Status != EmployeeStatus.Terminated
                && (gymIds == null || gymIds.Contains(e.GymId));
            AddInclude(e => e.Gym);
            OrderBy = e => e.FullName;
        }
    }

    /// <summary>
    /// Attendance records across a date range for the given employees (A1/A7
    /// compose). Employees are pre-scoped by the caller, so this filters by the
    /// id set; shift labels come from the assignment index and corrections are
    /// loaded separately (collection-then-include is not supported by the
    /// specification evaluator).
    /// </summary>
    public class AttendanceRecordsByEmployeeIdsRangeSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceRecordsByEmployeeIdsRangeSpec(int[] employeeIds, DateOnly from, DateOnly to)
        {
            Criteria = ar => employeeIds.Contains(ar.EmployeeId)
                && ar.Date >= from && ar.Date <= to;
        }
    }

    /// <summary>Shift assignments across a date range (shift labels + off days for the roster compose).</summary>
    public class ShiftAssignmentsByEmployeeIdsRangeSpec : BaseSpecification<ShiftAssignment, int>
    {
        public ShiftAssignmentsByEmployeeIdsRangeSpec(int[] employeeIds, DateOnly from, DateOnly to)
        {
            Criteria = sa => employeeIds.Contains(sa.EmployeeId)
                && sa.Date >= from && sa.Date <= to;
            AddInclude(sa => sa.ShiftTemplate!);
        }
    }

    /// <summary>Approved Day Off requests whose effective span overlaps the range (roster "Off — Day Off approved").</summary>
    public class ApprovedDayOffRequestsByEmployeeIdsSpec : BaseSpecification<EmployeeRequest, int>
    {
        public ApprovedDayOffRequestsByEmployeeIdsSpec(int[] employeeIds, DateOnly from, DateOnly to)
        {
            Criteria = r => r.Type == "Day Off"
                && r.Status == RequestStatus.Approved
                && employeeIds.Contains(r.EmployeeId)
                && (r.TargetStartDate ?? r.RequestDate) <= to
                && (r.TargetEndDate ?? r.RequestDate) >= from;
        }
    }

    /// <summary>Audit corrections for the given records, with editor profile (correctedBy display).</summary>
    public class AttendanceCorrectionsByRecordIdsSpec : BaseSpecification<AttendanceCorrection, int>
    {
        public AttendanceCorrectionsByRecordIdsSpec(int[] recordIds)
        {
            Criteria = c => recordIds.Contains(c.AttendanceRecordId);
            AddInclude(c => c.CorrectedByUser);
            AddInclude(c => c.CorrectedByUser.EmployeeProfile!);
        }
    }

    /// <summary>One employee with their gym (attendance history + manual-entry target lookup).</summary>
    public class EmployeeForAttendanceSpec : BaseSpecification<Employee, int>
    {
        public EmployeeForAttendanceSpec(int employeeId)
        {
            Criteria = e => e.Id == employeeId;
            AddInclude(e => e.Gym);
        }
    }

    /// <summary>
    /// Resolves an employee by numeric id or employee number ("EMP-1042") with
    /// their gym — the manual-entry target lookup (A3 needs Gym.Name for the response).
    /// </summary>
    public class EmployeeWithGymByReferenceSpec : BaseSpecification<Employee, int>
    {
        public EmployeeWithGymByReferenceSpec(string employeeReference)
        {
            var reference = employeeReference.Trim();
            int? numericId = int.TryParse(reference, out int parsed) ? parsed : null;
            Criteria = e => (numericId.HasValue && e.Id == numericId.Value) || e.EmployeeNumber == reference;
            AddInclude(e => e.Gym);
        }
    }

    /// <summary>One attendance record by id with employee/gym and shift template (A4 correction source).</summary>
    public class AttendanceRecordByIdWithDetailsSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceRecordByIdWithDetailsSpec(int recordId)
        {
            Criteria = ar => ar.Id == recordId;
            AddInclude(ar => ar.Employee);
            AddInclude(ar => ar.Employee.Gym);
            AddInclude(ar => ar.ScheduledShiftTemplate!);
        }
    }

    /// <summary>The stored record for one employee on one date, with its shift template (manual-entry upsert, A3).</summary>
    public class AttendanceRecordByEmployeeDateSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceRecordByEmployeeDateSpec(int employeeId, DateOnly date)
        {
            Criteria = ar => ar.EmployeeId == employeeId && ar.Date == date;
            AddInclude(ar => ar.ScheduledShiftTemplate!);
        }
    }

    /// <summary>Today's assignment for one employee (pins the manual entry's shift template).</summary>
    public class ShiftAssignmentByEmployeeDateSpec : BaseSpecification<ShiftAssignment, int>
    {
        public ShiftAssignmentByEmployeeDateSpec(int employeeId, DateOnly date)
        {
            Criteria = sa => sa.EmployeeId == employeeId && sa.Date == date;
        }
    }
}
