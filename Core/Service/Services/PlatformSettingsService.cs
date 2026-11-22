using System.Globalization;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.BillingModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PlatformModule;
using DomainLayer.Models.PlatformModule.Enums;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Service.Services
{
    /// <summary>
    /// Platform configuration and the feature-flag catalogue.
    ///
    /// Settings are stored as dotted key/value overrides, so defaults live in code and a fresh
    /// database still answers a complete object. Range validation happens here, before anything
    /// is written, so a bad value can never reach the table.
    /// </summary>
    public sealed class PlatformSettingsService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IPlatformReadRepository _readModel) : IPlatformSettingsService
    {
        private static readonly System.Text.RegularExpressions.Regex FlagKeyPattern =
            new(@"^[a-z0-9]+(\.[a-z0-9]+)+$", System.Text.RegularExpressions.RegexOptions.Compiled);

        // ------------------------------------------------------------------
        // Settings
        // ------------------------------------------------------------------

        public async Task<PlatformSettingsResponse> GetSettingsAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.settings.manage", cancellationToken);

            return await ReadSettingsAsync(cancellationToken);
        }

        public async Task<PlatformSettingsResponse> UpdateSettingsAsync(int? actorUserId, UpdatePlatformSettingsRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.settings.manage", cancellationToken);

            var before = await ReadSettingsAsync(cancellationToken);
            var updates = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            if (request.Security is { } security)
            {
                if (security.PasswordRotationDays is int rotation)
                {
                    RequireRange(rotation, 30, 365, "Password rotation must be between 30 and 365 days.");
                    updates[PlatformSettingsKeys.SecurityPasswordRotationDays] = rotation.ToString(CultureInfo.InvariantCulture);
                }

                if (security.SessionLifetimeMinutes is int lifetime)
                {
                    RequireRange(lifetime, 30, 1440, "Session lifetime must be between 30 and 1440 minutes.");
                    updates[PlatformSettingsKeys.SecuritySessionLifetimeMinutes] = lifetime.ToString(CultureInfo.InvariantCulture);
                }

                if (security.MaxFailedSignIns is int attempts)
                {
                    RequireRange(attempts, 3, 10, "Failed sign-in limit must be between 3 and 10.");
                    updates[PlatformSettingsKeys.SecurityMaxFailedSignIns] = attempts.ToString(CultureInfo.InvariantCulture);
                }

                if (security.LockoutMinutes is int lockout)
                {
                    RequireRange(lockout, 1, 1440, "Lockout duration must be between 1 and 1440 minutes.");
                    updates[PlatformSettingsKeys.SecurityLockoutMinutes] = lockout.ToString(CultureInfo.InvariantCulture);
                }

                if (security.RequireMfa is bool mfa)
                {
                    updates[PlatformSettingsKeys.SecurityRequireMfa] = mfa.ToString();
                }
            }

            if (request.Localization is { } localization)
            {
                if (!string.IsNullOrWhiteSpace(localization.DefaultLanguage))
                {
                    updates[PlatformSettingsKeys.LocalizationDefaultLanguage] = localization.DefaultLanguage.Trim().ToLowerInvariant();
                }

                if (localization.SupportedLanguages is { Count: > 0 })
                {
                    var languages = localization.SupportedLanguages
                        .Where(l => !string.IsNullOrWhiteSpace(l))
                        .Select(l => l.Trim().ToLowerInvariant())
                        .Distinct()
                        .ToList();

                    if (languages.Count == 0)
                    {
                        throw new BadRequestException("At least one supported language is required.");
                    }

                    updates[PlatformSettingsKeys.LocalizationSupportedLanguages] = string.Join(',', languages);
                }

                if (!string.IsNullOrWhiteSpace(localization.DefaultTimeZone))
                {
                    updates[PlatformSettingsKeys.LocalizationDefaultTimeZone] = localization.DefaultTimeZone.Trim();
                }
            }

            if (request.Branding is { } branding)
            {
                if (!string.IsNullOrWhiteSpace(branding.PlatformName))
                {
                    updates[PlatformSettingsKeys.BrandingPlatformName] = branding.PlatformName.Trim();
                }

                if (!string.IsNullOrWhiteSpace(branding.PrimaryColor))
                {
                    var color = branding.PrimaryColor.Trim();
                    if (!IsHexColor(color))
                    {
                        throw new BadRequestException("Primary colour must be a hex value such as #006c49.");
                    }

                    updates[PlatformSettingsKeys.BrandingPrimaryColor] = color;
                }

                if (!string.IsNullOrWhiteSpace(branding.SupportEmail))
                {
                    updates[PlatformSettingsKeys.BrandingSupportEmail] = branding.SupportEmail.Trim();
                }
            }

            if (request.Billing is { } billing)
            {
                if (!string.IsNullOrWhiteSpace(billing.Currency))
                {
                    updates[PlatformSettingsKeys.BillingCurrency] = billing.Currency.Trim().ToUpperInvariant();
                }

                if (billing.InvoiceDueDays is int dueDays)
                {
                    RequireRange(dueDays, 1, 365, "Invoice due days must be between 1 and 365.");
                    updates[PlatformSettingsKeys.BillingInvoiceDueDays] = dueDays.ToString(CultureInfo.InvariantCulture);
                }

                if (!string.IsNullOrWhiteSpace(billing.LegalName))
                {
                    updates[PlatformSettingsKeys.BillingLegalName] = billing.LegalName.Trim();
                }

                if (billing.TaxRegistration is not null)
                {
                    updates[PlatformSettingsKeys.BillingTaxRegistration] = billing.TaxRegistration.Trim();
                }

                if (!string.IsNullOrWhiteSpace(billing.BillingEmail))
                {
                    updates[PlatformSettingsKeys.BillingBillingEmail] = billing.BillingEmail.Trim();
                }
            }

            if (request.Audit is { } audit)
            {
                if (audit.PlatformEventsYears is int platformYears)
                {
                    RequireRange(platformYears, 1, 50, "Platform event retention must be between 1 and 50 years.");
                    updates[PlatformSettingsKeys.AuditPlatformEventsYears] = platformYears.ToString(CultureInfo.InvariantCulture);
                }

                if (audit.CompanyEventsYears is int companyYears)
                {
                    RequireRange(companyYears, 1, 50, "Company event retention must be between 1 and 50 years.");
                    updates[PlatformSettingsKeys.AuditCompanyEventsYears] = companyYears.ToString(CultureInfo.InvariantCulture);
                }

                if (audit.ExportRetentionDays is int exportDays)
                {
                    RequireRange(exportDays, 1, 3650, "Export retention must be between 1 and 3650 days.");
                    updates[PlatformSettingsKeys.AuditExportRetentionDays] = exportDays.ToString(CultureInfo.InvariantCulture);
                }
            }

            if (updates.Count == 0)
            {
                // Nothing to write: returning the current state keeps the endpoint idempotent
                // rather than raising for an empty patch.
                return before;
            }

            await PlatformSettingsStore.WriteAsync(_unitOfWork, actor.Id, updates, cancellationToken);

            // Flush before reading: ReadSettingsAsync queries the table, so without this the
            // response would echo the pre-save values while the database already has the new ones.
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var after = await ReadSettingsAsync(cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: request.Security is not null ? "Updated security policy" : "Updated platform settings",
                category: "Settings",
                severity: "info",
                entityType: "PlatformSetting",
                entityId: 0,
                companyId: null,
                gymId: null,
                target: string.Join(", ", updates.Keys),
                detail: $"{updates.Count} setting(s) changed.",
                values: new { Before = before, After = after },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return after;
        }

        // ------------------------------------------------------------------
        // Feature flags
        // ------------------------------------------------------------------

        public async Task<FeatureFlagsListResponse> GetFeatureFlagsAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.feature_flags.manage", cancellationToken);

            var flags = await _unitOfWork.GetRepository<FeatureFlag, int>()
                .GetAllAsync(new AllFeatureFlagsSpec(), cancellationToken);

            return new FeatureFlagsListResponse { Items = flags.Select(Map).ToList() };
        }

        public async Task<FeatureFlagItem> CreateFeatureFlagAsync(int? actorUserId, FeatureFlagUpsertRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.feature_flags.manage", cancellationToken);

            var key = RequireKey(request.Key);
            var name = RequireText(request.Name, "Flag name");

            if (await _unitOfWork.GetRepository<FeatureFlag, int>()
                    .GetByIdAsync(new FeatureFlagByKeySpec(key), cancellationToken) is not null)
            {
                throw new BadRequestException($"A feature flag with the key '{key}' already exists.");
            }

            var (scope, targets) = await ValidateTargetsAsync(request.Scope, request.Targets, cancellationToken);

            var flag = new FeatureFlag
            {
                Key = key,
                Name = name,
                Description = Clean(request.Description),
                IsEnabled = request.IsEnabled,
                Scope = scope,
                UpdatedByUserId = actor.Id,
                Targets = targets,
            };

            await _unitOfWork.GetRepository<FeatureFlag, int>().AddAsync(flag, cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: request.IsEnabled ? "Enabled feature flag" : "Created feature flag",
                category: "Settings",
                severity: "info",
                entityType: "FeatureFlag",
                entityId: 0,
                companyId: null,
                gymId: null,
                target: $"{key} · {scope}",
                detail: Describe(request.IsEnabled, scope, targets.Count),
                values: new { key, request.IsEnabled, Scope = scope.ToString(), Targets = targets.Count },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return Map(flag);
        }

        public async Task<FeatureFlagItem> UpdateFeatureFlagAsync(int? actorUserId, int flagId, FeatureFlagUpsertRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.feature_flags.manage", cancellationToken);

            var repository = _unitOfWork.GetRepository<FeatureFlag, int>();
            var flag = await repository.GetByIdAsync(new FeatureFlagTrackedByIdSpec(flagId), cancellationToken)
                       ?? throw new NotFoundException("Feature flag not found.");

            var key = RequireKey(request.Key);
            var name = RequireText(request.Name, "Flag name");

            // The key is the handle every consumer looks up, so renaming it silently would break
            // them. Treat a different key as a conflict rather than an update.
            if (!string.Equals(flag.Key, key, StringComparison.Ordinal))
            {
                throw new BadRequestException("A feature flag's key cannot be changed. Create a new flag instead.");
            }

            var (scope, targets) = await ValidateTargetsAsync(request.Scope, request.Targets, cancellationToken);
            var wasEnabled = flag.IsEnabled;

            flag.Name = name;
            flag.Description = Clean(request.Description);
            flag.IsEnabled = request.IsEnabled;
            flag.Scope = scope;
            flag.UpdatedByUserId = actor.Id;

            flag.Targets.Clear();
            foreach (var target in targets)
            {
                flag.Targets.Add(target);
            }

            repository.Update(flag);

            var action = !wasEnabled && request.IsEnabled
                ? "Enabled feature flag"
                : wasEnabled && !request.IsEnabled
                    ? "Disabled feature flag"
                    : "Updated feature flag";

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: action,
                category: "Settings",
                severity: "info",
                entityType: "FeatureFlag",
                entityId: flag.Id,
                companyId: null,
                gymId: null,
                target: $"{flag.Key} · {scope}",
                detail: Describe(request.IsEnabled, scope, targets.Count),
                values: new { flag.Key, WasEnabled = wasEnabled, request.IsEnabled, Scope = scope.ToString() },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return Map(flag);
        }

        public async Task DeleteFeatureFlagAsync(int? actorUserId, int flagId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.feature_flags.manage", cancellationToken);

            var repository = _unitOfWork.GetRepository<FeatureFlag, int>();
            var flag = await repository.GetByIdAsync(new FeatureFlagTrackedByIdSpec(flagId), cancellationToken)
                       ?? throw new NotFoundException("Feature flag not found.");

            repository.Remove(flag);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Deleted feature flag",
                category: "Settings",
                severity: "info",
                entityType: "FeatureFlag",
                entityId: flag.Id,
                companyId: null,
                gymId: null,
                target: flag.Key,
                detail: "Flag removed from the catalogue.",
                values: new { flag.Key },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        public async Task<EffectiveFeatureFlagsResponse> GetEffectiveFlagsAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            // Readable by any authenticated user: the SPA and the in-gym portal gate their UI on
            // this map, so gating it on a permission would contradict its purpose.
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);

            var flags = (await _unitOfWork.GetRepository<FeatureFlag, int>()
                .GetAllAsync(new AllFeatureFlagsSpec(), cancellationToken)).ToList();

            if (flags.Count == 0)
            {
                return new EffectiveFeatureFlagsResponse { Flags = new Dictionary<string, bool>() };
            }

            var (companyIds, planIds) = await ResolveCallerScopeAsync(actor, cancellationToken);

            var result = new Dictionary<string, bool>(StringComparer.Ordinal);
            foreach (var flag in flags)
            {
                // A disabled flag is off everywhere; scope only narrows an enabled one.
                result[flag.Key] = flag.IsEnabled && flag.Scope switch
                {
                    FeatureFlagScope.Global => true,
                    FeatureFlagScope.Plans => flag.Targets.Any(t => t.PlanId is int id && planIds.Contains(id)),
                    FeatureFlagScope.Companies => flag.Targets.Any(t => t.CompanyId is int id && companyIds.Contains(id)),
                    _ => false,
                };
            }

            return new EffectiveFeatureFlagsResponse { Flags = result };
        }

        // ------------------------------------------------------------------
        // Internals
        // ------------------------------------------------------------------

        private async Task<PlatformSettingsResponse> ReadSettingsAsync(CancellationToken cancellationToken)
        {
            var stored = await PlatformSettingsStore.ReadAsync(_unitOfWork, cancellationToken);

            return new PlatformSettingsResponse
            {
                Security = new SecuritySettingsDto
                {
                    PasswordRotationDays = PlatformSettingsStore.ReadInt(stored, PlatformSettingsKeys.SecurityPasswordRotationDays, 60),
                    SessionLifetimeMinutes = PlatformSettingsStore.ReadInt(stored, PlatformSettingsKeys.SecuritySessionLifetimeMinutes, 480),
                    MaxFailedSignIns = PlatformSettingsStore.ReadInt(stored, PlatformSettingsKeys.SecurityMaxFailedSignIns, 5),
                    LockoutMinutes = PlatformSettingsStore.ReadInt(stored, PlatformSettingsKeys.SecurityLockoutMinutes, 15),
                    RequireMfa = PlatformSettingsStore.ReadBool(stored, PlatformSettingsKeys.SecurityRequireMfa, false),
                },
                Localization = new LocalizationSettingsDto
                {
                    DefaultLanguage = PlatformSettingsStore.ReadString(stored, PlatformSettingsKeys.LocalizationDefaultLanguage, "en"),
                    SupportedLanguages = PlatformSettingsStore.ReadList(
                        stored, PlatformSettingsKeys.LocalizationSupportedLanguages, ["en", "ar"]),
                    DefaultTimeZone = PlatformSettingsStore.ReadString(stored, PlatformSettingsKeys.LocalizationDefaultTimeZone, "Africa/Cairo"),
                },
                Branding = new BrandingSettingsDto
                {
                    PlatformName = PlatformSettingsStore.ReadString(stored, PlatformSettingsKeys.BrandingPlatformName, "ReviveHR"),
                    PrimaryColor = PlatformSettingsStore.ReadString(stored, PlatformSettingsKeys.BrandingPrimaryColor, "#006c49"),
                    SupportEmail = PlatformSettingsStore.ReadString(stored, PlatformSettingsKeys.BrandingSupportEmail, "support@revivehr.com"),
                },
                Billing = new BillingSettingsDto
                {
                    Currency = PlatformSettingsStore.ReadString(stored, PlatformSettingsKeys.BillingCurrency, "EGP"),
                    InvoiceDueDays = PlatformSettingsStore.ReadInt(stored, PlatformSettingsKeys.BillingInvoiceDueDays, 30),
                    LegalName = PlatformSettingsStore.ReadString(stored, PlatformSettingsKeys.BillingLegalName, "ReviveHR Technologies Ltd."),
                    TaxRegistration = PlatformSettingsStore.ReadString(stored, PlatformSettingsKeys.BillingTaxRegistration, "EG-492-819-204"),
                    BillingEmail = PlatformSettingsStore.ReadString(stored, PlatformSettingsKeys.BillingBillingEmail, "billing@revivehr.com"),
                },
                Audit = new AuditSettingsDto
                {
                    PlatformEventsYears = PlatformSettingsStore.ReadInt(stored, PlatformSettingsKeys.AuditPlatformEventsYears, 7),
                    CompanyEventsYears = PlatformSettingsStore.ReadInt(stored, PlatformSettingsKeys.AuditCompanyEventsYears, 3),
                    ExportRetentionDays = PlatformSettingsStore.ReadInt(stored, PlatformSettingsKeys.AuditExportRetentionDays, 90),
                },
            };
        }

        private async Task<(FeatureFlagScope Scope, List<FeatureFlagTarget> Targets)> ValidateTargetsAsync(
            string? scopeValue,
            List<FeatureFlagTargetDto>? requestedTargets,
            CancellationToken cancellationToken)
        {
            var scope = scopeValue?.Trim().ToLowerInvariant() switch
            {
                null or "" or "global" => FeatureFlagScope.Global,
                "plans" => FeatureFlagScope.Plans,
                "companies" => FeatureFlagScope.Companies,
                _ => throw new BadRequestException("Scope must be Global, Plans or Companies."),
            };

            var targets = new List<FeatureFlagTarget>();

            if (scope == FeatureFlagScope.Global)
            {
                // A global flag applies everywhere; leftover targets would be misleading.
                if (requestedTargets is { Count: > 0 })
                {
                    throw new BadRequestException("A global flag does not take targets.");
                }

                return (scope, targets);
            }

            if (requestedTargets is null || requestedTargets.Count == 0)
            {
                throw new BadRequestException($"A {scope} flag needs at least one target.");
            }

            foreach (var target in requestedTargets)
            {
                var hasPlan = target.PlanId is not null;
                var hasCompany = target.CompanyId is not null;

                if (hasPlan == hasCompany)
                {
                    throw new BadRequestException("Each target must name exactly one plan or one company.");
                }

                if (scope == FeatureFlagScope.Plans && !hasPlan)
                {
                    throw new BadRequestException("A Plans-scoped flag can only target plans.");
                }

                if (scope == FeatureFlagScope.Companies && !hasCompany)
                {
                    throw new BadRequestException("A Companies-scoped flag can only target companies.");
                }

                if (hasPlan)
                {
                    var plan = await _unitOfWork.GetRepository<SubscriptionPlan, int>()
                        .GetByIdAsync(target.PlanId!.Value, cancellationToken)
                        ?? throw new NotFoundException($"Plan {target.PlanId} not found.");
                    _ = plan;
                }

                if (hasCompany)
                {
                    var company = await _unitOfWork.GetRepository<Company, int>()
                        .GetByIdAsync(target.CompanyId!.Value, cancellationToken)
                        ?? throw new NotFoundException($"Company {target.CompanyId} not found.");
                    _ = company;
                }

                targets.Add(new FeatureFlagTarget
                {
                    PlanId = target.PlanId,
                    CompanyId = target.CompanyId,
                });
            }

            return (scope, targets);
        }

        /// <summary>
        /// The companies and plans the caller is associated with, used to evaluate targeted
        /// flags. Platform-wide roles see every company.
        /// </summary>
        private async Task<(IReadOnlySet<int> CompanyIds, IReadOnlySet<int> PlanIds)> ResolveCallerScopeAsync(
            User actor,
            CancellationToken cancellationToken)
        {
            var companyMap = await _readModel.GetUserCompanyMapAsync(cancellationToken);
            var companyIds = companyMap.TryGetValue(actor.Id, out var ids)
                ? ids.ToHashSet()
                : new HashSet<int>();

            if (companyIds.Count == 0)
            {
                return (companyIds, new HashSet<int>());
            }

            var subscriptions = await _unitOfWork.GetRepository<CompanySubscription, int>()
                .GetAllAsync(new LiveSubscriptionsSpec(), cancellationToken);

            var planIds = subscriptions
                .Where(s => companyIds.Contains(s.CompanyId))
                .Select(s => s.PlanId)
                .ToHashSet();

            return (companyIds, planIds);
        }

        private static FeatureFlagItem Map(FeatureFlag flag) => new()
        {
            Id = flag.Id,
            Key = flag.Key,
            Name = flag.Name,
            Description = flag.Description,
            IsEnabled = flag.IsEnabled,
            Scope = flag.Scope.ToString(),
            Targets = flag.Targets
                .Select(t => new FeatureFlagTargetDto { PlanId = t.PlanId, CompanyId = t.CompanyId })
                .ToList(),
            UpdatedAt = flag.UpdatedAt,
        };

        private static string Describe(bool enabled, FeatureFlagScope scope, int targetCount) =>
            (enabled ? "Enabled" : "Disabled") + " " + scope switch
            {
                FeatureFlagScope.Global => "platform-wide.",
                _ => $"for {targetCount} {scope.ToString().ToLowerInvariant()}.",
            };

        private static string RequireKey(string? key)
        {
            var normalized = RequireText(key, "Flag key").ToLowerInvariant();

            if (!FlagKeyPattern.IsMatch(normalized))
            {
                throw new BadRequestException("Flag key must be lowercase and dotted, e.g. \"payroll.export.pdf\".");
            }

            return normalized;
        }

        private static string RequireText(string? value, string label) =>
            string.IsNullOrWhiteSpace(value)
                ? throw new BadRequestException($"{label} is required.")
                : value.Trim();

        private static void RequireRange(int value, int min, int max, string message)
        {
            if (value < min || value > max)
            {
                throw new BadRequestException(message);
            }
        }

        private static bool IsHexColor(string value) =>
            value.Length == 7
            && value[0] == '#'
            && value[1..].All(Uri.IsHexDigit);

        private static string? Clean(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
