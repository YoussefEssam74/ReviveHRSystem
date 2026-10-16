using DomainLayer.Contracts;
using DomainLayer.Models.OrganizationModule;

namespace Service.Specifications
{
    /// <summary>
    /// Teams the user (through his employee profile) leads inside one gym.
    /// Teams never span gyms, so the gym predicate keeps the scope exact.
    /// </summary>
    public class TeamLeaderByUserAndGymSpec : BaseSpecification<TeamLeader, int>
    {
        public TeamLeaderByUserAndGymSpec(int userId, int gymId)
        {
            Criteria = tl => tl.Employee.UserId == userId && tl.Team.GymId == gymId;
            AddInclude(tl => tl.Team);
        }
    }
}
