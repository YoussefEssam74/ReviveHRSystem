namespace DomainLayer.Models.NotificationModule.Enums
{
    /// <summary>
    /// Defines audience targeting criteria for a broadcast announcement.
    /// AllGym (entire branch staff), Department, Role, or Individual user.
    /// </summary>
    public enum AnnouncementTargetType
    {
        AllGym = 1,
        Department = 2,
        Role = 3,
        Individual = 4
    }
}
