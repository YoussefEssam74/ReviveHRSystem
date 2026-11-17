import { apiRequest } from '../../../lib/api-client'

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Pipeline stage vocabulary (GET /api/candidates?stage, PUT /api/applications/{id}/stage). */
export const CANDIDATE_STAGES = [
  'Applied',
  'Screening',
  'First Interview',
  'Second Interview',
  'Accepted',
  'Rejected',
  'Hired',
] as const

/** Urgency vocabulary used by vacancies and vacancy requests. */
export const URGENCIES = ['Low', 'Medium', 'High'] as const

/** One vacancy row (GET /api/vacancies items). */
export interface Vacancy {
  id: number
  positionId: number | null
  position: string
  gymId: number | null
  gym: string
  headcount: number
  urgency: string | null
  status: string
  createdDate: string | null
  /** Count of non-rejected applications. */
  candidates: number
  requestedBy: string | null
  salary: number | null
  shift: string | null
  source: string | null
  description: string | null
  requirements: string | null
}

export interface VacancyListParams {
  gym?: number
  status?: string
  searchTerm?: string
  page?: number
  pageSize?: number
  sortBy?: 'createdDate' | 'position' | 'headcount'
  sortOrder?: 'asc' | 'desc'
}

/** GET /api/vacancies — paged, gym-scoped vacancy board. */
export function getVacancies(params: VacancyListParams = {}, signal?: AbortSignal): Promise<Paged<Vacancy>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.status) query.set('status', params.status)
  if (params.searchTerm) query.set('searchTerm', params.searchTerm)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  const qs = query.toString()
  return apiRequest<Paged<Vacancy>>(`/api/vacancies${qs ? '?' + qs : ''}`, { signal })
}

/** One interview round carried on a candidate card. */
export interface CandidateInterview {
  date: string | null
  by: string | null
  verdict: string | null
  eval: string | null
  type: string | null
  room: string | null
  notes: string | null
}

/** The hiring-form data carried on a candidate card. */
export interface CandidateForm {
  email: string | null
  source: string | null
  gymPref: string | null
  expYears: number | null
  education: string | null
  skills: string[]
  languages: string[]
  shift: string | null
  salaryExp: number | null
  availability: string | null
}

/** One pipeline card (GET /api/candidates items and vacancy detail candidates). */
export interface CandidateCard {
  id: number
  /** Application row id — required for stage moves (null when a card has no application). */
  applicationId: number | null
  name: string
  initials: string
  position: string
  stage: string
  appliedDate: string | null
  phone: string | null
  rating: number | null
  blocked: boolean
  blockReason: string | null
  hiredDate: string | null
  rejectedDate: string | null
  rejectedBy: string | null
  rejectReason: string | null
  form: CandidateForm | null
  screen: CandidateInterview | null
  iv1: CandidateInterview | null
  iv2: CandidateInterview | null
  decision: { by: string | null; date: string | null; verdict: string | null; note: string | null } | null
}

/** GET /api/vacancies/{id} — the detail modal payload. */
export interface VacancyDetail {
  data: Vacancy
  funnel: { stage: string; count: number }[]
  employeesUnderPosition: { id: number; name: string; initials: string; position: string; gym: string }[]
  candidates: CandidateCard[]
}

/** GET /api/vacancies/{id} — vacancy + funnel + staff + candidates (not wrapped). */
export function getVacancy(id: number, signal?: AbortSignal): Promise<VacancyDetail> {
  return apiRequest<VacancyDetail>(`/api/vacancies/${id}`, { signal })
}

export interface VacancyBody {
  position: string
  gymId?: number
  headcountNeeded?: number
  urgency?: string
  source?: string
  jobDescription?: string
  requirements?: string
  salary?: number
  shift?: string
  status?: string
}

/** POST /api/vacancies — creates a vacancy (201, wrapped in { data }). */
export function postVacancy(body: VacancyBody, signal?: AbortSignal): Promise<Vacancy> {
  return apiRequest<{ data: Vacancy }>('/api/vacancies', { method: 'POST', body, signal }).then((r) => r.data)
}

