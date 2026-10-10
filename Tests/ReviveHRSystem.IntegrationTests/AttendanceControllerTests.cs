using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Attendance;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    [Collection(ApiTestFixture.CollectionName)]
    public class AttendanceControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public AttendanceControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        /// <summary>
        /// Posts an attendance event authenticated as the station that owns
        /// <paramref name="stationToken"/>. The gym comes from that session — the body
        /// carries no station code.
        /// </summary>
        private async Task<(HttpStatusCode Status, JsonElement Body)> PostEventAsync(object payload, string stationToken)
        {
            var request = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/events", payload, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (response.StatusCode, body);
        }

        private static object EventPayload(string employeeNumber, string type, double? liveness = 0.95, DateTime? timestamp = null) =>
            new { employeeId = employeeNumber, type, livenessScore = liveness, timestamp };

        /// <summary>Creates a gym + employee with a shift, and logs the station in.</summary>
        private async Task<(TestGym Gym, TestEmployee Employee, string StationToken)> NewStationWithEmployeeAsync()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);
            return (gym, employee, stationToken);
        }

        [Fact]
        public async Task Event_ValidCheckIn_Returns201_WithRecord()
        {
            var (gym, employee, stationToken) = await NewStationWithEmployeeAsync();

            // Deterministic event time: start of today in the configured attendance timezone.
            // It is always at or before the 08:00 shift start (so ON_SCHEDULE holds at any
            // hour of the day) and always within the service's 24-hour past-skew window.
            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var timestamp = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date, attendanceTimeZone);

            var (status, body) = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", timestamp: timestamp), stationToken);

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
            var (_, employee, stationToken) = await NewStationWithEmployeeAsync();

            var first = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            var second = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);

            Assert.Equal(HttpStatusCode.Created, first.Status);
            Assert.Equal(HttpStatusCode.BadRequest, second.Status);
            Assert.Equal("This employee is already checked in today.", second.Body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_CheckOutAfterCheckIn_Returns201_ThenDuplicateOut400()
        {
            var (_, employee, stationToken) = await NewStationWithEmployeeAsync();

            await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            var checkOut = await PostEventAsync(EventPayload(employee.EmployeeNumber, "OUT"), stationToken);
            var duplicateOut = await PostEventAsync(EventPayload(employee.EmployeeNumber, "OUT"), stationToken);

            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            Assert.Equal("OUT", checkOut.Body.GetProperty("type").GetString());
            Assert.Equal(HttpStatusCode.BadRequest, duplicateOut.Status);
            Assert.Equal("This employee is already checked out today.", duplicateOut.Body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_CheckOutWithoutCheckIn_Returns400()
        {
            var (_, employee, stationToken) = await NewStationWithEmployeeAsync();

            var (status, body) = await PostEventAsync(EventPayload(employee.EmployeeNumber, "OUT"), stationToken);

            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("No check-in found for today. Check in first.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_AutoType_OpensWhenNoRecord_ClosesWhenOpen_RejectsWhenComplete()
        {
            // The always-on kiosk camera sends AUTO: the server decides the direction
            // from the employee's own state, so the terminal never has to guess.
            var (_, employee, stationToken) = await NewStationWithEmployeeAsync();

            var checkIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "AUTO"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkIn.Status);
            Assert.Equal("IN", checkIn.Body.GetProperty("type").GetString());

            var checkOut = await PostEventAsync(EventPayload(employee.EmployeeNumber, "AUTO"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            Assert.Equal("OUT", checkOut.Body.GetProperty("type").GetString());

            var complete = await PostEventAsync(EventPayload(employee.EmployeeNumber, "AUTO"), stationToken);
            Assert.Equal(HttpStatusCode.BadRequest, complete.Status);
            Assert.Equal(
                "This employee has already completed attendance for today.",
                complete.Body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task AutoCheckOut_BiometricWithoutConfirmation_IsPending_ThenRecordsWhenConfirmed()
        {
            // The kiosk camera sends AUTO. Closing today's open record must first ask
            // the employee: the biometric pipeline returns null (pending, nothing
            // written) until the scan is re-sent with confirmCheckout. The /events
            // endpoint keeps its immediate behaviour (covered by the AUTO test above).
            var (gym, employee, _) = await NewStationWithEmployeeAsync();

            using var scope = _fixture.Services.CreateScope();
            var attendance = scope.ServiceProvider.GetRequiredService<IAttendanceService>();

            var checkIn = await attendance.RecordBiometricEventAsync(new AttendanceEventRequest
            {
                EmployeeId = employee.EmployeeNumber,
                Type = "IN",
                LivenessScore = 0.95,
            }, gym.GymId);
            Assert.NotNull(checkIn);

            var pending = await attendance.RecordBiometricEventAsync(new AttendanceEventRequest
            {
                EmployeeId = employee.EmployeeNumber,
                Type = "AUTO",
                LivenessScore = 0.95,
            }, gym.GymId, confirmCheckout: false);
            Assert.Null(pending);

            var checkOut = await attendance.RecordBiometricEventAsync(new AttendanceEventRequest
            {
                EmployeeId = employee.EmployeeNumber,
                Type = "AUTO",
                LivenessScore = 0.95,
            }, gym.GymId, confirmCheckout: true);
            Assert.NotNull(checkOut);
            Assert.Equal("OUT", checkOut!.Type);
        }

        [Fact]
        public async Task AutoScan_AfterDayComplete_ThrowsAlreadyComplete()
        {
            // A completed day (IN then OUT) must surface as the typed exception the
            // face pipeline catches and turns into a silent "already complete" outcome,
            // rather than a generic rejection the kiosk would nag with.
            var (gym, employee, _) = await NewStationWithEmployeeAsync();

            using var scope = _fixture.Services.CreateScope();
            var attendance = scope.ServiceProvider.GetRequiredService<IAttendanceService>();

            var checkIn = await attendance.RecordBiometricEventAsync(new AttendanceEventRequest
            {
                EmployeeId = employee.EmployeeNumber,
                Type = "IN",
                LivenessScore = 0.95,
            }, gym.GymId);
            Assert.NotNull(checkIn);

            var checkOut = await attendance.RecordBiometricEventAsync(new AttendanceEventRequest
            {
                EmployeeId = employee.EmployeeNumber,
                Type = "AUTO",
                LivenessScore = 0.95,
            }, gym.GymId, confirmCheckout: true);
            Assert.NotNull(checkOut);
            Assert.Equal("OUT", checkOut!.Type);

            var exception = await Assert.ThrowsAsync<AttendanceAlreadyCompleteException>(() =>
                attendance.RecordBiometricEventAsync(new AttendanceEventRequest
                {
                    EmployeeId = employee.EmployeeNumber,
                    Type = "AUTO",
                    LivenessScore = 0.95,
                }, gym.GymId));
            Assert.Equal("This employee has already completed attendance for today.", exception.Message);
        }

        [Fact]
        public async Task Event_CheckInAfterMidnight_BelongsToPreviousOvernightShift()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            // Overnight shift (22:00 → 05:00) assigned only to yesterday.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, builder.AttendanceToday.AddDays(-1), "IT Night", new TimeOnly(22, 0), new TimeOnly(5, 0));

            // Check in at the first instant of today — after midnight, but still inside
            // yesterday's overnight window. Valid at any hour the suite runs.
            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var afterMidnight = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date, attendanceTimeZone);

            var (status, body) = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", timestamp: afterMidnight), stationToken);

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
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            // Overnight shift assigned to today: starts 22:00 tonight, ends 05:00 tomorrow.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, builder.AttendanceToday, "IT Night", new TimeOnly(22, 0), new TimeOnly(5, 0));

            var checkIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            var checkOut = await PostEventAsync(EventPayload(employee.EmployeeNumber, "OUT"), stationToken);

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
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            // Overnight shift (22:00 → 05:00) assigned only to yesterday.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, builder.AttendanceToday.AddDays(-1), "IT Night", new TimeOnly(22, 0), new TimeOnly(5, 0));

            // Check in after midnight (yesterday's shift is still running), then check out
            // with the server clock: the OUT must close yesterday's record, not 404.
            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var afterMidnight = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date, attendanceTimeZone);

            var checkIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", timestamp: afterMidnight), stationToken);
            var checkOut = await PostEventAsync(EventPayload(employee.EmployeeNumber, "OUT"), stationToken);

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
            var stationToken = await _fixture.GetStationTokenAsync(_fixture.Gym1StationCode);

            var (status, body) = await PostEventAsync(EventPayload("IT-ANY", "IN", liveness: 0.42), stationToken);

            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("Liveness score must be at least 70%.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_UnknownEmployee_Returns404()
        {
            var (_, _, stationToken) = await NewStationWithEmployeeAsync();

            var (status, body) = await PostEventAsync(EventPayload("IT-NOBODY", "IN"), stationToken);

            Assert.Equal(HttpStatusCode.NotFound, status);
            Assert.Equal("Employee not found.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_NoGymAccess_Returns401_CrossGymDenied()
        {
            var builder = NewBuilder();
            var homeGym = await builder.CreateGymWithStationAsync();
            var otherGym = await builder.CreateGymWithStationAsync();
            // Access + shift only at homeGym, scanned by otherGym's station.
            var employee = await builder.CreateEmployeeAsync(homeGym, shiftAtGym: homeGym);
            var otherStationToken = await _fixture.GetStationTokenAsync(otherGym.StationCode);

            var (status, body) = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), otherStationToken);

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
            var otherStationToken = await _fixture.GetStationTokenAsync(otherGym.StationCode);

            var (status, body) = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), otherStationToken);

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
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var (status, body) = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);

            Assert.Equal(HttpStatusCode.NotFound, status);
            Assert.Equal("No shift is scheduled for this employee today.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_InvalidType_Returns400()
        {
            var (_, _, stationToken) = await NewStationWithEmployeeAsync();

            var (status, body) = await PostEventAsync(EventPayload("IT-ANY", "JUMP"), stationToken);

            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("Type must be \"IN\" or \"OUT\".", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_RecordsTheStationSessionAndGym_ForAudit()
        {
            var (gym, employee, stationToken) = await NewStationWithEmployeeAsync();

            var (status, body) = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            Assert.Equal(HttpStatusCode.Created, status);
            var numericRecordId = int.Parse(body.GetProperty("recordId").GetString()!["ATT-".Length..]);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var record = await db.AttendanceRecords
                .Include(ar => ar.StationSession)
                .FirstOrDefaultAsync(ar => ar.Id == numericRecordId);

            Assert.NotNull(record);
            // Where the attendance was taken: the gym, linked to the session that issued it.
            Assert.Equal(gym.GymId, record!.GymId);
            Assert.NotNull(record.StationSession);
            Assert.Equal(gym.GymId, record.StationSession!.GymId);
        }

        [Fact]
        public async Task Manual_ValidEntry_Returns201_AndAuditsReason()
        {
            var (gym, employee, stationToken) = await NewStationWithEmployeeAsync();

            var request = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/manual", new
            {
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

            // The audit trail records the station session (never the plaintext code).
            var record = await db.AttendanceRecords
                .Include(ar => ar.StationSession)
                .FirstOrDefaultAsync(ar => ar.Id == numericRecordId);
            Assert.NotNull(record!.StationSession);

            using var auditJson = JsonDocument.Parse(audit!.NewValues!);
            Assert.True(auditJson.RootElement.TryGetProperty("stationSessionId", out var auditedSessionId));
            Assert.Equal(record.StationSessionId, auditedSessionId.GetInt32());
        }

        [Fact]
        public async Task Manual_MissingReason_Returns400()
        {
            var (_, employee, stationToken) = await NewStationWithEmployeeAsync();

            var request = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/manual", new
            {
                employeeId = employee.EmployeeNumber,
                type = "IN"
            }, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            // The DTO's [Required] reason rejects it before the service layer runs.
            Assert.Equal("Validation Error", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Event_WithoutToken_Returns401()
        {
            // No station session and no user token: the fallback policy rejects outright.
            var response = await _fixture.Client.PostAsJsonAsync(
                "/api/attendance/events",
                EventPayload("IT-ANY", "IN"));

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Event_UserTokenWithoutGymClaim_Returns401_StationSessionRequired()
        {
            // The seeded admin (TopManagement) logs in without a gymId claim, so a
            // perfectly valid user JWT still cannot act on a station's behalf.
            var adminToken = await _fixture.GetAdminTokenAsync();
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/attendance/events",
                EventPayload("IT-ANY", "IN"), adminToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("Attendance requests require a station session token.", body.GetProperty("errorMessage").GetString());
        }
    }
}
