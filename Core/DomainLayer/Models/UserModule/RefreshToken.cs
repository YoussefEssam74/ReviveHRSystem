using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// A long-lived, opaque refresh token issued alongside an access token (ADR-002
    /// refresh-token amendment). Only the SHA-256 hash is stored; the plaintext is
    /// returned to the client once. Tokens rotate on every refresh: the old token is
    /// revoked and a new one issued, so a stolen (reused) token is detectable.
    /// </summary>
    public class RefreshToken : BaseEntity<int>
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        /// <summary>SHA-256 hex of the opaque refresh token (unique, indexed).</summary>
        public string TokenHash { get; set; } = string.Empty;

        /// <summary>The gym the access token was scoped to, so refresh preserves it.</summary>
        public int? ScopedGymId { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAtUtc { get; set; }
        public DateTime? RevokedAtUtc { get; set; }

        /// <summary>Hash of the token that replaced this one on rotation (null if not rotated).</summary>
        public string? ReplacedByTokenHash { get; set; }
    }
}