using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Constants;
using DomainLayer.Models.SubscriptionModule;
using DomainLayer.Models.SubscriptionModule.Enums;
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
    /// Subscription management &amp; automated access control:
    /// suspension blocks sign-in and live sessions, the sweep persists the state,
    /// recording payment restores access, and Revive Admin alone can manage billing.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class SubscriptionBillingTests
    {
        private readonly ApiTestFixture _fixture;

        public SubscriptionBillingTests(ApiTestFixture fixture) => _fixture = fixture;

        private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
            await response.Content.ReadFromJsonAsync<JsonElement>();

        [Fact]
        public async Task SuspendedGym_BlocksNewLoginAndExistingSession_WithSuspensionMessage()
        {
            var adminToken = await _fixture.GetAdminTokenAsync();
            var karimToken = await _fixture.LoginAsync("karim@revive.hr", DevelopmentDataSeeder.EmployeePassword);

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var gym1Id = await db.Gyms
                .Where(g => g.Name == DevelopmentDataSeeder.Gym1Name)
                .Select(g => g.Id)
                .FirstAsync();
            var subscription = await db.GymSubscriptions.FirstAsync(s => s.GymId == gym1Id);

            var originalStatus = subscription.Status;
            var originalManual = subscription.IsSuspensionManual;
            var originalReason = subscription.SuspensionReason;

            subscription.Status = SubscriptionStatus.Suspended;
            subscription.IsSuspensionManual = true;
            subscription.SuspendedAtUtc = DateTime.UtcNow;
            subscription.SuspensionReason = "Integration test suspension.";
            await db.SaveChangesAsync();

            try
            {
                var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
                {
                    email = "karim@revive.hr",
                    password = DevelopmentDataSeeder.EmployeePassword
                });
                var loginBody = await ReadJsonAsync(login);

                Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
                Assert.Equal(SubscriptionMessages.SuspensionMessage, loginBody.GetProperty("errorMessage").GetString());

                var liveSession = await _fixture.Client.SendAsync(
                    _fixture.AuthorizedRequest(HttpMethod.Get, "/api/gyms", null, karimToken));
                Assert.Equal(HttpStatusCode.Unauthorized, liveSession.StatusCode);

                // Revive Admin is never locked out by a gym suspension.
                var adminLogin = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new
                {
                    email = DevelopmentDataSeeder.AdminEmail,
                    password = DevelopmentDataSeeder.EmployeePassword
                });
                Assert.Equal(HttpStatusCode.OK, adminLogin.StatusCode);

                // The admin can still read the billing state.
                var overview = await _fixture.Client.SendAsync(
                    _fixture.AuthorizedRequest(HttpMethod.Get, "/api/subscriptions", null, adminToken));
                Assert.Equal(HttpStatusCode.OK, overview.StatusCode);
            }
            finally
            {
                subscription.Status = originalStatus;
                subscription.IsSuspensionManual = originalManual;
                subscription.SuspensionReason = originalReason;
                subscription.SuspendedAtUtc = null;
                await db.SaveChangesAsync();
            }
        }

        [Fact]
        public async Task OverdueSubscription_IsSuspendedBySweep_AndPaymentRestoresAccess()
        {
            var adminToken = await _fixture.GetAdminTokenAsync();
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);

            // A cycle anchored just over two months back puts the current period's
            // due date yesterday; a zero-day grace window is therefore already over.
            var billingStart = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1).AddMonths(-2);
            var save = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Put,
                $"/api/subscriptions/{gym.GymId}",
                new
                {
                    amount = 1000m,
                    billingCycleMonths = 1,
                    gracePeriodDays = 0,
                    reminderLeadDays = 0,
                    autoSuspensionEnabled = true,
                    billingStartDate = billingStart
                },
                adminToken));
            Assert.Equal(HttpStatusCode.OK, save.StatusCode);

            // Enforcement is date-based, so sign-in is already refused before the sweep.
            var blockedLogin = await PostLoginAsync(employee.Email, employee.Password);
            Assert.Equal(HttpStatusCode.Unauthorized, blockedLogin.Status);
            Assert.Equal(SubscriptionMessages.SuspensionMessage, blockedLogin.Body.GetProperty("errorMessage").GetString());

            var cycle = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/subscriptions/run-cycle", null, adminToken));
            var cycleBody = await ReadJsonAsync(cycle);
            Assert.Equal(HttpStatusCode.OK, cycle.StatusCode);
            Assert.True(cycleBody.GetProperty("gymsSuspended").GetInt32() >= 1);
            Assert.True(cycleBody.GetProperty("overdueNoticesSent").GetInt32() >= 1);

            var suspendedDetail = await GetDetailAsync(gym.GymId, adminToken);
            Assert.Equal("Suspended", suspendedDetail.GetProperty("subscription").GetProperty("status").GetString());

            var outstanding = suspendedDetail.GetProperty("subscription").GetProperty("outstandingAmount").GetDecimal();
            Assert.True(outstanding > 0);

            var payment = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post,
                $"/api/subscriptions/{gym.GymId}/payments",
                new { amount = outstanding, method = "BankTransfer", reference = "IT-PAY-1" },
                adminToken));
            var paymentBody = await ReadJsonAsync(payment);
            Assert.Equal(HttpStatusCode.OK, payment.StatusCode);
            Assert.Contains("restored", paymentBody.GetProperty("message").GetString()!);

            var activeDetail = await GetDetailAsync(gym.GymId, adminToken);
            Assert.Equal("Active", activeDetail.GetProperty("subscription").GetProperty("status").GetString());
            Assert.Equal(0m, activeDetail.GetProperty("subscription").GetProperty("outstandingAmount").GetDecimal());

            var restoredLogin = await PostLoginAsync(employee.Email, employee.Password);
            Assert.Equal(HttpStatusCode.OK, restoredLogin.Status);
            Assert.False(string.IsNullOrWhiteSpace(restoredLogin.Body.GetProperty("accessToken").GetString()));
        }

        [Fact]
        public async Task NonAdmin_CannotReadOrManageSubscriptions()
        {
            var karimToken = await _fixture.LoginAsync("karim@revive.hr", DevelopmentDataSeeder.EmployeePassword);

            var overview = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/subscriptions", null, karimToken));

            Assert.Equal(HttpStatusCode.Unauthorized, overview.StatusCode);
        }

        [Fact]
        public async Task PlatformSettings_AreConfigurable()
        {
            var adminToken = await _fixture.GetAdminTokenAsync();
            var overview = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, "/api/subscriptions", null, adminToken));
            var original = (await ReadJsonAsync(overview)).GetProperty("settings");

            var originalCycle = original.GetProperty("defaultBillingCycleMonths").GetInt32();
            var originalGrace = original.GetProperty("defaultGracePeriodDays").GetInt32();
            var originalLead = original.GetProperty("reminderLeadDays").GetInt32();
            var originalAutoSuspend = original.GetProperty("autoSuspensionEnabled").GetBoolean();
            var originalCurrency = original.GetProperty("currency").GetString() ?? "EGP";

            try
            {
                var update = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                    HttpMethod.Put,
                    "/api/subscriptions/settings",
                    new
                    {
                        defaultBillingCycleMonths = 2,
                        defaultGracePeriodDays = 10,
                        reminderLeadDays = 5,
                        autoSuspensionEnabled = false,
                        currency = "usd"
                    },
                    adminToken));
                Assert.Equal(HttpStatusCode.OK, update.StatusCode);
                var updated = await ReadJsonAsync(update);
                Assert.Equal(2, updated.GetProperty("defaultBillingCycleMonths").GetInt32());
                Assert.Equal(10, updated.GetProperty("defaultGracePeriodDays").GetInt32());
                Assert.Equal(5, updated.GetProperty("reminderLeadDays").GetInt32());
                Assert.False(updated.GetProperty("autoSuspensionEnabled").GetBoolean());
                Assert.Equal("USD", updated.GetProperty("currency").GetString());
            }
            finally
            {
                var restore = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                    HttpMethod.Put,
                    "/api/subscriptions/settings",
                    new
                    {
                        defaultBillingCycleMonths = originalCycle,
                        defaultGracePeriodDays = originalGrace,
                        reminderLeadDays = originalLead,
                        autoSuspensionEnabled = originalAutoSuspend,
                        currency = originalCurrency
                    },
                    adminToken));
                Assert.Equal(HttpStatusCode.OK, restore.StatusCode);
            }
        }

        private async Task<(HttpStatusCode Status, JsonElement Body)> PostLoginAsync(string email, string password)
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email, password });
            return (response.StatusCode, await ReadJsonAsync(response));
        }

        private async Task<JsonElement> GetDetailAsync(int gymId, string token)
        {
            var response = await _fixture.Client.SendAsync(
                _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/subscriptions/{gymId}", null, token));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await ReadJsonAsync(response);
        }
    }
}
