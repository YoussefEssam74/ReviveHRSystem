using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.UserModule.Enums;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// My Access profile + the §5.9 support screens: GET /api/users/{id}
    /// (§5.8 access card), the org-wide positions catalog with headcount/open/fill
    /// derivation (§9.2), the read-only audit log with its category/user/gym/date
    /// filters (§9.3), and the overview CSV export (§9.1).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class ReportingControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public ReportingControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);
        private static string UniqueSuffix() => Guid.NewGuid().ToString("N")[..8];

        // ------------------------------------------------------------------
        // §5.8 — GET /api/users/{id} (access profile)
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetUserAccessProfile_Self_ReturnsContract()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.LoginAsync(employee.Email, employee.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/users/{employee.UserId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = json.GetProperty("data");
            Assert.Equal(employee.UserId, data.GetProperty("id").GetInt32());
            Assert.Equal(employee.Email, data.GetProperty("email").GetString());
            Assert.Equal("Employee", data.GetProperty("role").GetString());
            Assert.True(data.GetProperty("permissions").ValueKind == JsonValueKind.Array);
            Assert.True(data.GetProperty("effectivePermissions").ValueKind == JsonValueKind.Array);

            var gymItem = data.GetProperty("gyms").EnumerateArray()
                .First(g => g.GetProperty("id").GetInt32() == gym.GymId);
            Assert.Equal(gym.Name, gymItem.GetProperty("name").GetString());
            Assert.Equal("Test", gymItem.GetProperty("branch").GetString());

            Assert.True(data.GetProperty("trackedCount").GetInt32() > 0);
            Assert.True(data.GetProperty("grantedCount").GetInt32() >= 0);
            Assert.True(data.GetProperty("grantedCount").GetInt32() <= data.GetProperty("trackedCount").GetInt32());
        }

        [Fact]
        public async Task GetUserAccessProfile_OtherUser_WithoutTeamView_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var first = await builder.CreateEmployeeAsync(gym);
            var second = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.LoginAsync(first.Email, first.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/users/{second.UserId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetUserAccessProfile_OtherUser_WithTeamView_Returns200()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var viewer = await builder.CreateEmployeeAsync(gym);
            var subject = await builder.CreateEmployeeAsync(gym);
            await builder.GrantPermissionAsync(viewer.UserId, "team.view");
            var token = await _fixture.LoginAsync(viewer.Email, viewer.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/users/{subject.UserId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(subject.UserId, json.GetProperty("data").GetProperty("id").GetInt32());
        }

        [Fact]
        public async Task GetUserAccessProfile_UnknownUser_Returns404()
        {
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/users/99999999", null, admin);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // §9.2 — positions catalog
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetPositions_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/positions");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetPositions_WithoutPermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/positions", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task CreatePosition_Returns201_WithLevelsAndDerivation()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var title = $"Head Coach {UniqueSuffix()}";

            var createRequest = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/positions", new
            {
                title,
                levels = new[] { "Junior", "Mid", "Senior" },
                department = "Training",
                gym = gym.Name,
                headcount = 4
            }, admin);
            var createResponse = await _fixture.Client.SendAsync(createRequest);
            Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

            var created = (await createResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            var positionId = created.GetProperty("id").GetInt32();
            Assert.Equal(title, created.GetProperty("title").GetString());
            Assert.Equal(gym.Name, created.GetProperty("gym").GetString());
            Assert.Equal("Training", created.GetProperty("department").GetString());
            Assert.Equal(4, created.GetProperty("headcount").GetInt32());
            Assert.Equal(0, created.GetProperty("active").GetInt32());
            Assert.Equal(4, created.GetProperty("open").GetInt32());
            Assert.Equal(0, created.GetProperty("fill").GetInt32());
            Assert.Equal(
                new[] { "Junior", "Mid", "Senior" },
                created.GetProperty("levels").EnumerateArray().Select(l => l.GetString()).ToArray());

            // The row is listed under its gym scope.
            var listRequest = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/positions?gym={gym.GymId}", null, admin);
            var listResponse = await _fixture.Client.SendAsync(listRequest);
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listJson = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            var listed = listJson.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("id").GetInt32() == positionId);
            Assert.Equal(title, listed.GetProperty("title").GetString());

            // Partial update: headcount + levels.
            var updateRequest = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/positions/{positionId}", new
            {
                headcount = 6,
                levels = new[] { "Senior" }
            }, admin);
            var updateResponse = await _fixture.Client.SendAsync(updateRequest);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var updated = (await updateResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal(6, updated.GetProperty("headcount").GetInt32());
            Assert.Equal(new[] { "Senior" }, updated.GetProperty("levels").EnumerateArray().Select(l => l.GetString()).ToArray());
            Assert.Equal(title, updated.GetProperty("title").GetString());
        }

        [Fact]
        public async Task Positions_FillDerivesFromHeldEmployees()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            _ = await builder.CreateEmployeeAsync(gym); // holds the seeded "IT Tester" position
            var admin = await _fixture.GetAdminTokenAsync();

            // Find the employee's position row through the catalog.
            var findRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/positions?gym={gym.GymId}&searchTerm=IT%20Tester", null, admin);
            var findResponse = await _fixture.Client.SendAsync(findRequest);
            Assert.Equal(HttpStatusCode.OK, findResponse.StatusCode);
            var before = (await findResponse.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("items").EnumerateArray().First();
            var positionId = before.GetProperty("id").GetInt32();
            Assert.Equal(1, before.GetProperty("active").GetInt32());

            // Planned headcount 1 with 1 holder → full, nothing open.
            var updateRequest = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/positions/{positionId}", new
            {
                headcount = 1
            }, admin);
            var updateResponse = await _fixture.Client.SendAsync(updateRequest);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

            var after = (await updateResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal(1, after.GetProperty("active").GetInt32());
            Assert.Equal(0, after.GetProperty("open").GetInt32());
            Assert.Equal(100, after.GetProperty("fill").GetInt32());
        }

        [Fact]
        public async Task CreatePosition_UnknownGym_Returns400()
        {
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/positions", new
            {
                title = $"Ghost Role {UniqueSuffix()}",
                levels = new[] { "Junior" },
                gym = "No Such Gym Ever"
            }, admin);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body.TryGetProperty("errorMessage", out _));
        }

        [Fact]
        public async Task CreatePosition_WithoutManagePermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "positions.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            // Can read …
            var readRequest = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/positions", null, token);
            var readResponse = await _fixture.Client.SendAsync(readRequest);
            Assert.Equal(HttpStatusCode.OK, readResponse.StatusCode);

            // … but cannot write without positions.manage.
            var writeRequest = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/positions", new
            {
                title = $"Blocked {UniqueSuffix()}",
                levels = new[] { "Junior" },
                gym = gym.Name
            }, token);
            var writeResponse = await _fixture.Client.SendAsync(writeRequest);
            Assert.Equal(HttpStatusCode.Unauthorized, writeResponse.StatusCode);
        }

        // ------------------------------------------------------------------
        // §9.3 — audit log
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetAuditLog_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/audit-log");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetAuditLog_WithoutPermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/audit-log", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetAuditLog_ReturnsRows_WithCategoryAndUserFilters()
        {
            var builder = NewBuilder();
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var subject = await builder.CreateEmployeeAsync(gymA);
            var employeeRowId = await builder.CreateAuditLogAsync(
                subject.UserId, "Employee Updated", "Employee", 123, gymA.GymId,
                """{"fullName":"Jane Doe"}""");
            var payrollRowId = await builder.CreateAuditLogAsync(
                subject.UserId, "Payroll Published", "PayrollPeriod", 456, gymB.GymId,
                """{"status":"Published"}""");
            var admin = await _fixture.GetAdminTokenAsync();

            // Both rows under the acting user.
            var all = await GetAuditAsync(admin, $"?user={subject.UserId}");
            Assert.True(all.GetProperty("total").GetInt32() >= 2);
            var employeeItem = all.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("id").GetInt32() == employeeRowId);
            Assert.Equal("Employee Updated", employeeItem.GetProperty("action").GetString());
            Assert.Equal("Employee #123", employeeItem.GetProperty("target").GetString());
            Assert.Contains("fullName", employeeItem.GetProperty("detail").GetString());
            Assert.Equal(gymA.Name, employeeItem.GetProperty("gym").GetString());
            Assert.False(string.IsNullOrWhiteSpace(employeeItem.GetProperty("user").GetString()));
            Assert.True(employeeItem.GetProperty("timestamp").GetDateTime() <= DateTime.UtcNow);

            // Category filter → Employee only, then Payroll only.
            var employeeOnly = await GetAuditAsync(admin, $"?user={subject.UserId}&action=Employee");
            var employeeIds = employeeOnly.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToArray();
            Assert.Contains(employeeRowId, employeeIds);
            Assert.DoesNotContain(payrollRowId, employeeIds);

            var payrollOnly = await GetAuditAsync(admin, $"?user={subject.UserId}&action=Payroll");
            var payrollIds = payrollOnly.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToArray();
            Assert.Contains(payrollRowId, payrollIds);
            Assert.DoesNotContain(employeeRowId, payrollIds);

            // Gym filter → the other gym's rows drop out.
            var gymFiltered = await GetAuditAsync(admin, $"?user={subject.UserId}&gym={gymB.GymId}");
            var gymIds = gymFiltered.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToArray();
            Assert.Contains(payrollRowId, gymIds);
            Assert.DoesNotContain(employeeRowId, gymIds);

            // Paging envelope.
            Assert.True(all.GetProperty("page").GetInt32() >= 1);
            Assert.True(all.GetProperty("pageSize").GetInt32() > 0);
            Assert.True(all.GetProperty("totalPages").GetInt32() >= 1);
        }

        // ------------------------------------------------------------------
        // §9.1 — report export
        // ------------------------------------------------------------------

        [Fact]
        public async Task ExportReport_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/reports/export?period=30d&format=csv");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task ExportReport_WithoutPermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/reports/export?period=30d&format=csv", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task ExportReport_ReturnsCsvStream_WithOverviewSections()
        {
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/reports/export?period=90d&format=csv", null, admin);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);

            var csv = await response.Content.ReadAsStringAsync();
            Assert.StartsWith("Section,Metric,Value", csv);
            Assert.Contains("\"Workforce\"", csv);
            Assert.Contains("\"Attendance\"", csv);
            Assert.Contains("\"Hiring\"", csv);

            var fileName = response.Content.Headers.ContentDisposition?.FileName ?? string.Empty;
            Assert.Contains("90d", fileName);
        }

        private async Task<JsonElement> GetAuditAsync(string token, string queryString)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/audit-log{queryString}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }
    }
}
