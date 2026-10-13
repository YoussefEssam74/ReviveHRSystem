namespace Shared.DataTransferObject.EmployeeProfile;

/// <summary>Sends a one-to-one message to a team member (mock 13.8 "Message" button).</summary>
public sealed class SendTeamMessageDto
{
    public string Message { get; init; } = string.Empty;
}
