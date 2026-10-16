using DomainLayer.Contracts;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.SchedulingModule.Enums;

namespace Service.Specifications
{
    /// <summary>Cycles of a gym overlapping a month window.</summary>
    public class ShiftCyclesByGymSpec : BaseSpecification<ShiftCycle, int>
    {
        public ShiftCyclesByGymSpec(int gymId, DateOnly monthStart)
        {
            var monthEnd = monthStart.AddMonths(1);
            Criteria = c => c.GymId == gymId && c.StartDate < monthEnd && c.EndDate >= monthStart;
            OrderBy = c => c.StartDate;
        }
    }

    /// <summary>All assignments of one cycle.</summary>
    public class AssignmentsByCycleSpec : BaseSpecification<ShiftAssignment, int>
    {
        public AssignmentsByCycleSpec(int cycleId)
        {
            Criteria = a => a.ShiftCycleId == cycleId;
        }
    }

    /// <summary>Assignments of one cycle for a set of employees (scoped grid).</summary>
    public class AssignmentsByCycleAndEmployeesSpec : BaseSpecification<ShiftAssignment, int>
    {
        public AssignmentsByCycleAndEmployeesSpec(int cycleId, IReadOnlyCollection<int> employeeIds)
        {
            Criteria = a => a.ShiftCycleId == cycleId && employeeIds.Contains(a.EmployeeId);
            AddInclude(a => a.Employee);
        }
    }

    /// <summary>Assignments referencing one shift template (template deletion cleanup).</summary>
    public class AssignmentsByTemplateSpec : BaseSpecification<ShiftAssignment, int>
    {
        public AssignmentsByTemplateSpec(int templateId)
        {
            Criteria = a => a.ShiftTemplateId == templateId;
        }
    }

    /// <summary>Active shift templates of one gym.</summary>
    public class ShiftTemplatesByGymSpec : BaseSpecification<ShiftTemplate, int>
    {
        public ShiftTemplatesByGymSpec(int gymId)
        {
            Criteria = t => t.GymId == gymId && t.IsActive;
            OrderBy = t => t.StartTime;
        }
    }
}
