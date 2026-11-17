namespace Shared.DataTransferObject.Gym
{
    /// <summary>
    /// One gym in the portal's gym list (GET /api/gyms): identity, branch location,
    /// and the gym's active staff count.
    /// </summary>
    public class GymListResponse
    {
        public int Id { get; init; }
        public required string Name { get; init; }
        public required string Branch { get; init; }
        public int Employees { get; init; }
    }
}
