using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.Web.DataSeed;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Employee directory against the HR-portal contract (S1): gym-scoped listing,
    /// gym isolation, and the create → edit → status-change lifecycle with its
    /// employment-history trail. Permission gates are covered by
    /// EmployeesControllerTests; these tests authenticate as the seeded Top
    /// Management account (which bypasses permission checks per ADR-003) and scope
    /// by gym in the query/body.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EmployeeManagementTests
    {
        private readonly ApiTestFixture _fixture;

        public EmployeeManagementTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Directory_PlainEmployee_Returns401()
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Directory_BranchGym_SeesGymRoster()
        {
            var (token, gym1Id) = await LoginAdminWithGymAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees?gym={gym1Id}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(body.GetProperty("items").EnumerateArray(), e => e.GetProperty("name").GetString() == "Karim Hassan");
        }

        [Fact]
        public async Task Directory_CrossGym_SeesOnlyActiveGym()
        {
            var (token, _) = await LoginAdminWithGymAsync();
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var gym2Id = await GymIdByNameAsync("Revive Second Gym");

            var gym1Employees = await GetNamesAsync(token, gym1Id);
            var gym2Employees = await GetNamesAsync(token, gym2Id);

            // Gym isolation: neither roster contains the other gym's employees.
            Assert.Contains("Karim Hassan", gym1Employees);
            Assert.Contains("Sara Ali", gym2Employees);
            Assert.DoesNotContain("Sara Ali", gym1Employees);
            Assert.DoesNotContain("Karim Hassan", gym2Employees);
        }

        [Fact]
        public async Task Create_Edit_StatusChange_RecordsHistory()
        {
            var (token, gym1Id) = await LoginAdminWithGymAsync();
            var positionTitle = await AnyPositionTitleAsync(gym1Id);

            var create = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/employees", new
            {
                firstName = "Nadia",
                lastName = "Fouad",
                email = $"nadia.fouad.{Guid.NewGuid():N}@revive.hr",
                position = positionTitle,
                level = "1",
                gym = gym1Id
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(createResponse.IsSuccessStatusCode, "EMP CREATE: " + created.ToString());
            var employeeId = created.GetProperty("data").GetProperty("id").GetInt32();

            var edit = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/employees/{employeeId}", new
            {
                name = "Nadia Fouad Ahmed",
                status = "Active"
            }, token);
            var editResponse = await _fixture.Client.SendAsync(edit);
            editResponse.EnsureSuccessStatusCode();
            var edited = await editResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Nadia Fouad Ahmed", edited.GetProperty("name").GetString());

            var statusChange = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{employeeId}/status-change", new
            {
                status = "Suspended",
                note = "Pending investigation"
            }, token);
            var statusResponse = await _fixture.Client.SendAsync(statusChange);
            statusResponse.EnsureSuccessStatusCode();

            // The status change is a timeline event, not an overwrite.
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var history = await db.EmploymentHistories
                .Where(h => h.EmployeeId == employeeId && h.ChangeType == DomainLayer.Models.EmployeeModule.Enums.EmploymentChangeType.StatusChange)
                .ToListAsync();
            var entry = Assert.Single(history);
            Assert.Contains("Active", entry.OldValueJson!);
            Assert.Contains("Suspended", entry.NewValueJson!);
            Assert.Equal("Pending investigation", entry.Reason);
        }

        [Fact]
        public async Task Directory_Admin_SeesEveryGym()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees?pageSize=100", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var names = body.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("name").GetString()).ToList();
            Assert.Contains("Karim Hassan", names!);
            Assert.Contains("Sara Ali", names!);
        }

        // ---------- helpers ----------

        private async Task<IReadOnlyList<string>> GetNamesAsync(string token, int gymId)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees?gym={gymId}&pageSize=100", null, token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("name").GetString()!).ToList();
        }

        private async Task<(string Token, int Gym1Id)> LoginAdminWithGymAsync()
        {
            var token = await _fixture.GetAdminTokenAsync();
            return (token, await GymIdByNameAsync("Revive Main Gym"));
        }

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }

        private async Task<string> AnyPositionTitleAsync(int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Positions.Where(p => p.GymId == gymId).OrderBy(p => p.Id).Select(p => p.Title).FirstAsync();
        }
    }
}
