namespace DomainLayer.Models.EmployeeModule.Enums
{
    /// <summary>
    /// Identifies the kind of change recorded on an employee's career timeline.
    /// Transfer (gym move), PositionChange, RoleChange, StatusChange, CompensationChange, ContractChange, Hire, Offboard.
    /// </summary>
    public enum EmploymentChangeType
    {
        Transfer = 1,
        PositionChange = 2,
        RoleChange = 3,
        StatusChange = 4,
        CompensationChange = 5,
        ContractChange = 6,
        Hire = 7,
        Offboard = 8
    }
}
