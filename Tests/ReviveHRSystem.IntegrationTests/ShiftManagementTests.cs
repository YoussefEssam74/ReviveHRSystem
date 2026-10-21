using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using Shared.DataTransferObject.Attendance;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Shift management (mock Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â§15-16): cycle create/publish/delete, assignment
    /// upserts (paint), template CRUD, feature gates and team scope. Employees only
    /// see published cycles through the Slice 1 schedule endpoint.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class ShiftManagementTests
    {
        private readonly ApiTestFixture _fixture;

        public ShiftManagementTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Templates_CRUD_And_AssignmentCleanup()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);

            // Create
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gym1Id}/shift-templates", new
            {
                name = "Split Shift",
                start = new TimeOnly(10, 0),
                end = new TimeOnly(18, 0)
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            var templateId = created.GetProperty("id").GetInt32();
            Assert.Equal("Split Shift", created.GetProperty("name").GetString());

            // Update
            var update = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-templates/{templateId}", new
            {
                name = "Split Shift (Late)",
                start = new TimeOnly(11, 0),
                end = new TimeOnly(19, 0)
            }, token);
            var updateResponse = await _fixture.Client.SendAsync(update);
            updateResponse.EnsureSuccessStatusCode();
            var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Split Shift (Late)", updated.GetProperty("name").GetString());

            // Use it in an assignment, then delete the template: the cell becomes an Off Day.
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3);
            var (cycleId, cycleDay) = await CreateCycleAsync(gym1Id, await _fixture.GetAdminTokenAsync(), day, employeeId);
            var assign = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/assignments", new
            {
                assignments = new[] { new { employeeId, date = cycleDay, shiftTemplateId = templateId } }
            }, token);
            (await _fixture.Client.SendAsync(assign)).EnsureSuccessStatusCode();

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/gyms/{gym1Id}/shift-templates/{templateId}", null, token);
            var deleteResponse = await _fixture.Client.SendAsync(delete);
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var assignment = await db.ShiftAssignments.FirstAsync(a => a.EmployeeId == employeeId && a.Date == cycleDay);
            Assert.Null(assignment.ShiftTemplateId);
        }

        [Fact]
        public async Task Template_InvalidTimeWindow_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);

            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gym1Id}/shift-templates", new
            {
                name = "Backwards",
                start = new TimeOnly(18, 0),
                end = new TimeOnly(9, 0)
            }, token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        /// <summary>
        /// Regression: the portal's &lt;input type="time"&gt; posts "HH:mm" (no seconds).
        /// TimeOnly's default JSON binder only accepted "HH:mm:ss", so creating a template
        /// from the UI answered 400 "validation error" while the API's own tests (which
        /// serialize TimeOnly objects into "HH:mm:ss") stayed green. The flexible
        /// TimeOnly converter now binds both shapes; responses keep "HH:mm:ss" so the
        /// frontend's .slice(0, 5) display is unchanged.
        /// </summary>
        [Fact]
        public async Task Template_Create_FromBrowserTimeInput_HHMM_BindsAndCreates()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);

            // Raw "HH:mm" strings — the exact payload the SPA sends.
            var payload = "{\"name\":\"Browser Time Input\",\"start\":\"08:00\",\"end\":\"16:00\"}";
            var create = new HttpRequestMessage(HttpMethod.Post, $"/api/gyms/{gym1Id}/shift-templates")
            {
                Content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json")
            };
            create.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var created = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("08:00:00", created.GetProperty("start").GetString());
            Assert.Equal("16:00:00", created.GetProperty("end").GetString());

            // Update with the same short format also binds.
            var templateId = created.GetProperty("id").GetInt32();
            var updatePayload = "{\"name\":\"Browser Time Input (v2)\",\"start\":\"09:30\",\"end\":\"17:45\"}";
            var update = new HttpRequestMessage(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-templates/{templateId}")
            {
                Content = new StringContent(updatePayload, System.Text.Encoding.UTF8, "application/json")
            };
            update.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var updateResponse = await _fixture.Client.SendAsync(update);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("09:30:00", updated.GetProperty("start").GetString());

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/gyms/{gym1Id}/shift-templates/{templateId}", null, token);
            (await _fixture.Client.SendAsync(delete)).EnsureSuccessStatusCode();
        }

        [Fact]
        public async Task Cycle_Publish_MakesScheduleVisibleToEmployee()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(4);
            var templateId = await AnyShiftTemplateIdAsync(gym1Id);

            var (cycleId, cycleDay) = await CreateCycleAsync(gym1Id, await _fixture.GetAdminTokenAsync(), day, employeeId);

            // Draft: the employee's schedule endpoint does not expose it yet.
            // Query the month of cycleDay (not the originally requested day): when
            // earlier tests in this class already occupy the preferred date,
            // FreeCycleDateAsync advances cycleDay, possibly into the next month.
            var draftSchedule = await GetEmployeeScheduleAsync(employeeId, cycleDay);
            Assert.DoesNotContain(draftSchedule, d => d == cycleDay);

            // Paint one employee + one day, then publish.
            var assign = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/assignments", new
            {
                assignments = new[] { new { employeeId, date = cycleDay, shiftTemplateId = templateId } }
            }, token);
            (await _fixture.Client.SendAsync(assign)).EnsureSuccessStatusCode();

            var publish = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/publish", new { }, token);
            var publishResponse = await _fixture.Client.SendAsync(publish);
            Assert.Equal(HttpStatusCode.NoContent, publishResponse.StatusCode);

            var publishedSchedule = await GetEmployeeScheduleAsync(employeeId, cycleDay);
            Assert.Contains(publishedSchedule, d => d == cycleDay);
        }

        [Fact]
        public async Task Cycle_Delete_RemovesAssignments()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5);
            var templateId = await AnyShiftTemplateIdAsync(gym1Id);

            var (cycleId, cycleDay) = await CreateCycleAsync(gym1Id, await _fixture.GetAdminTokenAsync(), day, employeeId);
            var assign = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/assignments", new
            {
                assignments = new[] { new { employeeId, date = cycleDay, shiftTemplateId = templateId } }
            }, token);
            (await _fixture.Client.SendAsync(assign)).EnsureSuccessStatusCode();

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}", null, token);
            var deleteResponse = await _fixture.Client.SendAsync(delete);
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            Assert.False(await db.ShiftCycles.AnyAsync(c => c.Id == cycleId));
            Assert.False(await db.ShiftAssignments.AnyAsync(a => a.ShiftCycleId == cycleId));
        }

        [Fact]
        public async Task Cycles_PlainEmployee_Returns401()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/gyms/{gym1Id}/shift-cycles", null, token);
            var response = await _fixture.Client.SendAsync(request);

            // The HR schedule controllers guard with schedule.view (ADR-003): no grant → 401.
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Assignments_TargetingOtherGymEmployee_Returns400()
        {
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var token = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var saraId = await OwnEmployeeIdAsync("sara@revive.hr");
            var day = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(6);

            var (cycleId, cycleDay) = await CreateCycleAsync(gym1Id, await _fixture.GetAdminTokenAsync(), day, saraId);
            var assign = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/gyms/{gym1Id}/shift-cycles/{cycleId}/assignments", new
            {
                assignments = new[] { new { employeeId = saraId, date = cycleDay, shiftTemplateId = (int?)null } }
            }, token);
            var response = await _fixture.Client.SendAsync(assign);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Template_Create_WithScheduleManageKeyOnly_Returns201()
        {
            // The portal shows "New Template" to anyone holding schedule.manage (the same
            // key /api/auth/me hands the UI). The write gate used to accept only per-gym
            // Team Leader / Branch Manager / Super Admin roles, so a holder of the key
            // through a direct grant or a global role was rejected with a misleading
            // "Shift cycle not found." — it must accept the key too.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var email = "tmplkey@revive.hr";

            string token;
            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var hasher = scope.ServiceProvider.GetRequiredService<ServiceAbstraction.Services.IPasswordHasher>();

                var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
                if (user is null)
                {
                    user = new DomainLayer.Models.UserModule.User
                    {
                        Email = email,
                        UserName = "tmplkey",
                        PasswordHash = hasher.Hash("Revive!2026"),
                        UserType = DomainLayer.Models.UserModule.Enums.UserType.Employee,
                        IsActive = true
                    };
                    db.Users.Add(user);
                    await db.SaveChangesAsync();
                }

                if (!await db.UserGymAccesses.AnyAsync(a => a.UserId == user.Id && a.GymId == gym1Id))
                {
                    db.UserGymAccesses.Add(new DomainLayer.Models.UserModule.UserGymAccess
                    {
                        UserId = user.Id,
                        GymId = gym1Id
                    });
                    await db.SaveChangesAsync();
                }

                // Direct grant only — deliberately no UserGymRoles row.
                var permissionId = await db.Permissions
                    .Where(p => p.Key == "schedule.manage")
                    .Select(p => p.Id)
                    .SingleAsync();
                if (!await db.UserPermissions.AnyAsync(up => up.UserId == user.Id && up.PermissionId == permissionId))
                {
                    db.UserPermissions.Add(new DomainLayer.Models.UserModule.UserPermission
                    {
                        UserId = user.Id,
                        PermissionId = permissionId
                    });
                    await db.SaveChangesAsync();
                }

                token = await _fixture.LoginAsync(email, "Revive!2026");
            }

            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gym1Id}/shift-templates", new
            {
                name = "Key Only Shift",
                start = new TimeOnly(9, 0),
                end = new TimeOnly(17, 0)
            }, token);
            var response = await _fixture.Client.SendAsync(create);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);

            using var verifyScope = _fixture.Services.CreateScope();
            var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            Assert.True(await verifyDb.ShiftTemplates.AnyAsync(
                t => t.GymId == gym1Id && t.Name == "Key Only Shift"));
        }

        // ---------- helpers ----------

        /// <summary>Drops a leftover assignment row so the (employee, date) unique index never blocks the paint.</summary>
        private async Task ClearAssignmentAsync(int employeeId, DateOnly day)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var stale = await db.ShiftAssignments
                .Where(a => a.EmployeeId == employeeId && a.Date == day)
                .ToListAsync();
            if (stale.Count > 0)
            {
                db.ShiftAssignments.RemoveRange(stale);
                await db.SaveChangesAsync();
            }
        }

        /// <summary>
        /// Picks a day the gym's existing cycles do not cover and where the target
        /// employee holds no assignment in any cycle. IgnoreQueryFilters matters: rows
        /// soft-deleted by earlier suites still occupy the (EmployeeId, Date) index.
        /// </summary>
        private async Task<DateOnly> FreeCycleDateAsync(int gymId, int employeeId, DateOnly preferred)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var cycles = await db.ShiftCycles.IgnoreQueryFilters()
                .Where(c => c.GymId == gymId)
                .ToListAsync();
            var busyDates = (await db.ShiftAssignments.IgnoreQueryFilters()
                .Where(a => a.EmployeeId == employeeId)
                .Select(a => a.Date)
                .ToListAsync())
                .ToHashSet();

            var day = preferred;
            while (cycles.Any(c => c.StartDate <= day && c.EndDate >= day) || busyDates.Contains(day))
            {
                day = day.AddDays(1);
            }

            return day;
        }

        private async Task<(int CycleId, DateOnly Day)> CreateCycleAsync(int gymId, string token, DateOnly day, int employeeId)
        {
            // The gym-level create is the HR schedule controller's (S3): Draft cycle, { data } envelope.
            var freeDay = await FreeCycleDateAsync(gymId, employeeId, day);
            var create = _fixture.AuthorizedRequest(HttpMethod.Post, $"/api/gyms/{gymId}/shift-cycles", new
            {
                startDate = freeDay.ToString("yyyy-MM-dd"),
                endDate = freeDay.ToString("yyyy-MM-dd")
            }, token);
            var createResponse = await _fixture.Client.SendAsync(create);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            return (created.GetProperty("data").GetProperty("id").GetInt32(), freeDay);
        }

        private async Task<List<DateOnly>> GetEmployeeScheduleAsync(int employeeId, DateOnly day)
        {
            // The scheduled employee reads his own published schedule (Slice 1 endpoint).
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/schedule?month={day:yyyy-MM}", null, token);
            var response = await _fixture.Client.SendAsync(request);
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.GetProperty("days").EnumerateArray()
                .Where(d => !d.GetProperty("isOff").GetBoolean())
                .Select(d => DateOnly.Parse(d.GetProperty("date").GetString()!))
                .ToList();
        }

        private async Task<string> LoginSelectingGymAsync(string email, int gymId)
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email, password = "Revive!2026" });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            var temp = loginBody.GetProperty("tempSessionToken").GetString()!;

            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new { gymId, tempSessionToken = temp });
            select.EnsureSuccessStatusCode();
            var selectBody = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selectBody.GetProperty("accessToken").GetString()!;
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        private async Task<int> AnyShiftTemplateIdAsync(int gymId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.ShiftTemplates.Where(t => t.GymId == gymId).OrderBy(t => t.Id).Select(t => t.Id).FirstAsync();
        }
    }
}
