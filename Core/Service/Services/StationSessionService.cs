using System.Security.Cryptography;
using System.Text;
using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.OrganizationModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Configuration;

namespace Service.Services
{
    /// <summary>
    /// DB-backed station sessions (ADR-004 "Station Credential").
    /// Tokens are 256-bit cryptographically random values, transmitted once in the
    /// kiosk-login response and stored only as a SHA-256 hash. Validation is a single
    /// indexed lookup by hash plus expiry/revocation/gym checks, so every attendance
    /// request derives its GymId from the database rather than from client input.
    /// No device IDs, MAC addresses, or IP addresses are involved — hardware can be
    /// replaced simply by redeeming a fresh enrollment code.
    /// </summary>
    public sealed class StationSessionService(
        IUnitOfWork unitOfWork,
        StationSessionOptions options) : IStationSessionService
    {
        private const int TokenBytes = 32; // 256 bits of entropy

        public TimeSpan SessionLifetime => TimeSpan.FromHours(options.LifetimeHours);

        public async Task<string> CreateSessionAsync(int gymId, int? stationCodeId, CancellationToken cancellationToken = default)
        {
            var token = GenerateToken();
            var nowUtc = DateTime.UtcNow;

            await unitOfWork.GetRepository<StationSession, int>().AddAsync(new StationSession
            {
                GymId = gymId,
                StationCodeId = stationCodeId,
                TokenHash = HashToken(token),
                CreatedAtUtc = nowUtc,
                ExpiresAtUtc = nowUtc.Add(SessionLifetime)
            }, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);
            return token;
        }

        public async Task<StationSession?> ValidateSessionAsync(string sessionToken, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(sessionToken))
            {
                return null;
            }

            var session = await unitOfWork.GetRepository<StationSession, int>()
                .GetByIdAsync(new StationSessionByTokenHashSpec(HashToken(sessionToken)), cancellationToken);

            if (session is null || !IsLive(session))
            {
                return null;
            }

            return session;
        }

        public async Task<int> RevokeGymSessionsAsync(int gymId, CancellationToken cancellationToken = default)
        {
            var nowUtc = DateTime.UtcNow;
            var liveSessions = await unitOfWork.GetRepository<StationSession, int>()
                .GetAllAsync(new LiveStationSessionsByGymSpec(gymId, nowUtc), cancellationToken);

            var revoked = 0;
            foreach (var session in liveSessions)
            {
                session.RevokedAtUtc = nowUtc;
                unitOfWork.GetRepository<StationSession, int>().Update(session);
                revoked++;
            }

            if (revoked > 0)
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return revoked;
        }

        public async Task<bool> RevokeSessionAsync(int stationSessionId, CancellationToken cancellationToken = default)
        {
            var session = await unitOfWork.GetRepository<StationSession, int>()
                .GetByIdAsync(new StationSessionByIdSpec(stationSessionId), cancellationToken);

            if (session is null)
            {
                return false;
            }

            if (session.RevokedAtUtc is null && session.ExpiresAtUtc > DateTime.UtcNow)
            {
                session.RevokedAtUtc = DateTime.UtcNow;
                unitOfWork.GetRepository<StationSession, int>().Update(session);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return true;
        }

        private static bool IsLive(StationSession session) =>
            session.RevokedAtUtc is null
            && session.ExpiresAtUtc > DateTime.UtcNow
            && session.Gym.Status == GymStatus.Active;

        private static string GenerateToken() =>
            Convert.ToHexString(RandomNumberGenerator.GetBytes(TokenBytes)).ToLowerInvariant();

        private static string HashToken(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    }
}
