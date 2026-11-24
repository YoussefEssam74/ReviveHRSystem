namespace Shared.DataTransferObject.Gym
{
    /// <summary>
    /// Result of a branch logo upload: the endpoint that streams the stored image
    /// back. The stored path itself never leaves the server.
    /// </summary>
    public class GymLogoUploadResult
    {
        public required string LogoUrl { get; init; }
    }
}
