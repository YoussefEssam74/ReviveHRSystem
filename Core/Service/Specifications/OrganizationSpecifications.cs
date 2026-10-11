using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;

namespace Service.Specifications
{
    /// <summary>Finds every active gym, ordered by name (Top Management gym list).</summary>
    public class ActiveGymsSpec : BaseSpecification<Gym, int>
    {
        public ActiveGymsSpec()
        {
            Criteria = g => g.Status == GymStatus.Active;
            OrderBy = g => g.Name;
        }
    }

    /// <summary>Finds the given active gyms by id, ordered by name (scoped gym list).</summary>
    public class GymsByIdsSpec : BaseSpecification<Gym, int>
    {
        public GymsByIdsSpec(IReadOnlyCollection<int> gymIds)
        {
            Criteria = g => gymIds.Contains(g.Id) && g.Status == GymStatus.Active;
            OrderBy = g => g.Name;
        }
    }

    /// <summary>Finds a gym's active employees (staff count for the gym list).</summary>
    public class ActiveEmployeesByGymCountSpec : BaseSpecification<Employee, int>
    {
        public ActiveEmployeesByGymCountSpec(int gymId)
        {
            Criteria = e => e.GymId == gymId && e.Status == EmployeeStatus.Active;
        }
    }
}
