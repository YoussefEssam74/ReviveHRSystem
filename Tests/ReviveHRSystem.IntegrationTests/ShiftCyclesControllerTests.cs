using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.NotificationModule.Enums;
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
    /// Shifts &amp; schedule (S5, Section 4 S1–S8): the cycle selector chips,
    /// cycle detail with the weekly roster grid (days[0 = Mon … 6 = Sun]),
    /// draft creation, copy-previous, publish (+ employee notifications and
    /// conflict warnings), the conflicts endpoint, the Edit Shift save, and
    /// the shift-template legend. S9/S10 are covered by the attendance and
    /// requests suites (they compose A1/A2 responses).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class ShiftCyclesControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public ShiftCyclesControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        // ------------------------------------------------------------------
        // S1 — GET /api/gyms/{gymId}/shift-cycles
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetShiftCycles_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/gyms/1/shift-cycles");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetShiftCycles_HrWithoutScheduleView_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/gyms/{gym.GymId}/shift-cycles", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetShiftCycles_ReturnsChipsNewestFirst()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var (olderId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, builder.AttendanceToday.AddDays(20), builder.AttendanceToday.AddDays(24));
            var (newerId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, builder.AttendanceToday.AddDays(30), builder.AttendanceToday.AddDays(34));

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/gyms/{gym.GymId}/shift-cycles", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var chips = body.EnumerateArray().ToList();
            Assert.Equal(2, chips.Count);
            Assert.Equal(newerId, chips[0].GetProperty("id").GetInt32());
            Assert.Equal(olderId, chips[1].GetProperty("id").GetInt32());
            Assert.All(chips, c => Assert.Equal("Draft", c.GetProperty("status").GetString()));
            Assert.All(chips, c => Assert.False(string.IsNullOrWhiteSpace(c.GetProperty("label").GetString())));
        }

        [Fact]
        public async Task GetShiftCycles_GymNotFound_Returns404()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/gyms/999999/shift-cycles", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // S2 — GET /api/shift-cycles/{id}
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetShiftCycle_ReturnsLegendRosterAndWeeklyDays()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var templateId = await builder.CreateShiftTemplateAsync(gym, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));
            await builder.CreateShiftTemplateAsync(gym, "IT Closed", new TimeOnly(0, 0), new TimeOnly(0, 0), isActive: false);
            var token = await _fixture.GetAdminTokenAsync();
            var (cycleId, start, _) = await CreateDraftCycleAsync(token, gym.GymId, NextMonday(builder.AttendanceToday), NextMonday(builder.AttendanceToday).AddDays(6));
            await SetAssignmentsAsync(token, cycleId, new object[]
            {
                new { employeeId = employee.EmployeeId, day = 0, shiftTemplateId = templateId },
                new { employeeId = employee.EmployeeId, day = 1, shiftTemplateId = (int?)null },
            });

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/shift-cycles/{cycleId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(cycleId, body.GetProperty("id").GetInt32());
            Assert.Equal("Draft", body.GetProperty("status").GetString());
            Assert.StartsWith(start.ToString("MMM"), body.GetProperty("label").GetString());

            // Legend carries only active templates, with colors and HH:mm times.
            var legend = body.GetProperty("shiftTemplates").EnumerateArray().ToList();
            var morning = Assert.Single(legend, t => t.GetProperty("name").GetString() == "IT Morning");
            Assert.Equal("08:00", morning.GetProperty("start").GetString());
            Assert.Equal("16:00", morning.GetProperty("end").GetString());
            Assert.False(morning.GetProperty("isOff").GetBoolean());
            Assert.False(string.IsNullOrWhiteSpace(morning.GetProperty("color").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(morning.GetProperty("bgColor").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(morning.GetProperty("textColor").GetString()));

            // Roster row: Monday carries the template, every other day is Off (null).
            var row = Assert.Single(
                body.GetProperty("assignments").EnumerateArray().ToList(),
                a => a.GetProperty("employeeId").GetInt32() == employee.EmployeeId);
            Assert.Equal(employee.FullName, row.GetProperty("name").GetString());
            Assert.Equal("IT Tester", row.GetProperty("position").GetString());
            Assert.Equal(gym.Name, row.GetProperty("gym").GetString());
            Assert.False(string.IsNullOrWhiteSpace(row.GetProperty("initials").GetString()));
            var days = row.GetProperty("days").EnumerateArray().ToList();
            Assert.Equal(7, days.Count);
            Assert.Equal(templateId, days[0].GetInt32());
            Assert.Equal(JsonValueKind.Null, days[1].ValueKind);
            Assert.Equal(JsonValueKind.Null, days[6].ValueKind);
        }

        [Fact]
        public async Task GetShiftCycle_NotFound_Returns404()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/shift-cycles/999999", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // S3 — POST /api/gyms/{gymId}/shift-cycles
        // ------------------------------------------------------------------

        [Fact]
        public async Task CreateShiftCycle_Returns201DraftWithDerivedLabel()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var start = builder.AttendanceToday.AddDays(40);
            var end = start.AddDays(9);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/gyms/{gym.GymId}/shift-cycles",
                new { startDate = start.ToString("yyyy-MM-dd"), endDate = end.ToString("yyyy-MM-dd") }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.True(body.GetProperty("data").GetProperty("id").GetInt32() > 0);
            Assert.Equal("Draft", body.GetProperty("data").GetProperty("status").GetString());
            Assert.StartsWith(start.ToString("MMM"), body.GetProperty("data").GetProperty("label").GetString());
        }

        [Fact]
        public async Task CreateShiftCycle_WithLabel_EchoesLabel()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/gyms/{gym.GymId}/shift-cycles",
                new { label = "Ramadan Cycle", startDate = "2027-02-15", endDate = "2027-02-24" }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal("Ramadan Cycle", body.GetProperty("data").GetProperty("label").GetString());
        }

        [Fact]
        public async Task CreateShiftCycle_OverlappingDates_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var start = builder.AttendanceToday.AddDays(50);
            await CreateDraftCycleAsync(token, gym.GymId, start, start.AddDays(9));

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/gyms/{gym.GymId}/shift-cycles",
                new { startDate = start.AddDays(5).ToString("yyyy-MM-dd"), endDate = start.AddDays(14).ToString("yyyy-MM-dd") }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateShiftCycle_EndBeforeStart_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/gyms/{gym.GymId}/shift-cycles",
                new { startDate = "2027-03-10", endDate = "2027-03-01" }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateShiftCycle_HrWithoutScheduleManage_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/gyms/{gym.GymId}/shift-cycles",
                new { startDate = "2027-04-01", endDate = "2027-04-10" }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // S7 — PUT /api/shift-cycles/{id}/assignments
        // ------------------------------------------------------------------

        [Fact]
        public async Task SetAssignments_PublishedCycle_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var (cycleId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, builder.AttendanceToday.AddDays(60), builder.AttendanceToday.AddDays(69));
            await PublishAsync(token, cycleId);

            var response = await SetAssignmentsAsyncResponse(token, cycleId, Array.Empty<object>());

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task SetAssignments_UnknownEmployee_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var (cycleId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, builder.AttendanceToday.AddDays(70), builder.AttendanceToday.AddDays(79));

            var response = await SetAssignmentsAsyncResponse(token, cycleId, new object[]
            {
                new { employeeId = 999999, day = 0, shiftTemplateId = (int?)null },
            });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task SetAssignments_UnknownTemplate_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var (cycleId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, builder.AttendanceToday.AddDays(80), builder.AttendanceToday.AddDays(89));

            var response = await SetAssignmentsAsyncResponse(token, cycleId, new object[]
            {
                new { employeeId = employee.EmployeeId, day = 0, shiftTemplateId = 999999 },
            });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // S5 / S6 — publish & conflicts
        // ------------------------------------------------------------------

        [Fact]
        public async Task Publish_ReturnsOkNotifiesEmployeeAndFlipsStatus()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var templateId = await builder.CreateShiftTemplateAsync(gym, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));
            var token = await _fixture.GetAdminTokenAsync();
            var monday = NextMonday(builder.AttendanceToday);
            var (cycleId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, monday, monday.AddDays(6));
            await SetAssignmentsAsync(token, cycleId, new object[]
            {
                new { employeeId = employee.EmployeeId, day = 0, shiftTemplateId = templateId },
            });

            var publishResponse = await PublishAsync(token, cycleId);
            var publishBody = await publishResponse.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, publishResponse.StatusCode);
            Assert.Equal("Schedule published.", publishBody.GetProperty("message").GetString());

            var detailRequest = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/shift-cycles/{cycleId}", null, token);
            var detail = await (await _fixture.Client.SendAsync(detailRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Published", detail.GetProperty("status").GetString());

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            Assert.True(await db.Notifications.AnyAsync(n =>
                n.UserId == employee.UserId
                && n.Type == NotificationType.ScheduleUpdate
                && n.LinkTo == "/schedule"));
        }

        [Fact]
        public async Task Publish_WithConflict_WarnsInMessage()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var templateId = await builder.CreateShiftTemplateAsync(gym, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));
            var token = await _fixture.GetAdminTokenAsync();
            var monday = NextMonday(builder.AttendanceToday);
            var (cycleId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, monday, monday.AddDays(6));
            await SetAssignmentsAsync(token, cycleId, new object[]
            {
                new { employeeId = employee.EmployeeId, day = 0, shiftTemplateId = templateId },
            });
            await builder.CreateApprovedDayOffAsync(employee.EmployeeId, monday, monday);

            var response = await PublishAsync(token, cycleId);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("unresolved conflict", body.GetProperty("message").GetString());
        }

        [Fact]
        public async Task Publish_AlreadyPublished_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var (cycleId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, builder.AttendanceToday.AddDays(90), builder.AttendanceToday.AddDays(99));
            await PublishAsync(token, cycleId);

            var response = await PublishAsync(token, cycleId);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task GetConflicts_ReturnsApprovedDayOffOverlap()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var templateId = await builder.CreateShiftTemplateAsync(gym, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));
            var token = await _fixture.GetAdminTokenAsync();
            var monday = NextMonday(builder.AttendanceToday);
            var (cycleId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, monday, monday.AddDays(6));
            await SetAssignmentsAsync(token, cycleId, new object[]
            {
                new { employeeId = employee.EmployeeId, day = 0, shiftTemplateId = templateId },
            });
            await builder.CreateApprovedDayOffAsync(employee.EmployeeId, monday, monday);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/shift-cycles/{cycleId}/conflicts", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(1, body.GetProperty("count").GetInt32());
            var conflict = Assert.Single(body.GetProperty("conflicts").EnumerateArray().ToList());
            Assert.Equal(employee.EmployeeId, conflict.GetProperty("employeeId").GetInt32());
            Assert.Equal(0, conflict.GetProperty("day").GetInt32()); // Monday = 0
            Assert.Contains("Approved Day Off", conflict.GetProperty("message").GetString());
            Assert.Contains("assigned", conflict.GetProperty("message").GetString());
        }

        [Fact]
        public async Task GetConflicts_EmployeeNotLinkedToGym_FlagsConflict()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var homeGym = await builder.CreateGymWithStationAsync();
            var otherGym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(homeGym);
            var token = await _fixture.GetAdminTokenAsync();
            var monday = NextMonday(builder.AttendanceToday);
            var (cycleId, _, _) = await CreateDraftCycleAsync(token, otherGym.GymId, monday, monday.AddDays(6));
            await SetAssignmentsAsync(token, cycleId, new object[]
            {
                new { employeeId = employee.EmployeeId, day = 0, shiftTemplateId = (int?)null },
            });

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/shift-cycles/{cycleId}/conflicts", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var conflict = Assert.Single(body.GetProperty("conflicts").EnumerateArray().ToList());
            Assert.Equal(employee.EmployeeId, conflict.GetProperty("employeeId").GetInt32());
            Assert.Contains(otherGym.Name, conflict.GetProperty("message").GetString());
        }

        // ------------------------------------------------------------------
        // S4 — POST /api/shift-cycles/{id}/copy-previous
        // ------------------------------------------------------------------

        [Fact]
        public async Task CopyPrevious_NoEarlierCycle_ReturnsZeroCopy()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var (cycleId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, builder.AttendanceToday.AddDays(5), builder.AttendanceToday.AddDays(14));

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/shift-cycles/{cycleId}/copy-previous", new { }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(0, body.GetProperty("copied").GetInt32());
            Assert.Contains("No previous cycle", body.GetProperty("message").GetString());
        }

        [Fact]
        public async Task CopyPrevious_CopiesWeeklyPattern()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var templateId = await builder.CreateShiftTemplateAsync(gym, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));
            var token = await _fixture.GetAdminTokenAsync();

            var sourceStart = builder.AttendanceToday.AddDays(20);
            var (sourceId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, sourceStart, sourceStart.AddDays(9));
            var sourceMonday = NextMonday(sourceStart.AddDays(1)); // inside the source window
            await builder.AddShiftAssignmentAsync(sourceId, employee.EmployeeId, sourceMonday, templateId);

            var targetStart = sourceStart.AddDays(20);
            var (targetId, targetEnd, _) = await CreateDraftCycleAsync(token, gym.GymId, targetStart, targetStart.AddDays(9));

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/shift-cycles/{targetId}/copy-previous", new { }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var copied = body.GetProperty("copied").GetInt32();
            Assert.True(copied >= 1, $"expected at least one copied assignment, got {copied}");
            Assert.Contains("Copied", body.GetProperty("message").GetString());

            // Every Monday of the target window now carries the template.
            var detailRequest = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/shift-cycles/{targetId}", null, token);
            var detail = await (await _fixture.Client.SendAsync(detailRequest)).Content.ReadFromJsonAsync<JsonElement>();
            var row = Assert.Single(
                detail.GetProperty("assignments").EnumerateArray().ToList(),
                a => a.GetProperty("employeeId").GetInt32() == employee.EmployeeId);
            Assert.Equal(templateId, row.GetProperty("days").EnumerateArray().ElementAt(0).GetInt32());
            _ = targetEnd;
        }

        [Fact]
        public async Task CopyPrevious_PublishedTarget_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();
            var sourceStart = builder.AttendanceToday.AddDays(100);
            await CreateDraftCycleAsync(token, gym.GymId, sourceStart, sourceStart.AddDays(9));
            var (targetId, _, _) = await CreateDraftCycleAsync(token, gym.GymId, sourceStart.AddDays(20), sourceStart.AddDays(29));
            await PublishAsync(token, targetId);

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/shift-cycles/{targetId}/copy-previous", new { }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // S8 — GET /api/gyms/{gymId}/shift-templates
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetShiftTemplates_ReturnsActiveOnlyOrderedByStart()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            await builder.CreateShiftTemplateAsync(gym, "IT Night", new TimeOnly(22, 0), new TimeOnly(5, 0));
            await builder.CreateShiftTemplateAsync(gym, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));
            await builder.CreateShiftTemplateAsync(gym, "IT Closed", new TimeOnly(0, 0), new TimeOnly(0, 0), isActive: false);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/gyms/{gym.GymId}/shift-templates", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var templates = body.EnumerateArray().ToList();
            Assert.Equal(2, templates.Count);
            Assert.Equal("IT Morning", templates[0].GetProperty("name").GetString());
            Assert.Equal("08:00", templates[0].GetProperty("start").GetString());
            Assert.Equal("16:00", templates[0].GetProperty("end").GetString());
            Assert.False(templates[0].GetProperty("isOff").GetBoolean());
            Assert.False(string.IsNullOrWhiteSpace(templates[0].GetProperty("bgColor").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(templates[0].GetProperty("textColor").GetString()));
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private static DateOnly NextMonday(DateOnly from)
        {
            var delta = ((int)DayOfWeek.Monday - (int)from.DayOfWeek + 7) % 7;
            return from.AddDays(delta == 0 ? 7 : delta);
        }

        private async Task<(int Id, DateOnly Start, DateOnly End)> CreateDraftCycleAsync(string token, int gymId, DateOnly start, DateOnly end)
        {
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/gyms/{gymId}/shift-cycles",
                new { startDate = start.ToString("yyyy-MM-dd"), endDate = end.ToString("yyyy-MM-dd") }, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (body.GetProperty("data").GetProperty("id").GetInt32(), start, end);
        }

        private async Task<HttpResponseMessage> SetAssignmentsAsyncResponse(string token, int cycleId, object[] assignments)
        {
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/shift-cycles/{cycleId}/assignments",
                new { assignments }, token);
            return await _fixture.Client.SendAsync(request);
        }

        private async Task SetAssignmentsAsync(string token, int cycleId, object[] assignments)
        {
            var response = await SetAssignmentsAsyncResponse(token, cycleId, assignments);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        private async Task<HttpResponseMessage> PublishAsync(string token, int cycleId)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/shift-cycles/{cycleId}/publish", null, token);
            return await _fixture.Client.SendAsync(request);
        }
    }
}
