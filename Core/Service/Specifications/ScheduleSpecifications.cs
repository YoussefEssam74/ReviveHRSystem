using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.SchedulingModule.Enums;

namespace Service.Specifications
{
    /// <summary>Published cycles of a gym overlapping a month window.</summary>
    public class PublishedCyclesByGymSpec : BaseSpecification<ShiftCycle, int>
    {
        public PublishedCyclesByGymSpec(int gymId, DateOnly monthStart, DateOnly monthEnd)
        {
            Criteria = c => c.GymId == gymId
                && c.Status == ShiftCycleStatus.Published
                && c.StartDate < monthEnd
                && c.EndDate >= monthStart;
            OrderBy = c => c.StartDate;
        }
    }

    /// <summary>Assignments of one employee inside the given cycles.</summary>
    public class ScheduleAssignmentsByEmployeeSpec : BaseSpecification<ShiftAssignment, int>
    {
        public ScheduleAssignmentsByEmployeeSpec(int employeeId, IReadOnlyCollection<int> cycleIds)
        {
            Criteria = a => a.EmployeeId == employeeId && cycleIds.Contains(a.ShiftCycleId);
            AddInclude(a => a.ShiftTemplate!);
            OrderBy = a => a.Date;
        }
    }

    /// <summary>All cycles of one gym, newest first, including the gym name.</summary>
    public class ShiftCyclesByGymSpec : BaseSpecification<ShiftCycle, int>
    {
        public ShiftCyclesByGymSpec(int gymId)
        {
            Criteria = c => c.GymId == gymId;
            AddInclude(c => c.Gym);
            OrderByDescending = c => c.StartDate;
        }

        /// <summary>The gym's cycles overlapping the given month window.</summary>
        public ShiftCyclesByGymSpec(int gymId, DateOnly monthStart)
        {
            var monthEnd = monthStart.AddMonths(1);
            Criteria = c => c.GymId == gymId && c.StartDate < monthEnd && c.EndDate >= monthStart;
            OrderBy = c => c.StartDate;
        }
    }

    /// <summary>One cycle with its gym and assignments loaded (detail, publish, conflicts).</summary>
    public class ShiftCycleByIdSpec : BaseSpecification<ShiftCycle, int>
    {
        public ShiftCycleByIdSpec(int cycleId)
        {
            Criteria = c => c.Id == cycleId;
            AddInclude(c => c.Gym);
            AddInclude(c => c.ShiftAssignments);
        }
    }

    /// <summary>The gym's latest cycle ending strictly before <paramref name="before"/> (copy-previous default source).</summary>
    public class PreviousShiftCycleByGymSpec : BaseSpecification<ShiftCycle, int>
    {
        public PreviousShiftCycleByGymSpec(int gymId, DateOnly before)
        {
            Criteria = c => c.GymId == gymId && c.EndDate < before;
            OrderByDescending = c => c.EndDate;
        }
    }

    /// <summary>Active shift templates of one gym (legend, detail, Edit Shift select).</summary>
    public class ShiftTemplatesByGymSpec : BaseSpecification<ShiftTemplate, int>
    {
        public ShiftTemplatesByGymSpec(int gymId)
        {
            Criteria = t => t.GymId == gymId && t.IsActive;
            OrderBy = t => t.StartTime;
        }
    }

    /// <summary>All templates of one gym, inactive included (conflict detection).</summary>
    public class AnyShiftTemplatesByGymSpec : BaseSpecification<ShiftTemplate, int>
    {
        public AnyShiftTemplatesByGymSpec(int gymId)
        {
            Criteria = t => t.GymId == gymId;
        }
    }

    /// <summary>A fixed set of employees by id, with position and gym names (roster rows).</summary>
    public class EmployeesByIdsSpec : BaseSpecification<Employee, int>
    {
        public EmployeesByIdsSpec(int[] ids)
        {
            Criteria = e => ids.Contains(e.Id);
            AddInclude(e => e.Position);
            AddInclude(e => e.Gym);
        }
    }

    /// <summary>
    /// Assignments of a fixed employee set inside a date window — used to find
    /// rows held by other cycles (the (EmployeeId, Date) unique index forces
    /// re-parenting instead of inserting a duplicate).
    /// </summary>
    public class ShiftAssignmentsOfEmployeesInRangeSpec : BaseSpecification<ShiftAssignment, int>
    {
        public ShiftAssignmentsOfEmployeesInRangeSpec(int[] employeeIds, DateOnly from, DateOnly to)
        {
            Criteria = a => employeeIds.Contains(a.EmployeeId) && a.Date >= from && a.Date <= to;
        }
    }

    /// <summary>
    /// Approved full-day off requests (Day Off / Sick Leave) of these employees
    /// whose date range overlaps [from, to] — the schedule conflict source
    /// ("approved Day Off but a shift is assigned").
    /// </summary>
    public class ApprovedDayOffRequestsOverlappingSpec : BaseSpecification<EmployeeRequest, int>
    {
        public ApprovedDayOffRequestsOverlappingSpec(int[] employeeIds, DateOnly from, DateOnly to)
        {
            var blockingTypes = new[] { "Day Off", "Sick Leave" };
            Criteria = r => r.Status == RequestStatus.Approved
                && blockingTypes.Contains(r.Type)
                && employeeIds.Contains(r.EmployeeId)
                && (r.TargetEndDate ?? r.RequestDate) >= from
                && (r.TargetStartDate ?? r.RequestDate) <= to;
        }
    }
}
