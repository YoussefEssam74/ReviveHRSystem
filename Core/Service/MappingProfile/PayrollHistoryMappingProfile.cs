using System.Text.Json;
using AutoMapper;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>
/// Payroll, employment-history, evaluation and event feed mappings (mock §4/§5/§8/§9).
/// JSONB payloads (history old/new values, evaluation answers) are unwrapped/parsed here.
/// </summary>
public sealed class PayrollHistoryMappingProfile : Profile
{
    public PayrollHistoryMappingProfile()
    {
        CreateMap<PayrollEntry, PayrollEntryDto>()
            .ForMember(d => d.Period, o => o.MapFrom(s => s.PayrollPeriod.StartDate.ToString("MMMM yyyy")))
            .ForMember(d => d.Status, o => o.MapFrom(s => PayrollStatusLabel(s.PayrollPeriod.Status)))
            .ForMember(d => d.PaidDate, o => o.MapFrom(s => s.PayrollPeriod.Status == PayrollPeriodStatus.Locked ? s.PayrollPeriod.EndDate : (DateOnly?)null))
            .ForMember(d => d.Visible, o => o.MapFrom(s => s.PayrollPeriod.Status != PayrollPeriodStatus.Open))
            .ForMember(d => d.NetSalary, o => o.MapFrom(s => s.NetPay))
            .ForMember(d => d.Items, o => o.MapFrom(s => s.LineItems.OrderBy(li => li.EffectiveDate)));

        CreateMap<PayrollEntryLineItem, PayrollLineItemDto>()
            .ForMember(d => d.Kind, o => o.MapFrom(s => s.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase) ? "deduction" : "earning"));

        CreateMap<EmploymentHistory, EmploymentHistoryEventDto>()
            .ForMember(d => d.Type, o => o.MapFrom(s => s.ChangeType.ToString()))
            .ForMember(d => d.From, o => o.MapFrom(s => Unwrap(s.OldValueJson)))
            .ForMember(d => d.To, o => o.MapFrom(s => Unwrap(s.NewValueJson)))
            .ForMember(d => d.Effective, o => o.MapFrom(s => s.EffectiveDate))
            .ForMember(d => d.Detail, o => o.MapFrom(s => s.Reason));

        CreateMap<EvaluationAnswer, EvaluationCriterionDto>()
            .ForMember(d => d.Name, o => o.MapFrom(s => s.EvaluationQuestion.QuestionText))
            .ForMember(d => d.Score, o => o.MapFrom(s => NumericAnswer(s) ?? 0))
            .ForMember(d => d.Comment, o => o.MapFrom(s => (string?)null));

        CreateMap<Event, EmployeeEventDto>()
            .ForMember(d => d.Type, o => o.MapFrom(s => EventTypeLabel(s.Type)))
            .ForMember(d => d.Category, o => o.MapFrom(s =>
                s.Type == EventType.DocumentExpiry || s.Type == EventType.ContractExpiry
                    ? "Compliance"
                    : "Onboarding"))
            .ForMember(d => d.Detail, o => o.MapFrom(s => s.Description))
            .ForMember(d => d.Date, o => o.MapFrom(s => DateOnly.FromDateTime(s.CreatedAt)))
            .ForMember(d => d.Urgent, o => o.MapFrom(s => s.Status == EventStatus.Open));

        CreateMap<Announcement, EmployeeEventDto>()
            .ForMember(d => d.Type, o => o.MapFrom(s => "Announcement"))
            .ForMember(d => d.Category, o => o.MapFrom(s => "HR Announcements"))
            .ForMember(d => d.Detail, o => o.MapFrom(s => s.Body))
            .ForMember(d => d.Date, o => o.MapFrom(s => DateOnly.FromDateTime(s.SentAt ?? s.ScheduledAt ?? DateTime.UtcNow)))
            .ForMember(d => d.Urgent, o => o.MapFrom(s => false));
    }

    private static string EventTypeLabel(EventType type) => type switch
    {
        EventType.DocumentExpiry => "Document Expiry",
        EventType.ContractExpiry => "Contract",
        _ => type.ToString()
    };

    private static string PayrollStatusLabel(PayrollPeriodStatus status) => status switch
    {
        PayrollPeriodStatus.Open => "Processing",
        PayrollPeriodStatus.Approved => "Approved",
        PayrollPeriodStatus.Locked => "Paid",
        _ => status.ToString()
    };

    /// <summary>History values are JSONB payloads: a plain JSON string unwraps to its text.</summary>
    private static string? Unwrap(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.ValueKind == JsonValueKind.String
                ? document.RootElement.GetString()
                : json;
        }
        catch (JsonException)
        {
            return json;
        }
    }

    /// <summary>Answers are JSONB: a bare number, or an object with a numeric field.</summary>
    private static decimal? NumericAnswer(EvaluationAnswer answer)
    {
        if (string.IsNullOrWhiteSpace(answer.AnswerValueJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(answer.AnswerValueJson);
            var root = document.RootElement;
            if (root.ValueKind == JsonValueKind.Number && root.TryGetDecimal(out var number))
            {
                return number;
            }

            if (root.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in root.EnumerateObject())
                {
                    if (property.Value.ValueKind == JsonValueKind.Number && property.Value.TryGetDecimal(out var value))
                    {
                        return value;
                    }
                }
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }
}
