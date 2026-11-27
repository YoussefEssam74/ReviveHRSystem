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
  roleId?: number
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
  if (params.roleId) query.set('roleId', String(params.roleId))
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
  /** HR's per-request-type final-approval grants for this account. */
  autoApproveRequestTypes: Record<string, boolean>
}

/** Your own id is always allowed; another user's requires team.view. */
export function getUserAccessProfile(id: number, signal?: AbortSignal): Promise<UserAccessProfile> {
  return apiRequest<Wrapped<UserAccessProfile>>(`/api/users/${id}`, { signal }).then((r) => r.data)
}

export function putUserPermissions(id: number, permissions: string[]) {
  return apiRequest<Wrapped<UserAssignmentData>>(`/api/users/${id}/permissions`, {
    method: 'PUT', body: { permissions },
  }).then((r) => r.data)
}

export function putUserGymAccess(id: number, gymIds: number[]) {
  return apiRequest<Wrapped<UserAssignmentData>>(`/api/users/${id}/gym-access`, {
    method: 'PUT', body: { gymIds },
  }).then((r) => r.data)
}

/** PUT /api/users/{id}/auto-approval — HR's per-person, per-type final-approval grant. */
export function putUserAutoApproval(id: number, requestTypes: Record<string, boolean>) {
  return apiRequest<{ message: string }>(`/api/users/${id}/auto-approval`, {
    method: 'PUT', body: { requestTypes },
  }).then((r) => r.message)
}

/** One request type with this account's auto-approval state. */
export interface AutoApprovalTypeItem {
  id: string
  label: string
  enabled: boolean
}

/** One person's access through a single role (GET /api/roles/{id}/members/{userId}). */
export interface RoleMemberDetail {
  userId: number
  name: string
  email: string
  roleId: number
  roleName: string
  permissions: string[]
  effectivePermissions: string[]
  /** Only the gyms where this role is held. */
  gyms: { id: number; name: string; branch: string }[]
  autoApproveRequestTypes: AutoApprovalTypeItem[]
}

export function getRoleMember(roleId: number, userId: number, signal?: AbortSignal): Promise<RoleMemberDetail> {
  return apiRequest<Wrapped<RoleMemberDetail>>(`/api/roles/${roleId}/members/${userId}`, { signal }).then((r) => r.data)
}

export interface UserAssignmentData {
  userId: number
  roleId: number | null
  rolePreset: string | null
  permissions: string[]
  effectivePermissions: string[]
  count: number
  gymIds: number[]
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

/** GET /api/roles/{id} â€” one role plus its permissions. */
export function getRole(id: number, signal?: AbortSignal): Promise<Role> {
  return apiRequest<Wrapped<Role>>(`/api/roles/${id}`, { signal }).then((r) => r.data)
}

export interface CreateRoleBody {
  name: string
  description?: string | null
  permissions: string[]
}

/** POST /api/roles — creates a custom role with its initial permission set (team.manage). */
export function postCreateRole(body: CreateRoleBody): Promise<Role> {
  return apiRequest<Wrapped<Role>>('/api/roles', { method: 'POST', body }).then((r) => r.data)
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

export interface PermissionPage {
  /** "Employee portal" | "HR portal" | "Super Admin portal". */
  portal: string
  page: string
  label: string
  permissions: string[]
}

export interface PermissionCatalog {
  items: PermissionCatalogItem[]
  modules: PermissionModule[]
  /** The same keys grouped by portal page — the assignment table's layout. */
  pages: PermissionPage[]
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
