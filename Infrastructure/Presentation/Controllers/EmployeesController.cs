using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Payroll;
using Shared.DataTransferObject.Request;
using Shared.DataTransferObject.Separation;

namespace Presentation.Controllers
{
    /// <summary>
    /// Employee directory and lifecycle endpoints (S1). Every route sits behind JWT
    /// auth plus the ADR-003 guard inside the service (permission key + gym scope).
    /// Response shapes follow the UI spec: the directory is a paged envelope,
    /// create/detail use the { data } envelope, other lists are plain arrays, and
    /// lifecycle actions return { message }.
    /// </summary>
    [Route("api/employees")]
    [Authorize]
    public class EmployeesController(
        IEmployeeService _service,
        IRequestService _requests,
        IAttendanceManagementService _attendance,
        IPayrollService _payroll,
        IEvaluationService _evaluations,
        ISeparationsService _separations,
        IWebHostEnvironment _environment) : ApiControllerBase
    {
        private static readonly string[] AllowedDocumentExtensions =
            [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"];

        /// <summary>GET /api/employees — directory with gym/search/status filters, sorting, paging.</summary>
        [HttpGet]
        public async Task<ActionResult<EmployeeListResponse>> GetEmployees([FromQuery] EmployeeListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetEmployeesAsync(GetActorUserId(), query, GetGymIdFromToken(), cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/employees — onboards a new employee (account + profile).</summary>
        [HttpPost]
        public async Task<ActionResult<EmployeeDataResponse>> CreateEmployee([FromBody] CreateEmployeeRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateEmployeeAsync(GetActorUserId(), request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/employees/bulk-import — CSV upload (name, email, position, level, gym, salary).</summary>
        [HttpPost("bulk-import")]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<ActionResult<BulkImportResultResponse>> BulkImport(IFormFile? file, CancellationToken cancellationToken)
        {
            if (file is null || file.Length == 0)
            {
                return BadRequest(new { statusCode = 400, errorMessage = "A non-empty CSV file is required." });
            }

            if (!string.Equals(Path.GetExtension(file.FileName), ".csv", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { statusCode = 400, errorMessage = "Only .csv files are accepted." });
            }

            string csvContent;
            using (var reader = new StreamReader(file.OpenReadStream()))
            {
                csvContent = await reader.ReadToEndAsync(cancellationToken);
            }

            var result = await _service.BulkImportAsync(GetActorUserId(), csvContent, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/employees/{id} — full profile detail.</summary>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<EmployeeDataResponse>> GetEmployee(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetEmployeeAsync(GetActorUserId(), id, GetGymIdFromToken(), cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/employees/{id} — edit modal (name, position, status).</summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<EmployeeDetailResponse>> UpdateEmployee(int id, [FromBody] UpdateEmployeeRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.UpdateEmployeeAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/employees/{id}/status-change — reactivates / leaves / suspends / terminates.</summary>
        [HttpPost("{id:int}/status-change")]
        public async Task<ActionResult<EmployeeDetailResponse>> ChangeStatus(int id, [FromBody] ChangeEmployeeStatusRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ChangeStatusAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/employees/{id}/history — career timeline.</summary>
        [HttpGet("{id:int}/history")]
        public async Task<ActionResult<IReadOnlyList<EmployeeHistoryItem>>> GetHistory(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetHistoryAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/employees/{id}/payroll — per-period payroll history (payroll.view).</summary>
        [HttpGet("{id:int}/payroll")]
        public async Task<ActionResult<EmployeePayrollResponse>> GetEmployeePayroll(int id, CancellationToken cancellationToken)
            => Ok(await _payroll.GetEmployeePayrollAsync(GetActorUserId(), id, cancellationToken));

        /// <summary>GET /api/employees/{id}/evaluations — profile evaluations history (evaluations.view).</summary>
        [HttpGet("{id:int}/evaluations")]
        public async Task<ActionResult<Shared.DataTransferObject.Evaluation.EmployeeEvaluationResponse>> GetEmployeeEvaluations(int id, CancellationToken cancellationToken)
            => Ok(await _evaluations.GetEmployeeEvaluationsAsync(GetActorUserId(), id, cancellationToken));

        /// <summary>GET /api/employees/{id}/documents — uploaded documents.</summary>
        [HttpGet("{id:int}/documents")]
        public async Task<ActionResult<IReadOnlyList<EmployeeDocumentItem>>> GetDocuments(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetDocumentsAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/employees/{id}/documents — multipart upload (file + category + optional expiryDate).</summary>
        [HttpPost("{id:int}/documents")]
        [RequestSizeLimit(10 * 1024 * 1024)]
        public async Task<ActionResult<EmployeeDocumentItem>> UploadDocument(
            int id,
            IFormFile? file,
            [FromForm] string? category,
            [FromForm] string? expiryDate,
            CancellationToken cancellationToken)
        {
            if (file is null || file.Length == 0)
            {
                return BadRequest(new { statusCode = 400, errorMessage = "A non-empty file is required." });
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedDocumentExtensions.Contains(extension))
            {
                return BadRequest(new
                {
                    statusCode = 400,
                    errorMessage = "Only PDF or image files are accepted.",
                });
            }

            DateOnly? parsedExpiry = null;
            if (!string.IsNullOrWhiteSpace(expiryDate))
            {
                if (!DateOnly.TryParse(expiryDate, out var parsed))
                {
                    return BadRequest(new { statusCode = 400, errorMessage = "expiryDate must be a date like 2026-12-31." });
                }

                parsedExpiry = parsed;
            }

            // The presentation layer owns the file bytes (IFormFile is host-only);
            // the service receives a validated, already-stored upload descriptor.
            var storedName = $"{Guid.NewGuid():N}{extension}";
            var directory = Path.Combine(
                _environment.ContentRootPath, "App_Data", "EmployeeDocuments", id.ToString());
            Directory.CreateDirectory(directory);
            var absolutePath = Path.Combine(directory, storedName);
            var relativePath = Path.Combine("App_Data", "EmployeeDocuments", id.ToString(), storedName);

            await using (var stream = System.IO.File.Create(absolutePath))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            try
            {
                var result = await _service.AddDocumentAsync(GetActorUserId(), id, new EmployeeDocumentUpload
                {
                    FileName = Path.GetFileName(file.FileName),
                    RelativeFilePath = relativePath,
                    SizeBytes = file.Length,
                    Category = category ?? string.Empty,
                    ExpiryDate = parsedExpiry,
                }, cancellationToken);
                return Ok(result);
            }
            catch
            {
                // No database row was created, so remove the orphaned file.
                if (System.IO.File.Exists(absolutePath))
                {
                    System.IO.File.Delete(absolutePath);
                }

                throw;
            }
        }

        /// <summary>GET /api/employees/{id}/leave-balance — current-year balances.</summary>
        [HttpGet("{id:int}/leave-balance")]
        public async Task<ActionResult<LeaveBalanceResponse>> GetLeaveBalance(int id, CancellationToken cancellationToken)
        {
            var result = await _service.GetLeaveBalanceAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/employees/{id}/leave-balance — updates granted totals.</summary>
        [HttpPut("{id:int}/leave-balance")]
        public async Task<ActionResult<MessageResponse>> UpdateLeaveBalance(int id, [FromBody] UpdateLeaveBalanceRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.UpdateLeaveBalanceAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/employees/{id}/requests — the employee's own requests tab (A8, requests.view).</summary>
        [HttpGet("{id:int}/requests")]
        public async Task<ActionResult<IReadOnlyList<EmployeeRequestItem>>> GetEmployeeRequests(int id, CancellationToken cancellationToken)
        {
            var result = await _requests.GetEmployeeRequestsAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// GET /api/employees/{id}/attendance — the employee file's Attendance tab (A7):
        /// elapsed days of the requested month with month totals; requires attendance.view.
        /// </summary>
        [HttpGet("{id:int}/attendance")]
        public async Task<ActionResult<Shared.DataTransferObject.Attendance.EmployeeAttendanceResponse>> GetEmployeeAttendance(int id, [FromQuery] Shared.DataTransferObject.Attendance.EmployeeAttendanceQuery query, CancellationToken cancellationToken)
        {
            var result = await _attendance.GetEmployeeAttendanceAsync(GetActorUserId(), id, query, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/employees/{id}/transfer — moves the employee to another gym.</summary>
        [HttpPost("{id:int}/transfer")]
        public async Task<ActionResult<MessageResponse>> Transfer(int id, [FromBody] TransferEmployeeRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.TransferAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/employees/{id}/position-change — new position/level in the same gym.</summary>
        [HttpPost("{id:int}/position-change")]
        public async Task<ActionResult<MessageResponse>> ChangePosition(int id, [FromBody] PositionChangeRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ChangePositionAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/employees/{id}/compensation — records a salary change.</summary>
        [HttpPost("{id:int}/compensation")]
        public async Task<ActionResult<MessageResponse>> AddCompensation(int id, [FromBody] CompensationRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.AddCompensationAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/employees/{id}/contract — level, salary, and/or start date changes.</summary>
        [HttpPost("{id:int}/contract")]
        public async Task<ActionResult<MessageResponse>> ChangeContract(int id, [FromBody] ContractChangeRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ChangeContractAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/employees/{id}/role-change — sets/clears system role + team permissions (E16).</summary>
        [HttpPost("{id:int}/role-change")]
        public async Task<ActionResult<MessageResponse>> ChangeRole(int id, [FromBody] RoleChangeRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.ChangeEmployeeRoleAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>E19 — POST /api/employees/{id}/offboard: HR-initiated offboarding (creates the exit case, parks the employee in Notice Period).</summary>
        [HttpPost("{id:int}/offboard")]
        public async Task<ActionResult<Shared.DataTransferObject.Separation.OffboardResponse>> Offboard(int id, [FromBody] OffboardEmployeeRequest request, CancellationToken cancellationToken)
        {
            var result = await _separations.OffboardEmployeeAsync(GetActorUserId(), id, request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }
    }
}
