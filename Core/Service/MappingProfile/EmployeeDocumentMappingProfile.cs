using AutoMapper;
using DomainLayer.Models.EmployeeModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>Employee document vault mappings (mock §3). Status is derived from the expiry date.</summary>
public sealed class EmployeeDocumentMappingProfile : Profile
{
    public EmployeeDocumentMappingProfile()
    {
        CreateMap<EmployeeDocument, EmployeeDocumentDto>()
            .ForMember(d => d.Name, o => o.MapFrom(s => s.FileName))
            .ForMember(d => d.Category, o => o.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.UploadDate, o => o.MapFrom(s => DateOnly.FromDateTime(s.UploadedAt)))
            .ForMember(d => d.ExpiryDate, o => o.MapFrom(s => s.ExpiryDate))
            .ForMember(d => d.Status, o => o.MapFrom(s => StatusFor(s.ExpiryDate)))
            .ForMember(d => d.CanDownload, o => o.MapFrom(s => !string.IsNullOrWhiteSpace(s.FilePath)));
    }

    private static string StatusFor(DateOnly? expiryDate)
    {
        if (!expiryDate.HasValue)
        {
            return "Valid";
        }

        var daysLeft = expiryDate.Value.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber;
        return daysLeft < 0 ? "Expired"
            : daysLeft <= 30 ? "Expiring Soon"
            : "Valid";
    }
}
