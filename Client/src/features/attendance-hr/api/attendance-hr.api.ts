import { apiRequest } from '../../../lib/api-client'

/** One row of the HR attendance grid (GET /api/attendance). */
export interface AttendanceRow {
  /** null for synthesized Off/Scheduled/Absent days. */
  id: number | null
  employeeId: string
  name: string
  gym: string
  date: string
  shift: string | null
  checkIn: string | null
  checkOut: string | null
  status: string
  source: string | null
  notes: string | null
  correctedBy: string | null
  correctedAt: string | null
}

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AttendanceParams {
  date?: string
  from?: string
  to?: string
  gym?: number
  employeeId?: string
  status?: string
  page?: number
  pageSize?: number
}

export function getAttendance(params: AttendanceParams = {}, signal?: AbortSignal): Promise<Paged<AttendanceRow>> {
  const query = new URLSearchParams()
  if (params.date) query.set('date', params.date)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.employeeId) query.set('employeeId', params.employeeId)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<AttendanceRow>>(`/api/attendance${qs ? '?' + qs : ''}`, { signal })
}

export interface CorrectAttendanceBody {
  checkIn?: string
  checkOut?: string
  status: string
  reason: string
}

/** PUT /api/attendance/{id}/correct — returns the updated row (wrapped in { data }). */
export function putCorrect(id: number, body: CorrectAttendanceBody, signal?: AbortSignal): Promise<AttendanceRow> {
  return apiRequest<{ data: AttendanceRow }>(`/api/attendance/${id}/correct`, { method: 'PUT', body, signal }).then(
    (r) => r.data,
  )
}
