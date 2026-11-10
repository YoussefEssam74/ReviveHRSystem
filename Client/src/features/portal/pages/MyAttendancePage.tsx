import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, SquarePen } from 'lucide-react'
import { getEmployeeDashboard } from '../api/dashboard.api'
import {
  getEmployeeDeductions,
  getOwnAttendance,
  getOwnLeaveBalance,
  type EmployeeAttendanceItem,
  type EmployeeDeduction,
} from '../api/attendance.api'
import { getExcusedHoursBudget, getOwnRequests, getRequestTypes } from '../api/requests.api'
import { listWarningNotices, type WarningNoticeRow } from '../api/branch.api'
import { NewRequestModal } from '../components/NewRequestModal'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Drawer } from '../../../components/ui/drawer'
import { Button } from '../../../components/ui/button'
import { StatusBadge } from '../../../components/ui/badge'
import { Badge, type BadgeColor } from '../../../components/ui/badge'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateWithYear, formatMoney, formatTimeLabel } from '../../../lib/format'
import { PAGE_PATHS } from '../portal-nav'
import { cn } from '../../../lib/utils'

/** "09:12" | "09:12:30" → 552 minutes (null when absent). */
function minutesOf(value: string | null): number | null {
  if (!value) return null
  const [h, m] = value.split(':')
  const hours = Number(h)
  const minutes = Number(m)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

/** 552 → "9h 12m" (null → dash). */
function workedLabel(total: number | null): string {
  if (total === null) return '—'
  return `${Math.floor(total / 60)}h ${total % 60}m`
}

/** "09:12:30" | "09:12" TimeOnly string → "9:12 AM". */
function time12(value: string | null): string {
  if (!value) return '—'
  const [h, m] = value.split(':')
  const hour = Number(h)
  if (Number.isNaN(hour)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${m ?? '00'} ${suffix}`
}

function monthLabel(iso: string): string {
  const [year, month] = iso.split('-')
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${names[Number(month) - 1]} ${year}`
}

function currentMonthIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function previousMonthIso(): string {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** RequestTypeCatalog id for attendance corrections (backend `RequestTypeCatalog`). */
const CHECK_IN_CORRECTION_ID = 'check-in-correction'

/** RequestTypeCatalog id for disputing a raised deduction (backend `RequestTypeCatalog`). */
const DEDUCTION_CORRECTION_ID = 'deduction-correction'

/** Badge color per deduction status — from the employee's seat: applied = money gone. */
const DEDUCTION_COLORS: Record<string, BadgeColor> = {
  'In review': 'yellow',
  Pending: 'yellow',
  'Pending HR': 'yellow',
  'Branch approved': 'yellow',
  Applied: 'red',
  Rejected: 'green',
  Resolved: 'green',
}

/** A deduction the branch/HR still stands behind — a waived one no longer paints its day. */
function isLiveDeduction(deduction: EmployeeDeduction): boolean {
  return deduction.status !== 'Rejected' && deduction.status !== 'Resolved'
}

/** Raw RequestStatus enum → the label the badge vocabulary understands. */
function requestStatusLabel(status: string | null): string {
  if (!status) return '—'
  return status === 'PendingHRReview' ? 'Pending HR Review' : status
}

/** Draft of a request being launched: optional type + date to prefill in the modal. */
interface RequestDraft {
  typeId?: string
  date?: string
}

/** A request riding on a day chip (type + status). */
interface DayRequestChipProps {
  type: string
  status: string
}

function RequestChip({ type, status }: DayRequestChipProps) {
  const statusColor = status === 'Approved' ? 'text-brand-600' : status === 'Rejected' ? 'text-red-600' : 'text-yellow-600'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-[10px] font-semibold text-charcoal-700">
      {type}
      <span className="font-normal text-charcoal-300">·</span>
      <span className={statusColor}>{status}</span>
    </span>
  )
}

/**
 * Box-2 content for a history row: the day's warning chips (any issued notice)
 * and each priced deduction with the state it is in — Pending while the branch
 * or HR still has to decide, Applied once booked, Rejected once waived — all
 * opening the day drawer. The day's own status stays in the Status column, so
 * it is never repeated here.
 */
function DayWarningChips({
  warning,
  deductions,
  onOpen,
}: {
  warning: WarningNoticeRow | null
  deductions: EmployeeDeduction[]
  onOpen: (warning: WarningNoticeRow | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {warning && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpen(warning)
          }}
          className="inline-flex"
          title={warning.reason}
        >
          <Badge color="orange">{warning.type || 'Warning'}</Badge>
        </button>
      )}
      {deductions.map((deduction) => (
        <button
          key={deduction.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpen(warning)
          }}
          className="inline-flex"
          title={`${deduction.description} · ${deduction.status}${deduction.detail ? ` — ${deduction.detail}` : ''}`}
        >
          <Badge color={DEDUCTION_COLORS[deduction.status] ?? 'gray'}>
            {deduction.amount != null ? formatMoney(deduction.amount) : 'Amount pending'}
            <span className="font-normal">· {deduction.status}</span>
          </Badge>
        </button>
      ))}
      {!warning && deductions.length === 0 && <span className="text-charcoal-400">—</span>}
    </div>
  )
}

