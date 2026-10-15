using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.UserModule.Enums;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Payroll page (api-spec-from-ui.md §5.5): the period directory with derived
    /// totals, the settlement sheet (bonus edit, add line, close/reopen, publish &amp;
    /// lock), the pending-deduction review queue, payslips, the CSV export, the
    /// per-employee payroll history, and the punch-audit lookup behind ATT refs.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class PayrollControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public PayrollControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        /// <summary>Gym + employee + open period (Aug 2031 unless overridden) + Draft entry.</summary>
        private async Task<(TestGym Gym, TestEmployee Employee, int PeriodId, int EntryId)> SetupSheetAsync(
            decimal baseSalary = 17600m,
            decimal bonus = 0,
            decimal overtimeHours = 0,
            DateOnly? periodStart = null)
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var start = periodStart ?? new DateOnly(2031, 8, 1);
            var periodId = await builder.CreatePayrollPeriodAsync(gym.GymId, start, start.AddMonths(1).AddDays(-1));
            var entryId = await builder.CreatePayrollEntryAsync(
                periodId, employee.EmployeeId, baseSalary, bonus, overtimeHours);
            return (gym, employee, periodId, entryId);
        }

        private async Task<JsonElement> GetJsonAsync(string url, string token)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, url, null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from {url} but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        // ------------------------------------------------------------------
        // Period directory + detail
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetPeriods_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/payroll-periods");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetPeriods_WithoutPermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/payroll-periods", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetPeriods_ReturnsDerivedTotals()
        {
            var (gym, _, periodId, _) = await SetupSheetAsync(baseSalary: 17600m, bonus: 500m, overtimeHours: 10m);
            var builder = NewBuilder();
            var employee2 = await builder.CreateEmployeeAsync(gym);
            var entry2 = await builder.CreatePayrollEntryAsync(periodId, employee2.EmployeeId, 8800m);
            await builder.AddPayrollLineAsync(entry2, 300m, status: "Approved");
            var admin = await _fixture.GetAdminTokenAsync();

            var json = await GetJsonAsync("/api/payroll-periods?pageSize=100", admin);
            var item = json.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("id").GetInt32() == periodId);

            // 17600 + 500 + OT pay (17600/176 × 1.5 × 10 = 1500) + employee2's 8800.
            Assert.Equal("August 2031", item.GetProperty("period").GetString());
            Assert.Equal("Open", item.GetProperty("status").GetString());
            Assert.False(item.GetProperty("locked").GetBoolean());
            Assert.Equal(0, item.GetProperty("publishedGyms").GetArrayLength());
            Assert.Equal(2, item.GetProperty("totalEmployees").GetInt32());
            Assert.Equal(28400m, item.GetProperty("totalGross").GetDecimal());
            Assert.Equal(300m, item.GetProperty("totalDeductions").GetDecimal());
            Assert.Equal(28100m, item.GetProperty("totalNet").GetDecimal());
        }

        [Fact]
        public async Task GetPeriodStatusFilter_MatchesDerivedStatus()
        {
            var (_, _, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var open = await GetJsonAsync("/api/payroll-periods?status=Open&pageSize=100", admin);
            Assert.Contains(
                open.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == periodId);

            var paid = await GetJsonAsync("/api/payroll-periods?status=Paid&pageSize=100", admin);
            Assert.DoesNotContain(
                paid.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == periodId);
        }

        [Fact]
        public async Task GetPeriodDetail_ReturnsEntryRowsWithLines()
        {
            var (gym, employee, periodId, entryId) = await SetupSheetAsync(baseSalary: 17600m, bonus: 500m, overtimeHours: 10m);
            var builder = NewBuilder();
            var recordId = await builder.CreateAttendanceRecordAsync(
                employee.EmployeeId, gym.GymId, new DateOnly(2031, 8, 15),
                checkInUtc: DateTime.UtcNow.AddHours(-9), checkOutUtc: DateTime.UtcNow.AddHours(-1));
            var requestId = await builder.CreateApprovedDayOffAsync(employee.EmployeeId,
                new DateOnly(2031, 8, 20), new DateOnly(2031, 8, 20));
            await builder.AddPayrollLineAsync(entryId, 300m, status: "Approved", reason: "Uniform damaged",
                attendanceRecordId: recordId, requestRef: requestId);
            await builder.AddPayrollLineAsync(entryId, 120m, status: "Pending", source: "biometric");
            var admin = await _fixture.GetAdminTokenAsync();

            var json = await GetJsonAsync($"/api/payroll-periods/{periodId}", admin);
            var data = json.GetProperty("data");
            Assert.Equal(periodId, data.GetProperty("id").GetInt32());
            Assert.Equal("August 2031", data.GetProperty("period").GetString());
            Assert.Equal(1, data.GetProperty("totalEmployees").GetInt32());

            var row = data.GetProperty("items").EnumerateArray().Single();
            Assert.Equal(employee.EmployeeId, row.GetProperty("employeeId").GetInt32());
            Assert.Equal(employee.FullName, row.GetProperty("name").GetString());
            Assert.Equal(2, row.GetProperty("initials").GetString()!.Length); // first + last name parts
            Assert.Equal(gym.Name, row.GetProperty("gym").GetString());
            Assert.Equal("IT Tester", row.GetProperty("position").GetString());
            Assert.Equal("Active", row.GetProperty("employmentStatus").GetString());
            Assert.Equal(26, row.GetProperty("days").GetInt32());
            Assert.Equal(10m, row.GetProperty("overtime").GetDecimal());
            Assert.Equal(17600m, row.GetProperty("baseSalary").GetDecimal());
            Assert.Equal(500m, row.GetProperty("bonus").GetDecimal());
            Assert.Equal(19600m, row.GetProperty("gross").GetDecimal());
            Assert.Equal(300m, row.GetProperty("deductions").GetDecimal()); // pending excluded
            Assert.Equal(19300m, row.GetProperty("net").GetDecimal());
            Assert.Equal("Draft", row.GetProperty("status").GetString());
            Assert.False(row.GetProperty("reviewed").GetBoolean());

            var relatedIds = row.GetProperty("relatedRequestIds").EnumerateArray()
                .Select(r => r.GetInt32()).ToArray();
            Assert.Contains(requestId, relatedIds);

            var lines = row.GetProperty("deductionLines").EnumerateArray().ToList();
            Assert.Equal(2, lines.Count);
            var biometricLine = lines.Single(l => l.GetProperty("source").GetString() == "biometric");
            Assert.Equal("Pending", biometricLine.GetProperty("status").GetString());
            Assert.Equal("ATT-MANUAL", biometricLine.GetProperty("attendanceRef").GetString());
            var managerLine = lines.Single(l => l.GetProperty("source").GetString() == "manager");
            Assert.Equal($"ATT-{recordId}", managerLine.GetProperty("attendanceRef").GetString());
            Assert.Equal(requestId, managerLine.GetProperty("requestId").GetInt32());
        }

        // ------------------------------------------------------------------
        // Settlement actions
        // ------------------------------------------------------------------

        [Fact]
        public async Task UpdateBonus_RecomputesTotals()
        {
            var (_, employee, periodId, entryId) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var builder = NewBuilder();
            await builder.AddPayrollLineAsync(entryId, 200m, status: "Accepted");

            var request = _fixture.AuthorizedRequest(HttpMethod.Put,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}", new { bonus = 1000m }, admin);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal(employee.EmployeeId, data.GetProperty("employeeId").GetInt32());
            Assert.Equal(1000m, data.GetProperty("bonus").GetDecimal());
            Assert.Equal(18600m, data.GetProperty("gross").GetDecimal());
            Assert.Equal(200m, data.GetProperty("deductions").GetDecimal());
            Assert.Equal(18400m, data.GetProperty("net").GetDecimal());
        }

        [Fact]
        public async Task UpdateBonus_UnknownEntry_Returns404()
        {
            var (gym, _, periodId, _) = await SetupSheetAsync();
            var stranger = await NewBuilder().CreateEmployeeAsync(gym);
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Put,
                $"/api/payroll-periods/{periodId}/entries/{stranger.EmployeeId}", new { bonus = 10m }, admin);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task UpdateBonus_LockedPeriod_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var periodId = await builder.CreatePayrollPeriodAsync(
                gym.GymId, new DateOnly(2031, 2, 1), new DateOnly(2031, 2, 28),
                DomainLayer.Models.PayrollModule.Enums.PayrollPeriodStatus.Locked);
            await builder.CreatePayrollEntryAsync(periodId, employee.EmployeeId, 10000m);
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Put,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}", new { bonus = 10m }, admin);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains("locked", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task AddDeduction_CreatesPendingLine_WithoutTouchingApprovedTotal()
        {
            var (_, employee, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/deductions",
                new { source = "manager", reason = "Uniform damaged", amount = 150m }, admin);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);

            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.True(data.GetProperty("id").GetInt32() > 0);
            Assert.Equal("Pending", data.GetProperty("status").GetString());
            Assert.Equal("manager", data.GetProperty("source").GetString());
            Assert.Equal(150m, data.GetProperty("amount").GetDecimal());

            var entry = data.GetProperty("entry");
            Assert.Equal(17600m, entry.GetProperty("gross").GetDecimal());
            Assert.Equal(0m, entry.GetProperty("deductions").GetDecimal()); // pending not deducted yet
            Assert.Equal(17600m, entry.GetProperty("net").GetDecimal());
            Assert.Equal(1, entry.GetProperty("pendingCount").GetInt32());
        }

        [Fact]
        public async Task AddDeduction_InvalidPayload_Returns400()
        {
            var (_, employee, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var badSource = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/deductions",
                new { source = "kiosk", reason = "Nope", amount = 10m }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, (await _fixture.Client.SendAsync(badSource)).StatusCode);

            var badAmount = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/deductions",
                new { source = "manager", reason = "Nope", amount = 0m }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, (await _fixture.Client.SendAsync(badAmount)).StatusCode);

            var missingReason = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/deductions",
                new { source = "manager", amount = 5m }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, (await _fixture.Client.SendAsync(missingReason)).StatusCode);
        }

        [Fact]
        public async Task CloseEntry_WithPendingLines_Returns400()
        {
            var (_, employee, periodId, entryId) = await SetupSheetAsync();
            var builder = NewBuilder();
            await builder.AddPayrollLineAsync(entryId, 50m, status: "Pending");
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/close", null, admin);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CloseAndReopen_RoundTrip()
        {
            var (_, employee, periodId, entryId) = await SetupSheetAsync();
            var builder = NewBuilder();
            await builder.AddPayrollLineAsync(entryId, 400m, status: "Approved");
            var admin = await _fixture.GetAdminTokenAsync();

            var closeRequest = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/close", null, admin);
            var closeResponse = await _fixture.Client.SendAsync(closeRequest);
            Assert.Equal(HttpStatusCode.OK, closeResponse.StatusCode);

            var closed = (await closeResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal("Reviewed", closed.GetProperty("status").GetString());
            Assert.True(closed.GetProperty("reviewed").GetBoolean());
            Assert.NotEqual(JsonValueKind.Null, closed.GetProperty("reviewedAt").ValueKind);
            Assert.Equal(17600m, closed.GetProperty("gross").GetDecimal());
            Assert.Equal(400m, closed.GetProperty("deductions").GetDecimal());
            Assert.Equal(17200m, closed.GetProperty("net").GetDecimal());

            var reopenRequest = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/reopen", null, admin);
            var reopenResponse = await _fixture.Client.SendAsync(reopenRequest);
            Assert.Equal(HttpStatusCode.OK, reopenResponse.StatusCode);

            var reopened = (await reopenResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal("Draft", reopened.GetProperty("status").GetString());
            Assert.False(reopened.GetProperty("reviewed").GetBoolean());
        }

        [Fact]
        public async Task Approve_WithDraftEntry_Returns400()
        {
            var (gym, _, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/approve", new { gym = gym.Name }, admin);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Approve_WrongGym_Returns400()
        {
            var (_, employee, periodId, entryId) = await SetupSheetAsync();
            var otherGym = await NewBuilder().CreateGymWithStationAsync();
            var builder = NewBuilder();
            await builder.AddPayrollLineAsync(entryId, 100m, status: "Accepted");
            var admin = await _fixture.GetAdminTokenAsync();

            // Settle the sheet so only the branch check can fail.
            var close = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/close", null, admin);
            Assert.Equal(HttpStatusCode.OK, (await _fixture.Client.SendAsync(close)).StatusCode);

            var request = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/approve", new { gym = otherGym.Name }, admin);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains("different branch", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Approve_PublishesAndLocks_ThenRefusesSecondPublish()
        {
            var (gym, employee, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var close = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/close", null, admin);
            Assert.Equal(HttpStatusCode.OK, (await _fixture.Client.SendAsync(close)).StatusCode);

            var request = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/approve", new { gym = gym.Name }, admin);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal(periodId, data.GetProperty("id").GetInt32());
            Assert.Equal("Published", data.GetProperty("status").GetString());
            Assert.True(data.GetProperty("locked").GetBoolean());
            Assert.Equal(new[] { gym.Name },
                data.GetProperty("publishedGyms").EnumerateArray().Select(g => g.GetString()).ToArray());

            // The sheet is Locked now and the period is closed for business.
            var detail = await GetJsonAsync($"/api/payroll-periods/{periodId}", admin);
            Assert.Equal("Published", detail.GetProperty("data").GetProperty("status").GetString());
            Assert.True(detail.GetProperty("data").GetProperty("locked").GetBoolean());
            Assert.Equal("Locked", detail.GetProperty("data").GetProperty("items").EnumerateArray().First()
                .GetProperty("status").GetString());

            var again = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/approve", new { gym = gym.Name }, admin);
            Assert.Equal(HttpStatusCode.BadRequest, (await _fixture.Client.SendAsync(again)).StatusCode);
        }

        [Fact]
        public async Task Approve_WithoutPermission_Returns401()
        {
            var (gym, _, periodId, _) = await SetupSheetAsync();
            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/approve", new { gym = gym.Name }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // Deduction candidates
        // ------------------------------------------------------------------

        [Fact]
        public async Task DeductionCandidates_ListsPendingLines()
        {
            var (gym, employee, periodId, _) = await SetupSheetAsync(
                periodStart: new DateOnly(2031, 1, 1)); // unique month for the label filter
            var admin = await _fixture.GetAdminTokenAsync();

            var create = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/deductions",
                new { source = "biometric", reason = "Missed punch", amount = 90m }, admin);
            Assert.Equal(HttpStatusCode.Created, (await _fixture.Client.SendAsync(create)).StatusCode);

            var byGym = await GetJsonAsync($"/api/deduction-candidates?gym={gym.GymId}&status=Pending", admin);
            var item = byGym.GetProperty("items").EnumerateArray().Single();
            Assert.True(item.GetProperty("id").GetInt32() > 0);
            Assert.Equal(employee.EmployeeId, item.GetProperty("employeeId").GetInt32());
            Assert.Equal(employee.FullName, item.GetProperty("employeeName").GetString());
            Assert.Equal(gym.Name, item.GetProperty("gym").GetString());
            Assert.Equal("January 2031", item.GetProperty("period").GetString());
            Assert.Equal("Missed punch", item.GetProperty("reason").GetString());
            Assert.Equal("biometric", item.GetProperty("source").GetString());
            Assert.Equal(90m, item.GetProperty("amount").GetDecimal());
            Assert.Equal("Pending", item.GetProperty("status").GetString());
            Assert.Equal("ATT-MANUAL", item.GetProperty("attendanceRef").GetString());

            // Label filter resolves to the same row; an unknown label returns nothing.
            var byLabel = await GetJsonAsync("/api/deduction-candidates?period=January%202031&status=Pending", admin);
            Assert.Contains(byLabel.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("employeeId").GetInt32() == employee.EmployeeId);

            var byUnknownLabel = await GetJsonAsync("/api/deduction-candidates?period=Nowhere%20Month", admin);
            Assert.Equal(0, byUnknownLabel.GetProperty("total").GetInt32());
        }

        [Fact]
        public async Task DeductionCandidates_WithoutPermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/deduction-candidates", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task ReviewDeduction_Accepted_RecomputesEntry()
        {
            var (_, employee, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var create = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/deductions",
                new { source = "manager", reason = "Late arrival fine", amount = 200m }, admin);
            var lineId = (await (await _fixture.Client.SendAsync(create))
                .Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("id").GetInt32();

            var review = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/deduction-candidates/{lineId}/review", new { decision = "Accepted" }, admin);
            var response = await _fixture.Client.SendAsync(review);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal(lineId, data.GetProperty("id").GetInt32());
            Assert.Equal("Accepted", data.GetProperty("status").GetString());
            Assert.Equal(200m, data.GetProperty("amount").GetDecimal());

            var entry = data.GetProperty("entry");
            Assert.Equal(employee.EmployeeId, entry.GetProperty("employeeId").GetInt32());
            Assert.Equal(17600m, entry.GetProperty("gross").GetDecimal());
            Assert.Equal(200m, entry.GetProperty("deductions").GetDecimal());
            Assert.Equal(17400m, entry.GetProperty("net").GetDecimal());
            Assert.Equal(0, entry.GetProperty("pendingCount").GetInt32());

            // Out of the pending queue.
            var queue = await GetJsonAsync("/api/deduction-candidates?status=Pending", admin);
            Assert.DoesNotContain(queue.GetProperty("items").EnumerateArray(),
                i => i.GetProperty("id").GetInt32() == lineId);
        }

        [Fact]
        public async Task ReviewDeduction_Rejected_LeavesDeductionsUnchanged()
        {
            var (_, employee, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var create = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/deductions",
                new { source = "manager", reason = "Waived this time", amount = 75m }, admin);
            var lineId = (await (await _fixture.Client.SendAsync(create))
                .Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("id").GetInt32();

            var review = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/deduction-candidates/{lineId}/review", new { decision = "Rejected" }, admin);
            var response = await _fixture.Client.SendAsync(review);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            Assert.Equal("Rejected", data.GetProperty("status").GetString());
            Assert.Equal(0m, data.GetProperty("entry").GetProperty("deductions").GetDecimal());
            Assert.Equal(17600m, data.GetProperty("entry").GetProperty("net").GetDecimal());
        }

        [Fact]
        public async Task ReviewDeduction_InvalidDecision_Returns400()
        {
            var (_, employee, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var create = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/payroll-periods/{periodId}/entries/{employee.EmployeeId}/deductions",
                new { source = "manager", reason = "Check", amount = 10m }, admin);
            var lineId = (await (await _fixture.Client.SendAsync(create))
                .Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("id").GetInt32();

            var review = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/deduction-candidates/{lineId}/review", new { decision = "Maybe" }, admin);
            var response = await _fixture.Client.SendAsync(review);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // Payslip, export, history, punch audit
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetPayslip_ReturnsPreview()
        {
            var (gym, employee, periodId, entryId) = await SetupSheetAsync(baseSalary: 17600m, bonus: 500m, overtimeHours: 10m);
            var builder = NewBuilder();
            await builder.AddPayrollLineAsync(entryId, 300m, status: "Approved", reason: "Uniform");
            await builder.AddPayrollLineAsync(entryId, 120m, status: "Pending", reason: "Pending thing");
            var admin = await _fixture.GetAdminTokenAsync();

            var json = await GetJsonAsync($"/api/payroll-periods/{periodId}/payslips/{employee.EmployeeId}", admin);
            var data = json.GetProperty("data");

            Assert.Equal("August 2031", data.GetProperty("period").GetString());
            Assert.Equal(gym.Name, data.GetProperty("gym").GetString());
            Assert.Equal(employee.EmployeeId, data.GetProperty("employee").GetProperty("employeeId").GetInt32());
            Assert.Equal(employee.FullName, data.GetProperty("employee").GetProperty("name").GetString());
            Assert.Equal("IT Tester", data.GetProperty("employee").GetProperty("position").GetString());
            Assert.Equal(17600m, data.GetProperty("baseSalary").GetDecimal());
            Assert.Equal(10m, data.GetProperty("overtime").GetDecimal());
            Assert.Equal(1500m, data.GetProperty("overtimePay").GetDecimal());
            Assert.Equal(500m, data.GetProperty("bonus").GetDecimal());
            Assert.Equal(19600m, data.GetProperty("gross").GetDecimal());
            Assert.Equal(2, data.GetProperty("deductions").GetArrayLength()); // all lines listed
            Assert.Equal(19300m, data.GetProperty("net").GetDecimal());       // only approved deducted
            Assert.Equal(26, data.GetProperty("days").GetInt32());
            Assert.Equal("Draft", data.GetProperty("status").GetString());
        }

        [Fact]
        public async Task Export_ReturnsCsvStream()
        {
            var (_, employee, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get,
                $"/api/payroll-periods/{periodId}/export?format=csv", null, admin);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);

            var csv = await response.Content.ReadAsStringAsync();
            Assert.StartsWith("Employee,Employee ID,Position,Base Salary,OT Hours,OT Pay,Bonus,Gross,Deductions,Net,Status", csv);
            Assert.Contains($"\"{employee.FullName}\"", csv);

            var fileName = response.Content.Headers.ContentDisposition?.FileName ?? string.Empty;
            Assert.Contains("august-2031", fileName);
        }

        [Fact]
        public async Task Export_PdfFormat_Returns400()
        {
            var (_, _, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get,
                $"/api/payroll-periods/{periodId}/export?format=pdf", null, admin);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Export_WithoutPermission_Returns401()
        {
            var (gym, _, periodId, _) = await SetupSheetAsync();
            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get,
                $"/api/payroll-periods/{periodId}/export?format=csv", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task EmployeePayroll_ListsHistoryWithPeriodLabel()
        {
            var (_, employee, periodId, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();

            var json = await GetJsonAsync($"/api/employees/{employee.EmployeeId}/payroll", admin);
            var item = json.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("period").GetString() == "August 2031");
            Assert.Equal(17600m, item.GetProperty("baseSalary").GetDecimal());
            Assert.Equal("IT Tester", item.GetProperty("position").GetString());
        }

        [Fact]
        public async Task EmployeePayroll_WithoutPermission_Returns401()
        {
            var (gym, employee, _, _) = await SetupSheetAsync();
            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get,
                $"/api/employees/{employee.EmployeeId}/payroll", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task AttendanceRef_ReturnsPunchAudit()
        {
            var (gym, employee, _, _) = await SetupSheetAsync();
            var builder = NewBuilder();
            var recordId = await builder.CreateAttendanceRecordAsync(
                employee.EmployeeId, gym.GymId, new DateOnly(2031, 8, 15),
                checkInUtc: new DateTime(2031, 8, 15, 7, 5, 0, DateTimeKind.Utc),
                checkOutUtc: new DateTime(2031, 8, 15, 15, 10, 0, DateTimeKind.Utc));
            var admin = await _fixture.GetAdminTokenAsync();

            var json = await GetJsonAsync($"/api/attendance/ATT-{recordId}", admin);
            var data = json.GetProperty("data");
            Assert.Equal($"ATT-{recordId}", data.GetProperty("id").GetString());
            Assert.Equal("2031-08-15", data.GetProperty("date").GetString());
            Assert.NotNull(data.GetProperty("firstIn").GetString());
            Assert.NotNull(data.GetProperty("lastOut").GetString());
            Assert.Equal("Biometric", data.GetProperty("device").GetString());
            Assert.Equal("On Time", data.GetProperty("exception").GetString());

            // Bare record ids resolve too.
            var bare = await GetJsonAsync($"/api/attendance/{recordId}", admin);
            Assert.Equal($"ATT-{recordId}", bare.GetProperty("data").GetProperty("id").GetString());
        }

        [Fact]
        public async Task AttendanceRef_UnknownOrMissingPermission_Fails()
        {
            var (gym, _, _, _) = await SetupSheetAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var builder = NewBuilder();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var missing = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/attendance/ATT-99999999", null, admin);
            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(missing)).StatusCode);

            var noPermission = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/attendance/ATT-1", null, token);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _fixture.Client.SendAsync(noPermission)).StatusCode);
        }

        [Fact]
        public async Task RequestsIdsFilter_ReturnsOnlyLinkedRows()
        {
            var (_, employee, _, _) = await SetupSheetAsync();
            var builder = NewBuilder();
            var first = await builder.CreateApprovedDayOffAsync(employee.EmployeeId,
                new DateOnly(2031, 3, 1), new DateOnly(2031, 3, 1));
            var second = await builder.CreateApprovedDayOffAsync(employee.EmployeeId,
                new DateOnly(2031, 3, 5), new DateOnly(2031, 3, 5));
            var admin = await _fixture.GetAdminTokenAsync();

            var json = await GetJsonAsync($"/api/requests?ids={first}", admin);
            var ids = json.GetProperty("items").EnumerateArray()
                .Select(i => i.GetProperty("id").GetInt32()).ToArray();
            Assert.Equal(new[] { first }, ids);
            Assert.Equal(1, json.GetProperty("total").GetInt32());

            var both = await GetJsonAsync($"/api/requests?ids={first},{second}", admin);
            var bothIds = both.GetProperty("items").EnumerateArray()
                .Select(i => i.GetProperty("id").GetInt32()).ToArray();
            Assert.Contains(first, bothIds);
            Assert.Contains(second, bothIds);
        }
    }
}
