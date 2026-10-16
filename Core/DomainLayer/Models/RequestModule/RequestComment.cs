using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.RequestModule
{
    /// <summary>
    /// A comment posted on an employee request (mock 17.5). Comments are a
    /// collaboration trail next to the approval decisions: they never change the
    /// request's status, and the author is preserved for the audit trail.
    /// </summary>
    public class RequestComment : BaseEntity<int>
    {
        public int RequestId { get; set; }
        public virtual EmployeeRequest Request { get; set; } = null!;

        public int AuthorUserId { get; set; }
        public virtual User AuthorUser { get; set; } = null!;

        public string Body { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
