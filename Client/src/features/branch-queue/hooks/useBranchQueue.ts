import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBonuses,
  getDeductions,
  getWarnings,
  postBonusReview,
  postDeductionReview,
  postWarningReview,
  type ProposalListParams,
  type ReviewProposalBody,
} from '../api/branch-queue.api'

/** Pending warning notices (requests.view). Pass `enabled` to pause the query off-tab. */
export function useWarnings(params: ProposalListParams, enabled = true) {
  return useQuery({
    queryKey: ['branch-queue', 'warnings', params],
    queryFn: ({ signal }) => getWarnings(params, signal),
    enabled,
  })
}

/** Pending bonus proposals (requests.view). */
export function useBonuses(params: ProposalListParams, enabled = true) {
  return useQuery({
    queryKey: ['branch-queue', 'bonuses', params],
    queryFn: ({ signal }) => getBonuses(params, signal),
    enabled,
  })
}

/** Pending deduction lines (payroll.view | payroll.edit). */
export function useDeductions(params: ProposalListParams, enabled = true) {
  return useQuery({
    queryKey: ['branch-queue', 'deductions', params],
    queryFn: ({ signal }) => getDeductions(params, signal),
    enabled,
  })
}

/** POST /api/warning-notices/{id}/review — File / Decline (requests.approve). */
export function useReviewWarning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ReviewProposalBody }) => postWarningReview(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-queue'] })
    },
  })
}

/** POST /api/bonus-proposals/{id}/review — Approve / Decline (requests.approve). */
export function useReviewBonus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ReviewProposalBody }) => postBonusReview(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-queue'] })
    },
  })
}

/** POST /api/deduction-candidates/{id}/review — Accept / Waive (payroll.edit). Recomputes payroll totals. */
export function useReviewDeduction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'Accepted' | 'Rejected' }) =>
      postDeductionReview(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-queue'] })
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })
}
