using System.Globalization;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Request;

namespace Service.Services
{
    /// <summary>
    /// HR requests module (S3, Section 4 R1–R7 + A2/A6/A8): the paged inbox with the
    /// UI's status/type/gym/date/quick filters, request detail, on-behalf creation
    /// (R7), the HR decision stage with Day Off / Sick Leave payment handling (R3/A6),
    /// decision undo (R4), bulk approve (R5), archive/restore (R6), and the
    /// employee-file requests tab (A8). Mirrors <see cref="EmployeeService"/> for
    /// actor resolution, gym scoping, and the ADR-003 guards.
    /// </summary>
    public class RequestService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess,
        ITeamScopeService _teamScope,
        TimeZoneInfo attendanceTimeZone) : IRequestService
    {
        private const int DefaultPageSize = 20;
        private const int MaxPageSize = 100;

        /// <summary>Request types the HR form offers (UI's select list).</summary>
        private static readonly string[] AllowedTypes =
            ["Day Off", "Sick Leave", "Leave Early", "Late Arrival", "Shift Swap", "Resignation"];

        /// <summary>Types that consume a leave balance and therefore surface the paid/unpaid choice.</summary>
        private static readonly string[] BalanceTypes = ["Day Off", "Sick Leave"];

        // ------------------------------------------------------------------
        // R1 — inbox list
        // ------------------------------------------------------------------

        public async Task<RequestListResponse> GetRequestsAsync(int? actorUserId, RequestListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "requests.view", query.Gym, cancellationToken);

            var gymFilter = await ResolveGymFilterAsync(actor, query.Gym, cancellationToken);
            var (statusFilter, decidedOnly) = ParseStatusFilter(query.Status);
            var dateFilter = ParseDate(query.Date);
            var quick = ParseQuick(query.Quick);
            var typeFilter = string.IsNullOrWhiteSpace(query.Type) ? null : query.Type.Trim();

            var sortBy = (query.SortBy ?? "submitted").Trim().ToLowerInvariant();
            // The inbox opens newest-first; an explicit "asc" flips it.
            var sortDescending = string.IsNullOrWhiteSpace(query.SortOrder) ||
                                 string.Equals(query.SortOrder, "desc", StringComparison.OrdinalIgnoreCase);

            var page = Math.Max(query.Page, 1);
            var pageSize = query.PageSize <= 0 ? DefaultPageSize : Math.Min(query.PageSize, MaxPageSize);
            var idFilter = ParseIds(query.Ids);

            var countSpec = new RequestDirectorySpec(
                gymFilter, statusFilter, decidedOnly, typeFilter, dateFilter, quick, 0, 0, sortBy, sortDescending, idFilter);
            var total = await _unitOfWork.GetRepository<EmployeeRequest, int>().CountAsync(countSpec, cancellationToken);

            var pageSpec = new RequestDirectorySpec(
                gymFilter, statusFilter, decidedOnly, typeFilter, dateFilter, quick,
                (page - 1) * pageSize, pageSize, sortBy, sortDescending, idFilter);
            var requests = await _unitOfWork.GetRepository<EmployeeRequest, int>().GetAllAsync(pageSpec, cancellationToken);

            // Unscheduled Attendance rows from before the request carried its own
            // check-in time have no TargetTime: resolve it from the linked
            // attendance record so the desk still shows the real check-in.
            var checkInFallbacks = await ResolveCheckInTimeFallbacksAsync(requests, cancellationToken);

            return new RequestListResponse
            {
                Items = requests.Select(r => MapItem(r, checkInFallbacks.GetValueOrDefault((r.EmployeeId, r.RequestDate)))).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        // ------------------------------------------------------------------
        // R2 — detail
        // ------------------------------------------------------------------

        public async Task<RequestDetailResponse> GetRequestAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var request = await _unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetByIdAsync(new RequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Request not found.");

            // The requester can always follow his own request's progress (mock §10.4
            // detail timeline); other readers need requests.view on the request's gym.
            if (!await IsOwnEmployeeAsync(actor.Id, request.EmployeeId, cancellationToken))
            {
                await _accessControl.EnsurePermissionForGymAsync(actor.Id, "requests.view", request.Employee.GymId, cancellationToken);
            }

            var checkInFallback = await ResolveCheckInTimeFallbackAsync(request, cancellationToken);

            return new RequestDetailResponse { Data = MapItem(request, checkInFallback) };
        }

        // ------------------------------------------------------------------
        // R7 — on-behalf creation (subject picked by name)
        // ------------------------------------------------------------------

        public async Task<CreateRequestResponse> CreateRequestAsync(int? actorUserId, CreateRequestRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "requests.view", cancellationToken);

            var name = (request.Employee ?? string.Empty).Trim();
            if (name.Length == 0)
            {
                throw new BadRequestException("Employee is required.");
            }

            var gymFilter = await ResolveGymFilterAsync(actor, null, cancellationToken);
            var matches = (await _unitOfWork.GetRepository<Employee, int>()
                    .GetAllAsync(new EmployeeByFullNameSpec(name, gymFilter), cancellationToken))
                .ToList();
            var employee = matches.Count switch
            {
                0 => throw new BadRequestException($"No employee named \"{name}\" was found in your gyms."),
                > 1 => throw new BadRequestException($"Multiple employees are named \"{name}\" — open the request from an employee file instead."),
                _ => matches[0],
            };

            var type = ParseType(request.Type);
            var requestedDate = ParseRequiredDate(request.RequestedDate, "requestedDate");
            DateOnly? endDate = null;
            if (!string.IsNullOrWhiteSpace(request.EndDate))
            {
                endDate = ParseRequiredDate(request.EndDate, "endDate");
                if (endDate.Value < requestedDate)
                {
                    throw new BadRequestException("endDate must be on or after requestedDate.");
                }
            }

            var entity = new EmployeeRequest
            {
                EmployeeId = employee.Id,
                Employee = employee,
                Type = type,
                RequestDate = requestedDate,
                TargetStartDate = requestedDate,
                TargetEndDate = endDate,
                Details = (request.Reason ?? string.Empty).Trim(),
                Status = RequestStatus.PendingHRReview,
                CreatedAt = DateTime.UtcNow,
            };

            await _unitOfWork.GetRepository<EmployeeRequest, int>().AddAsync(entity, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var item = MapItem(entity);
            return new CreateRequestResponse
            {
                Data = new CreatedRequestData
                {
                    Id = item.Id,
                    Status = item.Status,
                    Timeline = item.Timeline,
                },
            };
        }

        // ------------------------------------------------------------------
        // R3 / A6 — the HR decision stage
        // ------------------------------------------------------------------

        public async Task<RequestDecisionResponse> DecideRequestAsync(int? actorUserId, int requestId, DecideRequestRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var entity = await _unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetByIdAsync(new RequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Request not found.");

            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "requests.approve", entity.Employee.GymId, cancellationToken);

            if (!string.Equals((request.Stage ?? "HR").Trim(), "HR", StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestException("This endpoint records the HR stage decision only.");
            }

            switch (entity.Status)
            {
                case RequestStatus.Archived:
                    throw new BadRequestException("Archived requests cannot be decided. Restore the request first.");
                case RequestStatus.Pending:
                    throw new BadRequestException("This request is still awaiting the branch manager's decision.");
                case RequestStatus.Approved:
                case RequestStatus.Rejected:
                    throw new BadRequestException("This request has already been decided. Use undo-decision to reopen it.");
            }

            var decision = ParseDecision(request.Decision);
            var comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
            if (decision == DecisionOutcome.Rejected && comment is null)
            {
                throw new BadRequestException("A rejection comment is required.");
            }

            var payment = decision == DecisionOutcome.Approved && IsBalanceType(entity.Type)
                ? await ResolvePaymentAsync(entity, request.Payment, cancellationToken)
                : null;

            if (payment == "paid")
            {
                await ApplyBalanceAsync(entity, +1, cancellationToken);
            }

            var offboarding = decision == DecisionOutcome.Approved && entity.Type == "Resignation";
            if (offboarding)
            {
                entity.Employee.Status = EmployeeStatus.NoticePeriod;
            }

            // Rejecting a Resignation whose approval parked the employee in Notice
            // Period (and no live offboarding case exists) must release them back
            // to Active — the standing-only path leaves no case to reset from.
            if (decision == DecisionOutcome.Rejected
                && entity.Type == "Resignation"
                && entity.Employee.Status == EmployeeStatus.NoticePeriod
                && !await HasLiveOffboardingCaseAsync(entity.EmployeeId, cancellationToken))
            {
                entity.Employee.Status = EmployeeStatus.Active;
                _unitOfWork.GetRepository<Employee, int>().Update(entity.Employee);
                await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(
                    EmployeeService.NewHistory(
                        entity.EmployeeId,
                        DateOnly.FromDateTime(DateTime.UtcNow),
                        EmploymentChangeType.StatusChange,
                        EmployeeService.StatusDisplay(EmployeeStatus.NoticePeriod),
                        EmployeeService.StatusDisplay(EmployeeStatus.Active),
                        "Resignation rejected — employment continues.",
                        actor.Id),
                    cancellationToken);
            }

            if (entity.Type == RequestTypeCatalog.UnscheduledAttendanceLabel)
            {
                if (decision == DecisionOutcome.Approved)
                {
                    var days = request.CalculatedDays ?? (entity.OvertimeHoursRequested.HasValue ? (int)entity.OvertimeHoursRequested.Value : (request.Payment?.Contains("2") == true ? 2 : 1));
                    if (days is not (1 or 2))
                    {
                        throw new BadRequestException("Unscheduled attendance can be counted as 1 or 2 days.");
                    }

                    payment = $"{days} day{(days > 1 ? "s" : "")}";
                    entity.OvertimeHoursRequested = days;
                }
                var attendanceRepo = _unitOfWork.GetRepository<AttendanceRecord, int>();
                var records = await attendanceRepo.GetAllAsync(
                    new AttendanceRecordByEmployeeDatesSpec(entity.EmployeeId, entity.RequestDate), cancellationToken);
                var record = records.FirstOrDefault(r => r.Date == entity.RequestDate);
                if (record is not null)
                {
                    if (decision == DecisionOutcome.Approved)
                    {
                        var days = request.CalculatedDays ?? (entity.OvertimeHoursRequested.HasValue ? (int)entity.OvertimeHoursRequested.Value : 1);
                        if (days is not (1 or 2))
                        {
                            throw new BadRequestException("Unscheduled attendance can be counted as 1 or 2 days.");
                        }

                        record.Notes = $"Approved as {days} day(s) cover/extra day";
                        record.Status = AttendanceStatus.OnTime;
                    }
                    else
                    {
                        record.Notes = "Unscheduled attendance rejected by HR";
                    }
                    attendanceRepo.Update(record);
                }
            }

            entity.Status = decision == DecisionOutcome.Approved ? RequestStatus.Approved : RequestStatus.Rejected;
            entity.Payment = payment;
            entity.Decisions.Add(new RequestDecision
            {
                RequestId = entity.Id,
                Stage = ApprovalStage.HR,
                Decision = decision,
                Comment = comment,
                DecidedBy = actor.Id,
                DecidedAt = DateTime.UtcNow,
            });

            if (decision == DecisionOutcome.Approved)
            {
                await ApplyDeductionCorrectionAsync(entity, actor.Id, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new RequestDecisionResponse
            {
                Message = decision == DecisionOutcome.Rejected
                    ? "Request rejected · employee notified"
                    : payment switch
                    {
                        "paid" => "Request approved · paid (balance deducted)",
                        "unpaid" => "Request approved · unpaid (payroll deduction)",
                        _ => "Request approved · employee notified",
                    },
                Item = MapItem(entity),
                OffboardingPrompt = offboarding ? true : null,
                // SeparationId fills in with the S6 terminations module.
                SeparationId = null,
            };
        }

        // ------------------------------------------------------------------
        // R4 — undo the HR decision while the date is still ahead
        // ------------------------------------------------------------------

        public async Task<RequestDecisionResponse> UndoDecisionAsync(int? actorUserId, int requestId, UndoDecisionRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var entity = await _unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetByIdAsync(new RequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Request not found.");

            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "requests.approve", entity.Employee.GymId, cancellationToken);

            if (entity.Status is not (RequestStatus.Approved or RequestStatus.Rejected))
            {
                throw new BadRequestException("Only decided requests can be undone.");
            }

            var lastDate = entity.TargetEndDate ?? entity.RequestDate;
            if (lastDate < DateOnly.FromDateTime(DateTime.UtcNow.Date))
            {
                throw new BadRequestException("The requested date has passed — the decision can no longer be changed.");
            }

            var requestRepo = _unitOfWork.GetRepository<RequestDecision, int>();
            foreach (var hrDecision in entity.Decisions.Where(d => d.Stage == ApprovalStage.HR).ToList())
            {
                entity.Decisions.Remove(hrDecision);
                requestRepo.Remove(hrDecision);
            }

            if (entity.Payment == "paid")
            {
                await ApplyBalanceAsync(entity, -1, cancellationToken);
            }

            if (entity.Type == "Resignation" && entity.Employee.Status == EmployeeStatus.NoticePeriod)
            {
                entity.Employee.Status = EmployeeStatus.Active;
            }

            entity.Status = RequestStatus.PendingHRReview;
            entity.Payment = null;

            if (entity.Type == RequestTypeCatalog.UnscheduledAttendanceLabel)
            {
                var attendanceRepo = _unitOfWork.GetRepository<AttendanceRecord, int>();
                var records = await attendanceRepo.GetAllAsync(
                    new AttendanceRecordByEmployeeDatesSpec(entity.EmployeeId, entity.RequestDate), cancellationToken);
                var record = records.FirstOrDefault(r => r.Date == entity.RequestDate);
                if (record is not null)
                {
                    // Undo returns the request to HR review, so the attendance note
                    // reverts to the BM-approved wording (or plain pending when
                    // no BM approval is on record).
                    var bmDecision = entity.Decisions
                        .Where(d => d.Stage == ApprovalStage.BranchManager)
                        .OrderBy(d => d.DecidedAt).LastOrDefault();
                    var days = entity.OvertimeHoursRequested.HasValue
                        ? (int)entity.OvertimeHoursRequested.Value
                        : (bmDecision?.Decision == DecisionOutcome.Approved ? 1 : 0);
                    record.Notes = bmDecision?.Decision == DecisionOutcome.Approved
                        ? $"Approved by BM as {days} day(s) (Pending HR review)"
                        : "Unscheduled / Off-day check-in (pending approval)";
                    attendanceRepo.Update(record);
                }
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new RequestDecisionResponse
            {
                Message = "Decision undone · returned to Pending HR Review",
                Item = MapItem(entity),
            };
        }

        // ------------------------------------------------------------------
        // R5 — bulk approve
        // ------------------------------------------------------------------

        public async Task<BulkDecideResponse> BulkDecideAsync(int? actorUserId, BulkDecideRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "requests.approve", cancellationToken);

            if (ParseDecision(request.Decision) != DecisionOutcome.Approved)
            {
                throw new BadRequestException("Bulk decisions only support Approved.");
            }

            var comment = string.IsNullOrWhiteSpace(request.Comment) ? "Bulk approved" : request.Comment.Trim();
            var gymFilter = await ResolveGymFilterAsync(actor, null, cancellationToken);

            IReadOnlyList<EmployeeRequest> targets;
            if (request.RequestIds is { Count: > 0 } ids)
            {
                var distinctIds = ids.Distinct().ToList();
                var loaded = await _unitOfWork.GetRepository<EmployeeRequest, int>()
                    .GetAllAsync(new RequestByIdsSpec(distinctIds, gymFilter), cancellationToken);
                targets = loaded.ToList();
                if (targets.Count != distinctIds.Count)
                {
                    throw new NotFoundException("One or more requests were not found in your gyms.");
                }
            }
            else
            {
                // No ids: every pending request in the caller's gym scope.
                var all = await _unitOfWork.GetRepository<EmployeeRequest, int>()
                    .GetAllAsync(new RequestDirectorySpec(
                        gymFilter, RequestStatus.PendingHRReview, false, null, null, null, 0, 0, "submitted", true),
                        cancellationToken);
                targets = all.ToList();
            }

            var approved = 0;
            var unpaidApplied = 0;
            foreach (var entity in targets.Where(t => t.Status == RequestStatus.PendingHRReview))
            {
                var payment = IsBalanceType(entity.Type)
                    ? await ResolvePaymentAsync(entity, requested: null, cancellationToken)
                    : null;

                if (payment == "paid")
                {
                    await ApplyBalanceAsync(entity, +1, cancellationToken);
                }
                else if (payment == "unpaid")
                {
                    unpaidApplied++;
                }

                if (entity.Type == "Resignation")
                {
                    entity.Employee.Status = EmployeeStatus.NoticePeriod;
                    _unitOfWork.GetRepository<Employee, int>().MarkModified(entity.Employee);
                }

                if (entity.Type == RequestTypeCatalog.UnscheduledAttendanceLabel)
                {
                    // Bulk approval carries no explicit days: the BM's value wins.
                    var days = entity.OvertimeHoursRequested.HasValue
                        ? (int)entity.OvertimeHoursRequested.Value
                        : 1;
                    payment = $"{days} day{(days > 1 ? "s" : "")}";
                    entity.OvertimeHoursRequested = days;

                    var attendanceRepo = _unitOfWork.GetRepository<AttendanceRecord, int>();
                    var records = await attendanceRepo.GetAllAsync(
                        new AttendanceRecordByEmployeeDatesSpec(entity.EmployeeId, entity.RequestDate), cancellationToken);
                    var record = records.FirstOrDefault(r => r.Date == entity.RequestDate);
                    if (record is not null)
                    {
                        record.Notes = $"Approved as {days} day(s) cover/extra day";
                        record.Status = AttendanceStatus.OnTime;
                    }
                }

                entity.Status = RequestStatus.Approved;
                entity.Payment = payment;
                var decision = new RequestDecision
                {
                    RequestId = entity.Id,
                    Stage = ApprovalStage.HR,
                    Decision = DecisionOutcome.Approved,
                    Comment = comment,
                    DecidedBy = actor.Id,
                    DecidedAt = DateTime.UtcNow,
                };
                entity.Decisions.Add(decision);
                await _unitOfWork.GetRepository<RequestDecision, int>().AddAsync(decision, cancellationToken);

                await ApplyDeductionCorrectionAsync(entity, actor.Id, cancellationToken);

                // The targets come from a no-tracking directory query, so the
                // status/payment mutations above need an explicit attach. Mark only
                // the row itself: two requests of the same employee each carry their
                // own detached Employee instance, and a graph-walking Update() would
                // attach the second copy and collide with the first.
                _unitOfWork.GetRepository<EmployeeRequest, int>().MarkModified(entity);
                approved++;
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new BulkDecideResponse
            {
                Message = approved == 1 ? "1 request approved" : $"{approved} requests approved",
                Approved = approved,
                UnpaidApplied = unpaidApplied,
            };
        }

        // ------------------------------------------------------------------
        // R6 — archive / restore
        // ------------------------------------------------------------------

        public async Task<MessageResponse> ArchiveRequestAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default)
        {
            var (actor, entity) = await LoadScopedRequestAsync(actorUserId, requestId, "requests.view", cancellationToken);

            if (entity.Status == RequestStatus.Archived)
            {
                throw new BadRequestException("This request is already archived.");
            }

            entity.Status = RequestStatus.Archived;
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = "Request archived" };
        }

        public async Task<MessageResponse> RestoreRequestAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default)
        {
            var (actor, entity) = await LoadScopedRequestAsync(actorUserId, requestId, "requests.view", cancellationToken);

            if (entity.Status != RequestStatus.Archived)
            {
                throw new BadRequestException("This request is not archived.");
            }

            var hrDecision = LastDecision(entity, ApprovalStage.HR);
            var bmDecision = LastDecision(entity, ApprovalStage.BranchManager);
            entity.Status = hrDecision is not null
                ? hrDecision.Decision == DecisionOutcome.Approved ? RequestStatus.Approved : RequestStatus.Rejected
                : bmDecision is not null
                    ? RequestStatus.PendingHRReview
                    : RequestStatus.Pending;

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = "Request restored" };
        }

        // ------------------------------------------------------------------
        // A8 — employee file → Requests tab
        // ------------------------------------------------------------------

        public async Task<IReadOnlyList<EmployeeRequestItem>> GetEmployeeRequestsAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            // The employee's own requests tab is self-service — no key needed. Anyone
            // else reads it from the employee file with requests.view on that gym,
            // and a team-scoped Team Leader only ever sees his team members (F1).
            if (!await IsOwnEmployeeAsync(actor.Id, employeeId, cancellationToken))
            {
                await _accessControl.EnsurePermissionForGymAsync(actor.Id, "requests.view", employee.GymId, cancellationToken);
                await EnsureTeamScopeAsync(actor.Id, employee, cancellationToken);
            }

            var requests = await _unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new EmployeeRequestsSpec(employeeId), cancellationToken);

            return requests.Select(r => new EmployeeRequestItem
            {
                Id = r.Id,
                Type = r.Type,
                RequestedDate = r.RequestDate,
                EndDate = r.TargetEndDate is { } end && end != r.RequestDate ? end : null,
                SubmittedDate = DateOnly.FromDateTime(r.CreatedAt),
                Status = StatusDisplay(r.Status),
                Reason = r.Details,
                BmComment = LastDecision(r, ApprovalStage.BranchManager)?.Comment,
            }).ToList();
        }

        /// <summary>
        /// True while the employee still has an offboarding case that is neither
        /// completed nor cancelled — i.e. the standing change is still owned by the
        /// separations module and must not be released by a rejection here.
        /// </summary>
        private async Task<bool> HasLiveOffboardingCaseAsync(int employeeId, CancellationToken cancellationToken)
        {
            var cases = await _unitOfWork.GetRepository<OffboardingCase, int>()
                .GetAllAsync(new OffboardingCasesByEmployeesSpec([employeeId]), cancellationToken);
            return cases.Any(c => c.Status is not ("Completed" or "Cancelled"));
        }

        /// <summary>True when the employee row belongs to the caller's own login.</summary>
        private async Task<bool> IsOwnEmployeeAsync(int actorUserId, int employeeId, CancellationToken cancellationToken)
        {
            var own = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken);
            return own is not null && own.Id == employeeId;
        }

        /// <summary>
        /// Team-scoped Team Leaders see only the members of the team they lead in
        /// the employee's gym (F1/F2/F3 convergence); every other role is gym-wide
        /// already. Conceals out-of-team targets with the generic not-found.
        /// </summary>
        private async Task EnsureTeamScopeAsync(int actorUserId, Employee employee, CancellationToken cancellationToken)
        {
            if (!await _teamScope.IsTeamScopedAsync(actorUserId, employee.GymId, cancellationToken))
            {
                return;
            }

            var ledTeamId = await _teamScope.GetLedTeamIdAsync(actorUserId, employee.GymId, cancellationToken);
            if (ledTeamId is null || employee.TeamId != ledTeamId.Value)
            {
                throw new NotFoundException("Employee not found.");
            }
        }

        /// <summary>
        /// The payment recorded on an approve: an explicit paid/unpaid wins; otherwise
        /// the balance decides (paid while days remain, unpaid when exhausted) — the
        /// same default the mock UI's decision modal applies.
        /// </summary>
        private static string ResolvePayment(string? requested, decimal leftDays) =>
            (requested ?? (leftDays > 0 ? "paid" : "unpaid")).ToLowerInvariant() switch
            {
                "paid" => "paid",
                "unpaid" => "unpaid",
                _ => throw new BadRequestException("payment must be paid or unpaid."),
            };

        private async Task<string> ResolvePaymentAsync(EmployeeRequest entity, string? requested, CancellationToken cancellationToken)
        {
            var balance = await LoadBalanceForTypeAsync(entity.Type, entity.EmployeeId, cancellationToken);
            var leftDays = balance is null ? 0 : balance.RemainingDays;
            return ResolvePayment(requested, leftDays);
        }

        /// <summary>
        /// Applies the approved days to the matching leave balance: direction +1 deducts
        /// on approve (creating an empty balance row when none exists, so the deduction
        /// still shows), -1 returns them on undo, clamped at zero.
        /// </summary>
        private async Task ApplyBalanceAsync(EmployeeRequest entity, int direction, CancellationToken cancellationToken)
        {
            var leaveType = entity.Type == "Day Off" ? LeaveType.Annual : LeaveType.Sick;
            var balance = await LoadBalanceForTypeAsync(entity.Type, entity.EmployeeId, cancellationToken)
                ?? new LeaveBalance
                {
                    EmployeeId = entity.EmployeeId,
                    LeaveType = leaveType,
                    Year = DateTime.UtcNow.Year,
                    TotalEntitlement = 0,
                    PendingDays = 0,
                    UsedDays = 0,
                };

            var days = DaysOf(entity);
            balance.UsedDays = direction > 0
                ? balance.UsedDays + days
                : Math.Max(0, balance.UsedDays - days);

            if (balance.Id == 0)
            {
                await _unitOfWork.GetRepository<LeaveBalance, int>().AddAsync(balance, cancellationToken);
            }
            else
            {
                _unitOfWork.GetRepository<LeaveBalance, int>().Update(balance);
            }
        }

        private async Task<LeaveBalance?> LoadBalanceForTypeAsync(string type, int employeeId, CancellationToken cancellationToken)
        {
            var leaveType = type == "Day Off" ? LeaveType.Annual : LeaveType.Sick;
            var balances = await _unitOfWork.GetRepository<LeaveBalance, int>()
                .GetAllAsync(new LeaveBalancesForYearSpec(employeeId, DateTime.UtcNow.Year), cancellationToken);
            return balances.FirstOrDefault(b => b.LeaveType == leaveType);
        }

        /// <summary>Calendar days the request spans (a single Day Off counts as one).</summary>
        private static int DaysOf(EmployeeRequest entity)
        {
            var start = entity.TargetStartDate ?? entity.RequestDate;
            var end = entity.TargetEndDate ?? entity.RequestDate;
            return (end.DayNumber - start.DayNumber) + 1;
        }

        // ------------------------------------------------------------------
        // Shared plumbing
        // ------------------------------------------------------------------

        private async Task<(User Actor, EmployeeRequest Entity)> LoadScopedRequestAsync(
            int? actorUserId, int requestId, string permissionKey, CancellationToken cancellationToken)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var entity = await _unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetByIdAsync(new RequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Request not found.");

            await _accessControl.EnsurePermissionForGymAsync(actor.Id, permissionKey, entity.Employee.GymId, cancellationToken);
            return (actor, entity);
        }

        /// <summary>The caller's gym scope — TopManagement sees all; others their assigned gyms (empty matches nobody).</summary>
        private async Task<int[]?> ResolveGymFilterAsync(User actor, int? requestedGym, CancellationToken cancellationToken)
        {
            if (actor.UserType == UserType.TopManagement)
            {
                return requestedGym.HasValue ? [requestedGym.Value] : null;
            }

            var allowedIds = (await _userAccess.GetGymAccessAsync(actor.Id, cancellationToken))
                .Select(a => a.GymId)
                .ToHashSet();
            if (requestedGym.HasValue)
            {
                if (!allowedIds.Contains(requestedGym.Value))
                {
                    throw new UnAuthorizedException("You are not assigned to this gym.");
                }

                return [requestedGym.Value];
            }

            return allowedIds.Count == 0 ? [] : allowedIds.ToArray();
        }

        private async Task<User> ResolveActorAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var actor = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(actorUserId.Value, cancellationToken);
            if (actor is null || !actor.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            return actor;
        }

        /// <summary>Check-in wall time for one Unscheduled Attendance request whose own
        /// TargetTime was never recorded (rows from before the request carried the
        /// check-in): the linked attendance record is the source of truth, shown in
        /// the attendance timezone. Null when the type does not carry a check-in.</summary>
        private async Task<TimeOnly?> ResolveCheckInTimeFallbackAsync(EmployeeRequest entity, CancellationToken cancellationToken)
        {
            if (entity.TargetTime is not null || entity.Type != RequestTypeCatalog.UnscheduledAttendanceLabel)
            {
                return null;
            }

            var records = await _unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeeDateSpec(entity.EmployeeId, entity.RequestDate), cancellationToken);
            var record = records
                .Where(r => r.CheckInTime is not null)
                .OrderBy(r => r.CheckInTime)
                .FirstOrDefault();
            return record?.CheckInTime is { } checkInUtc
                ? TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(checkInUtc, attendanceTimeZone))
                : null;
        }

        /// <summary>Batch twin of <see cref="ResolveCheckInTimeFallbackAsync"/> for list
        /// reads: one range query covers every row that needs the fallback.</summary>
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
            var records = await _unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceRecordsByEmployeeIdsRangeSpec(ids, from, to), cancellationToken);

            return records
                .Where(r => r.CheckInTime is not null)
                .GroupBy(r => (r.EmployeeId, r.Date))
                .ToDictionary(
                    g => g.Key,
                    g => TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
                        g.Min(r => r.CheckInTime!.Value), attendanceTimeZone)));
        }

        /// <summary>Maps an entity onto the R1 card shape (decisions, payment, timeline).</summary>
        private static RequestListItem MapItem(EmployeeRequest entity, TimeOnly? requestTimeFallback = null)
        {
            var bm = LastDecision(entity, ApprovalStage.BranchManager);
            var hr = LastDecision(entity, ApprovalStage.HR);

            return new RequestListItem
            {
                Id = entity.Id,
                Employee = entity.Employee?.FullName ?? string.Empty,
                Gym = entity.Employee?.Gym?.Name ?? string.Empty,
                Type = entity.Type,
                SubmittedDate = DateOnly.FromDateTime(entity.CreatedAt),
                RequestedDate = entity.RequestDate,
                EndDate = NormalizeDisplayRange(entity),
                RequestTime = requestTimeFallback ?? entity.TargetTime,
                Amount = entity.RequestedAmount,
                Status = StatusDisplay(entity.Status),
                BmDecision = bm?.Decision.ToString(),
                BmComment = bm?.Comment,
                HrDecision = hr?.Decision.ToString(),
                HrComment = hr?.Comment,
                Payment = entity.Payment,
                CalculatedDays = entity.OvertimeHoursRequested.HasValue
                    ? (int?)entity.OvertimeHoursRequested.Value
                    : (entity.Payment != null && entity.Payment.Contains("2") ? (int?)2 : (entity.Payment != null && entity.Payment.Contains("1") ? (int?)1 : null)),
                Reason = entity.Details,
                HasAttachment = !string.IsNullOrEmpty(entity.AttachmentPath),
                Timeline = BuildTimeline(entity, bm, hr),
            };
        }

        /// <summary>
        /// Range end the detail drawer renders (mock §10 "Oct 20 – Oct 22"): the
        /// entity's TargetEndDate when it actually extends past the request date.
        /// </summary>
        private static DateOnly? NormalizeDisplayRange(EmployeeRequest entity) =>
            entity.TargetEndDate is { } end && end != entity.RequestDate ? end : null;

        /// <summary>Submitted → BM step → HR step, mirroring the mock UI's timeline chips.</summary>
        private static List<RequestTimelineStep> BuildTimeline(EmployeeRequest entity, RequestDecision? bm, RequestDecision? hr)
        {
            var steps = new List<RequestTimelineStep>
            {
                new() { Step = "Submitted", Date = FormatStamp(entity.CreatedAt), Done = true },
            };

            if (bm is not null)
            {
                steps.Add(new RequestTimelineStep
                {
                    Step = $"BM {bm.Decision}",
                    Date = FormatStamp(bm.DecidedAt),
                    Done = true,
                });
            }
            else if (entity.Status == RequestStatus.Pending)
            {
                steps.Add(new RequestTimelineStep { Step = "BM Review", Date = "Pending" });
            }

            if (hr is not null)
            {
                steps.Add(new RequestTimelineStep
                {
                    Step = $"HR {hr.Decision}",
                    Date = FormatStamp(hr.DecidedAt),
                    Done = true,
                });
            }
            else if (entity.Status == RequestStatus.PendingHRReview)
            {
                steps.Add(new RequestTimelineStep { Step = "HR Review", Date = "Pending" });
            }

            return steps;
        }

        private static RequestDecision? LastDecision(EmployeeRequest entity, ApprovalStage stage) =>
            entity.Decisions?
                .Where(d => d.Stage == stage)
                .OrderBy(d => d.DecidedAt)
                .LastOrDefault();

        private static string FormatStamp(DateTime moment) =>
            moment.ToString("MMM d, yyyy '·' HH:mm", CultureInfo.InvariantCulture);

        private static string StatusDisplay(RequestStatus status) =>
            status == RequestStatus.PendingHRReview ? "Pending HR Review" : status.ToString();

        /// <summary>
        /// An approved Deduction Correction takes the disputed money off the employee:
        /// while the sheet is still open the line and its candidate are rejected (the
        /// day is waived, and the candidate stays final); once the sheet is locked the
        /// paid month cannot change, so the amount is offset by a negative deduction
        /// line in the employee's next open period.
        /// </summary>
        private async Task ApplyDeductionCorrectionAsync(
            EmployeeRequest request, int actorId, CancellationToken cancellationToken)
        {
            if (!request.Type.Equals(RequestTypeCatalog.DeductionCorrectionLabel, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var date = request.TargetStartDate ?? request.RequestDate;
            var candidates = (await _unitOfWork.GetRepository<DeductionCandidate, int>()
                    .GetAllAsync(new DeductionCandidatesByEmployeesSpec([request.EmployeeId]), cancellationToken))
                .Where(c => PayrollService.CandidateDayOf(c) == date)
                .ToList();
            var candidate = candidates
                .OrderByDescending(c => c.Status == DeductionStatus.Approved)
                .ThenByDescending(c => c.Status == DeductionStatus.BranchApproved)
                .FirstOrDefault();

            var entries = (await _unitOfWork.GetRepository<PayrollEntry, int>()
                    .GetAllAsync(new PayrollEntriesByEmployeeSpec(request.EmployeeId), cancellationToken))
                .ToList();

            var match = entries
                .SelectMany(entry => entry.LineItems
                    .Where(l => l.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase))
                    .Where(l => candidate is not null
                        ? l.DeductionCandidateId == candidate.Id
                        : l.EffectiveDate == date)
                    .Select(line => (Entry: entry, Line: line)))
                .OrderByDescending(x => x.Entry.PayrollPeriod.StartDate)
                .FirstOrDefault();

            if (match.Line is null)
            {
                // No sheet line yet — a still-pending candidate is simply waived.
                if (candidate is not null
                    && candidate.Status is DeductionStatus.Pending or DeductionStatus.BranchApproved)
                {
                    candidate.Status = DeductionStatus.Rejected;
                    candidate.ReviewedBy = actorId;
                    candidate.ReviewedAt = DateTime.UtcNow;
                    _unitOfWork.GetRepository<DeductionCandidate, int>().MarkModified(candidate);
                }

                return;
            }

            var entry = match.Entry;
            var line = match.Line;
            var period = entry.PayrollPeriod;
            var locked = period.Status != PayrollPeriodStatus.Open
                || period.PaidDate is not null
                || entry.Status == "Locked";

            if (!locked)
            {
                if (line.Status is not "Rejected")
                {
                    line.Status = "Rejected";
                    line.ReviewedBy = actorId;
                    line.ReviewedAt = DateTime.UtcNow;
                    _unitOfWork.GetRepository<PayrollEntryLineItem, int>().MarkModified(line);
                }

                if (candidate is not null && candidate.Status != DeductionStatus.Rejected)
                {
                    candidate.Status = DeductionStatus.Rejected;
                    candidate.ReviewedBy = actorId;
                    candidate.ReviewedAt = DateTime.UtcNow;
                    _unitOfWork.GetRepository<DeductionCandidate, int>().MarkModified(candidate);
                }

                PayrollService.SyncTotals(entry);
                _unitOfWork.GetRepository<PayrollEntry, int>().MarkModified(entry);
                return;
            }

            // The locked month is paid history. The correction becomes a negative
            // deduction in the next open period, so net pay carries the refund.
            if (line.Status is not ("Accepted" or "Approved"))
            {
                return;
            }

            var openEntries = entries
                .Where(e => e.PayrollPeriod.Id != period.Id
                    && e.PayrollPeriod.Status == PayrollPeriodStatus.Open
                    && e.PayrollPeriod.PaidDate is null)
                .OrderBy(e => e.PayrollPeriod.StartDate)
                .ToList();
            var openEntry = openEntries.FirstOrDefault(e => e.PayrollPeriod.StartDate > period.StartDate)
                ?? openEntries.FirstOrDefault()
                ?? throw new BadRequestException(
                    "This month is locked and there is no open payroll period to carry the correction.");

            if (openEntry.LineItems.Any(l => l.EmployeeRequestId == request.Id))
            {
                return;
            }

            var reversal = new PayrollEntryLineItem
            {
                PayrollEntryId = openEntry.Id,
                Type = "Deduction",
                Label = "Deduction correction",
                EffectiveDate = date,
                Amount = -Math.Abs(line.Amount),
                Reason = string.IsNullOrWhiteSpace(request.Details)
                    ? $"Reversal of the {date:yyyy-MM-dd} deduction."
                    : request.Details.Trim(),
                Source = "correction",
                EmployeeRequestId = request.Id,
                Status = "Accepted",
                ReviewedBy = actorId,
                ReviewedAt = DateTime.UtcNow,
            };

            await _unitOfWork.GetRepository<PayrollEntryLineItem, int>().AddAsync(reversal, cancellationToken);
            openEntry.LineItems.Add(reversal);
            PayrollService.SyncTotals(openEntry);
            _unitOfWork.GetRepository<PayrollEntry, int>().MarkModified(openEntry);
        }

        private static bool IsBalanceType(string type) =>
            type is "Day Off" or "Sick Leave";

        private static DecisionOutcome ParseDecision(string? value) =>
            (value ?? string.Empty).Trim().ToLowerInvariant() switch
            {
                "approved" => DecisionOutcome.Approved,
                "rejected" => DecisionOutcome.Rejected,
                _ => throw new BadRequestException("decision must be Approved or Rejected."),
            };

        private static string ParseType(string? value)
        {
            var term = (value ?? string.Empty).Trim();
            var match = AllowedTypes.FirstOrDefault(t =>
                string.Equals(t, term, StringComparison.OrdinalIgnoreCase));
            return match ?? throw new BadRequestException(
                $"type must be one of: {string.Join(", ", AllowedTypes)}.");
        }

        private static DateOnly ParseRequiredDate(string? value, string field)
        {
            if (!DateOnly.TryParse(value?.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            {
                throw new BadRequestException($"{field} must be a valid date (yyyy-MM-dd).");
            }

            return parsed;
        }

        private static DateOnly? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return ParseRequiredDate(value, "date");
        }

        /// <summary>The "ids" filter: a comma-separated id list (the linked-requests pane).</summary>
        private static int[]? ParseIds(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var ids = new List<int>();
            foreach (var part in value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!int.TryParse(part, out var id))
                {
                    throw new BadRequestException("ids must be a comma-separated list of integers.");
                }

                ids.Add(id);
            }

            return ids.Count > 0 ? ids.Distinct().ToArray() : null;
        }

        /// <summary>Status vocabulary: the display values the UI tabs send, plus "Decided".</summary>
        private static (RequestStatus? Status, bool DecidedOnly) ParseStatusFilter(string? value)
        {
            var term = (value ?? string.Empty).Replace(" ", string.Empty).ToLowerInvariant();
            return term switch
            {
                "" => (null, false),
                "pending" => (RequestStatus.Pending, false),
                "pendinghrreview" => (RequestStatus.PendingHRReview, false),
                "approved" => (RequestStatus.Approved, false),
                "rejected" => (RequestStatus.Rejected, false),
                "archived" => (RequestStatus.Archived, false),
                "decided" => (null, true),
                _ => throw new BadRequestException("status must be Pending, Pending HR Review, Approved, Rejected, Archived, or Decided."),
            };
        }

        private static string? ParseQuick(string? value)
        {
            var term = (value ?? string.Empty).Trim().ToLowerInvariant();
            return term switch
            {
                "" => null,
                "urgent" or "approved" or "bmrejected" or "balance" => term,
                _ => throw new BadRequestException("quick must be urgent, approved, bmRejected, or balance."),
            };
        }
    }
}
