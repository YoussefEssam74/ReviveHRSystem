import { apiRequest } from '../../../lib/api-client'

/** Option in /api/me gyms[] and the session switcher. */
export interface GymOption {
  gymId: number
  gymName: string
}

/**
 * GET /api/me — the session contract: identity, the token's active gym, every
 * accessible gym, the role held in the active gym, the team the user leads in
 * it, and the employee profile linked 1:1 to this account (every self-service
 * route /api/employees/{id}/… is addressed by it).
 */
export interface MeResponse {
  userId: number
  email: string
  userName: string
  userType: string
  activeGym: GymOption | null
  gyms: GymOption[]
  roleInActiveGym: string | null
  ledTeamId: number | null
  employeeId: number | null
}

/** Gym as listed by GET /api/auth/me (includes the branch location label). */
export interface CurrentUserGym {
  id: number
  name: string
  branch: string
}

/**
 * GET /api/auth/me — the portal profile: name pieces, position/level, granted
 * permission keys, assigned gyms, token's selected gym, employment snapshot.
 */
export interface CurrentUserResponse {
  id: number
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  initials: string
  position: string | null
  level: string | null
  role: string
  permissions: string[]
  gyms: CurrentUserGym[]
  selectedGym: number | null
  hireDate: string | null
  employmentType: string | null
  status: string | null
}

/** POST /api/auth/switch-gym — fresh token scoped to the new gym + refreshed context. */
export interface SwitchGymResponse {
  accessToken: string
  expiresInSeconds: number
  me: MeResponse
}

export function getMe(signal?: AbortSignal): Promise<MeResponse> {
  return apiRequest<MeResponse>('/api/me', { signal })
}

export function getCurrentUser(signal?: AbortSignal): Promise<CurrentUserResponse> {
  return apiRequest<CurrentUserResponse>('/api/auth/me', { signal })
}

export function postSwitchGym(gymId: number, signal?: AbortSignal): Promise<SwitchGymResponse> {
  return apiRequest<SwitchGymResponse>('/api/auth/switch-gym', { method: 'POST', body: { gymId }, signal })
}