/**
 * An off/empty row that carries a live deduction still reads as the day that
 * deduction punishes — Late when one names lateness, Absent otherwise. A
 * waived deduction no longer paints the day.
 */
function dayDisplayStatus(item: EmployeeAttendanceItem, deductions: EmployeeDeduction[]) {
  const live = deductions.filter(isLiveDeduction)
  if ((item.status !== 'Off' && item.status !== '') || live.length === 0) return item.status
  return live.some((row) => /late/i.test(row.description)) ? 'Late' : 'Absent'
}

export default function MyAttendancePage() {
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null

  const [month, setMonth] = useState<string>(currentMonthIso())
  const [detailDate, setDetailDate] = useState<string | null>(null)
  /** The warning whose badge opened the detail drawer — its reason shows there. */
  const [detailWarning, setDetailWarning] = useState<WarningNoticeRow | null>(null)
  const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null)

  const dashboardQuery = useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: ({ signal }) => getEmployeeDashboard(signal),
    staleTime: 30_000,
    enabled: employeeId != null,
  })
  const attendanceQuery = useQuery({
    queryKey: ['portal', 'attendance', employeeId, month],
    queryFn: ({ signal }) => getOwnAttendance(employeeId!, month, 1, signal),
    enabled: employeeId != null,
  })
  const balanceQuery = useQuery({
    queryKey: ['portal', 'leave-balance', employeeId],
    queryFn: ({ signal }) => getOwnLeaveBalance(employeeId!, signal),
    enabled: employeeId != null,
  })
  const budgetQuery = useQuery({
    queryKey: ['portal', 'excused-hours', employeeId],
    queryFn: ({ signal }) => getExcusedHoursBudget(employeeId!, signal),
    enabled: employeeId != null,
  })
  const typesQuery = useQuery({
    queryKey: ['portal', 'request-types'],
    queryFn: ({ signal }) => getRequestTypes(signal),
    staleTime: 10 * 60_000,
    enabled: employeeId != null,
  })
  const requestsQuery = useQuery({
    queryKey: ['portal', 'requests', employeeId, 'list'],
    queryFn: ({ signal }) => getOwnRequests(employeeId!, signal),
    enabled: employeeId != null,
  })
  const deductionsQuery = useQuery({
    queryKey: ['portal', 'deductions', employeeId],
    queryFn: ({ signal }) => getEmployeeDeductions(employeeId!, signal),
    enabled: employeeId != null,
  })
  const warningsQuery = useQuery({
    queryKey: ['portal', 'warnings', employeeId],
    queryFn: ({ signal }) => listWarningNotices(employeeId!, signal),
    enabled: employeeId != null,
  })

  if (employeeId == null) {
    return (
      <EmptyState
        title="No employee profile"
        hint="This account is not linked to an employee profile, so it has no attendance to show."
      />
    )
  }
  if (attendanceQuery.isLoading) return <LoadingState label="Loading attendance…" />
  if (attendanceQuery.isError) {
    return <ErrorState message={describeApiError(attendanceQuery.error)} onRetry={() => attendanceQuery.refetch()} />
  }

  const dashboard = dashboardQuery.data ?? null
  const attendance = attendanceQuery.data
  const balance = balanceQuery.data ?? null
  const budget = budgetQuery.data ?? null
  const requests = requestsQuery.data ?? []
  const deductions = deductionsQuery.data ?? []
  // Deductions grouped by their date — several can share one day, and every one
  // of them stays addressable through its own badge/details action.
  const deductionsByDate = new Map<string, EmployeeDeduction[]>()
  for (const row of deductions) {
    if (!row.date) continue
    const group = deductionsByDate.get(row.date)
    if (group) group.push(row)
    else deductionsByDate.set(row.date, [row])
  }
  const warnings = warningsQuery.data ?? []
  const warningsByDate = new Map(
    warnings
      .map((row) => {
        const date = row.issuedAt ? row.issuedAt.slice(0, 10) : null
        return date ? [date, row] as const : null
      })
      .filter((entry): entry is readonly [string, WarningNoticeRow] => entry !== null),
  )
  // Off days (no shift planned) are omitted from the history like in the mock —
  // unless the day carries a warning, a live deduction, or an unscheduled punch
  // (shift "Cover / Extra Day" or a cover-day value), all of which must stay
  // reachable on the day they happened. A waived deduction does not resurrect
  // an off day.
  const history = (attendance?.items ?? []).filter((item) => {
    const shift = item.shift.trim().toLowerCase()
    if (shift !== '' && shift !== 'off') return true
    if (item.coverDays != null) return true
    return warningsByDate.has(item.date) || (deductionsByDate.get(item.date) ?? []).some(isLiveDeduction)
  })
  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const monthOptions = [
    { value: currentMonthIso(), label: monthLabel(currentMonthIso()) },
    { value: previousMonthIso(), label: monthLabel(previousMonthIso()) },
  ]

  function requestsOn(isoDate: string) {
    return requests.filter((request) => {
      const start = request.requestedDate
      const end = request.endDate ?? request.requestedDate
      return start <= isoDate && isoDate <= end
    })
  }
  /** Opens the day drawer, carrying the warning whose badge was clicked (or none). */
  function openDetail(date: string, warning: WarningNoticeRow | null) {
    setDetailDate(date)
    setDetailWarning(warning)
  }
  const LEAVE_TYPES = new Set(['Annual Leave', 'Sick Leave', 'Paid Holiday'])
  function leaveOn(isoDate: string) {
    return requestsOn(isoDate).find((request) => LEAVE_TYPES.has(request.type) && request.status === 'Approved') ?? null
  }

  const detailBase = detailDate ? attendance?.items.find((item) => item.date === detailDate) ?? null : null
  const detailDeductions = detailDate ? deductionsByDate.get(detailDate) ?? [] : []
  // An off row carrying a deduction reads as the day that deduction punishes.
  const detail = detailBase ? { ...detailBase, status: dayDisplayStatus(detailBase, detailDeductions) } : null
  const today = dashboard?.todayAttendance ?? null
  const workedToday = (() => {
    const inMinutes = minutesOf(today?.checkIn ?? null)
    const outMinutes = minutesOf(today?.checkOut ?? null)
    return outMinutes !== null && inMinutes !== null ? outMinutes - inMinutes : null
  })()
  const detailLeave = detailDate ? leaveOn(detailDate) : null
  const detailOthers = detailDate ? requestsOn(detailDate).filter((r) => r !== detailLeave) : []

  return (
    <div className="space-y-2 pb-2">
      {/* Today's view — the dashboard session card is the real read-only display */}
      {dashboard && (
        <div className="card overflow-hidden">
          <div className="flex flex-col justify-between gap-1 border-b border-charcoal-100 px-4 py-2 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-bold text-charcoal-900">Today's View</p>
              <p className="text-[10px] text-charcoal-500">
                {formatDateWithYear(todayIso)} · {dashboard.user.gymName}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-charcoal-100 px-2 py-0.5 text-[9px] font-semibold text-charcoal-600">
              Read-only
            </span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-charcoal-100 lg:grid-cols-5">
            <div className="bg-white px-3 py-2.5">
              <p className="bento-label mb-1 text-charcoal-400">ASSIGNED SHIFT</p>
              <p className="text-sm font-bold leading-snug text-charcoal-900">{dashboard.todayShift?.shiftName ?? 'Off'}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-charcoal-500">
                {dashboard.todayShift ? `${time12(dashboard.todayShift.start)} – ${time12(dashboard.todayShift.end)}` : 'no shift today'}
              </p>
            </div>
            <div className="bg-white px-3 py-2.5">
              <p className="bento-label mb-1 text-charcoal-400">CHECK-IN</p>
              <p className={cn('text-sm font-bold leading-snug', today?.checkIn ? 'text-brand-600' : 'text-charcoal-400')}>
                {time12(today?.checkIn ?? null)}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-charcoal-500">
                {today?.checkIn ? dashboard.user.gymName : 'not checked in'}
              </p>
            </div>
            <div className="bg-white px-3 py-2.5">
              <p className="bento-label mb-1 text-charcoal-400">CHECK-OUT</p>
              <p className={cn('text-sm font-bold leading-snug', today?.checkOut ? 'text-charcoal-900' : 'text-charcoal-400')}>
                {time12(today?.checkOut ?? null)}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-charcoal-500">{today?.checkOut ? 'completed' : 'in progress'}</p>
            </div>
            <div className="bg-white px-3 py-2.5">
              <p className="bento-label mb-1 text-charcoal-400">WORKING HOURS</p>
              <p className="text-sm font-bold leading-snug text-charcoal-900">{workedLabel(workedToday)}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-charcoal-500">{today?.checkOut ? 'day complete' : 'updating live'}</p>
            </div>
            <div className="col-span-2 bg-white px-3 py-2.5 lg:col-span-1">
              <p className="bento-label mb-1 text-charcoal-400">ATTENDANCE STATUS</p>
              <div className="mt-0.5">
                {today ? <StatusBadge status={today.status} /> : <StatusBadge status="Off" />}
              </div>
              <p className="mt-1 text-[10px] leading-snug text-charcoal-500">{today?.source || 'No action needed'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats row — one straight line of seven boxes on phones, so nothing is
          pushed to a second row or clipped by the page edge. */}
      {dashboard && (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          <StatPill value={`${Math.round(dashboard.monthSummary.rate)}%`} label="Attendance Rate" color="text-brand-700" accent="border-l-brand-500" />
          <StatPill value={dashboard.monthSummary.present} label="Present" color="text-brand-600" accent="border-l-brand-500" />
          <StatPill value={dashboard.monthSummary.late} label="Late" color="text-yellow-600" accent="border-l-yellow-500" />
          <StatPill value={dashboard.monthSummary.absent} label="Absent" color="text-red-600" accent="border-l-red-500" />
          <StatPill value={dashboard.monthSummary.earlyCheckout} label="Early Out" color="text-blue-600" accent="border-l-blue-500" />
          <StatPill value={dashboard.monthSummary.missingCheckout} label="Missing Out" color="text-charcoal-600" accent="border-l-charcoal-400" />
          <StatPill value={dashboard.monthSummary.coverDays} label="Cover days" color="text-violet-600" accent="border-l-violet-500" />
        </div>
      )}

      {/* Leave balance + quick request launch */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="card px-3 py-2">
          <p className="bento-label mb-1.5">LEAVE BALANCE</p>
          <div className="space-y-1.5">
            {balance ? (
              <>
                <BalanceRow label="Annual" used={balance.dayOff.used} total={balance.dayOff.total} color="bg-brand-500" />
                <BalanceRow label="Sick" used={balance.sick.used} total={balance.sick.total} color="bg-red-400" />
                <BalanceRow label="Unpaid" used={balance.unpaid.used} total={balance.unpaid.total} color="bg-blue-500" />
              </>
            ) : (
              balanceQuery.isError && <p className="text-[11px] text-red-600">{describeApiError(balanceQuery.error)}</p>
            )}
            {budget && (
              <BalanceRow
                label="Excused hours"
                used={budget.usedHours}
                total={budget.capHours}
                color="bg-purple-400"
                time
              />
            )}
          </div>
        </div>

        <div className="card px-3 py-2 lg:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="bento-label">NEW REQUEST</p>
            <Link to={PAGE_PATHS.requests} className="text-[10px] font-semibold text-brand-600 hover:underline">
              View All
            </Link>
          </div>

          {/* Phone: a single launcher — the form itself asks for the type. */}
          <div className="flex flex-wrap items-center gap-2 sm:hidden">
            <Button size="sm" onClick={() => setRequestDraft({})}>
              <SquarePen className="h-3.5 w-3.5" aria-hidden="true" /> New Request
            </Button>
            <p className="text-[10px] text-charcoal-500">Choose the request type in the form — leave, swap, correction or advance.</p>
          </div>

          {/* Tablet / desktop: the type chips. Deduction disputes start from the
              deduction itself (day drawer → Request correction), so that type is
              not offered as a standalone chip here. */}
          <div className="hidden sm:block">
            {typesQuery.isError ? (
              <p className="text-[11px] text-red-600">{describeApiError(typesQuery.error)}</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {(typesQuery.data ?? [])
                  .filter((type) => type.id !== 'unscheduled-attendance' && type.id !== DEDUCTION_CORRECTION_ID)
                  .map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setRequestDraft({ typeId: type.id })}
                      className="flex min-w-0 items-center gap-1.5 rounded-lg border border-charcoal-200 px-2 py-1.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
                    >
                      <SquarePen className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" aria-hidden="true" />
                      <span className="truncate text-[10px] font-semibold text-charcoal-700">{type.label}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance history */}
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-charcoal-900">Attendance History</p>
        <div className="w-full shrink-0 sm:w-44">
          <select
            className="form-select"
            aria-label="Select month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card hidden overflow-hidden lg:block">
        {history.length === 0 ? (
          <EmptyState title="No attendance records for this month" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-charcoal-100 text-charcoal-500 dark:text-charcoal-700">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Shift</th>
                  <th className="px-4 py-2.5 font-medium">Check In</th>
                  <th className="px-4 py-2.5 font-medium">Check Out</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Warnings & Deductions</th>
                  <th className="px-4 py-2.5 font-medium">Requests</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const leave = leaveOn(item.date)
                  const others = requestsOn(item.date).filter((r) => r !== leave)
                  const dayDeductions = deductionsByDate.get(item.date) ?? []
                  const warning = warningsByDate.get(item.date) ?? null
                  return (
                    <tr
                      key={item.date}
                      className="cursor-pointer border-b border-charcoal-50 transition-colors last:border-0 hover:bg-charcoal-50"
                      onClick={() => openDetail(item.date, null)}
                    >
                      <td className="px-4 py-2.5 font-medium">{formatDate(item.date)}</td>
                      <td className="px-4 py-2.5">{item.shift}</td>
                      <td className="px-4 py-2.5">{time12(item.checkIn)}</td>
                      <td className="px-4 py-2.5">{time12(item.checkOut)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {leave ? <StatusBadge status={leave.status} /> : <StatusBadge status={dayDisplayStatus(item, dayDeductions)} />}
                          {item.coverDays != null && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Cover: {item.coverDays}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <DayWarningChips warning={warning} deductions={dayDeductions} onOpen={(w) => openDetail(item.date, w)} />
                      </td>
                      <td className="px-4 py-2.5">
                        {others.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {others.map((request) => (
                              <RequestChip key={request.id} type={request.type} status={request.status} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-charcoal-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2 lg:hidden">
        {history.length === 0 && <EmptyState title="No attendance records for this month" />}
        {history.map((item) => {
          const leave = leaveOn(item.date)
          const others = requestsOn(item.date).filter((r) => r !== leave)
          const dayDeductions = deductionsByDate.get(item.date) ?? []
          const warning = warningsByDate.get(item.date) ?? null
          return (
            <div key={item.date} className="card card-interactive cursor-pointer p-3" onClick={() => openDetail(item.date, null)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-charcoal-900">{formatDate(item.date)}</p>
                  <p className="text-[10px] text-charcoal-500">{item.shift}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {item.coverDays != null && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Cover: {item.coverDays}
                    </span>
                  )}
                  {leave ? <StatusBadge status={leave.status} /> : <StatusBadge status={dayDisplayStatus(item, dayDeductions)} />}
                </div>
              </div>
              <div className="mt-1.5">
                <DayWarningChips warning={warning} deductions={dayDeductions} onOpen={(w) => openDetail(item.date, w)} />
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-charcoal-500">
                <span>In: {time12(item.checkIn)}</span>
                <span>Out: {time12(item.checkOut)}</span>
              </div>
              {others.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {others.map((request) => (
                    <RequestChip key={request.id} type={request.type} status={request.status} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* A failed deductions load would silently hide the day chips, so it surfaces. */}
      {deductionsQuery.isError && (
        <ErrorState message={describeApiError(deductionsQuery.error)} onRetry={() => deductionsQuery.refetch()} />
      )}

      <AttendanceDetailDrawer
        detailDate={detailDate}
        detail={detail}
        leave={detailLeave}
        others={detailOthers}
        warning={detailWarning}
        deductions={detailDate ? deductionsByDate.get(detailDate) ?? [] : []}
        onClose={() => {
          setDetailDate(null)
          setDetailWarning(null)
        }}
        onCorrect={() => {
          const date = detailDate ?? undefined
          setDetailDate(null)
          setDetailWarning(null)
          setRequestDraft({ typeId: CHECK_IN_CORRECTION_ID, date })
        }}
        onCorrectDeduction={(row) => {
          setDetailDate(null)
          setDetailWarning(null)
          if (row.date) setRequestDraft({ typeId: DEDUCTION_CORRECTION_ID, date: row.date })
        }}
        onNewRequest={() => {
          setDetailDate(null)
          setDetailWarning(null)
          setRequestDraft({})
        }}
      />

      {requestDraft && employeeId != null && (
        <NewRequestModal
          employeeId={employeeId}
          preselect={requestDraft.typeId}
          presetDate={requestDraft.date}
          onClose={() => setRequestDraft(null)}
        />
      )}
    </div>
  )
}

function StatPill({
  value,
  label,
  color,
  accent,
}: {
  value: number | string
  label: string
  color: string
  accent: string
}) {
  return (
    <div className={cn('card flex min-w-0 flex-col items-center rounded-xl border-l-2 px-0.5 py-2 text-center sm:border-l-4 sm:px-2', accent)}>
      <p className={cn('text-[11px] font-bold leading-none sm:text-base', color)}>{value}</p>
      <p className="mt-1 text-[7px] leading-[1.15] text-charcoal-500 sm:text-[9px]">{label}</p>
    </div>
  )
}

function BalanceRow({
  label,
  used,
  total,
  color,
  time = false,
}: {
  label: string
  used: number
  total: number
  color: string
  time?: boolean
}) {
  const remaining = Math.max(0, total - used)
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const fmtHours = (hours: number) =>
    hours < 1 ? `${Math.round(hours * 60)} min` : `${Math.round(hours * 10) / 10} hr${Math.round(hours * 10) / 10 !== 1 ? 's' : ''}`
  const remText = time ? fmtHours(remaining) : String(remaining)
  const totText = time ? fmtHours(total) : String(total)
  const spent = remaining <= 0
  const low = !spent && pct >= 75
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 flex-shrink-0 truncate text-[10px] font-medium text-charcoal-600">{label}</span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-charcoal-100">
        <div className={cn('h-full rounded-full transition-all', spent ? 'bg-red-500' : low ? 'bg-yellow-500' : color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('whitespace-nowrap text-[11px] font-bold', spent ? 'text-red-600' : low ? 'text-yellow-600' : 'text-charcoal-900')}>
        {remText}
        <span className="text-[9px] font-medium text-charcoal-400">/{totText}</span>
      </span>
    </div>
  )
}

/**
 * The mock's day-detail drawer, in two sections: the day's ATTENDANCE facts
 * (with its own correction action) and its WARNINGS & DEDUCTIONS (each row
 * disputable on its own).
 */
function AttendanceDetailDrawer({
  detailDate,
  detail,
  leave,
  others,
  warning,
  deductions,
  onClose,
  onCorrect,
  onCorrectDeduction,
  onNewRequest,
}: {
  detailDate: string | null
  detail: EmployeeAttendanceItem | null
  leave: { type: string; status: string } | null
  others: Array<{ id: number; type: string; status: string }>
  /** The warning badge that opened the drawer, if opened through one. */
  warning: WarningNoticeRow | null
  /** Every deduction raised on this day (several can share it). */
  deductions: EmployeeDeduction[]
  onClose: () => void
  /** Opens the New Request modal directly on the Check-in Correction type for this day. */
  onCorrect: () => void
  /** Opens the New Request modal for disputing a deduction raised on this day. */
  onCorrectDeduction: (deduction: EmployeeDeduction) => void
  /** Opens the New Request modal with no type pre-picked. */
  onNewRequest: () => void
}) {
  return (
    <Drawer open={detailDate != null} title="Attendance Details" onClose={onClose}>
      {detail && (
        <div className="space-y-4">
          <div className="border-b border-charcoal-100 py-2 text-center">
            <p className="text-sm font-bold text-charcoal-900">{formatDateWithYear(detail.date)}</p>
            <div className="mt-1">
              <StatusBadge status={detail.status} />
            </div>
          </div>

          {/* Section 1 — the day's attendance facts, with its own correction action */}
          <div>
            <p className="bento-label mb-1.5 text-charcoal-500">ATTENDANCE</p>
            <div className="space-y-2">
              <DayRow label="Scheduled Shift" value={formatTimeLabel(detail.shift)} />
              <DayRow label="Check In" value={time12(detail.checkIn)} valueClass={detail.checkIn ? 'text-brand-600' : 'text-charcoal-400'} bold />
              <DayRow label="Check Out" value={time12(detail.checkOut)} bold />
              {detail.coverDays != null && (
                <DayRow
                  label="Cover / Extra Days"
                  value={`${detail.coverDays} day${detail.coverDays === 1 ? '' : 's'}`}
                  valueClass="text-violet-600"
                  bold
                />
              )}
              {detail.notes ? (
                <div className="py-1.5 text-xs">
                  <span className="mb-1 flex items-center gap-1.5 text-charcoal-500">Notes</span>
                  <p className="rounded-lg bg-charcoal-50 p-2.5 text-charcoal-700">{detail.notes}</p>
                </div>
              ) : null}
            </div>

            {(leave || others.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {leave && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-[10px] font-semibold text-charcoal-700">
                    {leave.type}
                    <span className="font-normal text-charcoal-300">·</span>
                    <StatusBadge status={leave.status} />
                  </span>
                )}
                {others.map((request) => (
                  <RequestChip key={request.id} type={request.type} status={request.status} />
                ))}
              </div>
            )}

            {detail.status !== 'Off' && (
              <button
                type="button"
                onClick={onCorrect}
                className="btn btn-md btn-primary mt-3 flex w-full items-center justify-center gap-2"
              >
                <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
                Request Correction
              </button>
            )}
          </div>

          {/* Section 2 — warnings & deductions raised on the day, each disputable on its own */}
          <div>
            <p className="bento-label mb-1.5 text-charcoal-500">WARNINGS & DEDUCTIONS</p>
            <div className="space-y-2">
              {warning && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-2.5">
                  <p className="text-xs font-semibold text-orange-800">{warning.type || 'Warning'}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-charcoal-700">{warning.reason}</p>
                </div>
              )}
              {deductions.map((deduction) => (
                <div key={deduction.id} className="rounded-lg border border-charcoal-200 bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-charcoal-900">{deduction.description}</p>
                    <Badge color={DEDUCTION_COLORS[deduction.status] ?? 'gray'}>{deduction.status}</Badge>
                  </div>
                  {deduction.detail && <p className="mt-1 text-[10px] text-charcoal-500">{deduction.detail}</p>}
                  <p className="mt-1 text-[11px] font-semibold text-charcoal-900">
                    {deduction.amount != null ? formatMoney(deduction.amount) : 'Amount pending — your manager will price it'}
                  </p>
                  {deduction.correctionRequestId != null ? (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-charcoal-500">
                      Correction
                      <StatusBadge status={requestStatusLabel(deduction.correctionStatus)} />
                    </div>
                  ) : deduction.date && isLiveDeduction(deduction) ? (
                    <button
                      type="button"
                      onClick={() => onCorrectDeduction(deduction)}
                      className="mt-2 rounded-lg border border-charcoal-200 px-2 py-1 text-[10px] font-semibold text-charcoal-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
                    >
                      Request correction
                    </button>
                  ) : null}
                </div>
              ))}
              {!warning && deductions.length === 0 && (
                <p className="text-[11px] text-charcoal-400">No warnings or deductions on this day.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onNewRequest}
            className="btn btn-md btn-secondary flex w-full items-center justify-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Create Another Request
          </button>
        </div>
      )}
    </Drawer>
  )
}

function DayRow({ label, value, valueClass, bold }: { label: string; value: string; valueClass?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-charcoal-100 py-1.5 text-xs">
      <span className="text-charcoal-500">{label}</span>
      <span className={cn(bold ? 'font-bold' : 'font-medium', valueClass ?? 'text-charcoal-900')}>{value}</span>
    </div>
  )
}
