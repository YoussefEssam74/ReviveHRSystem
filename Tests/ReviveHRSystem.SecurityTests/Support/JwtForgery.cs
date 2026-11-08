using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Shared.Configuration;

namespace ReviveHRSystem.SecurityTests.Support
{
    /// <summary>
    /// Builds the authentication-attack theory token variants. The REAL signing key is
    /// never printed or written anywhere — it is read from the running host's own
    /// configuration only to produce the attack artifacts (expired, forged, alg:none).
    /// An override via SECURITYTEST_JWT_KEY (env var, set by the scripts) takes
    /// precedence and keeps the same in-memory-only guarantee.
    /// </summary>
    public static class JwtForgery
    {
        public static JwtSettings ResolveSettings(IServiceProvider services)
        {
            // The host registers the concrete JwtSettings singleton (Program.cs);
            // no IOptions<JwtSettings> binding is configured.
            var overrideKey = Environment.GetEnvironmentVariable("SECURITYTEST_JWT_KEY");
            var settings = services.GetRequiredService<JwtSettings>();

            if (!string.IsNullOrWhiteSpace(overrideKey)
                && !string.Equals(overrideKey, settings.Key, StringComparison.Ordinal))
            {
                // Clone with the script-provided key so every forged variant is signed
                // (or intentionally mis-signed) with the values the runner decided.
                return new JwtSettings
                {
                    Key = overrideKey,
                    Issuer = settings.Issuer,
                    Audience = settings.Audience,
                    AccessTokenMinutes = settings.AccessTokenMinutes,
                    SelectionTokenMinutes = settings.SelectionTokenMinutes
                };
            }

            return settings;
        }

        /// <summary>A token whose lifetime ended in the past (correct signature).</summary>
        public static string ExpiredToken(JwtSettings settings, int userId = 1001)
        {
            var claims = BaseClaims(userId);
            var handler = new JwtSecurityTokenHandler();
            var token = new JwtSecurityToken(
                issuer: settings.Issuer,
                audience: settings.Audience,
                claims: claims,
                notBefore: DateTime.UtcNow.AddMinutes(-30),
                expires: DateTime.UtcNow.AddMinutes(-15),
                signingCredentials: Sign(settings));
            return handler.WriteToken(token);
        }

        /// <summary>A structurally valid token signed with a DIFFERENT 256-bit key.</summary>
        public static string WrongKeyToken(JwtSettings settings, int userId = 1001)
        {
            var impostor = new JwtSettings { Key = "totally-different-256-bit-security-test-key", Issuer = settings.Issuer, Audience = settings.Audience };
            var claims = BaseClaims(userId);
            var handler = new JwtSecurityTokenHandler();
            var token = new JwtSecurityToken(
                issuer: impostor.Issuer,
                audience: impostor.Audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMinutes(15),
                signingCredentials: Sign(impostor));
            return handler.WriteToken(token);
        }

        /// <summary>{"alg":"none"} — classic JWT confusion attack; must never authenticate.</summary>
        public static string AlgNoneToken(int userId = 1001)
        {
            var header = Base64Url(Encoding.UTF8.GetBytes("""{"alg":"none","typ":"JWT"}"""));
            var payload = Base64Url(Encoding.UTF8.GetBytes(
                $$"""{"uid":"{{userId}}","sub":"{{userId}}","email":"pwned@test.local","name":"impostor","userType":"TopManagement","jti":"{{Guid.NewGuid()}}"}"""));
            return $"{header}.{payload}.";
        }

        /// <summary>Takes a REAL token and corrupts one payload byte (signature mismatch).</summary>
        public static string TamperedPayloadToken(string realToken)
        {
            var parts = realToken.Split('.');
            var payload = Encoding.UTF8.GetString(Base64UrlDecode(parts[1]));
            var tampered = payload.Replace("\"sub\":\"", "\"sub\":\"9\"");
            if (tampered == payload)
            {
                // Fallback: flip the last character of the payload.
                tampered = payload.Length > 4
                    ? payload[..^1] + (payload[^1] == 'x' ? 'y' : 'x')
                    : payload + "x";
            }

            return $"{parts[0]}.{Base64Url(Encoding.UTF8.GetBytes(tampered))}.{parts[2]}";
        }

        /// <summary>Takes a REAL token and corrupts the signature characters.</summary>
        public static string CorruptedSignatureToken(string realToken)
        {
            var parts = realToken.Split('.');
            var signatureChars = parts[2].ToCharArray();
            signatureChars[signatureChars.Length - 1] =
                signatureChars[^1] == 'A' ? 'B' : 'A';
            return $"{parts[0]}.{parts[1]}.{new string(signatureChars)}";
        }

        /// <summary>
        /// Fresh, correctly signed token for the impersonated uid (the real insider
        /// attack: signed content claiming a different account). The signature again
        /// uses the configured key — this documents that any leaked signing key means
        /// total impersonation; it is NOT testable as "accepted" here because the
        /// value the server must protect is the key itself, so the suite ships the
        /// wrong-key and alg:none variants as the reachable external attacks.
        /// </summary>
        public static string ForgedClaimsToken(JwtSettings settings, int impersonatedUserId)
        {
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, impersonatedUserId.ToString()),
                new("uid", impersonatedUserId.ToString()),
                new(JwtRegisteredClaimNames.Email, "forged@test.local"),
                new(JwtRegisteredClaimNames.Name, "forged"),
                new("userType", "TopManagement"),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var handler = new JwtSecurityTokenHandler();
            var token = new JwtSecurityToken(
                issuer: settings.Issuer,
                audience: settings.Audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMinutes(15),
                signingCredentials: Sign(settings));
            return handler.WriteToken(token);
        }

        private static List<Claim> BaseClaims(int userId) => new()
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new("uid", userId.ToString()),
            new(JwtRegisteredClaimNames.Email, "attacker@test.local"),
            new(JwtRegisteredClaimNames.Name, "attacker"),
            new("userType", "Employee"),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        private static SigningCredentials Sign(JwtSettings settings) =>
            new(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Key)), SecurityAlgorithms.HmacSha256);

        private static string Base64Url(byte[] bytes) =>
            Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private static byte[] Base64UrlDecode(string s)
        {
            var padded = s.Replace('-', '+').Replace('_', '/');
            switch (padded.Length % 4)
            {
                case 2: padded += "=="; break;
                case 3: padded += "="; break;
            }

            return Convert.FromBase64String(padded);
        }
    }
}