/** PUT /api/vacancies/{id} — partial update (wrapped in { data }). */
export function putVacancy(id: number, body: VacancyBody, signal?: AbortSignal): Promise<Vacancy> {
  return apiRequest<{ data: Vacancy }>(`/api/vacancies/${id}`, { method: 'PUT', body, signal }).then((r) => r.data)
}

/** One vacancy request row (GET /api/vacancy-requests items). */
export interface VacancyRequest {
  id: number
  positionId: number | null
  position: string
  gymId: number | null
  gym: string
  urgency: string | null
  status: string
  submittedBy: string | null
  submittedDate: string | null
  reason: string | null
  salary: number | null
  shift: string | null
  headcount: number | null
  decidedBy: string | null
  vacancyId: number | null
}

export interface VacancyRequestListParams {
  status?: string
  gym?: number
  page?: number
  pageSize?: number
}

/** GET /api/vacancy-requests — the branch-manager request queue, newest first. */
export function getVacancyRequests(params: VacancyRequestListParams = {}, signal?: AbortSignal): Promise<Paged<VacancyRequest>> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<VacancyRequest>>(`/api/vacancy-requests${qs ? '?' + qs : ''}`, { signal })
}

export interface DecideVacancyRequestBody {
  decision: 'Approved' | 'Rejected'
  comment?: string
}

/** PUT /api/vacancy-requests/{id}/decide — approval creates the linked vacancy. */
export function putDecideVacancyRequest(id: number, body: DecideVacancyRequestBody, signal?: AbortSignal): Promise<VacancyRequest> {
  return apiRequest<{ data: VacancyRequest }>(`/api/vacancy-requests/${id}/decide`, { method: 'PUT', body, signal }).then(
    (r) => r.data,
  )
}

export interface CandidateListParams {
  searchTerm?: string
  stage?: string
  position?: string
  view?: string
  blocked?: string
  page?: number
  pageSize?: number
  sortBy?: 'applied' | 'name'
  sortOrder?: 'asc' | 'desc'
}

/** GET /api/candidates — the pipeline (one card per application). */
export function getCandidates(params: CandidateListParams = {}, signal?: AbortSignal): Promise<Paged<CandidateCard>> {
  const query = new URLSearchParams()
  if (params.searchTerm) query.set('searchTerm', params.searchTerm)
  if (params.stage) query.set('stage', params.stage)
  if (params.position) query.set('position', params.position)
  if (params.view) query.set('view', params.view)
  if (params.blocked) query.set('blocked', params.blocked)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  const qs = query.toString()
  return apiRequest<Paged<CandidateCard>>(`/api/candidates${qs ? '?' + qs : ''}`, { signal })
}

/** GET /api/candidates/{id} — one candidate card (wrapped in { data }). */
export function getCandidate(id: number, signal?: AbortSignal): Promise<CandidateCard> {
  return apiRequest<{ data: CandidateCard }>(`/api/candidates/${id}`, { signal }).then((r) => r.data)
}

/**
 * PUT /api/applications/{id}/stage — forward/backward stage move.
 * The path id is the APPLICATION id (CandidateItem.ApplicationId), not the candidate id.
 * Hired is NOT reachable here (the API answers 400) — only the hire wizard.
 */
export function putCandidateStage(
  applicationId: number,
  stage: string,
  signal?: AbortSignal,
): Promise<{ id: number; stage: string }> {
  return apiRequest<{ id: number; stage: string }>(`/api/applications/${applicationId}/stage`, {
    method: 'PUT',
    body: { stage },
    signal,
  })
}

/** PUT /api/candidates/{id}/block — block or unblock a candidate. */
export function putCandidateBlock(
  id: number,
  body: { blocked: boolean; blockReason?: string },
  signal?: AbortSignal,
): Promise<{ id: number; blocked: boolean; blockReason: string | null }> {
  return apiRequest<{ id: number; blocked: boolean; blockReason: string | null }>(`/api/candidates/${id}/block`, {
    method: 'PUT',
    body,
    signal,
  })
}
