import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { Pagination } from '../../../components/ui/pagination'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { EDIT, VIEW } from '../../../lib/permissions'
import { cn } from '../../../lib/utils'
import { useBonuses, useDeductions, useWarnings } from '../../branch-queue/hooks/useBranchQueue'
import { useMockToast } from '../../dashboard/hooks/useMockToast'
import { DashboardToasts } from '../../dashboard/components/DashboardToasts'
import type { RequestDecisionResult, RequestListItem } from '../api/requests.api'
import { useArchiveRequest, useRequestInbox, useRequestSummary } from '../hooks/useRequests'
import { currentMonthShort, requestTypeLabel } from '../lib/request-status'
import { RequestCard } from '../components/RequestCard'
import { RequestDecisionDialog, type DecisionMode } from '../components/RequestDecisionDialog'
import { RequestDetailDialog } from '../components/RequestDetailDialog'
import { BulkApproveDialog } from '../components/BulkApproveDialog'
import { NewRequestDialog } from '../components/NewRequestDialog'
import { BranchSubmissionCard, type BranchSubmission, type BranchKind } from '../components/BranchSubmissionCard'

type InboxTab = 'pending' | 'decided' | 'archived'
type QuickFilter = 'urgent' | 'approved' | 'bmRejected' | 'balance'

const BRANCH_KINDS: BranchKind[] = ['Deduction', 'Warning', 'Bonus']

const QUICK_LABELS: Record<QuickFilter, string> = {
  urgent: 'Urgent',
  approved: 'Approved',
  bmRejected: 'BM Rejected',
  balance: 'Balance alerts',
}

const TABS: { value: InboxTab; label: string }[] = [
  { value: 'pending', label: 'Pending HR' },
  { value: 'decided', label: 'Decided' },
  { value: 'archived', label: 'Archived' },
]

interface KpiTileProps {
  active: boolean
  value: string | number
  suffix?: string
  label: string
  tone?: string
  accent?: string
  onClick: () => void
}

/** One clickable KPI tile of the four above the inbox. */
function KpiTile({ active, value, suffix, label, tone, accent, onClick }: KpiTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to filter this list"
      className={cn(
        'rounded-xl border border-charcoal-200 px-2 py-1 text-center transition hover:bg-charcoal-50',
        accent,
        active ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white',
      )}
    >
      <p className={cn('text-sm font-bold leading-none', tone ?? 'text-charcoal-900')}>
        {value}
        {suffix && <span className="text-[10px] font-normal text-charcoal-400">{suffix}</span>}
      </p>
      <p className="mt-1 text-[9px] leading-none text-charcoal-500">{label}</p>
    </button>
  )
}

