using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.BillingModule;
using DomainLayer.Models.BillingModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Service.Services
{
    /// <summary>
    /// Subscription plan catalogue. Price changes never touch an existing agreement: a
    /// company's <c>CompanySubscription</c> snapshots the terms it was sold, so editing a
    /// plan only affects future sign-ups until the next renewal.
    /// </summary>
    public sealed class PlanService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IPlatformReadRepository _readModel) : IPlanService
    {
        public async Task<PlansListResponse> GetPlansAsync(int? actorUserId, PlanListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.plans.view", cancellationToken);

            var plans = (await _unitOfWork.GetRepository<SubscriptionPlan, int>()
                .GetAllAsync(new AllPlansSpec(query.IncludeArchived), cancellationToken)).ToList();

            var footprints = await _readModel.GetPlanFootprintsAsync(cancellationToken);
            var totalMrr = footprints.Sum(f => f.Mrr);

            return new PlansListResponse
            {
                Items = plans
                    .Select(p => BuildItem(p, footprints.FirstOrDefault(f => f.PlanId == p.Id), totalMrr))
                    .ToList(),
            };
        }

        public async Task<PlanListItem> GetPlanAsync(int? actorUserId, int planId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.plans.view", cancellationToken);

            var plan = await LoadPlanAsync(planId, cancellationToken);
            var footprints = await _readModel.GetPlanFootprintsAsync(cancellationToken);

            return BuildItem(plan, footprints.FirstOrDefault(f => f.PlanId == plan.Id), footprints.Sum(f => f.Mrr));
        }

        public async Task<PlanListItem> CreatePlanAsync(int? actorUserId, PlanUpsertRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.plans.manage", cancellationToken);

            var name = RequireText(request.Name, "Plan name");
            await EnsureNameAvailableAsync(name, null, cancellationToken);

            var validated = Validate(request);

            if (request.IsHighlighted)
            {
                await ClearHighlightAsync(null, cancellationToken);
            }

            var plan = new SubscriptionPlan
            {
                Name = name,
                Slug = await BuildUniqueSlugAsync(name, cancellationToken),
                Tagline = Clean(request.Tagline),
                Price = validated.Price,
                Currency = "EGP",
                CycleCount = validated.CycleCount,
                CycleUnit = validated.CycleUnit,
                TrialMode = validated.TrialMode,
                TrialDays = validated.TrialDays,
                SeatLimit = validated.SeatLimit,
                BranchLimit = validated.BranchLimit,
                IsHighlighted = request.IsHighlighted,
                SortOrder = await NextSortOrderAsync(cancellationToken),
                Features = validated.Features
                    .Select((label, index) => new PlanFeature { Label = label, SortOrder = index + 1 })
                    .ToList(),
                AddOns = validated.AddOns
                    .Select((addOn, index) => new PlanAddOn
                    {
                        Name = addOn.Name,
                        Quantity = addOn.Quantity,
                        Price = addOn.Price,
                        SortOrder = index + 1,
                    })
                    .ToList(),
            };

            await _unitOfWork.GetRepository<SubscriptionPlan, int>().AddAsync(plan, cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Created subscription plan",
                category: "Settings",
                severity: "info",
                entityType: "SubscriptionPlan",
                entityId: 0,
                companyId: null,
                gymId: null,
                target: $"{name} · {plan.Price:N0} {PlatformHelpers.CycleLabel(plan.CycleCount, plan.CycleUnit).ToLowerInvariant()}",
                detail: $"Seats {Describe(plan.SeatLimit)} · branches {Describe(plan.BranchLimit)} · "
                        + $"{plan.Features.Count} features · {plan.AddOns.Count} add-ons.",
                values: new { request.Name, request.Price, request.SeatLimit, request.BranchLimit },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return await GetPlanAsync(actor.Id, plan.Id, cancellationToken);
        }

        public async Task<PlanListItem> UpdatePlanAsync(int? actorUserId, int planId, PlanUpsertRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.plans.manage", cancellationToken);

            var plan = await LoadPlanAsync(planId, cancellationToken);
            var before = new { plan.Name, plan.Price, plan.SeatLimit, plan.BranchLimit };

            var name = RequireText(request.Name, "Plan name");
            await EnsureNameAvailableAsync(name, planId, cancellationToken);

            var validated = Validate(request);

            if (request.IsHighlighted)
            {
                await ClearHighlightAsync(planId, cancellationToken);
            }

            plan.Name = name;
            plan.Tagline = Clean(request.Tagline);
            plan.Price = validated.Price;
            plan.CycleCount = validated.CycleCount;
            plan.CycleUnit = validated.CycleUnit;
            plan.TrialMode = validated.TrialMode;
            plan.TrialDays = validated.TrialDays;
            plan.SeatLimit = validated.SeatLimit;
            plan.BranchLimit = validated.BranchLimit;
            plan.IsHighlighted = request.IsHighlighted;

            // Features and add-ons are replaced wholesale: the editor submits the full list.
            plan.Features.Clear();
            foreach (var (label, index) in validated.Features.Select((l, i) => (l, i)))
            {
                plan.Features.Add(new PlanFeature { PlanId = plan.Id, Label = label, SortOrder = index + 1 });
            }

            plan.AddOns.Clear();
            foreach (var (addOn, index) in validated.AddOns.Select((a, i) => (a, i)))
            {
                plan.AddOns.Add(new PlanAddOn
                {
                    PlanId = plan.Id,
                    Name = addOn.Name,
                    Quantity = addOn.Quantity,
                    Price = addOn.Price,
                    SortOrder = index + 1,
                });
            }

            _unitOfWork.GetRepository<SubscriptionPlan, int>().Update(plan);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Updated subscription plan",
                category: "Settings",
                severity: "warning",
                entityType: "SubscriptionPlan",
                entityId: plan.Id,
                companyId: null,
                gymId: null,
                target: $"{plan.Name} · {plan.Price:N0} {PlatformHelpers.CycleLabel(plan.CycleCount, plan.CycleUnit).ToLowerInvariant()}",
                detail: "Applies to new sign-ups only; existing companies keep their agreed terms until renewal.",
                values: new { Before = before, After = new { plan.Name, plan.Price, plan.SeatLimit, plan.BranchLimit } },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return await GetPlanAsync(actor.Id, plan.Id, cancellationToken);
        }

        public async Task<PlanListItem> DuplicatePlanAsync(int? actorUserId, int planId, DuplicatePlanRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.plans.manage", cancellationToken);

            var source = await LoadPlanAsync(planId, cancellationToken);
            var name = RequireText(request.Name, "Plan name");
            await EnsureNameAvailableAsync(name, null, cancellationToken);

            // A duplicate never inherits the highlight: two "Popular" plans would be ambiguous.
            var copy = new SubscriptionPlan
            {
                Name = name,
                Slug = await BuildUniqueSlugAsync(name, cancellationToken),
                Tagline = source.Tagline,
                Price = source.Price,
                Currency = source.Currency,
                CycleCount = source.CycleCount,
                CycleUnit = source.CycleUnit,
                TrialMode = source.TrialMode,
                TrialDays = source.TrialDays,
                SeatLimit = source.SeatLimit,
                BranchLimit = source.BranchLimit,
                IsHighlighted = false,
                SortOrder = await NextSortOrderAsync(cancellationToken),
                Features = source.Features
                    .OrderBy(f => f.SortOrder)
                    .Select((f, index) => new PlanFeature { Label = f.Label, SortOrder = index + 1 })
                    .ToList(),
                AddOns = source.AddOns
                    .OrderBy(a => a.SortOrder)
                    .Select((a, index) => new PlanAddOn
                    {
                        Name = a.Name,
                        Quantity = a.Quantity,
                        Price = a.Price,
                        SortOrder = index + 1,
                    })
                    .ToList(),
            };

            await _unitOfWork.GetRepository<SubscriptionPlan, int>().AddAsync(copy, cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Duplicated subscription plan",
                category: "Settings",
                severity: "info",
                entityType: "SubscriptionPlan",
                entityId: 0,
                companyId: null,
                gymId: null,
                target: $"{name} · copied from {source.Name}",
                detail: "Features and add-ons copied. The copy is not highlighted.",
                values: new { SourcePlanId = planId, request.Name },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return await GetPlanAsync(actor.Id, copy.Id, cancellationToken);
        }

        public async Task ArchivePlanAsync(int? actorUserId, int planId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.plans.manage", cancellationToken);

            var plan = await LoadPlanAsync(planId, cancellationToken);

            var liveSubscriptions = await _unitOfWork.GetRepository<CompanySubscription, int>()
                .CountAsync(new LiveSubscriptionsByPlanSpec(planId), cancellationToken);

            if (liveSubscriptions > 0)
            {
                throw new BadRequestException(
                    $"This plan is in use by {liveSubscriptions} company subscription(s). Move them to another plan before archiving it.");
            }

            plan.IsArchived = true;
            plan.IsHighlighted = false;
            _unitOfWork.GetRepository<SubscriptionPlan, int>().Update(plan);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Archived subscription plan",
                category: "Settings",
                severity: "warning",
                entityType: "SubscriptionPlan",
                entityId: plan.Id,
                companyId: null,
                gymId: null,
                target: plan.Name,
                detail: "Archived plans stay readable for historical invoices but cannot be assigned.",
                values: new { plan.Name },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ------------------------------------------------------------------
        // Internals
        // ------------------------------------------------------------------

        private async Task<SubscriptionPlan> LoadPlanAsync(int planId, CancellationToken cancellationToken) =>
            await _unitOfWork.GetRepository<SubscriptionPlan, int>()
                .GetByIdAsync(new PlanDetailSpec(planId), cancellationToken)
            ?? throw new NotFoundException("Plan not found.");

        private static PlanListItem BuildItem(SubscriptionPlan plan, PlanFootprintRow? footprint, decimal totalMrr) =>
            new()
            {
                Id = plan.Id,
                Name = plan.Name,
                Slug = plan.Slug,
                Tagline = plan.Tagline,
                Price = plan.Price,
                Currency = plan.Currency,
                CycleCount = plan.CycleCount,
                CycleUnit = PlatformHelpers.CycleUnitLabel(plan.CycleUnit),
                CycleLabel = PlatformHelpers.CycleLabel(plan.CycleCount, plan.CycleUnit),
                TrialMode = plan.TrialMode.ToString(),
                TrialDays = plan.TrialDays,
                SeatLimit = plan.SeatLimit,
                BranchLimit = plan.BranchLimit,
                IsHighlighted = plan.IsHighlighted,
                IsArchived = plan.IsArchived,
                SortOrder = plan.SortOrder,
                Features = plan.Features.OrderBy(f => f.SortOrder).Select(f => f.Label).ToList(),
                AddOns = plan.AddOns
                    .OrderBy(a => a.SortOrder)
                    .Select(a => new PlanAddOnDto { Name = a.Name, Quantity = a.Quantity, Price = a.Price })
                    .ToList(),
                CompaniesOnPlan = footprint?.Companies ?? 0,
                Mrr = footprint?.Mrr ?? 0,
                MrrSharePercent = totalMrr > 0 && footprint is not null
                    ? (int)Math.Round(footprint.Mrr * 100m / totalMrr)
                    : 0,
            };

        private sealed record ValidatedPlan(
            decimal Price,
            int CycleCount,
            PlanCycleUnit CycleUnit,
            TrialMode TrialMode,
            int TrialDays,
            int? SeatLimit,
            int? BranchLimit,
            List<string> Features,
            List<PlanAddOnDto> AddOns);

        private static ValidatedPlan Validate(PlanUpsertRequest request)
        {
            if (request.Price <= 0)
            {
                throw new BadRequestException("A plan needs a price greater than zero.");
            }

            var cycleCount = request.CycleCount < 1 ? 1 : request.CycleCount;
            if (cycleCount > 60)
            {
                throw new BadRequestException("The billing cycle cannot exceed 60 months or years.");
            }

            var cycleUnit = request.CycleUnit?.Trim().ToLowerInvariant() switch
            {
                null or "" or "months" or "month" => PlanCycleUnit.Months,
                "years" or "year" => PlanCycleUnit.Years,
                _ => throw new BadRequestException("Cycle unit must be Months or Years."),
            };

            var trialMode = request.TrialMode?.Trim().ToLowerInvariant() switch
            {
                null or "" or "none" => TrialMode.None,
                "days" => TrialMode.Days,
                "trial" or "trialplan" => TrialMode.TrialPlan,
                _ => throw new BadRequestException("Trial mode must be None, Days or TrialPlan."),
            };

            var trialDays = trialMode == TrialMode.Days ? request.TrialDays : 0;
            if (trialMode == TrialMode.Days && trialDays < 1)
            {
                throw new BadRequestException("A free trial needs a length of at least one day.");
            }

            if (request.SeatLimit is <= 0)
            {
                throw new BadRequestException("Seat limit must be positive, or empty for unlimited.");
            }

            if (request.BranchLimit is <= 0)
            {
                throw new BadRequestException("Branch limit must be positive, or empty for unlimited.");
            }

            var features = (request.Features ?? [])
                .Select(f => f?.Trim())
                .Where(f => !string.IsNullOrWhiteSpace(f))
                .Select(f => f!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (features.Count == 0)
            {
                throw new BadRequestException("Select at least one feature for the plan.");
            }

            var addOns = (request.AddOns ?? [])
                .Where(a => a is not null && !string.IsNullOrWhiteSpace(a.Name))
                .Select(a => new PlanAddOnDto
                {
                    Name = a.Name.Trim(),
                    Quantity = a.Quantity < 1 ? 1 : a.Quantity,
                    Price = a.Price,
                })
                .Where(a => a.Price > 0)
                .ToList();

            return new ValidatedPlan(
                request.Price,
                cycleCount,
                cycleUnit,
                trialMode,
                trialDays,
                request.SeatLimit,
                request.BranchLimit,
                features,
                addOns);
        }

        private async Task EnsureNameAvailableAsync(string name, int? excludePlanId, CancellationToken cancellationToken)
        {
            var clash = await _unitOfWork.GetRepository<SubscriptionPlan, int>()
                .GetByIdAsync(new PlanByNameSpec(name), cancellationToken);

            if (clash is not null && clash.Id != excludePlanId)
            {
                throw new BadRequestException("A plan with that name already exists.");
            }
        }

        /// <summary>Derives a URL-safe slug, disambiguating with a numeric suffix when needed.</summary>
        private async Task<string> BuildUniqueSlugAsync(string name, CancellationToken cancellationToken)
        {
            var baseSlug = new string(name.Trim().ToLowerInvariant()
                .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
                .ToArray());

            baseSlug = System.Text.RegularExpressions.Regex.Replace(baseSlug, "-{2,}", "-").Trim('-');
            if (baseSlug.Length == 0)
            {
                baseSlug = "plan";
            }
            if (baseSlug.Length > 100)
            {
                baseSlug = baseSlug[..100].Trim('-');
            }

            var existing = (await _unitOfWork.GetRepository<SubscriptionPlan, int>()
                .GetAllAsync(cancellationToken))
                .Select(p => p.Slug)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (!existing.Contains(baseSlug))
            {
                return baseSlug;
            }

            var suffix = 2;
            while (existing.Contains($"{baseSlug}-{suffix}"))
            {
                suffix++;
            }

            return $"{baseSlug}-{suffix}";
        }

        private async Task ClearHighlightAsync(int? exceptPlanId, CancellationToken cancellationToken)
        {
            var repository = _unitOfWork.GetRepository<SubscriptionPlan, int>();
            var plans = await repository.GetAllAsync(new HighlightedPlansSpec(exceptPlanId), cancellationToken);

            foreach (var plan in plans)
            {
                plan.IsHighlighted = false;
                repository.Update(plan);
            }
        }

        private async Task<int> NextSortOrderAsync(CancellationToken cancellationToken)
        {
            var plans = await _unitOfWork.GetRepository<SubscriptionPlan, int>().GetAllAsync(cancellationToken);
            return plans.Select(p => p.SortOrder).DefaultIfEmpty(0).Max() + 1;
        }

        private static string Describe(int? limit) => limit?.ToString() ?? "unlimited";

        private static string RequireText(string? value, string label) =>
            string.IsNullOrWhiteSpace(value)
                ? throw new BadRequestException($"{label} is required.")
                : value.Trim();

        private static string? Clean(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
