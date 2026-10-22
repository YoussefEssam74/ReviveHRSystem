import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, X } from 'lucide-react'
import {
  decideRequest,
  editManagedRequest,
  getRequestDetail,
  getRequestInbox,
  getRequestTypes,
  type DeskRequestRow,
  type RequestDetail,
} from '../api/requests.api'
import { EmptyState } from '../../../components/ui/primitives'
import { Drawer } from '../../../components/ui/drawer'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateWithYear } from '../../../lib/format'
import { cn } from '../../../lib/utils'

/** The four real workflow states behind the mock's tab bar (mock §17). */
type DeskTab = 'Pending' | 'PendingHRReview' | 'Approved' | 'Rejected'

const TABS: { key: DeskTab; label: string; hint: string }[] = [
  { key: 'Pending', label: 'NEED ACTION', hint: 'Waiting for your decision' },
  { key: 'PendingHRReview', label: 'PENDING HR', hint: 'Approved to HR, awaiting sign-off' },
  { key: 'Approved', label: 'APPROVED', hint: 'Signed off end-to-end' },
  { key: 'Rejected', label: 'REJECTED', hint: 'Rejected at the desk or by HR' },
]

const TAB_STYLES: Record<DeskTab, { active: string; badge: string }> = {
  Pending: { active: 'bg-yellow-100 text-yellow-800', badge: 'text-yellow-600' },
  PendingHRReview: { active: 'bg-purple-100 text-purple-800', badge: 'text-purple-600' },
  Approved: { active: 'bg-green-100 text-green-800', badge: 'text-green-600' },
  Rejected: { active: 'bg-red-100 text-red-800', badge: 'text-red-600' },
}

const PAGE_SIZE = 10

export default function TeamRequestsPage() {
  const { isTeamLeader, isBranchManager } = usePortalSession()
  const [tab, setTab] = useState<DeskTab>('Pending')

  if (!isTeamLeader && !isBranchManager) {
    return (
      <EmptyState
        title="Requests desk is for managers"
        hint="Stage-1 decisions run through the team-leader / branch-manager desk role."
      />
    )
  }

  return <DeskWorkspace tab={tab} onTab={setTab} />
}

function DeskWorkspace({ tab, onTab }: { tab: DeskTab; onTab: (tab: DeskTab) => void }) {
  return (
    <div className="space-y-3">
      <TabBar tab={tab} onTab={onTab} />
      <DeskList key={tab} status={tab} />
    </div>
  )
}

