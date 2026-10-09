namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Password hashing abstraction (PBKDF2). Lives behind an abstraction so the
    /// algorithm/parameters can change without touching authentication logic.
    /// </summary>
    public interface IPasswordHasher
    {
        string Hash(string password);

        bool Verify(string password, string passwordHash);
    }
}
