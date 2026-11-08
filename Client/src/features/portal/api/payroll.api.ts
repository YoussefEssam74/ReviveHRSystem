import { apiRequest } from '../../../lib/api-client'

/**
 * My Payroll (mock §8):
 *  - sheets  GET /api/employees/{id}/payroll-sheets            → PayrollSheet[] (visible periods)
 *  - payslip GET /api/employees/{id}/payroll/{entryId}/payslip → { data: PayslipCard }
 */

export interface PayrollLineItem {
  label: string
  amount: number
  /** "earning" | "deduction". */
  kind: string
  /** DateOnly "yyyy-MM-dd". */
  effectiveDate: string
  reason: string | null
  /** Attendance day this line prices (per-day deductions), when linked. */
  attendanceRecordId: number | null
  /** Line review state — "Pending" surfaces as "In review". */
  status: string
}

/** One detail row behind the breakdown's deductions (mock §8): late/absent days and branch deductions. */
export interface PayrollDeductionDetail {
  /** "late" | "absent" | "candidate" — attendance day rows vs unmatched deductions. */
  kind: string
  /** DateOnly "yyyy-MM-dd". */
  date: string
  label: string
  /** Positive amount of an attached deduction; null when informational. */
  amount: number | null
  /** Minutes after shift start — late rows only. */
  minutesLate: number | null
  /** Gym-local "HH:mm" check-in — late rows only. */
  checkInAt: string | null
  /** The day's scheduled shift window ("Morning Shift 08:00–16:00") — late/absent rows. */
  shift: string | null
  reason: string | null
  issuedBy: string | null
  /** Human review status of the attached deduction. */
  status: string | null
  /** Pairs this row with its payroll line so the sheet merges them into one row. */
  attendanceRecordId: number | null
}

export interface PayrollSheet {
  id: number
  /** "September 2026" label. */
  period: string
  status: string
  /** Set once the period is locked (the mock's "paid" stamp). */
  paidDate: string | null
  /** False while the period is still open — the row must not show money yet. */
  visible: boolean
  baseSalary: number
  totalBonuses: number
  totalDeductions: number
  netSalary: number
  items: PayrollLineItem[]
  daysWorked?: number
  workingDays?: number
  scheduledWeeklyDays?: number
  overtimeHours?: number
  paidLeaveDays?: number
  sickLeaveDays?: number
  annualLeaveDays?: number
  absentDays?: number
  lateCount?: number
  earlyLeaveCount?: number
  unpaidLeaveDays?: number
  leaveDeduction?: number
  salaryAdvance?: number
  /** The gym's annual-increase policy percent (mock's "Annual Increase (10%)"). */
  annualIncreasePercent?: number | null
  /** This period's raise slice: base salary × the gym's annual-increase percent. */
  annualIncrease?: number
  /** Overtime pay of the period (base/176×1.5×hours — the payslip's derivation). */
  overtimePay?: number
  /** Per-day late/absent rows and branch deductions behind the expanded breakdown. */
  deductionDetails?: PayrollDeductionDetail[]
}

export interface PayslipDeductionLine {
  label: string
  reason: string | null
  /** "manager" | "biometric". */
  source: string
  amount: number
  status: string
}

export interface PayslipCard {
  period: string
  gym: string
  employee: { employeeId: number; name: string; position: string }
  baseSalary: number
  /** The gym's annual-increase policy percent (mock's "ANNUAL INCREASE (10%)"). */
  annualIncreasePercent?: number | null
  /** This period's raise slice: base salary × the gym's annual-increase percent. */
  annualIncrease?: number
  /** Overtime hours. */
  overtime: number
  overtimePay: number
  bonus: number
  gross: number
  deductions: PayslipDeductionLine[]
  net: number
  days: number
  status: string
}

export interface PayslipResponse {
  data: PayslipCard
}

export function getOwnPayrollSheets(employeeId: number, signal?: AbortSignal): Promise<PayrollSheet[]> {
  return apiRequest<PayrollSheet[]>(`/api/employees/${employeeId}/payroll-sheets`, { signal })
}

export function getOwnPayslip(employeeId: number, entryId: number, signal?: AbortSignal): Promise<PayslipResponse> {
  return apiRequest<PayslipResponse>(`/api/employees/${employeeId}/payroll/${entryId}/payslip`, { signal })
}
