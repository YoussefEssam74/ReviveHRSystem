using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
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
    /// list as priced, pending deductions (one day / a quarter day of pay at
    /// salary ÷ 30), reading the list twice never doubles a day up, a day that no
    /// longer justifies the deduction (corrected to On Time, approved leave of any
    /// type) takes the auto-raised row with it, a rejected day is final, a row
    /// raised before any salary was on file is priced for real as soon as one
    /// exists, and HR can re-price a line at month end.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class AttendanceDeductionSweepTests
    {
        private const decimal Salary = 7800m;

        private readonly ApiTestFixture _fixture;

        public AttendanceDeductionSweepTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        [Fact]
        public async Task DerivedAbsence_RaisesPricedDayDeduction_OncePerDay()
        {
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) = await SceneAsync(builder);

            var first = await BranchDeductionsAsync(token, employeeId);
            var row = Assert.Single(first);

            Assert.Equal("Unapproved absence", row.GetProperty("reason").GetString());
            Assert.Equal("Pending", row.GetProperty("status").GetString());
            // One day of pay: base ÷ 30 × 1.
            Assert.Equal(Expected(1), row.GetProperty("amount").GetDecimal());
            Assert.Equal(1m, row.GetProperty("deductionDays").GetDecimal());
            // The day it punishes rides along, so payroll close and the tab agree
            // on which day the money belongs to.
            Assert.Equal(target.ToString("yyyy-MM-dd"), row.GetProperty("date").GetString());
            Assert.StartsWith($"auto-absence:{target:yyyy-MM-dd}", row.GetProperty("note").GetString());

            // Idempotent: a second read of the same tab never raises the day twice.
            var second = await BranchDeductionsAsync(token, employeeId);
            var again = Assert.Single(second);
            Assert.Equal(row.GetProperty("id").GetInt32(), again.GetProperty("id").GetInt32());
        }

        [Fact]
        public async Task LateRecord_RaisesQuarterDayDeduction()
        {
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) = await SceneAsync(builder);
            await builder.CreateAttendanceRecordAsync(
                employeeId, await GymIdOf(employeeId), target,
                status: AttendanceStatus.Late);

            var rows = await BranchDeductionsAsync(token, employeeId);
            var row = Assert.Single(rows);

            Assert.Equal("Late arrival", row.GetProperty("reason").GetString());
            Assert.Equal("Pending", row.GetProperty("status").GetString());
            // A quarter day of pay: base ÷ 30 ÷ 4.
            Assert.Equal(Expected(0.25m), row.GetProperty("amount").GetDecimal());
            Assert.Equal(0.25m, row.GetProperty("deductionDays").GetDecimal());
            Assert.Equal(target.ToString("yyyy-MM-dd"), row.GetProperty("date").GetString());
            Assert.Contains("quarter day", row.GetProperty("note").GetString(), StringComparison.Ordinal);
        }

        [Fact]
        public async Task CorrectedDay_TakesTheAutoDeductionWithIt()
        {
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) = await SceneAsync(builder);
            await builder.CreateAttendanceRecordAsync(
                employeeId, await GymIdOf(employeeId), target, status: AttendanceStatus.Late);

            Assert.Single(await BranchDeductionsAsync(token, employeeId));

            // HR corrects the day back to On Time in the attendance grid: the day no
            // longer justifies the penalty, so the pending auto row goes with it.
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var record = await db.AttendanceRecords
                    .SingleAsync(r => r.EmployeeId == employeeId && r.Date == target);
                record.Status = AttendanceStatus.OnTime;
                await db.SaveChangesAsync();
            }

            Assert.Empty(await BranchDeductionsAsync(token, employeeId));
        }

        [Fact]
        public async Task ApprovedDayOff_IsNotAnAbsence()
        {
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) = await SceneAsync(builder);
            await builder.CreateApprovedDayOffAsync(employeeId, target, target);

            Assert.Empty(await BranchDeductionsAsync(token, employeeId));
        }

        /// <summary>
        /// Approved leave of any type — paid or unpaid, balance-consuming or not —
        /// exempts the day, even when a stale biometric record still says Late.
        /// </summary>
        [Theory]
        [InlineData("Annual Leave")]
        [InlineData("Sick Leave")]
        public async Task ApprovedLeaveOfAnyType_IsNotAnAbsence(string leaveType)
        {
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) = await SceneAsync(builder);
            await SeedApprovedLeaveAsync(employeeId, leaveType, target);
            await builder.CreateAttendanceRecordAsync(
                employeeId, await GymIdOf(employeeId), target, status: AttendanceStatus.Late);

            Assert.Empty(await BranchDeductionsAsync(token, employeeId));
        }

        /// <summary>
        /// A rejection is final: the row keeps its day, and the sweep never re-raises
        /// the punished day — not on the next read of the tab either.
        /// </summary>
        [Fact]
        public async Task RejectedDay_IsFinal_AndNeverReRaised()
        {
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) = await SceneAsync(builder);
            var row = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            var candidateId = row.GetProperty("id").GetInt32();

            var reject = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/deduction-candidates/{candidateId}/branch-review", new { decision = "Reject" }, token);
            Assert.Equal(HttpStatusCode.OK, (await _fixture.Client.SendAsync(reject)).StatusCode);

            var after = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal(candidateId, after.GetProperty("id").GetInt32());
            Assert.Equal("Rejected", after.GetProperty("status").GetString());
            Assert.Equal(Expected(1), after.GetProperty("amount").GetDecimal());

            // The next sweep of the same day adds nothing.
            var third = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal(candidateId, third.GetProperty("id").GetInt32());
        }

        [Fact]
        public async Task SalaryHistory_PricesTheDeduction_WhenNoSheetCoversTheMonth()
        {
            // The usual mid-month state: HR has recorded a salary but no payroll
            // sheet exists yet. The salary history is the pricing source, so the
            // branch still sees real money rather than a bare 0.
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) =
                await SceneAsync(builder, withSheet: false);
            await SeedCompensationAsync(employeeId, Salary, target.AddDays(-30));

            var row = Assert.Single(await BranchDeductionsAsync(token, employeeId));

            Assert.Equal(Expected(1), row.GetProperty("amount").GetDecimal());
            Assert.DoesNotContain("No salary on file", row.GetProperty("note").GetString(), StringComparison.Ordinal);
            Assert.Contains("Auto-priced", row.GetProperty("note").GetString(), StringComparison.Ordinal);
        }

        [Fact]
        public async Task NoSalaryOnFile_FallsBackToAPricedManuallyRow()
        {
            var builder = NewBuilder();
            var (token, employeeId, _, _, _) = await SceneAsync(builder, withSheet: false);

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
            var (token, employeeId, target, _, _) =
                await SceneAsync(builder, withSheet: false);

            var before = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal(0m, before.GetProperty("amount").GetDecimal());

            await SeedCompensationAsync(employeeId, Salary, target.AddDays(-30));

            var after = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal(before.GetProperty("id").GetInt32(), after.GetProperty("id").GetInt32());
            Assert.Equal(Expected(1), after.GetProperty("amount").GetDecimal());
            Assert.Contains("Auto-priced", after.GetProperty("note").GetString(), StringComparison.Ordinal);
        }

        // ------------------------------------------------------------------
        // Scene: a fresh gym, its Branch Manager, one employee, one finished day
        // ------------------------------------------------------------------

        /// <summary>
        /// A gym whose Branch Manager can read its deductions, one employee scheduled
        /// on a day the gym's local clock has already finished, and — unless asked
        /// otherwise — this month's payroll sheet. The branch list only sweeps from
        /// the current month, so the punished day is yesterday whenever the month
        /// has one, else today under a shift that ended a minute after midnight.
        /// </summary>
        private async Task<(string Token, int EmployeeId, DateOnly Target, DateOnly MonthStart, DateOnly MonthEnd)> SceneAsync(
            TestDataBuilder builder, bool withSheet = true)
        {
            var gym = await builder.CreateGymWithStationAsync();
            var manager = await builder.CreateUserAsync(UserType.TopManagement, new[] { gym });
            await GrantGymRoleAsync(manager.UserId, gym.GymId, "Branch Manager");

            var employee = await builder.CreateEmployeeAsync(gym);

            var today = builder.AttendanceToday;
            var target = today.Day > 1 ? today.AddDays(-1) : today;
            // The shift only has to exist for the day; a 00:00–00:01 end keeps the
            // "every shift has ended" guard true even when the day is today.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, target, "IT Morning",
                new TimeOnly(0, 0), new TimeOnly(0, 1));

            var monthStart = new DateOnly(target.Year, target.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            if (withSheet)
            {
                var periodId = await builder.CreatePayrollPeriodAsync(gym.GymId, monthStart, monthEnd);
                await builder.CreatePayrollEntryAsync(periodId, employee.EmployeeId, Salary);
            }

            var token = await LoginAsync(manager, gym.GymId);
            return (token, employee.EmployeeId, target, monthStart, monthEnd);
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

        /// <summary>An approved leave request of any type covering one day.</summary>
        private async Task SeedApprovedLeaveAsync(int employeeId, string leaveType, DateOnly date)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            db.EmployeeRequests.Add(new EmployeeRequest
            {
                EmployeeId = employeeId,
                Type = leaveType,
                RequestDate = date,
                TargetStartDate = date,
                TargetEndDate = date,
                Details = "Integration-test leave",
                Status = RequestStatus.Approved,
            });
            await db.SaveChangesAsync();
        }

        /// <summary>base ÷ 30 × <paramref name="days"/> — the pricing rule under test.</summary>
        private static decimal Expected(decimal days) =>
            Math.Round(Math.Round(Salary / 30m, 2) * days, 2);

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
