namespace DomainLayer.Models.BillingModule.Enums
{
    /// <summary>
    /// How a plan handles the period before billing starts.
    /// <see cref="TrialPlan"/> marks a plan that is itself a trial and is never billed.
    /// </summary>
    public enum TrialMode
    {
        None = 0,
        Days = 1,
        TrialPlan = 2
    }
}
