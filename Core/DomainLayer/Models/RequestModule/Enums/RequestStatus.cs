namespace DomainLayer.Models.RequestModule.Enums
{
    /// <summary>
    /// Represents the workflow status of an employee request through a two-stage approval pipeline.
    /// Pending (awaiting Branch Manager or first reviewer), PendingHRReview (passed stage 1, awaiting HR final sign-off), Approved, Rejected.
    /// </summary>
    public enum RequestStatus
    {
        Pending = 1,
        PendingHRReview = 2,
        Approved = 3,
        Rejected = 4
    }
}
