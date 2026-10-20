import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus, SquarePen } from 'lucide-react'
import { getEmployeeDashboard } from '../api/dashboard.api'
import {
  getOwnAttendance,
  getOwnLeaveBalance,
  type EmployeeAttendanceItem,
} from '../api/attendance.api'
import { getExcusedHoursBudget, getOwnRequests, getRequestTypes } from '../api/requests.api'
import { NewRequestModal } from '../components/NewRequestModal'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Drawer } from '../../../components/ui/drawer'
import { StatusBadge } from '../../../components/ui/badge'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateWithYear } from '../../../lib/format'
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

export default function MyAttendancePage() {
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null

  const [month, setMonth] = useState<string>(currentMonthIso())
  const [detailDate, setDetailDate] = useState<string | null>(null)
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

  // Off days (no shift planned) are omitted from the history like in the mock.
  const history = (attendance?.items ?? []).filter((item) => {
    const shift = item.shift.trim().toLowerCase()
    return shift !== '' && shift !== 'off'
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
  const LEAVE_TYPES = new Set(['Annual Leave', 'Sick Leave', 'Paid Holiday'])
  function leaveOn(isoDate: string) {
    return requestsOn(isoDate).find((request) => LEAVE_TYPES.has(request.type) && request.status === 'Approved') ?? null
  }

  const detail = detailDate ? attendance?.items.find((item) => item.date === detailDate) ?? null : null
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
          <div className="grid grid-cols-2 divide-y divide-charcoal-100 lg:grid-cols-5 lg:divide-y-0 lg:divide-x">
            <div className="px-3 py-2.5">
              <p className="bento-label mb-1 text-charcoal-400">ASSIGNED SHIFT</p>
              <p className="text-sm font-bold leading-snug text-charcoal-900">{dashboard.todayShift?.shiftName ?? 'Off'}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-charcoal-500">
                {dashboard.todayShift ? `${time12(dashboard.todayShift.start)} – ${time12(dashboard.todayShift.end)}` : 'no shift today'}
              </p>
            </div>
            <div className="px-3 py-2.5">
              <p className="bento-label mb-1 text-charcoal-400">CHECK-IN</p>
              <p className={cn('text-sm font-bold leading-snug', today?.checkIn ? 'text-brand-600' : 'text-charcoal-400')}>
                {time12(today?.checkIn ?? null)}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-charcoal-500">
                {today?.checkIn ? dashboard.user.gymName : 'not checked in'}
              </p>
            </div>
            <div className="px-3 py-2.5">
              <p className="bento-label mb-1 text-charcoal-400">CHECK-OUT</p>
              <p className={cn('text-sm font-bold leading-snug', today?.checkOut ? 'text-charcoal-900' : 'text-charcoal-400')}>
                {time12(today?.checkOut ?? null)}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-charcoal-500">{today?.checkOut ? 'completed' : 'in progress'}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="bento-label mb-1 text-charcoal-400">WORKING HOURS</p>
              <p className="text-sm font-bold leading-snug text-charcoal-900">{workedLabel(workedToday)}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-charcoal-500">{today?.checkOut ? 'day complete' : 'updating live'}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="bento-label mb-1 text-charcoal-400">ATTENDANCE STATUS</p>
              <div className="mt-0.5">
                {today ? <StatusBadge status={today.status} /> : <StatusBadge status="Off" />}
              </div>
              <p className="mt-1 text-[10px] leading-snug text-charcoal-500">{today?.source || 'No action needed'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats row (the dashboard aggregate's real month summary) */}
      {dashboard && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <StatPill value={`${Math.round(dashboard.monthSummary.rate)}%`} label="Attendance Rate" color="text-brand-700" accent="border-l-brand-500" />
          <StatPill value={dashboard.monthSummary.present} label="Present" color="text-brand-600" accent="border-l-brand-500" />
          <StatPill value={dashboard.monthSummary.late} label="Late" color="text-yellow-600" accent="border-l-yellow-500" />
          <StatPill value={dashboard.monthSummary.absent} label="Absent" color="text-red-600" accent="border-l-red-500" />
          <StatPill value={dashboard.monthSummary.earlyCheckout} label="Early Out" color="text-blue-600" accent="border-l-blue-500" />
          <StatPill value={dashboard.monthSummary.missingCheckout} label="Missing Out" color="text-charcoal-600" accent="border-l-charcoal-400" />
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
          {typesQuery.isError ? (
            <p className="text-[11px] text-red-600">{describeApiError(typesQuery.error)}</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {(typesQuery.data ?? []).map((type) => (
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

      {/* Attendance history */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs font-bold text-charcoal-900">Attendance History</p>
        <select
          className="form-select w-36"
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

      <div className="card hidden overflow-hidden lg:block">
        {history.length === 0 ? (
          <EmptyState title="No attendance records for this month" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-charcoal-100 text-charcoal-500">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Shift</th>
                  <th className="px-4 py-2.5 font-medium">Check In</th>
                  <th className="px-4 py-2.5 font-medium">Check Out</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Requests</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const leave = leaveOn(item.date)
                  const others = requestsOn(item.date).filter((r) => r !== leave)
                  return (
                    <tr
                      key={item.date}
                      className="cursor-pointer border-b border-charcoal-50 transition-colors last:border-0 hover:bg-charcoal-50"
                      onClick={() => setDetailDate(item.date)}
                    >
                      <td className="px-4 py-2.5 font-medium">{formatDate(item.date)}</td>
                      <td className="px-4 py-2.5">{item.shift}</td>
                      <td className="px-4 py-2.5">{time12(item.checkIn)}</td>
                      <td className="px-4 py-2.5">{time12(item.checkOut)}</td>
                      <td className="px-4 py-2.5">
                        {leave ? <StatusBadge status={leave.status} /> : <StatusBadge status={item.status} />}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {others.map((request) => (
                            <RequestChip key={request.id} type={request.type} status={request.status} />
                          ))}
                        </div>
                      </td>
                      <td className="px-2">
                        <ChevronRight className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
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
          return (
            <div key={item.date} className="card card-interactive cursor-pointer p-3" onClick={() => setDetailDate(item.date)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-charcoal-900">{formatDate(item.date)}</p>
                  <p className="text-[10px] text-charcoal-500">{item.shift}</p>
                </div>
                {leave ? <StatusBadge status={leave.status} /> : <StatusBadge status={item.status} />}
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

      <AttendanceDetailDrawer
        detailDate={detailDate}
        detail={detail}
        leave={detailLeave}
        others={detailOthers}
        onClose={() => setDetailDate(null)}
        onCorrect={() => {
          const date = detailDate ?? undefined
          setDetailDate(null)
          setRequestDraft({ typeId: CHECK_IN_CORRECTION_ID, date })
        }}
        onNewRequest={() => {
          setDetailDate(null)
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
    <div className={cn('card flex flex-col items-center rounded-xl border-l-4 px-2 py-2 text-center', accent)}>
      <p className={cn('text-base font-bold leading-none', color)}>{value}</p>
      <p className="mt-1 text-[9px] leading-tight text-charcoal-500">{label}</p>
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
      <span className="w-16 flex-shrink-0 truncate text-[10px] font-medium text-charcoal-600">{label}</span>
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

/** The mock's day-detail drawer: day facts + the requests riding on the day. */
function AttendanceDetailDrawer({
  detailDate,
  detail,
  leave,
  others,
  onClose,
  onCorrect,
  onNewRequest,
}: {
  detailDate: string | null
  detail: EmployeeAttendanceItem | null
  leave: { type: string; status: string } | null
  others: Array<{ id: number; type: string; status: string }>
  onClose: () => void
  /** Opens the New Request modal directly on the Check-in Correction type for this day. */
  onCorrect: () => void
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

          <div className="space-y-2">
            <DayRow label="Scheduled Shift" value={detail.shift} />
            <DayRow label="Check In" value={time12(detail.checkIn)} valueClass={detail.checkIn ? 'text-brand-600' : 'text-charcoal-400'} bold />
            <DayRow label="Check Out" value={time12(detail.checkOut)} bold />
            {detail.notes ? (
              <div className="py-1.5 text-xs">
                <span className="mb-1 flex items-center gap-1.5 text-charcoal-500">Notes</span>
                <p className="rounded-lg bg-charcoal-50 p-2.5 text-charcoal-700">{detail.notes}</p>
              </div>
            ) : null}
          </div>

          {(leave || others.length > 0) && (
            <div>
              <p className="bento-label mb-1.5 text-charcoal-500">LEAVE & REQUESTS</p>
              <div className="flex flex-wrap gap-1.5">
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
            </div>
          )}

          <div className="space-y-2">
            {detail.status !== 'Off' && (
              <button
                type="button"
                onClick={onCorrect}
                className="btn btn-md btn-primary flex w-full items-center justify-center gap-2"
              >
                <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
                Request Correction
              </button>
            )}
            <button
              type="button"
              onClick={onNewRequest}
              className="btn btn-md btn-secondary flex w-full items-center justify-center gap-2"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create Another Request
            </button>
          </div>
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
