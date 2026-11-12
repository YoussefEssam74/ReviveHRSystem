import { apiRequest } from '../../../lib/api-client'

interface Wrapped<T> {
  data: T
}

/**
 * The My Access card (GET /api/users/{id} with your own id → { data }):
 * direct permissions, assigned gyms, the effective (direct ∪ role) set the
 * matrix is computed from, and the granted-vs-tracked counters.
 */
export interface MyAccessProfile {
  id: number
  email: string
  /** Primary role name, or the user-type label when role-less. */
  role: string
  /** Direct (user-level) permission keys. */
  permissions: string[]
  gyms: { id: number; name: string; branch: string }[]
  /** Direct ∪ role permissions — what the permission matrix renders from. */
  effectivePermissions: string[]
  grantedCount: number
  trackedCount: number
}

/** Your own id is always allowed — no team.view needed for self-service. */
export function getMyAccess(id: number, signal?: AbortSignal): Promise<MyAccessProfile> {
  return apiRequest<Wrapped<MyAccessProfile>>(`/api/users/${id}`, { signal }).then((r) => r.data)
}

/** One catalog entry (GET /api/permissions). */
export interface PermissionCatalogItem {
  key: string
  area: string
  description: string | null
}

/** The catalog grouped by area — the My Access matrix source. */
export interface PermissionModule {
  name: string
  permissions: string[]
}

export interface PermissionCatalog {
  items: PermissionCatalogItem[]
  modules: PermissionModule[]
  totalTracked: number
}

/** GET /api/permissions — requires team.view; the page degrades gracefully on 403. */
export function getPermissionCatalog(signal?: AbortSignal): Promise<PermissionCatalog> {
  return apiRequest<Wrapped<PermissionCatalog>>('/api/permissions', { signal }).then((r) => r.data)
}

/** One gym in GET /api/gyms — the gyms visible to the signed-in user. */
export interface GymOption {
  id: number
  name: string
  branch: string
  employees: number
}

/** GET /api/gyms — the switch-gym choices (same set POST /api/auth/switch-gym accepts). */
export function getGyms(signal?: AbortSignal): Promise<GymOption[]> {
  return apiRequest<GymOption[]>('/api/gyms', { signal })
}
