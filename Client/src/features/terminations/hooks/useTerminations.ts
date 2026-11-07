import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEmployeeOptions,
  getSeparation,
  getSeparations,
  postFinalize,
  postSeparation,
  putChecklist,
  putVerdict,
  type InitiateSeparationBody,
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
