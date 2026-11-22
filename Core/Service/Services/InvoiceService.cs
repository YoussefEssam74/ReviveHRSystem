using System.Text;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.BillingModule;
using DomainLayer.Models.BillingModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.PlatformModule;
using DomainLayer.Models.PlatformModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Service.Services
{
    /// <summary>
    /// The invoice ledger. Invoice numbers follow INV-{yyyy}-{seq:D4}, are allocated under a
    /// transaction-scoped advisory lock so two concurrent issues can never collide, and are
    /// never reused — even after a void.
    /// </summary>
    public sealed class InvoiceService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IPlatformReadRepository _readModel) : IInvoiceService
    {
        /// <summary>Days between issue and due date when the caller does not supply one.</summary>
        private const int DefaultDueDays = 30;

        /// <summary>Advisory-lock key guarding the invoice-number sequence.</summary>
        private const int InvoiceSequenceLockKey = 7_412_001;

        /// <summary>No email transport is wired up yet, so reminders are recorded but not delivered.</summary>
        private const bool MailTransportConfigured = false;

        // ------------------------------------------------------------------
        // Read
        // ------------------------------------------------------------------

        public async Task<InvoicesListResponse> GetInvoicesAsync(int? actorUserId, InvoiceListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.view", cancellationToken);

            var snapshot = await _readModel.GetInvoiceSnapshotAsync(cancellationToken);
            var filtered = ApplyFilters(snapshot, query);

            // The summary describes the filtered set, which is what the ledger header states.
            var summary = new InvoiceSummaryDto
            {
                Billed = filtered.Sum(r => r.Amount),
                Collected = filtered.Sum(r => r.AmountPaid),
                Outstanding = filtered.Sum(r => r.Amount - r.AmountPaid),
                OpenInvoices = filtered.Count(r => r.Status is "Open" or "Overdue"),
                OverdueInvoices = filtered.Count(r => r.Status == "Overdue"),
            };

            var page = Math.Max(1, query.PageNumber);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);
            var total = filtered.Count;

            var cycleByPlan = await LoadPlanCycleLabelsAsync(cancellationToken);
            var termByCompany = (await _unitOfWork.GetRepository<CompanySubscription, int>()
                    .GetAllAsync(cancellationToken))
                .Where(s => s.Status != SubscriptionStatus.Cancelled)
                .GroupBy(s => s.CompanyId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.StartedOn).First());

            return new InvoicesListResponse
            {
                Items = filtered
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(r => new InvoiceListItem
                    {
                        Id = r.Id,
                        InvoiceNumber = r.InvoiceNumber,
                        Company = new InvoiceCompanyRef { Id = r.CompanyId, Name = r.CompanyName, City = r.CompanyCity },
                        PeriodLabel = r.PeriodLabel,
                        Plan = r.PlanId is int planId
                            ? new InvoicePlanRef
                            {
                                Id = planId,
                                Name = r.PlanName ?? "—",
                                CycleLabel = cycleByPlan.TryGetValue(planId, out var label) ? label : string.Empty,
                            }
                            : null,
                        Amount = r.Amount,
                        Currency = r.Currency,
                        Status = PlatformHelpers.StatusLabel(r.Status),
                        IssuedOn = r.IssuedOn,
                        DueOn = r.DueOn,
                        PaidOn = r.PaidOn,
                        DaysOverdue = DaysOverdue(r),
                        PeriodStart = r.PeriodStart,
                        PeriodEnd = r.PeriodEnd,
                        SubscriptionStart = termByCompany.TryGetValue(r.CompanyId, out var term) ? term.StartedOn : null,
                        SubscriptionEnd = termByCompany.TryGetValue(r.CompanyId, out var termEnd) ? termEnd.RenewsOn : null,
                    })
                    .ToList(),
                Summary = summary,
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                TotalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)),
            };
        }

        public async Task<InvoiceDetailResponse> GetInvoiceAsync(int? actorUserId, int invoiceId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.view", cancellationToken);

            return await BuildDetailAsync(invoiceId, cancellationToken);
        }

        // ------------------------------------------------------------------
        // Issue
        // ------------------------------------------------------------------

        public async Task<InvoiceDetailResponse> CreateInvoiceAsync(int? actorUserId, CreateInvoiceRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.manage", cancellationToken);

            var company = await _unitOfWork.GetRepository<Company, int>()
                .GetByIdAsync(new CompanyByIdSpec(request.CompanyId), cancellationToken)
                ?? throw new NotFoundException("Company not found.");

            if (company.Status is CompanyStatus.Closed)
            {
                throw new BadRequestException("A closed company cannot be invoiced.");
            }

            if (request.PeriodEnd < request.PeriodStart)
            {
                throw new BadRequestException("The billing period ends before it starts.");
            }

            var subscription = company.Subscriptions
                .Where(s => s.Status != SubscriptionStatus.Cancelled)
                .OrderByDescending(s => s.StartedOn)
                .FirstOrDefault();

            if (subscription?.Plan is null)
            {
                throw new BadRequestException("This company has no active subscription to invoice.");
            }

            if (subscription.Plan.TrialMode == DomainLayer.Models.BillingModule.Enums.TrialMode.TrialPlan)
            {
                throw new BadRequestException("This plan is a trial plan and is never billed.");
            }

            var periodStart = NormalizeDate(request.PeriodStart);
            var duplicate = await _unitOfWork.GetRepository<Invoice, int>()
                .CountAsync(new InvoiceForPeriodSpec(request.CompanyId, periodStart), cancellationToken);

            if (duplicate > 0)
            {
                throw new BadRequestException("An invoice already exists for this company and period.");
            }

            var amount = request.Amount ?? Math.Round(subscription.PriceOverride ?? subscription.Plan.Price, 2);
            if (amount <= 0)
            {
                throw new BadRequestException("The invoice amount must be greater than zero.");
            }

            var issuedOn = NormalizeDate(request.IssuedOn ?? DateTime.UtcNow);
            var dueOn = NormalizeDate(request.DueOn ?? issuedOn.AddDays(DefaultDueDays));

            Invoice? invoice = null;

            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                // Serialise number allocation: two concurrent issues must not read the
                // same max sequence and produce duplicate numbers.
                await _unitOfWork.AcquireTransactionLockAsync(InvoiceSequenceLockKey, cancellationToken);

                invoice = new Invoice
                {
                    InvoiceNumber = await NextInvoiceNumberAsync(issuedOn.Year, cancellationToken),
                    CompanyId = company.Id,
                    SubscriptionId = subscription.Id,
                    PeriodStart = periodStart,
                    PeriodEnd = NormalizeDate(request.PeriodEnd),
                    PeriodLabel = BuildPeriodLabel(periodStart),
                    Amount = amount,
                    Currency = subscription.Plan.Currency,
                    Status = InvoiceStatus.Open,
                    IssuedOn = issuedOn,
                    DueOn = dueOn,
                    Notes = Clean(request.Notes),
                };

                await _unitOfWork.GetRepository<Invoice, int>().AddAsync(invoice, cancellationToken);

                await PlatformHelpers.WriteAuditAsync(
                    _unitOfWork, actor,
                    action: "Issued invoice",
                    category: "Billing",
                    severity: "info",
                    entityType: "Invoice",
                    entityId: 0,
                    companyId: company.Id,
                    gymId: null,
                    target: $"{invoice.InvoiceNumber} · {company.Name}",
                    detail: $"{amount:N0} {invoice.Currency} for {invoice.PeriodLabel}, due {dueOn:yyyy-MM-dd}.",
                    values: new { invoice.InvoiceNumber, amount, invoice.PeriodLabel },
                    cancellationToken);

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);

            return await BuildDetailAsync(invoice!.Id, cancellationToken);
        }

        // ------------------------------------------------------------------
        // Payments
        // ------------------------------------------------------------------

        public async Task<RecordPaymentResponse> RecordPaymentAsync(int? actorUserId, int invoiceId, RecordPaymentRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.manage", cancellationToken);

            var invoiceRepository = _unitOfWork.GetRepository<Invoice, int>();
            var invoice = await invoiceRepository.GetByIdAsync(new InvoiceByIdSpec(invoiceId), cancellationToken)
                          ?? throw new NotFoundException("Invoice not found.");

            if (invoice.Status is InvoiceStatus.Void)
            {
                throw new BadRequestException("A voided invoice cannot accept a payment.");
            }

            if (invoice.Status is InvoiceStatus.Trial)
            {
                throw new BadRequestException("A trial invoice carries no amount and cannot be paid.");
            }

            if (request.Amount <= 0)
            {
                throw new BadRequestException("The payment amount must be greater than zero.");
            }

            var remaining = invoice.Amount - invoice.AmountPaid;
            if (request.Amount > remaining)
            {
                throw new BadRequestException(
                    $"The payment exceeds the remaining balance of {remaining:N0} {invoice.Currency}.");
            }

            var method = request.Method?.Trim().ToLowerInvariant() switch
            {
                null or "" or "banktransfer" or "bank" => PaymentMethod.BankTransfer,
                "card" => PaymentMethod.Card,
                "cash" => PaymentMethod.Cash,
                "other" => PaymentMethod.Other,
                _ => throw new BadRequestException("Payment method must be BankTransfer, Card, Cash or Other."),
            };

            var paidOn = NormalizeDate(request.PaidOn ?? DateTime.UtcNow);

            await _unitOfWork.GetRepository<InvoicePayment, int>().AddAsync(new InvoicePayment
            {
                InvoiceId = invoice.Id,
                Amount = Math.Round(request.Amount, 2),
                PaidOn = paidOn,
                Method = method,
                Reference = Clean(request.Reference),
                RecordedByUserId = actor.Id,
            }, cancellationToken);

            invoice.AmountPaid = Math.Round(invoice.AmountPaid + request.Amount, 2);

            var fullySettled = invoice.AmountPaid >= invoice.Amount;
            if (fullySettled)
            {
                invoice.Status = InvoiceStatus.Paid;
                invoice.PaidOn = paidOn;
            }

            invoiceRepository.Update(invoice);

            // Settling the last overdue invoice lifts the account back to Active and clears
            // the payroll block, mirroring the console's "record payment" flow.
            var company = await _unitOfWork.GetRepository<Company, int>().GetByIdAsync(invoice.CompanyId, cancellationToken);
            var companyStatus = company?.Status ?? CompanyStatus.Active;

            if (fullySettled && company is not null && company.Status == CompanyStatus.PaymentOverdue)
            {
                var stillOverdue = await invoiceRepository.CountAsync(
                    new OverdueInvoicesForCompanySpec(company.Id), cancellationToken);

                if (stillOverdue == 0)
                {
                    company.Status = CompanyStatus.Active;
                    _unitOfWork.GetRepository<Company, int>().Update(company);
                    companyStatus = CompanyStatus.Active;
                }
            }

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Recorded payment",
                category: "Billing",
                severity: "info",
                entityType: "Invoice",
                entityId: invoice.Id,
                companyId: invoice.CompanyId,
                gymId: null,
                target: $"{invoice.InvoiceNumber} · {request.Amount:N0} {invoice.Currency}",
                detail: fullySettled
                    ? $"Settled in full. {(companyStatus == CompanyStatus.Active ? "Company returned to Active and payroll access restored." : "Invoice settled.")}"
                    : $"Partial payment recorded. {remaining - request.Amount:N0} {invoice.Currency} still outstanding.",
                values: new { request.Amount, Method = method.ToString(), request.Reference, FullySettled = fullySettled },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var blocked = companyStatus is CompanyStatus.PaymentOverdue or CompanyStatus.Suspended or CompanyStatus.Closed;

            return new RecordPaymentResponse
            {
                InvoiceId = invoice.Id,
                Status = PlatformHelpers.InvoiceStatusLabel(invoice.Status),
                PaidOn = invoice.PaidOn,
                AmountPaid = invoice.AmountPaid,
                AmountRemaining = Math.Max(0, invoice.Amount - invoice.AmountPaid),
                CompanyStatus = PlatformHelpers.CompanyStatusLabel(companyStatus),
                PayrollBlocked = blocked,
            };
        }

        // ------------------------------------------------------------------
        // Reminders / void
        // ------------------------------------------------------------------

        public async Task<SendReminderResponse> SendReminderAsync(int? actorUserId, int invoiceId, SendReminderRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.manage", cancellationToken);

            var invoice = await _unitOfWork.GetRepository<Invoice, int>()
                .GetByIdAsync(new InvoiceByIdSpec(invoiceId), cancellationToken)
                ?? throw new NotFoundException("Invoice not found.");

            if (invoice.Status != InvoiceStatus.Overdue)
            {
                throw new BadRequestException("Only an overdue invoice can be chased with a reminder.");
            }

            var sentAt = DateTime.UtcNow;

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Sent payment reminder",
                category: "Billing",
                severity: "warning",
                entityType: "Invoice",
                entityId: invoice.Id,
                companyId: invoice.CompanyId,
                gymId: null,
                target: $"{invoice.InvoiceNumber} · {invoice.Company?.Name ?? $"#{invoice.CompanyId}"}",
                detail: MailTransportConfigured
                    ? $"Reminder emailed to {invoice.Company?.ContactEmail ?? "the billing contact"} for {invoice.Amount:N0} {invoice.Currency}."
                    : "No email transport is configured; the reminder was recorded on the trail but not delivered.",
                values: new { Channel = request.Channel ?? "Email", MailConfigured = MailTransportConfigured },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new SendReminderResponse
            {
                InvoiceId = invoice.Id,
                SentTo = invoice.Company?.ContactEmail,
                SentAt = sentAt,
                MailConfigured = MailTransportConfigured,
            };
        }

        public async Task<BulkReminderResponse> SendBulkRemindersAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.manage", cancellationToken);

            var overdue = (await _unitOfWork.GetRepository<Invoice, int>()
                .GetAllAsync(new OverdueInvoicesSpec(), cancellationToken)).ToList();

            var sentIds = new List<int>();

            foreach (var invoice in overdue)
            {
                await PlatformHelpers.WriteAuditAsync(
                    _unitOfWork, actor,
                    action: "Sent payment reminder",
                    category: "Billing",
                    severity: "warning",
                    entityType: "Invoice",
                    entityId: invoice.Id,
                    companyId: invoice.CompanyId,
                    gymId: null,
                    target: $"{invoice.InvoiceNumber} · {invoice.Company?.Name ?? $"#{invoice.CompanyId}"}",
                    detail: $"Bulk reminder for {invoice.Amount:N0} {invoice.Currency}.",
                    values: new { Bulk = true, MailConfigured = MailTransportConfigured },
                    cancellationToken);

                sentIds.Add(invoice.Id);
            }

            if (sentIds.Count > 0)
            {
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return new BulkReminderResponse
            {
                Requested = overdue.Count,
                Sent = sentIds.Count,
                Failed = [],
                InvoiceIds = sentIds,
            };
        }

        public async Task<VoidInvoiceResponse> VoidInvoiceAsync(int? actorUserId, int invoiceId, VoidInvoiceRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.manage", cancellationToken);

            var repository = _unitOfWork.GetRepository<Invoice, int>();
            var invoice = await repository.GetByIdAsync(new InvoiceByIdSpec(invoiceId), cancellationToken)
                          ?? throw new NotFoundException("Invoice not found.");

            if (invoice.Status is InvoiceStatus.Void)
            {
                throw new BadRequestException("This invoice is already void.");
            }

            if (invoice.AmountPaid > 0)
            {
                throw new BadRequestException("An invoice with recorded payments cannot be voided.");
            }

            var reason = string.IsNullOrWhiteSpace(request.Reason)
                ? throw new BadRequestException("A reason is required to void an invoice.")
                : request.Reason.Trim();

            invoice.Status = InvoiceStatus.Void;
            invoice.Notes = string.IsNullOrWhiteSpace(invoice.Notes) ? $"Void: {reason}" : $"{invoice.Notes}\nVoid: {reason}";
            repository.Update(invoice);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Voided invoice",
                category: "Billing",
                severity: "warning",
                entityType: "Invoice",
                entityId: invoice.Id,
                companyId: invoice.CompanyId,
                gymId: null,
                target: invoice.InvoiceNumber,
                detail: $"Voided: {reason}. The number is not reused.",
                values: new { reason },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new VoidInvoiceResponse
            {
                Id = invoice.Id,
                Status = PlatformHelpers.InvoiceStatusLabel(invoice.Status),
                VoidedAt = DateTime.UtcNow,
            };
        }

        // ------------------------------------------------------------------
        // Documents
        // ------------------------------------------------------------------

        public async Task<(string FileName, byte[] Content)> GetInvoicePdfAsync(int? actorUserId, int invoiceId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.view", cancellationToken);

            var detail = await BuildDetailAsync(invoiceId, cancellationToken);

            var lines = new List<MinimalPdfWriter.PdfLine>
            {
                new("ReviveHR — Subscription invoice", 16, Bold: true),
                new(string.Empty),
                new($"Invoice      {detail.InvoiceNumber}"),
                new($"Status       {detail.Status}"),
                new($"Period       {detail.PeriodLabel}"),
                new($"Issued       {detail.IssuedOn:yyyy-MM-dd}"),
                new($"Due          {detail.DueOn:yyyy-MM-dd}"),
                detail.PaidOn is null ? new(string.Empty) : new($"Paid         {detail.PaidOn:yyyy-MM-dd}"),
                new(string.Empty),
                new("Billed to", 12, Bold: true),
                new(detail.Company.Name),
                new(detail.Company.City ?? string.Empty),
                new(detail.Company.ContactEmail ?? string.Empty),
                new(string.Empty),
                new("Description                             Qty      Unit        Amount", 10, Bold: true),
            };

            foreach (var item in detail.LineItems)
            {
                lines.Add(new MinimalPdfWriter.PdfLine(
                    $"{Truncate(item.Description, 38),-38} {item.Quantity,4} {item.UnitPrice,10:N2} {item.Amount,12:N2}"));
            }

            lines.Add(new(string.Empty));
            lines.Add(new MinimalPdfWriter.PdfLine($"Total: {detail.Amount:N2} {detail.Currency}", 12, Bold: true));
            lines.Add(new($"Paid:  {detail.AmountPaid:N2} {detail.Currency}"));

            if (!string.IsNullOrWhiteSpace(detail.Notes))
            {
                lines.Add(new(string.Empty));
                lines.Add(new MinimalPdfWriter.PdfLine("Notes", 11, Bold: true));
                lines.Add(new(detail.Notes!));
            }

            lines.Add(new(string.Empty));
            lines.Add(new("Generated by ReviveHR. This document is not a tax invoice.", 8));

            return ($"{detail.InvoiceNumber}.pdf", MinimalPdfWriter.Build(detail.InvoiceNumber, lines));
        }

        public async Task<(string FileName, byte[] Content)> ExportInvoicesAsync(int? actorUserId, InvoiceListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.view", cancellationToken);

            var snapshot = ApplyFilters(await _readModel.GetInvoiceSnapshotAsync(cancellationToken), query);

            var sb = new StringBuilder();
            sb.AppendLine("Invoice,Company,City,Period,Amount,Paid,Outstanding,Status,Issued,Due,Paid On");

            foreach (var row in snapshot)
            {
                sb.AppendLine(string.Join(',',
                    Csv(row.InvoiceNumber),
                    Csv(row.CompanyName),
                    Csv(row.CompanyCity),
                    Csv(row.PeriodLabel),
                    row.Amount.ToString("0.00"),
                    row.AmountPaid.ToString("0.00"),
                    (row.Amount - row.AmountPaid).ToString("0.00"),
                    Csv(row.Status),
                    row.IssuedOn.ToString("yyyy-MM-dd"),
                    row.DueOn.ToString("yyyy-MM-dd"),
                    row.PaidOn?.ToString("yyyy-MM-dd") ?? string.Empty));
            }

            return ($"revivehr-invoices-{DateTime.UtcNow:yyyyMMdd}.csv", Encoding.UTF8.GetBytes(sb.ToString()));
        }

        // ------------------------------------------------------------------
        // Internals
        // ------------------------------------------------------------------

        private async Task<InvoiceDetailResponse> BuildDetailAsync(int invoiceId, CancellationToken cancellationToken)
        {
            var invoice = await _unitOfWork.GetRepository<Invoice, int>()
                .GetByIdAsync(new InvoiceByIdSpec(invoiceId), cancellationToken)
                ?? throw new NotFoundException("Invoice not found.");

            var company = await _unitOfWork.GetRepository<Company, int>()
                .GetByIdAsync(invoice.CompanyId, cancellationToken);

            var subscription = invoice.SubscriptionId is int subscriptionId
                ? await _unitOfWork.GetRepository<CompanySubscription, int>()
                    .GetByIdAsync(new SubscriptionWithPlanSpec(subscriptionId), cancellationToken)
                : null;

            var payments = await _unitOfWork.GetRepository<InvoicePayment, int>()
                .GetAllAsync(new PaymentsByInvoiceSpec(invoiceId), cancellationToken);

            // The ledger stores one invoice per period, so the single line describes the
            // subscription it bills. Overage lines will be added when seat billing lands.
            var lineItems = new List<InvoiceLineItemDto>
            {
                new()
                {
                    Description = subscription?.Plan is null
                        ? $"Subscription · {invoice.PeriodLabel}"
                        : $"{subscription.Plan.Name} plan · {PlatformHelpers.CycleLabel(subscription.Plan.CycleCount, subscription.Plan.CycleUnit)}",
                    Quantity = 1,
                    UnitPrice = invoice.Amount,
                    Amount = invoice.Amount,
                },
            };

            return new InvoiceDetailResponse
            {
                Id = invoice.Id,
                InvoiceNumber = invoice.InvoiceNumber,
                Status = PlatformHelpers.InvoiceStatusLabel(invoice.Status),
                Company = new InvoiceCompanyDetailRef
                {
                    Id = invoice.CompanyId,
                    Name = company?.Name ?? $"#{invoice.CompanyId}",
                    City = company?.City,
                    ContactEmail = company?.ContactEmail,
                },
                PeriodLabel = invoice.PeriodLabel,
                PeriodStart = invoice.PeriodStart,
                PeriodEnd = invoice.PeriodEnd,
                Amount = invoice.Amount,
                AmountPaid = invoice.AmountPaid,
                Currency = invoice.Currency,
                IssuedOn = invoice.IssuedOn,
                DueOn = invoice.DueOn,
                PaidOn = invoice.PaidOn,
                DaysOverdue = DaysOverdue(invoice.Status, invoice.DueOn, invoice.PaidOn),
                LineItems = lineItems,
                Payments = payments
                    .OrderBy(p => p.PaidOn)
                    .Select(p => new InvoicePaymentDto
                    {
                        Id = p.Id,
                        Amount = p.Amount,
                        PaidOn = p.PaidOn,
                        Method = p.Method.ToString(),
                        Reference = p.Reference,
                    })
                    .ToList(),
                Notes = invoice.Notes,
            };
        }

        /// <summary>Allocates the next number for the year. Caller must hold the sequence lock.</summary>
        private async Task<string> NextInvoiceNumberAsync(int year, CancellationToken cancellationToken)
        {
            var prefix = $"INV-{year}-";
            var existing = await _unitOfWork.GetRepository<Invoice, int>()
                .GetAllAsync(new InvoicesByYearSpec(year), cancellationToken);

            var maxSequence = 0;
            foreach (var number in existing.Select(i => i.InvoiceNumber))
            {
                if (number.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(number[prefix.Length..], out var sequence)
                    && sequence > maxSequence)
                {
                    maxSequence = sequence;
                }
            }

            return $"{prefix}{maxSequence + 1:D4}";
        }

        private static List<InvoiceSnapshotRow> ApplyFilters(IReadOnlyList<InvoiceSnapshotRow> rows, InvoiceListQuery query)
        {
            var status = string.IsNullOrWhiteSpace(query.Status) || query.Status.Equals("all", StringComparison.OrdinalIgnoreCase)
                ? null
                : query.Status.Trim().ToLowerInvariant();

            var period = string.IsNullOrWhiteSpace(query.Period) ? null : query.Period.Trim().ToLowerInvariant();
            var term = string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim().ToLowerInvariant();
            var from = query.From?.Date;
            var to = query.To?.Date;

            return rows
                .Where(r =>
                    (status is null || r.Status.ToLowerInvariant() == status)
                    && (query.CompanyId is null || r.CompanyId == query.CompanyId)
                    && (period is null || r.PeriodLabel.ToLowerInvariant() == period)
                    && (from is null || r.IssuedOn.Date >= from)
                    && (to is null || r.IssuedOn.Date <= to)
                    && (term is null
                        || r.InvoiceNumber.ToLowerInvariant().Contains(term)
                        || r.PeriodLabel.ToLowerInvariant().Contains(term)))
                .OrderByDescending(r => r.IssuedOn)
                .ThenByDescending(r => r.Id)
                .ToList();
        }

        private async Task<Dictionary<int, string>> LoadPlanCycleLabelsAsync(CancellationToken cancellationToken)
        {
            var plans = await _unitOfWork.GetRepository<SubscriptionPlan, int>().GetAllAsync(cancellationToken);
            return plans.ToDictionary(
                p => p.Id,
                p => PlatformHelpers.CycleLabel(p.CycleCount, p.CycleUnit));
        }

        private static int DaysOverdue(InvoiceSnapshotRow row) =>
            DaysOverdue(ParseStatus(row.Status), row.DueOn, row.PaidOn);

        private static int DaysOverdue(InvoiceStatus status, DateTime dueOn, DateTime? paidOn)
        {
            if (status is InvoiceStatus.Paid or InvoiceStatus.Void or InvoiceStatus.Trial)
            {
                return 0;
            }

            var reference = paidOn?.Date ?? DateTime.UtcNow.Date;
            return Math.Max(0, (reference - dueOn.Date).Days);
        }

        private static InvoiceStatus ParseStatus(string status) =>
            Enum.TryParse<InvoiceStatus>(status, ignoreCase: true, out var parsed) ? parsed : InvoiceStatus.Open;

        private static string BuildPeriodLabel(DateTime periodStart) => periodStart.ToString("MMM yyyy");

        private static DateTime NormalizeDate(DateTime value) =>
            DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);

        private static string Csv(string? value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            var needsQuotes = value.Contains(',') || value.Contains('"') || value.Contains('\n');
            return needsQuotes ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
        }

        private static string Truncate(string value, int max) =>
            value.Length <= max ? value : value[..(max - 1)] + "…";

        private static string? Clean(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
