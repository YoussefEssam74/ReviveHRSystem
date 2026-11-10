import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, Eye, FileText, Paperclip, X } from 'lucide-react'
import {
  decideRequest,
  decideRequestHr,
  downloadRequestAttachment,
  getHrRequests,
  getOwnLeaveBalance,
  getRequestDetail,
  getRequestInbox,
  type DeskRequestRow,
  type HrRequestItem,
  type RequestDetail,
} from '../api/requests.api'
import { EmptyState } from '../../../components/ui/primitives'
import { Drawer } from '../../../components/ui/drawer'
import { ErrorState, LoadingState, Spinner } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { ApiError, describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateWithYear, formatMoney, formatNumber, formatTime, formatTimeLabel, formatTimeOfDay } from '../../../lib/format'
import { getEmployeeDirectory } from '../api/branch.api'

import { cn } from '../../../lib/utils'

function coverPayText(salary: number | null | undefined, days: number | null | undefined): string | null {
  if (salary == null || salary <= 0 || days == null || days <= 0) return null
  const daily = Math.round((salary / 30) * 100) / 100
  const total = Math.round(daily * days * 100) / 100
  return formatMoney(total)
}

/** Unscheduled Attendance persists its 1/2 cover-day count in the Payment column
 *  (backend legacy: "2 days") — it is not a paid/unpaid outcome, so it must never
 *  render as the raw payment string; the cover-pay amount is shown instead. */
function isCoverDaysPayment(payment: string | null | undefined): boolean {
  return /^\d+\s*days?\s*$/i.test((payment ?? '').trim())
}

/** The four real workflow states behind the mock's tab bar (mock §17). */
type DeskTab = 'Pending' | 'PendingHRReview' | 'Approved' | 'Rejected'

const TABS: { key: DeskTab; label: string; short: string; hint: string }[] = [
  { key: 'Pending', label: 'NEED ACTION', short: 'Action', hint: 'Waiting for your decision' },
  { key: 'PendingHRReview', label: 'PENDING HR', short: 'With HR', hint: 'Approved to HR, awaiting sign-off' },
  { key: 'Approved', label: 'APPROVED', short: 'Approved', hint: 'Signed off end-to-end' },
  { key: 'Rejected', label: 'REJECTED', short: 'Rejected', hint: 'Rejected at the desk or by HR' },
]

const TAB_STYLES: Record<DeskTab, { active: string; badge: string }> = {
  Pending: { active: 'bg-yellow-100 text-yellow-800', badge: 'text-yellow-600' },
  PendingHRReview: { active: 'bg-purple-100 text-purple-800', badge: 'text-purple-600' },
  Approved: { active: 'bg-green-100 text-green-800', badge: 'text-green-600' },
  Rejected: { active: 'bg-red-100 text-red-800', badge: 'text-red-600' },
}

const PAGE_SIZE = 10

