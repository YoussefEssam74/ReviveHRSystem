import { apiRequest } from '../../../lib/api-client'
import { withQuery, type PagedCountResult } from '../../../lib/paged'

/**
 * Branch-manager surfaces (mock §20/§11/§21/§23/§24 — Employees directory,
 * Attendance Management, Branch Actions palette, Recruitment requisitions and
 * Employee Leaving). Server scopes every read/wrote to the acting caller: a
 * Branch Manager sees his gym, a Team Leader his led team; permission keys are
 * enforced per endpoint and surfaced through the /api/auth/me key bundle.
 */

/* ==================== Employees directory (mock §11) ==================== */

/**
 * One directory row (`EmployeeListItem`): identity + employment snapshot. The
 * server answers `GET /api/employees` inside employees.view; status values are
 * EmployeeStatus names ("Active", "OnLeave", "Suspended", "Terminated").
 */
export interface EmployeeDirectoryRow {
  id: number
  employeeNumber: string
  name: string
  position: string
  level: string
  gymId: number
  gym: string
  status: string
  initials: string
  /** DateOnly "yyyy-MM-dd" or null when unknown. */
  hireDate: string | null
  salary: number | null
  phone: string | null
  email: string
}

export interface EmployeeDirectoryParams {
  search?: string
  status?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: string
  gym?: number
  signal?: AbortSignal
}

export function getEmployeeDirectory({
  signal,
  ...params
}: EmployeeDirectoryParams): Promise<PagedCountResult<EmployeeDirectoryRow>> {
  return apiRequest<PagedCountResult<EmployeeDirectoryRow>>(withQuery('/api/employees', params), { signal })
}

/**
 * POST /api/employees — onboards a new employee (account + profile). `gym` is
 * the id of the receiving gym (the branch manager sends the active gym).
 */
export function createDirectoryEmployee(fields: {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  position: string
  level: string
  salary: number | null
  gym: number
  startDate: string
}): Promise<{ data: EmployeeDirectoryRow }> {
  return apiRequest<{ data: EmployeeDirectoryRow }>('/api/employees', { method: 'POST', body: fields })
}

/** PUT /api/employees/{id} — the edit modal (name, position, status). */
export function updateDirectoryEmployee(
  employeeId: number,
  fields: { name?: string | null; position?: string | null; status?: string | null },
): Promise<{ data: EmployeeDirectoryRow }> {
  return apiRequest<{ data: EmployeeDirectoryRow }>(`/api/employees/${employeeId}`, { method: 'PUT', body: fields })
}

/**
 * POST /api/employees/{id}/status-change — reactivates / leaves / suspends /
 * terminates. The server parses EmployeeStatus ("Active", "OnLeave",
 * "Suspended", "Terminated") case-insensitively and writes a history event.
 */
export function changeMemberStatus(
  employeeId: number,
  fields: { status: string; note: string | null },
): Promise<{ data: { id: number; status: string } }> {
  return apiRequest(`/api/employees/${employeeId}/status-change`, { method: 'POST', body: fields })
}

/* ==================== Attendance management (mock §13/A1) ==================== */

/**
 * One attendance grid row (`AttendanceListItem`). `id` is null for synthesized
 * roster rows (Off/Scheduled/Absent days with no stored record); checkIn/out
 * are "HH:mm" display strings; status is the display value ("On Time", "Late",
 * "Absent", "Early Checkout", "Missing Checkout", "Off", "Scheduled").
 */
export interface AttendanceGridRow {
  id: number | null
  employeeId: number
  name: string
  gym: string
  date: string
  shift: string
  checkIn: string | null
  checkOut: string | null
  status: string
  source: string
  notes: string | null
  correctedBy: string | null
  correctedAt: string | null
}

