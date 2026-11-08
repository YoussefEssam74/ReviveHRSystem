import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Zap } from 'lucide-react'
import {
  createTeamFollowUp,
  getTeamFollowUps,
  getTeamToday,
  sendReminder,
  updateTeamFollowUp,
  type TeamFollowUp,
  type TeamMemberDay,
} from '../api/team.api'
import { getEmployeeDirectory } from '../api/branch.api'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'

/** Mock §19 severity vocabulary. */
const SEVERITIES = ['Low', 'Medium', 'High'] as const
type Severity = (typeof SEVERITIES)[number]

const SEV_CLASS: Record<Severity, { border: string; bg: string; badge: string }> = {
  High: { border: 'border-l-red-400', bg: 'bg-red-50/50', badge: 'badge-red' },
  Medium: { border: 'border-l-yellow-400', bg: 'bg-yellow-50/50', badge: 'badge-yellow' },
  Low: { border: 'border-l-blue-400', bg: 'bg-blue-50/50', badge: 'badge-blue' },
}

/** The action vocabulary the backend accepts — see FollowUpActionType. */
const ACTIONS = ['Deduction', 'Warning', 'EscalateToHR', 'Reminder', 'Resolution'] as const
type ActionKind = (typeof ACTIONS)[number]

const ACTION_LABELS: Record<ActionKind, string> = {
  Deduction: 'Deduction',
  Warning: 'Warning',
  EscalateToHR: 'Escalate to HR',
  Reminder: 'Reminder',
  Resolution: 'Close as handled',
}

const ACTION_HINTS: Record<ActionKind, string> = {
  Deduction: 'Deducts pay per the branch policy',
  Warning: 'Formal warning recorded on the member',
  EscalateToHR: 'Hands it to the HR portal to decide',
  Reminder: 'Nudges the member (a notification goes out)',
  Resolution: 'Closes the item as handled',
}

const OPEN_ACTIONS: ActionKind[] = ['Deduction', 'Warning', 'EscalateToHR', 'Reminder']

const DEDUCTION_AMOUNTS = ['Quarter Day', 'Half Day', 'Day', '3 Days'] as const

export default function TeamActionsPage() {
  const { me, isTeamLeader, isBranchManager } = usePortalSession()
  const ledTeamId = me?.ledTeamId ?? null

  if (!isTeamLeader && !isBranchManager) {
    return (
      <EmptyState
        title="Team Actions is for managers"
        hint="Follow-ups scope to the team you lead in the active gym."
      />
    )
  }
  // A Branch Manager's scope is the whole gym — teams and the employees nobody has
  // assigned to a team yet — so he never depends on leading one himself.
  if (!isBranchManager && ledTeamId == null) {
    return (
      <EmptyState
        title="No team in this gym"
        hint="You have no led team in the active gym, so there is no one to follow up on."
      />
    )
  }

  return <ActionsWorkspace scopeTeamId={isBranchManager ? null : ledTeamId} />
}

