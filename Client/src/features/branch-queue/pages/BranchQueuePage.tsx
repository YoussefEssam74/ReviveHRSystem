import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Gift, MinusCircle } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Select } from '../../../components/ui/select'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Tabs, type TabItem } from '../../../components/ui/tabs'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { DeclineDialog } from '../components/DeclineDialog'
import { useMe } from '../../../contexts/MeContext'
import { EDIT } from '../../../lib/permissions'
import { formatDate, formatMoney } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'
import type { BonusProposal, DeductionCandidate, WarningNotice } from '../api/branch-queue.api'
import { useBonuses, useDeductions, useReviewBonus, useReviewDeduction, useReviewWarning, useWarnings } from '../hooks/useBranchQueue'

type QueueTab = 'warnings' | 'bonuses' | 'deductions'

const KIND_BADGE: Record<QueueTab, string> = {
  warnings: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  bonuses: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  deductions: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
}

const KIND_LABEL: Record<QueueTab, string> = {
  warnings: 'Warning',
  bonuses: 'Bonus',
  deductions: 'Deduction',
}

interface DeclineTarget {
  tab: QueueTab
  id: number
  subject: string
  detail?: string
}

/**
 * Branch Queue — warnings / bonuses / deductions submitted by branch managers,
 * awaiting an HR decision (mock §20). Approving a deduction lands it in the
 * employee's payroll; approving a bonus/warning files it on the record.
 * Declining always requires a reason and applies nothing.
 */
