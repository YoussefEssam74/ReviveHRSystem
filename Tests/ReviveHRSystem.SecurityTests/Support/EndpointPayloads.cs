using System.Net.Http.Headers;
using System.Text;

namespace ReviveHRSystem.SecurityTests.Support
{
    /// <summary>
    /// Request payload factory for the matrix rows. Bodies come from the existing
    /// integration tests, so a 2xx is always achievable when the access layer allows
    /// the identity — a failed 2xx assertion then reflects authorization or business
    /// rules, never an invalid payload. Multipart endpoints supply a ready HttpContent.
    /// </summary>
    public static class EndpointPayloads
    {
        public enum Kind
        {
            NoBody,
            Json,
            Multipart
        }

        private static readonly System.Text.RegularExpressions.Regex Placeholder =
            new(@"\{[^}]+\}", System.Text.RegularExpressions.RegexOptions.Compiled);

        public static (Kind Kind, object? Body, HttpContent? Multipart) Build(
            string method, string routeTemplate, SecurityContext c)
        {
            // The matrix templates normalise every placeholder to {p}; payloads keys
            // use the same canonical form so one placeholder name can never desync.
            var key = $"{method.ToUpperInvariant()} {Placeholder.Replace(routeTemplate, "{p}")}";
            var today = DateTime.UtcNow.ToString("yyyy-MM-dd");

            switch (key)
            {
                case "POST /api/employees":
                    return (Kind.Json, new
                    {
                        firstName = "Matrix",
                        lastName = "Probe",
                        email = $"matrix-{Guid.NewGuid():N}@test.local".ToLowerInvariant(),
                        phone = "01000000000",
                        position = "Trainer",
                        level = "2",
                        salary = 5000,
                        gym = c.GymAId,
                        startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
                    }, null);

                case "DELETE /api/employees/face/{p}":
                case "DELETE /api/employees/face/{employeeReference}":
                    return (Kind.NoBody, null, null);

                case "POST /api/employees/{p}/evaluations":
                    return (Kind.Json, new
                    {
                        evaluationFormId = c.EvaluationFormId,
                        answers = new[] { new { questionId = c.EvaluationQuestionId, score = 4, comment = "Matrix health check" } },
                        overallComment = "Security suite."
                    }, null);

                case "PUT /api/employees/{p}/evaluations/{p}":
                    return (Kind.Json, new
                    {
                        answers = new[] { new { questionId = c.EvaluationQuestionId, score = 5 } }
                    }, null);

                case "PUT /api/employees/{p}":
                    return (Kind.Json, new { name = "Security Suite Rename", status = "Active" }, null);

                case "POST /api/employees/{p}/status-change":
                    // Active -> Active is a deliberate no-op (or 400); state stays neutral.
                    return (Kind.Json, new { status = "Active", note = "Matrix health check" }, null);

                case "POST /api/employees/{p}/transfer":
                    // Same-gym transfer keeps the run state-neutral (400/no-op or 200).
                    return (Kind.Json, new
                    {
                        toGym = c.GymAId,
                        effectiveDate = today,
                        reason = "Matrix health check (same gym -> rejected or no-op)"
                    }, null);

                case "POST /api/employees/{p}/position-change":
                    return (Kind.Json, new { position = "Coach", level = "3" }, null);

                case "POST /api/employees/{p}/compensation":
                    return (Kind.Json, new { salary = 7500, effectiveDate = today }, null);

                case "POST /api/employees/{p}/contract":
                    return (Kind.Json, new { level = "Senior", salary = 6500 }, null);

                case "POST /api/employees/{p}/role-change":
                    return (Kind.Json, new { systemRole = "None (Employee)" }, null);

                case "PUT /api/employees/{p}/leave-balance":
                    return (Kind.Json, new
                    {
                        dayOff = new { used = 1, total = 21 },
                        sick = new { used = 0, total = 14 },
                        unpaid = new { used = 0, total = 0 },
                    }, null);

                case "PUT /api/employees/{p}/onboarding-checklist":
                    return (Kind.Json, new { item = "ID & contract signed", done = true }, null);

                case "POST /api/employees/{p}/offboard":
                    // Future-dated resignation keeps run state predictable (the target
                    // is the probe employee, not karim).
                    return (Kind.Json, new
                    {
                        lastDay = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(90)),
                        reason = "Security matrix probe (future-dated)",
                        separationType = "Resignation"
                    }, null);

                case "POST /api/requests/{p}/cancel":
                case "POST /api/requests/{p}/undo":
                    // The management-side undo carries no body (the stage-1 decided
                    // request it targets is substituted from the identity's own clone).
                    return (Kind.NoBody, null, null);

                case "PUT /api/employees/{p}/contact":
                    return (Kind.Json, new { phone = "01000000000", address = "Security Matrix St 1" }, null);

                case "POST /api/employees/face/enroll":
                    return (Kind.Json, new { employeeNumber = c.ProbeEmployeeNumber, image = BlackImage() }, null);

                case "POST /api/employees/bulk-import":
                    return (Kind.Multipart, null, BulkImportMultipart(c));

                case "POST /api/employees/{p}/documents":
                    return (Kind.Multipart, null, DocumentUploadMultipart());

                case "PUT /api/employees/{p}/photo":
                    return (Kind.Multipart, null, PhotoMultipart());

                case "POST /api/employees/{p}/requests":
                    return (Kind.Multipart, null, RequestCreateMultipart());

                // ---------------- platform console ----------------

                case "POST /api/platform/companies":
                    return (Kind.Json, new
                    {
                        name = $"Matrix Gym {Guid.NewGuid():N}"[..24],
                        code = $"MX{Guid.NewGuid():N}"[..10].ToUpperInvariant(),
                        city = "Matrix City",
                        primaryBranch = new { name = "Matrix Branch", area = "Matrix Area", address = "1 Matrix St", phone = "01000000000" },
                        contact = new { name = "Matrix Contact", email = $"matrix-{Guid.NewGuid():N}@test.local".ToLowerInvariant(), phone = "01000000000" },
                        // Growth is seeded second and allows a trial, so the 201 path is reachable.
                        subscription = new { planId = c.GrowthPlanId, startTrial = true },
                        assignHrLater = true,
                    }, null);

                case "PUT /api/platform/companies/{p}":
                    return (Kind.Json, new
                    {
                        name = "Revive Main Gym",
                        city = "Matrix City",
                        contact = new { name = "Matrix Contact", email = "matrix@test.local", phone = "01000000000" },
                    }, null);

                case "PUT /api/platform/companies/{p}/status":
                    // Restoring an already-Active company is the deterministic no-op path:
                    // the 400 proves the guard passed and the business rule fired.
                    return (Kind.Json, new { status = "Active" }, null);

                case "POST /api/platform/companies/{p}/branches":
                    return (Kind.Json, new
                    {
                        name = $"Matrix Branch {Guid.NewGuid():N}"[..20],
                        area = "Matrix Area",
                        address = "2 Matrix St",
                        phone = "01000000000",
                    }, null);

                case "PUT /api/platform/companies/{p}/branches/{p}":
                    return (Kind.Json, new
                    {
                        name = "Revive Main Gym",
                        area = "Matrix Area",
                        address = "3 Matrix St",
                        phone = "01000000000",
                    }, null);

                case "POST /api/platform/companies/{p}/hr-staff":
                    // Empty list is a valid, idempotent no-op that still exercises the guard.
                    return (Kind.Json, new { userIds = Array.Empty<int>() }, null);

                case "POST /api/platform/users":
                    // Employee account: no company binding is required, so the 201 path
                    // stays reachable without depending on branch resolution.
                    return (Kind.Json, new
                    {
                        fullName = $"Matrix Employee {Guid.NewGuid():N}"[..24],
                        email = $"matrix-emp-{Guid.NewGuid():N}@test.local".ToLowerInvariant(),
                        phone = "01000000000",
                        userType = "Employee",
                        sendInvite = false,
                    }, null);

                case "POST /api/platform/users/hr-managers":
                    return (Kind.Json, new
                    {
                        fullName = "Matrix HRM Probe",
                        email = $"matrix-hrm-{Guid.NewGuid():N}@test.local".ToLowerInvariant(),
                        phone = "01000000000",
                        sendInvite = false,
                    }, null);

                case "PUT /api/platform/users/{p}/status":
                    return (Kind.Json, new { status = "Active", reason = "Security matrix probe" }, null);

                case "POST /api/platform/users/{p}/reset-password":
                    return (Kind.Json, new { revokeSessions = false }, null);

                case "POST /api/platform/users/{p}/revoke-sessions":
                    return (Kind.Json, new { reason = "Security matrix probe" }, null);

                case "PUT /api/platform/users/{p}/gym-access":
                    // Re-grant the branch the seeded HR user already holds: a no-op that
                    // keeps run state stable.
                    return (Kind.Json, new { branchIds = new[] { c.GymAId } }, null);

                // ---------------- platform plans ----------------

                case "POST /api/platform/plans":
                    return (Kind.Json, new
                    {
                        name = $"Matrix Plan {Guid.NewGuid():N}"[..24],
                        tagline = "Security matrix probe",
                        price = 1500,
                        cycleCount = 1,
                        cycleUnit = "Months",
                        trialMode = "Days",
                        trialDays = 14,
                        seatLimit = 50,
                        branchLimit = 2,
                        isHighlighted = false,
                        features = new[] { "Security matrix probe", "Priority support" },
                        addOns = new[] { new { name = "Extra employees", quantity = 5, price = 60 } },
                    }, null);

                case "PUT /api/platform/plans/{p}":
                    return (Kind.Json, new
                    {
                        name = $"Matrix Plan Put {Guid.NewGuid():N}"[..28],
                        tagline = "Security matrix probe (updated)",
                        price = 1600,
                        cycleCount = 1,
                        cycleUnit = "Months",
                        trialMode = "None",
                        trialDays = 0,
                        seatLimit = 60,
                        branchLimit = 2,
                        isHighlighted = false,
                        features = new[] { "Security matrix probe" },
                        addOns = Array.Empty<object>(),
                    }, null);

                case "POST /api/platform/plans/{p}/duplicate":
                    return (Kind.Json, new { name = $"Matrix Copy {Guid.NewGuid():N}"[..26] }, null);

                // ---------------- platform invoices ----------------

                case "POST /api/platform/invoices":
                    // A far-future period keeps this clear of every other row's invoices.
                    return (Kind.Json, new
                    {
                        companyId = c.CompanyAId,
                        periodStart = "2031-01-01",
                        periodEnd = "2031-01-31",
                        amount = 1000,
                        notes = "Security matrix probe",
                    }, null);

                case "POST /api/platform/invoices/reminders/bulk":
                    return (Kind.NoBody, null, null);

                case "POST /api/platform/invoices/{p}/payments":
                    // Partial payment of 1 unit: settles nothing, so run state stays stable.
                    return (Kind.Json, new { amount = 1, method = "BankTransfer", reference = "MATRIX-PROBE" }, null);

                case "POST /api/platform/invoices/{p}/reminders":
                    return (Kind.Json, new { channel = "Email" }, null);

                case "POST /api/platform/invoices/{p}/void":
                    return (Kind.Json, new { reason = "Security matrix probe" }, null);

                // ---------------- platform governance ----------------

                case "PUT /api/platform/settings":
                    // An all-null patch: the service treats it as an idempotent no-op and returns
                    // the current settings, which keeps run state untouched.
                    return (Kind.Json, new { }, null);

                case "PUT /api/platform/audit/retention-policy":
                    // Re-submits the defaults so the probe never widens or narrows retention.
                    return (Kind.Json, new
                    {
                        platformEventsYears = 7,
                        companyEventsYears = 3,
                        impersonationYears = 7,
                        exportRetentionDays = 90,
                    }, null);

                case "POST /api/platform/audit/export":
                    return (Kind.Json, new { format = "Csv", from = "2020-01-01" }, null);

                case "POST /api/platform/audit/{p}/review":
                    // The probe audit row may already be reviewed from a previous run, which the
                    // service answers with 400 — both outcomes are accepted by the row.
                    return (Kind.Json, new { note = "Security matrix probe" }, null);

                case "POST /api/platform/feature-flags":
                    return (Kind.Json, new
                    {
                        key = $"matrix.created.{Guid.NewGuid():N}"[..28].ToLowerInvariant(),
                        name = "Matrix created flag",
                        description = "Security matrix probe",
                        isEnabled = false,
                        scope = "Global",
                    }, null);

                case "PUT /api/platform/feature-flags/{p}":
                    return (Kind.Json, new
                    {
                        key = c.FeatureFlagProbeKey,
                        name = "Matrix probe (updated)",
                        description = "Security matrix probe",
                        isEnabled = false,
                        scope = "Global",
                    }, null);

                case "POST /api/platform/impersonation/start":
                    // Entering a workspace is the probe's whole point; the service auto-ends the
                    // actor's previous session, so repeated runs stay stable.
                    return (Kind.Json, new
                    {
                        companyId = c.CompanyAId,
                        reason = "Security matrix probe: verify act-as session issuance.",
                    }, null);

                case "POST /api/platform/impersonation/end":
                    // The probe has no live session id of its own; ending an unknown one is a 404
                    // after the guard passes, which the row accepts.
                    return (Kind.Json, new { sessionId = int.MaxValue }, null);

                default:
                    if (method.StartsWith("GET", StringComparison.OrdinalIgnoreCase)
                        || method.StartsWith("DELETE", StringComparison.OrdinalIgnoreCase))
                    {
                        return (Kind.NoBody, null, null);
                    }

                    throw new InvalidOperationException(
                        $"No payload defined for matrix route: {method} {routeTemplate}. " +
                        "Add it in EndpointPayloads so the 2xx path stays reachable.");
            }
        }

