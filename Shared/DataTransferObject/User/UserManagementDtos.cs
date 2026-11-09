using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.User
{
    // =====================================================================
    // HR account management (api-spec-from-ui.md §4.8 H3/H6 + dashboard D12)
    // Phase 0 wiring endpoints: create (the HR-Team wizard's final submit),
    // suspend/reactivate, and the admin password reset.
    // =====================================================================

    /// <summary>
    /// POST /api/users body — the Create-HR-Account wizard (step 1 personal info,
    /// step 2 gym access, step 3 permissions). The mock-only inputs phone and
    /// "Start Date" have no home on the bare User identity and are dropped
    /// (documented deviation); role templates are client-side presets, so the
    /// wizard sends either the resolved permission keys or a rolePreset name.
    /// </summary>
    public class CreateUserRequest
    {
        [Required, StringLength(100)]
        public string FullName { get; init; } = string.Empty;

        [Required, EmailAddress, StringLength(256)]
        public string Email { get; init; } = string.Empty;

        /// <summary>Gym access rows granted at creation (step 2); at least one is required (validated in the service).</summary>
        public List<int>? GymIds { get; init; }

        /// <summary>Direct permission keys (step 3, template or granular selection).</summary>
        public List<string>? Permissions { get; init; }

        /// <summary>Optional role assigned by name ("HR (Default)", …); resolves to the matching Role row.</summary>
        [StringLength(100)]
        public string? RolePreset { get; init; }
    }

    /// <summary>POST /api/users → 201 `{ data: &lt;team member row&gt; }`.</summary>
    public class CreateUserResponse
    {
        public UserListItem Data { get; set; } = null!;
    }

    /// <summary>PUT /api/users/{id}/status body — suspend/reactivate (reason required, mirrored from the mock modal).</summary>
    public class UserStatusRequest
    {
        /// <summary>"Active" | "Suspended".</summary>
        [Required, StringLength(20)]
        public string Status { get; init; } = string.Empty;

        [Required, StringLength(500)]
        public string Reason { get; init; } = string.Empty;
    }

    /// <summary>POST /api/users/{id}/reset-password body — the admin sets a known new password (never echoed back).</summary>
    public class ResetPasswordRequest
    {
        [Required, StringLength(100, MinimumLength = 8)]
        public string NewPassword { get; init; } = string.Empty;
    }
}
