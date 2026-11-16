import type { RequestListItem } from '../api/requests.api'
import { formatTimeOfDay } from '../../../lib/format'

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

/** The requested date is still ahead, so an HR decision can still be undone. */
export function isDecisionUndoable(request: Pick<RequestListItem, 'requestedDate'>): boolean {
  const start = new Date(`${request.requestedDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return false
  const today = new Date()
  return start.getTime() >= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
}

/**
 * Clock time the request was filed ("2:35 PM"), or null when the payload has none.
 *
 * The inbox row's `submittedDate` is a date-only value, so the exact instant is
 * read from the timeline's "Submitted" stamp — the API renders it as
 * "MMM d, yyyy · HH:mm" (invariant culture).
 */
export function submittedTimeLabel(request: Pick<RequestListItem, 'timeline'>): string | null {
  return splitStepStamp(stepStamp(request, 'Submitted'))?.time ?? null
}

/** "Nov 11 · 10:48 PM" — when the branch manager decided (Approved/Rejected), or null. */
export function bmDecisionTimeLabel(request: Pick<RequestListItem, 'timeline'>): string | null {
  return shortStepStamp(stepStamp(request, 'BM '))
}

/** "Nov 12 · 9:02 AM" — when HR recorded its final decision, or null. */
export function hrDecisionTimeLabel(request: Pick<RequestListItem, 'timeline'>): string | null {
  return shortStepStamp(stepStamp(request, 'HR '))
}

/** The date stamp of the first timeline step whose label starts with `prefix`. */
function stepStamp(request: Pick<RequestListItem, 'timeline'>, prefix: string): string | undefined {
  return request.timeline?.find((step) => step.step.startsWith(prefix))?.date
}

/** Splits the API's step stamp ("Nov 11, 2026 · 22:48") into its date and clock parts. */
function splitStepStamp(stamp: string | undefined): { date: string; time: string } | null {
  const match = stamp ? /^(.*?)\s*·\s*(\d{1,2}):(\d{2})\s*$/.exec(stamp) : null
  if (!match) return null
  return { date: match[1], time: formatTimeOfDay(`${match[2]}:${match[3]}`) }
}

/** "Nov 11 · 10:48 PM" — the step stamp with the year dropped and a 12-hour clock. */
function shortStepStamp(stamp: string | undefined): string | null {
  const parts = splitStepStamp(stamp)
  return parts ? `${parts.date.replace(/,\s*\d{4}$/, '')} · ${parts.time}` : null
}

/** "Sep" — the KPI tile's "Approved (Sep)" month label. */
export function currentMonthShort(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short' })
}
