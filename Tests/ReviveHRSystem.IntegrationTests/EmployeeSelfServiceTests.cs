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

        /// <summary>Records today's check-in for the employee (test-owned data).</summary>
        private async Task SeedAttendanceRecordAsync(int employeeId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var employee = await db.Employees.FindAsync(employeeId);
            if (employee is null)
            {
                return;
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (await db.AttendanceRecords.AnyAsync(r => r.EmployeeId == employeeId && r.Date == today))
            {
                return;
            }

            db.AttendanceRecords.Add(new DomainLayer.Models.AttendanceModule.AttendanceRecord
            {
                EmployeeId = employeeId,
                GymId = employee.GymId,
                Date = today,
                CheckInTime = DateTime.UtcNow.Date.AddHours(8),
                CheckInMethod = DomainLayer.Models.AttendanceModule.Enums.AttendanceMethod.Manual,
                Status = DomainLayer.Models.AttendanceModule.Enums.AttendanceStatus.OnTime
            });
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Documents_SelfUpload_AppearsInVaultAndChecklist()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var upload = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{employeeId}/documents", new
            {
                category = "Certification",
                fileName = "First Aid Certificate 2026.pdf",
                filePath = "/uploads/first-aid-2026.pdf",
                expiryDate = DateOnly.FromDateTime(DateTime.Today).AddDays(20)
            }, token);
            var uploadResponse = await _fixture.Client.SendAsync(upload);
            uploadResponse.EnsureSuccessStatusCode();
            var uploaded = await uploadResponse.Content.ReadFromJsonAsync<JsonElement>();
            var documentId = uploaded.GetProperty("id").GetInt32();
            Assert.Equal("Certification", uploaded.GetProperty("category").GetString());
            Assert.Equal("Expiring Soon", uploaded.GetProperty("status").GetString());

            var list = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/documents", null, token);
            var listResponse = await _fixture.Client.SendAsync(list);
            listResponse.EnsureSuccessStatusCode();
            var documents = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(documents.EnumerateArray(), d => d.GetProperty("id").GetInt32() == documentId);

            var required = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/required-documents", null, token);
            var requiredResponse = await _fixture.Client.SendAsync(required);
            requiredResponse.EnsureSuccessStatusCode();
            var requiredDocs = await requiredResponse.Content.ReadFromJsonAsync<JsonElement>();
            var certification = requiredDocs.EnumerateArray().First(d => d.GetProperty("key").GetString() == "certification");
            Assert.Equal(documentId, certification.GetProperty("documentId").GetInt32());
        }

        [Fact]
        public async Task Documents_UploadToSomeoneElsesId_Returns404()
        {
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var upload = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/employees/{saraId}/documents", new
            {
                category = "Contract",
                fileName = "stolen.pdf",
                filePath = "/uploads/x.pdf"
            }, token);
            var response = await _fixture.Client.SendAsync(upload);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Attendance_Self_ReturnsOverview()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            await SeedAttendanceRecordAsync(employeeId);
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/attendance", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body.GetProperty("summary").GetProperty("rate").GetInt32() >= 0);
            Assert.True(body.GetProperty("records").GetArrayLength() >= 1);
        }

        [Fact]
        public async Task LeaveBalance_AnnualLeaveRequest_ReservesAnnualDays()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var before = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/leave-balance", null, token);
            var beforeResponse = await _fixture.Client.SendAsync(before);
            beforeResponse.EnsureSuccessStatusCode();
            var beforeBody = await beforeResponse.Content.ReadFromJsonAsync<JsonElement>();
            var pendingBefore = beforeBody.GetProperty("balances").TryGetProperty("Annual", out var annual)
                ? annual.GetProperty("pending").GetDecimal() : 0m;

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

            var after = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/leave-balance", null, token);
            var afterResponse = await _fixture.Client.SendAsync(after);
            afterResponse.EnsureSuccessStatusCode();
            var afterBody = await afterResponse.Content.ReadFromJsonAsync<JsonElement>();
            var pendingAfter = afterBody.GetProperty("balances").GetProperty("Annual").GetProperty("pending").GetDecimal();
            Assert.Equal(pendingBefore + 1, pendingAfter);
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

            var balanceBefore = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/leave-balance", null, token);
            var balanceBeforeResponse = await _fixture.Client.SendAsync(balanceBefore);
            balanceBeforeResponse.EnsureSuccessStatusCode();
            var balanceBeforeBody = await balanceBeforeResponse.Content.ReadFromJsonAsync<JsonElement>();
            var pendingBefore = balanceBeforeBody.GetProperty("balances").GetProperty("Annual").GetProperty("pending").GetDecimal();

            var cancel = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/requests/{requestId}/cancel", new { }, token);
            var cancelResponse = await _fixture.Client.SendAsync(cancel);
            Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);

            var detail = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/requests/{requestId}", null, token);
            var detailResponse = await _fixture.Client.SendAsync(detail);
            detailResponse.EnsureSuccessStatusCode();
            var detailBody = await detailResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Cancelled", detailBody.GetProperty("status").GetString());

            // The cancelled request released the day it had reserved (whatever else the
            // suite left pending for this employee, the delta is exactly -1).
            var balance = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/leave-balance", null, token);
            var balanceResponse = await _fixture.Client.SendAsync(balance);
            balanceResponse.EnsureSuccessStatusCode();
            var balanceBody = await balanceResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(pendingBefore - 1m, balanceBody.GetProperty("balances").GetProperty("Annual").GetProperty("pending").GetDecimal());
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

            // The final 9-type catalog agreed with the product owner.
            var ids = body.EnumerateArray().Select(t => t.GetProperty("id").GetString()).ToList();
            Assert.Equal(9, ids.Count);
            Assert.Contains("annual-leave", ids);
            Assert.Contains("sick-leave", ids);
            Assert.Contains("late-attendance", ids);
            Assert.Contains("early-leave", ids);
            Assert.Contains("shift-swap", ids);
            Assert.Contains("weekly-off-swap", ids);
            Assert.Contains("check-in-correction", ids);
            Assert.Contains("salary-advance", ids);
            Assert.Contains("paid-holiday", ids);

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
