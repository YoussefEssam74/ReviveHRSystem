using AutoMapper;
using DomainLayer.Models.EmployeeModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>Employee directory mappings (mock §21).</summary>
public sealed class EmployeeManagementMappingProfile : Profile
{
    public EmployeeManagementMappingProfile()
    {
        CreateMap<Employee, EmployeeSummaryDto>()
            .ForMember(d => d.Name, o => o.MapFrom(s => s.FullName))
            .ForMember(d => d.Position, o => o.MapFrom(s => s.Position != null ? s.Position.Title : string.Empty))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.Initials, o => o.MapFrom(s => string.Concat(s.FullName
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Take(2)
                .Select(w => char.ToUpperInvariant(w[0])))));
    }
}
