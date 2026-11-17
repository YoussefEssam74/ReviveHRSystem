import { apiRequest } from '../../../lib/api-client'

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Builder question kinds as the API accepts and echoes them:
 * `text` (rating, no options) | `choose` (single choice) | `checkbox` (multi).
 */
export type QuestionKind = 'text' | 'choose' | 'checkbox'

/** One question as stored/echoed by the API (`type` is the builder's word). */
export interface FormQuestion {
  type: string
  text: string
  options: string[]
}

/** A question inside the editor draft (type normalized to the builder's words). */
export interface QuestionDraft {
  kind: QuestionKind
  text: string
  options: string[]
}

/** Maps any stored question type (API words or legacy tokens) onto the editor. */
export function toQuestionDraft(question: FormQuestion): QuestionDraft {
  const type = question.type.toLowerCase()
  const kind: QuestionKind =
    type === 'choose' || type === 'multiplechoice' ? 'choose' : type === 'checkbox' ? 'checkbox' : 'text'
  return {
    kind,
    text: question.text,
    options: kind === 'text' ? [] : [...question.options],
  }
}

/** The question payload the POST/PUT bodies carry. */
export interface QuestionInput {
  type: QuestionKind
  text: string
  options: string[]
}

/** Common card shape shared by evaluation forms and hiring forms. */
export interface FormCard {
  id: number
  name: string
  position: string | null
  gym: string
  status: string
  questions: number
  questionList: FormQuestion[]
  /** ISO timestamp. */
  createdDate: string
  /** ISO timestamp, null until first used. */
  lastUsed: string | null
}

/** One evaluation template card (GET /api/evaluation-forms). */
export interface EvaluationForm extends FormCard {
  /** Target role alias ("All" = any position). */
  target: string | null
  /** Active | Completed | Inactive. */
  status: string
  /** Submitted responses through this form. */
  submissions: number
}

export interface EvaluationFormListParams {
  gym?: number
  status?: string
  position?: string
  page?: number
  pageSize?: number
}

export function getEvaluationForms(
  params: EvaluationFormListParams = {},
  signal?: AbortSignal,
): Promise<Paged<EvaluationForm>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.status) query.set('status', params.status)
  if (params.position) query.set('position', params.position)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<EvaluationForm>>(`/api/evaluation-forms${qs ? '?' + qs : ''}`, { signal })
}

interface Wrapped<T> {
  data: T
}

/** GET /api/evaluation-forms/{id} â€” the form with its question list. */
export function getEvaluationForm(id: number, signal?: AbortSignal): Promise<EvaluationForm> {
  return apiRequest<Wrapped<EvaluationForm>>(`/api/evaluation-forms/${id}`, { signal }).then((r) => r.data)
}

/** POST/PUT /api/evaluation-forms body (â‰¥ 1 question; choice questions â‰¥ 2 options). */
export interface UpsertEvaluationFormBody {
  name: string
  position?: string
  /** Branch name, "All" for every branch. */
  gym?: string
  /** Active | Completed | Inactive. */
  status?: string
  questionList: QuestionInput[]
}

export function postEvaluationForm(body: UpsertEvaluationFormBody, signal?: AbortSignal): Promise<EvaluationForm> {
  return apiRequest<Wrapped<EvaluationForm>>('/api/evaluation-forms', { method: 'POST', body, signal }).then(
    (r) => r.data,
  )
}

/** PUT replaces the whole question list. */
export function putEvaluationForm(
  id: number,
  body: UpsertEvaluationFormBody,
  signal?: AbortSignal,
): Promise<EvaluationForm> {
  return apiRequest<Wrapped<EvaluationForm>>(`/api/evaluation-forms/${id}`, { method: 'PUT', body, signal }).then(
    (r) => r.data,
  )
}

/** DELETE â€” 204; blocked with 400 once responses exist (set Inactive instead). */
export function deleteEvaluationForm(id: number, signal?: AbortSignal): Promise<void> {
  return apiRequest<void>(`/api/evaluation-forms/${id}`, { method: 'DELETE', signal })
}

/** One assignment routed by a dispatch. */
export interface DispatchAssignment {
  id: number
  formId: number
  formName: string
  evaluatorEmail: string
  evaluatorName: string
  subjects: string[]
  completedSubjects: string[]
  status: string
  dispatchedDate: string
  dispatchedBy: string
}