export interface AttendanceGridParams {
  /** Single day "yyyy-MM-dd" (preferred) or a From/To range. */
  date?: string
  from?: string | null
  to?: string | null
  employeeId?: number
  /** Display status tab: "On Time" | "Late" | "Absent" | "Early Checkout" | "Off" | "Scheduled". */
  status?: string
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

/** GET /api/attendance — composed rows for the range, scoped to the caller. */
export function getAttendanceGrid({
  signal,
  ...params
}: AttendanceGridParams): Promise<{
  items: AttendanceGridRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}> {
  return apiRequest(withQuery('/api/attendance', params), { signal })
}

/* ==================== Branch Actions (mock §20) ==================== */

/** One branch-raised deduction candidate (attendance feature). */
export interface DeductionCandidateRow {
  id: number
  employeeId: number
  employee: string
  amount: number
  reason: string
  note: string | null
  status: string
  /** UTC ISO timestamp. */
  issuedAt: string
  issuedBy: string
}

/** One branch-raised warning notice (employees feature). */
export interface WarningNoticeRow {
  id: number
  employeeId: number
  employee: string
  type: string
  reason: string
  note: string | null
  status: string
  issuedAt: string
  issuedBy: string
}

/** One branch-raised bonus proposal (employees feature). */
export interface BonusProposalRow {
  id: number
  employeeId: number
  employee: string
  type: string
  amount: number
  reason: string
  note: string | null
  status: string
  issuedAt: string
  issuedBy: string
}

export function issueDeduction(fields: {
  employeeId: number
  amount: number
  reason: string
  note: string | null
}): Promise<DeductionCandidateRow> {
  return apiRequest<DeductionCandidateRow>('/api/deduction-candidates', { method: 'POST', body: fields })
}

export function issueWarning(fields: {
  employeeId: number
  type: string
  reason: string
  note: string | null
}): Promise<WarningNoticeRow> {
  return apiRequest<WarningNoticeRow>('/api/warning-notices', { method: 'POST', body: fields })
}

export function proposeBonus(fields: {
  employeeId: number
  type: string
  amount: number
  reason: string
  note: string | null
}): Promise<BonusProposalRow> {
  return apiRequest<BonusProposalRow>('/api/bonus-proposals', { method: 'POST', body: fields })
}

/** POST /api/branch-reports — free-form report; the server answers 204. */
export function sendBranchReport(fields: { period: string; type: string; message: string }): Promise<void> {
  return apiRequest<void>('/api/branch-reports', { method: 'POST', body: fields })
}

/** GET /api/branch-actions/pending-hr — everything still pending with HR. */
export interface BranchQueueItem {
  id: number
  kind: string
  employee: string
  detail: string
  /** DateTime raised. */
  date: string
  /** Server value: "Pending HR". */
  status: string
}

export function getPendingHrQueue(signal?: AbortSignal): Promise<BranchQueueItem[]> {
  return apiRequest<BranchQueueItem[]>('/api/branch-actions/pending-hr', { signal })
}

/** GET /api/deduction-candidates/branch?employeeId= — scope-wide, newest first. */
export function listBranchDeductions(employeeId?: number, signal?: AbortSignal): Promise<DeductionCandidateRow[]> {
  const path = withQuery('/api/deduction-candidates/branch', employeeId ? { employeeId } : {})
  return apiRequest<DeductionCandidateRow[]>(path, { signal })
}

/** GET /api/warning-notices?employeeId= — scope-wide, newest first. */
export function listWarningNotices(employeeId?: number, signal?: AbortSignal): Promise<WarningNoticeRow[]> {
  const path = withQuery('/api/warning-notices', employeeId ? { employeeId } : {})
  return apiRequest<WarningNoticeRow[]>(path, { signal })
}

/** GET /api/bonus-proposals?employeeId= — scope-wide, newest first. */
export function listBonusProposals(employeeId?: number, signal?: AbortSignal): Promise<BonusProposalRow[]> {
  const path = withQuery('/api/bonus-proposals', employeeId ? { employeeId } : {})
  return apiRequest<BonusProposalRow[]>(path, { signal })
}

/* ==================== Recruitment: vacancy requests (mock §23) ==================== */
/** One requisition card (`VacancyRequestItem`). */
export interface VacancyRequestRow {
  id: number
  positionId: number | null
  position: string
  gymId: number | null
  gym: string
  urgency: string | null
  status: string
  submittedBy: string | null
  submittedDate: string
  reason: string
  salary: number | null
  shift: string | null
  headcount: number
  decidedBy: string | null
  /** Vacancy created by an approval (null until approved). */
  vacancyId: number | null
}

export interface VacancyRequestParams {
  status?: string
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

/** GET /api/vacancy-requests — paged queue, filterable by status tab. */
export function getVacancyRequests({ signal, ...params }: VacancyRequestParams): Promise<{
  items: VacancyRequestRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}> {
  return apiRequest(withQuery('/api/vacancy-requests', params), { signal })
}

/**
 * POST /api/vacancy-requests — submit a headcount requisition for the caller's
 * own gym (`gymId` omitted = the active gym is assumed server-side).
 */
export function createVacancyRequest(fields: {
  position: string
  urgency: string
  reason: string
  salary?: number | null
  shift?: string | null
  headcount: number
}): Promise<{ data: VacancyRequestRow }> {
  return apiRequest<{ data: VacancyRequestRow }>('/api/vacancy-requests', { method: 'POST', body: fields })
}

/**
 * PUT /api/vacancy-requests/{id}/decide — approve (creates the vacancy) or
 * reject. Guarded by `recruitment.vacancy_request.approve`, which no seeded
 * Branch Manager holds — the UI only offers this to key-holders (Super Admin).
 */
export function decideVacancyRequest(
  id: number,
  fields: { decision: string; comment?: string | null },
): Promise<{ data: VacancyRequestRow }> {
  return apiRequest<{ data: VacancyRequestRow }>(`/api/vacancy-requests/${id}/decide`, {
    method: 'PUT',
    body: fields,
  })
}

/** PUT /api/vacancy-requests/{id}/reopen — back to Pending (`…approve` key). */
export function reopenVacancyRequest(id: number): Promise<{
  id: number
  status: string
  decidedBy: string | null
  vacancyWithdrawn: boolean
}> {
  return apiRequest(`/api/vacancy-requests/${id}/reopen`, { method: 'PUT' })
}

/* ==================== Employee Leaving (mock §24) ==================== */

/** One offboarding case (`OffboardingCaseDto`). */
export interface OffboardingCaseRow {
  id: number
  employeeId: number
  employee: string
  position: string
  /** DateOnly "yyyy-MM-dd". */
  lastWorkingDate: string
  status: string
  reason: string
}

export interface OffboardingParams {
  status?: string
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

/** GET /api/offboarding-requests — paged leaving cases (employees.offboard). */
export function getOffboardingCases({ signal, ...params }: OffboardingParams): Promise<PagedCountResult<OffboardingCaseRow>> {
  return apiRequest<PagedCountResult<OffboardingCaseRow>>(withQuery('/api/offboarding-requests', params), { signal })
}

/** POST /api/offboarding-requests — initiate a leaving process. */
export function initiateOffboarding(fields: {
  employeeId: number
  lastWorkingDate: string
  reason: string
}): Promise<OffboardingCaseRow> {
  return apiRequest<OffboardingCaseRow>('/api/offboarding-requests', { method: 'POST', body: fields })
}

/** PUT /api/offboarding-requests/{id}/last-day — move an in-flight case's last working day. */
export function updateOffboardingLastDay(caseId: number, lastWorkingDate: string): Promise<OffboardingCaseRow> {
  return apiRequest<OffboardingCaseRow>(`/api/offboarding-requests/${caseId}/last-day`, {
    method: 'PUT',
    body: { lastWorkingDate },
  })
}

/** POST /api/offboarding-requests/{id}/close — close an in-flight case; the person stays employed. */
export function closeOffboardingCase(caseId: number): Promise<OffboardingCaseRow> {
  return apiRequest<OffboardingCaseRow>(`/api/offboarding-requests/${caseId}/close`, { method: 'POST' })
}
