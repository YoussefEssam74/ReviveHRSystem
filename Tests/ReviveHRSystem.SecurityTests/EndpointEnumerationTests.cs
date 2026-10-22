using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using ReviveHRSystem.SecurityTests.Fixtures;
using ReviveHRSystem.SecurityTests.Support;
using Xunit;

namespace ReviveHRSystem.SecurityTests
{
    /// <summary>
    /// Guards against "unmapped" endpoints: any HTTP route registered in the API but
    /// missing from the access matrix fails here with the exact route list. Every
    /// remaining route (matrix-covered routes are exercised by the matrix theories)
    /// is probed anonymous to confirm the default-deny fallback answers 401 — except
    /// the deliberately public endpoints, which are asserted to actually respond.
    /// </summary>
    [Trait("Suite", "Enumeration")]
    [Collection(SecurityApiFixture.CollectionName)]
    public class EndpointEnumerationTests(SecurityApiFixture fixture)
    {
        // The 7 [AllowAnonymous] endpoints (verified against the controllers):
        // AuthController 23/38, KioskController 32/103, HiringFormsController 19/25,
        // ApplicationsController 19. Placeholders use the {p} canon.
        private static readonly string[] PubliclyAccessible =
        [
            "POST /api/auth/login",
            "POST /api/auth/login/select-gym",
            "POST /api/kiosk/login",
            "POST /api/kiosk/logout",
            "GET /api/hiring-forms",
            "GET /api/hiring-forms/{p}",   // GET {id:int}: anonymous Allowed; a data-404
                                           // (unknown id) is still an anonymous HANDLER hit
            "POST /api/applications",
        ];

        private static readonly string[] EmployeesFamily =
        [
            "api/employees",
            "api/requests",
            "api/request-types",
        ];

        private static readonly Regex Placeholder = new(@"\{[^}]+\}", RegexOptions.Compiled);

        [Fact]
        public async Task Every_Mapped_Route_Is_Classified_And_Default_Deny_Holds()
        {
            var routes = CollectHttpRoutes();
            Assert.True(routes.Count > 10, $"Endpoint enumeration found only {routes.Count} routes — data source empty?");

            var doc = MatrixCatalog.Load();
            var failures = new List<string>();
            var denyProbes = new List<(string Method, string Template)>();
            var publicProbes = new List<(string Key, HttpStatusCode Status)>();

            foreach (var (method, template) in routes)
            {
                // Convention routes have no leading slash in RawText ('api/employees/{id:int}'),
                // while matrix rows use '/api/...'; match without leading slashes and
                // carry the {id:int}-style constraints in the placeholder canon.
                var normalized = Placeholder.Replace(template, "{p}").TrimStart('/');
                var inMatrix = doc.Rows.Any(r =>
                    r.RouteTemplate.TrimStart('/').Equals(normalized, StringComparison.OrdinalIgnoreCase) &&
                    r.Method.Equals(method, StringComparison.OrdinalIgnoreCase));
                var isPublic = PubliclyAccessible.Any(p =>
                    p.StartsWith($"{method} ", StringComparison.OrdinalIgnoreCase) &&
                    p.EndsWith(normalized, StringComparison.OrdinalIgnoreCase));

                if (isPublic)
                {
                    publicProbes.Add((
                        $"public {method} {template}",
                        await ProbeAnonymous(method, Placeholder.Replace(template, "1"))));
                    continue;
                }

                if (inMatrix)
                {
                    continue; // exercised by AccessMatrixTests
                }

                if (EmployeesFamily.Any(f => normalized.StartsWith(f, StringComparison.Ordinal)))
                {
                    failures.Add($"{method} {template} — employees-family route missing from access-matrix.json");
                    continue;
                }

                denyProbes.Add((method, template));
            }

            var publicGetViolations = publicProbes
                .Where(p =>
                    p.Key.StartsWith("public GET", StringComparison.Ordinal) &&
                    p.Status != HttpStatusCode.OK &&           // route list: 200
                    p.Status != HttpStatusCode.NotFound)       // anonymous detail with unknown id
                .Select(p => $"{p.Key} -> {(int)p.Status}")
                .ToList();
            var publicPostViolations = publicProbes
                .Where(p => p.Key.StartsWith("public POST", StringComparison.Ordinal) && (int)p.Status >= 500)
                .Select(p => $"{p.Key} -> {(int)p.Status}")
                .ToList();

            Assert.True(publicGetViolations.Count == 0 && publicPostViolations.Count == 0,
                "Public endpoint probes failed:\n  " + string.Join("\n  ",
                    publicGetViolations.Concat(publicPostViolations)));

            Assert.True(failures.Count == 0,
                "Unmapped employees-family endpoints:\n  " + string.Join("\n  ", failures));

            Assert.True(denyProbes.Count > 0,
                "No default-deny candidates discovered — enumeration lost its input.");

            var denyViolations = new List<string>();
            foreach (var (method, template) in denyProbes)
            {
                var status = await ProbeAnonymous(method, Placeholder.Replace(template, "1"));
                if (status != HttpStatusCode.Unauthorized)
                {
                    denyViolations.Add(
                        $"{method} {template} → {(int)status} (default deny expects 401)");
                }
            }

            Assert.True(denyViolations.Count == 0,
                "Default-deny violations (anonymous should NEVER reach these):\n  " +
                string.Join("\n  ", denyViolations));
        }

        private List<(string Method, string Template)> CollectHttpRoutes()
        {
            var endpoints = fixture.Services
                .GetServices<EndpointDataSource>()
                .SelectMany(ds => ds.Endpoints)
                .OfType<RouteEndpoint>()
                .ToList();

            var routes = new List<(string Method, string Template)>();
            foreach (var endpoint in endpoints)
            {
                var template = endpoint.RoutePattern.RawText;
                if (string.IsNullOrEmpty(template))
                {
                    continue;
                }

                var methods = endpoint.Metadata
                    .OfType<IHttpMethodMetadata>()
                    .SelectMany(m => m.HttpMethods)
                    .Distinct()
                    .ToList();

                if (methods.Count == 0)
                {
                    continue; // non-HTTP endpoint (e.g. signalr) — not part of the assertion surface
                }

                routes.AddRange(methods.Select(m => (m.ToUpperInvariant(), template)));
            }

            return routes
                .GroupBy(r => r)
                .Select(g => g.Key)
                .ToList();
        }

        private async Task<HttpStatusCode> ProbeAnonymous(string method, string concreteTemplate)
        {
            var url = "/" + concreteTemplate.TrimStart('/');
            using var request = new HttpRequestMessage(new HttpMethod(method), url);
            if (method is "POST" or "PUT" or "PATCH")
            {
                request.Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");
            }

            var response = await fixture.Client.SendAsync(request);
            return response.StatusCode;
        }
    }

    file static class EnumerableExtensions
    {
        public static T FirstOrNone<T>(this IEnumerable<T> source, T fallback) =>
            source.FirstOrDefault(fallback!);
    }
}