        /// <summary>
        /// Route-template placeholders → concrete values, identity aware: the target
        /// employee is always karim (the matrix's subject), so a plain employee
        /// (employeeOther) probing another employee's file is a true IDOR probe.
        /// </summary>
        public static string SubstituteRoute(string routeTemplate, SecurityContext c, string identityKey, int rowId, string method = "")
        {
            // Platform console routes use their own id space (company / branch / user / plan /
            // invoice / flag), so they are resolved before the HR-portal substitution below.
            if (routeTemplate.Contains("/api/platform/", StringComparison.OrdinalIgnoreCase))
            {
                return SubstitutePlatformRoute(routeTemplate, c, method);
            }

            // Row 21 (offboard) mutates the target's employment lifecycle — it must
            // never touch karim, on whom ~40 other rows depend inside the same run:
            // the dedicated probe employee absorbs it.
            var employeeId = rowId == 21 ? c.ProbeEmployeeId : c.KarimEmployeeId;

            var result = routeTemplate
                .Replace("{empId}", employeeId.ToString())
                .Replace("{id}", employeeId.ToString())
                .Replace("{evaluationId}", c.KarimEvaluationId.ToString())
                .Replace("{entryId}", c.PayrollEntryId.ToString())
                .Replace("{requestId}", c.KarimPendingRequestId.ToString())
                .Replace("{employeeReference}", c.ProbeEmployeeNumber);

            // The attachment download must address the request that actually HAS an
            // attachment (the endpoint 404s a pending request without files). The id
            // segment is matched as a whole so multi-digit ids can't corrupt each other.
            result = System.Text.RegularExpressions.Regex.Replace(
                result,
                @"/requests/\d+/attachment$",
                $"/requests/{c.KarimAttachedRequestId}/attachment");

            // The stage-1 undo adresses a stage-1 decided request; each allowed
            // identity owns a distinct decided target so parallel matches of the row
            // can never undo the same request twice. Out-of-scope identities keep the
            // karim-employee fallback, which requests with that id do not possess.
            result = System.Text.RegularExpressions.Regex.Replace(
                result,
                @"/requests/\d+/undo$",
                identityKey switch
                {
                    "teamLeader" => $"/requests/{c.KarimStage1DecidedTlRequestId}/undo",
                    "branchManager" => $"/requests/{c.KarimStage1DecidedBmRequestId}/undo",
                    "topManagement" => $"/requests/{c.KarimStage1DecidedTopRequestId}/undo",
                    _ => result,
                });

            // The two download routes address different document sources.
            return result.Replace("{docId}", result.Contains("/hr-documents/")
                ? c.KarimHrDocumentId.ToString()
                : c.KarimEmployeeDocumentId.ToString());
        }

