using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared;
using Shared.Authorization;
using Shared.DataTransferObject;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Self-service requests (mock §10). The catalog is the final 9-type list agreed with
    /// the product owner:
    ///
    /// - **Annual Leave / Sick Leave** draw from the leave balance (21 / 10 default days):
    ///   submitting reserves pending days and refuses to exceed what remains; the sick-leave
    ///   medical certificate must ride with the request.
    /// - **Late Attendance / Early Leave** share one monthly excused-hours budget per gym
    ///   (HR-set, default 4h); hours are derived from the employee's published schedule.
    /// - **Shift Swap / Weekly Off Swap** name a colleague of the same gym.
    /// - **Check-in Correction**, **Salary Advance** (amount) and **Paid Holiday** (working
    ///   a paid holiday for double day pay) carry no automatic limit — approval is the gate.
    ///
    /// Every type then follows the two-stage workflow: TL/BM stage 1 → HR final
    /// (management side). Approval consumes reserved leave days, rejection releases them.
    /// </summary>
    public class EmployeeRequestService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IUserAccessRepository userAccess,
        ITeamScopeService teamScope,
        IMapper mapper,
        IFileStorage fileStorage) : IEmployeeRequestService
    {
        /// <summary>Storage category of request attachments (e.g. the medical certificate).</summary>
        internal const string AttachmentCategory = "request-attachments";

        /// <summary>
        /// Loads an on-behalf target and enforces the row-32 manager gates:
        /// Branch Manager = gym scope, Team Leader = the team he leads; anyone
        /// else (or an out-of-scope target) silently learns the target is not there.
        /// </summary>
        private async Task<Employee> ResolveOnBehalfTargetAsync(int actorUserId, int employeeId, CancellationToken cancellationToken)
        {
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, employee.GymId, cancellationToken);
            if (roleNames.Contains(Shared.Authorization.RoleNames.BranchManager, StringComparer.Ordinal))
            {
                return employee;
            }

            if (roleNames.Contains(Shared.Authorization.RoleNames.TeamLeader, StringComparer.Ordinal))
            {
                var ledTeamId = await teamScope.GetLedTeamIdAsync(actorUserId, employee.GymId, cancellationToken);
                if (ledTeamId is not null && employee.TeamId == ledTeamId.Value)
                {
                    return employee;
                }
            }

            throw new NotFoundException("Employee not found.");
        }

        public async Task<IReadOnlyList<EmployeeRequestDto>> GetRequestsAsync(
            int actorUserId, int employeeId, string? status, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, activeGymId, cancellationToken);

            var requests = await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new RequestsByEmployeeSpec(employeeId), cancellationToken);

            return requests
                .Where(r => status is null || r.Status.ToString().Equals(status, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(r => r.SubmittedAt)
                .Select(r => mapper.Map<EmployeeRequestDto>(r))
                .ToList();
        }

        public async Task<EmployeeRequestDto> GetRequestAsync(
            int actorUserId, int requestId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var request = await LoadAsync(requestId, cancellationToken)
                ?? throw new NotFoundException("Request not found.");

            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, request.EmployeeId, activeGymId, cancellationToken);

            return mapper.Map<EmployeeRequestDto>(request);
        }

        public async Task<EmployeeRequestDto> CreateAsync(
            int actorUserId, int employeeId, CreateEmployeeRequestDto request,
            AttachmentUpload? attachment = default, CancellationToken cancellationToken = default)
        {
            // Self submissions always work; a route id pointing at another employee
            // is the Branch Manager / Team Leader on-behalf flow (matrix row 32):
            // TL(task) submits for a team member, BM for anyone in his gym, while
            // employees cannot vouch for each other and cross-tenant targets
            // stay invisible (404). The request is then created FOR the target.
            var ownEmployee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
                ?? throw new UnAuthorizedException("This account has no employee profile.");

            var employee = employeeId == ownEmployee.Id
                ? ownEmployee
                : await ResolveOnBehalfTargetAsync(actorUserId, employeeId, cancellationToken);

            var type = RequestTypeCatalog.Find(request.Type)
                ?? throw new BadRequestException($"Unknown request type '{request.Type}'.");

            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BadRequestException("A reason is required.");
            }

            var reason = request.Reason.Trim();
            if (reason.Length > 1000)
            {
                throw new BadRequestException("The reason may not exceed 1000 characters.");
            }

            if (type.RequiresAttachment && attachment is null)
            {
                throw new BadRequestException(
                    "Sick Leave requires a medical certificate to be sent with the request.");
            }

            var gym = await unitOfWork.GetRepository<Gym, int>()
                .GetByIdAsync(employee.GymId, cancellationToken)
                ?? throw new NotFoundException("Your gym was not found.");

            var needsDate = type.Id != RequestTypeCatalog.SalaryAdvanceId;
            var requestDate = request.RequestDate == default
                ? needsDate
                    ? throw new BadRequestException("A date is required.")
                    : DateOnly.FromDateTime(DateTime.UtcNow)   // an advance is submitted "now"; its form carries no date
                : request.RequestDate;

            var entity = new EmployeeRequest
            {
                EmployeeId = employee.Id,
                Type = type.Label,
                RequestDate = requestDate,
                Details = reason,
                Status = RequestStatus.Pending
            };

            // Single-day types carry the same date in both slots; weekly off swap
            // overrides the target with the off day it takes in exchange.
            entity.TargetStartDate = entity.RequestDate;

            switch (type.Id)
            {
                case RequestTypeCatalog.AnnualLeaveId:
                case RequestTypeCatalog.SickLeaveId:
                    entity.TargetEndDate = NormalizeEndDate(entity, request.EndDate);

                    // No submission may lock more days than the balance still has.
                    await LeaveBalanceReservation.EnsureDaysAvailableAsync(
                        unitOfWork, employee.Id, type.ConsumesLeave!.Value,
                        LeaveBalanceReservation.DaysRequested(entity), cancellationToken);
                    break;

                case RequestTypeCatalog.LateAttendanceId:
                case RequestTypeCatalog.EarlyLeaveId:
                    await ApplyExcusedHoursRequestAsync(entity, type, request, employee, gym, cancellationToken);
                    break;

                case RequestTypeCatalog.ShiftSwapId:
                    entity.TargetEndDate = NormalizeEndDate(entity, request.EndDate);
                    entity.SwapWithEmployeeId = await ResolveColleagueIdAsync(employee, request.SwapWithEmployeeId, cancellationToken);
                    break;

                case RequestTypeCatalog.WeeklyOffSwapId:
                    entity.TargetStartDate = request.TargetDate
                        ?? throw new BadRequestException("The weekly off day you want in exchange is required.");
                    if (entity.TargetStartDate.Value == entity.RequestDate)
                    {
                        throw new BadRequestException("The off day taken must differ from the off day given up.");
                    }
                    entity.SwapWithEmployeeId = await ResolveColleagueIdAsync(employee, request.SwapWithEmployeeId, cancellationToken);
                    break;

                case RequestTypeCatalog.CheckInCorrectionId:
                    entity.TargetTime = request.RequestTime
                        ?? throw new BadRequestException("The corrected check-in time is required.");
                    break;

                case RequestTypeCatalog.SalaryAdvanceId:
                    if (request.Amount is null || request.Amount.Value <= 0)
                    {
                        throw new BadRequestException("A positive amount is required.");
                    }

                    entity.RequestedAmount = Math.Round(request.Amount.Value, 2);
                    break;
                case RequestTypeCatalog.PaidHolidayId:
                    // Working a paid holiday is approved by HR; nothing else to validate.
                    break;

                default:
                    throw new BadRequestException($"Unknown request type '{request.Type}'.");
            }

            // The file rides with the request (sick leave's medical certificate), stored
            // through the same boundary as avatars and documents; storage refusing the
            // upload (unsupported type, over the cap) is a problem with the request.
            if (attachment is not null)
            {
                entity.AttachmentPath = await SaveOrRefuseAsync(attachment, cancellationToken);
            }

            await unitOfWork.GetRepository<EmployeeRequest, int>().AddAsync(entity, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            var leaveType = LeaveBalanceReservation.LeaveTypeFor(entity);
            if (leaveType is not null)
            {
                await LeaveBalanceReservation.AdjustPendingDaysAsync(
                    unitOfWork, employee.Id, leaveType.Value, LeaveBalanceReservation.DaysRequested(entity), cancellationToken);
            }

            return await GetRequestAsync(actorUserId, entity.Id, employee.GymId, cancellationToken);
        }

        public async Task CancelAsync(int actorUserId, int requestId, CancellationToken cancellationToken = default)
        {
            var request = await LoadAsync(requestId, cancellationToken)
                ?? throw new NotFoundException("Request not found.");

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
                ?? throw new UnAuthorizedException("This account has no employee profile.");

            if (request.EmployeeId != employee.Id)
            {
                throw new NotFoundException("Request not found.");
            }

            if (request.Status != RequestStatus.Pending)
            {
                throw new BadRequestException("Only pending requests can be cancelled.");
            }

            request.Status = RequestStatus.Cancelled;
            unitOfWork.GetRepository<EmployeeRequest, int>().Update(request);

            // Release any days the pending request had reserved.
            var leaveType = LeaveBalanceReservation.LeaveTypeFor(request);
            if (leaveType is not null)
            {
                await LeaveBalanceReservation.AdjustPendingDaysAsync(
                    unitOfWork, employee.Id, leaveType.Value, -LeaveBalanceReservation.DaysRequested(request), cancellationToken);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public async Task<FileDownload> DownloadAttachmentAsync(
            int actorUserId, int requestId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var request = await LoadAsync(requestId, cancellationToken)
                ?? throw new NotFoundException("Request not found.");

            // The requester always gets his own file; anyone else needs employee-scoped
            // access in the request's gym, so a cross-scope caller learns nothing.
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, request.EmployeeId, activeGymId, cancellationToken);

            var content = string.IsNullOrWhiteSpace(request.AttachmentPath)
                ? null
                : fileStorage.TryOpenRead(request.AttachmentPath);

            return content is null
                ? throw new NotFoundException("No file is stored for this request.")
                : new FileDownload(
                    content,
                    "medical-certificate" + Path.GetExtension(request.AttachmentPath!),
                    FileContentTypes.FromFileName(request.AttachmentPath!));
        }

        public async Task<ExcusedHoursBudgetDto> GetExcusedHoursBudgetAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, activeGymId, cancellationToken);

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            var gym = await unitOfWork.GetRepository<Gym, int>()
                .GetByIdAsync(employee.GymId, cancellationToken);

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var used = await ExcusedHoursUsedInMonthAsync(employee.Id, today, cancellationToken);
            var cap = gym?.ExcusedLateHoursCapPerMonth ?? 0;

            return new ExcusedHoursBudgetDto
            {
                CapHours = cap,
                UsedHours = used,
                RemainingHours = Math.Max(0, cap - used),
                Month = $"{today.Year:D4}-{today.Month:D2}"
            };
        }

        public async Task<IReadOnlyList<EmployeeColleagueDto>> GetColleaguesAsync(
            int actorUserId, int employeeId, CancellationToken cancellationToken = default)
        {
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            // Matrix row 36: the swap-picker belongs to the negotiators —
            // Branch Manager (gym scope) and Team Leader (own team, F6's note
            // says the leaderboard picks the swap partner), plus Top Management
            // (unscoped). Employees do not list a colleague roster, and
            // out-of-gym callers learn nothing.
            var actor = await unitOfWork.GetRepository<DomainLayer.Models.UserModule.User, int>()
                .GetByIdAsync(actorUserId, cancellationToken);
            if (actor is not null && actor.UserType == DomainLayer.Models.UserModule.Enums.UserType.TopManagement)
            {
                return await ListColleaguesAsync(employee, cancellationToken);
            }

            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, employee.GymId, cancellationToken);
            if (!roleNames.Contains(Shared.Authorization.RoleNames.BranchManager, StringComparer.Ordinal))
            {
                if (roleNames.Contains(Shared.Authorization.RoleNames.TeamLeader, StringComparer.Ordinal))
                {
                    var ledTeamId = await teamScope.GetLedTeamIdAsync(actorUserId, employee.GymId, cancellationToken);
                    if (ledTeamId is null || employee.TeamId != ledTeamId.Value)
                    {
                        throw new NotFoundException("Employee not found.");
                    }
                }
                else
                {
                    throw new NotFoundException("Employee not found.");
                }
            }

            return await ListColleaguesAsync(employee, cancellationToken);
        }

        private async Task<IReadOnlyList<EmployeeColleagueDto>> ListColleaguesAsync(Employee employee, CancellationToken cancellationToken)
        {
            var colleagues = await unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(new EmployeesByGymSpec(employee.GymId), cancellationToken);

            return colleagues
                .Where(e => e.Id != employee.Id && e.Status == EmployeeStatus.Active)
                .Select(e => new EmployeeColleagueDto { Id = e.Id, FullName = e.FullName })
                .ToList();
        }

        public Task<IReadOnlyList<RequestTypeDto>> GetRequestTypesAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<RequestTypeDto>>(RequestTypeCatalog.All
                .Select(t => new RequestTypeDto
                {
                    Id = t.Id,
                    Label = t.Label,
                    Fields = t.Fields,
                    ConsumesLeave = t.ConsumesLeave?.ToString(),
                    RequiresAttachment = t.RequiresAttachment,
                    RequiresColleague = t.RequiresColleague,
                    RequiresAmount = t.RequiresAmount,
                    LimitedByMonthlyExcusedHours = t.LimitedByMonthlyExcusedHours,
                    RequiresTargetDate = t.RequiresTargetDate
                })
                .ToList());

        // ---------- per-type rules ----------

        /// <summary>
        /// Late attendance / early leave: the excused hours are derived from the
        /// employee's published schedule for the incident date (late = arrival after the
        /// shift start; early = departure before the shift end), then counted against the
        /// gym's monthly budget. Pending requests hold their hours, so several small
        /// requests cannot together outrun the cap.
        /// </summary>
        private async Task ApplyExcusedHoursRequestAsync(
            EmployeeRequest entity,
            RequestTypeDefinition type,
            CreateEmployeeRequestDto request,
            Employee employee,
            Gym gym,
            CancellationToken cancellationToken)
        {
            if (request.RequestTime is null)
            {
                throw new BadRequestException(
                    type.Id == RequestTypeCatalog.LateAttendanceId
                        ? "The actual arrival time is required."
                        : "The departure time is required.");
            }

            var template = await ScheduledShiftAsync(employee.GymId, employee.Id, entity.RequestDate, cancellationToken)
                ?? throw new BadRequestException(
                    "No published shift is scheduled for this date — late attendance and early leave require a scheduled shift.");

            var hours = type.Id == RequestTypeCatalog.LateAttendanceId
                ? LateHours(template, request.RequestTime.Value)
                : EarlyHours(template, request.RequestTime.Value);

            var used = await ExcusedHoursUsedInMonthAsync(employee.Id, entity.RequestDate, cancellationToken);
            var cap = gym.ExcusedLateHoursCapPerMonth;
            if (used + hours > cap)
            {
                throw new BadRequestException(
                    $"This request needs {hours:0.##} excused hour(s) but only {Math.Max(0, cap - used):0.##} of the {cap:0.##} monthly hours remain.");
            }

            entity.RequestedHours = hours;
        }

        private static decimal LateHours(ShiftTemplate template, TimeOnly arrival)
        {
            if (arrival <= template.StartTime)
            {
                throw new BadRequestException(
                    $"The submitted time is not later than the scheduled shift start ({template.StartTime:HH:mm}).");
            }

            return Math.Round((decimal)(arrival - template.StartTime).TotalMinutes / 60m, 2);
        }

        private static decimal EarlyHours(ShiftTemplate template, TimeOnly departure)
        {
            // A shift that crosses midnight ends "earlier" the next day, so its end time
            // is lifted past midnight before the comparison.
            var shiftEnd = template.EndTime <= template.StartTime
                ? template.EndTime.AddHours(24)
                : template.EndTime;
            var left = departure < template.StartTime
                ? departure.AddHours(24)
                : departure;

            if (left >= shiftEnd)
            {
                throw new BadRequestException(
                    $"The submitted time is not earlier than the scheduled shift end ({template.EndTime:HH:mm}).");
            }

            return Math.Round((decimal)(shiftEnd - left).TotalMinutes / 60m, 2);
        }

        /// <summary>Published shift template of an employee on a date, or null when none is published.</summary>
        private async Task<ShiftTemplate?> ScheduledShiftAsync(
            int gymId, int employeeId, DateOnly date, CancellationToken cancellationToken)
        {
            var monthStart = new DateOnly(date.Year, date.Month, 1);
            var cycles = await unitOfWork.GetRepository<ShiftCycle, int>()
                .GetAllAsync(new PublishedCyclesByGymSpec(gymId, monthStart, monthStart.AddMonths(1)), cancellationToken);

            if (!cycles.Any())
            {
                return null;
            }

            var assignments = await unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(
                    new ScheduleAssignmentsByEmployeeSpec(employeeId, cycles.Select(c => c.Id).ToList()),
                    cancellationToken);

            return assignments.FirstOrDefault(a => a.Date == date)?.ShiftTemplate;
        }

        /// <summary>Hours already held this calendar month by pending and approved capped requests.</summary>
        private async Task<decimal> ExcusedHoursUsedInMonthAsync(
            int employeeId, DateOnly anyDateInMonth, CancellationToken cancellationToken)
        {
            var requests = await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new RequestsByEmployeeSpec(employeeId), cancellationToken);

            return requests
                .Where(r => RequestTypeCatalog.CountsAgainstExcusedHoursCap(r.Type)
                    && r.RequestDate.Year == anyDateInMonth.Year
                    && r.RequestDate.Month == anyDateInMonth.Month
                    && r.Status is RequestStatus.Pending or RequestStatus.PendingHRReview or RequestStatus.Approved)
                .Sum(r => r.RequestedHours ?? 0m);
        }

        private async Task<int> ResolveColleagueIdAsync(
            Employee self, int? swapWithEmployeeId, CancellationToken cancellationToken)
        {
            if (swapWithEmployeeId is null)
            {
                throw new BadRequestException("A colleague to swap with is required.");
            }

            if (swapWithEmployeeId.Value == self.Id)
            {
                throw new BadRequestException("You cannot swap with yourself.");
            }

            var colleague = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(swapWithEmployeeId.Value, cancellationToken);

            if (colleague is null || colleague.GymId != self.GymId || colleague.Status != EmployeeStatus.Active)
            {
                throw new BadRequestException("The selected colleague is not an active employee of your gym.");
            }

            return colleague.Id;
        }

        /// <summary>A range without an end is a single day, and the end may not precede the start.</summary>
        private static DateOnly? NormalizeEndDate(EmployeeRequest entity, DateOnly? endDate)
        {
            if (endDate is null)
            {
                return null;
            }

            if (endDate.Value < entity.RequestDate)
            {
                throw new BadRequestException("The end date may not be before the start date.");
            }

            return endDate;
        }

        private async Task<EmployeeRequest?> LoadAsync(int requestId, CancellationToken cancellationToken) =>
            await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetByIdAsync(new RequestByIdSpec(requestId), cancellationToken);

        /// <summary>
        /// Storage refuses what it will not write (unsupported extension, over the size
        /// cap); that is a problem with the request, so it surfaces as a 400 rather than
        /// falling through as a 500.
        /// </summary>
        private async Task<string> SaveOrRefuseAsync(AttachmentUpload attachment, CancellationToken cancellationToken)
        {
            try
            {
                var stored = await fileStorage.SaveAsync(
                    AttachmentCategory, attachment.FileName, attachment.Content, cancellationToken);
                return stored.RelativePath;
            }
            catch (InvalidOperationException e)
            {
                throw new BadRequestException(e.Message);
            }
        }
    }
}
