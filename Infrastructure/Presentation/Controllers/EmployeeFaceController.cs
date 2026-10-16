using DomainLayer.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Face;

namespace Presentation.Controllers
{
    /// <summary>
    /// HR-side face enrollment: registers an employee's face for Face-ID attendance.
    /// Faces are stored as embeddings in the database (one per employee, re-enrolling
    /// replaces) and are only ever matched within the station's gym scope.
    /// Enrollment and removal are restricted to TopManagement, or HR users assigned to
    /// the employee's gym — an employee's own session token is not sufficient.
    /// </summary>
    [Route("api/employees/face")]
    [Authorize]
    public class EmployeeFaceController(IFaceBiometricService _faceBiometricService) : ApiControllerBase
    {
        #region Enroll

        /// <summary>Enrolls (or replaces) the employee's face from one camera frame.</summary>
        /// <response code="201">Face embedding stored.</response>
        [HttpPost("enroll")]
        [ProducesResponseType(typeof(FaceEnrollmentResponse), StatusCodes.Status201Created)]
        public async Task<ActionResult<FaceEnrollmentResponse>> Enroll([FromBody] FaceEnrollmentRequest request, CancellationToken cancellationToken)
        {
            var response = await _faceBiometricService.EnrollFaceAsync(request, GetActorUserId(), cancellationToken);
            return StatusCode(StatusCodes.Status201Created, response);
        }

        #endregion

        #region Remove

        /// <summary>Removes the employee's stored face embedding.</summary>
        /// <response code="204">Face embedding removed.</response>
        [HttpDelete("{employeeReference}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> Remove(string employeeReference, CancellationToken cancellationToken)
        {
            await _faceBiometricService.RemoveEmployeeFaceAsync(employeeReference, GetActorUserId(), cancellationToken);
            return NoContent();
        }

        #endregion
    }
}
