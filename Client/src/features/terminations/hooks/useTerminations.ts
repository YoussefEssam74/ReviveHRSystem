import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAllPages } from '../../../lib/paged'
import {
  getEmployeeOptions,
  getSeparation,
  getSeparations,
  postFinalize,
  postOffboardEmployee,
  postSeparation,
  putApproval,
  putChecklist,
  putClearance,
  putExitInterview,
  putExitInterviewSchedule,
  putExitInterviewStatus,
  putStage,
  putVerdict,
  type ApprovalBody,
  type ClearanceBody,
  type ExitInterviewFormBody,
  type ExitInterviewStatusBody,
  type InitiateSeparationBody,
  type OffboardEmployeeBody,
  type SeparationListParams,
  type VerdictBody,
} from '../api/terminations.api'

/** Paged separation cases (gym / status / type filtered). */
export function useSeparations(params: SeparationListParams) {
  return useQuery({
    queryKey: ['separations', params],
    queryFn: ({ signal }) => getSeparations(params, signal),
  })
}

/**
 * Every case in the pipeline (all pages). The Terminations board groups the
 * rows by stage, so it cannot work from a single 20-row page.
 */
export function useAllSeparations(params: Omit<SeparationListParams, 'page' | 'pageSize'>) {
  return useQuery({
    queryKey: ['separations', 'board', params],
    queryFn: ({ signal }) =>
      fetchAllPages((page, pageSignal) =>
        getSeparations({ ...params, page, pageSize: 100 }, pageSignal ?? signal),
      ),
  })
}

/** One separation case with its checklist and verdict. */
export function useSeparation(id: number) {
  return useQuery({
    queryKey: ['separations', 'detail', id],
    queryFn: ({ signal }) => getSeparation(id, signal),
    enabled: Number.isFinite(id) && id > 0,
  })
}

/** Employee picker results for the initiate dialog. */
export function useEmployeeOptions(search: string) {
  return useQuery({
    queryKey: ['separations', 'employee-options', search],
    queryFn: ({ signal }) => getEmployeeOptions(search, signal),
    enabled: search.trim().length >= 2,
  })
}

/** POST /api/separations — open a Termination case. */
export function useInitiateSeparation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: InitiateSeparationBody) => postSeparation(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['separations'] })
    },
  })
}

/** POST /api/employees/{id}/offboard — HR-initiated offboarding (Notice Period). */
export function useOffboardEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, body }: { employeeId: number; body: OffboardEmployeeBody }) =>
      postOffboardEmployee(employeeId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['separations'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** PUT /api/separations/{id}/stage — move a case one pipeline stage. */
export function useMoveStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => putStage(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['separations'] })
    },
  })
}

/** PUT /api/separations/{id}/checklist — toggle one exit task. */
export function useToggleChecklist(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ index, done }: { index: number; done: boolean }) => putChecklist(id, index, done),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['separations'] })
    },
  })
}

/** PUT /api/separations/{id}/verdict — save the exit verdict. */
export function useSaveVerdict(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: VerdictBody) => putVerdict(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['separations'] })
    },
  })
}

/** POST /api/separations/{id}/finalize — archive the separation. */
export function useFinalizeSeparation(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => postFinalize(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['separations'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Termination workflow — HR approval → exit interview → clearance
// ---------------------------------------------------------------------------

/** Invalidate every cache a workflow step can change. */
function useTerminationWorkflowMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<string>,
  options: { archivesEmployee?: boolean } = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['separations'] })
      if (options.archivesEmployee) {
        queryClient.invalidateQueries({ queryKey: ['employees'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      }
    },
  })
}

/** PUT /api/separations/{id}/approval — HR approves or rejects a termination request. */
export function useDecideTermination() {
  return useTerminationWorkflowMutation(({ id, body }: { id: number; body: ApprovalBody }) =>
    putApproval(id, body),
  )
}

/** PUT /api/separations/{id}/exit-interview/schedule — book or re-book the interview. */
export function useScheduleExitInterview() {
  return useTerminationWorkflowMutation(({ id, scheduledAt }: { id: number; scheduledAt: string }) =>
    putExitInterviewSchedule(id, scheduledAt),
  )
}

/** PUT /api/separations/{id}/exit-interview/status — Completed | No Show | Rescheduled. */
export function useUpdateExitInterviewStatus() {
  return useTerminationWorkflowMutation(({ id, body }: { id: number; body: ExitInterviewStatusBody }) =>
    putExitInterviewStatus(id, body),
  )
}

/** PUT /api/separations/{id}/exit-interview — save the exit interview form. */
export function useSaveExitInterview() {
  return useTerminationWorkflowMutation(({ id, body }: { id: number; body: ExitInterviewFormBody }) =>
    putExitInterview(id, body),
  )
}

/** PUT /api/separations/{id}/clearance — save clearance; completing it archives the employee. */
export function useSaveClearance() {
  return useTerminationWorkflowMutation(
    ({ id, body }: { id: number; body: ClearanceBody }) => putClearance(id, body),
    { archivesEmployee: true },
  )
}
