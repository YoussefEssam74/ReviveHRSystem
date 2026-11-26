namespace DomainLayer.Constants
{
    /// <summary>Billing-related copy shared by the API and the sign-in gate.</summary>
    public static class SubscriptionMessages
    {
        /// <summary>
        /// Shown when a gym-scoped user tries to sign in while the gym's subscription
        /// is suspended. Requirement: the message must explain the suspension and how
        /// to restore access.
        /// </summary>
        public const string SuspensionMessage =
            "Your HR system access has been temporarily suspended due to an outstanding subscription payment. Please complete your payment to restore access.";
    }
}
