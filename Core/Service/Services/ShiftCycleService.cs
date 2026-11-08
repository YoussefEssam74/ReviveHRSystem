using System.Globalization;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.SchedulingModule.Enums;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Employee;
using Shared.DataTransferObject.Schedule;

namespace Service.Services
{
    /// <summary>
    /// Shifts &amp; schedule (S5, Section 4 S1–S8). Cycle detail (S2) powers the
    /// calendar, the roster grid, the day detail modal, and the employee file's
    /// Schedule tab (A9). Assignment rows live in ShiftAssignment with a global
    /// (EmployeeId, Date) unique index: one employee holds exactly one shift per
    /// date system-wide, writes are upserts, and an explicit Off row is a null
    /// ShiftTemplateId (kiosk check-in ignores null-template rows — see
    /// AttendanceService shift resolution). Status rules: S3 creates Draft,
    /// S4/S7 require Draft, S5 publishes Draft → Published.
    /// </summary>
    public sealed class ShiftCycleService : IShiftCycleService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IAccessControlService _accessControl;
        private readonly IUserAccessRepository _userAccess;
        private readonly ITeamScopeService _teamScope;

        public ShiftCycleService(
            IUnitOfWork unitOfWork,
            IAccessControlService accessControl,
            IUserAccessRepository userAccess,
            ITeamScopeService teamScope)
        {
            _unitOfWork = unitOfWork;
            _accessControl = accessControl;
            _userAccess = userAccess;
            _teamScope = teamScope;
        }

        // ------------------------------------------------------------------
        // S1 / S8 — cycle list & template legend
        // ------------------------------------------------------------------

        /// <inheritdoc />
        public async Task<IReadOnlyList<ShiftCycleListItem>> GetShiftCyclesAsync(int? actorUserId, int gymId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "schedule.view", gymId, cancellationToken);
            await EnsureGymExistsAsync(gymId, cancellationToken);

