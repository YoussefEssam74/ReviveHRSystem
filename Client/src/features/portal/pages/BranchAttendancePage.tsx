import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Zap } from 'lucide-react'
import {
  getAttendanceGrid,
  getEmployeeDirectory,
  type AttendanceGridRow,
} from '../api/branch.api'
import { getOwnAttendance } from '../api/attendance.api'
import { getOwnRequests } from '../api/requests.api'
import { CreateFollowUpModal } from './TeamActionsPage'
import { getTeamToday, type TeamMemberDay } from '../api/team.api'

import { EmptyState } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { formatDate, humanize } from '../../../lib/format'

/**
 * Attendance Management (mock §16 renderAttendanceManagement): one date of the
 * composed attendance grid — the four real stat tiles plus the Late and Absent
 * problem lists. Row actions: Take action (follow-up), Reminder, View (detail
 * modal with the month's late/absent history + requests) and Mark Present on
 * absent rows (manualAttendance, `attendance.manual_entry` key).
 */

/** "Showed up" statuses for the Present tile (Late and Missing Checkout count separately). */
const PRESENT_SET = new Set(['On Time', 'Present', 'Early Checkout'])

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
  const { isBranchManager, isTeamLeader } = usePortalSession()

  if (!isBranchManager && !isTeamLeader) {
    return (
      <EmptyState
        title="Attendance Management is for managers"
        hint="The day roster is guarded by the attendance.view permission key."
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
  const { me } = usePortalSession()
  const [detailRow, setDetailRow] = useState<AttendanceGridRow | null>(null)
  const [followUpMember, setFollowUpMember] = useState<TeamMemberDay | null>(null)

  // Identity join: the grid row carries name + shift + punches but no position.
  // BMs (employees.view) join the directory; TLs join the team-day roster.
  const identityQuery = useQuery({
    queryKey: ['portal', 'attendance-identity', mapKey, date],
    queryFn: ({ signal }) => loadIdentities({ signal }, canViewEmployees, ledTeamId, date),
    enabled: rows.length > 0,
    staleTime: 5 * 60_000,
  })
  const identities = identityQuery.data ?? []

  const lateRows = rows.filter((row) => row.status === 'Late')
  const absentRows = rows.filter((row) => row.status === 'Absent')
  const presentCount = rows.filter((row) => PRESENT_SET.has(row.status)).length
  const missingCheckoutCount = rows.filter((row) => row.status === 'Missing Checkout').length

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
  // employee that was clicked — never on whoever happens to head the list.
  const openFollowUpFor = (row: AttendanceGridRow) => {
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
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <div>
          <h1 className="text-base font-bold text-charcoal-900">Attendance Management</h1>
          <p className="text-[11px] leading-tight text-charcoal-500">
            Today&apos;s branch attendance · {me?.activeGym?.gymName || 'your gym'} · {formatDate(date)}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="form-input h-8 w-32 py-1 text-xs"
          aria-label="Attendance date"
        />
      </div>

      {/* Stats — real counts from the day's grid (compact) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          value={presentCount}
          label="Present"
          accent="border-l-brand-500"
          numberClass="text-brand-600"
        />
        <StatTile
          value={lateRows.length}
          label="Late"
          numberClass="text-yellow-600"
        />
        <StatTile
          value={absentRows.length}
          label="Absent"
          numberClass="text-red-600"
        />
        <StatTile
          value={missingCheckoutCount}
          label="Missing Checkout"
          numberClass="text-blue-600"
        />
      </div>

      {lateRows.length === 0 && absentRows.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8" aria-hidden="true" />}
          title="No attendance exceptions"
          hint="Everyone scheduled on this day checked in on time. Pick another date to review late or absent days."
        />
      ) : (
        <div className="space-y-3">
          <ExceptionList
            title="LATE CHECK-INS"
            titleIcon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
            headerClass="bg-yellow-50/50"
            titleClass="text-yellow-700"
            rows={lateRows}
            identities={identities}
            hint={(row) => (row.checkIn ? `Checked in ${row.checkIn}` : 'No check-in')}
            onView={setDetailRow}
            onFollowUp={openFollowUpFor}
          />
          <ExceptionList
            title="ABSENT"
            titleIcon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
            headerClass="bg-red-50/50"
            titleClass="text-red-700"
            rows={absentRows}
            identities={identities}
            hint={() => 'No check-in'}
            onView={setDetailRow}
            onFollowUp={openFollowUpFor}
          />
        </div>
      )}

      {detailRow && (
        <AttendanceDetailModal
          row={detailRow}
          member={memberById.get(detailRow.employeeId) ?? null}
          canViewEmployees={canViewEmployees}
          onFollowUp={() => openFollowUpFor(detailRow)}
          onClose={() => setDetailRow(null)}
        />
      )}

      {followUpMember && (
        <CreateFollowUpModal
          members={members}
          defaultMember={followUpMember}
          onClose={() => setFollowUpMember(null)}
        />
      )}
    </div>
  )
}

/* ==================== tiles + lists ==================== */

function StatTile({
  value,
  label,
  accent,
  numberClass,
}: {
  value: number
  label: string
  accent?: string
  numberClass: string
}) {
  return (
    <div className={cn('rounded-lg border border-charcoal-200 border-l-4 bg-white px-3 py-2 text-center', accent)}>
      <p className={cn('text-base font-bold leading-tight', numberClass)}>{value}</p>
      <p className="text-[10px] text-charcoal-500">{label}</p>
    </div>
  )
}

function ExceptionList({
  title,
  titleIcon,
  headerClass,
  titleClass,
  rows,
  identities,
  hint,
  onView,
  onFollowUp,
}: {
  title: string
  titleIcon: React.ReactNode
  headerClass: string
  titleClass: string
  rows: AttendanceGridRow[]
  identities: IdentityRow[]
  hint: (row: AttendanceGridRow) => string
  onView: (row: AttendanceGridRow) => void
  onFollowUp: (row: AttendanceGridRow) => void
}) {
  if (rows.length === 0) return null
  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
      <div className={cn('flex items-center gap-1.5 border-b border-charcoal-100 px-4 py-2.5', headerClass)}>
        <p className={cn('bento-label flex items-center gap-1.5', titleClass)}>
          {titleIcon}
          {title} ({rows.length})
        </p>
      </div>
      <div className="divide-y divide-charcoal-50">
        {rows.map((row) => {
          const identity = identities.find((item) => item.employeeId === row.employeeId)
          return (
            <div
              key={`${row.employeeId}-${row.date}`}
              className="flex flex-col justify-between gap-2 p-3 transition-colors hover:bg-charcoal-50/50 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                  {identity?.initials ?? initialsOf(row.name)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-charcoal-900">{row.name}</p>
                  <p className="truncate text-[10px] text-charcoal-500">
                    {identity?.position ?? '—'} · {hint(row)}
                  </p>
                </div>
              </div>
              <AttendanceRowActions
                onView={() => onView(row)}
                onFollowUp={() => onFollowUp(row)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ==================== per-row actions (mock attRowActions) ==================== */

function AttendanceRowActions({
  onView,
  onFollowUp,
}: {
  onView: () => void
  onFollowUp: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="secondary" onClick={onFollowUp}>
        <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Take action
      </Button>
      <Button size="sm" variant="secondary" onClick={onView}>
        View
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
  onClose,
}: {
  row: AttendanceGridRow
  member: TeamMemberDay | null
  canViewEmployees: boolean
  onFollowUp: () => void
  onClose: () => void
}) {
  const navigate = useNavigate()

  // History events: the viewed day's month's late + absent days, newest first,
  // excluding the day itself (the host strip already shows that one). The month
  // comes from the viewed row — never the server's UTC-anchored default, which
  // drifts into the previous month at month boundaries (Egypt UTC+2/+3).
  const month = row.date.slice(0, 7)
  const historyQuery = useQuery({
    queryKey: ['portal', 'attendance-history', row.employeeId, month],
    queryFn: ({ signal }) => getOwnAttendance(row.employeeId, month, 1, signal),
  })

  const requestsQuery = useQuery({
    queryKey: ['portal', 'employee-requests', row.employeeId],
    queryFn: ({ signal }) => getOwnRequests(row.employeeId, signal),
  })

  const initials = member?.initials ?? initialsOf(row.name)
  const position = member?.position ?? '—'

  // History events: the viewed day's month's late + absent days, newest first,
  // excluding the viewed day itself (the host strip already shows that one).
  const historyItems = (historyQuery.data?.items ?? []).filter(
    (item) => (item.status === 'Late' || item.status === 'Absent') && item.date !== row.date,
  )
  const lateBefore = historyItems.filter((item) => item.status === 'Late').length
  const absentBefore = historyItems.length - lateBefore

  const requests = requestsQuery.data ?? []

  return (
    <Modal
      open
      title={`${row.name} — ${formatDate(row.date)} attendance`}
      subtitle={position}
      width="wide"
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onFollowUp}>
            Take action
          </Button>
          {canViewEmployees && (
            <Button size="sm" onClick={() => navigate(`/employee/branch/employees/${row.employeeId}`)}>
              Full profile
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
          <div className="ml-auto flex-shrink-0 text-right">
            <p className="text-[10px] text-charcoal-400">Scheduled today</p>
            <p className="text-xs font-semibold text-charcoal-900">{row.shift}</p>
          </div>
        </div>

        {/* Check in / out / today */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="bento-label text-charcoal-500">Check in</p>
            <p className={cn('mt-0.5 text-sm font-bold', row.checkIn ? 'text-charcoal-900' : 'text-charcoal-400')}>
              {row.checkIn ?? '—'}
            </p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="bento-label text-charcoal-500">Check out</p>
            <p className={cn('mt-0.5 text-sm font-bold', row.checkOut ? 'text-charcoal-900' : 'text-charcoal-400')}>
              {row.checkOut ?? '—'}
            </p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="bento-label text-charcoal-500">Today</p>
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
          <div className="flex items-center justify-between border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-2">
            <p className="bento-label">LATE / ABSENT HISTORY</p>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[9px] font-semibold text-yellow-700">
                {lateBefore} late
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-semibold text-red-700">
                {absentBefore} absent
              </span>
            </div>
          </div>
          <div className="divide-y divide-charcoal-50">
            {historyQuery.isLoading ? (
              <div className="p-3 text-center text-xs text-charcoal-500">Loading history…</div>
            ) : historyQuery.error ? (
              <p className="p-3 text-center text-[11px] text-red-600">{describeApiError(historyQuery.error)}</p>
            ) : historyItems.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-charcoal-500">No late arrivals or absences on record</p>
              </div>
            ) : (
              historyItems.map((item) => (
                <div key={item.date} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-charcoal-900">
                      {item.status} — {item.shift}
                    </p>
                    <p className="truncate text-[10px] text-charcoal-500">
                      {item.checkIn ? `Checked in ${item.checkIn}` : 'No check-in'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex flex-shrink-0 items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold',
                      item.status === 'Late' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700',
                    )}
                  >
                    {formatDate(item.date)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Requests */}
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-2">
            <p className="bento-label">REQUESTS ({requests.length})</p>
          </div>
          <div className="divide-y divide-charcoal-50">
            {requestsQuery.isLoading ? (
              <div className="p-3 text-center text-xs text-charcoal-500">Loading requests…</div>
            ) : requestsQuery.error ? (
              <p className="p-3 text-center text-[11px] text-red-600">{describeApiError(requestsQuery.error)}</p>
            ) : requests.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-charcoal-500">No requests on record</p>
              </div>
            ) : (
              requests.slice(0, 6).map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-charcoal-900">{request.type}</p>
                    <p className="truncate text-[10px] text-charcoal-500">
                      {formatDate(request.requestedDate)}
                      {request.endDate ? ` → ${formatDate(request.endDate)}` : ''} · submitted{' '}
                      {formatDate(request.submittedDate)}
                    </p>
                  </div>
                  <StatusBadge status={humanize(request.status)} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
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
