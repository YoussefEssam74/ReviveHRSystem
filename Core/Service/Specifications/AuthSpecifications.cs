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
        }
    }

    /// <summary>Finds a user by id (login-time gym selection).</summary>
    public class UserByIdSpec : BaseSpecification<User, int>
    {
        public UserByIdSpec(int id)
        {
            Criteria = u => u.Id == id;
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
        }
    }

    /// <summary>All still-active (non-revoked) refresh tokens of one user — the set
    /// reused detection revokes when a rotated token is presented again.</summary>
    public class RefreshTokensByUserActiveSpec : BaseSpecification<RefreshToken, int>
    {
        public RefreshTokensByUserActiveSpec(int userId)
        {
            Criteria = rt => rt.UserId == userId && rt.RevokedAtUtc == null;
        }
    }
}
