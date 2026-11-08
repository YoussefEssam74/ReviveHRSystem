import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserRound } from 'lucide-react'
import {
  createVacancyRequest,
  decideVacancyRequest,
  getVacancyRequests,
  reopenVacancyRequest,
  type VacancyRequestRow,
} from '../api/branch.api'
import { EmptyState } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { formatDate, formatMoney, humanize } from '../../../lib/format'

/**
 * Recruitment (mock §23 renderRecruitment): the BM's headcount-requisition
 * queue — submit a vacancy request and follow its real state
 * (Pending → HR decides → Approved/Rejected). The mock's candidate-match /
 * second-interview stage machine is HR-side in the real domain (documented
 * deviation), so the tabs are the three real statuses. Decide/Reopen buttons
 * render only for `recruitment.vacancy_request.approve` key holders.
 */

type Tab = 'All' | 'Pending' | 'Approved' | 'Rejected'
const TABS: Tab[] = ['All', 'Pending', 'Approved', 'Rejected']

const URGENCY_BADGE: Record<string, string> = {
  high: 'bg-red-50 text-red-700',
  medium: 'bg-yellow-50 text-yellow-700',
  low: 'bg-blue-50 text-blue-700',
}

function urgencyClass(urgency: string | null): string {
  if (!urgency) return 'bg-charcoal-50 text-charcoal-600'
  return URGENCY_BADGE[urgency.trim().toLowerCase()] ?? 'bg-charcoal-50 text-charcoal-600'
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold', className)}>
      {children}
    </span>
  )
}

export default function BranchRecruitmentPage() {
  const me = usePortalSession()

  // Recruitment is a Branch-Manager surface (never served to a Team Leader,
  // even as an empty state): the keys AND the active-gym role must both say
  // Branch Manager.
  if (!me.isBranchManager || (!me.can('recruitment.view') && !me.can('recruitment.vacancy_request.create'))) {
    return (
      <EmptyState
        title="Recruitment is for Branch Managers"
        hint="Submitting vacancy requests requires the requisition keys and the Branch Manager role in the active gym."
      />
    )
  }

  return <RecruitmentWorkspace />
}

