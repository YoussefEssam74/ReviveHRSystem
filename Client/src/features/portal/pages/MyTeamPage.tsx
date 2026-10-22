import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, ChevronRight, Clock, Search, UserRoundCheck } from 'lucide-react'
import { getTeamToday, sendReminder, type TeamMemberDay } from '../api/team.api'
import { manualAttendance } from '../api/attendance.api'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'

/** TimeOnly "HH:mm:ss" → "8:00 AM" (local helper piloted on the self pages). */
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
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** The shift label of a member row: "Morning 7:00 AM – 3:00 PM" / "Off". */
function shiftLabel(member: TeamMemberDay): string {
  if (member.isOff || !member.shiftName) return 'Off'
  if (!member.shiftStart && !member.shiftEnd) return member.shiftName
  return `${member.shiftName} ${time12(member.shiftStart)} – ${time12(member.shiftEnd)}`
}

/** Attention rows derive only from real statuses — the "reason" text comes from
 * the status and the (missing/present) check-in, never fabricated. */
function attentionReason(member: TeamMemberDay): string {
  if (member.status === 'Absent' && member.isOff) return 'Scheduled day off'
  if (member.status === 'Absent') return 'No check-in recorded'
  if (member.status === 'Late') return `Checked in late at ${time12(member.checkIn)}`
  return member.status
}

function attentionDetail(member: TeamMemberDay): string {
  if (member.isOff) return 'Off day'
  if (!member.shiftName) return 'No shift scheduled'
  return `Shift ${time12(member.shiftStart)} – ${time12(member.shiftEnd)}`
}

const MEMBER_PROFILE_PATH = (employeeId: number | string) => `/employee/branch/employees/${employeeId}`

export default function MyTeamPage() {
  const { me, isTeamLeader, isBranchManager, can } = usePortalSession()
  const [date, setDate] = useState(todayIso())
  const [search, setSearch] = useState('')
  const ledTeamId = me?.ledTeamId ?? null

  if (!isTeamLeader && !isBranchManager) {
    return (
      <EmptyState
        title="Team pages are for managers"
        hint="Your session holds no team-leader or branch-manager role in this gym."
      />
    )
  }

  if (ledTeamId == null) {
    return (
      <div className="space-y-3">
        <PageHeader date={date} onDate={setDate} search={search} onSearch={setSearch} title="My Team" subtitle="No led team in the active gym." />
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" aria-hidden="true" />}
          title="No team in this gym"
          hint="You have no led team in the active gym. The My Team page scopes to the team you lead here."
        />
      </div>
    )
  }

  return (
    <TeamWorkspace
      ledTeamId={ledTeamId}
      date={date}
      onDate={setDate}
      search={search}
      onSearch={setSearch}
      canMark={can('attendance.manual_entry')}
    />
  )
}

function PageHeader({
  title,
  subtitle,
  date,
  onDate,
  search,
  onSearch,
}: {
  title: string
  subtitle: string
  date: string
  onDate: (date: string) => void
  search: string
  onSearch: (search: string) => void
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-xl font-bold text-charcoal-900">{title}</h1>
        <p className="mt-0.5 text-xs text-charcoal-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search team..."
            className="form-input pl-8 text-[13px]"
            style={{ padding: '0.375rem 0.625rem 0.375rem 2rem', width: 200 }}
          />
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onDate(e.target.value)}
          className="form-input text-[13px]"
          style={{ padding: '0.375rem 0.625rem', width: 150 }}
          aria-label="Team day"
        />
      </div>
    </div>
  )
}

