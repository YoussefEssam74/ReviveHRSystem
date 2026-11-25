import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, Inbox, LogIn, LogOut, Zap } from 'lucide-react'
import {
  getAttendanceGrid,
  getEmployeeDirectory,
  type AttendanceGridRow,
} from '../api/branch.api'
import { getOwnAttendance } from '../api/attendance.api'
import { decideRequest, getOwnRequests, type EmployeeRequestItem } from '../api/requests.api'
import { CreateFollowUpModal } from './TeamActionsPage'
import { getTeamToday, type TeamMemberDay } from '../api/team.api'

import { EmptyState } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { activeLocale, formatDate, formatMoney, formatTimeLabel, formatTimeOfDay, humanize } from '../../../lib/format'

/**
 * Attendance Management (mock §16 renderAttendanceManagement): one date of the
 * composed attendance grid — the four real stat tiles plus the Late and Absent
 * problem lists. Row actions: Take action (follow-up), Reminder, View (detail
 * modal with the month's late/absent history + requests) and Mark Present on
 * absent rows (manualAttendance, `attendance.manual_entry` key).
 */

/** Days with no attendance to judge — neither on time, late nor absent. */
const OFF_STATUSES = new Set(['Off', 'Scheduled'])

/** Statuses that count as attended on time: a punch landed and the day is not late. */
const ON_TIME_STATUSES = new Set(['On Time', 'Early Checkout', 'Missing Checkout', 'Covering (Extra Shift)'])

/** The statuses the filter offers; any other status the day carries is appended. */
const ATTENDANCE_STATUSES = [
  'On Time',
  'Late',
  'Early Checkout',
  'Absent',
  'Sick Leave',
  'Annual Leave',
  'Paid Holiday',
]

/** The stored status vocabulary mapped onto what the board shows. */
function attendanceStatusLabel(status: string): string {
  return status === 'Early Checkout' ? 'Early Leaving' : status
}

/** The three departments the board rolls up into, in display order. */
type DepartmentId = 'sales' | 'trainers' | 'hk'

const DEPARTMENTS: {
  id: DepartmentId
  label: string
  accent: string
  bar: string
  number: string
}[] = [
  { id: 'sales', label: 'Sales', accent: 'border-s-blue-500', bar: 'bg-blue-500', number: 'text-blue-600' },
  { id: 'trainers', label: 'Trainers', accent: 'border-s-brand-500', bar: 'bg-brand-500', number: 'text-brand-600' },
  { id: 'hk', label: 'Housekeeping', accent: 'border-s-amber-500', bar: 'bg-amber-500', number: 'text-amber-600' },
]

/**
 * Positions are free text, so a department is matched by keyword rather than an
 * exact title. Housekeeping is tested first ("maintenance" must not fall through
 * to another bucket); reception/front-desk count as Sales — they sit on the
 * front-of-house team. An unmatched title (e.g. "Branch Manager") belongs to no
 * card but still appears in the status tables below.
 */
function departmentOf(position: string): DepartmentId | null {
  const value = position.toLowerCase()
  if (/house ?keeping|\bhk\b|clean|laundry|janitor|maintenance/.test(value)) return 'hk'
  if (/sales|consult|reception|front ?desk|cashier|member/.test(value)) return 'sales'
  if (/train|coach|instructor|fitness|nutrition|yoga|zumba|pilates|physical/.test(value)) return 'trainers'
  return null
}

type IdentityRow = { employeeId: number; position: string; initials: string }

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export default function BranchAttendancePage() {
  const { t } = useTranslation()
  const { isBranchManager, isTeamLeader } = usePortalSession()

  if (!isBranchManager && !isTeamLeader) {
    return (
      <EmptyState
        title={t('Attendance Management is for managers')}
        hint={t('The day roster is guarded by the attendance.view permission key.')}
      />
    )
  }

  return <AttendanceWorkspace />
}

function AttendanceWorkspace() {
  const { me, can } = usePortalSession()
  const [date, setDate] = useState(todayIso())

  const gridQuery = useQuery({
    queryKey: ['portal', 'grid', me?.activeGym?.gymId, date],
    queryFn: ({ signal }) => getAttendanceGrid({ date, page: 1, pageSize: 200, signal }),
  })

  if (gridQuery.isLoading) return <LoadingState />
  if (gridQuery.error)
    return <ErrorState message={describeApiError(gridQuery.error)} onRetry={() => void gridQuery.refetch()} />

  const canViewEmployees = can('employees.view')
  const ledTeamId = me?.ledTeamId ?? null
  const identitySource = canViewEmployees ? 'directory' : `team-${ledTeamId}`

  return (
    <AttendanceBoard
      key={date}
      date={date}
      onDateChange={setDate}
      rows={gridQuery.data?.items ?? []}
      mapKey={identitySource}
      canViewEmployees={canViewEmployees}
      ledTeamId={ledTeamId}
    />
  )
}

