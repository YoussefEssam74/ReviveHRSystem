using DomainLayer.Contracts;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.SchedulingModule.Enums;

namespace Service.Specifications
{
    /// <summary>All assignments of one cycle.</summary>
    public class AssignmentsByCycleSpec : BaseSpecification<ShiftAssignment, int>
    {
        public AssignmentsByCycleSpec(int cycleId)
        {
            Criteria = a => a.ShiftCycleId == cycleId;
            // Cycle deletion removes every fetched assignment before SaveChanges — keep tracked.
            ApplyTracking();
        }
    }

    /// <summary>Assignments of one cycle for a set of employees (scoped grid).</summary>
    public class AssignmentsByCycleAndEmployeesSpec : BaseSpecification<ShiftAssignment, int>
    {
        public AssignmentsByCycleAndEmployeesSpec(int cycleId, IReadOnlyCollection<int> employeeIds)
        {
            Criteria = a => a.ShiftCycleId == cycleId && employeeIds.Contains(a.EmployeeId);
            AddInclude(a => a.Employee);
            // Grid overlay mutates fetched assignments before SaveChanges without Update() — keep tracked.
            ApplyTracking();
        }
    }

    /// <summary>Assignments referencing one shift template (template deletion cleanup).</summary>
    public class AssignmentsByTemplateSpec : BaseSpecification<ShiftAssignment, int>
    {
        public AssignmentsByTemplateSpec(int templateId)
        {
            Criteria = a => a.ShiftTemplateId == templateId;
            // Template deletion nulls the fetched cells' template id before SaveChanges — keep tracked.
            ApplyTracking();
        }
    }
}
