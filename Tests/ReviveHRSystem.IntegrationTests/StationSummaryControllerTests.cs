using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// The kiosk dashboard data endpoint: today's counters and the scheduled roster
    /// (shift, punches, lateness / early leave) for the station's gym, authenticated
    /// by the station session.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class StationSummaryControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public StationSummaryControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        /// <summary>Kiosk dashboard built at a fixed instant (the midnight rollover is clock-driven).</summary>
        private async Task<Shared.DataTransferObject.Attendance.StationSummaryResponse> BuildSummaryAtAsync(int gymId, DateTime utcNow)
        {
            using var scope = _fixture.Services.CreateScope();
            var sp = scope.ServiceProvider;
            var service = new Service.Services.AttendanceService(
                sp.GetRequiredService<DomainLayer.Contracts.IUnitOfWork>(),
                sp.GetRequiredService<DomainLayer.Contracts.IUserAccessRepository>(),
                sp.GetRequiredService<ServiceAbstraction.Services.IStationSessionService>(),
                sp.GetRequiredService<TimeZoneInfo>(),
                sp.GetRequiredService<Service.Services.AttendanceOptions>(),
                new FixedTimeProvider(utcNow));
            return await service.GetStationSummaryAsync(gymId);
        }

        private static DateTime LocalToUtc(DateOnly date, TimeOnly time, TimeZoneInfo tz) =>
            TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified), tz);

        private sealed class FixedTimeProvider(DateTime utcNow) : TimeProvider
        {
            public override DateTimeOffset GetUtcNow() => new(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc));
        }

        [Fact]
        public async Task Summary_StationSession_ReturnsGymsTodayData()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            // One check-in today: present 1, scheduled 1 (the employee's shift).
            var punch = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/events", new
            {
                employeeId = employee.EmployeeNumber,
                type = "IN",
                livenessScore = 0.95,
            }, stationToken);
            var punchResponse = await _fixture.Client.SendAsync(punch);
            Assert.Equal(HttpStatusCode.Created, punchResponse.StatusCode);

            var request = _fixture.StationRequest(HttpMethod.Get, "/api/attendance/station-summary", null, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(body.GetProperty("presentCount").GetInt32() >= 1);
            Assert.True(body.GetProperty("scheduledTodayCount").GetInt32() >= 1);

            var records = body.GetProperty("records").EnumerateArray().ToArray();
            Assert.Contains(records, r => r.GetProperty("employeeId").GetString() == employee.EmployeeNumber);
            var row = records.First(r => r.GetProperty("employeeId").GetString() == employee.EmployeeNumber);
            Assert.Equal("PRESENT", row.GetProperty("status").GetString());
            Assert.False(string.IsNullOrWhiteSpace(row.GetProperty("checkIn").GetString()));
            Assert.Null(row.GetProperty("checkOut").GetString());
            Assert.Matches(@"^\d{2}:\d{2}$", row.GetProperty("shiftStart").GetString()!);
            Assert.Matches(@"^\d{2}:\d{2}$", row.GetProperty("shiftEnd").GetString()!);
            Assert.True(row.GetProperty("lateMinutes").GetInt32() >= 0);
            Assert.Equal(0, row.GetProperty("earlyLeaveMinutes").GetInt32());
        }

        [Fact]
        public async Task Summary_CheckOut_UpdatesTheRowToLeft()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            foreach (var type in new[] { "IN", "OUT" })
            {
                var punch = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/events", new
                {
                    employeeId = employee.EmployeeNumber,
                    type,
                    livenessScore = 0.95,
                }, stationToken);
                var punchResponse = await _fixture.Client.SendAsync(punch);
                Assert.Equal(HttpStatusCode.Created, punchResponse.StatusCode);
            }

            var request = _fixture.StationRequest(HttpMethod.Get, "/api/attendance/station-summary", null, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var row = body.GetProperty("records").EnumerateArray()
                .First(r => r.GetProperty("employeeId").GetString() == employee.EmployeeNumber);
            Assert.Equal("LEFT", row.GetProperty("status").GetString());
            Assert.False(string.IsNullOrWhiteSpace(row.GetProperty("checkIn").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(row.GetProperty("checkOut").GetString()));
            Assert.Equal(0, body.GetProperty("presentCount").GetInt32());
        }

        [Fact]
        public async Task Summary_AfterMidnight_KeepsYesterdaysOvernightPunchesVisible()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);

            using var scope = _fixture.Services.CreateScope();
            var sp = scope.ServiceProvider;
            var tz = sp.GetRequiredService<TimeZoneInfo>();
            var today = builder.AttendanceToday;
            var yesterday = today.AddDays(-1);

            // The reported case: a 20:00 → 04:00 shift dated yesterday. At 03:05 the shift
            // is still running, but the roster used to switch to the new date at 00:00 and
            // drop both punches — so a check-out looked like it never happened.
            await builder.AssignShiftAsync(employee.EmployeeId, gym.GymId, yesterday, "IT Night", new TimeOnly(20, 0), new TimeOnly(4, 0));
            // …and they are also on tonight's roster, which must not hide the running shift.
            await builder.AssignShiftAsync(employee.EmployeeId, gym.GymId, today, "IT Night", new TimeOnly(20, 0), new TimeOnly(4, 0));

            var db = sp.GetRequiredService<Presistence.Data.ReviveHrDbContext>();
            db.AttendanceRecords.Add(new DomainLayer.Models.AttendanceModule.AttendanceRecord
            {
                EmployeeId = employee.EmployeeId,
                GymId = gym.GymId,
                Date = yesterday,
                CheckInTime = LocalToUtc(yesterday, new TimeOnly(21, 13), tz),
                CheckOutTime = LocalToUtc(today, new TimeOnly(3, 12), tz),
                CheckInMethod = DomainLayer.Models.AttendanceModule.Enums.AttendanceMethod.Biometric,
                CheckOutMethod = DomainLayer.Models.AttendanceModule.Enums.AttendanceMethod.Biometric,
                Status = DomainLayer.Models.AttendanceModule.Enums.AttendanceStatus.Late,
            });
            await db.SaveChangesAsync();

            var summary = await BuildSummaryAtAsync(gym.GymId, LocalToUtc(today, new TimeOnly(3, 5), tz));

            var row = Assert.Single(summary.Records, r => r.EmployeeId == employee.EmployeeNumber);
            Assert.True(row.CarriedOver);
            Assert.Equal("LEFT", row.Status);
            Assert.Equal("21:13", row.CheckIn);
            Assert.Equal("03:12", row.CheckOut);

            // Still one row per person while the shift is open (tonight's row steps aside).
            Assert.Single(summary.Records, r => r.EmployeeId == employee.EmployeeNumber);
            // The "x of y" counter counts the roster that is displayed.
            Assert.Equal(summary.Records.Count, summary.ScheduledTodayCount);

            // The carry-over is bounded: by mid-morning the roster is today-only again.
            var later = await BuildSummaryAtAsync(gym.GymId, LocalToUtc(today, new TimeOnly(15, 0), tz));
            var laterRow = Assert.Single(later.Records, r => r.EmployeeId == employee.EmployeeNumber);
            Assert.False(laterRow.CarriedOver);
            Assert.Equal("SCHEDULED", laterRow.Status);
            Assert.Null(laterRow.CheckIn);
        }

        [Fact]
        public async Task Summary_WithoutStationToken_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/attendance/station-summary");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Summary_ScopedToTheSessionsGym()
        {
            var builder = NewBuilder();
            var homeGym = await builder.CreateGymWithStationAsync();
            var otherGym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(homeGym, shiftAtGym: homeGym);
            var otherStationToken = await _fixture.GetStationTokenAsync(otherGym.StationCode);

            // The employee is checked in at homeGym; the other gym's station must not
            // see that record in its feed.
            var homeToken = await _fixture.GetStationTokenAsync(homeGym.StationCode);
            var punch = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/events", new
            {
                employeeId = employee.EmployeeNumber,
                type = "IN",
                livenessScore = 0.95,
            }, homeToken);
            Assert.Equal(HttpStatusCode.Created, (await _fixture.Client.SendAsync(punch)).StatusCode);

            var request = _fixture.StationRequest(HttpMethod.Get, "/api/attendance/station-summary", null, otherStationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(0, body.GetProperty("presentCount").GetInt32());
            Assert.Empty(body.GetProperty("records").EnumerateArray());
        }

        [Fact]
        public async Task Summary_GymScopedUserToken_Returns200()
        {
            // Karim's token is scoped to gym 1, so it may read that gym's dashboard.
            var token = await _fixture.LoginAsync(
                "karim@revive.hr",
                ReviveHRSystem.Web.DataSeed.DevelopmentDataSeeder.EmployeePassword);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/attendance/station-summary", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task Summary_ExpiredSession_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<Presistence.Data.ReviveHrDbContext>();
                var session = await db.StationSessions.FirstAsync(s => s.GymId == gym.GymId);
                session.ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
                await db.SaveChangesAsync();
            }

            var request = _fixture.StationRequest(HttpMethod.Get, "/api/attendance/station-summary", null, stationToken);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }
}