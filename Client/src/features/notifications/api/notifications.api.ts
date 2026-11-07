import { apiRequest } from '../../../lib/api-client'

/**
 * Notifications (S5.7) — the signed-in user's own inbox; a JWT is enough, no
 * permission key. `color` is the badge tone (yellow | green | blue | red |
 * purple) and `link` the in-app page the row points at.
 */
export interface NotificationItem {
  id: number
  category: string
  title: string
  description: string | null
  date: string
  read: boolean
  color: string | null
  link: string | null
}

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
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
}

/** GET /api/notifications — newest first, scoped to the caller. */
export function getNotifications(
  params: NotificationListParams = {},
  signal?: AbortSignal,
): Promise<Paged<NotificationItem>> {
  const query = new URLSearchParams()
  if (params.unread) query.set('unread', 'true')
  if (params.category) query.set('category', params.category)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<NotificationItem>>(`/api/notifications${qs ? '?' + qs : ''}`, { signal })
}

/** GET /api/notifications/unread-count — the header bell badge. */
export function getUnreadCount(signal?: AbortSignal): Promise<{ count: number }> {
  return apiRequest<{ count: number }>('/api/notifications/unread-count', { signal })
}

/** PUT /api/notifications/read-all — marks every unread row read. */
export function putReadAll(signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/notifications/read-all', { method: 'PUT', signal })
}

/** PUT /api/notifications/{id}/read — marks one owned row read (another user's row → 404). */
export function putReadOne(id: number, signal?: AbortSignal): Promise<NotificationItem> {
  return apiRequest<NotificationItem>(`/api/notifications/${id}/read`, { method: 'PUT', signal })
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
): Promise<Paged<AnnouncementItem>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<AnnouncementItem>>(`/api/announcements${qs ? '?' + qs : ''}`, { signal })
}

/** POST /api/announcements — compose + fan out (announcements.manage) → 201 { data }. */
export function postAnnouncement(body: CreateAnnouncementBody, signal?: AbortSignal): Promise<AnnouncementItem> {
  return apiRequest<{ data: AnnouncementItem }>('/api/announcements', { method: 'POST', body, signal }).then(
    (r) => r.data,
  )
}
