using System.Globalization;
using System.Text.Json;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Recruitment;
using Shared.DataTransferObject.Separation;

namespace Service.Services
{
    /// <summary>
    /// Separations / exit lifecycle (api-spec-from-ui.md §5.6 T1–T6 + E19). Two
    /// initiation paths share one case-creation core: the Branch-Manager termination
    /// request (T2 → status "Requested") and the HR-initiated offboard (E19 → status
    /// "Notice Period", employee moved to Notice Period — the mock's submitInitiateOffboarding).
    /// A case then walks the five exit checklist tasks, records the HR exit verdict,
    /// and finalizes by archiving the employee (status Terminated, login cut, the
    /// mock's "Employee Offboarded" audit row).
    /// </summary>
    public sealed class SeparationsService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess,
        IUserSessionService _userSessions) : ISeparationsService
    {
        /// <summary>The five exit tasks the mock pre-seeds on every separation.</summary>
        internal static readonly string[] ExitChecklistLabels =
        [
            "Exit interview scheduled",
            "Handover completed",
            "Uniform returned",
            "Access cards revoked",
            "Final settlement",
        ];

        /// <summary>Canonical stage vocabulary (mock _sepStages).</summary>
        internal static readonly string[] SeparationStages =
        [
            "Requested",
            "Notice Period",
            "Exit In Progress",
            "Under Review",
            "Completed",
        ];

        /// <summary>T2 reason vocabulary — the mock's bm-term-reason select options.</summary>
        private static readonly string[] TerminationReasons =
        [
            "Performance issues",
            "Attendance violations",
            "Misconduct / policy breach",
            "Contract expiry — not renewing",
            "Restructuring / redundancy",
        ];

        private static readonly string[] SettlementDirections = ["none", "owedToEmployee", "employeeOwes"];
        private static readonly string[] RehireStatuses = ["Eligible", "Banned", "Not Eligible"];
        private static readonly string[] ApprovalDecisions = ["Approved", "Rejected"];
        private static readonly string[] ExitInterviewStatuses = ["Completed", "No Show", "Rescheduled"];

        private static readonly JsonSerializerOptions JsonStore = new(JsonSerializerDefaults.Web);

        // ==================================================================
        // T1 — GET /api/separations · GET /api/separations/{id}
        // ==================================================================

        public async Task<SeparationListResponse> GetSeparationsAsync(int? actorUserId, SeparationListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "employees.view", cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            var scope = await ResolveScopeAsync(actor, query.Gym, cancellationToken);
            var status = HrPortalHelpers.NullIfBlank(query.Status)?.Trim().ToLowerInvariant();
            var type = HrPortalHelpers.NullIfBlank(query.Type)?.Trim().ToLowerInvariant();

            var total = await _unitOfWork.GetRepository<OffboardingCase, int>()
                .CountAsync(new SeparationListSpec(scope, status, type, 0, 0), cancellationToken);
            var rows = await _unitOfWork.GetRepository<OffboardingCase, int>()
                .GetAllAsync(new SeparationListSpec(scope, status, type, (page - 1) * pageSize, pageSize), cancellationToken);

            return new SeparationListResponse
            {
                Items = await MapItemsAsync(rows, withLeaveTaken: true, cancellationToken),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<SeparationDataResponse> GetSeparationAsync(int? actorUserId, int separationId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await _unitOfWork.GetRepository<OffboardingCase, int>()
                .GetByIdAsync(new SeparationByIdSpec(separationId), cancellationToken)
                ?? throw new NotFoundException("Separation not found.");
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "employees.view", kase.Employee.GymId, cancellationToken);

            var items = await MapItemsAsync([kase], withLeaveTaken: true, cancellationToken);
            return new SeparationDataResponse { Data = items[0] };
        }

        // ==================================================================
        // T2 — POST /api/separations (Branch-Manager termination request)
        // ==================================================================

        public async Task<SeparationDataResponse> RequestSeparationAsync(int? actorUserId, CreateSeparationRequest request, CancellationToken cancellationToken = default)
        {
            var reason = CanonicalizeTerminationReason(request.Reason);
            var separationId = await CreateOffboardingCaseAsync(
                actorUserId, request.EmployeeId, request.LastDay, reason, request.Notes, "Termination", "Requested", cancellationToken);

            var kase = await _unitOfWork.GetRepository<OffboardingCase, int>()
                .GetByIdAsync(new SeparationByIdSpec(separationId), cancellationToken)
                ?? throw new NotFoundException("Separation not found.");

            // A Branch-Manager termination request waits for HR approval before
            // anything happens to the employee.
            kase.ApprovalStatus = "Pending";
            _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var items = await MapItemsAsync([kase], withLeaveTaken: true, cancellationToken);
            return new SeparationDataResponse { Data = items[0] };
        }

        // ==================================================================
        // E19 — POST /api/employees/{id}/offboard (HR-initiated offboarding)
        // ==================================================================

        public async Task<OffboardResponse> OffboardEmployeeAsync(int? actorUserId, int employeeId, OffboardEmployeeRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var reason = HrPortalHelpers.NullIfBlank(request.Reason)
                ?? throw new BadRequestException("A reason is required.");
            var separationType = ResolveSeparationType(request.SeparationType, reason);

            var separationId = await CreateOffboardingCaseAsync(
                actorUserId, employeeId, request.LastDay, reason, request.Notes, separationType, "Notice Period", cancellationToken);

            // The mock parks the employee in Notice Period while the exit runs.
            var employee = await _unitOfWork.GetRepository<Employee, int>().GetByIdAsync(employeeId, cancellationToken)
                ?? throw new NotFoundException("Employee not found.");
            await MoveEmployeeStandingAsync(actor, employee, EmployeeStatus.NoticePeriod, EmploymentChangeType.StatusChange,
                $"Offboarding initiated (Last Day: {request.LastDay.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}, Reason: {reason})",
                cancellationToken);

            await AuditAsync(actor, "Offboarding Initiated", nameof(Employee), employee.Id, employee.GymId,
                new
                {
                    target = employee.FullName,
                    detail = $"Offboarding initiated (Last Day: {request.LastDay.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}, Reason: {reason})",
                },
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new OffboardResponse { Data = new OffboardResponseData { SeparationId = separationId } };
        }

        // ==================================================================
        // T3 — PUT /api/separations/{id}/checklist
        // ==================================================================

        public async Task<SeparationChecklistDataResponse> UpdateChecklistAsync(int? actorUserId, int separationId, SeparationChecklistRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await LoadForActionAsync(actor, separationId, cancellationToken);

            var ordered = kase.ChecklistItems.OrderBy(i => i.SortOrder).ToList();
            if (request.Index < 0 || request.Index >= ordered.Count)
            {
                throw new BadRequestException("Unknown checklist item.");
            }

            var item = ordered[request.Index];
            if (item.IsCompleted != request.Done)
            {
                item.IsCompleted = request.Done;
                item.CompletedAt = request.Done ? DateTime.UtcNow : null;
                item.CompletedBy = request.Done ? actor.Id : null;
                _unitOfWork.GetRepository<OffboardingChecklistItem, int>().Update(item);

                // First tick moves Requested / Notice Period → Exit In Progress (mock toggleSepChecklist).
                if (request.Done && (kase.Status == "Requested" || kase.Status == "Notice Period"))
                {
                    kase.Status = "Exit In Progress";
                    _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            var done = ordered.Count(i => i.IsCompleted);
            return new SeparationChecklistDataResponse
            {
                Data = new SeparationChecklistResponse
                {
                    Progress = ordered.Count > 0 ? (int)Math.Round(done * 100d / ordered.Count) : 0,
                    Status = kase.Status,
                },
            };
        }

        // ==================================================================
        // T4 — PUT /api/separations/{id}/stage
        // ==================================================================

        public async Task<MessageResponse> UpdateStageAsync(int? actorUserId, int separationId, SeparationStageRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await LoadForActionAsync(actor, separationId, cancellationToken);

            var target = SeparationStages.FirstOrDefault(s => string.Equals(s, request.Status?.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new BadRequestException("Status must be Requested, Notice Period, Exit In Progress, Under Review, or Completed.");

            if (target == kase.Status && target != "Completed")
            {
                return new MessageResponse { Message = $"Separation is already {target}." };
            }

            var alreadyCompleted = target == kase.Status;
            kase.Status = target;
            if (target == "Completed")
            {
                // The mock's moveSeparation ticks the whole strip when it lands on Completed.
                var now = DateTime.UtcNow;
                foreach (var item in kase.ChecklistItems)
                {
                    if (item.IsCompleted)
                    {
                        continue;
                    }

                    item.IsCompleted = true;
                    item.CompletedAt = now;
                    item.CompletedBy = actor.Id;
                    _unitOfWork.GetRepository<OffboardingChecklistItem, int>().Update(item);
                }

                kase.CompletedAt ??= now;
            }

            _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);

            if (target == "Completed")
            {
                // A completed case means the employment is over: archive the employee
                // and cut live access, exactly like the explicit finalize action.
                // Re-running this for an already-Completed case self-heals legacy rows
                // whose employee/login were never terminated.
                await AuditAsync(actor, "Employee Offboarded", nameof(Employee), kase.EmployeeId, kase.Employee.GymId,
                    new
                    {
                        target = kase.Employee.FullName,
                        detail = $"Separation completed via stage update (Reason: {kase.Reason})",
                    },
                    cancellationToken);
                await TerminateEmployeeAsync(
                    actor, kase,
                    $"Separation completed via stage update (Reason: {kase.Reason})",
                    cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse
            {
                Message = alreadyCompleted
                    ? "Separation is already Completed."
                    : $"Separation stage updated to {target}.",
            };
        }

        // ==================================================================
        // T5 — PUT /api/separations/{id}/verdict
        // ==================================================================

        public async Task<MessageResponse> SaveVerdictAsync(int? actorUserId, int separationId, SeparationVerdictRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await LoadForActionAsync(actor, separationId, cancellationToken);

            var finalReason = HrPortalHelpers.NullIfBlank(request.FinalReason)
                ?? throw new BadRequestException("A final reason is required.");
            var direction = MatchVocabulary(SettlementDirections, request.Settlement?.Direction)
                ?? throw new BadRequestException("Settlement direction must be none, owedToEmployee, or employeeOwes.");
            var rehire = MatchVocabulary(RehireStatuses, request.Rehire?.Status)
                ?? throw new BadRequestException("Rehire status must be Eligible or Banned.");

            kase.FinalReason = finalReason;
            kase.SettlementDirection = direction;
            kase.SettlementAmount = request.Settlement?.Amount ?? 0;
            kase.SettlementNote = HrPortalHelpers.NullIfBlank(request.Settlement?.Note);
            kase.RehireStatus = rehire;
            kase.RehireNote = HrPortalHelpers.NullIfBlank(request.Rehire?.Note);

            // Spec: verdict moves the case to Under Review (a completed case stays completed).
            if (kase.Status != "Completed")
            {
                kase.Status = "Under Review";
            }

            _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = "Exit verdict saved." };
        }

        // ==================================================================
        // T6 — POST /api/separations/{id}/finalize
        // ==================================================================

        public async Task<MessageResponse> FinalizeAsync(int? actorUserId, int separationId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await LoadForActionAsync(actor, separationId, cancellationToken);

            if (!kase.ChecklistItems.All(i => i.IsCompleted))
            {
                throw new BadRequestException("Complete the exit checklist before finalizing.");
            }

            if (kase.FinalReason is null || kase.SettlementDirection is null || kase.RehireStatus is null)
            {
                throw new BadRequestException("Save the exit verdict before finalizing.");
            }

            if (kase.Status != "Completed")
            {
                kase.Status = "Completed";
            }

            kase.CompletedAt ??= DateTime.UtcNow;
            _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);

            await AuditAsync(actor, "Employee Offboarded", nameof(Employee), kase.EmployeeId, kase.Employee.GymId,
                new
                {
                    target = kase.Employee.FullName,
                    detail = $"Exit checklist completed. Separation finalized (Reason: {kase.Reason})",
                },
                cancellationToken);

            // Archive the employee (status Terminated + Offboard history row) and
            // sever every live session: deactivate the account and revoke refresh
            // tokens. The shared helper keeps this path identical to stage → Completed.
            var employee = await TerminateEmployeeAsync(
                actor, kase,
                $"Exit checklist completed. Separation finalized (Reason: {kase.Reason})",
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = $"Separation completed for {employee.FullName}." };
        }

        // ==================================================================
        // Termination workflow — approval → exit interview → clearance
        // ==================================================================

        public async Task<MessageResponse> DecideTerminationRequestAsync(int? actorUserId, int separationId, SeparationApprovalRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await LoadForActionAsync(actor, separationId, cancellationToken);

            var decision = MatchVocabulary(ApprovalDecisions, request.Decision)
                ?? throw new BadRequestException("Decision must be Approved or Rejected.");
            if (kase.Status == "Completed")
            {
                throw new BadRequestException("This separation is already complete.");
            }

            if (kase.ApprovalStatus == "Rejected")
            {
                throw new BadRequestException("This termination request was already rejected.");
            }

            if (decision == "Approved" && kase.ApprovalStatus == "Approved")
            {
                return new MessageResponse { Message = "This termination request is already approved." };
            }

            kase.ApprovalStatus = decision;
            kase.ApprovedBy = actor.Id;
            kase.ApprovedAt = DateTime.UtcNow;
            kase.ApprovalNote = HrPortalHelpers.NullIfBlank(request.Note);
            _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);

            if (decision == "Rejected")
            {
                // Cancelling the case releases the employee — no exit, no Notice Period.
                kase.Status = "Cancelled";
                kase.CompletedAt = DateTime.UtcNow;
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                await AuditAsync(actor, "Termination Request Rejected", nameof(Employee), kase.EmployeeId, kase.Employee.GymId,
                    new { target = kase.Employee.FullName, detail = kase.ApprovalNote ?? $"Reason: {kase.Reason}" },
                    cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return new MessageResponse { Message = $"Termination request rejected for {kase.Employee.FullName}." };
            }

            if (kase.Status is "Requested" or "Open")
            {
                kase.Status = "Notice Period";
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // HR approval parks the employee in Notice Period while the exit runs.
            await MoveEmployeeStandingAsync(actor, kase.Employee, EmployeeStatus.NoticePeriod, EmploymentChangeType.StatusChange,
                $"Termination request approved (Last Day: {kase.LastWorkingDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}, Reason: {kase.Reason})",
                cancellationToken);

            await AuditAsync(actor, "Termination Request Approved", nameof(Employee), kase.EmployeeId, kase.Employee.GymId,
                new { target = kase.Employee.FullName, detail = kase.ApprovalNote ?? $"Reason: {kase.Reason}" },
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = $"Termination request approved for {kase.Employee.FullName}." };
        }

        public async Task<MessageResponse> ScheduleExitInterviewAsync(int? actorUserId, int separationId, ExitInterviewScheduleRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await LoadForActionAsync(actor, separationId, cancellationToken);

            EnsureClearancePending(kase);
            if (kase.ApprovalStatus != "Approved")
            {
                throw new BadRequestException("Approve the termination request before scheduling the exit interview.");
            }

            if (request.ScheduledAt == default)
            {
                throw new BadRequestException("An interview date and time is required.");
            }

            var isReschedule = kase.ExitInterviewScheduledAt is not null;
            kase.ExitInterviewScheduledAt = NormalizeUtc(request.ScheduledAt);
            kase.ExitInterviewStatus = isReschedule ? "Rescheduled" : "Scheduled";
            kase.ExitInterviewCompletedAt = null;
            if (kase.Status is "Requested" or "Open" or "Notice Period")
            {
                kase.Status = "Exit In Progress";
            }

            TickChecklist(kase, "Exit interview scheduled", actor.Id);
            _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await AuditAsync(actor, isReschedule ? "Exit Interview Rescheduled" : "Exit Interview Scheduled",
                nameof(Employee), kase.EmployeeId, kase.Employee.GymId,
                new
                {
                    target = kase.Employee.FullName,
                    detail = $"Exit interview {request.ScheduledAt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)}",
                },
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse
            {
                Message = isReschedule
                    ? $"Exit interview rescheduled for {kase.Employee.FullName}."
                    : $"Exit interview scheduled for {kase.Employee.FullName}.",
            };
        }

        public async Task<MessageResponse> UpdateExitInterviewStatusAsync(int? actorUserId, int separationId, ExitInterviewStatusRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await LoadForActionAsync(actor, separationId, cancellationToken);

            EnsureClearancePending(kase);
            var status = MatchVocabulary(ExitInterviewStatuses, request.Status)
                ?? throw new BadRequestException("Exit interview status must be Completed, No Show, or Rescheduled.");

            if (status == "Rescheduled")
            {
                if (request.RescheduledAt is null || request.RescheduledAt == default)
                {
                    throw new BadRequestException("A new interview date and time is required to reschedule.");
                }

                kase.ExitInterviewScheduledAt = NormalizeUtc(request.RescheduledAt.Value);
            }

            kase.ExitInterviewStatus = status;
            kase.ExitInterviewCompletedAt = status == "Completed" ? DateTime.UtcNow : null;
            if (status == "Completed")
            {
                TickChecklist(kase, "Exit interview scheduled", actor.Id);
            }

            _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await AuditAsync(actor, $"Exit Interview {status}", nameof(Employee), kase.EmployeeId, kase.Employee.GymId,
                new { target = kase.Employee.FullName, detail = HrPortalHelpers.NullIfBlank(request.Note) },
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = $"Exit interview marked {status}." };
        }

        public async Task<MessageResponse> SaveExitInterviewAsync(int? actorUserId, int separationId, ExitInterviewFormRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await LoadForActionAsync(actor, separationId, cancellationToken);

            EnsureClearancePending(kase);
            if (kase.ApprovalStatus != "Approved")
            {
                throw new BadRequestException("Approve the termination request before recording the exit interview.");
            }

            if (request.Complete)
            {
                if (HrPortalHelpers.NullIfBlank(request.Interviewer) is null || request.InterviewDate is null)
                {
                    throw new BadRequestException("Interviewer and interview date are required to complete the exit interview.");
                }

                if (HrPortalHelpers.NullIfBlank(request.ReasonForLeaving) is null)
                {
                    throw new BadRequestException("Reason for leaving is required to complete the exit interview.");
                }

                if (request.RehireEligible is null)
                {
                    throw new BadRequestException("Choose whether the employee is eligible for rehire.");
                }
            }

            kase.Interviewer = HrPortalHelpers.NullIfBlank(request.Interviewer);
            kase.InterviewDate = request.InterviewDate;
            kase.ReasonForLeaving = HrPortalHelpers.NullIfBlank(request.ReasonForLeaving);
            kase.WhatLikedMost = HrPortalHelpers.NullIfBlank(request.WhatLikedMost);
            kase.WhatToImprove = HrPortalHelpers.NullIfBlank(request.WhatToImprove);
            kase.JobSatisfaction = request.JobSatisfaction;
            kase.ManagementRating = request.ManagementRating;
            kase.WorkEnvironmentRating = request.WorkEnvironmentRating;
            kase.CompensationRating = request.CompensationRating;
            kase.WouldRecommend = request.WouldRecommend;
            kase.InterviewNotes = HrPortalHelpers.NullIfBlank(request.Notes);
            kase.Blacklisted = request.Blacklisted;
            kase.BlacklistReason = request.Blacklisted ? HrPortalHelpers.NullIfBlank(request.BlacklistReason) : null;

            if (request.RehireEligible is not null)
            {
                kase.RehireStatus = request.RehireEligible.Value ? "Eligible" : "Not Eligible";
                kase.RehireNote = HrPortalHelpers.NullIfBlank(request.RehireNote);
            }

            if (request.Complete)
            {
                kase.ExitInterviewStatus = "Completed";
                kase.ExitInterviewCompletedAt = DateTime.UtcNow;
                TickChecklist(kase, "Exit interview scheduled", actor.Id);
            }
            else if (kase.ExitInterviewStatus is null)
            {
                kase.ExitInterviewStatus = "Scheduled";
            }

            _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await AuditAsync(actor, request.Complete ? "Exit Interview Completed" : "Exit Interview Saved",
                nameof(Employee), kase.EmployeeId, kase.Employee.GymId,
                new { target = kase.Employee.FullName, detail = kase.ReasonForLeaving },
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse
            {
                Message = request.Complete
                    ? $"Exit interview completed for {kase.Employee.FullName}."
                    : $"Exit interview saved for {kase.Employee.FullName}.",
            };
        }

        public async Task<MessageResponse> SaveClearanceAsync(int? actorUserId, int separationId, SeparationClearanceRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var kase = await LoadForActionAsync(actor, separationId, cancellationToken);

            EnsureClearancePending(kase);

            kase.UniformReturned = request.UniformReturned;
            kase.AssetsReturned = request.AssetsReturned;
            kase.AccessRevoked = request.AccessRevoked;
            kase.FinalSettlementCompleted = request.FinalSettlementCompleted;
            kase.ClearanceNotes = HrPortalHelpers.NullIfBlank(request.Notes);

            if (request.SettlementDirection is not null)
            {
                kase.SettlementDirection = MatchVocabulary(SettlementDirections, request.SettlementDirection)
                    ?? throw new BadRequestException("Settlement direction must be none, owedToEmployee, or employeeOwes.");
            }

            if (request.SettlementAmount is not null)
            {
                kase.SettlementAmount = request.SettlementAmount;
            }

            if (!request.Complete)
            {
                _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return new MessageResponse { Message = "Clearance saved." };
            }

            if (!(request.UniformReturned && request.AssetsReturned && request.AccessRevoked && request.FinalSettlementCompleted))
            {
                throw new BadRequestException("Return the uniform and assets, revoke access and settle the final pay before completing clearance.");
            }

            if (kase.ExitInterviewStatus != "Completed")
            {
                throw new BadRequestException("Complete the exit interview before completing clearance.");
            }

            kase.ClearanceCompleted = true;
            kase.ClearanceCompletedAt = DateTime.UtcNow;
            foreach (var label in new[] { "Handover completed", "Uniform returned", "Access cards revoked", "Final settlement" })
            {
                TickChecklist(kase, label, actor.Id);
            }

            // The employee leaves the roster only once the interview AND the
            // clearance are done — the automatic move to Former Employees.
            if (kase.Status != "Completed")
            {
                kase.Status = "Completed";
            }

            kase.CompletedAt ??= DateTime.UtcNow;
            kase.FinalReason ??= kase.Reason;
            kase.SettlementDirection ??= "none";
            kase.RehireStatus ??= "Not Eligible";
            _unitOfWork.GetRepository<OffboardingCase, int>().Update(kase);

            await AuditAsync(actor, "Employee Offboarded", nameof(Employee), kase.EmployeeId, kase.Employee.GymId,
                new
                {
                    target = kase.Employee.FullName,
                    detail = $"Exit interview and clearance completed. Moved to Former Employees (Reason: {kase.Reason})",
                },
                cancellationToken);
            await TerminateEmployeeAsync(actor, kase,
                $"Exit interview and clearance completed. Separation finalized (Reason: {kase.Reason})",
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse
            {
                Message = $"Clearance completed — {kase.Employee.FullName} moved to Former Employees.",
            };
        }

        // ==================================================================
        // Shared case-creation core (T2 / E19 / Offboard action-request approve)
        // ==================================================================

        public async Task<int> CreateOffboardingCaseAsync(int? actorUserId, int employeeId, DateOnly lastDay, string reason, string? notes, string separationType, string initialStatus, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var employee = await _unitOfWork.GetRepository<Employee, int>().GetByIdAsync(employeeId, cancellationToken)
                ?? throw new NotFoundException("Employee not found.");
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "employees.offboard", employee.GymId, cancellationToken);

            var open = (await _unitOfWork.GetRepository<OffboardingCase, int>()
                .GetAllAsync(new EmployeeActiveSeparationsSpec(employeeId), cancellationToken)).ToList();
            if (open.Count > 0)
            {
                throw new BadRequestException("This employee already has an exit in progress.");
            }

            var kase = new OffboardingCase
            {
                EmployeeId = employeeId,
                LastWorkingDate = lastDay,
                Reason = reason,
                Status = initialStatus,
                SeparationType = separationType,
                InitiatedBy = actor.Id,
                InitiatedAt = DateTime.UtcNow,
                Notes = HrPortalHelpers.NullIfBlank(notes),
            };

            var order = 0;
            foreach (var label in ExitChecklistLabels)
            {
                kase.ChecklistItems.Add(new OffboardingChecklistItem
                {
                    Title = label,
                    SortOrder = order++,
                    IsCompleted = false,
                });
            }

            await _unitOfWork.GetRepository<OffboardingCase, int>().AddAsync(kase, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return kase.Id;
        }

        // ------------------------------------------------------------------
        // Shared plumbing
        // ------------------------------------------------------------------

        /// <summary>Load for T3–T6: 404 on a missing case, employees.offboard on its gym.</summary>
        private async Task<OffboardingCase> LoadForActionAsync(User actor, int separationId, CancellationToken cancellationToken)
        {
            var kase = await _unitOfWork.GetRepository<OffboardingCase, int>()
                .GetByIdAsync(new SeparationByIdSpec(separationId), cancellationToken)
                ?? throw new NotFoundException("Separation not found.");
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "employees.offboard", kase.Employee.GymId, cancellationToken);
            return kase;
        }

        /// <summary>A finished case cannot be re-opened by the interview/clearance steps.</summary>
        private static void EnsureClearancePending(OffboardingCase kase)
        {
            if (kase.Status == "Cancelled")
            {
                throw new BadRequestException("This separation was cancelled.");
            }

            if (kase.ClearanceCompleted || kase.Status == "Completed")
            {
                throw new BadRequestException("This exit is already complete.");
            }
        }

        /// <summary>Timestamps come from the browser; normalise before persisting.</summary>
        private static DateTime NormalizeUtc(DateTime value) =>
            value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
                : value.ToUniversalTime();

        /// <summary>Ticks one seeded exit task by label (no-op when already done).</summary>
        private static void TickChecklist(OffboardingCase kase, string label, int actorId)
        {
            var item = kase.ChecklistItems.FirstOrDefault(i => string.Equals(i.Title, label, StringComparison.OrdinalIgnoreCase));
            if (item is null || item.IsCompleted)
            {
                return;
            }

            item.IsCompleted = true;
            item.CompletedAt = DateTime.UtcNow;
            item.CompletedBy = actorId;
        }

        private async Task<int[]> ResolveScopeAsync(User actor, string? gymRaw, CancellationToken cancellationToken)
        {
            var gymFilter = await HrPortalHelpers.ResolveGymFilterAsync(_unitOfWork, gymRaw, cancellationToken);
            return await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, gymFilter, cancellationToken);
        }

        private async Task<List<SeparationItem>> MapItemsAsync(IEnumerable<OffboardingCase> rows, bool withLeaveTaken, CancellationToken cancellationToken)
        {
            var materialized = rows as IReadOnlyList<OffboardingCase> ?? rows.ToList();
            Dictionary<int, decimal> leaveByEmployee = [];
            if (withLeaveTaken && materialized.Count > 0)
            {
                var employeeIds = materialized.Select(r => r.EmployeeId).Distinct().ToArray();
                var balances = await _unitOfWork.GetRepository<LeaveBalance, int>()
                    .GetAllAsync(new LeaveBalancesForEmployeesSpec(employeeIds, DateTime.UtcNow.Year), cancellationToken);
                leaveByEmployee = balances.GroupBy(b => b.EmployeeId).ToDictionary(g => g.Key, g => g.Sum(b => b.UsedDays));
            }

            return materialized.Select(c => MapItem(c, leaveByEmployee.GetValueOrDefault(c.EmployeeId))).ToList();
        }

        private static SeparationItem MapItem(OffboardingCase c, decimal leaveTaken)
        {
            var ordered = c.ChecklistItems.OrderBy(i => i.SortOrder).ToList();
            var done = ordered.Count(i => i.IsCompleted);

            return new SeparationItem
            {
                Id = c.Id,
                Employee = c.Employee.FullName,
                EmployeeId = c.EmployeeId,
                EmployeeNumber = c.Employee.EmployeeNumber,
                Position = c.Employee.Position?.Title,
                Gym = c.Employee.Gym.Name,
                LastDay = c.LastWorkingDate,
                HireDate = c.Employee.HireDate,
                TerminationDate = c.CompletedAt is null ? null : DateOnly.FromDateTime(c.CompletedAt.Value),
                Reason = c.Reason,
                Notes = c.Notes,
                RequestedBy = EventsService.RequesterRoleLabel(c.InitiatedByUser.UserType),
                RequestedByUser = HrPortalHelpers.DisplayName(c.InitiatedByUser),
                SubmittedDate = c.InitiatedAt,
                Status = c.Status,
                SeparationType = c.SeparationType,
                Progress = ordered.Count > 0 ? (int)Math.Round(done * 100d / ordered.Count) : 0,
                Checklist = ordered.Select(i => new ChecklistEntry(i.Title, i.IsCompleted)).ToList(),
                Verdict = BuildVerdict(c),
                LeaveTaken = leaveTaken,
                ApprovalStatus = c.ApprovalStatus,
                ApprovedBy = c.ApprovedByUser is null ? null : HrPortalHelpers.DisplayName(c.ApprovedByUser),
                ApprovedAt = c.ApprovedAt,
                ApprovalNote = c.ApprovalNote,
                ExitInterviewStatus = c.ExitInterviewStatus,
                ExitInterviewScheduledAt = c.ExitInterviewScheduledAt,
                ExitInterviewCompletedAt = c.ExitInterviewCompletedAt,
                ExitInterview = new ExitInterviewDetails
                {
                    Interviewer = c.Interviewer,
                    InterviewDate = c.InterviewDate,
                    ReasonForLeaving = c.ReasonForLeaving,
                    WhatLikedMost = c.WhatLikedMost,
                    WhatToImprove = c.WhatToImprove,
                    JobSatisfaction = c.JobSatisfaction,
                    ManagementRating = c.ManagementRating,
                    WorkEnvironmentRating = c.WorkEnvironmentRating,
                    CompensationRating = c.CompensationRating,
                    WouldRecommend = c.WouldRecommend,
                    Notes = c.InterviewNotes,
                    RehireEligible = c.RehireStatus is null ? null : c.RehireStatus == "Eligible",
                    RehireNote = c.RehireNote,
                },
                Clearance = new SeparationClearance
                {
                    UniformReturned = c.UniformReturned,
                    AssetsReturned = c.AssetsReturned,
                    AccessRevoked = c.AccessRevoked,
                    FinalSettlementCompleted = c.FinalSettlementCompleted,
                    Completed = c.ClearanceCompleted,
                    CompletedAt = c.ClearanceCompletedAt,
                    Notes = c.ClearanceNotes,
                    SettlementDirection = c.SettlementDirection,
                    SettlementAmount = c.SettlementAmount,
                },
                Blacklisted = c.Blacklisted,
                BlacklistReason = c.BlacklistReason,
            };
        }

        private static SeparationVerdict? BuildVerdict(OffboardingCase c)
        {
            if (c.FinalReason is null && c.SettlementDirection is null && c.RehireStatus is null)
            {
                return null;
            }

            return new SeparationVerdict
            {
                FinalReason = c.FinalReason,
                Settlement = c.SettlementDirection is null
                    ? null
                    : new SeparationSettlement
                    {
                        Direction = c.SettlementDirection,
                        Amount = c.SettlementAmount ?? 0,
                        Note = c.SettlementNote,
                    },
                Rehire = c.RehireStatus is null
                    ? null
                    : new SeparationRehire { Status = c.RehireStatus, Note = c.RehireNote },
            };
        }

        /// <summary>
        /// Archives the employee for a completed separation and cuts every live
        /// session. Idempotent: an already-Terminated employee still gets their
        /// account deactivated and refresh tokens revoked.
        /// </summary>
        private async Task<Employee> TerminateEmployeeAsync(
            User actor, OffboardingCase kase, string historyReason, CancellationToken cancellationToken)
        {
            var employee = await _unitOfWork.GetRepository<Employee, int>().GetByIdAsync(kase.EmployeeId, cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            if (employee.Status != EmployeeStatus.Terminated)
            {
                var entry = EmployeeService.NewHistory(
                    employee.Id,
                    DateOnly.FromDateTime(DateTime.UtcNow),
                    EmploymentChangeType.Offboard,
                    EmployeeService.StatusDisplay(employee.Status),
                    EmployeeService.StatusDisplay(EmployeeStatus.Terminated),
                    historyReason,
                    actor.Id);
                employee.Status = EmployeeStatus.Terminated;
                _unitOfWork.GetRepository<Employee, int>().Update(employee);
                await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
            }

            await _userSessions.TerminateAccessAsync(employee.UserId, cancellationToken);
            return employee;
        }

        /// <summary>Parks the employee at a new standing with an employment-history row.</summary>
        private async Task MoveEmployeeStandingAsync(User actor, Employee employee, EmployeeStatus target, EmploymentChangeType changeType, string historyReason, CancellationToken cancellationToken)
        {
            if (employee.Status == target)
            {
                return;
            }

            var entry = EmployeeService.NewHistory(
                employee.Id,
                DateOnly.FromDateTime(DateTime.UtcNow),
                changeType,
                EmployeeService.StatusDisplay(employee.Status),
                EmployeeService.StatusDisplay(target),
                historyReason,
                actor.Id);

            employee.Status = target;
            _unitOfWork.GetRepository<Employee, int>().Update(employee);
            await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        /// <summary>T2's closed reason vocabulary (the mock's select options).</summary>
        private static string CanonicalizeTerminationReason(string reason)
        {
            var clean = HrPortalHelpers.NullIfBlank(reason)
                ?? throw new BadRequestException("A reason is required.");
            var normalized = NormalizeKey(clean);
            return TerminationReasons.FirstOrDefault(r => NormalizeKey(r) == normalized)
                ?? throw new BadRequestException($"Invalid termination reason. Choose one of: {string.Join(", ", TerminationReasons)}.");
        }

        /// <summary>E19: explicit type wins; otherwise derive it from the reason (mock vocabulary).</summary>
        internal static string ResolveSeparationType(string? separationType, string reason)
        {
            var clean = HrPortalHelpers.NullIfBlank(separationType);
            if (clean is null)
            {
                return reason.Contains("Termination", StringComparison.OrdinalIgnoreCase) ? "Termination" : "Resignation";
            }

            if (string.Equals(clean, "Resignation", StringComparison.OrdinalIgnoreCase))
            {
                return "Resignation";
            }

            if (string.Equals(clean, "Termination", StringComparison.OrdinalIgnoreCase))
            {
                return "Termination";
            }

            throw new BadRequestException("Separation type must be \"Resignation\" or \"Termination\".");
        }

        private static string? MatchVocabulary(string[] vocabulary, string? value)
        {
            var clean = HrPortalHelpers.NullIfBlank(value);
            return clean is null
                ? null
                : vocabulary.FirstOrDefault(v => string.Equals(v, clean, StringComparison.OrdinalIgnoreCase));
        }

        private static string NormalizeKey(string value) =>
            value.Trim().ToLowerInvariant().Replace(" ", string.Empty);

        private async Task AuditAsync(User actor, string action, string entityType, int entityId, int? gymId, object values, CancellationToken cancellationToken) =>
            await _unitOfWork.GetRepository<AuditLog, int>().AddAsync(new AuditLog
            {
                UserId = actor.Id,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                GymId = gymId,
                NewValues = JsonSerializer.Serialize(values, JsonStore),
            }, cancellationToken);
    }
}
