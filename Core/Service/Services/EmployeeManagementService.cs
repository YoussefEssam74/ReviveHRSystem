using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

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
        public async Task<IReadOnlyList<EmployeeSummaryDto>> GetDirectoryAsync(
            int actorUserId, int? activeGymId, string? query, string? status, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            var employees = await LoadScopedEmployeesAsync(actorUserId, gymId, cancellationToken);

            return employees
                .Where(e => string.IsNullOrWhiteSpace(query)
                    || e.FullName.Contains(query, StringComparison.OrdinalIgnoreCase))
                .Where(e => string.IsNullOrWhiteSpace(status)
                    || e.Status.ToString().Equals(status, StringComparison.OrdinalIgnoreCase))
                .Select(e => mapper.Map<EmployeeSummaryDto>(e))
                .ToList();
        }

        public async Task<EmployeeSummaryDto> CreateAsync(
            int actorUserId, int? activeGymId, CreateEmployeeDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            if (string.IsNullOrWhiteSpace(request.FullName))
            {
                throw new BadRequestException("A full name is required.");
            }

            var positions = await unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Position, int>()
                .GetAllAsync(new PositionsByGymSpec(gymId), cancellationToken);
            var position = positions.FirstOrDefault(p => p.Id == request.PositionId)
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
                var positions = await unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Position, int>()
                    .GetAllAsync(new PositionsByGymSpec(employee.GymId), cancellationToken);
                var position = positions.FirstOrDefault(p => p.Id == request.PositionId)
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

            var inScope = (await LoadScopedEmployeesAsync(actorUserId, activeGymId, cancellationToken))
                .Any(e => e.Id == employee.Id);

            if (!inScope)
            {
                throw new NotFoundException("Employee not found.");
            }

            return employee;
        }

        private static int RequireGym(int? activeGymId) =>
            activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

        private async Task<string> NextEmployeeNumberAsync(CancellationToken cancellationToken)
        {
            var employees = await unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(cancellationToken);
            var max = employees
                .Select(e => int.TryParse(e.EmployeeNumber.Replace("EMP-", string.Empty), out var n) ? n : 0)
                .DefaultIfEmpty(1000)
                .Max();
            return $"EMP-{max + 1}";
        }
    }
}
