using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ServiceAbstraction.Services;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Slice E: avatar upload/read (mock 2.4), the HR-published documents list (3.3)
    /// and the two download streams (3.5/3.6).
    ///
    /// The point of these tests is the access rule rather than the byte plumbing: a
    /// document may only be read through the route that matches its owner, only by
    /// someone already able to see that employee, and only when bytes are actually
    /// stored — every other answer is 404 so the route never confirms an id exists.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class DocumentStorageTests
    {
        private readonly ApiTestFixture _fixture;

        public DocumentStorageTests(ApiTestFixture fixture) => _fixture = fixture;

        /// <summary>A 1x1 transparent PNG: the smallest file that is still a real image.</summary>
        private static readonly byte[] TinyPng = Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

        /// <summary>A 1x1 white JPEG, so a second upload differs in type as well as bytes.</summary>
        private static readonly byte[] TinyJpeg = Convert.FromBase64String(
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==");

        [Fact]
        public async Task Photo_UploadThenRead_RoundTripsTheBytes()
        {
            var employeeId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var upload = await _fixture.Client.SendAsync(MultipartPut(
                $"/api/employees/{employeeId}/photo", token, "me.png", TinyPng));
            upload.EnsureSuccessStatusCode();

            var body = await upload.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal($"/api/employees/{employeeId}/photo", body.GetProperty("photoUrl").GetString());

            var read = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/photo", null, token);
            var readResponse = await _fixture.Client.SendAsync(read);
            readResponse.EnsureSuccessStatusCode();

            Assert.Equal("image/png", readResponse.Content.Headers.ContentType?.MediaType);
            Assert.Equal(TinyPng, await readResponse.Content.ReadAsByteArrayAsync());

            // The profile now advertises the avatar instead of the initials placeholder.
            var profileRequest = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}", null, token);
            var profileBody = await (await _fixture.Client.SendAsync(profileRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal($"/api/employees/{employeeId}/photo", profileBody.GetProperty("photoUrl").GetString());
        }

        [Fact]
        public async Task Photo_UploadToAnotherEmployee_Returns404()
        {
            // Uploads are self-only: the route's id must be the caller's own employee.
            var karimId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var saraId = await EmployeeIdByEmailAsync("sara@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var upload = await _fixture.Client.SendAsync(MultipartPut(
                $"/api/employees/{saraId}/photo", token, "me.png", TinyPng));

            Assert.Equal(HttpStatusCode.NotFound, upload.StatusCode);
        }

        [Fact]
        public async Task Photo_UnsupportedFileType_Returns400()
        {
            // The extension decides the media type served back, so an unknown one is
            // refused rather than stored and then served as something it is not.
            var employeeId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var upload = await _fixture.Client.SendAsync(MultipartPut(
                $"/api/employees/{employeeId}/photo", token, "payload.exe", new byte[] { 1, 2, 3 }));

            Assert.Equal(HttpStatusCode.BadRequest, upload.StatusCode);
        }

        [Fact]
        public async Task HrDocuments_ShowsOnlyHrPublishedDocuments()
        {
            var employeeId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var ownDocId = await SeedDocumentAsync(employeeId, DocumentSourceRow.Employee, "Contract", "my-contract.pdf");
            var hrDocId = await SeedDocumentAsync(employeeId, DocumentSourceRow.Hr, "Contract", "handbook.png", TinyPng);

            var list = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/hr-documents", null, token);
            var body = await (await _fixture.Client.SendAsync(list)).Content.ReadFromJsonAsync<JsonElement>();

            var ids = body.EnumerateArray().Select(d => d.GetProperty("id").GetInt32()).ToList();
            Assert.Contains(hrDocId, ids);
            Assert.DoesNotContain(ownDocId, ids);

            var mine = body.EnumerateArray().First(d => d.GetProperty("id").GetInt32() == hrDocId);
            Assert.Equal("handbook.png", mine.GetProperty("name").GetString());

            // The label comes from the stored extension, so a .png always reads as PNG
            // whatever its bytes turn out to be — the type and the file can't disagree.
            Assert.Equal($"PNG · {TinyPng.Length} B", mine.GetProperty("size").GetString());
        }

        [Fact]
        public async Task Download_StoredEmployeeDocument_ReturnsItsBytes()
        {
            var employeeId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var documentId = await SeedDocumentAsync(employeeId, DocumentSourceRow.Employee, "NationalId", "id.png", TinyPng);

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/documents/{documentId}/download", null, token);
            var response = await _fixture.Client.SendAsync(request);

            response.EnsureSuccessStatusCode();
            Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
            Assert.Equal(TinyPng, await response.Content.ReadAsByteArrayAsync());
        }

        [Fact]
        public async Task Download_HrDocument_IsOnlyReachableThroughTheHrRoute()
        {
            var employeeId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var documentId = await SeedDocumentAsync(employeeId, DocumentSourceRow.Hr, "Other", "policy.png", TinyPng);

            var viaHr = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/hr-documents/{documentId}/download", null, token);
            (await _fixture.Client.SendAsync(viaHr)).EnsureSuccessStatusCode();

            // The employee-vault route must not serve it, and must not confirm it exists.
            var viaVault = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/documents/{documentId}/download", null, token);
            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(viaVault)).StatusCode);
        }

        [Fact]
        public async Task Download_DocumentOfAnotherGym_Returns404()
        {
            // Karim (gym1) must not learn that sara's (gym2) document exists.
            var karimId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var saraId = await EmployeeIdByEmailAsync("sara@revive.hr");
            var documentId = await SeedDocumentAsync(saraId, DocumentSourceRow.Employee, "Contract", "sara.png", TinyPng);

            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{saraId}/documents/{documentId}/download", null, token);

            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(request)).StatusCode);
        }

        [Fact]
        public async Task Download_MetadataOnlyDocument_Returns404()
        {
            // canDownload is false for a row with no stored bytes, so the stream route
            // answers 404 rather than an empty 200.
            var employeeId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");
            var documentId = await SeedDocumentAsync(employeeId, DocumentSourceRow.Employee, "Other", "link-only.pdf");

            var list = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/documents", null, token);
            var body = await (await _fixture.Client.SendAsync(list)).Content.ReadFromJsonAsync<JsonElement>();
            var row = body.EnumerateArray().First(d => d.GetProperty("id").GetInt32() == documentId);
            Assert.False(row.GetProperty("canDownload").GetBoolean());

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/documents/{documentId}/download", null, token);
            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(request)).StatusCode);
        }

        [Fact]
        public async Task Download_UnknownDocumentId_Returns404()
        {
            var employeeId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var request = _fixture.AuthorizedRequest(
                HttpMethod.Get, $"/api/employees/{employeeId}/documents/999999/download", null, token);

            Assert.Equal(HttpStatusCode.NotFound, (await _fixture.Client.SendAsync(request)).StatusCode);
        }

        [Fact]
        public async Task Photo_UploadTwice_SupersedesAndReapsThePreviousFile()
        {
            // Replacing an avatar must leave exactly one stored file: the new bytes
            // served under the new type, and the old path gone rather than orphaned.
            var employeeId = await EmployeeIdByEmailAsync("karim@revive.hr");
            var token = await _fixture.LoginAsync("karim@revive.hr", "Revive!2026");

            var first = await _fixture.Client.SendAsync(MultipartPut(
                $"/api/employees/{employeeId}/photo", token, "first.png", TinyPng));
            first.EnsureSuccessStatusCode();

            var oldPath = await PhotoPathAsync(employeeId);

            var second = await _fixture.Client.SendAsync(MultipartPut(
                $"/api/employees/{employeeId}/photo", token, "second.jpg", TinyJpeg));
            second.EnsureSuccessStatusCode();

            var read = _fixture.AuthorizedRequest(HttpMethod.Get, $"/api/employees/{employeeId}/photo", null, token);
            var response = await _fixture.Client.SendAsync(read);

            response.EnsureSuccessStatusCode();
            Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
            Assert.Equal(TinyJpeg, await response.Content.ReadAsByteArrayAsync());

            using var scope = _fixture.Services.CreateScope();
            var storage = scope.ServiceProvider.GetRequiredService<IFileStorage>();

            Assert.NotEqual(oldPath, await PhotoPathAsync(employeeId));
            Assert.Null(storage.TryOpenRead(oldPath));      // superseded file reaped
            Assert.NotNull(storage.TryOpenRead(await PhotoPathAsync(employeeId)));
        }

        [Fact]
        public async Task Storage_OverSizeCap_IsRefusedAndLeavesNoFile()
        {
            // The cap is a hard ceiling: a body one byte over must be refused, and the
            // partial write must be cleaned up rather than left as an orphan nobody
            // references (the row that would name it is never created either).
            using var scope = _fixture.Services.CreateScope();
            var storage = scope.ServiceProvider.GetRequiredService<IFileStorage>();
            var root = StorageRoot(scope.ServiceProvider);
            var filesBefore = CountFiles(root);

            var oversized = new MemoryStream(new byte[10 * 1024 * 1024 + 1]);
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                () => storage.SaveAsync("avatars", "big.png", oversized));

            Assert.Contains("MB", exception.Message);
            Assert.Equal(filesBefore, CountFiles(root));
        }

        [Fact]
        public void Storage_TraversalPaths_NeverEscapeTheRoot()
        {
            // A stored path is data that outlives the request that wrote it (and older
            // rows were populated from a client-supplied value), so it is re-checked on
            // the way back in. None of these may resolve to a file outside the root.
            using var scope = _fixture.Services.CreateScope();
            var storage = scope.ServiceProvider.GetRequiredService<IFileStorage>();

            Assert.Null(storage.TryOpenRead("../../../appsettings.json"));
            Assert.Null(storage.TryOpenRead(@"..\..\appsettings.json"));
            Assert.Null(storage.TryOpenRead("documents/../../appsettings.json"));
            Assert.Null(storage.TryOpenRead(@"C:\Windows\win.ini"));
            Assert.Null(storage.TryOpenRead("/etc/passwd"));
            Assert.Null(storage.TryOpenRead(string.Empty));
        }

        // ---------- helpers ----------

        private HttpRequestMessage MultipartPut(string url, string token, string fileName, byte[] bytes)
        {
            var request = new HttpRequestMessage(HttpMethod.Put, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var form = new MultipartFormDataContent();
            var file = new ByteArrayContent(bytes);
            file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            form.Add(file, "file", fileName);
            request.Content = form;

            return request;
        }

        private async Task<int> EmployeeIdByEmailAsync(string email)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees.Where(e => e.User!.Email == email).Select(e => e.Id).SingleAsync();
        }

        /// <summary>The storage path currently on the row — server-side only, never returned by the API.</summary>
        private async Task<string> PhotoPathAsync(int employeeId)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();
            return await db.Employees
                .Where(e => e.Id == employeeId)
                .Select(e => e.PhotoPath)
                .SingleAsync() ?? string.Empty;
        }

        /// <summary>Everything currently on disk under the configured storage root.</summary>
        private static int CountFiles(string root) =>
            Directory.Exists(root)
                ? Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories).Count()
                : 0;

        /// <summary>Resolves the configured root exactly the way the provider does.</summary>
        private static string StorageRoot(IServiceProvider services)
        {
            var configured = services.GetRequiredService<Microsoft.Extensions.Options.IOptions<Storage.StorageOptions>>()
                .Value.RootPath;

            return Path.GetFullPath(Path.IsPathRooted(configured)
                ? configured
                : Path.Combine(AppContext.BaseDirectory, configured));
        }

        /// <summary>
        /// Owner of a document row, as stored. The domain enum mirrors these values,
        /// but the test writes them by name so a renamed enum member fails loudly here
        /// instead of silently reclassifying every seeded document.
        /// </summary>
        private enum DocumentSourceRow
        {
            Employee = 0,
            Hr = 1
        }

        /// <summary>
        /// Creates a document row, storing real bytes when supplied so the download
        /// path is exercised end to end; passing null leaves a metadata-only row.
        /// </summary>
        private async Task<int> SeedDocumentAsync(int employeeId, DocumentSourceRow source, string category, string fileName, byte[]? bytes = null)
        {
            using var scope = _fixture.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ReviveHrDbContext>();

            string path = string.Empty;
            long? size = null;
            string? contentType = null;

            if (bytes is not null)
            {
                var storage = scope.ServiceProvider.GetRequiredService<IFileStorage>();
                var stored = await storage.SaveAsync(
                    source == DocumentSourceRow.Hr ? "hr-documents" : "documents",
                    fileName,
                    new MemoryStream(bytes));
                path = stored.RelativePath;
                size = stored.SizeBytes;
                contentType = stored.ContentType;
            }

            var document = new DomainLayer.Models.EmployeeModule.EmployeeDocument
            {
                EmployeeId = employeeId,
                Type = Enum.Parse<DomainLayer.Models.EmployeeModule.Enums.DocumentType>(category),
                FileName = fileName,
                FilePath = path,
                SizeBytes = size,
                ContentType = contentType,
                Source = (DomainLayer.Models.EmployeeModule.Enums.DocumentSource)source
            };

            db.EmployeeDocuments.Add(document);
            await db.SaveChangesAsync();
            return document.Id;
        }
    }
}
