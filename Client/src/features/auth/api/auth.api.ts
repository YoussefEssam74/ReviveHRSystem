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