            var cycles = await _unitOfWork.GetRepository<ShiftCycle, int>().GetAllAsync(new ShiftCyclesByGymSpec(gymId), cancellationToken);
            return cycles
                .Select(c => new ShiftCycleListItem
                {
                    Id = c.Id,
                    Label = LabelFor(c),
                    Status = StatusFor(c),
                    StartDate = c.StartDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    EndDate = c.EndDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                })
                .ToList();
        }

        /// <inheritdoc />
        public async Task<IReadOnlyList<ShiftTemplateItem>> GetShiftTemplatesAsync(int? actorUserId, int gymId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "schedule.view", gymId, cancellationToken);
            await EnsureGymExistsAsync(gymId, cancellationToken);

            var templates = await _unitOfWork.GetRepository<ShiftTemplate, int>().GetAllAsync(new ShiftTemplatesByGymSpec(gymId), cancellationToken);
            return templates.Select(ToTemplateItem).ToList();
        }

        // ------------------------------------------------------------------
        // S2 — cycle detail (roster grid, legend, conflicts)
        // ------------------------------------------------------------------

        /// <inheritdoc />
        public async Task<ShiftCycleDetailResponse> GetShiftCycleAsync(int? actorUserId, int cycleId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var cycle = await LoadCycleAsync(cycleId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "schedule.view", cycle.GymId, cancellationToken);

            // The grid lists the FULL assignable roster (assigned or not) so an
            // employee is never hidden from assignment: for team leaders the
            // members of the team they lead in this gym, otherwise the gym's
            // non-terminated roster. Assignments overlay the pattern on top.
            var roster = await LoadRosterEmployeesAsync(actor.Id, cycle.GymId, cancellationToken);
            var assigned = await LoadAssignedEmployeesAsync(cycle, cancellationToken);
            var allTemplates = (await _unitOfWork.GetRepository<ShiftTemplate, int>()
                .GetAllAsync(new AnyShiftTemplatesByGymSpec(cycle.GymId), cancellationToken)).ToList();
            var conflicts = await ComputeConflictsAsync(cycle, allTemplates, assigned, cancellationToken);

            var rows = new List<ShiftAssignmentRow>();
            var cycleDates = DatesOf(cycle).ToList();
            foreach (var employee in roster.OrderBy(e => e.FullName, StringComparer.OrdinalIgnoreCase))
            {
                // days[0 = Mon … 6 = Sun]; first occurrence wins so a later
                // duplicate row can never overwrite an explicit cell. AssignedDays
                // distinguishes an explicit Off row (null template) from a weekday
                // that was never assigned at all.
                var days = new int?[7];
                var assignedDays = new bool[7];
                var filled = new bool[7];
                // The grid renders real dates, not the weekday pattern: a cycle can
                // carry a date-specific override (Set Assignments accepts a Date),
                // and falling back to "first Monday of the cycle" showed a different
                // shift from the employee's Shift tab.
                var byDate = new Dictionary<DateOnly, ShiftAssignment>();
                foreach (var assignment in cycle.ShiftAssignments
                             .Where(a => a.EmployeeId == employee.Id && a.Date >= cycle.StartDate && a.Date <= cycle.EndDate)
                             .OrderBy(a => a.Date))
                {
                    byDate.TryAdd(assignment.Date, assignment);
                    var day = WeekdayIndex(assignment.Date);
                    if (filled[day]) continue;
                    days[day] = assignment.ShiftTemplateId;
                    assignedDays[day] = true;
                    filled[day] = true;
                }

                var daysByDate = cycleDates
                    .Select(date => byDate.TryGetValue(date, out var assignment)
                        ? new ShiftAssignmentDateCell
                        {
                            Date = date,
                            ShiftTemplateId = assignment.ShiftTemplateId,
                            Assigned = true,
                        }
                        : new ShiftAssignmentDateCell { Date = date, Assigned = false })
                    .ToList();

                rows.Add(new ShiftAssignmentRow
                {
                    EmployeeId = employee.Id,
                    Name = employee.FullName,
                    Position = employee.Position?.Title ?? "—",
                    Gym = employee.Gym?.Name ?? "—",
                    Initials = BuildInitials(employee.FullName),
                    Days = days.ToList(),
                    AssignedDays = assignedDays.ToList(),
                    DaysByDate = daysByDate,
                });
            }

            return new ShiftCycleDetailResponse
            {
                Id = cycle.Id,
                Label = LabelFor(cycle),
                Status = StatusFor(cycle),
                StartDate = cycle.StartDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                EndDate = cycle.EndDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ShiftTemplates = allTemplates.Where(t => t.IsActive).Select(ToTemplateItem).ToList(),
                Assignments = rows,
                Conflicts = conflicts,
            };
        }

        // ------------------------------------------------------------------
        // S3 — create draft cycle
        // ------------------------------------------------------------------

        /// <inheritdoc />
        public async Task<ShiftCycleDataResponse> CreateShiftCycleAsync(int? actorUserId, int gymId, CreateShiftCycleRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "schedule.manage", gymId, cancellationToken);
            await EnsureGymExistsAsync(gymId, cancellationToken);

            var startDate = ParseRequiredDate(request.StartDate, "startDate");
            var endDate = ParseRequiredDate(request.EndDate, "endDate");
            if (endDate < startDate)
                throw new BadRequestException("endDate must be on or after startDate.");

            var existing = await _unitOfWork.GetRepository<ShiftCycle, int>().GetAllAsync(new ShiftCyclesByGymSpec(gymId), cancellationToken);
            if (existing.Any(c => c.StartDate <= endDate && c.EndDate >= startDate))
                throw new BadRequestException("A cycle already covers these dates for this gym.");

            var cycle = new ShiftCycle
            {
                GymId = gymId,
                StartDate = startDate,
                EndDate = endDate,
                Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim(),
                Status = ShiftCycleStatus.Draft,
            };

            await _unitOfWork.GetRepository<ShiftCycle, int>().AddAsync(cycle, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ShiftCycleDataResponse
            {
                Data = new ShiftCycleListItem
                {
                    Id = cycle.Id,
                    Label = LabelFor(cycle),
                    Status = StatusFor(cycle),
                    StartDate = cycle.StartDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    EndDate = cycle.EndDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                },
            };
        }

        // ------------------------------------------------------------------
        // S4 — copy previous cycle pattern
        // ------------------------------------------------------------------

        /// <inheritdoc />
        public async Task<CopyShiftCycleResponse> CopyPreviousCycleAsync(int? actorUserId, int cycleId, CopyShiftCycleRequest? request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var target = await LoadCycleAsync(cycleId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "schedule.manage", target.GymId, cancellationToken);

            if (target.Status != ShiftCycleStatus.Draft)
                throw new BadRequestException("Only draft cycles can be changed.");

            ShiftCycle? source = null;
            if (request?.SourceCycleId is int sourceId)
            {
                source = await _unitOfWork.GetRepository<ShiftCycle, int>().GetByIdAsync(new ShiftCycleByIdSpec(sourceId), cancellationToken)
                    ?? throw new NotFoundException("Source cycle not found.");
                if (source.GymId != target.GymId)
                    throw new BadRequestException("The source cycle belongs to a different gym.");
            }
            else
            {
                var previous = (await _unitOfWork.GetRepository<ShiftCycle, int>()
                        .GetAllAsync(new PreviousShiftCycleByGymSpec(target.GymId, target.StartDate), cancellationToken))
                    .FirstOrDefault();
                if (previous is null)
                    return new CopyShiftCycleResponse { Message = "No previous cycle found to copy.", Copied = 0 };

                source = await _unitOfWork.GetRepository<ShiftCycle, int>()
                    .GetByIdAsync(new ShiftCycleByIdSpec(previous.Id), cancellationToken)
                    ?? throw new NotFoundException("Source cycle not found.");
            }

            // Source employees linked to the target gym (cross-gym rows skipped).
            var sourceEmployeeIds = source.ShiftAssignments.Select(a => a.EmployeeId).Distinct().ToArray();
            var eligibleEmployeeIds = sourceEmployeeIds.Length == 0
                ? []
                : (await _unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByIdsSpec(sourceEmployeeIds), cancellationToken))
                    .Where(e => e.GymId == target.GymId)
                    .Select(e => e.Id)
                    .ToArray();

            // Weekly pattern per (employee, weekday). Explicit Off rows (null
            // template) are copied too so a rest day never silently becomes
            // "not assigned" in the target cycle.
            var pattern = new Dictionary<(int EmployeeId, int Day), int?>();
            foreach (var assignment in source.ShiftAssignments
                         .Where(a => eligibleEmployeeIds.Contains(a.EmployeeId))
                         .OrderBy(a => a.Date))
            {
                var key = (assignment.EmployeeId, WeekdayIndex(assignment.Date));
                if (!pattern.ContainsKey(key))
                    pattern[key] = assignment.ShiftTemplateId;
            }

            if (pattern.Count == 0)
                return new CopyShiftCycleResponse { Message = "Source cycle has no assignments to copy.", Copied = 0 };

            var globalRows = await LoadExistingAssignmentsAsync(
                pattern.Keys.Select(k => k.EmployeeId).Distinct().ToArray(), target.StartDate, target.EndDate, cancellationToken);

            var copied = 0;
            foreach (var ((employeeId, day), templateId) in pattern)
            {
                foreach (var date in DatesForWeekday(target, day))
                {
                    ApplyAssignment(target, globalRows, employeeId, date, templateId);
                    copied++;
                }
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return new CopyShiftCycleResponse { Message = $"Copied {copied} employee assignments.", Copied = copied };
        }

        // ------------------------------------------------------------------
        // S5 — publish (+ notifications) & S6 — conflicts
        // ------------------------------------------------------------------

        /// <inheritdoc />
        public async Task<MessageResponse> PublishShiftCycleAsync(int? actorUserId, int cycleId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var cycle = await LoadCycleAsync(cycleId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "schedule.manage", cycle.GymId, cancellationToken);

            if (cycle.Status == ShiftCycleStatus.Published)
                throw new BadRequestException("This cycle is already published.");
            if (cycle.Status == ShiftCycleStatus.Archived)
                throw new BadRequestException("Archived cycles cannot be published.");

            // Publishing supersedes any earlier published cycle covering the same
            // dates. Two published cycles over one date make the employee schedule
            // ambiguous (and let assignment writes re-parent rows between them), so
            // the previous one is archived as part of the publish.
            var superseded = (await _unitOfWork.GetRepository<ShiftCycle, int>()
                    .GetAllAsync(new ShiftCyclesByGymSpec(cycle.GymId), cancellationToken))
                .Where(c => c.Id != cycle.Id
                    && c.Status == ShiftCycleStatus.Published
                    && c.StartDate <= cycle.EndDate
                    && c.EndDate >= cycle.StartDate)
                .ToList();
            foreach (var previous in superseded)
            {
                previous.Status = ShiftCycleStatus.Archived;
                _unitOfWork.GetRepository<ShiftCycle, int>().Update(previous);
            }

            var employees = await LoadAssignedEmployeesAsync(cycle, cancellationToken);
            var templates = (await _unitOfWork.GetRepository<ShiftTemplate, int>()
                .GetAllAsync(new AnyShiftTemplatesByGymSpec(cycle.GymId), cancellationToken)).ToList();
            var conflicts = await ComputeConflictsAsync(cycle, templates, employees, cancellationToken);

            cycle.Status = ShiftCycleStatus.Published;
            cycle.PublishedAt = DateTime.UtcNow;
            cycle.PublishedBy = actor.Id;

            // Notify every scheduled employee (first use of the Notification table).
            var label = LabelFor(cycle);
            var userIds = employees.Select(e => e.UserId).Distinct().ToList();
            var notificationRepository = _unitOfWork.GetRepository<Notification, int>();
            foreach (var userId in userIds)
            {
                await notificationRepository.AddAsync(new Notification
                {
                    UserId = userId,
                    Title = "New schedule published",
                    Message = $"{label} is now available.",
                    Type = NotificationType.ScheduleUpdate,
                    LinkTo = "/schedule",
                    CreatedAt = DateTime.UtcNow,
                }, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var message = conflicts.Count > 0
                ? $"Schedule published with {conflicts.Count} unresolved conflict(s)."
                : "Schedule published.";
            if (superseded.Count > 0)
            {
                message += $" Superseded cycle(s) archived: {string.Join(", ", superseded.Select(LabelFor))}.";
            }

            return new MessageResponse { Message = message };
        }

        /// <inheritdoc />
        public async Task<ShiftConflictsResponse> GetShiftCycleConflictsAsync(int? actorUserId, int cycleId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var cycle = await LoadCycleAsync(cycleId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "schedule.view", cycle.GymId, cancellationToken);

            var employees = await LoadAssignedEmployeesAsync(cycle, cancellationToken);
            var templates = (await _unitOfWork.GetRepository<ShiftTemplate, int>()
                .GetAllAsync(new AnyShiftTemplatesByGymSpec(cycle.GymId), cancellationToken)).ToList();

            return new ShiftConflictsResponse { Conflicts = await ComputeConflictsAsync(cycle, templates, employees, cancellationToken) };
        }

        // ------------------------------------------------------------------
        // S7 — Edit Shift save (exact dates when supplied, otherwise the
        // cycle's matching weekdays)
        // ------------------------------------------------------------------

        /// <inheritdoc />
        public async Task<MessageResponse> SetShiftAssignmentsAsync(int? actorUserId, int cycleId, SetShiftAssignmentsRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var cycle = await LoadCycleAsync(cycleId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "schedule.manage", cycle.GymId, cancellationToken);

            if (cycle.Status == ShiftCycleStatus.Archived)
                throw new BadRequestException("Archived cycles are read-only.");

            foreach (var input in request.Assignments)
            {
                if (input.Date is DateOnly date)
                {
                    if (date < cycle.StartDate || date > cycle.EndDate)
                    {
                        throw new BadRequestException(
                            $"date {date:yyyy-MM-dd} is outside the cycle's range ({cycle.StartDate:yyyy-MM-dd} – {cycle.EndDate:yyyy-MM-dd}).");
                    }
                }
                else if (input.Day < 0 || input.Day > 6)
                {
                    throw new BadRequestException("day must be between 0 (Monday) and 6 (Sunday).");
                }
            }

            // Validate employees (unknown id → 400).
            var employeeIds = request.Assignments.Select(a => a.EmployeeId).Distinct().ToArray();
            if (employeeIds.Length > 0)
            {
                var employees = (await _unitOfWork.GetRepository<Employee, int>()
                        .GetAllAsync(new EmployeesByIdsSpec(employeeIds), cancellationToken))
                    .Select(e => e.Id)
                    .ToHashSet();
                var unknown = employeeIds.Where(id => !employees.Contains(id)).ToArray();
                if (unknown.Length > 0)
                    throw new BadRequestException($"Unknown employeeId(s): {string.Join(", ", unknown)}.");
            }

            // Validate templates (must be an active template of this gym; null = Off).
            var requestedTemplateIds = request.Assignments
                .Where(a => a.ShiftTemplateId.HasValue)
                .Select(a => a.ShiftTemplateId!.Value)
                .Distinct()
                .ToArray();
            if (requestedTemplateIds.Length > 0)
            {
                var activeTemplates = (await _unitOfWork.GetRepository<ShiftTemplate, int>()
                        .GetAllAsync(new ShiftTemplatesByGymSpec(cycle.GymId), cancellationToken))
                    .Select(t => t.Id)
                    .ToHashSet();
                var unknownTemplates = requestedTemplateIds.Where(id => !activeTemplates.Contains(id)).ToArray();
                if (unknownTemplates.Length > 0)
                    throw new BadRequestException($"Unknown or inactive shiftTemplateId(s): {string.Join(", ", unknownTemplates)}.");
            }

            var globalRows = employeeIds.Length == 0
                ? new Dictionary<(int EmployeeId, DateOnly Date), ShiftAssignment>()
                : await LoadExistingAssignmentsAsync(employeeIds, cycle.StartDate, cycle.EndDate, cancellationToken);

            var applied = 0;
            foreach (var input in request.Assignments)
            {
                IEnumerable<DateOnly> dates = input.Date is DateOnly date
                    ? new[] { date }
                    : DatesForWeekday(cycle, input.Day);

                foreach (var target in dates)
                {
                    ApplyAssignment(cycle, globalRows, input.EmployeeId, target, input.ShiftTemplateId);
                    applied++;
                }
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return new MessageResponse { Message = $"Saved {applied} assignments." };
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private static int WeekdayIndex(DateOnly date) => ((int)date.DayOfWeek + 6) % 7;

        private static IEnumerable<DateOnly> DatesOf(ShiftCycle cycle)
        {
            for (var date = cycle.StartDate; date <= cycle.EndDate; date = date.AddDays(1))
                yield return date;
        }

        private static IEnumerable<DateOnly> DatesForWeekday(ShiftCycle cycle, int day) =>
            DatesOf(cycle).Where(date => WeekdayIndex(date) == day);

        private static string LabelFor(ShiftCycle cycle) =>
            !string.IsNullOrWhiteSpace(cycle.Label)
                ? cycle.Label
                : $"{cycle.StartDate.ToString("MMM d", CultureInfo.InvariantCulture)} – {cycle.EndDate.ToString("MMM d", CultureInfo.InvariantCulture)}";

        private static string StatusFor(ShiftCycle cycle) => cycle.Status.ToString();

        private static DateOnly ParseRequiredDate(string? value, string field)
        {
            if (!DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                throw new BadRequestException($"{field} must be a valid date in yyyy-MM-dd format.");
            return date;
        }

        private async Task<User> ResolveActorAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            if (actorUserId is null or <= 0)
                throw new UnAuthorizedException("Authentication is required.");

            var user = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(actorUserId.Value, cancellationToken);
            if (user is null || !user.IsActive)
                throw new UnAuthorizedException("Authentication is required.");

            return user;
        }

        private async Task EnsureGymExistsAsync(int gymId, CancellationToken cancellationToken)
        {
            var gym = await _unitOfWork.GetRepository<Gym, int>().GetByIdAsync(gymId, cancellationToken);
            if (gym is null)
                throw new NotFoundException("Gym not found.");
        }

        private async Task<ShiftCycle> LoadCycleAsync(int cycleId, CancellationToken cancellationToken)
        {
            var cycle = await _unitOfWork.GetRepository<ShiftCycle, int>().GetByIdAsync(new ShiftCycleByIdSpec(cycleId), cancellationToken);
            if (cycle is null)
                throw new NotFoundException("Shift cycle not found.");
            return cycle;
        }

        private async Task<List<Employee>> LoadAssignedEmployeesAsync(ShiftCycle cycle, CancellationToken cancellationToken)
        {
            var ids = cycle.ShiftAssignments.Select(a => a.EmployeeId).Distinct().ToArray();
            if (ids.Length == 0) return [];
            return (await _unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByIdsSpec(ids), cancellationToken)).ToList();
        }

        /// <summary>
        /// The cycle's assignable roster: members of the team the caller leads
        /// in this gym when they lead one, otherwise every non-terminated
        /// employee of the gym. Fresh drafts therefore open with the complete
        /// grid instead of "no employees".
        /// </summary>
        private async Task<List<Employee>> LoadRosterEmployeesAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var ledTeamId = await _teamScope.GetLedTeamIdAsync(actorUserId, gymId, cancellationToken);
            var employeeRepo = _unitOfWork.GetRepository<Employee, int>();
            var employees = ledTeamId is int teamId
                ? await employeeRepo.GetAllAsync(new EmployeesByTeamSpec(teamId), cancellationToken)
                : await employeeRepo.GetAllAsync(new EmployeesForRosterSpec(new[] { gymId }), cancellationToken);
            return employees.ToList();
        }

        /// <summary>All rows of these employees inside [from, to], keyed by (employee, date) — cross-cycle collision lookup.</summary>
        private async Task<Dictionary<(int EmployeeId, DateOnly Date), ShiftAssignment>> LoadExistingAssignmentsAsync(
            int[] employeeIds, DateOnly from, DateOnly to, CancellationToken cancellationToken)
        {
            var rows = await _unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new ShiftAssignmentsOfEmployeesInRangeSpec(employeeIds, from, to), cancellationToken);
            return rows.ToDictionary(a => (a.EmployeeId, a.Date));
        }

        /// <summary>
        /// Upsert one (employee, date) cell of the target cycle. The global
        /// (EmployeeId, Date) unique index means a row owned by another cycle is
        /// re-parented to this cycle (this cycle's write wins) instead of duplicated.
        /// </summary>
        private static void ApplyAssignment(
            ShiftCycle target,
            Dictionary<(int EmployeeId, DateOnly Date), ShiftAssignment> globalRows,
            int employeeId,
            DateOnly date,
            int? templateId)
        {
            if (globalRows.TryGetValue((employeeId, date), out var existing))
            {
                if (existing.ShiftCycleId == target.Id)
                {
                    existing.ShiftTemplateId = templateId;
                }
                else
                {
                    // Re-parent (FK update) — no duplicate insert against the unique index.
                    existing.ShiftCycleId = target.Id;
                    existing.ShiftTemplateId = templateId;
                }
                return;
            }

            var row = new ShiftAssignment
            {
                EmployeeId = employeeId,
                Date = date,
                ShiftTemplateId = templateId,
            };
            target.ShiftAssignments.Add(row);
            globalRows[(employeeId, date)] = row;
        }

        private static ShiftTemplateItem ToTemplateItem(ShiftTemplate template)
        {
            var (color, bg, text) = ShiftTemplateColors.Derive(template.Color);
            return new ShiftTemplateItem
            {
                Id = template.Id,
                Name = template.Name,
                Start = template.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture),
                End = template.EndTime.ToString("HH:mm", CultureInfo.InvariantCulture),
                Color = color,
                BgColor = bg,
                TextColor = text,
                // Off is an explicit assignment without a template, never a template.
                IsOff = false,
            };
        }

        private static string BuildInitials(string fullName)
        {
            var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 0) return string.Empty;
            var first = parts[0][..1];
            var last = parts.Length > 1 ? parts[^1][..1] : string.Empty;
            return (first + last).ToUpperInvariant();
        }

        /// <summary>
        /// Conflict detection (S6):
        /// C1 approved Day Off / Sick Leave overlapping a working shift;
        /// C2 an assigned employee not linked to the cycle's gym;
        /// C3 an assignment outside the cycle's dates;
        /// C4 an assignment whose template is missing or inactive.
        /// day = weekday index (0 = Mon … 6 = Sun) of the offending assignment.
        /// </summary>
        private async Task<List<ShiftConflictItem>> ComputeConflictsAsync(
            ShiftCycle cycle,
            List<ShiftTemplate> allTemplates,
            List<Employee> employees,
            CancellationToken cancellationToken)
        {
            var conflicts = new List<ShiftConflictItem>();
            var templatesById = allTemplates.ToDictionary(t => t.Id);
            var assignments = cycle.ShiftAssignments.OrderBy(a => a.Date).ToList();
            var working = assignments.Where(a => a.ShiftTemplateId.HasValue).ToList();

            // C1 — approved Day Off / Sick Leave vs an assigned shift.
            var workingEmployeeIds = working.Select(a => a.EmployeeId).Distinct().ToArray();
            if (workingEmployeeIds.Length > 0)
            {
                var requests = await _unitOfWork.GetRepository<EmployeeRequest, int>().GetAllAsync(
                    new ApprovedDayOffRequestsOverlappingSpec(workingEmployeeIds, cycle.StartDate, cycle.EndDate), cancellationToken);

                foreach (var request in requests)
                {
                    var from = request.TargetStartDate ?? request.RequestDate;
                    var to = request.TargetEndDate ?? request.RequestDate;
                    foreach (var assignment in working.Where(a => a.EmployeeId == request.EmployeeId && a.Date >= from && a.Date <= to))
                    {
                        var shiftName = assignment.ShiftTemplateId.HasValue && templatesById.TryGetValue(assignment.ShiftTemplateId.Value, out var template)
                            ? template.Name
                            : "a shift";
                        conflicts.Add(new ShiftConflictItem
                        {
                            EmployeeId = assignment.EmployeeId,
                            Day = WeekdayIndex(assignment.Date),
                            Message = $"Approved {request.Type} on {assignment.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)} but {shiftName} assigned.",
                        });
                    }
                }
            }

            // C2 — employee not linked to the cycle's gym (gym row or UserGymAccess).
            foreach (var employee in employees)
            {
                if (employee.GymId == cycle.GymId) continue;
                if (await _userAccess.HasGymAccessAsync(employee.UserId, cycle.GymId, cancellationToken)) continue;

                var first = assignments.FirstOrDefault(a => a.EmployeeId == employee.Id);
                conflicts.Add(new ShiftConflictItem
                {
                    EmployeeId = employee.Id,
                    Day = first is null ? 0 : WeekdayIndex(first.Date),
                    Message = $"Employee is not linked to {cycle.Gym.Name}.",
                });
            }

            // C3 — assignment outside the cycle's date range.
            foreach (var assignment in assignments.Where(a => a.Date < cycle.StartDate || a.Date > cycle.EndDate))
            {
                conflicts.Add(new ShiftConflictItem
                {
                    EmployeeId = assignment.EmployeeId,
                    Day = WeekdayIndex(assignment.Date),
                    Message = $"Assignment on {assignment.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)} falls outside the cycle dates.",
                });
            }

            // C4 — template missing or inactive.
            foreach (var assignment in working)
            {
                if (!assignment.ShiftTemplateId.HasValue) continue;
                if (!templatesById.TryGetValue(assignment.ShiftTemplateId.Value, out var template))
                {
                    conflicts.Add(new ShiftConflictItem
                    {
                        EmployeeId = assignment.EmployeeId,
                        Day = WeekdayIndex(assignment.Date),
                        Message = "Assigned shift template no longer exists.",
                    });
                }
                else if (!template.IsActive)
                {
                    conflicts.Add(new ShiftConflictItem
                    {
                        EmployeeId = assignment.EmployeeId,
                        Day = WeekdayIndex(assignment.Date),
                        Message = $"Shift template {template.Name} is inactive.",
                    });
                }
            }

            return conflicts
                .OrderBy(c => c.EmployeeId)
                .ThenBy(c => c.Day)
                .ToList();
        }
    }
}
