using AutoMapper;
using DomainLayer.Models.SchedulingModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Schedule mappings: employee schedule days (mock §7) and shift-management
/// cycles/templates (mock §15-16). IsToday is computed against "today" unless the
/// service passes Items["today"] explicitly.
/// </summary>
public sealed class ScheduleMappingProfile : Profile
{
    public ScheduleMappingProfile()
    {
        CreateMap<ShiftAssignment, ScheduleDayDto>()
            .ForMember(d => d.DayName, o => o.MapFrom(s => s.Date.DayOfWeek.ToString()))
            .ForMember(d => d.ShiftName, o => o.MapFrom(s => s.ShiftTemplate != null ? s.ShiftTemplate.Name : null))
            .ForMember(d => d.Start, o => o.MapFrom(s => s.ShiftTemplate != null ? s.ShiftTemplate.StartTime : (TimeOnly?)null))
            .ForMember(d => d.End, o => o.MapFrom(s => s.ShiftTemplate != null ? s.ShiftTemplate.EndTime : (TimeOnly?)null))
            .ForMember(d => d.IsOff, o => o.MapFrom(s => s.ShiftTemplateId == null))
            .ForMember(d => d.IsToday, o => o.MapFrom((s, _, _, ctx) =>
                s.Date == (ctx.TryGetItem<DateOnly>("today") ?? DateOnly.FromDateTime(DateTime.UtcNow))));

        CreateMap<ShiftCycle, ScheduleCycleDto>()
            .ForMember(d => d.Start, o => o.MapFrom(s => s.StartDate))
            .ForMember(d => d.End, o => o.MapFrom(s => s.EndDate))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()));

        CreateMap<ShiftCycle, ShiftCycleDto>()
            .ForMember(d => d.Start, o => o.MapFrom(s => s.StartDate))
            .ForMember(d => d.End, o => o.MapFrom(s => s.EndDate))
            .ForMember(d => d.Label, o => o.MapFrom(s => $"{s.StartDate:MMM d} - {s.EndDate:MMM d}"))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.Custom, o => o.MapFrom(s => false));

        CreateMap<ShiftTemplate, ShiftTemplateDto>()
            .ForMember(d => d.Start, o => o.MapFrom(s => s.StartTime))
            .ForMember(d => d.End, o => o.MapFrom(s => s.EndTime));
    }
}
