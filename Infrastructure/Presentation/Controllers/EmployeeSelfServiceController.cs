using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule.Enums;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.Payroll;

namespace Presentation.Controllers
{
    /// <summary>
    /// Employee self-service surface (mock §§3, 6, 7, 10): documents, attendance,
    /// leave balance, published schedule and requests. Reads of another employee's
    /// data require the [employees] feature level in the active gym with matching
    /// scope; writes (documents, requests) are self-only and enforced in services.
    /// </summary>
    [Route("api/employees/{id}/documents")]
    public class EmployeeDocumentsController(
        IEmployeeDocumentService documentService) : ApiControllerBase
    {
        [HttpGet("~/api/employees/{id}/required-documents")]
        public async Task<ActionResult<IReadOnlyList<RequiredDocumentDto>>> GetRequiredDocuments(
            int id, CancellationToken cancellationToken)
        {
            var documents = await documentService.GetRequiredDocumentsAsync(GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(documents);
        }

        /// <summary>Official company documents published by HR for this employee (mock §3.3).</summary>
        [HttpGet("~/api/employees/{id}/hr-documents")]
        public async Task<ActionResult<IReadOnlyList<HrDocumentDto>>> GetHrDocuments(
            int id, CancellationToken cancellationToken)
        {
            var documents = await documentService.GetHrDocumentsAsync(GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(documents);
        }

        /// <summary>
        /// Streams a document the employee uploaded himself. Respects <c>canDownload</c>:
        /// a row with nothing stored answers 404 instead of an empty body.
        /// </summary>
        [HttpGet("{docId}/download")]
        public async Task<IActionResult> Download(int id, int docId, CancellationToken cancellationToken)
        {
            var file = await documentService.DownloadAsync(
                GetActorUserId(), id, docId, DocumentSource.Employee, GetGymIdFromToken(), cancellationToken);
            return File(file.Content, file.ContentType, file.FileName);
        }

        /// <summary>Streams a document HR published (mock §3.6).</summary>
        [HttpGet("~/api/employees/{id}/hr-documents/{docId}/download")]
        public async Task<IActionResult> DownloadHrDocument(int id, int docId, CancellationToken cancellationToken)
        {
            var file = await documentService.DownloadAsync(
                GetActorUserId(), id, docId, DocumentSource.Hr, GetGymIdFromToken(), cancellationToken);
            return File(file.Content, file.ContentType, file.FileName);
        }
    }

    /// <summary>Profile avatar (mock 2.4). Upload is self-only; read follows the
    /// employee's existing visibility, so a team screen can render the photo.</summary>
    [Route("api/employees/{id}/photo")]
    public class EmployeePhotoController(IEmployeeDocumentService documentService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> Get(int id, CancellationToken cancellationToken)
        {
            var file = await documentService.GetPhotoAsync(GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return File(file.Content, file.ContentType);
        }

        [HttpPut]
        [RequestSizeLimit(11 * 1024 * 1024)]
        public async Task<ActionResult<PhotoUploadResultDto>> Upload(
            int id, IFormFile file, CancellationToken cancellationToken)
        {
            if (file is null || file.Length == 0)
            {
                throw new BadRequestException("A photo file is required.");
            }

            await using var content = file.OpenReadStream();
            var result = await documentService.UploadPhotoAsync(GetActorUserId(), id, file.FileName, content, cancellationToken);
            return Ok(result);
        }
    }

    /// <summary>Published schedule for one employee (mock §7; published cycles only).</summary>
    [Route("api/employees/{id}/schedule")]
    public class EmployeeScheduleController(
        IScheduleSelfService scheduleService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<EmployeeScheduleDto>> GetSchedule(
            int id, [FromQuery] string? month, CancellationToken cancellationToken)
        {
            var schedule = await scheduleService.GetScheduleAsync(
                GetActorUserId(), id, month, GetGymIdFromToken(), cancellationToken);
            return Ok(schedule);
        }
    }

    /// <summary>
    /// Own evaluation details (mock §9): criteria, reviewer and the 5-point max.
    /// Mounted beside the thin profile tab so the portal can render the score card
    /// without a management permission; access is the usual employee scope.
    /// </summary>
    [Route("~/api/employees/{id}/evaluations/detail")]
    public class EmployeeEvaluationDetailController(
        IEvaluationSelfService evaluationService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EvaluationDto>>> GetDetails(
            int id, CancellationToken cancellationToken)
            => Ok(await evaluationService.GetEvaluationsAsync(
                GetActorUserId(), id, GetGymIdFromToken(), cancellationToken));
    }

    /// <summary>Self-service requests (mock §10) and the configurable request types.</summary>
    [Route("api/employees/{id}/requests")]
    public class EmployeeRequestsController(
        IEmployeeRequestService requestService) : ApiControllerBase
    {
        /// <summary>
        /// Submits a request. Multipart because a file can ride with it — the sick-leave
        /// medical certificate must be sent with the request, so it belongs to the same
        /// call that creates the row rather than to a follow-up upload.
        /// </summary>
        [HttpPost]
        [RequestSizeLimit(11 * 1024 * 1024)]
        public async Task<ActionResult<EmployeeRequestDto>> Create(
            int id,
            [FromForm] CreateEmployeeRequestDto request,
            IFormFile? attachment,
            CancellationToken cancellationToken)
        {
            AttachmentUpload? upload = null;
            if (attachment is { Length: > 0 })
            {
                upload = new AttachmentUpload(attachment.FileName, attachment.OpenReadStream());
            }

            var created = await requestService.CreateAsync(GetActorUserId(), id, request, upload, cancellationToken);
            return Created($"/api/requests/{created.Id}", created);
        }
    }

    /// <summary>Monthly excused-hours budget of one employee (late attendance / early leave).</summary>
    [Route("api/employees/{id}/excused-hours")]
    public class EmployeeExcusedHoursController(
        IEmployeeRequestService requestService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<ExcusedHoursBudgetDto>> GetExcusedHours(
            int id, CancellationToken cancellationToken)
        {
            var budget = await requestService.GetExcusedHoursBudgetAsync(
                GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(budget);
        }
    }

    /// <summary>
    /// Deductions hanging on one employee — absence follow-ups and payroll candidates —
    /// each joined with the Deduction Correction request filed against its date.
    /// </summary>
    [Route("api/employees/{id}/deductions")]
    public class EmployeeDeductionsController(
        IEmployeeRequestService requestService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EmployeeDeductionDto>>> GetDeductions(
            int id, CancellationToken cancellationToken)
        {
            var deductions = await requestService.GetDeductionsAsync(
                GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(deductions);
        }
    }

    /// <summary>Own payroll sheets (mock §8): visible period cards for the employee.</summary>
    [Route("~/api/employees/{id}/payroll-sheets")]
    public class EmployeePayrollSheetsController(IPayrollSelfService payroll) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<PayrollEntryDto>>> GetSheets(
            int id, CancellationToken cancellationToken)
            => Ok(await payroll.GetPayrollAsync(GetActorUserId(), id, GetGymIdFromToken(), cancellationToken));
    }

    /// <summary>One sheet's payslip card (mock §8 modal), addressed by the sheet's own id.</summary>
    [Route("~/api/employees/{id}/payroll/{entryId:int}/payslip")]
    public class EmployeePayrollSlipController(IPayrollSelfService payroll) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<PayslipResponse>> GetPayslip(
            int id, int entryId, CancellationToken cancellationToken)
            => Ok(await payroll.GetPayslipAsync(GetActorUserId(), id, entryId, cancellationToken));
    }

    /// <summary>
    /// Active colleagues of the caller's own gym — the shift-swap pickers' data
    /// source (id + name only). Plain-directory listing would need employees.view
    /// which the swap requester never holds; this surface is self-only.
    /// </summary>
    [Route("~/api/employees/{id}/colleagues")]
    public class EmployeeColleaguesController(
        IEmployeeRequestService requestService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EmployeeColleagueDto>>> GetColleagues(
            int id, CancellationToken cancellationToken)
        {
            var colleagues = await requestService.GetColleaguesAsync(GetActorUserId(), id, cancellationToken);
            return Ok(colleagues);
        }
    }

    /// <summary>Single request operations: detail, cancel; plus the request-type catalog.</summary>
    [Route("api/requests")]
    public class EmployeeRequestDetailController(
        IEmployeeRequestService requestService) : ApiControllerBase
    {
        /// <summary>
        /// Streams the file riding with a request (the sick-leave medical certificate).
        /// The requester gets his own file; anyone else needs employee-scoped access.
        /// </summary>
        [HttpGet("~/api/requests/{id}/attachment")]
        public async Task<IActionResult> DownloadAttachment(int id, CancellationToken cancellationToken)
        {
            var file = await requestService.DownloadAttachmentAsync(
                GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return File(file.Content, file.ContentType, file.FileName);
        }

        [HttpPost("~/api/requests/{id}/cancel")]
        public async Task<IActionResult> Cancel(int id, CancellationToken cancellationToken)
        {
            await requestService.CancelAsync(GetActorUserId(), id, cancellationToken);
            return NoContent();
        }

        [HttpGet("~/api/request-types")]
        public async Task<ActionResult<IReadOnlyList<RequestTypeDto>>> GetRequestTypes(CancellationToken cancellationToken)
        {
            var types = await requestService.GetRequestTypesAsync(cancellationToken);
            return Ok(types);
        }
    }
}
