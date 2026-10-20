import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarX2, ChevronRight, Download, FileText, Plus } from 'lucide-react'
import { cancelRequest, getOwnRequests, getRequestDetail, type RequestDetail } from '../api/requests.api'
import { NewRequestModal } from '../components/NewRequestModal'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Drawer } from '../../../components/ui/drawer'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { apiDownload, describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateWithYear } from '../../../lib/format'
import { cn } from '../../../lib/utils'

type StatusFilter = 'All' | 'Pending' | 'Approved' | 'Rejected'

const PILL_FILTERS: StatusFilter[] = ['All', 'Pending', 'Approved', 'Rejected']
const PILL_STYLES: Record<StatusFilter, string> = {
  All: 'bg-charcoal-100 text-charcoal-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-brand-100 text-brand-700',
  Rejected: 'bg-red-100 text-red-700',
}
const PILL_STYLES_ACTIVE: Record<StatusFilter, string> = {
  All: 'bg-charcoal-800 text-white',
  Pending: 'bg-yellow-500 text-white',
  Approved: 'bg-brand-600 text-white',
  Rejected: 'bg-red-500 text-white',
}

/** "2026-10-20" + "2026-10-22" → "Oct 20 – Oct 22" (single date → one token). */
export function rangeLabel(start: string, end: string | null): string {
  if (!end || end === start) return formatDateWithYear(start)
  return `${formatDate(start)} – ${formatDateWithYear(end)}`
}

export default function MyRequestsPage() {
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null
  const [filter, setFilter] = useState<StatusFilter>('All')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-xl font-bold text-charcoal-900">My Requests</h1>
        <Button size="sm" onClick={() => setNewOpen(true)} disabled={employeeId == null}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New Request
        </Button>
      </div>

      {employeeId == null && (
        <EmptyState
          title="No employee profile"
          hint="This account is not linked to an employee profile, so it has no self-service requests."
        />
      )}
      {employeeId != null && (
        <RequestsWorkspace
          employeeId={employeeId}
          filter={filter}
          onFilter={setFilter}
          detailId={detailId}
          onDetail={setDetailId}
        />
      )}

      {newOpen && employeeId != null && <NewRequestModal employeeId={employeeId} onClose={() => setNewOpen(false)} />}
    </div>
  )
}

