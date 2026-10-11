using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule;

namespace Service.Specifications
{
    /// <summary>Active positions of one gym.</summary>
    public class PositionsByGymSpec : BaseSpecification<Position, int>
    {
        public PositionsByGymSpec(int gymId)
        {
            Criteria = p => p.GymId == gymId;
            OrderBy = p => p.Title;
        }
    }

    /// <summary>
    /// Teams of a gym the employee leads or belongs to (My Team scope).
    /// </summary>
    public class TeamsByMemberOrLeaderSpec : BaseSpecification<Team, int>
    {
        public TeamsByMemberOrLeaderSpec(int employeeId, int gymId)
        {
            Criteria = t => t.GymId == gymId
                && (t.Members.Any(m => m.Id == employeeId) || t.TeamLeaders.Any(tl => tl.EmployeeId == employeeId));
            AddInclude(t => t.Members);
            AddInclude(t => t.TeamLeaders);
        }
    }

    /// <summary>One team with its members and leaders.</summary>
    public class TeamWithMembersSpec : BaseSpecification<Team, int>
    {
        public TeamWithMembersSpec(int teamId)
        {
            Criteria = t => t.Id == teamId;
            AddInclude(t => t.Members);
            AddInclude(t => t.TeamLeaders);
        }
    }

    /// <summary>Offboarding cases of one gym through their employees.</summary>
    public class OffboardingCasesByGymSpec : BaseSpecification<OffboardingCase, int>
    {
        public OffboardingCasesByGymSpec(int gymId)
        {
            Criteria = c => c.Employee.GymId == gymId;
            AddInclude(c => c.Employee);
            OrderByDescending = c => c.InitiatedAt;
        }
    }

    /// <summary>Offboarding cases of a set of employees.</summary>
    public class OffboardingCasesByEmployeesSpec : BaseSpecification<OffboardingCase, int>
    {
        public OffboardingCasesByEmployeesSpec(IReadOnlyCollection<int> employeeIds)
        {
            Criteria = c => employeeIds.Contains(c.EmployeeId);
            AddInclude(c => c.Employee);
            OrderByDescending = c => c.InitiatedAt;
        }
    }

    /// <summary>Vacancy requests of one gym, newest first.</summary>
    public class VacancyRequestsByGymSpec : BaseSpecification<VacancyRequest, int>
    {
        public VacancyRequestsByGymSpec(int gymId)
        {
            Criteria = r => r.GymId == gymId;
            AddInclude(r => r.Position);
            AddInclude(r => r.Requester);
            OrderByDescending = r => r.Id;
        }
    }
}
