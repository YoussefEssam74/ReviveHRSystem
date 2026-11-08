using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ReviveHRSystem.SecurityTests.Fixtures;
using ReviveHRSystem.SecurityTests.Support;
using Xunit;

namespace ReviveHRSystem.SecurityTests
{
    /// <summary>
    /// IDOR + team-scope behaviour that the matrix rows cover only in aggregate:
    /// the Team Leader must see (in list/detail) ONLY his own team members — not the
    /// gym-wide leaks the findings flagged (F1 requests-tab, F2 attendance-tab,
    /// F3 evaluations-tab behave gym-wide today, which the dedicated red probes
    /// document); cross-tenant targets must be hidden (404/401, never 2xx).
    /// </summary>
    [Trait("Suite", "Idor")]
    [Collection(SecurityApiFixture.CollectionName)]
    public class TenantIsolationTests(SecurityApiFixture fixture)
    {
        [Fact]
        public async Task Detail_Cross_Tenant_Twin_Never_2xx()
        {
            foreach (var twin in new[]
                     {
                         fixture.Context.TeamLeaderTwin, fixture.Context.BranchManagerTwin,
                         fixture.Context.HrTwin, fixture.Context.HrManagerTwin, fixture.Context.EmployeeTwin,
                     })
            {
                var token = await fixture.GetTokenAsync(twin);
                using var request = fixture.AuthorizedRequest(
                    HttpMethod.Get, $"/api/employees/{fixture.Context.KarimEmployeeId}", null, token);
                var response = await fixture.Client.SendAsync(request);
                var status = (int)response.StatusCode;

                Assert.True(status is 401 or 404,
                    $"Cross-tenant twin ({twin.Key}) received {status} for another gym's employee detail.");
            }
        }

        [Fact]
        public async Task TeamLeader_Detail_Of_Outsider_Is_Hidden()
        {
            var token = await fixture.GetTokenAsync(fixture.Context.TeamLeader);
            using var request = fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{fixture.Context.OutsiderEmployeeId}", null, token);
            var response = await fixture.Client.SendAsync(request);

            // Team scope: an employee outside the leader's team does not exist for him.
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Directory_List_As_TeamLeader_Contains_Only_Team_Members()
        {
            var token = await fixture.GetTokenAsync(fixture.Context.TeamLeader);
            using var request = fixture.AuthorizedRequest(HttpMethod.Get, "/api/employees", null, token);
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(json.TryGetProperty("items", out var items), "List envelope must expose 'items'.");

            // Identify records by ID, never by name: other matrix rows legitimately
            // mutate the target's display name during the run (rename/contract rows).
            var ids = items.EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToList();

            // Karim (team member) must be listed; the outsider must never appear.
            Assert.Contains(fixture.Context.KarimEmployeeId, ids);
            Assert.DoesNotContain(fixture.Context.OutsiderEmployeeId, ids);
        }

        [Fact]
        public async Task F1_Requests_Tab_Is_Team_Scoped_For_TeamLeader()
        {
            var token = await fixture.GetTokenAsync(fixture.Context.TeamLeader);
            using var request = fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{fixture.Context.OutsiderEmployeeId}/requests", null, token);
            var response = await fixture.Client.SendAsync(request);

            // MATRIX (desired): 404 hidden for non-team members. Today the endpoint
            // answers 200 gym-wide for any TL holding requests.view — known red.
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task F2_Attendance_Tab_Is_Team_Scoped_For_TeamLeader()
        {
            var token = await fixture.GetTokenAsync(fixture.Context.TeamLeader);
            using var request = fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{fixture.Context.OutsiderEmployeeId}/attendance", null, token);
            var response = await fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task F3_Evaluation_Tab_Is_Team_Scoped_For_TeamLeader()
        {
            var token = await fixture.GetTokenAsync(fixture.Context.TeamLeader);
            using var request = fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{fixture.Context.OutsiderEmployeeId}/evaluations", null, token);
            var response = await fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Cross_Tenant_Request_Attachment_Never_Leaks()
        {
            var token = await fixture.GetTokenAsync(fixture.Context.EmployeeTwin);
            using var request = fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/requests/{fixture.Context.KarimAttachedRequestId}/attachment", null, token);
            var response = await fixture.Client.SendAsync(request);

            Assert.True((int)response.StatusCode is 401 or 404);
        }
    }
}

