namespace DomainLayer.Models.EmployeeModule.Enums
{
    /// <summary>
    /// Categorizes types of leave entitlement tracked on employee balances and requests.
    /// Annual (vacation days), Sick (medical leave), Emergency (urgent personal leave), Unpaid.
    /// </summary>
    public enum LeaveType
    {
        Annual = 1,
        Sick = 2,
        Emergency = 3,
        Unpaid = 4
    }
}
