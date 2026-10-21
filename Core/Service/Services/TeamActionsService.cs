using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Team Actions (mock 13.4-13.8 / 19). Scope resolves exactly like the rest of the
    /// management surface: the caller's teams in the active gym — every team for a
    /// Branch Manager, otherwise only the teams he leads
    /// (<see cref="TeamsLedByUserSpec"/>; members answer NotFound). The follow-up list
    /// covers all of those teams unless a specific team is requested. A target outside
    /// that scope answers 404 so the API never confirms another team's data exists; a
    /// caller with no team in that gym gets 404 on every route here (fails closed).
    /// A Branch Manager additionally covers gym employees who are not assigned to
    /// any team yet (the branch pages list them): he can raise a follow-up about any
    /// of them and those items — which hang off no team — appear in his scope-wide
    /// list. A Team Leader stays team-scoped and cannot reach them.
    /// </summary>
    public class TeamActionsService(
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IUserAccessRepository userAccess) : ITeamActionsService
    {
        public async Task<IReadOnlyList<TeamFollowUpDto>> GetFollowUpsAsync(
            int actorUserId, int? activeGymId, int? teamId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            var scope = await ResolveScopeAsync(actorUserId, gymId, cancellationToken);

            IEnumerable<TeamFollowUp> followUps;
            if (teamId is not null)
            {
                var team = scope.Teams.FirstOrDefault(t => t.Id == teamId.Value)
                    ?? throw new NotFoundException("Team not found.");

                followUps = await unitOfWork.GetRepository<TeamFollowUp, int>()
                    .GetAllAsync(new TeamFollowUpsByTeamSpec(team.Id), cancellationToken);
            }
            else
            {
                // Fail closed for a leader with no team in this gym. A Branch Manager
                // still has a scope: the gym's teams plus its team-less employees.
                if (scope.Teams.Count == 0 && !scope.IsBranchManager)
                {
                    throw new NotFoundException("Team not found.");
                }

                followUps = scope.IsBranchManager
                    ? await unitOfWork.GetRepository<TeamFollowUp, int>()
                        .GetAllAsync(new TeamFollowUpsForGymScopeSpec(scope.Teams.Select(t => t.Id).ToList(), gymId), cancellationToken)
                    : await unitOfWork.GetRepository<TeamFollowUp, int>()
                        .GetAllAsync(new TeamFollowUpsByTeamsSpec(scope.Teams.Select(t => t.Id).ToList()), cancellationToken);
            }

            return followUps.Select(f => mapper.Map<TeamFollowUpDto>(f)).ToList();
        }

        public async Task<TeamFollowUpDto> CreateFollowUpAsync(
            int actorUserId, int? activeGymId, CreateTeamFollowUpDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            var scope = await ResolveScopeAsync(actorUserId, gymId, cancellationToken);

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeProfileByIdSpec(request.EmployeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            if (employee.GymId != gymId)
            {
                throw new NotFoundException("Employee not found.");
            }

            var team = scope.Teams.FirstOrDefault(t => t.Id == employee.TeamId);

            // A Branch Manager's scope is the whole gym roster (the same rows the
            // branch pages list), so an employee nobody has assigned to a team yet
            // still takes a follow-up — it simply hangs off no team. Everyone else
            // stays team-scoped and answers the concealment 404.
            var teamlessInGymScope = employee.TeamId is null && scope.IsBranchManager;
            if (team is null && !teamlessInGymScope)
            {
                throw new NotFoundException("Employee not found.");
            }

            if (string.IsNullOrWhiteSpace(request.Description))
            {
                throw new BadRequestException("A description is required.");
            }

            var action = ParseAction(request.Action);
            var severity = ParseSeverity(request.Severity);
            var resolving = action == FollowUpActionType.Resolution;

            var followUp = new TeamFollowUp
            {
                EmployeeId = employee.Id,
                TeamId = team?.Id,
                ActionType = action,
                Severity = severity,
                Description = RequiredText(request.Description, 1000, "description"),
                LastAction = request.Action.Trim(),
                Note = OptionalText(request.Note, 1000, "note"),
                IsResolved = resolving,
                RaisedByUserId = actorUserId
            };

            await unitOfWork.GetRepository<TeamFollowUp, int>().AddAsync(followUp, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await MapAsync(followUp.Id, cancellationToken);
        }

        public async Task<TeamFollowUpDto> UpdateFollowUpAsync(
            int actorUserId, int followUpId, int? activeGymId, UpdateTeamFollowUpDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            var followUp = await LoadInScopeAsync(actorUserId, followUpId, gymId, cancellationToken);

            var action = ParseAction(request.Action);
            followUp.LastAction = request.Action.Trim();
            followUp.ActionType = action;
            followUp.Note = OptionalText(request.Note, 1000, "note");

            // A resolution closes the item; anything else reopens a closed one.
            followUp.IsResolved = action == FollowUpActionType.Resolution;

            unitOfWork.GetRepository<TeamFollowUp, int>().Update(followUp);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await MapAsync(followUp.Id, cancellationToken);
        }

        public async Task SendReminderAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            var record = await ResolveTeamMemberAsync(actorUserId, employeeId, gymId, cancellationToken);
            EnsureNotSelf(actorUserId, record.Employee);

            // The reminder is recorded as a follow-up so the trail is preserved, and
            // surfaced to the employee immediately through his inbox. A team-less
            // employee has no follow-up list to hang the row on (TeamId is required),
            // so only the notification is sent for him.
            if (record.Team is not null)
            {
                var followUp = new TeamFollowUp
                {
                    EmployeeId = record.Employee.Id,
                    TeamId = record.Team.Id,
                    ActionType = FollowUpActionType.Reminder,
                    Severity = FollowUpSeverity.Medium,
                    Description = "Attendance reminder",
                    LastAction = "Send reminder",
                    IsResolved = true,
                    RaisedByUserId = actorUserId
                };
                await unitOfWork.GetRepository<TeamFollowUp, int>().AddAsync(followUp, cancellationToken);
            }

            await NotifyAsync(record.Employee, "Reminder", "Your manager sent you a reminder.", cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public async Task SendMessageAsync(
            int actorUserId, int employeeId, int? activeGymId, SendTeamMessageDto request, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                throw new BadRequestException("A message is required.");
            }

            var gymId = RequireGym(activeGymId);
            var record = await ResolveTeamMemberAsync(actorUserId, employeeId, gymId, cancellationToken);
            EnsureNotSelf(actorUserId, record.Employee);

            var message = new TeamMessage
            {
                FromUserId = actorUserId,
                ToEmployeeId = record.Employee.Id,
                Body = RequiredText(request.Message, 2000, "message")
            };
            await unitOfWork.GetRepository<TeamMessage, int>().AddAsync(message, cancellationToken);

            await NotifyAsync(record.Employee, "New message", request.Message.Trim(), cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ---------- helpers ----------

        /// <summary>
        /// Deduction a no-permission absence starts from, pending manager / HR
        /// confirmation — it must not silently land on the payroll as-is.
        /// </summary>
        public const string UnauthorizedAbsenceDeduction = "3 Days";

        /// <summary>
        /// The attendance sweep's write-side: employees the dashboard (or any caller)
        /// already proved scheduled-but-unpunched for <paramref name="date"/> get one
        /// pending <see cref="FollowUpActionType.Deduction"/> follow-up each, raised by
        /// the System account. Idempotent per (EmployeeId, date) via the note marker,
        /// so the sweep running on every dashboard load never duplicates rows. The
        /// item is left open — approval is still a human decision.
        /// </summary>
        public async Task<int> SweepAbsenceDeductionsAsync(
            IReadOnlyList<Employee> employees, DateOnly date, CancellationToken cancellationToken = default)
        {
            if (employees.Count == 0)
            {
                return 0;
            }

            var employeeIds = employees.Select(e => e.Id).ToArray();

            // One marker per (employee, date). Any pre-existing deduction for the
            // pair — manual or sweeps from earlier days in the loop — counts as the
            // dedupe so a corrected record that erases the absence never re-queues it.
            var existing = (await unitOfWork.GetRepository<TeamFollowUp, int>()
                .GetAllAsync(new TeamFollowUpsDeductionForEmployeesSpec(employeeIds), cancellationToken))
                .Where(f => f.Note is not null && f.Note.Contains(Marker(date)))
                .Select(f => f.EmployeeId)
                .ToHashSet();

            var systemUserId = await GetSystemUserIdAsync(cancellationToken);
            if (systemUserId is null)
            {
                // No system account to attribute the rows to — skip quietly rather
                // than failing the dashboard load; the next run can pick it up.
                return 0;
            }

            var created = 0;
            foreach (var employee in employees)
            {
                if (existing.Contains(employee.Id))
                {
                    continue;
                }

                var followUp = new TeamFollowUp
                {
                    EmployeeId = employee.Id,
                    TeamId = employee.TeamId,
                    ActionType = FollowUpActionType.Deduction,
                    Severity = FollowUpSeverity.High,
                    Description = $"Deduction — {UnauthorizedAbsenceDeduction}",
                    LastAction = "Auto-raised",
                    Note = Marker(date),
                    IsResolved = false,
                    RaisedByUserId = systemUserId.Value
                };
                await unitOfWork.GetRepository<TeamFollowUp, int>().AddAsync(followUp, cancellationToken);
                existing.Add(employee.Id);
                created++;

                if (employee.UserId > 0)
                {
                    await NotifyAsync(employee, "Absence recorded",
                        "You were marked absent without permission for " +
                        $"{date:yyyy-MM-dd}. A {UnauthorizedAbsenceDeduction} deduction was raised for review.",
                        cancellationToken);
                }
            }

            if (created > 0)
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return created;
        }

        /// <summary>The marker stamped into the note for one absence day.</summary>
        private static string Marker(DateOnly date) => $"auto-absence:{date:yyyy-MM-dd}";

        private async Task<int?> GetSystemUserIdAsync(CancellationToken cancellationToken)
        {
            var admin = await unitOfWork.GetRepository<DomainLayer.Models.UserModule.User, int>()
                .GetAllAsync(new UserByEmailSpec("admin@revive.hr"), cancellationToken);
            return admin.Select(u => u.Id).Cast<int?>().FirstOrDefault();
        }

        private async Task NotifyAsync(Employee employee, string title, string body, CancellationToken cancellationToken)
        {
            await unitOfWork.GetRepository<Notification, int>().AddAsync(new Notification
            {
                UserId = employee.UserId,
                Title = title,
                Message = body,
                Type = NotificationType.SystemUpdate
            }, cancellationToken);
        }

        // A manager's own employee row sits inside his own roster, so without this
        // guard a self-reminder would silently deliver the notification to the
        // sender's own inbox instead of a real target.
        private static void EnsureNotSelf(int actorUserId, Employee employee)
        {
            if (employee.UserId == actorUserId)
            {
                throw new BadRequestException("You cannot send this to your own account.");
            }
        }

        private async Task<TeamFollowUpDto> MapAsync(int followUpId, CancellationToken cancellationToken)
        {
            var reloaded = await unitOfWork.GetRepository<TeamFollowUp, int>()
                .GetByIdAsync(new TeamFollowUpByIdSpec(followUpId), cancellationToken)
                ?? throw new NotFoundException("Follow-up not found.");

            return mapper.Map<TeamFollowUpDto>(reloaded);
        }

        private async Task<TeamFollowUp> LoadInScopeAsync(
            int actorUserId, int followUpId, int gymId, CancellationToken cancellationToken)
        {
            var followUp = await unitOfWork.GetRepository<TeamFollowUp, int>()
                .GetByIdAsync(new TeamFollowUpByIdSpec(followUpId), cancellationToken)
                ?? throw new NotFoundException("Follow-up not found.");

            // The token's active gym governs everything: a follow-up belonging to
            // another gym is invisible regardless of what the caller could do there.
            var employee = followUp.Employee
                ?? await unitOfWork.GetRepository<Employee, int>()
                    .GetByIdAsync(new EmployeeByIdSpec(followUp.EmployeeId), cancellationToken);

            if (employee is null || employee.GymId != gymId)
            {
                throw new NotFoundException("Follow-up not found.");
            }

            var scope = await ResolveScopeAsync(actorUserId, gymId, cancellationToken);

            // A team-less follow-up only exists inside a Branch Manager's gym scope;
            // the employee's gym was already checked above.
            if (followUp.TeamId is null)
            {
                if (!scope.IsBranchManager)
                {
                    throw new NotFoundException("Follow-up not found.");
                }

                return followUp;
            }

            if (!scope.Teams.Any(t => t.Id == followUp.TeamId.Value))
            {
                throw new NotFoundException("Follow-up not found.");
            }

            return followUp;
        }

        /// <summary>
        /// The caller's reach in one gym: the teams he may act on and whether he is a
        /// Branch Manager (whose scope is the whole roster, team-less rows included).
        /// </summary>
        private async Task<(List<Team> Teams, bool IsBranchManager)> ResolveScopeAsync(
            int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            // Branch Managers see every team in the gym without belonging to any of
            // them; everyone else is leader-only — just the teams he leads (plain
            // members of a team do not get the team management surface).
            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, gymId, cancellationToken);
            var isBranchManager = roleNames.Contains(RoleNames.BranchManager, StringComparer.Ordinal);

            if (isBranchManager)
            {
                var gymTeams = await unitOfWork.GetRepository<Team, int>()
                    .GetAllAsync(new TeamsByGymSpec(gymId), cancellationToken);

                return (gymTeams.ToList(), true);
            }

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
                ?? throw new UnAuthorizedException("This account has no employee profile.");

            var teams = await unitOfWork.GetRepository<Team, int>()
                .GetAllAsync(new TeamsLedByUserSpec(employee.Id, gymId), cancellationToken);

            return (teams.ToList(), false);
        }

        private async Task<(Team? Team, Employee Employee)> ResolveTeamMemberAsync(
            int actorUserId, int employeeId, int gymId, CancellationToken cancellationToken)
        {
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeProfileByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            // Team membership is resolved in the token's active gym, so a cross-gym
            // caller never reaches another branch's team through this path.
            if (employee.GymId != gymId)
            {
                throw new NotFoundException("Employee not found.");
            }

            var scope = await ResolveScopeAsync(actorUserId, gymId, cancellationToken);

            var team = scope.Teams.FirstOrDefault(t => t.Id == employee.TeamId);
            if (team is not null)
            {
                return (team, employee);
            }

            // The branch pages (attendance grid, employee directory) list the whole gym
            // roster, including employees nobody has put in a team yet — a Branch
            // Manager acting inside his own gym covers them too, otherwise the remind /
            // message buttons on rows that are plainly visible answered a misleading
            // "Employee not found." Everyone else stays fail-closed.
            if (employee.TeamId is null && scope.IsBranchManager)
            {
                return (null, employee);
            }

            throw new NotFoundException("Employee not found.");
        }

        private static FollowUpActionType ParseAction(string action) =>
            Enum.TryParse<FollowUpActionType>(action, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
                ? parsed
                : throw new BadRequestException($"Unknown action '{action}'.");

        private static FollowUpSeverity ParseSeverity(string? severity) =>
            string.IsNullOrWhiteSpace(severity)
                ? FollowUpSeverity.Medium
                : Enum.TryParse<FollowUpSeverity>(severity, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
                    ? parsed
                    : throw new BadRequestException($"Unknown severity '{severity}'.");

        /// <summary>
        /// Trims and length-checks user text before it reaches the database, so an
        /// oversized body is a 400 rather than a DbUpdateException surfacing as a 500.
        /// </summary>
        private static string RequiredText(string? value, int maxLength, string fieldName)
        {
            var trimmed = (value ?? string.Empty).Trim();
            if (trimmed.Length == 0)
            {
                throw new BadRequestException($"A {fieldName} is required.");
            }

            if (trimmed.Length > maxLength)
            {
                throw new BadRequestException($"The {fieldName} may not exceed {maxLength} characters.");
            }

            return trimmed;
        }

        private static string? OptionalText(string? value, int maxLength, string fieldName)
        {
            var trimmed = (value ?? string.Empty).Trim();
            if (trimmed.Length == 0)
            {
                return null;
            }

            if (trimmed.Length > maxLength)
            {
                throw new BadRequestException($"The {fieldName} may not exceed {maxLength} characters.");
            }

            return trimmed;
        }

        private static int RequireGym(int? activeGymId) =>
            activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");
    }
}
