import { apiRequest } from '../../../lib/api-client'
import type { FeatureLevels } from '../../../lib/permissions'

/** GET /api/me — the caller's session context for the active gym. */
export interface ActiveGym {
  gymId: number
  gymName: string
}

export interface GymOption {
  gymId: number
  gymName: string
}

export interface MeResponse {
  userId: number
  email: string
  userName: string
  userType: string
  activeGym: ActiveGym | null
  gyms: GymOption[]
  roleInActiveGym: string | null
  ledTeamId: number | null
  featureLevels: FeatureLevels
}

export function getMe(signal?: AbortSignal): Promise<MeResponse> {
  return apiRequest<MeResponse>('/api/me', { signal })
}

/** POST /api/auth/switch-gym — re-scopes the session; returns a fresh token + me. */
export interface SwitchGymResponse {
  accessToken: string
  expiresInSeconds: number
  me: MeResponse
}

export function postSwitchGym(gymId: number, signal?: AbortSignal): Promise<SwitchGymResponse> {
  return apiRequest<SwitchGymResponse>('/api/auth/switch-gym', { method: 'POST', body: { gymId }, signal })
}

/** GET /api/gyms — every gym the user may switch between. */
export interface GymListItem {
  id: number
  name: string
  branch: string | null
  employees: number
}

export function getGyms(signal?: AbortSignal): Promise<GymListItem[]> {
  return apiRequest<GymListItem[]>('/api/gyms', { signal })
}

/** One notification row (GET /api/notifications). */
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

export interface NotificationPage {
  items: NotificationItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function getNotifications(params: { unread?: boolean; page?: number; pageSize?: number } = {}, signal?: AbortSignal): Promise<NotificationPage> {
  const query = new URLSearchParams()
  if (params.unread) query.set('unread', 'true')
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<NotificationPage>(`/api/notifications${qs ? '?' + qs : ''}`, { signal })
}

export function getUnreadCount(signal?: AbortSignal): Promise<{ count: number }> {
  return apiRequest<{ count: number }>('/api/notifications/unread-count', { signal })
}

export function putReadAll(signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/notifications/read-all', { method: 'PUT', signal })
}

export function putReadOne(id: number, signal?: AbortSignal): Promise<void> {
  return apiRequest<void>(`/api/notifications/${id}/read`, { method: 'PUT', signal })
}
