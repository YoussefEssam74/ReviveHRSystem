using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared;
using Shared.DataTransferObject.EmployeeProfile;
using Shared.DataTransferObject.QueryParams;

namespace Service.Services
{
    /// <summary>
    /// Employee management (mock Â§21). Scope: the caller's team when he is a
    /// team-scoped leader in the active gym, otherwise the gym (ADR-003 Amendment 1).
    /// Out-of-scope targets answer 404 (no existence leak). Status changes are
    /// recorded on the employment-history timeline (history is preserved).
    /// </summary>
    public class EmployeeManagementService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService,
        IPasswordHasher passwordHasher,
        IMapper mapper) : IEmployeeManagementService
    {
        public async Task<PaginationResult<EmployeeSummaryDto>> GetDirectoryAsync(
            int actorUserId, int? activeGymId, EmployeeQueryParams query, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            var employees = await LoadScopedEmployeesAsync(actorUserId, gymId, cancellationToken);

            // Filtering happens on the already-loaded scoped set (team or gym), which is
            // small; only the slice is projected, so the page costs one materialization.
            var filtered = employees
                .Where(e => string.IsNullOrWhiteSpace(query.Q)
                    || e.FullName.Contains(query.Q, StringComparison.OrdinalIgnoreCase))
                .Where(e => string.IsNullOrWhiteSpace(query.Status)
                    || e.Status.ToString().Equals(query.Status, StringComparison.OrdinalIgnoreCase))
                .Where(e => query.PositionId is null || e.PositionId == query.PositionId);

            // A stable order is part of the paging contract: without it, "page 2" is
            // undefined when rows shift between requests.
            var ordered = (query.SortBy?.ToLowerInvariant()) switch
            {
                "status" => filtered.OrderBy(e => e.Status).ThenBy(e => e.FullName, StringComparer.OrdinalIgnoreCase),
                _ => filtered.OrderBy(e => e.FullName, StringComparer.OrdinalIgnoreCase)
            };

            var page = ordered
                .Skip(query.SkipCount)
                .Take(query.PageSize)
                .Select(e => mapper.Map<EmployeeSummaryDto>(e))
                .ToList();

            return new PaginationResult<EmployeeSummaryDto>(query.PageNumber, query.PageSize, filtered.Count(), page);
        }

        public async Task<EmployeeSummaryDto> CreateAsync(
            int actorUserId, int? activeGymId, CreateEmployeeDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            if (string.IsNullOrWhiteSpace(request.FullName))
            {
                throw new BadRequestException("A full name is required.");
            }

            var position = await unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Position, int>()
                .GetByIdAsync(new PositionByIdAndGymSpec(request.PositionId, gymId), cancellationToken)
                ?? throw new BadRequestException("The selected position does not belong to the active gym.");

            var employeeNumber = await NextEmployeeNumberAsync(cancellationToken);

            // Every employee needs exactly one login account (User is 1:1 with Employee):
            // manual creation provisions the account with a random temporary password,
            // exactly like the candidate-to-hire flow. The plaintext is never stored or
            // returned; a password-set/reset flow belongs to the account lifecycle.
            var temporaryPassword = Guid.NewGuid().ToString("N")[..12] + "A1";
            var user = new User
            {
                Email = $"{employeeNumber.ToLowerInvariant()}@revive.hr",
                UserName = employeeNumber.ToLowerInvariant(),
                PasswordHash = passwordHasher.Hash(temporaryPassword),
                UserType = UserType.Employee,
                IsActive = true
            };
            await unitOfWork.GetRepository<User, int>().AddAsync(user, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            var employee = new Employee
            {
                UserId = user.Id,
                FullName = request.FullName.Trim(),
                GymId = gymId,
                PositionId = position.Id,
                EmployeeNumber = employeeNumber,
                HireDate = DateOnly.FromDateTime(DateTime.UtcNow),
                ContractType = "FullTime",
                ContractStartDate = DateOnly.FromDateTime(DateTime.UtcNow),
                Status = EmployeeStatus.Active,
                // Team-scoped leaders create members of their own team.
                TeamId = await teamScopeService.IsTeamScopedAsync(actorUserId, gymId, cancellationToken)
                    ? await teamScopeService.GetLedTeamIdAsync(actorUserId, gymId, cancellationToken)
                    : null
            };

            await unitOfWork.GetRepository<Employee, int>().AddAsync(employee, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return mapper.Map<EmployeeSummaryDto>(employee);
        }

        public async Task<EmployeeSummaryDto> UpdateAsync(
            int actorUserId, int employeeId, int? activeGymId, UpdateEmployeeDto request, CancellationToken cancellationToken = default)
        {
            var employee = await LoadScopedEmployeeAsync(actorUserId, employeeId, RequireGym(activeGymId), cancellationToken);

            if (!string.IsNullOrWhiteSpace(request.FullName))
            {
                employee.FullName = request.FullName.Trim();
            }

            if (request.PositionId > 0 && request.PositionId != employee.PositionId)
            {
                var position = await unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Position, int>()
                    .GetByIdAsync(new PositionByIdAndGymSpec(request.PositionId, employee.GymId), cancellationToken)
                    ?? throw new BadRequestException("The selected position does not belong to the employee's gym.");
                employee.PositionId = position.Id;
            }

            if (!string.IsNullOrWhiteSpace(request.Status)
                && !Enum.TryParse<EmployeeStatus>(request.Status, ignoreCase: true, out var status))
            {
                throw new BadRequestException($"Unknown employment status '{request.Status}'.");
            }

            unitOfWork.GetRepository<Employee, int>().Update(employee);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return mapper.Map<EmployeeSummaryDto>(employee);
        }

        public async Task ChangeStatusAsync(
            int actorUserId, int employeeId, int? activeGymId, ChangeEmployeeStatusDto request, CancellationToken cancellationToken = default)
        {
            var employee = await LoadScopedEmployeeAsync(actorUserId, employeeId, RequireGym(activeGymId), cancellationToken);

            if (!Enum.TryParse<EmployeeStatus>(request.Status, ignoreCase: true, out var status))
            {
                throw new BadRequestException($"Unknown employment status '{request.Status}'.");
            }

            var previous = employee.Status;
            if (previous == status)
            {
                return;
            }

            employee.Status = status;
            unitOfWork.GetRepository<Employee, int>().Update(employee);

            // Status changes are timeline events: history is preserved, never overwritten.
            var history = new EmploymentHistory
            {
                EmployeeId = employee.Id,
                ChangeType = EmploymentChangeType.StatusChange,
                OldValueJson = System.Text.Json.JsonSerializer.Serialize(previous.ToString()),
                NewValueJson = System.Text.Json.JsonSerializer.Serialize(status.ToString()),
                EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
                ChangedBy = actorUserId,
                Reason = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim()
            };
            await unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(history, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ---------- scope helpers ----------

        private async Task<List<Employee>> LoadScopedEmployeesAsync(
            int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, gymId, cancellationToken);

            var employees = ledTeamId is not null
                ? await unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByTeamSpec(ledTeamId.Value), cancellationToken)
                : await unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByGymSpec(gymId), cancellationToken);

            return employees.ToList();
        }

        private async Task<Employee> LoadScopedEmployeeAsync(
            int actorUserId, int employeeId, int activeGymId, CancellationToken cancellationToken)
        {
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeProfileByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            // The active gym governs everything: an employee outside it is invisible,
            // regardless of what the caller could do in his own gym.
            if (employee.GymId != activeGymId)
            {
                throw new NotFoundException("Employee not found.");
            }

            var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, activeGymId, cancellationToken);
            if (ledTeamId is not null && employee.TeamId != ledTeamId.Value)
            {
                throw new NotFoundException("Employee not found.");
            }

            return employee;
        }

        private static int RequireGym(int? activeGymId) =>
            activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

        private async Task<string> NextEmployeeNumberAsync(CancellationToken cancellationToken)
        {
            // The high-water mark must cover every stored number: seeded or imported
            // employees can sit outside the newest Id rows, and the number doubles as
            // the login, so reusing one would collide with an existing account.
            var employees = await unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(new LatestEmployeesSpec(), cancellationToken);

            var max = employees
                .Select(e => int.TryParse(e.EmployeeNumber.Replace("EMP-", string.Empty), out var n) ? n : 0)
                .DefaultIfEmpty(1000)
                .Max();
            return $"EMP-{max + 1}";
        }
    }
}