function RequestsWorkspace({
  employeeId,
  filter,
  onFilter,
  detailId,
  onDetail,
}: {
  employeeId: number
  filter: StatusFilter
  onFilter: (filter: StatusFilter) => void
  detailId: number | null
  onDetail: (id: number | null) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const requestsQuery = useQuery({
    queryKey: ['portal', 'requests', employeeId, 'list'],
    queryFn: ({ signal }) => getOwnRequests(employeeId, signal),
  })

  const requests = requestsQuery.data ?? []
  const counts = useMemo(() => {
    const byStatus = new Map<string, number>()
    for (const request of requests) byStatus.set(request.status, (byStatus.get(request.status) ?? 0) + 1)
    const pending = (byStatus.get('Pending') ?? 0) + (byStatus.get('Pending HR Review') ?? 0)
    return {
      All: requests.length,
      Pending: pending,
      Approved: byStatus.get('Approved') ?? 0,
      Rejected: byStatus.get('Rejected') ?? 0,
    } satisfies Record<StatusFilter, number>
  }, [requests])

  const filtered = useMemo(
    () =>
      filter === 'All'
        ? requests
        : requests.filter((request) =>
            filter === 'Pending'
              ? request.status === 'Pending' || request.status === 'Pending HR Review'
              : request.status === filter,
          ),
    [filter, requests],
  )

  const cancelMutation = useMutation({
    mutationFn: (requestId: number) => cancelRequest(requestId),
    onSuccess: async () => {
      toast('Request cancelled')
      await queryClient.invalidateQueries({ queryKey: ['portal', 'requests'] })
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const downloadMutation = useMutation({
    mutationFn: (requestId: number) => apiDownload(`/api/requests/${requestId}/attachment`),
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName ?? 'attachment'
      anchor.click()
      URL.revokeObjectURL(url)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  if (requestsQuery.isLoading) return <LoadingState label="Loading your requests…" />
  if (requestsQuery.isError) {
    return <ErrorState message={describeApiError(requestsQuery.error)} onRetry={() => requestsQuery.refetch()} />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PILL_FILTERS.map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => onFilter(pill)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              filter === pill ? PILL_STYLES_ACTIVE[pill] : PILL_STYLES[pill],
            )}
          >
            {pill} <span className="text-[10px] opacity-70">{counts[pill]}</span>
          </button>
        ))}
      </div>

      <div className="card hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-charcoal-100 text-charcoal-500">
                <th className="px-4 py-2.5 font-medium">Request</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Submitted</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((request) => (
                <tr
                  key={request.id}
                  className="cursor-pointer border-b border-charcoal-50 transition-colors last:border-0 hover:bg-charcoal-50"
                  onClick={() => onDetail(request.id)}
                >
                  <td className="px-4 py-2.5 font-medium">#{request.id}</td>
                  <td className="px-4 py-2.5">{request.type}</td>
                  <td className="px-4 py-2.5">{rangeLabel(request.requestedDate, request.endDate)}</td>
                  <td className="px-4 py-2.5">{formatDate(request.submittedDate)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="px-2">
                    <ChevronRight className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1.5 lg:hidden">
        {filtered.map((request) => (
          <div key={request.id} className="card card-interactive cursor-pointer p-3" onClick={() => onDetail(request.id)}>
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-charcoal-100 text-charcoal-600">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-charcoal-900">{request.type}</p>
                  <p className="text-[10px] text-charcoal-500">
                    #{request.id} · {formatDate(request.submittedDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="hidden text-[10px] text-charcoal-700 sm:block">{rangeLabel(request.requestedDate, request.endDate)}</p>
                <StatusBadge status={request.status} />
                <ChevronRight className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={<FileText className="h-10 w-10" aria-hidden="true" />}
          title={filter === 'All' ? 'No requests yet' : `No ${filter.toLowerCase()} requests`}
          hint={filter === 'All' ? 'Submit a new request to see it here.' : undefined}
        />
      )}

      <RequestDetailDrawer
        requestId={detailId}
        onClose={() => onDetail(null)}
        onCancel={(id) => cancelMutation.mutate(id)}
        cancelling={cancelMutation.isPending}
        onDownload={(id) => downloadMutation.mutate(id)}
        downloading={downloadMutation.isPending}
      />
    </div>
  )
}

/* ==================== Detail drawer ==================== */

function RequestDetailDrawer({
  requestId,
  onClose,
  onCancel,
  cancelling,
  onDownload,
  downloading,
}: {
  requestId: number | null
  onClose: () => void
  onCancel: (id: number) => void
  cancelling: boolean
  onDownload: (id: number) => void
  downloading: boolean
}) {
  const query = useQuery({
    queryKey: ['portal', 'requests', requestId, 'detail'],
    queryFn: ({ signal }) => getRequestDetail(requestId!, signal),
    enabled: requestId != null,
    retry: false,
  })

  const detail: RequestDetail | undefined = query.data
  const canCancel = detail?.status === 'Pending' || detail?.status === 'Pending HR Review'

  return (
    <Drawer open={requestId != null} title={detail ? detail.type : 'Request'} onClose={onClose}>
      {query.isLoading && <LoadingState label="Loading request…" />}
      {query.isError && <ErrorState message={describeApiError(query.error)} onRetry={() => query.refetch()} />}
      {detail && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge status={detail.status} />
              <span className="text-[10px] font-medium text-charcoal-400">#{detail.id}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-charcoal-50 p-2.5 text-center">
              <p className="bento-label mb-0.5">TYPE</p>
              <p className="text-xs font-semibold text-charcoal-900">{detail.type}</p>
            </div>
            <div className="rounded-lg bg-charcoal-50 p-2.5 text-center">
              <p className="bento-label mb-0.5">SUBMITTED</p>
              <p className="text-xs font-semibold text-charcoal-900">{formatDateWithYear(detail.submittedDate)}</p>
            </div>
          </div>

          <div className="rounded-lg bg-charcoal-50 p-3">
            <p className="bento-label mb-1">REQUESTED DATE</p>
            <p className="text-sm font-bold text-charcoal-900">{rangeLabel(detail.requestedDate, detail.endDate)}</p>
          </div>

          <div>
            <p className="bento-label mb-1">REASON</p>
            <p className="rounded-lg bg-charcoal-50 p-2.5 text-xs text-charcoal-700">{detail.reason}</p>
          </div>

          {detail.bmComment && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="bento-label mb-1 text-blue-600">TEAM LEAD / BRANCH MANAGER COMMENT</p>
              <p className="text-xs text-charcoal-700">{detail.bmComment}</p>
            </div>
          )}
          {detail.hrComment && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
              <p className="bento-label mb-1 text-brand-600">HR COMMENT</p>
              <p className="text-xs text-charcoal-700">{detail.hrComment}</p>
            </div>
          )}

          <div>
            <p className="bento-label mb-2">APPROVAL WORKFLOW</p>
            <div className="space-y-0">
              {detail.timeline.map((step, index) => (
                <div key={step.step + index} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'mt-0.5 h-3 w-3 flex-shrink-0 rounded-full',
                        step.done ? 'bg-brand-500 ring-2 ring-brand-100' : 'bg-charcoal-300',
                      )}
                    />
                    {index < detail.timeline.length - 1 && <div className="my-0.5 h-6 w-0.5 bg-charcoal-200" />}
                  </div>
                  <div className="pb-3">
                    <p className={cn('text-xs font-medium', step.done ? 'text-charcoal-900' : 'text-charcoal-400')}>{step.step}</p>
                    <p className={cn('text-[10px]', step.done ? 'text-charcoal-500' : 'text-charcoal-400')}>{step.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t border-charcoal-100 pt-2">
            {canCancel && (
              <Button
                variant="dangerOutline"
                size="sm"
                className="flex-1 justify-center"
                disabled={cancelling}
                onClick={() => onCancel(detail.id)}
              >
                <CalendarX2 className="h-3.5 w-3.5" aria-hidden="true" />
                {cancelling ? 'Cancelling…' : 'Cancel Request'}
              </Button>
            )}
            {detail.status === 'Approved' && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-center"
                disabled={downloading}
                onClick={() => onDownload(detail.id)}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {downloading ? 'Downloading…' : 'Download'}
              </Button>
            )}
            <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}
