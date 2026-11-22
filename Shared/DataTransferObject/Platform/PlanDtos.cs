namespace Shared.DataTransferObject.Platform;

// ------------------------------------------------------------------
// Subscription plans — §6.6
// ------------------------------------------------------------------

public class PlanListQuery
{
    /// <summary>Include archived plans (default false).</summary>
    public bool IncludeArchived { get; init; }
}

public class PlanAddOnDto
{
    public required string Name { get; init; }
    public int Quantity { get; init; } = 1;
    public decimal Price { get; init; }
}

/// <summary>One plan row in the catalogue rail, including its computed commercial footprint.</summary>
public class PlanListItem
{
    public int Id { get; init; }
    public required string Name { get; init; }
    public required string Slug { get; init; }
    public string? Tagline { get; init; }
    public decimal Price { get; init; }
    public required string Currency { get; init; }
    public int CycleCount { get; init; }

    /// <summary>Months | Years.</summary>
    public required string CycleUnit { get; init; }

    /// <summary>Human cadence: Monthly, Every 3 months, Yearly…</summary>
    public required string CycleLabel { get; init; }

    /// <summary>None | Days | TrialPlan.</summary>
    public required string TrialMode { get; init; }

    public int TrialDays { get; init; }
    public int? SeatLimit { get; init; }
    public int? BranchLimit { get; init; }
    public bool IsHighlighted { get; init; }
    public bool IsArchived { get; init; }
    public int SortOrder { get; init; }
    public required IReadOnlyList<string> Features { get; init; }
    public required IReadOnlyList<PlanAddOnDto> AddOns { get; init; }

    /// <summary>Companies on a live subscription to this plan (computed).</summary>
    public int CompaniesOnPlan { get; init; }

    /// <summary>Monthly recurring revenue this plan produces (computed).</summary>
    public decimal Mrr { get; init; }

    public int MrrSharePercent { get; init; }
}

public class PlansListResponse
{
    public required IReadOnlyList<PlanListItem> Items { get; init; }
}

/// <summary>Create/update body. Changes apply to new sign-ups; existing companies keep their snapshot.</summary>
public class PlanUpsertRequest
{
    public required string Name { get; init; }
    public string? Tagline { get; init; }
    public decimal Price { get; init; }
    public int CycleCount { get; init; } = 1;

    /// <summary>Months | Years.</summary>
    public string? CycleUnit { get; init; } = "Months";

    /// <summary>None | Days | TrialPlan.</summary>
    public string? TrialMode { get; init; } = "None";

    public int TrialDays { get; init; }

    /// <summary>Null = unlimited.</summary>
    public int? SeatLimit { get; init; }

    /// <summary>Null = unlimited.</summary>
    public int? BranchLimit { get; init; }

    public bool IsHighlighted { get; init; }
    public required List<string> Features { get; init; }
    public List<PlanAddOnDto>? AddOns { get; init; }
}

public class DuplicatePlanRequest
{
    public required string Name { get; init; }
}