        /// <summary>
        /// Platform routes address companies, branches and users, not employees. Each
        /// template is resolved explicitly so a company id can never be mistaken for an
        /// employee id (which the HR-portal substitution below would do).
        /// </summary>
        private static bool IsDelete(string method) =>
            method.Equals("DELETE", StringComparison.OrdinalIgnoreCase);

        private static string SubstitutePlatformRoute(string routeTemplate, SecurityContext c, string method)
        {
            // Invoice and plan routes need their own probe records; resolve those first so a
            // single {id} segment cannot be mistaken for a company or an employee id.
            var invoiceRoute = routeTemplate.Replace("{id:int}", "{id}");
            if (invoiceRoute.Contains("/platform/invoices/{id}", StringComparison.OrdinalIgnoreCase))
            {
                var invoiceId = invoiceRoute switch
                {
                    var r when r.EndsWith("/payments", StringComparison.OrdinalIgnoreCase) => c.InvoicePaymentProbeId,
                    var r when r.EndsWith("/reminders", StringComparison.OrdinalIgnoreCase) => c.InvoiceOverdueProbeId,
                    var r when r.EndsWith("/void", StringComparison.OrdinalIgnoreCase) => c.InvoiceVoidProbeId,
                    _ => c.InvoiceProbeId,
                };

                return System.Text.RegularExpressions.Regex.Replace(
                    routeTemplate, @"\{id(:int)?\}", invoiceId.ToString());
            }

            if (routeTemplate.Contains("/platform/feature-flags/{id}", StringComparison.OrdinalIgnoreCase))
            {
                // The delete row needs its own flag; the update row must not be left pointing at
                // one the delete already removed.
                var flagId = IsDelete(method) ? c.FeatureFlagDeleteProbeId : c.FeatureFlagProbeId;

                return System.Text.RegularExpressions.Regex.Replace(
                    routeTemplate, @"\{id(:int)?\}", flagId.ToString());
            }

            if (routeTemplate.Contains("/platform/audit/{id}", StringComparison.OrdinalIgnoreCase))
            {
                return System.Text.RegularExpressions.Regex.Replace(
                    routeTemplate, @"\{id(:int)?\}", c.AuditProbeId.ToString());
            }

            if (routeTemplate.Contains("/platform/audit/exports/{id}", StringComparison.OrdinalIgnoreCase))
            {
                // No package is guaranteed to exist, so the id stays a non-existent placeholder
                // and the row expects 404 for an authorized caller.
                return System.Text.RegularExpressions.Regex.Replace(
                    routeTemplate, @"\{id(:int)?\}", "EXP-0000-0000");
            }

            if (routeTemplate.Contains("/platform/plans/{id}", StringComparison.OrdinalIgnoreCase))            {
                var planId = routeTemplate.EndsWith("/archive-probe", StringComparison.OrdinalIgnoreCase)
                    ? c.PlanArchiveProbeId
                    : c.PlanProbeId;

                // The archive row targets a plan with no live subscription, so archiving it is a
                // deterministic 204 rather than a "plan in use" refusal.
                if (routeTemplate.EndsWith("/{id:int}", StringComparison.OrdinalIgnoreCase))
                {
                    planId = c.PlanArchiveProbeId;
                }

                return System.Text.RegularExpressions.Regex.Replace(
                    routeTemplate, @"\{id(:int)?\}", planId.ToString());
            }

            var segments = routeTemplate.Split('/');

            for (var i = 0; i < segments.Length; i++)
            {
                var current = segments[i];
                if (current is not ("{id:int}" or "{companyId:int}" or "{branchId:int}" or "{userId:int}" or "{id}" or "{companyId}" or "{branchId}" or "{userId}"))
                {
                    continue;
                }

                var previous = i > 0 ? segments[i - 1] : string.Empty;

                segments[i] = previous switch
                {
                    "companies" => c.CompanyAId.ToString(),
                    "branches" => c.GymAId.ToString(),
                    // User-administration rows target the throwaway probe account.
                    "hr-staff" or "users" => c.PlatformProbeUserId.ToString(),
                    _ => segments[i],
                };
            }

            return string.Join('/', segments);
        }