/** POST /api/evaluation-forms/{id}/dispatch â†’ routes the form to eligible evaluators. */
export interface DispatchResult {
  formId: number
  createdAssignments: DispatchAssignment[]
  routedEvaluators: number
  evaluationsAssigned: number
}

export function postEvaluationDispatch(id: number, signal?: AbortSignal): Promise<DispatchResult> {
  return apiRequest<Wrapped<DispatchResult>>(`/api/evaluation-forms/${id}/dispatch`, {
    method: 'POST',
    // Empty JSON body: the endpoint takes no parameters but expects a body.
    body: {},
    signal,
  }).then((r) => r.data)
}

/** POST /api/evaluation-forms/{id}/launch-cycle — seeds the cycle review rows. */
export interface LaunchCycleResult {
  batchId: number
  startedCount: number
  status: string
}

/** POST /api/evaluation-forms/{id}/launch-cycle body (exports check the In Progress status). */
export interface LaunchCycleBody {
  /** Review window label ("Q3 2026", "90-Day Probation", …). */
  period: string
}

export function postEvaluationLaunchCycle(id: number, body: LaunchCycleBody, signal?: AbortSignal): Promise<LaunchCycleResult> {
  return apiRequest<Wrapped<LaunchCycleResult>>(`/api/evaluation-forms/${id}/launch-cycle`, {
    method: 'POST',
    body,
    signal,
  }).then((r) => r.data)
}

/** One hiring form card (GET /api/hiring-forms). */
export interface HiringForm extends FormCard {
  /** Open | Closed. */
  status: string
  /** Received applications. */
  applicants: number
}

export interface HiringFormListParams {
  gym?: number
  status?: string
  position?: string
  page?: number
  pageSize?: number
}

export function getHiringForms(params: HiringFormListParams = {}, signal?: AbortSignal): Promise<Paged<HiringForm>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.status) query.set('status', params.status)
  if (params.position) query.set('position', params.position)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<HiringForm>>(`/api/hiring-forms${qs ? '?' + qs : ''}`, { signal })
}

/** GET /api/hiring-forms/{id}. */
export function getHiringForm(id: number, signal?: AbortSignal): Promise<HiringForm> {
  return apiRequest<Wrapped<HiringForm>>(`/api/hiring-forms/${id}`, { signal }).then((r) => r.data)
}

/** POST/PUT /api/hiring-forms body (same shape as evaluation forms). */
export interface UpsertHiringFormBody {
  name: string
  position?: string
  gym?: string
  /** Open (accepting submissions) | Closed. */
  status?: string
  questionList: QuestionInput[]
}

export function postHiringForm(body: UpsertHiringFormBody, signal?: AbortSignal): Promise<HiringForm> {
  return apiRequest<Wrapped<HiringForm>>('/api/hiring-forms', { method: 'POST', body, signal }).then((r) => r.data)
}

export function putHiringForm(id: number, body: UpsertHiringFormBody, signal?: AbortSignal): Promise<HiringForm> {
  return apiRequest<Wrapped<HiringForm>>(`/api/hiring-forms/${id}`, { method: 'PUT', body, signal }).then(
    (r) => r.data,
  )
}

/** DELETE â€” 204; blocked with 400 while applications exist (close it instead). */
export function deleteHiringForm(id: number, signal?: AbortSignal): Promise<void> {
  return apiRequest<void>(`/api/hiring-forms/${id}`, { method: 'DELETE', signal })
}

/** One stored answer of a submitted evaluation. */
export interface EvaluationAnswer {
  question: string
  type: string
  answer: string
}

/** One completed / in-progress evaluation (GET /api/evaluation-responses). */
export interface EvaluationResponseRow {
  id: number
  employee: string
  form: string
  formId: number
  period: string | null
  score: number | null
  /** Completed | In Progress. */
  status: string
  notes: string | null
  reviewedBy: string
  /** ISO timestamp. */
  reviewedDate: string
  answers: EvaluationAnswer[]
  gym: string
}

export interface EvaluationResponseListParams {
  gym?: number
  formId?: number
  period?: string
  status?: string
  page?: number
  pageSize?: number
}

export function getEvaluationResponses(
  params: EvaluationResponseListParams = {},
  signal?: AbortSignal,
): Promise<Paged<EvaluationResponseRow>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.formId != null) query.set('formId', String(params.formId))
  if (params.period) query.set('period', params.period)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<EvaluationResponseRow>>(`/api/evaluation-responses${qs ? '?' + qs : ''}`, { signal })
}
