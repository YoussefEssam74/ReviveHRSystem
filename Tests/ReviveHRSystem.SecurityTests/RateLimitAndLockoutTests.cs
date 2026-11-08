using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using ReviveHRSystem.SecurityTests.Fixtures;
using System.Net;
using System.Net.Http.Json;
using ReviveHRSystem.Web.DataSeed;
using Xunit;

namespace ReviveHRSystem.SecurityTests
{
    /// <summary>
    /// Login rate limiting + brute-force defence spec.
    ///
    /// - Rate limiting (fixed window, IP-partitioned) must answer 429 once the login
    ///   bucket is exhausted. appsettings.Testing.json raises limits to 100k so normal
    ///   suites never throttle; therefore this chain needs its OWN factory with a low
    ///   permit count to make the 429 observable at all.
    /// - Account lockout: after repeated failed logins, the same account with the
    ///   CORRECT password must NOT log in until a lockout window elapses. The API has
    ///   no lockout today — this fact is intentionally red until it exists.
    /// </summary>
    [Collection(Fixtures.SecurityApiFixture.CollectionName)]
    public class RateLimitAndLockoutTests(SecurityApiFixture fixture)
    {
        /// <summary>
        /// A factory pointed at the (already-created) security database with the given
        /// login-window permit count. The shared security fixture provisions that
        /// database first; this class joins the same collection to guarantee ordering.
        /// </summary>
        private static WebApplicationFactory<ReviveHRSystem.Web.Program> BuildFactory(int loginPermits)
        {
            var appsettings = FindAppsettings();
            var configuration = new ConfigurationBuilder().AddJsonFile(appsettings).Build();
            var baseConnection = configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("DefaultConnection missing in appsettings.json.");

            var securityDbConnection = new NpgsqlConnectionStringBuilder(baseConnection)
            {
                Database = Fixtures.SecurityApiFixture.TestDatabaseName
            };

            return new WebApplicationFactory<ReviveHRSystem.Web.Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.UseSetting("ConnectionStrings:DefaultConnection", securityDbConnection.ConnectionString);
                builder.UseSetting("RateLimiting:AuthLoginPermits", loginPermits.ToString());
                builder.UseSetting("RateLimiting:StationLoginPermits", "100000");
                builder.UseSetting("RateLimiting:StationAttendancePermits", "100000");
            });
        }

        [Fact]
        public async Task Login_Burst_Exceeding_Window_Answers_429()
        {
            const int permits = 3;
            using var factory = BuildFactory(permits);
            var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

            var statuses = new List<HttpStatusCode>();
            for (var attempt = 0; attempt < permits + 2; attempt++)
            {
                var response = await client.PostAsJsonAsync("/api/auth/login", new
                {
                    email = DevelopmentDataSeeder.AdminEmail,
                    password = "wrong-password-for-throttle-test"
                });
                statuses.Add(response.StatusCode);
            }

            Assert.True(statuses.Contains(HttpStatusCode.TooManyRequests),
                $"Login rate limiting never answered 429 within {statuses.Count} attempts: [{string.Join(", ", statuses)}].");
            Assert.Equal(HttpStatusCode.TooManyRequests, statuses[^1]);
        }

        /// <summary>
        /// Lockout spec: repeated failures lock the account so a later CORRECT
        /// password still cannot log in until the window elapses. The probe hammers
        /// a THROWAWAY account (fresh per run) — a lock on a shared seeded identity
        /// would poison every later test that mints tokens for the 15-minute window.
        /// </summary>
        [Fact]
        public async Task Password_Guessing_Locks_The_Account()
        {
            using var factory = BuildFactory(100000); // no throttling on purpose
            var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

            // Dedicated victim account for this run: after the lock fires, nothing
            // else in the suite needs it again.
            string victimEmail;
            string victimPassword;
            using (var scope = fixture.NewScope())
            {
                var builder = new IntegrationTests.Support.TestDataBuilder(scope.ServiceProvider);
                var db = scope.ServiceProvider.GetRequiredService<Presistence.Data.ReviveHrDbContext>();
                var gymRow = await db.Gyms.OrderBy(g => g.Id).FirstAsync();
                var gym = new IntegrationTests.Support.TestGym(gymRow.Id, "", gymRow.Name);
                var victim = await builder.CreateUserAsync(
                    DomainLayer.Models.UserModule.Enums.UserType.Employee, [gym]);
                victimEmail = victim.Email;
                victimPassword = victim.Password;
            }

            for (var attempt = 0; attempt < 6; attempt++)
            {
                var wrong = await client.PostAsJsonAsync("/api/auth/login", new
                {
                    email = victimEmail,
                    password = $"guess-attempt-{attempt}"
                });
                Assert.True(wrong.IsSuccessStatusCode is false,
                    "Wrong-password login unexpectedly succeeded before the lockout probe.");
            }

            var correct = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = victimEmail,
                password = victimPassword
            });

            Assert.True(
                correct.IsSuccessStatusCode is false,
                $"NO ACCOUNT LOCKOUT: after 6 sequential failures the CORRECT password still logged in " +
                $"({correct.StatusCode}). Expected a lockout (401/403/423 with lock reason) until the window elapses.");
        }

        private static string FindAppsettings()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null)
            {
                var candidate = Path.Combine(directory.FullName, "ReviveHRSystem.Web", "appsettings.json");
                if (File.Exists(candidate))
                {
                    return candidate;
                }

                directory = directory.Parent;
            }

            throw new FileNotFoundException("Could not locate ReviveHRSystem.Web/appsettings.json.");
        }
    }
}