/** HR requests inbox (mock pages-requests.js): KPI tiles, type pills, tabs, decision flow. */
export default function RequestsPage() {
  const navigate = useNavigate()
  const { can, me } = useMe()
  const canView = can('requests', VIEW)
  const canDecide = can('requests', EDIT)
  const canDecideDeduction = can('payroll', EDIT)
  const { toasts, toast, remove } = useMockToast()

  const [tab, setTab] = useState<InboxTab>('pending')
  const [type, setType] = useState<string>('all')
  const [quick, setQuick] = useState<QuickFilter | null>(null)
  const [page, setPage] = useState(1)

  const [deciding, setDeciding] = useState<{ request: RequestListItem; mode: DecisionMode } | null>(null)
  const [detail, setDetail] = useState<RequestListItem | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [offboarding, setOffboarding] = useState<{ employee: string } | null>(null)
  const [monthShort] = useState(currentMonthShort)

  const gymId = me?.activeGym?.gymId
  const isBranchKind = (BRANCH_KINDS as string[]).includes(type)

  const summary = useRequestSummary(gymId, canView)

  const inbox = useRequestInbox(
    {
      status: quick ? undefined : tab === 'pending' ? 'Pending HR Review' : tab === 'decided' ? 'Decided' : 'Archived',
      type: type !== 'all' && !isBranchKind ? type : undefined,
      quick: quick ?? undefined,
      gym: gymId,
      page,
      pageSize: 20,
    },
    canView && !isBranchKind,
  )

  // The pending set behind Bulk Approve and the balance warnings.
  const pendingAll = useRequestInbox({ status: 'Pending HR Review', gym: gymId, pageSize: 100 }, canView)

  const warnings = useWarnings({ status: 'Pending', pageSize: 100 }, canView)
  const bonuses = useBonuses({ status: 'Pending', pageSize: 100 }, canView)
  const deductions = useDeductions({ status: 'Pending', pageSize: 100 }, canView)
  const archive = useArchiveRequest()

  const branchItems = useMemo<BranchSubmission[]>(() => {
    const list: BranchSubmission[] = []
    for (const item of deductions.data?.items ?? []) {
      list.push({
        id: item.id,
        kind: 'Deduction',
        employee: item.employeeName,
        title: item.label,
        amount: item.amount,
        issuedBy: 'Branch Manager',
        gym: item.gym,
        date: item.date,
        status: item.status,
      })
    }
    for (const item of warnings.data?.items ?? []) {
      list.push({
        id: item.id,
        kind: 'Warning',
        employee: item.employee,
        title: item.reason,
        amount: null,
        issuedBy: item.issuedBy,
        gym: null,
        date: item.issuedAt,
        status: item.status,
      })
    }
    for (const item of bonuses.data?.items ?? []) {
      list.push({
        id: item.id,
        kind: 'Bonus',
        employee: item.employee,
        title: item.reason,
        amount: item.amount,
        issuedBy: item.issuedBy,
        gym: null,
        date: item.issuedAt,
        status: item.status,
      })
    }
    return list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [deductions.data, warnings.data, bonuses.data])

  const branchCounts = useMemo(() => {
    const counts: Record<BranchKind, number> = { Deduction: 0, Warning: 0, Bonus: 0 }
    for (const item of branchItems) counts[item.kind]++
    return counts
  }, [branchItems])

  const typePills = useMemo(() => {
    const pills: { value: string; label: string; count: number }[] = [
      { value: 'all', label: 'All', count: (summary.data?.total ?? 0) + branchItems.length },
    ]
    for (const entry of summary.data?.byType ?? []) {
      if (entry.count > 0) {
        pills.push({ value: entry.type, label: requestTypeLabel(entry.type), count: entry.count })
      }
    }
    const branchLabels: Record<BranchKind, string> = { Deduction: 'Deductions', Warning: 'Warnings', Bonus: 'Bonuses' }
    for (const kind of BRANCH_KINDS) {
      if (branchCounts[kind] > 0) {
        pills.push({ value: kind, label: branchLabels[kind], count: branchCounts[kind] })
      }
    }
    return pills
  }, [summary.data, branchItems.length, branchCounts])

  const resetTo = (next: { tab?: InboxTab; type?: string; quick?: QuickFilter | null }) => {
    if (next.tab) setTab(next.tab)
    if (next.type !== undefined) setType(next.type)
    if (next.quick !== undefined) setQuick(next.quick)
    setPage(1)
  }

  const toggleQuick = (key: QuickFilter) => {
    setQuick((current) => (current === key ? null : key))
    setPage(1)
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
  const error = inbox.error

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-base font-bold text-charcoal-900">Requests</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            Day off, sick leave &amp; approvals — BM &amp; HR flow, HR picks paid/unpaid
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New Request
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <KpiTile
          active={quick === 'urgent'}
          value={summary.data?.urgent ?? 0}
          suffix={`/${summary.data?.pending ?? 0}`}
          label="Urgent — Pending HR"
          tone="text-red-600"
          accent="border-l-4 border-l-red-500"
          onClick={() => toggleQuick('urgent')}
        />
        <KpiTile
          active={quick === 'approved'}
          value={summary.data?.approvedThisMonth ?? 0}
          label={`Approved (${monthShort})`}
          tone="text-brand-600"
          onClick={() => toggleQuick('approved')}
        />
        <KpiTile
          active={quick === 'bmRejected'}
          value={summary.data?.bmRejected ?? 0}
          label="BM Rejected"
          onClick={() => toggleQuick('bmRejected')}
        />
        <KpiTile
          active={quick === 'balance'}
          value={summary.data?.balanceAlerts ?? 0}
          label="Balance Alerts"
          tone={(summary.data?.balanceAlerts ?? 0) > 0 ? 'text-red-600' : 'text-charcoal-900'}
          accent={(summary.data?.balanceAlerts ?? 0) > 0 ? 'border-l-4 border-l-red-500' : ''}
          onClick={() => toggleQuick('balance')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-charcoal-100 p-0.5">
        {typePills.map((pill) => (
          <button
            key={pill.value}
            type="button"
            title={`Filter: ${pill.label}`}
            onClick={() => resetTo({ type: pill.value })}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-all',
              type === pill.value
                ? 'bg-white font-bold text-charcoal-900 shadow-sm'
                : 'text-charcoal-500 hover:text-charcoal-700',
            )}
          >
            {pill.label}
            {pill.count > 0 && (
              <span className={cn('badge ml-1 text-[9px]', type === pill.value ? 'badge-brand' : 'badge-gray')}>
                {pill.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {!isBranchKind && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-charcoal-100 p-0.5">
            {TABS.map((entry) => {
              const count =
                entry.value === 'pending'
                  ? summary.data?.pending
                  : entry.value === 'decided'
                    ? summary.data?.decided
                    : summary.data?.archived
              const active = !quick && tab === entry.value
              return (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => resetTo({ tab: entry.value, quick: null })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-[10px] font-medium transition-all',
                    active ? 'bg-white text-charcoal-900 shadow-sm' : 'text-charcoal-500',
                  )}
                >
                  {entry.label}
                  {count ? (
                    <span
                      className={cn(
                        'badge ml-1 text-[9px]',
                        entry.value === 'pending' ? 'badge-red' : 'badge-gray',
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                  {entry.value === 'pending' && (summary.data?.awaitingManager ?? 0) > 0 && (
                    <span className="ml-1 text-[9px] font-normal text-amber-600">
                      {summary.data!.awaitingManager} w/o manager
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {quick && (
              <button
                type="button"
                onClick={() => setQuick(null)}
                title="Click to clear the filter"
                className="badge badge-blue cursor-pointer text-[9px] hover:opacity-75"
              >
                {QUICK_LABELS[quick]} ✕
              </button>
            )}
            {canDecide && !quick && tab === 'pending' && pendingForBulk.length > 0 && (
              <Button size="sm" onClick={() => setBulkOpen(true)}>
                Bulk Approve
              </Button>
            )}
          </div>
        </div>
      )}

      {isBranchKind ? (
        <div className="space-y-1.5">
          {branchItems.filter((item) => item.kind === type).length === 0 ? (
            <div className="rounded-xl border border-charcoal-200 bg-white p-4 text-center text-xs text-charcoal-500">
              No {type.toLowerCase()} submissions yet.
            </div>
          ) : (
            branchItems
              .filter((item) => item.kind === type)
              .map((item) => (
                <BranchSubmissionCard
                  key={`${item.kind}-${item.id}`}
                  submission={item}
                  canDecide={canDecide}
                  canDecideDeduction={canDecideDeduction}
                  onError={(message) => toast(message, 'error')}
                />
              ))
          )}
        </div>
      ) : inbox.isLoading ? (
        <LoadingState label="Loading requests…" />
      ) : error ? (
        <ErrorState message={describeApiError(error)} />
      ) : items.length === 0 && branchItems.length === 0 ? (
        <EmptyState icon={FileText} title="No requests here" message="Nothing matches this tab and filter." />
      ) : (
        <div className="space-y-1.5">
          {items.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              canDecide={canDecide}
              onDecide={onDecide}
              onDetail={setDetail}
              onArchive={onArchive}
            />
          ))}

          {type === 'all' &&
            !quick &&
            branchItems.map((item) => (
              <BranchSubmissionCard
                key={`${item.kind}-${item.id}`}
                submission={item}
                canDecide={canDecide}
                canDecideDeduction={canDecideDeduction}
                onError={(message) => toast(message, 'error')}
              />
            ))}
        </div>
      )}

      {!isBranchKind && (inbox.data?.totalPages ?? 0) > 1 && (
        <Pagination
          page={inbox.data!.page}
          pageSize={inbox.data!.pageSize}
          total={inbox.data!.total}
          totalPages={inbox.data!.totalPages}
          onPageChange={setPage}
          noun="requests"
        />
      )}

      {!canDecide && (
        <p className="text-center text-[10px] text-charcoal-400">
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
