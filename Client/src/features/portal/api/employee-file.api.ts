import { apiDownload, apiRequest } from '../../../lib/api-client'
import { withQuery } from '../../../lib/paged'

/**
 * Employee-file self-service (mock §§2/3/4/9):
 *  - profile     GET   /api/employees/{id}                                → { data: EmployeeProfile }
 *  - contact     PUT   /api/employees/{id}/contact                        → EmployeeProfile
 *  - emergency   PATCH /api/employees/{id}/emergency-contact              → EmployeeProfile
 *  - photo       GET/PUT /api/employees/{id}/photo (multipart `file`)     → binary / { photoUrl }
 *  - documents   GET   /api/employees/{id}/documents                      → EmployeeDocument[]
 *  - upload      POST  /api/employees/{id}/documents (multipart)          → EmployeeDocument
 *  - download    GET   /api/employees/{id}/documents/{docId}/download     → binary
 *  - hr-docs     GET   /api/employees/{id}/hr-documents[/{docId}/download]
 *  - required    GET   /api/employees/{id}/required-documents             → RequiredDocument[]
 *  - history     GET   /api/employees/{id}/history                        → EmployeeHistoryItem[]
 *  - evaluations GET   /api/employees/{id}/evaluations                    → { items: EmployeeEvaluation[] }
 */

export interface GymSummary {
  id: number
  name: string
  branch: string | null
}

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

export interface EmployeeProfile {
  id: number
  fullName: string
  position: string
  status: string
  employmentType: string
  /** DateOnly "yyyy-MM-dd" or null. */
  hireDate: string | null
  dateOfBirth: string | null
  nationalId: string | null
  gender: string | null
  address: string | null
  phone: string | null
  email: string
  gym: GymSummary
  emergencyContact: EmergencyContact
  photoUrl: string | null
  /** HR-controlled salary — only ever populated on the employee's own profile. */
  baseSalary: number | null
}

export interface EmployeeProfileResponse {
  data: EmployeeProfile
}

export interface EmployeeDocument {
  id: number
  name: string
  category: string
  status: string
  /** DateOnly "yyyy-MM-dd". */
  uploadDate: string
  expiryDate: string | null
}

export interface RequiredDocument {
  key: string
  label: string
  /** Set once the employee has uploaded a document for this requirement. */
  documentId: number | null
}

export interface HrDocument {
  id: number
  name: string
  category: string
  /** DateOnly "yyyy-MM-dd". */
  addedDate: string
  /** "PDF · 2.1 MB" display column. */
  size: string
  sizeBytes: number | null
}

export interface EmployeeHistoryItem {
  type: string
  from: string | null
  to: string | null
  /** DateOnly "yyyy-MM-dd". */
  date: string
  detail: string | null
}

export interface EmployeeEvaluation {
  id: number
  employee: string
  position: string
  period: string | null
  score: number | null
  /** "Pass" | "Below Target" (≥60 passes). */
  result: string
  /** Completed | In Progress. */
  status: string
  gym: string
  form: string
  formId: number
}

export interface EmployeeEvaluationResponse {
  items: EmployeeEvaluation[]
}

export function getOwnProfile(employeeId: number, signal?: AbortSignal): Promise<EmployeeProfile> {
  return apiRequest<EmployeeProfileResponse>(`/api/employees/${employeeId}`, { signal }).then((body) => body.data)
}

export function updateContact(
  employeeId: number,
  fields: { phone: string | null; address: string | null },
): Promise<EmployeeProfile> {
  return apiRequest<EmployeeProfile>(`/api/employees/${employeeId}/contact`, { method: 'PUT', body: fields })
}

export function updateEmergencyContact(
  employeeId: number,
  fields: { name: string; relationship: string; phone: string },
): Promise<EmployeeProfile> {
  return apiRequest<EmployeeProfile>(`/api/employees/${employeeId}/emergency-contact`, { method: 'PATCH', body: fields })
}

/** PUT multipart avatar upload → { photoUrl } pointing at GET /api/employees/{id}/photo. */
export function uploadProfilePhoto(employeeId: number, file: File): Promise<{ photoUrl: string }> {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<{ photoUrl: string }>(`/api/employees/${employeeId}/photo`, { method: 'PUT', form })
}

