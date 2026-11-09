import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getActionRequests,
  postDecide,
  putApprove,
  putReject,
  type ActionRequestParams,
} from '../api/requests.api'

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
    },
  })
}

/**
 * HR stage decision on an employee request (PendingHRReview → Approved/Rejected).
 * Invalidates the dashboard queue + any request list queries after a decision.
 */
export function useDecideEmployeeRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; decision: 'approved' | 'rejected'; comment?: string }) =>
      postDecide(args.id, { decision: args.decision, comment: args.comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['action-requests'] })
    },
  })
}
