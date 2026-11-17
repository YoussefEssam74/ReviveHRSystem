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

export function postRefresh(refreshToken: string, signal?: AbortSignal): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/refresh', { method: 'POST', body: { refreshToken }, signal })
}

export function postLogout(
  refreshToken?: string,
  accessToken?: string,
  signal?: AbortSignal,
): Promise<void> {
  // The explicit access token keeps the bearer intact: the caller (signOut)
  // clears the session store before this request lands, so apiRequest() would
  // otherwise lose the last valid credential.
  return apiRequest<void>('/api/auth/logout', {
    method: 'POST',
    body: refreshToken ? { refreshToken } : undefined,
    ...(accessToken ? { accessToken } : {}),
    signal,
  })
}
