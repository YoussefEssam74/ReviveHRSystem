using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    [Collection(ApiTestFixture.CollectionName)]
    public class AttendanceControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public AttendanceControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private async Task<(HttpStatusCode Status, JsonElement Body)> PostEventAsync(object payload, string? tokenStationCode = null)
        {
            // Attendance endpoints require a station JWT: sign in as the station the
            // payload names (or an explicit override for the token/binding tests).
            var payloadJson = JsonSerializer.SerializeToElement(payload);
            var payloadCode = payloadJson.GetProperty("code").GetString()
                ?? throw new InvalidOperationException("Event payload is missing the station code.");
            var stationToken = await _fixture.GetStationTokenAsync(tokenStationCode ?? payloadCode);

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/attendance/events", payload, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (response.StatusCode, body);
        }

        private static object EventPayload(string code, string employeeNumber, string type, double? liveness = 0.95, DateTime? timestamp = null) =>
            new { code, employeeId = employeeNumber, type, livenessScore = liveness, timestamp };

        [Fact]
        public async Task Event_ValidCheckIn_Returns201_WithRecord()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);

            // Deterministic event time: start of today in the configured attendance timezone.
            // It is always at or before the 08:00 shift start (so ON_SCHEDULE holds at any
            // hour of the day) and always within the service's 24-hour past-skew window.
            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var timestamp = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date, attendanceTimeZone);

            var (status, body) = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "IN", timestamp: timestamp));

            Assert.Equal(HttpStatusCode.Created, status);
            Assert.StartsWith("ATT-", body.GetProperty("recordId").GetString());
            Assert.Equal("IN", body.GetProperty("type").GetString());
            Assert.Equal("Biometric", body.GetProperty("method").GetString());
            Assert.Equal(gym.GymId, body.GetProperty("gymId").GetInt32());
            Assert.Equal("ON_SCHEDULE", body.GetProperty("shiftComparison").GetString());
            Assert.Equal(employee.EmployeeNumber, body.GetProperty("employeeId").GetString());
        }

        [Fact]
        public async Task Event_DuplicateCheckIn_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);

            var first = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "IN"));
            var second = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "IN"));

            Assert.Equal(HttpStatusCode.Created, first.Status);
            Assert.Equal(HttpStatusCode.BadRequest, second.Status);
            Assert.Equal("This employee is already checked in today.", second.Body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_CheckOutAfterCheckIn_Returns201_ThenDuplicateOut400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);

            await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "IN"));
            var checkOut = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "OUT"));
            var duplicateOut = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "OUT"));

            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            Assert.Equal("OUT", checkOut.Body.GetProperty("type").GetString());
            Assert.Equal(HttpStatusCode.BadRequest, duplicateOut.Status);
            Assert.Equal("This employee is already checked out today.", duplicateOut.Body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_CheckOutWithoutCheckIn_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);

            var (status, body) = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "OUT"));

            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("No check-in found for today. Check in first.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_CheckInAfterMidnight_BelongsToPreviousOvernightShift()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);

            // Overnight shift (22:00 → 05:00) assigned only to yesterday.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, builder.AttendanceToday.AddDays(-1), "IT Night", new TimeOnly(22, 0), new TimeOnly(5, 0));

            // Check in at the first instant of today — after midnight, but still inside
            // yesterday's overnight window. Valid at any hour the suite runs.
            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var afterMidnight = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date, attendanceTimeZone);

            var (status, body) = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "IN", timestamp: afterMidnight));

            Assert.Equal(HttpStatusCode.Created, status);
            Assert.StartsWith("ATT-", body.GetProperty("recordId").GetString());
            Assert.Equal(gym.GymId, body.GetProperty("gymId").GetInt32());
            // Clocking in after the 22:00 start is late, even though the clock says 00:00.
            Assert.Equal("LATE", body.GetProperty("shiftComparison").GetString());
            Assert.Equal("LATE", body.GetProperty("attendanceStatus").GetString());
        }

        [Fact]
        public async Task Event_CheckOutBeforeOvernightShiftEnds_ReturnsEarlyCheckout()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);

            // Overnight shift assigned to today: starts 22:00 tonight, ends 05:00 tomorrow.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, builder.AttendanceToday, "IT Night", new TimeOnly(22, 0), new TimeOnly(5, 0));

            var checkIn = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "IN"));
            var checkOut = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "OUT"));

            Assert.Equal(HttpStatusCode.Created, checkIn.Status);
            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            // The shift ends at 05:00 *tomorrow*, so leaving at any time today is early —
            // comparing bare clock times against 05:00 would get this wrong most of the day.
            Assert.Equal("EARLY_CHECKOUT", checkOut.Body.GetProperty("shiftComparison").GetString());
        }

        [Fact]
        public async Task Event_CheckOutAfterMidnight_ClosesPreviousOvernightShift()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);

            // Overnight shift (22:00 → 05:00) assigned only to yesterday.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, builder.AttendanceToday.AddDays(-1), "IT Night", new TimeOnly(22, 0), new TimeOnly(5, 0));

            // Check in after midnight (yesterday's shift is still running), then check out
            // with the server clock: the OUT must close yesterday's open record, not 404.
            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var afterMidnight = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date, attendanceTimeZone);

            var checkIn = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "IN", timestamp: afterMidnight));
            var checkOut = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "OUT"));

            Assert.Equal(HttpStatusCode.Created, checkIn.Status);
            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            Assert.Equal(
                checkIn.Body.GetProperty("recordId").GetString(),
                checkOut.Body.GetProperty("recordId").GetString());
            // The 00:00 check-in was after the 22:00 start; the checkout must not clear it.
            Assert.Equal("LATE", checkOut.Body.GetProperty("attendanceStatus").GetString());
        }

        [Fact]
        public async Task Event_LivenessBelowThreshold_Returns400()
        {
            var (status, body) = await PostEventAsync(EventPayload(_fixture.Gym1StationCode, "IT-ANY", "IN", liveness: 0.42));

            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("Liveness score must be at least 70%.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_UnknownEmployee_Returns404()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();

            var (status, body) = await PostEventAsync(EventPayload(gym.StationCode, "IT-NOBODY", "IN"));

            Assert.Equal(HttpStatusCode.NotFound, status);
            Assert.Equal("Employee not found.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_NoGymAccess_Returns401_CrossGymDenied()
        {
            var builder = NewBuilder();
            var homeGym = await builder.CreateGymWithStationAsync();
            var otherGym = await builder.CreateGymWithStationAsync();
            // Access + shift only at homeGym, scanned at otherGym.
            var employee = await builder.CreateEmployeeAsync(homeGym, shiftAtGym: homeGym);

            var (status, body) = await PostEventAsync(EventPayload(otherGym.StationCode, employee.EmployeeNumber, "IN"));

            Assert.Equal(HttpStatusCode.Unauthorized, status);
            Assert.Equal("You are not assigned to this gym.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_ScheduledAtOtherBranch_Returns401_WrongBranch()
        {
            var builder = NewBuilder();
            var homeGym = await builder.CreateGymWithStationAsync();
            var otherGym = await builder.CreateGymWithStationAsync();
            // Access to BOTH gyms but today's shift is only at homeGym.
            var employee = await builder.CreateEmployeeAsync(
                homeGym,
                accessGyms: new[] { homeGym, otherGym },
                shiftAtGym: homeGym);

            var (status, body) = await PostEventAsync(EventPayload(otherGym.StationCode, employee.EmployeeNumber, "IN"));

            Assert.Equal(HttpStatusCode.Unauthorized, status);
            Assert.Equal("This employee is scheduled at a different branch today.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_ScheduledDayOff_Returns404()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            // Access to the gym but no shift today.
            var employee = await builder.CreateEmployeeAsync(gym);

            var (status, body) = await PostEventAsync(EventPayload(gym.StationCode, employee.EmployeeNumber, "IN"));

            Assert.Equal(HttpStatusCode.NotFound, status);
            Assert.Equal("No shift is scheduled for this employee today.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_InvalidStationCode_Returns401()
        {
            // Authenticate with a real station token first, so the 401 proves the
            // body's unknown station code — not a missing JWT — is what failed.
            var (status, body) = await PostEventAsync(EventPayload("999999", "IT-ANY", "IN"), tokenStationCode: _fixture.Gym1StationCode);

            Assert.Equal(HttpStatusCode.Unauthorized, status);
            Assert.Equal("Invalid or expired station code.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_InvalidType_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();

            var (status, body) = await PostEventAsync(EventPayload(gym.StationCode, "IT-ANY", "JUMP"));

            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("Type must be \"IN\" or \"OUT\".", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Manual_ValidEntry_Returns201_AndAuditsReason()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);

            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);
            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/attendance/manual", new
            {
                code = gym.StationCode,
                employeeId = employee.EmployeeNumber,
                type = "IN",
                reason = "Face ID camera offline"
            }, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal("Manual", body.GetProperty("method").GetString());

            var recordId = body.GetProperty("recordId").GetString()!;
            Assert.StartsWith("ATT-", recordId);
            var numericRecordId = int.Parse(recordId["ATT-".Length..]);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var audit = await db.AuditLogs.FirstOrDefaultAsync(
                a => a.Action == "AttendanceManualEntry" && a.EntityId == numericRecordId);
            Assert.NotNull(audit);
            Assert.Contains("Face ID camera offline", audit!.NewValues);
        }

        [Fact]
        public async Task Event_WithoutToken_Returns401()
        {
            // Global fallback policy: any request without a JWT is rejected outright.
            var response = await _fixture.Client.PostAsJsonAsync(
                "/api/attendance/events",
                EventPayload(_fixture.Gym1StationCode, "IT-ANY", "IN"));

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Event_UserTokenWithoutGymClaim_Returns401_StationTokenRequired()
        {
            // The seeded admin (TopManagement) logs in without a gymId claim, so a
            // perfectly valid user JWT still cannot act on a station's behalf.
            var adminToken = await _fixture.GetAdminTokenAsync();
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/attendance/events",
                EventPayload(_fixture.Gym1StationCode, "IT-ANY", "IN"), adminToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("Attendance requests require a station token bound to a gym.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_TokenFromOtherStation_Returns401_StationTokenGymMismatch()
        {
            var builder = NewBuilder();
            var tokenGym = await builder.CreateGymWithStationAsync();
            var targetGym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(targetGym, shiftAtGym: targetGym);

            // JWT issued for tokenGym, but the event targets targetGym's station.
            var stationToken = await _fixture.GetStationTokenAsync(tokenGym.StationCode);
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/attendance/events",
                EventPayload(targetGym.StationCode, employee.EmployeeNumber, "IN"), stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("The station token is not bound to this gym.", body.GetProperty("errorMessage").GetString());
        }
    }
}
