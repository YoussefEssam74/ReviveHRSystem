namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Billing & invoices — §6.7
// ------------------------------------------------------------------

public class InvoiceListQuery
{
    /// <summary>Draft | Open | Paid | Overdue | Trial | Void.</summary>
    public string? Status { get; init; }

    public int? CompanyId { get; init; }

    /// <summary>"Nov 2026" style period label.</summary>
    public string? Period { get; init; }

    public DateTime? From { get; init; }
    public DateTime? To { get; init; }

    /// <summary>Invoice number or period substring.</summary>
    public string? Search { get; init; }

    public int PageNumber { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}

public class InvoiceCompanyRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public string? City { get; init; }
}

public class InvoiceCompanyDetailRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public string? City { get; init; }
    public string? ContactEmail { get; init; }
}

public class InvoicePlanRef
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public required string CycleLabel { get; init; }
}

public class InvoiceListItem
{
    public int Id { get; init; }
    public required string InvoiceNumber { get; init; }
    public required InvoiceCompanyRef Company { get; init; }
    public required string PeriodLabel { get; init; }
    public InvoicePlanRef? Plan { get; init; }
    public decimal Amount { get; init; }
    public required string Currency { get; init; }
    public required string Status { get; init; }
    public DateTime IssuedOn { get; init; }
    public DateTime DueOn { get; init; }
    public DateTime? PaidOn { get; init; }
    public int DaysOverdue { get; init; }
    public DateTime PeriodStart { get; init; }
    public DateTime PeriodEnd { get; init; }

    /// <summary>Start of the subscription term this invoice was raised under.</summary>
    public DateTime? SubscriptionStart { get; init; }

    /// <summary>Renewal date of that term (the ledger's "End" column).</summary>
    public DateTime? SubscriptionEnd { get; init; }
}

public class InvoiceSummaryDto
{
    public decimal Billed { get; init; }
    public decimal Collected { get; init; }
    public decimal Outstanding { get; init; }
    public int OpenInvoices { get; init; }
    public int OverdueInvoices { get; init; }
}

public class InvoicesListResponse
{
    public required IReadOnlyList<InvoiceListItem> Items { get; init; }
    public required InvoiceSummaryDto Summary { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
}

public class InvoiceLineItemDto
{
    public required string Description { get; init; }
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal Amount { get; init; }
}

public class InvoicePaymentDto
{
    public int Id { get; init; }
    public decimal Amount { get; init; }
    public DateTime PaidOn { get; init; }
    public required string Method { get; init; }
    public string? Reference { get; init; }
}

public class InvoiceDetailResponse
{
    public int Id { get; init; }
    public required string InvoiceNumber { get; init; }
    public required string Status { get; init; }
    public required InvoiceCompanyDetailRef Company { get; init; }
    public required string PeriodLabel { get; init; }
    public DateTime PeriodStart { get; init; }
    public DateTime PeriodEnd { get; init; }
    public decimal Amount { get; init; }
    public decimal AmountPaid { get; init; }
    public required string Currency { get; init; }
    public DateTime IssuedOn { get; init; }
    public DateTime DueOn { get; init; }
    public DateTime? PaidOn { get; init; }
    public int DaysOverdue { get; init; }
    public required IReadOnlyList<InvoiceLineItemDto> LineItems { get; init; }
    public required IReadOnlyList<InvoicePaymentDto> Payments { get; init; }
    public string? Notes { get; init; }
}

/// <summary>
/// Manual invoice issue. Omitting <see cref="Amount"/> derives it from the active
/// subscription (plan price, honouring any price override).
/// </summary>
public class CreateInvoiceRequest
{
    public int CompanyId { get; init; }
    public DateTime PeriodStart { get; init; }
    public DateTime PeriodEnd { get; init; }
    public decimal? Amount { get; init; }
    public DateTime? IssuedOn { get; init; }
    public DateTime? DueOn { get; init; }
    public string? Notes { get; init; }
}

public class RecordPaymentRequest
{
    public decimal Amount { get; init; }
    public DateTime? PaidOn { get; init; }

    /// <summary>BankTransfer | Card | Cash | Other.</summary>
    public string? Method { get; init; } = "BankTransfer";

    public string? Reference { get; init; }
}

public class RecordPaymentResponse
{
    public int InvoiceId { get; init; }
    public required string Status { get; init; }
    public DateTime? PaidOn { get; init; }
    public decimal AmountPaid { get; init; }
    public decimal AmountRemaining { get; init; }
    public required string CompanyStatus { get; init; }
    public bool PayrollBlocked { get; init; }
}

public class SendReminderRequest
{
    /// <summary>Only Email is meaningful today; recorded for future channels.</summary>
    public string? Channel { get; init; } = "Email";
}

public class SendReminderResponse
{
    public int InvoiceId { get; init; }
    public string? SentTo { get; init; }
    public DateTime SentAt { get; init; }
    public bool MailConfigured { get; init; }
}

public class BulkReminderResponse
{
    public int Requested { get; init; }
    public int Sent { get; init; }
    public required IReadOnlyList<int> Failed { get; init; }
    public required IReadOnlyList<int> InvoiceIds { get; init; }
}

public class VoidInvoiceRequest
{
    public required string Reason { get; init; }
}

public class VoidInvoiceResponse
{
    public int Id { get; init; }
    public required string Status { get; init; }
    public DateTime VoidedAt { get; init; }
}
