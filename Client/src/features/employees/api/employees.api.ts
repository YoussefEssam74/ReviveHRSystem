import { apiDownload, apiRequest } from '../../../lib/api-client'
import { getEmployeeRequestRows, type EmployeeRequestRow } from '../../requests/api/requests.api'
import type { PayrollEntry } from '../../payroll/api/payroll.api'

/** One row of the paged employee directory (GET /api/employees). */
export interface EmployeeListItem {
  id: number
  employeeNumber: string
  name: string
  position: string
  level: string | null
  gymId: number
  gym: string
  status: string
  initials: string
  hireDate: string | null
  salary: number | null
  phone: string | null
  email: string | null
}

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface EmployeeListParams {
  gym?: number
  search?: string
  status?: string
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'hireDate' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export function getEmployees(params: EmployeeListParams = {}, signal?: AbortSignal): Promise<Paged<EmployeeListItem>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  const qs = query.toString()
  return apiRequest<Paged<EmployeeListItem>>(`/api/employees${qs ? '?' + qs : ''}`, { signal })
}

/** Employee profile (GET /api/employees/{id}, wrapped in { data }). */
export interface EmployeeProfile {
  id: number
  employeeNumber: string
  name: string
  position: string
  level: string | null
  gymId: number
  gym: string
  status: string
  initials: string
  hireDate: string | null
  email: string | null
  phone: string | null
  salary: number | null
  systemRole: string | null
  branches: { id: number; name: string; branch: string | null }[]
  dateOfBirth: string | null
  gender: string | null
  nationalId: string | null
  employmentType: string | null
  /** Avatar URL (/api/employees/{id}/photo), or null for the initials placeholder. */
  photoUrl: string | null
  excusedHoursPerMonth: number | null
}

interface Wrapped<T> {
  data: T
}

export function getEmployee(id: number, signal?: AbortSignal): Promise<EmployeeProfile> {
  return apiRequest<Wrapped<EmployeeProfile>>(`/api/employees/${id}`, { signal }).then((r) => r.data)
}

export interface StatusChangeBody {
  status: 'Active' | 'On Leave' | 'Suspended' | 'Terminated'
  note?: string
}

/** POST /api/employees/{id}/status-change — returns the updated profile (wrapped). */
export function postStatusChange(id: number, body: StatusChangeBody, signal?: AbortSignal): Promise<EmployeeProfile> {
  return apiRequest<Wrapped<EmployeeProfile>>(`/api/employees/${id}/status-change`, { method: 'POST', body, signal }).then(
    (r) => r.data,
  )
}

// ---------------------------------------------------------------------------
// Lifecycle actions used by the dashboard fast actions + decision cards.
// ---------------------------------------------------------------------------

/** POST /api/employees body — one home gym (id), auto-generated employee code. */
export interface CreateEmployeeBody {
  firstName: string
  lastName: string
  email: string
  phone?: string
  position: string
  level: string
  salary?: number
  /** Home gym id. */
  gym: number
  /** Contract start date ("YYYY-MM-DD"). */
  startDate: string
  /** Initial login password; omitted keeps the server's temporary password. */
  password?: string
  /** "YYYY-MM-DD". */
  dateOfBirth?: string
  gender?: string
  nationalId?: string
  /** FullTime | PartTime. */
  employmentType?: string
  /** Annual days granted for the hiring year (the accrual still caps it). */
  annualLeaveDays?: number
  sickLeaveDays?: number
  /** Employee-specific monthly excused-hours cap; omitted follows the gym policy. */
  excusedHoursPerMonth?: number
}

/** The create response echoes the saved profile (wrapped). */
export function postCreateEmployee(body: CreateEmployeeBody, signal?: AbortSignal): Promise<EmployeeProfile> {
  return apiRequest<Wrapped<EmployeeProfile>>(`/api/employees`, { method: 'POST', body, signal }).then((r) => r.data)
}

/**
 * The numbers the Create Account form starts from
 * (GET /api/employees/leave-defaults). Annual days are earned from the hire date;
 * the excused-hours cap is the selected branch's attendance policy.
 */
export interface LeaveDefaults {
  annualLeaveDays: number
  annualLeaveMaxDays: number
  sickLeaveDays: number
  excusedHoursPerMonth: number
}

export function getLeaveDefaults(gymId: number, hireDate?: string, signal?: AbortSignal): Promise<LeaveDefaults> {
  const query = new URLSearchParams({ gymId: String(gymId) })
  if (hireDate) query.set('hireDate', hireDate)
  return apiRequest<LeaveDefaults>(`/api/employees/leave-defaults?${query.toString()}`, { signal })
}

