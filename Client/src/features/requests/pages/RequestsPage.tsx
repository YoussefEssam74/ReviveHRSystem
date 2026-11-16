import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Inbox, Plus, Search, X } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Avatar } from '../../../components/ui/avatar'
import { Badge } from '../../../components/ui/badge'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { EmptyState } from '../../../components/ui/empty-state'
import { Pagination } from '../../../components/ui/pagination'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { EDIT, VIEW } from '../../../lib/permissions'
import { cn } from '../../../lib/utils'
import { useMockToast } from '../../dashboard/hooks/useMockToast'
import { DashboardToasts } from '../../dashboard/components/DashboardToasts'
import type { RequestDecisionResult, RequestListItem } from '../api/requests.api'
import { useArchiveRequest, useRequestInbox, useRequestSummary } from '../hooks/useRequests'
import {
  bmDecisionTimeLabel,
  currentMonthShort,
  hrDecisionTimeLabel,
  isDecisionUndoable,
  requestTypeLabel,
  requestUrgency,
  submittedTimeLabel,
  REQUEST_TYPE_CATALOG,
} from '../lib/request-status'
import { RequestDecisionDialog, type DecisionMode } from '../components/RequestDecisionDialog'
import { RequestDetailDialog } from '../components/RequestDetailDialog'
import { BulkApproveDialog } from '../components/BulkApproveDialog'
import { NewRequestDialog } from '../components/NewRequestDialog'
import { UrgencyTag } from '../components/RequestCard'

type QuickFilter = 'urgent' | 'approved' | 'bmRejected' | 'balance'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'Pending HR Review', label: 'Pending HR review' },
  { value: 'Decided', label: 'Decided (approved / rejected)' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Archived', label: 'Archived' },
]

const QUICK_LABELS: Record<QuickFilter, string> = {
  urgent: 'Urgent',
  approved: 'Approved',
  bmRejected: 'BM rejected',
  balance: 'Balance alerts',
}

/** Table-density status wording; the filter select keeps the full names. */
const STATUS_LABELS: Record<string, string> = {
  'Pending HR Review': 'Pending HR',
  'Awaiting Manager': 'Awaiting BM',
}

interface StatTileProps {
  label: string
  value: number | string
  hint?: string
  active: boolean
  tone?: string
  onClick: () => void
}

/** Compact KPI tile; clicking it toggles the filter it represents. */
function StatTile({ label, value, hint, active, tone, onClick }: StatTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? 'Clear this filter' : `Filter: ${label}`}
      className={cn(
        'rounded-xl border bg-white p-3 text-start transition hover:border-emerald-300 hover:shadow-sm',
        active ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200',
      )}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold leading-none', tone ?? 'text-slate-900')}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </button>
  )
}

