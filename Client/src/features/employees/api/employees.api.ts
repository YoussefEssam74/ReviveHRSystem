import { apiRequest } from '../../../lib/api-client'

/** One row of the paged employee directory (GET /api/employees). */
export interface EmployeeListItem {
  id: number
  employeeNumber: string
  name: string
  position: string
  level: string | null
  gymId: number
  gym: string
  status: string
  initials: string
  hireDate: string | null
  salary: number | null
  phone: string | null
  email: string | null
}

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface EmployeeListParams {
  gym?: number
  search?: string
  status?: string
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'hireDate' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export function getEmployees(params: EmployeeListParams = {}, signal?: AbortSignal): Promise<Paged<EmployeeListItem>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  const qs = query.toString()
  return apiRequest<Paged<EmployeeListItem>>(`/api/employees${qs ? '?' + qs : ''}`, { signal })
}

/** Employee profile (GET /api/employees/{id}, wrapped in { data }). */
export interface EmployeeProfile {
  id: number
  employeeNumber: string
  name: string
  position: string
  level: string | null
  gymId: number
  gym: string
  status: string
  initials: string
  hireDate: string | null
  email: string | null
  phone: string | null
  salary: number | null
  systemRole: string | null
  branches: { id: number; name: string; branch: string | null }[]
}

interface Wrapped<T> {
  data: T
}

export function getEmployee(id: number, signal?: AbortSignal): Promise<EmployeeProfile> {
  return apiRequest<Wrapped<EmployeeProfile>>(`/api/employees/${id}`, { signal }).then((r) => r.data)
}

export interface StatusChangeBody {
  status: 'Active' | 'On Leave' | 'Suspended' | 'Terminated'
  note?: string
}

/** POST /api/employees/{id}/status-change — returns the updated profile (wrapped). */
export function postStatusChange(id: number, body: StatusChangeBody, signal?: AbortSignal): Promise<EmployeeProfile> {
  return apiRequest<Wrapped<EmployeeProfile>>(`/api/employees/${id}/status-change`, { method: 'POST', body, signal }).then(
    (r) => r.data,
  )
}

// ---------------------------------------------------------------------------
// Lifecycle actions used by the dashboard fast actions + decision cards.
// ---------------------------------------------------------------------------

/** POST /api/employees body — one home gym (id), auto-generated employee code. */
export interface CreateEmployeeBody {
  firstName: string
  lastName: string
  email: string
  phone?: string
  position: string
  level: string
  salary?: number
  /** Home gym id. */
  gym: number
  /** Contract start date ("YYYY-MM-DD"). */
  startDate: string
}

/** The create response echoes the saved profile (wrapped). */
export function postCreateEmployee(body: CreateEmployeeBody, signal?: AbortSignal): Promise<EmployeeProfile> {
  return apiRequest<Wrapped<EmployeeProfile>>(`/api/employees`, { method: 'POST', body, signal }).then((r) => r.data)
}

/** POST /api/employees/{id}/contract — level and/or salary change with an effective date. */
export interface ContractChangeBody {
  level?: string
  salary?: number
  effectiveDate?: string
}

export function postContractChange(id: number, body: ContractChangeBody, signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/employees/${id}/contract`, { method: 'POST', body, signal })
}

/** POST /api/employees/{id}/role-change — sets the system role (None (Employee) | Team Leader | Branch Manager | …). */
export interface RoleChangeBody {
  systemRole?: string
  permissions?: string[]
}

export function postRoleChange(id: number, body: RoleChangeBody, signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/employees/${id}/role-change`, { method: 'POST', body, signal })
}
