using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.UserModule;

namespace DomainLayer.Models.AttendanceModule
{
    /// <summary>
    /// Audit log recording adjustments made to an attendance record.
    /// Preserves original vs. corrected times and statuses, along with mandatory justification reason, editor user, and timestamp.
    /// </summary>
    public class AttendanceCorrection : BaseEntity
    {
        public int AttendanceRecordId { get; set; }
        public virtual AttendanceRecord AttendanceRecord { get; set; } = null!;

        public DateTime? OriginalCheckIn { get; set; }
        public DateTime? OriginalCheckOut { get; set; }
        public AttendanceStatus OriginalStatus { get; set; }

        public DateTime? CorrectedCheckIn { get; set; }
        public DateTime? CorrectedCheckOut { get; set; }
        public AttendanceStatus CorrectedStatus { get; set; }

        public string Reason { get; set; } = string.Empty;

        public int CorrectedBy { get; set; }
        public virtual User CorrectedByUser { get; set; } = null!;

        public DateTime CorrectedAt { get; set; } = DateTime.UtcNow;
    }
}
