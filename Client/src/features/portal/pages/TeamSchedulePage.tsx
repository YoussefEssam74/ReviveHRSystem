import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckSquare, Pencil, Plus, RotateCcw, Square, Trash2 } from 'lucide-react'
import {
  copyPreviousCycle,
  createShiftCycle,
  createShiftTemplate,
  deleteShiftCycle,
  deleteShiftTemplate,
  getShiftCycle,
  getShiftCycles,
  getShiftTemplates,
  publishShiftCycle,
  setShiftAssignments,
  updateShiftTemplate,
  type SetAssignmentInput,
  type ShiftCycleDetail,
  type ShiftCycleItem,
  type ShiftRosterRow,
  type ShiftTemplateDtoApi,
  type ShiftTemplateItem,
} from '../api/team.api'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { ConfirmDialog, Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { invalidateScheduleQueries, scheduleKeys } from '../api/schedule-keys'

/* ==================== date helpers ==================== */

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Local calendar date, yyyy-MM-dd ("today"). */
function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** Weekday short names indexed by getUTCDay() (0 = Sunday). */
const UTC_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Spec's weekday column names: 0 = Monday … 6 = Sunday. */
const DOW = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * One grid cell: a shift template id, null for an explicit Off day, or
 * 'unassigned' when no assignment row exists for that weekday.
 */
type CellPaint = number | null | 'unassigned'

interface ISODate {
  date: string
  num: number
  dow: string
}

/** Inclusive date enumeration between two ISO dates (UTC arithmetic — no DST surprises). */
function isoRange(from: string, to: string): ISODate[] {
  const out: ISODate[] = []
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  let cursor = Date.UTC(fy, fm - 1, fd)
  const end = Date.UTC(ty, tm - 1, td)
  while (cursor <= end) {
    const dt = new Date(cursor)
    out.push({
      date: `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`,
      num: dt.getUTCDate(),
      dow: UTC_DOW[dt.getUTCDay()],
    })
    cursor += 86_400_000
  }
  return out
}

/** Spec's weekday index (0 = Monday) of an ISO date. */
function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** ISO date shifted by whole days (UTC arithmetic — no DST surprises). */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`
}

function daysInMonthOf(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** "2026-10" → "October 2026". */
function monthLabelOf(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

/** Every month of the current year plus any month a cycle touches (spanning years). */
function monthWindow(cycles: ShiftCycleItem[], todayYm: string): string[] {
  const keys = new Set<string>([todayYm])
  const todayYear = Number(todayYm.slice(0, 4))
  const years = new Set<number>([todayYear])
  for (const cycle of cycles) {
    years.add(Number(cycle.startDate.slice(0, 4)))
    years.add(Number(cycle.endDate.slice(0, 4)))
  }
  for (const year of years) {
    for (let m = 1; m <= 12; m++) keys.add(`${year}-${pad2(m)}`)
  }
  return [...keys].sort()
}

type MonthLock = 'current' | 'past' | 'planned'

function monthLockOf(ym: string, todayYm: string): MonthLock {
  return ym === todayYm ? 'current' : ym < todayYm ? 'past' : 'planned'
}

const EDIT_CELL: Record<number, string> = {
  0: 'bg-charcoal-50',
  1: 'bg-charcoal-50/60',
  2: 'bg-charcoal-50',
  3: 'bg-charcoal-50/60',
  4: 'bg-charcoal-50',
  5: 'bg-brand-50/50',
  6: 'bg-brand-50/50',
}

/** "HH:mm" → "7:00 AM". */
function clock12(value: string): string {
  const [hourPart, minutePart] = value.split(':')
  const hour = Number(hourPart)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${minutePart} ${suffix}`
}

/** Row cell label: "7:00–3:00" or OFF. */
function cellLabel(template: ShiftTemplateItem): string {
  if (template.isOff) return 'OFF'
  return `${clock12(template.start)}–${clock12(template.end)}`
}

/* ==================== page ==================== */

export default function TeamSchedulePage() {
  const { me, isTeamLeader, isBranchManager, can } = usePortalSession()
  const location = useLocation()
  const gymId = me?.activeGym?.gymId ?? null
  const manage = can('schedule.manage')
  const title = isBranchManager ? 'Branch Schedule' : 'Team Schedule'
  // Deep link from the Branch Actions palette ("Publish Shift Schedule"):
  // /employee/team/schedule?edit=1 opens straight in Assign Shifts mode.
  const startEditing = new URLSearchParams(location.search).get('edit') === '1'

  if (!isTeamLeader && !isBranchManager) {
    return <EmptyState title="Schedule pages are for managers" hint="Assigning shifts needs a manager role in the active gym." />
  }
  if (gymId == null) {
    return <EmptyState title="No active gym" hint="Pick a gym branch to view its shift cycles." />
  }

  return <ScheduleWorkspace key={gymId} gymId={gymId} title={title} manage={manage} startEditing={startEditing} />
}

