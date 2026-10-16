using DomainLayer.Models.UserModule.Enums;
using Microsoft.AspNetCore.Authorization;
using Shared.Authorization;

namespace Presentation.Authorization;

/// <summary>
/// Policy-based feature access for endpoints (ADR-003 Amendment 1). A policy name is
/// "feature:{code}:{level}"; policies are registered for every catalog feature x
/// View/Edit level at startup (see AuthorizationPolicies.Register).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class HasFeatureAccessAttribute : AuthorizeAttribute
{
    public HasFeatureAccessAttribute(string feature, AccessLevel requiredLevel)
    {
        Feature = feature;
        RequiredLevel = requiredLevel;
        Policy = AuthorizationPolicies.For(feature, requiredLevel);
    }

    public string Feature { get; }
    public AccessLevel RequiredLevel { get; }
}

/// <summary>Policy-name helpers for feature access policies.</summary>
public static class AuthorizationPolicies
{
    public static string For(string feature, AccessLevel requiredLevel) =>
        $"feature:{feature}:{(int)requiredLevel}";

    /// <summary>Registers a policy for every catalog feature at View and Edit level.</summary>
    public static void Register(AuthorizationOptions options)
    {
        foreach (var feature in Features.All)
        {
            AddFeature(options, feature, AccessLevel.View);
            AddFeature(options, feature, AccessLevel.Edit);
        }
    }

    private static void AddFeature(AuthorizationOptions options, string feature, AccessLevel level) =>
        options.AddPolicy(For(feature, level), policy =>
            policy.RequireAuthenticatedUser()
                  .AddRequirements(new FeatureAccessRequirement(feature, level)));
}

/// <summary>Requirement: the caller must hold at least <see cref="RequiredLevel"/> on
/// <see cref="Feature"/> in the gym the token is scoped to.</summary>
public sealed class FeatureAccessRequirement : IAuthorizationRequirement
{
    public FeatureAccessRequirement(string feature, AccessLevel requiredLevel)
    {
        Feature = feature;
        RequiredLevel = requiredLevel;
    }

    public string Feature { get; }
    public AccessLevel RequiredLevel { get; }
}
