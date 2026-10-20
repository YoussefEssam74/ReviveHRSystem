import { apiRequest } from '../../../lib/api-client'

/**
 * Account settings of the signed-in user (mock §12):
 *  - preferences  GET/PUT /api/me/settings       → NotificationPreference
 *  - password     POST /api/auth/change-password → 204/{message}
 */

export interface NotificationPreference {
  requests: boolean
  attendance: boolean
  recruitment: boolean
  management: boolean
  announcements: boolean
}

export function getPreferences(signal?: AbortSignal): Promise<NotificationPreference> {
  return apiRequest<NotificationPreference>('/api/me/settings', { signal })
}

export function updatePreferences(preferences: NotificationPreference): Promise<NotificationPreference> {
  return apiRequest<NotificationPreference>('/api/me/settings', { method: 'PUT', body: preferences })
}

export interface ChangePasswordBody {
  currentPassword: string
  newPassword: string
}

export function apiChangePassword(body: ChangePasswordBody): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/auth/change-password', { method: 'POST', body })
}
