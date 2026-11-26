using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using ReviveHRSystem.Web.DataSeed;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Plan catalog, gym-side visibility, renewal/upgrade requests, explicit due
    /// dates and the reminder → grace notifications.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class SubscriptionPlansAndRequestsTests
    {
        private readonly ApiTestFixture _fixture;

        public SubscriptionPlansAndRequestsTests(ApiTestFixture fixture) => _fixture = fixture;

        private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
            await response.Content.ReadFromJsonAsync<JsonElement>();

        private async Task<int> GymIdAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).FirstAsync();
        }

        private async Task<string> LoginAsGymAdminAsync(string email, int gymId)
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email,
                password = DevelopmentDataSeeder.EmployeePassword
            });
            var body = await ReadJsonAsync(response);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            if (body.GetProperty("requiresGymSelection").GetBoolean())
            {
                var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
                {
                    gymId,
                    tempSessionToken = body.GetProperty("tempSessionToken").GetString()
                });
                var selectBody = await ReadJsonAsync(select);
                Assert.Equal(HttpStatusCode.OK, select.StatusCode);
                return selectBody.GetProperty("accessToken").GetString()!;
            }

            return body.GetProperty("accessToken").GetString()!;
        }

        private async Task<JsonElement> GetMySubscriptionAsync(string token)
        {
            var response = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/subscriptions/mine", null, token));
            return await ReadJsonAsync(response);
        }

        private async Task<JsonElement> GetDetailAsync(int gymId, string adminToken)
        {
            var response = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/subscriptions/{gymId}", null, adminToken));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await ReadJsonAsync(response);
        }

        private async Task<JsonElement> GetPlansAsync(string token)
        {
            var response = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/subscription-plans", null, token));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await ReadJsonAsync(response);
        }

        [Fact]
        public async Task GymAdmin_SeesOwnSubscription_ButOtherRolesCannot()
        {
            var gym1Id = await GymIdAsync(DevelopmentDataSeeder.Gym1Name);
            var gym2Id = await GymIdAsync(DevelopmentDataSeeder.Gym2Name);

            // Omar is Branch Manager at gym1 → allowed.
            var omarGym1 = await LoginAsGymAdminAsync("omar@revive.hr", gym1Id);
            var mine = await GetMySubscriptionAsync(omarGym1);
            Assert.Equal(gym1Id, mine.GetProperty("subscription").GetProperty("subscription").GetProperty("gymId").GetInt32());
            Assert.True(mine.GetProperty("availablePlans").GetArrayLength() >= 3);
            Assert.Equal(JsonValueKind.Array, mine.GetProperty("pendingRequests").ValueKind);

            // Omar is only Team Leader at gym2 → denied.
            var omarGym2 = await LoginAsGymAdminAsync("omar@revive.hr", gym2Id);
            var deniedTeamLeader = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/subscriptions/mine", null, omarGym2));
            Assert.Equal(HttpStatusCode.Unauthorized, deniedTeamLeader.StatusCode);

            // HR and employees are never gym management.
            foreach (var email in new[] { "hr@revive.hr", "karim@revive.hr" })
            {
                var token = await _fixture.LoginAsync(email, DevelopmentDataSeeder.EmployeePassword);
                var denied = await _fixture.Client.SendAsync(
                    _fixture.AuthorizedRequest(HttpMethod.Get, "/api/subscriptions/mine", null, token));
                Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
            }
        }

        [Fact]
        public async Task PlanChangeRequest_IsApproved_AndAppliesThePlan()
        {
            var adminToken = await _fixture.GetAdminTokenAsync();
            var gym1Id = await GymIdAsync(DevelopmentDataSeeder.Gym1Name);

            var originalDetail = await GetDetailAsync(gym1Id, adminToken);
            var original = originalDetail.GetProperty("subscription");
            var originalPlanId = original.GetProperty("planId").ValueKind == JsonValueKind.Null
                ? (int?)null
                : original.GetProperty("planId").GetInt32();
            var originalAmount = original.GetProperty("amount").GetDecimal();
            var originalCycle = original.GetProperty("billingCycleMonths").GetInt32();
            var originalGrace = original.GetProperty("gracePeriodDays").GetInt32();
            var originalReminder = original.GetProperty("reminderLeadDays").GetInt32();
            var originalAuto = original.GetProperty("autoSuspensionEnabled").GetBoolean();
            var originalStart = original.GetProperty("billingStartDate").GetString();

            var plans = await GetPlansAsync(adminToken);
            var targetPlan = plans.EnumerateArray().First(plan =>
                plan.GetProperty("isActive").GetBoolean() &&
                plan.GetProperty("id").GetInt32() != (originalPlanId ?? 0));

            try
            {
                var omar = await LoginAsGymAdminAsync("omar@revive.hr", gym1Id);
                var submit = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                    HttpMethod.Post,
                    "/api/subscriptions/mine/requests",
                    new
                    {
                        type = "PlanChange",
                        requestedPlanId = targetPlan.GetProperty("id").GetInt32(),
                        note = "Integration test upgrade."
                    },
                    omar));
                var submitted = await ReadJsonAsync(submit);
                Assert.Equal(HttpStatusCode.OK, submit.StatusCode);
                Assert.Equal("Pending", submitted.GetProperty("status").GetString());
                var requestId = submitted.GetProperty("id").GetInt32();

                var pending = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                    HttpMethod.Get, "/api/subscriptions/requests?status=Pending", null, adminToken));
                var pendingBody = await ReadJsonAsync(pending);
                Assert.Contains(
                    pendingBody.EnumerateArray(),
                    row => row.GetProperty("id").GetInt32() == requestId);

                var approve = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                    HttpMethod.Post,
                    $"/api/subscriptions/requests/{requestId}/approve",
                    new { note = "Approved in integration test." },
                    adminToken));
                Assert.Equal(HttpStatusCode.OK, approve.StatusCode);

                var changed = await GetDetailAsync(gym1Id, adminToken);
                var changedSubscription = changed.GetProperty("subscription");
                Assert.Equal(targetPlan.GetProperty("id").GetInt32(), changedSubscription.GetProperty("planId").GetInt32());
                Assert.Equal(targetPlan.GetProperty("pricePerCycle").GetDecimal(), changedSubscription.GetProperty("amount").GetDecimal());

                var mine = await GetMySubscriptionAsync(omar);
                Assert.Equal(targetPlan.GetProperty("name").GetString(),
                    mine.GetProperty("subscription").GetProperty("subscription").GetProperty("planName").GetString());
                Assert.Empty(mine.GetProperty("pendingRequests").EnumerateArray());
            }
            finally
            {
                var restore = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                    HttpMethod.Put,
                    $"/api/subscriptions/{gym1Id}",
                    new
                    {
                        amount = originalAmount,
                        billingCycleMonths = originalCycle,
                        gracePeriodDays = originalGrace,
                        reminderLeadDays = originalReminder,
                        autoSuspensionEnabled = originalAuto,
                        billingStartDate = originalStart,
                        planId = originalPlanId,
                    },
                    adminToken));
                Assert.Equal(HttpStatusCode.OK, restore.StatusCode);
            }
        }

        [Fact]
        public async Task PlanCatalog_IsAdminManaged_AndGymAdminsSeeActivePlansOnly()
        {
            var adminToken = await _fixture.GetAdminTokenAsync();
            var name = $"Integration Plan {Guid.NewGuid():N}"[..40];

            var create = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post,
                "/api/subscription-plans",
                new
                {
                    name,
                    description = "Created by an integration test.",
                    pricePerCycle = 1234m,
                    billingCycleMonths = 2,
                    gracePeriodDays = 5,
                    reminderLeadDays = 2,
                    isActive = true,
                    sortOrder = 99
                },
                adminToken));
            var created = await ReadJsonAsync(create);
            Assert.Equal(HttpStatusCode.OK, create.StatusCode);
            var planId = created.GetProperty("id").GetInt32();
            Assert.Equal(0, created.GetProperty("gymCount").GetInt32());

            var update = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put,
                $"/api/subscription-plans/{planId}",
                new
                {
                    name = $"{name} v2",
                    description = "Updated.",
                    pricePerCycle = 1500m,
                    billingCycleMonths = 3,
                    gracePeriodDays = 6,
                    reminderLeadDays = 3,
                    isActive = true,
                    sortOrder = 100
                },
                adminToken));
            Assert.Equal(HttpStatusCode.OK, update.StatusCode);

            var gym1Id = await GymIdAsync(DevelopmentDataSeeder.Gym1Name);
            var omar = await LoginAsGymAdminAsync("omar@revive.hr", gym1Id);
            var gymPlans = await GetPlansAsync(omar);
            Assert.Contains(gymPlans.EnumerateArray(), plan => plan.GetProperty("id").GetInt32() == planId);

            var archive = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Delete, $"/api/subscription-plans/{planId}", null, adminToken));
            Assert.Equal(HttpStatusCode.NoContent, archive.StatusCode);

            var gymPlansAfter = await GetPlansAsync(omar);
            Assert.DoesNotContain(gymPlansAfter.EnumerateArray(), plan => plan.GetProperty("id").GetInt32() == planId);

            var adminPlans = await GetPlansAsync(adminToken);
            var archived = adminPlans.EnumerateArray().First(plan => plan.GetProperty("id").GetInt32() == planId);
            Assert.False(archived.GetProperty("isActive").GetBoolean());

            var employee = await _fixture.LoginAsync("karim@revive.hr", DevelopmentDataSeeder.EmployeePassword);
            var denied = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/subscription-plans", null, employee));
            Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        }

        [Fact]
        public async Task ExplicitDueDate_DrivesReminderGraceAndSuspensionNotifications()
        {
            var adminToken = await _fixture.GetAdminTokenAsync();
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var today = builder.AttendanceToday;

            async Task SaveDueDateAsync(DateOnly dueDate)
            {
                var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                    HttpMethod.Put,
                    $"/api/subscriptions/{gym.GymId}",
                    new
                    {
                        amount = 1200m,
                        billingCycleMonths = 1,
                        gracePeriodDays = 7,
                        reminderLeadDays = 3,
                        autoSuspensionEnabled = true,
                        billingStartDate = today,
                        nextDueDate = dueDate
                    },
                    adminToken));
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            }

            async Task RunCycleAsync()
            {
                var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                    HttpMethod.Post, "/api/subscriptions/run-cycle", null, adminToken));
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            }

            // "Expiring soon" reminder for an invoice due in two days.
            await SaveDueDateAsync(today.AddDays(2));
            var firstDetail = await GetDetailAsync(gym.GymId, adminToken);
            Assert.Equal(today.AddDays(2).ToString("yyyy-MM-dd"),
                firstDetail.GetProperty("subscription").GetProperty("nextDueDate").GetString());
            await RunCycleAsync();

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                Assert.True(await db.Notifications.AnyAsync(n =>
                    n.UserId == employee.UserId && n.Title == "Subscription expiring soon"));
            }

            // Past the due date, inside grace: grace notification + GracePeriod status.
            await SaveDueDateAsync(today.AddDays(-2));
            await RunCycleAsync();

            var graceDetail = await GetDetailAsync(gym.GymId, adminToken);
            Assert.Equal("GracePeriod", graceDetail.GetProperty("subscription").GetProperty("status").GetString());

            using (var scope = _fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                Assert.True(await db.Notifications.AnyAsync(n =>
                    n.UserId == employee.UserId && n.Title == "Subscription grace period started"));
            }

            // Past grace: suspended + login refused with the required message.
            await SaveDueDateAsync(today.AddDays(-10));
            await RunCycleAsync();

            var suspendedDetail = await GetDetailAsync(gym.GymId, adminToken);
            Assert.Equal("Suspended", suspendedDetail.GetProperty("subscription").GetProperty("status").GetString());

            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
            {
                email = employee.Email,
                password = employee.Password
            });
            var loginBody = await ReadJsonAsync(login);
            Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
            Assert.Equal(SubscriptionMessages.SuspensionMessage, loginBody.GetProperty("errorMessage").GetString());
        }
    }
}
