using System.ComponentModel.DataAnnotations;

namespace Shared.DataTransferObject.Subscription
{
    /// <summary>Platform-wide subscription defaults (Revive Admin settings panel).</summary>
    public class SubscriptionSettingsDto
    {
        public int DefaultBillingCycleMonths { get; set; }
        public int DefaultGracePeriodDays { get; set; }
        public int ReminderLeadDays { get; set; }
        public bool AutoSuspensionEnabled { get; set; }
        public string Currency { get; set; } = "EGP";
    }

    public class UpdateSubscriptionSettingsRequest
    {
        [Range(1, 36, ErrorMessage = "The billing cycle must be between 1 and 36 months.")]
        public int DefaultBillingCycleMonths { get; set; } = 1;

        [Range(0, 90, ErrorMessage = "The grace period must be between 0 and 90 days.")]
        public int DefaultGracePeriodDays { get; set; } = 7;

        [Range(0, 60, ErrorMessage = "The reminder lead time must be between 0 and 60 days.")]
        public int ReminderLeadDays { get; set; } = 3;

        public bool AutoSuspensionEnabled { get; set; } = true;

        [Required, StringLength(10, MinimumLength = 1)]
        public string Currency { get; set; } = "EGP";
    }

    /// <summary>Totals across every configured gym subscription.</summary>
    public class SubscriptionSummaryDto
    {
        public int TotalGyms { get; set; }
        public int ActiveCount { get; set; }
        public int GracePeriodCount { get; set; }
        public int SuspendedCount { get; set; }
        public int OverdueInvoiceCount { get; set; }
        public decimal OutstandingTotal { get; set; }
        public decimal CollectedTotal { get; set; }
    }

    /// <summary>One gym row on the Subscriptions overview table.</summary>
    public class GymSubscriptionListItem
    {
        public int GymId { get; set; }
        public string GymName { get; set; } = string.Empty;
        public string? Branch { get; set; }
        public string Status { get; set; } = string.Empty;
        public int? PlanId { get; set; }
        public string? PlanName { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "EGP";
        public int BillingCycleMonths { get; set; }
        public int GracePeriodDays { get; set; }
        public int ReminderLeadDays { get; set; }
        /// <summary>Gym-specific grace override; null inherits the platform default.</summary>
        public int? GracePeriodDaysOverride { get; set; }
        /// <summary>Gym-specific reminder-lead override; null inherits the platform default.</summary>
        public int? ReminderLeadDaysOverride { get; set; }
        public bool AutoSuspensionEnabled { get; set; }
        public DateOnly BillingStartDate { get; set; }
        public DateOnly? NextDueDate { get; set; }
        public int? DaysUntilDue { get; set; }
        public int DaysOverdue { get; set; }
        public bool InGracePeriod { get; set; }
        public decimal OutstandingAmount { get; set; }
        public int UnpaidInvoiceCount { get; set; }
        public DateTime? LastPaymentAtUtc { get; set; }
        public DateTime? SuspendedAtUtc { get; set; }
        public string? SuspensionReason { get; set; }
        public bool IsSuspensionManual { get; set; }
        public DateTime? CancelledAtUtc { get; set; }
        /// <summary>Administrator override that keeps access open through this date.</summary>
        public DateOnly? AccessOverrideUntil { get; set; }
    }

