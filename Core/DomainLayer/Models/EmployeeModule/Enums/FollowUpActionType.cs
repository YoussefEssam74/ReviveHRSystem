namespace DomainLayer.Models.EmployeeModule.Enums
{
    /// <summary>
    /// Action taken on a team follow-up (mock 13.5 Team Actions palette):
    /// a reminder or a warning to the employee, a pay deduction, an escalation
    /// to the HR portal, or closing the item as resolved. Values are stored
    /// ints, so existing members are renamed in place and new ones append at
    /// the end to keep old rows readable.
    /// </summary>
    public enum FollowUpActionType
    {
        Reminder = 1,
        // Legacy value kept so pre-existing rows serialize as a name instead
        // of a bare "2"; not offered in the UI palette.
        Meeting = 2,
        // Renamed from "Escalation" — same stored value, new vocabulary.
        EscalateToHR = 3,
        Resolution = 4,
        Deduction = 5,
        Warning = 6
    }
}
