namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Result of the avatar upload (mock 2.4 camera button).</summary>
public sealed class PhotoUploadResultDto
{
    /// <summary>
    /// Where the avatar can now be fetched: GET /api/employees/{employeeId}/photo.
    /// The storage path itself never leaves the server, so clients can cache this URL
    /// and the physical layout stays replaceable.
    /// </summary>
    public string PhotoUrl { get; init; } = string.Empty;
}
