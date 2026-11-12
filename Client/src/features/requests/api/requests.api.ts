import { apiRequest } from '../../../lib/api-client'

/** One row of the escalated action-request queue (GET /api/action-requests). */
export interface ActionRequest {
  id: number
  employeeId: number | null
  employee: string | null
  position: string | null
  ActionType: string
  proposedDetails: {
    fromGym?: string | null
    toGym?: string | null
    effectiveDate?: string | null
    currentSalary?: number | null
    newSalary?: number | null
    systemRole?: string | null
    lastDay?: string | null
    reason?: string | null
    source?: string | null
  } | null
  justification: string | null
  requestedById: number | null
  requestedBy: string | null
  status: string
  submittedDate: string | null
  reviewedById: number | null
  reviewedBy: string | null
  reviewedDate: string | null
  reviewComment: string | null
}

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ActionRequestParams {
  gym?: number
  status?: string
  actionType?: string
  page?: number
  pageSize?: number
}

export function getActionRequests(params: ActionRequestParams = {}, signal?: AbortSignal): Promise<Paged<ActionRequest>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.status) query.set('status', params.status)
  if (params.actionType) query.set('actionType', params.actionType)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<ActionRequest>>(`/api/action-requests${qs ? '?' + qs : ''}`, { signal })
}

interface DecisionResponse {
  data: {
    id: number
    status: string
    reviewedBy: string | null
    reviewedDate: string | null
    executed: boolean
    reviewComment?: string | null
  }
}

/** PUT /api/action-requests/{id}/approve — executes the effect and marks Approved. */
export function putApprove(id: number, signal?: AbortSignal): Promise<DecisionResponse['data']> {
  return apiRequest<DecisionResponse>(`/api/action-requests/${id}/approve`, { method: 'PUT', signal }).then((r) => r.data)
}

/** PUT /api/action-requests/{id}/reject — requires a comment; executes nothing. */
export function putReject(id: number, comment: string, signal?: AbortSignal): Promise<DecisionResponse['data']> {
  return apiRequest<DecisionResponse>(`/api/action-requests/${id}/reject`, { method: 'PUT', body: { comment }, signal }).then(
    (r) => r.data,
  )
}

// ---------------------------------------------------------------------------
// Employee requests (leave / resignation / ...) — the HR inbox (R1–R10).
// BM decides Pending → Pending HR Review; HR takes the final decision here.
// ---------------------------------------------------------------------------

export interface RequestTimelineStep {
  step: string
  date: string
  done: boolean
}

/** Leave-balance snapshot printed on Day Off / Sick Leave cards. */
export interface RequestLeaveBalance {
  label: string
  total: number
  used: number
  left: number
  afterApproval: number
}

/** One HR inbox card (GET /api/requests items). */
export interface RequestListItem {
  id: number
  employee: string
  gym: string
  type: string
  employeeId: number
  employeeNumber: string
  initials: string
  position: string
  level: string | null
  hireDate: string | null
  leaveBalance: RequestLeaveBalance | null
  /** True while the request still sits at stage 1 (no branch-manager decision yet). */
  awaitingManager: boolean
  /** ISO date (yyyy-MM-dd). */
  submittedDate: string
  requestedDate: string
  /** End of a leave/swap range; null on single-day types. */
  endDate: string | null
  status: string
  bmDecision: string | null
  bmComment: string | null
  hrDecision: string | null
  hrComment: string | null
  /** paid | unpaid (Day Off / Sick Leave approvals only). */
  payment: string | null
  reason: string
  hasAttachment: boolean
  timeline: RequestTimelineStep[]
}

export interface RequestListParams {
  /** Pending HR Review | Approved | Rejected | Archived | Decided. */
  status?: string
  type?: string
  gym?: number
  /** yyyy-MM-dd — matches requests whose span covers that day. */
  date?: string
  /** urgent | bmRejected | balance | approved. */
  quick?: string
  /** Comma-separated ids (the payroll settlement sheet's linked requests). */
  ids?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function getRequests(params: RequestListParams = {}, signal?: AbortSignal): Promise<Paged<RequestListItem>> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.type) query.set('type', params.type)
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.date) query.set('date', params.date)
  if (params.quick) query.set('quick', params.quick)
  if (params.ids) query.set('ids', params.ids)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  const qs = query.toString()
  return apiRequest<Paged<RequestListItem>>(`/api/requests${qs ? '?' + qs : ''}`, { signal })
}

/** Counts behind the KPI tiles, tab badges and type pills (GET /api/requests/summary). */
export interface RequestSummary {
  pending: number
  /** The subset of `pending` with no branch-manager decision yet. */
  awaitingManager: number
  urgent: number
  approvedThisMonth: number
  bmRejected: number
  balanceAlerts: number
  decided: number
  archived: number
  total: number
  byType: { type: string; count: number }[]
}

