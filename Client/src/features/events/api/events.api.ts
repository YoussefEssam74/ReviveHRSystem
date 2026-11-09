import { apiRequest } from '../../../lib/api-client'

/** One card of the HR events queue (GET /api/events). */
export interface EventItem {
  id: number
  /** Server type word ("Document Expiry", "Contract Expiry", "PendingHRReview", …). */
  type: string
  /** Tab id of the type (documents | requests | offboarding | transfers | vacancies | payroll). */
  tab: string
  title: string
  /** Due date (ISO); null when the source carries no date. */
  date: string | null
  /** Urgency derives from days-to-due: high ≤ 7, medium ≤ 14, else low. */
  urgency: string
  branch: string | null
  detail: string | null
  /** Permission key governing visibility of this row. */
  permission: string
  resolved: boolean
  resolvedOn: string | null
  resolvedBy: string | null
  // --- per-type extras (present only when applicable) -------------------
  employee?: string | null
  employeeId?: number | null
  position?: string | null
  gym?: string | null
  docType?: string | null
  docNo?: string | null
  expiresOn?: string | null
  lastDay?: string | null
  requestedBy?: string | null
  fromGym?: string | null
  toGym?: string | null
  headcount?: number | null
  period?: string | null
  grossTotal?: number | null
}

export interface EventListParams {
  /** `all` (default) | branch id | branch name — omitted here for "all". */
  gym?: string
  /** Comma-separated type words ("Document Expiry,Contract Expiry"). */
  type?: string
  urgency?: string
  /** true = the resolved list, omitted = open only. */
  resolved?: boolean
  page?: number
  pageSize?: number
}

/** The list envelope plus `hidden` (in-scope rows the caller may not see). */
export interface EventList {
  items: EventItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hidden: number
}

export function getEvents(params: EventListParams = {}, signal?: AbortSignal): Promise<EventList> {
  const query = new URLSearchParams()
  if (params.gym) query.set('gym', params.gym)
  if (params.type) query.set('type', params.type)
  if (params.urgency) query.set('urgency', params.urgency)
  if (params.resolved) query.set('resolved', 'true')
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<EventList>(`/api/events${qs ? '?' + qs : ''}`, { signal })
}

/** One branch (GET /api/gyms) — the queue's gym filter options. */
export interface GymOption {
  id: number
  name: string
  branch: string | null
  employees: number
}

export function getGyms(signal?: AbortSignal): Promise<GymOption[]> {
  return apiRequest<GymOption[]>('/api/gyms', { signal })
}
