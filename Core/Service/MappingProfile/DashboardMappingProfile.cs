using AutoMapper;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.SchedulingModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Employee dashboard leaf mappings (mock §1). Aggregates (greeting, month
/// counters, overview strip) are composed in the service; only the per-entity
/// rows live here.
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
            .ForMember(d => d.GymName, o => o.MapFrom(s => s.Gym != null ? s.Gym.Name : string.Empty));

        CreateMap<ShiftAssignment, DashboardShiftDto>()
            .ForMember(d => d.ShiftName, o => o.MapFrom(s => s.ShiftTemplate != null ? s.ShiftTemplate.Name : string.Empty))
            .ForMember(d => d.Start, o => o.MapFrom(s => s.ShiftTemplate != null ? s.ShiftTemplate.StartTime : default))
            .ForMember(d => d.End, o => o.MapFrom(s => s.ShiftTemplate != null ? s.ShiftTemplate.EndTime : default));

        CreateMap<AttendanceRecord, DashboardAttendanceDto>()
            .ForMember(d => d.CheckIn, o => o.MapFrom(s => s.CheckInTime.HasValue ? TimeOnly.FromDateTime(s.CheckInTime.Value) : (TimeOnly?)null))
            .ForMember(d => d.CheckOut, o => o.MapFrom(s => s.CheckOutTime.HasValue ? TimeOnly.FromDateTime(s.CheckOutTime.Value) : (TimeOnly?)null))
            .ForMember(d => d.CheckedIn, o => o.MapFrom(s => s.CheckInTime != null))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.Source, o => o.MapFrom(s => s.CheckInMethod != null ? s.CheckInMethod.ToString() : string.Empty));

        CreateMap<EmployeeDocument, DashboardActionDto>()
            .ForMember(d => d.Title, o => o.MapFrom(s => "Document expiring soon"))
            .ForMember(d => d.Detail, o => o.MapFrom(s => $"{s.FileName} expires {s.ExpiryDate:yyyy-MM-dd}."))
            .ForMember(d => d.Urgent, o => o.MapFrom(s =>
                s.ExpiryDate.HasValue && s.ExpiryDate.Value <= DateOnly.FromDateTime(DateTime.UtcNow).AddDays(14)));
    }
}