    public class SubscriptionInvoiceDto
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public DateOnly PeriodStart { get; set; }
        public DateOnly PeriodEnd { get; set; }
        public DateOnly DueDate { get; set; }
        public DateOnly GraceEndsOn { get; set; }
        public decimal Amount { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal Balance { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime IssuedAtUtc { get; set; }
        public DateTime? PaidAtUtc { get; set; }
        public bool ReminderSent { get; set; }
        public bool OverdueNoticeSent { get; set; }
        public bool TriggeredSuspension { get; set; }
    }

    public class SubscriptionPaymentDto
    {
        public int Id { get; set; }
        public int InvoiceId { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime PaidAtUtc { get; set; }
        public string Method { get; set; } = string.Empty;
        public string? Reference { get; set; }
        public string? Notes { get; set; }
        public int? RecordedByUserId { get; set; }
    }

    public class SubscriptionOverviewResponse
    {
        public SubscriptionSettingsDto Settings { get; set; } = new();
        public SubscriptionSummaryDto Summary { get; set; } = new();
        public IReadOnlyList<GymSubscriptionListItem> Items { get; set; } = [];
        /// <summary>Active gyms that do not have a subscription configured yet.</summary>
        public IReadOnlyList<GymSubscriptionCandidate> UnconfiguredGyms { get; set; } = [];
    }

    public class GymSubscriptionCandidate
    {
        public int GymId { get; set; }
        public string GymName { get; set; } = string.Empty;
        public string? Branch { get; set; }
    }

    public class GymSubscriptionDetailResponse
    {
        public GymSubscriptionListItem Subscription { get; set; } = new();
        public SubscriptionSettingsDto Settings { get; set; } = new();
        public IReadOnlyList<SubscriptionInvoiceDto> Invoices { get; set; } = [];
        public IReadOnlyList<SubscriptionPaymentDto> Payments { get; set; } = [];
    }

    /// <summary>Configures a gym subscription; also updates an existing one.</summary>
    public class SaveGymSubscriptionRequest
    {
        [Range(0.01, 10_000_000, ErrorMessage = "The cycle amount must be greater than zero.")]
        public decimal Amount { get; set; }

        [Range(1, 36, ErrorMessage = "The billing cycle must be between 1 and 36 months.")]
        public int BillingCycleMonths { get; set; } = 1;

        [Range(0, 90, ErrorMessage = "The grace period must be between 0 and 90 days.")]
        public int? GracePeriodDays { get; set; }

        [Range(0, 60, ErrorMessage = "The reminder lead time must be between 0 and 60 days.")]
        public int? ReminderLeadDays { get; set; }

        public bool AutoSuspensionEnabled { get; set; } = true;

        /// <summary>First billing date; defaults to today when omitted on creation.</summary>
        public DateOnly? BillingStartDate { get; set; }

        /// <summary>Assigns a catalog plan (amount/cycle copied from it before overrides).</summary>
        public int? PlanId { get; set; }

        /// <summary>Explicit next payment date; shifts the earliest unpaid/upcoming invoice.</summary>
        public DateOnly? NextDueDate { get; set; }
    }

    public class RecordSubscriptionPaymentRequest
    {
        [Range(0.01, 10_000_000, ErrorMessage = "The payment amount must be greater than zero.")]
        public decimal Amount { get; set; }

        public DateTime? PaidAtUtc { get; set; }

        [Required, StringLength(40, MinimumLength = 1)]
        public string Method { get; set; } = "BankTransfer";

        [StringLength(120)]
        public string? Reference { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }
    }

    public class SuspendSubscriptionRequest
    {
        [StringLength(500)]
        public string? Reason { get; set; }
    }

    /// <summary>
    /// Restores access without a payment. The override lasts the requested number of
    /// days (default: the gym's grace window) and then normal automation resumes.
    /// </summary>
    public class ReactivateSubscriptionRequest
    {
        [Range(0, 90, ErrorMessage = "The override window must be between 0 and 90 days.")]
        public int? OverrideDays { get; set; }
    }

    public class SubscriptionActionResponse
    {
        public string Message { get; set; } = string.Empty;
        public GymSubscriptionDetailResponse Subscription { get; set; } = new();
    }

    public class RunSubscriptionCycleResponse
    {
        public string Message { get; set; } = string.Empty;
        public int GymsProcessed { get; set; }
        public int InvoicesCreated { get; set; }
        public int RemindersSent { get; set; }
        public int OverdueNoticesSent { get; set; }
        public int GymsSuspended { get; set; }
        public int GymsReactivated { get; set; }
    }

    // ==================================================================
    // Plans
    // ==================================================================

    public class SubscriptionPlanDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal PricePerCycle { get; set; }
        public int BillingCycleMonths { get; set; }
        public int? GracePeriodDays { get; set; }
        public int? ReminderLeadDays { get; set; }
        public bool IsActive { get; set; }
        public int SortOrder { get; set; }
        /// <summary>Number of gyms currently on this plan (admin listing).</summary>
        public int GymCount { get; set; }
    }

    public class SaveSubscriptionPlanRequest
    {
        [Required, StringLength(120, MinimumLength = 2)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        [Range(0.01, 10_000_000, ErrorMessage = "The plan price must be greater than zero.")]
        public decimal PricePerCycle { get; set; }

        [Range(1, 36, ErrorMessage = "The billing cycle must be between 1 and 36 months.")]
        public int BillingCycleMonths { get; set; } = 1;

        [Range(0, 90, ErrorMessage = "The grace period must be between 0 and 90 days.")]
        public int? GracePeriodDays { get; set; }

        [Range(0, 60, ErrorMessage = "The reminder lead time must be between 0 and 60 days.")]
        public int? ReminderLeadDays { get; set; }

        public bool IsActive { get; set; } = true;
        public int SortOrder { get; set; }
    }

    // ==================================================================
    // Gym-side view + renewal / upgrade requests
    // ==================================================================

    public class SubscriptionRequestDto
    {
        public int Id { get; set; }
        public int GymId { get; set; }
        public string GymName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? CurrentPlanName { get; set; }
        public string? RequestedPlanName { get; set; }
        public string RequestedByUserName { get; set; } = string.Empty;
        public string? Note { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? ReviewedAtUtc { get; set; }
        public string? ReviewNote { get; set; }
    }

    public class MySubscriptionResponse
    {
        public GymSubscriptionDetailResponse Subscription { get; set; } = new();
        public IReadOnlyList<SubscriptionPlanDto> AvailablePlans { get; set; } = [];
        public IReadOnlyList<SubscriptionRequestDto> PendingRequests { get; set; } = [];
    }

    public class CreateSubscriptionRequestRequest
    {
        [Required, StringLength(20)]
        public string Type { get; set; } = "Renewal";

        public int? RequestedPlanId { get; set; }

        [StringLength(500)]
        public string? Note { get; set; }
    }

    public class ReviewSubscriptionRequestRequest
    {
        [StringLength(500)]
        public string? Note { get; set; }
    }
}
