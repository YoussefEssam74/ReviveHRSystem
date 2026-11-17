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
    /// Notifications &amp; announcements (api-spec-from-ui.md §5.7): the signed-in
    /// user's inbox (list / unread badge / mark one read / mark all read, category
    /// and unread filters) and the announcement history (compose with audience
    /// fan-out, read-rate, edit, retract-deletes-the-fan-out).
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class NotificationsControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public NotificationsControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);
        private static string UniqueSuffix() => Guid.NewGuid().ToString("N")[..8];

        /// <summary>Gym + employee (audience member) + the employee's session token.</summary>
        private async Task<(TestGym Gym, TestEmployee Employee, string Token)> SetupAudienceAsync()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var token = await _fixture.LoginAsync(employee.Email, employee.Password);
            return (gym, employee, token);
        }

        private async Task<JsonElement> ComposeAsync(string adminToken, object body)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/announcements", body, adminToken);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json.GetProperty("data");
        }

        private async Task<int> GetUnreadCountAsync(string token)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/notifications/unread-count", null, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json.GetProperty("count").GetInt32();
        }

        // ------------------------------------------------------------------
        // Inbox — GET /api/notifications, unread-count, read, read-all
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetNotifications_Anonymous_Returns401()
        {
            var response = await _fixture.Client.GetAsync("/api/notifications");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetNotifications_AfterAnnouncement_ShowsFanOutRow()
        {
            var (gym, _, token) = await SetupAudienceAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var title = $"Locker Policy {UniqueSuffix()}";
            var message = "New locker policy takes effect next Sunday.";

            await ComposeAsync(admin, new
            {
                title,
                audience = gym.Name,
                type = "Policy Update",
                message
            });

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/notifications", null, token);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(json.GetProperty("total").GetInt32() >= 1);

            var item = json.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("title").GetString() == $"Announcement: {title}");
            Assert.Equal("Announcements", item.GetProperty("category").GetString());
            Assert.Equal(message, item.GetProperty("description").GetString());
            Assert.False(item.GetProperty("read").GetBoolean());
            Assert.Equal("purple", item.GetProperty("color").GetString());
            Assert.Equal("announcements", item.GetProperty("link").GetString());
            Assert.True(item.GetProperty("date").GetDateTime() <= DateTime.UtcNow);
        }

        [Fact]
        public async Task GetNotifications_CategoryAndUnreadFilters_AreApplied()
        {
            var (gym, _, token) = await SetupAudienceAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            await ComposeAsync(admin, new
            {
                title = $"Category Check {UniqueSuffix()}",
                audience = gym.Name,
                type = "Reminder",
                message = "Filter test payload."
            });

            var announcements = _fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/notifications?category=Announcements&unread=true", null, token);
            var announcementsResponse = await _fixture.Client.SendAsync(announcements);
            Assert.Equal(HttpStatusCode.OK, announcementsResponse.StatusCode);
            var announcementsJson = await announcementsResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(announcementsJson.GetProperty("total").GetInt32() >= 1);

            var requests = _fixture.AuthorizedRequest(
                HttpMethod.Get, "/api/notifications?category=Requests", null, token);
            var requestsResponse = await _fixture.Client.SendAsync(requests);
            Assert.Equal(HttpStatusCode.OK, requestsResponse.StatusCode);
            var requestsJson = await requestsResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(0, requestsJson.GetProperty("total").GetInt32());
        }

        [Fact]
        public async Task UnreadCount_MarkRead_MarkAllRead_RoundTrip()
        {
            var (gym, _, token) = await SetupAudienceAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var title = $"Read Badge {UniqueSuffix()}";
            await ComposeAsync(admin, new { title, audience = gym.Name, message = "Badge test." });

            var before = await GetUnreadCountAsync(token);
            Assert.True(before >= 1);

            // Mark the fan-out row read → the badge drops by one.
            var listRequest = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/notifications?unread=true", null, token);
            var listResponse = await _fixture.Client.SendAsync(listRequest);
            var listJson = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            var row = listJson.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("title").GetString() == $"Announcement: {title}");
            var rowId = row.GetProperty("id").GetInt32();

            var readRequest = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/notifications/{rowId}/read", null, token);
            var readResponse = await _fixture.Client.SendAsync(readRequest);
            Assert.Equal(HttpStatusCode.OK, readResponse.StatusCode);
            var readJson = await readResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(readJson.GetProperty("read").GetBoolean());

            Assert.Equal(before - 1, await GetUnreadCountAsync(token));

            // Mark everything read → badge hits zero.
            var allRequest = _fixture.AuthorizedRequest(HttpMethod.Put, "/api/notifications/read-all", null, token);
            var allResponse = await _fixture.Client.SendAsync(allRequest);
            Assert.Equal(HttpStatusCode.OK, allResponse.StatusCode);
            Assert.Equal(0, await GetUnreadCountAsync(token));
        }

        [Fact]
        public async Task MarkRead_OtherUsersRow_Returns404()
        {
            var (gym, _, firstToken) = await SetupAudienceAsync();
            var builder = NewBuilder();
            var second = await builder.CreateEmployeeAsync(gym);
            var secondToken = await _fixture.LoginAsync(second.Email, second.Password);
            var admin = await _fixture.GetAdminTokenAsync();
            await ComposeAsync(admin, new { title = $"Shared {UniqueSuffix()}", audience = gym.Name, message = "Two recipients." });

            // First user's row id, tried by the second user.
            var listRequest = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/notifications", null, firstToken);
            var listResponse = await _fixture.Client.SendAsync(listRequest);
            var listJson = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            var rowId = listJson.GetProperty("items").EnumerateArray().First()
                .GetProperty("id").GetInt32();

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/notifications/{rowId}/read", null, secondToken);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ------------------------------------------------------------------
        // Announcements — list / compose / edit / retract
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetAnnouncements_WithoutPermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/announcements", null, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task CreateAnnouncement_WithoutPermission_Returns401()
        {
            var builder = NewBuilder();
            var gym = await builder.CreateGymWithStationAsync();
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/announcements", new
            {
                title = $"Nope {UniqueSuffix()}",
                audience = gym.Name,
                message = "Blocked."
            }, token);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task CreateAnnouncement_Returns201_WithContractFields()
        {
            var (gym, _, _) = await SetupAudienceAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var title = $"Safety Briefing {UniqueSuffix()}";

            var data = await ComposeAsync(admin, new
            {
                title,
                audience = gym.Name,
                type = "Event",
                message = "Quarterly safety briefing on Thursday."
            });

            Assert.True(data.GetProperty("id").GetInt32() > 0);
            Assert.Equal(title, data.GetProperty("title").GetString());
            Assert.Equal(gym.Name, data.GetProperty("audience").GetString());
            Assert.Equal("Event", data.GetProperty("type").GetString());
            Assert.Equal("Sent", data.GetProperty("status").GetString());
            Assert.Equal(0, data.GetProperty("readRate").GetDecimal());
            Assert.NotNull(data.GetProperty("sentDate").GetString());
        }

        [Fact]
        public async Task CreateAnnouncement_MissingTitle_Returns400()
        {
            var admin = await _fixture.GetAdminTokenAsync();

            var request = _fixture.AuthorizedRequest(HttpMethod.Post, "/api/announcements", new
            {
                audience = "All Employees",
                message = "No title supplied."
            }, admin);
            var response = await _fixture.Client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body.TryGetProperty("errorMessage", out _));
        }

        [Fact]
        public async Task AnnouncementReadRate_TracksFanOutReads()
        {
            var (gym, _, token) = await SetupAudienceAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var title = $"Read Rate {UniqueSuffix()}";
            var created = await ComposeAsync(admin, new { title, audience = gym.Name, message = "Rate test." });
            var announcementId = created.GetProperty("id").GetInt32();

            // Nobody has read it yet → 0%.
            var initial = await FindAnnouncementAsync(admin, announcementId);
            Assert.Equal(0, initial.GetProperty("readRate").GetDecimal());

            // The sole audience member reads the fan-out → 100%.
            var listRequest = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/notifications?unread=true", null, token);
            var listResponse = await _fixture.Client.SendAsync(listRequest);
            var listJson = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            var rowId = listJson.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("title").GetString() == $"Announcement: {title}")
                .GetProperty("id").GetInt32();
            var readRequest = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/notifications/{rowId}/read", null, token);
            var readResponse = await _fixture.Client.SendAsync(readRequest);
            Assert.Equal(HttpStatusCode.OK, readResponse.StatusCode);

            var after = await FindAnnouncementAsync(admin, announcementId);
            Assert.Equal(100, after.GetProperty("readRate").GetDecimal());
        }

        [Fact]
        public async Task UpdateAnnouncement_Retract_CancelsAndDropsFanOut()
        {
            var (gym, _, token) = await SetupAudienceAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var title = $"Retract Me {UniqueSuffix()}";
            var created = await ComposeAsync(admin, new { title, audience = gym.Name, message = "Will be retracted." });
            var announcementId = created.GetProperty("id").GetInt32();
            Assert.True(await GetUnreadCountAsync(token) >= 1);

            var request = _fixture.AuthorizedRequest(HttpMethod.Put, $"/api/announcements/{announcementId}", new
            {
                status = "Cancelled"
            }, admin);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = json.GetProperty("data");
            Assert.Equal(announcementId, data.GetProperty("id").GetInt32());
            Assert.Equal("Cancelled", data.GetProperty("status").GetString());

            // The fan-out rows are gone → the audience badge drops.
            Assert.Equal(0, await GetUnreadCountAsync(token));
        }

        [Fact]
        public async Task GetAnnouncements_ReturnsCardWithAudienceAndRate()
        {
            var (gym, _, _) = await SetupAudienceAsync();
            var admin = await _fixture.GetAdminTokenAsync();
            var title = $"Listed Card {UniqueSuffix()}";
            await ComposeAsync(admin, new { title, audience = gym.Name, type = "Recognition", message = "Nice work!" });

            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/announcements", null, admin);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(json.GetProperty("total").GetInt32() >= 1);
            var card = json.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("title").GetString() == title);
            Assert.Equal(gym.Name, card.GetProperty("audience").GetString());
            Assert.Equal("Sent", card.GetProperty("status").GetString());
            Assert.True(card.GetProperty("readRate").GetDecimal() >= 0);
        }

        private async Task<JsonElement> FindAnnouncementAsync(string adminToken, int announcementId)
        {
            var request = _fixture.AuthorizedRequest(HttpMethod.Get, "/api/announcements", null, adminToken);
            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json.GetProperty("items").EnumerateArray()
                .First(i => i.GetProperty("id").GetInt32() == announcementId);
        }
    }
}
