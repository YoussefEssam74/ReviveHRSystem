import { apiRequest } from '../../../lib/api-client'

/**
 * My Attendance + My Schedule (mock §§5/6/7):
 *  - attendance GET /api/employees/{id}/attendance?month=yyyy-MM → paged items + month totals
 *  - leave balance GET /api/employees/{id}/leave-balance
 *  - schedule    GET /api/employees/{id}/schedule?month=     → published cycle days
 */

/** One day row of the attendance history (A7). */
export interface EmployeeAttendanceItem {
  date: string
  /** "Morning 08:00 – 16:00" — the display string the service builds. */
  shift: string
  checkIn: string | null
  checkOut: string | null
  status: string
  notes: string | null
}

export interface EmployeeAttendanceTotals {
  total: number
  present: number
  late: number
  early: number
  absent: number
  off: number
  /** Worked hours summed (decimal). */
  hours: number
  /** Scheduled hours summed over the same days (future days excluded). */
  expected: number
}

export interface EmployeeAttendanceResponse {
  items: EmployeeAttendanceItem[]
  totals: EmployeeAttendanceTotals
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface LeaveBalanceBucket {
  used: number
  total: number
}

export interface LeaveBalanceResponse {
  employeeId: number
  dayOff: LeaveBalanceBucket
  sick: LeaveBalanceBucket
  unpaid: LeaveBalanceBucket
}

/** One published schedule day (mock §7). */
export interface ScheduleDay {
  date: string
  dayName: string
  shiftName: string | null
  /** TimeOnly "HH:mm:ss". */
  start: string | null
  end: string | null
  isOff: boolean
  isToday: boolean
}

export interface ScheduleCycle {
  id: number
  start: string
  end: string
  status: string
}

export interface EmployeeScheduleDto {
  month: string
  cycles: ScheduleCycle[]
  days: ScheduleDay[]
}

/** month: "yyyy-MM"; omit for the current month. */
export function getOwnAttendance(employeeId: number, month?: string, page = 1, signal?: AbortSignal): Promise<EmployeeAttendanceResponse> {
  const monthQuery = month ? `&month=${month}` : ''
  return apiRequest<EmployeeAttendanceResponse>(
    `/api/employees/${employeeId}/attendance?page=${page}${monthQuery}`,
    { signal },
  )
}

/* ==================== Management writes (mark present / corrections) ==================== */

/** One HR day-upsert row (HrAttendanceRecordResponse → AttendanceListItem). */
export interface HrAttendanceRecord {
  data: {
    id: number
    name: string
    gym: string
    date: string
    checkIn: string | null
    checkOut: string | null
    status: string
  }
}

/**
 * POST /api/attendance/manual with the HR day-write form (`IsHrForm: true`) —
 * upserts the (employee, day) record. Guarded by `attendance.manual_entry`.
 * Punches are "HH:mm"; Absent/Off days clear them server-side.
 */
export function manualAttendance(esr: {
  employeeId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  reason: string
}): Promise<HrAttendanceRecord> {
  // IsHrForm is server-derived from the presence of date/status/checkIn above.
  return apiRequest<HrAttendanceRecord>('/api/attendance/manual', {
    method: 'POST',
    body: esr,
  })
}

/** PUT /api/attendance/{id}/correct — audit-trailed day correction (attendance.edit). */
export function correctAttendance(
  recordId: number,
  fields: { checkIn: string | null; checkOut: string | null; status: string; reason: string },
): Promise<HrAttendanceRecord> {
  return apiRequest<HrAttendanceRecord>(`/api/attendance/${recordId}/correct`, {
    method: 'PUT',
    body: fields,
  })
}

export function getOwnLeaveBalance(employeeId: number, signal?: AbortSignal): Promise<LeaveBalanceResponse> {
  return apiRequest<LeaveBalanceResponse>(`/api/employees/${employeeId}/leave-balance`, { signal })
}

/**
 * One deduction on the employee (GET /api/employees/{id}/deductions): an absence
 * follow-up or a payroll candidate, joined with the correction request he filed.
 */
export interface EmployeeDeduction {
  /** "followup-{id}" | "candidate-{id}" — separate id spaces, prefixed. */
  id: string
  source: 'absence' | 'candidate'
  /** "yyyy-MM-dd"; null when a hand-raised follow-up never carried the marker. */
  date: string | null
  description: string
  /** Money deductions only (day-based follow-ups leave it null). */
  amount: number | null
  /** Human status: In review | Resolved | Applied | Rejected. */
  status: string
  detail: string | null
  correctionRequestId: number | null
  /** Raw RequestStatus of the correction (Pending, PendingHRReview, ...). */
  correctionStatus: string | null
}

export function getEmployeeDeductions(employeeId: number, signal?: AbortSignal): Promise<EmployeeDeduction[]> {
  return apiRequest<EmployeeDeduction[]>(`/api/employees/${employeeId}/deductions`, { signal })
}

export function getOwnSchedule(employeeId: number, month?: string, signal?: AbortSignal): Promise<EmployeeScheduleDto> {
  const monthQuery = month ? `?month=${month}` : ''
  return apiRequest<EmployeeScheduleDto>(`/api/employees/${employeeId}/schedule${monthQuery}`, { signal })
}
