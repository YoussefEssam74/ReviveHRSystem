using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using ReviveHRSystem.Web.DataSeed;
using Xunit;

namespace ReviveHRSystem.IntegrationTests.Fixtures
{
    /// <summary>
    /// Boots the API once per test run against a dedicated PostgreSQL database
    /// (<c>ReviveHrSystemDb_IntegrationTests</c>) that is dropped and recreated on
    /// startup, then migrated + seeded with the shared development scenario.
    /// Uses the local PostgreSQL server (same provider as production) — no Docker
    /// required. Tests live in a single xUnit collection so they run sequentially
    /// against this shared host; each test creates its own data for isolation.
    /// </summary>
    public sealed class ApiTestFixture : IAsyncLifetime
    {
        public const string CollectionName = "api";
        public const string TestDatabaseName = "ReviveHrSystemDb_IntegrationTests";

        private WebApplicationFactory<ReviveHRSystem.Web.Program> _factory = null!;
        private string? _adminToken;
        private readonly Dictionary<string, string> _stationTokens = new();

        public HttpClient Client { get; private set; } = null!;

        /// <summary>Root service provider of the running test host (for scoped services / DbContext).</summary>
        public IServiceProvider Services => _factory.Services;

        /// <summary>
        /// Live (randomly generated, never hardcoded) station code seeded for the
        /// first development gym. Read from the database after seeding.
        /// </summary>
        public string Gym1StationCode { get; private set; } = string.Empty;

        /// <summary>Live station code seeded for the second development gym.</summary>
        public string Gym2StationCode { get; private set; } = string.Empty;

        public async Task InitializeAsync()
        {
            var appsettingsPath = FindAppsettings();
            var configuration = new ConfigurationBuilder()
                .AddJsonFile(appsettingsPath)
                .Build();

            var baseConnection = configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("DefaultConnection is missing from appsettings.json.");

            var maintenanceConnection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = "postgres" };
            var testConnection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = TestDatabaseName };

            await using (var connection = new NpgsqlConnection(maintenanceConnection.ConnectionString))
            {
                await connection.OpenAsync();
                await using var command = connection.CreateCommand();
                command.CommandText =
                    $"DROP DATABASE IF EXISTS \"{TestDatabaseName}\" WITH (FORCE); " +
                    $"CREATE DATABASE \"{TestDatabaseName}\";";
                await command.ExecuteNonQueryAsync();
            }

            _factory = new WebApplicationFactory<ReviveHRSystem.Web.Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.UseSetting("ConnectionStrings:DefaultConnection", testConnection.ConnectionString);
                // Belt & braces with appsettings.Testing.json — rate limits must never throttle the suite.
                builder.UseSetting("RateLimiting:AuthLoginPermits", "100000");
                builder.UseSetting("RateLimiting:StationLoginPermits", "100000");
                builder.UseSetting("RateLimiting:StationAttendancePermits", "100000");
            });

            Client = _factory.CreateClient();

            // Migrate + seed the shared scenario (idempotent, Development-only in normal runs).
            await DevelopmentDataSeeder.SeedAsync(_factory.Services);

            // The seeder generates a random code per gym — read the live values so
            // tests never depend on a hardcoded station code.
            (Gym1StationCode, Gym2StationCode) = await ReadSeededStationCodesAsync();
        }

        /// <summary>Reads the active station code of each seeded development gym from the database.</summary>
        private async Task<(string Gym1, string Gym2)> ReadSeededStationCodesAsync()
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Presistence.Data.ReviveHrDbContext>();

            var codes = await db.StationCodes
                .Where(sc => sc.IsActive && (sc.Gym!.Name == DevelopmentDataSeeder.Gym1Name
                    || sc.Gym.Name == DevelopmentDataSeeder.Gym2Name))
                .Select(sc => new { sc.Gym!.Name, sc.Code })
                .ToListAsync();

            var gym1 = codes.FirstOrDefault(c => c.Name == DevelopmentDataSeeder.Gym1Name)?.Code
                ?? throw new InvalidOperationException("No active station code was seeded for gym 1.");
            var gym2 = codes.FirstOrDefault(c => c.Name == DevelopmentDataSeeder.Gym2Name)?.Code
                ?? throw new InvalidOperationException("No active station code was seeded for gym 2.");
            return (gym1, gym2);
        }

        public async Task DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
        }

        /// <summary>Logs in as the seeded super admin (cached for the run).</summary>
        public async Task<string> GetAdminTokenAsync()
        {
            if (_adminToken is not null)
            {
                return _adminToken;
            }

            _adminToken = await LoginAsync(DevelopmentDataSeeder.AdminEmail, DevelopmentDataSeeder.EmployeePassword);
            return _adminToken;
        }

        /// <summary>Logs in with credentials and returns the issued access token.</summary>
        public async Task<string> LoginAsync(string email, string password)
        {
            var response = await Client.PostAsJsonAsync("/api/auth/login", new { email, password });
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json.GetProperty("accessToken").GetString()
                ?? throw new InvalidOperationException("Login returned no accessToken.");
        }

        /// <summary>Logs in with a 6-digit station code and returns the station token (cached per code).</summary>
        public async Task<string> GetStationTokenAsync(string stationCode)
        {
            if (_stationTokens.TryGetValue(stationCode, out var cached))
            {
                return cached;
            }

            var response = await Client.PostAsJsonAsync("/api/kiosk/login", new { code = stationCode });
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            var token = json.GetProperty("token").GetString()
                ?? throw new InvalidOperationException("Station login returned no token.");
            _stationTokens[stationCode] = token;
            return token;
        }

        /// <summary>Builds an authorized GET/POST request.</summary>
        public HttpRequestMessage AuthorizedRequest(HttpMethod method, string url, object? body, string token)
        {
            var request = new HttpRequestMessage(method, url)
            {
                Content = body is null ? null : JsonContent.Create(body)
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return request;
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

            throw new FileNotFoundException(
                "Could not locate ReviveHRSystem.Web/appsettings.json above the test output directory.");
        }
    }

    [CollectionDefinition(ApiTestFixture.CollectionName)]
    public class ApiCollection : ICollectionFixture<ApiTestFixture>
    {
    }
}
