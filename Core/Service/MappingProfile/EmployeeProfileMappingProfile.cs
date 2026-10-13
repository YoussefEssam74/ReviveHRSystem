using AutoMapper;
using DomainLayer.Models.EmployeeModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Employee self-service profile mappings (mock §2.1). Salary is HR-controlled:
/// BaseSalary is only mapped when the caller passes Items["includeSalary"] = true
/// (the service decides ownership); otherwise it is stripped.
/// </summary>
public sealed class EmployeeProfileMappingProfile : Profile
{
    public EmployeeProfileMappingProfile()
    {
        CreateMap<Employee, EmployeeProfileDto>()
            .ForMember(d => d.Position, o => o.MapFrom(s => s.Position != null ? s.Position.Title : string.Empty))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.EmploymentType, o => o.MapFrom(s => s.ContractType))
            .ForMember(d => d.Email, o => o.MapFrom(s => s.User != null ? s.User.Email : string.Empty))
            .ForMember(d => d.Gym, o => o.MapFrom(s => s))
            .ForMember(d => d.EmergencyContact, o => o.MapFrom(s => s))
            .ForMember(d => d.PhotoUrl, o => o.MapFrom(s =>
                string.IsNullOrWhiteSpace(s.PhotoPath) ? null : $"/api/employees/{s.Id}/photo"))
            .ForMember(d => d.BaseSalary, o => o.MapFrom((s, _, _, ctx) =>
                ctx.TryGetItem<bool>("includeSalary") is false
                    ? null
                    : s.Compensations.OrderByDescending(c => c.EffectiveDate).FirstOrDefault()?.Amount));

        CreateMap<Employee, GymSummaryDto>()
            .ForMember(d => d.Id, o => o.MapFrom(s => s.GymId))
            .ForMember(d => d.Name, o => o.MapFrom(s => s.Gym != null ? s.Gym.Name : string.Empty))
            .ForMember(d => d.Branch, o => o.MapFrom(s => s.Gym != null ? s.Gym.Location : null));

        CreateMap<Employee, EmergencyContactDto>()
            .ForMember(d => d.Name, o => o.MapFrom(s => s.EmergencyContactName))
            .ForMember(d => d.Relationship, o => o.MapFrom(s => s.EmergencyContactRelationship))
            .ForMember(d => d.Phone, o => o.MapFrom(s => s.EmergencyContactPhone));
    }
}
