using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using Shared.DataTransferObject.Auth;
using Shared.DataTransferObject.Gym;

namespace Service.Mapping;

/// <summary>
/// Central AutoMapper profile for the service layer. Only straight entity/DTO
/// copies live here; responses composed from several sources or computed at
/// runtime (login responses, attendance reports) stay as explicit projections
/// in the services so the business rules remain visible in code.
/// </summary>
public sealed class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<StationCode, StationCodeResponse>()
            .ForMember(d => d.GymName, o => o.MapFrom(s => s.Gym.Name));

        CreateMap<GymAccessEntry, GymOption>();
    }
}
