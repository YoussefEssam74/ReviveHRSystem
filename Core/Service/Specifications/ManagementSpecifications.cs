using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule;
using Microsoft.EntityFrameworkCore;

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

    /// <summary>A single position validated to belong to a specific gym.</summary>
    public class PositionByIdAndGymSpec : BaseSpecification<Position, int>
    {
        public PositionByIdAndGymSpec(int positionId, int gymId)
        {
            Criteria = p => p.Id == positionId && p.GymId == gymId;
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

    /// <summary>
    /// Teams of a gym the employee leads (My Team scope). Team surfaces are
    /// leader-only: a plain member answers NotFound, the leader owns the team's
    /// management data.
    /// </summary>
    public class TeamsLedByUserSpec : BaseSpecification<Team, int>
    {
        public TeamsLedByUserSpec(int employeeId, int gymId)
        {
            Criteria = t => t.GymId == gymId
                && t.TeamLeaders.Any(tl => tl.EmployeeId == employeeId);
            AddInclude(t => t.Members);
            AddInclude(t => t.TeamLeaders);
        }
    }

    /// <summary>Every team of one gym (Branch Manager scope).</summary>
    public class TeamsByGymSpec : BaseSpecification<Team, int>
    {
        public TeamsByGymSpec(int gymId)
        {
            Criteria = t => t.GymId == gymId;
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

    /// <summary>
    /// Follow-ups of one team, newest activity first, with the employee they concern.
    /// </summary>
    public class TeamFollowUpsByTeamSpec : BaseSpecification<TeamFollowUp, int>
    {
        public TeamFollowUpsByTeamSpec(int teamId)
        {
            Criteria = f => f.TeamId == teamId;
            AddInclude(f => f.Employee);
            OrderByDescending = f => EF.Property<DateTime?>(f, "UpdatedAt") ?? EF.Property<DateTime>(f, "CreatedAt");
            ThenByDescending = f => f.Id;
        }
    }

    /// <summary>
    /// Follow-ups of a set of teams, newest activity first, with the employee they concern.
    /// </summary>
    public class TeamFollowUpsByTeamsSpec : BaseSpecification<TeamFollowUp, int>
    {
        public TeamFollowUpsByTeamsSpec(IReadOnlyCollection<int> teamIds)
        {
            Criteria = f => f.TeamId.HasValue && teamIds.Contains(f.TeamId.Value);
            AddInclude(f => f.Employee);
            OrderByDescending = f => EF.Property<DateTime?>(f, "UpdatedAt") ?? EF.Property<DateTime>(f, "CreatedAt");
            ThenByDescending = f => f.Id;
        }
    }

    /// <summary>
    /// The Branch Manager's scope-wide follow-up list: every team of the gym plus the
    /// team-less items he raises about employees nobody has assigned to a team yet.
    /// Those hang off no team, so they can only be reached through the employee's gym —
    /// a Team Leader never sees them (his scope stays the teams he leads).
    /// </summary>
    public class TeamFollowUpsForGymScopeSpec : BaseSpecification<TeamFollowUp, int>
    {
        public TeamFollowUpsForGymScopeSpec(IReadOnlyCollection<int> teamIds, int gymId)
        {
            Criteria = f => (f.TeamId.HasValue && teamIds.Contains(f.TeamId.Value))
                || (!f.TeamId.HasValue && f.Employee.GymId == gymId);
            AddInclude(f => f.Employee);
            OrderByDescending = f => EF.Property<DateTime?>(f, "UpdatedAt") ?? EF.Property<DateTime>(f, "CreatedAt");
            ThenByDescending = f => f.Id;
        }
    }

    /// <summary>One follow-up with the employee it concerns (scope and target checks).</summary>
    public class TeamFollowUpByIdSpec : BaseSpecification<TeamFollowUp, int>
    {
        public TeamFollowUpByIdSpec(int followUpId)
        {
            Criteria = f => f.Id == followUpId;
            AddInclude(f => f.Employee);
        }
    }

    /// <summary>
    /// Auto-absence deductions raised by the system for a set of employees, used by
    /// the sweep's idempotency check before it creates new rows.
    /// </summary>
    public class TeamFollowUpsDeductionForEmployeesSpec : BaseSpecification<TeamFollowUp, int>
    {
        public TeamFollowUpsDeductionForEmployeesSpec(IReadOnlyCollection<int> employeeIds)
        {
            Criteria = f => employeeIds.Contains(f.EmployeeId);
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