/** HR requests inbox: status/type/date-range filters over a review table with approve/reject actions. */
export default function RequestsPage() {
  const navigate = useNavigate()
  const { can, me } = useMe()
  const canView = can('requests', VIEW)
  const canDecide = can('requests', EDIT)
  const { toasts, toast, remove } = useMockToast()

  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [quick, setQuick] = useState<QuickFilter | null>(null)
  const [page, setPage] = useState(1)

  const [deciding, setDeciding] = useState<{ request: RequestListItem; mode: DecisionMode } | null>(null)
  const [detail, setDetail] = useState<RequestListItem | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [offboarding, setOffboarding] = useState<{ employee: string } | null>(null)
  const monthShort = currentMonthShort()

  const gymId = me?.activeGym?.gymId

  // Typing must not fire a request per keystroke: the input value updates at once,
  // the query term follows after a short pause.
  const [search, setSearch] = useState('')
  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])

  const onName = (value: string) => {
    setName(value)
    resetPage()
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => setSearch(value.trim()), 300)
  }

  const summary = useRequestSummary(gymId, canView)

  const inbox = useRequestInbox(
    {
      // A quick tile owns the status dimension; the select and the tiles are exclusive.
      status: quick ? undefined : status || undefined,
      type: type || undefined,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
      quick: quick ?? undefined,
      gym: gymId,
      page,
      pageSize: 20,
    },
    canView,
  )

  // The pending set behind Bulk Approve.
  const pendingAll = useRequestInbox({ status: 'Pending HR Review', gym: gymId, pageSize: 100 }, canView)

  const archive = useArchiveRequest()

  // Types the select offers: whatever the gym actually raised, plus the full catalog.
  const typeOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { value: string; label: string }[] = []
    const add = (value: string) => {
      const label = requestTypeLabel(value)
      if (seen.has(label)) return
      seen.add(label)
      options.push({ value, label })
    }
    for (const entry of summary.data?.byType ?? []) add(entry.type)
    for (const catalogType of REQUEST_TYPE_CATALOG) add(catalogType)
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [summary.data])

  const hasFilters = Boolean(status || type || name || from || to || quick)
  const matchesBulkScope = !quick && (status === '' || status === 'Pending HR Review')

  const resetPage = () => setPage(1)

  const onStatus = (value: string) => {
    setStatus(value)
    setQuick(null)
    resetPage()
  }

  /** Tiles toggle a status filter on and off. */
  const toggleStatus = (value: string) => {
    setStatus((current) => (current === value ? '' : value))
    setQuick(null)
    resetPage()
  }

  const onFrom = (value: string) => {
    setFrom(value)
    // Keep the window valid so the server never rejects from > to.
    if (value && to && value > to) setTo(value)
    resetPage()
  }

  const onTo = (value: string) => {
    setTo(value)
    if (value && from && value < from) setFrom(value)
    resetPage()
  }

  const toggleQuick = (key: QuickFilter) => {
    setQuick((current) => (current === key ? null : key))
    resetPage()
  }

  const clearFilters = () => {
    setStatus('')
    setType('')
    setName('')
    setFrom('')
    setTo('')
    setQuick(null)
    // Drop any pending debounce so the cleared name does not come back.
    window.clearTimeout(searchTimer.current)
    setSearch('')
    resetPage()
  }

  const onDecide = (request: RequestListItem, mode: DecisionMode) => setDeciding({ request, mode })

  const onDecided = (result: RequestDecisionResult, mode: DecisionMode) => {
    if (mode === 'undo') {
      toast('Decision undone — request returned to Pending HR', 'info')
      return
    }
    if (mode === 'reject') {
      toast('Request rejected · employee notified', 'error')
      return
    }
    const payment = result.item?.payment
    toast(
      payment === 'unpaid'
        ? 'Request approved · unpaid (payroll deduction)'
        : payment === 'paid'
          ? 'Request approved · paid (balance deducted)'
          : 'Request approved · employee notified',
    )
    if (result.offboardingPrompt) {
      setOffboarding({ employee: result.item?.employee ?? '' })
    }
  }

  const onArchive = async (request: RequestListItem, restore: boolean) => {
    try {
      await archive.mutateAsync({ id: request.id, restore })
      toast(restore ? 'Restored to inbox' : 'Archived')
    } catch (err) {
      toast(describeApiError(err), 'error')
    }
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-300 bg-white p-12 text-center">
        <FileText className="mx-auto mb-2 h-8 w-8 text-charcoal-300" aria-hidden="true" />
        <h2 className="text-base font-bold text-charcoal-900">No requests access</h2>
        <p className="mt-1 text-sm text-charcoal-500">
          You don&apos;t have permission to view requests for this gym. Ask an administrator for the requests feature.
        </p>
      </div>
    )
  }

  const pendingForBulk = pendingAll.data?.items ?? []
  const items = inbox.data?.items ?? []
  const total = inbox.data?.total ?? 0

  return (
    <div>
      <PageHeader
        title="Requests"
        description="Day off, sick leave & approvals — filter, then approve or reject."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/console/branch-queue')}>
              <Inbox className="h-4 w-4" aria-hidden="true" />
              Branch queue
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New request
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Pending HR"
          value={summary.data?.pending ?? 0}
          hint={`${summary.data?.awaitingManager ?? 0} awaiting manager`}
          tone="text-amber-600"
          active={!quick && status === 'Pending HR Review'}
          onClick={() => toggleStatus('Pending HR Review')}
        />
        <StatTile
          label="Approved"
          value={summary.data?.approvedThisMonth ?? 0}
          hint={`in ${monthShort}`}
          tone="text-emerald-600"
          active={!quick && status === 'Approved'}
          onClick={() => toggleStatus('Approved')}
        />
        <StatTile
          label="BM rejected"
          value={summary.data?.bmRejected ?? 0}
          hint="needs HR review"
          active={quick === 'bmRejected'}
          onClick={() => toggleQuick('bmRejected')}
        />
        <StatTile
          label="Balance alerts"
          value={summary.data?.balanceAlerts ?? 0}
          hint="no balance left"
          tone={(summary.data?.balanceAlerts ?? 0) > 0 ? 'text-red-600' : 'text-slate-900'}
          active={quick === 'balance'}
          onClick={() => toggleQuick('balance')}
        />
      </div>

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <Label htmlFor="request-name">Name</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="request-name"
                value={name}
                placeholder="Search employee"
                className="ps-9"
                onChange={(e) => onName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="request-status">Status</Label>
            <Select id="request-status" value={status} onChange={(e) => onStatus(e.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="request-type">Type</Label>
            <Select
              id="request-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                resetPage()
              }}
            >
              <option value="">All types</option>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="request-from">From date</Label>
            <Input
              id="request-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => onFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="request-to">To date</Label>
            <Input
              id="request-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => onTo(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{inbox.isLoading ? 'Loading…' : `${total} request${total === 1 ? '' : 's'}`}</span>
            {quick && (
              <button
                type="button"
                onClick={() => setQuick(null)}
                title="Clear this filter"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
              >
                {QUICK_LABELS[quick]}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear filters
              </Button>
            )}
            {canDecide && matchesBulkScope && pendingForBulk.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>
                Approve all pending ({pendingForBulk.length})
              </Button>
            )}
          </div>
        </div>

        {inbox.isLoading ? (
          <LoadingState label="Loading requests…" />
        ) : inbox.error ? (
          <ErrorState message={describeApiError(inbox.error)} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No requests match these filters"
            message={hasFilters ? 'Try a different name, status, type or date range.' : 'Nothing has been raised yet.'}
          />
        ) : (
          <>
            <Table tableClassName="min-w-[720px] table-fixed">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[14%]" />
                <col className="w-[17%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[19%]" />
              </colgroup>
              <THead>
                <TH className="px-3 text-start">Name</TH>
                <TH className="px-3 text-start">Type</TH>
                <TH className="px-3 text-start">Reason</TH>
                <TH className="px-3 text-start">Submitted</TH>
                <TH className="px-3 text-start">Status</TH>
                <TH className="sticky end-0 bg-white px-3 text-end">Action</TH>
              </THead>
              <TBody>
                {items.map((request) => {
                  const pending = request.status === 'Pending HR Review' || request.awaitingManager
                  const archived = request.status === 'Archived'
                  const undoable = !pending && !archived && canDecide && isDecisionUndoable(request)
                  const submittedTime = submittedTimeLabel(request)
                  const hrDecided = hrDecisionTimeLabel(request)
                  const bmDecided = bmDecisionTimeLabel(request)
                  // One line under the badge: the latest stage that decided, and when.
                  const decidedStamp = hrDecided ? `HR · ${hrDecided}` : bmDecided ? `BM · ${bmDecided}` : null

                  return (
                    <TR key={request.id} onClick={() => setDetail(request)}>
                      <TD className="px-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={request.initials || request.employee.slice(0, 1).toUpperCase()} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900" title={request.employee}>
                              {request.employee}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {request.position ? `${request.position} · ` : ''}
                              {request.gym}
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD className="px-3">
                        <span
                          className="badge badge-gray max-w-full overflow-hidden"
                          title={requestTypeLabel(request.type)}
                        >
                          <span className="min-w-0 truncate">{requestTypeLabel(request.type)}</span>
                        </span>
                      </TD>
                      <TD className="px-3">
                        <p className="line-clamp-2 text-sm text-slate-600" title={request.reason || undefined}>
                          {request.reason || '—'}
                        </p>
                      </TD>
                      <TD className="whitespace-nowrap px-3 text-slate-600">
                        <p>
                          {formatDate(request.submittedDate)}
                          {submittedTime && (
                            <span className="text-xs text-slate-400"> · {submittedTime}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatDate(request.requestedDate)}
                          {request.endDate && request.endDate !== request.requestedDate
                            ? ` – ${formatDate(request.endDate)}`
                            : ''}
                        </p>
                      </TD>
                      <TD className="px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            status={request.awaitingManager ? 'Awaiting Manager' : request.status}
                            className="whitespace-nowrap"
                          >
                            {STATUS_LABELS[request.awaitingManager ? 'Awaiting Manager' : request.status] ??
                              request.status}
                          </Badge>
                          {pending && requestUrgency(request) !== 'Normal' && <UrgencyTag request={request} />}
                        </div>
                        {decidedStamp && <p className="mt-0.5 text-[10px] text-slate-400">{decidedStamp}</p>}
                      </TD>
                      <TD className="sticky end-0 bg-white px-3 text-end">
                        <div
                          className="flex flex-wrap items-center justify-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {pending && canDecide && (
                            <>
                              <Button size="sm" variant="success" onClick={() => onDecide(request, 'approve')}>
                                Approve
                              </Button>
                              <Button size="sm" variant="dangerOutline" onClick={() => onDecide(request, 'reject')}>
                                Reject
                              </Button>
                            </>
                          )}
                          {undoable && (
                            <Button size="sm" variant="outline" onClick={() => onDecide(request, 'undo')}>
                              Undo
                            </Button>
                          )}
                          {!pending && (
                            <Button size="sm" variant="outline" onClick={() => setDetail(request)}>
                              View
                            </Button>
                          )}
                          {archived && (
                            <Button size="sm" variant="outline" onClick={() => onArchive(request, true)}>
                              Restore
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>

            {(inbox.data?.totalPages ?? 0) > 1 && (
              <Pagination
                page={inbox.data!.page}
                pageSize={inbox.data!.pageSize}
                total={inbox.data!.total}
                totalPages={inbox.data!.totalPages}
                onPageChange={setPage}
                noun="requests"
              />
            )}
          </>
        )}
      </Card>

      {!canDecide && (
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Final approve/reject requires <code>requests.approve</code>. You can view requests and BM decisions only.
        </p>
      )}

      {deciding && (
        <RequestDecisionDialog
          request={deciding.request}
          mode={deciding.mode}
          onClose={() => setDeciding(null)}
          onDecided={onDecided}
        />
      )}

      {detail && (
        <RequestDetailDialog
          request={detail}
          canDecide={canDecide}
          onClose={() => setDetail(null)}
          onDecide={(mode) => {
            const request = detail
            setDetail(null)
            setDeciding({ request, mode })
          }}
          onArchive={(restore) => {
            const request = detail
            setDetail(null)
            onArchive(request, restore)
          }}
        />
      )}

      {bulkOpen && (
        <BulkApproveDialog
          pending={pendingForBulk}
          onClose={() => setBulkOpen(false)}
          onApproved={(count, unpaid) =>
            toast(
              unpaid > 0
                ? `All ${count} approved in bulk · ${unpaid} recorded as unpaid`
                : `All ${count} approved in bulk`,
            )
          }
        />
      )}

      {newOpen && (
        <NewRequestDialog
          onClose={() => setNewOpen(false)}
          onCreated={(employee) => toast(`Request created for ${employee}`)}
        />
      )}

      {offboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true" onClick={() => setOffboarding(null)} />
          <div role="dialog" aria-modal="true" aria-label="Resignation approved" className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold text-charcoal-900">Resignation Approved — Start Offboarding?</h2>
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800">
              <strong>{offboarding.employee}</strong>&apos;s resignation has been approved.
              <p className="mt-1 text-[11px] text-brand-700">
                Would you like to initiate the exit &amp; separation checklist (handover, uniform return, settlement) now?
              </p>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setOffboarding(null)}>
                Later
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setOffboarding(null)
                  navigate('/console/terminations')
                }}
              >
                Start Offboarding Checklist →
              </Button>
            </div>
          </div>
        </div>
      )}

      <DashboardToasts toasts={toasts} onDismiss={remove} />
    </div>
  )
}
