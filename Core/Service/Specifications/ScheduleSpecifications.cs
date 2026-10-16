using DomainLayer.Contracts;
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
            AddInclude(a => a.ShiftTemplate);
            OrderBy = a => a.Date;
        }
    }
}
