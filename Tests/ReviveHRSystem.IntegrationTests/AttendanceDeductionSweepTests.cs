using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.AttendanceModule.Enums;
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
    /// The attendance → deduction bridge behind Employees Performance → Deductions:
    /// a scheduled-but-unpunched day and a stored late day both land in the branch's
    /// list as priced, pending deductions (3 days / a quarter day of pay), reading
    /// the list twice never doubles a day up, a day that no longer justifies the
    /// deduction (corrected to On Time, approved day off) takes the auto-raised row
    /// with it, a row raised before any salary was on file is priced for real as soon
    /// as one exists, and HR can re-price a line at month end.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class AttendanceDeductionSweepTests
    {
        private const decimal Salary = 7800m;

        private readonly ApiTestFixture _fixture;

        public AttendanceDeductionSweepTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        [Fact]
        public async Task DerivedAbsence_RaisesPricedThreeDayDeduction_OncePerDay()
        {
            var builder = NewBuilder();
            var (token, employeeId, today, monthStart, monthEnd) = await SceneAsync(builder, shiftToday: true);

            var first = await BranchDeductionsAsync(token, employeeId);
            var row = Assert.Single(first);

            Assert.Equal("Unapproved absence", row.GetProperty("reason").GetString());
            Assert.Equal("Pending", row.GetProperty("status").GetString());
            // Three days of pay: base ÷ scheduled workdays × 3.
            Assert.Equal(Expected(monthStart, monthEnd, 3), row.GetProperty("amount").GetDecimal());
            // The day it punishes rides along in the marker, so payroll close and the
            // tab agree on which day the money belongs to.
            Assert.StartsWith($"auto-absence:{today:yyyy-MM-dd}", row.GetProperty("note").GetString());

            // Idempotent: a second read of the same tab never raises the day twice.
            var second = await BranchDeductionsAsync(token, employeeId);
            Assert.Single(second);
        }

        [Fact]
        public async Task LateRecord_RaisesQuarterDayDeduction()
        {
            var builder = NewBuilder();
            var (token, employeeId, today, monthStart, monthEnd) = await SceneAsync(builder, shiftToday: false);
            await builder.CreateAttendanceRecordAsync(
                employeeId, await GymIdOf(employeeId), today,
                status: AttendanceStatus.Late);

            var rows = await BranchDeductionsAsync(token, employeeId);
            var row = Assert.Single(rows);

            Assert.Equal("Late arrival", row.GetProperty("reason").GetString());
            Assert.Equal("Pending", row.GetProperty("status").GetString());
            // A quarter day of pay: base ÷ scheduled workdays ÷ 4.
            Assert.Equal(Expected(monthStart, monthEnd, 0.25m), row.GetProperty("amount").GetDecimal());
            Assert.Contains("quarter day", row.GetProperty("note").GetString(), StringComparison.Ordinal);
        }

        [Fact]
        public async Task CorrectedDay_TakesTheAutoDeductionWithIt()
        {
            var builder = NewBuilder();
            var (token, employeeId, today, _, _) = await SceneAsync(builder, shiftToday: false);
            await builder.CreateAttendanceRecordAsync(
                employeeId, await GymIdOf(employeeId), today, status: AttendanceStatus.Late);

            Assert.Single(await BranchDeductionsAsync(token, employeeId));

            // HR corrects the day back to On Time in the attendance grid: the day no
            // longer justifies the penalty, so the pending auto row goes with it.
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var record = await db.AttendanceRecords
                    .SingleAsync(r => r.EmployeeId == employeeId && r.Date == today);
                record.Status = AttendanceStatus.OnTime;
                await db.SaveChangesAsync();
            }

            Assert.Empty(await BranchDeductionsAsync(token, employeeId));
        }

        [Fact]
        public async Task ApprovedDayOff_IsNotAnAbsence()
        {
            var builder = NewBuilder();
            var (token, employeeId, today, _, _) = await SceneAsync(builder, shiftToday: true);
            await builder.CreateApprovedDayOffAsync(employeeId, today, today);

            Assert.Empty(await BranchDeductionsAsync(token, employeeId));
        }

        [Fact]
        public async Task SalaryHistory_PricesTheDeduction_WhenNoSheetCoversTheMonth()
        {
            // The usual mid-month state: HR has recorded a salary but no payroll
            // sheet exists yet. The salary history is the pricing source, so the
            // branch still sees real money rather than a bare 0.
            var builder = NewBuilder();
            var (token, employeeId, today, monthStart, monthEnd) =
                await SceneAsync(builder, shiftToday: true, withSheet: false);
            await SeedCompensationAsync(employeeId, Salary, today.AddDays(-30));

            var row = Assert.Single(await BranchDeductionsAsync(token, employeeId));

            Assert.Equal(Expected(monthStart, monthEnd, 3), row.GetProperty("amount").GetDecimal());
            Assert.DoesNotContain("No salary on file", row.GetProperty("note").GetString(), StringComparison.Ordinal);
            Assert.Contains("Auto-priced", row.GetProperty("note").GetString(), StringComparison.Ordinal);
        }

        [Fact]
        public async Task NoSalaryOnFile_FallsBackToAPricedManuallyRow()
        {
            var builder = NewBuilder();
            var (token, employeeId, _, _, _) = await SceneAsync(builder, shiftToday: true, withSheet: false);

            // No sheet and no salary history: nothing to charge yet — the row stays
            // pending at 0 and tells the branch to price it by hand.
            var row = Assert.Single(await BranchDeductionsAsync(token, employeeId));

            Assert.Equal(0m, row.GetProperty("amount").GetDecimal());
            Assert.Contains("No salary on file", row.GetProperty("note").GetString(), StringComparison.Ordinal);
        }

        [Fact]
        public async Task SalaryRecordedLater_PricesTheAlreadyRaisedRow()
        {
            // The row is raised before anyone records a salary (the state your branch
            // list is in now): it stands at 0. Once HR records a salary, the next read
            // of the tab prices that same row — no duplicate, no manual entry needed.
            var builder = NewBuilder();
            var (token, employeeId, today, monthStart, monthEnd) =
                await SceneAsync(builder, shiftToday: true, withSheet: false);

            var before = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal(0m, before.GetProperty("amount").GetDecimal());

            await SeedCompensationAsync(employeeId, Salary, today.AddDays(-30));

            var after = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal(before.GetProperty("id").GetInt32(), after.GetProperty("id").GetInt32());
            Assert.Equal(Expected(monthStart, monthEnd, 3), after.GetProperty("amount").GetDecimal());
            Assert.Contains("Auto-priced", after.GetProperty("note").GetString(), StringComparison.Ordinal);
        }

        // ------------------------------------------------------------------
        // Scene: a fresh gym, its Branch Manager, one employee, this month's sheet
        // ------------------------------------------------------------------

        private async Task<(string Token, int EmployeeId, DateOnly Today, DateOnly MonthStart, DateOnly MonthEnd)> SceneAsync(
            TestDataBuilder builder, bool shiftToday, bool withSheet = true)
        {
            var gym = await builder.CreateGymWithStationAsync();
            var manager = await builder.CreateUserAsync(UserType.TopManagement, new[] { gym });
            await GrantGymRoleAsync(manager.UserId, gym.GymId, "Branch Manager");

            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: shiftToday ? gym : null);

            var today = builder.AttendanceToday;
            var monthStart = new DateOnly(today.Year, today.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            if (withSheet)
            {
                var periodId = await builder.CreatePayrollPeriodAsync(gym.GymId, monthStart, monthEnd);
                await builder.CreatePayrollEntryAsync(periodId, employee.EmployeeId, Salary);
            }

            var token = await LoginAsync(manager, gym.GymId);
            return (token, employee.EmployeeId, today, monthStart, monthEnd);
        }

        /// <summary>HR records a salary (the salary-history rung of the pricing chain).</summary>
        private async Task SeedCompensationAsync(int employeeId, decimal amount, DateOnly effectiveDate)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            db.Compensations.Add(new DomainLayer.Models.EmployeeModule.Compensation
            {
                EmployeeId = employeeId,
                Amount = amount,
                EffectiveDate = effectiveDate,
                // ChangedBy is a real account — whoever recorded the salary.
                ChangedBy = await db.Users.OrderBy(u => u.Id).Select(u => u.Id).FirstAsync(),
            });
            await db.SaveChangesAsync();
        }

        /// <summary>base ÷ scheduled workdays × <paramref name="days"/> — the pricing rule under test.</summary>
        private static decimal Expected(DateOnly monthStart, DateOnly monthEnd, decimal days)
        {
            var span = monthEnd.DayNumber - monthStart.DayNumber + 1;
            var scheduled = Math.Max(1, (int)Math.Floor(span * 6 / 7.0));
            return Math.Round(Math.Round(Salary / scheduled, 2) * days, 2);
        }

        private async Task<JsonElement[]> BranchDeductionsAsync(string token, int employeeId)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get,
                $"/api/deduction-candidates/branch?employeeId={employeeId}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from the branch deductions list but got {(int)response.StatusCode}: {body}");

            var json = JsonSerializer.Deserialize<JsonElement>(body);
            var array = json.ValueKind == JsonValueKind.Array ? json : json.GetProperty("data");
            return array.EnumerateArray().ToArray();
        }

        private async Task<string> LoginAsync(TestUser user, int gymId)
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login",
                new { email = user.Email, password = user.Password });
            login.EnsureSuccessStatusCode();
            var body = await login.Content.ReadFromJsonAsync<JsonElement>();
            if (body.TryGetProperty("accessToken", out var direct) && direct.ValueKind == JsonValueKind.String)
            {
                return direct.GetString()!;
            }

            var temp = body.GetProperty("tempSessionToken").GetString()!;
            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym",
                new { gymId, tempSessionToken = temp });
            select.EnsureSuccessStatusCode();
            var selected = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selected.GetProperty("accessToken").GetString()!;
        }

        private async Task GrantGymRoleAsync(int userId, int gymId, string roleName)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var roleId = await db.Roles.Where(r => r.Name == roleName).Select(r => r.Id).SingleAsync();
            db.UserGymRoles.Add(new DomainLayer.Models.UserModule.UserGymRole
            {
                UserId = userId,
                GymId = gymId,
                RoleId = roleId,
            });
            await db.SaveChangesAsync();
        }

        private async Task<int> GymIdOf(int employeeId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.Id == employeeId).Select(e => e.GymId).SingleAsync();
        }
    }
}
