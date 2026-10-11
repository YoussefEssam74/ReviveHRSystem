using DomainLayer.Models.UserModule.Enums;
using Microsoft.AspNetCore.Authorization;
using ServiceAbstraction.Services;

namespace Presentation.Authorization;

/// <summary>
/// Evaluates <see cref="FeatureAccessRequirement"/> against the effective feature
/// levels of the caller in the token's gym (ADR-003 Amendment 1). Both ids come from
/// the token: a caller without a gym-scoped token fails the requirement, and the gym
/// can never come from the request.
/// </summary>
public class FeatureAccessHandler(IPermissionService permissionService)
    : AuthorizationHandler<FeatureAccessRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, FeatureAccessRequirement requirement)
    {
        var uidClaim = context.User.FindFirst("uid")?.Value ?? context.User.FindFirst("sub")?.Value;
        var gymClaim = context.User.FindFirst("gymId")?.Value;

        if (!int.TryParse(uidClaim, out var userId) || !int.TryParse(gymClaim, out var gymId))
        {
            context.Fail();
            return;
        }

        var hasAccess = await permissionService.HasAccessAsync(
            userId, gymId, requirement.Feature, requirement.RequiredLevel);

        if (hasAccess)
        {
            context.Succeed(requirement);
        }
        else
        {
            context.Fail();
        }
    }
}
