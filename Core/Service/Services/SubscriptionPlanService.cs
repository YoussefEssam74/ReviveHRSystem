using System.Text.Json;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.SubscriptionModule;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.Subscription;

namespace Service.Services
{
    /// <summary>Plan catalog CRUD for Revive Admin; active plans are readable by gym accounts.</summary>
    public sealed class SubscriptionPlanService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess) : ISubscriptionPlanService
    {
        public async Task<IReadOnlyList<SubscriptionPlanDto>> GetPlansAsync(
            int? actorUserId, int? gymId, CancellationToken cancellationToken = default)
        {
            var actor = await EnsureAuthenticatedAsync(actorUserId, cancellationToken);
            var isAdmin = await IsTopManagementAsync(actor.Id, cancellationToken);
            if (!isAdmin)
            {
                if (gymId is null or <= 0)
                {
                    throw new UnAuthorizedException("Select a gym before viewing subscription plans.");
                }

                await EnsureGymAdminAsync(actor, gymId.Value, cancellationToken);
            }

            var plans = isAdmin
                ? await unitOfWork.GetRepository<SubscriptionPlan, int>()
                    .GetAllAsync(new SubscriptionPlansWithGymsSpec(), cancellationToken)
                : await unitOfWork.GetRepository<SubscriptionPlan, int>()
                    .GetAllAsync(new ActiveSubscriptionPlansSpec(), cancellationToken);

            return plans.Select(ToDto).ToList();
        }

        public async Task<SubscriptionPlanDto> CreatePlanAsync(
            int? actorUserId, SaveSubscriptionPlanRequest request, CancellationToken cancellationToken = default)
        {
            await EnsureAdminAsync(actorUserId, cancellationToken);
            await EnsureNameAvailableAsync(request.Name, excludePlanId: null, cancellationToken);

            var plan = new SubscriptionPlan
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim(),
                PricePerCycle = request.PricePerCycle,
                BillingCycleMonths = request.BillingCycleMonths,
                GracePeriodDays = request.GracePeriodDays,
                ReminderLeadDays = request.ReminderLeadDays,
                IsActive = request.IsActive,
                SortOrder = request.SortOrder,
            };
            await unitOfWork.GetRepository<SubscriptionPlan, int>().AddAsync(plan, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            await AddAuditAsync(actorUserId, "SubscriptionPlanCreated", plan.Id,
                new { plan.Name, plan.PricePerCycle, plan.BillingCycleMonths }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return ToDto(plan);
        }

        public async Task<SubscriptionPlanDto> UpdatePlanAsync(
            int? actorUserId, int planId, SaveSubscriptionPlanRequest request, CancellationToken cancellationToken = default)
        {
            await EnsureAdminAsync(actorUserId, cancellationToken);
            var plan = await unitOfWork.GetRepository<SubscriptionPlan, int>()
                .GetByIdAsync(new SubscriptionPlanByIdSpec(planId, tracking: true), cancellationToken)
                ?? throw new NotFoundException("Subscription plan not found.");

            await EnsureNameAvailableAsync(request.Name, excludePlanId: planId, cancellationToken);

            plan.Name = request.Name.Trim();
            plan.Description = request.Description?.Trim();
            plan.PricePerCycle = request.PricePerCycle;
            plan.BillingCycleMonths = request.BillingCycleMonths;
            plan.GracePeriodDays = request.GracePeriodDays;
            plan.ReminderLeadDays = request.ReminderLeadDays;
            plan.IsActive = request.IsActive;
            plan.SortOrder = request.SortOrder;

            await unitOfWork.SaveChangesAsync(cancellationToken);
            await AddAuditAsync(actorUserId, "SubscriptionPlanUpdated", plan.Id,
                new { plan.Name, plan.PricePerCycle, plan.BillingCycleMonths, plan.IsActive }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return ToDto(plan);
        }

        public async Task ArchivePlanAsync(int? actorUserId, int planId, CancellationToken cancellationToken = default)
        {
            await EnsureAdminAsync(actorUserId, cancellationToken);
            var plan = await unitOfWork.GetRepository<SubscriptionPlan, int>()
                .GetByIdAsync(new SubscriptionPlanByIdSpec(planId, tracking: true), cancellationToken)
                ?? throw new NotFoundException("Subscription plan not found.");

            plan.IsActive = false;
            await unitOfWork.SaveChangesAsync(cancellationToken);

            await AddAuditAsync(actorUserId, "SubscriptionPlanArchived", plan.Id, new { plan.Name }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        private async Task<User> EnsureAuthenticatedAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByIdSpec(actorUserId.Value), cancellationToken);
            if (user is null || !user.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            return user;
        }

        private async Task<bool> IsTopManagementAsync(int userId, CancellationToken cancellationToken)
        {
            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserSessionStatusSpec(userId), cancellationToken);
            return user?.UserType == UserType.TopManagement;
        }

        private async Task EnsureAdminAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null or <= 0)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var user = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserSessionStatusSpec(actorUserId.Value), cancellationToken);
            if (user is null || !user.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            if (user.UserType != UserType.TopManagement)
            {
                throw new UnAuthorizedException("Only Revive Admin can manage subscription plans.");
            }
        }

        private async Task EnsureGymAdminAsync(User user, int gymId, CancellationToken cancellationToken)
        {
            if (user.UserType == UserType.TopManagement)
            {
                return;
            }

            var roles = await userAccess.GetGymRoleNamesAsync(user.Id, gymId, cancellationToken);
            if (!roles.Contains(RoleNames.BranchManager, StringComparer.Ordinal)
                && !roles.Contains(RoleNames.SuperAdmin, StringComparer.Ordinal))
            {
                throw new UnAuthorizedException(
                    "Only the gym's Branch Manager or Super Admin can view subscription plans.");
            }
        }

        private async Task EnsureNameAvailableAsync(
            string name, int? excludePlanId, CancellationToken cancellationToken)
        {
            var existing = await unitOfWork.GetRepository<SubscriptionPlan, int>()
                .GetByIdAsync(new SubscriptionPlanByNameSpec(name), cancellationToken);
            if (existing is not null && existing.Id != excludePlanId)
            {
                throw new BadRequestException($"A subscription plan named \"{name.Trim()}\" already exists.");
            }
        }

        private async Task AddAuditAsync(
            int? actorUserId, string action, int entityId, object values, CancellationToken cancellationToken)
        {
            await unitOfWork.GetRepository<AuditLog, int>().AddAsync(new AuditLog
            {
                UserId = actorUserId,
                Action = action,
                EntityType = nameof(SubscriptionPlan),
                EntityId = entityId,
                NewValues = JsonSerializer.Serialize(values),
                Timestamp = DateTime.UtcNow,
            }, cancellationToken);
        }

        private static SubscriptionPlanDto ToDto(SubscriptionPlan plan) => new()
        {
            Id = plan.Id,
            Name = plan.Name,
            Description = plan.Description,
            PricePerCycle = plan.PricePerCycle,
            BillingCycleMonths = plan.BillingCycleMonths,
            GracePeriodDays = plan.GracePeriodDays,
            ReminderLeadDays = plan.ReminderLeadDays,
            IsActive = plan.IsActive,
            SortOrder = plan.SortOrder,
            GymCount = plan.Subscriptions.Count,
        };
    }
}
