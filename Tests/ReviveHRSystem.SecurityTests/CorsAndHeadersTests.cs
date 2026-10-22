using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Npgsql;
using ReviveHRSystem.SecurityTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.SecurityTests
{
    /// <summary>
    /// CORS is opt-in (empty Cors:AllowedOrigins ⇒ no origin allowed). The tests
    /// verify: an unknown origin receives NO Access-Control-Allow-* and a configured
    /// origin is honoured, plus key hardening headers on responses.
    /// They run with a dedicated factory so allowed-origins is deterministic.
    /// </summary>
    [Trait("Suite", "Cors")]
    [Collection(Fixtures.SecurityApiFixture.CollectionName)]
    public class CorsAndHeadersTests
    {
        private static WebApplicationFactory<ReviveHRSystem.Web.Program> BuildFactory(params string[] allowedOrigins)
        {
            var appsettings = FindAppsettings();
            var configuration = new ConfigurationBuilder().AddJsonFile(appsettings).Build();
            var baseConnection = configuration.GetConnectionString("DefaultConnection")!;
            var securityDb = new NpgsqlConnectionStringBuilder(baseConnection)
            {
                Database = SecurityApiFixture.TestDatabaseName
            };

            var factory = new WebApplicationFactory<ReviveHRSystem.Web.Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.UseSetting("ConnectionStrings:DefaultConnection", securityDb.ConnectionString);
                builder.UseSetting("RateLimiting:AuthLoginPermits", "100000");
                builder.UseSetting("RateLimiting:StationLoginPermits", "100000");
                builder.UseSetting("RateLimiting:StationAttendancePermits", "100000");
                for (var i = 0; i < allowedOrigins.Length; i++)
                {
                    builder.UseSetting($"Cors:AllowedOrigins:{i}", allowedOrigins[i]);
                }
            });
            return factory;
        }

        [Fact]
        public async Task Preflight_From_Unknown_Origin_Is_Rejected()
        {
            using var factory = BuildFactory("https://app.revive.local");
            var client = factory.CreateClient();

            using var request = new HttpRequestMessage(HttpMethod.Options, "/api/employees");
            request.Headers.Add("Origin", "https://evil.example.com");
            request.Headers.Add("Access-Control-Request-Method", "GET");

            var response = await client.SendAsync(request);

            Assert.False(
                response.Headers.Contains("Access-Control-Allow-Origin"),
                "Unknown origin received CORS allow headers — the CORS policy would permit third parties to call the API from a browser.");
        }

        [Fact]
        public async Task Preflight_From_Configured_Origin_Is_Allowed()
        {
            using var factory = BuildFactory("https://app.revive.local");
            var client = factory.CreateClient();

            using var request = new HttpRequestMessage(HttpMethod.Options, "/api/employees");
            request.Headers.Add("Origin", "https://app.revive.local");
            request.Headers.Add("Access-Control-Request-Method", "GET");
            request.Headers.Add("Access-Control-Request-Headers", "authorization");

            var response = await client.SendAsync(request);

            Assert.True(
                response.Headers.Contains("Access-Control-Allow-Origin"),
                "Configured origin did not receive CORS allow headers — the SPA would break.");
        }

        [Fact]
        public async Task Simple_Request_Unknown_Origin_Gets_No_Acao_Header()
        {
            using var factory = BuildFactory(); // opt-in CORS with NO origins = default deny
            var client = factory.CreateClient();

            using var request = new HttpRequestMessage(HttpMethod.Get, "/api/request-types");
            request.Headers.Add("Origin", "https://evil.example.com");
            var response = await client.SendAsync(request);

            Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        }

        [Fact]
        public async Task Error_Responses_Do_Not_Leak_Stack_Traces()
        {
            using var factory = BuildFactory();
            var client = factory.CreateClient();

            var response = await client.GetAsync("/api/employees/0100000000");
            var body = await response.Content.ReadAsStringAsync();

            Assert.DoesNotContain("at ReviveHRSystem", body);
            Assert.DoesNotContain("at System.", body);
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
