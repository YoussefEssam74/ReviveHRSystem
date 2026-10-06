namespace DomainLayer.Models.NotificationModule.Enums
{
    /// <summary>
    /// Identifies the kind of actionable task awaiting HR resolution in the Events inbox.
    /// DocumentExpiry, ContractExpiry, ResignationFollowUp, VacancyRequestPending, RequestPendingHRReview.
    /// </summary>
    public enum EventType
    {
        DocumentExpiry = 1,
        ContractExpiry = 2,
        ResignationFollowUp = 3,
        VacancyRequestPending = 4,
        RequestPendingHRReview = 5
    }
}
