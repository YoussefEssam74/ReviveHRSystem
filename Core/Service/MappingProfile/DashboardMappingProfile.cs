using AutoMapper;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.SchedulingModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Employee dashboard leaf mappings (mock §1). Aggregates (greeting, month
/// counters, overview strip) are composed in the service; only the per-entity
/// rows live here. Attendance punches are also composed in the service because
/// they must be converted from UTC to the configured gym timezone.
/// </summary>
public sealed class DashboardMappingProfile : Profile
{
    public DashboardMappingProfile()
    {
        CreateMap<Employee, DashboardUserDto>()
            .ForMember(d => d.FirstName, o => o.MapFrom(s => s.FullName
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .FirstOrDefault() ?? string.Empty))
            .ForMember(d => d.Position, o => o.MapFrom(s => s.Position != null ? s.Position.Title : string.Empty))
            .ForMember(d => d.GymName, o => o.MapFrom(s => s.Gym != null ? s.Gym.Name : string.Empty))
            .ForMember(d => d.GymId, o => o.MapFrom(s => s.GymId));

        CreateMap<ShiftAssignment, DashboardShiftDto>()
            .ForMember(d => d.ShiftName, o => o.MapFrom(s => s.ShiftTemplate != null ? s.ShiftTemplate.Name : string.Empty))
            .ForMember(d => d.Start, o => o.MapFrom(s => s.ShiftTemplate != null ? s.ShiftTemplate.StartTime : default))
            .ForMember(d => d.End, o => o.MapFrom(s => s.ShiftTemplate != null ? s.ShiftTemplate.EndTime : default));

        CreateMap<EmployeeDocument, DashboardActionDto>()
            .ForMember(d => d.Title, o => o.MapFrom(s => "Document expiring soon"))
            .ForMember(d => d.Detail, o => o.MapFrom(s => $"{s.FileName} expires {s.ExpiryDate:yyyy-MM-dd}."))
            .ForMember(d => d.Urgent, o => o.MapFrom(s =>
                s.ExpiryDate.HasValue && s.ExpiryDate.Value <= DateOnly.FromDateTime(DateTime.UtcNow).AddDays(14)));
    }
}
