import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  deleteEvaluationForm,
  deleteHiringForm,
  getEvaluationAssignments,
  getEvaluationForm,
  getEvaluationForms,
  getEvaluationResponses,
  getGoals,
  getHiringForm,
  getHiringForms,
  getPerformanceCycles,
  postEvaluationDispatch,
  postEvaluationForm,
  postEvaluationLaunchCycle,
  postEvaluationResponse,
  postGoal,
  postHiringForm,
  putEvaluationForm,
  putHiringForm,
  type AssignmentListParams,
  type CreateGoalBody,
  type EvaluationFormListParams,
  type EvaluationResponseListParams,
  type GoalListParams,
  type HiringFormListParams,
  type SubmitEvaluationBody,
  type UpsertEvaluationFormBody,
  type UpsertHiringFormBody,
} from '../api/evaluations.api'

function invalidateEvaluations(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['evaluations'] })
  queryClient.invalidateQueries({ queryKey: ['evaluation-assignments'] })
}

/** Paged evaluation-template list. */
export function useEvaluationForms(params: EvaluationFormListParams, enabled = true) {
  return useQuery({
    queryKey: ['evaluations', 'forms', params],
    queryFn: ({ signal }) => getEvaluationForms(params, signal),
    enabled,
  })
}

/** Single evaluation template (fresh question list for the editor). */
export function useEvaluationForm(id: number | null) {
  return useQuery({
    queryKey: ['evaluations', 'form', id],
    queryFn: ({ signal }) => getEvaluationForm(id ?? 0, signal),
    enabled: id != null,
  })
}

/** Create (id null) or update (whole question list replaced). */
export function useSaveEvaluationForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: UpsertEvaluationFormBody }) =>
      id == null ? postEvaluationForm(body) : putEvaluationForm(id, body),
    onSuccess: () => invalidateEvaluations(queryClient),
  })
}

/** DELETE /api/evaluation-forms/{id} (400 once responses exist → set Inactive). */
export function useDeleteEvaluationForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteEvaluationForm(id),
    onSuccess: () => invalidateEvaluations(queryClient),
  })
}

/** POST /api/evaluation-forms/{id}/dispatch — route to eligible evaluators. */
export function useDispatchEvaluationForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => postEvaluationDispatch(id),
    onSuccess: () => invalidateEvaluations(queryClient),
  })
}

/** Paged hiring-form list. */
export function useHiringForms(params: HiringFormListParams, enabled = true) {
  return useQuery({
    queryKey: ['evaluations', 'hiring-forms', params],
    queryFn: ({ signal }) => getHiringForms(params, signal),
    enabled,
  })
}

/** Single hiring form (fresh question list for the editor). */
export function useHiringForm(id: number | null) {
  return useQuery({
    queryKey: ['evaluations', 'hiring-form', id],
    queryFn: ({ signal }) => getHiringForm(id ?? 0, signal),
    enabled: id != null,
  })
}

/** Create (id null) or update a hiring form. */
export function useSaveHiringForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: UpsertHiringFormBody }) =>
      id == null ? postHiringForm(body) : putHiringForm(id, body),
    onSuccess: () => invalidateEvaluations(queryClient),
  })
}

/** DELETE /api/hiring-forms/{id} (400 while applications exist → close instead). */
export function useDeleteHiringForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteHiringForm(id),
    onSuccess: () => invalidateEvaluations(queryClient),
  })
}

/** Paged evaluation history (completed + in-progress responses). */
export function useEvaluationResponses(params: EvaluationResponseListParams, enabled = true) {
  return useQuery({
    queryKey: ['evaluations', 'responses', params],
    queryFn: ({ signal }) => getEvaluationResponses(params, signal),
    enabled,
  })
}

/** The signed-in evaluator's assigned evaluations (My Evaluations inbox). */
export function useEvaluationAssignments(params: AssignmentListParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['evaluation-assignments', params],
    queryFn: ({ signal }) => getEvaluationAssignments(params, signal),
    enabled,
    // A viewer without evaluator keys gets a 403 — that means "no inbox", not a
    // transient failure, so retrying only burns requests.
    retry: false,
  })
}

/** POST /api/evaluation-forms/{id}/responses — submit a scored evaluation. */
export function useSubmitEvaluation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, body }: { formId: number; body: SubmitEvaluationBody }) =>
      postEvaluationResponse(formId, body),
    onSuccess: () => invalidateEvaluations(queryClient),
  })
}

/** POST /api/evaluation-forms/{id}/launch-cycle — seed In Progress rows. */
export function useLaunchEvaluationCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ formId, period }: { formId: number; period: string }) =>
      postEvaluationLaunchCycle(formId, { period }),
    onSuccess: () => invalidateEvaluations(queryClient),
  })
}

/** Performance-cycle chips for History & Trends. */
export function usePerformanceCycles(enabled = true) {
  return useQuery({
    queryKey: ['evaluations', 'performance-cycles'],
    queryFn: ({ signal }) => getPerformanceCycles(signal),
    enabled,
  })
}

/** Goals & OKRs cards for History & Trends. */
export function useGoals(params: GoalListParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['evaluations', 'goals', params],
    queryFn: ({ signal }) => getGoals(params, signal),
    enabled,
  })
}

/** POST /api/goals — the "+ Add" goal form. */
export function useCreateGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateGoalBody) => postGoal(body),
    onSuccess: () => invalidateEvaluations(queryClient),
  })
}
