using System.Net;
using System.Text.Json;
using DomainLayer.Models.EmployeeModule.Enums;
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
    /// Escalated employee action requests (api-spec-from-ui.md §9.4): the Events
    /// page's Escalated tab. Reading needs events.view OR any ACTION_TYPES meta
    /// permission and is filtered per action type + gym; approve executes the
    /// proposed effect (gym move / compensation / role assign / offboard case /
    /// import audit) and marks the row Approved; reject requires a comment and
    /// audits "{Label} Request Rejected". There is no create endpoint (E20 is out
    /// of scope) — rows are seeded directly through TestDataBuilder.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class ActionRequestControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public ActionRequestControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private ReviveHrDbContext Db => _fixture.Services.GetRequiredService<ReviveHrDbContext>();

        private sealed record Scene(TestDataBuilder Builder, TestGym Gym, TestUser Hr, TestEmployee Employee, string Token);

        private async Task<Scene> CreateSceneAsync(TestGym[]? extraGyms, params string[] permissionKeys)
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hrGyms = extraGyms is null ? new[] { gym } : new[] { gym }.Concat(extraGyms).ToArray();
            var hr = await builder.CreateUserAsync(UserType.HR, hrGyms);
            foreach (var key in permissionKeys)
            {
                await builder.GrantPermissionAsync(hr.UserId, key);
            }

            var token = await _fixture.LoginAsync(hr.Email, hr.Password);
            var employee = await builder.CreateEmployeeAsync(gym);
            return new Scene(builder, gym, hr, employee, token);
        }

        private Task<Scene> CreateSceneAsync(params string[] permissionKeys)
            => CreateSceneAsync(null, permissionKeys);

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body, string token)
            => await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(method, url, body, token));

        private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
        {
            var body = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        private async Task<JsonElement> GetAsync(string url, string token)
        {
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(HttpMethod.Get, url, null, token));
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from {url} but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        private static async Task<string> AssertErrorAsync(HttpResponseMessage response, HttpStatusCode expected)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == expected,
                $"Expected {(int)expected} but got {(int)response.StatusCode}: {body}");
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.GetProperty("errorMessage").GetString() ?? string.Empty;
        }

        private static List<JsonElement> ItemsOf(JsonElement envelope) =>
            envelope.GetProperty("items").EnumerateArray().ToList();

        private static DateOnly Days(int offset) => DateOnly.FromDateTime(DateTime.UtcNow.AddDays(offset));

        private async Task<int> ApproveAsync(Scene scene, int requestId)
        {
            var response = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/approve", null, scene.Token);
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from approve but got {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
            return (await ReadAsync(response)).GetProperty("data").GetProperty("id").GetInt32();
        }

        // ------------------------------------------------------------------
        // GET /api/action-requests — read gate + per-type visibility
        // ------------------------------------------------------------------

        [Fact]
        public async Task Get_WithoutAnyReadPermission_Returns401_MetaOnlyUserCanRead()
        {
            var scene = await CreateSceneAsync(); // no keys at all
            var denied = await SendAsync(HttpMethod.Get, "/api/action-requests", null, scene.Token);
            await AssertErrorAsync(denied, HttpStatusCode.Unauthorized);

            // A holder of just one ACTION_TYPES meta key may still read (§9.4).
            var meta = await scene.Builder.CreateUserAsync(UserType.HR, new[] { scene.Gym });
            await scene.Builder.GrantPermissionAsync(meta.UserId, "employees.transfer");
            var metaToken = await _fixture.LoginAsync(meta.Email, meta.Password);
            var allowed = await SendAsync(HttpMethod.Get, "/api/action-requests", null, metaToken);
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }

        [Fact]
        public async Task List_FiltersRowsByTheActorHeldActionTypes()
        {
            var scene = await CreateSceneAsync("events.view", "employees.transfer");
            await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "Transfer",
                new { fromGym = scene.Gym.Name, toGym = "Elsewhere", effectiveDate = Days(3).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);
            await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "CompensationChange",
                new { currentSalary = 10000, newSalary = 12500, effectiveDate = Days(3).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);
            await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "Offboard",
                new { lastDay = Days(10).ToString("yyyy-MM-dd"), reason = "Performance Termination" },
                scene.Hr.UserId);

            // Only the Transfer row is visible to a transfer-key holder.
            var visible = await GetAsync("/api/action-requests?status=Pending", scene.Token);
            var only = Assert.Single(ItemsOf(visible));
            Assert.Equal("Transfer", only.GetProperty("actionType").GetString());
            Assert.Equal(1, visible.GetProperty("total").GetInt32());

            // events.view alone sees nothing (no meta keys → no rows).
            var viewer = await scene.Builder.CreateUserAsync(UserType.HR, new[] { scene.Gym });
            await scene.Builder.GrantPermissionAsync(viewer.UserId, "events.view");
            var viewerToken = await _fixture.LoginAsync(viewer.Email, viewer.Password);
            var empty = await GetAsync("/api/action-requests", viewerToken);
            Assert.Empty(ItemsOf(empty));
            Assert.Equal(0, empty.GetProperty("total").GetInt32());
        }

        [Fact]
        public async Task List_FiltersByTypeStatusGym_AndCarriesTheMockShape()
        {
            var scene = await CreateSceneAsync("events.view", "employees.transfer", "employees.offboard");
            var transferId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "Transfer",
                new { fromGym = scene.Gym.Name, toGym = "Elsewhere", effectiveDate = Days(3).ToString("yyyy-MM-dd") },
                scene.Hr.UserId, justification: "Better commute for the team lead");
            await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "Offboard",
                new { lastDay = Days(10).ToString("yyyy-MM-dd"), reason = "Performance Termination" },
                scene.Hr.UserId);

            var byType = await GetAsync("/api/action-requests?actionType=transfer", scene.Token);
            var item = Assert.Single(ItemsOf(byType));
            Assert.Equal(transferId, item.GetProperty("id").GetInt32());
            Assert.Equal("Pending", item.GetProperty("status").GetString());
            Assert.Equal(scene.Employee.FullName, item.GetProperty("employee").GetString());
            Assert.Equal("IT Tester", item.GetProperty("position").GetString());
            Assert.Equal("Better commute for the team lead", item.GetProperty("justification").GetString());
            Assert.Equal(scene.Hr.Email.Split('@')[0], item.GetProperty("requestedBy").GetString());
            var details = item.GetProperty("proposedDetails");
            Assert.Equal(scene.Gym.Name, details.GetProperty("fromGym").GetString());
            Assert.Equal("Elsewhere", details.GetProperty("toGym").GetString());

            var byGym = await GetAsync($"/api/action-requests?gym={Uri.EscapeDataString(scene.Gym.Name)}", scene.Token);
            Assert.Equal(2, byGym.GetProperty("total").GetInt32());

            var approved = await GetAsync("/api/action-requests?status=Approved", scene.Token);
            Assert.Empty(ItemsOf(approved));
        }

        // ------------------------------------------------------------------
        // PUT /api/action-requests/{id}/approve
        // ------------------------------------------------------------------

        [Fact]
        public async Task Approve_Transfer_MovesEmployee_MarksApproved_Audits()
        {
            var destination = await NewBuilder().CreateGymWithStationAsync();
            var scene = await CreateSceneAsync(new[] { destination }, "employees.transfer");
            var requestId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "Transfer",
                new
                {
                    fromGym = scene.Gym.Name,
                    toGym = destination.Name,
                    effectiveDate = Days(2).ToString("yyyy-MM-dd"),
                },
                scene.Hr.UserId);

            var response = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/approve", null, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var data = (await ReadAsync(response)).GetProperty("data");
            Assert.Equal(requestId, data.GetProperty("id").GetInt32());
            Assert.Equal("Approved", data.GetProperty("status").GetString());
            Assert.True(data.GetProperty("executed").GetBoolean());
            Assert.Equal(scene.Hr.Email.Split('@')[0], data.GetProperty("reviewedBy").GetString());
            Assert.False(data.GetProperty("reviewedDate").ValueKind == JsonValueKind.Null);

            // The effect actually executed: employee moved, row approved, audited.
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == scene.Employee.EmployeeId);
            Assert.Equal(destination.GymId, employee.GymId);
            var action = await Db.ActionRequests.AsNoTracking().SingleAsync(a => a.Id == requestId);
            Assert.Equal("Approved", action.Status);
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Gym Transfer Executed" && a.UserId == scene.Hr.UserId));

            // A second approve is refused.
            var again = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/approve", null, scene.Token);
            var message = await AssertErrorAsync(again, HttpStatusCode.BadRequest);
            Assert.Contains("already been decided", message);
        }

        [Fact]
        public async Task Approve_CompensationChange_Executes()
        {
            var scene = await CreateSceneAsync("employees.compensation.manage");
            var requestId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "CompensationChange",
                new { currentSalary = 10000, newSalary = 13200.75, effectiveDate = Days(5).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);

            var response = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/approve", null, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True((await ReadAsync(response)).GetProperty("data").GetProperty("executed").GetBoolean());
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Compensation Updated" && a.UserId == scene.Hr.UserId));
            Assert.Equal("Approved",
                (await Db.ActionRequests.AsNoTracking().SingleAsync(a => a.Id == requestId)).Status);
        }

        [Fact]
        public async Task Approve_RoleAssign_AssumesExistingSystemRole()
        {
            // The system role must exist (roles are global — created by an admin).
            var adminToken = await _fixture.GetAdminTokenAsync();
            var roleName = $"Team Leader {Guid.NewGuid().ToString("N")[..8]}";
            var createRole = await SendAsync(HttpMethod.Post, "/api/roles", new { name = roleName }, adminToken);
            Assert.True(createRole.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Role create failed: {(int)createRole.StatusCode}: {await createRole.Content.ReadAsStringAsync()}");

            var scene = await CreateSceneAsync("employees.role.assign");
            var requestId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "RoleAssign",
                new { systemRole = roleName },
                scene.Hr.UserId);

            var response = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/approve", null, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True((await ReadAsync(response)).GetProperty("data").GetProperty("executed").GetBoolean());
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "System Role Assigned" && a.UserId == scene.Hr.UserId));
        }

        [Fact]
        public async Task Approve_Offboard_CreatesSeparation_ParksEmployeeInNoticePeriod()
        {
            var scene = await CreateSceneAsync("employees.offboard");
            var requestId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "Offboard",
                new { lastDay = Days(11).ToString("yyyy-MM-dd"), reason = "Performance Termination" },
                scene.Hr.UserId);

            var response = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/approve", null, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True((await ReadAsync(response)).GetProperty("data").GetProperty("executed").GetBoolean());

            var separation = await Db.OffboardingCases.AsNoTracking().SingleAsync(c => c.EmployeeId == scene.Employee.EmployeeId);
            Assert.Equal("Notice Period", separation.Status);
            Assert.Equal("Termination", separation.SeparationType);
            Assert.Equal(5, await Db.OffboardingChecklistItems.CountAsync(i => i.OffboardingCaseId == separation.Id));
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == scene.Employee.EmployeeId);
            Assert.Equal(EmployeeStatus.NoticePeriod, employee.Status);
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Offboarding Initiated" && a.UserId == scene.Hr.UserId));
        }

        [Fact]
        public async Task Approve_BulkImport_LabelAuditsOnly_BlankSourceRejected()
        {
            var scene = await CreateSceneAsync("employees.bulk_import");
            var requestId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "BulkImport",
                new { source = "new_hires_sep2026.csv — 12 rows" },
                scene.Hr.UserId);

            var response = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/approve", null, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True((await ReadAsync(response)).GetProperty("data").GetProperty("executed").GetBoolean());
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Bulk Import Executed" && a.UserId == scene.Hr.UserId));

            // A blank source cannot be approved.
            var blankId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "BulkImport",
                new { source = "" },
                scene.Hr.UserId);
            var blank = await SendAsync(HttpMethod.Put, $"/api/action-requests/{blankId}/approve", null, scene.Token);
            var message = await AssertErrorAsync(blank, HttpStatusCode.BadRequest);
            Assert.Contains("A source is required", message);
        }

        [Fact]
        public async Task Approve_WrongPermission_UnknownGymAndUnknownId()
        {
            var scene = await CreateSceneAsync("events.view", "employees.transfer");
            var compensationId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "CompensationChange",
                new { currentSalary = 5000, newSalary = 6000, effectiveDate = Days(3).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);
            var wrongPerm = await SendAsync(HttpMethod.Put, $"/api/action-requests/{compensationId}/approve", null, scene.Token);
            await AssertErrorAsync(wrongPerm, HttpStatusCode.Unauthorized); // transfer key ≠ compensation key

            var badTransferId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "Transfer",
                new { fromGym = scene.Gym.Name, toGym = "Atlantis", effectiveDate = Days(3).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);
            var unknownGym = await SendAsync(HttpMethod.Put, $"/api/action-requests/{badTransferId}/approve", null, scene.Token);
            var gymMessage = await AssertErrorAsync(unknownGym, HttpStatusCode.BadRequest);
            Assert.Contains("Unknown gym", gymMessage);

            var missing = await SendAsync(HttpMethod.Put, "/api/action-requests/9999999/approve", null, scene.Token);
            await AssertErrorAsync(missing, HttpStatusCode.NotFound);
        }

        // ------------------------------------------------------------------
        // PUT /api/action-requests/{id}/reject
        // ------------------------------------------------------------------

        [Fact]
        public async Task Reject_WithoutComment_Returns400()
        {
            var scene = await CreateSceneAsync("employees.transfer");
            var requestId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "Transfer",
                new { fromGym = scene.Gym.Name, toGym = "Elsewhere", effectiveDate = Days(3).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);

            var response = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/reject",
                new { comment = "" }, scene.Token);
            var message = await AssertErrorAsync(response, HttpStatusCode.BadRequest);
            Assert.False(string.IsNullOrWhiteSpace(message));
        }

        [Fact]
        public async Task Reject_WithComment_MarksRejected_AuditsLabelRequestRejected()
        {
            var scene = await CreateSceneAsync("employees.transfer");
            var requestId = await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId, scene.Employee.EmployeeId, "Transfer",
                new { fromGym = scene.Gym.Name, toGym = "Elsewhere", effectiveDate = Days(3).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);

            var response = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/reject",
                new { comment = "Hold until the Q1 budget clears" }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var data = (await ReadAsync(response)).GetProperty("data");
            Assert.Equal("Rejected", data.GetProperty("status").GetString());
            Assert.False(data.GetProperty("executed").GetBoolean());
            Assert.Equal("Hold until the Q1 budget clears", data.GetProperty("reviewComment").GetString());
            Assert.Equal(scene.Hr.Email.Split('@')[0], data.GetProperty("reviewedBy").GetString());

            var action = await Db.ActionRequests.AsNoTracking().SingleAsync(a => a.Id == requestId);
            Assert.Equal("Rejected", action.Status);
            Assert.Equal("Hold until the Q1 budget clears", action.ReviewComment);

            // The employee was NOT moved by a rejection.
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == scene.Employee.EmployeeId);
            Assert.Equal(scene.Gym.GymId, employee.GymId);

            // Mock-faithful audit label: "{Label} Request Rejected" → "Transfer Gym Request Rejected".
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Transfer Gym Request Rejected" && a.UserId == scene.Hr.UserId));

            // Rejecting twice is refused too.
            var again = await SendAsync(HttpMethod.Put, $"/api/action-requests/{requestId}/reject",
                new { comment = "Changed my mind" }, scene.Token);
            var message = await AssertErrorAsync(again, HttpStatusCode.BadRequest);
            Assert.Contains("already been decided", message);
        }
    }
}
