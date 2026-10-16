using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DomainLayer.Models.UserModule.Enums;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Employees module (S1): directory listing with gym scoping / search / status
    /// filters / pagination, onboarding, profile edits, status changes, career
    /// history, leave balances, transfers, position &amp; compensation changes,
    /// contract changes, document uploads and CSV bulk import.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EmployeesControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public EmployeesControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        // ------------------------------------------------------------------
        // GET /api/employees — directory
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetList_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/employees");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetList_HrWithoutPermission_Returns401()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var builder = new TestDataBuilder(_fixture.Services);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetList_Admin_ReturnsEmployeesAcrossGyms()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var employeeA = await builder.CreateEmployeeAsync(gymA);
            var employeeB = await builder.CreateEmployeeAsync(gymB);
            var token = await _fixture.GetAdminTokenAsync();

            // pageSize=100 (the max): the shared test DB accumulates employees
            // across the suite, so the default first page isn't guaranteed to
            // contain the ones created by this test.
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees?pageSize=100", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var ids = body.GetProperty("items").EnumerateArray()
                .Select(i => i.GetProperty("id").GetInt32()).ToList();
            Assert.Contains(employeeA.EmployeeId, ids);
            Assert.Contains(employeeB.EmployeeId, ids);
        }

        [Fact]
        public async Task GetList_Hr_ReturnsOnlyAssignedGymEmployees()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var employeeA = await builder.CreateEmployeeAsync(gymA);
            _ = await builder.CreateEmployeeAsync(gymB);

            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await builder.GrantPermissionAsync(hr.UserId, "employees.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var items = body.GetProperty("items").EnumerateArray().ToList();
            Assert.All(items, i => Assert.Equal(gymA.GymId, i.GetProperty("gymId").GetInt32()));
            Assert.Contains(items, i => i.GetProperty("id").GetInt32() == employeeA.EmployeeId);
        }

        [Fact]
        public async Task GetList_Hr_GymFilterForUnassignedGym_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await builder.GrantPermissionAsync(hr.UserId, "employees.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees?gym={gymB.GymId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetList_Search_FiltersByName()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var adminToken = await _fixture.GetAdminTokenAsync();

            var created = await CreateViaApiAsync(adminToken, new
            {
                firstName = "Zorblatt",
                lastName = "Quintuplet",
                email = UniqueEmail(),
                position = "Trainer",
                level = "2",
                gym = gym.GymId,
                startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
            });

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/employees?search=Zorblatt", null, adminToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var items = body.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(items);
            Assert.Equal(created.GetProperty("id").GetInt32(), items[0].GetProperty("id").GetInt32());
        }

        [Fact]
        public async Task GetList_InvalidStatus_Returns400()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/employees?status=Retired", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task GetList_Pagination_ReturnsEnvelope()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            await builder.CreateEmployeeAsync(gym);
            await builder.CreateEmployeeAsync(gym);
            await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees?gym={gym.GymId}&pageSize=2&page=1", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(3, body.GetProperty("total").GetInt32());
            Assert.Equal(1, body.GetProperty("page").GetInt32());
            Assert.Equal(2, body.GetProperty("pageSize").GetInt32());
            Assert.Equal(2, body.GetProperty("totalPages").GetInt32());
            Assert.Equal(2, body.GetProperty("items").GetArrayLength());
        }

        // ------------------------------------------------------------------
        // POST /api/employees — onboarding
        // ------------------------------------------------------------------

        [Fact]
        public async Task Create_Anonymous_Returns401()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/employees", new { });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Create_Valid_ReturnsDataEnvelopeWithInitialsAndNumber()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();

            var response = await CreateViaApiRawAsync(token, new
            {
                firstName = "Jane",
                lastName = "Doe",
                email = UniqueEmail(),
                phone = "01000000000",
                position = "Trainer",
                level = "2",
                salary = 5000,
                gym = gym.GymId,
                startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
            });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Jane Doe", data.GetProperty("name").GetString());
            Assert.Equal("JD", data.GetProperty("initials").GetString());
            Assert.StartsWith("EMP-", data.GetProperty("employeeNumber").GetString());
            Assert.Equal("Active", data.GetProperty("status").GetString());
            Assert.Equal(gym.GymId, data.GetProperty("gymId").GetInt32());
            Assert.Equal(5000, data.GetProperty("salary").GetDecimal());
        }

        [Fact]
        public async Task Create_DuplicateEmail_Returns400()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var email = UniqueEmail();
            await CreateViaApiAsync(token, new
            {
                firstName = "Jane",
                lastName = "Doe",
                email,
                position = "Trainer",
                level = "2",
                gym = gym.GymId,
                startDate = DateOnly.FromDateTime(DateTime.UtcNow),
            });

            var response = await CreateViaApiRawAsync(token, new
            {
                firstName = "John",
                lastName = "Doe",
                email,
                position = "Trainer",
                level = "2",
                gym = gym.GymId,
                startDate = DateOnly.FromDateTime(DateTime.UtcNow),
            });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Create_GymWithoutAccess_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await builder.GrantPermissionAsync(hr.UserId, "employees.create");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var response = await CreateViaApiRawAsync(token, new
            {
                firstName = "OutOf",
                lastName = "Scope",
                email = UniqueEmail(),
                position = "Trainer",
                level = "2",
                gym = gymB.GymId,
                startDate = DateOnly.FromDateTime(DateTime.UtcNow),
            });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // GET /api/employees/{id} — detail
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetDetail_Unknown_Returns404()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees/99999999", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task GetDetail_CrossGym_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var employeeB = await builder.CreateEmployeeAsync(gymB);

            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await builder.GrantPermissionAsync(hr.UserId, "employees.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeB.EmployeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // PUT /api/employees/{id} — edit
        // ------------------------------------------------------------------

        [Fact]
        public async Task Put_Update_ChangesNameAndPosition()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, new
            {
                firstName = "Old",
                lastName = "Name",
                email = UniqueEmail(),
                position = "Trainer",
                level = "2",
                gym = gym.GymId,
                startDate = DateOnly.FromDateTime(DateTime.UtcNow),
            });
            var id = created.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/employees/{id}", new
            {
                name = "Renamed Person",
                position = "Coach",
            }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Renamed Person", body.GetProperty("name").GetString());
            Assert.Equal("Coach", body.GetProperty("position").GetString());
            // Level is untouched when the request does not carry one.
            Assert.Equal("2", body.GetProperty("level").GetString());
        }

        // ------------------------------------------------------------------
        // POST /api/employees/{id}/status-change
        // ------------------------------------------------------------------

        [Fact]
        public async Task StatusChange_InvalidStatus_Returns400()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/employees/{id}/status-change", new { status = "Retired" }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task StatusChange_Suspended_UpdatesStatusAndWritesHistory()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/employees/{id}/status-change",
                new { status = "Suspended", note = "Policy violation" }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Suspended", body.GetProperty("status").GetString());

            var history = await GetHistoryAsync(token, id);
            var entry = Assert.Single(history, h => h.GetProperty("type").GetString() == "Status Changed");
            Assert.Equal("Active", entry.GetProperty("from").GetString());
            Assert.Equal("Suspended", entry.GetProperty("to").GetString());
            Assert.Equal("Policy violation", entry.GetProperty("detail").GetString());
        }

        // ------------------------------------------------------------------
        // GET /api/employees/{id}/history
        // ------------------------------------------------------------------

        [Fact]
        public async Task History_NewHire_ShowsJoinedRevive()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var history = await GetHistoryAsync(token, id);

            var hire = Assert.Single(history);
            Assert.Equal("Joined Revive", hire.GetProperty("type").GetString());
            Assert.Contains(gym.Name, hire.GetProperty("to").GetString());
        }

        // ------------------------------------------------------------------
        // Leave balances
        // ------------------------------------------------------------------

        [Fact]
        public async Task LeaveBalance_NewEmployee_ReturnsZeroBuckets()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{id}/leave-balance", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(id, body.GetProperty("employeeId").GetInt32());
            Assert.Equal(0, body.GetProperty("dayOff").GetProperty("used").GetDecimal());
            Assert.Equal(0, body.GetProperty("dayOff").GetProperty("total").GetDecimal());
            Assert.Equal(0, body.GetProperty("sick").GetProperty("used").GetDecimal());
            Assert.Equal(0, body.GetProperty("unpaid").GetProperty("total").GetDecimal());
        }

        [Fact]
        public async Task LeaveBalance_UpdateWithPermission_UpdatesBuckets()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var adminToken = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(adminToken, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "employees.view");
            await builder.GrantPermissionAsync(hr.UserId, "employees.leave_balance.manage");
            var hrToken = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/employees/{id}/leave-balance", new
                {
                    dayOff = new { used = 3, total = 21 },
                    sick = new { used = 1, total = 14 },
                    unpaid = new { used = 0, total = 0 },
                }, hrToken);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // The PUT returns a message; read the balances back through GET.
            var getRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{id}/leave-balance", null, adminToken);
            var getResponse = await _fixture.Client.SendAsync(getRequest);
            var body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(3, body.GetProperty("dayOff").GetProperty("used").GetDecimal());
            Assert.Equal(21, body.GetProperty("dayOff").GetProperty("total").GetDecimal());
            Assert.Equal(1, body.GetProperty("sick").GetProperty("used").GetDecimal());
        }

        [Fact]
        public async Task LeaveBalance_UpdateWithoutPermission_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var adminToken = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(adminToken, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "employees.view");
            var hrToken = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/employees/{id}/leave-balance", new
                {
                    dayOff = new { used = 3, total = 21 },
                }, hrToken);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // POST /api/employees/{id}/transfer
        // ------------------------------------------------------------------

        [Fact]
        public async Task Transfer_MovesEmployeeBetweenGyms()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gymA.GymId));
            var id = created.GetProperty("id").GetInt32();

            var hrA = await builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await builder.GrantPermissionAsync(hrA.UserId, "employees.view");
            var hrAToken = await _fixture.LoginAsync(hrA.Email, hrA.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/employees/{id}/transfer", new
                {
                    toGym = gymB.GymId,
                    effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
                    reason = "Branch reassignment",
                }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // The transfer returns a message; confirm the move through the detail endpoint.
            var detailRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{id}", null, token);
            var detailResponse = await _fixture.Client.SendAsync(detailRequest);
            var body = await detailResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(gymB.GymId, body.GetProperty("data").GetProperty("gymId").GetInt32());

            // The old gym's HR can no longer see the employee (IDOR guard after move).
            var oldGymRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{id}", null, hrAToken);
            var oldGymResponse = await _fixture.Client.SendAsync(oldGymRequest);
            Assert.Equal(HttpStatusCode.Unauthorized, oldGymResponse.StatusCode);

            // And the employee dropped out of the old gym's directory listing.
            var listRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees?gym={gymA.GymId}", null, hrAToken);
            var listResponse = await _fixture.Client.SendAsync(listRequest);
            var listBody = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            var ids = listBody.GetProperty("items").EnumerateArray()
                .Select(i => i.GetProperty("id").GetInt32()).ToList();
            Assert.DoesNotContain(id, ids);

            var history = await GetHistoryAsync(token, id);
            Assert.Contains(history, h => h.GetProperty("type").GetString() == "Gym Transfer");
        }

        [Fact]
        public async Task Transfer_ToUnassignedGym_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var adminToken = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(adminToken, NewHireBody(gymA.GymId));
            var id = created.GetProperty("id").GetInt32();

            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await builder.GrantPermissionAsync(hr.UserId, "employees.view");
            await builder.GrantPermissionAsync(hr.UserId, "employees.transfer");
            var hrToken = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/employees/{id}/transfer", new
                {
                    toGym = gymB.GymId,
                    effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
                    reason = "Should not be allowed",
                }, hrToken);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // POST /api/employees/{id}/position-change
        // ------------------------------------------------------------------

        [Fact]
        public async Task PositionChange_UpdatesPositionAndLevel()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/employees/{id}/position-change",
                new { position = "Head Trainer", level = "3" }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // The position change returns a message; confirm through the detail endpoint.
            var detailRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{id}", null, token);
            var detailResponse = await _fixture.Client.SendAsync(detailRequest);
            var body = await detailResponse.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");
            Assert.Equal("Head Trainer", data.GetProperty("position").GetString());
            Assert.Equal("3", data.GetProperty("level").GetString());

            var history = await GetHistoryAsync(token, id);
            Assert.Contains(history, h => h.GetProperty("type").GetString() == "Position Changed");
        }

        // ------------------------------------------------------------------
        // POST /api/employees/{id}/compensation & contract-change
        // ------------------------------------------------------------------

        [Fact]
        public async Task Compensation_SetsSalaryAndWritesHistory()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/employees/{id}/compensation",
                new { salary = 7500, effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow) }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // The compensation change returns a message; salary shows in the detail view.
            var detailRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{id}", null, token);
            var detailResponse = await _fixture.Client.SendAsync(detailRequest);
            var body = await detailResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(7500, body.GetProperty("data").GetProperty("salary").GetDecimal());

            var history = await GetHistoryAsync(token, id);
            Assert.Contains(history, h => h.GetProperty("type").GetString() == "Salary Changed");
        }

        [Fact]
        public async Task ContractChange_UpdatesLevelAndSalary()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/employees/{id}/contract",
                new { level = "Senior", salary = 6500 }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // The contract change returns a message; level & salary show in the detail view.
            var detailRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{id}", null, token);
            var detailResponse = await _fixture.Client.SendAsync(detailRequest);
            var body = await detailResponse.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");
            Assert.Equal("Senior", data.GetProperty("level").GetString());
            Assert.Equal(6500, data.GetProperty("salary").GetDecimal());

            var history = await GetHistoryAsync(token, id);
            Assert.Contains(history, h => h.GetProperty("type").GetString() == "Contract Updated");
        }

        // ------------------------------------------------------------------
        // Documents
        // ------------------------------------------------------------------

        [Fact]
        public async Task Documents_UploadAndList()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var uploadResponse = await UploadDocumentAsync(token, id, "contract.pdf", "Contract");
            var uploadBody = await uploadResponse.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, uploadResponse.StatusCode);
            Assert.Equal("contract.pdf", uploadBody.GetProperty("name").GetString());
            Assert.Equal("Employment Contract", uploadBody.GetProperty("category").GetString());
            Assert.Equal("Valid", uploadBody.GetProperty("status").GetString());

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{id}/documents", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var documents = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Single(documents.EnumerateArray());
        }

        [Fact]
        public async Task Documents_InvalidCategory_Returns400()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var created = await CreateViaApiAsync(token, NewHireBody(gym.GymId));
            var id = created.GetProperty("id").GetInt32();

            var response = await UploadDocumentAsync(token, id, "file.pdf", "Banana");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // POST /api/employees/bulk-import
        // ------------------------------------------------------------------

        [Fact]
        public async Task BulkImport_AddsAndSkipsRows()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var unique = UniqueEmail();
            var csv =
                "Name,Email,Position,Level,Gym,Salary\n" +
                $"Bulk Person,{unique},Trainer,2,{gym.Name},5000\n" +
                $"Bad Email,not-an-email,Trainer,2,{gym.Name},100\n" +
                $"Duplicate,karim@revive.hr,Trainer,2,{gym.Name},100\n";

            using var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
            content.Add(fileContent, "file", "import.csv");
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/employees/bulk-import")
            {
                Content = content,
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(1, body.GetProperty("added").GetInt32());
            Assert.Equal(2, body.GetProperty("skipped").GetInt32());

            // The imported employee is actually in the directory now.
            var listRequest = _fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/employees?search=Bulk Person", null, token);
            var listResponse = await _fixture.Client.SendAsync(listRequest);
            var listBody = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Single(listBody.GetProperty("items").EnumerateArray());
        }

        [Fact]
        public async Task BulkImport_WithoutPermission_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var hrToken = await _fixture.LoginAsync(hr.Email, hr.Password);

            using var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("Name,Email\nX,x@y.z\n"));
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
            content.Add(fileContent, "file", "import.csv");
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/employees/bulk-import")
            {
                Content = content,
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", hrToken);

            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private static object NewHireBody(int gymId) => new
        {
            firstName = "Hank",
            lastName = "Newhire",
            email = UniqueEmail(),
            position = "Trainer",
            level = "2",
            gym = gymId,
            startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
        };

        private static string UniqueEmail() => $"emp-{Guid.NewGuid():N}@test.local".ToLowerInvariant();

        private async Task<JsonElement> CreateViaApiAsync(string token, object body)
        {
            var response = await CreateViaApiRawAsync(token, body);
            var text = await response.Content.ReadAsStringAsync();
            var json = JsonDocument.Parse(text).RootElement;
            if ((int)response.StatusCode >= 400 ||
                json.ValueKind != JsonValueKind.Object ||
                !json.TryGetProperty("data", out var data))
            {
                throw new InvalidOperationException($"Create failed: {(int)response.StatusCode} {text}");
            }

            return data;
        }

        private async Task<HttpResponseMessage> CreateViaApiRawAsync(string token, object body)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/employees", body, token);
            return await _fixture.Client.SendAsync(request);
        }

        private async Task<List<JsonElement>> GetHistoryAsync(string token, int employeeId)
        {
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/history", null, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.EnumerateArray().ToList();
        }

        private async Task<HttpResponseMessage> UploadDocumentAsync(
            string token, int employeeId, string fileName, string category)
        {
            using var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("%PDF-1.4 test"));
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            content.Add(fileContent, "file", fileName);
            content.Add(new StringContent(category), "category");

            var request = new HttpRequestMessage(
                HttpMethod.Post, $"/api/employees/{employeeId}/documents")
            {
                Content = content,
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return await _fixture.Client.SendAsync(request);
        }
    }
}
