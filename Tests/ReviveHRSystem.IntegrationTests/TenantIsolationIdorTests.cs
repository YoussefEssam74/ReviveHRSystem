using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Tenant isolation / IDOR suite. Gyms are tenants; a seeded HR principal of
    /// gym A must never see or mutate gym B's data through any route. The API
    /// deliberately answers 401 (modelled after the documented cross-gym detail
    /// behaviour in <see cref="EmployeesControllerTests"/>) or 404 (existence
    /// concealment) - the invariant tested here is that it never returns the
    /// other tenant's data with 2xx.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class TenantIsolationIdorTests
    {
        private readonly ApiTestFixture _fixture;
        private readonly TestDataBuilder _builder;

        public TenantIsolationIdorTests(ApiTestFixture fixture)
        {
            _fixture = fixture;
            _builder = new TestDataBuilder(fixture.Services);
        }

        [Fact]
        public async Task EmployeesList_OtherGymEmployeesNeverAppear()
        {
            var gymA = await _builder.CreateGymWithStationAsync();
            var gymB = await _builder.CreateGymWithStationAsync();
            var hrUser = await _builder.CreateUserAsync(UserTypeHR(), new[] { gymA });
            await _builder.GrantPermissionAsync(hrUser.UserId, "employees.view");

            // Employees live in different tenants.
            await _builder.CreateEmployeeAsync(gymA);
            var foreignEmployee = await _builder.CreateEmployeeAsync(gymB);

            var token = await _fixture.LoginAsync(hrUser.Email, hrUser.Password);
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees?page=1&pageSize=100", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items");
            for (var i = 0; i < items.GetArrayLength(); i++)
            {
                var employeeNumber = items[i].TryGetProperty("employeeNumber", out var number)
                    ? number.GetString()
                    : null;
                Assert.NotEqual(foreignEmployee.EmployeeNumber, employeeNumber);
            }
        }

        [Fact]
        public async Task EmployeeDetail_CrossGym_Returns401_NeverLeaksData()
        {
            var gymA = await _builder.CreateGymWithStationAsync();
            var gymB = await _builder.CreateGymWithStationAsync();
            var hrUser = await _builder.CreateUserAsync(UserTypeHR(), new[] { gymA });
            await _builder.GrantPermissionAsync(hrUser.UserId, "employees.view");
            var foreignEmployee = await _builder.CreateEmployeeAsync(gymB);

            var token = await _fixture.LoginAsync(hrUser.Email, hrUser.Password);
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{foreignEmployee.EmployeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            // Deliberate denial (existing suite pins 401); the data leak is the
            // real failure mode, so assert both the status and the body shape.
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            var raw = await response.Content.ReadAsStringAsync();
            Assert.DoesNotContain(foreignEmployee.EmployeeNumber, raw);
        }

        [Fact]
        public async Task ShiftTemplates_OtherGymRoute_Returns401()
        {
            var gymA = await _builder.CreateGymWithStationAsync();
            var gymB = await _builder.CreateGymWithStationAsync();
            var hrUser = await _builder.CreateUserAsync(UserTypeHR(), new[] { gymA });
            await _builder.CreateEmployeeAsync(gymA);
            await _builder.CreateEmployeeAsync(gymB);

            // Route gym (B) mismatches token gym (A) -> EnsureGymScope refuses.
            var token = await _fixture.LoginAsync(hrUser.Email, hrUser.Password);
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/gyms/{gymB.GymId}/shift-templates", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task PayrollSheets_OtherEmployee_Returns404()
        {
            // Self-scope: one employee must not read another employee's pay data,
            // even inside their own gym.
            var gym = await _builder.CreateGymWithStationAsync();
            var reader = await _builder.CreateEmployeeAsync(gym);
            var target = await _builder.CreateEmployeeAsync(gym);

            var token = await _fixture.LoginAsync(reader.Email, reader.Password);
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{target.EmployeeId}/payroll-sheets", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        private static DomainLayer.Models.UserModule.Enums.UserType UserTypeHR() =>
            DomainLayer.Models.UserModule.Enums.UserType.HR;
    }
}
