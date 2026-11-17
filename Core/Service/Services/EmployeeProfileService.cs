using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using DomainLayer.Models.UserModule.Enums;

namespace Service.Services
{
    public class EmployeeProfileService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IMapper mapper) : IEmployeeProfileService
    {
        public async Task<EmployeeProfileDto> GetProfileAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            // Sequential: the three lookups below share one scoped DbContext, and EF Core
            // forbids concurrent operations on a single context (the previous
            // Task.WhenAll version threw InvalidOperationException intermittently).
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken);

            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, activeGymId, cancellationToken);

            var profile = await LoadProfileAsync(employeeId, cancellationToken);

            var isOwner = employee is not null && employee.Id == profile.Id;
            return mapper.Map<EmployeeProfileDto>(profile, opts => opts.Items["includeSalary"] = isOwner);
        }

        public async Task<EmployeeProfileDto> UpdateContactAsync(
            int actorUserId, UpdateContactRequestDto request, CancellationToken cancellationToken = default)
        {
            var employee = await OwnEmployeeOrThrowAsync(actorUserId, cancellationToken);

            employee.Phone = string.IsNullOrWhiteSpace(request.Phone) ? employee.Phone : request.Phone.Trim();
            employee.Address = string.IsNullOrWhiteSpace(request.Address) ? employee.Address : request.Address.Trim();

            unitOfWork.GetRepository<Employee, int>().Update(employee);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // Re-load with full includes so navigations are populated for mapping.
            var updated = await LoadProfileAsync(employee.Id, cancellationToken);
            return mapper.Map<EmployeeProfileDto>(updated, opts => opts.Items["includeSalary"] = true);
        }

        public async Task<EmployeeProfileDto> UpdateEmergencyContactAsync(
            int actorUserId, UpdateEmergencyContactRequestDto request, CancellationToken cancellationToken = default)
        {
            var employee = await OwnEmployeeOrThrowAsync(actorUserId, cancellationToken);

            employee.EmergencyContactName = string.IsNullOrWhiteSpace(request.Name) ? employee.EmergencyContactName : request.Name.Trim();
            employee.EmergencyContactRelationship = string.IsNullOrWhiteSpace(request.Relationship) ? employee.EmergencyContactRelationship : request.Relationship.Trim();
            employee.EmergencyContactPhone = string.IsNullOrWhiteSpace(request.Phone) ? employee.EmergencyContactPhone : request.Phone.Trim();

            unitOfWork.GetRepository<Employee, int>().Update(employee);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // Re-load with full includes so navigations are populated for mapping.
            var updated = await LoadProfileAsync(employee.Id, cancellationToken);
            return mapper.Map<EmployeeProfileDto>(updated, opts => opts.Items["includeSalary"] = true);
        }

        private async Task<Employee> LoadProfileAsync(int employeeId, CancellationToken cancellationToken) =>
            await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeProfileByIdSpec(employeeId), cancellationToken)
            ?? throw new NotFoundException("Employee not found.");

        private async Task<Employee> OwnEmployeeOrThrowAsync(int actorUserId, CancellationToken cancellationToken) =>
            await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
            ?? throw new UnAuthorizedException("This account has no employee profile.");
    }
}
