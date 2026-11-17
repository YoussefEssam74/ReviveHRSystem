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
    /// Roles &amp; Permissions module (S2): paged roles list, create/clone/update,
    /// wholesale permission replacement, archive (with the assigned-users guard),
    /// the permission catalog (6.7 + My Access matrix), user-level assignment
    /// (direct permissions / single role / gym access — 6.4–6.6), and the
    /// employee role-change endpoint (E16).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class RolesControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public RolesControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        // ------------------------------------------------------------------
        // GET /api/roles — list
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetRoles_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/roles");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetRoles_HrWithoutTeamView_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/roles", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetRoles_Admin_ReturnsEnvelopeWithItems()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var roleName = UniqueRoleName("List Probe");
            var created = await CreateRoleAsync(token, roleName);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/roles", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(body.TryGetProperty("page", out _));
            Assert.True(body.TryGetProperty("pageSize", out _));
            Assert.True(body.TryGetProperty("total", out _));
            Assert.True(body.TryGetProperty("totalPages", out _));

            var items = body.GetProperty("items").EnumerateArray().ToList();
            var item = Assert.Single(items, i => i.GetProperty("id").GetInt32() == created.GetProperty("id").GetInt32());
            Assert.Equal(roleName, item.GetProperty("name").GetString());
            Assert.Equal("Active", item.GetProperty("status").GetString());
            Assert.True(item.GetProperty("isEmpty").GetBoolean());
            Assert.False(item.GetProperty("isPreset").GetBoolean());
            Assert.Equal(0, item.GetProperty("permissionsCount").GetInt32());
            Assert.Equal(0, item.GetProperty("usersCount").GetInt32());
        }

        [Fact]
        public async Task GetRoles_Search_FiltersByName()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var alphaName = UniqueRoleName("Alpha Rangers");
            var betaName = UniqueRoleName("Beta Squad");
            await CreateRoleAsync(token, alphaName);
            await CreateRoleAsync(token, betaName);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/roles?search=Alpha%20Rangers", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var items = body.GetProperty("items").EnumerateArray().ToList();
            Assert.Contains(items, i => i.GetProperty("name").GetString() == alphaName);
            Assert.DoesNotContain(items, i => i.GetProperty("name").GetString() == betaName);
        }

        // ------------------------------------------------------------------
        // POST /api/roles — create
        // ------------------------------------------------------------------

        [Fact]
        public async Task CreateRole_Returns201WithPermissions()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var name = UniqueRoleName("Creator");

            var response = await SendAsync(HttpMethod.Post, "/api/roles", token, new
            {
                name,
                description = "Handles onboarding",
                permissions = new[] { "employees.view", "employees.create" },
            });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = body.GetProperty("data");

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal(name, data.GetProperty("name").GetString());
            Assert.Equal("Handles onboarding", data.GetProperty("description").GetString());
            Assert.Equal("Active", data.GetProperty("status").GetString());
            Assert.False(data.GetProperty("isEmpty").GetBoolean());
            Assert.Equal(2, data.GetProperty("permissionsCount").GetInt32());
            // Keys are returned sorted ordinal.
            Assert.Equal(
                new[] { "employees.create", "employees.view" },
                data.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).ToArray());
        }

        [Fact]
        public async Task CreateRole_WhitespaceName_Returns400()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(HttpMethod.Post, "/api/roles", token, new { name = "   " });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateRole_DuplicateNameDifferentCase_Returns400()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var name = UniqueRoleName("Dup Role");
            await CreateRoleAsync(token, name);

            var response = await SendAsync(HttpMethod.Post, "/api/roles", token, new { name = name.ToUpperInvariant() });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateRole_UnknownPermissionKey_Returns400()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(HttpMethod.Post, "/api/roles", token, new
            {
                name = UniqueRoleName("Bad Key"),
                permissions = new[] { "not.a.real.key" },
            });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateRole_CloneFromRoleId_CopiesPermissions()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var source = await CreateRoleAsync(token, UniqueRoleName("Template"),
                new[] { "attendance.view", "schedule.view" });

            var cloneName = UniqueRoleName("Cloned Draft");
            var response = await SendAsync(HttpMethod.Post, "/api/roles", token, new
            {
                name = cloneName,
                cloneFromRoleId = source.GetProperty("id").GetInt32(),
            });
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal(
                new[] { "attendance.view", "schedule.view" },
                data.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).ToArray());
        }

        // ------------------------------------------------------------------
        // PUT /api/roles/{id} — update
        // ------------------------------------------------------------------

        [Fact]
        public async Task UpdateRole_ChangesNameDescriptionAndPermissions()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var role = await CreateRoleAsync(token, UniqueRoleName("Before"), new[] { "employees.view" });
            var roleId = role.GetProperty("id").GetInt32();
            var newName = UniqueRoleName("After");

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/roles/{roleId}", new
            {
                name = newName,
                description = "Updated by test",
                permissions = new[] { "audit.view" },
            }, token);
            var response = await _fixture.Client.SendAsync(request);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(roleId, data.GetProperty("id").GetInt32());
            Assert.Equal(newName, data.GetProperty("name").GetString());
            Assert.Equal("Updated by test", data.GetProperty("description").GetString());
            Assert.Equal(new[] { "audit.view" },
                data.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).ToArray());
        }

        [Fact]
        public async Task UpdateRole_KeepingOwnName_IsAllowed()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var name = UniqueRoleName("Self Rename");
            var role = await CreateRoleAsync(token, name);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/roles/{role.GetProperty("id").GetInt32()}", new { name }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task UpdateRole_DuplicateOtherRoleName_Returns400()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var roleA = await CreateRoleAsync(token, UniqueRoleName("Taken Name"));
            var roleB = await CreateRoleAsync(token, UniqueRoleName("Other Role"));

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/roles/{roleB.GetProperty("id").GetInt32()}",
                new { name = roleA.GetProperty("name").GetString() }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // PUT /api/roles/{id}/permissions — wholesale replacement
        // ------------------------------------------------------------------

        [Fact]
        public async Task SetPermissions_ReplacesSetWholesale()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var role = await CreateRoleAsync(token, UniqueRoleName("Configurable"),
                new[] { "employees.view", "employees.create" });
            var roleId = role.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/roles/{roleId}/permissions",
                new { permissions = new[] { "reports.view", "audit.view" } }, token);
            var response = await _fixture.Client.SendAsync(request);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(roleId, data.GetProperty("id").GetInt32());
            // The old keys are gone — replacement, not merge.
            Assert.Equal(new[] { "audit.view", "reports.view" },
                data.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).ToArray());
        }

        // ------------------------------------------------------------------
        // POST /api/roles/{id}/clone
        // ------------------------------------------------------------------

        [Fact]
        public async Task CloneRole_Returns201AndCopiesPermissions()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var source = await CreateRoleAsync(token, UniqueRoleName("Source"),
                new[] { "payroll.view", "payroll.approve" });
            var sourceId = source.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/roles/{sourceId}/clone",
                new { name = UniqueRoleName("Copy") }, token);
            var response = await _fixture.Client.SendAsync(request);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal(
                new[] { "payroll.approve", "payroll.view" },
                data.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).ToArray());
        }

        [Fact]
        public async Task CloneRole_DuplicateName_Returns400()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var existing = await CreateRoleAsync(token, UniqueRoleName("Occupied"));
            var source = await CreateRoleAsync(token, UniqueRoleName("Donor"));

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/roles/{source.GetProperty("id").GetInt32()}/clone",
                new { name = existing.GetProperty("name").GetString() }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // DELETE /api/roles/{id} — archive
        // ------------------------------------------------------------------

        [Fact]
        public async Task ArchiveRole_Returns204AndHidesFromList()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var name = UniqueRoleName("Doomed");
            var role = await CreateRoleAsync(token, name);
            var roleId = role.GetProperty("id").GetInt32();

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/roles/{roleId}", null, token);
            var deleteResponse = await _fixture.Client.SendAsync(delete);
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            var list = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/roles?search={Uri.EscapeDataString(name)}", null, token);
            var listResponse = await _fixture.Client.SendAsync(list);
            var body = await listResponse.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Empty(body.GetProperty("items").EnumerateArray());
        }

        [Fact]
        public async Task ArchiveRole_AssignedToUser_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();
            var role = await CreateRoleAsync(token, UniqueRoleName("In Use"));
            var roleId = role.GetProperty("id").GetInt32();

            // Assign the role first — archive must refuse to silently strip access.
            var assign = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/users/{user.UserId}/roles", new { roleId }, token);
            var assignResponse = await _fixture.Client.SendAsync(assign);
            Assert.Equal(HttpStatusCode.OK, assignResponse.StatusCode);

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, $"/api/roles/{roleId}", null, token);
            var response = await _fixture.Client.SendAsync(delete);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task ArchiveRole_Unknown_Returns404()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var delete = _fixture.AuthorizedRequest(HttpMethod.Delete, "/api/roles/99999999", null, token);
            var response = await _fixture.Client.SendAsync(delete);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task CreateRole_HrWithoutTeamManage_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var response = await SendAsync(HttpMethod.Post, "/api/roles", token, new { name = UniqueRoleName("Nope") });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // GET /api/permissions — catalog
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetPermissions_ReturnsSeededCatalogBothViews()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/permissions", null, token);
            var response = await _fixture.Client.SendAsync(request);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // >= (not ==): TestDataBuilder.GrantPermissionAsync may add extra keys.
            Assert.True(data.GetProperty("totalTracked").GetInt32() >= 47);

            var items = data.GetProperty("items").EnumerateArray().ToList();
            Assert.Contains(items, i =>
                i.GetProperty("key").GetString() == "employees.view"
                && i.GetProperty("area").GetString() == "Employees");

            var modules = data.GetProperty("modules").EnumerateArray().ToList();
            Assert.Contains(modules, m =>
                m.GetProperty("name").GetString() == "Employees"
                && m.GetProperty("permissions").EnumerateArray().Any(p => p.GetString() == "employees.view"));
            Assert.Contains(modules, m =>
                m.GetProperty("name").GetString() == "Teams"
                && m.GetProperty("permissions").EnumerateArray().Any(p => p.GetString() == "team.manage"));
        }

        // ------------------------------------------------------------------
        // PUT /api/users/{id}/permissions — direct permission replacement (6.4)
        // ------------------------------------------------------------------

        [Fact]
        public async Task ReplaceUserPermissions_UnknownUser_Returns404()
        {
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(
                HttpMethod.Put, "/api/users/99999999/permissions", token, new { permissions = new[] { "audit.view" } });

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task ReplaceUserPermissions_UnknownKey_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(
                HttpMethod.Put, $"/api/users/{user.UserId}/permissions", token,
                new { permissions = new[] { "not.a.real.key" } });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task ReplaceUserPermissions_ReplacesAndReportsEffective()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();

            // Seed one key directly, then replace — the direct key must disappear.
            await builder.GrantPermissionAsync(user.UserId, "schedule.view");

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/users/{user.UserId}/permissions",
                new { permissions = new[] { "audit.view" } }, token);
            var response = await _fixture.Client.SendAsync(request);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(user.UserId, data.GetProperty("userId").GetInt32());
            Assert.Equal(new[] { "audit.view" },
                data.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).ToArray());
            Assert.Contains("audit.view",
                data.GetProperty("effectivePermissions").EnumerateArray().Select(p => p.GetString()).ToArray());
            Assert.DoesNotContain("schedule.view",
                data.GetProperty("effectivePermissions").EnumerateArray().Select(p => p.GetString()).ToArray());
        }

        // ------------------------------------------------------------------
        // PUT /api/users/{id}/roles — single-role assignment (6.5)
        // ------------------------------------------------------------------

        [Fact]
        public async Task ReplaceUserRoles_ByRoleId_AssignsRole()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();
            var role = await CreateRoleAsync(token, UniqueRoleName("Assigned By Id"));
            var roleId = role.GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/users/{user.UserId}/roles", new { roleId }, token);
            var response = await _fixture.Client.SendAsync(request);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(roleId, data.GetProperty("roleId").GetInt32());
            Assert.Equal(role.GetProperty("name").GetString(), data.GetProperty("rolePreset").GetString());
        }

        [Fact]
        public async Task ReplaceUserRoles_ByPresetName_AssignsRole()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();
            var role = await CreateRoleAsync(token, UniqueRoleName("Preset Role"),
                new[] { "requests.view.team" });
            var roleName = role.GetProperty("name").GetString()!;

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/users/{user.UserId}/roles", new { rolePreset = roleName }, token);
            var response = await _fixture.Client.SendAsync(request);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(role.GetProperty("id").GetInt32(), data.GetProperty("roleId").GetInt32());
            // Effective permissions now include the role's keys.
            Assert.Contains("requests.view.team",
                data.GetProperty("effectivePermissions").EnumerateArray().Select(p => p.GetString()).ToArray());
        }

        [Fact]
        public async Task ReplaceUserRoles_UnknownPreset_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(
                HttpMethod.Put, $"/api/users/{user.UserId}/roles", token,
                new { rolePreset = "Ghost Preset" });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task ReplaceUserRoles_BothIdAndPreset_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();
            var role = await CreateRoleAsync(token, UniqueRoleName("Ambiguous"));

            var response = await SendAsync(
                HttpMethod.Put, $"/api/users/{user.UserId}/roles", token,
                new
                {
                    roleId = role.GetProperty("id").GetInt32(),
                    rolePreset = role.GetProperty("name").GetString(),
                });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task ReplaceUserRoles_BothNull_ClearsRoles()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();
            var role = await CreateRoleAsync(token, UniqueRoleName("To Clear"));

            var assign = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/users/{user.UserId}/roles",
                new { roleId = role.GetProperty("id").GetInt32() }, token);
            var assignResponse = await _fixture.Client.SendAsync(assign);
            Assert.Equal(HttpStatusCode.OK, assignResponse.StatusCode);

            var clear = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/users/{user.UserId}/roles",
                new { roleId = (int?)null, rolePreset = (string?)null }, token);
            var clearResponse = await _fixture.Client.SendAsync(clear);
            var data = (await clearResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, clearResponse.StatusCode);
            Assert.Equal(JsonValueKind.Null, data.GetProperty("roleId").ValueKind);
            Assert.Equal(JsonValueKind.Null, data.GetProperty("rolePreset").ValueKind);
        }

        // ------------------------------------------------------------------
        // PUT /api/users/{id}/gym-access — gym replacement (6.6)
        // ------------------------------------------------------------------

        [Fact]
        public async Task ReplaceGymAccess_ByNames_ReplacesAccess()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gymA });
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/users/{user.UserId}/gym-access",
                new { gyms = new[] { gymB.Name } }, token);
            var response = await _fixture.Client.SendAsync(request);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            // gymA was replaced away — only gymB remains.
            Assert.Equal(new[] { gymB.GymId },
                data.GetProperty("gymIds").EnumerateArray().Select(g => g.GetInt32()).ToArray());
        }

        [Fact]
        public async Task ReplaceGymAccess_UnknownGym_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(
                HttpMethod.Put, $"/api/users/{user.UserId}/gym-access", token,
                new { gyms = new[] { "No Such Gym" } });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task ReplaceGymAccess_EmptySet_RevokesAll()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new[] { gym });
            var token = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/users/{user.UserId}/gym-access",
                new { gymIds = Array.Empty<int>(), gyms = Array.Empty<string>() }, token);
            var response = await _fixture.Client.SendAsync(request);
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Empty(data.GetProperty("gymIds").EnumerateArray());
        }

        // ------------------------------------------------------------------
        // POST /api/employees/{id}/role-change — E16
        // ------------------------------------------------------------------

        [Fact]
        public async Task RoleChange_AssignsRoleAndWritesHistory()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            // The role must exist first — presets are created via 7.2, not seeded.
            var role = await CreateRoleAsync(token, UniqueRoleName("Branch Manager"),
                new[] { "requests.approve.team" });
            var roleName = role.GetProperty("name").GetString()!;

            var response = await SendAsync(
                HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/role-change", token,
                new { systemRole = roleName, permissions = new[] { "attendance.view" } });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Role changed.", body.GetProperty("message").GetString());

            var history = await GetHistoryAsync(token, employee.EmployeeId);
            var entry = Assert.Single(history, h => h.GetProperty("type").GetString() == "Role Changed");
            Assert.Equal("None (Employee)", entry.GetProperty("from").GetString());
            Assert.Equal(roleName, entry.GetProperty("to").GetString());
        }

        [Fact]
        public async Task RoleChange_None_ClearsRole()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();
            var role = await CreateRoleAsync(token, UniqueRoleName("Temporary"));
            var roleName = role.GetProperty("name").GetString()!;

            var assign = await SendAsync(
                HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/role-change", token,
                new { systemRole = roleName });
            Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

            var clear = await SendAsync(
                HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/role-change", token,
                new { systemRole = "None (Employee)" });
            Assert.Equal(HttpStatusCode.OK, clear.StatusCode);

            var history = await GetHistoryAsync(token, employee.EmployeeId);
            var clearEntry = Assert.Single(history.Where(h =>
                h.GetProperty("to").GetString() == "None (Employee)"));
            Assert.Equal(roleName, clearEntry.GetProperty("from").GetString());
        }

        [Fact]
        public async Task RoleChange_UnknownRole_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(
                HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/role-change", token,
                new { systemRole = "Ghost Role" });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task RoleChange_UnknownPermissionKey_Returns400()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.GetAdminTokenAsync();

            var response = await SendAsync(
                HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/role-change", token,
                new { systemRole = "None (Employee)", permissions = new[] { "not.a.real.key" } });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task RoleChange_HrWithoutPermission_Returns401()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var hrToken = await _fixture.LoginAsync(hr.Email, hr.Password);

            var response = await SendAsync(
                HttpMethod.Post, $"/api/employees/{employee.EmployeeId}/role-change", hrToken,
                new { systemRole = "None (Employee)" });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private static string UniqueRoleName(string prefix) => $"{prefix} {Guid.NewGuid():N}";

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, string token, object body)
        {
            var request = _fixture.AuthorizedRequest(method, url, body, token);
            return await _fixture.Client.SendAsync(request);
        }

        /// <summary>Creates a role through the API and returns its { data } payload.</summary>
        private async Task<JsonElement> CreateRoleAsync(string token, string name, string[]? permissions = null)
        {
            var response = await SendAsync(HttpMethod.Post, "/api/roles", token, new
            {
                name,
                permissions,
            });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.GetProperty("data");
        }

        private async Task<List<JsonElement>> GetHistoryAsync(string token, int employeeId)
        {
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/history", null, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.EnumerateArray().ToList();
        }
    }
}
