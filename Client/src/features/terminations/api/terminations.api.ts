import { apiRequest } from '../../../lib/api-client'

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Closed status vocabulary of the separation lifecycle (GET /api/separations). */
export const SEPARATION_STATUSES = ['Requested', 'Notice Period', 'Exit In Progress', 'Under Review', 'Completed'] as const

/** Closed reason vocabulary for a Termination case (POST /api/separations). */
export const TERMINATION_REASONS = [
  'Performance issues',
  'Attendance violations',
  'Misconduct / policy breach',
  'Contract expiry — not renewing',
  'Restructuring / redundancy',
] as const

/** The T5 verdict shape carried on a separation case. */
export interface SeparationVerdict {
  finalReason: string | null
  settlement: {
    direction: 'none' | 'owedToEmployee' | 'employeeOwes'
    amount: number | null
    note: string | null
  } | null
  rehire: {
    status: 'Eligible' | 'Banned'
    note: string | null
  } | null
}

/** One separation case — list item and detail share the same shape. */
export interface Separation {
  id: number
  employee: string
  employeeId: number
  position: string
  gym: string
  lastDay: string | null
  reason: string | null
  /** Role label: HR Manager | Branch Manager | Top Management. */
  requestedBy: string | null
  /** Display name of the requesting user. */
  requestedByUser: string | null
  submittedDate: string | null
  status: string
  separationType: string
  /** Percent of the five-task exit checklist completed (0–100). */
  progress: number
  /** The five exit tasks as [label, done] pairs. */
  checklist: [string, boolean][]
  verdict: SeparationVerdict | null
  leaveTaken: number | null
}

export interface SeparationListParams {
  gym?: number
  status?: string
  type?: string
  page?: number
  pageSize?: number
}

/** GET /api/separations — paged, gym-scoped separation cases. */
export function getSeparations(params: SeparationListParams = {}, signal?: AbortSignal): Promise<Paged<Separation>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.status) query.set('status', params.status)
  if (params.type) query.set('type', params.type)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<Separation>>(`/api/separations${qs ? '?' + qs : ''}`, { signal })
}

/** GET /api/separations/{id} — the case with its verdict (wrapped in { data }). */
export function getSeparation(id: number, signal?: AbortSignal): Promise<Separation> {
  return apiRequest<{ data: Separation }>(`/api/separations/${id}`, { signal }).then((r) => r.data)
}

export interface InitiateSeparationBody {
  employeeId: number
  /** yyyy-MM-dd. */
  lastDay: string
  /** One of the TERMINATION_REASONS entries (closed vocabulary). */
  reason: string
  notes?: string
}

/** POST /api/separations — T2, the Branch-Manager termination request (returns the new case). */
export function postSeparation(body: InitiateSeparationBody, signal?: AbortSignal): Promise<Separation> {
  return apiRequest<{ data: Separation }>('/api/separations', { method: 'POST', body, signal }).then((r) => r.data)
}

export interface ChecklistState {
  id: number
  progress: number
  status: string
  checklist: [string, boolean][]
}

/** PUT /api/separations/{id}/checklist — T3, tick/untick one exit task by index. */
export function putChecklist(id: number, index: number, done: boolean, signal?: AbortSignal): Promise<ChecklistState> {
  return apiRequest<{ data: ChecklistState }>(`/api/separations/${id}/checklist`, {
    method: 'PUT',
    body: { index, done },
    signal,
  }).then((r) => r.data)
}

export type SettlementDirection = 'none' | 'owedToEmployee' | 'employeeOwes'
export type RehireStatus = 'Eligible' | 'Banned'

export interface VerdictBody {
  finalReason: string
  settlement: { direction: SettlementDirection; amount: number; note?: string }
  rehire: { status: RehireStatus; note?: string }
}

/** PUT /api/separations/{id}/verdict — T5, saves the exit verdict (moves the case to Under Review). */
export function putVerdict(id: number, body: VerdictBody, signal?: AbortSignal): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/verdict`, { method: 'PUT', body, signal }).then(
    (r) => r.message,
  )
}

/** POST /api/separations/{id}/finalize — T6, archives the employee (checklist + verdict required server-side). */
export function postFinalize(id: number, signal?: AbortSignal): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/finalize`, { method: 'POST', signal }).then((r) => r.message)
}

/** One employee match used by the initiate dialog's picker (GET /api/employees rows). */
export interface EmployeeOption {
  id: number
  name: string
  position: string
  gym: string
}

/** Employee directory search feeding the "new separation" employee picker. */
export function getEmployeeOptions(search: string, signal?: AbortSignal): Promise<Paged<EmployeeOption>> {
  const query = new URLSearchParams()
  query.set('search', search)
  query.set('pageSize', '8')
  return apiRequest<Paged<EmployeeOption>>(`/api/employees?${query.toString()}`, { signal })
}
