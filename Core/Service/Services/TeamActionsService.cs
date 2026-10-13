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
    /// Branch Manager, otherwise the member-or-leader set from
    /// <see cref="TeamsByMemberOrLeaderSpec"/>. The follow-up list covers all of those
    /// teams unless a specific team is requested. A target outside that scope answers
    /// 404 so the API never confirms another team's data exists; a caller with no team
    /// in that gym gets 404 on every route here (fails closed).
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
            var teams = await MyTeamsAsync(actorUserId, gymId, cancellationToken);

            IEnumerable<TeamFollowUp> followUps;
            if (teamId is not null)
            {
                var team = teams.FirstOrDefault(t => t.Id == teamId.Value)
                    ?? throw new NotFoundException("Team not found.");

                followUps = await unitOfWork.GetRepository<TeamFollowUp, int>()
                    .GetAllAsync(new TeamFollowUpsByTeamSpec(team.Id), cancellationToken);
            }
            else
            {
                if (teams.Count == 0)
                {
                    throw new NotFoundException("Team not found.");
                }

                followUps = await unitOfWork.GetRepository<TeamFollowUp, int>()
                    .GetAllAsync(new TeamFollowUpsByTeamsSpec(teams.Select(t => t.Id).ToList()), cancellationToken);
            }

            return followUps.Select(f => mapper.Map<TeamFollowUpDto>(f)).ToList();
        }

        public async Task<TeamFollowUpDto> CreateFollowUpAsync(
            int actorUserId, int? activeGymId, CreateTeamFollowUpDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            var teams = await MyTeamsAsync(actorUserId, gymId, cancellationToken);

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeProfileByIdSpec(request.EmployeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            if (employee.GymId != gymId)
            {
                throw new NotFoundException("Employee not found.");
            }

            var team = teams.FirstOrDefault(t => t.Id == employee.TeamId)
                ?? throw new NotFoundException("Employee not found.");

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
                TeamId = team.Id,
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

            // The reminder is recorded as a follow-up so the trail is preserved, and
            // surfaced to the employee immediately through his inbox.
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

            var teams = await MyTeamsAsync(actorUserId, gymId, cancellationToken);
            if (!teams.Any(t => t.Id == followUp.TeamId))
            {
                throw new NotFoundException("Follow-up not found.");
            }

            return followUp;
        }

        private async Task<List<Team>> MyTeamsAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            // Branch Managers see every team in the gym without belonging to any of
            // them; everyone else resolves the member-or-leader set from his profile.
            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, gymId, cancellationToken);
            if (roleNames.Contains(RoleNames.BranchManager, StringComparer.Ordinal))
            {
                var gymTeams = await unitOfWork.GetRepository<Team, int>()
                    .GetAllAsync(new TeamsByGymSpec(gymId), cancellationToken);

                return gymTeams.ToList();
            }

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
                ?? throw new UnAuthorizedException("This account has no employee profile.");

            var teams = await unitOfWork.GetRepository<Team, int>()
                .GetAllAsync(new TeamsByMemberOrLeaderSpec(employee.Id, gymId), cancellationToken);

            return teams.ToList();
        }

        private async Task<(Team Team, Employee Employee)> ResolveTeamMemberAsync(
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

            var teams = await MyTeamsAsync(actorUserId, gymId, cancellationToken);

            var team = teams.FirstOrDefault(t => t.Id == employee.TeamId)
                ?? throw new NotFoundException("Employee not found.");

            return (team, employee);
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
