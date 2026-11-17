using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// The Deduction Correction request (mock §10): an employee disputes a deduction
    /// that already landed on him, the branch forwards it and HR decides. An approved
    /// correction takes the money off him — while the sheet is still open the line and
    /// its day are waived; once the month is locked the paid history cannot change, so
    /// the amount comes back as a negative deduction in his next open period.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class DeductionCorrectionTests
    {
        private readonly ApiTestFixture _fixture;

        public DeductionCorrectionTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task ApprovedCorrection_OnOpenSheet_WaivesTheLineAndTheDay()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var builder = new TestDataBuilder(_fixture.Services);

            // A closed month of its own — two months back, so the seeded paid month
            // (last month) and its per-day history stay untouched by this dispute.
            var closedMonth = new DateOnly(DateTime.Today.Year, DateTime.Today.Month, 1).AddMonths(-2);
            var punishedDay = closedMonth.AddDays(20);
            var periodId = await builder.CreatePayrollPeriodAsync(
                await GymIdOfAsync(employeeId), closedMonth, closedMonth.AddMonths(1).AddDays(-1),
                PayrollPeriodStatus.Open);
            var entryId = await builder.CreatePayrollEntryAsync(periodId, employeeId, 9000m);
            var candidateId = await SeedAppliedDeductionAsync(employeeId, entryId, punishedDay, 300m);

            var requestId = await SubmitAndApproveCorrectionAsync(employeeId, punishedDay, "I was on approved leave that day.");

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();

            var line = await db.PayrollEntryLineItems.AsNoTracking()
                .SingleAsync(l => l.PayrollEntryId == entryId && l.DeductionCandidateId == candidateId);
            Assert.Equal("Rejected", line.Status);

            var candidate = await db.DeductionCandidates.AsNoTracking().SingleAsync(c => c.Id == candidateId);
            Assert.Equal(DeductionStatus.Rejected, candidate.Status);

            var entry = await db.PayrollEntries.AsNoTracking()
                .Include(e => e.LineItems)
                .SingleAsync(e => e.Id == entryId);
            Assert.Equal(0m, entry.TotalDeductions);
            Assert.Equal(await GrossOfAsync(db, entryId), entry.NetPay);

            var request = await db.EmployeeRequests.AsNoTracking().SingleAsync(r => r.Id == requestId);
            Assert.Equal(DomainLayer.Models.RequestModule.Enums.RequestStatus.Approved, request.Status);
        }

        [Fact]
        public async Task ApprovedCorrection_OnLockedSheet_ReversesIntoTheNextOpenPeriod()
        {
            var employeeId = await OwnEmployeeIdAsync("karim@revive.hr");
            var builder = new TestDataBuilder(_fixture.Services);

            var closedMonth = new DateOnly(DateTime.Today.Year, DateTime.Today.Month, 1).AddMonths(-2);
            var punishedDay = closedMonth.AddDays(21);
            var periodId = await builder.CreatePayrollPeriodAsync(
                await GymIdOfAsync(employeeId), closedMonth, closedMonth.AddMonths(1).AddDays(-1),
                PayrollPeriodStatus.Locked, closedMonth.AddMonths(1));
            var entryId = await builder.CreatePayrollEntryAsync(periodId, employeeId, 9000m, status: "Locked");
            var candidateId = await SeedAppliedDeductionAsync(employeeId, entryId, punishedDay, 300m);

            var requestId = await SubmitAndApproveCorrectionAsync(employeeId, punishedDay, "The absence was excused.");

            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();

            // The paid month keeps its history: the original line stands.
            var original = await db.PayrollEntryLineItems.AsNoTracking()
                .SingleAsync(l => l.PayrollEntryId == entryId && l.DeductionCandidateId == candidateId);
            Assert.Equal("Accepted", original.Status);
            Assert.Equal(300m, original.Amount);

            // …and the refund rides the employee's next open period as a negative line.
            var reversal = await db.PayrollEntryLineItems.AsNoTracking()
                .Include(l => l.PayrollEntry).ThenInclude(e => e.PayrollPeriod)
                .SingleAsync(l => l.EmployeeRequestId == requestId);
            Assert.Equal(-300m, reversal.Amount);
            Assert.Equal("Accepted", reversal.Status);
            Assert.Equal("correction", reversal.Source);
            Assert.Equal("Deduction correction", reversal.Label);
            Assert.Equal(punishedDay, reversal.EffectiveDate);
            Assert.Equal(PayrollPeriodStatus.Open, reversal.PayrollEntry.PayrollPeriod.Status);
            Assert.True(reversal.PayrollEntry.PayrollPeriod.StartDate > closedMonth);

            var openEntry = await db.PayrollEntries.AsNoTracking()
                .Include(e => e.LineItems)
                .Include(e => e.PayrollPeriod).ThenInclude(p => p.Gym)
                .SingleAsync(e => e.Id == reversal.PayrollEntryId);
            Assert.Equal(-300m, openEntry.TotalDeductions);

            // Net = gross − deductions, so the refund raises the net pay back up.
            Assert.Equal(await GrossOfAsync(db, openEntry.Id) + 300m, openEntry.NetPay);
        }

        /// <summary>The sheet's earnings header: base + the gym's raise slice + bonuses (no OT on these sheets).</summary>
        private static async Task<decimal> GrossOfAsync(ReviveHrDbContext db, int entryId)
        {
            var entry = await db.PayrollEntries.AsNoTracking()
                .Include(e => e.PayrollPeriod).ThenInclude(p => p.Gym)
                .SingleAsync(e => e.Id == entryId);
            var percent = entry.PayrollPeriod.Gym?.AnnualIncreasePercent;
            var increase = percent is > 0 && entry.BaseSalary > 0
                ? Math.Round(entry.BaseSalary * percent.Value / 100m, 2)
                : 0m;
            return entry.BaseSalary + increase + entry.TotalBonuses;
        }

        /// <summary>Files the dispute as the employee, forwards it as the branch manager and decides it as HR.</summary>
        private async Task<int> SubmitAndApproveCorrectionAsync(int employeeId, DateOnly day, string reason)
        {
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var form = new MultipartFormDataContent
            {
                { new StringContent("Deduction Correction"), "type" },
                { new StringContent(day.ToString("yyyy-MM-dd")), "requestDate" },
                { new StringContent(reason), "reason" },
            };
            var submit = await _fixture.Client.SendAsync(
                Authorized(HttpMethod.Post, $"/api/employees/{employeeId}/requests", form, token));
            Assert.Equal(HttpStatusCode.Created, submit.StatusCode);
            var requestId = (await submit.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

            // Stage 1 — the branch manager forwards it to HR.
            var gym1Id = await GymIdByNameAsync("Revive Main Gym");
            var managerToken = await LoginSelectingGymAsync("omar@revive.hr", gym1Id);
            var forward = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/requests/{requestId}/decisions", new { decision = "Approved" }, managerToken);
            Assert.Equal(HttpStatusCode.NoContent, (await _fixture.Client.SendAsync(forward)).StatusCode);

            // Stage 2 — HR makes the final call.
            var admin = await _fixture.GetAdminTokenAsync();
            var decide = _fixture.AuthorizedRequest(HttpMethod.Post,
                $"/api/requests/{requestId}/decide", new { decision = "Approved", comment = "Correction upheld." }, admin);
            var decideResponse = await _fixture.Client.SendAsync(decide);
            Assert.Equal(HttpStatusCode.OK, decideResponse.StatusCode);

            return requestId;
        }

        /// <summary>An applied, priced deduction on one attendance day, with its candidate.</summary>
        private async Task<int> SeedAppliedDeductionAsync(int employeeId, int entryId, DateOnly day, decimal amount)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var issuerId = await db.Users.Where(u => u.Email == "omar@revive.hr").Select(u => u.Id).SingleAsync();

            var candidate = new DeductionCandidate
            {
                EmployeeId = employeeId,
                DeductionDate = day,
                DeductionDays = 1m,
                IsSystemGenerated = true,
                Amount = amount,
                Reason = "Unapproved absence",
                Note = "Auto-priced: 1 days (base ÷ 30 calendar days × 1).",
                IssuedBy = issuerId,
                IssuedAt = DateTime.UtcNow.AddDays(-2),
                Status = DeductionStatus.Approved,
                ReviewedBy = issuerId,
                ReviewedAt = DateTime.UtcNow.AddDays(-1),
            };
            db.DeductionCandidates.Add(candidate);
            await db.SaveChangesAsync();

            db.PayrollEntryLineItems.Add(new PayrollEntryLineItem
            {
                PayrollEntryId = entryId,
                Type = "Deduction",
                Label = $"Unapproved Absence — {day:MMM d}",
                EffectiveDate = day,
                Amount = amount,
                Reason = "Auto-priced: 1 days (base ÷ 30 calendar days × 1).",
                Source = "biometric",
                Status = "Accepted",
                DeductionCandidateId = candidate.Id,
            });

            var entry = await db.PayrollEntries.SingleAsync(e => e.Id == entryId);
            entry.TotalDeductions = amount;
            entry.NetPay = entry.BaseSalary - amount;
            await db.SaveChangesAsync();

            return candidate.Id;
        }

        private async Task<int> OwnEmployeeIdAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        private async Task<int> GymIdOfAsync(int employeeId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.Id == employeeId).Select(e => e.GymId).SingleAsync();
        }

        private async Task<int> GymIdByNameAsync(string name)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Gyms.Where(g => g.Name == name).Select(g => g.Id).SingleAsync();
        }

        private async Task<string> LoginSelectingGymAsync(string email, int gymId)
        {
            var login = await _fixture.Client.PostAsJsonAsync("/api/auth/login", new { email, password = "Revive!2026" });
            var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
            if (loginBody.TryGetProperty("accessToken", out var direct) && direct.ValueKind == JsonValueKind.String)
            {
                return direct.GetString()!;
            }

            var temp = loginBody.GetProperty("tempSessionToken").GetString()!;
            var select = await _fixture.Client.PostAsJsonAsync("/api/auth/login/select-gym",
                new { gymId, tempSessionToken = temp });
            select.EnsureSuccessStatusCode();
            return (await select.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!;
        }

        private HttpRequestMessage Authorized(HttpMethod method, string url, HttpContent content, string token)
        {
            var request = new HttpRequestMessage(method, url) { Content = content };
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            return request;
        }
    }
}
