import { ApiError, apiRequest } from '../../../lib/api-client'
import { loadStoredSession } from '../../../lib/session-store'

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type PayrollPeriodStatus = 'Open' | 'Partially Published' | 'Published' | 'Paid'
export type PayrollEntryStatus = 'Draft' | 'Reviewed' | 'Locked'
export type DeductionSource = 'manager' | 'biometric'
export type DeductionLineStatus = 'Pending' | 'Accepted' | 'Approved' | 'Rejected'

/** One period row (GET /api/payroll-periods) — a branch × month settlement run. */
export interface PayrollPeriod {
  id: number
  /** The branch this run belongs to (periods are per-gym rows). */
  gymId: number
  /** Branch name ("Nasr City"). */
  gym: string
  /** Month label ("October 2026"). */
  period: string
  /** Derived: Open | Partially Published | Published | Paid. */
  status: PayrollPeriodStatus
  locked: boolean
  paidDate: string | null
  publishedGyms: string[]
  totalEmployees: number
  totalGross: number
  totalDeductions: number
  totalNet: number
}

export interface PayrollPeriodListParams {
  gym?: number
  status?: string
  page?: number
  pageSize?: number
}

export function getPayrollPeriods(params: PayrollPeriodListParams = {}, signal?: AbortSignal): Promise<Paged<PayrollPeriod>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<PayrollPeriod>>(`/api/payroll-periods${qs ? '?' + qs : ''}`, { signal })
}

/** One deduction line on an entry sheet. */
export interface DeductionLine {
  id: number
  /** ISO date (yyyy-MM-dd). */
  date: string
  label: string
  reason: string | null
  /** biometric | manager. */
  source: DeductionSource
  amount: number
  /** Pending | Accepted | Approved | Rejected. */
  status: DeductionLineStatus
  /** ATT-{recordId}, ATT-MANUAL for ad-hoc biometric lines, or "". */
  attendanceRef: string
  requestId: number | null
}

/** One punch the settlement sheet's evidence column renders. */
export interface PayrollPunch {
  /** ATT-{recordId} — feeds GET /api/attendance/{id}. */
  attendanceRef: string
  /** ISO date (yyyy-MM-dd). */
  date: string
  /** Gym-local "08:41". */
  firstIn: string | null
  lastOut: string | null
  /** Biometric | Manual | Unknown. */
  device: string
  /** On Time | Late | Absent | Early Checkout | Missing Checkout | Off. */
  exception: string
  detail: string
  onTime: boolean
}

/** One day behind the settlement sheet's counters. */
export interface PayrollAttendanceDay {
  /** ISO date (yyyy-MM-dd). */
  date: string
  /**
   * Attended | WeeklyOff | ApprovedLeave | Late | Absent | EarlyCheckout |
   * MissingCheckout — the counter row this day belongs to.
   */
  kind: string
  /** Friendly status ("On Time", "Late", "Off", …). */
  status: string
  /** Shift window ("08:00–16:00"). */
  shift: string | null
  checkIn: string | null
  checkOut: string | null
  workedHours: number
  overtimeHours: number
  note: string | null
  /** ATT-{recordId} when the day has a punch. */
  attendanceRef: string | null
}

/** Work-days ledger + punch proof for one settlement sheet. */
export interface PayrollAttendance {
  /** Set when HR corrected the counters by hand (raw log stays visible). */
  adjustedAt: string | null
  daysAttended: number
  weeklyOffs: number
  approvedLeaves: number
  overtimeHours: number
  lateArrivals: number
  unexcusedAbsences: number
  punches: PayrollPunch[]
  /** Every day of the period, oldest first — the click-through log. */
  days: PayrollAttendanceDay[]
}

/** PUT …/entries/{employeeId}/attendance — HR's correction of the six counters. */
export interface UpdatePayrollAttendanceBody {
  daysAttended: number
  weeklyOffs: number
  approvedLeaves: number
  overtimeHours: number
  lateArrivals: number
  unexcusedAbsences: number
}

export function putEntryAttendance(
  periodId: number,
  employeeId: number,
  body: UpdatePayrollAttendanceBody,
): Promise<EntryTotals> {
  return apiRequest<Wrapped<EntryTotals>>(`/api/payroll-periods/${periodId}/entries/${employeeId}/attendance`, {
    method: 'PUT',
    body,
  }).then((r) => r.data)
}

