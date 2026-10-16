namespace DomainLayer.Models.EmployeeModule.Enums
{
    /// <summary>
    /// Categorizes employee documentation.
    /// Contract (employment agreement), NationalId (civil registry / passport), Certification (fitness certificates), Other.
    /// </summary>
    public enum DocumentType
    {
        Contract = 1,
        NationalId = 2,
        Certification = 3,
        Other = 4
    }
}
