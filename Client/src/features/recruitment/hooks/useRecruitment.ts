import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteWaitingListItem,
  getCandidate,
  getCandidates,
  getFormApplications,
  getInterviews,
  getVacancies,
  getVacancy,
  getVacancyRequests,
  getWaitingList,
  postAssignWaitingItem,
  postConvertApplication,
  postHireCandidate,
  postInterview,
  postVacancy,
  putCandidateBlock,
  putCandidateStage,
  putDecideVacancyRequest,
  putRejectFormApplication,
  putVacancy,
  type AssignWaitingBody,
  type CandidateListParams,
  type CreateInterviewBody,
  type DecideVacancyRequestBody,
  type FormApplicationListParams,
  type HireTermsBody,
  type InterviewListParams,
  type VacancyBody,
  type VacancyListParams,
  type VacancyRequestListParams,
  type WaitingListParams,
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

/* ==================== Hiring-form applications ==================== */

/** Paged hiring-form applications (the Hiring tab's applicant pane). */
export function useFormApplications(params: FormApplicationListParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['form-applications', params],
    queryFn: ({ signal }) => getFormApplications(params, signal),
    enabled,
  })
}

/** PUT /api/applications/{id}/reject. */
export function useRejectFormApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comment }: { id: number; comment?: string }) => putRejectFormApplication(id, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-applications'] })
    },
  })
}

/** POST /api/candidates — "Add to Pipeline" conversion. */
export function useConvertFormApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (applicationId: number) => postConvertApplication(applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-applications'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
    },
  })
}

/* ==================== Interviews ==================== */

/** Paged interviews calendar. */
export function useInterviews(params: InterviewListParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['interviews', params],
    queryFn: ({ signal }) => getInterviews(params, signal),
    enabled,
  })
}

/** POST /api/interviews — book a round. */
export function useScheduleInterview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateInterviewBody) => postInterview(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
  })
}

/* ==================== Waiting list ==================== */

/** Paged waiting-list pool. */
export function useWaitingList(params: WaitingListParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['waiting-list', params],
    queryFn: ({ signal }) => getWaitingList(params, signal),
    enabled,
  })
}

/** DELETE /api/recruitment/waiting-list/{id}. */
export function useRemoveFromWaitingList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteWaitingListItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiting-list'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
  })
}

/** POST /api/recruitment/waiting-list/{id}/assign — the assign/hire wizard. */
export function useAssignWaitingCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AssignWaitingBody }) => postAssignWaitingItem(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiting-list'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
      queryClient.invalidateQueries({ queryKey: ['new-comers'] })
    },
  })
}

/* ==================== Hire (pipeline) ==================== */

/** POST /api/applications/{id}/hire — the Hired transition. */
export function useHireCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationId, body }: { applicationId: number; body: HireTermsBody }) =>
      postHireCandidate(applicationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
      queryClient.invalidateQueries({ queryKey: ['waiting-list'] })
      queryClient.invalidateQueries({ queryKey: ['new-comers'] })
    },
  })
}
