namespace Shared.DataTransferObject.User
{
    /// <summary>
    /// PUT /api/users/{id}/permissions body (6.4/D12/H5): the full replacement set
    /// of direct (user-level) permission keys. Effective access is these keys plus
    /// everything inherited from assigned roles.
    /// </summary>
    public class UserPermissionsRequest
    {
        public required List<string> Permissions { get; init; }
    }

    /// <summary>
    /// PUT /api/users/{id}/roles body (6.5): assign a single role either by id or by
    /// preset name (the UI's "Apply Role Preset"). Sending both nulls clears roles.
    /// </summary>
    public class UserRoleAssignmentRequest
    {
        public int? RoleId { get; init; }
        public string? RolePreset { get; init; }
    }

    /// <summary>
    /// PUT /api/users/{id}/gym-access body (6.6/H4): the full replacement set of
    /// accessible gyms, addressed by id (admin tabs) or by name (hire wizard).
    /// An empty set revokes all gym access (the wizard enforces its own min-1).
    /// </summary>
    public class UserGymAccessRequest
    {
        public List<int>? GymIds { get; init; }
        public List<string>? Gyms { get; init; }
    }

    public class UserAssignmentResponse
    {
        public required UserAssignmentData Data { get; init; }
    }

    public class UserAssignmentData
    {
        public int UserId { get; init; }
        public int? RoleId { get; init; }
        public string? RolePreset { get; init; }
        public required List<string> Permissions { get; init; }
        public required List<string> EffectivePermissions { get; init; }
        public int Count { get; init; }
        public required List<int> GymIds { get; init; }
    }
}
