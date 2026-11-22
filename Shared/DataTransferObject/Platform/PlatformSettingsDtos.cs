namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Platform settings & feature flags — §6.11
// ------------------------------------------------------------------

public class SecuritySettingsDto
{
    public int PasswordRotationDays { get; init; }
    public int SessionLifetimeMinutes { get; init; }
    public int MaxFailedSignIns { get; init; }
    public int LockoutMinutes { get; init; }
    public bool RequireMfa { get; init; }
}

public class LocalizationSettingsDto
{
    public required string DefaultLanguage { get; init; }
    public required IReadOnlyList<string> SupportedLanguages { get; init; }
    public required string DefaultTimeZone { get; init; }
}

public class BrandingSettingsDto
{
    public required string PlatformName { get; init; }
    public required string PrimaryColor { get; init; }
    public required string SupportEmail { get; init; }
}

public class BillingSettingsDto
{
    public required string Currency { get; init; }
    public int InvoiceDueDays { get; init; }
    public required string LegalName { get; init; }
    public string? TaxRegistration { get; init; }
    public required string BillingEmail { get; init; }
}

public class AuditSettingsDto
{
    public int PlatformEventsYears { get; init; }
    public int CompanyEventsYears { get; init; }
    public int ExportRetentionDays { get; init; }
}

public class PlatformSettingsResponse
{
    public required SecuritySettingsDto Security { get; init; }
    public required LocalizationSettingsDto Localization { get; init; }
    public required BrandingSettingsDto Branding { get; init; }
    public required BillingSettingsDto Billing { get; init; }
    public required AuditSettingsDto Audit { get; init; }
}

/// <summary>
/// Partial update: send only the sections being changed. A section that is null (or a field
/// inside it that is null) keeps its stored value.
/// </summary>
public class UpdatePlatformSettingsRequest
{
    public SecuritySettingsPatch? Security { get; init; }
    public LocalizationSettingsPatch? Localization { get; init; }
    public BrandingSettingsPatch? Branding { get; init; }
    public BillingSettingsPatch? Billing { get; init; }
    public AuditSettingsPatch? Audit { get; init; }
}

public class SecuritySettingsPatch
{
    public int? PasswordRotationDays { get; init; }
    public int? SessionLifetimeMinutes { get; init; }
    public int? MaxFailedSignIns { get; init; }
    public int? LockoutMinutes { get; init; }
    public bool? RequireMfa { get; init; }
}

public class LocalizationSettingsPatch
{
    public string? DefaultLanguage { get; init; }
    public List<string>? SupportedLanguages { get; init; }
    public string? DefaultTimeZone { get; init; }
}

public class BrandingSettingsPatch
{
    public string? PlatformName { get; init; }
    public string? PrimaryColor { get; init; }
    public string? SupportEmail { get; init; }
}

public class BillingSettingsPatch
{
    public string? Currency { get; init; }
    public int? InvoiceDueDays { get; init; }
    public string? LegalName { get; init; }
    public string? TaxRegistration { get; init; }
    public string? BillingEmail { get; init; }
}

public class AuditSettingsPatch
{
    public int? PlatformEventsYears { get; init; }
    public int? CompanyEventsYears { get; init; }
    public int? ExportRetentionDays { get; init; }
}

// ------------------------------------------------------------------
// Feature flags
// ------------------------------------------------------------------

public class FeatureFlagTargetDto
{
    public int? PlanId { get; init; }
    public int? CompanyId { get; init; }
}

public class FeatureFlagItem
{
    public int Id { get; init; }
    public required string Key { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public bool IsEnabled { get; init; }

    /// <summary>Global | Plans | Companies.</summary>
    public required string Scope { get; init; }

    public required IReadOnlyList<FeatureFlagTargetDto> Targets { get; init; }
    public DateTime? UpdatedAt { get; init; }
}

public class FeatureFlagsListResponse
{
    public required IReadOnlyList<FeatureFlagItem> Items { get; init; }
}

public class FeatureFlagUpsertRequest
{
    /// <summary>Dotted key, e.g. "payroll.export.pdf". Must match ^[a-z0-9]+(\.[a-z0-9]+)+$.</summary>
    public required string Key { get; init; }

    public required string Name { get; init; }
    public string? Description { get; init; }
    public bool IsEnabled { get; init; }

    /// <summary>Global | Plans | Companies.</summary>
    public string? Scope { get; init; } = "Global";

    public List<FeatureFlagTargetDto>? Targets { get; init; }
}

/// <summary>Flags in force for the caller — what the SPA and the in-gym portal read.</summary>
public class EffectiveFeatureFlagsResponse
{
    public required IReadOnlyDictionary<string, bool> Flags { get; init; }
}
