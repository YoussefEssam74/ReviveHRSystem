using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.SecurityTests.Fixtures;
using ReviveHRSystem.SecurityTests.Support;
using Xunit;

namespace ReviveHRSystem.SecurityTests
{
    /// <summary>
    /// Mass-assignment probes: clients must not smuggle ownership or identity fields
    /// through employee payload bodies (gym ownership, a foreign user identity, or
    /// user-type/role escalation), and the self-only employee-scoped writes must
    /// never act on another employee's identity or data.
    /// </summary>
    [Trait("Suite", "MassAssignment")]
    [Collection(SecurityApiFixture.CollectionName)]
    public class MassAssignmentTests(SecurityApiFixture fixture)
    {
        [Fact]
        public async Task Onboard_Body_Cannot_Claim_Another_Gym_As_Tenant_Twin()
        {
            var token = await fixture.GetTokenAsync(fixture.Context.BranchManagerTwin);
            var body = new
            {
                firstName = "Injected",
                lastName = "Tenant Hopper",
                email = $"mass.assign.{Guid.NewGuid():N}@test.local",
                position = "Trainer",
                level = "2",
                gym = fixture.Context.GymAId, // twin's gym is B; A is out of scope
                startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
            };
            using var request = fixture.AuthorizedRequest(HttpMethod.Post, "/api/employees", body, token);
            var response = await fixture.Client.SendAsync(request);

            Assert.True((int)response.StatusCode is 401 or 404,
                $"Cross-tenant twin created an employee in another gym: {response.StatusCode}");
        }

        [Fact]
        public async Task Edit_Body_Cannot_Reassign_Identity_Fields()
        {
            using (var before = fixture.NewScope())
            {
                var db = before.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
                var beforeId = (await db.Employees.FirstAsync(e => e.Id == fixture.Context.ProbeEmployeeId)).UserId;

                var token = await fixture.GetTokenAsync(fixture.Context.Hr);
                var body = new
                {
                    name = "Still Security Suite",
                    // smuggled identity fields the edit contract does not know
                    id = 999999,
                    userId = 999999,
                    userType = "TopManagement",
                    role = "SuperAdmin",
                    status = "Active",
                };
                using var request = fixture.AuthorizedRequest(
                    HttpMethod.Put, $"/api/employees/{fixture.Context.ProbeEmployeeId}", body, token);
                var response = await fixture.Client.SendAsync(request);
                Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);

                var afterId = (await db.Employees.Include(e => e.User)
                    .FirstAsync(e => e.Id == fixture.Context.ProbeEmployeeId)).UserId;
                Assert.Equal(beforeId, afterId);

                var user = await db.Users.FirstAsync(u => u.Id == afterId);
                Assert.Equal(DomainLayer.Models.UserModule.Enums.UserType.Employee, user.UserType);
            }
        }

        [Fact]
        public async Task OnBehalf_Request_Create_Is_Not_Available_As_Plain_Employee()
        {
            // On-behalf submission is NOT implemented: a plain employee raising a
            // request under somebody else's employee id is 404, never foreign-write.
            var token = await fixture.GetTokenAsync(fixture.Context.EmployeeOther);
            using var content = Multipart(
                [("type", "annual-leave"),
                 ("requestDate", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd")),
                 ("reason", "Foreign submit attempt (matrix flow)")]
            );
            using var request = new HttpRequestMessage(
                HttpMethod.Post, $"/api/employees/{fixture.Context.KarimEmployeeId}/requests")
            { Content = content };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Self_Only_Photo_Upload_Rejects_Foreign_Employee_Target()
        {
            var token = await fixture.GetTokenAsync(fixture.Context.EmployeeOther);
            using var content = MultipartPhoto();
            using var request = new HttpRequestMessage(
                HttpMethod.Put, $"/api/employees/{fixture.Context.KarimEmployeeId}/photo")
            { Content = content };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Contact_Write_Never_Changes_Another_Employee_Record()
        {
            // Matrix row 22 converged design (actor-based): the contact write updates
            // the CALLER'S own record — the id in the route is advisory. The write
            // therefore answers 2xx for any profile-bearing actor, but the cited
            // employee's data must never budge (this test keeps that invariant).
            using var before = fixture.NewScope();
            var db = before.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            var karimBefore = await db.Employees.FirstAsync(e => e.Id == fixture.Context.KarimEmployeeId);
            var callerUser = await db.Users.FirstAsync(u => u.Email == fixture.Context.EmployeeOther.Email);
            var callerBefore = await db.Employees.FirstAsync(e => e.UserId == callerUser.Id);

            var token = await fixture.GetTokenAsync(fixture.Context.EmployeeOther);
            var body = new { phone = "01111111111", address = "Outsider Own Address" };
            using var request = fixture.AuthorizedRequest(
                HttpMethod.Put, $"/api/employees/{fixture.Context.KarimEmployeeId}/contact", body, token);
            var response = await fixture.Client.SendAsync(request);
            Assert.True(response.IsSuccessStatusCode,
                $"Actor-based contact write should update the caller's OWN record, got {response.StatusCode}.");

            var karimAfter = await db.Employees.AsNoTracking()
                .FirstAsync(e => e.Id == fixture.Context.KarimEmployeeId);
            Assert.Equal(karimBefore.Phone, karimAfter.Phone);
            Assert.Equal(karimBefore.Address, karimAfter.Address);

            var callerAfter = await db.Employees.AsNoTracking()
                .FirstAsync(e => e.UserId == callerUser.Id);
            Assert.Equal(body.phone, callerAfter.Phone);
            Assert.Equal(body.address, callerAfter.Address);
        }

        // ------------------------------------------------------------------ helpers

        private static MultipartFormDataContent Multipart(IEnumerable<(string Key, string Value)> fields, (byte[] Data, string Name)? file = null)
        {
            var multipart = new MultipartFormDataContent();
            foreach (var (key, value) in fields)
            {
                multipart.Add(new StringContent(value), key);
            }
            if (file is not null)
            {
                var fileContent = new ByteArrayContent(file.Value.Data);
                fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
                multipart.Add(fileContent, "file", file.Value.Name);
            }
            return multipart;
        }

        private static MultipartFormDataContent MultipartPhoto() => Multipart([], (Data: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], Name: "matrix-avatar.png"));
    }
}
