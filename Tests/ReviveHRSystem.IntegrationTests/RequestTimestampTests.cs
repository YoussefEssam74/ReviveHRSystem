using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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
    /// The request drawer and the request tables must report the same instants: the
    /// submission time and the branch-manager approval time come from one source, so a
    /// row can never disagree with its own timeline about when something happened.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class RequestTimestampTests
    {
        private readonly ApiTestFixture _fixture;

        public RequestTimestampTests(ApiTestFixture fixture) => _fixture = fixture;

        private ReviveHrDbContext Db => _fixture.Services.GetRequiredService<ReviveHrDbContext>();

        [Fact]
        public async Task DrawerAndInbox_ReportTheSameSubmittedAndApprovedInstants()
        {
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var submittedAt = DateTime.UtcNow.AddMinutes(-30);
            var requestId = await builder.CreateLeaveRequestAsync(
                employee.EmployeeId, "Annual Leave", new DateOnly(2027, 3, 8), new DateOnly(2027, 3, 9),
                DomainLayer.Models.RequestModule.Enums.RequestStatus.Pending);

            // Fix the submission instant so the assertions are exact.
            var seeded = await Db.EmployeeRequests.SingleAsync(r => r.Id == requestId);
            seeded.SubmittedAt = submittedAt;
            await Db.SaveChangesAsync();

            var manager = await builder.CreateUserAsync(UserType.TopManagement, [gym]);
            await GrantGymRoleAsync(manager.UserId, gym.GymId, "Branch Manager");
            var managerToken = await LoginAsync(manager.Email, manager.Password, gym.GymId);

            var approve = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Post, $"/api/requests/{requestId}/decisions", new { decision = "Approve" }, managerToken));
            Assert.Equal(HttpStatusCode.NoContent, approve.StatusCode);

            var detailResponse = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/requests/{requestId}", null, managerToken));
            Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
            var detail = (await detailResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

            var submitted = detail.GetProperty("submittedAt").GetDateTime();
            var approvedAt = detail.GetProperty("bmDecidedAt").GetDateTime();
            Assert.Equal(submittedAt, submitted, TimeSpan.FromSeconds(1));

            var steps = detail.GetProperty("timeline").EnumerateArray().ToList();
            Assert.Equal(submitted, steps.Single(s => s.GetProperty("step").GetString() == "Submitted")
                .GetProperty("occurredAt").GetDateTime());
            Assert.Equal(approvedAt, steps.Single(s => s.GetProperty("step").GetString() == "BM Approved")
                .GetProperty("occurredAt").GetDateTime());

            var inboxResponse = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/requests/inbox?status=PendingHRReview", null, managerToken));
            Assert.Equal(HttpStatusCode.OK, inboxResponse.StatusCode);
            var inbox = await inboxResponse.Content.ReadFromJsonAsync<JsonElement>();
            var row = inbox.GetProperty("items").EnumerateArray()
                .Single(item => item.GetProperty("id").GetInt32() == requestId);

            // Same instants as the drawer — that is what the table's two date columns print.
            Assert.Equal(submitted, row.GetProperty("submittedAt").GetDateTime());
            Assert.Equal(approvedAt, row.GetProperty("bmDecidedAt").GetDateTime());
        }

        private async Task GrantGymRoleAsync(int userId, int gymId, string roleName)
        {
            Db.UserRoles.Add(new DomainLayer.Models.UserModule.UserRole
            {
                UserId = userId,
                GymId = gymId,
                RoleName = roleName,
            });
            await Db.SaveChangesAsync();
        }

        private async Task<string> LoginAsync(string email, string password, int gymId)
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email, password });
            login.EnsureSuccessStatusCode();
            var body = await login.Content.ReadFromJsonAsync<JsonElement>();

            if (body.TryGetProperty("accessToken", out var direct) && direct.ValueKind == JsonValueKind.String)
            {
                return direct.GetString()!;
            }

            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym", new
            {
                gymId,
                tempSessionToken = body.GetProperty("tempSessionToken").GetString()!,
            });
            select.EnsureSuccessStatusCode();
            var selected = await select.Content.ReadFromJsonAsync<JsonElement>();
            return selected.GetProperty("accessToken").GetString()!;
        }
    }
}
