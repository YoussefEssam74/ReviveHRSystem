import { apiRequest } from '../../../lib/api-client'

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Closed status vocabulary of the separation lifecycle (GET /api/separations). */
export const SEPARATION_STATUSES = ['Requested', 'Notice Period', 'Exit In Progress', 'Under Review', 'Completed'] as const

/** HR decision on a Branch-Manager termination request. */
export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

/** Exit interview lifecycle vocabulary. */
export const EXIT_INTERVIEW_STATUSES = ['Scheduled', 'Completed', 'No Show', 'Rescheduled'] as const
export type ExitInterviewStatus = (typeof EXIT_INTERVIEW_STATUSES)[number]

/** Closed reason vocabulary for a Termination case (POST /api/separations). */
export const TERMINATION_REASONS = [
  'Performance issues',
  'Attendance violations',
  'Misconduct / policy breach',
  'Contract expiry — not renewing',
  'Restructuring / redundancy',
] as const

/** Reason vocabulary offered by the HR-initiated offboarding dialog (E19). */
export const OFFBOARDING_REASONS = [
  'Resignation',
  'End of Contract',
  'Mutual Agreement',
  'Performance Termination',
  'Relocation / Personal',
] as const

/** The T5 verdict shape carried on a separation case. */
export interface SeparationVerdict {
  finalReason: string | null
  settlement: {
    direction: 'none' | 'owedToEmployee' | 'employeeOwes'
    amount: number | null
    note: string | null
    /** Pro-rated annual days earned in the exit calendar year. */
    leaveEarnedDaysThisYear: number
    /** Earned days never taken — the days paid out. */
    leaveEncashmentDays: number
    /** Base salary ÷ the exit month's calendar days. */
    leaveEncashmentDailyRate: number
    /** Encashment days × the daily rate (owed to the employee). */
    leaveEncashmentAmount: number
    /** Days taken beyond the earned balance, plus days settled unpaid. */
    unpaidLeaveDays: number
    /** Unpaid-leave days × the daily rate (owed by the employee). */
    unpaidLeaveAmount: number
  } | null
  rehire: {
    status: 'Eligible' | 'Banned'
    note: string | null
  } | null
}

/** One separation case — list item and detail share the same shape. */
export interface Separation {
  id: number
  employee: string
  employeeId: number
  employeeNumber: string | null
  position: string
  gym: string
  lastDay: string | null
  hireDate: string | null
  terminationDate: string | null
  reason: string | null
  notes: string | null
  /** Role label: HR Manager | Branch Manager | Top Management. */
  requestedBy: string | null
  /** Display name of the requesting user. */
  requestedByUser: string | null
  submittedDate: string | null
  status: string
  separationType: string
  /** Percent of the five-task exit checklist completed (0–100). */
  progress: number
  /** The five exit tasks as [label, done] pairs. */
  checklist: [string, boolean][]
  verdict: SeparationVerdict | null
  leaveTaken: number | null
  /** HR decision on a termination request: Pending | Approved | Rejected. */
  approvalStatus: string
  approvedBy: string | null
  approvedAt: string | null
  approvalNote: string | null
  /** Scheduled | Completed | No Show | Rescheduled (null = not scheduled). */
  exitInterviewStatus: string | null
  exitInterviewScheduledAt: string | null
  exitInterviewCompletedAt: string | null
  exitInterview: ExitInterviewDetails | null
  clearance: SeparationClearance | null
  blacklisted: boolean
  blacklistReason: string | null
}

/** The professional exit interview form saved by HR. */
export interface ExitInterviewDetails {
  interviewer: string | null
  interviewDate: string | null
  reasonForLeaving: string | null
  whatLikedMost: string | null
  whatToImprove: string | null
  jobSatisfaction: number | null
  managementRating: number | null
  workEnvironmentRating: number | null
  compensationRating: number | null
  wouldRecommend: boolean | null
  notes: string | null
  rehireEligible: boolean | null
  rehireNote: string | null
  /** Editable question set with the recorded answers (defaults when none saved). */
  questions: ExitInterviewQuestion[]
}

/** Answer control an exit-interview question renders. */
export type ExitInterviewQuestionKind = 'text' | 'select' | 'checkbox' | 'multi' | 'rating'

