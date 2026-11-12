using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.AttendanceModule.Enums;
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
    /// Multiple punches collapse into first check-in + last checkout, and an
    /// unscheduled (off-day) check-in auto-creates an Unscheduled Attendance
    /// request that BM (stage 1) and HR (final) accept with 1 or 2 cover days.
    /// The cover-day value is display-only and never moves the leave balance.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class UnscheduledAttendanceTests
    {
        private readonly ApiTestFixture _fixture;

        public UnscheduledAttendanceTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private static object EventPayload(string employeeNumber, string type, DateTime? timestamp = null) =>
            new { employeeId = employeeNumber, type, livenessScore = 0.95, timestamp };

        private async Task<(HttpStatusCode Status, JsonElement Body)> PostEventAsync(object payload, string stationToken)
        {
            var request = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/events", payload, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (response.StatusCode, body);
        }

        [Fact]
        public async Task MultiplePunches_SameDay_KeepFirstCheckIn_AndLastCheckOut()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym, shiftAtGym: gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            // Relative to now (never future beyond the skew, never far past):
            // IN → OUT → IN → OUT within the same attendance day.
            var now = DateTime.UtcNow;
            var firstIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", now.AddMinutes(-40)), stationToken);
            var firstOut = await PostEventAsync(EventPayload(employee.EmployeeNumber, "OUT", now.AddMinutes(-30)), stationToken);
            var secondIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN", now.AddMinutes(-20)), stationToken);
            var lastOut = await PostEventAsync(EventPayload(employee.EmployeeNumber, "OUT", now.AddMinutes(-10)), stationToken);

            Assert.Equal(HttpStatusCode.Created, firstIn.Status);
            Assert.Equal(HttpStatusCode.Created, firstOut.Status);
            Assert.Equal(HttpStatusCode.Created, secondIn.Status);
            Assert.Equal(HttpStatusCode.Created, lastOut.Status);
            Assert.Equal(firstIn.Body.GetProperty("recordId").GetString(), lastOut.Body.GetProperty("recordId").GetString());

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var record = await db.AttendanceRecords.SingleAsync(r => r.EmployeeId == employee.EmployeeId);
            // First check-in is kept (not the re-entry), last checkout wins.
            // DB storage truncates sub-millisecond ticks, so compare to the minute.
            Assert.Equal(now.AddMinutes(-40).ToString("yyyy-MM-dd HH:mm"), record.CheckInTime!.Value.ToString("yyyy-MM-dd HH:mm"));
            Assert.Equal(now.AddMinutes(-10).ToString("yyyy-MM-dd HH:mm"), record.CheckOutTime!.Value.ToString("yyyy-MM-dd HH:mm"));
        }

        [Fact]
        public async Task OffDayCheckIn_CreatesUnscheduledRequest_AndSecondPunchDoesNotDuplicate()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            // No shift at the gym: an off-day check-in.
            var employee = await builder.CreateEmployeeAsync(gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var checkIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkIn.Status);
            Assert.Equal("UNSCHEDULED", checkIn.Body.GetProperty("shiftComparison").GetString());

            var checkOut = await PostEventAsync(EventPayload(employee.EmployeeNumber, "OUT"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkOut.Status);

            // A second cycle the same day must not create a second request.
            var secondIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            Assert.Equal(HttpStatusCode.Created, secondIn.Status);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var requests = await db.EmployeeRequests
                .Where(r => r.EmployeeId == employee.EmployeeId && r.Type == "Unscheduled Attendance")
                .ToListAsync();
            var single = Assert.Single(requests);
            Assert.Equal(RequestStatus.Pending, single.Status);
            Assert.Equal(builder.AttendanceToday, single.RequestDate);
        }

        [Fact]
        public async Task BmThenHrApproval_CoverDaysStored_AndLeaveBalanceUnchanged()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            // 4 Fridays off example: total 21, used 17 so 4 remain — working the
            // off day must leave this untouched and add a cover day instead.
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.SetLeaveBalanceAsync(employee.EmployeeId, total: 21, used: 17);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var checkIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkIn.Status);

            int requestId;
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                requestId = await db.EmployeeRequests
                    .Where(r => r.EmployeeId == employee.EmployeeId && r.Type == "Unscheduled Attendance")
                    .Select(r => r.Id).SingleAsync();
            }

            var manager = await builder.CreateUserAsync(UserType.TopManagement, new[] { gym });
            await GrantGymRoleAsync(manager.UserId, gym.GymId, "Branch Manager");
            var bmToken = await LoginAsync(manager, gym.GymId);

            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "requests.approve");
            await builder.GrantPermissionAsync(hr.UserId, "requests.view");
            var hrToken = await LoginAsync(hr, gym.GymId);

            // BM approves to HR review as 2 days.
            var bmDecision = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{requestId}/decisions",
                new { decision = "Approve", comment = "Needed for cover.", calculatedDays = 2 }, bmToken));
            Assert.Equal(HttpStatusCode.NoContent, bmDecision.StatusCode);

            // HR gives the final decision, counting 1 day instead.
            var hrDecision = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{requestId}/decide",
                new { stage = "HR", decision = "Approved", comment = "Counted as one.", calculatedDays = 1 }, hrToken));
            Assert.Equal(HttpStatusCode.OK, hrDecision.StatusCode);

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var request = await db.EmployeeRequests.SingleAsync(r => r.Id == requestId);
                Assert.Equal(RequestStatus.Approved, request.Status);
                Assert.Equal(1m, request.OvertimeHoursRequested);
                Assert.Equal("1 day", request.Payment);

                var record = await db.AttendanceRecords.SingleAsync(r => r.EmployeeId == employee.EmployeeId);
                Assert.Equal(AttendanceStatus.OnTime, record.Status);
                Assert.Equal("Approved as 1 day(s) cover/extra day", record.Notes);

                var balance = await db.LeaveBalances
                    .SingleAsync(b => b.EmployeeId == employee.EmployeeId
                        && b.LeaveType == DomainLayer.Models.EmployeeModule.Enums.LeaveType.Annual);
                Assert.Equal(17m, balance.UsedDays);
                Assert.Equal(0m, balance.PendingDays);
            }

            // Employee history surfaces the cover day and the monthly total.
            var ownToken = await _fixture.LoginAsync(employee.Email, employee.Password);
            var history = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employee.EmployeeId}/attendance?month={Month()}", null, ownToken));
            Assert.Equal(HttpStatusCode.OK, history.StatusCode);
            var historyBody = await history.Content.ReadFromJsonAsync<JsonElement>();
            var totals = historyBody.GetProperty("totals");
            Assert.Equal(1, totals.GetProperty("coverDays").GetInt32());
            var items = historyBody.GetProperty("items").EnumerateArray().ToList();
            var item = Assert.Single(items, i => i.GetProperty("date").GetString() == builder.AttendanceToday.ToString("yyyy-MM-dd"));
            Assert.Equal(1, item.GetProperty("coverDays").GetInt32());
        }

        [Fact]
        public async Task RejectedUnscheduledAttendance_StaysPresent_WithNoCoverDay()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            await builder.SetLeaveBalanceAsync(employee.EmployeeId, total: 21, used: 17);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var checkIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkIn.Status);

            int requestId;
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                requestId = await db.EmployeeRequests
                    .Where(r => r.EmployeeId == employee.EmployeeId && r.Type == "Unscheduled Attendance")
                    .Select(r => r.Id).SingleAsync();
            }

            var manager = await builder.CreateUserAsync(UserType.TopManagement, new[] { gym });
            await GrantGymRoleAsync(manager.UserId, gym.GymId, "Branch Manager");
            var bmToken = await LoginAsync(manager, gym.GymId);

            var reject = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{requestId}/decisions",
                new { decision = "Reject", comment = "Not needed." }, bmToken));
            Assert.Equal(HttpStatusCode.NoContent, reject.StatusCode);

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var request = await db.EmployeeRequests.SingleAsync(r => r.Id == requestId);
                Assert.Equal(RequestStatus.Rejected, request.Status);

                var record = await db.AttendanceRecords.SingleAsync(r => r.EmployeeId == employee.EmployeeId);
                Assert.Equal(AttendanceStatus.OnTime, record.Status);
                Assert.Equal("Unscheduled attendance rejected by Branch Manager", record.Notes);

                var balance = await db.LeaveBalances
                    .SingleAsync(b => b.EmployeeId == employee.EmployeeId
                        && b.LeaveType == DomainLayer.Models.EmployeeModule.Enums.LeaveType.Annual);
                Assert.Equal(17m, balance.UsedDays);
            }
        }

        [Fact]
        public async Task Approve_WithInvalidCalculatedDays_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var checkIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkIn.Status);

            int requestId;
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                requestId = await db.EmployeeRequests
                    .Where(r => r.EmployeeId == employee.EmployeeId && r.Type == "Unscheduled Attendance")
                    .Select(r => r.Id).SingleAsync();
            }

            var manager = await builder.CreateUserAsync(UserType.TopManagement, new[] { gym });
            await GrantGymRoleAsync(manager.UserId, gym.GymId, "Branch Manager");
            var bmToken = await LoginAsync(manager, gym.GymId);

            var decision = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{requestId}/decisions",
                new { decision = "Approve", comment = (string?)null, calculatedDays = 3 }, bmToken));
            Assert.Equal(HttpStatusCode.BadRequest, decision.StatusCode);
        }

        [Fact]
        public async Task ManuallySubmittingUnscheduledAttendance_Returns400()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);

            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email = employee.Email, password = employee.Password });
            login.EnsureSuccessStatusCode();
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var token = loginBody.GetProperty("accessToken").GetString()!;

            var content = new MultipartFormDataContent
            {
                { new StringContent("unscheduled-attendance"), "type" },
                { new StringContent("I worked my off day."), "reason" },
                { new StringContent(builder.AttendanceToday.ToString("yyyy-MM-dd")), "requestDate" },
            };
            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/requests")
            {
                Content = content
            };
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task MissingTargetTime_DeskAndHrReadsFallBackToAttendanceCheckIn()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            // No shift at the gym: an off-day check-in.
            var employee = await builder.CreateEmployeeAsync(gym);
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var checkIn = await PostEventAsync(EventPayload(employee.EmployeeNumber, "IN"), stationToken);
            Assert.Equal(HttpStatusCode.Created, checkIn.Status);

            int requestId;
            DateTime checkInUtc;
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                requestId = await db.EmployeeRequests
                    .Where(r => r.EmployeeId == employee.EmployeeId && r.Type == "Unscheduled Attendance")
                    .Select(r => r.Id).SingleAsync();
                // Simulate a row created before the request carried its own
                // check-in time: the desk/HR reads must still show the real one.
                var request = await db.EmployeeRequests.SingleAsync(r => r.Id == requestId);
                request.TargetTime = null;
                await db.SaveChangesAsync();

                var record = await db.AttendanceRecords.SingleAsync(r => r.EmployeeId == employee.EmployeeId);
                checkInUtc = record.CheckInTime!.Value;
            }

            var timeZone = _fixture.Services.GetRequiredService<TimeZoneInfo>();
            var expected = TimeZoneInfo.ConvertTimeFromUtc(checkInUtc, timeZone).ToString("HH:mm:ss");

            var manager = await builder.CreateUserAsync(UserType.TopManagement, new[] { gym });
            await GrantGymRoleAsync(manager.UserId, gym.GymId, "Branch Manager");
            var bmToken = await LoginAsync(manager, gym.GymId);

            // BM approves to HR review as 2 days: Payment stays "2 days" storage.
            var decision = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{requestId}/decisions",
                new { decision = "Approve", comment = "Needed for cover.", calculatedDays = 2 }, bmToken));
            Assert.Equal(HttpStatusCode.NoContent, decision.StatusCode);

            // Stage-1 desk inbox.
            var inbox = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/requests/inbox?status=PendingHRReview", null, bmToken));
            Assert.Equal(HttpStatusCode.OK, inbox.StatusCode);
            var inboxBody = await inbox.Content.ReadFromJsonAsync<JsonElement>();
            var item = inboxBody.GetProperty("items").EnumerateArray()
                .Single(i => i.GetProperty("id").GetInt32() == requestId);
            Assert.StartsWith(expected, item.GetProperty("requestTime").GetString());

            // Request detail.
            var detail = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/requests/{requestId}", null, bmToken));
            Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
            var detailBody = await detail.Content.ReadFromJsonAsync<JsonElement>();
            Assert.StartsWith(expected, detailBody.GetProperty("data").GetProperty("requestTime").GetString());

            // HR directory list.
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            await builder.GrantPermissionAsync(hr.UserId, "requests.view");
            var hrToken = await LoginAsync(hr, gym.GymId);

            var hrList = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/requests?status=PendingHRReview", null, hrToken));
            Assert.Equal(HttpStatusCode.OK, hrList.StatusCode);
            var hrBody = await hrList.Content.ReadFromJsonAsync<JsonElement>();
            var hrItem = hrBody.GetProperty("items").EnumerateArray()
                .Single(i => i.GetProperty("id").GetInt32() == requestId);
            Assert.StartsWith(expected, hrItem.GetProperty("requestTime").GetString());
        }

        private string Month()
        {
            var today = NewBuilder().AttendanceToday;
            return $"{today.Year:D4}-{today.Month:D2}";
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
    }
}
