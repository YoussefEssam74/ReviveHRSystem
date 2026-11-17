using System.Net;
using System.Net.Http.Json;
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
    /// HR action queue (api-spec-from-ui.md §5.6): GET /api/events derives the eight
    /// pending/expiring sources into Events rows (sync-on-read, prune on vanish),
    /// filters them by the actor's gym scope + per-type permission, and serves the
    /// counts, resolve/reopen, renewal-request, and transfer-decide actions.
    /// Every list assertion is scoped to the per-test HR user's own gym, so leftovers
    /// from other tests never leak in.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class EventsControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public EventsControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        private TestDataBuilder NewBuilder() => new(_fixture.Services);

        private ReviveHrDbContext Db => _fixture.Services.GetRequiredService<ReviveHrDbContext>();

        private static string UniqueSuffix() => Guid.NewGuid().ToString("N")[..8];

        private sealed record Scene(TestDataBuilder Builder, TestGym Gym, TestUser Hr, TestEmployee Employee, string Token);

        private async Task<Scene> CreateSceneAsync(params string[] permissionKeys)
            => await CreateSceneAsync(null, permissionKeys);

        /// <summary>
        /// Builds gym + HR user + employee. extraGyms grants the HR user access to
        /// additional branches — TransferAsync (employees.transfer) demands the actor
        /// be assigned to the destination gym too, mirroring real ADR-003 scoping.
        /// </summary>
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

        private async Task<JsonElement> GetAsync(string url, string token)
        {
            var response = await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(HttpMethod.Get, url, null, token));
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK,
                $"Expected 200 from {url} but got {(int)response.StatusCode}: {body}");
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body, string token)
            => await _fixture.Client.SendAsync(_fixture.AuthorizedRequest(method, url, body, token));

        private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
        {
            var body = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<JsonElement>(body);
        }

        /// <summary>Asserts an error status and returns the envelope's errorMessage.</summary>
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

        private async Task<List<JsonElement>> GetEventsAsync(Scene scene, string? query = null)
        {
            var envelope = await GetAsync($"/api/events{query}", scene.Token);
            return ItemsOf(envelope);
        }

        // ------------------------------------------------------------------
        // Auth + derivation
        // ------------------------------------------------------------------

        [Fact]
        public async Task GetEvents_WithoutEventsView_Returns401()
        {
            var scene = await CreateSceneAsync(); // no keys at all
            var response = await SendAsync(HttpMethod.Get, "/api/events", null, scene.Token);
            await AssertErrorAsync(response, HttpStatusCode.Unauthorized);
        }

        [Fact]
        public async Task ExpiringDocument_SurfacesCardWithFullPayload()
        {
            var scene = await CreateSceneAsync("events.view", "employees.documents.manage");
            var expiry = Days(3);
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Certification, $"first-aid-{UniqueSuffix()}.pdf", expiry);

            var items = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId);
            var card = Assert.Single(items, i => i.GetProperty("type").GetString() == "Document Expiry");

            Assert.Equal("documents", card.GetProperty("tab").GetString());
            Assert.Equal("high", card.GetProperty("urgency").GetString());
            Assert.Equal(scene.Gym.Name, card.GetProperty("branch").GetString());
            Assert.Equal(scene.Employee.FullName, card.GetProperty("employee").GetString());
            Assert.Equal(scene.Employee.EmployeeId, card.GetProperty("employeeId").GetInt32());
            Assert.Equal("Certification", card.GetProperty("docType").GetString());
            Assert.Equal("employees.documents.manage", card.GetProperty("permission").GetString());
            Assert.False(card.GetProperty("resolved").GetBoolean());
            Assert.Equal(expiry.ToString("yyyy-MM-dd"), card.GetProperty("expiresOn").GetString());
            Assert.False(card.GetProperty("editableByEmployee").GetBoolean());
            Assert.False(string.IsNullOrWhiteSpace(card.GetProperty("detail").GetString()));
        }

        [Fact]
        public async Task ContractAndDocument_ExpiryWindows_DriveUrgencyAndVisibility()
        {
            var scene = await CreateSceneAsync("events.view", "employees.documents.manage", "employees.contract.manage");
            await scene.Builder.SetContractEndDateAsync(scene.Employee.EmployeeId, Days(10));
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Other, "fitness.pdf", Days(40));   // inside 45d → low
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.NationalId, "expired.pdf", Days(60)); // outside window → absent

            var items = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId);

            var contract = Assert.Single(items, i => i.GetProperty("type").GetString() == "Contract Expiry");
            Assert.Equal("medium", contract.GetProperty("urgency").GetString());
            Assert.Equal("Employment Contract", contract.GetProperty("docType").GetString());

            var lowDoc = Assert.Single(items, i => i.GetProperty("docNo").GetString() == "fitness.pdf");
            Assert.Equal("low", lowDoc.GetProperty("urgency").GetString());

            Assert.DoesNotContain(items, i => i.GetProperty("docNo").GetString() == "expired.pdf");
        }

        [Fact]
        public async Task PendingRequest_SurfacesAsRequestEvent()
        {
            var scene = await CreateSceneAsync("events.view", "requests.view", "requests.approve");
            var create = await SendAsync(HttpMethod.Post, "/api/requests", new
            {
                employee = scene.Employee.FullName,
                type = "Resignation",
                requestedDate = Days(7).ToString("yyyy-MM-dd"),
                reason = "Relocating abroad",
            }, scene.Token);
            Assert.True(create.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Create request failed: {(int)create.StatusCode}: {await create.Content.ReadAsStringAsync()}");
            var requestId = (await ReadAsync(create)).GetProperty("data").GetProperty("id").GetInt32();

            var items = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId);
            var card = Assert.Single(items, i => i.GetProperty("type").GetString() == "PendingHRReview");

            Assert.Equal(requestId, card.GetProperty("requestId").GetInt32());
            Assert.Equal("Resignation", card.GetProperty("requestType").GetString());
            Assert.Equal("high", card.GetProperty("urgency").GetString()); // resignations are always high
            Assert.Equal("requests", card.GetProperty("tab").GetString());
            Assert.Equal("requests.approve", card.GetProperty("permission").GetString());
        }

        [Fact]
        public async Task Separations_SurfacedAsLeavingEvents_WithChecklistProgress()
        {
            var scene = await CreateSceneAsync("events.view", "employees.offboard", "employees.view");

            // E19 — HR-initiated offboarding (Resignation by default)
            var offboard = await SendAsync(HttpMethod.Post, $"/api/employees/{scene.Employee.EmployeeId}/offboard",
                new { lastDay = Days(5).ToString("yyyy-MM-dd"), reason = "Relocation", notes = "Moving abroad" },
                scene.Token);
            Assert.Equal(HttpStatusCode.Created, offboard.StatusCode);
            var separationId = (await ReadAsync(offboard)).GetProperty("data").GetProperty("separationId").GetInt32();

            // T2 — Branch-Manager termination for a second employee
            var second = await scene.Builder.CreateEmployeeAsync(scene.Gym);
            var terminate = await SendAsync(HttpMethod.Post, "/api/separations", new
            {
                employeeId = second.EmployeeId,
                lastDay = Days(12).ToString("yyyy-MM-dd"),
                reason = "Performance issues",
            }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, terminate.StatusCode);
            var terminationId = (await ReadAsync(terminate)).GetProperty("data").GetProperty("id").GetInt32();

            var items = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId);

            var leaving = Assert.Single(items, i => i.GetProperty("type").GetString() == "Resignation");
            Assert.Equal(separationId, leaving.GetProperty("separationId").GetInt32());
            Assert.Equal("high", leaving.GetProperty("urgency").GetString());
            Assert.Equal(0, leaving.GetProperty("checklistDone").GetInt32());
            Assert.Equal(5, leaving.GetProperty("checklistTotal").GetInt32());
            Assert.Equal("HR Manager", leaving.GetProperty("requestedBy").GetString());
            Assert.Equal("offboarding", leaving.GetProperty("tab").GetString());

            var termination = Assert.Single(items, i => i.GetProperty("type").GetString() == "Termination");
            Assert.Equal(terminationId, termination.GetProperty("separationId").GetInt32());
            Assert.Equal("medium", termination.GetProperty("urgency").GetString()); // 12 days out → >7, ≤14
        }

        [Fact]
        public async Task VacancyAndPayroll_SurfacedWithPayloads()
        {
            var scene = await CreateSceneAsync(
                "events.view", "recruitment.vacancy_request.approve", "payroll.approve");
            var vacancyId = await scene.Builder.CreateVacancyRequestAsync(scene.Gym.GymId, scene.Hr.UserId, urgency: "High");
            var periodId = await scene.Builder.CreatePayrollPeriodAsync(
                scene.Gym.GymId, Days(-15), Days(5));
            await scene.Builder.CreatePayrollEntryAsync(periodId, scene.Employee.EmployeeId, baseSalary: 12000m);

            var items = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId);

            var vacancy = Assert.Single(items, i => i.GetProperty("type").GetString() == "PendingVacancyRequest");
            Assert.Equal(vacancyId, vacancy.GetProperty("vacancyRequestId").GetInt32());
            Assert.Equal("High", vacancy.GetProperty("vrUrgency").GetString());
            Assert.Equal(1, vacancy.GetProperty("headcount").GetInt32());
            Assert.Equal("IT Tester", vacancy.GetProperty("position").GetString());
            Assert.Equal(scene.Gym.Name, vacancy.GetProperty("gym").GetString());

            var payroll = Assert.Single(items, i => i.GetProperty("type").GetString() == "PayrollApproval");
            Assert.Equal(periodId, payroll.GetProperty("payrollPeriodId").GetInt32());
            Assert.Equal(1, payroll.GetProperty("headcount").GetInt32());
            Assert.Equal(12000m, payroll.GetProperty("grossTotal").GetDecimal());
            Assert.False(string.IsNullOrWhiteSpace(payroll.GetProperty("period").GetString()));
            Assert.Equal("payroll.approve", payroll.GetProperty("permission").GetString());
        }

        [Fact]
        public async Task TransferActionRequest_SurfacesAsTransferTicket()
        {
            var other = await NewBuilder().CreateGymWithStationAsync();
            var scene = await CreateSceneAsync("events.view", "employees.transfer");
            await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId,
                scene.Employee.EmployeeId,
                "Transfer",
                new { fromGym = scene.Gym.Name, toGym = other.Name, effectiveDate = Days(2).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);

            var items = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId);
            var card = Assert.Single(items, i => i.GetProperty("type").GetString() == "TransferRequest");

            Assert.Equal(scene.Gym.Name, card.GetProperty("fromGym").GetString());
            Assert.Equal(other.Name, card.GetProperty("toGym").GetString());
            Assert.Equal(scene.Employee.FullName, card.GetProperty("employee").GetString());
            Assert.Equal(scene.Hr.Email.Split('@')[0], card.GetProperty("raisedBy").GetString());
            Assert.Equal("employees.transfer", card.GetProperty("permission").GetString());
            Assert.Equal("transfers", card.GetProperty("tab").GetString());
        }

        // ------------------------------------------------------------------
        // Filters, permissions, hidden count
        // ------------------------------------------------------------------

        [Fact]
        public async Task TypeFilter_UnknownMatchesNothing_MultipleTypesCombine()
        {
            var scene = await CreateSceneAsync("events.view", "employees.documents.manage", "employees.contract.manage");
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Certification, "cert.pdf", Days(3));
            await scene.Builder.SetContractEndDateAsync(scene.Employee.EmployeeId, Days(6));

            var unknown = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId + "&type=Bogus");
            Assert.Empty(unknown);

            var combined = await GetEventsAsync(scene,
                "?gym=" + scene.Gym.GymId + "&type=" + Uri.EscapeDataString("Document Expiry,Contract Expiry"));
            Assert.Equal(2, combined.Count);
            Assert.Contains(combined, i => i.GetProperty("type").GetString() == "Document Expiry");
            Assert.Contains(combined, i => i.GetProperty("type").GetString() == "Contract Expiry");

            var single = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId + "&type=Contract Expiry");
            Assert.Single(single);
        }

        [Fact]
        public async Task UrgencyFilter_ReturnsOnlyMatchingCards()
        {
            var scene = await CreateSceneAsync("events.view", "employees.documents.manage", "employees.contract.manage");
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Certification, "urgent.pdf", Days(2));   // high
            await scene.Builder.SetContractEndDateAsync(scene.Employee.EmployeeId, Days(10));     // medium

            var medium = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId + "&urgency=medium");
            var only = Assert.Single(medium);
            Assert.Equal("Contract Expiry", only.GetProperty("type").GetString());

            var high = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId + "&urgency=high");
            Assert.Single(high, i => i.GetProperty("type").GetString() == "Document Expiry");
        }

        [Fact]
        public async Task PermissionFilter_HidesOtherQueuesAndReportsHiddenCount()
        {
            var other = await NewBuilder().CreateGymWithStationAsync();
            var scene = await CreateSceneAsync("events.view", "employees.documents.manage");
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Certification, "visible.pdf", Days(3));
            await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId,
                scene.Employee.EmployeeId,
                "Transfer",
                new { fromGym = scene.Gym.Name, toGym = other.Name, effectiveDate = Days(2).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);

            var envelope = await GetAsync("/api/events?gym=" + scene.Gym.GymId, scene.Token);
            var items = ItemsOf(envelope);

            Assert.Contains(items, i => i.GetProperty("type").GetString() == "Document Expiry");
            Assert.DoesNotContain(items, i => i.GetProperty("type").GetString() == "TransferRequest");
            Assert.Equal(1, envelope.GetProperty("hidden").GetInt32()); // the transfer card, in scope but not permitted
        }

        [Fact]
        public async Task UnknownGymFilter_Returns400()
        {
            var scene = await CreateSceneAsync("events.view");
            var response = await SendAsync(HttpMethod.Get, "/api/events?gym=Atlantis", null, scene.Token);
            var message = await AssertErrorAsync(response, HttpStatusCode.BadRequest);
            Assert.Equal("Gym not found.", message);
        }

        // ------------------------------------------------------------------
        // Resolve / reopen
        // ------------------------------------------------------------------

        [Fact]
        public async Task ResolveReopen_RoundTripsAndAudits()
        {
            var scene = await CreateSceneAsync("events.view", "employees.documents.manage");
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Certification, "resolve-me.pdf", Days(4));
            var card = Assert.Single(await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId));
            var eventId = card.GetProperty("id").GetInt32();

            var resolve = await SendAsync(HttpMethod.Put, $"/api/events/{eventId}/resolve", null, scene.Token);
            Assert.Equal(HttpStatusCode.OK, resolve.StatusCode);
            var resolvedData = (await ReadAsync(resolve)).GetProperty("data");
            Assert.True(resolvedData.GetProperty("resolved").GetBoolean());
            Assert.False(string.IsNullOrWhiteSpace(resolvedData.GetProperty("resolvedBy").GetString()));
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Event Resolved" && a.UserId == scene.Hr.UserId));

            // Gone from the open list, present under the resolved toggle, idempotent resolve.
            var open = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId);
            Assert.DoesNotContain(open, i => i.GetProperty("id").GetInt32() == eventId);
            var resolvedList = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId + "&resolved=true");
            var backIn = Assert.Single(resolvedList, i => i.GetProperty("id").GetInt32() == eventId);
            Assert.True(backIn.GetProperty("resolved").GetBoolean());
            Assert.Equal(HttpStatusCode.OK,
                (await SendAsync(HttpMethod.Put, $"/api/events/{eventId}/resolve", null, scene.Token)).StatusCode);

            var reopen = await SendAsync(HttpMethod.Put, $"/api/events/{eventId}/reopen", null, scene.Token);
            Assert.Equal(HttpStatusCode.OK, reopen.StatusCode);
            Assert.False((await ReadAsync(reopen)).GetProperty("data").GetProperty("resolved").GetBoolean());
            Assert.Contains(
                await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId),
                i => i.GetProperty("id").GetInt32() == eventId);
        }

        [Fact]
        public async Task Resolve_WithoutTheEventsPermission_Returns401()
        {
            var scene = await CreateSceneAsync("events.view", "employees.documents.manage");
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Certification, "guarded.pdf", Days(4));
            var eventId = (await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId))[0].GetProperty("id").GetInt32();

            var viewer = await scene.Builder.CreateUserAsync(UserType.HR, new[] { scene.Gym });
            await scene.Builder.GrantPermissionAsync(viewer.UserId, "events.view");
            var viewerToken = await _fixture.LoginAsync(viewer.Email, viewer.Password);

            var response = await SendAsync(HttpMethod.Put, $"/api/events/{eventId}/resolve", null, viewerToken);
            await AssertErrorAsync(response, HttpStatusCode.Unauthorized);
        }

        // ------------------------------------------------------------------
        // Renewal request
        // ------------------------------------------------------------------

        [Fact]
        public async Task RenewalRequest_NotifiesEmployeeAndAudits()
        {
            var scene = await CreateSceneAsync("events.view", "employees.documents.manage");
            var documentName = $"license-{UniqueSuffix()}.pdf";
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Certification, documentName, Days(3));
            var card = Assert.Single(await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId));
            var eventId = card.GetProperty("id").GetInt32();

            var response = await SendAsync(HttpMethod.Post, $"/api/events/{eventId}/renewal-request", null, scene.Token);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var data = (await ReadAsync(response)).GetProperty("data");
            Assert.True(data.GetProperty("notificationId").GetInt32() > 0);
            Assert.Contains("Renewal requested from", data.GetProperty("message").GetString());

            // The employee sees the replacement request in their notifications.
            var employeeToken = await _fixture.LoginAsync(scene.Employee.Email, scene.Employee.Password);
            var inbox = await GetAsync("/api/notifications?pageSize=100", employeeToken);
            Assert.Contains("Replacement requested", inbox.GetRawText());

            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Document Renewal Requested" && a.UserId == scene.Hr.UserId));
        }

        [Fact]
        public async Task RenewalRequest_OnContractEvent_Returns400()
        {
            var scene = await CreateSceneAsync("events.view", "employees.contract.manage");
            await scene.Builder.SetContractEndDateAsync(scene.Employee.EmployeeId, Days(5));
            var card = Assert.Single(await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId));

            var response = await SendAsync(HttpMethod.Post, $"/api/events/{card.GetProperty("id").GetInt32()}/renewal-request", null, scene.Token);
            var message = await AssertErrorAsync(response, HttpStatusCode.BadRequest);
            Assert.Contains("expiring documents", message);
        }

        // ------------------------------------------------------------------
        // Transfer decisions
        // ------------------------------------------------------------------

        [Fact]
        public async Task DecideTransfer_Approve_MovesEmployeeAndResolvesTicket()
        {
            var other = await NewBuilder().CreateGymWithStationAsync();
            var scene = await CreateSceneAsync(new[] { other }, "events.view", "employees.transfer");
            await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId,
                scene.Employee.EmployeeId,
                "Transfer",
                new { fromGym = scene.Gym.Name, toGym = other.Name, effectiveDate = Days(2).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);
            var card = Assert.Single(
                await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId + "&type=TransferRequest"));
            var eventId = card.GetProperty("id").GetInt32();

            var response = await SendAsync(HttpMethod.Put, $"/api/events/{eventId}/decide",
                new { decision = "approve" }, scene.Token);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var data = (await ReadAsync(response)).GetProperty("data");
            Assert.True(data.GetProperty("resolved").GetBoolean());
            Assert.Equal(scene.Employee.EmployeeId, data.GetProperty("employee").GetProperty("id").GetInt32());
            Assert.Equal(other.Name, data.GetProperty("employee").GetProperty("gym").GetString());

            // The employee actually moved, the escalation was marked Approved, and it was audited.
            var employee = await Db.Employees.AsNoTracking().SingleAsync(e => e.Id == scene.Employee.EmployeeId);
            Assert.Equal(other.GymId, employee.GymId);
            var action = await Db.ActionRequests.AsNoTracking().SingleAsync(a => a.EmployeeId == scene.Employee.EmployeeId && a.ActionType == "Transfer");
            Assert.Equal("Approved", action.Status);
            Assert.True(await Db.AuditLogs.AnyAsync(a =>
                a.Action == "Gym Transfer Executed" && a.UserId == scene.Hr.UserId));

            // Deciding again reports the request was already handled.
            var again = await SendAsync(HttpMethod.Put, $"/api/events/{eventId}/decide",
                new { decision = "approve" }, scene.Token);
            await AssertErrorAsync(again, HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task DecideTransfer_UnknownDestination_Returns400()
        {
            var scene = await CreateSceneAsync("events.view", "employees.transfer");
            await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId,
                scene.Employee.EmployeeId,
                "Transfer",
                new { fromGym = scene.Gym.Name, toGym = "Atlantis", effectiveDate = Days(2).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);
            var card = Assert.Single(
                await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId + "&type=TransferRequest"));

            var response = await SendAsync(HttpMethod.Put, $"/api/events/{card.GetProperty("id").GetInt32()}/decide",
                new { decision = "approve" }, scene.Token);
            var message = await AssertErrorAsync(response, HttpStatusCode.BadRequest);
            Assert.Contains("Unknown gym", message);
        }

        [Fact]
        public async Task Decide_OnNonTransferEvent_Returns400()
        {
            var scene = await CreateSceneAsync("events.view", "employees.documents.manage");
            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Certification, "not-a-ticket.pdf", Days(3));
            var card = Assert.Single(await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId));

            var response = await SendAsync(HttpMethod.Put, $"/api/events/{card.GetProperty("id").GetInt32()}/decide",
                new { decision = "approve" }, scene.Token);
            var message = await AssertErrorAsync(response, HttpStatusCode.BadRequest);
            Assert.Contains("transfer tickets", message);
        }

        // ------------------------------------------------------------------
        // Counts + pruning
        // ------------------------------------------------------------------

        [Fact]
        public async Task Counts_GroupsOpenHighResolvedAndEscalations_PerGym()
        {
            var other = await NewBuilder().CreateGymWithStationAsync();
            var scene = await CreateSceneAsync(
                "events.view",
                "employees.documents.manage",
                "employees.contract.manage",
                "recruitment.vacancy_request.approve",
                "payroll.approve",
                "employees.transfer");

            await scene.Builder.AddEmployeeDocumentAsync(
                scene.Employee.EmployeeId, DocumentType.Certification, "counts-high.pdf", Days(3)); // high
            await scene.Builder.SetContractEndDateAsync(scene.Employee.EmployeeId, Days(10));        // medium
            await scene.Builder.CreateVacancyRequestAsync(scene.Gym.GymId, scene.Hr.UserId);
            var periodId = await scene.Builder.CreatePayrollPeriodAsync(scene.Gym.GymId, Days(-15), Days(5));
            await scene.Builder.CreatePayrollEntryAsync(periodId, scene.Employee.EmployeeId, baseSalary: 9000m);
            await scene.Builder.CreateActionRequestAsync(
                scene.Gym.GymId,
                scene.Employee.EmployeeId,
                "Transfer",
                new { fromGym = scene.Gym.Name, toGym = other.Name, effectiveDate = Days(2).ToString("yyyy-MM-dd") },
                scene.Hr.UserId);

            var counts = (await GetAsync($"/api/events/counts?gym={Uri.EscapeDataString(scene.Gym.Name)}", scene.Token))
                .GetProperty("data");

            var documents = counts.GetProperty("documents");
            Assert.Equal(2, documents.GetProperty("open").GetInt32());
            Assert.Equal(1, documents.GetProperty("high").GetInt32());
            Assert.Equal(0, documents.GetProperty("resolved").GetInt32());
            Assert.Equal(1, counts.GetProperty("vacancies").GetProperty("open").GetInt32());
            Assert.Equal(1, counts.GetProperty("payroll").GetProperty("open").GetInt32());
            Assert.Equal(1, counts.GetProperty("transfers").GetProperty("open").GetInt32());
            Assert.Equal(1, counts.GetProperty("escalations").GetProperty("open").GetInt32());
        }

        [Fact]
        public async Task ContractEvent_IsPrunedOnceItsSourceVanishes()
        {
            var scene = await CreateSceneAsync("events.view", "employees.contract.manage");
            await scene.Builder.SetContractEndDateAsync(scene.Employee.EmployeeId, Days(5));
            var card = Assert.Single(
                await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId + "&type=Contract%20Expiry"));
            var eventId = card.GetProperty("id").GetInt32();

            await scene.Builder.ClearContractEndDateAsync(scene.Employee.EmployeeId);

            var after = await GetEventsAsync(scene, "?gym=" + scene.Gym.GymId + "&type=Contract%20Expiry");
            Assert.DoesNotContain(after, i => i.GetProperty("id").GetInt32() == eventId);

            var resolve = await SendAsync(HttpMethod.Put, $"/api/events/{eventId}/resolve", null, scene.Token);
            await AssertErrorAsync(resolve, HttpStatusCode.NotFound);
        }
    }
}
