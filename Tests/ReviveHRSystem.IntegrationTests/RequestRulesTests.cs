using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.EmployeeModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// The 9-type employee request catalog and its submission rules: annual/sick leave
    /// balance limits, the sick-leave medical certificate, the shared monthly excused-hours
    /// budget of late attendance / early leave, colleague validation for the swaps, the
    /// salary-advance amount, the attachment stream and the HR-set gym attendance policy.
    /// Every test builds its own employee (and schedule where needed) so the shared
    /// database never leaks state between cases.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class RequestRulesTests
    {
        private readonly ApiTestFixture _fixture;

        public RequestRulesTests(ApiTestFixture fixture) => _fixture = fixture;

        // ---------- leave balances ----------

        [Fact]
        public async Task AnnualLeave_WithinRemainingBalance_ReservesDays()
        {
            var employee = await CreateSelfServiceEmployeeAsync("annual-ok@revive.hr");
            await SeedLeaveBalanceAsync(employee.EmployeeId, LeaveType.Annual, total: 5, used: 1, pending: 1);

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "annual-leave",
                ["requestDate"] = Iso(Today.AddDays(3)),
                ["endDate"] = Iso(Today.AddDays(4)),
                ["reason"] = "Trip"
            });

            Assert.Equal(HttpStatusCode.Created, created.Status);
            var body = await created.ReadAsync();
            Assert.Equal("Annual Leave", body.GetProperty("type").GetString());
            Assert.Equal(Iso(Today.AddDays(3)), body.GetProperty("requestDate").GetString());
            Assert.Equal(Iso(Today.AddDays(4)), body.GetProperty("endDate").GetString());

            var pending = await PendingDaysAsync(employee.EmployeeId, LeaveType.Annual);
            Assert.Equal(3m, pending);
        }

        [Fact]
        public async Task AnnualLeave_ExceedingRemainingBalance_Returns400()
        {
            var employee = await CreateSelfServiceEmployeeAsync("annual-over@revive.hr");
            await SeedLeaveBalanceAsync(employee.EmployeeId, LeaveType.Annual, total: 2, used: 0, pending: 0);

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "annual-leave",
                ["requestDate"] = Iso(Today.AddDays(3)),
                ["endDate"] = Iso(Today.AddDays(5)),
                ["reason"] = "Long trip"
            });

            Assert.Equal(HttpStatusCode.BadRequest, created.Status);

            // Nothing was reserved by the refused submission.
            var pending = await PendingDaysAsync(employee.EmployeeId, LeaveType.Annual);
            Assert.Equal(0m, pending);
        }

        [Fact]
        public async Task AnnualLeave_NoBalanceRow_DefaultsTo21Days()
        {
            var employee = await CreateSelfServiceEmployeeAsync("annual-default@revive.hr");

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "annual-leave",
                ["requestDate"] = Iso(Today.AddDays(10)),
                ["reason"] = "Rest"
            });

            await created.EnsureSuccessAsync();
            var pending = await PendingDaysAsync(employee.EmployeeId, LeaveType.Annual);
            Assert.Equal(1m, pending);
        }

        [Fact]
        public async Task SickLeave_WithoutMedicalCertificate_Returns400()
        {
            var employee = await CreateSelfServiceEmployeeAsync("sick-nofile@revive.hr");

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "sick-leave",
                ["requestDate"] = Iso(Today),
                ["reason"] = "Flu"
            });

            Assert.Equal(HttpStatusCode.BadRequest, created.Status);
        }

        [Fact]
        public async Task SickLeave_WithCertificate_CreatesRequestAndDownloads()
        {
            var employee = await CreateSelfServiceEmployeeAsync("sick-ok@revive.hr");

            var created = await SubmitAsync(
                employee.Token, employee.EmployeeId,
                new Dictionary<string, string>
                {
                    ["type"] = "sick-leave",
                    ["requestDate"] = Iso(Today),
                    ["reason"] = "Flu"
                },
                file: (FieldName: "attachment", Content: FakePdf(), FileName: "medical-certificate.pdf"));

            await created.EnsureSuccessAsync();
            var body = await created.ReadAsync();
            Assert.True(body.GetProperty("hasAttachment").GetBoolean());
            var requestId = body.GetProperty("id").GetInt32();

            // Sick balance reserved the day (default 10-day entitlement).
            var pending = await PendingDaysAsync(employee.EmployeeId, LeaveType.Sick);
            Assert.Equal(1m, pending);

            // The requester streams his own certificate.
            var download = await _fixture.Client.SendAsync(
                Authorized(HttpMethod.Get, $"/api/requests/{requestId}/attachment", employee.Token));
            Assert.Equal(HttpStatusCode.OK, download.StatusCode);
            Assert.Equal("application/pdf", download.Content.Headers.ContentType?.MediaType);
        }

        [Fact]
        public async Task SickLeave_ExceedingBalance_Returns400()
        {
            var employee = await CreateSelfServiceEmployeeAsync("sick-over@revive.hr");
            await SeedLeaveBalanceAsync(employee.EmployeeId, LeaveType.Sick, total: 1, used: 0, pending: 0);

            var created = await SubmitAsync(
                employee.Token, employee.EmployeeId,
                new Dictionary<string, string>
                {
                    ["type"] = "sick-leave",
                    ["requestDate"] = Iso(Today),
                    ["endDate"] = Iso(Today.AddDays(2)),
                    ["reason"] = "Flu"
                },
                file: (FieldName: "attachment", Content: FakePdf(), FileName: "medical-certificate.pdf"));

            Assert.Equal(HttpStatusCode.BadRequest, created.Status);
        }

        // ---------- late attendance / early leave ----------

        [Fact]
        public async Task LateAttendance_DerivesHoursFromTheSchedule()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var employee = await CreateSelfServiceEmployeeAsync("late-ok@revive.hr");
            var incident = Today.AddDays(-1);
            await SeedScheduleAsync(employee.EmployeeId, gymId, incident, new TimeOnly(8, 0), new TimeOnly(16, 0));

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "late-attendance",
                ["requestDate"] = Iso(incident),
                ["requestTime"] = "09:30",
                ["reason"] = "Traffic"
            });

            await created.EnsureSuccessAsync();
            var body = await created.ReadAsync();
            Assert.Equal("Late Attendance", body.GetProperty("type").GetString());
            Assert.Equal(1.5m, body.GetProperty("hours").GetDecimal());
        }

        [Fact]
        public async Task LateAttendance_ExceedingMonthlyBudget_Returns400()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var employee = await CreateSelfServiceEmployeeAsync("late-over@revive.hr");
            var incident = Today.AddDays(-1);
            await SeedScheduleAsync(employee.EmployeeId, gymId, incident, new TimeOnly(8, 0), new TimeOnly(16, 0));

            // 2.5h first (granted within the 4h budget), then 2.5h more — over the cap.
            var first = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "late-attendance",
                ["requestDate"] = Iso(incident),
                ["requestTime"] = "10:30",
                ["reason"] = "Traffic"
            });
            await first.EnsureSuccessAsync();

            var second = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "late-attendance",
                ["requestDate"] = Iso(incident),
                ["requestTime"] = "11:30",
                ["reason"] = "Traffic again"
            });

            Assert.Equal(HttpStatusCode.BadRequest, second.Status);
        }

        [Fact]
        public async Task EarlyLeave_SharesTheSameMonthlyBudget()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var employee = await CreateSelfServiceEmployeeAsync("early-share@revive.hr");
            var incident = Today.AddDays(-1);
            await SeedScheduleAsync(employee.EmployeeId, gymId, incident, new TimeOnly(8, 0), new TimeOnly(16, 0));

            // Early leave of 3h, then a 2h late arrival: both draw on one 4h budget.
            var early = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "early-leave",
                ["requestDate"] = Iso(incident),
                ["requestTime"] = "13:00",
                ["reason"] = "Appointment"
            });
            await early.EnsureSuccessAsync();

            var late = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "late-attendance",
                ["requestDate"] = Iso(incident),
                ["requestTime"] = "10:30",
                ["reason"] = "Traffic"
            });

            Assert.Equal(HttpStatusCode.BadRequest, late.Status);
        }

        [Fact]
        public async Task EarlyLeave_DerivesHoursFromTheSchedule()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var employee = await CreateSelfServiceEmployeeAsync("early-ok@revive.hr");
            var incident = Today.AddDays(-1);
            await SeedScheduleAsync(employee.EmployeeId, gymId, incident, new TimeOnly(8, 0), new TimeOnly(16, 0));

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "early-leave",
                ["requestDate"] = Iso(incident),
                ["requestTime"] = "14:00",
                ["reason"] = "Appointment"
            });

            await created.EnsureSuccessAsync();
            var body = await created.ReadAsync();
            Assert.Equal("Early Leave", body.GetProperty("type").GetString());
            Assert.Equal(2m, body.GetProperty("hours").GetDecimal());
        }

        [Fact]
        public async Task LateAttendance_WithoutPublishedShift_Returns400()
        {
            var employee = await CreateSelfServiceEmployeeAsync("late-noshift@revive.hr");

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "late-attendance",
                ["requestDate"] = Iso(Today.AddDays(-2)),
                ["requestTime"] = "09:30",
                ["reason"] = "Traffic"
            });

            Assert.Equal(HttpStatusCode.BadRequest, created.Status);
        }

        [Fact]
        public async Task LateAttendance_NotLaterThanShiftStart_Returns400()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var employee = await CreateSelfServiceEmployeeAsync("late-early@revive.hr");
            var incident = Today.AddDays(-1);
            await SeedScheduleAsync(employee.EmployeeId, gymId, incident, new TimeOnly(8, 0), new TimeOnly(16, 0));

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "late-attendance",
                ["requestDate"] = Iso(incident),
                ["requestTime"] = "07:00",
                ["reason"] = "Not late at all"
            });

            Assert.Equal(HttpStatusCode.BadRequest, created.Status);
        }

        [Fact]
        public async Task ExcusedHours_Budget_ReflectsSpentHours()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var employee = await CreateSelfServiceEmployeeAsync("budget@revive.hr");
            await SeedScheduleAsync(employee.EmployeeId, gymId, Today, new TimeOnly(8, 0), new TimeOnly(16, 0));

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "late-attendance",
                ["requestDate"] = Iso(Today),
                ["requestTime"] = "09:30",
                ["reason"] = "Traffic"
            });
            await created.EnsureSuccessAsync();

            var budget = await _fixture.Client.SendAsync(
                Authorized(HttpMethod.Get, $"/api/employees/{employee.EmployeeId}/excused-hours", employee.Token));
            budget.EnsureSuccessStatusCode();
            var body = await budget.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(4m, body.GetProperty("capHours").GetDecimal());
            Assert.Equal(1.5m, body.GetProperty("usedHours").GetDecimal());
            Assert.Equal(2.5m, body.GetProperty("remainingHours").GetDecimal());
            Assert.Equal($"{Today.Year:D4}-{Today.Month:D2}", body.GetProperty("month").GetString());
        }

        // ---------- swaps, correction, salary advance, paid holiday ----------

        [Fact]
        public async Task ShiftSwap_ColleagueOfSameGym_Creates()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var employee = await CreateSelfServiceEmployeeAsync("swap-ok@revive.hr");
            var colleague = await CreateEmployeeAsync("swap-colleague@revive.hr", gymId, "EMP-7201");

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "shift-swap",
                ["requestDate"] = Iso(Today.AddDays(2)),
                ["endDate"] = Iso(Today.AddDays(3)),
                ["swapWithEmployeeId"] = colleague.ToString(),
                ["reason"] = "Wedding"
            });

            await created.EnsureSuccessAsync();
            var body = await created.ReadAsync();
            Assert.Equal("Shift Swap", body.GetProperty("type").GetString());
            Assert.Equal(colleague, body.GetProperty("swapWithEmployeeId").GetInt32());
            Assert.False(string.IsNullOrEmpty(body.GetProperty("swapWithEmployeeName").GetString()));
        }

        [Fact]
        public async Task ShiftSwap_WithoutColleague_Returns400()
        {
            var employee = await CreateSelfServiceEmployeeAsync("swap-none@revive.hr");

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "shift-swap",
                ["requestDate"] = Iso(Today.AddDays(2)),
                ["reason"] = "Wedding"
            });

            Assert.Equal(HttpStatusCode.BadRequest, created.Status);
        }

        [Fact]
        public async Task ShiftSwap_WithSelf_Returns400()
        {
            var employee = await CreateSelfServiceEmployeeAsync("swap-self@revive.hr");

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "shift-swap",
                ["requestDate"] = Iso(Today.AddDays(2)),
                ["swapWithEmployeeId"] = employee.EmployeeId.ToString(),
                ["reason"] = "Wedding"
            });

            Assert.Equal(HttpStatusCode.BadRequest, created.Status);
        }

        [Fact]
        public async Task ShiftSwap_ColleagueOfAnotherGym_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var gym2Id = await GymIdByNameAsync("Revive Second Gym");
            var employee = await CreateSelfServiceEmployeeAsync("swap-cross@revive.hr");
            var outsider = await CreateEmployeeAsync("swap-outsider@revive.hr", gym2Id, "EMP-7202");
            Assert.NotEqual(gym1Id, gym2Id);

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "shift-swap",
                ["requestDate"] = Iso(Today.AddDays(2)),
                ["swapWithEmployeeId"] = outsider.ToString(),
                ["reason"] = "Wedding"
            });

            Assert.Equal(HttpStatusCode.BadRequest, created.Status);
        }

        [Fact]
        public async Task WeeklyOffSwap_RequiresTargetDateAndColleague()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var employee = await CreateSelfServiceEmployeeAsync("weekly-off@revive.hr");
            var colleague = await CreateEmployeeAsync("weekly-colleague@revive.hr", gymId, "EMP-7203");

            var missingBoth = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "weekly-off-swap",
                ["requestDate"] = Iso(Today.AddDays(6)),
                ["reason"] = "Need Monday off"
            });
            Assert.Equal(HttpStatusCode.BadRequest, missingBoth.Status);

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "weekly-off-swap",
                ["requestDate"] = Iso(Today.AddDays(6)),
                ["targetDate"] = Iso(Today.AddDays(9)),
                ["swapWithEmployeeId"] = colleague.ToString(),
                ["reason"] = "Need Monday off"
            });

            await created.EnsureSuccessAsync();
            var body = await created.ReadAsync();
            Assert.Equal(Iso(Today.AddDays(6)), body.GetProperty("requestDate").GetString());
            Assert.Equal(Iso(Today.AddDays(9)), body.GetProperty("targetDate").GetString());
        }

        [Fact]
        public async Task CheckInCorrection_RequiresTheCorrectedTime()
        {
            var employee = await CreateSelfServiceEmployeeAsync("correction-none@revive.hr");

            var missingTime = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "check-in-correction",
                ["requestDate"] = Iso(Today.AddDays(-1)),
                ["reason"] = "Face ID failed"
            });
            Assert.Equal(HttpStatusCode.BadRequest, missingTime.Status);

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "check-in-correction",
                ["requestDate"] = Iso(Today.AddDays(-1)),
                ["requestTime"] = "08:05",
                ["reason"] = "Face ID failed"
            });

            await created.EnsureSuccessAsync();
            var body = await created.ReadAsync();
            Assert.Equal("Check-in Correction", body.GetProperty("type").GetString());
            Assert.Equal("08:05:00", body.GetProperty("requestTime").GetString());
        }

        [Fact]
        public async Task SalaryAdvance_RequiresPositiveAmount()
        {
            var employee = await CreateSelfServiceEmployeeAsync("advance-bad@revive.hr");

            var missing = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "salary-advance",
                ["reason"] = "Emergency"
            });
            Assert.Equal(HttpStatusCode.BadRequest, missing.Status);

            var zero = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "salary-advance",
                ["amount"] = "0",
                ["reason"] = "Emergency"
            });
            Assert.Equal(HttpStatusCode.BadRequest, zero.Status);

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "salary-advance",
                ["amount"] = "2500",
                ["reason"] = "Emergency"
            });

            await created.EnsureSuccessAsync();
            var body = await created.ReadAsync();
            Assert.Equal("Salary Advance", body.GetProperty("type").GetString());
            Assert.Equal(2500m, body.GetProperty("amount").GetDecimal());
        }

        [Fact]
        public async Task PaidHoliday_WorkRequest_Creates()
        {
            var employee = await CreateSelfServiceEmployeeAsync("paid-holiday@revive.hr");

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "paid-holiday",
                ["requestDate"] = Iso(Today.AddDays(20)),
                ["reason"] = "Volunteering for the Eid shift"
            });

            await created.EnsureSuccessAsync();
            var body = await created.ReadAsync();
            Assert.Equal("Paid Holiday", body.GetProperty("type").GetString());
            Assert.Equal("Pending", body.GetProperty("status").GetString());
        }

        // ---------- catalog + policy surfaces ----------

        [Fact]
        public async Task UnknownRequestType_Returns400()
        {
            var employee = await CreateSelfServiceEmployeeAsync("unknown-type@revive.hr");

            var created = await SubmitAsync(employee.Token, employee.EmployeeId, new Dictionary<string, string>
            {
                ["type"] = "moon-leave",
                ["requestDate"] = Iso(Today),
                ["reason"] = "Nope"
            });

            Assert.Equal(HttpStatusCode.BadRequest, created.Status);
        }

        [Fact]
        public async Task CreateRequest_ForAnotherEmployee_Returns404()
        {
            var employee = await CreateSelfServiceEmployeeAsync("idor@revive.hr");
            var otherId = await OwnEmployeeIdAsync("karim@revive.hr");

            var created = await SubmitAsync(employee.Token, otherId, new Dictionary<string, string>
            {
                ["type"] = "paid-holiday",
                ["requestDate"] = Iso(Today),
                ["reason"] = "Someone else's request"
            });

            Assert.Equal(HttpStatusCode.NotFound, created.Status);
        }

        [Fact]
        public async Task AttendancePolicy_ReadAndUpdate_ByHR()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("hr@revive.hr", gymId);

            var read = await _fixture.Client.SendAsync(
                Authorized(HttpMethod.Get, $"/api/gyms/{gymId}/attendance-policy", token));
            read.EnsureSuccessStatusCode();
            var before = await read.Content.ReadFromJsonAsync<JsonElement>();
            var original = before.GetProperty("excusedLateHoursCapPerMonth").GetDecimal();

            var update = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/gyms/{gymId}/attendance-policy",
                new { excusedLateHoursCapPerMonth = 6 }, token);
            var updateResponse = await _fixture.Client.SendAsync(update);
            updateResponse.EnsureSuccessStatusCode();
            var after = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(6m, after.GetProperty("excusedLateHoursCapPerMonth").GetDecimal());

            var reread = await _fixture.Client.SendAsync(
                Authorized(HttpMethod.Get, $"/api/gyms/{gymId}/attendance-policy", token));
            reread.EnsureSuccessStatusCode();
            var final = await reread.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(6m, final.GetProperty("excusedLateHoursCapPerMonth").GetDecimal());

            // Restore the pre-test value: the suite shares one database and other tests
            // read the default cap.
            var restore = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/gyms/{gymId}/attendance-policy",
                new { excusedLateHoursCapPerMonth = original }, token);
            (await _fixture.Client.SendAsync(restore)).EnsureSuccessStatusCode();
        }

        [Fact]
        public async Task AttendancePolicy_Update_AnotherGymsPolicy_Returns401()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var gym2Id = await GymIdByNameAsync("Revive Second Gym");
            var token = await LoginSelectingGymAsync("hr@revive.hr", gym1Id);

            var update = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/gyms/{gym2Id}/attendance-policy",
                new { excusedLateHoursCapPerMonth = 50 }, token);
            var response = await _fixture.Client.SendAsync(update);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task AttendancePolicy_Update_NegativeCap_Returns400()
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("hr@revive.hr", gymId);

            var update = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/gyms/{gymId}/attendance-policy",
                new { excusedLateHoursCapPerMonth = -1 }, token);
            var response = await _fixture.Client.SendAsync(update);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ---------- helpers ----------

        private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

        private static string Iso(DateOnly date) => date.ToString("yyyy-MM-dd");

        private static byte[] FakePdf() => System.Text.Encoding.ASCII.GetBytes("%PDF-1.4 fake medical certificate");

        private static HttpRequestMessage Authorized(HttpMethod method, string url, string token)
        {
            var request = new HttpRequestMessage(method, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return request;
        }

        /// <summary>Posts the create-request form (multipart, with an optional attachment).</summary>
        private async Task<SubmitResult> SubmitAsync(
            string token, int employeeId, Dictionary<string, string> fields,
            (string FieldName, byte[] Content, string FileName)? file = null)
        {
            var content = new MultipartFormDataContent();
            foreach (var (key, value) in fields)
            {
                content.Add(new StringContent(value), key);
            }

            if (file is not null)
            {
                var (fieldName, bytes, fileName) = file.Value;
                var fileContent = new ByteArrayContent(bytes);
                fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
                content.Add(fileContent, fieldName, fileName);
            }

            var request = Authorized(HttpMethod.Post, $"/api/employees/{employeeId}/requests", token);
            request.Content = content;

            var response = await _fixture.Client.SendAsync(request);

            return new SubmitResult(response, response.Content);
        }

        private sealed record SubmitResult(HttpResponseMessage Response, HttpContent Content)
        {
            public HttpStatusCode Status => Response.StatusCode;

            public async Task<JsonElement> ReadAsync() => await Content.ReadFromJsonAsync<JsonElement>();

            public async Task EnsureSuccessAsync()
            {
                if (!Response.IsSuccessStatusCode)
                {
                    var error = await Content.ReadAsStringAsync();
                    throw new InvalidOperationException(
                        $"Expected a success status but got {(int)Response.StatusCode}: {error}");
                }
            }
        }

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }

        /// <summary>A brand-new employee with his own login (one account per test).</summary>
        private async Task<(int EmployeeId, string Token)> CreateSelfServiceEmployeeAsync(string email)
        {
            var gymId = await GymIdByNameAsync("Revive Main Gym");
            var employeeId = await CreateEmployeeAsync(email, gymId, $"EMP-{Math.Abs(email.GetHashCode()) % 100000}");
            var token = await LoginSelectingGymAsync(email, gymId);
            return (employeeId, token);
        }

        private async Task<int> CreateEmployeeAsync(string email, int gymId, string employeeNumber)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();

            var existingUser = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (existingUser is null)
            {
                var hasher = scope.ServiceProvider.GetRequiredService<ServiceAbstraction.Services.IPasswordHasher>();
                existingUser = new DomainLayer.Models.UserModule.User
                {
                    Email = email,
                    UserName = email.Split('@')[0],
                    PasswordHash = hasher.Hash("Revive!2026"),
                    UserType = DomainLayer.Models.UserModule.Enums.UserType.Employee,
                    IsActive = true
                };
                db.Users.Add(existingUser);
                await db.SaveChangesAsync();
            }

            var existing = await db.Employees.FirstOrDefaultAsync(e => e.UserId == existingUser.Id);
            if (existing is not null)
            {
                return existing.Id;
            }

            var positionId = await db.Positions.Where(p => p.GymId == gymId).OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();
            var employee = new DomainLayer.Models.EmployeeModule.Employee
            {
                UserId = existingUser.Id,
                GymId = gymId,
                PositionId = positionId,
                FullName = "Request Tester",
                EmployeeNumber = employeeNumber,
                HireDate = new DateOnly(2026, 1, 5),
                ContractType = "FullTime",
                ContractStartDate = new DateOnly(2026, 1, 5),
                Status = DomainLayer.Models.EmployeeModule.Enums.EmployeeStatus.Active
            };
            db.Employees.Add(employee);

            // Gym access so login can scope (or auto-scope) the token to this gym.
            if (!await db.UserGymAccesses.AnyAsync(a => a.UserId == existingUser.Id && a.GymId == gymId))
            {
                db.UserGymAccesses.Add(new DomainLayer.Models.UserModule.UserGymAccess
                {
                    UserId = existingUser.Id,
                    GymId = gymId
                });
            }

            await db.SaveChangesAsync();
            return employee.Id;
        }

        private async Task SeedLeaveBalanceAsync(
            int employeeId, LeaveType leaveType, decimal total, decimal used, decimal pending)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();

            var existing = await db.LeaveBalances.FirstOrDefaultAsync(b =>
                b.EmployeeId == employeeId && b.LeaveType == leaveType && b.Year == DateTime.UtcNow.Year);
            if (existing is not null)
            {
                existing.TotalEntitlement = total;
                existing.UsedDays = used;
                existing.PendingDays = pending;
            }
            else
            {
                db.LeaveBalances.Add(new DomainLayer.Models.EmployeeModule.LeaveBalance
                {
                    EmployeeId = employeeId,
                    LeaveType = leaveType,
                    Year = DateTime.UtcNow.Year,
                    TotalEntitlement = total,
                    UsedDays = used,
                    PendingDays = pending
                });
            }

            await db.SaveChangesAsync();
        }

        private async Task<decimal> PendingDaysAsync(int employeeId, LeaveType leaveType)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var balance = await db.LeaveBalances.FirstOrDefaultAsync(b =>
                b.EmployeeId == employeeId && b.LeaveType == leaveType && b.Year == DateTime.UtcNow.Year);
            return balance?.PendingDays ?? 0m;
        }

        /// <summary>Publishes a one-day shift cycle for the employee so late/early hours are derivable.</summary>
        private async Task SeedScheduleAsync(
            int employeeId, int gymId, DateOnly date, TimeOnly start, TimeOnly end)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();

            if (await db.ShiftAssignments.AnyAsync(a => a.EmployeeId == employeeId && a.Date == date))
            {
                return;
            }

            var template = await db.ShiftTemplates.FirstOrDefaultAsync(t =>
                t.GymId == gymId && t.StartTime == start && t.EndTime == end && t.IsActive);
            if (template is null)
            {
                template = new DomainLayer.Models.SchedulingModule.ShiftTemplate
                {
                    GymId = gymId,
                    Name = "Request Test Shift",
                    StartTime = start,
                    EndTime = end,
                    IsActive = true
                };
                db.ShiftTemplates.Add(template);
                await db.SaveChangesAsync();
            }

            var cycle = await db.ShiftCycles.FirstOrDefaultAsync(c =>
                c.GymId == gymId && c.Status == DomainLayer.Models.SchedulingModule.Enums.ShiftCycleStatus.Published
                    && c.StartDate <= date && c.EndDate >= date);
            if (cycle is null)
            {
                cycle = new DomainLayer.Models.SchedulingModule.ShiftCycle
                {
                    GymId = gymId,
                    StartDate = date,
                    EndDate = date,
                    Status = DomainLayer.Models.SchedulingModule.Enums.ShiftCycleStatus.Published,
                    PublishedAt = DateTime.UtcNow
                };
                db.ShiftCycles.Add(cycle);
                await db.SaveChangesAsync();
            }

            db.ShiftAssignments.Add(new DomainLayer.Models.SchedulingModule.ShiftAssignment
            {
                ShiftCycleId = cycle.Id,
                EmployeeId = employeeId,
                Date = date,
                ShiftTemplateId = template.Id
            });
            await db.SaveChangesAsync();
        }

        private async Task<string> LoginSelectingGymAsync(string email, int gymId)
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email, password = "Revive!2026" });
            login.EnsureSuccessStatusCode();
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();

            // A single-gym account is auto-scoped at login; only multi-gym accounts
            // return a temp session that must be resolved by choosing the gym.
            if (loginBody.TryGetProperty("accessToken", out var direct))
            {
                return direct.GetString()!;
            }

            var temp = loginBody.GetProperty("tempSessionToken").GetString()!;
            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new { gymId, tempSessionToken = temp });
            select.EnsureSuccessStatusCode();
            var selectBody = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selectBody.GetProperty("accessToken").GetString()!;
        }
    }
}
