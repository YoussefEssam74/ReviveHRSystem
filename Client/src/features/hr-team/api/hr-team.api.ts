import { apiRequest } from '../../../lib/api-client'

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface Wrapped<T> {
  data: T
}

/** One HR Team member row (GET /api/users). */
export interface TeamMember {
  id: number
  name: string
  email: string
  /** Two-letter avatar derived from the name. */
  initials: string
  /** Primary role name, or the user-type label when role-less. */
  role: string
  /** Every preset role name assigned to the user. */
  roles: string[]
  /** Assigned gym names (portal-wide, not gym-scoped). */
  gyms: string[]
  /** Effective (direct ∪ role) permission count. */
  permissionsCount: number
  permissions: string[]
  /** "Active" | "Suspended". */
  status: string
  lastLoginAt: string | null
}

export interface TeamListParams {
  /** Gym id or branch name (blank = the actor's full scope). */
  gym?: string
  /** staff (default) | hr | topmanagement | employee | all. */
  type?: string
  /** Case-insensitive substring of name, email or username. */
  search?: string
  /** "Active" | "Suspended" — omitted returns every member. */
  status?: string
  page?: number
  pageSize?: number
}

/** GET /api/users — paged HR Team member list (team.view). */
export function getTeamMembers(params: TeamListParams = {}, signal?: AbortSignal): Promise<Paged<TeamMember>> {
  const query = new URLSearchParams()
  if (params.gym) query.set('gym', params.gym)
  if (params.type) query.set('type', params.type)
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<TeamMember>>(`/api/users${qs ? '?' + qs : ''}`, { signal })
}

/** Access profile (GET /api/users/{id}, wrapped in { data }). */
export interface UserAccessProfile {
  id: number
  email: string
  /** Primary role name, or the user-type label when role-less. */
  role: string
  /** Direct (user-level) permission keys. */
  permissions: string[]
  gyms: { id: number; name: string; branch: string }[]
  /** Direct ∪ role permissions — what the matrix is computed from. */
  effectivePermissions: string[]
  grantedCount: number
  trackedCount: number
}

/** Your own id is always allowed; another user's requires team.view. */
export function getUserAccessProfile(id: number, signal?: AbortSignal): Promise<UserAccessProfile> {
  return apiRequest<Wrapped<UserAccessProfile>>(`/api/users/${id}`, { signal }).then((r) => r.data)
}

/** POST /api/users body — the create-HR-account wizard's final submit. */
export interface CreateUserBody {
  fullName: string
  email: string
  /** Gym access rows granted at creation (at least one). */
  gymIds: number[]
  /** Direct permission keys (optional; replaces the overrides wholesale). */
  permissions?: string[]
  /** Role assigned by name (optional). */
  rolePreset?: string
}

/** POST /api/users → 201 { data }. The temporary password is set server-side and never echoed. */
export function postCreateUser(body: CreateUserBody): Promise<TeamMember> {
  return apiRequest<Wrapped<TeamMember>>('/api/users', { method: 'POST', body }).then((r) => r.data)
}

/** PUT /api/users/{id}/status body — suspend/reactivate; reason is required. */
export interface ChangeUserStatusBody {
  status: 'Active' | 'Suspended'
  reason: string
}

/** PUT /api/users/{id}/status → { message }. Self-suspend is refused server-side. */
export function putUserStatus(id: number, body: ChangeUserStatusBody): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/users/${id}/status`, { method: 'PUT', body })
}

/** POST /api/users/{id}/reset-password → { message }. The plaintext is never echoed. */
export function postResetPassword(id: number, newPassword: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/users/${id}/reset-password`, {
    method: 'POST',
    body: { newPassword },
  })
}

/** One role row (GET /api/roles). */
export interface Role {
  id: number
  name: string
  description: string | null
  status: string
  permissionsCount: number
  usersCount: number
  /** True when the role has zero permissions (the "New Role Draft" badge). */
  isEmpty: boolean
  isPreset: boolean
  /** The role's permission keys, sorted. */
  permissions: string[]
}

export interface RoleListParams {
  /** Case-insensitive substring of name or description. */
  search?: string
  page?: number
  pageSize?: number
}

/** GET /api/roles — paged roles with permission/user counters (team.view). */
export function getRoles(params: RoleListParams = {}, signal?: AbortSignal): Promise<Paged<Role>> {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<Role>>(`/api/roles${qs ? '?' + qs : ''}`, { signal })
}

/** PUT /api/roles/{id}/permissions — replaces the set wholesale (team.manage). */
export function putRolePermissions(id: number, permissions: string[]): Promise<{ id: number; permissions: string[] }> {
  return apiRequest<Wrapped<{ id: number; permissions: string[] }>>(`/api/roles/${id}/permissions`, {
    method: 'PUT',
    body: { permissions },
  }).then((r) => r.data)
}

/** One catalog entry (GET /api/permissions). */
export interface PermissionCatalogItem {
  key: string
  area: string
  description: string | null
}

/** The catalog grouped by area — the My Access / admin matrix source. */
export interface PermissionModule {
  name: string
  permissions: string[]
}

export interface PermissionCatalog {
  items: PermissionCatalogItem[]
  modules: PermissionModule[]
  totalTracked: number
}

/** GET /api/permissions — flat items + area-grouped modules + totalTracked (team.view). */
export function getPermissionCatalog(signal?: AbortSignal): Promise<PermissionCatalog> {
  return apiRequest<Wrapped<PermissionCatalog>>('/api/permissions', { signal }).then((r) => r.data)
}

/** One gym in the portal gym list (GET /api/gyms). */
export interface GymOption {
  id: number
  name: string
  branch: string
  employees: number
}

/** GET /api/gyms — the gyms visible to the signed-in user (gym-access picker). */
export function getGyms(signal?: AbortSignal): Promise<GymOption[]> {
  return apiRequest<GymOption[]>('/api/gyms', { signal })
}
