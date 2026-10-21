import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, BadgeCheck, Briefcase, CalendarDays, Check, ChevronsLeft, CreditCard, Lock, MapPin, Pencil, X } from 'lucide-react'
import { getShiftCycle, getTeamToday, setShiftAssignments, type SetAssignmentInput, type TeamMemberDay } from '../api/team.api'
import { getOwnAttendance, getOwnLeaveBalance, getOwnSchedule, manualAttendance, type EmployeeScheduleDto, type EmployeeAttendanceResponse } from '../api/attendance.api'
import { decideRequest, getOwnRequests, type EmployeeRequestItem } from '../api/requests.api'
import { getOwnEvaluationDetails, downloadDocument, downloadHrDocument, getHrDocuments, getOwnDocuments, getOwnHistory, getOwnProfile, type EmployeeDocument, type EmployeeHistoryItem, type EvaluationDetail, type HrDocument } from '../api/employee-file.api'
import { getOwnPayrollSheets } from '../api/payroll.api'
import { getAttendanceGrid } from '../api/branch.api'
import { EmptyState, SectionCard } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { apiRequest, describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { formatDateWithYear, formatMoney, humanize } from '../../../lib/format'

/** MyTeamPage hands the viewer-known header data through location.state so a
 * Team Leader (no employees.view key) still gets a usable title bar. */
interface HeaderState {
  name?: string
  position?: string
  initials?: string
  status?: string
}

function time12(value: string | null): string {
  if (!value) return '—'
  const [hourPart, minutePart] = value.split(':')
  const hour = Number(hourPart)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${minutePart} ${suffix}`
}

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Monday..Sunday dates of the week containing today (mock's "CURRENT WEEK"). */
function currentWeekDates(): { label: string; date: string }[] {
  const anchor = new Date(`${todayIso()}T00:00:00`)
  const weekdayIndex = (anchor.getDay() + 6) % 7
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - weekdayIndex)
  return Array.from({ length: 7 }, (_, index) => {
    const cursor = new Date(monday)
    cursor.setDate(monday.getDate() + index)
    return {
      label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
      date: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
    }
  })
}

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
/** Edit-shift sentinel: leave the weekday untouched (the PUT upserts only sent cells). */
const SHIFT_KEEP = '__keep'
/** Edit-shift sentinel: book an explicit rest day (null templateId). */
const SHIFT_OFF = '__off'

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export default function MemberProfilePage() {
  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const headerState = (location.state ?? {}) as HeaderState
  const { can } = usePortalSession()

  const employeeId = Number(params.id)
  const valid = Number.isFinite(employeeId) && employeeId > 0

  // Header detail is the employees.view read; team leaders get the viewer-known
  // snapshot via location.state instead (the employees-view endpoint 403s for them).
  const headerInfo = useQuery({
    queryKey: ['portal', 'member', 'header', employeeId],
    queryFn: ({ signal }) =>
      apiRequest<{ data: MemberHeader }>(`/api/employees/${employeeId}`, { signal }).then((body) => body.data),
    enabled: valid && can('employees.view'),
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 2,
  })

  if (!valid) {
    return <EmptyState title="Employee not found" hint="The drill-in link is missing a valid employee id." />
  }

  const member: MemberHeader | null =
    headerInfo.data ?? (headerState.name ? { name: headerState.name, position: headerState.position, initials: headerState.initials, status: headerState.status, gym: null, employeeNumber: null } : null)

  // Key holders get the full nine-tab management profile (mock §13); a Team
  // Leader keeps the lighter drill-in built in Phase 2.
  const fullProfile = can('employees.view') && member != null

  return (
    <div className="space-y-3">
      <MemberHeaderBar
        memberId={employeeId}
        member={member}
        fullProfile={fullProfile}
        onBack={() => navigate(-1)}
      />

      {fullProfile && member ? (
        <BMProfile memberId={employeeId} member={member} />
      ) : (
        <ProfileBody memberId={employeeId} member={member} />
      )}
    </div>
  )
}

function isForbidden(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 403
}

/* Shape of GET /api/employees/{id} → { data }. Optional lib fields map to null
 * for the location.state fallback. */
interface MemberHeader {
  name?: string
  position?: string
  level?: string
  gym?: string | null
  employeeNumber?: string | null
  hireDate?: string | null
  email?: string
  phone?: string | null
  salary?: number | null
  status?: string
  initials?: string
}

function MemberHeaderBar({
  memberId,
  member,
  fullProfile,
  onBack,
}: {
  memberId: number
  member: MemberHeader | null
  /** Viewer holds employees.view — enables the lifecycle actions + grid fallback. */
  fullProfile: boolean
  onBack: () => void
}) {
  const { me, can } = usePortalSession()
  const navigate = useNavigate()
  const ledTeamId = me?.ledTeamId ?? null

  // Today's live row (drives the status badge) — needs only the
  // caller's led team to reach this member.
  const todayQuery = useQuery({
    queryKey: ['portal', 'team', 'today', ledTeamId, 'member', memberId],
    queryFn: ({ signal }) => getTeamToday(ledTeamId as number, null, signal),
    enabled: ledTeamId != null,
  })
  // Key holders without a led team (Branch Manager) join the gym-day grid so
  // the header stays live for their whole roster.
  const gridQuery = useQuery({
    queryKey: ['portal', 'grid', todayIso(), 'member', memberId],
    queryFn: ({ signal }) => getAttendanceGrid({ date: todayIso(), page: 1, pageSize: 200, signal }),
    enabled: fullProfile && ledTeamId == null,
    staleTime: 60_000,
  })

  const teamRow = todayQuery.data?.members.find((m) => m.employeeId === memberId) ?? null
  const gridRow = (gridQuery.data?.items ?? []).find((item) => item.employeeId === memberId) ?? null
  const row: TeamMemberDay | null =
    teamRow ??
    (gridRow
      ? {
          employeeId: gridRow.employeeId,
          name: gridRow.name,
          position: '',
          status: gridRow.status,
          checkIn: gridRow.checkIn,
          initials: member?.initials ?? initialsOf(gridRow.name),
          shiftName: gridRow.shift,
          shiftStart: null,
          shiftEnd: null,
          isOff: gridRow.status === 'Off',
        }
      : null)

  const status = row?.status ?? member?.status ?? null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
        </Button>
        {fullProfile && (
          <button
            type="button"
            onClick={() => navigate('/employee/branch/employees')}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-charcoal-500 hover:bg-charcoal-50 hover:text-charcoal-800"
          >
            <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Employees
          </button>
        )}
      </div>

      <div className="rounded-xl border border-charcoal-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700">
            {member?.initials ?? '#'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-charcoal-900">{member?.name ?? `Employee #${memberId}`}</h1>
              {status && <StatusBadge status={humanize(status)} />}
            </div>
            <p className="mt-0.5 text-xs text-charcoal-500">
              {[
                member?.position ?? row?.position ?? '—',
                member?.employeeNumber ?? `#${memberId}`,
                member?.level,
                member?.gym,
                member?.hireDate ? `Hired ${formatDateWithYear(member.hireDate)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
            {fullProfile && can('employees.offboard') && (
              <Button size="sm" variant="danger" onClick={() => navigate('/employee/branch/leaving')}>
                Offboard
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PresentModal({
  memberId,
  row,
  onSaved,
  onClose,
}: {
  memberId: number
  row: { shiftStart: string | null; shiftEnd: string | null; name: string }
  /** Optional extra refresh the host page wants after the day is upserted. */
  onSaved?: () => void
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [checkIn, setCheckIn] = useState(row.shiftStart ? row.shiftStart.slice(0, 5) : '')
  const [checkOut, setCheckOut] = useState(row.shiftEnd && row.shiftEnd !== '00:00:00' ? row.shiftEnd.slice(0, 5) : '')
  const [reason, setReason] = useState('Marked present by team manager')

  const saveMutation = useMutation({
    // Today's date resolves at save time (event), not during render.
    mutationFn: () => {
      const now = new Date()
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      return manualAttendance({
        employeeId: String(memberId),
        date,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        status: 'On Time',
        reason,
      })
    },
    onSuccess: () => {
      toast('Saved.')
      onSaved?.()
      void queryClient.invalidateQueries({ queryKey: ['portal', 'team', 'today'] })
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal
      open
      title={`Mark Present — ${row.name.split(' ')[0]}`}
      subtitle="Upserts today's attendance record."
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="mp-in">
              Check in (HH:mm)
            </label>
            <input id="mp-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label" htmlFor="mp-out">
              Check out (HH:mm)
            </label>
            <input id="mp-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="form-input" />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="mp-reason">
            Reason
          </label>
          <input id="mp-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="form-input" />
        </div>
      </div>
    </Modal>
  )
}

function ProfileBody({ memberId, member }: { memberId: number; member: MemberHeader | null }) {
  return (
    <div className="space-y-3">
      {/* Employment & contact (employees.view) */}
      {member && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <SectionCard title="Employment">
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Field label="Hire Date" value={member.hireDate ? formatDateWithYear(member.hireDate) : '—'} />
              <Field label="Level" value={member.level ?? '—'} />
              <Field label="Email" value={member.email ?? '—'} />
              <Field label="Phone" value={member.phone ?? '—'} />
              <Field label="Employee #" value={member.employeeNumber ?? '—'} />
              <Field label="Gym" value={member.gym ?? '—'} />
            </dl>
          </SectionCard>
          <SectionCard title="Today">
            <TodaysAttendance memberId={memberId} />
          </SectionCard>
        </div>
      )}
      {!member && <TodaysAttendanceCard memberId={memberId} />}

      <UpcomingSchedule memberId={memberId} />
      <MemberRequests memberId={memberId} />
      <MemberEvaluations memberId={memberId} />
    </div>
  )
}

function TodaysAttendance({ memberId }: { memberId: number }) {
  const { me } = usePortalSession()
  const ledTeamId = me?.ledTeamId ?? null
  const todayQuery = useQuery({
    queryKey: ['portal', 'team', 'today', ledTeamId, 'member', memberId],
    queryFn: ({ signal }) => getTeamToday(ledTeamId as number, null, signal),
    enabled: ledTeamId != null,
  })

  const row = todayQuery.data?.members.find((m) => m.employeeId === memberId) ?? null
  if (!row) {
    return <p className="text-xs text-charcoal-500">No live team row for today.</p>
  }
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs">
      <Field
        label="Scheduled"
        value={
          row.isOff || !row.shiftName
            ? 'Off'
            : `${row.shiftName} ${time12(row.shiftStart)} – ${time12(row.shiftEnd)}`
        }
      />
      <Field label="Check In" value={time12(row.checkIn)} />
      <Field label="Shift" value={row.shiftName ?? '—'} />
      <Field label="Status" value={row.status} />
    </dl>
  )
}

function TodaysAttendanceCard({ memberId }: { memberId: number }) {
  return (
    <SectionCard title="Today">
      <TodaysAttendance memberId={memberId} />
    </SectionCard>
  )
}

function UpcomingSchedule({ memberId }: { memberId: number }) {
  const scheduleQuery = useQuery({
    queryKey: ['portal', 'member', 'schedule', memberId],
    queryFn: ({ signal }) => getOwnSchedule(memberId, undefined, signal),
  })

  if (scheduleQuery.isLoading) return <SectionCard title="Upcoming shifts"><LoadingState /></SectionCard>
  if (scheduleQuery.error)
    return (
      <SectionCard title="Upcoming shifts">
        <ErrorState message={describeApiError(scheduleQuery.error)} onRetry={() => scheduleQuery.refetch()} />
      </SectionCard>
    )

  const schedule: EmployeeScheduleDto | undefined = scheduleQuery.data
  const upcoming = (schedule?.days ?? []).slice(0, 7)
  return (
    <SectionCard
      title="Upcoming shifts"
      subtitle={
        (schedule?.cycles ?? [])
          .map((c) => `${formatDateWithYear(c.start)} – ${formatDateWithYear(c.end)} (${c.status})`)
          .join(', ') || undefined
      }
    >
      {upcoming.length === 0 ? (
        <p className="text-xs text-charcoal-500">No published shifts for this month.</p>
      ) : (
        <ul className="space-y-1.5">
          {upcoming.map((day) => (
            <li key={day.date} className={`flex items-center justify-between rounded-lg p-2.5 ${day.isToday ? 'bg-brand-50/50 ring-1 ring-brand-500' : 'bg-charcoal-50'}`}>
              <div className="flex items-center gap-2">
                <p className="w-24 text-xs font-semibold text-charcoal-900">
                  {day.dayName.slice(0, 3)} {day.date.slice(8)}
                </p>
                {day.isToday && <span className="badge badge-green">Today</span>}
              </div>
              <span className="schedule-shift-badge border border-charcoal-200 text-[10px]">
                {day.isOff || !day.shiftName ? 'OFF' : `${day.shiftName} ${time12(day.start)} – ${time12(day.end)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!schedule?.cycles.length && (
        <p className="mt-2 text-[10px] text-charcoal-400">No published cycles for {schedule?.month ?? 'this month'}.</p>
      )}
    </SectionCard>
  )
}

function MemberRequests({ memberId }: { memberId: number }) {
  const { can } = usePortalSession()
  const requestsQuery = useQuery({
    queryKey: ['portal', 'member', 'requests', memberId],
    queryFn: ({ signal }) => getOwnRequests(memberId, signal),
  })

  if (requestsQuery.isLoading) return <SectionCard title="Requests"><LoadingState /></SectionCard>
  if (requestsQuery.error)
    return (
      <SectionCard title="Requests">
        <ErrorState message={describeApiError(requestsQuery.error)} onRetry={() => requestsQuery.refetch()} />
      </SectionCard>
    )

  const requests: EmployeeRequestItem[] = requestsQuery.data ?? []
  const canDecide = can('requests.view')
  return (
    <SectionCard title={`Requests (${requests.length})`}>
      {requests.length === 0 ? (
        <p className="text-xs text-charcoal-500">No requests found.</p>
      ) : (
        <ul className="divide-y divide-charcoal-50">
          {requests.slice(0, 6).map((r) => (
            <MemberRequestRow key={r.id} memberId={memberId} request={r} canDecide={canDecide} />
          ))}
        </ul>
      )}
      {requests.length > 6 && (
        <p className="mt-1 text-[10px] text-charcoal-400">Showing the 6 most recent of {requests.length}.</p>
      )}
    </SectionCard>
  )
}

/** One request row in the member's Requests tab; a manager (requests.view) can
 *  approve-to-HR / reject inline here — same semantics as the team requests desk. */
function MemberRequestRow({
  memberId,
  request,
  canDecide,
}: {
  memberId: number
  request: EmployeeRequestItem
  canDecide: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<'Approve' | 'Reject' | null>(null)

  const decideMutation = useMutation({
    mutationFn: (input: { decision: 'Approve' | 'Reject' }) => decideRequest(request.id, input.decision, null),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['portal', 'member', 'requests', memberId] })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'requests'] })
      toast(`Request #${request.id} ${variables.decision === 'Approve' ? 'approved to HR review' : 'rejected'}.`)
      setDecision(null)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  // BM acts on Pending; once it reaches HR it is HR's call (same as the team desk).
  const canApprove = canDecide && request.status === 'Pending'
  const canReject = canDecide && (request.status === 'Pending' || request.status === 'PendingHRReview')

  return (
    <li className="flex items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-charcoal-900">{request.type}</p>
        <p className="text-[10px] text-charcoal-500">
          {formatDateWithYear(request.requestedDate)} · Submitted {formatDateWithYear(request.submittedDate)}
        </p>
        {request.reason && <p className="text-[10px] text-charcoal-400">{request.reason}</p>}
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <StatusBadge status={request.status} />
        {(canApprove || canReject) && (
          <div className="flex gap-1.5">
            {canApprove && (
              <Button size="sm" variant="primary" onClick={() => setDecision('Approve')}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approve
              </Button>
            )}
            {canReject && (
              <Button size="sm" variant="dangerOutline" onClick={() => setDecision('Reject')}>
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Reject
              </Button>
            )}
          </div>
        )}
      </div>

      {decision && (
        <Modal
          open
          title={`${decision} request #${request.id}`}
          subtitle={
            decision === 'Approve'
              ? 'Approves to HR review — HR gives the final sign-off.'
              : 'Rejects the request; reserved leave days are released.'
          }
          onClose={() => setDecision(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <Button
                variant={decision === 'Reject' ? 'danger' : 'primary'}
                loading={decideMutation.isPending}
                onClick={() => decideMutation.mutate({ decision })}
              >
                {decision === 'Approve' ? 'Confirm approve' : 'Confirm reject'}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-charcoal-600">
            {decision === 'Approve'
              ? 'The request moves to HR review for the final sign-off.'
              : 'Reject this request? Reserved leave days are released.'}
          </p>
        </Modal>
      )}
    </li>
  )
}

function MemberEvaluations({ memberId }: { memberId: number }) {
  const evalsQuery = useQuery({
    queryKey: ['portal', 'member', 'evaluations', memberId],
    queryFn: ({ signal }) => getOwnEvaluationDetails(memberId, signal),
  })

  if (evalsQuery.isLoading) return <SectionCard title="Evaluations"><LoadingState /></SectionCard>
  if (evalsQuery.error)
    return (
      <SectionCard title="Evaluations">
        <ErrorState message={describeApiError(evalsQuery.error)} onRetry={() => evalsQuery.refetch()} />
      </SectionCard>
    )

  const evals: EvaluationDetail[] = evalsQuery.data ?? []
  return (
    <SectionCard title={`Evaluations (${evals.length})`}>
      {evals.length === 0 ? (
        <p className="text-xs text-charcoal-500">No evaluations yet.</p>
      ) : (
        <ul className="divide-y divide-charcoal-50">
          {evals.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-charcoal-900">{e.period}</p>
                <p className="text-[10px] text-charcoal-500">
                  Score {e.score.toFixed(1)}/{e.maxScore} · {formatDateWithYear(e.date)} · Reviewer {e.reviewer || '—'}
                </p>
              </div>
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
                <StatusBadge status={e.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-charcoal-50 p-2.5">
      <dt className="text-[10px] text-charcoal-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-charcoal-900">{value}</dd>
    </div>
  )
}

/* ==================== Branch Manager management profile (mock §13) ==================== */

const BM_TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'documents', label: 'Documents' },
  { id: 'employment', label: 'Employment' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'shift', label: 'Shift' },
  { id: 'requests', label: 'Requests' },
  { id: 'evals', label: 'Evaluations' },
  { id: 'payroll', label: 'Payroll' },
] as const

type BmTabId = (typeof BM_TABS)[number]['id']

/* ==================== bm profile ==================== */

function BMProfile({ memberId, member }: { memberId: number; member: MemberHeader }) {
  const { can } = usePortalSession()
  const [tab, setTab] = useState<BmTabId>('personal')

  // Shares the ShiftTab cache entry (same query key) — no extra network call.
  const scheduleQuery = useQuery({
    queryKey: ['portal', 'member', 'schedule', memberId],
    queryFn: ({ signal }) => getOwnSchedule(memberId, undefined, signal),
  })

  // Week days that fall inside a published cycle but have no assignment row —
  // surfaced on every tab so an unassigned day is never silent.
  const missingDays = useMemo(() => {
    const schedule = scheduleQuery.data
    if (!schedule) return []
    const byDate = new Map((schedule.days ?? []).map((day) => [day.date, day]))
    return currentWeekDates()
      .filter(({ date }) => !byDate.has(date))
      .filter(({ date }) => schedule.cycles.some((cycle) => cycle.start <= date && date <= cycle.end))
      .map(({ label, date }) => `${label} ${date.slice(5)}`)
  }, [scheduleQuery.data])

  // Salary data is HR-controlled: the payroll tab stays hidden until the viewer
  // holds payroll.view (a seeded Branch Manager does not).
  const tabs = BM_TABS.filter((option) => option.id !== 'payroll' || can('payroll.view'))

  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
      <div className="flex overflow-x-auto border-b border-charcoal-100 bg-charcoal-50/60 px-1.5">
        {tabs.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTab(option.id)}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors',
              tab === option.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-700',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {missingDays.length > 0 && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-800">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">
              {missingDays.length} {missingDays.length === 1 ? 'day' : 'days'} of this week{' '}
              {missingDays.length === 1 ? 'has' : 'have'} no assigned shift.
            </span>{' '}
            {missingDays.join(', ')} — open the Shift tab to assign {missingDays.length === 1 ? 'it' : 'them'}.
          </p>
        </div>
      )}
      <div className="p-4">
        {tab === 'personal' && <PersonalTab memberId={memberId} member={member} />}
        {tab === 'documents' && <DocumentsTab memberId={memberId} />}
        {tab === 'employment' && <EmploymentTab memberId={memberId} />}
        {tab === 'attendance' && <AttendanceTab memberId={memberId} />}
        {tab === 'shift' && <ShiftTab memberId={memberId} />}
        {tab === 'requests' && <MemberRequests memberId={memberId} />}
        {tab === 'evals' && <MemberEvaluations memberId={memberId} />}
        {tab === 'payroll' && <PayrollTab memberId={memberId} member={member} />}
      </div>
    </div>
  )
}

/* ==================== personal ==================== */

function InfoField({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <label className="bento-label text-charcoal-500">{label}</label>
      <p className="mt-0.5 text-xs text-charcoal-900">{value || '—'}</p>
    </div>
  )
}

function HrRow({
  label,
  value,
  icon,
  divider = true,
  valueClassName,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  divider?: boolean
  valueClassName?: string
}) {
  return (
    <div className={divider ? 'flex items-end justify-between border-b border-charcoal-200 pb-2' : 'flex items-end justify-between'}>
      <div className="min-w-0">
        <p className="bento-label text-charcoal-500">{label}</p>
        <p className={cn('mt-0.5 text-xs font-semibold text-charcoal-900', valueClassName)}>{value}</p>
      </div>
      {icon}
    </div>
  )
}

function PersonalTab({ memberId, member }: { memberId: number; member: MemberHeader }) {
  const profileQuery = useQuery({
    queryKey: ['portal', 'member', 'profile', memberId],
    queryFn: ({ signal }) => getOwnProfile(memberId, signal),
  })

  if (profileQuery.isLoading) return <LoadingState label="Loading profile…" />
  if (profileQuery.error)
    return <ErrorState message={describeApiError(profileQuery.error)} onRetry={() => profileQuery.refetch()} />

  const profile = profileQuery.data
  const employmentStatus = humanize(profile?.status ?? member.status ?? '—')
  const employmentType = profile?.employmentType ?? null
  const gymLabel = profile?.gym?.name
    ? [profile.gym.name, profile.gym.branch].filter(Boolean).join(' — ')
    : member.gym ?? '—'
  const employeeId = member.employeeNumber || `EMP-${String(memberId).padStart(4, '0')}`
  const hireDate = member.hireDate
    ? formatDateWithYear(member.hireDate)
    : profile?.hireDate
      ? formatDateWithYear(profile.hireDate)
      : '—'
  const iconClass = 'h-3.5 w-3.5 flex-shrink-0 text-charcoal-400'

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
      <div className="space-y-2 lg:col-span-2">
        {/* Personal Info — read-only for a Branch Manager */}
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="flex items-center justify-between border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-2">
            <div>
              <p className="bento-label">PROFILE DETAILS</p>
              <h3 className="mt-0.5 text-sm font-bold text-charcoal-900">Personal Info</h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-charcoal-400">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Read-only
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
            <InfoField label="Full Name" value={profile?.fullName ?? member.name ?? null} />
            <InfoField label="Date of Birth" value={profile?.dateOfBirth ? formatDateWithYear(profile.dateOfBirth) : null} />
            <InfoField label="National ID" value={profile?.nationalId ?? null} />
            <InfoField label="Gender" value={profile?.gender ?? null} />
          </div>
        </div>

        {/* Contact Info — a Branch Manager may read but not correct here (contact API is self-only) */}
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="flex items-center justify-between border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-2">
            <div>
              <p className="bento-label">COMMUNICATION</p>
              <h3 className="mt-0.5 text-sm font-bold text-charcoal-900">Contact Info</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
            <InfoField label="Mobile Number" value={member.phone ?? profile?.phone ?? null} />
            <InfoField label="Personal Email" value={member.email ?? profile?.email ?? null} />
            <InfoField label="Residential Address" value={profile?.address ?? null} className="sm:col-span-2" />
          </div>
        </div>
      </div>

      {/* Employment Info — HR controlled, mirrors the My Profile right column */}
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-xl border border-charcoal-200 bg-charcoal-50">
          <div
            className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] opacity-[0.03]"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center justify-between border-b border-charcoal-200 bg-charcoal-100/50 px-3 py-2">
            <div>
              <p className="bento-label flex items-center gap-1 text-charcoal-600">
                <Lock className="h-3 w-3" aria-hidden="true" />
                HR CONTROLLED
              </p>
              <h3 className="mt-0.5 text-sm font-bold text-charcoal-900">Employment Info</h3>
            </div>
          </div>
          <div className="relative z-10 space-y-2 p-3">
            <HrRow label="Employee ID" value={employeeId} icon={<CreditCard className={iconClass} aria-hidden="true" />} />
            <HrRow label="Primary Location" value={gymLabel} icon={<MapPin className={iconClass} aria-hidden="true" />} />
            <HrRow
              label="Job Title / Position"
              value={member.position ?? profile?.position ?? null}
              icon={<Briefcase className={iconClass} aria-hidden="true" />}
            />
            <HrRow label="Employment Level" value={member.level ?? null} />
            <HrRow label="Hire Date" value={hireDate} icon={<CalendarDays className={iconClass} aria-hidden="true" />} />
            <HrRow
              label="Current Status"
              divider={false}
              valueClassName="flex items-center gap-1.5"
              value={
                <>
                  <span
                    className={cn('h-2 w-2 rounded-full', employmentStatus === 'Active' ? 'bg-brand-500' : 'bg-charcoal-400')}
                    aria-hidden="true"
                  />
                  {employmentStatus + (employmentType ? ` · ${employmentType}` : '')}
                </>
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ==================== documents ==================== */

function DocumentsTab({ memberId }: { memberId: number }) {
  const docsQuery = useQuery({
    queryKey: ['portal', 'member', 'documents', memberId],
    queryFn: ({ signal }) => getOwnDocuments(memberId, signal),
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 2,
  })
  const hrDocsQuery = useQuery({
    queryKey: ['portal', 'member', 'hr-documents', memberId],
    queryFn: ({ signal }) => getHrDocuments(memberId, signal),
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 2,
  })

  const docs: EmployeeDocument[] = docsQuery.data ?? []
  const hrDocs: HrDocument[] = hrDocsQuery.data ?? []

  return (
    <div className="space-y-3">
      <div>
        <p className="bento-label mb-1.5 text-charcoal-400">EMPLOYEE DOCUMENTS ({docs.length})</p>
        {docsQuery.isLoading ? (
          <LoadingState label="Loading documents…" />
        ) : docsQuery.error ? (
          <p className="text-[11px] text-red-600">{describeApiError(docsQuery.error)}</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-charcoal-500">No documents on record.</p>
        ) : (
          <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
            {docs.map((doc) => (
              <DocumentRow key={doc.id} memberId={memberId} doc={doc} />
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="bento-label mb-1.5 text-charcoal-400">HR FILES ({hrDocs.length})</p>
        {hrDocsQuery.isLoading ? (
          <LoadingState label="Loading HR files…" />
        ) : hrDocsQuery.error ? (
          <p className="text-[11px] text-red-600">{describeApiError(hrDocsQuery.error)}</p>
        ) : hrDocs.length === 0 ? (
          <p className="text-xs text-charcoal-500">HR has not attached any files.</p>
        ) : (
          <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
            {hrDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-charcoal-900">{doc.name}</p>
                  <p className="text-[10px] text-charcoal-500">
                    {doc.category} · {doc.size} · Added {formatDateWithYear(doc.addedDate)}
                  </p>
                </div>
                {doc.sizeBytes != null && (
                  <button type="button" onClick={() => void downloadHrDocument(memberId, doc.id)} className="btn btn-sm btn-secondary">
                    Download
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DocumentRow({ memberId, doc }: { memberId: number; doc: EmployeeDocument }) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-charcoal-900">{doc.name}</p>
        <p className="text-[10px] text-charcoal-500">
          {doc.category} · Uploaded {formatDateWithYear(doc.uploadDate)}
          {doc.expiryDate ? ` · Expires ${formatDateWithYear(doc.expiryDate)}` : ''}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <StatusBadge status={humanize(doc.status)} />
        <button type="button" onClick={() => void downloadDocument(memberId, doc.id)} className="btn btn-sm btn-secondary">
          Download
        </button>
      </div>
    </div>
  )
}

/* ==================== employment ==================== */

function EmploymentTab({ memberId }: { memberId: number }) {
  const historyQuery = useQuery({
    queryKey: ['portal', 'member', 'history', memberId],
    queryFn: ({ signal }) => getOwnHistory(memberId, signal),
  })

  if (historyQuery.isLoading) return <LoadingState label="Loading employment history…" />
  if (historyQuery.error)
    return <ErrorState message={describeApiError(historyQuery.error)} onRetry={() => historyQuery.refetch()} />

  const rows: EmployeeHistoryItem[] = historyQuery.data ?? []
  if (rows.length === 0) return <p className="text-xs text-charcoal-500">No employment changes recorded yet.</p>

  return (
    <div>
      <p className="bento-label mb-1.5 text-charcoal-400">EMPLOYMENT HISTORY ({rows.length})</p>
      <ul className="space-y-1.5">
        {rows.map((item, index) => (
          <li key={`${item.type}-${item.date}-${index}`} className="flex items-start justify-between gap-3 rounded-lg bg-charcoal-50 p-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-charcoal-900">{item.type}</p>
              <p className="text-[10px] text-charcoal-500">
                {item.from ? `${item.from} → ${item.to ?? '—'}` : item.to ?? '—'}
              </p>
              {item.detail && <p className="text-[10px] text-charcoal-400">{item.detail}</p>}
            </div>
            <span className="whitespace-nowrap text-[10px] font-semibold text-charcoal-500">
              {formatDateWithYear(item.date)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ==================== attendance ==================== */

function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function AttendanceTab({ memberId }: { memberId: number }) {
  const [month, setMonth] = useState(currentMonthValue())

  const historyQuery = useQuery({
    queryKey: ['portal', 'member', 'attendance', memberId, month],
    queryFn: ({ signal }) => getOwnAttendance(memberId, month, 1, signal),
  })

  const balanceQuery = useQuery({
    queryKey: ['portal', 'member', 'leave-balance', memberId],
    queryFn: ({ signal }) => getOwnLeaveBalance(memberId, signal),
  })

  if (historyQuery.isLoading) return <LoadingState label="Loading attendance…" />
  if (historyQuery.error)
    return <ErrorState message={describeApiError(historyQuery.error)} onRetry={() => historyQuery.refetch()} />

  const history: EmployeeAttendanceResponse | undefined = historyQuery.data
  const totals = history?.totals
  const balance = balanceQuery.data
  const items = history?.items ?? []

  const presentRaw = totals?.present ?? 0
  const late = totals?.late ?? 0
  const early = totals?.early ?? 0
  const absent = totals?.absent ?? 0
  const onTime = Math.max(0, presentRaw - late - early)
  const sick = balance?.sick?.used ?? 0
  const annual = balance?.dayOff?.used ?? 0
  const segmentsTotal = onTime + late + sick + annual + absent

  const segments = [
    { label: 'On Time', value: onTime, className: 'bg-brand-500' },
    { label: 'Late', value: late, className: 'bg-yellow-400' },
    { label: 'Sick Leave', value: sick, className: 'bg-blue-400' },
    { label: 'Annual Leave', value: annual, className: 'bg-emerald-400' },
    { label: 'Absent', value: absent, className: 'bg-red-400' },
  ]

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="bento-label text-charcoal-400">ATTENDANCE</p>
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="form-input w-36"
          aria-label="Attendance month"
        />
      </div>

      <div className="mb-3">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-charcoal-100">
          {segmentsTotal > 0 &&
            segments.map((segment) => (
              <div
                key={segment.label}
                className={segment.className}
                style={{ width: `${(segment.value / segmentsTotal) * 100}%` }}
                title={`${segment.label}: ${segment.value} day${segment.value === 1 ? '' : 's'}`}
              />
            ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {segments.map((segment) => (
            <span key={segment.label} className="flex items-center gap-1 text-[10px] text-charcoal-500">
              <span className={cn('h-2 w-2 rounded-full', segment.className)} aria-hidden="true" />
              {segment.label} {segment.value}
            </span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-6">
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="text-base font-bold text-brand-700">{onTime} days</p>
            <p className="text-[10px] text-charcoal-500">On time</p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="text-base font-bold text-yellow-600">{late} days</p>
            <p className="text-[10px] text-charcoal-500">Late</p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="text-base font-bold text-blue-600">{sick} days</p>
            <p className="text-[10px] text-charcoal-500">Sick Leave</p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="text-base font-bold text-emerald-600">{annual} days</p>
            <p className="text-[10px] text-charcoal-500">Annual Leave</p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="text-base font-bold text-red-600">{absent} days</p>
            <p className="text-[10px] text-charcoal-500">Absent</p>
          </div>
          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="text-base font-bold text-charcoal-600">{balance?.unpaid?.used ?? 0} days</p>
            <p className="text-[10px] text-charcoal-500">Unpaid Leave</p>
          </div>
        </div>
        {totals && <p className="mt-1 text-[10px] text-charcoal-400">{totals.hours.toFixed(0)}h — {early} early leaving {early === 1 ? 'day' : 'days'} this month.</p>}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-charcoal-500">No attendance rows for this month.</p>
      ) : (
        <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
          {items.slice(0, 12).map((item) => (
            <div key={item.date} className="flex items-center justify-between gap-2 p-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-charcoal-900">{formatDateWithYear(item.date)}</p>
                <p className="truncate text-[10px] text-charcoal-500">
                  {item.checkIn ?? '—'} → {item.checkOut ?? '—'}
                  {item.notes ? ` · ${item.notes}` : ''}
                </p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-2">
                <span className="hidden text-[10px] text-charcoal-400 sm:block">{item.shift}</span>
                <StatusBadge status={humanize(item.status)} />
              </span>
            </div>
          ))}
        </div>
      )}
      {items.length > 12 && (
        <p className="mt-1 text-[10px] text-charcoal-400">Showing the 12 latest rows of {items.length}.</p>
      )}
    </div>
  )
}

/* ==================== shift ==================== */

function ShiftTab({ memberId }: { memberId: number }) {
  const { can } = usePortalSession()
  const [editCycleId, setEditCycleId] = useState<number | null>(null)

  const scheduleQuery = useQuery({
    queryKey: ['portal', 'member', 'schedule', memberId],
    queryFn: ({ signal }) => getOwnSchedule(memberId, undefined, signal),
  })

  if (scheduleQuery.isLoading) return <LoadingState label="Loading shift…" />
  if (scheduleQuery.error)
    return <ErrorState message={describeApiError(scheduleQuery.error)} onRetry={() => scheduleQuery.refetch()} />

  const schedule = scheduleQuery.data
  const byDate = new Map((schedule?.days ?? []).map((day) => [day.date, day]))

  // A date inside a cycle with no assignment row is a scheduling hole; a row
  // with isOff is an explicit rest day. Dates outside every cycle stay neutral.
  const inCycle = (date: string) =>
    (schedule?.cycles ?? []).some((cycle) => cycle.start <= date && date <= cycle.end)

  const week = currentWeekDates().map((entry) => ({ ...entry, day: byDate.get(entry.date) }))
  const missingCount = week.filter((entry) => !entry.day && inCycle(entry.date)).length

  // The assignments PUT upserts a Draft cycle's weekly pattern only, so the
  // edit action is offered solely while today sits inside a Draft cycle.
  const draftCycle = (schedule?.cycles ?? []).find(
    (cycle) => cycle.status === 'Draft' && cycle.start <= todayIso() && todayIso() <= cycle.end,
  )

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="bento-label text-charcoal-400">CURRENT WEEK</p>
        {can('schedule.manage') && draftCycle && (
          <Button size="sm" variant="secondary" onClick={() => setEditCycleId(draftCycle.id)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit shift
          </Button>
        )}
      </div>
      {(schedule?.cycles?.length ?? 0) === 0 && (
        <p className="mb-2 text-[10px] text-charcoal-400">
          No published cycles — days below stay unscheduled until HR publishes one.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {week.map((entry) => {
          const isToday = entry.date === todayIso()
          const day = entry.day
          const worked = day && !day.isOff && day.shiftName
          const missing = !day && inCycle(entry.date)
          return (
            <div
              key={entry.date}
              className={cn(
                'rounded-lg border p-2 text-center',
                missing
                  ? 'border-amber-300 bg-amber-50'
                  : isToday
                    ? 'border-brand-300 bg-brand-50/60'
                    : 'border-charcoal-100 bg-charcoal-50',
              )}
            >
              <p className={cn('text-[10px] font-semibold', isToday ? 'text-brand-700' : 'text-charcoal-500')}>
                {(day?.dayName ?? entry.label).slice(0, 3)} {entry.date.slice(8)}
              </p>
              <p className={cn('mt-1 text-[11px] font-bold', missing ? 'text-amber-600' : 'text-charcoal-900')}>
                {worked ? day?.shiftName : missing ? 'NO SHIFT' : day ? 'OFF' : '—'}
              </p>
              <p className="text-[9px] text-charcoal-500">
                {worked && day?.start ? `${time12(day.start)} – ${time12(day.end)}` : '—'}
              </p>
            </div>
          )
        })}
      </div>
      {schedule?.cycles?.length ? (
        <p className="mt-2 text-[10px] text-charcoal-400">
          {schedule.cycles.map((cycle) => `${formatDateWithYear(cycle.start)} – ${formatDateWithYear(cycle.end)} (${cycle.status})`).join(', ')}
        </p>
      ) : null}
      {missingCount > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-800">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>
            {missingCount} {missingCount === 1 ? 'day' : 'days'} of this week{' '}
            {missingCount === 1 ? 'has' : 'have'} no assigned shift —{' '}
            {week
              .filter((entry) => !entry.day && inCycle(entry.date))
              .map((entry) => `${entry.label} ${entry.date.slice(5)}`)
              .join(', ')}
            .
          </span>
        </p>
      )}
      {editCycleId != null && (
        <EditShiftModal memberId={memberId} cycleId={editCycleId} onClose={() => setEditCycleId(null)} />
      )}
    </div>
  )
}

/** Weekly-pattern editor for one member inside the Draft shift cycle (mirrors the Assign Shift modal). */
function EditShiftModal({
  memberId,
  cycleId,
  onClose,
}: {
  memberId: number
  cycleId: number
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    queryKey: ['portal', 'shift-cycle', cycleId],
    queryFn: ({ signal }) => getShiftCycle(cycleId, signal),
  })
  const [selected, setSelected] = useState<Record<number, string> | null>(null)

  const detail = detailQuery.data
  const templates = (detail?.shiftTemplates ?? []).filter((template) => !template.isOff)
  const row = detail?.assignments.find((assignment) => assignment.employeeId === memberId)

  // Existing template id for a weekday; null = the day was never assigned.
  const initialFor = (day: number): string | null => {
    const id = row?.days[day]
    return id == null ? null : String(id)
  }

  const values: Record<number, string> =
    selected ??
    Object.fromEntries(Array.from({ length: 7 }, (_, day): [number, string] => [day, initialFor(day) ?? SHIFT_KEEP]))

  const saveMutation = useMutation({
    mutationFn: (payload: SetAssignmentInput[]) => setShiftAssignments(cycleId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['portal', 'member', 'schedule', memberId] })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'shift-cycle', cycleId] })
      toast('Weekly shift pattern saved.')
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const hasChanges = Array.from({ length: 7 }, (_, day) => values[day]).some(
    (value, day) => value !== (initialFor(day) ?? SHIFT_KEEP),
  )

  return (
    <Modal
      open
      title="Edit shift"
      subtitle={`${detail?.label ?? 'Current cycle'} — Mondays to Sundays.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!hasChanges}
            loading={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate(
                Array.from({ length: 7 }, (_, day): SetAssignmentInput | null => {
                  const value = values[day]
                  if (value === (initialFor(day) ?? SHIFT_KEEP)) return null
                  return { employeeId: memberId, day, shiftTemplateId: value === SHIFT_OFF ? null : Number(value) }
                }).filter((input): input is SetAssignmentInput => input !== null),
              )
            }
          >
            Save
          </Button>
        </div>
      }
    >
      {detailQuery.isLoading && <LoadingState label="Loading cycle…" />}
      {detailQuery.error && (
        <ErrorState message={describeApiError(detailQuery.error)} onRetry={() => detailQuery.refetch()} />
      )}
      {!detailQuery.isLoading && !detailQuery.error && (
        <>
          <p className="mb-3 text-[11px] text-charcoal-600">
            &ldquo;Not assigned&rdquo; leaves the day untouched; &ldquo;Off&rdquo; books an explicit rest day.
          </p>
          <div className="space-y-2">
            {Array.from({ length: 7 }, (_, day) => (
              <div key={WEEKDAY_LABELS[day]} className="flex items-center gap-3">
                <p className="w-24 text-[11px] font-semibold text-charcoal-900">{WEEKDAY_LABELS[day]}</p>
                <select
                  className="field-input h-9 flex-1 !px-2.5 text-xs"
                  value={values[day]}
                  onChange={(event) => setSelected({ ...values, [day]: event.target.value })}
                >
                  {initialFor(day) == null && <option value={SHIFT_KEEP}>Not assigned</option>}
                  {templates.map((template) => (
                    <option key={template.id} value={String(template.id)}>
                      {template.name} ({template.start.slice(0, 5)}–{template.end.slice(0, 5)})
                    </option>
                  ))}
                  <option value={SHIFT_OFF}>Off</option>
                </select>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

/* ==================== payroll snapshot ==================== */

function PayrollTab({ memberId, member }: { memberId: number; member: MemberHeader }) {
  const sheetsQuery = useQuery({
    queryKey: ['portal', 'member', 'payroll', memberId],
    queryFn: ({ signal }) => getOwnPayrollSheets(memberId, signal),
  })

  if (sheetsQuery.isLoading) return <LoadingState label="Loading payroll snapshot…" />
  if (sheetsQuery.error)
    return <ErrorState message={describeApiError(sheetsQuery.error)} onRetry={() => sheetsQuery.refetch()} />

  const sheets = sheetsQuery.data ?? []
  const latest = sheets.find((sheet) => sheet.visible) ?? null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg bg-charcoal-50 p-3">
        <div>
          <p className="text-[10px] text-charcoal-500">LATEST PAYSLIP</p>
          <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
            {latest
              ? `${latest.period}${latest.paidDate ? ` · Paid ${formatDateWithYear(latest.paidDate)}` : ''}`
              : 'No closed payslip yet'}
          </p>
        </div>
        <p className="text-sm font-bold text-charcoal-900">
          {latest
            ? formatMoney(latest.netSalary)
            : member.salary != null
              ? formatMoney(member.salary)
              : '—'}
        </p>
      </div>
      <p className="text-center text-[10px] text-charcoal-400">
        Full payslips live in HR payroll — the Branch Manager sees the latest net figure only.
      </p>
    </div>
  )
}
