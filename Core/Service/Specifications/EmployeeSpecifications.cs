using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;

namespace Service.Specifications
{
    /// <summary>Finds the employee profile that belongs to a user account (1:1).</summary>
    public class EmployeeByUserIdSpec : BaseSpecification<Employee, int>
    {
        public EmployeeByUserIdSpec(int userId)
        {
            Criteria = e => e.UserId == userId;
        }
    }

    /// <summary>Finds an employee by id with the gym loaded (scope checks need the gym).</summary>
    public class EmployeeByIdSpec : BaseSpecification<Employee, int>
    {
        public EmployeeByIdSpec(int employeeId)
        {
            Criteria = e => e.Id == employeeId;
            AddInclude(e => e.Gym);
        }
    }

    /// <summary>
    /// Profile-shaped load of one employee: gym, position, login account and the
    /// compensation history (current salary = latest effective record).
    /// </summary>
    public class EmployeeProfileByIdSpec : BaseSpecification<Employee, int>
    {
        public EmployeeProfileByIdSpec(int employeeId)
        {
            Criteria = e => e.Id == employeeId;
            AddInclude(e => e.Gym);
            AddInclude(e => e.Position);
            AddInclude(e => e.User);
            AddInclude(e => e.Compensations);
        }
    }

    /// <summary>Dashboard-shaped load of the actor's own employee: gym + position.</summary>
    public class EmployeeSummaryByUserIdSpec : BaseSpecification<Employee, int>
    {
        public EmployeeSummaryByUserIdSpec(int userId)
        {
            Criteria = e => e.UserId == userId;
            AddInclude(e => e.Gym);
            AddInclude(e => e.Position);
        }
    }

    /// <summary>All documents of one employee, newest first.</summary>
    public class DocumentsByEmployeeSpec : BaseSpecification<EmployeeDocument, int>
    {
        public DocumentsByEmployeeSpec(int employeeId)
        {
            Criteria = d => d.EmployeeId == employeeId;
            OrderByDescending = d => d.UploadedAt;
        }
    }

    /// <summary>Leave balances of one employee for a given year.</summary>
    public class LeaveBalancesByEmployeeSpec : BaseSpecification<DomainLayer.Models.EmployeeModule.LeaveBalance, int>
    {
        public LeaveBalancesByEmployeeSpec(int employeeId, int year)
        {
            Criteria = lb => lb.EmployeeId == employeeId && lb.Year == year;
        }
    }
}