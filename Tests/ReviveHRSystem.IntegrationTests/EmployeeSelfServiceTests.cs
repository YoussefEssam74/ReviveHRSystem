using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Employee self-service surface (mock §§3, 6, 7, 10): documents, attendance,
    /// leave balance, published schedule, requests. Writes are self-only; reads of
    /// another employee need the [employees] grant and answer 404 cross-scope.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EmployeeSelfServiceTests
    {
        private readonly ApiTestFixture _fixture;

        public EmployeeSelfServiceTests(ApiTestFixture fixture) => _fixture = fixture;

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        [Fact]
        public async Task LeaveBalance_AnnualLeaveRequest_ReservesAnnualDays()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var pendingBefore = await PendingAnnualDaysAsync(employeeId);

            var create = MultipartRequest(
                HttpMethod.Post, $"/api/employees/{employeeId}/requests", token,
                new Dictionary<string, string>
                {
                    ["type"] = "annual-leave",
                    ["requestDate"] = DateOnly.FromDateTime(DateTime.Today).AddDays(7).ToString("yyyy-MM-dd"),
                    ["reason"] = "Family event"
                });
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Pending", created.GetProperty("status").GetString());
            Assert.Equal("Annual Leave", created.GetProperty("type").GetString());

            // The submitted day is reserved on the annual balance until it is decided.
            Assert.Equal(pendingBefore + 1, await PendingAnnualDaysAsync(employeeId));
        }

        [Fact]
        public async Task Requests_CancelPending_ReleasesReservedDays()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var create = MultipartRequest(
                HttpMethod.Post, $"/api/employees/{employeeId}/requests", token,
                new Dictionary<string, string>
                {
                    ["type"] = "annual-leave",
                    ["requestDate"] = DateOnly.FromDateTime(DateTime.Today).AddDays(9).ToString("yyyy-MM-dd"),
                    ["reason"] = "Personal day"
                });
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            var requestId = created.GetProperty("id").GetInt32();

            var pendingBefore = await PendingAnnualDaysAsync(employeeId);

            var cancel = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{requestId}/cancel", new { }, token);
            var cancelResponse = await _fixture.Client.SendAsync(cancel);
            Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var request = await db.EmployeeRequests.FindAsync(requestId);
            Assert.Equal(DomainLayer.Models.RequestModule.Enums.RequestStatus.Cancelled, request!.Status);

            // The cancelled request released the day it had reserved.
            Assert.Equal(pendingBefore - 1m, await PendingAnnualDaysAsync(employeeId));
        }

        /// <summary>Days currently reserved on the employee's annual balance (read through the context).</summary>
        private async Task<decimal> PendingAnnualDaysAsync(int employeeId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var year = DateTime.UtcNow.Year;
            var row = await db.LeaveBalances.FirstOrDefaultAsync(b =>
                b.EmployeeId == employeeId && b.Year == year && b.LeaveType == DomainLayer.Models.EmployeeModule.Enums.LeaveType.Annual);
            return row?.PendingDays ?? 0m;
        }

        [Fact]
        public async Task Schedule_Self_ReturnsPublishedDays()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/schedule", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body.GetProperty("days").GetArrayLength() >= 1);
            Assert.Contains(body.GetProperty("cycles").EnumerateArray(), c => c.GetProperty("status").GetString() == "Published");
        }

        [Fact]
        public async Task Schedule_OtherEmployee_AsPlainEmployee_Returns404()
        {
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{saraId}/schedule", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task RequestTypes_ReturnsConfigurableCatalog()
        {
            var response = await _fixture.Client.GetAsync("/api/request-types");

            // The catalog is configuration, not personal data, so it is readable by any
            // authenticated user through the fallback policy; unauthenticated must fail.
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/request-types", null, token);
            var authedResponse = await _fixture.Client.SendAsync(request);
            authedResponse.EnsureSuccessStatusCode();
            var body = await authedResponse.Content.ReadFromJsonAsync<JsonElement>();

            // The catalog agreed with the product owner (absence disputes added later).
            var ids = body.EnumerateArray().Select(t => t.GetProperty("id").GetString()).ToList();
            Assert.Equal(10, ids.Count);
            Assert.Contains("annual-leave", ids);
            Assert.Contains("sick-leave", ids);
            Assert.Contains("late-attendance", ids);
            Assert.Contains("early-leave", ids);
            Assert.Contains("shift-swap", ids);
            Assert.Contains("weekly-off-swap", ids);
            Assert.Contains("check-in-correction", ids);
            Assert.Contains("salary-advance", ids);
            Assert.Contains("paid-holiday", ids);
            Assert.Contains("deduction-correction", ids);

            var sick = body.EnumerateArray().First(t => t.GetProperty("id").GetString() == "sick-leave");
            Assert.True(sick.GetProperty("requiresAttachment").GetBoolean());
            Assert.Equal("Sick", sick.GetProperty("consumesLeave").GetString());

            var late = body.EnumerateArray().First(t => t.GetProperty("id").GetString() == "late-attendance");
            Assert.True(late.GetProperty("limitedByMonthlyExcusedHours").GetBoolean());
        }

        /// <summary>Multipart form post (the request create endpoint accepts an attachment).</summary>
        private static HttpRequestMessage MultipartRequest(
            HttpMethod method, string url, string token, Dictionary<string, string> fields,
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
                fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf");
                content.Add(fileContent, fieldName, fileName);
            }

            var request = new HttpRequestMessage(method, url) { Content = content };
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            return request;
        }
    }
}