/** PUT multipart avatar upload → { photoUrl } pointing at GET /api/employees/{id}/photo. */
export function uploadEmployeePhoto(employeeId: number, file: File): Promise<{ photoUrl: string }> {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<{ photoUrl: string }>(`/api/employees/${employeeId}/photo`, { method: 'PUT', form })
}

/** POST /api/employees/{id}/contract — level and/or salary change with an effective date. */
export interface ContractChangeBody {
  level?: string
  salary?: number
  effectiveDate?: string
}

export function postContractChange(id: number, body: ContractChangeBody, signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/employees/${id}/contract`, { method: 'POST', body, signal })
}

/** POST /api/employees/{id}/role-change — sets the system role (None (Employee) | Team Leader | Branch Manager | …). */
export interface RoleChangeBody {
  systemRole?: string
  permissions?: string[]
}

export function postRoleChange(id: number, body: RoleChangeBody, signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/employees/${id}/role-change`, { method: 'POST', body, signal })
}

/** POST /api/employees/{id}/transfer — moves the employee to another gym. */
export interface TransferBody {
  /** Destination gym id (must differ from the current home gym). */
  toGym: number
  /** DateOnly "yyyy-MM-dd". */
  effectiveDate: string
  reason: string
}

export function postTransfer(id: number, body: TransferBody, signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/employees/${id}/transfer`, { method: 'POST', body, signal })
}

/** POST /api/employees/{id}/position-change — new position/level in the same gym. */
export interface PositionChangeBody {
  /** Omitted keeps the employee's current title. */
  position?: string
  level: string
}

export function postPositionChange(
  id: number,
  body: PositionChangeBody,
  signal?: AbortSignal,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/employees/${id}/position-change`, { method: 'POST', body, signal })
}

/** POST /api/employees/{id}/compensation — records a salary change. */
export interface CompensationBody {
  salary: number
  /** DateOnly "yyyy-MM-dd". */
  effectiveDate: string
}