export function getRequestSummary(gym?: number, signal?: AbortSignal): Promise<RequestSummary> {
  const qs = gym != null ? `?gym=${gym}` : ''
  return apiRequest<RequestSummary>(`/api/requests/summary${qs}`, { signal })
}

/** GET /api/requests/{id} → `{ data: item }`. */
export function getRequest(id: number, signal?: AbortSignal): Promise<RequestListItem> {
  return apiRequest<{ data: RequestListItem }>(`/api/requests/${id}`, { signal }).then((r) => r.data)
}

/** One row of GET /api/employees/{id}/requests — the employee's whole request log. */
export interface EmployeeRequestRow {
  id: number
  type: string
  status: string
  requestedDate: string
  endDate: string | null
  submittedDate: string
  /** Date + clock time the request was filed. */
  submittedAt: string
  reason: string | null
  payment: string | null
  calculatedDays: number | null
  /** Branch-manager stage: outcome, approver name and when it was decided. */
  bmDecision: string | null
  bmApprover: string | null
  bmDecidedAt: string | null
  bmComment: string | null
  hrDecision: string | null
}

/**
 * GET /api/employees/{id}/requests — every request the employee ever filed, whatever
 * its status. The settlement sheet reads it to show the month's whole conversation
 * (pending, approved, rejected) rather than only the rows linked to a deduction.
 */
export function getEmployeeRequestRows(employeeId: number, signal?: AbortSignal): Promise<EmployeeRequestRow[]> {
  return apiRequest<EmployeeRequestRow[]>(`/api/employees/${employeeId}/requests`, { signal })
}

export interface CreateRequestBody {
  employee: string
  type: string
  requestedDate: string
  endDate?: string
  reason?: string
}

/** POST /api/requests — HR submits on an employee's behalf → 201 `{ data: { id, status, timeline } }`. */
export function postRequest(
  body: CreateRequestBody,
  signal?: AbortSignal,
): Promise<{ id: number; status: string; timeline: RequestTimelineStep[] }> {
  return apiRequest<{ data: { id: number; status: string; timeline: RequestTimelineStep[] } }>('/api/requests', {
    method: 'POST',
    body,
    signal,
  }).then((r) => r.data)
}

/** Decision / undo response: `{ message, item, offboardingPrompt?, separationId? }`. */
export interface RequestDecisionResult {
  message: string
  item: RequestListItem
  offboardingPrompt?: boolean | null
  separationId?: number | null
}

export interface DecideRequestBody {
  decision: 'approved' | 'rejected'
  comment?: string
  /** Only Day Off / Sick Leave approvals. */
  payment?: 'paid' | 'unpaid'
  /** Only cover / unscheduled-attendance approvals: how many days the day is worth. */
  calculatedDays?: number
}

/** POST /api/requests/{id}/decide — HR stage decision (requires requests.approve). */
export function postDecide(id: number, body: DecideRequestBody, signal?: AbortSignal): Promise<RequestDecisionResult> {
  return apiRequest<RequestDecisionResult>(`/api/requests/${id}/decide`, {
    method: 'POST',
    body: { stage: 'HR', ...body },
    signal,
  })
}

/** POST /api/requests/{id}/undo-decision — payroll editors may also undo a past-dated request at settlement. */
export function postUndoDecision(id: number, comment?: string, signal?: AbortSignal): Promise<RequestDecisionResult> {
  return apiRequest<RequestDecisionResult>(`/api/requests/${id}/undo-decision`, {
    method: 'POST',
    body: { comment },
    signal,
  })
}

export interface BulkDecideResult {
  message: string
  approved: number
  unpaidApplied: number
}

/** POST /api/requests/bulk-decide — approves pending requests, payment derived per balance. */
export function postBulkDecide(
  body: { decision?: 'approved'; comment?: string; requestIds?: number[] } = {},
  signal?: AbortSignal,
): Promise<BulkDecideResult> {
  return apiRequest<BulkDecideResult>('/api/requests/bulk-decide', {
    method: 'POST',
    body: { decision: 'approved', ...body },
    signal,
  })
}

/** One leave bucket as GET /api/employees/{id}/leave-balance returns it. */
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

/** GET /api/employees/{id}/leave-balance — the New Request dialog's live preview. */
export function getEmployeeLeaveBalance(employeeId: number, signal?: AbortSignal): Promise<LeaveBalanceResponse> {
  return apiRequest<LeaveBalanceResponse>(`/api/employees/${employeeId}/leave-balance`, { signal })
}

/** POST /api/requests/{id}/archive | /restore → `{ message }`. */
export function postArchive(id: number, signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/requests/${id}/archive`, { method: 'POST', signal })
}

export function postRestore(id: number, signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/requests/${id}/restore`, { method: 'POST', signal })
}
