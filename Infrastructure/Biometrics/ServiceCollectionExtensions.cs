using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ServiceAbstraction.Services;

namespace Biometrics
{
    public static class ServiceCollectionExtensions
    {
        /// <summary>Registers the in-process face biometrics (engine singleton + scoped service).</summary>
        public static IServiceCollection AddFaceBiometrics(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<BiometricsOptions>(configuration.GetSection(BiometricsOptions.SectionName));
            services.AddSingleton<FaceRecognitionEngine>();
            services.AddScoped<IFaceBiometricService, FaceBiometricService>();
            return services;
        }
    }
}