export default function BranchQueuePage() {
  const { t } = useTranslation()
  const { can } = useMe()
  const canDecideRequests = can('requests', EDIT)
  const canDecidePayroll = can('payroll', EDIT)

  const [tab, setTab] = useState<QueueTab>('warnings')
  const [status, setStatus] = useState('Pending')
  const [page, setPage] = useState(1)
  const [declining, setDeclining] = useState<DeclineTarget | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const params = { status: status || undefined, page, pageSize: 20 }
  const warnings = useWarnings(params, tab === 'warnings')
  const bonuses = useBonuses(params, tab === 'bonuses')
  const deductions = useDeductions(params, tab === 'deductions')

  const reviewWarning = useReviewWarning()
  const reviewBonus = useReviewBonus()
  const reviewDeduction = useReviewDeduction()

  const tabs: TabItem<QueueTab>[] = [
    { value: 'warnings', label: t('Warnings') },
    { value: 'bonuses', label: t('Bonuses') },
    { value: 'deductions', label: t('Deductions') },
  ]
  const statusOptions =
    tab === 'deductions'
      ? ['', 'Pending', 'Accepted', 'Approved', 'Rejected']
      : ['', 'Pending', 'Approved', 'Rejected']

  const onTab = (value: QueueTab) => {
    setTab(value)
    setPage(1)
    setActionError(null)
  }
  const onStatus = (value: string) => {
    setStatus(value)
    setPage(1)
    setActionError(null)
  }

  /** Direct decisions (File/Approve/Accept/Waive) — no reason required. */
  const runDecision = async (fn: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const onFileWarning = (item: WarningNotice) =>
    runDecision(() => reviewWarning.mutateAsync({ id: item.id, body: { decision: 'Approved' } }))
  const onApproveBonus = (item: BonusProposal) =>
    runDecision(() => reviewBonus.mutateAsync({ id: item.id, body: { decision: 'Approved' } }))
  const onAcceptDeduction = (item: DeductionCandidate) =>
    runDecision(() => reviewDeduction.mutateAsync({ id: item.id, decision: 'Accepted' }))
  const onWaiveDeduction = (item: DeductionCandidate) =>
    runDecision(() => reviewDeduction.mutateAsync({ id: item.id, decision: 'Rejected' }))

  const onConfirmDecline = async (note: string) => {
    if (!declining) return
    if (declining.tab === 'bonuses') {
      await reviewBonus.mutateAsync({ id: declining.id, body: { decision: 'Rejected', note } })
    } else {
      await reviewWarning.mutateAsync({ id: declining.id, body: { decision: 'Rejected', note } })
    }
    setActionError(null)
  }

  return (
    <div>
      <PageHeader
        title={t('Branch Queue')}
        description={t(
          'Warnings and bonuses sent from branch managers, plus deduction lines awaiting review — approve to apply, or decline with a reason.',
        )}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs items={tabs} value={tab} onChange={onTab} className="w-fit" />
        <Select
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          className="sm:w-48"
          aria-label={t('Filter by status')}
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option === '' ? t('All statuses') : t(option)}
            </option>
          ))}
        </Select>
      </div>

      {actionError && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <Card>
        {tab === 'warnings' &&
          (warnings.isLoading ? (
            <LoadingState label={t('Loading warnings…')} />
          ) : warnings.error ? (
            <ErrorState message={describeApiError(warnings.error)} />
          ) : (warnings.data?.items?.length ?? 0) === 0 ? (
            <EmptyState icon={AlertTriangle} title={t('No warning notices')} message={t('Nothing matches this filter.')} />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {warnings.data!.items.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={KIND_BADGE.warnings}>{t(KIND_LABEL.warnings)}</Badge>
                        <p className="text-sm font-semibold text-slate-900">{item.employee}</p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        {item.type} — {item.reason}
                      </p>
                      {item.note && <p className="mt-0.5 text-xs text-slate-500">{item.note}</p>}
                      <p className="mt-1 text-xs text-slate-400">
                        {t('Sent by {{name}} · {{date}}', { name: item.issuedBy, date: formatDate(item.issuedAt) })}
                      </p>
                      {item.reviewedBy && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {t('{{action}} by {{name}}', {
                            action: item.status === 'Rejected' ? t('Declined') : t('Filed'),
                            name: item.reviewedBy,
                          })}
                          {item.reviewNote ? ` — “${item.reviewNote}”` : ''}
                        </p>
                      )}
                    </div>
                    {item.status === 'Pending' && canDecideRequests && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => void onFileWarning(item)} loading={reviewWarning.isPending}>
                          {t('File warning')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDeclining({
                              tab: 'warnings',
                              id: item.id,
                              subject: `${item.employee} · ${t(KIND_LABEL.warnings)}`,
                              detail: `${item.type} — ${item.reason}`,
                            })
                          }
                        >
                          {t('Decline')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination
                page={warnings.data!.page}
                pageSize={warnings.data!.pageSize}
                total={warnings.data!.total}
                totalPages={warnings.data!.totalPages}
                onPageChange={setPage}
                noun={t('warnings')}
              />
            </>
          ))}

        {tab === 'bonuses' &&
          (bonuses.isLoading ? (
            <LoadingState label={t('Loading bonuses…')} />
          ) : bonuses.error ? (
            <ErrorState message={describeApiError(bonuses.error)} />
          ) : (bonuses.data?.items?.length ?? 0) === 0 ? (
            <EmptyState icon={Gift} title={t('No bonus proposals')} message={t('Nothing matches this filter.')} />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {bonuses.data!.items.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={KIND_BADGE.bonuses}>{t(KIND_LABEL.bonuses)}</Badge>
                        <p className="text-sm font-semibold text-slate-900">{item.employee}</p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        {item.type} · <span className="font-semibold">{formatMoney(item.amount)}</span> — {item.reason}
                      </p>
                      {item.note && <p className="mt-0.5 text-xs text-slate-500">{item.note}</p>}
                      <p className="mt-1 text-xs text-slate-400">
                        {t('Sent by {{name}} · {{date}}', { name: item.issuedBy, date: formatDate(item.issuedAt) })}
                      </p>
                      {item.reviewedBy && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {t('{{action}} by {{name}}', {
                            action: item.status === 'Rejected' ? t('Declined') : t('Approved'),
                            name: item.reviewedBy,
                          })}
                          {item.reviewNote ? ` — “${item.reviewNote}”` : ''}
                        </p>
                      )}
                    </div>
                    {item.status === 'Pending' && canDecideRequests && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => void onApproveBonus(item)} loading={reviewBonus.isPending}>
                          {t('Approve bonus')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDeclining({
                              tab: 'bonuses',
                              id: item.id,
                              subject: `${item.employee} · ${t(KIND_LABEL.bonuses)}`,
                              detail: `${item.type} · ${formatMoney(item.amount)} — ${item.reason}`,
                            })
                          }
                        >
                          {t('Decline')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination
                page={bonuses.data!.page}
                pageSize={bonuses.data!.pageSize}
                total={bonuses.data!.total}
                totalPages={bonuses.data!.totalPages}
                onPageChange={setPage}
                noun={t('bonuses')}
              />
            </>
          ))}

        {tab === 'deductions' &&
          (deductions.isLoading ? (
            <LoadingState label={t('Loading deductions…')} />
          ) : deductions.error ? (
            <ErrorState message={describeApiError(deductions.error)} />
          ) : (deductions.data?.items?.length ?? 0) === 0 ? (
            <EmptyState icon={MinusCircle} title={t('No deduction lines')} message={t('Nothing matches this filter.')} />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {deductions.data!.items.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={KIND_BADGE.deductions}>{t(KIND_LABEL.deductions)}</Badge>
                        <p className="text-sm font-semibold text-slate-900">{item.employeeName}</p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        <span className="font-semibold">{formatMoney(item.amount)}</span> — {item.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.gym} · {item.period} · {formatDate(item.date)} · {item.source}
                      </p>
                    </div>
                    {item.status === 'Pending' && canDecidePayroll && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => void onAcceptDeduction(item)} loading={reviewDeduction.isPending}>
                          {t('Approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onWaiveDeduction(item)}
                          loading={reviewDeduction.isPending}
                        >
                          {t('Waive')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination
                page={deductions.data!.page}
                pageSize={deductions.data!.pageSize}
                total={deductions.data!.total}
                totalPages={deductions.data!.totalPages}
                onPageChange={setPage}
                noun={t('deductions')}
              />
            </>
          ))}
      </Card>

      {declining && (
        <DeclineDialog
          kind={declining.tab === 'bonuses' ? 'bonus' : 'warning'}
          subject={declining.subject}
          detail={declining.detail}
          onClose={() => setDeclining(null)}
          onConfirm={onConfirmDecline}
        />
      )}
    </div>
  )
}
