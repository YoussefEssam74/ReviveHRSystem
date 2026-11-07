import { useState } from 'react'
import { FileText, Check, X } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Button } from '../../../components/ui/button'
import { Tabs } from '../../../components/ui/tabs'
import { Dialog } from '../../../components/ui/dialog'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { useActionRequests, useApproveRequest, useRejectRequest } from '../hooks/useRequests'
import { useMe } from '../../../contexts/MeContext'
import { actionTypeLabel, formatDate, formatMoney } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'
import type { ActionRequest } from '../api/requests.api'

type StatusTab = 'Pending' | 'Approved' | 'Rejected' | ''

const TABS: { value: StatusTab; label: string }[] = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

/** A short human summary of what a request proposes. */
function detailSummary(request: ActionRequest): string {
  const d = request.proposedDetails
  if (!d) return request.justification ?? '—'
  switch (request.ActionType) {
    case 'Transfer':
      return `${d.fromGym ?? '—'} → ${d.toGym ?? '—'}`
    case 'CompensationChange':
      return `${formatMoney(d.currentSalary)} → ${formatMoney(d.newSalary)}`
    case 'RoleAssign':
      return d.systemRole ?? '—'
    case 'Offboard':
      return d.lastDay ? `Last day ${formatDate(d.lastDay)}` : '—'
    case 'BulkImport':
      return d.source ?? '—'
    default:
      return '—'
  }
}

/** Escalated action-request queue (E20/§5.6) — approve / reject pending rows. */
export default function RequestsPage() {
  const { can } = useMe()
  const [tab, setTab] = useState<StatusTab>('Pending')
  const [page, setPage] = useState(1)

  const [rejecting, setRejecting] = useState<ActionRequest | null>(null)
  const [comment, setComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const approve = useApproveRequest()
  const reject = useRejectRequest()

  const { data, isLoading, error } = useActionRequests({
    status: tab || undefined,
    page,
    pageSize: 20,
  })

  const canReview = can('requests', 2)

  const onApprove = async (id: number) => {
    setActionError(null)
    try {
      await approve.mutateAsync(id)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const openReject = (request: ActionRequest) => {
    setRejecting(request)
    setComment('')
    setActionError(null)
  }

  const onReject = async () => {
    if (!rejecting) return
    setActionError(null)
    try {
      await reject.mutateAsync({ id: rejecting.id, comment })
      setRejecting(null)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <div>
      <PageHeader title="Requests" description="Escalated action requests awaiting review" />

      <Tabs items={TABS} value={tab} onChange={(value) => { setTab(value); setPage(1) }} className="mb-4 w-fit" />

      <Card>
        {isLoading ? (
          <LoadingState label="Loading requests…" />
        ) : error ? (
          <ErrorState message={describeApiError(error)} />
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyState icon={FileText} title="No requests" message="There are no requests in this view." />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {data!.items.map((request) => (
                <li key={request.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Avatar name={request.requestedBy?.slice(0, 1).toUpperCase() ?? '?'} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{actionTypeLabel(request.ActionType)}</p>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {request.employee ?? '—'}
                        {request.position ? ` · ${request.position}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{detailSummary(request)}</p>
                      {request.justification && (
                        <p className="mt-1 text-sm italic text-slate-500">“{request.justification}”</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span>By {request.requestedBy ?? '—'}</span>
                        <span>{formatDate(request.submittedDate)}</span>
                        {request.reviewedBy && <span>· Reviewed by {request.reviewedBy}</span>}
                      </div>
                    </div>
                  </div>

                  {canReview && request.status === 'Pending' && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => onApprove(request.id)} loading={approve.isPending && approve.variables === request.id}>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Approve
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => openReject(request)}>
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {actionError && (
              <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </p>
            )}
            <Pagination
              page={data!.page}
              pageSize={data!.pageSize}
              total={data!.total}
              totalPages={data!.totalPages}
              onPageChange={setPage}
              noun="requests"
            />
          </>
        )}
      </Card>

      <Dialog
        open={rejecting != null}
        onClose={() => setRejecting(null)}
        title="Reject request"
        description={rejecting ? `${actionTypeLabel(rejecting.ActionType)} · ${rejecting.employee ?? '—'}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onReject} loading={reject.isPending} disabled={comment.trim().length === 0}>
              Reject request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}
          <div>
            <Label htmlFor="comment">Comment (required)</Label>
            <Textarea
              id="comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Why is this request being rejected?"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
