using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.UserModule;
using Service.Specifications;using ServiceAbstraction.Services;
using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;

namespace Service.Services
{
    /// <summary>
    /// Management-side request workflow (mock §17 Team/Requests Management): the
    /// scoped inbox and the two-stage approval. Stage 1 (BranchManager) is the
    /// TL/BM decision that moves a request to HR review; HR's final decision lives
    /// in the HR portal. The desk belongs to the manager roles of the active gym
    /// (Team Leader / Branch Manager / Super Admin): data scope comes from the
    /// per-gym role — team for Team Leaders, the whole gym for Branch Managers —
    /// and plain employees hold no desk at all (ADR-003 Amendment 1).
    /// </summary>
    public class RequestManagementService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService,
        IUserAccessRepository userAccess,
        IMapper mapper,
        TimeZoneInfo attendanceTimeZone) : IRequestManagementService
    {
        public async Task<PaginationResult<EmployeeRequestDto>> GetInboxAsync(
            int actorUserId, int? activeGymId, RequestQueryParams query, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureDeskRoleAsync(actorUserId, gymId, cancellationToken);
            var employeeIds = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);

            // The status arrives as a free-form label: an unknown label matched no row
            // under the old in-memory compare, so it yields an empty page, not an error.
            RequestStatus? status = null;
            if (!string.IsNullOrWhiteSpace(query.Status))
            {
                if (!Enum.TryParse<RequestStatus>(query.Status.Trim(), ignoreCase: true, out var parsedStatus))
                {
                    return new PaginationResult<EmployeeRequestDto>(query.PageNumber, query.PageSize, 0, []);
                }

                status = parsedStatus;
            }

            // The desk list can cover a team's or a gym's whole history — filter, sort
            // (spec keeps SubmittedAt desc) and page execute in SQL; the count repeats
            // the filters without paging for the envelope total.
            var repository = unitOfWork.GetRepository<EmployeeRequest, int>();
            var total = await repository.CountAsync(
                new RequestsByEmployeesSpec(employeeIds, status, query.Type, query.DateFrom, query.DateTo),
                cancellationToken);
            var rows = await repository.GetAllAsync(
                new RequestsByEmployeesSpec(employeeIds, status, query.Type, query.DateFrom, query.DateTo, query.SkipCount, query.PageSize),
                cancellationToken);

            // Unscheduled Attendance rows from before the request carried its own
            // check-in time have no TargetTime: the linked attendance record is the
            // source of truth for the check-in shown on the desk.
            var checkInFallbacks = await ResolveCheckInTimeFallbacksAsync(rows, cancellationToken);

            var page = rows.Select(r =>
            {
                var dto = mapper.Map<EmployeeRequestDto>(r);
                return dto.RequestTime is null && checkInFallbacks.TryGetValue((r.EmployeeId, r.RequestDate), out var checkIn)
                    ? WithRequestTime(dto, checkIn)
                    : dto;
            }).ToList();
            return new PaginationResult<EmployeeRequestDto>(query.PageNumber, query.PageSize, total, page);
        }

        public async Task DecideAsync(
            int actorUserId, int requestId, int? activeGymId, RequestDecisionDto decision, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureDeskRoleAsync(actorUserId, gymId, cancellationToken);
            var request = await LoadInScopeAsync(actorUserId, requestId, gymId, cancellationToken);

            if (request.Status is not (RequestStatus.Pending or RequestStatus.PendingHRReview))
            {
                throw new BadRequestException("Only pending requests can be decided at this stage.");
            }

            var outcome = ParseDecision(decision.Decision);
            var stage = ParseStage(decision.Stage);

            // A request already forwarded to HR can no longer be approved again at
            // the desk — but the desk can still pull it back with a rejection.
            if (request.Status == RequestStatus.PendingHRReview && outcome != DecisionOutcome.Rejected)
            {
                throw new BadRequestException("This request is already approved to HR — you can only reject it from here.");
            }

            request.Status = outcome == DecisionOutcome.Approved
                ? RequestStatus.PendingHRReview
                : RequestStatus.Rejected;

            // The desk may re-decide his own stage — most commonly reject after an
            // earlier acceptance. (RequestId, Stage) is unique, so a second insert
            // used to blow up as the misleading "concurrent update" error: rewrite
            // the existing stage row in place instead.
            var stageDecision = request.Decisions.FirstOrDefault(d => d.Stage == stage);
            if (stageDecision is null)
            {
                request.Decisions.Add(new RequestDecision
                {
                    RequestId = request.Id,
                    Stage = stage,
                    Decision = outcome,
                    Comment = string.IsNullOrWhiteSpace(decision.Comment) ? null : decision.Comment.Trim(),
                    DecidedBy = actorUserId,
                    DecidedAt = DateTime.UtcNow
                });
            }
            else
            {
                stageDecision.Decision = outcome;
                stageDecision.Comment = string.IsNullOrWhiteSpace(decision.Comment) ? null : decision.Comment.Trim();
                stageDecision.DecidedBy = actorUserId;
                stageDecision.DecidedAt = DateTime.UtcNow;
            }

            unitOfWork.GetRepository<EmployeeRequest, int>().Update(request);

            if (request.Type == RequestTypeCatalog.UnscheduledAttendanceLabel)
            {
                var attendanceRepo = unitOfWork.GetRepository<AttendanceRecord, int>();
                var records = await attendanceRepo.GetAllAsync(
                    new AttendanceRecordByEmployeeDatesSpec(request.EmployeeId, request.RequestDate), cancellationToken);
                var record = records.FirstOrDefault(r => r.Date == request.RequestDate);
                if (record is not null)
                {
                    if (outcome == DecisionOutcome.Approved)
                    {
                        var days = ValidateUnscheduledAttendanceDays(decision.CalculatedDays);
                        request.Payment = $"{days} day{(days > 1 ? "s" : "")}";
                        request.OvertimeHoursRequested = days;
                        record.Notes = $"Approved by BM as {days} day(s) (Pending HR review)";
                    }
                    else
                    {
                        record.Notes = "Unscheduled attendance rejected by Branch Manager";
                    }
                    attendanceRepo.Update(record);
                }
            }

            // A rejected stage-1 decision releases any reserved leave days immediately;
            // approval consumes them at the HR stage.
            var leaveType = LeaveBalanceReservation.LeaveTypeFor(request);
            if (outcome == DecisionOutcome.Rejected && leaveType is not null)
            {
                await LeaveBalanceReservation.AdjustPendingDaysAsync(
                    unitOfWork, request.EmployeeId, leaveType.Value, -LeaveBalanceReservation.DaysRequested(request), cancellationToken);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        private static int ValidateUnscheduledAttendanceDays(int? calculatedDays)
        {
            var days = calculatedDays ?? 1;
            if (days is not (1 or 2))
            {
                throw new BadRequestException("Unscheduled attendance can be counted as 1 or 2 days.");
            }

            return days;
        }

        public async Task UndoAsync(
            int actorUserId, int requestId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureDeskRoleAsync(actorUserId, gymId, cancellationToken);
            var request = await LoadInScopeAsync(actorUserId, requestId, gymId, cancellationToken);

            if (request.Status is not (RequestStatus.PendingHRReview or RequestStatus.Rejected))
            {
                throw new BadRequestException("Only decided requests can be undone at this stage.");
            }

            // An HR decision on record is final here: HR-managed requests go through the
            // HR undo-decision route. Status "Rejected" alone does not prove a stage-1
            // rejection — HR's final rejection also lands in that status, so the decision
            // record (not the status) is what separates the two.
            if (request.Decisions.Any(d => d.Stage == ApprovalStage.HR))
            {
                throw new BadRequestException("An HR decision is recorded for this request — only unfinalized branch-stage decisions can be undone.");
            }

            var lastDate = request.TargetEndDate ?? request.RequestDate;
            if (lastDate < DateOnly.FromDateTime(DateTime.UtcNow.Date))
            {
                throw new BadRequestException("The requested date has passed — the decision can no longer be changed.");
            }

            var leaveType = LeaveBalanceReservation.LeaveTypeFor(request);
            if (request.Status == RequestStatus.Rejected && leaveType is not null)
            {
                await LeaveBalanceReservation.AdjustPendingDaysAsync(
                    unitOfWork, request.EmployeeId, leaveType.Value, +LeaveBalanceReservation.DaysRequested(request), cancellationToken);
            }

            foreach (var stageDecision in request.Decisions.Where(d => d.Stage == ApprovalStage.BranchManager).ToList())
            {
                request.Decisions.Remove(stageDecision);
                unitOfWork.GetRepository<RequestDecision, int>().Remove(stageDecision);
            }

            request.Status = RequestStatus.Pending;
            unitOfWork.GetRepository<EmployeeRequest, int>().Update(request);

            if (request.Type == RequestTypeCatalog.UnscheduledAttendanceLabel)
            {
                var attendanceRepo = unitOfWork.GetRepository<AttendanceRecord, int>();
                var records = await attendanceRepo.GetAllAsync(
                    new AttendanceRecordByEmployeeDatesSpec(request.EmployeeId, request.RequestDate), cancellationToken);
                var record = records.FirstOrDefault(r => r.Date == request.RequestDate);
                if (record is not null)
                {
                    record.Notes = "Unscheduled / Off-day check-in (pending approval)";
                    attendanceRepo.Update(record);
                }
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public async Task EditAsync(
            int actorUserId, int requestId, int? activeGymId, UpdateRequestDto update, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureDeskRoleAsync(actorUserId, gymId, cancellationToken);
            var request = await LoadInScopeAsync(actorUserId, requestId, gymId, cancellationToken);

            if (request.Status is not (RequestStatus.Pending or RequestStatus.PendingHRReview))
            {
                throw new BadRequestException("Only pending requests can be edited.");
            }

            if (!string.IsNullOrWhiteSpace(update.Type))
            {
                // A manager edits a request, not invents a type: the label must be one
                // the catalog knows so its rules (balance, caps) still apply.
                var type = RequestTypeCatalog.Find(update.Type)
                    ?? throw new BadRequestException($"Unknown request type '{update.Type}'.");
                // System-generated cover requests are tied to the attendance record
                // for that date; re-typing one would orphan the record.
                if (request.Type == RequestTypeCatalog.UnscheduledAttendanceLabel
                    && type.Label != RequestTypeCatalog.UnscheduledAttendanceLabel)
                {
                    throw new BadRequestException("Unscheduled Attendance requests cannot change type.");
                }
                request.Type = type.Label;
            }

            if (request.Type == RequestTypeCatalog.UnscheduledAttendanceLabel
                && ((update.RequestDate.HasValue && update.RequestDate.Value != request.RequestDate)
                    || update.EndDate.HasValue))
            {
                throw new BadRequestException("Unscheduled Attendance requests cannot change date.");
            }

            if (update.RequestDate.HasValue)
            {
                request.TargetStartDate = update.RequestDate;
                request.RequestDate = update.RequestDate.Value;
            }

            if (update.EndDate.HasValue)
            {
                request.TargetEndDate = update.EndDate;
            }

            if (!string.IsNullOrWhiteSpace(update.Reason))
            {
                request.Details = update.Reason.Trim();
            }

            unitOfWork.GetRepository<EmployeeRequest, int>().Update(request);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public async Task<RequestCommentDto> AddCommentAsync(
            int actorUserId, int requestId, int? activeGymId, CreateRequestCommentDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureDeskRoleAsync(actorUserId, gymId, cancellationToken);

            if (string.IsNullOrWhiteSpace(request.Comment))
            {
                throw new BadRequestException("A comment is required.");
            }

            var body = request.Comment.Trim();
            if (body.Length > 1000)
            {
                throw new BadRequestException("The comment may not exceed 1000 characters.");
            }

            // Scope check first: a comment on another team's request must not exist.
            await LoadInScopeAsync(actorUserId, requestId, gymId, cancellationToken);

            var comment = new RequestComment
            {
                RequestId = requestId,
                AuthorUserId = actorUserId,
                Body = body
            };

            await unitOfWork.GetRepository<RequestComment, int>().AddAsync(comment, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            var reloaded = await unitOfWork.GetRepository<RequestComment, int>()
                .GetByIdAsync(new RequestCommentByIdSpec(comment.Id), cancellationToken)
                ?? throw new NotFoundException("Comment not found.");

            return new RequestCommentDto
            {
                Id = reloaded.Id,
                Author = reloaded.AuthorUser?.UserName ?? string.Empty,
                Body = reloaded.Body,
                Date = reloaded.CreatedAt
            };
        }

        // ---------- helpers ----------

        /// <summary>Re-emits a mapped inbox row with the resolved check-in time: the DTO
        /// is init-only, so a copy is needed to overlay the attendance-record fallback.</summary>
        private static EmployeeRequestDto WithRequestTime(EmployeeRequestDto dto, TimeOnly checkIn) => new()
        {
            Id = dto.Id,
            EmployeeId = dto.EmployeeId,
            EmployeeName = dto.EmployeeName,
            Type = dto.Type,
            SubmittedDate = dto.SubmittedDate,
            SubmittedAt = dto.SubmittedAt,
            RequestDate = dto.RequestDate,
            EndDate = dto.EndDate,
            TargetDate = dto.TargetDate,
            RequestTime = checkIn,
            Hours = dto.Hours,
            Amount = dto.Amount,
            SwapWithEmployeeId = dto.SwapWithEmployeeId,
            SwapWithEmployeeName = dto.SwapWithEmployeeName,
            HasAttachment = dto.HasAttachment,
            Status = dto.Status,
            Reason = dto.Reason,
            Payment = dto.Payment,
            CalculatedDays = dto.CalculatedDays,
            Timeline = dto.Timeline,
        };

        /// <summary>Check-in wall times (attendance timezone) for Unscheduled Attendance
        /// rows whose own TargetTime was never recorded: one range query over the
        /// linked attendance records covers the whole page.</summary>
        private async Task<Dictionary<(int EmployeeId, DateOnly Date), TimeOnly>> ResolveCheckInTimeFallbacksAsync(
            IEnumerable<EmployeeRequest> entities, CancellationToken cancellationToken)
        {
            var needed = entities
                .Where(e => e.TargetTime is null && e.Type == RequestTypeCatalog.UnscheduledAttendanceLabel)
                .ToList();
            if (needed.Count == 0)
            {
                return [];
            }

            var ids = needed.Select(e => e.EmployeeId).Distinct().ToArray();
            var from = needed.Min(e => e.RequestDate);
            var to = needed.Max(e => e.RequestDate);
            var records = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceRecordsByEmployeeIdsRangeSpec(ids, from, to), cancellationToken);

            return records
                .Where(r => r.CheckInTime is not null)
                .GroupBy(r => (r.EmployeeId, r.Date))
                .ToDictionary(
                    g => g.Key,
                    g => TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
                        g.Min(r => r.CheckInTime!.Value), attendanceTimeZone)));
        }

        private async Task<List<int>> ScopedEmployeeIdsAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, gymId, cancellationToken);

            var employees = ledTeamId is not null
                ? await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                    .GetAllAsync(new EmployeesByTeamSpec(ledTeamId.Value), cancellationToken)
                : await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                    .GetAllAsync(new EmployeesByGymSpec(gymId), cancellationToken);

            // Exclude the actor's own employee record — a BM or TL must not appear
            // in request management lists they oversee.
            var ownEmployee = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken);

            return employees
                .Where(e => ownEmployee is null || e.Id != ownEmployee.Id)
                .Select(e => e.Id)
                .ToList();
        }

        private async Task<EmployeeRequest> LoadInScopeAsync(
            int actorUserId, int requestId, int gymId, CancellationToken cancellationToken)
        {
            var request = await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetByIdAsync(new RequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Request not found.");

            var employee = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(request.EmployeeId), cancellationToken);
            if (employee is null || employee.GymId != gymId)
            {
                throw new NotFoundException("Request not found.");
            }

            var inScope = (await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken)).Contains(request.EmployeeId);
            if (!inScope)
            {
                throw new NotFoundException("Request not found.");
            }

            return request;
        }

        private static DecisionOutcome ParseDecision(string decision)
        {
            // The portals send "approve"/"reject"; the HR vocabulary is
            // "Approved"/"Rejected" — both are accepted so the desk and the HR
            // portal speak one contract.
            var normalized = decision.Trim().ToLowerInvariant();
            return normalized switch
            {
                "approve" or "approved" or "accept" or "accepted" => DecisionOutcome.Approved,
                "reject" or "rejected" => DecisionOutcome.Rejected,
                _ => throw new BadRequestException($"Unknown decision '{decision}'."),
            };
        }

        /// <summary>
        /// Stage carried by the decision. Omitted means stage 1 (BranchManager), which
        /// is the only stage this portal acts on. The <c>HR</c> stage is rejected rather
        /// than trusted, because recording an "HR Approved" decision from a stage-1
        /// caller would let an approver forge a record attributed to a stage he does not
        /// hold; naming the stage explicitly is still what lets the HR portal add
        /// stage 2 later without a contract change.
        /// </summary>
        private static ApprovalStage ParseStage(string? stage)
        {
            if (string.IsNullOrWhiteSpace(stage))
            {
                return ApprovalStage.BranchManager;
            }

            if (!Enum.TryParse<ApprovalStage>(stage, ignoreCase: true, out var parsed) || !Enum.IsDefined(parsed))
            {
                throw new BadRequestException($"Unknown approval stage '{stage}'.");
            }

            if (parsed != ApprovalStage.BranchManager)
            {
                throw new BadRequestException("HR decisions are made in the HR portal.");
            }

            return parsed;
        }

        /// <summary>
        /// The stage-1 desk belongs to the manager roles of the active gym
        /// (Team Leader / Branch Manager / Super Admin). A plain employee answers
        /// NotFound so the surface does not exist for him.
        /// </summary>
        private static readonly string[] DeskRoleNames =
        [
            Shared.Authorization.RoleNames.TeamLeader,
            Shared.Authorization.RoleNames.BranchManager,
            Shared.Authorization.RoleNames.SuperAdmin,
        ];

        private async Task EnsureDeskRoleAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, gymId, cancellationToken);
            if (!roleNames.Any(DeskRoleNames.Contains))
            {
                throw new NotFoundException("Request not found.");
            }
        }

        private static int RequireGym(int? activeGymId) =>
            activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");
    }
}
