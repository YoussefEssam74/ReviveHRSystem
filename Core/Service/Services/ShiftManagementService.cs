using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.SchedulingModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Shift management (mock §§15-16). Scope: team-scoped leaders manage their
    /// team's members inside the gym's cycles; Branch Managers manage the gym's
    /// roster. Assignments are upserted per (employee, date) — the domain enforces
    /// one shift per employee per date.
    /// </summary>
    /// <summary>
    /// Shift management (mock §§15-16). Schedules and templates are management
    /// artifacts: a Team Leader manages his team's members inside the gym's
    /// cycles, a Branch Manager the gym's roster; a plain employee answers the
    /// same NotFound the missing-cycle path does. Assignments are upserted per
    /// (employee, date) — the domain enforces one shift per employee per date.
    /// </summary>
    public class ShiftManagementService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService,
        IUserAccessRepository userAccess,
        IMapper mapper) : IShiftManagementService
    {
        private static readonly string[] ManagementRoleNames =
        [
            Shared.Authorization.RoleNames.TeamLeader,
            Shared.Authorization.RoleNames.BranchManager,
            Shared.Authorization.RoleNames.SuperAdmin,
        ];

        private async Task EnsureManagementScopeAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, gymId, cancellationToken);
            if (roleNames.Any(ManagementRoleNames.Contains))
            {
                return;
            }

            // Same key the rest of the schedule surface (ShiftCycleService) and the
            // portal's `can('schedule.manage')` gate on — per-gym role keys, with the
            // global-role fallback for users who hold no role in this gym. Without it
            // a user the UI shows "New Template" / "Create Schedule" to was rejected
            // here with a misleading "Shift cycle not found."
            var permissionKeys = await userAccess.GetPermissionKeysForGymAsync(actorUserId, gymId, cancellationToken);
            if (permissionKeys.Contains("schedule.manage", StringComparer.Ordinal))
            {
                return;
            }

            throw new NotFoundException("Shift cycle not found.");
        }

        public async Task<IReadOnlyList<ShiftCycleDto>> GetCyclesAsync(
            int actorUserId, int gymId, string? month, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var cycles = await unitOfWork.GetRepository<ShiftCycle, int>()
                .GetAllAsync(new ShiftCyclesByGymSpec(gymId, ParseMonth(month)), cancellationToken);

            return cycles.Select(c => mapper.Map<ShiftCycleDto>(c)).ToList();
        }

        public async Task<ShiftCycleDetailDto> GetCycleAsync(
            int actorUserId, int gymId, int cycleId, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var cycle = await LoadCycleAsync(gymId, cycleId, cancellationToken);
            var days = DaysOf(cycle);
            var employeeIds = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);

            var assignments = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByCycleAndEmployeesSpec(cycleId, employeeIds), cancellationToken);

            var rows = assignments
                .GroupBy(a => a.EmployeeId)
                .Select(g =>
                {
                    var byDate = g.ToDictionary(a => a.Date, a => a.ShiftTemplateId);
                    return new ShiftAssignmentRowDto
                    {
                        EmployeeId = g.Key,
                        Name = g.First().Employee?.FullName ?? string.Empty,
                        ShiftTemplateIds = days.Select(d => byDate.TryGetValue(d, out var id) ? id : (int?)null).ToList()
                    };
                })
                .OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new ShiftCycleDetailDto
            {
                Id = cycle.Id,
                Start = cycle.StartDate,
                End = cycle.EndDate,
                Status = cycle.Status.ToString(),
                Days = days,
                Assignments = rows
            };
        }

        public async Task<ShiftCycleDto> CreateCycleAsync(
            int actorUserId, int gymId, CreateShiftCycleDto request, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            if (request.EndDate < request.StartDate)
            {
                throw new BadRequestException("The cycle end date must be on or after the start date.");
            }

            var cycle = new ShiftCycle
            {
                GymId = gymId,
                StartDate = request.StartDate,
                EndDate = request.EndDate,
                Status = ShiftCycleStatus.Draft
            };

            await unitOfWork.GetRepository<ShiftCycle, int>().AddAsync(cycle, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return mapper.Map<ShiftCycleDto>(cycle);
        }

        public async Task UpdateAssignmentsAsync(
            int actorUserId, int gymId, int cycleId, UpdateAssignmentsDto request, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var cycle = await LoadCycleAsync(gymId, cycleId, cancellationToken);
            if (cycle.Status == ShiftCycleStatus.Archived)
            {
                throw new BadRequestException("Archived cycles cannot be modified.");
            }

            var employeeIds = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);
            var dates = DaysOf(cycle);
            var repository = unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>();

            var existing = (await repository.GetAllAsync(new AssignmentsByCycleAndEmployeesSpec(cycleId, employeeIds), cancellationToken))
                .ToDictionary(a => (a.EmployeeId, a.Date));

            foreach (var entry in request.Assignments)
            {
                if (!employeeIds.Contains(entry.EmployeeId) || !dates.Contains(entry.Date))
                {
                    throw new BadRequestException("An assignment targets an out-of-scope employee or a date outside the cycle.");
                }

                if (existing.TryGetValue((entry.EmployeeId, entry.Date), out var assignment))
                {
                    if (assignment.ShiftTemplateId != entry.ShiftTemplateId)
                    {
                        assignment.ShiftTemplateId = entry.ShiftTemplateId;
                        repository.Update(assignment);
                    }
                }
                else
                {
                    await repository.AddAsync(new DomainLayer.Models.SchedulingModule.ShiftAssignment
                    {
                        ShiftCycleId = cycle.Id,
                        EmployeeId = entry.EmployeeId,
                        Date = entry.Date,
                        ShiftTemplateId = entry.ShiftTemplateId
                    }, cancellationToken);
                }
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public async Task PublishAsync(int actorUserId, int gymId, int cycleId, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var cycle = await LoadCycleAsync(gymId, cycleId, cancellationToken);
            if (cycle.Status == ShiftCycleStatus.Published)
            {
                return;
            }

            cycle.Status = ShiftCycleStatus.Published;
            cycle.PublishedAt = DateTime.UtcNow;
            cycle.PublishedBy = actorUserId;
            unitOfWork.GetRepository<ShiftCycle, int>().Update(cycle);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public async Task DeleteAsync(int actorUserId, int gymId, int cycleId, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var cycle = await LoadCycleAsync(gymId, cycleId, cancellationToken);

            var assignments = (await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByCycleSpec(cycleId), cancellationToken)).ToList();
            var repository = unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>();
            foreach (var assignment in assignments)
            {
                repository.Remove(assignment);
            }

            unitOfWork.GetRepository<ShiftCycle, int>().Remove(cycle);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public async Task<IReadOnlyList<ShiftTemplateDto>> GetTemplatesAsync(
            int actorUserId, int gymId, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var templates = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftTemplate, int>()
                .GetAllAsync(new ShiftTemplatesByGymSpec(gymId), cancellationToken);

            return templates.Select(t => mapper.Map<ShiftTemplateDto>(t)).ToList();
        }

        public async Task<ShiftTemplateDto> CreateTemplateAsync(
            int actorUserId, int gymId, CreateShiftTemplateDto request, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var template = await SaveTemplateAsync(gymId, null, request.Name, request.Start, request.End, cancellationToken);
            return mapper.Map<ShiftTemplateDto>(template);
        }

        public async Task<ShiftTemplateDto> UpdateTemplateAsync(
            int actorUserId, int gymId, int templateId, UpdateShiftTemplateDto request, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var template = await SaveTemplateAsync(gymId, templateId, request.Name, request.Start, request.End, cancellationToken);
            return mapper.Map<ShiftTemplateDto>(template);
        }

        public async Task DeleteTemplateAsync(int actorUserId, int gymId, int templateId, CancellationToken cancellationToken = default)
        {
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var template = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftTemplate, int>()
                .GetByIdAsync(templateId, cancellationToken)
                ?? throw new NotFoundException("Shift template not found.");

            if (template.GymId != gymId)
            {
                throw new NotFoundException("Shift template not found.");
            }

            // Cells referencing the template become Off Day (null template) so
            // schedules stay valid after the template is gone.
            var assignments = (await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new AssignmentsByTemplateSpec(templateId), cancellationToken)).ToList();

            var repository = unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>();
            foreach (var assignment in assignments)
            {
                assignment.ShiftTemplateId = null;
                repository.Update(assignment);
            }

            unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftTemplate, int>().Remove(template);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ---------- helpers ----------

        private async Task<DomainLayer.Models.SchedulingModule.ShiftTemplate> SaveTemplateAsync(
            int gymId, int? templateId, string name, TimeOnly start, TimeOnly end, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new BadRequestException("A template name is required.");
            }

            if (end <= start)
            {
                throw new BadRequestException("The end time must be after the start time.");
            }

            var repository = unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftTemplate, int>();

            if (templateId is null)
            {
                var template = new DomainLayer.Models.SchedulingModule.ShiftTemplate
                {
                    GymId = gymId,
                    Name = name.Trim(),
                    StartTime = start,
                    EndTime = end,
                    IsActive = true
                };
                await repository.AddAsync(template, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);
                return template;
            }

            var existing = await repository.GetByIdAsync(templateId.Value, cancellationToken)
                ?? throw new NotFoundException("Shift template not found.");

            if (existing.GymId != gymId)
            {
                throw new NotFoundException("Shift template not found.");
            }

            existing.Name = name.Trim();
            existing.StartTime = start;
            existing.EndTime = end;
            repository.Update(existing);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return existing;
        }

        private async Task<ShiftCycle> LoadCycleAsync(int gymId, int cycleId, CancellationToken cancellationToken)
        {
            var cycle = await unitOfWork.GetRepository<ShiftCycle, int>().GetByIdAsync(cycleId, cancellationToken);
            if (cycle is null || cycle.GymId != gymId)
            {
                throw new NotFoundException("Schedule cycle not found.");
            }

            return cycle;
        }

        private async Task<List<int>> ScopedEmployeeIdsAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, gymId, cancellationToken);

            var employees = ledTeamId is not null
                ? await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                    .GetAllAsync(new EmployeesByTeamSpec(ledTeamId.Value), cancellationToken)
                : await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                    .GetAllAsync(new EmployeesByGymSpec(gymId), cancellationToken);

            return employees.Select(e => e.Id).ToList();
        }

        private static List<DateOnly> DaysOf(ShiftCycle cycle)
        {
            var days = new List<DateOnly>();
            for (var day = cycle.StartDate; day <= cycle.EndDate; day = day.AddDays(1))
            {
                days.Add(day);
            }

            return days;
        }

        private static DateOnly ParseMonth(string? month) =>
            DateOnly.TryParseExact($"{month}-01", "yyyy-MM-dd", out var parsed)
                ? new DateOnly(parsed.Year, parsed.Month, 1)
                : new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
    }
}
