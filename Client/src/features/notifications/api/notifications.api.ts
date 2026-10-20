import { apiRequest } from '../../../lib/api-client'
import { withQuery, type PagedResult } from '../../../lib/paged'

/**
 * Notification rows match Shared.DataTransferObject.Notification.NotificationItem:
 * { id, category, title, description, date, read, color, link }.
 */
export interface NotificationItem {
  id: number
  /** Requests | Recruitment | Document | System | Announcements. */
  category: string
  title: string
  description: string
  date: string
  read: boolean
  /** Badge tone: yellow | green | blue | red | purple. */
  color: string
  /** Mock page id the "Open →" action targets. */
  link: string | null
}

export interface UnreadCountResponse {
  count: number
}

export function getNotifications(
  params: { unread?: boolean; category?: string; page?: number; pageSize?: number; signal?: AbortSignal },
): Promise<PagedResult<NotificationItem>> {
  const { unread, category, page, pageSize, signal } = params
  return apiRequest<PagedResult<NotificationItem>>(
    withQuery('/api/notifications', { unread, category, page, pageSize }),
    { signal },
  )
}

export function getUnreadCount(signal?: AbortSignal): Promise<UnreadCountResponse> {
  return apiRequest<UnreadCountResponse>('/api/notifications/unread-count', { signal })
}

export function putMarkRead(id: number, signal?: AbortSignal): Promise<NotificationItem> {
  return apiRequest<NotificationItem>(`/api/notifications/${id}/read`, { method: 'PUT', signal })
}

export function putMarkAllRead(signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/notifications/read-all', { method: 'PUT', signal })
}
