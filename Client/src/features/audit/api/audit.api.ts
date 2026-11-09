import { apiRequest } from '../../../lib/api-client'

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** One audit row (GET /api/audit-log), newest first. */
export interface AuditLogItem {
  id: number
  /** Action label ("Employee Updated"). */
  action: string
  /** Actor display name ("System" for background work). */
  user: string
  /** Entity label ("Employee #12"). */
  target: string
  /** Truncated digest of the new-values snapshot. */
  detail: string
  timestamp: string
  /** Tagged gym name, or "All Gyms" for org-wide rows. */
  gym: string
}

export interface AuditLogParams {
  /** All actions (blank) | Employee | Payroll | Recruitment | Bulk Import. */
  action?: string
  /** Gym id filter. */
  gym?: number
  /** Acting user id filter. */
  user?: number
  /** Inclusive start date (yyyy-MM-dd). */
  from?: string
  /** Inclusive end date (yyyy-MM-dd). */
  to?: string
  page?: number
  pageSize?: number
}

/** GET /api/audit-log — paged, filtered, read-only (audit.view). */
export function getAuditLog(params: AuditLogParams = {}, signal?: AbortSignal): Promise<Paged<AuditLogItem>> {
  const query = new URLSearchParams()
  if (params.action) query.set('action', params.action)
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.user != null) query.set('user', String(params.user))
  // Date-only inputs become an inclusive day range on the server's DateTime filter.
  if (params.from) query.set('from', `${params.from}T00:00:00`)
  if (params.to) query.set('to', `${params.to}T23:59:59`)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<AuditLogItem>>(`/api/audit-log${qs ? '?' + qs : ''}`, { signal })
}

/** One potential actor for the user filter (GET /api/users — needs team.view). */
export interface ActorOption {
  id: number
  name: string
  email: string
}

/** GET /api/users?type=all&pageSize=100 — populates the actor filter; hides itself on 403. */
export function getActors(signal?: AbortSignal): Promise<Paged<ActorOption>> {
  const query = new URLSearchParams({ type: 'all', pageSize: '100' })
  return apiRequest<Paged<ActorOption>>(`/api/users?${query.toString()}`, { signal })
}

/** One gym for the gym filter (GET /api/gyms). */
export interface GymOption {
  id: number
  name: string
}

/** GET /api/gyms — the gyms visible to the signed-in user. */
export function getGyms(signal?: AbortSignal): Promise<GymOption[]> {
  return apiRequest<GymOption[]>('/api/gyms', { signal })
}
