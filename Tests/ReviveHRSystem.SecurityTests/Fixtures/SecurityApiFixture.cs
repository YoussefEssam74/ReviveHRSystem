using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Support;
using ReviveHRSystem.SecurityTests.Support;
using ReviveHRSystem.Web.DataSeed;
using Xunit;

namespace ReviveHRSystem.SecurityTests.Fixtures
{
    /// <summary>
    /// Security-suite twin of the integration fixture. Boots the API once per run
    /// against a dedicated database on the local PostgreSQL server
    /// (<c>ReviveHrSystemDb_SecurityTests</c>, dropped and recreated), migrates and
    /// runs the shared development seed, then provisions the security identity
    /// catalog: the five working roles homed in gym A, the same roles as
    /// cross-tenant twins in gym B, a team led by the gym-A Team Leader, and the
    /// permission bundles the access matrix assigns to HR / HR Manager.
    /// </summary>
    public sealed class SecurityApiFixture : IAsyncLifetime
    {
        public const string CollectionName = "security";
        public const string TestDatabaseName = "ReviveHrSystemDb_SecurityTests";

        private WebApplicationFactory<ReviveHRSystem.Web.Program> _factory = null!;
        private readonly Dictionary<string, string> _tokenCache = new();

        public HttpClient Client { get; private set; } = null!;

        /// <summary>Root service provider of the running test host.</summary>
        public IServiceProvider Services => _factory.Services;

        /// <summary>Seeded identity catalog (users, employees, gym ids, ids to target).</summary>
        public SecurityContext Context { get; private set; } = null!;

        public async Task InitializeAsync()
        {
            var appsettingsPath = FindAppsettings();
            var configuration = new ConfigurationBuilder()
                .AddJsonFile(appsettingsPath)
                .Build();

            var baseConnection = configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("DefaultConnection is missing from appsettings.json.");

            // Automation hook: a dedicated QA database connection string may override
            // the developer's local server so the suite never touches dev data.
            var qaPipelineConnection = Environment.GetEnvironmentVariable("QA_TEST_CONNECTION_STRING");
            if (!string.IsNullOrWhiteSpace(qaPipelineConnection))
            {
                baseConnection = qaPipelineConnection;
            }

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
                // Access tests must observe the *authorization* layer, not get throttled;
                // rate limiting gets its own dedicated low-limit factory in RateLimitTests.
                builder.UseSetting("RateLimiting:AuthLoginPermits", "100000");
                builder.UseSetting("RateLimiting:StationLoginPermits", "100000");
                builder.UseSetting("RateLimiting:StationAttendancePermits", "100000");
            });

            Client = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

            await DevelopmentDataSeeder.SeedAsync(_factory.Services);

            Context = await SecurityProvisioning.ProvisionAsync(_factory.Services, Client);
        }

        public async Task DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
        }

        /// <summary>Logs in with credentials and caches the issued access token.</summary>
        public async Task<string> LoginAsync(string email, string password = DevelopmentDataSeeder.EmployeePassword)
        {
            if (_tokenCache.TryGetValue(email, out var cached))
            {
                return cached;
            }

            // Full ADR-002 flow: login may answer a gym-SELECTION challenge for
            // multi-gym accounts; stepping through it mints the scoped access token a
            // real session would carry (unscoped tokens legitimately fail gym-scoped
            // reads with 404 — scrambling every Managers-allowed matrix row).
            var response = await Client.PostAsJsonAsync("/api/auth/login", new { email, password });
            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException($"Login failed for {email}: {(int)response.StatusCode}.");
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();

            // The login selection challenge applies only to multi-gym EMPLOYEES
            // (AuthService): management accounts (Top Management dual-scope, HR
            // Manager dual-gym) receive an unscoped token directly, exactly as in
            // production — those users scope their session afterwards.
            var requiresSelection = json.TryGetProperty("requiresGymSelection", out var flag) && flag.GetBoolean();
            var tempSessionToken = requiresSelection
                ? json.GetProperty("tempSessionToken").GetString()
                : null;

            if (requiresSelection)
            {
                var select = await Client.PostAsJsonAsync("/api/auth/login/select-gym", new
                {
                    gymId = json.GetProperty("gyms").EnumerateArray().First().GetProperty("gymId").GetInt32(),
                    tempSessionToken
                });
                if (!select.IsSuccessStatusCode)
                {
                    throw new InvalidOperationException(
                        $"Gym selection failed for {email}: {(int)select.StatusCode}.");
                }

                json = await select.Content.ReadFromJsonAsync<JsonElement>();
            }

            var token = json.GetProperty("accessToken").GetString()
                ?? throw new InvalidOperationException($"Login returned no accessToken for {email}.");
            _tokenCache[email] = token;
            return token;
        }

        /// <summary>
        /// Token for a matrix identity: login, then — when the minted session is not
        /// gym-scoped — the production switch-gym hop. Multi-gym employees answer the
        /// selection challenge; multi-gym managers switch-gym (AuthService never
        /// challenges them at login). Unscoped tokens 404 every EnsureCanAccess read,
        /// so the matrix rows need the scoped session a real portal session uses.
        /// </summary>
        public async Task<string> GetTokenAsync(SecurityUserIdentity identity)
        {
            if (_tokenCache.TryGetValue(identity.Email, out var cached))
            {
                return cached;
            }

            var token = await LoginAsync(identity.Email, identity.Password);
            if (!await AuthMeHasSelectedGymAsync(token))
            {
                token = await SwitchGymAsync(token, identity.GymId);
            }

            _tokenCache[identity.Email] = token;
            return token;
        }

        /// <summary>/api/auth/me is 200 only for a bearer token it understands; the
        /// selectedGym field mirrors the token's gymId claim.</summary>
        private async Task<bool> AuthMeHasSelectedGymAsync(string token)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var response = await Client.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return false;
            }

            var me = await response.Content.ReadFromJsonAsync<JsonElement>();
            return me.TryGetProperty("selectedGym", out var selectedGym)
                && selectedGym.ValueKind == JsonValueKind.Number
                && selectedGym.GetInt32() > 0;
        }

        private async Task<string> SwitchGymAsync(string token, int gymId)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/switch-gym")
            {
                Content = JsonContent.Create(new { gymId })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var response = await Client.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(
                    $"Switch-gym to {gymId} failed with {(int)response.StatusCode}.");
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json.GetProperty("accessToken").GetString()
                ?? throw new InvalidOperationException("Switch-gym returned no accessToken.");
        }

        public HttpRequestMessage AuthorizedRequest(HttpMethod method, string url, object? body, string token)
        {
            var request = new HttpRequestMessage(method, url)
            {
                Content = body is null ? null : JsonContent.Create(body)
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return request;
        }

        /// <summary>
        /// Resolves a live JObject-ish service scope for direct DB assertions.
        /// </summary>
        public IServiceScope NewScope() => _factory.Services.CreateScope();

        public async Task<int> EmployeeIdByEmailAsync(string email)
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
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

    [CollectionDefinition(SecurityApiFixture.CollectionName)]
    public class SecurityCollection : ICollectionFixture<SecurityApiFixture>
    {
    }
}
