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
        public async Task Event_CheckOutAfterCheckIn_Returns201_ThenStaleOut400()
        {
            var (_, employee, stationToken) = await NewStationWithEmployeeAsync();

            var checkIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkIn.Status);
            var checkInAt = checkIn.Body.GetProperty("timestamp").GetDateTime();

            var checkOut = await PostEventAsync(EventPayload(employee.EmployeeNumber, "OUT"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            Assert.Equal("OUT", checkOut.Body.GetProperty("type").GetString());

            // A checkout that is not after the recorded one is refused — a replayed or
            // back-dated punch cannot move the day's end time backwards.
            var staleOut = await PostEventAsync(
                EventPayload(employee.EmployeeNumber, "OUT", timestamp: checkInAt), stationToken);

            Assert.Equal(HttpStatusCode.BadRequest, staleOut.Status);
            Assert.Equal("This employee is already checked out today.", staleOut.Body.GetProperty("errorMessage").GetString());
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
        public async Task Event_AutoType_OpensWhenNoRecord_ClosesWhenOpen_ReopensWhenComplete()
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

            // A scan on an already-complete day opens it again: the employee is back,
            // so the day is re-opened rather than nagging the terminal with an error.
            var reopened = await PostEventAsync(EventPayload(employee.EmployeeNumber, "AUTO"), stationToken);
            Assert.Equal(HttpStatusCode.Created, reopened.Status);
            Assert.Equal("IN", reopened.Body.GetProperty("type").GetString());

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var record = await db.AttendanceRecords.SingleAsync(r => r.EmployeeId == employee.EmployeeId);
            Assert.NotNull(record.CheckInTime);
            Assert.Null(record.CheckOutTime);
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
        public async Task AutoScan_AfterDayComplete_ReopensTheDay()
        {
            // The face pipeline's "already complete" outcome is gone: a scan on a
            // completed day re-opens it (the same AUTO behaviour /events has), so the
            // terminal never blocks an employee who is genuinely back at work.
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

            var reopened = await attendance.RecordBiometricEventAsync(new AttendanceEventRequest
            {
                EmployeeId = employee.EmployeeNumber,
                Type = "AUTO",
                LivenessScore = 0.95,
            }, gym.GymId, confirmCheckout: true);
            Assert.NotNull(reopened);
            Assert.Equal("IN", reopened!.Type);
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
            Assert.Equal("EARLY_LEAVE", checkOut.Body.GetProperty("shiftComparison").GetString());
            Assert.True(checkOut.Body.GetProperty("earlyLeaveWarning").GetBoolean());
        }

        /// <summary>
        /// A shift window around "now" whose end sits <paramref name="endsAfterCheckoutMinutes"/>
        /// after the check-out instant, with both punches in the recent past. Keeps the
        /// grace/warning tests independent of the clock the suite runs at.
        /// </summary>
        private (DateTime CheckInUtc, DateTime CheckOutUtc, TimeOnly CheckOutLocal, DateOnly Date, TimeOnly Start, TimeOnly End) RecentShift(
            int endsAfterCheckoutMinutes, int shiftMinutes = 480)
        {
            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var checkOutLocal = nowLocal.AddMinutes(-2);
            var endLocal = checkOutLocal.AddMinutes(endsAfterCheckoutMinutes);
            var startLocal = endLocal.AddMinutes(-shiftMinutes);
            return (
                TimeZoneInfo.ConvertTimeToUtc(startLocal, attendanceTimeZone),
                TimeZoneInfo.ConvertTimeToUtc(checkOutLocal, attendanceTimeZone),
                TimeOnly.FromDateTime(checkOutLocal),
                DateOnly.FromDateTime(startLocal),
                TimeOnly.FromDateTime(startLocal),
                TimeOnly.FromDateTime(endLocal));
        }

        private DateTime LocalUtc(DateOnly date, int hour, int minute)
        {
            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            return TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(new TimeOnly(hour, minute)), attendanceTimeZone);
        }

        private async Task SeedEarlyLeaveRequestAsync(
            int employeeId,
            DateOnly date,
            TimeOnly requestedTime,
            DomainLayer.Models.RequestModule.Enums.RequestStatus status =
                DomainLayer.Models.RequestModule.Enums.RequestStatus.Pending)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            db.EmployeeRequests.Add(new DomainLayer.Models.RequestModule.EmployeeRequest
            {
                EmployeeId = employeeId,
                Type = "Early Leave",
                RequestDate = date,
                TargetStartDate = date,
                TargetTime = requestedTime,
                Status = status,
                Details = "Integration test early leave request.",
                SubmittedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        private async Task<List<DomainLayer.Models.NotificationModule.Notification>> EarlyLeaveWarningsAsync(int userId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Notifications
                .Where(n => n.UserId == userId && n.Title == "Early Leaving Warning")
                .ToListAsync();
        }

        [Fact]
        public async Task Event_CheckOutInsideGrace_DoesNotRaiseWarning()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var hr = await builder.CreateUserAsync(DomainLayer.Models.UserModule.Enums.UserType.HR, [gym]);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            // Ends 5 minutes after the check-out: inside the 10-minute grace window.
            var window = RecentShift(endsAfterCheckoutMinutes: 5);
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, window.Date, "IT Grace", window.Start, window.End);

            await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", timestamp: window.CheckInUtc), stationToken);
            var checkOut = await PostEventAsync(
                EventPayload(employee.EmployeeNumber, "OUT", timestamp: window.CheckOutUtc), stationToken);

            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            Assert.Equal("ON_SCHEDULE", checkOut.Body.GetProperty("shiftComparison").GetString());
            Assert.False(checkOut.Body.GetProperty("earlyLeaveWarning").GetBoolean());
            Assert.Empty(await EarlyLeaveWarningsAsync(hr.UserId));
        }

        [Fact]
        public async Task Event_CheckOutPastGrace_WarnsBranchManagerAndHr()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var hr = await builder.CreateUserAsync(DomainLayer.Models.UserModule.Enums.UserType.HR, [gym]);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            // Ends 40 minutes after the check-out: well past the grace window.
            var window = RecentShift(endsAfterCheckoutMinutes: 40);
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, window.Date, "IT Warn", window.Start, window.End);

            await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", timestamp: window.CheckInUtc), stationToken);
            var checkOut = await PostEventAsync(
                EventPayload(employee.EmployeeNumber, "OUT", timestamp: window.CheckOutUtc), stationToken);

            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            Assert.Equal("EARLY_LEAVE", checkOut.Body.GetProperty("shiftComparison").GetString());
            Assert.True(checkOut.Body.GetProperty("earlyLeaveWarning").GetBoolean());
            Assert.True(checkOut.Body.GetProperty("earlyLeaveMinutes").GetInt32() >= 40);

            var warnings = await EarlyLeaveWarningsAsync(hr.UserId);
            Assert.Single(warnings);
            Assert.Contains("No early leave request was filed.", warnings[0].Message);
        }

        [Fact]
        public async Task Event_CheckOutBeforeRequestedEarlyLeaveTime_StillWarns()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var hr = await builder.CreateUserAsync(DomainLayer.Models.UserModule.Enums.UserType.HR, [gym]);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var window = RecentShift(endsAfterCheckoutMinutes: 40);
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, window.Date, "IT BeforeRequest", window.Start, window.End);

            // The employee asked to leave 20 minutes after the punch he actually made.
            await SeedEarlyLeaveRequestAsync(
                employee.EmployeeId, window.Date, window.CheckOutLocal.Add(TimeSpan.FromMinutes(20)));

            await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", timestamp: window.CheckInUtc), stationToken);
            var checkOut = await PostEventAsync(
                EventPayload(employee.EmployeeNumber, "OUT", timestamp: window.CheckOutUtc), stationToken);

            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            Assert.Equal("EARLY_LEAVE", checkOut.Body.GetProperty("shiftComparison").GetString());
            Assert.True(checkOut.Body.GetProperty("earlyLeaveWarning").GetBoolean());

            var warnings = await EarlyLeaveWarningsAsync(hr.UserId);
            Assert.Single(warnings);
            Assert.Contains("before the requested", warnings[0].Message);
        }

        [Theory]
        [InlineData(DomainLayer.Models.RequestModule.Enums.RequestStatus.Pending)]
        [InlineData(DomainLayer.Models.RequestModule.Enums.RequestStatus.Approved)]
        public async Task Event_CheckOutNotBeforeRequestedEarlyLeaveTime_IsCovered(DomainLayer.Models.RequestModule.Enums.RequestStatus requestStatus)
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var hr = await builder.CreateUserAsync(DomainLayer.Models.UserModule.Enums.UserType.HR, [gym]);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var window = RecentShift(endsAfterCheckoutMinutes: 40);
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, window.Date, "IT Covered", window.Start, window.End);

            // The request asked to leave 30 minutes before the actual check-out.
            await SeedEarlyLeaveRequestAsync(
                employee.EmployeeId, window.Date, window.CheckOutLocal.Add(TimeSpan.FromMinutes(-30)), requestStatus);

            await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", timestamp: window.CheckInUtc), stationToken);
            var checkOut = await PostEventAsync(
                EventPayload(employee.EmployeeNumber, "OUT", timestamp: window.CheckOutUtc), stationToken);

            Assert.Equal(HttpStatusCode.Created, checkOut.Status);
            Assert.Equal("EARLY_LEAVE_COVERED", checkOut.Body.GetProperty("shiftComparison").GetString());
            Assert.False(checkOut.Body.GetProperty("earlyLeaveWarning").GetBoolean());
            Assert.Empty(await EarlyLeaveWarningsAsync(hr.UserId));
        }

        [Fact]
        public async Task Event_ThirdEarlyLeaveOfMonth_DraftsWarningNotice()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.CreateUserAsync(DomainLayer.Models.UserModule.Enums.UserType.HR, [gym]);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone));
            var monthStart = new DateOnly(today.Year, today.Month, 1);
            var window = RecentShift(endsAfterCheckoutMinutes: 40);

            // Two prior unexcused early departures in the same month (never today or
            // the shift date today's punch will use).
            var priorDates = Enumerable.Range(0, DateTime.DaysInMonth(today.Year, today.Month))
                .Select(monthStart.AddDays)
                .Where(day => day != today && day != window.Date)
                .OrderBy(day => day < today ? 0 : 1)
                .ThenByDescending(day => day)
                .Take(2)
                .ToList();

            int templateId;
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                foreach (var day in priorDates)
                {
                    await builder.AssignShiftAsync(
                        employee.EmployeeId, gym.GymId, day, "IT Seeded", new TimeOnly(8, 0), new TimeOnly(16, 0));
                    await db.AttendanceRecords.AddAsync(new AttendanceRecord
                    {
                        EmployeeId = employee.EmployeeId,
                        GymId = gym.GymId,
                        Date = day,
                        Status = DomainLayer.Models.AttendanceModule.Enums.AttendanceStatus.EarlyCheckout,
                        ScheduledShiftTemplateId = (await db.ShiftTemplates
                            .FirstAsync(t => t.GymId == gym.GymId && t.Name == "IT Seeded")).Id,
                        CheckInTime = LocalUtc(day, 8, 0),
                        CheckOutTime = LocalUtc(day, 14, 0),
                    });
                    await db.SaveChangesAsync();
                }

                templateId = (await db.ShiftTemplates.FirstAsync(t => t.GymId == gym.GymId && t.Name == "IT Seeded")).Id;
            }
            Assert.True(templateId > 0);

            // Today's third warning is what triggers the auto-drafted notice.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, window.Date, "IT ThirdWarn", window.Start, window.End);

            await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", timestamp: window.CheckInUtc), stationToken);
            var checkOut = await PostEventAsync(
                EventPayload(employee.EmployeeNumber, "OUT", timestamp: window.CheckOutUtc), stationToken);
            Assert.Equal("EARLY_LEAVE", checkOut.Body.GetProperty("shiftComparison").GetString());

            using var verifyScope = _fixture.Services.CreateScope();
            var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var notice = await verifyDb.WarningNotices
                .FirstOrDefaultAsync(w => w.EmployeeId == employee.EmployeeId
                    && w.Reason == "Repeated early leaving");
            Assert.NotNull(notice);
            Assert.Equal(DomainLayer.Models.EmployeeModule.Enums.ProposalStatus.Pending, notice!.Status);
            Assert.Equal("Attendance", notice.Type);
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
        public async Task Event_AutoAfterMidnight_ClosesPreviousOvernightShift()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            // Overnight shift (22:00 → 05:00) assigned only to yesterday.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, builder.AttendanceToday.AddDays(-1), "IT Night", new TimeOnly(22, 0), new TimeOnly(5, 0));

            var attendanceTimeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var afterMidnight = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date, attendanceTimeZone);

            // Check in just after midnight, then let the always-on kiosk send AUTO a
            // few minutes later. It must close yesterday's open overnight record as
            // OUT instead of trying to open a second check-in for today.
            var checkIn = await PostEventAsync(
                EventPayload(employee.EmployeeNumber, "IN", timestamp: afterMidnight.AddMinutes(5)), stationToken);
            var auto = await PostEventAsync(
                EventPayload(employee.EmployeeNumber, "AUTO", timestamp: afterMidnight.AddMinutes(10)), stationToken);

            Assert.Equal(HttpStatusCode.Created, checkIn.Status);
            Assert.Equal(HttpStatusCode.Created, auto.Status);
            Assert.Equal("OUT", auto.Body.GetProperty("type").GetString());
            Assert.Equal(checkIn.Body.GetProperty("recordId").GetString(), auto.Body.GetProperty("recordId").GetString());
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
        public async Task Event_ScheduledDayOff_RecordsUnscheduledCheckIn()
        {
            // An employee with no shift today who still shows up is not turned away:
            // the punch is recorded as an unscheduled / off-day check-in (pending
            // approval) so HR can decide whether to pay it.
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            // Access to the gym but no shift today.
            var employee = await builder.CreateEmployeeAsync(gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var (status, body) = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);

            Assert.Equal(HttpStatusCode.Created, status);
            Assert.Equal("IN", body.GetProperty("type").GetString());

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var record = await db.AttendanceRecords.SingleAsync(r => r.EmployeeId == employee.EmployeeId);
            Assert.NotNull(record.CheckInTime);
            Assert.Contains("Unscheduled", record.Notes ?? string.Empty, StringComparison.Ordinal);

            // …and the approval request behind it exists for HR to decide.
            var request = await db.EmployeeRequests.SingleAsync(r =>
                r.EmployeeId == employee.EmployeeId && r.RequestDate == record.Date);
            Assert.Equal("Unscheduled Attendance", request.Type);
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
