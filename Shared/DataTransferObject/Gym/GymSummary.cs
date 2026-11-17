namespace Shared.DataTransferObject.Gym
{
    /// <summary>
    /// A gym as seen by a signed-in user: id, display name, and the branch location
    /// the portal shows next to it (Gym.Location).
    /// </summary>
    public class GymSummary
    {
        public int Id { get; init; }
        public required string Name { get; init; }
        public required string Branch { get; init; }
    }
}