function TabBar({ tab, onTab }: { tab: DeskTab; onTab: (tab: DeskTab) => void }) {  const counts = useQuery({
    queryKey: ['portal', 'desk', 'counts'],
    queryFn: async ({ signal }) => {
      const statuses: DeskTab[] = ['Pending', 'PendingHRReview', 'Approved', 'Rejected']
      const results = await Promise.all(
        statuses.map((status) =>
          getRequestInbox({ status, page: 1, pageSize: 1, signal }).then((page) => page.totalCount),
        ),
      )
      return Object.fromEntries(statuses.map((status, index) => [status, results[index]])) as Record<DeskTab, number>
    },
  })

  const totals = counts.data
  const subtitle = totals
    ? TABS.map((t) => `${(totals[t.key] ?? 0).toLocaleString()} ${t.label.toLowerCase()}`).join(' · ')
    : 'Loading desk…'

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-charcoal-900">Team Requests</h1>
        <p className="mt-0.5 text-xs text-charcoal-500">{subtitle}</p>
      </div>
      <div className="flex gap-1.5 rounded-xl border border-charcoal-200 bg-white p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            className={cn('min-w-0 flex-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors', tab === t.key ? TAB_STYLES[t.key].active : 'text-charcoal-500 hover:bg-charcoal-50')}
          >
            <span className="block truncate text-[11px] font-semibold">{t.label}</span>
            <span className="mt-0.5 block text-[10px] font-bold">{totals ? totals[t.key] : '—'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** "2026-10-20" + "2026-10-22" → "Oct 20 – Oct 22" */
function rangeLabel(start: string, end: string | null): string {
  if (!end || end === start) return formatDateWithYear(start)
  return `${formatDate(start)} – ${formatDateWithYear(end)}`
}

function DeskList({ status }: { status: DeskTab }) {
  const [page, setPage] = useState(1)

  const inboxQuery = useQuery({
    queryKey: ['portal', 'desk', 'inbox', status, page],
    queryFn: ({ signal }) => getRequestInbox({ status, page, pageSize: PAGE_SIZE, signal }),
  })

  // DeskList is remounted per tab (key on <DeskList>), so page state resets naturally.

  if (inboxQuery.isLoading) return <LoadingState />
  if (inboxQuery.error)
    return <ErrorState message={describeApiError(inboxQuery.error)} onRetry={() => inboxQuery.refetch()} />

  const envelope = inboxQuery.data
  const rows = envelope?.items ?? []

  return (
    <div className="space-y-2">
      {rows.length > 0 ? (
        <div className="divide-y divide-charcoal-50 overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          {rows.map((row) => (
            <DeskRow key={row.id} row={row} status={status} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={TABS.find((t) => t.key === status)?.hint ?? 'Nothing here'}
          hint="Desk rows appear as soon as team members submit requests."
        />
      )}
      {envelope && envelope.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <p className="text-[10px] text-charcoal-500">
            Page {envelope.page} of {envelope.totalPages} · {envelope.totalCount} total
          </p>
          <Button size="sm" variant="secondary" disabled={page >= envelope.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

/** The real stage-1 rule set: decide only Pending rows, edit Pending and
 * PendingHRReview rows, and view everything. */
function DeskRow({ row, status }: { row: DeskRequestRow; status: DeskTab }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [decision, setDecision] = useState<'Approve' | 'Reject' | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['portal', 'desk'] })
    void queryClient.invalidateQueries({ queryKey: ['portal', 'requests'] })
  }

  const decideMutation = useMutation({
    mutationFn: (input: { decision: string; comment: string | null }) =>
      decideRequest(row.id, input.decision, input.comment),
    onSuccess: () => {
      toast(`Request #${row.id} ${status === 'Pending' && decision === 'Approve' ? 'approved to HR review' : 'rejected'}.`)
      setDecision(null)
      invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const rejectionNote = row.timeline.filter((step) => step.step.toLowerCase().includes('rejected')).pop()

  return (
    <div className="p-3 transition-colors hover:bg-charcoal-50/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
            {initialsOf(row.employeeName)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-charcoal-900">{row.employeeName}</p>
              <StatusBadge status={row.status} />
            </div>
            <p className="mt-0.5 text-[10px] text-charcoal-500">
              {row.type} · {rangeLabel(row.requestedDate, row.endDate)} · Submitted {formatDate(row.submittedDate)}
            </p>
            {row.reason && <p className="mt-0.5 line-clamp-2 text-[10px] text-charcoal-400">{row.reason}</p>}
            {rejectionNote && (
              <p className="mt-0.5 text-[10px] text-red-500">
                {rejectionNote.step}
                {rejectionNote.date ? ` · ${rejectionNote.date}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {(status === 'Pending' || status === 'PendingHRReview') && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
            </Button>
          )}
          {status === 'Pending' && (
            <>
              <Button size="sm" onClick={() => setDecision('Approve')}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approve
              </Button>
              <Button size="sm" variant="dangerOutline" onClick={() => setDecision('Reject')}>
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Reject
              </Button>
            </>
          )}
          {status === 'PendingHRReview' && (
            <Button size="sm" variant="dangerOutline" onClick={() => setDecision('Reject')}>
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Reject
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setDetailId(row.id)}>
            View
          </Button>
        </div>
      </div>

      {decision && (
        <Modal
          open
          title={decision === 'Approve' ? `Approve request #${row.id}` : `Reject request #${row.id}`}
          subtitle={
            decision === 'Approve'
              ? 'Approves to HR review — HR gives the final sign-off.'
              : 'Rejects the request; reserved leave days are released.'
          }
          onClose={() => setDecision(null)}
          footer={
            <>
              <Button size="sm" variant="secondary" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant={decision === 'Reject' ? 'danger' : 'primary'}
                loading={decideMutation.isPending}
                onClick={() => decideMutation.mutate({ decision, comment: null })}
              >
                {decision === 'Approve' ? 'Approve' : 'Reject'}
              </Button>
            </>
          }
        >
          <div className="space-y-2">
            <p className="text-xs text-charcoal-700">
              {row.employeeName} — {row.type}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-charcoal-50 p-2.5">
                <p className="bento-label text-charcoal-500">From</p>
                <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{formatDateWithYear(row.requestedDate)}</p>
              </div>
              <div className="rounded-lg bg-charcoal-50 p-2.5">
                <p className="bento-label text-charcoal-500">To</p>
                <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                  {row.endDate ? formatDateWithYear(row.endDate) : 'Same day'}
                </p>
              </div>
            </div>
            {row.reason && (
              <div className="rounded-lg bg-charcoal-50 p-2.5">
                <p className="bento-label text-charcoal-500">Reason</p>
                <p className="mt-0.5 text-xs text-charcoal-700">{row.reason}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {editOpen && <EditRequestModal row={row} onClose={() => setEditOpen(false)} onSaved={invalidate} />}

      {detailId != null && (
        <RequestDetailDrawer requestId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

function EditRequestModal({
  row,
  onClose,
  onSaved,
}: {
  row: DeskRequestRow
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const typesQuery = useQuery({
    queryKey: ['portal', 'request-types'],
    queryFn: ({ signal }) => getRequestTypes(signal),
    staleTime: 5 * 60_000,
  })
  const types = typesQuery.data ?? []

  const [typeId, setTypeId] = useState('')
  const [requestDate, setRequestDate] = useState(row.requestedDate)
  const [endDate, setEndDate] = useState(row.endDate ?? '')
  const [reason, setReason] = useState(row.reason)

  // The selected type derives from the list during render (no effect needed):
  // an explicit choice wins, else the row's stored type, else the first entry.
  const fallbackType =
    types.find((t) => t.label.toLowerCase() === row.type.toLowerCase()) ??
    types.find((t) => t.id.toLowerCase() === row.type.toLowerCase()) ??
    types[0]
  const effectiveTypeId = typeId || fallbackType?.id || row.type

  const saveMutation = useMutation({
    mutationFn: () =>
      editManagedRequest(row.id, {
        type: effectiveTypeId || row.type,
        requestDate,
        endDate: endDate || null,
        reason: reason.trim() || null,
      }),
    onSuccess: () => {
      toast(`Request #${row.id} updated.`)
      onSaved()
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const activeType = types.find((t) => t.id === effectiveTypeId)
  const usesRange = activeType ? activeType.fields.includes('date-from') || activeType.fields.includes('date-to') : Boolean(row.endDate)

  return (
    <Modal
      open
      title={`Edit request #${row.id}`}
      subtitle={`${row.employeeName} — the manager edit patches type, dates and reason.`}
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
        <div>
          <label className="form-label" htmlFor="desk-type">
            Type
          </label>
          <select id="desk-type" value={effectiveTypeId} onChange={(e) => setTypeId(e.target.value)} className="form-input">
            {types.length === 0 && <option value="">{row.type}</option>}
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="desk-date">
              Requested date
            </label>
            <input
              id="desk-date"
              type="date"
              value={requestDate}
              onChange={(e) => e.target.value && setRequestDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="desk-end">
              End date
            </label>
            <input
              id="desk-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={!usesRange}
              className="form-input"
            />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="desk-reason">
            Reason
          </label>
          <textarea
            id="desk-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
          />
        </div>
      </div>
    </Modal>
  )
}

function RequestDetailDrawer({ requestId, onClose }: { requestId: number; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: ['portal', 'desk', 'detail', requestId],
    queryFn: ({ signal }) => getRequestDetail(requestId, signal),
  })

  if (detailQuery.isLoading) return <Drawer open onClose={onClose} title={`Request #${requestId}`}>
    <LoadingState />
  </Drawer>
  if (detailQuery.error)
    return (
      <Drawer open onClose={onClose} title={`Request #${requestId}`}>
        <ErrorState message={describeApiError(detailQuery.error)} onRetry={() => detailQuery.refetch()} />
      </Drawer>
    )

  const detail = detailQuery.data as RequestDetail | undefined
  if (!detail) return null

  return (
    <Drawer open onClose={onClose} title={`Request #${detail.id}`}>
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-charcoal-900">{detail.employee}</p>
            <StatusBadge status={detail.status} />
          </div>
          <p className="mt-0.5 text-[11px] text-charcoal-500">{detail.gym}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <Field label="Type" value={detail.type} />
          <Field label="Status" value={detail.status} />
          <Field label="Submitted" value={formatDateWithYear(detail.submittedDate)} />
          <Field label="Requested" value={rangeLabel(detail.requestedDate, detail.endDate)} />
          {detail.bmDecision && <Field label="Desk decision" value={detail.bmDecision} />}
          {detail.bmComment && <Field label="Desk comment" value={detail.bmComment} />}
          {detail.hrDecision && <Field label="HR decision" value={detail.hrDecision} />}
          {detail.hrComment && <Field label="HR comment" value={detail.hrComment} />}
          {detail.payment && <Field label="Payment" value={detail.payment} />}
        </dl>
        <div className="rounded-lg bg-charcoal-50 p-3">
          <p className="bento-label text-charcoal-500">Reason</p>
          <p className="mt-1 text-xs text-charcoal-700">{detail.reason || 'No reason provided.'}</p>
        </div>
        <div>
          <p className="bento-label mb-1.5 text-charcoal-500">TIMELINE</p>
          <ol className="space-y-1.5">
            {detail.timeline.map((step, index) => (
              <li key={index} className="flex items-center gap-2 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${step.done ? 'bg-brand-500' : 'bg-charcoal-300'}`} />
                <span className={step.done ? 'font-medium text-charcoal-900' : 'text-charcoal-500'}>{step.step}</span>
                {step.date && <span className="text-[10px] text-charcoal-400">{step.date}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Drawer>
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

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}