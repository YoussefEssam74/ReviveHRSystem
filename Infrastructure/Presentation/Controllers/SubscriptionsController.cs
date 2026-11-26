using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Subscription;

namespace Presentation.Controllers
{
    /// <summary>
    /// Subscription management &amp; automated access control (Revive Admin only).
    /// Every action is additionally gated to Top Management inside the service, so
    /// neither an HR account nor a gym account can read or change billing.
    /// </summary>
    [ApiController]
    [Route("api/subscriptions")]
    [Authorize]
    public class SubscriptionsController(ISubscriptionService _subscriptionService) : ApiControllerBase
    {
        /// <summary>
        /// GET /api/subscriptions — every gym's billing status, the platform settings,
        /// totals and the active gyms that are not billed yet.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<SubscriptionOverviewResponse>> GetOverview(CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.GetOverviewAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/subscriptions/{gymId} — one gym's subscription, invoices and payment ledger.</summary>
        [HttpGet("{gymId:int}")]
        public async Task<ActionResult<GymSubscriptionDetailResponse>> GetGymSubscription(
            int gymId, CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.GetGymSubscriptionAsync(GetActorUserId(), gymId, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// PUT /api/subscriptions/{gymId} — creates the billing agreement or updates
        /// its amount, cycle, grace, reminder lead and auto-suspension flag.
        /// </summary>
        [HttpPut("{gymId:int}")]
        public async Task<ActionResult<SubscriptionActionResponse>> SaveSubscription(
            int gymId, [FromBody] SaveGymSubscriptionRequest request, CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.SaveGymSubscriptionAsync(
                GetActorUserId(), gymId, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// POST /api/subscriptions/{gymId}/payments — records a confirmed payment,
        /// settles the oldest invoices and automatically restores suspended access.
        /// </summary>
        [HttpPost("{gymId:int}/payments")]
        public async Task<ActionResult<SubscriptionActionResponse>> RecordPayment(
            int gymId, [FromBody] RecordSubscriptionPaymentRequest request, CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.RecordPaymentAsync(
                GetActorUserId(), gymId, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/subscriptions/{gymId}/suspend — manually blocks the gym's system access.</summary>
        [HttpPost("{gymId:int}/suspend")]
        public async Task<ActionResult<SubscriptionActionResponse>> Suspend(
            int gymId, [FromBody] SuspendSubscriptionRequest request, CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.SuspendAsync(
                GetActorUserId(), gymId, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// POST /api/subscriptions/{gymId}/reactivate — manually restores access for a
        /// bounded override window.
        /// </summary>
        [HttpPost("{gymId:int}/reactivate")]
        public async Task<ActionResult<SubscriptionActionResponse>> Reactivate(
            int gymId, [FromBody] ReactivateSubscriptionRequest request, CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.ReactivateAsync(
                GetActorUserId(), gymId, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/subscriptions/settings — platform-wide cycle, grace, reminder and suspension defaults.</summary>
        [HttpPut("settings")]
        public async Task<ActionResult<SubscriptionSettingsDto>> UpdateSettings(
            [FromBody] UpdateSubscriptionSettingsRequest request, CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.UpdateSettingsAsync(
                GetActorUserId(), request, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// POST /api/subscriptions/run-cycle — runs the billing sweep immediately
        /// (invoices, reminders, overdue notices, suspensions, restorations).
        /// </summary>
        [HttpPost("run-cycle")]
        public async Task<ActionResult<RunSubscriptionCycleResponse>> RunCycle(CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.RunCycleAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        // ------------------------------------------------------------------
        // Gym-side self-service (Branch Manager / Super Admin of the active gym)
        // ------------------------------------------------------------------

        /// <summary>
        /// GET /api/subscriptions/mine — the active gym's plan, status, due date,
        /// invoices, payments, available plans and pending requests.
        /// </summary>
        [HttpGet("mine")]
        public async Task<ActionResult<MySubscriptionResponse>> GetMine(CancellationToken cancellationToken)
        {
            var gymId = GetGymIdFromToken();
            if (gymId is null)
            {
                return BadRequest("Select a gym before viewing its subscription.");
            }

            var result = await _subscriptionService.GetMySubscriptionAsync(
                GetActorUserId(), gymId.Value, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// POST /api/subscriptions/mine/requests — gym admin submits a renewal or
        /// plan-change request for Revive Admin review.
        /// </summary>
        [HttpPost("mine/requests")]
        public async Task<ActionResult<SubscriptionRequestDto>> CreateMyRequest(
            [FromBody] CreateSubscriptionRequestRequest request, CancellationToken cancellationToken)
        {
            var gymId = GetGymIdFromToken();
            if (gymId is null)
            {
                return BadRequest("Select a gym before requesting a subscription change.");
            }

            var result = await _subscriptionService.CreateMyRequestAsync(
                GetActorUserId(), gymId.Value, request, cancellationToken);
            return Ok(result);
        }

        // ------------------------------------------------------------------
        // Revive Admin request review
        // ------------------------------------------------------------------

        /// <summary>GET /api/subscriptions/requests?status=Pending|Approved|Rejected|Cancelled|All</summary>
        [HttpGet("requests")]
        public async Task<ActionResult<IReadOnlyList<SubscriptionRequestDto>>> GetRequests(
            [FromQuery] string? status, CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.GetRequestsAsync(
                GetActorUserId(), status, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/subscriptions/requests/{requestId}/approve — applies the plan and ensures the renewal invoice.</summary>
        [HttpPost("requests/{requestId:int}/approve")]
        public async Task<ActionResult<SubscriptionActionResponse>> ApproveRequest(
            int requestId, [FromBody] ReviewSubscriptionRequestRequest request, CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.ApproveRequestAsync(
                GetActorUserId(), requestId, request, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/subscriptions/requests/{requestId}/reject — declines the request and notifies the gym.</summary>
        [HttpPost("requests/{requestId:int}/reject")]
        public async Task<ActionResult<SubscriptionActionResponse>> RejectRequest(
            int requestId, [FromBody] ReviewSubscriptionRequestRequest request, CancellationToken cancellationToken)
        {
            var result = await _subscriptionService.RejectRequestAsync(
                GetActorUserId(), requestId, request, cancellationToken);
            return Ok(result);
        }
    }
}
