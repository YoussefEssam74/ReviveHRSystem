using AutoMapper;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using Service.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Employee request mappings (mock §10 / §17). The timeline is the "Submitted"
/// step followed by every decision ("BM Approved", "HR Rejected", ...) — built by
/// the same helper the management drawer uses, so both surfaces agree.
/// </summary>
public sealed class RequestMappingProfile : Profile
{
    public RequestMappingProfile()
    {
        CreateMap<EmployeeRequest, EmployeeRequestDto>()
            .ForMember(d => d.EmployeeId, o => o.MapFrom(s => s.EmployeeId))
            .ForMember(d => d.EmployeeName, o => o.MapFrom(s => s.Employee != null ? s.Employee.FullName : string.Empty))
            .ForMember(d => d.SubmittedDate, o => o.MapFrom(s => DateOnly.FromDateTime(s.SubmittedAt)))
            .ForMember(d => d.SubmittedAt, o => o.MapFrom(s => s.SubmittedAt))
            .ForMember(d => d.RequestDate, o => o.MapFrom(s => s.RequestDate))
            .ForMember(d => d.EndDate, o => o.MapFrom(s => s.TargetEndDate))
            .ForMember(d => d.TargetDate, o => o.MapFrom(s => s.TargetStartDate))
            .ForMember(d => d.RequestTime, o => o.MapFrom(s => s.TargetTime))
            .ForMember(d => d.Hours, o => o.MapFrom(s => s.RequestedHours))
            .ForMember(d => d.Amount, o => o.MapFrom(s => s.RequestedAmount))
            .ForMember(d => d.SwapWithEmployeeId, o => o.MapFrom(s => s.SwapWithEmployeeId))
            .ForMember(d => d.SwapWithEmployeeName, o => o.MapFrom(s => s.SwapWithEmployee != null ? s.SwapWithEmployee.FullName : null))
            .ForMember(d => d.HasAttachment, o => o.MapFrom(s => !string.IsNullOrEmpty(s.AttachmentPath)))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.Reason, o => o.MapFrom(s => s.Details))
            .ForMember(d => d.Payment, o => o.MapFrom(s => s.Payment))
            .ForMember(d => d.CalculatedDays, o => o.MapFrom(s => s.OvertimeHoursRequested.HasValue ? (int?)s.OvertimeHoursRequested.Value : (s.Payment != null && s.Payment.Contains("2") ? (int?)2 : (s.Payment != null && s.Payment.Contains("1") ? (int?)1 : null))))
            .ForMember(d => d.BmDecidedAt, o => o.MapFrom(s => s.Decisions
                .Where(decision => decision.Stage == ApprovalStage.BranchManager)
                .OrderByDescending(decision => decision.DecidedAt)
                .Select(decision => (DateTime?)decision.DecidedAt)
                .FirstOrDefault()))
            .ForMember(d => d.HrDecidedAt, o => o.MapFrom(s => s.Decisions
                .Where(decision => decision.Stage == ApprovalStage.HR)
                .OrderByDescending(decision => decision.DecidedAt)
                .Select(decision => (DateTime?)decision.DecidedAt)
                .FirstOrDefault()))
            .ForMember(d => d.BmComment, o => o.MapFrom(s => s.Decisions
                .Where(decision => decision.Stage == ApprovalStage.BranchManager)
                .OrderByDescending(decision => decision.DecidedAt)
                .Select(decision => decision.Comment)
                .FirstOrDefault()))
            // One timeline builder for every surface: the drawer and the employee's own
            // list must show identical steps and identical clocks.
            .ForMember(d => d.Timeline, o => o.MapFrom(s => RequestService.BuildSharedTimeline(s)));

        CreateMap<RequestComment, RequestCommentDto>()
            .ForMember(d => d.Author, o => o.MapFrom(s => s.AuthorUser != null ? s.AuthorUser.UserName : string.Empty))
            .ForMember(d => d.Date, o => o.MapFrom(s => s.CreatedAt));

        CreateMap<Gym, AttendancePolicyDto>()
            .ForMember(d => d.GymId, o => o.MapFrom(s => s.Id))
            .ForMember(d => d.GymName, o => o.MapFrom(s => s.Name));
    }
}
