using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject;
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
        IFileStorage fileStorage,
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

        /// <summary>
        /// Materialises the employee's own vault for one employee. HR-published official
        /// documents are a separate screen and a separate query.
        /// </summary>
        private async Task<List<EmployeeDocumentDto>> ProjectAsync(int employeeId, CancellationToken cancellationToken)
        {
            var repository = unitOfWork.GetRepository<EmployeeDocument, int>();
            var documents = await repository.GetAllAsync(
                new DocumentsByEmployeeSpec(employeeId, DocumentSource.Employee), cancellationToken);

            return documents
                .Select(d => mapper.Map<EmployeeDocumentDto>(d))
                .ToList();
        }

        public async Task<IReadOnlyList<HrDocumentDto>> GetHrDocumentsAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            var documents = await unitOfWork.GetRepository<EmployeeDocument, int>()
                .GetAllAsync(new DocumentsByEmployeeSpec(employeeId, DocumentSource.Hr), cancellationToken);

            return documents
                .Select(d => new HrDocumentDto
                {
                    Id = d.Id,
                    Name = d.FileName,
                    Category = d.Type.ToString(),
                    AddedDate = DateOnly.FromDateTime(d.UploadedAt),
                    SizeBytes = d.SizeBytes,
                    Size = FormatSize(d)
                })
                .ToList();
        }

        public async Task<FileDownload> DownloadAsync(
            int actorUserId, int employeeId, int documentId, DocumentSource source, int? activeGymId,
            CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            var document = await unitOfWork.GetRepository<EmployeeDocument, int>()
                .GetByIdAsync(new DocumentByIdSpec(documentId), cancellationToken);

            // Every failure below answers 404 with the same message: an id that is not
            // readable and an id that does not exist must be indistinguishable, or the
            // route leaks which document ids exist.
            if (document is null || document.EmployeeId != employeeId || document.Source != source)
            {
                throw new NotFoundException("Document not found.");
            }

            return OpenOrMissing(document);
        }

        public async Task<PhotoUploadResultDto> UploadPhotoAsync(
            int actorUserId, int employeeId, string fileName, Stream content, CancellationToken cancellationToken = default)
        {
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
                ?? throw new UnAuthorizedException("This account has no employee profile.");

            if (employee.Id != employeeId)
            {
                throw new NotFoundException("Employee not found.");
            }

            if (string.IsNullOrWhiteSpace(fileName))
            {
                throw new BadRequestException("A file name is required.");
            }

            var stored = await SaveOrRefuseAsync("avatars", fileName, content, cancellationToken);
            var previous = employee.PhotoPath;

            try
            {
                employee.PhotoPath = stored.RelativePath;
                unitOfWork.GetRepository<Employee, int>().Update(employee);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch
            {
                // The row never moved on, so the new file is orphaned; a failed
                // cleanup must not mask the original failure.
                try
                {
                    fileStorage.Delete(stored.RelativePath);
                }
                catch
                {
                }

                throw;
            }

            // The superseded avatar is orphaned once the row moves on, so it is removed
            // after the commit rather than before it — keeping the new file is what the
            // caller asked for, and a leftover old one is only wasted space.
            if (!string.IsNullOrWhiteSpace(previous) && previous != stored.RelativePath)
            {
                fileStorage.Delete(previous);
            }

            return new PhotoUploadResultDto { PhotoUrl = $"/api/employees/{employee.Id}/photo" };
        }

        public async Task<FileDownload> GetPhotoAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeProfileByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            if (string.IsNullOrWhiteSpace(employee.PhotoPath))
            {
                throw new NotFoundException("No photo has been uploaded for this employee.");
            }

            var content = fileStorage.TryOpenRead(employee.PhotoPath)
                ?? throw new NotFoundException("No photo has been uploaded for this employee.");

            return new FileDownload(content, "photo", FileContentTypes.FromFileName(employee.PhotoPath));
        }

        /// <summary>
        /// Storage refuses what it will not write (unknown category, unsupported
        /// extension, over the size cap); that is a problem with the request, so it is
        /// surfaced as a 400 rather than falling through as a 500.
        /// </summary>
        private async Task<StoredFileInfo> SaveOrRefuseAsync(
            string category, string fileName, Stream content, CancellationToken cancellationToken)
        {
            try
            {
                return await fileStorage.SaveAsync(category, fileName, content, cancellationToken);
            }
            catch (InvalidOperationException e)
            {
                throw new BadRequestException(e.Message);
            }
        }

        /// <summary>
        /// Opens the stored bytes, or reports the row as un-downloadable. A row can be
        /// metadata only (uploaded before binaries were stored), and CanDownload is what
        /// tells the client so — here that becomes a 404 rather than an empty 200.
        /// </summary>
        private FileDownload OpenOrMissing(EmployeeDocument document)
        {
            var content = string.IsNullOrWhiteSpace(document.FilePath)
                ? null
                : fileStorage.TryOpenRead(document.FilePath);

            if (content is null)
            {
                throw new NotFoundException("No file is stored for this document.");
            }

            return new FileDownload(content, document.FileName, document.ContentType ?? "application/octet-stream");
        }

        /// <summary>Display size in the shape the mock shows ("PDF · 2.1 MB").</summary>
        private static string FormatSize(EmployeeDocument document)
        {
            if (document.SizeBytes is not long bytes)
            {
                return string.Empty;
            }

            var label = string.IsNullOrWhiteSpace(document.ContentType)
                ? Path.GetExtension(document.FileName).TrimStart('.').ToUpperInvariant()
                : TypeLabel(document.ContentType);

            var size = bytes >= 1024 * 1024
                ? $"{bytes / (1024d * 1024d):0.#} MB"
                : bytes >= 1024
                    ? $"{bytes / 1024d:0.#} KB"
                    : $"{bytes} B";

            return $"{label} · {size}";
        }

        private static string TypeLabel(string contentType) => contentType switch
        {
            "application/pdf" => "PDF",
            "image/png" => "PNG",
            "image/jpeg" => "JPG",
            "image/webp" => "WEBP",
            "image/gif" => "GIF",
            _ => contentType
        };

        private static readonly Dictionary<DocumentType, string> RequiredLabels = new()
        {
            [DocumentType.Contract] = "Employment Contract",
            [DocumentType.NationalId] = "National ID (Front & Back)",
            [DocumentType.Certification] = "Certifications",
            [DocumentType.Other] = "Other Documents"
        };
    }
}
