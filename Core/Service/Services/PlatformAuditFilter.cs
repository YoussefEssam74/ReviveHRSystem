using DomainLayer.Models.AuditModule;
using Shared.DataTransferObject.Platform;

namespace Service.Services
{
    /// <summary>
    /// Turns raw <see cref="AuditLog"/> rows into the console's audit rows and applies the
    /// Security &amp; audit filters. Shared by the per-company audit tab and (from P4) the
    /// platform-wide trail so both render identical rows.
    /// </summary>
    internal static class PlatformAuditFilter
    {
        /// <summary>
        /// Applies the console's filters and maps to the response shape. <paramref name="userNames"/>
        /// supplies the actor display name; a missing entry falls back to "System".
        /// </summary>
        public static List<PlatformAuditItem> Apply(
            IEnumerable<AuditLog> rows,
            PlatformAuditQuery query,
            IReadOnlyDictionary<int, string> userNames)
        {
            var term = string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim().ToLowerInvariant();
            var severity = string.IsNullOrWhiteSpace(query.Severity) ? null : query.Severity.Trim().ToLowerInvariant();
            var category = string.IsNullOrWhiteSpace(query.Category) ? null : query.Category.Trim().ToLowerInvariant();

            var filtered = rows.Where(row =>
            {
                if (severity is not null && !string.Equals(row.Severity, severity, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                if (category is not null && !string.Equals(row.Category, category, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                if (query.ActorId is int actorId && row.UserId != actorId)
                {
                    return false;
                }

                if (query.From is DateTime from && row.Timestamp < from)
                {
                    return false;
                }

                if (query.To is DateTime to && row.Timestamp > to)
                {
                    return false;
                }

                if (term is not null)
                {
                    var actorName = row.UserId is int id && userNames.TryGetValue(id, out var name) ? name : "system";
                    var haystack = $"{row.ActionLabel} {row.Action} {actorName} {row.Target} {row.IpAddress} {row.Detail}".ToLowerInvariant();
                    if (!haystack.Contains(term))
                    {
                        return false;
                    }
                }

                return true;
            });

            return filtered
                .OrderByDescending(row => row.Timestamp)
                .Select(row => Map(row, userNames))
                .ToList();
        }

        /// <summary>Summary strip for the full set (unfiltered), matching the page header.</summary>
        public static PlatformAuditCounts Counts(IEnumerable<AuditLog> rows)
        {
            var list = rows.ToList();
            return new PlatformAuditCounts
            {
                Total = list.Count,
                Critical = list.Count(r => string.Equals(r.Severity, "critical", StringComparison.OrdinalIgnoreCase)),
                Warning = list.Count(r => string.Equals(r.Severity, "warning", StringComparison.OrdinalIgnoreCase)),
                Info = list.Count(r => string.Equals(r.Severity, "info", StringComparison.OrdinalIgnoreCase)),
                AwaitingReview = list.Count(r =>
                    r.ReviewedAt is null
                    && !string.Equals(r.Severity, "info", StringComparison.OrdinalIgnoreCase)),
            };
        }

        public static PlatformAuditItem Map(AuditLog row, IReadOnlyDictionary<int, string> userNames)
        {
            var actorName = row.UserId is int id && userNames.TryGetValue(id, out var name) ? name : "System";

            return new PlatformAuditItem
            {
                Id = row.Id,
                OccurredAt = row.Timestamp,
                Actor = new PlatformAuditActor
                {
                    UserId = row.UserId,
                    Name = actorName,
                    Initials = PlatformHelpers.InitialsOf(actorName),
                    Role = null,
                    IpAddress = row.IpAddress,
                },
                Company = null,
                Category = row.Category,
                Severity = row.Severity,
                Action = row.ActionLabel ?? row.Action,
                Target = row.Target,
                IpAddress = row.IpAddress,
                Reviewed = row.ReviewedAt is not null,
            };
        }
    }
}
