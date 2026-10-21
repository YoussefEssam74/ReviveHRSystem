import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ChevronLeft, ChevronRight, Moon, Plus, Sun } from 'lucide-react'
import { getEmployeeDashboard } from '../api/dashboard.api'
import { getOwnAttendance, getOwnSchedule, type EmployeeAttendanceItem } from '../api/attendance.api'
import { getOwnRequests } from '../api/requests.api'
import { NewRequestModal } from '../components/NewRequestModal'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { StatusBadge } from '../../../components/ui/badge'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The caller's local calendar date — never UTC-derived: formatting a local
 *  Date with toISOString() replays the day a day short for positive UTC
 *  offsets (e.g. Egypt), breaking "today" and future-day shading. */
function todayIso(): string {
  const now = new Date()
  return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** DateOnly strings ("2026-10-20") sort lexicographically, so increments run
 *  on plain UTC-anchored arithmetic; local Date round-trips land a day early. */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return isoOf(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/** "08:00:00" → "8:00 AM". */
function time12(value: string | null): string {
  if (!value) return '—'
  const [h, m] = value.split(':')
  const hour = Number(h)
  if (Number.isNaN(hour)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${m ?? '00'} ${suffix}`
}

/** Short "8:00" → used inside tight calendar cells. */
function timeShort(value: string | null): string {
  if (!value) return '—'
  const [h, m] = value.split(':')
  const hour = Number(h)
  if (Number.isNaN(hour)) return value
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m ?? '00'}`
}

interface CellModel {
  date: string
  dayNum: number
  isToday: boolean
  isFuture: boolean
  shiftName: string | null
  start: string | null
  end: string | null
  isOff: boolean
  att: EmployeeAttendanceItem | null
  requests: Array<{ id: number; type: string; status: string }>
}

export default function MySchedulePage() {
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const monthIso = `${year}-${String(month).padStart(2, '0')}`
  const [selectedDate, setSelectedDate] = useState<string | null>(todayIso())
  const [dayRequestDate, setDayRequestDate] = useState<string | null>(null)

  const scheduleQuery = useQuery({
    queryKey: ['portal', 'schedule', employeeId, monthIso],
    queryFn: ({ signal }) => getOwnSchedule(employeeId!, monthIso, signal),
    enabled: employeeId != null,
  })
  const attendanceQuery = useQuery({
    queryKey: ['portal', 'attendance', employeeId, monthIso],
    queryFn: ({ signal }) => getOwnAttendance(employeeId!, monthIso, 1, signal),
    enabled: employeeId != null,
  })
  const requestsQuery = useQuery({
    queryKey: ['portal', 'requests', employeeId, 'list'],
    queryFn: ({ signal }) => getOwnRequests(employeeId!, signal),
    enabled: employeeId != null,
  })
  const dashboardQuery = useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: ({ signal }) => getEmployeeDashboard(signal),
    staleTime: 30_000,
    enabled: employeeId != null,
  })

  // Requests index by expanded DateOnly day, without triggering its own query state.
  const requestsByDay = useMemo(() => {
    const map = new Map<string, Array<{ id: number; type: string; status: string }>>()
    for (const request of requestsQuery.data ?? []) {
      const start = request.requestedDate
      const end = request.endDate ?? request.requestedDate
      for (let cursor = start; ; cursor = addDaysIso(cursor, 1)) {
        const list = map.get(cursor) ?? []
        list.push({ id: request.id, type: request.type, status: request.status })
        map.set(cursor, list)
        if (cursor >= end) break
      }
    }
    return map
  }, [requestsQuery.data])

  if (employeeId == null) {
    return (
      <EmptyState
        title="No employee profile"
        hint="This account is not linked to an employee profile, so it has no schedule to show."
      />
    )
  }
  if (scheduleQuery.isLoading) return <LoadingState label="Loading your schedule…" />
  if (scheduleQuery.isError) {
    return <ErrorState message={describeApiError(scheduleQuery.error)} onRetry={() => scheduleQuery.refetch()} />
  }
  if (attendanceQuery.isError) {
    return <ErrorState message={describeApiError(attendanceQuery.error)} onRetry={() => attendanceQuery.refetch()} />
  }

  const schedule = scheduleQuery.data
  const attByDay = new Map((attendanceQuery.data?.items ?? []).map((item) => [item.date, item]))
  const requests = requestsQuery.data ?? []
  const summary = dashboardQuery.data?.monthSummary ?? null

  const monthDate = new Date(year, month - 1, 1)
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`
  const lead = monthDate.getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate()
  const hasScheduleData = (schedule?.days.length ?? 0) > 0

  // Calendar cells derive from the published days themselves when available; a
  // month without published cycles renders only the leading blanks + empty grid.
  const cells: Array<CellModel | null> = []
  for (let i = 0; i < lead; i++) cells.push(null)
  if (schedule) {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = isoOf(year, month, day)
      const dayDto = schedule.days.find((d) => d.date === date)
      cells.push({
        date,
        dayNum: day,
        isToday: dayDto?.isToday ?? date === todayIso(),
        isFuture: date > todayIso(),
        shiftName: dayDto?.shiftName ?? null,
        start: dayDto?.start ?? null,
        end: dayDto?.end ?? null,
        isOff: dayDto?.isOff ?? false,
        att: attByDay.get(date) ?? null,
        requests: requestsByDay.get(date) ?? [],
      })
    }
  }

  const today = cells.find((cell) => cell?.isToday) ?? null
  const selected =
    cells.find((cell) => cell?.date === selectedDate) ?? today ?? cells.find(Boolean) ?? null

  function navigateMonth(direction: -1 | 1) {
    const d = new Date(year, month - 1 + direction, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setSelectedDate(null)
  }

  const attLine = (cell: CellModel) => {
    if (cell.att) {
      if (cell.att.status === 'Off') return <span className="text-[8px] font-medium text-charcoal-400">Off day</span>
      const statusColor =
        cell.att.status === 'Late'
          ? 'text-yellow-600'
          : cell.att.status === 'Absent'
            ? 'text-red-600'
            : 'text-brand-600'
      return (
        <span className={cn('text-[8px] font-semibold', statusColor)}>
          {timeShort(cell.att.checkIn)} → {timeShort(cell.att.checkOut)}
        </span>
      )
    }
    return (
      <span className="text-[8px] font-medium text-charcoal-400">
        {cell.isFuture ? 'Not yet' : 'No record'}
      </span>
    )
  }

  return (
    <div className="flex min-h-0 flex-col space-y-1">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-bold text-charcoal-900">My Schedule &amp; Attendance</h1>
          <p className="text-[9px] text-charcoal-500">Monthly view of your shifts, check-ins and requests</p>
        </div>
        {!hasScheduleData && schedule && (
          <p className="rounded-lg bg-yellow-50 px-2 py-1 text-[9px] font-medium text-yellow-700">
            No published shift cycles for this month yet
          </p>
        )}
      </div>

      {/* Month navigator + summary */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2 rounded-xl border border-charcoal-200 bg-white px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigateMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg p-1 transition-colors hover:bg-charcoal-50"
          >
            <ChevronLeft className="h-4 w-4 text-charcoal-600" aria-hidden="true" />
          </button>
          <div className="min-w-[110px] text-center">
            <p className="text-sm font-bold leading-none text-charcoal-900">{monthLabel}</p>
            <p className="mt-0.5 text-[9px] text-charcoal-500">{today ? `${today.date === todayIso() ? 'Today' : ''}` : 'Browse months'}</p>
          </div>
          <button
            type="button"
            onClick={() => navigateMonth(1)}
            aria-label="Next month"
            className="rounded-lg p-1 transition-colors hover:bg-charcoal-50"
          >
            <ChevronRight className="h-4 w-4 text-charcoal-600" aria-hidden="true" />
          </button>
        </div>
        {summary && (
          <div className="hidden flex-wrap items-center justify-end gap-2 text-[9px] text-charcoal-500 md:flex">
            <span className="font-bold text-brand-700">{Math.round(summary.rate)}%</span> rate
            <span className="text-charcoal-300">·</span>
            <span className="font-bold text-brand-600">{summary.present}</span> present
            <span className="text-charcoal-300">·</span>
            <span className="font-bold text-yellow-600">{summary.late}</span> late
            <span className="text-charcoal-300">·</span>
            <span className="font-bold text-red-600">{summary.absent}</span> absent
            <span className="text-charcoal-300">·</span>
            <span className="font-bold text-blue-600">{summary.earlyCheckout}</span> early
            <span className="text-charcoal-300">·</span>
            <span className="font-bold text-charcoal-600">{requests.length}</span> requests
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 px-1 text-[9px] text-charcoal-500">
        <span className="inline-flex items-center gap-1">
          <span className="schedule-shift-morning inline-block h-2.5 w-2.5 rounded border border-blue-200" />
          Morning
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="schedule-shift-evening inline-block h-2.5 w-2.5 rounded border border-green-200" />
          Evening
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="schedule-shift-off inline-block h-2.5 w-2.5 rounded border border-charcoal-200" />
          Off
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded border border-yellow-200 bg-yellow-100" />
          Pending Request
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded border border-brand-200 bg-brand-100" />
          Approved
        </span>
      </div>

      {/* Desktop: detail panel (left) + calendar (right) */}
      <div className="hidden min-h-0 flex-1 gap-2 lg:flex">
        {selected && <DayDetailPanel cell={selected} onNewRequest={() => setDayRequestDate(selected.date)} />}
        <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-charcoal-200 bg-white p-1">
          <div className="mb-0.5 grid flex-shrink-0 grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-0 text-center text-[8px] font-bold uppercase tracking-wider text-charcoal-400">
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-7 gap-1" style={{ gridAutoRows: '1fr' }}>
            {cells.map((cell, index) =>
              cell ? (
                <ScheduleCell
                  key={cell.date}
                  cell={cell}
                  selected={cell.date === selected?.date}
                  onSelect={() => setSelectedDate(cell.date)}
                  attLine={attLine(cell)}
                  onNewRequest={() => setDayRequestDate(cell.date)}
                />
              ) : (
                <div key={`lead-${index}`} className="h-full rounded-lg border border-dashed border-charcoal-200 bg-charcoal-50/40" />
              ),
            )}
          </div>
        </div>
      </div>

      {/* Mobile list */}
      <div className="flex-shrink-0 space-y-1.5 lg:hidden">
        {cells.filter(Boolean).length === 0 ? (
          <EmptyState title="No published schedule for this month" />
        ) : (
          cells.filter(Boolean).map((cell) => <MobileDayCard key={cell!.date} cell={cell!} onNewRequest={() => setDayRequestDate(cell!.date)} />)
        )}
      </div>

      {dayRequestDate && employeeId != null && (
        <NewRequestModal employeeId={employeeId} presetDate={dayRequestDate} onClose={() => setDayRequestDate(null)} />
      )}
    </div>
  )
}

/* ==================== Calendar cell ==================== */

function shiftPillClass(cell: CellModel): string {
  if (cell.isOff || !cell.shiftName) return 'schedule-shift-off'
  const name = cell.shiftName.toLowerCase()
  if (name.includes('morning')) return 'schedule-shift-morning'
  if (name.includes('evening')) return 'schedule-shift-evening'
  return 'schedule-shift-off'
}

function ScheduleCell({
  cell,
  selected,
  onSelect,
  attLine,
  onNewRequest,
}: {
  cell: CellModel
  selected: boolean
  onSelect: () => void
  attLine: React.ReactNode
  onNewRequest: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect()
      }}
      className={cn(
        'flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-white p-1 transition-all hover:shadow-md',
        selected
          ? 'border-brand-300 ring-2 ring-brand-500'
          : cell.isToday
            ? 'border-brand-200 ring-1 ring-brand-300'
            : 'border-charcoal-200',
      )}
    >
      <div className="flex items-center justify-between leading-none">
        <p className={cn('text-[11px] font-bold', cell.isToday ? 'text-brand-600' : 'text-charcoal-900')}>{cell.dayNum}</p>
        {cell.isToday && <span className="text-[7px] font-bold uppercase tracking-wide text-brand-600">Today</span>}
      </div>
      <div className="mt-0.5 leading-none">
        {cell.isOff ? (
          <span className={cn('inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-semibold', shiftPillClass(cell))}>
            <Moon className="h-2 w-2" aria-hidden="true" />
            OFF
          </span>
        ) : cell.shiftName ? (
          <span className={cn('inline-flex rounded px-1 py-0.5', shiftPillClass(cell))}>
            <span className="text-[8px] font-bold leading-none">
              {cell.shiftName} · {timeShort(cell.start)}–{timeShort(cell.end)}
            </span>
          </span>
        ) : (
          <span className={cn('inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-semibold', shiftPillClass(cell))}>
            <Sun className="h-2 w-2" aria-hidden="true" />
            No shift
          </span>
        )}
      </div>
      <div className="mt-0.5 leading-none">{attLine}</div>
      {cell.requests.length > 0 && (
        <div className="mt-0.5 flex items-center gap-0.5 overflow-hidden">
          {cell.requests.slice(0, 2).map((request) => {
            const chip =
              request.status === 'Approved'
                ? 'bg-brand-100 text-brand-700'
                : request.status === 'Rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
            return (
              <span key={request.id} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold', chip)}>
                {request.type}
              </span>
            )
          })}
          {cell.requests.length > 2 && <span className="text-[8px] font-semibold text-charcoal-400">+{cell.requests.length - 2}</span>}
        </div>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onNewRequest()
        }}
        className="mt-auto inline-flex w-full items-center justify-center gap-0.5 rounded border border-charcoal-200 px-1 py-0.5 text-[8px] font-semibold text-charcoal-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
      >
        <Plus className="h-2 w-2" aria-hidden="true" />
        Request
      </button>
    </div>
  )
}

/* ==================== Day detail (desktop panel / mobile card) ==================== */

function DayDetailPanel({ cell, onNewRequest }: { cell: CellModel; onNewRequest: () => void }) {
  const dateObj = new Date(cell.date + 'T00:00:00')
  const longLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const weekday = cell.date ? dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : ''

  return (
    <div className="sched-detail-panel flex w-64 flex-shrink-0 flex-col gap-3 overflow-y-auto">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-bold text-charcoal-900">{longLabel}</h3>
          {cell.isToday && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-semibold text-brand-700">Today</span>
          )}
        </div>
        <p className="text-[10px] text-charcoal-500">{weekday} · {cell.dayNum}</p>
      </div>

      {/* Assigned shift */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal-700">Assigned Shift</p>
        {cell.isOff ? (
          <div className="flex items-center gap-2 rounded-lg bg-charcoal-50 p-2.5">
            <span className="schedule-shift-off rounded px-2 py-0.5 text-[10px] font-semibold">OFF DAY</span>
            <span className="text-[10px] text-charcoal-500">No shift scheduled</span>
          </div>
        ) : cell.shiftName ? (
          <div className="flex items-center justify-between rounded-lg bg-charcoal-50 p-2.5">
            <div>
              <p className="text-xs font-semibold text-charcoal-900">{cell.shiftName} Shift</p>
              <p className="text-[10px] text-charcoal-500">
                {time12(cell.start)} – {time12(cell.end)}
              </p>
            </div>
            <span className={cn('rounded px-2 py-0.5 text-[10px] font-semibold', shiftPillClass(cell))}>{cell.shiftName}</span>
          </div>
        ) : (
          <div className="rounded-lg bg-charcoal-50 p-2.5 text-[10px] text-charcoal-500">No shift was published for this day</div>
        )}
      </div>

      {/* Attendance */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal-700">Attendance</p>
        {cell.att ? (
          <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200 bg-white">
            <DetailRow label="Check In" value={<span className={cell.att.status === 'Absent' ? 'text-red-600' : 'text-brand-600'}>{time12(cell.att.checkIn)}</span>} />
            <DetailRow label="Check Out" value={<span className="font-semibold text-charcoal-800">{time12(cell.att.checkOut)}</span>} />
            <DetailRow label="Status" value={<StatusBadge status={cell.att.status} />} />
            {cell.att.notes && (
              <div className="p-2.5">
                <span className="text-[10px] text-charcoal-500">Notes</span>
                <p className="mt-0.5 text-[10px] text-charcoal-700">{cell.att.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-charcoal-50 p-2.5 text-[10px] text-charcoal-500">
            {cell.isFuture ? 'Not yet recorded' : 'No attendance record'}
          </div>
        )}
      </div>

      {/* Requests */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <Calendar className="h-3 w-3 text-orange-500" aria-hidden="true" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-700">Requests</p>
        </div>
        {cell.requests.length > 0 ? (
          <div className="space-y-1">
            {cell.requests.map((request) => (
              <div key={request.id} className="rounded-lg border border-orange-100 bg-orange-50 p-2">
                <div className="mb-0.5 flex items-center justify-between">
                  <p className="text-[10px] font-medium text-charcoal-900">{request.type}</p>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[8px]',
                      request.status === 'Approved'
                        ? 'bg-green-100 text-green-700'
                        : request.status === 'Rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700',
                    )}
                  >
                    {request.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] italic text-charcoal-400">No requests for this day</p>
        )}
      </div>

      <button type="button" onClick={onNewRequest} className="btn btn-sm btn-secondary w-full">
        + Request for this day
      </button>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-2.5">
      <span className="text-[10px] text-charcoal-500">{label}</span>
      {value}
    </div>
  )
}

function MobileDayCard({ cell, onNewRequest }: { cell: CellModel; onNewRequest: () => void }) {
  return (
    <div className="card card-interactive p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-charcoal-900">{cell.dayNum}</p>
          <p className="text-[10px] text-charcoal-500">
            {cell.isOff
              ? 'Off day'
              : cell.shiftName
                ? `${cell.shiftName} · ${timeShort(cell.start)}–${timeShort(cell.end)}`
                : 'No shift published'}
          </p>
        </div>
        <div className="text-right">
          {cell.att ? (
            <StatusBadge status={cell.att.status} />
          ) : (
            <span className="text-[10px] text-charcoal-400">{cell.isFuture ? 'Not yet' : 'No record'}</span>
          )}
          {cell.att && (
            <p className="mt-1 text-[10px] text-charcoal-600">
              {timeShort(cell.att.checkIn)} → {timeShort(cell.att.checkOut)}
            </p>
          )}
        </div>
      </div>
      {cell.requests.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {cell.requests.map((request) => (
            <span
              key={request.id}
              className={cn(
                'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold',
                request.status === 'Approved'
                  ? 'bg-brand-100 text-brand-700'
                  : request.status === 'Rejected'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700',
              )}
            >
              {request.type}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[9px] text-charcoal-400">{cell.isToday ? 'Today' : ''}</p>
        <button
          type="button"
          onClick={onNewRequest}
          className="inline-flex items-center gap-1 rounded border border-charcoal-200 px-2 py-1 text-[9px] font-semibold text-charcoal-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        >
          <Plus className="h-2.5 w-2.5" aria-hidden="true" />
          Request
        </button>
      </div>
    </div>
  )
}
