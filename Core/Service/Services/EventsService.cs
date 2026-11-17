using System.Globalization;
using System.Text.Json;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Events;

namespace Service.Services
{
    /// <summary>
    /// HR action queue (api-spec-from-ui.md §5.6). The queue is DERIVED on every
    /// read from the eight pending/expiring sources (expiring documents & contracts,
    /// requests in HR review, ongoing separations, pending transfer escalations,
    /// pending vacancy requests, unlocked payroll runs) and materialized into
    /// Events rows — sync-on-read inserts new cards, refreshes changed ones, prunes
    /// cards whose source disappeared, and preserves the resolved overlay in
    /// between. Visibility = the actor's gym scope AND the per-type permission key
    /// (the same key the card's actions require); hidden counts what the scope
    /// matched but the permissions filtered out.
    /// </summary>
    public sealed class EventsService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess,
        IEmployeeService _employeeService) : IEventsService
    {
        /// <summary>Doc/contract derivation window — matches the mock's low-urgency tail.</summary>
        private const int ExpiryWindowDays = 45;

        private sealed record TypeMeta(EventType Type, string TypeWord, string Tab);

        private static readonly TypeMeta[] Metas =
        [
            new(EventType.DocumentExpiry, "Document Expiry", "documents"),
            new(EventType.ContractExpiry, "Contract Expiry", "documents"),
            new(EventType.RequestPendingHRReview, "PendingHRReview", "requests"),
            new(EventType.ResignationFollowUp, "Resignation", "offboarding"),
            new(EventType.Termination, "Termination", "offboarding"),
            new(EventType.TransferRequest, "TransferRequest", "transfers"),
            new(EventType.VacancyRequestPending, "PendingVacancyRequest", "vacancies"),
            new(EventType.PayrollApproval, "PayrollApproval", "payroll"),
        ];

        private static TypeMeta MetaOf(EventType type) => Array.Find(Metas, m => m.Type == type)!;

        /// <summary>The permission key that governs visibility AND actions for each event kind.</summary>
        internal static string PermissionOf(EventType type) => type switch
        {
            EventType.DocumentExpiry => "employees.documents.manage",
            EventType.ContractExpiry => "employees.contract.manage",
            EventType.RequestPendingHRReview => "requests.approve",
            EventType.ResignationFollowUp or EventType.Termination => "employees.offboard",
            EventType.TransferRequest => "employees.transfer",
            EventType.VacancyRequestPending => "recruitment.vacancy_request.approve",
            EventType.PayrollApproval => "payroll.approve",
            _ => "events.view",
        };

        private sealed record DerivedEvent(
            EventType Type, string EntityType, int EntityId, int GymId,
            string Title, string Description, string Urgency, DateTime DueDate);

        private static readonly JsonSerializerOptions JsonStore = new(JsonSerializerDefaults.Web);

        private sealed class TransferDetails
        {
            public string? FromGym { get; set; }
            public string? ToGym { get; set; }
            public DateOnly? EffectiveDate { get; set; }
        }

        // ==================================================================
        // GET /api/events
        // ==================================================================

        public async Task<EventListResponse> GetEventsAsync(int? actorUserId, EventListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "events.view", cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);

            var (rows, scope, keys) = await PrepareQueueAsync(actor, query.Gym, cancellationToken);
            bool InScope(Event e) => scope.Length == 0 || scope.Contains(e.GymId);
            bool Holds(Event e) => keys is null || keys.Contains(PermissionOf(e.Type));

            var typeFilter = ParseTypeFilter(query.Type);
            var resolvedWanted = query.Resolved == true ||
                                 string.Equals(query.Status?.Trim(), "Resolved", StringComparison.OrdinalIgnoreCase);
            var urgency = HrPortalHelpers.NullIfBlank(query.Urgency)?.ToLowerInvariant();

            // "N items hidden by your permissions" — global within the actor's scope
            // (the mock computes it over every event, not just the current tab).
            var hidden = rows.Count(r => InScope(r) && !Holds(r));

            var visible = rows
                .Where(InScope)
                .Where(r => r.Status == (resolvedWanted ? EventStatus.Resolved : EventStatus.Open))
                .Where(r => typeFilter is null || typeFilter.Contains(r.Type))
                .Where(r => urgency is null || string.Equals(r.Urgency, urgency, StringComparison.OrdinalIgnoreCase))
                .Where(Holds)
                .OrderBy(r => r.DueDate ?? DateTime.MaxValue)
                .ThenBy(r => r.Id)
                .ToList();

            var total = visible.Count;
            var pageRows = visible.Skip((page - 1) * pageSize).Take(pageSize).ToList();

            return new EventListResponse
            {
                Items = await BuildItemsAsync(pageRows, cancellationToken),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
                Hidden = hidden,
            };
        }

        // ==================================================================
        // GET /api/events/counts
        // ==================================================================

        public async Task<EventCountsDataResponse> GetCountsAsync(int? actorUserId, string? gym, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "events.view", cancellationToken);

            var (rows, scope, keys) = await PrepareQueueAsync(actor, gym, cancellationToken);
            bool InScope(Event e) => scope.Length == 0 || scope.Contains(e.GymId);
            bool Holds(Event e) => keys is null || keys.Contains(PermissionOf(e.Type));

            var visible = rows.Where(InScope).Where(Holds).ToList();
            EventCountGroup GroupFor(params EventType[] types) => CountGroup(visible.Where(r => types.Contains(r.Type)));

            var escalations = (await _unitOfWork.GetRepository<ActionRequest, int>()
                .GetAllAsync(new ActionRequestListSpec(scope, "pending", null, null, 0, 0), cancellationToken))
                .Where(a => keys is null || keys.Contains(PermissionKeyOfActionType(a.ActionType)))
                .ToList();

            return new EventCountsDataResponse
            {
                Data = new EventCountsResponse
                {
                    Documents = GroupFor(EventType.DocumentExpiry, EventType.ContractExpiry),
                    Requests = GroupFor(EventType.RequestPendingHRReview),
                    Offboarding = GroupFor(EventType.ResignationFollowUp, EventType.Termination),
                    Transfers = GroupFor(EventType.TransferRequest),
                    Vacancies = GroupFor(EventType.VacancyRequestPending),
                    Payroll = GroupFor(EventType.PayrollApproval),
                    Escalations = new EventCountGroup { Open = escalations.Count },
                },
            };
        }

        private static EventCountGroup CountGroup(IEnumerable<Event> rows) => new()
        {
            Open = rows.Count(r => r.Status == EventStatus.Open),
            High = rows.Count(r => r.Status == EventStatus.Open && r.Urgency == "high"),
            Resolved = rows.Count(r => r.Status == EventStatus.Resolved),
        };

        // ==================================================================
        // PUT /api/events/{id}/resolve · …/reopen
        // ==================================================================

        public async Task<EventResolveDataResponse> ResolveAsync(int? actorUserId, int eventId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var row = await LoadRowForActionAsync(actor, eventId, cancellationToken);

            if (row.Status == EventStatus.Resolved)
            {
                return new EventResolveDataResponse
                {
                    Data = new EventResolveResponse { Id = row.Id, Resolved = true, ResolvedOn = row.ResolvedAt, ResolvedBy = NameOf(row.Resolver) },
                };
            }

            row.Status = EventStatus.Resolved;
            row.ResolvedBy = actor.Id;
            row.ResolvedAt = DateTime.UtcNow;
            _unitOfWork.GetRepository<Event, int>().Update(row);

            await AuditAsync(actor, "Event Resolved", row, new { target = row.Title, detail = row.Description, type = MetaOf(row.Type).TypeWord }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EventResolveDataResponse
            {
                Data = new EventResolveResponse { Id = row.Id, Resolved = true, ResolvedOn = row.ResolvedAt, ResolvedBy = HrPortalHelpers.DisplayName(actor) },
            };
        }

        public async Task<EventResolveDataResponse> ReopenAsync(int? actorUserId, int eventId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var row = await LoadRowForActionAsync(actor, eventId, cancellationToken);

            if (row.Status == EventStatus.Open)
            {
                return new EventResolveDataResponse { Data = new EventResolveResponse { Id = row.Id, Resolved = false } };
            }

            row.Status = EventStatus.Open;
            row.ResolvedBy = null;
            row.ResolvedAt = null;
            _unitOfWork.GetRepository<Event, int>().Update(row);

            await AuditAsync(actor, "Event Reopened", row, new { target = row.Title, detail = row.Description, type = MetaOf(row.Type).TypeWord }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EventResolveDataResponse { Data = new EventResolveResponse { Id = row.Id, Resolved = false } };
        }

        // ==================================================================
        // POST /api/events/{id}/renewal-request
        // ==================================================================

        public async Task<EventRenewalDataResponse> RequestRenewalAsync(int? actorUserId, int eventId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            var row = await LoadRowForActionAsync(actor, eventId, cancellationToken);

            if (row.Type != EventType.DocumentExpiry)
            {
                throw new BadRequestException("Renewals apply to expiring documents — renew a contract through the employee's contract action.");
            }

            var document = await _unitOfWork.GetRepository<EmployeeDocument, int>().GetByIdAsync(row.EntityId, cancellationToken)
                ?? throw new NotFoundException("The expiring document no longer exists.");
            var employee = await _unitOfWork.GetRepository<Employee, int>().GetByIdAsync(document.EmployeeId, cancellationToken)
                ?? throw new NotFoundException("The employee no longer exists.");

            var label = DocTypeLabel(document.Type);
            var expiry = document.ExpiryDate?.ToString("MMM d, yyyy", CultureInfo.InvariantCulture) ?? "—";

            var notification = new Notification
            {
                UserId = employee.UserId,
                Title = "Replacement requested",
                Message = $"{employee.FullName} asked for a fresh {label} before {expiry}.",
                Type = NotificationType.ContractExpiry, // → category "Document"
                IsRead = false,
                LinkTo = "events",
                CreatedAt = DateTime.UtcNow,
            };
            await _unitOfWork.GetRepository<Notification, int>().AddAsync(notification, cancellationToken);

            await AuditAsync(actor, "Document Renewal Requested", row,
                new { target = employee.FullName, detail = $"{label} ({document.FileName}) expires {expiry}" }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EventRenewalDataResponse
            {
                Data = new EventRenewalResponse
                {
                    NotificationId = notification.Id,
                    Message = $"Renewal requested from {employee.FullName}.",
                },
            };
        }

        // ==================================================================
        // PUT /api/events/{id}/decide — transfers
        // ==================================================================

        public async Task<EventDecideDataResponse> DecideTransferAsync(int? actorUserId, int eventId, EventDecideRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);

            // Load under the row's OWN type permission (a transfer row's own key IS
            // employees.transfer) so a non-transfer row fails with the precise 400
            // below instead of a generic permission denial.
            var row = await LoadRowForActionAsync(actor, eventId, cancellationToken);

            if (row.Type != EventType.TransferRequest)
            {
                throw new BadRequestException("Only transfer tickets accept a decision — use resolve for the other queues.");
            }

            var decision = request.Decision?.Trim().ToLowerInvariant();
            if (decision is not ("approve" or "reject"))
            {
                throw new BadRequestException("Decision must be \"approve\" or \"reject\".");
            }

            var actionRequest = await _unitOfWork.GetRepository<ActionRequest, int>()
                .GetByIdAsync(new ActionRequestByIdSpec(row.EntityId), cancellationToken)
                ?? throw new NotFoundException("The underlying transfer request no longer exists.");
            if (actionRequest.Status != "Pending")
            {
                throw new BadRequestException("This request has already been decided.");
            }

            var details = ParseTransferDetails(actionRequest.ProposedDetailsJson);
            var requestedBy = actionRequest.RequestedBy is null ? null : HrPortalHelpers.DisplayName(actionRequest.RequestedBy);
            string? newGymName = null;
            int employeeId = 0;

            if (decision == "approve")
            {
                employeeId = actionRequest.EmployeeId
                    ?? throw new BadRequestException("This transfer has no employee attached.");
                var toGymName = HrPortalHelpers.NullIfBlank(details.ToGym)
                    ?? throw new BadRequestException("This transfer is missing its destination gym.");
                var toGym = await FindGymNamedAsync(toGymName, cancellationToken);
                var effective = details.EffectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

                await _employeeService.TransferAsync(actor.Id, employeeId,
                    new TransferEmployeeRequest
                    {
                        ToGym = toGym.Id,
                        EffectiveDate = effective,
                        Reason = string.IsNullOrWhiteSpace(actionRequest.Justification)
                            ? "Approved from the Events queue"
                            : actionRequest.Justification,
                    },
                    cancellationToken);

                actionRequest.Status = "Approved";
                newGymName = toGym.Name;

                await AuditAsync(actor, "Gym Transfer Executed", row,
                    new
                    {
                        target = actionRequest.Employee?.FullName,
                        detail = $"{details.FromGym ?? "—"} → {toGym.Name} (Effective {effective.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}). Approved by {(requestedBy is null ? "HR" : "HR")} from Events.",
                        employeeId,
                    },
                    cancellationToken);
            }
            else
            {
                actionRequest.Status = "Rejected";

                await AuditAsync(actor, "Transfer Request Rejected", row,
                    new { target = actionRequest.Employee?.FullName, detail = $"{details.FromGym ?? "—"} → {details.ToGym ?? "—"} rejected" },
                    cancellationToken);
            }

            actionRequest.ReviewedById = actor.Id;
            actionRequest.ReviewedDate = DateTime.UtcNow;
            actionRequest.ReviewComment = HrPortalHelpers.NullIfBlank(request.Comment);
            _unitOfWork.GetRepository<ActionRequest, int>().Update(actionRequest);

            // Resolve the card now; the next sync prunes it because the underlying
            // request is no longer Pending.
            row.Status = EventStatus.Resolved;
            row.ResolvedBy = actor.Id;
            row.ResolvedAt = DateTime.UtcNow;
            _unitOfWork.GetRepository<Event, int>().Update(row);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EventDecideDataResponse
            {
                Data = new EventDecideResponse
                {
                    Id = row.Id,
                    Resolved = true,
                    ResolvedOn = row.ResolvedAt,
                    ResolvedBy = HrPortalHelpers.DisplayName(actor),
                    Employee = decision == "approve"
                        ? new EventDecideEmployee { Id = employeeId, Gym = newGymName }
                        : null,
                },
            };
        }

        // ==================================================================
        // Shared plumbing
        // ==================================================================

        /// <summary>Derive → sync into Events rows → load the queue with gym + resolver.</summary>
        private async Task<(List<Event> Rows, int[] Scope, HashSet<string>? Keys)> PrepareQueueAsync(User actor, string? gymRaw, CancellationToken cancellationToken)
        {
            var derived = await DeriveEventsAsync(cancellationToken);
            await SyncQueueAsync(derived, cancellationToken);

            var gymFilter = await HrPortalHelpers.ResolveGymFilterAsync(_unitOfWork, gymRaw, cancellationToken);
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, gymFilter, cancellationToken);

            var keys = actor.UserType == UserType.TopManagement
                ? null
                : (await _userAccess.GetPermissionKeysAsync(actor.Id, cancellationToken))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var rows = (await _unitOfWork.GetRepository<Event, int>()
                .GetAllAsync(new EventQueueLoadSpec(), cancellationToken)).ToList();
            return (rows, scope, keys);
        }

        /// <summary>Loads a queue row and enforces its governing permission on its gym.</summary>
        private async Task<Event> LoadRowForActionAsync(User actor, int eventId, CancellationToken cancellationToken)
        {
            var row = await _unitOfWork.GetRepository<Event, int>().GetByIdAsync(new EventByIdSpec(eventId), cancellationToken)
                ?? throw new NotFoundException("Event not found.");
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, PermissionOf(row.Type), row.GymId, cancellationToken);
            return row;
        }

        /// <summary>Comma-separated tab type words ("Document Expiry,Contract Expiry"); null = no filter; unknown tokens match nothing.</summary>
        private static HashSet<EventType>? ParseTypeFilter(string? raw)
        {
            var clean = HrPortalHelpers.NullIfBlank(raw);
            if (clean is null)
            {
                return null;
            }

            var lookup = new Dictionary<string, EventType>(StringComparer.Ordinal);
            foreach (var meta in Metas)
            {
                lookup[NormalizeTypeToken(meta.TypeWord)] = meta.Type;
                lookup[NormalizeTypeToken(meta.Type.ToString())] = meta.Type;
            }

            var set = new HashSet<EventType>();
            foreach (var token in clean.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (lookup.TryGetValue(NormalizeTypeToken(token), out var type))
                {
                    set.Add(type);
                }
            }

            return set;
        }

        private static string NormalizeTypeToken(string value) =>
            value.Trim().ToLowerInvariant().Replace(" ", string.Empty).Replace("_", string.Empty).Replace("-", string.Empty);

        // ------------------------------------------------------------------
        // Derivation — the eight sources
        // ------------------------------------------------------------------

        private async Task<List<DerivedEvent>> DeriveEventsAsync(CancellationToken cancellationToken)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var window = today.AddDays(ExpiryWindowDays);
            var derived = new List<DerivedEvent>();

            // --- Expiring documents (Document Expiry)
            foreach (var document in await _unitOfWork.GetRepository<EmployeeDocument, int>()
                         .GetAllAsync(new ExpiringEmployeeDocumentsSpec(window), cancellationToken))
            {
                var label = DocTypeLabel(document.Type);
                var daysLeft = document.ExpiryDate!.Value.DayNumber - today.DayNumber;
                derived.Add(new DerivedEvent(
                    EventType.DocumentExpiry, nameof(EmployeeDocument), document.Id, document.Employee.GymId,
                    Truncate($"{label} — {document.Employee.FullName}"),
                    ExpiryDetail(label, daysLeft),
                    UrgencyByDaysLeft(daysLeft),
                    UtcDate(document.ExpiryDate!.Value)));
            }

            // --- Expiring contracts (Contract Expiry)
            foreach (var employee in await _unitOfWork.GetRepository<Employee, int>()
                         .GetAllAsync(new ExpiringContractsSpec(window), cancellationToken))
            {
                var daysLeft = employee.ContractEndDate!.Value.DayNumber - today.DayNumber;
                derived.Add(new DerivedEvent(
                    EventType.ContractExpiry, nameof(Employee), employee.Id, employee.GymId,
                    Truncate($"Contract — {employee.FullName}"),
                    ExpiryDetail("Contract", daysLeft),
                    UrgencyByDaysLeft(daysLeft),
                    UtcDate(employee.ContractEndDate!.Value)));
            }

            // --- Requests awaiting HR (PendingHRReview)
            foreach (var request in await _unitOfWork.GetRepository<EmployeeRequest, int>()
                         .GetAllAsync(new PendingHrReviewRequestsSpec(), cancellationToken))
            {
                var forDate = request.TargetStartDate ?? request.RequestDate;
                var daysLeft = forDate.DayNumber - today.DayNumber;
                var bm = LastBranchManagerDecision(request);
                derived.Add(new DerivedEvent(
                    EventType.RequestPendingHRReview, nameof(EmployeeRequest), request.Id, request.Employee.GymId,
                    Truncate($"Request — {request.Employee.FullName} ({request.Type})"),
                    bm?.Decision == DecisionOutcome.Rejected
                        ? "BM rejected. HR final call still required."
                        : "BM approved. Awaiting HR final decision.",
                    string.Equals(request.Type, "Resignation", StringComparison.OrdinalIgnoreCase) ? "high" : UrgencyByDaysLeft(daysLeft),
                    UtcDate(forDate)));
            }

            // --- Ongoing separations (Resignation | Termination)
            foreach (var kase in await _unitOfWork.GetRepository<OffboardingCase, int>()
                         .GetAllAsync(new ActiveSeparationsSpec(), cancellationToken))
            {
                var daysLeft = kase.LastWorkingDate.DayNumber - today.DayNumber;
                var done = kase.ChecklistItems.Count(i => i.IsCompleted);
                var total = kase.ChecklistItems.Count;
                derived.Add(new DerivedEvent(
                    kase.SeparationType == "Termination" ? EventType.Termination : EventType.ResignationFollowUp,
                    nameof(OffboardingCase), kase.Id, kase.Employee.GymId,
                    Truncate($"{kase.Employee.FullName} — {kase.Status}"),
                    $"Last day {kase.LastWorkingDate.ToString("MMM d", CultureInfo.InvariantCulture)}. {(total > 0 && done == total ? "Exit checklist complete." : "Exit checklist in progress.")}",
                    UrgencyByDaysLeft(daysLeft),
                    UtcDate(kase.LastWorkingDate)));
            }

            // --- Pending transfer escalations (TransferRequest)
            foreach (var action in await _unitOfWork.GetRepository<ActionRequest, int>()
                         .GetAllAsync(new PendingTransferActionRequestsSpec(), cancellationToken))
            {
                var details = ParseTransferDetails(action.ProposedDetailsJson);
                var fromName = HrPortalHelpers.NullIfBlank(details.FromGym) ?? action.Employee?.Gym?.Name ?? "—";
                var toName = HrPortalHelpers.NullIfBlank(details.ToGym);
                var effective = details.EffectiveDate ?? DateOnly.FromDateTime(action.SubmittedDate);
                var raisedBy = action.RequestedBy is null ? "HR" : HrPortalHelpers.DisplayName(action.RequestedBy);
                var employeeName = action.Employee?.FullName ?? "—";
                derived.Add(new DerivedEvent(
                    EventType.TransferRequest, nameof(ActionRequest), action.Id, action.GymId,
                    Truncate($"Transfer Request — {employeeName}"),
                    $"{raisedBy} requested moving {employeeName} from {fromName} to {toName ?? "—"}.",
                    UrgencyByDaysLeft(effective.DayNumber - today.DayNumber),
                    UtcDate(effective)));
            }

            // --- Pending vacancy requests (PendingVacancyRequest)
            foreach (var vacancy in await _unitOfWork.GetRepository<VacancyRequest, int>()
                         .GetAllAsync(new PendingVacancyRequestsSpec(), cancellationToken))
            {
                var position = vacancy.Position?.Title ?? "Position";
                var waitingDays = (int)(DateTime.UtcNow - vacancy.SubmittedDate).TotalDays;
                derived.Add(new DerivedEvent(
                    EventType.VacancyRequestPending, nameof(VacancyRequest), vacancy.Id, vacancy.GymId,
                    Truncate($"Vacancy Request — {position}"),
                    "Branch Manager request pending HR approval.",
                    waitingDays >= 14 ? "high" : waitingDays >= 7 ? "medium" : "low",
                    vacancy.SubmittedDate));
            }

            // --- Unlocked payroll runs (PayrollApproval)
            var periods = (await _unitOfWork.GetRepository<PayrollPeriod, int>()
                .GetAllAsync(new UnlockedPayrollPeriodsSpec(), cancellationToken)).ToList();
            if (periods.Count > 0)
            {
                var periodIds = periods.Select(p => p.Id).Distinct().ToArray();
                var entriesByPeriod = (await _unitOfWork.GetRepository<PayrollEntry, int>()
                        .GetAllAsync(new PayrollEntriesByPeriodsSpec(periodIds), cancellationToken))
                    .GroupBy(e => e.PayrollPeriodId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                foreach (var period in periods)
                {
                    entriesByPeriod.TryGetValue(period.Id, out var entries);
                    var daysLeft = period.EndDate.DayNumber - today.DayNumber;
                    derived.Add(new DerivedEvent(
                        EventType.PayrollApproval, nameof(PayrollPeriod), period.Id, period.GymId,
                        Truncate($"Payroll Run Awaiting Approval — {period.Gym.Name}"),
                        $"{PayrollService.PeriodLabel(period)} payroll is reconciled and ready for HR Manager sign-off.",
                        UrgencyByDaysLeft(daysLeft),
                        UtcDate(period.EndDate)));
                }
            }

            return derived;
        }

        /// <summary>
        /// Materializes the derived queue: insert new cards (Open), refresh changed
        /// fields (keeping the resolved overlay), prune cards whose source vanished.
        /// </summary>
        private async Task SyncQueueAsync(List<DerivedEvent> derived, CancellationToken cancellationToken)
        {
            var repo = _unitOfWork.GetRepository<Event, int>();
            var stored = (await repo.GetAllAsync(cancellationToken)).ToList();

            static (EventType Type, string EntityType, int EntityId) RowKeyOf(Event e) => (e.Type, e.EntityType, e.EntityId);
            static (EventType Type, string EntityType, int EntityId) DerivedKeyOf(DerivedEvent d) => (d.Type, d.EntityType, d.EntityId);

            var derivedKeys = derived.Select(DerivedKeyOf).ToHashSet();
            foreach (var stale in stored.Where(s => !derivedKeys.Contains(RowKeyOf(s))))
            {
                repo.Remove(stale);
            }

            var byKey = new Dictionary<(EventType, string, int), Event>();
            foreach (var row in stored)
            {
                byKey[RowKeyOf(row)] = row;
            }

            foreach (var d in derived)
            {
                if (byKey.TryGetValue(DerivedKeyOf(d), out var row))
                {
                    if (row.GymId != d.GymId || row.Title != d.Title || row.Description != d.Description ||
                        row.Urgency != d.Urgency || row.DueDate != d.DueDate)
                    {
                        row.GymId = d.GymId;
                        row.Title = d.Title;
                        row.Description = d.Description;
                        row.Urgency = d.Urgency;
                        row.DueDate = d.DueDate;
                        repo.Update(row);
                    }
                }
                else
                {
                    await repo.AddAsync(new Event
                    {
                        GymId = d.GymId,
                        Type = d.Type,
                        EntityType = d.EntityType,
                        EntityId = d.EntityId,
                        Title = d.Title,
                        Description = d.Description,
                        Status = EventStatus.Open,
                        Urgency = d.Urgency,
                        DueDate = d.DueDate,
                    }, cancellationToken);
                }
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ------------------------------------------------------------------
        // Page payloads
        // ------------------------------------------------------------------

        private async Task<List<EventItem>> BuildItemsAsync(List<Event> rows, CancellationToken cancellationToken)
        {
            var items = new List<EventItem>(rows.Count);
            foreach (var row in rows)
            {
                var meta = MetaOf(row.Type);
                items.Add(new EventItem
                {
                    Id = row.Id,
                    Type = meta.TypeWord,
                    Tab = meta.Tab,
                    Title = row.Title,
                    Date = row.DueDate,
                    Urgency = row.Urgency,
                    Branch = row.Gym?.Name,
                    Detail = row.Description,
                    Permission = PermissionOf(row.Type),
                    Resolved = row.Status == EventStatus.Resolved,
                    ResolvedOn = row.ResolvedAt,
                    ResolvedBy = NameOf(row.Resolver),
                });
            }

            var byRowId = items.ToDictionary(i => i.Id);
            int[] IdsOf(EventType type) => rows.Where(r => r.Type == type).Select(r => r.EntityId).Distinct().ToArray();

            // Documents
            var documentRows = rows.Where(r => r.Type == EventType.DocumentExpiry).ToList();
            if (documentRows.Count > 0)
            {
                var documents = (await _unitOfWork.GetRepository<EmployeeDocument, int>()
                        .GetAllAsync(new EmployeeDocumentsByIdsSpec(IdsOf(EventType.DocumentExpiry)), cancellationToken))
                    .ToDictionary(d => d.Id);
                foreach (var row in documentRows)
                {
                    if (!documents.TryGetValue(row.EntityId, out var document))
                    {
                        continue;
                    }

                    var item = byRowId[row.Id];
                    item.Employee = document.Employee.FullName;
                    item.EmployeeId = document.EmployeeId;
                    item.DocType = DocTypeLabel(document.Type);
                    item.DocNo = document.FileName;
                    item.ExpiresOn = document.ExpiryDate;
                    item.EditableByEmployee = document.EmployeeEditable;
                    item.RenewalPath = document.EmployeeEditable
                        ? "Employee uploads replacement from My Documents"
                        : "HR-only — request a fresh copy from the branch";
                }
            }

            // Contracts
            var contractRows = rows.Where(r => r.Type == EventType.ContractExpiry).ToList();
            if (contractRows.Count > 0)
            {
                var employees = (await _unitOfWork.GetRepository<Employee, int>()
                        .GetAllAsync(new ContractEmployeesByIdsSpec(IdsOf(EventType.ContractExpiry)), cancellationToken))
                    .ToDictionary(e => e.Id);
                foreach (var row in contractRows)
                {
                    if (!employees.TryGetValue(row.EntityId, out var employee))
                    {
                        continue;
                    }

                    var item = byRowId[row.Id];
                    item.Employee = employee.FullName;
                    item.EmployeeId = employee.Id;
                    item.DocType = "Employment Contract";
                    item.DocNo = employee.ContractType;
                    item.ExpiresOn = employee.ContractEndDate;
                    item.EditableByEmployee = false;
                    item.RenewalPath = "HR-only — decide renewal or separation";
                }
            }

            // Requests
            var requestRows = rows.Where(r => r.Type == EventType.RequestPendingHRReview).ToList();
            if (requestRows.Count > 0)
            {
                var requests = (await _unitOfWork.GetRepository<EmployeeRequest, int>()
                        .GetAllAsync(new HrRequestsByIdsSpec(IdsOf(EventType.RequestPendingHRReview)), cancellationToken))
                    .ToDictionary(r => r.Id);
                foreach (var row in requestRows)
                {
                    if (!requests.TryGetValue(row.EntityId, out var request))
                    {
                        continue;
                    }

                    var bm = LastBranchManagerDecision(request);
                    var item = byRowId[row.Id];
                    item.RequestId = request.Id;
                    item.Employee = request.Employee.FullName;
                    item.EmployeeId = request.EmployeeId;
                    item.RequestType = request.Type;
                    item.ForDate = request.TargetStartDate ?? request.RequestDate;
                    item.SubmittedOn = request.CreatedAt;
                    item.Reason = request.Details;
                    item.BmDecision = bm?.Decision.ToString();
                    item.BmComment = bm?.Comment;
                }
            }

            // Separations
            var separationRows = rows.Where(r => r.Type is EventType.ResignationFollowUp or EventType.Termination).ToList();
            if (separationRows.Count > 0)
            {
                var cases = (await _unitOfWork.GetRepository<OffboardingCase, int>()
                        .GetAllAsync(new SeparationsByIdsSpec(IdsOf(EventType.ResignationFollowUp).Concat(IdsOf(EventType.Termination)).Distinct().ToArray()), cancellationToken))
                    .ToDictionary(c => c.Id);
                foreach (var row in separationRows)
                {
                    if (!cases.TryGetValue(row.EntityId, out var kase))
                    {
                        continue;
                    }

                    var item = byRowId[row.Id];
                    item.Employee = kase.Employee.FullName;
                    item.EmployeeId = kase.EmployeeId;
                    item.Position = kase.Employee.Position?.Title;
                    item.LastDay = kase.LastWorkingDate;
                    item.Reason = kase.Reason;
                    item.RequestedBy = RequesterRoleLabel(kase.InitiatedByUser.UserType);
                    item.SeparationId = kase.Id;
                    item.ChecklistDone = kase.ChecklistItems.Count(i => i.IsCompleted);
                    item.ChecklistTotal = kase.ChecklistItems.Count;
                }
            }

            // Transfers
            var transferRows = rows.Where(r => r.Type == EventType.TransferRequest).ToList();
            if (transferRows.Count > 0)
            {
                var actions = (await _unitOfWork.GetRepository<ActionRequest, int>()
                        .GetAllAsync(new ActionRequestsByIdsSpec(IdsOf(EventType.TransferRequest)), cancellationToken))
                    .ToDictionary(a => a.Id);
                foreach (var row in transferRows)
                {
                    if (!actions.TryGetValue(row.EntityId, out var action))
                    {
                        continue;
                    }

                    var details = ParseTransferDetails(action.ProposedDetailsJson);
                    var item = byRowId[row.Id];
                    item.Employee = action.Employee?.FullName;
                    item.EmployeeId = action.EmployeeId;
                    item.FromGym = HrPortalHelpers.NullIfBlank(details.FromGym) ?? action.Employee?.Gym?.Name;
                    item.ToGym = details.ToGym;
                    item.EffectiveDate = details.EffectiveDate;
                    item.RaisedBy = NameOf(action.RequestedBy);
                    item.Justification = action.Justification;
                }
            }

            // Vacancy requests
            var vacancyRows = rows.Where(r => r.Type == EventType.VacancyRequestPending).ToList();
            if (vacancyRows.Count > 0)
            {
                var vacancies = (await _unitOfWork.GetRepository<VacancyRequest, int>()
                        .GetAllAsync(new VacancyRequestsByIdsSpec(IdsOf(EventType.VacancyRequestPending)), cancellationToken))
                    .ToDictionary(v => v.Id);
                foreach (var row in vacancyRows)
                {
                    if (!vacancies.TryGetValue(row.EntityId, out var vacancy))
                    {
                        continue;
                    }

                    var item = byRowId[row.Id];
                    item.VacancyRequestId = vacancy.Id;
                    item.Position = vacancy.Position?.Title;
                    item.Gym = vacancy.Gym.Name;
                    item.Headcount = vacancy.Headcount;
                    item.VrUrgency = vacancy.Urgency;
                    item.SubmittedBy = NameOf(vacancy.Requester);
                    item.SubmittedOn = vacancy.SubmittedDate;
                    item.VrReason = vacancy.Justification;
                }
            }

            // Payroll runs
            var payrollRows = rows.Where(r => r.Type == EventType.PayrollApproval).ToList();
            if (payrollRows.Count > 0)
            {
                var periodIds = payrollRows.Select(r => r.EntityId).Distinct().ToArray();
                var periods = (await _unitOfWork.GetRepository<PayrollPeriod, int>()
                        .GetAllAsync(new PayrollPeriodsByIdsSpec(periodIds), cancellationToken))
                    .ToDictionary(p => p.Id);
                var entriesByPeriod = (await _unitOfWork.GetRepository<PayrollEntry, int>()
                        .GetAllAsync(new PayrollEntriesByPeriodsSpec(periodIds), cancellationToken))
                    .GroupBy(e => e.PayrollPeriodId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                foreach (var row in payrollRows)
                {
                    if (!periods.TryGetValue(row.EntityId, out var period))
                    {
                        continue;
                    }

                    entriesByPeriod.TryGetValue(period.Id, out var entries);
                    entries ??= [];

                    var item = byRowId[row.Id];
                    item.PayrollPeriodId = period.Id;
                    item.Period = PayrollService.PeriodLabel(period);
                    item.Gym = period.Gym.Name;
                    item.Headcount = entries.Count;
                    item.GrossTotal = entries.Sum(PayrollService.GrossOf);
                    item.NetTotal = entries.Sum(PayrollService.NetOf);
                    item.PreparedOn = null; // periods carry no prepared timestamp yet
                    item.PendingDeductions = entries.Sum(e => e.LineItems.Count(li => li.Status == "Pending"));
                }
            }

            return items;
        }

        // ------------------------------------------------------------------
        // Small helpers
        // ------------------------------------------------------------------

        private async Task<Gym> FindGymNamedAsync(string name, CancellationToken cancellationToken) =>
            await HrPortalHelpers.FindGymByNameAsync(_unitOfWork, name, cancellationToken)
            ?? throw new BadRequestException($"Unknown gym '{name}'.");

        private async Task AuditAsync(User actor, string action, Event row, object values, CancellationToken cancellationToken) =>
            await _unitOfWork.GetRepository<AuditLog, int>().AddAsync(new AuditLog
            {
                UserId = actor.Id,
                Action = action,
                EntityType = row.EntityType,
                EntityId = row.EntityId,
                GymId = row.GymId,
                NewValues = JsonSerializer.Serialize(values, JsonStore),
            }, cancellationToken);

        private static TransferDetails ParseTransferDetails(string? json)
        {
            try
            {
                return string.IsNullOrWhiteSpace(json)
                    ? new TransferDetails()
                    : JsonSerializer.Deserialize<TransferDetails>(json, JsonStore) ?? new TransferDetails();
            }
            catch (JsonException)
            {
                return new TransferDetails();
            }
        }

        private static RequestDecision? LastBranchManagerDecision(EmployeeRequest request) =>
            request.Decisions
                .Where(d => d.Stage == ApprovalStage.BranchManager)
                .OrderByDescending(d => d.Id)
                .FirstOrDefault();

        internal static string DocTypeLabel(DocumentType type) => type switch
        {
            DocumentType.Contract => "Employment Contract",
            DocumentType.NationalId => "Identification",
            _ => type.ToString(),
        };

        internal static string UrgencyByDaysLeft(int daysLeft) => daysLeft <= 7 ? "high" : daysLeft <= 14 ? "medium" : "low";

        /// <summary>DateOnly → midnight UTC (Postgres timestamptz rejects Kind=Unspecified).</summary>
        private static DateTime UtcDate(DateOnly value) =>
            DateTime.SpecifyKind(value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

        private static string ExpiryDetail(string subject, int daysLeft) => daysLeft switch
        {
            < 0 => $"{subject} expired {Math.Abs(daysLeft)} day{(Math.Abs(daysLeft) == 1 ? "" : "s")} ago.",
            0 => $"{subject} expires today.",
            1 => $"{subject} expires tomorrow.",
            _ => $"{subject} expires in {daysLeft} days.",
        };

        internal static string RequesterRoleLabel(UserType type) => type switch
        {
            UserType.TopManagement => "Top Management",
            UserType.HR => "HR Manager",
            _ => "Employee",
        };

        /// <summary>Same key table the Escalated tab renders from (ACTION_TYPES in the mock).</summary>
        internal static string PermissionKeyOfActionType(string actionType) => actionType switch
        {
            "Transfer" => "employees.transfer",
            "CompensationChange" => "employees.compensation.manage",
            "RoleAssign" => "employees.role.assign",
            "Offboard" => "employees.offboard",
            "BulkImport" => "employees.bulk_import",
            _ => "events.view",
        };

        internal static string ActionTypeLabel(string actionType) => actionType switch
        {
            "Transfer" => "Transfer Gym",
            "CompensationChange" => "Compensation Change",
            "RoleAssign" => "Role Assign",
            "Offboard" => "Offboard",
            "BulkImport" => "Bulk Import",
            _ => actionType,
        };

        private static string? NameOf(User? user) => user is null ? null : HrPortalHelpers.DisplayName(user);

        private static string Truncate(string value) => value.Length <= 200 ? value : value[..200];
    }
}
