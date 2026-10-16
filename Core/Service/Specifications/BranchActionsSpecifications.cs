using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.PayrollModule;

namespace Service.Specifications
{
    /// <summary>One deduction candidate with its employee and issuer.</summary>
    public class DeductionCandidateByIdSpec : BaseSpecification<DeductionCandidate, int>
    {
        public DeductionCandidateByIdSpec(int id)
        {
            Criteria = d => d.Id == id;
            AddInclude(d => d.Employee);
            AddInclude(d => d.IssuedByUser);
        }
    }

    /// <summary>Deduction candidates of a set of employees (team/gym scope).</summary>
    public class DeductionCandidatesByEmployeesSpec : BaseSpecification<DeductionCandidate, int>
    {
        public DeductionCandidatesByEmployeesSpec(IReadOnlyCollection<int> employeeIds)
        {
            Criteria = d => employeeIds.Contains(d.EmployeeId);
            AddInclude(d => d.Employee);
            OrderByDescending = d => d.IssuedAt;
        }
    }

    /// <summary>One warning notice with its employee and issuer.</summary>
    public class WarningNoticeByIdSpec : BaseSpecification<WarningNotice, int>
    {
        public WarningNoticeByIdSpec(int id)
        {
            Criteria = w => w.Id == id;
            AddInclude(w => w.Employee);
            AddInclude(w => w.IssuedByUser);
        }
    }

    /// <summary>Warning notices of a set of employees (team/gym scope).</summary>
    public class WarningNoticesByEmployeesSpec : BaseSpecification<WarningNotice, int>
    {
        public WarningNoticesByEmployeesSpec(IReadOnlyCollection<int> employeeIds)
        {
            Criteria = w => employeeIds.Contains(w.EmployeeId);
            AddInclude(w => w.Employee);
            OrderByDescending = w => w.IssuedAt;
        }
    }

    /// <summary>One bonus proposal with its employee and issuer.</summary>
    public class BonusProposalByIdSpec : BaseSpecification<BonusProposal, int>
    {
        public BonusProposalByIdSpec(int id)
        {
            Criteria = b => b.Id == id;
            AddInclude(b => b.Employee);
            AddInclude(b => b.IssuedByUser);
        }
    }

    /// <summary>Bonus proposals of a set of employees (team/gym scope).</summary>
    public class BonusProposalsByEmployeesSpec : BaseSpecification<BonusProposal, int>
    {
        public BonusProposalsByEmployeesSpec(IReadOnlyCollection<int> employeeIds)
        {
            Criteria = b => employeeIds.Contains(b.EmployeeId);
            AddInclude(b => b.Employee);
            OrderByDescending = b => b.IssuedAt;
        }
    }
}
