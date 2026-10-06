namespace DomainLayer.Models.NotificationModule.Enums
{
    /// <summary>
    /// Represents the resolution state of an HR-actionable event.
    /// Open (unresolved, needs HR attention), Resolved.
    /// </summary>
    public enum EventStatus
    {
        Open = 1,
        Resolved = 2
    }
}