/** One exit-interview question; labels, kinds and options are editable by HR. */
export interface ExitInterviewQuestion {
  id: string
  label: string
  kind: ExitInterviewQuestionKind
  /** Answer choices for select/multi. */
  options: string[]
  /** text/select/rating/checkbox ("true"|"false")/multi ("A | B"). */
  answer: string | null
}

/** Clearance / final-settlement state of the exit. */
export interface SeparationClearance {
  uniformReturned: boolean
  assetsReturned: boolean
  accessRevoked: boolean
  finalSettlementCompleted: boolean
  completed: boolean
  completedAt: string | null
  notes: string | null
  settlementDirection: string | null
  settlementAmount: number | null
}

export interface SeparationListParams {
  gym?: number
  status?: string
  type?: string
  page?: number
  pageSize?: number
}

/** GET /api/separations — paged, gym-scoped separation cases. */
export function getSeparations(params: SeparationListParams = {}, signal?: AbortSignal): Promise<Paged<Separation>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.status) query.set('status', params.status)
  if (params.type) query.set('type', params.type)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<Separation>>(`/api/separations${qs ? '?' + qs : ''}`, { signal })
}

/** GET /api/separations/{id} — the case with its verdict (wrapped in { data }). */
export function getSeparation(id: number, signal?: AbortSignal): Promise<Separation> {
  return apiRequest<{ data: Separation }>(`/api/separations/${id}`, { signal }).then((r) => r.data)
}

export interface InitiateSeparationBody {
  employeeId: number
  /** yyyy-MM-dd. */
  lastDay: string
  /** One of the TERMINATION_REASONS entries (closed vocabulary). */
  reason: string
  notes?: string
}

/** POST /api/separations — T2, the Branch-Manager termination request (returns the new case). */
export function postSeparation(body: InitiateSeparationBody, signal?: AbortSignal): Promise<Separation> {
  return apiRequest<{ data: Separation }>('/api/separations', { method: 'POST', body, signal }).then((r) => r.data)
}

export interface ChecklistState {
  id: number
  progress: number
  status: string
  checklist: [string, boolean][]
}

/** PUT /api/separations/{id}/stage — T4, move the case along the five exit stages. */
export function putStage(id: number, status: string, signal?: AbortSignal): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/stage`, {
    method: 'PUT',
    body: { status },
    signal,
  }).then((r) => r.message)
}

/** PUT /api/separations/{id}/checklist — T3, tick/untick one exit task by index. */
export function putChecklist(id: number, index: number, done: boolean, signal?: AbortSignal): Promise<ChecklistState> {
  return apiRequest<{ data: ChecklistState }>(`/api/separations/${id}/checklist`, {
    method: 'PUT',
    body: { index, done },
    signal,
  }).then((r) => r.data)
}

export type SettlementDirection = 'none' | 'owedToEmployee' | 'employeeOwes'
export type RehireStatus = 'Eligible' | 'Banned'

export interface VerdictBody {
  finalReason: string
  settlement: {
    direction: SettlementDirection
    amount: number
    note?: string
    /** Optional HR override of the computed encashment (omitted = use the computed figure). */
    leaveEncashmentAmount?: number
    /** Optional HR override of the computed unpaid-leave debt. */
    unpaidLeaveAmount?: number
  }
  rehire: { status: RehireStatus; note?: string }
}

/** PUT /api/separations/{id}/verdict — T5, saves the exit verdict (moves the case to Under Review). */
export function putVerdict(id: number, body: VerdictBody, signal?: AbortSignal): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/verdict`, { method: 'PUT', body, signal }).then(
    (r) => r.message,
  )
}

/** Annual-leave encashment priced for one exit, computed but not saved. */
export interface LeaveEncashmentPreview {
  lastWorkingDay: string
  usedDays: number
  earnedDaysThisYear: number
  unusedDays: number
  deficitDays: number
  baseSalary: number
  dailyRate: number
  encashmentAmount: number
  debtAmount: number
  belowQualifyingPeriod: boolean
}

/** GET /api/separations/{id}/leave-encashment — preview shown before saving the verdict. */
export function getLeaveEncashment(id: number, signal?: AbortSignal): Promise<LeaveEncashmentPreview> {
  return apiRequest<{ data: LeaveEncashmentPreview }>(`/api/separations/${id}/leave-encashment`, { signal }).then(
    (r) => r.data,
  )
}