function TeamWorkspace({
  ledTeamId,
  date,
  onDate,
  search,
  onSearch,
  canMark,
}: {
  ledTeamId: number
  date: string
  onDate: (date: string) => void
  search: string
  onSearch: (search: string) => void
  canMark: boolean
}) {
  const todayQuery = useQuery({
    queryKey: ['portal', 'team', 'today', ledTeamId, date],
    queryFn: ({ signal }) => getTeamToday(ledTeamId, date, signal),
  })

  if (todayQuery.isLoading) return <LoadingState />
  if (todayQuery.error)
    return <ErrorState message={describeApiError(todayQuery.error)} onRetry={() => todayQuery.refetch()} />
  if (!todayQuery.data) return null
  const today = todayQuery.data

  return (
    <div className="space-y-3">
      <PageHeader
        title="My Team"
        subtitle={`${today.teamName} · ${today.stats.total} members · ${today.stats.present} present today`}
        date={date}
        onDate={onDate}
        search={search}
        onSearch={onSearch}
      />

      {/* Stats row — the five real TeamStats fields (the mock's "Issues" tile has no real source). */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <div className="rounded-xl border border-charcoal-200 border-l-4 border-l-brand-500 bg-white p-3 text-center">
          <p className="text-xl font-bold text-brand-700">{today.stats.total}</p>
          <p className="text-[10px] text-charcoal-500">Total</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-green-600">{today.stats.present}</p>
          <p className="text-[10px] text-charcoal-500">Present</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-yellow-600">{today.stats.late}</p>
          <p className="text-[10px] text-charcoal-500">Late</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-red-600">{today.stats.absent}</p>
          <p className="text-[10px] text-charcoal-500">Absent</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-blue-600">{today.stats.pendingRequests}</p>
          <p className="text-[10px] text-charcoal-500">Pending</p>
        </div>
      </div>

      {today.stats.late + today.stats.absent > 0 && (
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="border-b border-charcoal-100 bg-red-50/50 px-4 py-2.5">
            <p className="bento-label flex items-center gap-1.5 text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Needs attention ({today.stats.late + today.stats.absent})
            </p>
          </div>
          <div className="divide-y divide-charcoal-50">
            {today.members
              .filter((m) => m.status === 'Late' || m.status === 'Absent')
              .map((m) => (
                <AttentionRow key={m.employeeId} member={m} canMark={canMark} date={date} invalidateTeam={todayQuery.refetch} />
              ))}
          </div>
        </div>
      )}

      <MemberList members={today.members} search={search} />
    </div>
  )
}

function AttentionRow({
  member,
  canMark,
  date,
  invalidateTeam,
}: {
  member: TeamMemberDay
  canMark: boolean
  date: string
  invalidateTeam: () => void
}) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [presentOpen, setPresentOpen] = useState(false)
  const [remindOpen, setRemindOpen] = useState(false)

  const remindMutation = useMutation({
    mutationFn: () => sendReminder(member.employeeId),
    onSuccess: () => {
      toast(`Reminder sent to ${member.name.split(' ')[0]}.`)
      setRemindOpen(false)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <div className="flex items-center justify-between gap-2 p-3">
      <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => navigate(MEMBER_PROFILE_PATH(member.employeeId))}>
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
          {member.initials}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-charcoal-900">{member.name}</span>
            <StatusBadge status={member.status} />
          </span>
          <span className="block truncate text-[10px] text-charcoal-500">
            {member.position} · {attentionReason(member)}
          </span>
          <span className="block truncate text-[10px] text-charcoal-400">{attentionDetail(member)}</span>
        </span>
      </button>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {member.status === 'Absent' && !member.isOff && canMark && (
          <Button size="sm" onClick={() => setPresentOpen(true)}>
            <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark Present
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setRemindOpen(true)}>
          <Bell className="h-3.5 w-3.5" aria-hidden="true" /> Remind
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            navigate(MEMBER_PROFILE_PATH(member.employeeId), {
              state: { name: member.name, position: member.position, initials: member.initials, status: member.status },
            })
          }
        >
          View
        </Button>
      </div>

      {remindOpen && (
        <Modal
          open
          title={`Remind ${member.name.split(' ')[0]}?`}
          subtitle="Sends a reminder notification for today's shift."
          onClose={() => setRemindOpen(false)}
          footer={
            <>
              <Button size="sm" variant="secondary" onClick={() => setRemindOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={remindMutation.isPending} onClick={() => remindMutation.mutate()}>
                Send reminder
              </Button>
            </>
          }
        >
          <p className="text-xs text-charcoal-600">
            {member.name} — {attentionReason(member)} · {attentionDetail(member)}.
          </p>
        </Modal>
      )}

      {presentOpen && (
        <MarkPresentModal
          member={member}
          date={date}
          onClose={() => setPresentOpen(false)}
          onSaved={invalidateTeam}
        />
      )}
    </div>
  )
}

function MemberList({ members, search }: { members: TeamMemberDay[]; search: string }) {
  const navigate = useNavigate()
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return members
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(needle) ||
        m.position.toLowerCase().includes(needle) ||
        (m.shiftName ?? '').toLowerCase().includes(needle) ||
        m.status.toLowerCase().includes(needle),
    )
  }, [members, search])

  if (filtered.length === 0) {
    return (
      <EmptyState
        title={search ? 'No matching members' : 'No members today'}
        hint={search ? `Nothing matches “${search}”.` : 'The team roster is empty.'}
      />
    )
  }

  return (
    <div className="space-y-1.5">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Position</th>
              <th>Scheduled</th>
              <th>Check In</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.employeeId}
                className="cursor-pointer hover:bg-charcoal-50/50"
                onClick={() =>
                  navigate(MEMBER_PROFILE_PATH(m.employeeId), {
                    state: { name: m.name, position: m.position, initials: m.initials, status: m.status },
                  })
                }
              >
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                      {m.initials}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-charcoal-900">{m.name}</p>
                      <p className="text-[10px] text-charcoal-500">#{m.employeeId}</p>
                    </div>
                  </div>
                </td>
                <td className="text-xs">{m.position}</td>
                <td className="text-xs">{shiftLabel(m)}</td>
                <td className="text-xs">{time12(m.checkIn)}</td>
                <td>
                  <StatusBadge status={m.status} />
                </td>
                <td>
                  <ChevronRight className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-1.5 lg:hidden">
        {filtered.map((m) => (
          <button
            key={m.employeeId}
            className="w-full rounded-xl border border-charcoal-200 bg-white p-3 text-left"
            onClick={() =>
              navigate(MEMBER_PROFILE_PATH(m.employeeId), {
                state: { name: m.name, position: m.position, initials: m.initials, status: m.status },
              })
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                  {m.initials}
                </span>
                <div>
                  <p className="text-xs font-medium text-charcoal-900">{m.name}</p>
                  <p className="text-[10px] text-charcoal-500">
                    {m.position} · {shiftLabel(m)}
                  </p>
                </div>
              </div>
              <StatusBadge status={m.status} />
            </div>
            <div className="mt-2 flex items-center gap-4 text-[10px] text-charcoal-500">
              <span>In: {time12(m.checkIn)}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-brand-500" aria-hidden="true" /> {shiftLabel(m)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {search && <p className="text-[10px] text-charcoal-400">Filtering by “{search}”</p>}
    </div>
  )
}

export function MessageModal({
  employeeId,
  memberName,
  onClose,
}: {
  employeeId: number
  memberName: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const [message, setMessage] = useState('')

  const sendMutation = useMutation({
    mutationFn: (text: string) => import('../api/team.api').then((m) => m.sendTeamMessage(employeeId, text)),
    onSuccess: () => {
      toast(`Message sent to ${memberName.split(' ')[0]}.`)
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal
      open
      title={`Message — ${memberName}`}
      subtitle="One-to-one message; it shows up in the member's notifications."
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={message.trim().length === 0}
            loading={sendMutation.isPending}
            onClick={() => sendMutation.mutate(message.trim())}
          >
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label className="form-label" htmlFor="team-message">
          Message
        </label>
        <textarea
          id="team-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a short message…"
          className="form-input"
        />
        {message.trim().length === 0 && <p className="text-[10px] text-red-500">Message is required.</p>}
      </div>
    </Modal>
  )
}

function MarkPresentModal({
  member,
  date,
  onClose,
  onSaved,
}: {
  member: TeamMemberDay
  date: string
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [checkIn, setCheckIn] = useState(
    member.shiftStart ? member.shiftStart.slice(0, 5) : '',
  )
  const [checkOut, setCheckOut] = useState(
    member.shiftEnd && member.shiftEnd !== '00:00:00' ? member.shiftEnd.slice(0, 5) : '',
  )
  const [reason, setReason] = useState('Marked present by team manager')

  const saveMutation = useMutation({
    mutationFn: () =>
      manualAttendance({
        employeeId: String(member.employeeId),
        date,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        status: 'On Time',
        reason,
      }),
    onSuccess: () => {
      toast(`${member.name.split(' ')[0]} marked present.`)
      onSaved()
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal
      open
      title={`Mark Present — ${member.name.split(' ')[0]}`}
      subtitle="Upserts today's attendance record. Punch times use the shift defaults."
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
            <label className="form-label" htmlFor="mark-in">
              Check in (HH:mm)
            </label>
            <input
              id="mark-in"
              type="time"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="mark-out">
              Check out (HH:mm)
            </label>
            <input
              id="mark-out"
              type="time"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="mark-reason">
            Reason
          </label>
          <input
            id="mark-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
          />
          {reason.trim().length < 3 && <p className="mt-1 text-[10px] text-red-500">Reason must be at least 3 characters.</p>}
        </div>
        <p className="text-[10px] text-charcoal-400">
          Saved as “On Time” for {date}. Absent and Off days clear punch times server-side.
        </p>
      </div>
    </Modal>
  )
}