/** One settlement sheet row in the period detail. */
export interface PayrollEntry {
  employeeId: number
  name: string
  /** "RV-00124" — printed under the name. */
  employeeNumber: string
  initials: string
  gym: string
  position: string
  employmentStatus: string
  days: number
  /** Overtime hours (OT pay is folded into `gross`). */
  overtime: number
  baseSalary: number
  bonus: number
  gross: number
  /** Sum of Accepted|Approved lines (Pending excluded). */
  deductions: number
  net: number
  /** Draft | Reviewed | Locked. */
  status: PayrollEntryStatus
  reviewed: boolean
  relatedRequestIds: number[]
  deductionLines: DeductionLine[]
  /** Period detail only; null on the per-employee history list. */
  attendance: PayrollAttendance | null
}

/** GET /api/payroll-periods/{id} — the settlement sheet. */
export interface PayrollPeriodDetail extends PayrollPeriod {
  items: PayrollEntry[]
}

interface Wrapped<T> {
  data: T
}

/**
 * POST /api/payroll-periods/ensure?gym= — idempotently opens the current month and
 * adds a Draft sheet for every active employee without one (payroll.edit).
 */
export interface PayrollEnsureResult {
  periodId: number
  /** Month label ("November 2026"). */
  period: string
  created: boolean
  entriesAdded: number
  /** False when the period is already published/locked (nothing changed). */
  open: boolean
}

export function postEnsureCurrentPeriod(gymId: number, signal?: AbortSignal): Promise<PayrollEnsureResult> {
  return apiRequest<PayrollEnsureResult>(`/api/payroll-periods/ensure?gym=${gymId}`, { method: 'POST', signal })
}

export function getPayrollPeriod(id: number, signal?: AbortSignal): Promise<PayrollPeriodDetail> {
  return apiRequest<Wrapped<PayrollPeriodDetail>>(`/api/payroll-periods/${id}`, { signal }).then((r) => r.data)
}

/** PUT …/entries/{employeeId} → `{ data: { employeeId, bonus, gross, deductions, net } }`. */
export interface EntryTotals {
  employeeId: number
  bonus: number
  gross: number
  deductions: number
  net: number
}

export function putEntryBonus(periodId: number, employeeId: number, bonus: number, signal?: AbortSignal): Promise<EntryTotals> {
  return apiRequest<Wrapped<EntryTotals>>(`/api/payroll-periods/${periodId}/entries/${employeeId}`, {
    method: 'PUT',
    body: { bonus },
    signal,
  }).then((r) => r.data)
}

/** Recomputed totals echoed back by every entry mutation. */
export interface EntrySummary {
  gross: number
  deductions: number
  net: number
  pendingCount: number
}

export interface CreateDeductionBody {
  source: DeductionSource
  reason: string
  amount: number
}

/** POST …/deductions → 201 `{ data: { …line, entry } }` (a Pending line, not yet deducted). */
export interface CreatedDeductionLine extends DeductionLine {
  entry: EntrySummary
}

export function postEntryDeduction(
  periodId: number,
  employeeId: number,
  body: CreateDeductionBody,
  signal?: AbortSignal,
): Promise<CreatedDeductionLine> {
  return apiRequest<Wrapped<CreatedDeductionLine>>(
    `/api/payroll-periods/${periodId}/entries/${employeeId}/deductions`,
    { method: 'POST', body, signal },
  ).then((r) => r.data)
}

/** DELETE …/deductions/{lineId} → `{ data: { id, entry } }` (open periods only). */
export interface RemovedDeduction {
  id: number
  entry: EntrySummary
}

export function deleteEntryDeduction(
  periodId: number,
  employeeId: number,
  lineId: number,
  signal?: AbortSignal,
): Promise<RemovedDeduction> {
  return apiRequest<Wrapped<RemovedDeduction>>(
    `/api/payroll-periods/${periodId}/entries/${employeeId}/deductions/${lineId}`,
    { method: 'DELETE', signal },
  ).then((r) => r.data)
}

/** POST …/close — settles one sheet (refused while a line is Pending). */
export interface CloseEntryResult {
  employeeId: number
  status: PayrollEntryStatus
  reviewed: boolean
  reviewedAt: string | null
  gross: number
  deductions: number
  net: number
}

export function postEntryClose(periodId: number, employeeId: number, signal?: AbortSignal): Promise<CloseEntryResult> {
  return apiRequest<Wrapped<CloseEntryResult>>(`/api/payroll-periods/${periodId}/entries/${employeeId}/close`, {
    method: 'POST',
    signal,
  }).then((r) => r.data)
}

/** POST …/reopen — back to Draft. */
export interface ReopenEntryResult {
  employeeId: number
  status: PayrollEntryStatus
  reviewed: boolean
}

export function postEntryReopen(periodId: number, employeeId: number, signal?: AbortSignal): Promise<ReopenEntryResult> {
  return apiRequest<Wrapped<ReopenEntryResult>>(`/api/payroll-periods/${periodId}/entries/${employeeId}/reopen`, {
    method: 'POST',
    signal,
  }).then((r) => r.data)
}

