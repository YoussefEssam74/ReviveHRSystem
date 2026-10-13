using AutoMapper;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Employee request mappings (mock §10 / §17). The timeline is the "Submitted"
/// step followed by every decision ("Team Leader Approved", "HR Rejected", ...)
/// — the same shape for the self-service list and the management inbox.
/// </summary>
public sealed class RequestMappingProfile : Profile
{
    public RequestMappingProfile()
    {
        CreateMap<EmployeeRequest, EmployeeRequestDto>()
            .ForMember(d => d.SubmittedDate, o => o.MapFrom(s => DateOnly.FromDateTime(s.SubmittedAt)))
            .ForMember(d => d.RequestDate, o => o.MapFrom(s => s.TargetStartDate ?? s.RequestDate))
            .ForMember(d => d.EndDate, o => o.MapFrom(s => s.TargetEndDate))
            .ForMember(d => d.RequestTime, o => o.MapFrom(s => s.TargetTime))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.Reason, o => o.MapFrom(s => s.Details))
            .ForMember(d => d.Timeline, o => o.MapFrom(s => BuildTimeline(s)));

        CreateMap<RequestComment, RequestCommentDto>()
            .ForMember(d => d.Author, o => o.MapFrom(s => s.AuthorUser != null ? s.AuthorUser.UserName : string.Empty))
            .ForMember(d => d.Date, o => o.MapFrom(s => s.CreatedAt));
    }

    private static IReadOnlyList<RequestTimelineStepDto> BuildTimeline(EmployeeRequest request)
    {
        var steps = new List<RequestTimelineStepDto>
        {
            new() { Step = "Submitted", Done = true }
        };

        foreach (var decision in request.Decisions.OrderBy(d => d.DecidedAt))
        {
            steps.Add(new RequestTimelineStepDto
            {
                Step = decision.Stage switch
                {
                    ApprovalStage.BranchManager => $"Team Leader {decision.Decision}",
                    ApprovalStage.HR => $"HR {decision.Decision}",
                    _ => $"{decision.Stage} {decision.Decision}"
                },
                Date = decision.DecidedAt.ToString("yyyy-MM-dd HH:mm"),
                Done = true
            });
        }

        return steps;
    }
}
