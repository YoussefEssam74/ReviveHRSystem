using AutoMapper;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Team overview, vacancy requests and offboarding (mock §13/§23/§24).
/// Requests carry no creation timestamp, so a pending request shows today's date;
/// once decided, the decision date is shown. RequestedBy is the requester's user
/// name when the navigation is loaded (list reads), empty for just-created rows.
/// </summary>
public sealed class TeamRecruitmentOffboardingMappingProfile : Profile
{
    public TeamRecruitmentOffboardingMappingProfile()
    {
        CreateMap<Team, TeamDto>()
            .ForMember(d => d.MemberCount, o => o.MapFrom((s, _, _, ctx) =>
            {
                var selfId = ctx.TryGetItem<int>("selfEmployeeId");
                return selfId.HasValue ? s.Members.Count(m => m.Id != selfId.Value) : s.Members.Count;
            }));

        CreateMap<VacancyRequest, VacancyRequestDto>()
            .ForMember(d => d.Position, o => o.MapFrom(s => s.Position != null ? s.Position.Title : string.Empty))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.Date, o => o.MapFrom(s => DateOnly.FromDateTime(s.DecidedAt ?? DateTime.UtcNow)))
            .ForMember(d => d.RequestedBy, o => o.MapFrom(s => s.Requester != null ? s.Requester.UserName : string.Empty));

        CreateMap<OffboardingCase, OffboardingCaseDto>()
            .ForMember(d => d.Employee, o => o.MapFrom(s => s.Employee != null ? s.Employee.FullName : string.Empty))
            .ForMember(d => d.Position, o => o.MapFrom(s => s.Employee != null && s.Employee.Position != null ? s.Employee.Position.Title : string.Empty));
    }
}