function ActionsWorkspace({ scopeTeamId }: { scopeTeamId: number | null }) {
  const { isBranchManager } = usePortalSession()
  const [severity, setSeverity] = useState<'All' | Severity>('All')
  const [createOpen, setCreateOpen] = useState(false)

  // null teamId = the caller's whole scope: every gym team for a Branch Manager,
  // the led team otherwise.
  const followUpsQuery = useQuery({
    queryKey: ['portal', 'follow-ups', scopeTeamId ?? 'gym'],
    queryFn: ({ signal }) => getTeamFollowUps(scopeTeamId, signal),
  })

  // The picker: a Branch Manager acts on anyone in his gym (directory), a Team
  // Leader only on the members assigned to him (team-day roster).
  const membersQuery = useQuery({
    queryKey: ['portal', 'team', 'today', scopeTeamId, 'members-only'],
    queryFn: ({ signal }) => getTeamToday(scopeTeamId as number, null, signal),
    enabled: !isBranchManager && scopeTeamId != null,
    staleTime: 60_000,
  })
  const directoryQuery = useQuery({
    queryKey: ['portal', 'employees', 'follow-up-picker'],
    queryFn: ({ signal }) => getEmployeeDirectory({ page: 1, pageSize: 200, signal }),
    enabled: isBranchManager,
    staleTime: 60_000,
  })

  if (followUpsQuery.isLoading) return <LoadingState />
  if (followUpsQuery.error)
    return (
      <ErrorState message={describeApiError(followUpsQuery.error)} onRetry={() => followUpsQuery.refetch()} />
    )

  const followUps = followUpsQuery.data ?? []
  const open = followUps.filter((f) => !f.isResolved)
  const filtered = severity === 'All' ? open : open.filter((f) => f.severity === severity)
  const members: TeamMemberDay[] = isBranchManager
    ? (directoryQuery.data?.items ?? []).map((row) => ({
        employeeId: row.id,
        name: row.name,
        position: row.position,
        status: row.status,
        checkIn: null,
        initials: row.initials,
        shiftName: null,
        shiftStart: null,
        shiftEnd: null,
        isOff: false,
      }))
    : membersQuery.data?.members ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-charcoal-900">Team Actions</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">{open.length} items requiring attention</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Take Action
        </Button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {(['All', ...SEVERITIES] as const).map((option) => (
          <button
            key={option}
            onClick={() => setSeverity(option)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
              severity === option ? 'bg-charcoal-800 text-white' : 'bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200',
            )}
          >
            {option === 'All' ? 'All' : option}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-1.5">
          {filtered.map((item) => (
            <FollowUpRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" aria-hidden="true" />}
          title={severity === 'All' ? 'No open follow-ups' : `No open ${severity} follow-ups`}
          hint="Raised follow-ups appear here until someone records a Resolution."
        />
      )}

      {createOpen && (
        <CreateFollowUpModal
          members={members}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  )
}

function FollowUpRow({ item }: { item: TeamFollowUp }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [actionOpen, setActionOpen] = useState(false)
  const [remindOpen, setRemindOpen] = useState(false)

  const remindMutation = useMutation({
    mutationFn: () => sendReminder(item.employeeId),
    onSuccess: () => {
      toast(`Reminder sent to ${first(item.employee)}.`)
      setRemindOpen(false)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const sev = rowSeverity(item)

  return (
    <div className={cn('rounded-xl border border-charcoal-200 border-l-4 p-3', SEV_CLASS[sev].border, item.isResolved ? 'bg-charcoal-50/50' : SEV_CLASS[sev].bg)}>
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
            {initialsOf(item.employee)}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-charcoal-900">{item.employee}</p>
            <p className="text-[10px] text-charcoal-500">{item.description}</p>
            {item.note && !item.note.startsWith('auto-absence:') &&
              <p className="mt-1 text-xs text-charcoal-600">{item.note}</p>}
            {item.lastAction && (
              <p className="mt-0.5 text-[10px] text-charcoal-400">Last action: {item.lastAction}</p>
            )}
          </div>
        </div>
        <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
          {!item.isResolved ? (
            <>
              <span className={cn('badge', SEV_CLASS[sev].badge)}>{sev}</span>
              <Button size="sm" onClick={() => setActionOpen(true)}>
                Action
              </Button>
            </>
          ) : (
            <span className="badge badge-green">Resolved</span>
          )}
        </div>
      </div>

      {actionOpen && (
        <ActionModal
          item={item}
          onClose={() => setActionOpen(false)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['portal', 'follow-ups'] })
          }}
        />
      )}

      {remindOpen && (
        <Modal
          open
          title={`Remind ${first(item.employee)}?`}
          subtitle="Sends a reminder notification for this item."
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
            {item.employee} — {item.description}
          </p>
        </Modal>
      )}
    </div>
  )
}

function rowSeverity(item: TeamFollowUp): Severity {
  const match = SEVERITIES.find((s) => s.toLowerCase() === item.severity.trim().toLowerCase())
  return match ?? 'Medium'
}

function ActionModal({
  item,
  onClose,
  onSaved,
}: {
  item: TeamFollowUp
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [action, setAction] = useState<ActionKind>('Deduction')
  const [note, setNote] = useState('')

  const saveMutation = useMutation({
    mutationFn: () => updateTeamFollowUp(item.id, { action, note: note.trim() || null }),
    onSuccess: (updated) => {
      toast(updated.isResolved ? 'Follow-up resolved.' : `${ACTION_LABELS[action]} recorded.`)
      onSaved()
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal
      open
      title={`Action — ${item.employee}`}
      subtitle={item.description}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Record
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="form-label" htmlFor="action-kind">
            Action
          </label>
          <select
            id="action-kind"
            value={action}
            onChange={(e) => setAction(e.target.value as ActionKind)}
            className="form-input"
          >
            {ACTIONS.map((option) => (
              <option key={option} value={option}>
                {ACTION_LABELS[option]} — {ACTION_HINTS[option]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="action-note">
            Note (optional)
          </label>
          <textarea
            id="action-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened / what was agreed…"
            className="form-input"
          />
        </div>
        {action === 'Resolution' && (
          <p className="text-[10px] text-charcoal-400">Recording a Resolution closes this follow-up.</p>
        )}
      </div>
    </Modal>
  )
}

export function CreateFollowUpModal({
  members,
  defaultMember = null,
  onClose,
}: {
  members: TeamMemberDay[]
  /** The employee whose row the manager clicked — preselected so an action can never land on someone else. */
  defaultMember?: TeamMemberDay | null
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [action, setAction] = useState<ActionKind>('Deduction')
  const [severity, setSeverity] = useState<Severity>('Medium')
  const [description, setDescription] = useState('')
  const [deductionAmount, setDeductionAmount] = useState<(typeof DEDUCTION_AMOUNTS)[number] | ''>('')
  const [note, setNote] = useState('')

  // Deduction actions pick a day amount instead of writing a description —
  // the backend still requires a description, so the amount fills it in.
  const effectiveDescription = action === 'Deduction'
    ? deductionAmount
      ? `Deduction — ${deductionAmount}`
      : ''
    : description

  const createMutation = useMutation({
    mutationFn: () =>
      createTeamFollowUp({
        employeeId: effectiveEmployeeId as number,
        action,
        severity,
        description: effectiveDescription,
        note: note.trim() || null,
      }),
    onSuccess: (created) => {
      toast(`Follow-up raised for ${first(created.employee)}.`)
      void queryClient.invalidateQueries({ queryKey: ['portal', 'follow-ups'] })
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  // Derived during render — the modal opens fresh each time, so members are already
  // loaded or the list is empty. The clicked row wins over any list order: it is
  // the employee the action is about, even when he sits at the end of the roster
  // (or is missing from the list altogether, which is why it is spliced in front).
  const options =
    defaultMember && !members.some((m) => m.employeeId === defaultMember.employeeId)
      ? [defaultMember, ...members]
      : members
  const effectiveEmployeeId = employeeId ?? defaultMember?.employeeId ?? null

  return (
    <Modal
      open
      title="Raise follow-up"
      subtitle={
        defaultMember
          ? `About ${defaultMember.name} — spot something on the floor, log an action.`
          : 'Spot something on the floor — log an action about one team member.'
      }
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              effectiveEmployeeId == null ||
              effectiveDescription.trim().length === 0 ||
              (action === 'Deduction' && deductionAmount === '')
            }
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      {options.length === 0 ? (
        <EmptyState
          title="No employees to act on"
          hint="Nobody in your scope is available for a follow-up yet."
        />
      ) : (
        <div className="space-y-3">
          <div>
            <label className="form-label" htmlFor="fu-emp">
              Team member
            </label>
            <select
              id="fu-emp"
              value={effectiveEmployeeId ?? ''}
              onChange={(e) => setEmployeeId(Number(e.target.value))}
              className="form-input"
            >
              {effectiveEmployeeId == null && (
                <option value="" disabled>
                  Select an employee…
                </option>
              )}
              {options.map((m) => (
                <option key={m.employeeId} value={m.employeeId}>
                  {m.name} — {m.position}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label" htmlFor="fu-action">
                Action
              </label>
              <select
                id="fu-action"
                value={action}
                onChange={(e) => setAction(e.target.value as ActionKind)}
                className="form-input"
              >
                {OPEN_ACTIONS.map((option) => (
                  <option key={option} value={option}>
                    {ACTION_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="fu-sev">
                Severity
              </label>
              <select
                id="fu-sev"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                className="form-input"
              >
                {SEVERITIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {action === 'Deduction' ? (
            <div>
              <label className="form-label" htmlFor="fu-deduction">
                Deduction amount
              </label>
              <select
                id="fu-deduction"
                value={deductionAmount}
                onChange={(e) => setDeductionAmount(e.target.value as (typeof DEDUCTION_AMOUNTS)[number] | '')}
                className="form-input"
              >
                <option value="">Choose deduction…</option>
                {DEDUCTION_AMOUNTS.map((amount) => (
                  <option key={amount} value={amount}>
                    {amount}
                  </option>
                ))}
              </select>
              {deductionAmount === '' && (
                <p className="mt-1 text-[10px] text-red-500">Deduction amount is required.</p>
              )}
            </div>
          ) : (
            <div>
              <label className="form-label" htmlFor="fu-desc">
                Description
              </label>
              <textarea
                id="fu-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the follow-up is about…"
                className="form-input"
              />
              {description.trim().length === 0 && (
                <p className="mt-1 text-[10px] text-red-500">Description is required.</p>
              )}
            </div>
          )}
          <div>
            <label className="form-label" htmlFor="fu-note">
              Note (optional)
            </label>
            <input
              id="fu-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

function first(name: string): string {
  const words = name.split(' ').filter(Boolean)
  return words[0] ?? name
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}
