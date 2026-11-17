import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  getActionRequests,
  getRequest,
  getRequests,
  getRequestSummary,
  postArchive,
  postBulkDecide,
  postDecide,
  postRequest,
  postRestore,
  postUndoDecision,
  putApprove,
  putReject,
  type ActionRequestParams,
  type CreateRequestBody,
  type DecideRequestBody,
  type RequestListParams,
} from '../api/requests.api'

/** Drops every cache the inbox and its summary feed. */
function invalidateInbox(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['requests'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

/** Paged escalated-request queue. */
export function useActionRequests(params: ActionRequestParams) {
  return useQuery({
    queryKey: ['action-requests', params],
    queryFn: ({ signal }) => getActionRequests(params, signal),
  })
}

/** Approve (executes the proposed effect). */
export function useApproveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => putApprove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-requests'] })
    },
  })
}

/** Reject (comment required; executes nothing). */
export function useRejectRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) => putReject(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-requests'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// HR inbox (R1–R10)
// ---------------------------------------------------------------------------

/** Paged inbox for the current tab / type / quick filter. */
export function useRequestInbox(params: RequestListParams, enabled = true) {
  return useQuery({
    queryKey: ['requests', 'inbox', params],
    queryFn: ({ signal }) => getRequests(params, signal),
    enabled,
    placeholderData: (previous) => previous,
  })
}

/** KPI tiles + tab badges + type pills. */
export function useRequestSummary(gym?: number, enabled = true) {
  return useQuery({
    queryKey: ['requests', 'summary', gym ?? null],
    queryFn: ({ signal }) => getRequestSummary(gym, signal),
    enabled,
  })
}

/** One request's detail (R2). */
export function useRequestDetail(id: number | null) {
  return useQuery({
    queryKey: ['requests', 'detail', id],
    queryFn: ({ signal }) => getRequest(id!, signal),
    enabled: id != null && id > 0,
  })
}

/** POST /api/requests — HR creates a request on an employee's behalf. */
export function useCreateRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRequestBody) => postRequest(body),
    onSuccess: () => invalidateInbox(queryClient),
  })
}

/** POST /api/requests/{id}/decide — HR approve/reject with payment. */
export function useDecideRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: DecideRequestBody }) => postDecide(id, body),
    onSuccess: () => {
      invalidateInbox(queryClient)
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

/**
 * HR stage decision on an employee request (PendingHRReview → Approved/Rejected).
 * Kept for the dashboard's quick approve/decline cards.
 */
export function useDecideEmployeeRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; decision: 'approved' | 'rejected'; comment?: string }) =>
      postDecide(args.id, { decision: args.decision, comment: args.comment }),
    onSuccess: () => invalidateInbox(queryClient),
  })
}

/** POST /api/requests/{id}/undo-decision. */
export function useUndoDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comment }: { id: number; comment?: string }) => postUndoDecision(id, comment),
    onSuccess: () => invalidateInbox(queryClient),
  })
}

/** POST /api/requests/bulk-decide. */
export function useBulkDecide() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestIds?: number[]) => postBulkDecide(requestIds ? { requestIds } : {}),
    onSuccess: () => invalidateInbox(queryClient),
  })
}

/** POST /api/requests/{id}/archive | /restore. */
export function useArchiveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, restore }: { id: number; restore: boolean }) =>
      restore ? postRestore(id) : postArchive(id),
    onSuccess: () => invalidateInbox(queryClient),
  })
}
