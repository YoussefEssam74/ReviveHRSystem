using System.Security.Cryptography;
using System.Text;
using DomainLayer.Constants;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
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
        ISubscriptionService subscriptionService,
        StationSessionOptions options) : IStationSessionService
    {
        private const int TokenBytes = 32; // 256 bits of entropy

        public TimeSpan SessionLifetime => TimeSpan.FromHours(options.LifetimeHours);

        public async Task<string> CreateSessionAsync(
            int gymId,
            int? stationCodeId,
            StationClientInfo client,
            CancellationToken cancellationToken = default)
        {
            // A suspended gym cannot enroll an attendance station: the session would
            // be created but every request from it would be refused, leaving the
            // kiosk in a broken half-signed-in state.
            if (!await subscriptionService.IsGymAccessAllowedAsync(gymId, cancellationToken))
            {
                throw new UnAuthorizedException(SubscriptionMessages.SuspensionMessage);
            }

            var token = GenerateToken();
            var nowUtc = DateTime.UtcNow;

            await unitOfWork.GetRepository<StationSession, int>().AddAsync(new StationSession
            {
                GymId = gymId,
                StationCodeId = stationCodeId,
                TokenHash = HashToken(token),
                CreatedAtUtc = nowUtc,
                ExpiresAtUtc = nowUtc.Add(SessionLifetime),
                IpAddress = Trim(client.IpAddress, 64),
                DeviceInfo = Trim(client.DeviceInfo, 300),
                Latitude = client.Latitude,
                Longitude = client.Longitude,
                LocationAccuracyMeters = client.AccuracyMeters
            }, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);
            return token;
        }

        /// <summary>Keeps stored device metadata inside its column instead of failing the login.</summary>
        private static string? Trim(string? value, int maxLength)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var trimmed = value.Trim();
            return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
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
            && session.Gym is { Status: GymStatus.Active };

        private static string GenerateToken() =>
            Convert.ToHexString(RandomNumberGenerator.GetBytes(TokenBytes)).ToLowerInvariant();

        private static string HashToken(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    }
}
