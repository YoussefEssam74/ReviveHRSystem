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
    /// Attendance events. Callers authenticate either with the opaque station session
    /// token from POST /api/kiosk/login (sent as the X-Station-Token header) or with a
    /// gym-scoped user token. The gym is derived from the validated session â€” the
    /// request body carries no station code and never influences the gym binding.
    /// ADR-004 cross-gym validation (employee gym access + scheduled shift at that
    /// gym) applies to every event, exactly as before. No device token (device-bound
    /// credentials were deliberately removed â€” broken station hardware can never
    /// invalidate the integration).
    /// </summary>
    [Route("api/attendance")]
    [Authorize]
    public class AttendanceController(IAttendanceService _attendanceService, IFaceBiometricService _faceBiometricService) : ApiControllerBase
    {
        #region Record Event

        /// <summary>Biometric check-in/out from a station (liveness score required).</summary>
        /// <response code="201">Attendance event recorded.</response>
        /// <response code="401">Missing/expired station session, or no gym-bound credential.</response>
        [HttpPost("events")]
        [EnableRateLimiting("station-attendance")]
        [ProducesResponseType(typeof(AttendanceResponse), StatusCodes.Status201Created)]
        public async Task<ActionResult<AttendanceResponse>> RecordEvent([FromBody] AttendanceEventRequest request, CancellationToken cancellationToken)
        {
            // Integration endpoint: an AUTO event records immediately - the kiosk
            // confirmation gate only applies to face scans from the terminal UI.
            var response = await _attendanceService.RecordBiometricEventAsync(
                request,
                GetGymIdFromToken(),
                GetStationSessionId(),
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                confirmCheckout: true,
                cancellationToken: cancellationToken);
            return StatusCode(StatusCodes.Status201Created, response!);
        }

        #endregion

        #region Face Scan

        /// <summary>
        /// Face-ID check-in/out: detection + liveness + recognition, recorded atomically.
        /// Every frame-level state comes back as a 200 with an Outcome discriminator
        /// (no_face, low_liveness, unrecognized, already_complete, rejected,
        /// pending_checkout, recorded), so the station can drive a live HUD - liveness
        /// percentage, matched name and ID - and tell a silent "already complete" from a
        /// rejection that deserves a card. Only a frame that cannot be decoded as an
        /// image is a 400. An AUTO scan that would check the employee OUT returns
        /// pending_checkout (nothing recorded) unless the request carries ConfirmCheckout.
        /// </summary>
        /// <response code="200">Scan outcome (see FaceScanOutcome); a punch only for "recorded".</response>
        /// <response code="201">Face recognized and an attendance event was recorded.</response>
        /// <response code="401">Missing/expired station session, or no gym-bound credential.</response>
        [HttpPost("face-scan")]
        [EnableRateLimiting("station-attendance")]
        [ProducesResponseType(typeof(FaceScanResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(FaceScanResponse), StatusCodes.Status201Created)]
        public async Task<ActionResult<FaceScanResponse>> FaceScan([FromBody] FaceScanRequest request, CancellationToken cancellationToken)
        {
            var response = await _faceBiometricService.ScanFaceAsync(
                request,
                GetGymIdFromToken(),
                GetStationSessionId(),
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                cancellationToken);

            // 201 only when a punch was actually created; every other outcome is a
            // plain 200 - it is a scan result, not a resource.
            if (response.Outcome == FaceScanOutcome.Recorded)
                return StatusCode(StatusCodes.Status201Created, response);

            return Ok(response);
        }

        #endregion

        #region Station Summary

        /// <summary>
        /// Today's counters and most recent events for the station's gym - the data
        /// behind the kiosk dashboard. Authenticated by the station session (or a
        /// gym-scoped user token); the GymId comes from that credential.
        /// </summary>
        /// <response code="200">Today's summary for the gym.</response>
        /// <response code="401">Missing/expired station session, or no gym-bound credential.</response>
        [HttpGet("station-summary")]
        [EnableRateLimiting("station-attendance")]
        public async Task<ActionResult<StationSummaryResponse>> StationSummary(CancellationToken cancellationToken)
        {
            var response = await _attendanceService.GetStationSummaryAsync(
                GetGymIdFromToken() ?? 0,
                cancellationToken);
            return Ok(response);
        }

        #endregion

        #region Record Manual

        /// <summary>Manual check-in/out fallback (Face ID failure) â€” the reason is audited.</summary>
        /// <response code="201">Manual attendance event recorded and audited.</response>
        /// <response code="401">Missing/expired station session, or no gym-bound credential.</response>
        [HttpPost("manual")]
        [EnableRateLimiting("station-attendance")]
        [ProducesResponseType(typeof(Shared.DataTransferObject.Attendance.AttendanceResponse), StatusCodes.Status201Created)]
        public async Task<ActionResult<Shared.DataTransferObject.Attendance.AttendanceResponse>> RecordManual([FromBody] Shared.DataTransferObject.Attendance.ManualAttendanceRequest request, CancellationToken cancellationToken)
        {
            var response = await _attendanceService.RecordManualEntryAsync(
                request,
                GetGymIdFromToken(),
                GetStationSessionId(),
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                cancellationToken);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        #endregion
    }
}
