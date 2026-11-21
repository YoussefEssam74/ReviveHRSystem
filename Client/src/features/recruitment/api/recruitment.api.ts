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
  'First Interview',
  'Second Interview',
  'Accepted',
  'Rejected',
  'Hired',
] as const

/**
 * The board retired the Screening step. Legacy rows still store it, but every
 * screen renders them as Applied so one stage covers the pre-interview phase.
 */
export function displayStage(stage: string): string {
  return stage === 'Screening' ? 'Applied' : stage
}

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

/** The scheduled interview round the candidate did not attend. */
export interface MissedInterview {
  /** "First Interview" | "Second Interview". */
  stage: string
  scheduledDate: string
  type: string | null
  room: string | null
  interviewer: string | null
}

/** One pipeline card (GET /api/candidates items and vacancy detail candidates). */
export interface CandidateCard {
  id: number
  /** Application row id — required for stage moves (null when a card has no application). */
  applicationId: number | null
  name: string
  initials: string
  position: string
  /** Vacancy branch, else the candidate's preferred branch. */
  gym: string | null
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
  /** Scheduled round whose slot passed without an outcome (no-show). */
  missed: MissedInterview | null
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

/* ==================== Hiring-form applications ==================== */

/** Status vocabulary of a hiring-form application (GET /api/applications?status). */
export const FORM_APPLICATION_STATUSES = ['New', 'In Review', 'Shortlisted', 'Rejected', 'Moved to Pipeline'] as const

/** One stored answer — `answer` is a string (text/choose) or a string[] (checkbox), null when skipped. */
export interface FormApplicationAnswer {
  question: string
  type: string
  answer: string | string[] | null
}

/** One applicant card of the Hiring tab (GET /api/applications items). */
export interface FormApplication {
  id: number
  name: string
  email: string
  phone: string
  gym: string | null
  formId: number
  formName: string
  position: string | null
  appliedDate: string
  status: string
  rejectComment: string | null
  answers: FormApplicationAnswer[]
}

export interface FormApplicationListParams {
  formId?: number
  status?: string
  searchTerm?: string
  page?: number
  pageSize?: number
}

/** GET /api/applications — the Hiring tab's applicant pane. */
export function getFormApplications(
  params: FormApplicationListParams = {},
  signal?: AbortSignal,
): Promise<Paged<FormApplication>> {
  const query = new URLSearchParams()
  if (params.formId != null) query.set('formId', String(params.formId))
  if (params.status) query.set('status', params.status)
  if (params.searchTerm) query.set('searchTerm', params.searchTerm)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<FormApplication>>(`/api/applications${qs ? '?' + qs : ''}`, { signal })
}

/** GET /api/applications/{id} — applicant detail with answers (wrapped in { data }). */
export function getFormApplication(id: number, signal?: AbortSignal): Promise<FormApplication> {
  return apiRequest<{ data: FormApplication }>(`/api/applications/${id}`, { signal }).then((r) => r.data)
}

/** PUT /api/applications/{id}/reject — mark Rejected with an optional comment (wrapped in { data }). */
export function putRejectFormApplication(
  id: number,
  body: { comment?: string },
  signal?: AbortSignal,
): Promise<{ id: number; status: string }> {
  return apiRequest<{ data: { id: number; status: string } }>(`/api/applications/${id}/reject`, {
    method: 'PUT',
    body,
    signal,
  }).then((r) => r.data)
}

/**
 * POST /api/candidates — "Add to Pipeline": converts a form application into a
 * pipeline candidate (starts at Applied) and flips the application status to
 * "Moved to Pipeline".
 */
export function postConvertApplication(applicationId: number, signal?: AbortSignal): Promise<CandidateCard> {
  return apiRequest<{ data: CandidateCard; applicationStatus: string }>('/api/candidates', {
    method: 'POST',
    body: { applicationId },
    signal,
  }).then((r) => r.data)
}

/* ==================== Interviews ==================== */

/** One interview row (GET /api/interviews items). */
export interface Interview {
  id: number
  candidateId: number | null
  candidate: string
  position: string | null
  gym: string | null
  /** YYYY-MM-DD. */
  date: string
  /** HH:mm. */
  time: string
  scheduledDate: string
  type: string | null
  interviewer: string | null
  /** Scheduled | Invited | Completed | Cancelled | Draft. */
  status: string
  room: string | null
  verdict: string | null
  evaluation: string | null
}

export interface InterviewListParams {
  /** YYYY-MM month window. */
  month?: string
  /** YYYY-MM-DD selected day. */
  date?: string
  status?: string
  candidateId?: number
  page?: number
  pageSize?: number
}

/** GET /api/interviews — the interviews calendar feed. */
export function getInterviews(params: InterviewListParams = {}, signal?: AbortSignal): Promise<Paged<Interview>> {
  const query = new URLSearchParams()
  if (params.month) query.set('month', params.month)
  if (params.date) query.set('date', params.date)
  if (params.status) query.set('status', params.status)
  if (params.candidateId != null) query.set('candidateId', String(params.candidateId))
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<Interview>>(`/api/interviews${qs ? '?' + qs : ''}`, { signal })
}

export interface CreateInterviewBody {
  candidateId: number
  position?: string
  /** YYYY-MM-DD. */
  date: string
  /** HH:mm. */
  time: string
  /** On-site | Video | Trial | Panel. */
  type?: string
  interviewer?: string
  room?: string
}

/** POST /api/interviews — book a round for a candidate (201, wrapped in { data }). */
export function postInterview(body: CreateInterviewBody, signal?: AbortSignal): Promise<Interview> {
  return apiRequest<{ data: Interview }>('/api/interviews', { method: 'POST', body, signal }).then((r) => r.data)
}

/* ==================== Waiting list ==================== */

/** Open vacancy matched to a waiting candidate (partial position match). */
export interface WaitingMatch {
  id: number
  position: string
  gym: string | null
  headcount: number
  urgency: string | null
  candidates: number
}

/** One waiting-list card (GET /api/recruitment/waiting-list items). */
export interface WaitingListItem {
  id: number
  candidateId: number | null
  name: string
  position: string | null
  /** Vacancy branch, else the candidate's preferred branch. */
  gym: string | null
  rating: number | null
  skills: string[]
  note: string | null
  /** ISO datetime the candidate joined the pool. */
  since: string
  source: string | null
  matchingVacancies: WaitingMatch[]
}

export interface WaitingListParams {
  page?: number
  pageSize?: number
  position?: string
}

/** GET /api/recruitment/waiting-list — parked candidates + matching open vacancies. */
export function getWaitingList(params: WaitingListParams = {}, signal?: AbortSignal): Promise<Paged<WaitingListItem>> {
  const query = new URLSearchParams()
  if (params.position) query.set('position', params.position)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<WaitingListItem>>(`/api/recruitment/waiting-list${qs ? '?' + qs : ''}`, { signal })
}

/** DELETE /api/recruitment/waiting-list/{id} — 204, the application record is deleted. */
export function deleteWaitingListItem(id: number, signal?: AbortSignal): Promise<void> {
  return apiRequest<void>(`/api/recruitment/waiting-list/${id}`, { method: 'DELETE', signal })
}

/** POST /api/recruitment/waiting-list/{id}/assign body — the 3-step wizard's fields. */
export interface AssignWaitingBody {
  vacancyId?: number
  position?: string
  gymId?: number
  /** YYYY-MM-DD. */
  startDate?: string
  salary?: number
  annualIncrease?: number
  leaveDays?: number
  /** Junior | Mid | Senior. */
  level?: string
  email?: string
  password?: string
  role?: string
}

export interface AssignWaitingResult {
  employeeId: number
  name: string
  position: string | null
  level: string | null
  gym: string | null
  startDate: string | null
  waitingListRemoved: boolean
  newComerId: number
}

/** POST /api/recruitment/waiting-list/{id}/assign — creates the employee and leaves the pool. */
export function postAssignWaitingItem(
  id: number,
  body: AssignWaitingBody,
  signal?: AbortSignal,
): Promise<AssignWaitingResult> {
  return apiRequest<{ data: AssignWaitingResult }>(`/api/recruitment/waiting-list/${id}/assign`, {
    method: 'POST',
    body,
    signal,
  }).then((r) => r.data)
}

/* ==================== Hire (pipeline) ==================== */

/** POST /api/applications/{id}/hire body — offer terms + optional vacancy linkage. */
export interface HireTermsBody {
  vacancyId?: number
  gymId?: number
  offerLetterNote?: string
  salary?: number
  annualIncrease?: number
  leaveDays?: number
  /** YYYY-MM-DD. */
  startDate?: string
  /** Full-time | Part-time. */
  contractType?: string
  /** Junior | Mid | Senior. */
  level?: string
  email?: string
  password?: string
  role?: string
}

export interface HireResult {
  employeeId: number
  name: string
  position: string | null
  level: string | null
  gym: string | null
  status: string
  startDate: string | null
  email: string | null
  salary: number | null
  leaveDays: number | null
  role: string | null
  newComerId: number
  hiredDate: string | null
  vacancyHeadcountRemaining: number
}

/** POST /api/applications/{id}/hire — creates the User + Employee and closes the seat (201, wrapped in { data }). */
export function postHireCandidate(
  applicationId: number,
  body: HireTermsBody,
  signal?: AbortSignal,
): Promise<HireResult> {
  return apiRequest<{ data: HireResult }>(`/api/applications/${applicationId}/hire`, {
    method: 'POST',
    body,
    signal,
  }).then((r) => r.data)
}
