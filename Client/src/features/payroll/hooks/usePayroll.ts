import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  deleteEntryDeduction,
  downloadPeriodCsv,
  getAttendanceRef,
  getDeductionCandidates,
  getPayrollPeriod,
  getPayrollPeriods,
  getPayslip,
  postCandidateReview,
  postEnsureCurrentPeriod,
  postEntryClose,
  postEntryDeduction,
  postEntryReopen,
  postPeriodApprove,
  putEntryAttendance,
  putEntryBonus,
  type CreateDeductionBody,
  type DeductionCandidateParams,
  type PayrollPeriodListParams,
  type UpdatePayrollAttendanceBody,
} from '../api/payroll.api'

/** Paged payroll-period directory. */
export function usePayrollPeriods(params: PayrollPeriodListParams, enabled = true) {
  return useQuery({
    queryKey: ['payroll', 'periods', params],
    queryFn: ({ signal }) => getPayrollPeriods(params, signal),
    enabled,
  })
}

/** One period with its settlement sheets. */
export function usePayrollPeriod(id: number, enabled = true) {
  return useQuery({
    queryKey: ['payroll', 'period', id],
    queryFn: ({ signal }) => getPayrollPeriod(id, signal),
    enabled: enabled && Number.isFinite(id) && id > 0,
  })
}

/** Payslip preview for one entry. */
export function usePayslip(periodId: number, employeeId: number, enabled = true) {
  return useQuery({
    queryKey: ['payroll', 'payslip', periodId, employeeId],
    queryFn: ({ signal }) => getPayslip(periodId, employeeId, signal),
    enabled: enabled && Number.isFinite(employeeId) && employeeId > 0,
  })
}

/** Punch audit behind a deduction line (View Log on the settlement sheet). */
export function useAttendanceRef(ref: string | null) {
  return useQuery({
    queryKey: ['payroll', 'attendance-ref', ref],
    queryFn: ({ signal }) => getAttendanceRef(ref!, signal),
    enabled: Boolean(ref) && ref !== 'ATT-MANUAL',
  })
}

/**
 * Opens the current month's run and adds sheets for newly created employees.
 * Idempotent, so the page can call it on every visit.
 */
export function useEnsureCurrentPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (gymId: number) => postEnsureCurrentPeriod(gymId),
    onSuccess: () => invalidatePayroll(queryClient),
  })
}

/** The pending-lines review queue. */
export function useDeductionCandidates(params: DeductionCandidateParams, enabled = true) {
  return useQuery({
    queryKey: ['payroll', 'candidates', params],
    queryFn: ({ signal }) => getDeductionCandidates(params, signal),
    enabled,
  })
}

function invalidatePayroll(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['payroll'] })
}

/** PUT …/entries/{employeeId} — set the bonus (≥ 0). */
export function useUpdateBonus(periodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, bonus }: { employeeId: number; bonus: number }) =>
      putEntryBonus(periodId, employeeId, bonus),
    onSuccess: () => invalidatePayroll(queryClient),
  })
}

/** PUT …/entries/{employeeId}/attendance — correct the sheet's six counters. */
export function useUpdateEntryAttendance(periodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, body }: { employeeId: number; body: UpdatePayrollAttendanceBody }) =>
      putEntryAttendance(periodId, employeeId, body),
    onSuccess: () => invalidatePayroll(queryClient),
  })
}

/** POST …/deductions — the inline Add-Line form (creates a Pending line). */
export function useAddDeduction(periodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, body }: { employeeId: number; body: CreateDeductionBody }) =>
      postEntryDeduction(periodId, employeeId, body),
    onSuccess: () => invalidatePayroll(queryClient),
  })
}

/** DELETE …/deductions/{lineId} — quick undo of an Add-Line. */
export function useRemoveDeduction(periodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, lineId }: { employeeId: number; lineId: number }) =>
      deleteEntryDeduction(periodId, employeeId, lineId),
    onSuccess: () => invalidatePayroll(queryClient),
  })
}

/** POST …/close — settle & close one sheet. */
export function useCloseEntry(periodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (employeeId: number) => postEntryClose(periodId, employeeId),
    onSuccess: () => invalidatePayroll(queryClient),
  })
}

/** POST …/reopen — back to Draft. */
export function useReopenEntry(periodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (employeeId: number) => postEntryReopen(periodId, employeeId),
    onSuccess: () => invalidatePayroll(queryClient),
  })
}

/** POST /api/payroll-periods/{id}/approve — publish & lock the branch. */
export function useApprovePeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ periodId, gym }: { periodId: number; gym: string }) => postPeriodApprove(periodId, gym),
    onSuccess: () => invalidatePayroll(queryClient),
  })
}

/** POST /api/deduction-candidates/{id}/review — Approve (Accepted) / Waive (Rejected). */
export function useReviewCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, amount, days }: { id: number; decision?: 'Accepted' | 'Rejected'; amount?: number; days?: number }) =>
      postCandidateReview(id, { decision, amount, days }),
    onSuccess: () => invalidatePayroll(queryClient),
  })
}

/** Downloads the period CSV (no cache — a plain action with loading state). */
export function useExportPeriodCsv() {
  return useMutation({
    mutationFn: ({ periodId, gymId }: { periodId: number; gymId?: number }) => downloadPeriodCsv(periodId, gymId),
  })
}
