using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
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
        public async Task GetProfile_Self_ReturnsDetailWithSalary()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");
            Assert.Equal("Karim Hassan", data.GetProperty("name").GetString());
            Assert.Equal("Fitness Trainer", data.GetProperty("position").GetString());
            Assert.Equal("karim@revive.hr", data.GetProperty("email").GetString());
            Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("gym").GetString()));
            Assert.Equal("Active", data.GetProperty("status").GetString());
        }

        [Fact]
        public async Task GetProfile_OtherEmployee_AsPlainEmployee_Returns401()
        {
            // Karim (Employee role, no feature grants) must not read Sara's profile.
            var saraEmployeeId = await OwnEmployeeIdAsync("sara@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{saraEmployeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetProfile_OtherGymEmployee_WithoutGymAccess_Returns401()
        {
            // A principal holding employees.view but with no access to the employee's
            // gym still cannot read it: the key grants the capability, the gym access
            // row grants the reach (the seeded Branch Manager does hold both gyms, so
            // this scenario is built explicitly).
            var builder = new TestDataBuilder(_fixture.Services);
            var ownGym = await builder.CreateGymWithStationAsync();
            var otherGym = await builder.CreateGymWithStationAsync();
            var outsider = await builder.CreateEmployeeAsync(otherGym);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { ownGym });
            await builder.GrantPermissionAsync(hr.UserId, "employees.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{outsider.EmployeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
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
        public async Task UpdateContact_SomeoneElsesId_ActsOnOwnRecord()
        {
            // Matrix row 22 (converged, actor-based): the contact write updates the
            // CALLER's own record — the route id is advisory. Karim addressing Sara's
            // id must succeed and must never touch Sara's data.
            var scopeText = "";
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var saraId = await db.Employees.AsNoTracking().FirstAsync(e => e.User.Email == "sara@revive.hr");
                scopeText = saraId.Phone ?? "";
            }

            var saraEmployeeId = await OwnEmployeeIdAsync("sara@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/employees/{saraEmployeeId}/contact", new
            {
                phone = "+201111111111"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var sara = await db.Employees.AsNoTracking().FirstAsync(e => e.User.Email == "sara@revive.hr");
                Assert.Equal(scopeText, sara.Phone ?? "");
                var karim = await db.Employees.AsNoTracking().FirstAsync(e => e.User.Email == "karim@revive.hr");
                Assert.Equal("+201111111111", karim.Phone);
            }
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
