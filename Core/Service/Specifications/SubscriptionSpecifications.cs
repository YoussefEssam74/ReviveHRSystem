using DomainLayer.Contracts;
using DomainLayer.Models.SubscriptionModule;
using DomainLayer.Models.SubscriptionModule.Enums;

namespace Service.Specifications
{
    /// <summary>One gym's billing agreement, with its invoices (for cycle processing).</summary>
    public class GymSubscriptionByGymIdSpec : BaseSpecification<GymSubscription, int>
    {
        public GymSubscriptionByGymIdSpec(int gymId, bool tracking = false)
        {
            Criteria = s => s.GymId == gymId;
            AddInclude(s => s.Gym);
            AddInclude(s => s.Plan!);
            AddInclude(s => s.Invoices);
            if (tracking) ApplyTracking();
            else ApplyNoTracking();
        }
    }

    /// <summary>One gym's detail page: the agreement and its invoices (payments load separately).</summary>
    public class GymSubscriptionDetailSpec : BaseSpecification<GymSubscription, int>
    {
        public GymSubscriptionDetailSpec(int gymId)
        {
            Criteria = s => s.GymId == gymId;
            AddInclude(s => s.Gym);
            AddInclude(s => s.Plan!);
            AddInclude(s => s.Invoices);
        }
    }

    /// <summary>Every gym's agreement with its invoices (overview totals and status).</summary>
    public class GymSubscriptionsOverviewSpec : BaseSpecification<GymSubscription, int>
    {
        public GymSubscriptionsOverviewSpec()
        {
            AddInclude(s => s.Gym);
            AddInclude(s => s.Plan!);
            AddInclude(s => s.Invoices);
        }
    }

    /// <summary>
    /// Every non-cancelled agreement with invoices, tracked, for the billing sweep.
    /// Deliberately excludes payments: the sweep only needs invoices.
    /// </summary>
    public class GymSubscriptionsForBillingSpec : BaseSpecification<GymSubscription, int>
    {
        public GymSubscriptionsForBillingSpec()
        {
            Criteria = s => s.Status != SubscriptionStatus.Cancelled;
            AddInclude(s => s.Invoices);
            ApplyTracking();
        }
    }

    /// <summary>Access-gate lookup: the billing state of the given gyms only.</summary>
    public class GymSubscriptionsByGymIdsSpec : BaseSpecification<GymSubscription, int>
    {
        public GymSubscriptionsByGymIdsSpec(IReadOnlyCollection<int> gymIds)
        {
            Criteria = s => gymIds.Contains(s.GymId);
            AddInclude(s => s.Invoices);
        }
    }

    /// <summary>
    /// Single-gym access-gate lookup. Invoices are required because access is
    /// evaluated from the invoice due dates, not only from the persisted status.
    /// </summary>
    public class GymSubscriptionAccessSpec : BaseSpecification<GymSubscription, int>
    {
        public GymSubscriptionAccessSpec(int gymId)
        {
            Criteria = s => s.GymId == gymId;
            AddInclude(s => s.Invoices);
        }
    }

    /// <summary>The single platform settings row (Id = 1).</summary>
    public class SubscriptionSettingsSpec : BaseSpecification<SubscriptionSettings, int>
    {
        public SubscriptionSettingsSpec(bool tracking = false)
        {
            Criteria = s => s.Id == 1;
            if (tracking) ApplyTracking();
            else ApplyNoTracking();
        }
    }

    /// <summary>Payment ledger of one gym, newest first.</summary>
    public class SubscriptionPaymentsByGymSpec : BaseSpecification<SubscriptionPayment, int>
    {
        public SubscriptionPaymentsByGymSpec(int gymId)
        {
            Criteria = p => p.GymId == gymId;
            AddInclude(p => p.Invoice);
            OrderByDescending = p => p.PaidAtUtc;
        }
    }

    // ------------------------------------------------------------------
    // Plans + gym-initiated change requests
    // ------------------------------------------------------------------

    /// <summary>One plan by id; tracked for edits/archive.</summary>
    public class SubscriptionPlanByIdSpec : BaseSpecification<SubscriptionPlan, int>
    {
        public SubscriptionPlanByIdSpec(int planId, bool tracking = false)
        {
            Criteria = p => p.Id == planId;
            if (tracking) ApplyTracking();
            else ApplyNoTracking();
        }
    }

    /// <summary>Duplicate-name guard (case-insensitive).</summary>
    public class SubscriptionPlanByNameSpec : BaseSpecification<SubscriptionPlan, int>
    {
        public SubscriptionPlanByNameSpec(string name)
        {
            var wanted = name.Trim().ToLower();
            Criteria = p => p.Name.Trim().ToLower() == wanted;
        }
    }

    /// <summary>Plan catalog with gym usage (admin listing).</summary>
    public class SubscriptionPlansWithGymsSpec : BaseSpecification<SubscriptionPlan, int>
    {
        public SubscriptionPlansWithGymsSpec()
        {
            AddInclude(p => p.Subscriptions);
            OrderBy = p => p.SortOrder;
            ThenByDescending = p => p.Name;
        }
    }

    /// <summary>Active plans a gym can request (gym-side upgrade list).</summary>
    public class ActiveSubscriptionPlansSpec : BaseSpecification<SubscriptionPlan, int>
    {
        public ActiveSubscriptionPlansSpec()
        {
            Criteria = p => p.IsActive;
            OrderBy = p => p.SortOrder;
            ThenByDescending = p => p.Name;
        }
    }

    /// <summary>All change requests for Revive Admin, optionally filtered by status.</summary>
    public class SubscriptionChangeRequestsSpec : BaseSpecification<SubscriptionChangeRequest, int>
    {
        public SubscriptionChangeRequestsSpec(SubscriptionRequestStatus? status = null)
        {
            Criteria = status.HasValue ? r => r.Status == status.Value : r => true;
            AddInclude(r => r.Gym);
            AddInclude(r => r.CurrentPlan!);
            AddInclude(r => r.RequestedPlan!);
            AddInclude(r => r.RequestedBy);
            OrderByDescending = r => r.Id;
        }
    }

    /// <summary>One request with everything needed to decide it; tracked for the review.</summary>
    public class SubscriptionChangeRequestByIdSpec : BaseSpecification<SubscriptionChangeRequest, int>
    {
        public SubscriptionChangeRequestByIdSpec(int requestId)
        {
            Criteria = r => r.Id == requestId;
            AddInclude(r => r.Gym);
            AddInclude(r => r.CurrentPlan!);
            AddInclude(r => r.RequestedPlan!);
            AddInclude(r => r.RequestedBy);
            ApplyTracking();
        }
    }

    /// <summary>Pending requests of one gym (gym-side status banner).</summary>
    public class PendingSubscriptionRequestsByGymSpec : BaseSpecification<SubscriptionChangeRequest, int>
    {
        public PendingSubscriptionRequestsByGymSpec(int gymId)
        {
            Criteria = r => r.GymId == gymId && r.Status == SubscriptionRequestStatus.Pending;
            AddInclude(r => r.RequestedPlan!);
            OrderByDescending = r => r.Id;
        }
    }
}
