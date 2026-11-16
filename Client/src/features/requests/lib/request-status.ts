import type { RequestListItem } from '../api/requests.api'

export type RequestUrgency = 'Notice' | 'Urgent' | 'Review' | 'Normal'

/** The catalog's balance-consuming types (plus the legacy "Day Off" label). */
export const BALANCE_TYPES = ['Annual Leave', 'Day Off', 'Sick Leave']

/**
 * Every request type the HR catalog can raise. Filters show this whole list, not
 * just the types an employee happens to have used so far.
 */
export const REQUEST_TYPE_CATALOG = [
  'Annual Leave',
  'Sick Leave',
  'Late Attendance',
  'Early Leave',
  'Shift Swap',
  'Weekly Off Swap',
  'Check-in Correction',
  'Salary Advance',
  'Paid Holiday',
  'Deduction Correction',
  'Resignation',
]

/** Older rows store the enum-ish names; the cards print the mock's spaced labels. */
const LEGACY_TYPE_LABELS: Record<string, string> = {
  DayOff: 'Day Off',
  SickLeave: 'Sick Leave',
  ShiftSwap: 'Shift Swap',
  SalaryAdvance: 'Salary Advance',
  LateArrival: 'Late Arrival',
  LeaveEarly: 'Leave Early',
  CheckInCorrection: 'Check-in Correction',
}

/** Display label for a request type (legacy enum names included). */
export function requestTypeLabel(type: string): string {
  return LEGACY_TYPE_LABELS[type] ?? type
}

/**
 * Display label for a request status. Stage-1 "Pending" reads as
 * "Awaiting Manager" — clearer than a bare Pending on both portals, and it names
 * exactly who the request is waiting on.
 */
export function requestStatusLabel(status: string, awaitingManager = false): string {
  if (awaitingManager || status === 'Pending') return 'Awaiting Manager'
  return status
}

/** The mock's urgency vocabulary: notice period, time-critical types, BM rejections, then normal. */
export function requestUrgency(request: Pick<RequestListItem, 'type' | 'bmDecision'>): RequestUrgency {
  if (request.type === 'Resignation') return 'Notice'
  if (
    request.type === 'Late Attendance' ||
    request.type === 'Late Arrival' ||
    request.type === 'Early Leave' ||
    request.type === 'Leave Early' ||
    request.type === 'Sick Leave'
  ) {
    return 'Urgent'
  }
  if (request.bmDecision === 'Rejected') return 'Review'
  return 'Normal'
}

/** "Sep" — the KPI tile's "Approved (Sep)" month label. */
export function currentMonthShort(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short' })
}
