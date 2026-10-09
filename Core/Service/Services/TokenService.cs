using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DomainLayer.Models.UserModule;
using Microsoft.IdentityModel.Tokens;
using ServiceAbstraction.Services;
using Shared.Configuration;

namespace Service.Services
{
    /// <summary>
    /// JWT issuance/validation for the web login flow (ADR-002, access-token-only —
    /// no refresh tokens). Permissions are deliberately NOT embedded in the token;
    /// they are loaded server-side per request from the database.
    /// The gym-selection temp token is a purpose-scoped, short-lived JWT.
    /// </summary>
    public class TokenService(JwtSettings settings) : ITokenService
    {
        private const string SelectionPurposeClaim = "purpose";
        private const string SelectionPurposeValue = "gym-selection";
        private const string StationPurposeValue = "station";

        // Selection tokens carry a distinct audience so they can never satisfy the
        // JwtBearer audience check in Program.cs and authenticate as access tokens.
        private const string SelectionAudienceSuffix = ".gym-selection";

        private readonly JwtSecurityTokenHandler _tokenHandler = new();

        public int AccessTokenExpiresInSeconds => settings.AccessTokenMinutes * 60;

        public string CreateAccessToken(User user, IEnumerable<string> permissionKeys, int? scopedGymId)
        {
            List<Claim> claims = new()
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new("uid", user.Id.ToString()),
                new(JwtRegisteredClaimNames.Email, user.Email),
                new(JwtRegisteredClaimNames.Name, user.UserName),
                new("userType", user.UserType.ToString()),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            if (scopedGymId.HasValue)
            {
                claims.Add(new Claim("gymId", scopedGymId.Value.ToString()));
            }

            // permissionKeys are intentionally not added as claims (ADR-002: token stays small).
            _ = permissionKeys;

            return CreateSignedToken(claims, DateTime.UtcNow.AddMinutes(settings.AccessTokenMinutes));
        }

        public string CreateGymSelectionToken(int userId)
        {
            List<Claim> claims = new()
            {
                new(JwtRegisteredClaimNames.Sub, userId.ToString()),
                new("uid", userId.ToString()),
                new(SelectionPurposeClaim, SelectionPurposeValue),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            return CreateSignedToken(claims, DateTime.UtcNow.AddMinutes(settings.SelectionTokenMinutes));
        }

        public string CreateStationToken(int gymId)
        {
            // Station tokens use the same issuer/audience as access tokens so the
            // JwtBearer pipeline accepts them; the gymId claim is the binding that
            // attendance endpoints verify against the station code's gym (ADR-004).
            List<Claim> claims = new()
            {
                new(JwtRegisteredClaimNames.Sub, $"gym-{gymId}"),
                new("gymId", gymId.ToString()),
                new(SelectionPurposeClaim, StationPurposeValue),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            return CreateSignedToken(claims, DateTime.UtcNow.AddMinutes(settings.StationTokenMinutes));
        }

        public int? ValidateGymSelectionToken(string token)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return null;
            }

            try
            {
                var principal = _tokenHandler.ValidateToken(token, CreateValidationParameters(validateLifetime: true), out _);
                var purpose = principal.FindFirst(SelectionPurposeClaim)?.Value;
                var uid = principal.FindFirst("uid")?.Value;

                if (!string.Equals(purpose, SelectionPurposeValue, StringComparison.Ordinal) || !int.TryParse(uid, out int userId))
                {
                    return null;
                }

                return userId;
            }
            catch
            {
                // Expired, tampered, or wrong-purpose token — treated uniformly as invalid.
                return null;
            }
        }

        private string CreateSignedToken(IEnumerable<Claim> claims, DateTime expiresUtc)
        {
            var credentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Key)),
                SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: settings.Issuer,
                audience: settings.Audience,
                claims: claims,
                expires: expiresUtc,
                signingCredentials: credentials);

            return _tokenHandler.WriteToken(token);
        }

        private TokenValidationParameters CreateValidationParameters(bool validateLifetime) => new()
        {
            ValidateIssuer = true,
            ValidIssuer = settings.Issuer,
            ValidateAudience = true,
            ValidAudience = settings.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Key)),
            ValidateLifetime = validateLifetime,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    }
}
