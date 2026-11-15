import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useMutation, useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckSquare, MoreHorizontal, PaintBucket, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
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
import { formatDate, formatTimeOfDay } from '../../../lib/format'
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

/** "2026-10" → "October 2026" ("أكتوبر 2026" once the month name is translated). */
function monthLabelOf(ym: string, t: TFunction): string {
  const [y, m] = ym.split('-').map(Number)
  const monthName = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' })
  return `${t(monthName)} ${y}`
}

/** ISO "2026-09-01" → "Sep 1" from the local calendar (no UTC day shift). */
function isoDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return formatDate(new Date(y, m - 1, d), { withYear: 'auto' })
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

/** Week / Month switcher — labels are English keys, translated at render. */
const VIEW_OPTIONS: { value: 'week' | 'month'; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

/** "HH:mm" → "7:00 AM" / "7:00 ص". */
function clock12(value: string): string {
  return formatTimeOfDay(value)
}

/** Row cell label: "7:00–3:00" or OFF. */
function cellLabel(template: ShiftTemplateItem, t: TFunction): string {
  if (template.isOff) return t('OFF')
  return `${clock12(template.start)}–${clock12(template.end)}`
}

/** Compact "7a–3p" label for the mobile grid's narrow day columns. */
function shortCellLabel(template: ShiftTemplateItem, t: TFunction): string {
  if (template.isOff) return t('OFF')
  const compact = (value: string) => {
    const [hourPart, minutePart] = value.split(':')
    const hour = Number(hourPart)
    if (Number.isNaN(hour)) return value
    // "AM" → "a" / "PM" → "p"; the single-letter Arabic marker (ص/م) is kept whole.
    const meridiem = hour >= 12 ? t('PM') : t('AM')
    const suffix = meridiem.length === 1 ? meridiem : meridiem.toLowerCase().slice(0, 1)
    const display = hour % 12 === 0 ? 12 : hour % 12
    return minutePart && minutePart !== '00' ? `${display}:${minutePart}${suffix}` : `${display}${suffix}`
  }
  return `${compact(template.start)}–${compact(template.end)}`
}

/* ==================== page ==================== */

export default function TeamSchedulePage() {
  const { t } = useTranslation()
  const { me, isTeamLeader, isBranchManager, can } = usePortalSession()
  const location = useLocation()
  const gymId = me?.activeGym?.gymId ?? null
  const manage = can('schedule.manage')
  const title = isBranchManager ? t('Branch Schedule') : t('Team Schedule')
  // Deep link from the Branch Actions palette ("Publish Shift Schedule"):
  // /employee/team/schedule?edit=1 opens straight in Assign Shifts mode.
  const startEditing = new URLSearchParams(location.search).get('edit') === '1'

  if (!isTeamLeader && !isBranchManager) {
    return (
      <EmptyState
        title={t('Schedule pages are for managers')}
        hint={t('Assigning shifts needs a manager role in the active gym.')}
      />
    )
  }
  if (gymId == null) {
    return <EmptyState title={t('No active gym')} hint={t('Pick a gym branch to view its shift cycles.')} />
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
  const { t } = useTranslation()
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

  return (
    // Desktop pins the page to the viewport: the roster body scrolls inside the
    // card, so the title, filters and legend never leave the screen. The negative
    // margins trim the shared <main> padding (16px top / 32px bottom) down to an
    // 8px inset — still a visible frame, but the height goes to the table.
    <div className="schedule-page flex flex-col gap-3 lg:-mb-6 lg:-mt-2 lg:h-[calc(100dvh-4.5rem)] lg:min-h-0 lg:gap-2">
      {/* Header — one primary action; the rare cycle actions live in the toolbar menu. */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center lg:shrink-0">
        <div className="flex items-center gap-3">
          {/* brand-700 flips to a light green under .dark, so the glyph stays
              legible on the dark tint instead of going dark-on-dark. */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <CalendarGlyph className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-charcoal-900">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {manage && (
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t('New Schedule')}
            </Button>
          )}
          {manage && selectedCycle && (
            <Button
              size="sm"
              // The one action a manager comes here for, so it carries the
              // primary fill until the grid is already in edit mode.
              variant={editing ? 'outline' : 'primary'}
              aria-pressed={editing}
              onClick={() => setEditing((value) => !value)}
              title={t('Paint shifts in the grid below — pick a shift in the palette, then click or drag across cells.')}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />{' '}
              {editing ? t('Exit editing') : t('Assign Shifts')}
            </Button>
          )}
        </div>
      </div>

      {/* Main card */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:flex-1">
        {/* Period + view controls — one row, no label restating what the value says. */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:shrink-0">
          <select
            id="schedule-month"
            aria-label={t('Month')}
            value={selMonth}
            onChange={(e) => pickMonth(e.target.value)}
            className="rounded-lg border border-charcoal-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-charcoal-800 shadow-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-[220px]"
          >
            {months.map((ym) => (
              <option key={ym} value={ym}>
                {monthLabelOf(ym, t)}
              </option>
            ))}
          </select>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 text-[10px] font-semibold',
              selLock === 'current' ? 'text-brand-700' : 'text-charcoal-500',
            )}
          >
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', selLock === 'current' ? 'bg-brand-500' : 'bg-charcoal-300')} />
            {selLock === 'current' ? t('Live') : selLock === 'past' ? t('Past') : t('Planned')}
          </span>
          <div
            className="ms-auto flex shrink-0 items-center gap-0.5 rounded-lg bg-charcoal-100 p-0.5"
            role="tablist"
            aria-label={t('Days shown')}
          >
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={view === option.value}
                onClick={() => setView(option.value)}
                title={
                  option.value === 'week'
                    ? t('Seven days — a painted weekday repeats weekly inside the cycle')
                    : t('Every day of the selected month')
                }
                className={cn(
                  'rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all',
                  view === option.value
                    ? 'bg-white text-charcoal-900 shadow-sm'
                    : 'text-charcoal-500 hover:text-charcoal-700',
                )}
              >
                {t(option.label)}
              </button>
            ))}
          </div>
        </div>

        {/* Period strip — only earns a row when the month really holds several periods. */}
        {monthCycles.length > 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2.5 lg:shrink-0">
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
                  title={t('{{count}} days · {{start}} to {{end}}', {
                    count: isoRange(cycle.startDate, cycle.endDate).length,
                    start: isoDayLabel(cycle.startDate),
                    end: isoDayLabel(cycle.endDate),
                  })}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-start transition-all',
                    active
                      ? 'border-brand-500 bg-brand-50/60 shadow-sm ring-1 ring-brand-500'
                      : 'border-charcoal-200 hover:border-charcoal-300 hover:bg-charcoal-50/60',
                  )}
                >
                  <span className="whitespace-nowrap text-[11px] font-bold text-charcoal-900">{cycle.label}</span>
                  <StatusChip status={cycle.status} />
                </button>
              )
            })}
          </div>
        )}
        {monthCycles.length === 0 && (
          <div className="px-4 pb-3">
            <EmptyState
              title={t('No schedule covers {{month}}', { month: monthLabelOf(selMonth, t) })}
              hint={t('Create a schedule whose dates overlap this month, or pick another month.')}
              action={
                manage ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t('New Schedule')}
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
            editing={editing && canEdit}
            manage={manage}
            selMonth={selMonth}
            monthCycles={monthCycles}
            onDeleted={() => {
              setExplicitId(null)
              setEditing(false)
            }}
            onOpenTemplates={() => setTemplateOpen(true)}
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
            toast(t('Schedule created — assign shifts on the draft.'))
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

interface ActionMenuItem {
  label: string
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}

/** Overflow menu that keeps the rare cycle actions out of the toolbar. */
function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <Button
        size="sm"
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('Schedule actions')}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </Button>
      {open && (
        <div
          role="menu"
          // Above the roster's sticky header (z-20) and its corner cell (z-30):
          // the menu overlaps the grid, so an equal z-index lost to DOM order.
          className="absolute end-0 z-40 mt-1 min-w-[190px] overflow-hidden rounded-lg border border-charcoal-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-start text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                item.danger ? 'text-red-600 hover:bg-red-50' : 'text-charcoal-700 hover:bg-charcoal-50',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ==================== cycle detail ==================== */

/**
 * One selected cycle: toolbar (status, save/publish, overflow menu), paint
 * palette, legend and the date-column roster grid. Columns are real calendar
 * dates of the cycle — painting a weekday cell writes that weekday for every
 * matching date inside the cycle (the server's weekly-repeat semantics).
 */
function CycleDetailPanel({
  gymId,
  cycleId,
  view,
  editing,
  manage,
  selMonth,
  monthCycles,
  onDeleted,
  onOpenTemplates,
}: {
  gymId: number
  cycleId: number
  view: 'week' | 'month'
  editing: boolean
  manage: boolean
  selMonth: string
  /** Every schedule overlapping the selected month — the month view reads each date
   *  from the one that owns it. */
  monthCycles: { id: number; startDate: string; endDate: string }[]
  onDeleted: () => void
  /** Opens the shift-template manager owned by the workspace. */
  onOpenTemplates: () => void
}) {
  const { toast } = useToast()
  const { t } = useTranslation()
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

  // The Month view spans every schedule that overlaps the month, so each column has
  // to read from the cycle that actually owns that date: resolving them all from the
  // selected cycle painted one shift across the entire month. Sibling cycles are
  // fetched only for the month view and share the picker's cache key.
  const siblingCycleIds = useMemo(
    () => (view === 'month' ? monthCycles.filter((c) => c.id !== cycleId).map((c) => c.id) : []),
    [monthCycles, cycleId, view],
  )
  const siblingQueries = useQueries({
    queries: siblingCycleIds.map((id) => ({
      queryKey: scheduleKeys.cycle(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getShiftCycle(id, signal),
    })),
  })
  const cycleById = useMemo(() => {
    const map = new Map<number, ShiftCycleDetail>()
    if (detail) map.set(detail.id, detail)
    for (const query of siblingQueries) {
      const sibling = query.data
      if (sibling) map.set(sibling.id, sibling)
    }
    return map
  }, [detail, siblingQueries])
  const ownerCycleOf = useCallback(
    (date: string) => monthCycles.find((c) => c.startDate <= date && date <= c.endDate) ?? null,
    [monthCycles],
  )
  // Same date-accurate rule as the selected cycle: exact date cell first, weekly
  // pattern as the fallback for responses that predate daysByDate.
  const cellValueIn = useCallback((ownerDetail: ShiftCycleDetail, employeeId: number, date: string): CellPaint => {
    const row = ownerDetail.assignments.find((r) => r.employeeId === employeeId)
    if (!row) return 'unassigned'
    const byDate = row.daysByDate?.find((cell) => cell.date === date)
    if (byDate) return byDate.assigned ? (byDate.shiftTemplateId ?? null) : 'unassigned'
    const day = weekdayIndex(date)
    if (row.assignedDays?.[day] === false) return 'unassigned'
    return row.days[day] ?? null
  }, [])
  // The grid spans every schedule shown, so a shift that only appears in a sibling
  // cycle still renders with its own label and colour.
  const gridTemplateById = useMemo(() => {
    const map = new Map(templateById)
    for (const cycle of cycleById.values()) {
      for (const template of cycle.shiftTemplates) map.set(template.id, template)
    }
    return map
  }, [cycleById, templateById])

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

  // Grid value per column: the selected cycle keeps its pending paint edits, while a
  // date owned by another schedule in the month reads that schedule's own assignment.
  const cellValueAtDate = useCallback(
    (employeeId: number, date: string): CellPaint => {
      const owner = ownerCycleOf(date)
      if (!owner) return 'unassigned'
      if (owner.id === cycleId) return cellValueForDate(employeeId, date)
      const ownerDetail = cycleById.get(owner.id)
      return ownerDetail ? cellValueIn(ownerDetail, employeeId, date) : 'unassigned'
    },
    [cellValueForDate, cellValueIn, cycleById, cycleId, ownerCycleOf],
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
          ? `${result.message || t('Shift assignments saved.')} ${t(
              'This schedule is a Draft — press “Publish Shift” to make it visible in employees\' Shift tabs.',
            )}`
          : result.message || t('Shift assignments saved.'),
      )
      setEdits(new Map())
      invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const publishMutation = useMutation({
    mutationFn: () => publishShiftCycle(cycleId),
    onSuccess: (result) => {
      toast(result.message || t('Schedule published.'))
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
      toast(t('Schedule deleted — the cycle and its assignments were removed.'))
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
  // month ∩ the cycle range (Month view).
  const weekCols = weekColsOf(detail)
  const monthCols = monthColsOf(selMonth)
  const cols = view === 'week' ? weekCols : monthCols
  // Days owned by another schedule in the month are shown but not painted here —
  // an edit would write this cycle's weekday pattern, not that schedule's.
  const readOnlyDates = new Set(
    cols.filter((col) => ownerCycleOf(col.date)?.id !== cycleId).map((col) => col.date),
  )

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

  return (
    <>
      {/* Toolbar — status + coverage on the left, one primary action on the right. */}
      <div className="flex flex-col gap-2 border-t border-charcoal-100 px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] text-charcoal-600">
          <StatusChip status={detail.status} />
          <span className="font-semibold text-charcoal-800">
            {isoDayLabel(detail.startDate)} – {isoDayLabel(detail.endDate)}
          </span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-charcoal-400" />
          <span>{t('{{count}} employees', { count: detail.assignments.length })}</span>
          {employeesWithMissingDays > 0 && (
            <span
              className="badge badge-yellow inline-flex items-center gap-1"
              title={t('Employees who still have weekdays marked Not assigned')}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {t('{{count}} with missing days', { count: employeesWithMissingDays })}
            </span>
          )}
          {detail.conflicts.length > 0 && (
            <span className="badge badge-red flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {detail.conflicts.length === 1
                ? t('{{count}} conflict', { count: detail.conflicts.length })
                : t('{{count}} conflicts', { count: detail.conflicts.length })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:ms-auto">
          {manage && dirtyCountOf(edits) > 0 && (
            <Button
              size="sm"
              loading={saveMutation.isPending}
              disabled={!editing}
              onClick={() => saveMutation.mutate()}
            >
              {dirtyCountOf(edits) === 1
                ? t('Save {{count}} cell', { count: dirtyCountOf(edits) })
                : t('Save {{count}} cells', { count: dirtyCountOf(edits) })}
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
              title={t("Publish makes this schedule visible in every employee's Shift tab")}
            >
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" /> {t('Publish Shift')}
            </Button>
          )}
          {manage && (
            <ActionMenu
              items={[
                {
                  label: t('New Shift'),
                  icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                  onSelect: onOpenTemplates,
                },
                {
                  label: t('Copy Previous'),
                  icon: <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />,
                  onSelect: () => copyMutation.mutate(),
                  disabled: !editing || copyMutation.isPending,
                },
                {
                  label: t('Delete Schedule'),
                  icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
                  onSelect: () => setConfirmDelete(true),
                  danger: true,
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Draft visibility gate — one line; the Publish action sits right above. */}
      {isDraft && (
        <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800 lg:shrink-0">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">{t('Draft schedule.')}</span>{' '}
            {t('Employees cannot see these shifts until you publish them.')}
          </p>
        </div>
      )}

      {/* Paint palette */}
      {editing && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-charcoal-100 bg-brand-50/40 px-4 py-2 sm:flex-nowrap sm:overflow-x-auto lg:shrink-0">
          <span className="me-1 shrink-0 text-[10px] font-semibold text-charcoal-600">{t('Paint shift:')}</span>
          {activeTemplates.map((template) => {
            const selected = paintPick.kind === 'tpl' && paintPick.id === template.id
            return (
              <button
                key={template.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setPaintPick({ kind: 'tpl', id: template.id })}
                className={cn(
                  'shrink-0 rounded-lg border bg-white px-2 py-1 text-[10px] font-semibold transition-all',
                  selected ? 'border-brand-500 shadow-sm ring-2 ring-brand-400' : 'border-charcoal-200 hover:border-charcoal-300',
                )}
              >
                <span
                  className="me-1.5 inline-block h-2.5 w-2.5 rounded border"
                  style={{ background: template.bgColor, borderColor: `${template.color}40` }}
                />
                {template.name}
                <span className="ms-1 hidden font-normal text-charcoal-400 sm:inline">{cellLabel(template, t)}</span>
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
            <span className="me-1.5 inline-block h-2.5 w-2.5 rounded border border-charcoal-200 bg-charcoal-100" />
            {t('Off')}
          </button>
          <span className="ms-auto hidden shrink-0 text-[10px] text-charcoal-400 sm:inline">
            {isDraft
              ? t('Click a cell or drag across the grid to paint it.')
              : t('This schedule is published — saved edits reach employees immediately.')}
          </span>
        </div>
      )}

      {/* Roster scroll area — the only region of the card that scrolls, so the
          page itself never does on a desktop viewport. */}
      <div className="lg:min-h-0 lg:flex-1 lg:overflow-auto">
        {detail.assignments.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState
              title={t("No employees in this cycle's roster")}
              hint={t(
                "Assignments appear for the gym's employees; either no workers belong here yet, or none are scheduled.",
              )}
            />
          </div>
        ) : (
          <ScheduleGrid
            detail={detail}
            cols={cols}
            view={view}
            editing={editing}
            templateById={gridTemplateById}
            cellValueForDate={cellValueAtDate}
            readOnlyDates={readOnlyDates}
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

        {detail.conflicts.length > 0 && (
          <div className="border-t border-charcoal-100 px-4 py-3">
            <p className="bento-label text-red-700">
              <AlertTriangle className="me-1 inline h-3.5 w-3.5" aria-hidden="true" />{' '}
              {t('CONFLICTS ({{count}})', { count: detail.conflicts.length })}
            </p>
            <ul className="mt-2 space-y-1">
              {detail.conflicts.map((conflict, index) => (
                <li key={index} className="text-[11px] text-charcoal-600">
                  {memberName(detail.assignments, conflict.employeeId)} · {t(DOW[conflict.day])} — {conflict.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Legend is a footer: it explains what was just read and stays visible
          while the roster scrolls. While editing the palette takes over. */}
      {!editing && <ScheduleLegend templates={activeTemplates} />}

      <ConfirmDialog
        open={confirmDelete}
        title={t('Delete Schedule')}
        message={t(
          'Delete this schedule cycle? Its assignments are removed with it — employees lose the shifts of this period. This cannot be undone.',
        )}
        confirmLabel={t('Delete Schedule')}
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

/** Month view = every day of the selected month, so days the chosen schedule does
 *  not cover still appear (a partial cycle must not hide the rest of the month). */
function monthColsOf(selMonth: string): ISODate[] {
  return isoRange(`${selMonth}-01`, `${selMonth}-${pad2(daysInMonthOf(selMonth))}`)
}

function dirtyCountOf(edits: Map<string, number | null>): number {
  return edits.size
}

/** Swatch tint that mirrors `.shift-cell` without needing the class. */
function shiftTint(tone: string, strength = 12) {
  return {
    background: `color-mix(in srgb, ${tone} ${strength}%, var(--color-white))`,
    borderColor: `color-mix(in srgb, ${tone} ${strength + 20}%, transparent)`,
  }
}

/** Key for the roster: swatches reuse the cells' own tint maths, so the legend
 *  cannot drift away from what is on screen. */
function ScheduleLegend({ templates }: { templates: ShiftTemplateItem[] }) {
  const { t } = useTranslation()
  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 border-t border-charcoal-100 px-4 py-2.5 text-[11px] text-charcoal-600 sm:flex lg:shrink-0">
      {templates.map((template) => (
        <span key={template.id} className="inline-flex items-center gap-1.5">
          {/* A key reads as a colour chip, so it carries more of the accent than
              the cells themselves do. */}
          <span className="h-3.5 w-3.5 rounded-[4px] border" style={shiftTint(template.color, 42)} aria-hidden="true" />
          <span className="font-medium text-charcoal-800">{template.name}</span>
          <span className="text-charcoal-500">{cellLabel(template, t)}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px] border border-dashed border-charcoal-400" aria-hidden="true" />
        {t('Not assigned')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px] border border-charcoal-300 bg-charcoal-200/60" aria-hidden="true" />
        {t('Off')}
      </span>
    </div>
  )
}

/* ==================== roster grid (date columns) ==================== */

function ScheduleGrid({
  detail,
  cols,
  view,
  editing,
  templateById,
  cellValueForDate,
  readOnlyDates,
  missingDaysOf,
  paintingRef,
  onCell,
  onRowFill,
  onDayFill,
}: {
  detail: ShiftCycleDetail
  cols: ISODate[]
  view: 'week' | 'month'
  editing: boolean
  templateById: Map<number, ShiftTemplateItem>
  cellValueForDate: (employeeId: number, date: string) => CellPaint
  /** Columns owned by another schedule in the month: shown, never painted here. */
  readOnlyDates: Set<string>
  missingDaysOf: (employeeId: number) => number
  paintingRef: MutableRefObject<boolean>
  onCell: (employeeId: number, day: number) => void
  onRowFill: (row: ShiftRosterRow) => void
  onDayFill: (day: number) => void
}) {
  const { t } = useTranslation()
  const { me } = usePortalSession()
  // The gym-wide Branch Schedule roster includes every non-terminated gym
  // employee — including the manager's own record (a BM is staff of their
  // branch, by seed and by design). Mark that self-row so it reads as
  // intentional instead of looking like a data leak.
  const selfEmployeeId = me?.employeeId ?? null
  const today = todayISO()
  const selfBadge = (
    <span
      className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[9px] font-semibold text-brand-700"
      title={t('This row is your own employee record — a Branch Manager is staff of their branch too.')}
    >
      {t('You')}
    </span>
  )

  return (
    <>
      {/* Desktop grid — scrolling belongs to the card's roster area, so the
          sticky header and the sticky name column share one scroll box. */}
      <div className="hidden flex-col px-1 pb-4 lg:flex">
        <table className="data-table roster-grid">
          <thead>
            <tr>
              <th scope="col" className="sticky start-0 z-10 w-[240px] bg-charcoal-50">
                {t('Employee')}
              </th>
              <th
                scope="col"
                className="text-center"
                title={t('Weekdays this employee has not been assigned yet')}
              >
                {t('Missing')}
              </th>
              {cols.map((col) => {
                const day = weekdayIndex(col.date)
                const foreign = readOnlyDates.has(col.date)
                const isToday = col.date === today
                return (
                  <th
                    key={col.date}
                    scope="col"
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'roster-day',
                      day >= 5 && 'roster-day--weekend',
                      isToday && 'roster-day--today',
                      foreign && 'opacity-60',
                    )}
                  >
                    <span className="roster-day-dow">{t(col.dow)}</span>
                    <span className="roster-day-num">{col.num}</span>
                    {editing && !foreign && (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onDayFill(day)}
                        title={t('Apply the selected shift to everyone on {{weekday}} {{date}}', {
                          weekday: t(col.dow),
                          date: col.num,
                        })}
                        className="mx-auto mt-1 block rounded bg-charcoal-200/60 p-0.5 text-charcoal-600 transition-colors hover:bg-brand-200 hover:text-brand-800"
                      >
                        <PaintBucket className="h-3.5 w-3.5" aria-hidden="true" />
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
                <td className="sticky start-0 z-10 w-[240px] bg-white">
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
                        title={t('Fill the visible days for this employee')}
                        aria-label={t('Fill the visible days for {{name}}', { name: row.name })}
                        className="ms-auto shrink-0 rounded p-1 text-charcoal-500 transition-colors hover:bg-brand-100 hover:text-brand-700"
                      >
                        <PaintBucket className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="text-center">
                  <MissingDaysBadge count={missingDaysOf(row.employeeId)} />
                </td>
                {cols.map((col) => {
                  const day = weekdayIndex(col.date)
                  const foreign = readOnlyDates.has(col.date)
                  const value = cellValueForDate(row.employeeId, col.date)
                  const unassigned = value === 'unassigned'
                  const template = typeof value === 'number' ? templateById.get(value) : undefined
                  const off = !unassigned && (value === null || template?.isOff === true)
                  const tone = cellTone(template)
                  const shift = template ?? unknownTemplate()
                  // The shift name leads and the hours follow: a bare "8p–4a"
                  // only read as a shift to whoever memorised the templates.
                  const content = unassigned ? (
                    <>
                      —
                      <span className="sr-only">{t('Not assigned')}</span>
                    </>
                  ) : off ? (
                    t('OFF')
                  ) : (
                    <>
                      <span className="shift-cell__name">{shift.name}</span>
                      <span className="shift-cell__time">{shortCellLabel(shift, t)}</span>
                    </>
                  )
                  const describe = t('{{name}}, {{weekday}} {{date}}: {{status}}', {
                    name: row.name,
                    weekday: t(col.dow),
                    date: col.num,
                    status: unassigned ? t('not assigned') : off ? t('off') : (template?.name ?? t('shift')),
                  })
                  return (
                    <td key={col.date} className={cn('text-center', col.date === today && 'roster-col--today')}>
                      {editing && !foreign ? (
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
                          className={cn(
                            'shift-cell cursor-pointer select-none transition-shadow hover:ring-2 hover:ring-brand-400',
                            unassigned && 'shift-cell--empty',
                            off && 'shift-cell--off',
                          )}
                          style={tone}
                          aria-label={describe}
                        >
                          {content}
                        </button>
                      ) : (
                        <span
                          className={cn('shift-cell', unassigned && 'shift-cell--empty', off && 'shift-cell--off')}
                          style={tone}
                          title={describe}
                        >
                          {content}
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

      {/* Mobile: one card per employee, days laid out as a 7-column grid that
          fits the screen. The old sideways grid pinned the name column on top
          of the shift cells — it hid them and blocked painting on a phone. */}
      <div className="px-3 pb-4 lg:hidden">
        <p className="pb-1.5 text-[10px] text-charcoal-400">
          {editing
            ? t('Tap a day to paint the selected shift.')
            : t('Read-only preview — press “Assign Shifts” to edit.')}
        </p>

        {/* Week view adds a shared weekday bar (shifts repeat weekly, so the
            weekday is what a manager reasons about); the date itself lives in
            each cell, so it stays readable once the bar scrolls away. */}
        {view === 'week' && (
          <div className="mb-2 border-y border-charcoal-100 bg-charcoal-50/70 py-1.5">
            <div className="grid grid-cols-7 gap-1 px-2">
              {cols.map((col) => {
                const day = weekdayIndex(col.date)
                const foreign = readOnlyDates.has(col.date)
                return (
                  <div key={col.date} className={cn('text-center', foreign && 'opacity-60')}>
                    <span className="block text-[9px] font-bold uppercase leading-none tracking-wide text-charcoal-500">
                      {t(col.dow)}
                    </span>
                    {editing && !foreign && (
                      <button
                        type="button"
                        onClick={() => onDayFill(day)}
                        title={t('Apply the selected shift to everyone on {{weekday}} {{date}}', {
                          weekday: t(col.dow),
                          date: col.num,
                        })}
                        aria-label={t('Apply the selected shift to everyone on {{weekday}} {{date}}', {
                          weekday: t(col.dow),
                          date: col.num,
                        })}
                        className="mx-auto mt-1 flex rounded bg-charcoal-200/60 p-0.5 text-charcoal-600 transition-colors hover:bg-brand-200 hover:text-brand-800"
                      >
                        <PaintBucket className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {detail.assignments.map((row) => {
            const missing = missingDaysOf(row.employeeId)
            return (
              <div key={row.employeeId} className="rounded-xl border border-charcoal-200 bg-white p-2">
                <div className="flex items-center gap-1.5 pb-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-semibold text-brand-700">
                    {row.initials}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-charcoal-900">{row.name}</span>
                  {row.employeeId === selfEmployeeId && (
                    <span className="shrink-0 rounded bg-brand-100 px-1 text-[8px] font-semibold text-brand-700">
                      {t('You')}
                    </span>
                  )}
                  {/* Only flag gaps: a "Complete" chip on every row was pure noise. */}
                  {missing > 0 && <MissingDaysBadge count={missing} compact />}
                  {editing && (
                    <button
                      type="button"
                      onClick={() => onRowFill(row)}
                      title={t('Fill the visible days for this employee')}
                      aria-label={t('Fill the visible days for {{name}}', { name: row.name })}
                      className="shrink-0 rounded p-1 text-charcoal-500 hover:bg-brand-100 hover:text-brand-700"
                    >
                      <PaintBucket className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cols.map((col) => {
                    const day = weekdayIndex(col.date)
                    const foreign = readOnlyDates.has(col.date)
                    const value = cellValueForDate(row.employeeId, col.date)
                    const unassigned = value === 'unassigned'
                    const template = typeof value === 'number' ? templateById.get(value) : undefined
                    const off = !unassigned && (value === null || template?.isOff === true)
                    const label = unassigned ? '—' : off ? t('OFF') : shortCellLabel(template ?? unknownTemplate(), t)
                    const style = cellTone(template)
                    const cellClass = cn(
                      'shift-cell shift-cell--fit h-10 flex-col leading-none',
                      unassigned && 'shift-cell--empty',
                      off && 'shift-cell--off',
                    )
                    const describe = t('{{name}}, {{weekday}} {{date}}: {{status}}', {
                      name: row.name,
                      weekday: t(col.dow),
                      date: col.num,
                      status: unassigned ? t('not assigned') : off ? t('off') : (template?.name ?? t('shift')),
                    })
                    // Every cell carries its own date: the weekday bar scrolls
                    // away with the page, so the column must identify itself.
                    const body = (
                      <>
                        <span className="text-[8px] font-bold opacity-70">{col.num}</span>
                        <span className="mt-0.5">{label}</span>
                      </>
                    )
                    return editing && !foreign ? (
                      <button
                        key={col.date}
                        type="button"
                        onClick={() => onCell(row.employeeId, day)}
                        className={cn(cellClass, 'transition-opacity hover:opacity-85')}
                        style={style}
                        aria-label={describe}
                      >
                        {body}
                      </button>
                    ) : (
                      <div
                        key={col.date}
                        className={cn(cellClass, foreign && 'opacity-60')}
                        style={style}
                        title={describe}
                      >
                        {body}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

/** Per-employee gap indicator: amber while weekdays remain Not assigned. */
function MissingDaysBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  const { t } = useTranslation()

  if (count <= 0) {
    return compact ? (
      <span className="badge badge-green shrink-0" aria-label={t('Every weekday is assigned or marked Off')}>
        {t('Complete')}
      </span>
    ) : (
      <span className="text-[10px] text-charcoal-400" title={t('Every weekday is assigned or marked Off')}>
        —
      </span>
    )
  }

  return (
    <span
      className="badge badge-yellow shrink-0"
      title={
        count === 1
          ? t('{{count}} weekday not assigned yet', { count })
          : t('{{count}} weekdays not assigned yet', { count })
      }
      aria-label={
        count === 1 ? t('{{count}} weekday not assigned', { count }) : t('{{count}} weekdays not assigned', { count })
      }
    >
      {compact ? t('{{count}} not assigned', { count }) : count}
    </span>
  )
}

function memberName(rows: ShiftRosterRow[], employeeId: number): string {
  return rows.find((r) => r.employeeId === employeeId)?.name ?? `#${employeeId}`
}

/**
 * Hands the template accent to `.shift-cell`, which mixes it with the active
 * theme's surface/text tokens. Passing the API's pre-baked `bgColor`/`textColor`
 * pastels painted light blocks onto the dark surface.
 */
function cellTone(template: ShiftTemplateItem | undefined): CSSProperties | undefined {
  if (!template || template.isOff) return undefined
  return { '--shift-tone': template.color } as CSSProperties
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
  const { t } = useTranslation()
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
      title={t('Create New Schedule')}
      subtitle={t('Choose a date range within the month. A draft cycle is created and shifts can be assigned right away.')}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            disabled={!startDate || !endDate || rangeInvalid || overlapBlocked}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {t('Create Schedule')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="form-label" htmlFor="cycle-month">
            {t('Month')}
          </label>
          <select id="cycle-month" value={month} onChange={(e) => pickMonth(e.target.value)} className="form-input">
            {months.map((ym) => (
              <option key={ym} value={ym}>
                {monthLabelOf(ym, t)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="cycle-start">
              {t('Start Date')}
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
              {t('End Date')}
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
        {rangeInvalid && (
          <p className="text-[10px] text-red-500">{t('Start date must be on or before the end date.')}</p>
        )}
        {overlapBlocked && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
            {t('A schedule already covers these dates ({{schedules}}). Delete it from the period strip first, or pick a different range.', {
              schedules: overlapping.map((c) => c.label).join(', '),
            })}
          </p>
        )}
        <p className="bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-500">
          {t('Ranges longer than a week open in the Week view — every shift repeats on the same weekday of the following weeks. Switch to Month to see the full range. A cycle already covering these dates will be rejected by the server.')}
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
  const { t } = useTranslation()
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
      toast(
        editId == null
          ? t('Template “{{name}}” created — it is in the paint palette now.', { name: saved.name })
          : t('Template “{{name}}” updated.', { name: saved.name }),
      )
      invalidate()
      setEditId(null)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteShiftTemplate(gymId, deleteId!),
    onSuccess: () => {
      toast(t('Template deleted — cells that used it now show OFF.'))
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
        title={
          editingTemplate
            ? t('Edit Shift Template — {{name}}', { name: editingTemplate.name })
            : t('Shift Templates')
        }
        subtitle={t('Templates appear in the paint palette and the schedule legend; pick a color so each shift is easy to tell apart.')}
        onClose={onClose}
        width="wide"
        footer={
          <>
            {editingTemplate ? (
              <Button size="sm" variant="danger" className="me-auto" onClick={() => setDeleteId(editingTemplate.id)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t('Delete')}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={onClose}>
              {t('Close')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Form */}
          <div className="space-y-3 rounded-xl border border-charcoal-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">
              {editingTemplate ? t('Editing template') : t('Create new template')}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="form-label" htmlFor="tpl-name">
                  {t('Template Name')}
                </label>
                <input
                  id="tpl-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('e.g. Early Morning, Split, Part-time')}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="tpl-start">
                  {t('Start Time')}
                </label>
                <input id="tpl-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label" htmlFor="tpl-end">
                  {t('End Time')}
                </label>
                <input id="tpl-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="form-input" />
              </div>
            </div>
            <div>
              <label className="form-label" htmlFor="tpl-color">
                {t('Shift Color')}
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {TEMPLATE_COLORS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    aria-label={t('Use color {{color}}', { color: candidate })}
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
                  className="ms-1 h-8 w-10 cursor-pointer rounded border border-charcoal-200 bg-white p-0.5"
                  title={t('Pick a custom color')}
                />
                <span className="font-mono text-[10px] text-charcoal-500">{color}</span>
              </div>
            </div>
            <p className="bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-500">
              {t('Duration: {{duration}}', {
                duration:
                  durationHours == null ? t('set start and end times') : t('{{count}} hours', { count: durationHours }),
              })}
              {overnight ? ` ${t('— overnight shift, ends the next day.')}` : ''}
              {sameTime ? ` ${t('— start and end times must differ.')}` : ''}
            </p>
            <div className="flex justify-end gap-2 border-t border-charcoal-100 pt-3">
              {editingTemplate && (
                <Button size="sm" variant="secondary" onClick={resetCreate}>
                  {t('Cancel edit')}
                </Button>
              )}
              <Button
                size="sm"
                disabled={!name.trim() || sameTime}
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {editingTemplate ? t('Save Changes') : t('Create Template')}
              </Button>
            </div>
          </div>

          {/* Existing templates */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">{t('Existing templates')}</p>
            {templatesQuery.isLoading ? (
              <LoadingState />
            ) : templates.length === 0 ? (
              <p className="px-1 py-3 text-[11px] text-charcoal-500">{t('No templates yet — create the first one above.')}</p>
            ) : (
              <div className="space-y-1.5">
                {templates.map((template) => (
                  <div key={template.id} className="flex items-center gap-3 rounded-lg border border-charcoal-200 px-3 py-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border"
                      style={{ background: template.color, borderColor: `${template.color}80` }}
                      aria-hidden="true"
                    />
                    <span className="max-w-[60%] truncate rounded bg-charcoal-50 px-2 py-1 text-[10px] font-semibold text-charcoal-600">
                      {template.name}
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-charcoal-500">
                      {formatTimeOfDay(template.start)} – {formatTimeOfDay(template.end)}
                      {template.end < template.start ? ` ${t('(+1 day)')}` : ''}
                    </span>
                    <div className="ms-auto flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(template)}>
                        {t('Edit')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(template.id)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">{t('Delete {{name}}', { name: template.name })}</span>
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
        title={t('Delete Shift Template')}
        message={t('Delete this template? Schedule cells that reference it flip to OFF. This cannot be undone.')}
        confirmLabel={t('Delete Template')}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteId(null)}
      />
    </>
  )
}
