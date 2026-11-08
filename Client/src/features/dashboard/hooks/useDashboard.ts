import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getHrDashboard } from '../api/dashboard.api'
import { putDecideVacancyRequest, type DecideVacancyRequestBody } from '../../recruitment/api/recruitment.api'
import { postWarningReview, postBonusReview, postDeductionReview } from '../../branch-queue/api/branch-queue.api'
import { postFaceEnrollment } from '../../attendance/api/attendance.api'
import { postResetPassword } from '../../hr-team/api/hr-team.api'

/** HR dashboard aggregate. */
export function useHrDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'hr'],
    queryFn: ({ signal }) => getHrDashboard(signal),
  })
}

// ---------------------------------------------------------------------------
// Fast-path mutations used by the decision cards + fast actions. They build on
// the sibling feature APIs (no endpoint copies) and drop the shared caches the
// queue reads, so a decision immediately disappears from the dashboard.
// ---------------------------------------------------------------------------

/** PUT /api/vacancy-requests/{id}/decide — approval also opens the public vacancy. */
export function useDashboardVacancyDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: DecideVacancyRequestBody }) => putDecideVacancyRequest(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['recruitment'] })
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
    },
  })
}

/** POST …/{id}/review for the three branch submissions (deduction / warning / bonus). */
export function useDashboardBranchReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { kind: 'deduction' | 'warning' | 'bonus'; id: number; decision: 'Approved' | 'Rejected'; note?: string }) => {
      if (args.kind === 'warning') return postWarningReview(args.id, { decision: args.decision, note: args.note })
      if (args.kind === 'bonus') return postBonusReview(args.id, { decision: args.decision, note: args.note })
      return postDeductionReview(args.id, args.decision === 'Approved' ? 'Accepted' : 'Rejected')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['branch-queue'] })
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })
}

/** POST /api/employees/face/enroll — optional Face-ID capture in the create-account dialog. */
export function useDashboardFaceEnroll() {
  return useMutation({
    mutationFn: ({ employeeNumber, image }: { employeeNumber: string; image: string }) =>
      postFaceEnrollment({ employeeNumber, image }),
  })
}

/** POST /api/users/{id}/reset-password — the admin sets a known password (team.manage). */
export function useDashboardPasswordReset(userId: number) {
  return useMutation({
    mutationFn: (newPassword: string) => postResetPassword(userId, newPassword),
  })
}
