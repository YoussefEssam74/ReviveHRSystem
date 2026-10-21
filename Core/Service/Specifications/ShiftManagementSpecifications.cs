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
}
