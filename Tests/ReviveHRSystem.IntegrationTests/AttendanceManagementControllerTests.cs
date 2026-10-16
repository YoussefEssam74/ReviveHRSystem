using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.Extensions.DependencyInjection;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// HR attendance management (S4, Section 4 A1/A3/A4/A7/A10): the directory
    /// grid compose, the HR manual-entry form sharing the kiosk route, record
    /// correction with its audit trail, the employee-file attendance history
    /// with month totals, and the biometric pairing-code modal.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class AttendanceManagementControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public AttendanceManagementControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        // ------------------------------------------------------------------
        // GET /api/attendance — directory grid (A1)
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetAttendance_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/attendance");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetAttendance_HrWithoutAttendanceView_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/attendance", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetAttendance_Admin_ReturnsStoredRecordRow()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var today = builder.AttendanceToday;
            await builder.CreateAttendanceRecordAsync(
                employee.EmployeeId, gym.GymId, today,
                checkInUtc: AtHourUtc(today, 8), checkOutUtc: AtHourUtc(today, 16),
                status: AttendanceStatus.OnTime);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/attendance?date={today:yyyy-MM-dd}&gymId={gym.GymId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var item = Assert.Single(
                body.GetProperty("items").EnumerateArray().ToList(),
                i => i.GetProperty("employeeId").GetInt32() == employee.EmployeeId);
            Assert.Equal("On Time", item.GetProperty("status").GetString());
            Assert.Equal("08:00", item.GetProperty("checkIn").GetString());
            Assert.Equal("16:00", item.GetProperty("checkOut").GetString());
            Assert.Equal(employee.FullName, item.GetProperty("name").GetString());
            Assert.Equal(gym.Name, item.GetProperty("gym").GetString());
            Assert.True(item.GetProperty("id").GetInt32() > 0);
        }

        [Fact]
        public async Task GetAttendance_PastDayWithApprovedDayOff_IsOff()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var dayOffDate = builder.AttendanceToday.AddDays(-2);
            // A shift is scheduled that day so the request, not a plain off-day, explains the Off.
            await builder.AssignShiftAsync(employee.EmployeeId, gym.GymId, dayOffDate, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));
            await builder.CreateApprovedDayOffAsync(employee.EmployeeId, dayOffDate, dayOffDate);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/attendance?from={dayOffDate:yyyy-MM-dd}&to={dayOffDate:yyyy-MM-dd}&gymId={gym.GymId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var item = Assert.Single(
                body.GetProperty("items").EnumerateArray().ToList(),
                i => i.GetProperty("employeeId").GetInt32() == employee.EmployeeId);
            Assert.Equal("Off", item.GetProperty("status").GetString());
            Assert.Equal("Day Off approved", item.GetProperty("notes").GetString());
        }

        [Fact]
        public async Task GetAttendance_FutureDay_IsScheduled()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var tomorrow = builder.AttendanceToday.AddDays(1);
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/attendance?from={tomorrow:yyyy-MM-dd}&to={tomorrow:yyyy-MM-dd}&gymId={gym.GymId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var item = Assert.Single(
                body.GetProperty("items").EnumerateArray().ToList(),
                i => i.GetProperty("employeeId").GetInt32() == employee.EmployeeId);
            Assert.Equal("Scheduled", item.GetProperty("status").GetString());
        }

        [Fact]
        public async Task GetAttendance_StatusFilter_ReturnsOnlyMatchingStatus()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var present = await builder.CreateEmployeeAsync(gym);
            // Scheduled today but no punch: derives as Absent (not Off like unscheduled employees).
            var absent = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);
            var today = builder.AttendanceToday;
            await builder.CreateAttendanceRecordAsync(
                present.EmployeeId, gym.GymId, today,
                checkInUtc: AtHourUtc(today, 8), checkOutUtc: AtHourUtc(today, 16));
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/attendance?date={today:yyyy-MM-dd}&status=Absent&gymId={gym.GymId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains(items, i => i.GetProperty("employeeId").GetInt32() == absent.EmployeeId);
            Assert.DoesNotContain(items, i => i.GetProperty("employeeId").GetInt32() == present.EmployeeId);
        }

        [Fact]
        public async Task GetAttendance_HrScopedToOwnGym_SeesOnlyThatGym()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var employeeA = await builder.CreateEmployeeAsync(gymA);
            _ = await builder.CreateEmployeeAsync(gymB);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gymA });
            await builder.GrantPermissionAsync(hr.UserId, "attendance.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var today = builder.AttendanceToday;

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/attendance?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.NotEmpty(items);
            Assert.All(items, i => Assert.Equal(gymA.Name, i.GetProperty("gym").GetString()));
            Assert.Contains(items, i => i.GetProperty("employeeId").GetInt32() == employeeA.EmployeeId);
        }

        [Fact]
        public async Task GetAttendance_EmployeeIdFilter_ReturnsOnlyThatEmployee()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var wanted = await builder.CreateEmployeeAsync(gym);
            _ = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var today = builder.AttendanceToday;

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/attendance?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}&employeeId={wanted.EmployeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var items = body.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.NotEmpty(items);
            Assert.All(items, i => Assert.Equal(wanted.EmployeeId, i.GetProperty("employeeId").GetInt32()));
        }

        [Fact]
        public async Task GetAttendance_Pagination_SlicesAndReportsTotals()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            _ = await builder.CreateEmployeeAsync(gym);
            _ = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var today = builder.AttendanceToday;

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/attendance?date={today:yyyy-MM-dd}&pageSize=1&page=1", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Single(body.GetProperty("items").EnumerateArray().ToList());
            Assert.Equal(1, body.GetProperty("page").GetInt32());
            Assert.Equal(1, body.GetProperty("pageSize").GetInt32());
            Assert.True(body.GetProperty("total").GetInt32() >= 2);
            Assert.True(body.GetProperty("totalPages").GetInt32() >= 2);
        }

        // ------------------------------------------------------------------
        // POST /api/attendance/manual — HR day-write form (A3)
        // ------------------------------------------------------------------

        [Fact]
        public async Task RecordManual_HrForm_WithoutManualEntryPermission_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var today = builder.AttendanceToday;

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/attendance/manual", new
            {
                employeeId = employee.EmployeeId,
                date = $"{today:yyyy-MM-dd}",
                checkIn = "08:00",
                checkOut = "16:00",
                status = "On Time",
                reason = "Biometric device offline"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task RecordManual_HrForm_UpsertsDayRecord_Returns201()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "attendance.manual_entry");
            await builder.GrantPermissionAsync(hr.UserId, "attendance.view");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var today = builder.AttendanceToday;

            var first = await SendManualAsync(token, new
            {
                employeeId = employee.EmployeeId,
                date = $"{today:yyyy-MM-dd}",
                checkIn = "08:00",
                checkOut = "16:00",
                status = "On Time",
                reason = "Face ID failed, card verified"
            });
            var firstBody = await first.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Created, first.StatusCode);
            var data = firstBody.GetProperty("data");
            Assert.Equal("On Time", data.GetProperty("status").GetString());
            Assert.Equal("08:00", data.GetProperty("checkIn").GetString());
            Assert.Equal("16:00", data.GetProperty("checkOut").GetString());
            Assert.Equal("Manual", data.GetProperty("source").GetString());
            var recordId = data.GetProperty("id").GetInt32();

            // Same day again: the record is updated, not duplicated.
            var second = await SendManualAsync(token, new
            {
                employeeId = employee.EmployeeId,
                date = $"{today:yyyy-MM-dd}",
                checkIn = "09:30",
                checkOut = "17:00",
                status = "Late",
                reason = "Corrected arrival window"
            });
            var secondBody = await second.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Created, second.StatusCode);
            Assert.Equal(recordId, secondBody.GetProperty("data").GetProperty("id").GetInt32());
            Assert.Equal("Late", secondBody.GetProperty("data").GetProperty("status").GetString());
            Assert.Equal("09:30", secondBody.GetProperty("data").GetProperty("checkIn").GetString());

            // The grid shows exactly one stored row for the day.
            var grid = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get,
                $"/api/attendance?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}&employeeId={employee.EmployeeId}",
                null, token));
            var gridBody = await grid.Content.ReadFromJsonAsync<JsonElement>();
            var rows = gridBody.GetProperty("items").EnumerateArray()
                .Where(i => i.GetProperty("id").ValueKind == JsonValueKind.Number)
                .ToList();
            var row = Assert.Single(rows);
            Assert.Equal(recordId, row.GetProperty("id").GetInt32());
            Assert.Equal("Late", row.GetProperty("status").GetString());
        }

        [Fact]
        public async Task RecordManual_HrForm_UnknownEmployee_Returns404()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "attendance.manual_entry");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var today = builder.AttendanceToday;

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/attendance/manual", new
            {
                employeeId = "EMP-NOPE-9999",
                date = $"{today:yyyy-MM-dd}",
                checkIn = "08:00",
                checkOut = "16:00",
                status = "On Time",
                reason = "Manual entry for unknown employee"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task RecordManual_HrForm_MissingReason_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "attendance.manual_entry");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var today = builder.AttendanceToday;

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/attendance/manual", new
            {
                employeeId = employee.EmployeeId,
                date = $"{today:yyyy-MM-dd}",
                checkIn = "08:00",
                checkOut = "16:00",
                status = "On Time",
                reason = "x"
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // PUT /api/attendance/{id}/correct — correction with audit (A4)
        // ------------------------------------------------------------------

        [Fact]
        public async Task CorrectRecord_WithReason_UpdatesRecordAndAudits()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var today = builder.AttendanceToday;
            var recordId = await builder.CreateAttendanceRecordAsync(
                employee.EmployeeId, gym.GymId, today,
                checkInUtc: AtHourUtc(today, 8), checkOutUtc: AtHourUtc(today, 16));
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "attendance.edit");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/attendance/{recordId}/correct", new
                {
                    checkIn = "09:00",
                    checkOut = "17:00",
                    status = "Late",
                    reason = "Turnstile logs show a 09:00 entry"
                }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var data = body.GetProperty("data");
            Assert.Equal(recordId, data.GetProperty("id").GetInt32());
            Assert.Equal("Late", data.GetProperty("status").GetString());
            Assert.Equal("09:00", data.GetProperty("checkIn").GetString());
            Assert.Equal("17:00", data.GetProperty("checkOut").GetString());
            // The audit stamp names the editing user (no employee profile -> username).
            Assert.Equal(hr.Email.Split('@')[0], data.GetProperty("correctedBy").GetString());
            Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("correctedAt").GetString()));
        }

        [Fact]
        public async Task CorrectRecord_MissingReason_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var today = builder.AttendanceToday;
            var recordId = await builder.CreateAttendanceRecordAsync(employee.EmployeeId, gym.GymId, today);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "attendance.edit");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/attendance/{recordId}/correct", new
                {
                    status = "Late",
                    reason = "x"
                }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CorrectRecord_UnknownRecord_Returns404()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "attendance.edit");
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, "/api/attendance/99999999/correct", new
                {
                    status = "Late",
                    reason = "No such record exists"
                }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // GET /api/employees/{id}/attendance — history + totals (A7)
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetEmployeeAttendance_ReturnsElapsedDaysAndTotals()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var today = builder.AttendanceToday;
            await builder.CreateAttendanceRecordAsync(
                employee.EmployeeId, gym.GymId, today,
                checkInUtc: AtHourUtc(today, 8), checkOutUtc: AtHourUtc(today, 16));
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employee.EmployeeId}/attendance", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var items = body.GetProperty("items").EnumerateArray().ToList();
            Assert.NotEmpty(items);
            // No future days in the history (elapsed days only).
            Assert.All(items, i => Assert.True(string.CompareOrdinal(i.GetProperty("date").GetString(), $"{today:yyyy-MM-dd}") <= 0));

            var todayRow = Assert.Single(items, i => i.GetProperty("date").GetString() == $"{today:yyyy-MM-dd}");
            Assert.Equal("On Time", todayRow.GetProperty("status").GetString());
            Assert.Equal("08:00", todayRow.GetProperty("checkIn").GetString());

            var totals = body.GetProperty("totals");
            Assert.Equal(1, totals.GetProperty("present").GetInt32());
            Assert.Equal(8m, totals.GetProperty("hours").GetDecimal());
            Assert.True(totals.GetProperty("total").GetInt32() >= 1);
        }

        // ------------------------------------------------------------------
        // POST /api/gyms/{gymId}/biometric-devices/pairing-codes (A10)
        // ------------------------------------------------------------------

        [Fact]
        public async Task GeneratePairingCode_ReturnsSixDigitCodeWithLabel()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/gyms/{gym.GymId}/biometric-devices/pairing-codes",
                new { stationLabel = "Front Desk Kiosk" }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Matches(new Regex(@"^\d{6}$"), body.GetProperty("code").GetString());
            Assert.Equal(gym.GymId, body.GetProperty("gymId").GetInt32());
            Assert.Equal(gym.Name, body.GetProperty("gymName").GetString());
            Assert.Equal("Front Desk Kiosk", body.GetProperty("stationLabel").GetString());
            Assert.NotEqual(default, body.GetProperty("generatedAt").GetDateTime());
        }

        [Fact]
        public async Task GeneratePairingCode_Anonymous_Returns401()
        {
            var response = await _fixture.Client.PostAsJsonAsync(
                "/api/gyms/1/biometric-devices/pairing-codes", new { stationLabel = "Nope" });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private Task<HttpResponseMessage> SendManualAsync(string token, object body) =>
            _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/attendance/manual", body, token));

        /// <summary>Wall-clock hour on the given date, as the UTC instant the app's timezone stores.</summary>
        private DateTime AtHourUtc(DateOnly date, int hour)
        {
            var timeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var local = date.ToDateTime(new TimeOnly(hour, 0));
            return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), timeZone);
        }
    }
}
