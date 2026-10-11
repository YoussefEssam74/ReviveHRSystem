using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Self-service requests (mock §10). Creation reserves annual leave for Day Off
    /// requests (PendingDays) so a pending request blocks its days immediately;
    /// approval consumes them, rejection releases them (management side).
    /// </summary>
    public class EmployeeRequestService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IMapper mapper) : IEmployeeRequestService
    {
        private static readonly IReadOnlyList<RequestTypeDto> RequestTypes = new[]
        {
            new RequestTypeDto { Id = "day-off", Label = "Day Off", Fields = new[] { "date", "reason" } },
            new RequestTypeDto { Id = "leave-early", Label = "Leave Early", Fields = new[] { "date", "time", "reason" } },
            new RequestTypeDto { Id = "late-arrival", Label = "Late Arrival", Fields = new[] { "date", "time", "reason" } },
            new RequestTypeDto { Id = "shift-swap", Label = "Shift Swap", Fields = new[] { "date", "colleague", "reason" } },
            new RequestTypeDto { Id = "overtime", Label = "Overtime Request", Fields = new[] { "date", "time", "reason" } },
            new RequestTypeDto { Id = "document-request", Label = "Document Request", Fields = new[] { "document-type", "reason" } },
            new RequestTypeDto { Id = "correction", Label = "Attendance Correction", Fields = new[] { "date", "correction-type", "reason" } }
        };

        public async Task<IReadOnlyList<EmployeeRequestDto>> GetRequestsAsync(
            int actorUserId, int employeeId, string? status, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

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
                actorUserId, request.EmployeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            return mapper.Map<EmployeeRequestDto>(request);
        }

        public async Task<EmployeeRequestDto> CreateAsync(
            int actorUserId, int employeeId, CreateEmployeeRequestDto request, CancellationToken cancellationToken = default)
        {
            var employee = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
                ?? throw new UnAuthorizedException("This account has no employee profile.");

            if (employee.Id != employeeId)
            {
                throw new NotFoundException("Employee not found.");
            }

            if (string.IsNullOrWhiteSpace(request.Type))
            {
                throw new BadRequestException("A request type is required.");
            }

            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BadRequestException("A reason is required.");
            }

            var requestType = RequestTypes.FirstOrDefault(t =>
                t.Id.Equals(request.Type, StringComparison.OrdinalIgnoreCase)
                || t.Label.Equals(request.Type, StringComparison.OrdinalIgnoreCase));

            var entity = new EmployeeRequest
            {
                EmployeeId = employee.Id,
                Type = requestType?.Label ?? request.Type.Trim(),
                RequestDate = request.RequestDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.RequestDate,
                TargetStartDate = request.RequestDate == default ? null : request.RequestDate,
                TargetEndDate = request.EndDate,
                TargetTime = request.RequestTime,
                SwapWithEmployeeId = request.SwapWithEmployeeId,
                OvertimeHoursRequested = request.OvertimeHours,
                Details = request.Reason.Trim(),
                Status = RequestStatus.Pending
            };

            await unitOfWork.GetRepository<EmployeeRequest, int>().AddAsync(entity, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // Reserve leave days immediately (PendingDays) for annual leave requests.
            var leaveType = LeaveTypeFor(entity.Type);
            if (leaveType is not null)
            {
                await ReserveLeaveDaysAsync(employee.Id, leaveType.Value, DaysRequested(entity), cancellationToken);
            }

            return await GetRequestAsync(actorUserId, entity.Id, employee.GymId, cancellationToken);
        }

        public async Task CancelAsync(int actorUserId, int requestId, CancellationToken cancellationToken = default)
        {
            var request = await LoadAsync(requestId, cancellationToken)
                ?? throw new NotFoundException("Request not found.");

            var employee = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
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
            var leaveType = LeaveTypeFor(request.Type);
            if (leaveType is not null)
            {
                await ReserveLeaveDaysAsync(employee.Id, leaveType.Value, -DaysRequested(request), cancellationToken);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public Task<IReadOnlyList<RequestTypeDto>> GetRequestTypesAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(RequestTypes);

        private async Task<EmployeeRequest?> LoadAsync(int requestId, CancellationToken cancellationToken) =>
            await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetByIdAsync(new RequestByIdSpec(requestId), cancellationToken);

        private async Task ReserveLeaveDaysAsync(int employeeId, LeaveType leaveType, decimal days, CancellationToken cancellationToken)
        {
            var year = DateTime.UtcNow.Year;
            var balances = await unitOfWork.GetRepository<LeaveBalance, int>()
                .GetAllAsync(new LeaveBalancesByEmployeeSpec(employeeId, year), cancellationToken);

            var balance = balances.FirstOrDefault(b => b.LeaveType == leaveType);
            var isNew = balance is null;
            if (isNew)
            {
                balance = new LeaveBalance
                {
                    EmployeeId = employeeId,
                    LeaveType = leaveType,
                    Year = year,
                    TotalEntitlement = leaveType == LeaveType.Annual ? 21 : 0,
                    UsedDays = 0,
                    PendingDays = 0
                };
                await unitOfWork.GetRepository<LeaveBalance, int>().AddAsync(balance, cancellationToken);
            }

            balance!.PendingDays = Math.Max(0, balance.PendingDays + days);

            // Only existing rows need an explicit Update; new rows are already tracked as Added.
            if (!isNew)
            {
                unitOfWork.GetRepository<LeaveBalance, int>().Update(balance);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        private static LeaveType? LeaveTypeFor(string type) => type switch
        {
            "Day Off" => LeaveType.Annual,
            _ => null
        };

        private static decimal DaysRequested(EmployeeRequest request)
        {
            if (request.TargetStartDate is null)
            {
                return 1;
            }

            var end = request.TargetEndDate ?? request.TargetStartDate;
            return end.Value.DayNumber - request.TargetStartDate.Value.DayNumber + 1;
        }
    }
}
