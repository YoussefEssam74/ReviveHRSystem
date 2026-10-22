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
