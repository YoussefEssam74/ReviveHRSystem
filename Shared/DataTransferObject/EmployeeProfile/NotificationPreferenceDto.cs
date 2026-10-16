namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Notification preferences of the signed-in user (mock §12 toggles).</summary>
public sealed class NotificationPreferenceDto
{
    public bool Requests { get; init; }
    public bool Attendance { get; init; }
    public bool Recruitment { get; init; }
    public bool Management { get; init; }
    public bool Announcements { get; init; }
}
