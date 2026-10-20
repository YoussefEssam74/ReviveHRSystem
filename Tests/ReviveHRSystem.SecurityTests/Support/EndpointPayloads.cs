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
                    return (Kind.Json, new { }, null);

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
        public static string SubstituteRoute(string routeTemplate, SecurityContext c, string identityKey, int rowId)
        {
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

            // The two download routes address different document sources.
            return result.Replace("{docId}", result.Contains("/hr-documents/")
                ? c.KarimHrDocumentId.ToString()
                : c.KarimEmployeeDocumentId.ToString());
        }

        private static HttpContent BulkImportMultipart(SecurityContext c)
        {
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