export default function TeamRequestsPage() {
  const { isTeamLeader, isBranchManager, me } = usePortalSession()
  const [tab, setTab] = useState<DeskTab>('Pending')
  const [hrTab, setHrTab] = useState<'PendingHRReview' | 'Approved' | 'Rejected'>('PendingHRReview')

  const isManager = isTeamLeader || isBranchManager
  const isHr = (me?.userType === 'HR' || me?.userType === 'TopManagement') && !isManager

  if (!isManager && !isHr) {
    return (
      <EmptyState
        title="Requests desk is for managers and HR"
        hint="Stage-1 decisions run through the team-leader / branch-manager desk; HR gives the final sign-off here."
      />
    )
  }

  if (isHr) {
    return <HrWorkspace tab={hrTab} onTab={setHrTab} />
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

/* ==================== HR final stage (GET /api/requests + POST .../decide) ==================== */

type HrTab = 'PendingHRReview' | 'Approved' | 'Rejected'

const HR_TABS: { key: HrTab; label: string; short: string; hint: string }[] = [
  { key: 'PendingHRReview', label: 'NEED ACTION', short: 'Action', hint: 'Waiting for HR sign-off' },
  { key: 'Approved', label: 'APPROVED', short: 'Approved', hint: 'Signed off end-to-end' },
  { key: 'Rejected', label: 'REJECTED', short: 'Rejected', hint: 'Rejected by HR' },
]

function HrWorkspace({ tab, onTab }: { tab: HrTab; onTab: (tab: HrTab) => void }) {
  return (
    <div className="space-y-3">
      <HrTabBar tab={tab} onTab={onTab} />
      <HrList key={tab} status={tab} />
    </div>
  )
}

function HrTabBar({ tab, onTab }: { tab: HrTab; onTab: (tab: HrTab) => void }) {
  const counts = useQuery({
    queryKey: ['portal', 'hr-requests', 'counts'],
    queryFn: async ({ signal }) => {
      const statuses: HrTab[] = ['PendingHRReview', 'Approved', 'Rejected']
      const results = await Promise.all(
        statuses.map((status) => getHrRequests({ status, page: 1, pageSize: 1, signal }).then((page) => page.total)),
      )
      return Object.fromEntries(statuses.map((status, index) => [status, results[index]])) as Record<HrTab, number>
    },
  })

  const totals = counts.data
  const subtitle = totals
    ? HR_TABS.map((t) => `${(totals[t.key] ?? 0).toLocaleString()} ${t.label.toLowerCase()}`).join(' · ')
    : 'Loading HR inbox…'

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-charcoal-900">HR Requests</h1>
        <p className="mt-0.5 text-xs text-charcoal-500">{subtitle}</p>
      </div>
      <div className="flex gap-1.5 rounded-xl border border-charcoal-200 bg-white p-1.5">
        {HR_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            className={cn(
              'min-w-0 flex-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors',
              tab === t.key ? TAB_STYLES[t.key].active : 'text-charcoal-500 hover:bg-charcoal-50',
            )}
          >
            <span className="block text-[11px] font-semibold">
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </span>
            <span className="mt-0.5 block text-[10px] font-bold">{totals ? totals[t.key] : '—'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function HrList({ status }: { status: HrTab }) {
  const [page, setPage] = useState(1)

  const inboxQuery = useQuery({
    queryKey: ['portal', 'hr-requests', 'inbox', status, page],
    queryFn: ({ signal }) => getHrRequests({ status, page, pageSize: PAGE_SIZE, signal }),
  })

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
            <HrRow key={row.id} row={row} status={status} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={HR_TABS.find((t) => t.key === status)?.hint ?? 'Nothing here'}
          hint="HR rows appear as soon as branch managers approve requests to review."
        />
      )}
      {envelope && envelope.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <p className="text-[10px] text-charcoal-500">
            Page {envelope.page} of {envelope.totalPages} · {envelope.total} total
          </p>
          <Button size="sm" variant="secondary" disabled={page >= envelope.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

/** HR final decision: approve/reject Pending HR Review rows, with the 1/2-day
 *  cover selector for Unscheduled Attendance. Rejection requires a comment. */
function HrRow({ row, status }: { row: HrRequestItem; status: HrTab }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [decision, setDecision] = useState<'Approve' | 'Reject' | null>(null)
  const [calculatedDays, setCalculatedDays] = useState<1 | 2>(1)
  const [comment, setComment] = useState('')

  const salaryQuery = useQuery({
    queryKey: ['portal', 'employee', 'salary', row.employee],
    queryFn: ({ signal }) =>
      getEmployeeDirectory({ search: row.employee, pageSize: 5, signal }),
    enabled: row.type === 'Unscheduled Attendance',
    retry: false,
  })
  const salary =
    salaryQuery.data?.items?.find((item) => item.name === row.employee)?.salary ??
    salaryQuery.data?.items?.[0]?.salary ??
    null

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['portal', 'hr-requests'] })
    void queryClient.invalidateQueries({ queryKey: ['portal', 'desk'] })
    void queryClient.invalidateQueries({ queryKey: ['portal', 'requests'] })
  }

  const decideMutation = useMutation({
    mutationFn: (input: { decision: string; comment: string | null; calculatedDays?: 1 | 2 }) =>
      decideRequestHr(row.id, input.decision, input.comment, input.calculatedDays),
    onSuccess: () => {
      toast(`Request #${row.id} ${decision === 'Approve' ? 'approved' : 'rejected'}.`)
      setDecision(null)
      setComment('')
      invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const coverLabel =
    row.calculatedDays != null ? `Cover: ${row.calculatedDays} day${row.calculatedDays === 1 ? '' : 's'}` : null
  const coverPay = row.type === 'Unscheduled Attendance' ? coverPayText(salary, row.calculatedDays) : null

  return (
    <div
      className="cursor-pointer p-3 transition-colors hover:bg-charcoal-50/50"
      onClick={() => setDetailId(row.id)}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
            {initialsOf(row.employee)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-charcoal-900">{row.employee}</p>
              <StatusBadge status={row.status} />
              {coverLabel && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {coverLabel}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-charcoal-500">
              {row.type} · {rangeLabel(row.requestedDate, row.endDate)} · Submitted {formatDate(row.submittedDate)}
              {row.requestTime ? ` · ${formatTimeOfDay(row.requestTime)}` : ''}
              {row.amount != null ? ` · ${formatMoney(row.amount)}` : ''}
            </p>
            {row.gym && <p className="mt-0.5 text-[10px] text-charcoal-400">Gym · {row.gym}</p>}
            {row.reason && <p className="mt-0.5 line-clamp-2 text-[10px] text-charcoal-400">{formatTimeLabel(row.reason)}</p>}
            {row.payment && !(row.type === 'Unscheduled Attendance' && isCoverDaysPayment(row.payment)) && (
              <p className="mt-0.5 text-[10px] text-charcoal-500">Payment: {row.payment}</p>
            )}
            {coverPay && <p className="mt-0.5 text-[10px] text-charcoal-500">Cover pay: {coverPay}</p>}
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5 sm:flex-shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
          {status === 'PendingHRReview' && (
            <>
              <Button size="sm" onClick={() => setDecision('Approve')}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approve
              </Button>
              <Button size="sm" variant="dangerOutline" onClick={() => setDecision('Reject')}>
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Reject
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={() => setDetailId(row.id)}>
            View
          </Button>
        </div>
      </div>

      {decision && (
        <div onClick={(event) => event.stopPropagation()}>
          <Modal
            open
            title={decision === 'Approve' ? `Approve request #${row.id}` : `Reject request #${row.id}`}
            subtitle={
              decision === 'Approve'
                ? 'Final HR sign-off — the employee is notified.'
                : 'Rejection of an unscheduled day keeps the punch as present with no cover day.'
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
                  disabled={decision === 'Reject' && !comment.trim()}
                  onClick={() =>
                    decideMutation.mutate({
                      decision,
                      comment: decision === 'Reject' ? comment.trim() : comment.trim() || null,
                      calculatedDays:
                        decision === 'Approve' && row.type === 'Unscheduled Attendance'
                          ? calculatedDays
                          : undefined,
                    })
                  }
                >
                  {decision === 'Approve' ? 'Approve' : 'Reject'}
                </Button>
              </>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-charcoal-700">
                {row.employee} — {row.type}
              </p>
              {decision === 'Approve' && row.type === 'Unscheduled Attendance' && (
                <div className="rounded-lg border border-brand-200 bg-brand-50 p-2.5">
                  <label className="form-label" htmlFor={`hr-calculated-days-${row.id}`}>
                    Count this cover/extra day as
                  </label>
                  <select
                    id={`hr-calculated-days-${row.id}`}
                    value={calculatedDays}
                    onChange={(event) => setCalculatedDays(Number(event.target.value) as 1 | 2)}
                    className="form-input mt-1"
                  >
                    <option value={1}>1 day</option>
                    <option value={2}>2 days</option>
                  </select>
                  <p className="mt-1 text-[11px] font-semibold text-charcoal-800">
                    {coverPayText(salary, calculatedDays) ??
                      (salaryQuery.isLoading
                        ? 'Checking salary…'
                        : 'No salary on file — the cover pay cannot be priced yet.')}
                  </p>
                  <p className="mt-1 text-[10px] text-charcoal-500">
                    This is an extra/cover-day value and does not reduce the employee&apos;s monthly day-off balance.
                  </p>
                </div>
              )}
              <div>
                <label className="form-label" htmlFor={`hr-comment-${row.id}`}>
                  {decision === 'Reject' ? 'Reason (required for rejection)' : 'Comment (optional)'}
                </label>
                <textarea
                  id={`hr-comment-${row.id}`}
                  rows={2}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="form-input mt-1"
                />
              </div>
            </div>
          </Modal>
        </div>
      )}

      {detailId != null && (
        <div onClick={(event) => event.stopPropagation()}>
          <HrDetailDrawer requestId={detailId} onClose={() => setDetailId(null)} />
        </div>
      )}
    </div>
  )
}

function HrDetailDrawer({ requestId, onClose }: { requestId: number; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: ['portal', 'hr-requests', 'detail', requestId],
    queryFn: ({ signal }) => getRequestDetail(requestId, signal),
  })
  const detail = detailQuery.data as RequestDetail | undefined
  const salaryQuery = useQuery({
    queryKey: ['portal', 'employee', 'salary', detail?.employee ?? ''],
    queryFn: ({ signal }) =>
      getEmployeeDirectory({ search: detail!.employee, pageSize: 5, signal }),
    enabled: detail != null && detail.type === 'Unscheduled Attendance',
    retry: false,
  })
  const salary =
    salaryQuery.data?.items?.find((item) => item.name === detail?.employee)?.salary ??
    salaryQuery.data?.items?.[0]?.salary ??
    null
  const coverPay = coverPayText(salary, detail?.calculatedDays ?? null)

  if (detailQuery.isLoading) return <Drawer open onClose={onClose} title={`Request #${requestId}`}><LoadingState /></Drawer>
  if (detailQuery.error)
    return (
      <Drawer open onClose={onClose} title={`Request #${requestId}`}>
        <ErrorState message={describeApiError(detailQuery.error)} onRetry={() => detailQuery.refetch()} />
      </Drawer>
    )

  if (!detail) return null

  return (
    <Drawer open onClose={onClose} title={`Request #${detail.id}`}>
      <div className="space-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-charcoal-900">{detail.employee}</p>
            <StatusBadge status={detail.status} />
            {detail.calculatedDays != null && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Cover: {detail.calculatedDays} day{detail.calculatedDays === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-charcoal-500">Gym · {detail.gym}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <Field label="Type" value={detail.type} />
          <Field label="Status" value={detail.status} />
          <Field label="Submitted on" value={formatDateWithYear(detail.submittedDate)} />
          <Field label="Requested for" value={rangeLabel(detail.requestedDate, detail.endDate)} />
          {detail.requestTime && (
            <Field label="Time" value={formatTimeOfDay(detail.requestTime)} />
          )}
          {detail.amount != null && (
            <Field label="Amount" value={formatMoney(detail.amount)} />
          )}
          {coverPay && (
            <div className="col-span-2">
              <Field label="Cover pay" value={coverPay} />
            </div>
          )}
          {detail.payment &&
            !(detail.type === 'Unscheduled Attendance' && isCoverDaysPayment(detail.payment)) && (
              <Field label="Payment" value={detail.payment} />
            )}
          {detail.calculatedDays != null && (
            <Field label="Cover days" value={`${detail.calculatedDays} day${detail.calculatedDays === 1 ? '' : 's'}`} />
          )}
          {detail.bmDecision && <Field label="Desk decision" value={detail.bmDecision} />}
          {detail.bmComment && <Field label="Desk comment" value={detail.bmComment} />}
          {detail.hrDecision && <Field label="HR decision" value={detail.hrDecision} />}
          {detail.hrComment && <Field label="HR comment" value={detail.hrComment} />}
        </dl>
        {detail.hasAttachment && <RequestAttachmentCard requestId={detail.id} type={detail.type} />}
        <div className="rounded-lg bg-charcoal-50 p-3">
          <p className="bento-label text-charcoal-500">Reason</p>
          <p className="mt-1 text-xs text-charcoal-700">{detail.reason ? formatTimeLabel(detail.reason) : 'No reason provided.'}</p>
        </div>
        <div>
          <p className="bento-label mb-1.5 text-charcoal-500">TIMELINE</p>
          <ol className="space-y-1.5">
            {detail.timeline.map((step, index) => (
              <li key={index} className="flex items-center gap-2 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${step.done ? 'bg-brand-500' : 'bg-charcoal-300'}`} />
                <span className={step.done ? 'font-medium text-charcoal-900' : 'text-charcoal-500'}>{step.step}</span>
                {step.date && <span className="text-[10px] text-charcoal-400">{formatTimeLabel(step.date)}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Drawer>
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
            className={cn(
              'min-w-0 flex-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors',
              tab === t.key ? TAB_STYLES[t.key].active : 'text-charcoal-500 hover:bg-charcoal-50',
            )}
          >
            <span className="block text-[11px] font-semibold">
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </span>
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

/** The uploaded file is a medical certificate on sick leave, a generic file elsewhere. */
function attachmentLabel(type: string): string {
  return type.toLowerCase() === 'sick leave' ? 'Medical certificate' : 'Attached document'
}

/** Leave bucket a request type draws from, if any (drives the balance tile). */
function leaveBucketOf(type: string): 'sick' | 'dayOff' | null {
  if (type === 'Sick Leave') return 'sick'
  if (type === 'Annual Leave') return 'dayOff'
  return null
}

/** "1 / 10 days used · 9 left" — the limit the employee has and what this leaves. */
function balanceLabel(
  bucket: { used: number; total: number } | null,
  loading: boolean,
): string {
  if (loading) return 'Loading…'
  if (!bucket) return 'Unavailable'
  const remaining = Math.max(0, bucket.total - bucket.used)
  return `${formatNumber(bucket.used)} / ${formatNumber(bucket.total)} days used · ${formatNumber(remaining)} left`
}

function saveAttachment({ blob, fileName }: { blob: Blob; fileName: string | null }) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName ?? 'request-attachment'
  anchor.click()
  URL.revokeObjectURL(url)
}

/** 404 from the download endpoint means the row says "has attachment" but no file is
 *  stored — a data problem, not a permission or session problem. */
function isMissingDocument(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

function attachmentErrorTitle(error: unknown): string {
  if (isMissingDocument(error)) return 'No document uploaded'
  if (error instanceof ApiError && error.status === 403) return 'Not allowed to open this document'
  return "Couldn't load the document"
}

/** The API's own message plus the status, so a failure is never a dead end. */
function attachmentErrorDetail(error: unknown): string {
  if (isMissingDocument(error)) {
    return 'This request is marked as having an attachment, but no file is stored for it.'
  }
  if (!(error instanceof ApiError)) return describeApiError(error)
  if (error.status === 0) return `${error.message} Check your connection and try again.`
  if (error.status >= 500) return `${error.message} The server failed to return the file — try again in a moment.`
  return `${error.message} (HTTP ${error.status})`
}

/** Attachment card shared by the decision modal and the request drawer. */
function RequestAttachmentCard({ requestId, type }: { requestId: number; type: string }) {
  const { toast } = useToast()
  const [viewerOpen, setViewerOpen] = useState(false)
  const downloadMutation = useMutation({
    mutationFn: () => downloadRequestAttachment(requestId),
    onSuccess: saveAttachment,
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-charcoal-900">{attachmentLabel(type)}</p>
          <p className="text-[10px] text-charcoal-500">Uploaded with this request</p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1 justify-center"
          onClick={() => setViewerOpen(true)}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          View
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1 justify-center"
          loading={downloadMutation.isPending}
          onClick={() => downloadMutation.mutate()}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download
        </Button>
      </div>
      {viewerOpen && <AttachmentViewer requestId={requestId} type={type} onClose={() => setViewerOpen(false)} />}
    </div>
  )
}

/** Full-size, portal-mounted viewer so the drawer/modal can't clip it. */
function AttachmentViewer({
  requestId,
  type,
  onClose,
}: {
  requestId: number
  type: string
  onClose: () => void
}) {
  const attachmentQuery = useQuery({
    queryKey: ['portal', 'desk', 'attachment', requestId],
    queryFn: ({ signal }) => downloadRequestAttachment(requestId, signal),
    staleTime: Infinity,
    retry: false,
  })

  const fileName = attachmentQuery.data?.fileName ?? ''
  const contentType = attachmentQuery.data?.blob.type ?? ''
  const isPdf = contentType === 'application/pdf' || /\.pdf$/i.test(fileName)
  const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fileName)
  const blob = attachmentQuery.data?.blob ?? null
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!attachmentQuery.data) return
    const url = URL.createObjectURL(attachmentQuery.data.blob)
    // Blob URLs are an external resource: create on mount, revoke on cleanup.
    // oxlint-disable-next-line react/set-state-in-effect
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [attachmentQuery.data])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${attachmentLabel(type)} full view`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-charcoal-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-charcoal-900">{attachmentLabel(type)}</h2>
            {fileName && <p className="truncate text-[10px] text-charcoal-500">{fileName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document"
            className="rounded-lg p-1.5 text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-charcoal-100/50 p-2 sm:p-4">
          {attachmentQuery.isLoading && (
            <div role="status" className="flex flex-col items-center justify-center gap-3 py-24 text-charcoal-500">
              <Spinner className="h-8 w-8" />
              <p className="text-sm">Loading document…</p>
            </div>
          )}
          {attachmentQuery.error && (
            <div role="alert" className="mx-auto my-12 max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm font-semibold text-red-800">{attachmentErrorTitle(attachmentQuery.error)}</p>
              <p className="mt-1 text-xs text-red-700">{attachmentErrorDetail(attachmentQuery.error)}</p>
              {!isMissingDocument(attachmentQuery.error) && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => attachmentQuery.refetch()}>
                  Try again
                </Button>
              )}
            </div>
          )}
          {previewUrl && isPdf && (
            <iframe
              src={previewUrl}
              title={`${attachmentLabel(type)} full view`}
              className="h-[72vh] w-full rounded border border-charcoal-200 bg-white"
            />
          )}
          {previewUrl && isImage && (
            <img
              src={previewUrl}
              alt={`${attachmentLabel(type)} full view`}
              className="mx-auto max-h-[72vh] w-auto max-w-full rounded"
            />
          )}
          {attachmentQuery.data && !isPdf && !isImage && (
            <div className="mx-auto my-12 max-w-md rounded-2xl border border-charcoal-200 bg-white p-6 text-center">
              <FileText className="mx-auto h-10 w-10 text-charcoal-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-charcoal-900">Preview not available</p>
              <p className="mt-1 text-xs text-charcoal-500">
                This file type can&apos;t be displayed in the browser. Download it to open it.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-charcoal-100 px-4 py-3">
          <Button
            size="sm"
            variant="secondary"
            disabled={!blob}
            onClick={() => blob && saveAttachment({ blob, fileName: fileName || null })}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download
          </Button>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
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

/** The real stage-1 rule set: decide only Pending rows and view everything. */
function DeskRow({ row, status }: { row: DeskRequestRow; status: DeskTab }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can, me } = usePortalSession()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [decision, setDecision] = useState<'Approve' | 'Reject' | null>(null)
  const [hrDecision, setHrDecision] = useState<'Approve' | 'Reject' | null>(null)
  const [calculatedDays, setCalculatedDays] = useState<1 | 2>(1)
  const [hrComment, setHrComment] = useState('')

  const canHrDecide = can('requests.approve')

  const salaryQuery = useQuery({
    queryKey: ['portal', 'employee', 'salary', row.employeeName],
    queryFn: ({ signal }) =>
      getEmployeeDirectory({ search: row.employeeName, pageSize: 5, signal }),
    enabled: row.type === 'Unscheduled Attendance',
    retry: false,
  })
  const salary =
    salaryQuery.data?.items?.find((item) => item.name === row.employeeName)?.salary ??
    salaryQuery.data?.items?.[0]?.salary ??
    null

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['portal', 'desk'] })
    void queryClient.invalidateQueries({ queryKey: ['portal', 'requests'] })
  }

  const decideMutation = useMutation({
    mutationFn: (input: { decision: string; comment: string | null; calculatedDays?: 1 | 2 }) =>
      decideRequest(row.id, input.decision, input.comment, input.calculatedDays),
    onSuccess: () => {
      toast(`Request #${row.id} ${status === 'Pending' && decision === 'Approve' ? 'approved to HR review' : 'rejected'}.`)
      setDecision(null)
      invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const hrDecideMutation = useMutation({
    mutationFn: (input: { decision: string; comment: string | null; calculatedDays?: 1 | 2 }) =>
      decideRequestHr(row.id, input.decision, input.comment, input.calculatedDays),
    onSuccess: () => {
      toast(`Request #${row.id} ${hrDecision === 'Approve' ? 'approved' : 'rejected'}.`)
      setHrDecision(null)
      setHrComment('')
      invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const rejectionNote = row.timeline.filter((step) => step.step.toLowerCase().includes('rejected')).pop()
  const coverLabel =
    row.calculatedDays != null ? `Cover: ${row.calculatedDays} day${row.calculatedDays === 1 ? '' : 's'}` : null
  const coverPay = row.type === 'Unscheduled Attendance' ? coverPayText(salary, row.calculatedDays) : null

  return (
    <div
      className="cursor-pointer p-3 transition-colors hover:bg-charcoal-50/50"
      onClick={() => setDetailId(row.id)}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
            {initialsOf(row.employeeName)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-charcoal-900">{row.employeeName}</p>
              <StatusBadge status={row.status} />
              {coverLabel && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {coverLabel}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-charcoal-500">
              {row.type} · {rangeLabel(row.requestedDate, row.endDate)} · Submitted {formatDate(row.submittedDate)}
              {row.requestTime ? ` · ${formatTimeOfDay(row.requestTime)}` : ''}
              {row.amount != null ? ` · ${formatMoney(row.amount)}` : ''}
            </p>
            {row.reason && <p className="mt-0.5 line-clamp-2 text-[10px] text-charcoal-400">{formatTimeLabel(row.reason)}</p>}
            {row.hasAttachment && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {attachmentLabel(row.type)}
              </span>
            )}
            {rejectionNote && (
              <p className="mt-0.5 text-[10px] text-red-500">
                {rejectionNote.step}
                {rejectionNote.date ? ` · ${rejectionNote.date}` : ''}
              </p>
            )}
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5 sm:flex-shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
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
          {status === 'PendingHRReview' && canHrDecide && (
            <>
              <Button size="sm" onClick={() => setHrDecision('Approve')}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> HR Approve
              </Button>
              <Button size="sm" variant="dangerOutline" onClick={() => setHrDecision('Reject')}>
                <X className="h-3.5 w-3.5" aria-hidden="true" /> HR Reject
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={() => setDetailId(row.id)}>
            View
          </Button>
        </div>
      </div>

      {decision && (
        <div onClick={(event) => event.stopPropagation()}>
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
                  onClick={() =>
                    decideMutation.mutate({
                      decision,
                      comment: null,
                      calculatedDays:
                        decision === 'Approve' && row.type === 'Unscheduled Attendance'
                          ? calculatedDays
                          : undefined,
                    })
                  }
                >
                  {decision === 'Approve' ? 'Approve' : 'Reject'}
                </Button>
              </>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-charcoal-700">
                {row.employeeName} — {row.type}
                {me?.activeGym?.gymName ? ` · Gym: ${me.activeGym.gymName}` : ''}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-charcoal-50 p-2.5">
                  <p className="bento-label text-charcoal-500">Date</p>
                  <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                    {row.requestedDate
                      ? rangeLabel(row.requestedDate, row.endDate)
                      : `${formatDate(row.submittedDate)} (submitted)`}
                  </p>
                </div>
                <div className="rounded-lg bg-charcoal-50 p-2.5">
                  <p className="bento-label text-charcoal-500">
                    {row.requestTime ? 'Time' : 'Submitted at'}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                    {row.requestTime
                      ? formatTimeOfDay(row.requestTime)
                      : row.submittedAt
                        ? formatTime(row.submittedAt)
                        : '—'}
                  </p>
                </div>
                {row.calculatedDays != null && (
                  <div className="rounded-lg bg-charcoal-50 p-2.5">
                    <p className="bento-label text-charcoal-500">Cover days</p>
                    <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                      {row.calculatedDays} day{row.calculatedDays === 1 ? '' : 's'}
                    </p>
                  </div>
                )}
                {row.amount != null && (
                  <div className="rounded-lg bg-charcoal-50 p-2.5">
                    <p className="bento-label text-charcoal-500">Amount</p>
                    <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                      {formatMoney(row.amount)}
                    </p>
                  </div>
                )}
                {row.payment &&
                  !(row.type === 'Unscheduled Attendance' && isCoverDaysPayment(row.payment)) && (
                    <div className="rounded-lg bg-charcoal-50 p-2.5">
                      <p className="bento-label text-charcoal-500">Payment</p>
                      <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{row.payment}</p>
                    </div>
                  )}
                {coverPay && (
                  <div className="rounded-lg bg-charcoal-50 p-2.5">
                    <p className="bento-label text-charcoal-500">Cover pay</p>
                    <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{coverPay}</p>
                  </div>
                )}
              </div>
              {row.reason && (
                <div className="rounded-lg bg-charcoal-50 p-2.5">
                  <p className="bento-label text-charcoal-500">Reason</p>
                  <p className="mt-0.5 text-xs text-charcoal-700">{formatTimeLabel(row.reason)}</p>
                </div>
              )}
              {decision === 'Approve' && row.type === 'Unscheduled Attendance' && (
                <div className="rounded-lg border border-brand-200 bg-brand-50 p-2.5">
                  <label className="form-label" htmlFor={`calculated-days-${row.id}`}>
                    Count this cover/extra day as
                  </label>
                  <select
                    id={`calculated-days-${row.id}`}
                    value={calculatedDays}
                    onChange={(event) => setCalculatedDays(Number(event.target.value) as 1 | 2)}
                    className="form-input mt-1"
                  >
                    <option value={1}>1 day</option>
                    <option value={2}>2 days</option>
                  </select>
                  <p className="mt-1 text-[11px] font-semibold text-charcoal-800">
                    {coverPayText(salary, calculatedDays) ??
                      (salaryQuery.isLoading
                        ? 'Checking salary…'
                        : 'No salary on file — the cover pay cannot be priced yet.')}
                  </p>
                  <p className="mt-1 text-[10px] text-charcoal-500">
                    This is an extra/cover-day value and does not reduce the employee&apos;s monthly day-off balance.
                  </p>
                </div>
              )}
              {row.hasAttachment && <RequestAttachmentCard requestId={row.id} type={row.type} />}
            </div>
          </Modal>
        </div>
      )}

      {hrDecision && (
        <div onClick={(event) => event.stopPropagation()}>
          <Modal
            open
            title={hrDecision === 'Approve' ? `HR approve request #${row.id}` : `HR reject request #${row.id}`}
            subtitle={
              hrDecision === 'Approve'
                ? 'Final HR sign-off — the employee is notified.'
                : 'Rejection keeps the punch as present with no cover day.'
            }
            onClose={() => setHrDecision(null)}
            footer={
              <>
                <Button size="sm" variant="secondary" onClick={() => setHrDecision(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant={hrDecision === 'Reject' ? 'danger' : 'primary'}
                  loading={hrDecideMutation.isPending}
                  disabled={hrDecision === 'Reject' && !hrComment.trim()}
                  onClick={() =>
                    hrDecideMutation.mutate({
                      decision: hrDecision,
                      comment: hrComment.trim() || null,
                      calculatedDays:
                        hrDecision === 'Approve' && row.type === 'Unscheduled Attendance'
                          ? calculatedDays
                          : undefined,
                    })
                  }
                >
                  {hrDecision === 'Approve' ? 'Approve' : 'Reject'}
                </Button>
              </>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-charcoal-700">
                {row.employeeName} — {row.type}
              </p>
              {hrDecision === 'Approve' && row.type === 'Unscheduled Attendance' && (
                <div className="rounded-lg border border-brand-200 bg-brand-50 p-2.5">
                  <label className="form-label" htmlFor={`hr-calculated-days-${row.id}`}>
                    Count this cover/extra day as
                  </label>
                  <select
                    id={`hr-calculated-days-${row.id}`}
                    value={calculatedDays}
                    onChange={(event) => setCalculatedDays(Number(event.target.value) as 1 | 2)}
                    className="form-input mt-1"
                  >
                    <option value={1}>1 day</option>
                    <option value={2}>2 days</option>
                  </select>
                  <p className="mt-1 text-[11px] font-semibold text-charcoal-800">
                    {coverPayText(salary, calculatedDays) ??
                      (salaryQuery.isLoading
                        ? 'Checking salary…'
                        : 'No salary on file — the cover pay cannot be priced yet.')}
                  </p>
                  <p className="mt-1 text-[10px] text-charcoal-500">
                    This is an extra/cover-day value and does not reduce the employee&apos;s monthly day-off balance.
                  </p>
                </div>
              )}
              <div>
                <label className="form-label" htmlFor={`hr-comment-${row.id}`}>
                  {hrDecision === 'Reject' ? 'Reason (required for rejection)' : 'Comment (optional)'}
                </label>
                <textarea
                  id={`hr-comment-${row.id}`}
                  rows={2}
                  value={hrComment}
                  onChange={(event) => setHrComment(event.target.value)}
                  className="form-input mt-1"
                />
              </div>
            </div>
          </Modal>
        </div>
      )}

      {detailId != null && (
        <div onClick={(event) => event.stopPropagation()}>
          <RequestDetailDrawer
            requestId={detailId}
            employeeId={row.employeeId}
            onClose={() => setDetailId(null)}
          />
        </div>
      )}
    </div>
  )
}


function RequestDetailDrawer({
  requestId,
  employeeId,
  onClose,
}: {
  requestId: number
  /** Target employee of the request — drives the leave-balance tile. */
  employeeId: number
  onClose: () => void
}) {
  const detailQuery = useQuery({
    queryKey: ['portal', 'desk', 'detail', requestId],
    queryFn: ({ signal }) => getRequestDetail(requestId, signal),
  })
  const detail = detailQuery.data as RequestDetail | undefined
  const balanceQuery = useQuery({
    queryKey: ['portal', 'desk', 'leave-balance', employeeId],
    queryFn: ({ signal }) => getOwnLeaveBalance(employeeId, signal),
    enabled: employeeId > 0 && detail != null && leaveBucketOf(detail.type) != null,
    retry: false,
  })
  const leaveBucket = detail ? leaveBucketOf(detail.type) : null
  const salaryQuery = useQuery({
    queryKey: ['portal', 'employee', 'salary', detail?.employee ?? ''],
    queryFn: ({ signal }) =>
      getEmployeeDirectory({ search: detail!.employee, pageSize: 5, signal }),
    enabled: detail != null && detail.type === 'Unscheduled Attendance',
    retry: false,
  })
  const salary =
    salaryQuery.data?.items?.find((item) => item.name === detail?.employee)?.salary ??
    salaryQuery.data?.items?.[0]?.salary ??
    null
  const coverPay = coverPayText(salary, detail?.calculatedDays ?? null)

  if (detailQuery.isLoading) return <Drawer open onClose={onClose} title={`Request #${requestId}`}>
    <LoadingState />
  </Drawer>
  if (detailQuery.error)
    return (
      <Drawer open onClose={onClose} title={`Request #${requestId}`}>
        <ErrorState message={describeApiError(detailQuery.error)} onRetry={() => detailQuery.refetch()} />
      </Drawer>
    )

  if (!detail) return null

  return (
    <Drawer open onClose={onClose} title={`Request #${detail.id}`}>
      <div className="space-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-charcoal-900">{detail.employee}</p>
            <StatusBadge status={detail.status} />
            {detail.calculatedDays != null && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Cover: {detail.calculatedDays} day{detail.calculatedDays === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-charcoal-500">Gym · {detail.gym}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <Field label="Type" value={detail.type} />
          <Field label="Status" value={detail.status} />
          <Field label="Submitted on" value={formatDateWithYear(detail.submittedDate)} />
          <Field label="Requested for" value={rangeLabel(detail.requestedDate, detail.endDate)} />
          {leaveBucket && (
            <div className="col-span-2">
              <Field
                label={leaveBucket === 'sick' ? 'Sick leave limit' : 'Annual leave limit'}
                value={balanceLabel(balanceQuery.data?.[leaveBucket] ?? null, balanceQuery.isLoading)}
              />
            </div>
          )}
          {detail.requestTime && (
            <Field label="Time" value={formatTimeOfDay(detail.requestTime)} />
          )}
          {detail.amount != null && (
            <Field label="Amount" value={formatMoney(detail.amount)} />
          )}
          {coverPay && (
            <div className="col-span-2">
              <Field label="Cover pay" value={coverPay} />
            </div>
          )}
          {detail.payment &&
            !(detail.type === 'Unscheduled Attendance' && isCoverDaysPayment(detail.payment)) && (
              <Field label="Payment" value={detail.payment} />
            )}
          {detail.calculatedDays != null && (
            <Field label="Cover days" value={`${detail.calculatedDays} day${detail.calculatedDays === 1 ? '' : 's'}`} />
          )}
          {detail.bmDecision && <Field label="Desk decision" value={detail.bmDecision} />}
          {detail.bmComment && <Field label="Desk comment" value={detail.bmComment} />}
          {detail.hrDecision && <Field label="HR decision" value={detail.hrDecision} />}
          {detail.hrComment && <Field label="HR comment" value={detail.hrComment} />}
        </dl>
        {detail.hasAttachment && <RequestAttachmentCard requestId={detail.id} type={detail.type} />}
        <div className="rounded-lg bg-charcoal-50 p-3">
          <p className="bento-label text-charcoal-500">Reason</p>
          <p className="mt-1 text-xs text-charcoal-700">{detail.reason ? formatTimeLabel(detail.reason) : 'No reason provided.'}</p>
        </div>
        <div>
          <p className="bento-label mb-1.5 text-charcoal-500">TIMELINE</p>
          <ol className="space-y-1.5">
            {detail.timeline.map((step, index) => (
              <li key={index} className="flex items-center gap-2 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${step.done ? 'bg-brand-500' : 'bg-charcoal-300'}`} />
                <span className={step.done ? 'font-medium text-charcoal-900' : 'text-charcoal-500'}>{step.step}</span>
                {step.date && <span className="text-[10px] text-charcoal-400">{formatTimeLabel(step.date)}</span>}
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
