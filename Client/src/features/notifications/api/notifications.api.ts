import { apiRequest } from '../../../lib/api-client'
import { withQuery, type PagedResult } from '../../../lib/paged'

/**
 * Notifications (S5.7) — the signed-in user's own inbox; a JWT is enough, no
 * permission key. `color` is the badge tone (yellow | green | blue | red |
 * purple) and `link` the in-app page the row points at.
 */
export interface NotificationItem {
  id: number
  /** Requests | Recruitment | Document | System | Announcements. */
  category: string
  title: string
  description: string | null
  date: string
  read: boolean
  color: string | null
  link: string | null
}

/** The paged envelope every list endpoint returns. */
export type Paged<T> = PagedResult<T>

export interface UnreadCountResponse {
  count: number
}

/** Filter categories accepted by GET /api/notifications. */
export const NOTIFICATION_CATEGORIES = ['Requests', 'Recruitment', 'Document', 'System', 'Announcements'] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export interface NotificationListParams {
  /** true = only unread rows. */
  unread?: boolean
  category?: NotificationCategory | string
  page?: number
  pageSize?: number
  /** Callers that keep the signal in the params object (portal hooks). */
  signal?: AbortSignal
}

/** GET /api/notifications — newest first, scoped to the caller. */
export function getNotifications(
  params: NotificationListParams = {},
  signal?: AbortSignal,
): Promise<PagedResult<NotificationItem>> {
  return apiRequest<PagedResult<NotificationItem>>(
    withQuery('/api/notifications', {
      unread: params.unread ? true : undefined,
      category: params.category,
      page: params.page,
      pageSize: params.pageSize,
    }),
    { signal: params.signal ?? signal },
  )
}

/** GET /api/notifications/unread-count — the header bell badge. */
export function getUnreadCount(signal?: AbortSignal): Promise<UnreadCountResponse> {
  return apiRequest<UnreadCountResponse>('/api/notifications/unread-count', { signal })
}

/** PUT /api/notifications/read-all — marks every unread row read. */
export function putReadAll(signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/notifications/read-all', { method: 'PUT', signal })
}

/** PUT /api/notifications/{id}/read — marks one owned row read (another user's row → 404). */
export function putReadOne(id: number, signal?: AbortSignal): Promise<NotificationItem> {
  return apiRequest<NotificationItem>(`/api/notifications/${id}/read`, { method: 'PUT', signal })
}

/** Portal naming for the two mark-read operations. */
export function putMarkRead(id: number, signal?: AbortSignal): Promise<NotificationItem> {
  return putReadOne(id, signal)
}

export function putMarkAllRead(signal?: AbortSignal): Promise<{ message: string }> {
  return putReadAll(signal)
}

// ---------------------------------------------------------------------------
// Announcements (the Notifications page's second tab, mock §Notifications).
// Reads need announcements.view; composing needs announcements.manage — the API
// enforces both, the UI only hides the compose action.
// ---------------------------------------------------------------------------

/** One announcement card (GET /api/announcements items). */
export interface AnnouncementItem {
  id: number
  title: string
  /** "All Employees" | branch name | any label — the audience as sent. */
  audience: string
  type: string | null
  sentDate: string | null
  /** Draft | Scheduled | Sent | Cancelled. */
  status: string
  /** Percent (0–100, one decimal) of targeted users who read it. */
  readRate: number
  message: string | null
}

/** Compose body for POST /api/announcements. */
export interface CreateAnnouncementBody {
  title: string
  audience: string
  type?: string
  message: string
}

/** The compose dialog's type vocabulary (POST accepts these labels). */
export const ANNOUNCEMENT_TYPES = ['Policy Update', 'Event', 'Reminder', 'Recognition'] as const

/** The audience dropdown: everyone, plus each gym the caller can see. */
export const ANNOUNCEMENT_ALL_AUDIENCE = 'All Employees'

export interface AnnouncementListParams {
  gym?: number
  /** Draft | Scheduled | Sent | Cancelled; omitted = all. */
  status?: string
  page?: number
  pageSize?: number
}

/** GET /api/announcements — history cards with read-rate, newest first. */
export function getAnnouncements(
  params: AnnouncementListParams = {},
  signal?: AbortSignal,
): Promise<PagedResult<AnnouncementItem>> {
  return apiRequest<PagedResult<AnnouncementItem>>(
    withQuery('/api/announcements', {
      gym: params.gym,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    }),
    { signal },
  )
}

/** POST /api/announcements — compose + fan out (announcements.manage) → 201 { data }. */
export function postAnnouncement(body: CreateAnnouncementBody, signal?: AbortSignal): Promise<AnnouncementItem> {
  return apiRequest<{ data: AnnouncementItem }>('/api/announcements', { method: 'POST', body, signal }).then(
    (r) => r.data,
  )
}
