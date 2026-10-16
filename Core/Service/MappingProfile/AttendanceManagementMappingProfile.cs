using AutoMapper;
using DomainLayer.Models.EmployeeModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Branch/team attendance day view (mock §22). The person row comes straight from
/// the Employee; CheckIn/LateMinutes are filled in by the service from the day's
/// record (they live on AttendanceRecord, not on the employee).
/// </summary>
public sealed class AttendanceManagementMappingProfile : Profile
{
    public AttendanceManagementMappingProfile()
    {
        CreateMap<Employee, AttendancePersonDto>()
            .ForMember(d => d.EmployeeId, o => o.MapFrom(s => s.Id))
            .ForMember(d => d.Name, o => o.MapFrom(s => s.FullName))
            .ForMember(d => d.Position, o => o.MapFrom(s => s.Position != null ? s.Position.Title : string.Empty))
            .ForMember(d => d.CheckIn, o => o.MapFrom((s, _, _, ctx) => ctx.TryGetItem<TimeOnly>("checkIn")))
            .ForMember(d => d.LateMinutes, o => o.MapFrom((s, _, _, ctx) => ctx.TryGetItem<int>("lateMinutes")));
    }
}
