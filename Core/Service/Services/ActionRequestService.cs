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

namespace Service.Services
{
    /// <summary>
    /// Escalated employee action requests (api-spec-from-ui.md §9.4 / D6–D8): the
    /// Events page's Escalated tab. Reading requires `events.view` OR any of the
    /// five ACTION_TYPES meta permissions; each row is then filtered to the rows
    /// the actor may act on. Approve executes the proposed effect server-side
    /// (gym transfer / compensation / role assign / offboard case / import) and
    /// marks the row Approved with an audit entry; reject requires a comment and
    /// audits "{Label} Request Rejected" — both mirroring the mock's
    /// executeActionRequest / rejectActionRequest.
    /// </summary>
    public sealed class ActionRequestService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess,
        IEmployeeService _employeeService,
        ISeparationsService _separations) : IActionRequestService
    {
        /// <summary>read-allowed keys: the page key plus every ACTION_TYPES meta key.</summary>
        private static readonly string[] AnyReadKeys =
        [
            "events.view",
            "employees.transfer",
            "employees.compensation.manage",
            "employees.role.assign",
            "employees.offboard",
            "employees.bulk_import",
        ];

        private static readonly string[] ActionTypes = ["Transfer", "CompensationChange", "RoleAssign", "Offboard", "BulkImport"];

        private static readonly JsonSerializerOptions JsonStore = new(JsonSerializerDefaults.Web);

        // ==================================================================
        // GET /api/action-requests
        // ==================================================================

        public async Task<ActionRequestListResponse> GetActionRequestsAsync(int? actorUserId, ActionRequestListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await EnsureAnyPermissionAsync(actor, AnyReadKeys, cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            var scope = await ResolveScopeAsync(actor, query.Gym, cancellationToken);
            var status = HrPortalHelpers.NullIfBlank(query.Status)?.Trim().ToLowerInvariant();
            var actionType = HrPortalHelpers.NullIfBlank(query.ActionType)?.Trim().ToLowerInvariant();

            // Per-row visibility: the actor holds the row's ACTION_TYPES meta key.
            // Top Management sees everything; anyone else sees only their keys' types.
            string[]? allowedTypes = null;
            if (actor.UserType != UserType.TopManagement)
            {
                var keys = (await _userAccess.GetPermissionKeysAsync(actor.Id, cancellationToken))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                allowedTypes = ActionTypes
                    .Where(t => keys.Contains(EventsService.PermissionKeyOfActionType(t)))
                    .Select(t => t.ToLowerInvariant())
                    .ToArray();
                if (allowedTypes.Length == 0)
                {
                    return new ActionRequestListResponse { Page = page, PageSize = pageSize };
                }
            }

            var spec = new ActionRequestListSpec(scope, status, actionType, allowedTypes, 0, 0);
            var total = await _unitOfWork.GetRepository<ActionRequest, int>().CountAsync(spec, cancellationToken);
            var rows = await _unitOfWork.GetRepository<ActionRequest, int>()
                .GetAllAsync(new ActionRequestListSpec(scope, status, actionType, allowedTypes, (page - 1) * pageSize, pageSize), cancellationToken);

            return new ActionRequestListResponse
            {
                Items = rows.Select(MapItem).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        // ==================================================================
        // PUT /api/action-requests/{id}/approve
        // ==================================================================

        public async Task<ActionRequestDecisionResponse> ApproveAsync(int? actorUserId, int requestId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var request = await LoadForActionAsync(actor, requestId, cancellationToken);

            if (request.Status != "Pending")
            {
                throw new BadRequestException("This request has already been decided.");
            }

            var details = ParseDetails(request.ProposedDetailsJson);
            var employeeName = request.Employee?.FullName;
            var requestedBy = HrPortalHelpers.NullIfBlank(request.RequestedBy?.UserName) is not null
                ? HrPortalHelpers.DisplayName(request.RequestedBy!)
                : "HR";
            var auditAction = "Approved";
            var auditDetail = string.Empty;
            var auditEntityType = "ActionRequest";
            var auditEntityId = request.Id;
            int? auditGymId = request.GymId;

            switch (request.ActionType)
            {
                case "Transfer":
                {
                    var employeeId = request.EmployeeId
                        ?? throw new BadRequestException("This transfer has no employee attached.");
                    var toGymName = HrPortalHelpers.NullIfBlank(details.ToGym)
                        ?? throw new BadRequestException("This transfer is missing its destination gym.");
                    var toGym = await HrPortalHelpers.FindGymByNameAsync(_unitOfWork, toGymName, cancellationToken)
                        ?? throw new BadRequestException($"Unknown gym '{toGymName}'.");
                    var effective = details.EffectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

                    await _employeeService.TransferAsync(actor.Id, employeeId,
                        new TransferEmployeeRequest
                        {
                            ToGym = toGym.Id,
                            EffectiveDate = effective,
                            Reason = string.IsNullOrWhiteSpace(request.Justification)
                                ? "Approved from the Escalated tab"
                                : request.Justification,
                        },
                        cancellationToken);

                    auditAction = "Gym Transfer Executed";
                    auditDetail = $"{details.FromGym ?? "—"} → {toGym.Name} (Effective {FormatDate(effective)}). Approved request from {requestedBy}.";
                    auditEntityType = nameof(Employee);
                    auditEntityId = employeeId;
                    auditGymId = toGym.Id;
                    break;
                }

                case "CompensationChange":
                {
                    var employeeId = request.EmployeeId
                        ?? throw new BadRequestException("This change has no employee attached.");
                    var newSalary = details.NewSalary
                        ?? throw new BadRequestException("A proposed salary is required.");
                    var effective = details.EffectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

                    await _employeeService.AddCompensationAsync(actor.Id, employeeId,
                        new CompensationRequest { Salary = newSalary, EffectiveDate = effective },
                        cancellationToken);

                    auditAction = "Compensation Updated";
                    auditDetail = $"Salary EGP {(details.CurrentSalary ?? 0).ToString("N0", CultureInfo.InvariantCulture)} → EGP {newSalary.ToString("N0", CultureInfo.InvariantCulture)} (Effective {FormatDate(effective)}). Approved request from {requestedBy}.";
                    auditEntityType = nameof(Employee);
                    auditEntityId = employeeId;
                    break;
                }

                case "RoleAssign":
                {
                    var employeeId = request.EmployeeId
                        ?? throw new BadRequestException("This change has no employee attached.");
                    var systemRole = HrPortalHelpers.NullIfBlank(details.SystemRole)
                        ?? throw new BadRequestException("A system role is required.");

                    await _employeeService.ChangeEmployeeRoleAsync(actor.Id, employeeId,
                        new RoleChangeRequest { SystemRole = systemRole },
                        cancellationToken);

                    auditAction = "System Role Assigned";
                    auditDetail = $"System role set to {systemRole}. Approved request from {requestedBy}.";
                    auditEntityType = nameof(Employee);
                    auditEntityId = employeeId;
                    break;
                }

                case "Offboard":
                {
                    var employeeId = request.EmployeeId
                        ?? throw new BadRequestException("This offboarding has no employee attached.");
                    var lastDay = details.LastDay
                        ?? throw new BadRequestException("A last working day is required.");
                    var reason = HrPortalHelpers.NullIfBlank(details.Reason)
                        ?? throw new BadRequestException("A reason is required.");
                    var separationType = SeparationsService.ResolveSeparationType(null, reason);

                    await _separations.CreateOffboardingCaseAsync(
                        actorUserId, employeeId, lastDay, reason, notes: null, separationType, "Notice Period", cancellationToken);

                    // The mock parks the employee in Notice Period as the escalation executes.
                    var employee = await _unitOfWork.GetRepository<Employee, int>().GetByIdAsync(employeeId, cancellationToken)
                        ?? throw new NotFoundException("Employee not found.");
                    if (employee.Status != EmployeeStatus.NoticePeriod)
                    {
                        var entry = EmployeeService.NewHistory(
                            employee.Id,
                            DateOnly.FromDateTime(DateTime.UtcNow),
                            EmploymentChangeType.StatusChange,
                            EmployeeService.StatusDisplay(employee.Status),
                            EmployeeService.StatusDisplay(EmployeeStatus.NoticePeriod),
                            $"Offboarding escalation approved (Last Day: {FormatDate(lastDay)})",
                            actor.Id);
                        employee.Status = EmployeeStatus.NoticePeriod;
                        _unitOfWork.GetRepository<Employee, int>().Update(employee);
                        await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
                    }

                    auditAction = "Offboarding Initiated";
                    auditDetail = $"Approved escalation (Last Day: {FormatDate(lastDay)}, Reason: {reason}). Requested by {requestedBy}.";
                    auditEntityType = nameof(Employee);
                    auditEntityId = employeeId;
                    break;
                }

                case "BulkImport":
                {
                    var source = HrPortalHelpers.NullIfBlank(details.Source)
                        ?? throw new BadRequestException("A source is required for a bulk import.");

                    // The mock stores a file reference ("new_hires_sep2026.csv — 12 rows").
                    // When the source actually carries CSV content, run it through the
                    // import pipeline; a plain reference just audits (the real import
                    // stays on POST /api/employees/bulk-import).
                    if (source.Contains('\n') && source.Contains(','))
                    {
                        await _employeeService.BulkImportAsync(actorUserId, source, cancellationToken);
                    }

                    auditAction = "Bulk Import Executed";
                    auditDetail = $"{source}. Approved request from {requestedBy}.";
                    break;
                }

                default:
                    throw new BadRequestException($"Unknown action type '{request.ActionType}'.");
            }

            var reviewedAt = DateTime.UtcNow;
            request.Status = "Approved";
            request.ReviewedById = actor.Id;
            request.ReviewedDate = reviewedAt;
            request.ReviewComment = null;
            _unitOfWork.GetRepository<ActionRequest, int>().Update(request);

            await AuditAsync(actor, auditAction, auditEntityType, auditEntityId, auditGymId,
                new { target = employeeName, detail = auditDetail }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ActionRequestDecisionResponse
            {
                Data = new ActionRequestDecisionData
                {
                    Id = request.Id,
                    Status = "Approved",
                    ReviewedBy = HrPortalHelpers.DisplayName(actor),
                    ReviewedDate = reviewedAt,
                    Executed = true,
                },
            };
        }

        // ==================================================================
        // PUT /api/action-requests/{id}/reject
        // ==================================================================

        public async Task<ActionRequestDecisionResponse> RejectAsync(int? actorUserId, int requestId, ActionRequestRejectRequest body, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var request = await LoadForActionAsync(actor, requestId, cancellationToken);

            if (request.Status != "Pending")
            {
                throw new BadRequestException("This request has already been decided.");
            }

            var comment = HrPortalHelpers.NullIfBlank(body.Comment)
                ?? throw new BadRequestException("A comment is required.");

            var reviewedAt = DateTime.UtcNow;
            request.Status = "Rejected";
            request.ReviewedById = actor.Id;
            request.ReviewedDate = reviewedAt;
            request.ReviewComment = comment;
            _unitOfWork.GetRepository<ActionRequest, int>().Update(request);

            // Rejecting an Offboard escalation while the employee is parked in Notice
            // Period and no real offboarding case exists must release them back to
            // Active — the escalation never executed, so the standing cannot stick.
            if (request.ActionType == "Offboard" && request.EmployeeId is { } rejectedEmployeeId)
            {
                var employee = await _unitOfWork.GetRepository<Employee, int>()
                    .GetByIdAsync(rejectedEmployeeId, cancellationToken);
                if (employee is not null
                    && employee.Status == EmployeeStatus.NoticePeriod
                    && !await HasLiveOffboardingCaseAsync(rejectedEmployeeId, cancellationToken))
                {
                    employee.Status = EmployeeStatus.Active;
                    _unitOfWork.GetRepository<Employee, int>().Update(employee);
                    await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(
                        EmployeeService.NewHistory(
                            employee.Id,
                            DateOnly.FromDateTime(DateTime.UtcNow),
                            EmploymentChangeType.StatusChange,
                            EmployeeService.StatusDisplay(EmployeeStatus.NoticePeriod),
                            EmployeeService.StatusDisplay(EmployeeStatus.Active),
                            "Offboarding escalation rejected — employment continues.",
                            actor.Id),
                        cancellationToken);
                }
            }

            await AuditAsync(actor, $"{EventsService.ActionTypeLabel(request.ActionType)} Request Rejected", "ActionRequest", request.Id, request.GymId,
                new { target = request.Employee?.FullName, detail = $"{ActionSummary(request)}. Comment: {comment}" }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ActionRequestDecisionResponse
            {
                Data = new ActionRequestDecisionData
                {
                    Id = request.Id,
                    Status = "Rejected",
                    ReviewedBy = HrPortalHelpers.DisplayName(actor),
                    ReviewedDate = reviewedAt,
                    Executed = false,
                    ReviewComment = comment,
                },
            };
        }

        // ------------------------------------------------------------------
        // Shared plumbing
        // ------------------------------------------------------------------

        /// <summary>
        /// True while the employee still has an offboarding case that is neither
        /// completed nor cancelled — i.e. the Notice Period standing is owned by the
        /// separations module and must not be released by a rejection here.
        /// </summary>
        private async Task<bool> HasLiveOffboardingCaseAsync(int employeeId, CancellationToken cancellationToken)
        {
            var cases = await _unitOfWork.GetRepository<OffboardingCase, int>()
                .GetAllAsync(new OffboardingCasesByEmployeesSpec([employeeId]), cancellationToken);
            return cases.Any(c => c.Status is not ("Completed" or "Cancelled"));
        }

        /// <summary>read gate: events.view OR any ACTION_TYPES meta key (the mock's _canReadAction).</summary>
        private async Task EnsureAnyPermissionAsync(User actor, string[] keys, CancellationToken cancellationToken)
        {
            foreach (var key in keys)
            {
                try
                {
                    await _accessControl.EnsurePermissionAsync(actor.Id, key, cancellationToken);
                    return;
                }
                catch (UnAuthorizedException)
                {
                    // try the next acceptable key
                }
            }

            throw new UnAuthorizedException("You do not have permission to perform this action.");
        }

        /// <summary>Load for approve/reject: 404 on a missing row, its meta key on its gym.</summary>
        private async Task<ActionRequest> LoadForActionAsync(User actor, int requestId, CancellationToken cancellationToken)
        {
            var request = await _unitOfWork.GetRepository<ActionRequest, int>()
                .GetByIdAsync(new ActionRequestByIdSpec(requestId), cancellationToken)
                ?? throw new NotFoundException("Action request not found.");
            await _accessControl.EnsurePermissionForGymAsync(
                actor.Id, EventsService.PermissionKeyOfActionType(request.ActionType), request.GymId, cancellationToken);
            return request;
        }

        private async Task<int[]> ResolveScopeAsync(User actor, string? gymRaw, CancellationToken cancellationToken)
        {
            var gymFilter = await HrPortalHelpers.ResolveGymFilterAsync(_unitOfWork, gymRaw, cancellationToken);
            return await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, gymFilter, cancellationToken);
        }

        private static ActionRequestItem MapItem(ActionRequest request) => new()
        {
            Id = request.Id,
            EmployeeId = request.EmployeeId,
            Employee = request.Employee?.FullName,
            Position = request.Employee?.Position?.Title,
            ActionType = request.ActionType,
            ProposedDetails = ParseDetails(request.ProposedDetailsJson),
            Justification = request.Justification,
            RequestedById = request.RequestedById,
            RequestedBy = request.RequestedBy is null ? null : HrPortalHelpers.DisplayName(request.RequestedBy),
            Status = request.Status,
            SubmittedDate = request.SubmittedDate,
            ReviewedById = request.ReviewedById,
            ReviewedBy = request.ReviewedBy is null ? null : HrPortalHelpers.DisplayName(request.ReviewedBy),
            ReviewedDate = request.ReviewedDate,
            ReviewComment = request.ReviewComment,
        };

        /// <summary>The mock's actionSummary one-liner (used for reject audit details).</summary>
        private static string ActionSummary(ActionRequest request)
        {
            var details = ParseDetails(request.ProposedDetailsJson);
            return request.ActionType switch
            {
                "Transfer" => $"{details.FromGym ?? "—"} → {details.ToGym ?? "—"} · Effective {FormatDate(details.EffectiveDate)}",
                "CompensationChange" => $"Salary EGP {(details.CurrentSalary ?? 0).ToString("N0", CultureInfo.InvariantCulture)} → EGP {(details.NewSalary ?? 0).ToString("N0", CultureInfo.InvariantCulture)} · Effective {FormatDate(details.EffectiveDate)}",
                "RoleAssign" => $"System role → {details.SystemRole ?? "None (Employee)"}",
                "Offboard" => $"Last day {FormatDate(details.LastDay)} · Reason: {details.Reason ?? "—"}",
                "BulkImport" => details.Source ?? "Records queued for import",
                _ => string.Empty,
            };
        }

        private static ActionRequestProposedDetails ParseDetails(string? json)
        {
            try
            {
                return string.IsNullOrWhiteSpace(json)
                    ? new ActionRequestProposedDetails()
                    : JsonSerializer.Deserialize<ActionRequestProposedDetails>(json, JsonStore) ?? new ActionRequestProposedDetails();
            }
            catch (JsonException)
            {
                return new ActionRequestProposedDetails();
            }
        }

        /// <summary>≈ the mock's formatDate ("Sep 9, 2026").</summary>
        private static string FormatDate(DateOnly? date) =>
            date?.ToString("MMM d, yyyy", CultureInfo.InvariantCulture) ?? "—";

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
