using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Shared.DataTransferObject.Attendance;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Shift management (mock Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â§15-16): cycle create/publish/delete, assignment
    /// upserts (paint), template CRUD, feature gates and team scope. Employees only
    /// see published cycles through the Slice 1 schedule endpoint.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class ShiftManagementTests
    {
        private readonly ApiTestFixture _fixture;

        public ShiftManagementTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Templates_CRUD_And_AssignmentCleanup()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);

            // Create
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gym1Id}/shift-templates", new
            {
                name = "Split Shift",
                start = new TimeOnly(10, 0),
                end = new TimeOnly(18, 0)
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            var templateId = created.GetProperty("id").GetInt32();
            Assert.Equal("Split Shift", created.GetProperty("name").GetString());

            // Update
            var update = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-templates/{templateId}", new
            {
                name = "Split Shift (Late)",
                start = new TimeOnly(11, 0),
                end = new TimeOnly(19, 0)
            }, token);
            var updateResponse = await _fixture.Client.SendAsync(update);
            updateResponse.EnsureSuccessStatusCode();
            var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Split Shift (Late)", updated.GetProperty("name").GetString());

            // Use it in an assignment, then delete the template: the cell becomes an Off Day.
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3);
            var cycleId = await CreateCycleAsync(gym1Id, token, day);

            var assign = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/assignments", new
            {
                assignments = new[] { new { employeeId, date = day, shiftTemplateId = templateId } }
            }, token);
            (await _fixture.Client.SendAsync(assign)).EnsureSuccessStatusCode();

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/gyms/{gym1Id}/shift-templates/{templateId}", null, token);
            var deleteResponse = await _fixture.Client.SendAsync(delete);
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var assignment = await db.ShiftAssignments.FirstAsync(a => a.EmployeeId == employeeId && a.Date == day);
            Assert.Null(assignment.ShiftTemplateId);
        }

        [Fact]
        public async Task Template_InvalidTimeWindow_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);

            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gym1Id}/shift-templates", new
            {
                name = "Backwards",
                start = new TimeOnly(18, 0),
                end = new TimeOnly(9, 0)
            }, token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Cycle_Publish_MakesScheduleVisibleToEmployee()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(4);
            var templateId = await AnyShiftTemplateIdAsync(gym1Id);

            var cycleId = await CreateCycleAsync(gym1Id, token, day);

            // Draft: the employee's schedule endpoint does not expose it yet.
            var draftSchedule = await GetEmployeeScheduleAsync(employeeId, day);
            Assert.DoesNotContain(draftSchedule, d => d == day);

            // Paint one employee + one day, then publish.
            var assign = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/assignments", new
            {
                assignments = new[] { new { employeeId, date = day, shiftTemplateId = templateId } }
            }, token);
            (await _fixture.Client.SendAsync(assign)).EnsureSuccessStatusCode();

            var publish = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/publish", new { }, token);
            var publishResponse = await _fixture.Client.SendAsync(publish);
            Assert.Equal(HttpStatusCode.NoContent, publishResponse.StatusCode);

            var publishedSchedule = await GetEmployeeScheduleAsync(employeeId, day);
            Assert.Contains(publishedSchedule, d => d == day);
        }

        [Fact]
        public async Task Cycle_Delete_RemovesAssignments()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5);
            var templateId = await AnyShiftTemplateIdAsync(gym1Id);

            var cycleId = await CreateCycleAsync(gym1Id, token, day);
            var assign = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/assignments", new
            {
                assignments = new[] { new { employeeId, date = day, shiftTemplateId = templateId } }
            }, token);
            (await _fixture.Client.SendAsync(assign)).EnsureSuccessStatusCode();

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}", null, token);
            var deleteResponse = await _fixture.Client.SendAsync(delete);
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            Assert.False(await db.ShiftCycles.AnyAsync(c => c.Id == cycleId));
            Assert.False(await db.ShiftAssignments.AnyAsync(a => a.ShiftCycleId == cycleId));
        }

        [Fact]
        public async Task Cycles_PlainEmployee_Returns403()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/gyms/{gym1Id}/shift-cycles", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task Assignments_TargetingOtherGymEmployee_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");
            var day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(6);

            var cycleId = await CreateCycleAsync(gym1Id, token, day);
            var assign = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/assignments", new
            {
                assignments = new[] { new { employeeId = saraId, date = day, shiftTemplateId = (int?)null } }
            }, token);
            var response = await _fixture.Client.SendAsync(assign);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ---------- helpers ----------

        private async Task<int> CreateCycleAsync(int gymId, string token, DateOnly day)
        {
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gymId}/shift-cycles", new
            {
                startDate = day,
                endDate = day
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            return created.GetProperty("id").GetInt32();
        }

        private async Task<List<DateOnly>> GetEmployeeScheduleAsync(int employeeId, DateOnly day)
        {
            // The scheduled employee reads his own published schedule (Slice 1 endpoint).
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/schedule?month={day:yyyy-MM}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.GetProperty("days").EnumerateArray()
                .Where(d => !d.GetProperty("isOff").GetBoolean())
                .Select(d => DateOnly.Parse(d.GetProperty("date").GetString()!))
                .ToList();
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

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        private async Task<int> AnyShiftTemplateIdAsync(int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.ShiftTemplates.Where(t => t.GymId == gymId).OrderBy(t => t.Id).Select(t => t.Id).FirstAsync();
        }
    }
}
