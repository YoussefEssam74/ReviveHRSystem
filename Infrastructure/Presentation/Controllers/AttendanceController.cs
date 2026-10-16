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
    public class AttendanceController(
        IAttendanceService _attendanceService,
        IAttendanceManagementService _attendanceManagement,
        IFaceBiometricService _faceBiometricService,
        IPayrollService _payroll) : ApiControllerBase
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

        /// <summary>
        /// Manual attendance, two shapes on one route. The HR-portal day-write form
        /// (IsHrForm) is user-token authenticated and guarded by the
        /// attendance.manual_entry permission — it upserts the (employee, day) record
        /// and returns the composed grid row. The station punch form (IN/OUT/AUTO)
        /// keeps its kiosk-session authentication and audit trail, unchanged.
        /// </summary>
        /// <response code="201">Manual attendance event recorded and audited.</response>
        /// <response code="401">Missing/expired station session, or no gym-bound credential.</response>
        /// <response code="403">HR form without attendance.manual_entry on the employee's gym.</response>
        [HttpPost("manual")]
        [EnableRateLimiting("station-attendance")]
        [ProducesResponseType(typeof(Shared.DataTransferObject.Attendance.AttendanceResponse), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(HrAttendanceRecordResponse), StatusCodes.Status201Created)]
        public async Task<IActionResult> RecordManual([FromBody] Shared.DataTransferObject.Attendance.ManualAttendanceRequest request, CancellationToken cancellationToken)
        {
            if (request.IsHrForm)
            {
                var response = await _attendanceManagement.RecordManualEntryAsync(
                    GetActorUserId(), request.ToHrRequest(), cancellationToken);
                return StatusCode(StatusCodes.Status201Created, response);
            }

            var stationResponse = await _attendanceService.RecordManualEntryAsync(
                request,
                GetGymIdFromToken(),
                GetStationSessionId(),
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                cancellationToken);
            return StatusCode(StatusCodes.Status201Created, stationResponse);
        }

        #endregion

        #region HR Directory Grid

        /// <summary>
        /// The HR attendance directory grid (A1): one row per (employee, day) for the
        /// requested range, composing stored punches with shift assignments, approved
        /// Day Off requests and employment status — exactly what the mock UI generates
        /// client-side. Gym-scoped by the caller's access; requires attendance.view.
        /// </summary>
        /// <response code="200">Composed attendance rows for the range.</response>
        /// <response code="401">Missing/expired token.</response>
        /// <response code="403">No attendance.view on any of the requested gyms.</response>
        [HttpGet]
        [ProducesResponseType(typeof(AttendanceListResponse), StatusCodes.Status200OK)]
        public async Task<ActionResult<AttendanceListResponse>> GetAttendance([FromQuery] AttendanceListQuery query, CancellationToken cancellationToken)
        {
            var response = await _attendanceManagement.GetAttendanceAsync(GetActorUserId(), query, cancellationToken);
            return Ok(response);
        }

        #endregion

        #region Punch audit (payroll settlement refs)

        /// <summary>
        /// <summary>
        /// GET /api/attendance/{id} — punch audit for a referenced record (payroll
        /// settlement sheet, §5.5). The id is an attendance ref ("ATT-123") or a bare
        /// record id; requires payroll.view or attendance.view and the record's gym.
        /// </summary>
        /// </summary>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(Shared.DataTransferObject.Payroll.AttendanceRefResponse), StatusCodes.Status200OK)]
        public async Task<ActionResult<Shared.DataTransferObject.Payroll.AttendanceRefResponse>> GetAttendanceRef(string id, CancellationToken cancellationToken)
        {
            var response = await _payroll.GetAttendanceRefAsync(GetActorUserId(), id, cancellationToken);
            return Ok(response);
        }

        #endregion

        #region Correct Record

        /// <summary>
        /// Corrects one attendance record with a full audit trail (A4): the previous
        /// punch/status is preserved on an AttendanceCorrection row (alongside the
        /// editing user), and the record takes the new values. Requires
        /// attendance.edit on the record's gym; a reason of at least 3 characters is
        /// mandatory. Returns the composed grid row for the corrected record.
        /// </summary>
        /// <response code="200">The corrected record.</response>
        /// <response code="400">Missing reason or invalid punch format.</response>
        /// <response code="401">Missing/expired token.</response>
        /// <response code="403">No attendance.edit on the record's gym.</response>
        /// <response code="404">Unknown attendance record.</response>
        [HttpPut("{id:int}/correct")]
        [ProducesResponseType(typeof(HrAttendanceRecordResponse), StatusCodes.Status200OK)]
        public async Task<ActionResult<HrAttendanceRecordResponse>> CorrectRecord(int id, [FromBody] AttendanceCorrectionRequest request, CancellationToken cancellationToken)
        {
            var response = await _attendanceManagement.CorrectRecordAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(response);
        }

        #endregion
    }
}
