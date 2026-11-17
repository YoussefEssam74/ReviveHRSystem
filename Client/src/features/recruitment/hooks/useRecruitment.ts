import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCandidate,
  getCandidates,
  getVacancies,
  getVacancy,
  getVacancyRequests,
  postVacancy,
  putCandidateBlock,
  putCandidateStage,
  putDecideVacancyRequest,
  putVacancy,
  type CandidateListParams,
  type DecideVacancyRequestBody,
  type VacancyBody,
  type VacancyListParams,
  type VacancyRequestListParams,
} from '../api/recruitment.api'

/** Paged vacancy board. */
export function useVacancies(params: VacancyListParams) {
  return useQuery({
    queryKey: ['vacancies', params],
    queryFn: ({ signal }) => getVacancies(params, signal),
  })
}

/** Vacancy detail modal payload (vacancy + funnel + staff + candidates). */
export function useVacancy(id: number) {
  return useQuery({
    queryKey: ['vacancies', 'detail', id],
    queryFn: ({ signal }) => getVacancy(id, signal),
    enabled: Number.isFinite(id) && id > 0,
  })
}

/** POST /api/vacancies. */
export function useCreateVacancy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: VacancyBody) => postVacancy(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
    },
  })
}

/** PUT /api/vacancies/{id}. */
export function useUpdateVacancy(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: VacancyBody) => putVacancy(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
    },
  })
}

/** Paged vacancy-request queue. */
export function useVacancyRequests(params: VacancyRequestListParams) {
  return useQuery({
    queryKey: ['vacancy-requests', params],
    queryFn: ({ signal }) => getVacancyRequests(params, signal),
  })
}

/** PUT /api/vacancy-requests/{id}/decide — approval also creates a vacancy. */
export function useDecideVacancyRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: DecideVacancyRequestBody }) => putDecideVacancyRequest(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacancy-requests'] })
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
    },
  })
}

/** Paged candidate pipeline. */
export function useCandidates(params: CandidateListParams) {
  return useQuery({
    queryKey: ['candidates', params],
    queryFn: ({ signal }) => getCandidates(params, signal),
  })
}

/** One candidate card. */
export function useCandidate(id: number) {
  return useQuery({
    queryKey: ['candidates', 'detail', id],
    queryFn: ({ signal }) => getCandidate(id, signal),
    enabled: Number.isFinite(id) && id > 0,
  })
}

/** PUT /api/applications/{applicationId}/stage — stage move (Hired 400s; use the hire wizard). */
export function useMoveCandidateStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationId, stage }: { applicationId: number; stage: string }) =>
      putCandidateStage(applicationId, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
    },
  })
}

/** PUT /api/candidates/{id}/block — block or unblock. */
export function useBlockCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, blocked, blockReason }: { id: number; blocked: boolean; blockReason?: string }) =>
      putCandidateBlock(id, { blocked, blockReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
  })
}
