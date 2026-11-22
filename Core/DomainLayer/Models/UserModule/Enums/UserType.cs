namespace DomainLayer.Models.UserModule.Enums
{
    /// <summary>
    /// Represents the high-level platform user classification.
    /// TopManagement (Super Admin across all gyms), HRManager (platform HR lead across all
    /// gyms, without platform administration), HR (HR operations across assigned gyms),
    /// Employee (self-service user).
    /// </summary>
    public enum UserType
    {
        TopManagement = 1,
        HR = 2,
        Employee = 3,
        HRManager = 4
    }
}
