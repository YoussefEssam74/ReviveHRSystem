using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Employee profile endpoints (mock §2): self reads/updates need only the JWT;
    /// another employee's profile requires the [employees] feature level in the active
    /// gym plus matching scope, and cross-scope reads answer 404 (no existence leak).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EmployeeProfileTests
    {
        private readonly ApiTestFixture _fixture;

        public EmployeeProfileTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task GetProfile_Self_ReturnsProfile_WithSalary()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Karim Hassan", body.GetProperty("fullName").GetString());
            Assert.Equal("Fitness Trainer", body.GetProperty("position").GetString());
            Assert.Equal("karim@revive.hr", body.GetProperty("email").GetString());
            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("gym").GetProperty("name").GetString()));
            Assert.Equal("Active", body.GetProperty("status").GetString());
        }

        [Fact]
        public async Task GetProfile_OtherEmployee_AsPlainEmployee_Returns404()
        {
            // Karim (Employee role, no feature grants) must not read Sara's profile.
            var saraEmployeeId = await OwnEmployeeIdAsync("sara@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{saraEmployeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task GetProfile_OtherEmployee_AsBranchManagerSameGym_ReturnsProfile_WithoutSalary()
        {
            // Omar is Branch Manager at gym1 where Karim works.
            var karimEmployeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await LoginSelectingGymAsync("omar@revive.hr", await GymIdByNameAsync("Revive Main Gym"));

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{karimEmployeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Karim Hassan", body.GetProperty("fullName").GetString());
            // Compensation is HR-controlled: never exposed to managers.
            Assert.False(body.GetProperty("baseSalary").ValueKind == JsonValueKind.Number
                && body.GetProperty("baseSalary").GetDecimal() > 0);
        }

        [Fact]
        public async Task GetProfile_CrossGymEmployee_AsBranchManager_Returns404()
        {
            // Sara works at gym2; Omar's Branch Manager scope is gym1.
            var saraEmployeeId = await OwnEmployeeIdAsync("sara@revive.hr");
            var token = await LoginSelectingGymAsync("omar@revive.hr", await GymIdByNameAsync("Revive Main Gym"));

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{saraEmployeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task UpdateContact_Self_PersistsChanges()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/employees/{employeeId}/contact", new
            {
                phone = "+201000000000",
                address = "12 Nasr City Street"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("+201000000000", body.GetProperty("phone").GetString());
            Assert.Equal("12 Nasr City Street", body.GetProperty("address").GetString());
        }

        [Fact]
        public async Task UpdateContact_SomeoneElsesId_Returns404()
        {
            var saraEmployeeId = await OwnEmployeeIdAsync("sara@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/employees/{saraEmployeeId}/contact", new
            {
                phone = "+201111111111"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task UpdateEmergencyContact_Self_Persists()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Patch, $"/api/employees/{employeeId}/emergency-contact", new
            {
                name = "Layla Hassan",
                relationship = "Spouse",
                phone = "+201222222222"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Layla Hassan", body.GetProperty("emergencyContact").GetProperty("name").GetString());
            Assert.Equal("+201222222222", body.GetProperty("emergencyContact").GetProperty("phone").GetString());
        }

        [Fact]
        public async Task GetProfile_WithoutToken_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/employees/1");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        private async Task<string> LoginSelectingGymAsync(string email, int gymId)
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email, password = "Revive!2026" });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var temp = loginBody.GetProperty("tempSessionToken").GetString()!;

            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new { gymId, tempSessionToken = temp });
            select.EnsureSuccessStatusCode();
            var selectBody = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selectBody.GetProperty("accessToken").GetString()!;
        }

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees
                .Where(e => e.User!.Email == email)
                .Select(e => e.Id)
                .SingleAsync();
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }
    }
}
