import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  deleteEvaluationForm,
  deleteHiringForm,
  getEvaluationForm,
  getEvaluationForms,
  getEvaluationResponses,
  getHiringForm,
  getHiringForms,
  postEvaluationDispatch,
  postEvaluationForm,
  postHiringForm,
  putEvaluationForm,
  putHiringForm,
  type EvaluationFormListParams,
  type EvaluationResponseListParams,
  type HiringFormListParams,
  type UpsertEvaluationFormBody,
  type UpsertHiringFormBody,
} from '../api/evaluations.api'

function invalidateEvaluations(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['evaluations'] })
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
