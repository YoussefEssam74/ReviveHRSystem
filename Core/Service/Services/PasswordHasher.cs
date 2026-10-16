using System.Security.Cryptography;
using ServiceAbstraction.Services;

namespace Service.Services
{
    /// <summary>
    /// PBKDF2 password hashing. Stored format: PBKDF2${iterations}${saltBase64}${hashBase64}.
    /// Verification is constant-time.
    /// </summary>
    public class PasswordHasher : IPasswordHasher
    {
        private const string Prefix = "PBKDF2";
        private const int Iterations = 100_000;
        private const int SaltSizeBytes = 16;
        private const int HashSizeBytes = 32;

        public string Hash(string password)
        {
            ArgumentException.ThrowIfNullOrEmpty(password);

            byte[] salt = RandomNumberGenerator.GetBytes(SaltSizeBytes);
            byte[] hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSizeBytes);

            return $"{Prefix}${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
        }

        public bool Verify(string password, string passwordHash)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(passwordHash))
            {
                return false;
            }

            string[] parts = passwordHash.Split('$');
            if (parts.Length != 4 || !string.Equals(parts[0], Prefix, StringComparison.Ordinal))
            {
                return false;
            }

            if (!int.TryParse(parts[1], out int iterations) || iterations < 1)
            {
                return false;
            }

            byte[] salt;
            byte[] expected;
            try
            {
                salt = Convert.FromBase64String(parts[2]);
                expected = Convert.FromBase64String(parts[3]);
            }
            catch (FormatException)
            {
                return false;
            }

            byte[] actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
    }
}
