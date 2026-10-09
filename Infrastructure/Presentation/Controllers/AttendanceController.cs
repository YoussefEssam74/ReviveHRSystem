using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Attendance;
using Shared.DataTransferObject.Face;

namespace Presentation.Controllers
{
    /// <summary>
    /// Attendance events, authenticated with the station token issued by
    /// POST /api/kiosk/login (a gym-bound JWT) — or any gym-scoped user token.
    /// The gym's 6-digit station code in the body resolves the station; the token's
    /// gymId claim must match that gym (ADR-004 cross-gym validation still applies).
    /// No device token (device-bound credentials were deliberately removed — broken
    /// station hardware can never invalidate the integration).
    /// </summary>
    [Route("api/attendance")]
    [Authorize]
    public class AttendanceController(IAttendanceService _attendanceService, IFaceBiometricService _faceBiometricService) : ApiControllerBase
    {
        #region Record Event

        /// <summary>Biometric check-in/out from a station (liveness score required).</summary>
        /// <response code="201">Attendance event recorded.</response>
        /// <response code="401">Missing/expired token, unknown station code, token not gym-bound, or token bound to another gym.</response>
        [HttpPost("events")]
        [EnableRateLimiting("station-attendance")]
        [ProducesResponseType(typeof(AttendanceResponse), StatusCodes.Status201Created)]
        public async Task<ActionResult<AttendanceResponse>> RecordEvent([FromBody] AttendanceEventRequest request, CancellationToken cancellationToken)
        {
            var response = await _attendanceService.RecordBiometricEventAsync(
                request,
                GetGymIdFromToken(),
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                cancellationToken);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        #endregion

        #region Face Scan

        /// <summary>Face-ID check-in/out: detection + liveness + recognition, recorded atomically.</summary>
        /// <response code="201">Face recognized and attendance event recorded.</response>
        /// <response code="401">Missing/expired token, unknown station code, token not gym-bound, or token bound to another gym.</response>
        [HttpPost("face-scan")]
        [EnableRateLimiting("station-attendance")]
        [ProducesResponseType(typeof(FaceScanResponse), StatusCodes.Status201Created)]
        public async Task<ActionResult<FaceScanResponse>> FaceScan([FromBody] FaceScanRequest request, CancellationToken cancellationToken)
        {
            var response = await _faceBiometricService.ScanFaceAsync(
                request,
                GetGymIdFromToken(),
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                cancellationToken);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        #endregion

        #region Record Manual

        /// <summary>Manual check-in/out fallback (Face ID failure).</summary>
        /// <response code="201">Manual attendance event recorded and audited.</response>
        /// <response code="401">Missing/expired token, unknown station code, token not gym-bound, or token bound to another gym.</response>
        [HttpPost("manual")]
        [EnableRateLimiting("station-attendance")]
        [ProducesResponseType(typeof(AttendanceResponse), StatusCodes.Status201Created)]
        public async Task<ActionResult<AttendanceResponse>> RecordManual([FromBody] ManualAttendanceRequest request, CancellationToken cancellationToken)
        {
            var response = await _attendanceService.RecordManualEntryAsync(
                request,
                GetGymIdFromToken(),
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                cancellationToken);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        #endregion
    }
}
