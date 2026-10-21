using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Notification;

namespace Presentation.Controllers
{
    /// <summary>
    /// Notifications &amp; Announcements tab (api-spec-from-ui.md §5.7): the signed-in
    /// user's inbox (list / unread-count / mark read / mark all read) and the
    /// announcements broadcast history (list / compose / edit-retract). The inbox
    /// requires only a JWT (rows are user-scoped); announcements are gated
    /// announcements.view / announcements.manage inside the service (ADR-003).
    /// </summary>
    [Route("api/notifications")]
    [Authorize]
    public class NotificationsController(INotificationService _service) : ApiControllerBase
    {
        /// <summary>GET /api/notifications — my notifications, newest first (filters: unread, category).</summary>
        [HttpGet]
        public async Task<ActionResult<NotificationListResponse>> GetNotifications([FromQuery] NotificationListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetMyNotificationsAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>GET /api/notifications/unread-count — header bell badge.</summary>
        [HttpGet("unread-count")]
        public async Task<ActionResult<UnreadCountResponse>> GetUnreadCount(CancellationToken cancellationToken)
        {
            var result = await _service.GetUnreadCountAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/notifications/read-all — marks every unread notification read.</summary>
        [HttpPut("read-all")]
        public async Task<ActionResult<MessageDataResponse>> MarkAllRead(CancellationToken cancellationToken)
        {
            var result = await _service.MarkAllReadAsync(GetActorUserId(), cancellationToken);
            return Ok(result);
        }

        /// <summary>PUT /api/notifications/{id}/read — marks one notification read.</summary>
        [HttpPut("{id:int}/read")]
        public async Task<ActionResult<NotificationItem>> MarkRead(int id, CancellationToken cancellationToken)
        {
            var result = await _service.MarkReadAsync(GetActorUserId(), id, cancellationToken);
            return Ok(result);
        }
    }

    /// <summary>Announcement broadcast history + compose (api-spec-from-ui.md §5.7).</summary>
    [Route("api/announcements")]
    [Authorize]
    public class AnnouncementsController(INotificationService _service) : ApiControllerBase
    {
        /// <summary>GET /api/announcements — history cards with read-rate (announcements.view).</summary>
        [HttpGet]
        public async Task<ActionResult<AnnouncementListResponse>> GetAnnouncements([FromQuery] AnnouncementListQuery query, CancellationToken cancellationToken)
        {
            var result = await _service.GetAnnouncementsAsync(GetActorUserId(), query, cancellationToken);
            return Ok(result);
        }

        /// <summary>POST /api/announcements — compose + fan out to the audience (announcements.manage) → 201.</summary>
        [HttpPost]
        public async Task<ActionResult<AnnouncementDataResponse>> CreateAnnouncement([FromBody] CreateAnnouncementRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.CreateAnnouncementAsync(GetActorUserId(), request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, new AnnouncementDataResponse { Data = result });
        }

        /// <summary>PUT /api/announcements/{id} — edit, or retract via status "Cancelled" (announcements.manage).</summary>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<AnnouncementDataResponse>> UpdateAnnouncement(int id, [FromBody] UpdateAnnouncementRequest request, CancellationToken cancellationToken)
        {
            var result = await _service.UpdateAnnouncementAsync(GetActorUserId(), id, request, cancellationToken);
            return Ok(new AnnouncementDataResponse { Data = result });
        }
    }
}