function ScheduleWorkspace({
  gymId,
  title,
  manage,
  startEditing = false,
}: {
  gymId: number
  title: string
  manage: boolean
  startEditing?: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const cyclesQuery = useQuery({
    queryKey: scheduleKeys.cycles(gymId),
    queryFn: ({ signal }) => getShiftCycles(gymId, signal),
  })

  const [month, setMonth] = useState<string | null>(null)
  const [view, setView] = useState<'week' | 'month'>('week')
  const [explicitId, setExplicitId] = useState<number | null>(null)
  const [editing, setEditing] = useState(startEditing)
  const [createOpen, setCreateOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

  const cycles = useMemo(() => cyclesQuery.data ?? [], [cyclesQuery.data])
  const today = todayISO()
  const todayYm = today.slice(0, 7)
  const selMonth = month ?? todayYm
  const months = useMemo(() => monthWindow(cycles, todayYm), [cycles, todayYm])
  const selLock = monthLockOf(selMonth, todayYm)
  const monthFirst = `${selMonth}-01`
  const monthLast = `${selMonth}-${pad2(daysInMonthOf(selMonth))}`
  const monthCycles = useMemo(
    () =>
      cycles
        .filter((c) => c.startDate <= monthLast && c.endDate >= monthFirst)
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    [cycles, monthFirst, monthLast],
  )
  const coveringToday = monthCycles.filter((c) => c.startDate <= today && today <= c.endDate)
  // Default to the cycle employees actually see: the Published one covering
  // today. A Draft still gets its chip (and becomes the default only when no
  // published cycle covers today), so managers are one click away from it but
  // the initial view never silently disagrees with a staff member's Shift tab.
  const derivedId =
    coveringToday.findLast((c) => c.status === 'Published')?.id ??
    coveringToday.findLast((c) => c.status === 'Draft')?.id ??
    monthCycles[monthCycles.length - 1]?.id ??
    null
  const selectedId = explicitId ?? derivedId
  const selectedCycle = cycles.find((c) => c.id === selectedId) ?? null
  const canEdit = manage && selectedCycle?.status !== 'Archived' && selectedCycle != null

  const pickMonth = (ym: string) => {
    setMonth(ym)
    setExplicitId(null)
    setEditing(false)
    setView('week')
  }

  if (cyclesQuery.isLoading) return <LoadingState />
  if (cyclesQuery.error)
    return <ErrorState message={describeApiError(cyclesQuery.error)} onRetry={() => cyclesQuery.refetch()} />

  const histDesc =
    selLock === 'current'
      ? 'Live month — pick a period below to view or assign shifts.'
      : selLock === 'past'
        ? 'Past month — published and draft schedules of that month.'
        : 'Future month — plan ahead and assign shifts.'

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <CalendarGlyph className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-charcoal-900">{title}</h1>
            <p className="mt-0.5 text-xs text-charcoal-500">{histDesc}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {manage && editing && (
            <Button size="sm" variant="secondary" onClick={() => setTemplateOpen(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> New Template
            </Button>
          )}
          {manage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Create New Schedule
            </Button>
          )}
          {manage && selectedCycle && (
            <Button
              size="sm"
              variant={editing && canEdit ? 'primary' : 'secondary'}
              onClick={() => setEditing((value) => !value)}
              title="Paint shifts in the grid below — pick a shift in the palette, then click or drag across cells."
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Assign Shifts
            </Button>
          )}
        </div>
      </div>

      {/* Main card */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        {/* Month dropdown + state dot */}
        <div className="flex flex-wrap items-center gap-3 px-4 pb-2 pt-3">
          <label className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400" htmlFor="schedule-month">
            Month
          </label>
          <select
            id="schedule-month"
            value={selMonth}
            onChange={(e) => pickMonth(e.target.value)}
            className="flex-1 rounded-lg border border-charcoal-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-charcoal-800 shadow-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-[220px]"
          >
            {months.map((ym) => (
              <option key={ym} value={ym}>
                {monthLabelOf(ym)}
              </option>
            ))}
          </select>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 text-[10px] font-semibold',
              selLock === 'current' ? 'text-brand-600' : 'text-charcoal-400',
            )}
          >
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', selLock === 'current' ? 'bg-brand-500' : 'bg-charcoal-300')} />
            {selLock === 'current' ? 'Live' : selLock === 'past' ? 'Past' : 'Planned'}
          </span>
        </div>

        {/* Period strip */}
        {monthCycles.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-3">
            {monthCycles.map((cycle) => {
              const active = cycle.id === selectedId
              return (
                <button
                  key={cycle.id}
                  onClick={() => {
                    setExplicitId(cycle.id)
                    setEditing(false)
                    setView('week')
                  }}
                  className={cn(
                    'shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition-all',
                    active
                      ? 'border-brand-500 bg-brand-50/60 shadow-sm ring-1 ring-brand-500'
                      : 'border-charcoal-200 hover:border-charcoal-300 hover:bg-charcoal-50/60',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="whitespace-nowrap text-[11px] font-bold text-charcoal-900">{cycle.label}</p>
                    <StatusChip status={cycle.status} />
                  </div>
                  <p className="mt-0.5 whitespace-nowrap text-[9px] text-charcoal-500">
                    {isoRange(cycle.startDate, cycle.endDate).length} days
                  </p>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="px-4 pb-3">
            <EmptyState
              title={`No schedule covers ${monthLabelOf(selMonth)}`}
              hint="Create a schedule whose dates overlap this month, or pick another month."
              action={
                manage ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Create New Schedule
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}

        {selectedId != null && (
          <CycleDetailPanel
            gymId={gymId}
            cycleId={selectedId}
            view={view}
            onView={setView}
            editing={editing && canEdit}
            manage={manage}
            selMonth={selMonth}
            onDeleted={() => {
              setExplicitId(null)
              setEditing(false)
            }}
          />
        )}
      </div>

      {createOpen && (
        <CreateCycleModal
          gymId={gymId}
          defaultMonth={selMonth}
          months={months}
          existing={cycles}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setCreateOpen(false)
            setMonth(created.startDate.slice(0, 7))
            setExplicitId(created.id)
            setEditing(true)
            setView('week')
            void queryClient.invalidateQueries({ queryKey: scheduleKeys.cycles(gymId) })
            toast('Schedule created — assign shifts on the draft.')
          }}
        />
      )}
      {templateOpen && <ShiftTemplateManagerModal gymId={gymId} onClose={() => setTemplateOpen(false)} />}
    </div>
  )
}

function CalendarGlyph({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

function StatusChip({ status }: { status: string }) {
  const color =
    status === 'Draft' ? 'badge-yellow' : status === 'Published' ? 'badge-blue' : status === 'Archived' ? 'badge-gray' : 'badge-gray'
  return <span className={cn('badge', color)}>{status}</span>
}

/* ==================== cycle detail ==================== */

/**
 * One selected cycle: toolbar (view toggle, copy/delete/save/publish), paint
 * palette, legend and the date-column roster grid. Columns are real calendar
 * dates of the cycle — painting a weekday cell writes that weekday for every
 * matching date inside the cycle (the server's weekly-repeat semantics).
 */
function CycleDetailPanel({
  gymId,
  cycleId,
  view,
  onView,
  editing,
  manage,
  selMonth,
  onDeleted,
}: {
  gymId: number
  cycleId: number
  view: 'week' | 'month'
  onView: (view: 'week' | 'month') => void
  editing: boolean
  manage: boolean
  selMonth: string
  onDeleted: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    queryKey: scheduleKeys.cycle(cycleId),
    queryFn: ({ signal }) => getShiftCycle(cycleId, signal),
  })

  const [edits, setEdits] = useState<Map<string, number | null>>(new Map())
  const [paintPick, setPaintPick] = useState<{ kind: 'unset' } | { kind: 'off' } | { kind: 'tpl'; id: number }>({ kind: 'unset' })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const paintingRef = useRef(false)

  // Drag painting stops when the mouse is released anywhere on the page.
  useEffect(() => {
    const stop = () => {
      paintingRef.current = false
    }
    document.addEventListener('mouseup', stop)
    return () => document.removeEventListener('mouseup', stop)
  }, [])

  const detail = detailQuery.data
  const templates = useMemo(() => detail?.shiftTemplates ?? [], [detail])
  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])
  const isDraft = detail?.status === 'Draft'
  const activeTemplates = templates.filter((t) => !t.isOff)
  const paintValue: number | null =
    paintPick.kind === 'unset' ? (activeTemplates[0]?.id ?? null) : paintPick.kind === 'off' ? null : paintPick.id

  const invalidate = useCallback(() => {
    void invalidateScheduleQueries(queryClient)
  }, [queryClient])

  // Weekday-pattern value, still used for the "missing days" badge and as the
  // fallback when a response predates daysByDate. Pending paint edits are keyed
  // by weekday because the editor writes the whole weekday pattern.
  const weeklyCellValue = useCallback(
    (employeeId: number, day: number): CellPaint => {
      if (!detail) return 'unassigned'
      const key = `${employeeId}:${day}`
      if (edits.has(key)) return edits.get(key)!
      const row = detail.assignments.find((r) => r.employeeId === employeeId)
      if (!row) return 'unassigned'
      if (row.assignedDays?.[day] === false) return 'unassigned'
      if (row.assignedDays?.[day] === true) return row.days[day] ?? null
      // Older cached responses predate assignedDays: keep the old null = Off
      // behavior rather than flashing every day as unassigned.
      return row.days[day] ?? null
    },
    [detail, edits],
  )

  // Date-accurate value for the grid. A published cycle can hold a
  // date-specific override, so asking "what is Monday's pattern?" would show a
  // different shift from the employee's Shift tab. Prefer the exact date cell;
  // pending edits still paint the weekday they were made on.
  const cellValueForDate = useCallback(
    (employeeId: number, date: string): CellPaint => {
      if (!detail) return 'unassigned'
      const day = weekdayIndex(date)
      const key = `${employeeId}:${day}`
      if (edits.has(key)) return edits.get(key)!
      const row = detail.assignments.find((r) => r.employeeId === employeeId)
      if (!row) return 'unassigned'
      const byDate = row.daysByDate?.find((cell) => cell.date === date)
      if (byDate) return byDate.assigned ? (byDate.shiftTemplateId ?? null) : 'unassigned'
      return weeklyCellValue(employeeId, day)
    },
    [detail, edits, weeklyCellValue],
  )

  const setCell = useCallback((employeeId: number, day: number, templateId: number | null) => {
    setEdits((prev) => {
      const key = `${employeeId}:${day}`
      if (prev.get(key) === templateId) return prev
      const next = new Map(prev)
      next.set(key, templateId)
      return next
    })
  }, [])

  const saveMutation = useMutation({
    mutationFn: () => {
      const assignments: SetAssignmentInput[] = [...edits.entries()].map(([key, templateId]) => {
        const [employeeId, day] = key.split(':').map(Number)
        return { employeeId, day, shiftTemplateId: templateId }
      })
      return setShiftAssignments(cycleId, assignments)
    },
    onSuccess: (result) => {
      // A saved cell set is only half the job on a Draft: employees read
      // Published cycles, so the next action must be the publish step.
      toast(
        isDraft
          ? `${result.message || 'Shift assignments saved.'} This schedule is a Draft — press “Publish Shift” to make it visible in employees' Shift tabs.`
          : result.message || 'Shift assignments saved.',
      )
      setEdits(new Map())
      invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const publishMutation = useMutation({
    mutationFn: () => publishShiftCycle(cycleId),
    onSuccess: (result) => {
      toast(result.message || 'Schedule published.')
      invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const copyMutation = useMutation({
    mutationFn: () => copyPreviousCycle(cycleId, null),
    onSuccess: (result) => {
      toast(result.message)
      invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteShiftCycle(gymId, cycleId),
    onSuccess: () => {
      toast('Schedule deleted — the cycle and its assignments were removed.')
      setConfirmDelete(false)
      onDeleted()
      // Prune BEFORE refetching: with the stale cycles list still containing
      // the deleted cycle, the page and the sidebar badge kept selecting it and
      // refetched its detail — "Shift cycle not found" 404 noise on every delete.
      // Removing it from the list cache first re-derives the selection instantly.
      queryClient.setQueryData<ShiftCycleItem[]>(scheduleKeys.cycles(gymId), (old) =>
        old?.filter((c) => c.id !== cycleId),
      )
      queryClient.removeQueries({ queryKey: scheduleKeys.cycle(cycleId) })
      // The deleted cycle may have been the published one employees see, so
      // refresh their Shift tab/dashboard too — not just the branch list.
      void invalidateScheduleQueries(queryClient)
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast(describeApiError(error), 'error')
    },
  })

  if (detailQuery.isLoading) return <LoadingState />
  if (detailQuery.error)
    return <ErrorState message={describeApiError(detailQuery.error)} onRetry={() => detailQuery.refetch()} />
  if (!detail) return null

  // The visible day columns: week = the current week clipped to the cycle (the
  // same Mon–Sun an employee sees in their Shift tab); month = the selected
  // month ∩ the cycle range ("Show 30 days").
  const weekCols = weekColsOf(detail)
  const monthCols = monthColsOf(detail, selMonth)
  const cols = view === 'week' ? weekCols : monthCols
  const cycleDays = isoRange(detail.startDate, detail.endDate).length

  // Assignments are weekly patterns, so "missing" counts weekdays that have no
  // row yet (Not assigned) rather than every date they repeat on. This keeps the
  // number stable between the 7-day and whole-month views.
  const cycleWeekdays = (() => {
    const weekdays = new Set<number>()
    for (const day of isoRange(detail.startDate, detail.endDate)) weekdays.add(weekdayIndex(day.date))
    return [...weekdays]
  })()

  const missingDaysOf = (employeeId: number) =>
    cycleWeekdays.reduce((count, day) => count + (weeklyCellValue(employeeId, day) === 'unassigned' ? 1 : 0), 0)

  const employeesWithMissingDays = detail.assignments.filter((row) => missingDaysOf(row.employeeId) > 0).length

  // Visible non-Off cells.
  const assignedCount = detail.assignments.reduce(
    (acc, row) =>
      acc +
      cols.filter((col) => {
        const value = cellValueForDate(row.employeeId, col.date)
        if (typeof value !== 'number') return false
        const template = templateById.get(value)
        return template ? !template.isOff : true
      }).length,
    0,
  )

  const statsLabel =
    view === 'week'
      ? cols.length < cycleDays
        ? `${cols.length} of ${cycleDays} days (weekly repeat)`
        : `${cols.length} days`
      : `${cols.length} days · whole ${monthLabelOf(selMonth)}`

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-charcoal-100 px-4 py-2">
        <div className="flex items-center gap-2 text-[10px] text-charcoal-500">
          <span>{statsLabel}</span>
          <span>·</span>
          <span>{detail.assignments.length} employees</span>
          <span>·</span>
          <span>{assignedCount} shifts assigned</span>
          {employeesWithMissingDays > 0 && (
            <>
              <span>·</span>
              <span className="badge badge-yellow" title="Employees who still have weekdays marked Not assigned">
                {employeesWithMissingDays} with missing days
              </span>
            </>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {detail.conflicts.length > 0 && (
            <span className="badge badge-red flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {detail.conflicts.length} conflict
              {detail.conflicts.length === 1 ? '' : 's'}
            </span>
          )}
          <Button
            size="sm"
            variant={view === 'month' ? 'primary' : 'secondary'}
            onClick={() => onView(view === 'month' ? 'week' : 'month')}
            title={view === 'month' ? 'Back to the 7-day view — shifts repeat weekly' : 'Show the whole month (up to 31 days)'}
          >
            <CalendarGlyph className="h-3.5 w-3.5" aria-hidden="true" /> {view === 'month' ? 'Show 7 days' : 'Show 30 days'}
          </Button>
          {manage && editing && (
            <Button size="sm" variant="secondary" loading={copyMutation.isPending} onClick={() => copyMutation.mutate()}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Copy Previous
            </Button>
          )}
          {manage && (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete Schedule
            </Button>
          )}
          {manage && dirtyCountOf(edits) > 0 && (
            <Button
              size="sm"
              loading={saveMutation.isPending}
              disabled={!editing}
              onClick={() => saveMutation.mutate()}
            >
              Save {dirtyCountOf(edits)} cell{dirtyCountOf(edits) === 1 ? '' : 's'}
            </Button>
          )}
          {manage && isDraft && (
            <Button
              size="sm"
              // While there are unsaved painted cells, Save stays the primary
              // action; once saved (or read-only), publishing is the next step.
              variant={dirtyCountOf(edits) > 0 ? 'secondary' : 'primary'}
              loading={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
              title="Publish makes this schedule visible in every employee's Shift tab"
            >
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" /> Publish Shift
            </Button>
          )}
        </div>
      </div>

      {/* Draft visibility gate */}
      {isDraft && (
        <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Draft schedule.</span> Employees (and their profile Shift tab) can only see
            published schedules — paint the week, save, then press{' '}
            <span className="font-semibold">Publish Shift</span> above to make these shifts visible.
          </p>
        </div>
      )}

      {/* Hint */}
      <div className="border-t border-charcoal-100 px-4 py-2">
        <p className="text-[10px] text-charcoal-400">
          {editing
            ? isDraft
              ? 'Editing enabled — pick a shift below, then click or drag across the grid to paint it. “Off” books an explicit rest day; days left untouched stay “Not assigned”. Row ➤ and day ⬇ buttons fill in one click. Remember to Publish — draft shifts stay invisible to employees until then.'
              : 'Editing enabled — pick a shift below, then click or drag across the grid to paint it. “Off” books an explicit rest day; days left untouched stay “Not assigned”. Row ➤ and day ⬇ buttons fill in one click. This schedule is already Published — saved edits reach employees immediately; no re-publish is needed.'
            : isDraft
              ? 'Preview — read only. Press “Assign Shifts” above to paint shifts onto this draft.'
              : 'Preview — read only. Press “Assign Shifts” above to adjust shifts on this published schedule.'}
          {' '}The Missing column counts weekdays that still need a shift or an Off day.
          {view === 'month' && editing ? ' Whole month visible — a painted weekday repeats every following week inside the cycle.' : ''}
        </p>
      </div>

      {/* Paint palette */}
      {editing && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-charcoal-100 bg-brand-50/40 px-4 py-2">
          <span className="mr-1 shrink-0 text-[10px] font-semibold text-charcoal-600">Paint shift:</span>
          {activeTemplates.map((t) => {
            const selected = paintPick.kind === 'tpl' && paintPick.id === t.id
            return (
              <button
                key={t.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setPaintPick({ kind: 'tpl', id: t.id })}
                className={cn(
                  'shrink-0 rounded-lg border bg-white px-2 py-1 text-[10px] font-semibold transition-all',
                  selected ? 'border-brand-500 shadow-sm ring-2 ring-brand-400' : 'border-charcoal-200 hover:border-charcoal-300',
                )}
              >
                <span
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded border"
                  style={{ background: t.bgColor, borderColor: `${t.color}40` }}
                />
                {t.name}
                <span className="ml-1 font-normal text-charcoal-400">{cellLabel(t)}</span>
              </button>
            )
          })}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setPaintPick({ kind: 'off' })}
            className={cn(
              'shrink-0 rounded-lg border bg-white px-2 py-1 text-[10px] font-semibold transition-all',
              paintPick.kind === 'off' ? 'border-brand-500 shadow-sm ring-2 ring-brand-400' : 'border-charcoal-200 hover:border-charcoal-300',
            )}
          >
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded border border-charcoal-200 bg-charcoal-100" />
            Off
          </button>
          <span className="ml-auto hidden shrink-0 text-[10px] text-charcoal-400 sm:inline">
            Click a cell or drag across the grid to paint it.
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-charcoal-100 bg-charcoal-50/40 px-4 py-2 text-[10px] text-charcoal-500">
        {activeTemplates.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded border" style={{ background: t.bgColor, borderColor: `${t.color}40` }} />
            {t.name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded border border-dashed border-charcoal-300 bg-white" />
          Not assigned
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded border border-charcoal-200 bg-charcoal-100" />
          Off
        </span>
      </div>

      {/* Roster grid */}
      {detail.assignments.length === 0 ? (
        <div className="px-4 py-8">
          <EmptyState
            title="No employees in this cycle's roster"
            hint="Assignments appear for the gym's employees; either no workers belong here yet, or none are scheduled."
          />
        </div>
      ) : (
        <ScheduleGrid
          detail={detail}
          cols={cols}
          editing={editing}
          templateById={templateById}
          cellValueForDate={cellValueForDate}
          missingDaysOf={missingDaysOf}
          paintingRef={paintingRef}
          onCell={(employeeId, day) => setCell(employeeId, day, paintValue)}
          onRowFill={(row) => {
            const weekdays = [...new Set(cols.map((col) => weekdayIndex(col.date)))]
            weekdays.forEach((day) => setCell(row.employeeId, day, paintValue))
          }}
          onDayFill={(day) => {
            detail.assignments.forEach((row) => setCell(row.employeeId, day, paintValue))
          }}
        />
      )}

      {/* Conflicts */}
      {detail.conflicts.length > 0 && (
        <div className="border-t border-charcoal-100 px-4 py-3">
          <p className="bento-label text-red-700">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> CONFLICTS ({detail.conflicts.length})
          </p>
          <ul className="mt-2 space-y-1">
            {detail.conflicts.map((conflict, index) => (
              <li key={index} className="text-[11px] text-charcoal-600">
                {memberName(detail.assignments, conflict.employeeId)} · {DOW[conflict.day]} — {conflict.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Schedule"
        message="Delete this schedule cycle? Its assignments are removed with it — employees lose the shifts of this period. This cannot be undone."
        confirmLabel="Delete Schedule"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

/**
 * Week view = the week containing today, clipped to the cycle, so the Branch
 * Schedule and an employee's Shift tab compare the same Mon–Sun. When today is
 * outside the selected cycle (browsing a past/future period), fall back to the
 * cycle's first week.
 */
function weekColsOf(detail: ShiftCycleDetail): ISODate[] {
  const all = isoRange(detail.startDate, detail.endDate)
  const today = todayISO()
  if (today < detail.startDate || today > detail.endDate) {
    return all.slice(0, Math.min(7, all.length))
  }

  const monday = addDaysIso(today, -weekdayIndex(today))
  const sunday = addDaysIso(monday, 6)
  const start = monday < detail.startDate ? detail.startDate : monday
  const end = sunday > detail.endDate ? detail.endDate : sunday
  return isoRange(start, end)
}

/** Month view = the dates of the selected month that fall inside the cycle. */
function monthColsOf(detail: ShiftCycleDetail, selMonth: string): ISODate[] {
  const clippedStart = detail.startDate > `${selMonth}-01` ? detail.startDate : `${selMonth}-01`
  const clippedEnd = detail.endDate < `${selMonth}-${pad2(daysInMonthOf(selMonth))}`
    ? detail.endDate
    : `${selMonth}-${pad2(daysInMonthOf(selMonth))}`
  return clippedStart <= clippedEnd ? isoRange(clippedStart, clippedEnd) : []
}

function dirtyCountOf(edits: Map<string, number | null>): number {
  return edits.size
}

/* ==================== roster grid (date columns) ==================== */

function ScheduleGrid({
  detail,
  cols,
  editing,
  templateById,
  cellValueForDate,
  missingDaysOf,
  paintingRef,
  onCell,
  onRowFill,
  onDayFill,
}: {
  detail: ShiftCycleDetail
  cols: ISODate[]
  editing: boolean
  templateById: Map<number, ShiftTemplateItem>
  cellValueForDate: (employeeId: number, date: string) => CellPaint
  missingDaysOf: (employeeId: number) => number
  paintingRef: MutableRefObject<boolean>
  onCell: (employeeId: number, day: number) => void
  onRowFill: (row: ShiftRosterRow) => void
  onDayFill: (day: number) => void
}) {
  const { me, isBranchManager } = usePortalSession()
  // The gym-wide Branch Schedule roster includes every non-terminated gym
  // employee — including the manager's own record (a BM is staff of their
  // branch, by seed and by design). Mark that self-row so it reads as
  // intentional instead of looking like a data leak.
  const selfEmployeeId = me?.employeeId ?? null
  const selfBadge = (
    <span
      className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[9px] font-semibold text-brand-700"
      title="This row is your own employee record — a Branch Manager is staff of their branch too."
    >
      You{isBranchManager ? ' (Branch Manager)' : ''}
    </span>
  )

  return (
    <>
      {/* Desktop grid */}
      <div className="hidden flex-col overflow-x-auto px-1 pb-4 lg:flex">
        <table className="data-table" style={{ flex: '1 1 auto' }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-charcoal-50">Employee</th>
              <th className="text-center" title="Weekdays this employee has not been assigned yet">
                Missing
              </th>
              {cols.map((col) => {
                const day = weekdayIndex(col.date)
                return (
                  <th key={col.date} className="text-center">
                    <span className="block text-[11px] font-semibold text-charcoal-700">{col.num}</span>
                    <span className="text-[9px] font-normal text-charcoal-400">{col.dow}</span>
                    {editing && (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onDayFill(day)}
                        title={`Apply the selected shift to everyone on ${col.dow} ${col.num}`}
                        className="mx-auto mt-0.5 block rounded p-0.5 text-charcoal-400 hover:bg-brand-100 hover:text-brand-600"
                      >
                        <Square className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {detail.assignments.map((row) => (
              <tr key={row.employeeId}>
                <td className="sticky left-0 z-10 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                      {row.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-charcoal-900">{row.name}</p>
                      <p className="truncate text-[10px] text-charcoal-500">{row.position}</p>
                    </div>
                    {row.employeeId === selfEmployeeId && selfBadge}
                    {editing && (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onRowFill(row)}
                        title="Fill the visible days for this employee"
                        className="ml-auto shrink-0 rounded p-1 text-charcoal-400 hover:bg-brand-100 hover:text-brand-600"
                      >
                        <Square className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="text-center">
                  <MissingDaysBadge count={missingDaysOf(row.employeeId)} />
                </td>
                {cols.map((col) => {
                  const day = weekdayIndex(col.date)
                  const value = cellValueForDate(row.employeeId, col.date)
                  const unassigned = value === 'unassigned'
                  const template = typeof value === 'number' ? templateById.get(value) : undefined
                  const off = !unassigned && (value === null || template?.isOff === true)
                  return (
                    <td key={col.date} className={cn('text-center', editing && EDIT_CELL[day])}>
                      {editing ? (
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            paintingRef.current = true
                            onCell(row.employeeId, day)
                          }}
                          onMouseEnter={() => {
                            if (paintingRef.current) onCell(row.employeeId, day)
                          }}
                          className="schedule-shift-badge w-full cursor-pointer select-none border text-[10px] hover:opacity-90 hover:ring-1 hover:ring-brand-400"
                          style={unassigned ? UNASSIGNED_CELL : cellStyle(template, off)}
                        >
                          {unassigned ? 'Not assigned' : off ? 'OFF' : cellLabel(template ?? unknownTemplate())}
                        </button>
                      ) : (
                        <span
                          className="schedule-shift-badge inline-block border text-[10px]"
                          style={unassigned ? UNASSIGNED_CELL : cellStyle(template, off)}
                        >
                          {unassigned ? 'Not assigned' : off ? 'OFF' : (template?.start ?? '')}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-1.5 p-3 lg:hidden">
        {detail.assignments.map((row) => (
          <div key={row.employeeId} className="rounded-xl border border-charcoal-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                {row.initials}
              </span>
              <span className="min-w-0 truncate text-xs font-medium text-charcoal-900">{row.name}</span>
              {row.employeeId === selfEmployeeId && selfBadge}
              <MissingDaysBadge count={missingDaysOf(row.employeeId)} compact />
              {editing && (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onRowFill(row)}>
                  Fill visible
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {cols.map((col) => {
                const day = weekdayIndex(col.date)
                const value = cellValueForDate(row.employeeId, col.date)
                const unassigned = value === 'unassigned'
                const template = typeof value === 'number' ? templateById.get(value) : undefined
                const off = !unassigned && (value === null || template?.isOff === true)
                const label = `${col.num}/${col.dow}: ${unassigned ? 'Not assigned' : off ? 'OFF' : cellLabel(template ?? unknownTemplate())}`
                const style = unassigned ? UNASSIGNED_CELL : cellStyle(template, off)
                return editing ? (
                  <button
                    key={col.date}
                    type="button"
                    onClick={() => onCell(row.employeeId, day)}
                    className="schedule-shift-badge border text-[9px]"
                    style={style}
                  >
                    {label}
                  </button>
                ) : (
                  <span key={col.date} className="schedule-shift-badge border text-[9px]" style={style}>
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/** Per-employee gap indicator: amber while weekdays remain Not assigned. */
function MissingDaysBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  if (count <= 0) {
    return compact ? (
      <span className="badge badge-green shrink-0" aria-label="Every weekday is assigned or marked Off">
        Complete
      </span>
    ) : (
      <span className="text-[10px] text-charcoal-400" title="Every weekday is assigned or marked Off">
        0
      </span>
    )
  }

  return (
    <span
      className="badge badge-yellow shrink-0"
      title={`${count} weekday${count === 1 ? '' : 's'} not assigned yet`}
      aria-label={`${count} weekday${count === 1 ? '' : 's'} not assigned`}
    >
      {compact ? `${count} not assigned` : count}
    </span>
  )
}

function memberName(rows: ShiftRosterRow[], employeeId: number): string {
  return rows.find((r) => r.employeeId === employeeId)?.name ?? `#${employeeId}`
}

const FALLBACK_CELL: CSSProperties = { background: '#f5f5f6', color: '#6b7280', borderColor: '#e5e7eb80' }

const UNASSIGNED_CELL: CSSProperties = {
  background: '#ffffff',
  color: '#9ca3af',
  borderColor: '#d1d5db',
  borderStyle: 'dashed',
}

function cellStyle(template: ShiftTemplateItem | undefined, off: boolean): CSSProperties {
  if (off || !template) return FALLBACK_CELL
  return {
    background: template.bgColor,
    color: template.textColor,
    borderColor: `${template.color}40`,
  }
}

function unknownTemplate(): ShiftTemplateItem {
  return {
    id: -1,
    name: 'Unknown',
    start: '00:00',
    end: '00:00',
    color: '#9ca3af',
    bgColor: '#f3f4f6',
    textColor: '#4b5563',
    isOff: false,
  }
}

/* ==================== create cycle modal ==================== */

/**
 * Create New Schedule (mock): pick a month, then start/end dates constrained
 * to that month. The new draft opens in edit mode immediately after creation.
 */
export function CreateCycleModal({
  gymId,
  defaultMonth,
  months,
  existing,
  onClose,
  onCreated,
}: {
  gymId: number
  defaultMonth: string
  months: string[]
  existing: ShiftCycleItem[]
  onClose: () => void
  onCreated: (cycle: ShiftCycleItem) => void
}) {
  const [month, setMonth] = useState(defaultMonth)
  const [startDate, setStartDate] = useState(`${defaultMonth}-01`)
  const [endDate, setEndDate] = useState(`${defaultMonth}-${pad2(daysInMonthOf(defaultMonth))}`)

  const pickMonth = (ym: string) => {
    setMonth(ym)
    setStartDate(`${ym}-01`)
    setEndDate(`${ym}-${pad2(daysInMonthOf(ym))}`)
  }

  return (
    <CreateCycleInner
      gymId={gymId}
      month={month}
      months={months}
      existing={existing}
      startDate={startDate}
      endDate={endDate}
      pickMonth={pickMonth}
      setStartDate={setStartDate}
      setEndDate={setEndDate}
      onClose={onClose}
      onCreated={onCreated}
    />
  )
}

function CreateCycleInner({
  gymId,
  month,
  months,
  existing,
  startDate,
  endDate,
  pickMonth,
  setStartDate,
  setEndDate,
  onClose,
  onCreated,
}: {
  gymId: number
  month: string
  months: string[]
  existing: ShiftCycleItem[]
  startDate: string
  endDate: string
  pickMonth: (ym: string) => void
  setStartDate: (value: string) => void
  setEndDate: (value: string) => void
  onClose: () => void
  onCreated: (cycle: ShiftCycleItem) => void
}) {
  const { toast } = useToast()
  const createMutation = useMutation({
    mutationFn: () => createShiftCycle(gymId, { label: null, startDate, endDate }),
    onSuccess: (created) => onCreated(created),
    onError: (error) => toast(describeApiError(error), 'error'),
  })
  const dim = daysInMonthOf(month)
  const rangeInvalid = startDate > endDate
  // Mirror of the server's overlap rule — warn before the 400, not after.
  const overlapping = existing.filter((c) => c.startDate <= endDate && c.endDate >= startDate)
  const overlapBlocked = overlapping.length > 0

  return (
    <Modal
      open
      title="Create New Schedule"
      subtitle="Choose a date range within the month. A draft cycle is created and shifts can be assigned right away."
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!startDate || !endDate || rangeInvalid || overlapBlocked}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="form-label" htmlFor="cycle-month">
            Month
          </label>
          <select id="cycle-month" value={month} onChange={(e) => pickMonth(e.target.value)} className="form-input">
            {months.map((ym) => (
              <option key={ym} value={ym}>
                {monthLabelOf(ym)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="cycle-start">
              Start Date
            </label>
            <input
              id="cycle-start"
              type="date"
              value={startDate}
              min={`${month}-01`}
              max={`${month}-${pad2(dim)}`}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="cycle-end">
              End Date
            </label>
            <input
              id="cycle-end"
              type="date"
              value={endDate}
              min={`${month}-01`}
              max={`${month}-${pad2(dim)}`}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
        {rangeInvalid && <p className="text-[10px] text-red-500">Start date must be on or before the end date.</p>}
        {overlapBlocked && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
            A schedule already covers these dates ({overlapping.map((c) => c.label).join(', ')}). Delete it from the period
            strip first, or pick a different range.
          </p>
        )}
        <p className="bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-500">
          Ranges longer than a week open in a 7-day view where every shift repeats on the same weekday of the following
          weeks — the “Show 30 days” button reveals the full range. A cycle already covering these dates will be rejected
          by the server.
        </p>
      </div>
    </Modal>
  )
}

/* ==================== shift template manager ==================== */

/** Preset swatches; the native color input still allows any #rrggbb value. */
const TEMPLATE_COLORS = [
  '#0ea5e9',
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#f43f5e',
  '#a855f7',
  '#14b8a6',
  '#64748b',
]

/**
 * Shift Templates (the mock's "New Template" flow): masters the real CRUD
 * endpoints (POST/PUT/DELETE /api/gyms/{gymId}/shift-templates). The manager
 * chooses the base color; the API derives badge background/text tones and
 * deleting a template flips referencing cells to Off.
 */
function ShiftTemplateManagerModal({ gymId, onClose }: { gymId: number; onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const templatesQuery = useQuery({
    queryKey: scheduleKeys.templates(gymId),
    queryFn: ({ signal }) => getShiftTemplates(gymId, signal),
  })
  // null = create mode; number = edit that template.
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('16:00')
  const [color, setColor] = useState(TEMPLATE_COLORS[0])
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const templates = templatesQuery.data ?? []
  const editingTemplate = editId != null ? (templates.find((t) => t.id === editId) ?? null) : null
  const nextColor = TEMPLATE_COLORS[templates.length % TEMPLATE_COLORS.length]

  const invalidate = () => {
    // A template rename/recolor/delete changes every roster cell and the
    // employee Shift tab too, so refresh all schedule caches.
    void invalidateScheduleQueries(queryClient)
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editId == null
        ? createShiftTemplate(gymId, { name: name.trim(), start, end, color })
        : updateShiftTemplate(gymId, editId, { name: name.trim(), start, end, color }),
    onSuccess: (saved) => {
      toast(editId == null ? `Template “${saved.name}” created — it is in the paint palette now.` : `Template “${saved.name}” updated.`)
      invalidate()
      setEditId(null)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteShiftTemplate(gymId, deleteId!),
    onSuccess: () => {
      toast('Template deleted — cells that used it now show OFF.')
      setDeleteId(null)
      setEditId(null)
      invalidate()
    },
    onError: (error) => {
      setDeleteId(null)
      toast(describeApiError(error), 'error')
    },
  })

  const startEdit = (template: ShiftTemplateDtoApi) => {
    setEditId(template.id)
    setName(template.name)
    setStart(template.start.slice(0, 5))
    setEnd(template.end.slice(0, 5))
    setColor(template.color || TEMPLATE_COLORS[0])
  }

  const resetCreate = () => {
    setEditId(null)
    setName('')
    setStart('08:00')
    setEnd('16:00')
    setColor(nextColor)
  }

  const durationHours = (() => {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    if ([sh, sm, eh, em].some(Number.isNaN)) return null
    let mins = eh * 60 + em - (sh * 60 + sm)
    if (mins < 0) mins += 1440
    return Math.round((mins / 60) * 10) / 10
  })()

  const sameTime = start === end
  const overnight = end < start

  return (
    <>
      <Modal
        open
        title={editingTemplate ? `Edit Shift Template — ${editingTemplate.name}` : 'Shift Templates'}
        subtitle="Templates appear in the paint palette and the schedule legend; pick a color so each shift is easy to tell apart."
        onClose={onClose}
        width="wide"
        footer={
          <>
            {editingTemplate ? (
              <Button size="sm" variant="danger" className="mr-auto" onClick={() => setDeleteId(editingTemplate.id)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Form */}
          <div className="space-y-3 rounded-xl border border-charcoal-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">
              {editingTemplate ? 'Editing template' : 'Create new template'}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="form-label" htmlFor="tpl-name">
                  Template Name
                </label>
                <input
                  id="tpl-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Early Morning, Split, Part-time"
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="tpl-start">
                  Start Time
                </label>
                <input id="tpl-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label" htmlFor="tpl-end">
                  End Time
                </label>
                <input id="tpl-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="form-input" />
              </div>
            </div>
            <div>
              <label className="form-label" htmlFor="tpl-color">
                Shift Color
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {TEMPLATE_COLORS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    aria-label={`Use color ${candidate}`}
                    aria-pressed={color === candidate}
                    onClick={() => setColor(candidate)}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform hover:scale-105',
                      color === candidate ? 'border-charcoal-900 ring-2 ring-brand-300' : 'border-white',
                    )}
                    style={{ background: candidate }}
                  />
                ))}
                <input
                  id="tpl-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="ml-1 h-8 w-10 cursor-pointer rounded border border-charcoal-200 bg-white p-0.5"
                  title="Pick a custom color"
                />
                <span className="font-mono text-[10px] text-charcoal-500">{color}</span>
              </div>
            </div>
            <p className="bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-500">
              Duration: {durationHours == null ? 'set start and end times' : `${durationHours} hours`}
              {overnight ? ' — overnight shift, ends the next day.' : ''}
              {sameTime ? ' — start and end times must differ.' : ''}
            </p>
            <div className="flex justify-end gap-2 border-t border-charcoal-100 pt-3">
              {editingTemplate && (
                <Button size="sm" variant="secondary" onClick={resetCreate}>
                  Cancel edit
                </Button>
              )}
              <Button
                size="sm"
                disabled={!name.trim() || sameTime}
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </div>
          </div>

          {/* Existing templates */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">Existing templates</p>
            {templatesQuery.isLoading ? (
              <LoadingState />
            ) : templates.length === 0 ? (
              <p className="px-1 py-3 text-[11px] text-charcoal-500">No templates yet — create the first one above.</p>
            ) : (
              <div className="space-y-1.5">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border border-charcoal-200 px-3 py-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border"
                      style={{ background: t.color, borderColor: `${t.color}80` }}
                      aria-hidden="true"
                    />
                    <span className="max-w-[60%] truncate rounded bg-charcoal-50 px-2 py-1 text-[10px] font-semibold text-charcoal-600">
                      {t.name}
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-charcoal-500">
                      {t.start.slice(0, 5)} – {t.end.slice(0, 5)}
                      {t.end < t.start ? ' (+1 day)' : ''}
                    </span>
                    <div className="ml-auto flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">Delete {t.name}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={deleteId != null}
        title="Delete Shift Template"
        message="Delete this template? Schedule cells that reference it flip to OFF. This cannot be undone."
        confirmLabel="Delete Template"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteId(null)}
      />
    </>
  )
}
