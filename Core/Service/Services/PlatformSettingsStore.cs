using System.Globalization;
using DomainLayer.Contracts;
using DomainLayer.Models.PlatformModule;
using Service.Specifications;

namespace Service.Services
{
    /// <summary>
    /// Dotted keys the platform settings live under. Kept in one place so the settings screen,
    /// the retention policy and any future consumer cannot drift onto different spellings.
    /// </summary>
    internal static class PlatformSettingsKeys
    {
        public const string SecurityPasswordRotationDays = "security.passwordRotationDays";
        public const string SecuritySessionLifetimeMinutes = "security.sessionLifetimeMinutes";
        public const string SecurityMaxFailedSignIns = "security.maxFailedSignIns";
        public const string SecurityLockoutMinutes = "security.lockoutMinutes";
        public const string SecurityRequireMfa = "security.requireMfa";

        public const string LocalizationDefaultLanguage = "localization.defaultLanguage";
        public const string LocalizationSupportedLanguages = "localization.supportedLanguages";
        public const string LocalizationDefaultTimeZone = "localization.defaultTimeZone";

        public const string BrandingPlatformName = "branding.platformName";
        public const string BrandingPrimaryColor = "branding.primaryColor";
        public const string BrandingSupportEmail = "branding.supportEmail";

        public const string BillingCurrency = "billing.currency";
        public const string BillingInvoiceDueDays = "billing.invoiceDueDays";
        public const string BillingLegalName = "billing.legalName";
        public const string BillingTaxRegistration = "billing.taxRegistration";
        public const string BillingBillingEmail = "billing.billingEmail";

        public const string AuditPlatformEventsYears = "audit.platformEventsYears";
        public const string AuditCompanyEventsYears = "audit.companyEventsYears";
        public const string AuditImpersonationYears = "audit.impersonationYears";
        public const string AuditExportRetentionDays = "audit.exportRetentionDays";
    }

    /// <summary>
    /// Reads and writes <see cref="PlatformSetting"/> rows.
    ///
    /// Stored rows are treated as overrides: a key with no row falls back to the default the
    /// caller supplies, so a fresh database still answers a complete settings object and the
    /// seed never has to be kept in sync with the code.
    /// </summary>
    internal static class PlatformSettingsStore
    {
        /// <summary>All stored settings as a key → (value, updatedAt) map.</summary>
        public static async Task<IReadOnlyDictionary<string, PlatformSettingRow>> ReadAsync(
            IUnitOfWork unitOfWork,
            CancellationToken cancellationToken)
        {
            var rows = await unitOfWork.GetRepository<PlatformSetting, int>()
                .GetAllAsync(new AllPlatformSettingsSpec(), cancellationToken);

            return rows
                .GroupBy(r => r.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => new PlatformSettingRow
                    {
                        Value = g.First().Value,
                        UpdatedAt = g.First().UpdatedAt,
                    },
                    StringComparer.OrdinalIgnoreCase);
        }

        public static string ReadString(
            IReadOnlyDictionary<string, PlatformSettingRow> settings,
            string key,
            string fallback) =>
            settings.TryGetValue(key, out var row) && !string.IsNullOrWhiteSpace(row.Value)
                ? row.Value
                : fallback;

        public static int ReadInt(
            IReadOnlyDictionary<string, PlatformSettingRow> settings,
            string key,
            int fallback) =>
            settings.TryGetValue(key, out var row)
            && int.TryParse(row.Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : fallback;

        public static bool ReadBool(
            IReadOnlyDictionary<string, PlatformSettingRow> settings,
            string key,
            bool fallback) =>
            settings.TryGetValue(key, out var row)
            && bool.TryParse(row.Value, out var parsed)
                ? parsed
                : fallback;

        public static IReadOnlyList<string> ReadList(
            IReadOnlyDictionary<string, PlatformSettingRow> settings,
            string key,
            IReadOnlyList<string> fallback) =>
            settings.TryGetValue(key, out var row) && !string.IsNullOrWhiteSpace(row.Value)
                ? row.Value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                : fallback;

        public static DateTime? ReadUpdatedAt(
            IReadOnlyDictionary<string, PlatformSettingRow> settings,
            string key) =>
            settings.TryGetValue(key, out var row) ? row.UpdatedAt : null;

        /// <summary>
        /// Upserts each key. Callers are responsible for validating the values first; this only
        /// persists them so a bad range can never reach the database.
        /// </summary>
        public static async Task WriteAsync(
            IUnitOfWork unitOfWork,
            int actorUserId,
            IReadOnlyDictionary<string, string> values,
            CancellationToken cancellationToken)
        {
            var repository = unitOfWork.GetRepository<PlatformSetting, int>();
            var existing = (await repository.GetAllAsync(new AllPlatformSettingsTrackedSpec(), cancellationToken))
                .GroupBy(r => r.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            foreach (var (key, value) in values)
            {
                if (existing.TryGetValue(key, out var row))
                {
                    row.Value = value;
                    row.UpdatedByUserId = actorUserId;
                    repository.Update(row);
                    continue;
                }

                await repository.AddAsync(new PlatformSetting
                {
                    Key = key,
                    Value = value,
                    UpdatedByUserId = actorUserId,
                }, cancellationToken);
            }
        }
    }

    /// <summary>A stored setting plus when it was last written.</summary>
    internal sealed class PlatformSettingRow
    {
        public string Value { get; init; } = string.Empty;
        public DateTime? UpdatedAt { get; init; }
    }
}
