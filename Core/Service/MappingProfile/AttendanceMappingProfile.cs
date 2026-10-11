using AutoMapper;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Self-service attendance mappings (mock §6). Status uses the badge vocabulary
/// of the mock ("On Time", "Early Checkout", ...); the summary counters derived
/// from the mapped rows stay in the service.
/// </summary>
public sealed class AttendanceMappingProfile : Profile
{
    public AttendanceMappingProfile()
    {
        CreateMap<AttendanceRecord, AttendanceRecordDto>()
            .ForMember(d => d.Shift, o => o.MapFrom(s => s.ScheduledShiftTemplate == null
                ? "OFF"
                : $"{s.ScheduledShiftTemplate.StartTime:HH\\:mm}-{s.ScheduledShiftTemplate.EndTime:HH\\:mm}"))
            .ForMember(d => d.ShiftName, o => o.MapFrom(s => s.ScheduledShiftTemplate != null ? s.ScheduledShiftTemplate.Name : "Off"))
            .ForMember(d => d.CheckIn, o => o.MapFrom(s => s.CheckInTime.HasValue ? TimeOnly.FromDateTime(s.CheckInTime.Value) : (TimeOnly?)null))
            .ForMember(d => d.CheckOut, o => o.MapFrom(s => s.CheckOutTime.HasValue ? TimeOnly.FromDateTime(s.CheckOutTime.Value) : (TimeOnly?)null))
            .ForMember(d => d.Status, o => o.MapFrom(s => StatusLabel(s.Status)))
            .ForMember(d => d.Source, o => o.MapFrom(s => s.CheckInMethod != null ? s.CheckInMethod.ToString() : string.Empty))
            .ForMember(d => d.Notes, o => o.MapFrom(s => (string?)null));

        CreateMap<LeaveBalance, LeaveBalanceDto>()
            .ForMember(d => d.Total, o => o.MapFrom(s => s.TotalEntitlement))
            .ForMember(d => d.Used, o => o.MapFrom(s => s.UsedDays))
            .ForMember(d => d.Pending, o => o.MapFrom(s => s.PendingDays))
            .ForMember(d => d.Remaining, o => o.MapFrom(s => s.RemainingDays));
    }

    /// <summary>Mock §6 badge vocabulary.</summary>
    internal static string StatusLabel(AttendanceStatus status) => status switch
    {
        AttendanceStatus.OnTime => "On Time",
        AttendanceStatus.Late => "Late",
        AttendanceStatus.Absent => "Absent",
        AttendanceStatus.EarlyCheckout => "Early Checkout",
        AttendanceStatus.MissingCheckout => "Missing Checkout",
        _ => status.ToString()
    };
}
