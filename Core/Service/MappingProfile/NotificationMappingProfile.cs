using AutoMapper;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.UserModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Mapping;

/// <summary>Notification inbox and preference mappings (mock §11-12).</summary>
public sealed class NotificationMappingProfile : Profile
{
    public NotificationMappingProfile()
    {
        CreateMap<Notification, NotificationDto>()
            .ForMember(d => d.Category, o => o.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.Description, o => o.MapFrom(s => s.Message))
            .ForMember(d => d.Read, o => o.MapFrom(s => s.IsRead))
            .ForMember(d => d.Link, o => o.MapFrom(s => s.LinkTo));

        CreateMap<UserNotificationPreference, NotificationPreferenceDto>();
    }
}