function RecruitmentWorkspace() {
  const { me, can } = usePortalSession()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('All')
  const [page, setPage] = useState(1)
  const [newOpen, setNewOpen] = useState(false)
  const [detail, setDetail] = useState<VacancyRequestRow | null>(null)

  const listQuery = useQuery({
    queryKey: ['portal', 'vacancy-requests', tab, page],
    queryFn: ({ signal }) =>
      getVacancyRequests({
        status: tab === 'All' ? undefined : tab,
        page,
        pageSize: 12,
        signal,
      }),
    placeholderData: (previous) => previous,
  })

  // Tab counts — three cheap pageSize=1 count queries (real-state tabs).
  const tabsQuery = useQuery({
    queryKey: ['portal', 'vacancy-requests', 'counts'],
    queryFn: ({ signal }) =>
      Promise.all(
        (['Pending', 'Approved', 'Rejected'] as const).map(async (status) => {
          const envelope = await getVacancyRequests({ status, page: 1, pageSize: 1, signal })
          return [status, envelope.total] as const
        }),
      ),
  })

  if (listQuery.isLoading) return <LoadingState />
  if (listQuery.error)
    return <ErrorState message={describeApiError(listQuery.error)} onRetry={() => void listQuery.refetch()} />

  const rows = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = listQuery.data?.totalPages ?? 1
  const openPositions = rows.reduce((sum, row) => sum + row.headcount, 0)
  const counts = new Map(tabsQuery.data?.map(([status, value]) => [status, value]))

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: ['portal', 'vacancy-requests'] })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-charcoal-900">Recruitment</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {openPositions} open positions on this page · {Math.max(total, rows.length)} requests ·{' '}
            {me?.activeGym?.gymName || 'your gym'}
          </p>
        </div>
        {can('recruitment.vacancy_request.create') && (
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New Request
          </Button>
        )}
      </div>

      {/* State tabs with live counts */}
      <div className="flex overflow-x-auto rounded-xl border border-charcoal-200 bg-white px-1.5">
        {TABS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setTab(option)
              setPage(1)
            }}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-semibold transition-colors',
              tab === option
                ? 'border-b-2 border-brand-600 text-brand-700'
                : 'border-b-2 border-transparent text-charcoal-500 hover:text-charcoal-700',
            )}
          >
            {option} Positions
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                tab === option ? 'bg-brand-100 text-brand-700' : 'bg-charcoal-100 text-charcoal-600',
              )}
            >
              {option === 'All' ? Math.max(total, 0) : counts.get(option) ?? 0}
            </span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-charcoal-200 bg-white p-8 text-center">
          <UserRound className="mx-auto mb-2 h-10 w-10 text-charcoal-300" aria-hidden="true" />
          <p className="text-xs text-charcoal-500">No requests here right now.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <RecruitmentCard key={row.id} row={row} onOpen={() => setDetail(row)} />
          ))}
        </div>
      )}

      {(totalPages > 1 || (listQuery.data?.page ?? 1) > 1) && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            disabled={(listQuery.data?.page ?? 1) <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </Button>
          <span className="text-[11px] text-charcoal-500">
            Page {listQuery.data?.page ?? 1} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={(listQuery.data?.page ?? 1) >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {newOpen && <NewRequestModal onClose={() => setNewOpen(false)} onSaved={refreshLists} />}

      {detail && (
        <RecruitmentDetailModal
          row={detail}
          canApprove={can('recruitment.vacancy_request.approve')}
          canRaise={can('recruitment.vacancy_request.create')}
          onClose={() => setDetail(null)}
          onRaise={() => {
            setDetail(null)
            setNewOpen(true)
          }}
          onChanged={(next) => {
            refreshLists()
            if (next) setDetail(next)
            else setDetail(null)
          }}
        />
      )}
    </div>
  )
}

/* ==================== card ==================== */

function RecruitmentCard({ row, onOpen }: { row: VacancyRequestRow; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-charcoal-200 bg-white p-3 text-left transition-all hover:shadow-sm card-interactive"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <UserRound className="h-4 w-4 text-brand-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-charcoal-900">
              {row.position}
              {row.headcount > 1 && <span className="font-normal text-charcoal-500"> x{row.headcount}</span>}
            </p>
            <p className="truncate text-[10px] text-charcoal-500">
              {row.submittedBy ?? '—'} · {formatDate(row.submittedDate)}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className={cn('rounded px-2 py-0.5 text-[9px] font-semibold', urgencyClass(row.urgency))}>
            {row.urgency ?? '—'}
          </span>
          <StatusBadge status={humanize(row.status)} />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-charcoal-600">{row.reason}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip className="bg-charcoal-50 text-charcoal-600">Wants {row.shift ?? 'any shift'}</Chip>
        <Chip className="bg-charcoal-50 text-charcoal-600">
          EGP {row.salary != null ? formatMoney(row.salary) : '—'}
        </Chip>
        {row.vacancyId && (
          <Chip className="bg-blue-50 text-blue-700">Vacancy #{row.vacancyId} opened</Chip>
        )}
      </div>
    </button>
  )
}

/* ==================== new request modal (mock openNewRecruitment) ==================== */

function NewRequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = usePortalSession()
  const { toast } = useToast()
  const [position, setPosition] = useState('')
  const [urgency, setUrgency] = useState('Medium')
  const [shift, setShift] = useState('Morning')
  const [salary, setSalary] = useState('')
  const [headcount, setHeadcount] = useState('1')
  const [reason, setReason] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createVacancyRequest({
        position: position.trim(),
        urgency,
        reason: reason.trim(),
        salary: salary ? Number(salary) : null,
        shift,
        headcount: Math.max(1, Number(headcount) || 1),
      }),
    onSuccess: () => {
      toast(`${position.trim()} request submitted · awaiting HR`)
      onSaved()
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal open title="New Recruitment Request" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-2.5 text-[10px] leading-relaxed text-brand-800">
          Tell HR exactly what you need — the <b>shift</b> and the <b>expected salary</b> are what HR matches
          candidates against.
        </div>
        <div>
          <label className="form-label" htmlFor="rec-position">
            Position
          </label>
          <input
            id="rec-position"
            type="text"
            className="form-input"
            placeholder="e.g. Senior Trainer"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="rec-count">
              Count
            </label>
            <input
              id="rec-count"
              type="number"
              min={1}
              className="form-input"
              value={headcount}
              onChange={(event) => setHeadcount(event.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="rec-urgency">
              Urgency
            </label>
            <select id="rec-urgency" className="form-input" value={urgency} onChange={(event) => setUrgency(event.target.value)}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="rec-shift">
              Shift you want
            </label>
            <select id="rec-shift" className="form-input" value={shift} onChange={(event) => setShift(event.target.value)}>
              <option>Morning</option>
              <option>Evening</option>
              <option>Night</option>
              <option>Flexible</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="rec-salary">
              Expected salary (EGP, optional)
            </label>
            <input
              id="rec-salary"
              type="number"
              min={0}
              step={500}
              className="form-input"
              placeholder="e.g. 12000"
              value={salary}
              onChange={(event) => setSalary(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="rec-reason">
            Reason
          </label>
          <textarea
            id="rec-reason"
            rows={2}
            className="form-input"
            placeholder="Why is this position needed?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={position.trim().length === 0 || reason.trim().length === 0}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Submit Request
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-charcoal-400">
        Filed by {user?.fullName ?? 'you'} — the request lands straight in HR&apos;s pending queue.
      </p>
    </Modal>
  )
}

/* ==================== detail modal (mock openRecruitmentDetail, real stages) ==================== */

function RecruitmentDetailModal({
  row,
  canApprove,
  canRaise,
  onClose,
  onRaise,
  onChanged,
}: {
  row: VacancyRequestRow
  canApprove: boolean
  canRaise: boolean
  onClose: () => void
  onRaise: () => void
  onChanged: (row: VacancyRequestRow | null) => void
}) {
  const { toast } = useToast()

  const decideMutation = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => decideVacancyRequest(row.id, { decision, comment: null }),
    onSuccess: (updated) => {
      toast(updated.data.status === 'Approved' ? 'Request approved — vacancy created.' : 'Request rejected.')
      onChanged(updated.data)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const reopenMutation = useMutation({
    mutationFn: () => reopenVacancyRequest(row.id),
    onSuccess: (result) => {
      toast(result.vacancyWithdrawn ? 'Reopened — the vacancy had no applicants and was withdrawn.' : 'Request reopened — back to pending.')
      onChanged(null)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal open title={row.position} subtitle={row.gym} width="wide" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded px-2 py-0.5 text-[9px] font-semibold', urgencyClass(row.urgency))}>
            {row.urgency ?? '—'} urgency
          </span>
          <StatusBadge status={humanize(row.status)} />
          <span className="text-[10px] text-charcoal-400">
            submitted {formatDate(row.submittedDate)} · by {row.submittedBy ?? '—'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-charcoal-50 p-2.5">
            <p className="text-[10px] text-charcoal-500">Positions</p>
            <p className="text-xs font-semibold text-charcoal-900">{row.headcount}</p>
          </div>
          {row.vacancyId && (
            <div className="rounded-lg bg-charcoal-50 p-2.5">
              <p className="text-[10px] text-charcoal-500">Opened vacancy</p>
              <p className="text-xs font-semibold text-charcoal-900">#{row.vacancyId}</p>
            </div>
          )}
        </div>

        <div>
          <p className="form-label">Reason</p>
          <p className="text-xs text-charcoal-600">{row.reason}</p>
        </div>

        {/* what the BM asked for */}
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-2">
            <p className="bento-label">WHAT YOU ASKED FOR</p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            <div>
              <p className="bento-label text-charcoal-500">Position</p>
              <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                {row.position}
                {row.headcount > 1 ? ` x${row.headcount}` : ''}
              </p>
            </div>
            <div>
              <p className="bento-label text-charcoal-500">Shift</p>
              <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{row.shift ?? 'Any'}</p>
            </div>
            <div>
              <p className="bento-label text-charcoal-500">Expected salary</p>
              <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                {row.salary != null ? formatMoney(row.salary) : '—'}
              </p>
            </div>
            <div>
              <p className="bento-label text-charcoal-500">Requested by</p>
              <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{row.submittedBy ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* what happens next, per the real state */}
        {row.status === 'Pending' && (
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-3">
            <p className="mb-0.5 text-xs font-bold text-purple-800">With HR — awaiting decision</p>
            <p className="text-[11px] leading-snug text-purple-700">
              HR reviews the position, shift and salary. You can&apos;t do anything here yet; you&apos;ll be
              notified either way.
            </p>
          </div>
        )}
        {row.status === 'Approved' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="mb-0.5 text-xs font-bold text-green-800">
              Approved — {row.vacancyId ? `vacancy #${row.vacancyId} is open` : 'HR is opening the vacancy'}
            </p>
            <p className="text-[11px] leading-snug text-green-700">
              HR creates the account and the contract once hiring completes. Decided by {row.decidedBy ?? '—'}.
            </p>
            {canApprove && (
              <div className="mt-2">
                <Button size="sm" variant="danger" loading={reopenMutation.isPending} onClick={() => reopenMutation.mutate()}>
                  Reopen
                </Button>
              </div>
            )}
          </div>
        )}
        {row.status === 'Rejected' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="mb-1 text-xs font-bold text-red-800">HR rejected this request</p>
            <p className="text-[11px] leading-snug text-red-700">Decision recorded by {row.decidedBy ?? '—'}.</p>
            {canRaise && (
              <div className="mt-2">
                <Button size="sm" onClick={onRaise}>
                  Raise a new request
                </Button>
              </div>
            )}
          </div>
        )}

        {canApprove && row.status === 'Pending' && (
          <div className="rounded-xl border border-charcoal-200 bg-white p-3">
            <p className="bento-label mb-1.5 text-charcoal-700">You hold the approval key</p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" loading={decideMutation.isPending && decideMutation.variables === 'approve'} onClick={() => decideMutation.mutate('approve')}>
                Approve — open the vacancy
              </Button>
              <Button size="sm" variant="danger" onClick={() => decideMutation.mutate('reject')}>
                Reject
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