export function postCompensation(id: number, body: CompensationBody, signal?: AbortSignal): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/employees/${id}/compensation`, { method: 'POST', body, signal })
}

// ---------------------------------------------------------------------------
// Employee file tabs — the HR console's /console/employees/:id sections.
// ---------------------------------------------------------------------------

/** One row of the employee's document vault (GET /api/employees/{id}/documents). */
export interface EmployeeDocumentItem {
  id: number
  name: string
  category: string
  /** Valid | Expiring Soon (expires within 30 days, or already expired). */
  status: string
  /** DateOnly "yyyy-MM-dd". */
  uploadDate: string
  expiryDate: string | null
}

/** POST body for the multipart document upload. */
export interface EmployeeDocumentUploadBody {
  file: File
  category?: string
  /** DateOnly "yyyy-MM-dd". */
  expiryDate?: string | null
}

/** Document vault (employees.documents.view; the employee also reads their own). */
export function getEmployeeDocuments(id: number, signal?: AbortSignal): Promise<EmployeeDocumentItem[]> {
  return apiRequest<EmployeeDocumentItem[]>(`/api/employees/${id}/documents`, { signal })
}

/** Upload into the vault (employees.documents.manage, or the employee's own file). */
export function uploadEmployeeDocument(id: number, body: EmployeeDocumentUploadBody): Promise<EmployeeDocumentItem> {
  const form = new FormData()
  if (body.category) form.append('category', body.category)
  if (body.expiryDate) form.append('expiryDate', body.expiryDate)
  form.append('file', body.file)
  return apiRequest<EmployeeDocumentItem>(`/api/employees/${id}/documents`, { method: 'POST', form })
}

/** Streams one stored document straight into a browser download. */
export async function downloadEmployeeDocument(id: number, documentId: number, fileName: string): Promise<void> {
  const { blob } = await apiDownload(`/api/employees/${id}/documents/${documentId}/download`)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** One career-timeline row (GET /api/employees/{id}/history). */
export interface EmployeeHistoryItem {
  type: string
  from: string | null
  to: string | null
  /** DateOnly "yyyy-MM-dd". */
  date: string
  detail: string | null
}

export function getEmployeeHistory(id: number, signal?: AbortSignal): Promise<EmployeeHistoryItem[]> {
  return apiRequest<EmployeeHistoryItem[]>(`/api/employees/${id}/history`, { signal })
}

/** One published schedule day (GET /api/employees/{id}/schedule). */
export interface EmployeeScheduleDay {
  date: string
  dayName: string
  cycleId: number
  /** Shift template id, or null for an explicit Off day. */
  shiftTemplateId: number | null
  shiftName: string | null
  /** TimeOnly "HH:mm:ss". */
  start: string | null
  end: string | null
  isOff: boolean
  isToday: boolean
}

export interface EmployeeScheduleCycle {
  id: number
  start: string
  end: string
  status: string
}

export interface EmployeeScheduleResponse {
  month: string
  cycles: EmployeeScheduleCycle[]
  days: EmployeeScheduleDay[]
}

/** Published schedule days for a range (schedule.view); `from`/`to` are inclusive. */
export function getEmployeeSchedule(
  id: number,
  query: { from?: string; to?: string; month?: string } = {},
  signal?: AbortSignal,
): Promise<EmployeeScheduleResponse> {
  const params = new URLSearchParams()
  if (query.month) params.set('month', query.month)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  const qs = params.toString()
  return apiRequest<EmployeeScheduleResponse>(`/api/employees/${id}/schedule${qs ? '?' + qs : ''}`, { signal })
}

/** One day of the employee's attendance history (GET /api/employees/{id}/attendance). */
export interface EmployeeAttendanceItem {
  /** DateOnly "yyyy-MM-dd". */
  date: string
  shift: string
  checkIn: string | null
  checkOut: string | null
  status: string
  notes: string | null
  /** Approved cover/extra days for an unscheduled punch (1 or 2), else null. */
  coverDays: number | null
  isCoverDay: boolean
}

/** Month totals the Attendance tab prints above the day list. */
export interface EmployeeAttendanceTotals {
  total: number
  present: number
  late: number
  early: number
  absent: number
  off: number
  hours: number
  expected: number
  coverDays: number
  daysWorked: number
  extraShiftDays: number
}

export interface EmployeeAttendanceResponse extends Paged<EmployeeAttendanceItem> {
  totals: EmployeeAttendanceTotals
}

/** One month ('yyyy-MM') of attendance (attendance.view). */
export function getEmployeeAttendance(id: number, month: string, signal?: AbortSignal): Promise<EmployeeAttendanceResponse> {
  const query = new URLSearchParams()
  if (month) query.set('month', month)
  const qs = query.toString()
  return apiRequest<EmployeeAttendanceResponse>(`/api/employees/${id}/attendance${qs ? '?' + qs : ''}`, { signal })
}

/** One leave category's balance: days used and the annual entitlement. */
export interface LeaveBalanceBucket {
  used: number
  total: number
}

/** Current-year leave balances (GET /api/employees/{id}/leave-balance). */
export interface LeaveBalanceResponse {
  employeeId: number
  /** The Annual leave type. */
  dayOff: LeaveBalanceBucket
  sick: LeaveBalanceBucket
  unpaid: LeaveBalanceBucket
}

export function getEmployeeLeaveBalance(id: number, signal?: AbortSignal): Promise<LeaveBalanceResponse> {
  return apiRequest<LeaveBalanceResponse>(`/api/employees/${id}/leave-balance`, { signal })
}

/** The employee's request conversation, whatever the status (requests.view). */
export function getEmployeeRequests(id: number, signal?: AbortSignal): Promise<EmployeeRequestRow[]> {
  return getEmployeeRequestRows(id, signal)
}

/** One evaluation row of the employee's Evaluations tab. */
export interface EmployeeEvaluationItem {
  id: number
  employee: string
  position: string
  period: string | null
  score: number | null
  /** Pass | Below Target (≥ 60 passes). */
  result: string
  /** Completed | In Progress. */
  status: string
  gym: string
  form: string
  formId: number
}

export interface EmployeeEvaluationResponse {
  items: EmployeeEvaluationItem[]
}

/** Evaluations recorded against the employee (evaluations.view). */
export function getEmployeeEvaluations(id: number, signal?: AbortSignal): Promise<EmployeeEvaluationResponse> {
  return apiRequest<EmployeeEvaluationResponse>(`/api/employees/${id}/evaluations`, { signal })
}

/** One payroll sheet row; `period` is only filled by the per-employee history. */
export interface EmployeePayrollRow extends PayrollEntry {
  /** Month label ("August 2026"). */
  period: string | null
}

export interface EmployeePayrollResponse {
  items: EmployeePayrollRow[]
}

/** Payroll sheets the employee appears on (payroll.view). */
export function getEmployeePayroll(id: number, signal?: AbortSignal): Promise<EmployeePayrollResponse> {
  return apiRequest<EmployeePayrollResponse>(`/api/employees/${id}/payroll`, { signal })
}
