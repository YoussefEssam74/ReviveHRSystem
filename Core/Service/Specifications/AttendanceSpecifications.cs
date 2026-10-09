using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.EmployeeModule;
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
}
