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
// Employee requests (leave / resignation / ...) — the HR stage of the
// request pipeline. BM decides Pending → PendingHRReview; HR decides here.
// ---------------------------------------------------------------------------

export interface RequestDecisionResult {
  message: string
  offboardingPrompt?: boolean
  separationId?: number | null
}

/** POST /api/requests/{id}/decide — HR stage decision (stage "HR"; requires requests.approve). */
export function postDecide(
  id: number,
  body: { decision: 'approved' | 'rejected'; comment?: string; payment?: 'paid' | 'unpaid' },
  signal?: AbortSignal,
): Promise<RequestDecisionResult> {
  return apiRequest<RequestDecisionResult>(`/api/requests/${id}/decide`, {
    method: 'POST',
    body: { stage: 'HR', ...body },
    signal,
  })
}
