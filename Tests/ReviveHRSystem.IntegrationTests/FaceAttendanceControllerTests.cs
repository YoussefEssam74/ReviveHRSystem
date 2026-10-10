using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DomainLayer.Models.UserModule.Enums;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Face-ID endpoints (in-process ONNX pipeline). These cover the deterministic
    /// contract paths; the happy recognition path needs a real captured face and is
    /// exercised end-to-end via a live station flow.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class FaceAttendanceControllerTests
    {
        private readonly ApiTestFixture _fixture;

        public FaceAttendanceControllerTests(ApiTestFixture fixture) => _fixture = fixture;

        /// <summary>A64×64 black BMP as a data URL — valid image, contains no face.</summary>
        private static string BlackImage()
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

        private async Task<(HttpStatusCode Status, JsonElement Body)> PostFaceScanAsync(object payload, string stationToken)
        {
            // Face scans are station-session authenticated via the X-Station-Token header.
            var request = _fixture.StationRequest(HttpMethod.Post, "/api/attendance/face-scan", payload, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (response.StatusCode, body);
        }

        [Fact]
        public async Task FaceScan_BogusStationToken_Returns401()
        {
            // A session token that does not match any stored hash is rejected by the
            // authentication layer (bare 401 — no error envelope, no information leak).
            var request = _fixture.StationRequest(
                HttpMethod.Post, "/api/attendance/face-scan",
                new { type = "IN", image = BlackImage() }, new string('a', 64));

            var response = await _fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task FaceScan_WithoutStationToken_Returns401()
        {
            var response = await _fixture.Client.PostAsJsonAsync(
                "/api/attendance/face-scan",
                new { type = "IN", image = BlackImage() });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task FaceScan_BlackFrame_Returns200_NoFaceOutcome()
        {
            // A frame with no face is an ordinary scan outcome, not an error: the
            // station shows a live HUD from the discriminator.
            var stationToken = await _fixture.GetStationTokenAsync(_fixture.Gym1StationCode);

            var (status, body) = await PostFaceScanAsync(new
            {
                type = "IN",
                image = BlackImage(),
            }, stationToken);

            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal("no_face", body.GetProperty("outcome").GetString());
            Assert.Equal("No face was detected in the frame.", body.GetProperty("message").GetString());
        }

        [Fact]
        public async Task FaceScan_GarbageImage_Returns400_InvalidImage()
        {
            var stationToken = await _fixture.GetStationTokenAsync(_fixture.Gym1StationCode);

            var (status, body) = await PostFaceScanAsync(new
            {
                type = "IN",
                image = "data:image/jpeg;base64,not-base-64!!",
            }, stationToken);

            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("The frame could not be decoded as an image.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task FaceScan_GymScopedUserToken_Authenticates()
        {
            // Karim is scoped to gym1, so his access token carries the gymId claim and may
            // act on behalf of an attendance station; the black frame then proves the
            // authentication (not the image) is what got the request that far.
            var token = await _fixture.LoginAsync("karim@revive.hr", ReviveHRSystem.Web.DataSeed.DevelopmentDataSeeder.EmployeePassword);
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/attendance/face-scan")
            {
                Content = JsonContent.Create(new { type = "IN", image = BlackImage() }),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("no_face", body.GetProperty("outcome").GetString());
        }

        [Fact]
        public async Task Enroll_WithoutToken_Returns401()
        {
            var response = await _fixture.Client.PostAsJsonAsync("/api/employees/face/enroll", new
            {
                employeeNumber = "EMP-1042",
                image = BlackImage(),
            });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Enroll_BlackFrame_WithToken_Returns400_FaceNotDetected()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/employees/face/enroll")
            {
                Content = JsonContent.Create(new { employeeNumber = "EMP-1042", image = BlackImage() }),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("No face was detected in the frame.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Enroll_UnknownEmployee_Returns404()
        {
            var token = await _fixture.GetAdminTokenAsync();
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/employees/face/enroll")
            {
                Content = JsonContent.Create(new { employeeNumber = "IT-NOBODY", image = BlackImage() }),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("Employee not found.", body.GetProperty("errorMessage").GetString());
        }

        private async Task<(HttpStatusCode Status, JsonElement Body)> PostEnrollAsync(string token, string employeeNumber)
        {
            var request = _fixture.AuthorizedRequest(
                HttpMethod.Post, "/api/employees/face/enroll",
                new { employeeNumber, image = BlackImage() }, token);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (response.StatusCode, body);
        }

        // --- Enrollment authorization (HR-side administration) ---

        [Fact]
        public async Task Enroll_StationSession_Returns401()
        {
            // Regression: a station session authenticates as a station (gym binding, no
            // uid), so it must never reach HR-only operations such as enrolling faces.
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var request = _fixture.StationRequest(
                HttpMethod.Post, "/api/employees/face/enroll",
                new { employeeNumber = "IT-ANY", image = BlackImage() }, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("Your session is invalid. Please sign in again.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Enroll_EmployeeSession_Returns401()
        {
            // An authenticated employee may manage only their own self-service data.
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var employee = await new TestDataBuilder(_fixture.Services).CreateEmployeeAsync(gym);
            var token = await _fixture.LoginAsync(employee.Email, employee.Password);

            var (status, body) = await PostEnrollAsync(token, employee.EmployeeNumber);

            Assert.Equal(HttpStatusCode.Unauthorized, status);
            Assert.Equal("You are not allowed to manage face enrollments.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Enroll_HrWithoutGymAccess_Returns401()
        {
            // Cross-gym IDOR regression: HR for another gym cannot enroll this employee's face.
            var builder = new TestDataBuilder(_fixture.Services);
            var employeeGym = await builder.CreateGymWithStationAsync();
            var hrGym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(employeeGym);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { hrGym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var (status, body) = await PostEnrollAsync(token, employee.EmployeeNumber);

            Assert.Equal(HttpStatusCode.Unauthorized, status);
            Assert.Equal("You do not have access to this gym.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Enroll_HrWithGymAccess_PassesAuthorization()
        {
            // Authorization succeeds — the frame then fails face detection (400), which proves
            // gym scoping, not the image, is what allowed the request through.
            var builder = new TestDataBuilder(_fixture.Services);
            var gym = await builder.CreateGymWithStationAsync();
            var employee = await builder.CreateEmployeeAsync(gym);
            var hr = await builder.CreateUserAsync(UserType.HR, new[] { gym });
            var token = await _fixture.LoginAsync(hr.Email, hr.Password);

            var (status, body) = await PostEnrollAsync(token, employee.EmployeeNumber);

            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("No face was detected in the frame.", body.GetProperty("errorMessage").GetString());
        }

        [Fact]
        public async Task Remove_StationSession_Returns401()
        {
            var gym = await new TestDataBuilder(_fixture.Services).CreateGymWithStationAsync();
            var stationToken = await _fixture.GetStationTokenAsync(gym.StationCode);

            var request = _fixture.StationRequest(HttpMethod.Delete, "/api/employees/face/IT-ANY", null, stationToken);
            var response = await _fixture.Client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("Your session is invalid. Please sign in again.", body.GetProperty("errorMessage").GetString());
        }
    }
}
