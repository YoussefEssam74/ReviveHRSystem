using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using ReviveHRSystem.SecurityTests.Fixtures;
using ReviveHRSystem.SecurityTests.Support;
using Xunit;

namespace ReviveHRSystem.SecurityTests
{
    /// <summary>
    /// The matrix IS the spec: every testable row of tests/security/access-matrix.json
    /// runs for every identity with an expectation, asserting the exact status (or one
    /// of the accepted codes in array form). Rows flagged as conflicts with today's
    /// seeded permissions ship RED on purpose — they fail until seeds/keys/code
    /// converge on the matrix (documented in the findings as the known-red baseline).
    /// </summary>
    [Trait("Suite", "AccessMatrix")]
    [Collection(SecurityApiFixture.CollectionName)]
    public class AccessMatrixTests(SecurityApiFixture fixture)
    {
        public static IEnumerable<object[]> MatrixTheory()
        {
            var doc = MatrixCatalog.Load();
            foreach (var row in doc.TestableRows)
            {
                foreach (var identityKey in PresentIdentities(row))
                {
                    yield return new object[] { row.Id, identityKey };
                }
            }
        }

        private static IEnumerable<string> PresentIdentities(MatrixRow row)
        {
            var expected = row.Expected!;
            if (expected.Anonymous.ValueKind != JsonValueKind.Undefined) yield return "anonymous";

            if (expected.EmployeeSelf.ValueKind != JsonValueKind.Undefined) yield return "employeeSelf";
            if (expected.EmployeeOther.ValueKind != JsonValueKind.Undefined) yield return "employeeOther";
            if (expected.EmployeeSelf.ValueKind == JsonValueKind.Undefined
                && expected.EmployeeOther.ValueKind == JsonValueKind.Undefined
                && expected.Employee.ValueKind != JsonValueKind.Undefined) yield return "employee";

            if (expected.TeamLeader.ValueKind != JsonValueKind.Undefined) yield return "teamLeader";
            if (expected.BranchManager.ValueKind != JsonValueKind.Undefined) yield return "branchManager";
            if (expected.Hr.ValueKind != JsonValueKind.Undefined) yield return "hr";
            if (expected.HrManager.ValueKind != JsonValueKind.Undefined) yield return "hrManager";
            if (expected.TopManagement.ValueKind != JsonValueKind.Undefined) yield return "topManagement";
            if (expected.CrossTenantTwin.ValueKind != JsonValueKind.Undefined) yield return "crossTenantTwin";
        }

        [Theory]
        [MemberData(nameof(MatrixTheory))]
        public async Task Row_Matches_Expected_Status(int rowId, string identityKey)
        {
            var doc = MatrixCatalog.Load();
            var row = doc.Rows.Single(r => r.Id == rowId);
            var expected = row.StatusSetFor(identityKey);

            var (url, statusCode) = await ExecuteAsync(row, identityKey);
            var status = (int)statusCode;

            Assert.True(
                expected.Contains(status),
                $"MATRIX VIOLATION {row.Method} {url}\n" +
                $"identity = {identityKey}\n" +
                $"expected = {(expected.Count == 1 ? expected[0].ToString() : string.Join(" | ", expected))}\n" +
                $"actual   = {status}{(status == 500 ? " (unhandled exception — check server logs)" : "")}");
        }

        private async Task<(string url, HttpStatusCode status)> ExecuteAsync(MatrixRow row, string identityKey)
        {
            var context = fixture.Context;
            var url = EndpointPayloads.SubstituteRoute(row.Route, context, identityKey, row.Id);

            var (kind, body, multipart) = EndpointPayloads.Build(row.Method, row.RouteTemplate, context);
            using var request = new HttpRequestMessage(new HttpMethod(row.Method), url);
            switch (kind)
            {
                case EndpointPayloads.Kind.Json:
                    request.Content = JsonContent.Create(body);
                    break;
                case EndpointPayloads.Kind.Multipart:
                    request.Content = multipart;
                    break;
                default:
                    break;
            }

            if (!string.Equals(identityKey, "anonymous", StringComparison.Ordinal))
            {
                var token = await fixture.GetTokenAsync(ResolveIdentity(context, identityKey, row, url));
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            }

            var response = await fixture.Client.SendAsync(request);
            Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);
            return (url, response.StatusCode);
        }

        private static SecurityUserIdentity ResolveIdentity(
            SecurityContext context, string identityKey, MatrixRow row, string url)
        {
            switch (identityKey)
            {
                case "employeeSelf": return context.EmployeeSelf;
                case "employeeOther": return context.EmployeeOther;
                case "teamLeader": return context.TeamLeader;
                case "branchManager": return context.BranchManager;
                case "hr": return context.Hr;
                case "hrManager": return context.HrManager;
                case "topManagement": return context.TopManagement;
                case "crossTenantTwin": return PickTwin(context, row, url);
                case "employee":
                    // Legacy rows without self/other split: plain employee acts as self.
                    return context.EmployeeSelf;
                default:
                    throw new InvalidOperationException($"Unknown identity key '{identityKey}'.");
            }
        }

        /// <summary>
        /// The twin identity matching the row's route audience. This keeps each matrix
        /// row under tenant isolation by the role most likely to "have a duplicate"
        /// business profile in another gym (management twins), while employee-scope
        /// routes use the plain employee twin (sara, gym B).
        /// </summary>
        private static SecurityUserIdentity PickTwin(
            SecurityContext context, MatrixRow row, string url)
        {
            // Request/attachment/cancel rows belong to self-service; outsider twin = sara.
            if (row.Route.StartsWith("/api/requests/", StringComparison.Ordinal)
                || row.Route.StartsWith("/api/request-types", StringComparison.Ordinal)
                || row.Route.Contains("/evaluations", StringComparison.Ordinal))
            {
                return context.HrTwin;
            }

            return context.EmployeeTwin;
        }
    }
}
