namespace DomainLayer.Models.UserModule
{
    /// <summary>
    /// Stores long-lived refresh tokens for JWT session rotation, renewal, and revocation.
    /// Supports detecting compromised tokens and forcing logout.
    /// </summary>
    public class RefreshToken : BaseEntity
    {
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        public string Token { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? RevokedAt { get; set; }
        public string? ReplacedByToken { get; set; }

        public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
        public bool IsRevoked => RevokedAt is not null;
        public bool IsActive => !IsRevoked && !IsExpired;
    }
}
