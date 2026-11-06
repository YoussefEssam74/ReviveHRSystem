using DomainLayer.Contracts;
using DomainLayer.Models.UserModule;

namespace Service.Specifications
{
    /// <summary>Finds a user by email (case-insensitive) for login.</summary>
    public class UserByEmailSpec : BaseSpecification<User, int>
    {
        public UserByEmailSpec(string email)
        {
            var normalized = email.Trim().ToLower();
            Criteria = u => u.Email.ToLower() == normalized;
            // Failed sign-ins bump the lockout counters on the fetched user before
            // SaveChanges without Update() — keeps the flow tracked.
            ApplyTracking();
        }
    }

    /// <summary>Finds a user by id (login-time gym selection).</summary>
    public class UserByIdSpec : BaseSpecification<User, int>
    {
        public UserByIdSpec(int id)
        {
            Criteria = u => u.Id == id;
            // Gym selection stamps LastLoginAt on the fetched user before SaveChanges
            // without Update() — keeps the flow tracked.
            ApplyTracking();
        }
    }

    /// <summary>
    /// Finds a user with only the employee standing needed for session eligibility.
    /// Read-only (no tracking) — this runs on every authenticated request.
    /// </summary>
    public class UserSessionStatusSpec : BaseSpecification<User, int>
    {
        public UserSessionStatusSpec(int id)
        {
            Criteria = u => u.Id == id;
            AddInclude(u => u.EmployeeProfile!);
        }
    }

    /// <summary>Finds a user by id including the employee profile and its position.</summary>
    public class UserByIdWithProfileSpec : BaseSpecification<User, int>
    {
        public UserByIdWithProfileSpec(int id)
        {
            Criteria = u => u.Id == id;
            AddInclude(u => u.EmployeeProfile!);
            AddInclude(u => u.EmployeeProfile!.Position!);
        }
    }

    /// <summary>Finds a refresh token by its hash.</summary>
    public class RefreshTokenByHashSpec : BaseSpecification<RefreshToken, int>
    {
        public RefreshTokenByHashSpec(string tokenHash)
        {
            Criteria = rt => rt.TokenHash == tokenHash;
            AddInclude(rt => rt.User);
            // RefreshAsync/LogoutAsync mutate the fetched row before SaveChanges and
            // the row carries an xmin concurrency token — keep it tracked so the
            // stored token value and identity map stay coherent.
            ApplyTracking();
        }
    }

    /// <summary>All still-active (non-revoked) refresh tokens of one user — the set
    /// reused detection revokes when a rotated token is presented again.</summary>
    public class RefreshTokensByUserActiveSpec : BaseSpecification<RefreshToken, int>
    {
        public RefreshTokensByUserActiveSpec(int userId)
        {
            Criteria = rt => rt.UserId == userId && rt.RevokedAtUtc == null;
            // The chain revocation sweep mutates every fetched zombie before
            // SaveChanges; untracked materialization drops the xmin timestamp so
            // the consecutive Update() would never match the stored row.
            ApplyTracking();
        }
    }
}