/** Streams the avatar itself (photoUrl = /api/employees/{id}/photo). */
export function downloadProfilePhoto(employeeId: number, signal?: AbortSignal) {
  return apiDownload(`/api/employees/${employeeId}/photo`, signal)
}

export function getOwnDocuments(employeeId: number, signal?: AbortSignal): Promise<EmployeeDocument[]> {
  return apiRequest<EmployeeDocument[]>(`/api/employees/${employeeId}/documents`, { signal })
}

/** POST multipart — the required-documents upload (category + optional expiryDate + file). */
export function uploadDocument(
  employeeId: number,
  fields: { category: string; expiryDate: string | null; file: File },
): Promise<EmployeeDocument> {
  const form = new FormData()
  form.append('category', fields.category)
  if (fields.expiryDate) form.append('expiryDate', fields.expiryDate)
  form.append('file', fields.file)
  return apiRequest<EmployeeDocument>(`/api/employees/${employeeId}/documents`, { method: 'POST', form })
}

export function downloadDocument(employeeId: number, documentId: number, signal?: AbortSignal) {
  return apiDownload(`/api/employees/${employeeId}/documents/${documentId}/download`, signal)
}

export function getHrDocuments(employeeId: number, signal?: AbortSignal): Promise<HrDocument[]> {
  return apiRequest<HrDocument[]>(`/api/employees/${employeeId}/hr-documents`, { signal })
}

export function downloadHrDocument(employeeId: number, documentId: number, signal?: AbortSignal) {
  return apiDownload(`/api/employees/${employeeId}/hr-documents/${documentId}/download`, signal)
}

export function getRequiredDocuments(employeeId: number, signal?: AbortSignal): Promise<RequiredDocument[]> {
  return apiRequest<RequiredDocument[]>(`/api/employees/${employeeId}/required-documents`, { signal })
}

export function getOwnHistory(employeeId: number, signal?: AbortSignal): Promise<EmployeeHistoryItem[]> {
  return apiRequest<EmployeeHistoryItem[]>(`/api/employees/${employeeId}/history`, { signal })
}

export function getOwnEvaluations(employeeId: number, signal?: AbortSignal): Promise<EmployeeEvaluation[]> {
  return apiRequest<EmployeeEvaluationResponse>(`/api/employees/${employeeId}/evaluations`, { signal }).then(
    (body) => body.items,
  )
}

/* ==================== Org-wide evaluation history (mock §25 perf drill-in) ==================== */

/** One row of GET /api/evaluation-responses (`EvaluationResponseItem`). */
export interface EvaluationResponseHistoryItem {
  id: number
  employee: string
  form: string
  formId: number
  period: string | null
  score: number | null
  /** Completed | In Progress. */
  status: string
  notes: string | null
  reviewer: string
  /** ISO timestamp. */
  reviewedDate: string
  gym: string
}

export interface EvaluationResponseHistoryList {
  items: EvaluationResponseHistoryItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Gym-scoped submitted evaluations (evaluations.view) — performance pages. */
export function getEvaluationResponses(
  {
    signal,
    ...params
  }: {
    employeeId?: number
    period?: string
    status?: string
    gym?: number
    page?: number
    pageSize?: number
    signal?: AbortSignal
  },
): Promise<EvaluationResponseHistoryList> {
  return apiRequest<EvaluationResponseHistoryList>(withQuery('/api/evaluation-responses', params), { signal })
}

/* ==================== Rich evaluation details (portal, mock §9) ==================== */

export interface EvaluationCriterion {
  name: string
  score: number
  comment: string | null
}

/** One submitted evaluation with its per-criterion answers (max = 5 points). */
export interface EvaluationDetail {
  id: number
  period: string
  score: number
  maxScore: number
  status: string
  /** DateOnly "yyyy-MM-dd". */
  date: string
  reviewer: string
  criteria: EvaluationCriterion[]
  overallComment: string | null
}

export function getOwnEvaluationDetails(employeeId: number, signal?: AbortSignal): Promise<EvaluationDetail[]> {
  return apiRequest<EvaluationDetail[]>(`/api/employees/${employeeId}/evaluations/detail`, { signal })
}
