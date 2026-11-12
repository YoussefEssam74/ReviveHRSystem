import type { PayrollEntry } from '../api/payroll.api'

/** OT pay matches the mock: (base / 176) × 1.5 × overtime hours. */
export function overtimePayOf(entry: PayrollEntry): number {
  return Math.round((entry.baseSalary / 176) * 1.5 * entry.overtime)
}

/** Lines still awaiting an approve/waive decision. */
export function pendingLinesOf(entry: PayrollEntry): number {
  return entry.deductionLines.filter((line) => line.status === 'Pending').length
}

/** A sheet is closed once it is reviewed or the period locked it. */
export function isEntryClosed(entry: PayrollEntry): boolean {
  return entry.reviewed || entry.status === 'Reviewed' || entry.status === 'Locked'
}

/** The badge text the ledger prints for one employee. */
export function entryStatusLabel(entry: PayrollEntry): string {
  if (isEntryClosed(entry)) return 'Closed & Settled'
  const pending = pendingLinesOf(entry)
  return pending > 0 ? `${pending} Actions Needed` : 'Ready to Close'
}

/** Badge tone for the same three states. */
export function entryStatusTone(entry: PayrollEntry): 'green' | 'yellow' | 'blue' {
  if (isEntryClosed(entry)) return 'green'
  return pendingLinesOf(entry) > 0 ? 'yellow' : 'blue'
}
