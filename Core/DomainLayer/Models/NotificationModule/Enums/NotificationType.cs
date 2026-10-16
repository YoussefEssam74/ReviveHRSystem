namespace DomainLayer.Models.NotificationModule.Enums
{
    /// <summary>
    /// Categorizes system-generated inbound notifications sent to individual users.
    /// RecruitmentFollowUp, RequestUpdate, AttendanceIssue, ScheduleUpdate, ContractExpiry, SystemUpdate, Announcement.
    /// </summary>
    public enum NotificationType
    {
        RecruitmentFollowUp = 1,
        RequestUpdate = 2,
        AttendanceIssue = 3,
        ScheduleUpdate = 4,
        ContractExpiry = 5,
        SystemUpdate = 6,
        Announcement = 7
    }
}