/** POST /api/separations/{id}/finalize — T6, archives the employee (checklist + verdict required server-side). */
export function postFinalize(id: number, signal?: AbortSignal): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/finalize`, { method: 'POST', signal }).then((r) => r.message)
}

/** One employee match used by the initiate dialog's picker (GET /api/employees rows). */
export interface EmployeeOption {
  id: number
  name: string
  position: string
  gym: string
}

export interface OffboardEmployeeBody {
  /** yyyy-MM-dd. */
  lastDay: string
  reason: string
  notes?: string
  /** Defaults server-side from the reason (Termination when it says so). */
  separationType?: 'Resignation' | 'Termination'
}

/** POST /api/employees/{id}/offboard — E19, HR-initiated offboarding (starts in Notice Period). */
export function postOffboardEmployee(
  employeeId: number,
  body: OffboardEmployeeBody,
  signal?: AbortSignal,
): Promise<number> {
  return apiRequest<{ data: { separationId: number } }>(`/api/employees/${employeeId}/offboard`, {
    method: 'POST',
    body,
    signal,
  }).then((r) => r.data.separationId)
}

/** Employee directory search feeding the "new separation" employee picker. */
export function getEmployeeOptions(search: string, signal?: AbortSignal): Promise<Paged<EmployeeOption>> {
  const query = new URLSearchParams()
  query.set('search', search)
  query.set('pageSize', '8')
  return apiRequest<Paged<EmployeeOption>>(`/api/employees?${query.toString()}`, { signal })
}

// ---------------------------------------------------------------------------
// Termination workflow — HR approval → exit interview → clearance
// ---------------------------------------------------------------------------

export interface ApprovalBody {
  decision: 'Approved' | 'Rejected'
  note?: string
}

/** PUT /api/separations/{id}/approval — HR approves or rejects a termination request. */
export function putApproval(id: number, body: ApprovalBody, signal?: AbortSignal): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/approval`, {
    method: 'PUT',
    body,
    signal,
  }).then((r) => r.message)
}

/** PUT /api/separations/{id}/exit-interview/schedule — books the interview slot. */
export function putExitInterviewSchedule(
  id: number,
  scheduledAt: string,
  signal?: AbortSignal,
): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/exit-interview/schedule`, {
    method: 'PUT',
    body: { scheduledAt },
    signal,
  }).then((r) => r.message)
}

export interface ExitInterviewStatusBody {
  status: ExitInterviewStatus
  rescheduledAt?: string
  note?: string
}

/** PUT /api/separations/{id}/exit-interview/status — Completed | No Show | Rescheduled. */
export function putExitInterviewStatus(
  id: number,
  body: ExitInterviewStatusBody,
  signal?: AbortSignal,
): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/exit-interview/status`, {
    method: 'PUT',
    body,
    signal,
  }).then((r) => r.message)
}

export interface ExitInterviewFormBody {
  interviewer?: string
  /** yyyy-MM-dd. */
  interviewDate?: string
  reasonForLeaving?: string
  whatLikedMost?: string
  whatToImprove?: string
  jobSatisfaction?: number
  managementRating?: number
  workEnvironmentRating?: number
  compensationRating?: number
  wouldRecommend?: boolean
  notes?: string
  rehireEligible?: boolean
  rehireNote?: string
  blacklisted: boolean
  blacklistReason?: string
  /** Marks the interview Completed when true. */
  complete: boolean
  /** Editable question set; answers sync back to the legacy fields on the server. */
  questions?: ExitInterviewQuestion[]
}

/** PUT /api/separations/{id}/exit-interview — saves the professional exit interview form. */
export function putExitInterview(
  id: number,
  body: ExitInterviewFormBody,
  signal?: AbortSignal,
): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/exit-interview`, {
    method: 'PUT',
    body,
    signal,
  }).then((r) => r.message)
}

export interface ClearanceBody {
  uniformReturned: boolean
  assetsReturned: boolean
  accessRevoked: boolean
  finalSettlementCompleted: boolean
  settlementDirection?: SettlementDirection
  settlementAmount?: number
  notes?: string
  /** Completes clearance; the employee moves to Former Employees when the interview is done. */
  complete: boolean
}

/** PUT /api/separations/{id}/clearance — saves clearance and final settlement. */
export function putClearance(id: number, body: ClearanceBody, signal?: AbortSignal): Promise<string> {
  return apiRequest<{ message: string }>(`/api/separations/${id}/clearance`, {
    method: 'PUT',
    body,
    signal,
  }).then((r) => r.message)
}
