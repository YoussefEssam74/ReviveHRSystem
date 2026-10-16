using Shared.DataTransferObject.Gym;

namespace Shared.DataTransferObject.Auth
{
    /// <summary>
    /// The signed-in user's portal profile (GET /api/auth/me). Mirrors the HR Mock UI's
    /// currentUser contract: identity, derived name pieces, position, assigned gyms,
    /// the token's selected gym, and granted permission keys.
    /// </summary>
    public class CurrentUserResponse
    {
        public int Id { get; init; }
        public required string FirstName { get; init; }
        public required string LastName { get; init; }
        public required string FullName { get; init; }
        public required string Email { get; init; }
        public string? Phone { get; init; }
        public required string Initials { get; init; }
        public string? Position { get; init; }
        public string? Level { get; init; }
        public required string Role { get; init; }
        public required List<string> Permissions { get; init; }
        public required List<GymSummary> Gyms { get; init; }
        public int? SelectedGym { get; init; }
        public DateOnly? HireDate { get; init; }
        public string? EmploymentType { get; init; }
        public string? Status { get; init; }
    }
}
