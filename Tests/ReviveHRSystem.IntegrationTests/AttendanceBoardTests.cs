using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.AttendanceModule.Enums;
using Microsoft.Extensions.DependencyInjection;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Shared.DataTransferObject.Attendance;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// The live attendance board (A1) around midnight: a 20:00 → 04:00 shift dated
    /// yesterday is still running after 00:00 and its punches live on yesterday's record,
    /// so the "today" board must show that row instead of an empty, "Absent" one — and a
    /// shift nobody has reached yet is not an absence. The board's clock is pinned here so
    /// the assertions do not depend on when the suite runs.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class AttendanceBoardTests
    {
        private readonly ApiTestFixture _fixture;

        public AttendanceBoardTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Board_ShiftNotStartedYet_IsScheduledNotAbsent()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var today = builder.AttendanceToday;
            var tz = AttendanceTimeZone();

            // Tonight's 20:00 → 04:00 shift: at 03:05 it has not started.
            await builder.AssignShiftAsync(employee.EmployeeId, gym.GymId, today, "IT Night", new TimeOnly(20, 0), new TimeOnly(4, 0));

            var board = await BoardAtAsync(gym.GymId, today, LocalToUtc(today, new TimeOnly(3, 5), tz));

            var row = Assert.Single(board.Items, r => r.EmployeeId == employee.EmployeeId);
            Assert.Equal("Scheduled", row.Status);
            Assert.Null(row.CheckIn);
        }

        [Fact]
        public async Task Board_DayShiftAlreadyStartedWithoutPunch_IsAbsent()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var today = builder.AttendanceToday;
            var tz = AttendanceTimeZone();

            await builder.AssignShiftAsync(employee.EmployeeId, gym.GymId, today, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));

            var board = await BoardAtAsync(gym.GymId, today, LocalToUtc(today, new TimeOnly(17, 0), tz));

            var row = Assert.Single(board.Items, r => r.EmployeeId == employee.EmployeeId);
            Assert.Equal("Absent", row.Status);
        }

        [Fact]
        public async Task Board_AfterMidnight_ShowsLastNightsOvernightPunches()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var today = builder.AttendanceToday;
            var yesterday = today.AddDays(-1);
            var tz = AttendanceTimeZone();

            // The staff member works 20:00 → 04:00: last night's shift (dated yesterday)
            // closed at 03:35 this morning, and tonight's shift is also on the roster.
            var templateId = await builder.CreateShiftTemplateAsync(gym, "IT Night", new TimeOnly(20, 0), new TimeOnly(4, 0));
            await builder.AssignShiftAsync(employee.EmployeeId, gym.GymId, yesterday, "IT Night", new TimeOnly(20, 0), new TimeOnly(4, 0));
            await builder.AssignShiftAsync(employee.EmployeeId, gym.GymId, today, "IT Night", new TimeOnly(20, 0), new TimeOnly(4, 0));
            await builder.CreateAttendanceRecordAsync(
                employee.EmployeeId,
                gym.GymId,
                yesterday,
                checkInUtc: LocalToUtc(yesterday, new TimeOnly(21, 13), tz),
                checkOutUtc: LocalToUtc(today, new TimeOnly(3, 35), tz),
                status: AttendanceStatus.Late,
                scheduledShiftTemplateId: templateId);

            var board = await BoardAtAsync(gym.GymId, today, LocalToUtc(today, new TimeOnly(3, 38), tz));

            var row = Assert.Single(board.Items, r => r.EmployeeId == employee.EmployeeId);
            Assert.Equal(yesterday.ToString("yyyy-MM-dd"), row.Date);
            Assert.Equal("21:13", row.CheckIn);
            Assert.Equal("03:35", row.CheckOut);
            Assert.Equal("Late", row.Status);
            Assert.Equal(73, row.LateMinutes);
            Assert.Equal(25, row.EarlyLeaveMinutes);
            Assert.Contains("Night shift from yesterday", row.Notes);
        }

        [Fact]
        public async Task EmployeeHistory_LateAndEarlyDeparture_AreBothReported()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var today = builder.AttendanceToday;
            var tz = AttendanceTimeZone();

            // Stored status can only say one thing (lateness outranks early checkout), so
            // the row carries both measurements for the badges.
            var templateId = await builder.CreateShiftTemplateAsync(gym, "IT Night", new TimeOnly(20, 0), new TimeOnly(4, 0));
            await builder.AssignShiftAsync(employee.EmployeeId, gym.GymId, today, "IT Night", new TimeOnly(20, 0), new TimeOnly(4, 0));
            await builder.CreateAttendanceRecordAsync(
                employee.EmployeeId,
                gym.GymId,
                today,
                checkInUtc: LocalToUtc(today, new TimeOnly(21, 13), tz),
                checkOutUtc: LocalToUtc(today.AddDays(1), new TimeOnly(3, 35), tz),
                status: AttendanceStatus.Late,
                scheduledShiftTemplateId: templateId);

            var token = await _fixture.GetAdminTokenAsync();
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get,
                $"/api/employees/{employee.EmployeeId}/attendance?month={today:yyyy-MM}",
                null,
                token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var row = body.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("date").GetString() == today.ToString("yyyy-MM-dd"));
            Assert.Equal("Late", row.GetProperty("status").GetString());
            Assert.Equal(73, row.GetProperty("lateMinutes").GetInt32());
            Assert.Equal(25, row.GetProperty("earlyLeaveMinutes").GetInt32());
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        /// <summary>The board built at a pinned instant, so month/midnight rules are testable.</summary>
        private async Task<AttendanceListResponse> BoardAtAsync(int gymId, DateOnly date, DateTime utcNow)
        {
            using var scope = _fixture.Services.CreateScope();
            var sp = scope.ServiceProvider;
            var service = new Service.Services.AttendanceManagementService(
                sp.GetRequiredService<DomainLayer.Contracts.IUnitOfWork>(),
                sp.GetRequiredService<ServiceAbstraction.Services.IAccessControlService>(),
                sp.GetRequiredService<DomainLayer.Contracts.IUserAccessRepository>(),
                sp.GetRequiredService<ServiceAbstraction.Services.ITeamScopeService>(),
                sp.GetRequiredService<TimeZoneInfo>(),
                sp.GetRequiredService<ServiceAbstraction.Services.IAttendanceDeductionSweepService>(),
                new FixedTimeProvider(utcNow));

            var query = new AttendanceListQuery
            {
                Date = date.ToString("yyyy-MM-dd"),
                GymId = gymId,
                Page = 1,
                PageSize = 100,
            };
            return await service.GetAttendanceAsync(AdminUserId(), query, gymId);
        }

        /// <summary>The seeded admin principal (TopManagement bypasses gym permission checks).</summary>
        private int AdminUserId()
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Presistence.Data.ReviveHrDbContext>();
            return db.Users.Single(u => u.Email == "admin@revive.hr").Id;
        }

        private TimeZoneInfo AttendanceTimeZone()
        {
            using var scope = _fixture.Services.CreateScope();
            return scope.ServiceProvider.GetRequiredService<TimeZoneInfo>();
        }

        private static DateTime LocalToUtc(DateOnly date, TimeOnly time, TimeZoneInfo tz) =>
            TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified), tz);

        private sealed class FixedTimeProvider(DateTime utcNow) : TimeProvider
        {
            public override DateTimeOffset GetUtcNow() => new(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc));
        }
    }
}