        private static HttpContent BulkImportMultipart(SecurityContext c)        {
            var csv = "Name,Email,Position,Level,Gym,Salary\n" +
                      $"Bulk Matrix Probe,{Guid.NewGuid():N}.bulk@test.local,Trainer,2,Revive Main Gym,5000\n";
            var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
            content.Add(fileContent, "file", "import.csv");
            return content;
        }

        private static HttpContent DocumentUploadMultipart()
        {
            var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(Encoding.ASCII.GetBytes("%PDF-1.4 security matrix"));
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            content.Add(fileContent, "file", "matrix-doc.pdf");
            content.Add(new StringContent("Contract"), "category"); // a valid DocumentType
            return content;
        }

        private static HttpContent PhotoMultipart()
        {
            var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            content.Add(fileContent, "file", "matrix-avatar.png");
            return content;
        }

        private static HttpContent RequestCreateMultipart()
        {
            var content = new MultipartFormDataContent();
            content.Add(new StringContent("annual-leave"), "type");
            content.Add(new StringContent(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)).ToString("yyyy-MM-dd")), "requestDate");
            content.Add(new StringContent("Matrix health check (future annual leave)"), "reason");
            return content;
        }

        /// <summary>
        /// A 64x64 24-bit black BMP (byte-parity with the integration suite's
        /// proven implementation — the real SkiaSharp engine decodes it correctly
        /// and rejects it with 400 "No face was detected"). Wrapped in a data-URI.
        /// </summary>
        public static string BlackImage()
        {
            const int width = 64;
            const int height = 64;
            const int rowSize = width * 3; // 24-bit BMP, rows already 4-byte aligned
            const int dataSize = rowSize * height;
            var bytes = new byte[54 + dataSize];

            // BITMAPFILEHEADER
            bytes[0] = (byte)'B'; bytes[1] = (byte)'M';
            BitConverter.GetBytes(bytes.Length).CopyTo(bytes, 2);
            BitConverter.GetBytes(54).CopyTo(bytes, 10);
            // BITMAPINFOHEADER
            BitConverter.GetBytes(40).CopyTo(bytes, 14);
            BitConverter.GetBytes(width).CopyTo(bytes, 18);
            BitConverter.GetBytes(height).CopyTo(bytes, 22);
            BitConverter.GetBytes((short)1).CopyTo(bytes, 26);
            BitConverter.GetBytes((short)24).CopyTo(bytes, 28);
            BitConverter.GetBytes(dataSize).CopyTo(bytes, 34);
            // Remaining bytes are already zero → black pixels.

            return "data:image/bmp;base64," + Convert.ToBase64String(bytes);
        }
    }
}
