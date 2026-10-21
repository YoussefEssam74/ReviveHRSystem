import { apiDownload, apiRequest } from '../../../lib/api-client'
import { withQuery, type PagedCountResult } from '../../../lib/paged'

/**
 * Self-service requests (mock §10 My Requests):
 *  - list        GET  /api/employees/{id}/requests            → EmployeeRequestItem[] (plain array)
 *  - detail      GET  /api/requests/{id}                      → { data: RequestDetail }
 *  - types       GET  /api/request-types                      → RequestTypeDto[]
 *  - create      POST /api/employees/{id}/requests (multipart) → EmployeeRequestDto
 *  - cancel      POST /api/requests/{id}/cancel               → 204
 *  - attachment  GET  /api/requests/{id}/attachment           → binary
 *  - colleagues  GET  /api/employees/{id}/colleagues          → { id, fullName }[]
 *  - balance     GET  /api/employees/{id}/leave-balance       → LeaveBalanceResponse
 *  - budget      GET  /api/employees/{id}/excused-hours       → ExcusedHoursBudget
 */

/** A8 tab row: the list the employee renders (plain array, no envelope). */
export interface EmployeeRequestItem {
  id: number
  type: string
  /** DateOnly "yyyy-MM-dd". */
  requestedDate: string
  /** End of a leave/swap range, null on single-day types. */
  endDate: string | null
  submittedDate: string
  status: string
  reason: string
  bmComment: string | null
}

/** One timeline chip of the detail drawer's approval workflow. */
export interface RequestTimelineStep {
  step: string
  date: string
  done: boolean
}

/** GET /api/requests/{id} → { data } — identity + decisions + timeline. */
export interface RequestDetail {
  id: number
  employee: string
  gym: string
  type: string
  submittedDate: string
  requestedDate: string
  /** End of a leave/swap range, null on single-day types. */
  endDate: string | null
  status: string
  bmDecision: string | null
  bmComment: string | null
  hrDecision: string | null
  hrComment: string | null
  payment: string | null
  reason: string
  timeline: RequestTimelineStep[]
}

export interface RequestDetailResponse {
  data: RequestDetail
}

/** A configurable request type (mock requestTypes) with the client-side rule flags. */
export interface RequestTypeDto {
  id: string
  label: string
  /** Field tokens: date/date-from/date-to, target-date, time/time-from/time-to, colleague, amount, certificate, reason... */
  fields: string[]
  consumesLeave: string | null
  requiresAttachment: boolean
  requiresColleague: boolean
  requiresAmount: boolean
  limitedByMonthlyExcusedHours: boolean
  requiresTargetDate: boolean
}

/** Create-response (rich card shape the desk also renders; we use it for the toast + refresh). */
export interface CreatedRequest {
  id: number
  type: string
  status: string
}

export interface EmployeeColleague {
  id: number
  fullName: string
}

export interface LeaveBalanceBucket {
  used: number
  total: number
}

export interface LeaveBalanceResponse {
  employeeId: number
  dayOff: LeaveBalanceBucket
  sick: LeaveBalanceBucket
  unpaid: LeaveBalanceBucket
}

export interface ExcusedHoursBudget {
  capHours: number
  usedHours: number
  remainingHours: number
  month: string
}

export function getOwnRequests(employeeId: number, signal?: AbortSignal): Promise<EmployeeRequestItem[]> {
  return apiRequest<EmployeeRequestItem[]>(`/api/employees/${employeeId}/requests`, { signal })
}

/* ==================== Management desk (mock §17, TL/BM) ==================== */

/**
 * Row of the stage-1 desk inbox (`EmployeeRequestDto`): the employee who filed it
 * rides on every row so team/branch listings can show the requester.
 */
