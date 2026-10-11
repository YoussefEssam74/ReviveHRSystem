using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Employee documents (mock §3). The vault reads EmployeeDocuments; the checklist
    /// is derived from the DocumentType catalog (configurable by extending the enum);
    /// uploads create a new document for the caller's own profile. Status is derived
    /// from the expiry date (Valid / Expiring Soon / Expired).
    /// </summary>
    public class EmployeeDocumentService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IMapper mapper) : IEmployeeDocumentService
    {
        private static readonly DateOnly[] EmptyDates = Array.Empty<DateOnly>();

        public async Task<IReadOnlyList<EmployeeDocumentDto>> GetDocumentsAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            return await ProjectAsync(employeeId, cancellationToken);
        }

        public async Task<IReadOnlyList<RequiredDocumentDto>> GetRequiredDocumentsAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            var documents = await ProjectAsync(employeeId, cancellationToken);
            var uploaded = documents.ToLookup(d => d.Category, StringComparer.OrdinalIgnoreCase);

            return Enum.GetValues<DocumentType>()
                .Select(type => new RequiredDocumentDto
                {
                    Key = type.ToString().ToLowerInvariant(),
                    Label = RequiredLabels.TryGetValue(type, out var label) ? label : type.ToString(),
                    DocumentId = uploaded[type.ToString()].FirstOrDefault()?.Id
                })
                .ToList();
        }

        public async Task<EmployeeDocumentDto> UploadAsync(
            int actorUserId, int employeeId, UploadDocumentRequestDto request, CancellationToken cancellationToken = default)
        {
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
                ?? throw new UnAuthorizedException("This account has no employee profile.");

            if (employee.Id != employeeId)
            {
                throw new NotFoundException("Employee not found.");
            }

            if (string.IsNullOrWhiteSpace(request.FileName))
            {
                throw new BadRequestException("A file name is required.");
            }

            if (!Enum.TryParse<DocumentType>(request.Category, ignoreCase: true, out var documentType))
            {
                throw new BadRequestException($"Unknown document category '{request.Category}'.");
            }

            var document = new EmployeeDocument
            {
                EmployeeId = employee.Id,
                Type = documentType,
                FileName = request.FileName.Trim(),
                FilePath = request.FilePath?.Trim() ?? string.Empty,
                ExpiryDate = request.ExpiryDate,
                EmployeeEditable = true
            };

            await unitOfWork.GetRepository<EmployeeDocument, int>().AddAsync(document, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            var documents = await ProjectAsync(employee.Id, cancellationToken);
            return documents.First(d => d.Id == document.Id);
        }

        /// <summary>Materialises the vault for one employee.</summary>
        private async Task<List<EmployeeDocumentDto>> ProjectAsync(int employeeId, CancellationToken cancellationToken)
        {
            var repository = unitOfWork.GetRepository<EmployeeDocument, int>();
            var documents = await repository.GetAllAsync(new DocumentsByEmployeeSpec(employeeId), cancellationToken);

            return documents
                .Select(d => mapper.Map<EmployeeDocumentDto>(d))
                .ToList();
        }

        private static readonly Dictionary<DocumentType, string> RequiredLabels = new()
        {
            [DocumentType.Contract] = "Employment Contract",
            [DocumentType.NationalId] = "National ID (Front & Back)",
            [DocumentType.Certification] = "Certifications",
            [DocumentType.Other] = "Other Documents"
        };

        private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);
    }
}
