using DomainLayer.Contracts;
using DomainLayer.Models.RequestModule;

namespace Service.Specifications
{
    /// <summary>All requests of one employee, newest first, with the decision timeline.</summary>
    public class RequestsByEmployeeSpec : BaseSpecification<EmployeeRequest, int>
    {
        public RequestsByEmployeeSpec(int employeeId)
        {
            Criteria = r => r.EmployeeId == employeeId;
            AddInclude(r => r.Decisions);
            AddInclude(r => r.SwapWithEmployee);
            OrderByDescending = r => r.SubmittedAt;
        }
    }

    /// <summary>One request with its decision timeline (two-stage workflow history).</summary>
    public class RequestByIdSpec : BaseSpecification<EmployeeRequest, int>
    {
        public RequestByIdSpec(int requestId)
        {
            Criteria = r => r.Id == requestId;
            AddInclude(r => r.Decisions);
            AddInclude(r => r.SwapWithEmployee);
        }
    }
}