export interface DeskRequestRow {
  id: number
  employeeId: number
  employeeName: string
  type: string
  submittedDate: string
  requestedDate: string
  /** End of a leave/swap range, null on single-day types. */
  endDate: string | null
  /** Second date where the type uses one (swap exchange day). */
  targetDate: string | null
  /** Time request "HH:mm:ss" (late/early types). */
  requestTime: string | null
  hours: number | null
  amount: number | null
  swapWithEmployeeName: string | null
  hasAttachment: boolean
  status: string
  reason: string
  timeline: { step: string; date: string | null; done: boolean }[]
}

export interface RequestInboxParams {
  status?: string
  type?: string
  dateFrom?: string | null
  dateTo?: string | null
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

export function getRequestInbox(
  { signal, ...params }: RequestInboxParams,
): Promise<PagedCountResult<DeskRequestRow>> {
  return apiRequest<PagedCountResult<DeskRequestRow>>(withQuery('/api/requests/inbox', params), { signal })
}

/** POST /api/requests/{id}/decisions — stage "BranchManager" is the default. */
export function decideRequest(requestId: number, decision: string, comment: string | null): Promise<void> {
  return apiRequest<void>(`/api/requests/${requestId}/decisions`, {
    method: 'POST',
    body: { decision, comment },
  })
}

/** PUT /api/requests/{id} — manager edit of a pending request. */
export function editManagedRequest(
  requestId: number,
  fields: { type: string | null; requestDate: string | null; endDate: string | null; reason: string | null },
): Promise<void> {
  return apiRequest<void>(`/api/requests/${requestId}`, { method: 'PUT', body: fields })
}

export function getRequestDetail(requestId: number, signal?: AbortSignal): Promise<RequestDetail> {
  return apiRequest<RequestDetailResponse>(`/api/requests/${requestId}`, { signal }).then((body) => body.data)
}

export function getRequestTypes(signal?: AbortSignal): Promise<RequestTypeDto[]> {
  return apiRequest<RequestTypeDto[]>('/api/request-types', { signal })
}

/**
 * POST /api/requests — on-behalf creation (R7, `requests.view`): the manager
 * files a request on a named employee's behalf. It skips the team-leader stage
 * and lands directly in PendingHRReview for HR to decide.
 */
export function createOnBehalfRequest(fields: {
  employee: string
  type: string
  requestedDate: string
  endDate: string | null
  reason: string
}): Promise<{ data: { id: number; status: string } }> {
  return apiRequest<{ data: { id: number; status: string } }>('/api/requests', { method: 'POST', body: fields })
}

export function getOwnColleagues(employeeId: number, signal?: AbortSignal): Promise<EmployeeColleague[]> {
  return apiRequest<EmployeeColleague[]>(`/api/employees/${employeeId}/colleagues`, { signal })
}

export function getOwnLeaveBalance(
  employeeId: number,
  signal?: AbortSignal,
): Promise<LeaveBalanceResponse> {
  return apiRequest<LeaveBalanceResponse>(`/api/employees/${employeeId}/leave-balance`, { signal })
}

export function getExcusedHoursBudget(employeeId: number, signal?: AbortSignal): Promise<ExcusedHoursBudget> {
  return apiRequest<ExcusedHoursBudget>(`/api/employees/${employeeId}/excused-hours`, { signal })
}

/**
 * POST /api/employees/{id}/requests — multipart: the CreateEmployeeRequestDto
 * form fields plus the optional `attachment` file (sick-leave certificate).
 */
export function createRequest(
  employeeId: number,
  fields: Record<string, string>,
  attachment: File | null,
): Promise<CreatedRequest> {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== '' && value != null) form.append(key, value)
  }
  if (attachment) form.append('attachment', attachment)
  return apiRequest<CreatedRequest>(`/api/employees/${employeeId}/requests`, { method: 'POST', form })
}

export async function cancelRequest(requestId: number): Promise<void> {
  await apiRequest<void>(`/api/requests/${requestId}/cancel`, { method: 'POST' })
}

/** Streams the file riding with an approved request (sick-leave certificate). */
export function downloadRequestAttachment(requestId: number, signal?: AbortSignal) {
  return apiDownload(`/api/requests/${requestId}/attachment`, signal)
}
