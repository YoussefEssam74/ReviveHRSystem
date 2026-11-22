using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.BillingModule;
using DomainLayer.Models.BillingModule.Enums;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.PlatformModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using ServiceAbstraction.Services;
using Shared.Authorization;
using System.Text.Json;

namespace Service.Services
{
    /// <summary>
    /// Shared plumbing for the platform console services: actor resolution, display
    /// labels and the audit-write helper. Keeping these in one place stops the three
    /// platform services from drifting apart on labels and audit shape.
    /// </summary>
    internal static class PlatformHelpers
    {
        private static readonly JsonSerializerOptions JsonStore = new(JsonSerializerDefaults.Web);

        // ----- labels -----

        /// <summary>Company lifecycle label as the console renders it.</summary>
        public static string CompanyStatusLabel(CompanyStatus status) => status switch
        {
            CompanyStatus.Trial => "Trial",
            CompanyStatus.Active => "Active",
            CompanyStatus.PaymentOverdue => "Payment overdue",
            CompanyStatus.Suspended => "Suspended",
            CompanyStatus.Closed => "Closed",
            _ => status.ToString(),
        };

        /// <summary>Branch status label (Gym.Status).</summary>
        public static string BranchStatusLabel(GymStatus status) => status switch
        {
            GymStatus.Active => "Active",
            GymStatus.Inactive => "Inactive",
            GymStatus.Archived => "Archived",
            _ => status.ToString(),
        };

        /// <summary>Subscription status label.</summary>
        public static string SubscriptionStatusLabel(SubscriptionStatus status) => status switch
        {
            SubscriptionStatus.Trial => "Trial",
            SubscriptionStatus.Active => "Active",
            SubscriptionStatus.PastDue => "PastDue",
            SubscriptionStatus.Cancelled => "Cancelled",
            _ => status.ToString(),
        };

        /// <summary>Invoice status label.</summary>
        public static string InvoiceStatusLabel(InvoiceStatus status) => status switch
        {
            InvoiceStatus.Draft => "Draft",
            InvoiceStatus.Open => "Open",
            InvoiceStatus.Paid => "Paid",
            InvoiceStatus.Overdue => "Overdue",
            InvoiceStatus.Trial => "Trial",
            InvoiceStatus.Void => "Void",
            _ => status.ToString(),
        };

        /// <summary>Invoice status label from its stored string form.</summary>
        public static string StatusLabel(string? status) =>
            Enum.TryParse<InvoiceStatus>(status, ignoreCase: true, out var parsed)
                ? InvoiceStatusLabel(parsed)
                : status ?? string.Empty;

        /// <summary>Two-letter initials for the avatar chip.</summary>
        public static string InitialsOf(string? name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return "—";
            }

            var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return string.Concat(parts.Take(2).Select(p => char.ToUpperInvariant(p[0])));
        }

        /// <summary>Human billing cadence — "Monthly", "Every 3 months", "Yearly", "Every 2 years".</summary>
        public static string CycleLabel(int count, PlanCycleUnit unit)
        {
            var n = Math.Max(1, count);
            if (unit == PlanCycleUnit.Years)
            {
                return n == 1 ? "Yearly" : $"Every {n} years";
            }

            return n == 1 ? "Monthly" : $"Every {n} months";
        }

        /// <summary>Plan cycle unit label used in payloads ("Months" / "Years").</summary>
        public static string CycleUnitLabel(PlanCycleUnit unit) =>
            unit == PlanCycleUnit.Years ? "Years" : "Months";

        /// <summary>Payroll status shown on the account card.</summary>
        public static string PayrollStatusLabel(PayrollPeriod? period, bool blocked)
        {
            if (blocked)
            {
                return "Blocked · invoice overdue";
            }

            if (period is null)
            {
                return "Not started";
            }

            var month = period.StartDate.ToString("MMM yyyy");
            return period.Status switch
            {
                PayrollPeriodStatus.Open => $"Open · {month}",
                PayrollPeriodStatus.Approved => $"Pending approval · {month}",
                PayrollPeriodStatus.Locked => $"Locked · {month}",
                _ => month,
            };
        }

        // ----- RBAC -----

        public static async Task<User> ResolveActorAsync(
            IUnitOfWork unitOfWork,
            int? actorUserId,
            CancellationToken cancellationToken)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var actor = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(actorUserId.Value, cancellationToken);

            if (actor is null || !actor.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            return actor;
        }

        /// <summary>
        /// A company is only manageable by the platform-wide roles. Anyone else — including
        /// HR — is refused before any data is read, which keeps company data out of reach
        /// of a gym-scoped account even if a permission key were mis-granted.
        /// </summary>
        public static void EnsurePlatformRole(User actor)
        {
            if (actor.UserType is not (UserType.TopManagement or UserType.HRManager))
            {
                throw new UnAuthorizedException("You do not have access to the platform console.");
            }
        }

        // ----- audit -----

        /// <summary>
        /// One platform audit row. The legacy <see cref="AuditLog.Action"/> keeps its
        /// Created/Updated/Deleted vocabulary; the console's label lives in ActionLabel
        /// so existing readers are unaffected.
        /// </summary>
        public static Task WriteAuditAsync(
            IUnitOfWork unitOfWork,
            User actor,
            string action,
            string category,
            string severity,
            string entityType,
            int entityId,
            int? companyId,
            int? gymId,
            string? target,
            string? detail,
            object? values,
            CancellationToken cancellationToken)
        {
            var log = new AuditLog
            {
                UserId = actor.Id,
                Action = "Updated",
                ActionLabel = action,
                Category = category,
                Severity = severity,
                EntityType = entityType,
                EntityId = entityId,
                CompanyId = companyId,
                GymId = gymId,
                Target = target,
                Detail = detail,
                NewValues = values is null ? null : JsonSerializer.Serialize(values, JsonStore),
            };

            return unitOfWork.GetRepository<AuditLog, int>().AddAsync(log, cancellationToken);
        }

        /// <summary>Audit label for a role name, used when describing a user in the trail.</summary>
        public static string RoleLabel(User user, string? roleName) =>
            roleName ?? user.UserType switch
            {
                UserType.TopManagement => RoleNames.SuperAdmin,
                UserType.HRManager => RoleNames.HrManager,
                UserType.HR => RoleNames.Hr,
                _ => RoleNames.Employee,
            };

        /// <summary>Display status for a user account: Active | Invited | Suspended.</summary>
        public static string UserStatusLabel(User user, bool hasLoggedIn) =>
            !user.IsActive ? "Suspended" : hasLoggedIn || user.LastLoginAt is not null ? "Active" : "Invited";

        /// <summary>Monthly equivalent MRR for a plan price over its cadence.</summary>
        public static decimal MonthlyValue(decimal price, int cycleCount, PlanCycleUnit unit)
        {
            var count = Math.Max(1, cycleCount);
            var months = unit == PlanCycleUnit.Years ? count * 12 : count;
            return Math.Round(price / months, 2);
        }

        /// <summary>Start of the current billing month in UTC — matches how invoices are keyed.</summary>
        public static DateTime CurrentMonthStart()
        {
            var now = DateTime.UtcNow;
            return new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        }

        /// <summary>Parses a "Nov 2026" style period label, or null when it is not a period.</summary>
        public static DateTime? ParsePeriodStart(string? periodLabel) =>
            DateTime.TryParse($"1 {periodLabel}", out var parsed) ? parsed : null;
    }
}
