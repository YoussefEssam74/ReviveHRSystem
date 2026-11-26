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
    /// The attendance → deduction bridge behind Employees Performance → Deductions.
    /// The sweep flags a punished day but never invents a size: the branch manager
    /// chooses hours or days, and the money follows the month's rates (daily = base ÷
    /// calendar days, hourly = base ÷ assigned hours). A reading twice never doubles a
    /// day up, a day that no longer justifies the deduction takes the auto row with it,
    /// a rejected day is final, and an hours-based size stays unpriced until the
    /// month's roster is complete.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class AttendanceDeductionSweepTests
    {
        private const decimal Salary = 7800m;

        private readonly ApiTestFixture _fixture;

        public AttendanceDeductionSweepTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        [Fact]
        public async Task DerivedAbsence_IsFlaggedForTheManager_ThenPricedFromTheDaysHeChooses()
        {
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) = await SceneAsync(builder);

            var first = await BranchDeductionsAsync(token, employeeId);
            var row = Assert.Single(first);

            Assert.Equal("Unapproved absence", row.GetProperty("reason").GetString());
            Assert.Equal("Pending", row.GetProperty("status").GetString());
            // No size yet: the day is flagged, the manager prices it.
            Assert.Equal(0m, row.GetProperty("amount").GetDecimal());
            Assert.Equal(0m, row.GetProperty("deductionValue").GetDecimal());
            Assert.Contains("Awaiting the branch manager", row.GetProperty("note").GetString(), StringComparison.Ordinal);
            // The day it punishes rides along, so payroll close and the tab agree
            // on which day the money belongs to.
            Assert.Equal(target.ToString("yyyy-MM-dd"), row.GetProperty("date").GetString());
            Assert.StartsWith($"auto-absence:{target:yyyy-MM-dd}", row.GetProperty("note").GetString());

            // Idempotent: a second read of the same tab never raises the day twice.
            var second = await BranchDeductionsAsync(token, employeeId);
            var again = Assert.Single(second);
            Assert.Equal(row.GetProperty("id").GetInt32(), again.GetProperty("id").GetInt32());

            // The manager sizes it in days and approves: base ÷ the month's calendar
            // days × the days he chose.
            var sized = await BranchReviewAsync(token, row.GetProperty("id").GetInt32(), "approve", "days", 3m);
            Assert.Equal("BranchApproved", sized.GetProperty("status").GetString());
            Assert.Equal(3m, sized.GetProperty("deductionValue").GetDecimal());
            Assert.Equal("Days", sized.GetProperty("deductionUnit").GetString());
            Assert.Equal(ExpectedDays(3m, target), sized.GetProperty("amount").GetDecimal());
            Assert.Equal(3m, sized.GetProperty("deductionDays").GetDecimal());
        }

        [Fact]
        public async Task LateRecord_IsSizedInHours_AndPricedFromTheHourlyRate()
        {
            var builder = NewBuilder();
            var (token, employeeId, target, monthStart, monthEnd) =
                await SceneAsync(builder, fullDayTargetShift: true);
            // The hourly rate only exists once the whole month is rostered (8 h a day).
            await RosterWholeMonthAsync(
                employeeId, await GymIdOf(employeeId), monthStart, monthEnd, target, builder.AttendanceToday);
            await builder.CreateAttendanceRecordAsync(
                employeeId, await GymIdOf(employeeId), target,
                status: AttendanceStatus.Late);

            var row = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal("Late arrival", row.GetProperty("reason").GetString());
            Assert.Equal(0m, row.GetProperty("amount").GetDecimal());
            Assert.True(row.GetProperty("hourlyRateReady").GetBoolean());

            // Two hours of pay at base ÷ the month's assigned hours.
            var sized = await BranchReviewAsync(token, row.GetProperty("id").GetInt32(), "approve", "hours", 2m);
            Assert.Equal("Hours", sized.GetProperty("deductionUnit").GetString());
            Assert.Equal(ExpectedHours(2m, monthStart, monthEnd), sized.GetProperty("amount").GetDecimal());
            // The days column still reconciles: hours ÷ the day they represent.
            Assert.True(sized.GetProperty("deductionDays").GetDecimal() > 0);
        }

        [Fact]
        public async Task HoursSize_StaysUnpriced_UntilTheRosterIsComplete()
        {
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) = await SceneAsync(builder);
            await builder.CreateAttendanceRecordAsync(
                employeeId, await GymIdOf(employeeId), target, status: AttendanceStatus.Late);

            var row = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.False(row.GetProperty("hourlyRateReady").GetBoolean());

            // The manager sized it in hours, but the month is not rostered: the size is
            // kept, the money waits (and fills in by itself once the roster is done).
            var sized = await BranchReviewAsync(token, row.GetProperty("id").GetInt32(), "approve", "hours", 2m);
            Assert.Equal("BranchApproved", sized.GetProperty("status").GetString());
            Assert.Equal(2m, sized.GetProperty("deductionValue").GetDecimal());
            Assert.Equal(0m, sized.GetProperty("amount").GetDecimal());
            Assert.Contains("roster", sized.GetProperty("note").GetString(), StringComparison.OrdinalIgnoreCase);
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
            Assert.Equal(0m, after.GetProperty("amount").GetDecimal());

            // The next sweep of the same day adds nothing.
            var third = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal(candidateId, third.GetProperty("id").GetInt32());
        }

        [Fact]
        public async Task SalaryHistory_IsThePricingSource_WhenNoSheetCoversTheMonth()
        {
            // The usual mid-month state: HR has recorded a salary but no payroll
            // sheet exists yet. The salary history is the pricing source, so a size
            // the manager picks still turns into real money.
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) =
                await SceneAsync(builder, withSheet: false);
            await SeedCompensationAsync(employeeId, Salary, target.AddDays(-30));

            var row = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            var sized = await BranchReviewAsync(token, row.GetProperty("id").GetInt32(), "approve", "days", 1m);

            Assert.Equal(ExpectedDays(1m, target), sized.GetProperty("amount").GetDecimal());
            Assert.DoesNotContain("No salary on file", sized.GetProperty("note").GetString(), StringComparison.Ordinal);
        }

        [Fact]
        public async Task NoSalaryOnFile_SaysSoWhenTheManagerTriesToPriceIt()
        {
            var builder = NewBuilder();
            var (token, employeeId, _, _, _) = await SceneAsync(builder, withSheet: false);

            // No sheet and no salary history: nothing to charge yet — a size the manager
            // picks stays at 0 and the row says what is missing.
            var row = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            var sized = await BranchReviewAsync(token, row.GetProperty("id").GetInt32(), "approve", "days", 1m);

            Assert.Equal(0m, sized.GetProperty("amount").GetDecimal());
            Assert.Contains("No salary on file", sized.GetProperty("note").GetString(), StringComparison.Ordinal);
        }

        [Fact]
        public async Task SalaryRecordedLater_PricesTheAlreadySizedRow()
        {
            // The row is raised before anyone records a salary: it stands at 0. Once HR
            // records a salary, the same row prices itself — no duplicate, no manual entry.
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) =
                await SceneAsync(builder, withSheet: false);

            var before = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal(0m, before.GetProperty("amount").GetDecimal());
            await BranchReviewAsync(token, before.GetProperty("id").GetInt32(), "approve", "days", 1m);

            await SeedCompensationAsync(employeeId, Salary, target.AddDays(-30));

            var after = Assert.Single(await BranchDeductionsAsync(token, employeeId));
            Assert.Equal(before.GetProperty("id").GetInt32(), after.GetProperty("id").GetInt32());
            Assert.Equal(ExpectedDays(1m, target), after.GetProperty("amount").GetDecimal());
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
            TestDataBuilder builder, bool withSheet = true, bool fullDayTargetShift = false)
        {
            var gym = await builder.CreateGymWithStationAsync();
            var manager = await builder.CreateUserAsync(UserType.TopManagement, new[] { gym });
            await GrantGymRoleAsync(manager.UserId, gym.GymId, "Branch Manager");

            var employee = await builder.CreateEmployeeAsync(gym);

            var today = builder.AttendanceToday;
            var target = today.Day > 1 ? today.AddDays(-1) : today;
            // The shift only has to exist for the day; a 00:00–00:01 end keeps the
            // "every shift has ended" guard true even when the day is today. Tests that
            // need a real 8-hour day ask for it, so the month's hours add up evenly.
            await builder.AssignShiftAsync(
                employee.EmployeeId, gym.GymId, target, fullDayTargetShift ? "IT Full Month" : "IT Morning",
                fullDayTargetShift ? new TimeOnly(8, 0) : new TimeOnly(0, 0),
                fullDayTargetShift ? new TimeOnly(16, 0) : new TimeOnly(0, 1));

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

        [Fact]
        public async Task Preview_HoursSize_StaysUnpriced_UntilTheRosterIsComplete()
        {
            // The follow-up form's live preview must agree with the saved row: an
            // hours-based size has no money until every day of the month is rostered.
            var builder = NewBuilder();
            var (token, employeeId, target, _, _) = await SceneAsync(builder);

            var withoutRoster = await PreviewAsync(token, employeeId, target, "hours", 1m);
            Assert.False(withoutRoster.GetProperty("hourlyRateReady").GetBoolean());
            Assert.Equal(0m, withoutRoster.GetProperty("amount").GetDecimal());
            Assert.Contains("roster", withoutRoster.GetProperty("pendingReason").GetString(), StringComparison.OrdinalIgnoreCase);

            // A day-based size needs no roster: base ÷ that month's calendar days.
            var days = await PreviewAsync(token, employeeId, target, "days", 1m);
            Assert.Equal(ExpectedDays(1m, target), days.GetProperty("amount").GetDecimal());
        }

        [Fact]
        public async Task Preview_WithAFullRoster_PricesTheHours()
        {
            var builder = NewBuilder();
            var (token, employeeId, target, monthStart, monthEnd) =
                await SceneAsync(builder, fullDayTargetShift: true);
            await RosterWholeMonthAsync(
                employeeId, await GymIdOf(employeeId), monthStart, monthEnd, target, builder.AttendanceToday);

            var preview = await PreviewAsync(token, employeeId, target, "hours", 2m);

            Assert.True(preview.GetProperty("hourlyRateReady").GetBoolean());
            Assert.Equal(ExpectedHours(2m, monthStart, monthEnd), preview.GetProperty("amount").GetDecimal());
            Assert.Equal(JsonValueKind.Null, preview.GetProperty("pendingReason").ValueKind);        }

        /// <summary>The live pricing preview the follow-up form uses (no candidate exists yet).</summary>
        private async Task<JsonElement> PreviewAsync(
            string token, int employeeId, DateOnly date, string unit, decimal value)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get,
                $"/api/deduction-candidates/preview?employeeId={employeeId}&date={date:yyyy-MM-dd}&unit={unit}&value={value}",
                null,
                token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from the deduction preview but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        /// <summary>Sizes and reviews one deduction through the branch endpoint.</summary>
        private async Task<JsonElement> BranchReviewAsync(
            string token, int candidateId, string decision, string unit, decimal value)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/deduction-candidates/{candidateId}/branch-review",
                new { decision, unit, value }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from the branch review but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        /// <summary>
        /// Rosters every day of the month with an 8-hour shift (so the hourly rate exists)
        /// and punches the elapsed days off as worked — only the punished day stays open.
        /// </summary>
        private async Task RosterWholeMonthAsync(
            int employeeId, int gymId, DateOnly monthStart, DateOnly monthEnd, DateOnly target, DateOnly today)
        {
            var builder = NewBuilder();
            for (var date = monthStart; date <= monthEnd; date = date.AddDays(1))
            {
                // The punished day already carries its own 8-hour shift from the scene.
                if (date != target)
                {
                    await builder.AssignShiftAsync(
                        employeeId, gymId, date, "IT Full Month", new TimeOnly(8, 0), new TimeOnly(16, 0));
                }

                if (date != target && date <= today)
                {
                    // Worked, on time: an elapsed rostered day with no punch would be an absence.
                    await builder.CreateAttendanceRecordAsync(
                        employeeId, gymId, date,
                        checkInUtc: LocalAt(date, new TimeOnly(8, 0)),
                        checkOutUtc: LocalAt(date, new TimeOnly(16, 0)));
                }
            }
        }

        private DateTime LocalAt(DateOnly date, TimeOnly time)
        {
            using var scope = _fixture.Services.CreateScope();
            var tz = scope.ServiceProvider.GetRequiredService<TimeZoneInfo>();
            return TimeZoneInfo.ConvertTimeToUtc(
                DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified), tz);
        }

        /// <summary>base ÷ the punished month's calendar days × <paramref name="days"/>.</summary>
        private static decimal ExpectedDays(decimal days, DateOnly date) =>
            Math.Round(Math.Round(Salary / DateTime.DaysInMonth(date.Year, date.Month), 2) * days, 2);

        /// <summary>hours × (base ÷ the month's assigned hours, 8 h a day).</summary>
        private static decimal ExpectedHours(decimal hours, DateOnly monthStart, DateOnly monthEnd)
        {
            var days = monthEnd.DayNumber - monthStart.DayNumber + 1;
            var assignedHours = days * 8m;
            return Math.Round(hours * Math.Round(Salary / assignedHours, 2), 2);
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
            db.UserRoles.Add(new DomainLayer.Models.UserModule.UserRole
            {
                UserId = userId,
                GymId = gymId,
                RoleName = roleName,
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
