using AutoMapper;
using DomainLayer.Models.EmployeeModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Team Actions (mock 13.5-13.8 / 19). Follow-ups carry no separate label for the
/// mock's "type" field, so the description doubles as it; the action type and
/// severity are stored as enums and rendered as their names.
/// </summary>
public sealed class TeamActionsMappingProfile : Profile
{
    public TeamActionsMappingProfile()
    {
        CreateMap<TeamFollowUp, TeamFollowUpDto>()
            .ForMember(d => d.Employee, o => o.MapFrom(s => s.Employee != null ? s.Employee.FullName : string.Empty))
            .ForMember(d => d.ActionType, o => o.MapFrom(s => s.ActionType.ToString()))
            .ForMember(d => d.Severity, o => o.MapFrom(s => s.Severity.ToString()));
    }
}
