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
}
