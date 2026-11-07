import { useState } from 'react'
import { Check, ClipboardList, Wallet, X } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Select } from '../../../components/ui/select'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Tabs } from '../../../components/ui/tabs'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import SettlementSheet from '../components/SettlementSheet'
import { useDeductionCandidates, usePayrollPeriods, useReviewCandidate } from '../hooks/usePayroll'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { EDIT, VIEW } from '../../../lib/permissions'
import { formatDate, formatMoney } from '../../../lib/format'
import type { DeductionCandidate } from '../api/payroll.api'

type PayrollTab = 'periods' | 'candidates'

const TABS: { value: PayrollTab; label: string }[] = [
  { value: 'periods', label: 'Periods' },
  { value: 'candidates', label: 'Pending Deductions' },
]

const PERIOD_STATUSES = ['', 'Open', 'Partially Published', 'Published', 'Paid']
const CANDIDATE_STATUSES = ['Pending', 'Accepted', 'Approved', 'Rejected', '']

/** Payroll console: period settlement sheets + the pending-deductions review queue. */
export default function PayrollPage() {
  const { can, me } = useMe()
  const canView = can('payroll', VIEW)
  const canEdit = can('payroll', EDIT)

  const [tab, setTab] = useState<PayrollTab>('periods')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [openPeriodId, setOpenPeriodId] = useState<number | null>(null)

  const [candidateStatus, setCandidateStatus] = useState('Pending')
  const [candidatePage, setCandidatePage] = useState(1)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const periods = usePayrollPeriods({ status: status || undefined, page, pageSize: 20 }, canView)
  const candidates = useDeductionCandidates(
    { status: candidateStatus || undefined, page: candidatePage, pageSize: 20 },
    canView,
  )
  const review = useReviewCandidate()

  const onReview = async (id: number, decision: 'Accepted' | 'Rejected') => {
    setReviewError(null)
    try {
      await review.mutateAsync({ id, decision })
    } catch (err) {
      setReviewError(describeApiError(err))
    }
  }

  const description = me?.activeGym
    ? `Settlement sheets and deductions for ${me.activeGym.gymName}`
    : 'Payroll periods, settlement sheets and deduction reviews'

  if (!canView) {
    return (
      <div>
        <PageHeader title="Payroll" description={description} />
        <Card>
          <EmptyState
            icon={Wallet}
            title="No payroll access"
            message="You don't have permission to view payroll for this gym. Ask an administrator for the payroll feature."
          />
        </Card>
      </div>
    )
  }

  if (openPeriodId != null) {
    return (
      <div>
        <PageHeader title="Payroll" description={description} />
        <SettlementSheet periodId={openPeriodId} canEdit={canEdit} onBack={() => setOpenPeriodId(null)} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Payroll" description={description} />

      <Tabs items={TABS} value={tab} onChange={setTab} className="mb-4 w-fit" />

      {tab === 'periods' ? (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="sm:w-56"
              aria-label="Filter by status"
            >
              {PERIOD_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option || 'All statuses'}
                </option>
              ))}
            </Select>
          </div>

          {periods.isLoading ? (
            <LoadingState label="Loading payroll periods…" />
          ) : periods.error ? (
            <ErrorState message={describeApiError(periods.error)} />
          ) : (periods.data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payroll periods"
              message="No settlement periods match this filter for your gyms."
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {periods.data!.items.map((period) => (
                  <li
                    key={period.id}
                    className="flex flex-col gap-3 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{period.period}</p>
                        <StatusBadge status={period.status} />
                        {period.locked && <Badge>Locked</Badge>}
                        {period.publishedGyms.length > 0 && (
                          <Badge>{period.publishedGyms.join(', ')}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">{period.totalEmployees} employees</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Gross {formatMoney(period.totalGross)} · Deductions {formatMoney(period.totalDeductions)} · Net{' '}
                        {formatMoney(period.totalNet)}
                      </p>
                      {period.paidDate && (
                        <p className="mt-0.5 text-xs text-slate-400">Paid {formatDate(period.paidDate)}</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setOpenPeriodId(period.id)}>
                      Open sheet
                    </Button>
                  </li>
                ))}
              </ul>
              <Pagination
                page={periods.data!.page}
                pageSize={periods.data!.pageSize}
                total={periods.data!.total}
                totalPages={periods.data!.totalPages}
                onPageChange={setPage}
                noun="periods"
              />
            </>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <Select
              value={candidateStatus}
              onChange={(e) => {
                setCandidateStatus(e.target.value)
                setCandidatePage(1)
                setReviewError(null)
              }}
              className="sm:w-56"
              aria-label="Filter lines by status"
            >
              {CANDIDATE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option || 'All statuses'}
                </option>
              ))}
            </Select>
          </div>

          {candidates.isLoading ? (
            <LoadingState label="Loading deduction lines…" />
          ) : candidates.error ? (
            <ErrorState message={describeApiError(candidates.error)} />
          ) : (candidates.data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No deduction lines"
              message="There are no deduction lines in this view."
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {candidates.data!.items.map((line) => (
                  <CandidateRow
                    key={line.id}
                    line={line}
                    canReview={canEdit && line.status === 'Pending'}
                    reviewing={review.isPending && review.variables?.id === line.id}
                    onAccept={() => onReview(line.id, 'Accepted')}
                    onWaive={() => onReview(line.id, 'Rejected')}
                  />
                ))}
              </ul>
              {reviewError && (
                <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {reviewError}
                </p>
              )}
              <Pagination
                page={candidates.data!.page}
                pageSize={candidates.data!.pageSize}
                total={candidates.data!.total}
                totalPages={candidates.data!.totalPages}
                onPageChange={setCandidatePage}
                noun="lines"
              />
            </>
          )}
        </Card>
      )}
    </div>
  )
}

/** One reviewable deduction line with Approve (Accept) / Waive (Reject) actions. */
function CandidateRow({
  line,
  canReview,
  reviewing,
  onAccept,
  onWaive,
}: {
  line: DeductionCandidate
  canReview: boolean
  reviewing: boolean
  onAccept: () => void
  onWaive: () => void
}) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <Avatar name={line.employeeName.slice(0, 1).toUpperCase() || '?'} size="sm" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{line.employeeName}</p>
            <StatusBadge status={line.status} />
          </div>
          <p className="mt-0.5 text-sm text-slate-600">
            {line.gym} · {line.period} · {formatDate(line.date)}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {line.label || line.reason || 'Deduction'} · <span className="capitalize">{line.source}</span>
          </p>
          {line.reason && line.label && <p className="mt-0.5 text-sm italic text-slate-500">“{line.reason}”</p>}
          <p className="mt-1 text-lg font-bold text-slate-900">{formatMoney(line.amount)}</p>
        </div>
      </div>

      {canReview && (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onAccept} loading={reviewing}>
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Approve
          </Button>
          <Button variant="outline" size="sm" onClick={onWaive} disabled={reviewing}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Waive
          </Button>
        </div>
      )}
    </li>
  )
}
