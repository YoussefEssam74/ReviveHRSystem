using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ServiceAbstraction.Services;

namespace Storage
{
    /// <summary>Registers the local-disk file storage provider.</summary>
    public static class StorageRegistration
    {
        public static IServiceCollection AddLocalFileStorage(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
            services.AddSingleton<IFileStorage, LocalFileStorage>();
            return services;
        }
    }
}