/** POST /api/payroll-periods/{id}/approve — publish & lock the branch. */
export interface ApprovePeriodResult {
  id: number
  status: string
  locked: boolean
  publishedGyms: string[]
  message: string
}

export function postPeriodApprove(id: number, gym: string, signal?: AbortSignal): Promise<ApprovePeriodResult> {
  return apiRequest<Wrapped<ApprovePeriodResult>>(`/api/payroll-periods/${id}/approve`, {
    method: 'POST',
    body: { gym },
    signal,
  }).then((r) => r.data)
}

/** GET …/payslips/{employeeId} — the payslip preview. */
export interface PayslipDeduction {
  label: string
  reason: string | null
  source: string
  amount: number
  status: string
}

export interface Payslip {
  period: string
  gym: string
  employee: { employeeId: number; name: string; position: string }
  baseSalary: number
  /** Overtime hours. */
  overtime: number
  overtimePay: number
  bonus: number
  gross: number
  /** All lines with statuses — net only counts Accepted|Approved. */
  deductions: PayslipDeduction[]
  net: number
  days: number
  status: string
}

export function getPayslip(periodId: number, employeeId: number, signal?: AbortSignal): Promise<Payslip> {
  return apiRequest<Wrapped<Payslip>>(`/api/payroll-periods/${periodId}/payslips/${employeeId}`, { signal }).then(
    (r) => r.data,
  )
}

/** GET /api/attendance/{ref} — the punch audit behind a deduction line. */
export interface AttendanceRef {
  /** Normalized ref ("ATT-123"). */
  id: string
  /** ISO date (yyyy-MM-dd). */
  date: string
  firstIn: string | null
  lastOut: string | null
  /** Biometric | Manual. */
  device: string
  /** On Time | Late | Absent | Early Checkout | Missing Checkout. */
  exception: string
  detail: string
}

export function getAttendanceRef(ref: string, signal?: AbortSignal): Promise<AttendanceRef> {
  return apiRequest<Wrapped<AttendanceRef>>(`/api/attendance/${encodeURIComponent(ref)}`, { signal }).then((r) => r.data)
}

/** One reviewable deduction line (GET /api/deduction-candidates). */
export interface DeductionCandidate {
  id: number
  employeeId: number
  employeeName: string
  gym: string
  /** Month label ("October 2026"). */
  period: string
  /** ISO date (yyyy-MM-dd). */
  date: string
  label: string
  reason: string | null
  source: string
  amount: number
  status: string
  attendanceRef: string
  requestId: number | null
}

export interface DeductionCandidateParams {
  gym?: number
  /** Period id or month label. */
  period?: string
  status?: string
  page?: number
  pageSize?: number
}

export function getDeductionCandidates(
  params: DeductionCandidateParams = {},
  signal?: AbortSignal,
): Promise<Paged<DeductionCandidate>> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.period) query.set('period', params.period)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return apiRequest<Paged<DeductionCandidate>>(`/api/deduction-candidates${qs ? '?' + qs : ''}`, { signal })
}

/** POST /api/deduction-candidates/{id}/review — Accepted (approve) | Rejected (waive). */
export interface ReviewCandidateResult {
  id: number
  status: string
  amount: number
  entry: EntrySummary & { employeeId: number }
}

export function postCandidateReview(id: number, decision: 'Accepted' | 'Rejected', signal?: AbortSignal): Promise<ReviewCandidateResult> {
  return apiRequest<Wrapped<ReviewCandidateResult>>(`/api/deduction-candidates/${id}/review`, {
    method: 'POST',
    body: { decision },
    signal,
  }).then((r) => r.data)
}

/**
 * GET /api/payroll-periods/{id}/export — downloads the period CSV.
 *
 * This is the only call that does not go through `apiRequest`: the endpoint
 * streams `text/csv`, which `apiRequest` (JSON-only) would parse into null.
 * The Bearer token is attached from the same session store the client uses.
 */
export async function downloadPeriodCsv(periodId: number, gymId?: number): Promise<void> {
  const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
  const query = new URLSearchParams()
  query.set('format', 'csv')
  if (gymId != null) query.set('gym', String(gymId))
  const session = loadStoredSession()
  const response = await fetch(`${baseUrl}/api/payroll-periods/${periodId}/export?${query.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'text/csv',
      ...(session ? { Authorization: 'Bearer ' + session.accessToken } : {}),
    },
  })
  if (!response.ok) {
    throw new ApiError(
      response.status,
      'HTTP_' + response.status,
      response.status === 401
        ? 'You are not signed in, or your session has expired.'
        : 'The payroll export failed. Please try again.',
    )
  }
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const fileName = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? `payroll-${periodId}.csv`
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
