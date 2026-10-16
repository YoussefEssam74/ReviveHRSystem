namespace DomainLayer.Models.OrganizationModule.Enums
{
    /// <summary>
    /// Specifies the anchor date used to trigger annual compensation increases for a gym's employees.
    /// HireAnniversary (exact anniversary of hiring), FixedCalendarDate (e.g. Jan 1st).
    /// </summary>
    public enum AnnualIncreaseAnchorDate
    {
        HireAnniversary = 1,
        FixedCalendarDate = 2
    }
}