function AttendanceBoard({
  date,
  onDateChange,
  rows,
  mapKey,
  canViewEmployees,
  ledTeamId,
}: {
  date: string
  onDateChange: (value: string) => void
  rows: AttendanceGridRow[]
  mapKey: string
  canViewEmployees: boolean
  ledTeamId: number | null
}) {
  const { t } = useTranslation()
  const { me } = usePortalSession()
  const [detailRow, setDetailRow] = useState<AttendanceGridRow | null>(null)
  const [reviewRow, setReviewRow] = useState<AttendanceGridRow | null>(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [followUpMember, setFollowUpMember] = useState<TeamMemberDay | null>(null)
  const [followUpDeduction, setFollowUpDeduction] = useState<{ days: number; date: string | null } | null>(null)

  // Identity join: the grid row carries name + shift + punches but no position.
  // BMs (employees.view) join the directory; TLs join the team-day roster.
  const identityQuery = useQuery({
    queryKey: ['portal', 'attendance-identity', mapKey, date],
    queryFn: ({ signal }) => loadIdentities({ signal }, canViewEmployees, ledTeamId, date),
    enabled: rows.length > 0,
    staleTime: 5 * 60_000,
  })
  const identities = identityQuery.data ?? []

  // Everyone the day asked something of: Off/Scheduled staff are neither on
  // time, late nor absent, so they stay out of the department cards.
  const scheduledRows = rows.filter((row) => !OFF_STATUSES.has(row.status))
  const positionOf = (row: AttendanceGridRow) =>
    identities.find((item) => item.employeeId === row.employeeId)?.position ?? ''
  const departmentRows = (id: DepartmentId) =>
    scheduledRows.filter((row) => departmentOf(positionOf(row)) === id)

  // TeamMemberDay-shaped view of the day: every roster row for lookups (the detail
  // modal and the follow-up preselection), minus Off/Scheduled for the picker.
  const allMembers: TeamMemberDay[] = rows.map((row) => {
    const identity = identities.find((item) => item.employeeId === row.employeeId)
    return {
      employeeId: row.employeeId,
      name: row.name,
      position: identity?.position ?? '—',
      status: row.status,
      checkIn: row.checkIn,
      initials: identity?.initials ?? initialsOf(row.name),
      shiftName: row.shift,
      shiftStart: null,
      shiftEnd: null,
      isOff: row.status === 'Off',
    }
  })
  const members: TeamMemberDay[] = allMembers.filter((member) => !['Off', 'Scheduled'].includes(member.status))
  const memberById = new Map(allMembers.map((member) => [member.employeeId, member]))

  // Every "Take action" entry point carries its own row, so the popup opens on the
  // employee that was clicked — never on whoever happens to head the list. When the
  // day already carries a pending deduction, that deduction is handed over too: the
  // form opens as "Deduction, N days, this date" ready to confirm.
  const openFollowUpFor = (row: AttendanceGridRow) => {
    setFollowUpDeduction(row.deduction ? { days: row.deduction.days, date: row.date } : null)
    const member = memberById.get(row.employeeId)
    setFollowUpMember(
      member ?? {
        employeeId: row.employeeId,
        name: row.name,
        position: '—',
        status: row.status,
        checkIn: row.checkIn,
        initials: initialsOf(row.name),
        shiftName: row.shift,
        shiftStart: null,
        shiftEnd: null,
        isOff: false,
      },
    )
  }

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6.5rem)]">
      <div className="flex flex-col justify-between gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <div>
          <h1 className="text-base font-bold text-charcoal-900">{t('Attendance Management')}</h1>
          <p className="text-[11px] leading-tight text-charcoal-500">
            {t("Today's branch attendance · {{gym}} · {{date}}", {
              gym: me?.activeGym?.gymName || t('your gym'),
              date: formatDate(date),
            })}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="form-input h-8 w-32 py-1 text-xs"
          aria-label={t('Attendance date')}
        />
      </div>

      {/* Department roll-up: one card per team, counting the day's scheduled
          staff so "on time / scheduled" always reads against a real roster. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DEPARTMENTS.map((department) => {
          const teamRows = departmentRows(department.id)
          const onTime = teamRows.filter((row) => ON_TIME_STATUSES.has(row.status)).length
          const late = teamRows.filter((row) => row.status === 'Late').length
          const absent = teamRows.filter((row) => row.status === 'Absent').length
          const pct = teamRows.length ? Math.round((onTime / teamRows.length) * 100) : 0
          return (
            <div
              key={department.id}
              className={cn(
                'rounded-xl border border-charcoal-200 border-s-4 bg-white px-3 py-2.5',
                department.accent,
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="bento-label text-charcoal-500">{t(department.label)}</p>
                <p className={cn('text-lg font-bold leading-none tabular-nums', teamRows.length ? department.number : 'text-charcoal-400')}>
                  {teamRows.length ? `${onTime}/${teamRows.length}` : '—'}
                </p>
              </div>
              <p className="mt-0.5 text-[10px] text-charcoal-500">{t('On time')}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-charcoal-100">
                <div className={cn('h-full rounded-full transition-[width]', department.bar)} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[10px] text-charcoal-500">
                {t('{{late}} late · {{absent}} absent', { late, absent })}
              </p>
            </div>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-8 w-8" aria-hidden="true" />}
          title={t('No attendance for this day')}
          hint={t('Nobody is rostered on this date. Pick another day to review the branch.')}
        />
      ) : (
        <AttendanceTable
          rows={rows}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          positionOf={positionOf}
          initialsOfRow={(row) => identities.find((item) => item.employeeId === row.employeeId)?.initials ?? initialsOf(row.name)}
          onView={setDetailRow}
          onFollowUp={openFollowUpFor}
          onReview={setReviewRow}
        />
      )}

      {detailRow && (
        <AttendanceDetailModal
          row={detailRow}
          member={memberById.get(detailRow.employeeId) ?? null}
          canViewEmployees={canViewEmployees}
          onFollowUp={() => openFollowUpFor(detailRow)}
          onReview={() => {
            const current = detailRow
            setDetailRow(null)
            setReviewRow(current)
          }}
          onClose={() => setDetailRow(null)}
        />
      )}

      {reviewRow && <CoverReviewDialog row={reviewRow} onClose={() => setReviewRow(null)} />}

      {followUpMember && (
        <CreateFollowUpModal
          members={members}
          defaultMember={followUpMember}
          defaultDeduction={followUpDeduction}
          onClose={() => {
            setFollowUpMember(null)
            setFollowUpDeduction(null)
          }}
        />
      )}
    </div>
  )
}

/* ==================== status table ==================== */

/**
 * The whole branch roster for one day as a single table (Name, Job Title,
 * Shift, Status, Check-in, Check-out, Action), filtered by status. The same
 * rows stack as cards on phones, where seven columns cannot fit.
 */
function AttendanceTable({
  rows,
  statusFilter,
  onStatusFilterChange,
  positionOf,
  initialsOfRow,
  onView,
  onFollowUp,
  onReview,
}: {
  rows: AttendanceGridRow[]
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  positionOf: (row: AttendanceGridRow) => string
  initialsOfRow: (row: AttendanceGridRow) => string
  onView: (row: AttendanceGridRow) => void
  onFollowUp: (row: AttendanceGridRow) => void
  onReview: (row: AttendanceGridRow) => void
}) {
  const { t } = useTranslation()
  const statusOptions = Array.from(new Set([...ATTENDANCE_STATUSES, ...rows.map((row) => row.status)]))
  const visibleRows = statusFilter === 'All' ? rows : rows.filter((row) => row.status === statusFilter)

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:min-h-0 lg:flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-100 px-4 py-2.5">
        <p className="bento-label text-charcoal-500">
          {t('{{count}} employees', { count: visibleRows.length })}
        </p>
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          className="form-select h-8 w-40 py-1 text-xs"
          aria-label={t('Filter by status')}
        >
          <option value="All">{t('All Status')}</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {t(attendanceStatusLabel(status))}
            </option>
          ))}
        </select>
      </div>

      {visibleRows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[11px] text-charcoal-500">{t('No employees with this status.')}</p>
      ) : (
        <>
          {/* Desktop table: the card owns the scroll so the header stays pinned. */}
          <div className="hidden min-h-0 flex-1 overflow-auto lg:block">
            <table className="data-table min-w-[880px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>{t('Name')}</th>
                  <th>{t('Job Title')}</th>
                  <th>{t('Shift')}</th>
                  {/* Punches are short and often a dash, so these two columns are
                      centred — the dash then sits mid-cell instead of hugging the
                      text edge. */}
                  <th key="Check-in" className="is-center">
                    {t('Check-in')}
                  </th>
                  <th key="Check-out" className="is-center">
                    {t('Check-out')}
                  </th>
                  <th>{t('Status')}</th>
                  <th className="is-end">{t('Action')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={`${row.employeeId}-${row.date}`}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                          {initialsOfRow(row)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-charcoal-900">{row.name}</p>
                          {row.deduction && (row.status === 'Late' || row.status === 'Absent') && (
                            <p className="flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="font-semibold text-red-600">
                                {formatMoney(row.deduction.amount)}
                              </span>
                              <StatusBadge status={humanize(row.deduction.status)} />
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-charcoal-600">{positionOf(row) || '—'}</td>
                    <td className="whitespace-nowrap text-xs text-charcoal-600">{row.shift ? formatTimeLabel(row.shift) : '—'}</td>
                    <td className="is-center whitespace-nowrap text-xs tabular-nums text-charcoal-900">
                      {row.checkIn ? formatTimeOfDay(row.checkIn) : <span className="text-charcoal-400">—</span>}
                    </td>
                    <td className="is-center whitespace-nowrap text-xs tabular-nums text-charcoal-900">
                      {row.checkOut ? formatTimeOfDay(row.checkOut) : <span className="text-charcoal-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusBadge status={attendanceStatusLabel(row.status)} />
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <AttendanceRowActions
                          onView={() => onView(row)}
                          onFollowUp={() => onFollowUp(row)}
                          onReview={row.isCoverDay ? () => onReview(row) : undefined}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <div className="divide-y divide-charcoal-50 lg:hidden">
            {visibleRows.map((row) => (
              <div key={`${row.employeeId}-${row.date}`} className="p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                    {initialsOfRow(row)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-charcoal-900">{row.name}</p>
                    <p className="truncate text-[10px] text-charcoal-500">
                      {positionOf(row) || '—'} · {row.shift ? formatTimeLabel(row.shift) : '—'}
                    </p>
                  </div>
                  <StatusBadge status={attendanceStatusLabel(row.status)} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
                  <div className="rounded-lg bg-charcoal-50 px-2 py-1">
                    <dt className="text-charcoal-500">{t('Check-in')}</dt>
                    <dd className="font-semibold tabular-nums text-charcoal-900">
                      {row.checkIn ? formatTimeOfDay(row.checkIn) : '—'}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-charcoal-50 px-2 py-1">
                    <dt className="text-charcoal-500">{t('Check-out')}</dt>
                    <dd className="font-semibold tabular-nums text-charcoal-900">
                      {row.checkOut ? formatTimeOfDay(row.checkOut) : '—'}
                    </dd>
                  </div>
                </dl>
                {row.deduction && (row.status === 'Late' || row.status === 'Absent') && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-semibold text-red-600">
                      {t('Deduction: {{amount}}', { amount: formatMoney(row.deduction.amount) })}
                    </span>
                    <StatusBadge status={humanize(row.deduction.status)} />
                  </p>
                )}
                <div className="mt-2">
                  <AttendanceRowActions
                    onView={() => onView(row)}
                    onFollowUp={() => onFollowUp(row)}
                    onReview={row.isCoverDay ? () => onReview(row) : undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ==================== per-row actions (mock attRowActions) ==================== */

function AttendanceRowActions({
  onView,
  onFollowUp,
  onReview,
}: {
  onView: () => void
  onFollowUp: () => void
  onReview?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {onReview && (
        <Button
          size="sm"
          variant="secondary"
          className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-500/10"
          onClick={onReview}
        >
          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t('Review cover day')}
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={onFollowUp}>
        <Zap className="h-3.5 w-3.5" aria-hidden="true" /> {t('Take action')}
      </Button>
      <Button size="sm" variant="ghost" onClick={onView}>
        {t('View')}
      </Button>
    </div>
  )
}

/* ==================== detail modal (mock openAttDetail) ==================== */

function AttendanceDetailModal({
  row,
  member,
  canViewEmployees,
  onFollowUp,
  onReview,
  onClose,
}: {
  row: AttendanceGridRow
  member: TeamMemberDay | null
  canViewEmployees: boolean
  onFollowUp: () => void
  onReview: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // The month under review — opens on the viewed day's month and can be changed
  // to walk back through earlier months.
  const [month, setMonth] = useState(row.date.slice(0, 7))
  const currentMonth = todayIso().slice(0, 7)
  const historyQuery = useQuery({
    queryKey: ['portal', 'attendance-history', row.employeeId, month],
    queryFn: ({ signal }) => getOwnAttendance(row.employeeId, month, 1, signal),
  })

  const requestsQuery = useQuery({
    queryKey: ['portal', 'employee-requests', row.employeeId],
    queryFn: ({ signal }) => getOwnRequests(row.employeeId, signal),
  })

  const decideMutation = useMutation({
    mutationFn: (input: { requestId: number; decision: 'Approve' | 'Reject'; type: string }) =>
      decideRequest(
        input.requestId,
        input.decision,
        null,
        // Unscheduled-attendance approvals carry the cover-day count (1 or 2).
        input.decision === 'Approve' && input.type === 'Unscheduled Attendance' ? 1 : undefined,
      ),
    onSuccess: (_data, input) => {
      toast(
        input.decision === 'Approve'
          ? t('Request #{{id}} approved to HR review', { id: input.requestId })
          : t('Request #{{id}} rejected', { id: input.requestId }),
      )
      void queryClient.invalidateQueries({ queryKey: ['portal', 'attendance-history', row.employeeId] })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'employee-requests', row.employeeId] })
      // An approved cover day changes the day grid's counters.
      void queryClient.invalidateQueries({ queryKey: ['portal', 'grid'] })
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const initials = member?.initials ?? initialsOf(row.name)
  const position = member?.position ?? '—'

  const requests = requestsQuery.data ?? []
  // Index every request against each day it covers, so a late/absent row can
  // show the request raised for that exact day.
  const requestsByDate = new Map<string, EmployeeRequestItem[]>()
  for (const request of requests) {
    if (!request.requestedDate) continue
    let cursor = request.requestedDate
    const end = request.endDate ?? request.requestedDate
    for (let guard = 0; cursor <= end && guard < 62; guard += 1) {
      const list = requestsByDate.get(cursor) ?? []
      list.push(request)
      requestsByDate.set(cursor, list)
      cursor = addDaysIso(cursor, 1)
    }
  }

  // Late / absent / cover days of the selected month, newest first — including the
  // day the manager opened the modal for.
  const historyItems = (historyQuery.data?.items ?? [])
    .filter((item) => item.status === 'Late' || item.status === 'Absent' || item.isCoverDay)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const lateCount = historyItems.filter((item) => item.status === 'Late').length
  const coverCount = historyItems.filter((item) => item.isCoverDay).length
  const absentCount = historyItems.filter((item) => item.status === 'Absent').length

  return (
    <Modal
      open
      title={t('{{name}} — {{date}} attendance', { name: row.name, date: formatDate(row.date) })}
      subtitle={position}
      width="wide"
      onClose={onClose}
      footer={
        <>
          {row.isCoverDay && (
            <Button
              size="sm"
              variant="secondary"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-500/10"
              onClick={onReview}
            >
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t('Review cover day')}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onFollowUp}>
            {t('Take action')}
          </Button>
          {canViewEmployees && (
            <Button size="sm" onClick={() => navigate(`/employee/branch/employees/${row.employeeId}`)}>
              {t('Full profile')}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {/* Identity */}
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-charcoal-900">
              {row.name} <StatusBadge status={humanize(row.status)} />
            </p>
            <p className="text-[10px] text-charcoal-500">{gymLabel(row)}</p>
          </div>
          <div className="ms-auto flex-shrink-0 text-end">
            <p className="text-[10px] text-charcoal-400">{t('Scheduled today')}</p>
            <p className="text-xs font-semibold text-charcoal-900">
              {row.isCoverDay ? t('Covering (Extra Shift)') : formatTimeLabel(row.shift)}
            </p>
          </div>
        </div>

        {/* Check in / out / today */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="bento-label text-charcoal-500">{t('Check in')}</p>
            <p className={cn('mt-0.5 text-sm font-bold', row.checkIn ? 'text-charcoal-900' : 'text-charcoal-400')}>
              {formatTimeOfDay(row.checkIn)}
            </p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="bento-label text-charcoal-500">{t('Check out')}</p>
            <p className={cn('mt-0.5 text-sm font-bold', row.checkOut ? 'text-charcoal-900' : 'text-charcoal-400')}>
              {formatTimeOfDay(row.checkOut)}
            </p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="bento-label text-charcoal-500">{t('Today')}</p>
            <p
              className={cn(
                'mt-0.5 text-sm font-bold',
                row.status === 'Late' ? 'text-yellow-600' : row.status === 'Absent' ? 'text-red-600' : 'text-brand-700',
              )}
            >
              {row.status}
            </p>
          </div>
        </div>

        {/* Late / absent history — the month behind this day */}
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-charcoal-100 text-charcoal-600">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="bento-label">{t('LATE / ABSENT HISTORY')}</p>
                <p className="truncate text-[10px] text-charcoal-500">{monthLabel(month)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-charcoal-200 bg-white">
                <button
                  type="button"
                  onClick={() => setMonth(stepMonth(month, -1))}
                  aria-label={t('Previous month')}
                  className="rounded-s-lg p-1 text-charcoal-500 transition-colors hover:bg-charcoal-50 hover:text-charcoal-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                </button>
                <input
                  type="month"
                  value={month}
                  max={currentMonth}
                  onChange={(event) => event.target.value && setMonth(event.target.value)}
                  aria-label={t('History month')}
                  className="h-6 w-[7.5rem] border-0 bg-transparent px-1 text-center text-[11px] font-semibold text-charcoal-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setMonth(stepMonth(month, 1))}
                  disabled={month >= currentMonth}
                  aria-label={t('Next month')}
                  className="rounded-e-lg p-1 text-charcoal-500 transition-colors hover:bg-charcoal-50 hover:text-charcoal-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                </button>
              </div>
              <span className="badge badge-yellow">{t('{{count}} late', { count: lateCount })}</span>
              <span className="badge badge-red">{t('{{count}} absent', { count: absentCount })}</span>
              <span className="badge badge-purple">{t('{{count}} covering', { count: coverCount })}</span>
            </div>
          </div>
          <div className="divide-y divide-charcoal-50">
            {historyQuery.isLoading ? (
              <div className="p-3 text-center text-xs text-charcoal-500">{t('Loading history…')}</div>
            ) : historyQuery.error ? (
              <p className="p-3 text-center text-[11px] text-red-600">{describeApiError(historyQuery.error)}</p>
            ) : historyItems.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-charcoal-50 text-charcoal-400">
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-xs font-semibold text-charcoal-700">{t('No late arrivals or absences')}</p>
                <p className="mt-0.5 text-[10px] text-charcoal-500">
                  {t('{{month}} is clean for {{name}}.', { month: monthLabel(month), name: row.name })}
                </p>
              </div>
            ) : (
              historyItems.map((item) => {
                const dayRequests = requestsByDate.get(item.date) ?? []
                const isViewedDay = item.date === row.date
                const { weekday, day } = dayParts(item.date)
                const shift = item.isCoverDay ? null : shiftWindow(item.shift)
                const lateMinutes =
                  shift && item.status === 'Late' && item.checkIn ? minutesBetween(shift.start, item.checkIn) : 0
                const earlyMinutes =
                  shift && item.status === 'Early Checkout' && item.checkOut
                    ? minutesBetween(item.checkOut, shift.end)
                    : 0
                return (
                  <div key={item.date} className={cn('flex gap-2.5 px-3 py-2.5', isViewedDay && 'bg-brand-50/40')}>
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg',
                        item.status === 'Late' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700',
                      )}
                    >
                      <span className="text-[8px] font-bold uppercase tracking-wide">{weekday}</span>
                      <span className="text-sm font-bold leading-none">{day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={item.status} />
                        <span className="truncate text-[11px] font-medium text-charcoal-800">
                          {item.isCoverDay
                            ? t('Scheduled: Off — worked an extra shift')
                            : formatTimeLabel(item.shift)}
                        </span>
                        {item.coverDays != null && item.coverDays > 0 && (
                          <span className="badge badge-purple">
                            {item.coverDays === 1
                              ? t('Cover {{count}} day', { count: item.coverDays })
                              : t('Cover {{count}} days', { count: item.coverDays })}
                          </span>
                        )}
                        {isViewedDay && <span className="badge badge-blue">{t('This day')}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-charcoal-500">
                        <span className="inline-flex items-center gap-1">
                          <LogIn className="h-3 w-3 text-charcoal-400" aria-hidden="true" />
                          {t('In')}{' '}
                          <span className="font-mono font-semibold tabular-nums text-charcoal-800">
                            {formatTimeOfDay(item.checkIn)}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <LogOut className="h-3 w-3 text-charcoal-400" aria-hidden="true" />
                          {t('Out')}{' '}
                          <span className="font-mono font-semibold tabular-nums text-charcoal-800">
                            {formatTimeOfDay(item.checkOut)}
                          </span>
                        </span>
                        {lateMinutes > 0 && (
                          <span className="font-semibold text-amber-600">
                            {t('Late {{count}}m', { count: lateMinutes })}
                          </span>
                        )}
                        {earlyMinutes > 0 && (
                          <span className="font-semibold text-orange-600">
                            {t('Left early {{count}}m', { count: earlyMinutes })}
                          </span>
                        )}
                      </div>

                      {/* The request raised for this day, actionable right here */}
                      {dayRequests.map((request) => (
                        <div
                          key={request.id}
                          className="mt-1.5 rounded-lg border border-charcoal-100 bg-charcoal-50/60 p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-[11px] font-semibold text-charcoal-800">
                              {t('Request #{{id}} · {{type}}', { id: request.id, type: request.type })}
                            </p>
                            <StatusBadge status={humanize(request.status)} />
                          </div>
                          {request.status === 'Pending' && (
                            <div className="mt-1.5 flex gap-1.5">
                              <Button
                                size="sm"
                                variant="success"
                                disabled={decideMutation.isPending}
                                onClick={() =>
                                  decideMutation.mutate({ requestId: request.id, decision: 'Approve', type: request.type })
                                }
                              >
                                {t('Approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="dangerOutline"
                                disabled={decideMutation.isPending}
                                onClick={() =>
                                  decideMutation.mutate({ requestId: request.id, decision: 'Reject', type: request.type })
                                }
                              >
                                {t('Reject')}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
            {requestsQuery.error && (
              <p className="border-t border-charcoal-100 px-3 py-2 text-[10px] text-red-600">
                {t('Requests could not be loaded: {{error}}', { error: describeApiError(requestsQuery.error) })}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ==================== cover-day review (unscheduled attendance) ==================== */

/**
 * The action that actually changes a cover day's outcome: approve it as 1 or 2
 * cover days (sent to HR for the final sign-off) or reject it. A cover day is
 * never a disciplinary case, so this flow never raises a warning or deduction.
 */
function CoverReviewDialog({ row, onClose }: { row: AttendanceGridRow; onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [days, setDays] = useState<1 | 2>(1)

  const requestsQuery = useQuery({
    queryKey: ['portal', 'employee-requests', row.employeeId],
    queryFn: ({ signal }) => getOwnRequests(row.employeeId, signal),
  })
  const salaryQuery = useQuery({
    queryKey: ['portal', 'employee-salary', row.employeeId],
    queryFn: ({ signal }) => getEmployeeDirectory({ search: row.name, pageSize: 5, signal }),
    staleTime: 5 * 60_000,
  })

  const request = (requestsQuery.data ?? []).find(
    (item) => item.type === 'Unscheduled Attendance' && item.requestedDate === row.date,
  )
  const salary = salaryQuery.data?.items.find((item) => item.id === row.employeeId)?.salary ?? null
  // Cover pay is one day at the same rate a deduction uses: the day's own month.
  const [coverYear, coverMonth] = row.date.split('-').map(Number)
  const coverMonthDays = Number.isFinite(coverYear) && Number.isFinite(coverMonth)
    ? new Date(coverYear, coverMonth, 0).getDate()
    : 30
  const dailyRate = salary && salary > 0 ? salary / coverMonthDays : null
  const coverPay = dailyRate == null ? null : Math.round(dailyRate * days * 100) / 100
  const approvedDays = request?.calculatedDays ?? null
  const approvedPay = dailyRate == null || !approvedDays ? null : Math.round(dailyRate * approvedDays * 100) / 100

  const decide = useMutation({
    mutationFn: (decision: 'Approve' | 'Reject') =>
      decideRequest(request!.id, decision, null, decision === 'Approve' ? days : undefined),
    onSuccess: (_data, decision) => {
      toast(
        decision === 'Approve'
          ? days === 1
            ? t('Cover day approved for {{count}} day — sent to HR for sign-off.', { count: days })
            : t('Cover day approved for {{count}} days — sent to HR for sign-off.', { count: days })
          : t('Cover day rejected.'),
      )
      void queryClient.invalidateQueries({ queryKey: ['portal', 'attendance-history', row.employeeId] })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'employee-requests', row.employeeId] })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'grid'] })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'desk'] })
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const pending = request?.status === 'Pending'

  return (
    <Modal
      open
      title={t('Cover day — {{name}}', { name: row.name })}
      subtitle={`${formatDate(row.date)} · ${row.gym}`}
      onClose={onClose}
      footer={
        requestsQuery.isLoading ? undefined : pending ? (
          <>
            <Button size="sm" variant="secondary" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button
              size="sm"
              variant="dangerOutline"
              disabled={decide.isPending}
              onClick={() => decide.mutate('Reject')}
            >
              {t('Reject')}
            </Button>
            <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate('Approve')}>
              {days === 1
                ? t('Approve {{count}} day', { count: days })
                : t('Approve {{count}} days', { count: days })}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t('Close')}
          </Button>
        )
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="bento-label text-charcoal-500">{t('Scheduled')}</p>
            <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{t('Off')}</p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="bento-label text-charcoal-500">{t('Check in')}</p>
            <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{formatTimeOfDay(row.checkIn)}</p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="bento-label text-charcoal-500">{t('Check out')}</p>
            <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{formatTimeOfDay(row.checkOut)}</p>
          </div>
        </div>

        {requestsQuery.isLoading ? (
          <p className="text-xs text-charcoal-500">{t('Loading the cover request…')}</p>
        ) : requestsQuery.error ? (
          <p className="text-xs text-red-600">{describeApiError(requestsQuery.error)}</p>
        ) : !request ? (
          <div className="rounded-lg border border-charcoal-200 bg-charcoal-50/60 p-3">
            <p className="text-xs font-semibold text-charcoal-800">{t('No cover request on record')}</p>
            <p className="mt-0.5 text-[10px] text-charcoal-500">
              {t('This punch raised no Unscheduled Attendance request, so there is nothing to approve or reject.')}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-charcoal-200 p-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-charcoal-900">
                  {t('Request #{{id}} · {{type}}', { id: request.id, type: request.type })}
                </p>
                <p className="text-[10px] text-charcoal-500">
                  {t('Submitted {{date}}', { date: formatDate(request.submittedDate) })}
                </p>
              </div>
              <StatusBadge status={humanize(request.status)} />
            </div>

            {pending ? (
              <>
                <div>
                  <p className="bento-label text-charcoal-500">{t('Count this cover day as')}</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {([1, 2] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDays(value)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-start transition-colors',
                          days === value
                            ? 'border-purple-400 bg-purple-50 dark:bg-purple-500/10'
                            : 'border-charcoal-200 hover:bg-charcoal-50',
                        )}
                      >
                        <span className="block text-xs font-semibold text-charcoal-900">
                          {value === 1 ? t('{{count}} day', { count: value }) : t('{{count}} days', { count: value })}
                        </span>
                        <span className="block text-[10px] text-charcoal-500">
                          {value === 1 ? t('Single cover credit') : t('Double cover credit (long shift)')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-purple-50/70 p-2.5 dark:bg-purple-500/10">
                  <p className="flex items-center justify-between text-xs">
                    <span className="font-medium text-charcoal-700">{t('Cover pay')}</span>
                    <span className="font-bold text-purple-700 dark:text-purple-300">
                      {coverPay == null ? '—' : formatMoney(coverPay)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-charcoal-500">
                    {salary && salary > 0
                      ? days === 1
                        ? t('Base {{amount}} ÷ 30 × {{count}} day', { amount: formatMoney(salary), count: days })
                        : t('Base {{amount}} ÷ 30 × {{count}} days', { amount: formatMoney(salary), count: days })
                      : t('No base salary on record — HR prices the cover day.')}
                  </p>
                </div>

                <p className="text-[10px] text-charcoal-500">
                  {t('Approving sends it to HR for the final sign-off; the cover days count toward payroll once HR approves.')}
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-charcoal-200 bg-charcoal-50/60 p-2.5">
                <p className="text-xs font-medium text-charcoal-800">
                  {request.status === 'Pending HR Review'
                    ? t('Approved by the desk — waiting for HR sign-off.')
                    : request.status === 'Approved'
                      ? approvedDays === 1
                        ? t('Approved · {{count}} cover day', { count: approvedDays })
                        : approvedDays
                          ? t('Approved · {{count}} cover days', { count: approvedDays })
                          : t('Approved')
                      : t('Rejected — no cover credit for this day.')}
                </p>
                {request.status === 'Approved' && approvedPay != null && (
                  <p className="mt-0.5 text-[10px] text-charcoal-500">
                    {t('Cover pay: {{amount}}', { amount: formatMoney(approvedPay) })}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

/** "2026-11" → "November 2026" (the month picker's label). */
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  if (!year || !monthNumber) return month
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(activeLocale(), { month: 'long', year: 'numeric' })
}

/** "2026-11" ± n months, keeping the "yyyy-MM" shape. */
function stepMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(year, monthNumber - 1 + delta, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

/** DateOnly → the calendar chip's weekday + day number. */
function dayParts(iso: string): { weekday: string; day: string } {
  const date = new Date(iso + 'T00:00:00')
  return {
    weekday: date.toLocaleDateString(activeLocale(), { weekday: 'short' }),
    day: String(date.getDate()),
  }
}

/** Shift label "08:00–16:00" → its start/end clock times. */
function shiftWindow(label: string): { start: string; end: string } | null {
  const match = /(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/.exec(label)
  return match ? { start: match[1], end: match[2] } : null
}

/** Minutes from `a` to `b` ("HH:mm"), never negative. */
function minutesBetween(a: string, b: string): number {
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
  return Math.max(0, toMinutes(b) - toMinutes(a))
}

/** DateOnly strings sort lexicographically; increment on UTC-anchored arithmetic. */
function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

function gymLabel(row: AttendanceGridRow): string {
  return `${row.gym}`
}

/* ==================== identity join ==================== */

async function loadIdentities(
  { signal }: { signal?: AbortSignal },
  canViewEmployees: boolean,
  ledTeamId: number | null,
  date: string,
): Promise<IdentityRow[]> {
  if (canViewEmployees) {
    const page = await getEmployeeDirectory({ page: 1, pageSize: 200, signal })
    return page.items.map((row) => ({ employeeId: row.id, position: row.position, initials: row.initials }))
  }
  if (ledTeamId != null) {
    const day = await getTeamToday(ledTeamId, date, signal)
    return day.members.map((member) => ({
      employeeId: member.employeeId,
      position: member.position,
      initials: member.initials,
    }))
  }
  return []
}
