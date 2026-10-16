namespace DomainLayer.Models.EmployeeModule.Enums
{
    /// <summary>
    /// Action taken on a team follow-up (mock 13.5 Team Actions palette):
    /// a reminder to the employee, a one-on-one meeting, an escalation to the
    /// branch manager, or closing the item as resolved.
    /// </summary>
    public enum FollowUpActionType
    {
        Reminder = 1,
        Meeting = 2,
        Escalation = 3,
        Resolution = 4
    }
}
