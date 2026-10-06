namespace DomainLayer.Models.UserModule.Enums
{
    /// <summary>
    /// Represents the high-level platform user classification.
    /// TopManagement (Super Admin across all gyms), HR (HR operations across assigned gyms), Employee (Self-service user).
    /// </summary>
    public enum UserType
    {
        TopManagement = 1,
        HR = 2,
        Employee = 3
    }
}
