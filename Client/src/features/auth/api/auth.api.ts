import { apiRequest } from '../../../lib/api-client'
import type { components } from '../../../types/api/generated'

export type LoginResponse = components['schemas']['LoginResponse']
export type GymOption = components['schemas']['GymOption']
export type UserInfo = components['schemas']['UserInfo']

export function postLogin(body: { email: string; password: string }, signal?: AbortSignal): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', { method: 'POST', body, signal })
}

export function postSelectGym(body: { gymId: number; tempSessionToken: string }, signal?: AbortSignal): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login/select-gym', { method: 'POST', body, signal })
}

export function postRefresh(signal?: AbortSignal): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/refresh', { method: 'POST', signal })
}

export function postLogout(signal?: AbortSignal): Promise<void> {
  return apiRequest<void>('/api/auth/logout', {
    method: 'POST',
    signal,
  })
}
