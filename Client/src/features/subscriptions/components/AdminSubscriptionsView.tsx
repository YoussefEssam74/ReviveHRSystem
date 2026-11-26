import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayCircle, ReceiptText, RefreshCcw, Settings2, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { EmptyState } from '../../../components/ui/empty-state'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { StatStrip, StatTile } from '../../../components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { Tabs } from '../../../components/ui/tabs'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney } from '../../../lib/format'
import type { GymSubscription } from '../api/subscriptions.api'
import { useRunSubscriptionCycle, useSubscriptionPlans, useSubscriptions } from '../hooks/useSubscriptions'
import { RecordPaymentDialog } from '../components/RecordPaymentDialog'
import { ReactivateSubscriptionDialog } from '../components/ReactivateSubscriptionDialog'
import { SubscriptionDetailDialog } from '../components/SubscriptionDetailDialog'
import { SubscriptionPlansTab } from '../components/SubscriptionPlansTab'
import { SubscriptionRequestsTab } from '../components/SubscriptionRequestsTab'
import { SubscriptionSettingsDialog } from '../components/SubscriptionSettingsDialog'
import { SubscriptionStatusBadge } from '../components/SubscriptionStatusBadge'
import { SubscriptionTermsDialog } from '../components/SubscriptionTermsDialog'
import { SuspendSubscriptionDialog } from '../components/SuspendSubscriptionDialog'

const STATUS_FILTERS = ['All', 'Active', 'GracePeriod', 'Suspended', 'Cancelled'] as const
type AdminTab = 'gyms' | 'plans' | 'requests'

interface TermsTarget {
  gymId: number | null
  gymName: string
  existing: GymSubscription | null
}

/** Revive Admin — all gym subscriptions, the plan catalog and the request review queue. */
export function AdminSubscriptionsView() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const overview = useSubscriptions(true)
  const plans = useSubscriptionPlans(true)
  const runCycle = useRunSubscriptionCycle()

  const [tab, setTab] = useState<AdminTab>('gyms')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('All')
  const [detailGymId, setDetailGymId] = useState<number | null>(null)
  const [termsTarget, setTermsTarget] = useState<TermsTarget | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<GymSubscription | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<GymSubscription | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<GymSubscription | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const data = overview.data
  const currency = data?.settings.currency ?? 'EGP'
  const planOptions = plans.data ?? []

  const items = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.items ?? []).filter((item) => {
      if (statusFilter !== 'All' && item.status !== statusFilter) return false
      if (!query) return true
      return (
        item.gymName.toLowerCase().includes(query) ||
        (item.branch ?? '').toLowerCase().includes(query) ||
        (item.planName ?? '').toLowerCase().includes(query)
      )
    })
  }, [data?.items, search, statusFilter])

  const runCycleNow = async () => {
    try {
      const result = await runCycle.mutateAsync()
      toast(
        t(
          'Cycle complete: {{invoices}} invoices, {{reminders}} reminders, {{suspended}} suspensions, {{reactivated}} reactivations.',
          {
            invoices: result.invoicesCreated,
            reminders: result.remindersSent,
            suspended: result.gymsSuspended,
            reactivated: result.gymsReactivated,
          },
        ),
      )
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  if (overview.isLoading) {
    return <LoadingState label={t('Loading subscriptions…')} />
  }
  if (overview.error || !data) {
    return <ErrorState message={describeApiError(overview.error)} onRetry={() => void overview.refetch()} />
  }

  const openNewTerms = () => {
    setTermsTarget({ gymId: null, gymName: '', existing: null })
  }

  const rowActions = (item: GymSubscription) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={() => setDetailGymId(item.gymId)}>
        {t('View')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPaymentTarget(item)}
        disabled={item.outstandingAmount <= 0}
      >
        <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
        {t('Record')}
      </Button>
      {item.status === 'Suspended' ? (
        <Button variant="secondary" size="sm" onClick={() => setReactivateTarget(item)}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t('Reactivate')}
        </Button>
      ) : (
        <Button variant="dangerOutline" size="sm" onClick={() => setSuspendTarget(item)}>
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          {t('Suspend')}
        </Button>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        title={t('Subscriptions & billing')}
        description={t('Monthly HR service subscriptions, payment collection and automated access control.')}
        actions={
          tab === 'gyms' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                {t('Billing settings')}
              </Button>
              <Button variant="secondary" size="sm" onClick={runCycleNow} loading={runCycle.isPending}>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                {t('Run cycle now')}
              </Button>
              {data.unconfiguredGyms.length > 0 && (
                <Button size="sm" onClick={openNewTerms}>
                  <ReceiptText className="h-4 w-4" aria-hidden="true" />
                  {t('Set up billing')}
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <Tabs
        className="mb-4"
        items={[
          { value: 'gyms', label: 'Gyms' },
          { value: 'plans', label: 'Plans' },
          { value: 'requests', label: 'Requests' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as AdminTab)}
      />

      {tab === 'gyms' && (
        <>
          <StatStrip className="mb-4">
            <StatTile label={t('Gyms billed')} value={data.summary.totalGyms} />
            <StatTile label={t('Active')} value={data.summary.activeCount} />
            <StatTile label={t('Grace period')} value={data.summary.gracePeriodCount} />
            <StatTile label={t('Suspended')} value={data.summary.suspendedCount} accent />
            <StatTile label={t('Outstanding')} value={formatMoney(data.summary.outstandingTotal, currency)} />
            <StatTile label={t('Collected')} value={formatMoney(data.summary.collectedTotal, currency)} />
          </StatStrip>

          <Card>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('Search gyms or plans…')}
                aria-label={t('Search gyms')}
                className="sm:max-w-xs"
              />
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number])}
                aria-label={t('Filter by subscription status')}
                className="sm:w-52"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status === 'All' ? t('All statuses') : t(status === 'GracePeriod' ? 'Grace period' : status)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 sm:ms-auto">
                {t('{{shown}} of {{total}} gyms', { shown: items.length, total: data.items.length })}
              </p>
              <Button variant="ghost" size="sm" onClick={() => void overview.refetch()} aria-label={t('Refresh')}>
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>

            {items.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title={t('No gym subscriptions match these filters')}
                message={data.items.length === 0 ? t('Set up billing for the first gym to begin.') : t('Try another search or status.')}
                action={
                  data.unconfiguredGyms.length > 0 ? (
                    <Button size="sm" onClick={openNewTerms}>{t('Set up billing')}</Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <THead>
                      <TH>{t('Gym')}</TH>
                      <TH>{t('Status')}</TH>
                      <TH>{t('Plan')}</TH>
                      <TH>{t('Amount')}</TH>
                      <TH>{t('Next due')}</TH>
                      <TH>{t('Outstanding')}</TH>
                      <TH className="text-end">{t('Actions')}</TH>
                    </THead>
                    <TBody>
                      {items.map((item) => (
                        <TR key={item.gymId}>
                          <TD>
                            <button type="button" className="text-start" onClick={() => setDetailGymId(item.gymId)}>
                              <span className="block font-medium text-slate-900 hover:text-emerald-700">{item.gymName}</span>
                              <span className="block text-xs text-slate-500">{item.branch ?? t('No branch')}</span>
                            </button>
                          </TD>
                          <TD><SubscriptionStatusBadge status={item.status} /></TD>
                          <TD className="text-xs">
                            <span className="block font-medium text-slate-900">{item.planName ?? t('Custom plan')}</span>
                            <span className="block text-slate-500">{t('Every {{count}} month(s)', { count: item.billingCycleMonths })}</span>
                          </TD>
                          <TD className="whitespace-nowrap text-xs">
                            <span className="block font-semibold text-slate-900">{formatMoney(item.amount, currency)}</span>
                          </TD>
                          <TD className="whitespace-nowrap text-xs">
                            <span className="block text-slate-700">{formatDate(item.nextDueDate, { withYear: 'always' })}</span>
                            <span className={item.daysOverdue > 0 ? 'block font-semibold text-red-600' : 'block text-slate-500'}>
                              {item.daysOverdue > 0
                                ? t('{{count}} day(s) overdue', { count: item.daysOverdue })
                                : item.daysUntilDue != null
                                  ? t('In {{count}} day(s)', { count: item.daysUntilDue })
                                  : t('No unpaid invoice')}
                            </span>
                          </TD>
                          <TD className="whitespace-nowrap text-xs">
                            <span className={item.outstandingAmount > 0 ? 'font-semibold text-red-600' : 'text-emerald-700'}>
                              {formatMoney(item.outstandingAmount, currency)}
                            </span>
                            <span className="block text-slate-500">{t('{{count}} unpaid', { count: item.unpaidInvoiceCount })}</span>
                          </TD>
                          <TD className="text-end">{rowActions(item)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>

                <ul className="divide-y divide-slate-100 md:hidden">
                  {items.map((item) => (
                    <li key={item.gymId} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" className="min-w-0 text-start" onClick={() => setDetailGymId(item.gymId)}>
                          <span className="block truncate font-medium text-slate-900">{item.gymName}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {item.planName ?? t('Custom plan')} · {item.branch ?? t('No branch')}
                          </span>
                        </button>
                        <SubscriptionStatusBadge status={item.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500">{t('Amount')}</p>
                          <p className="font-semibold text-slate-900">{formatMoney(item.amount, currency)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">{t('Next due')}</p>
                          <p className="text-slate-700">{formatDate(item.nextDueDate, { withYear: 'always' })}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">{t('Outstanding')}</p>
                          <p className={item.outstandingAmount > 0 ? 'font-semibold text-red-600' : 'text-emerald-700'}>
                            {formatMoney(item.outstandingAmount, currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">{t('Grace')}</p>
                          <p className="text-slate-700">{t('{{count}} days', { count: item.gracePeriodDays })}</p>
                        </div>
                      </div>
                      {rowActions(item)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {data.unconfiguredGyms.length > 0 && (
            <Card className="mt-4 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{t('Gyms without billing')}</h2>
                  <p className="text-xs text-slate-500">
                    {t('These active gyms are not billed yet and therefore are not subject to automated suspension.')}
                  </p>
                </div>
                <Badge color="yellow">{data.unconfiguredGyms.length}</Badge>
              </div>
              <ul className="divide-y divide-slate-100">
                {data.unconfiguredGyms.map((gym) => (
                  <li key={gym.gymId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{gym.gymName}</p>
                      <p className="truncate text-xs text-slate-500">{gym.branch ?? '—'}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTermsTarget({ gymId: gym.gymId, gymName: gym.gymName, existing: null })}
                    >
                      {t('Set up billing')}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === 'plans' && <SubscriptionPlansTab currency={currency} />}
      {tab === 'requests' && <SubscriptionRequestsTab />}

      <SubscriptionDetailDialog
        open={detailGymId != null}
        gymId={detailGymId}
        onClose={() => setDetailGymId(null)}
        onRecordPayment={(subscription) => {
          setDetailGymId(null)
          setPaymentTarget(subscription)
        }}
        onEditTerms={(subscription) => {
          setDetailGymId(null)
          setTermsTarget({ gymId: subscription.gymId, gymName: subscription.gymName, existing: subscription })
        }}
        onSuspend={(subscription) => {
          setDetailGymId(null)
          setSuspendTarget(subscription)
        }}
        onReactivate={(subscription) => {
          setDetailGymId(null)
          setReactivateTarget(subscription)
        }}
      />

      <SubscriptionTermsDialog
        open={termsTarget != null}
        onClose={() => setTermsTarget(null)}
        gymId={termsTarget?.gymId ?? null}
        gymName={termsTarget?.gymName ?? ''}
        existing={termsTarget?.existing ?? null}
        settings={data.settings}
        candidates={data.unconfiguredGyms}
        plans={planOptions}
        onSaved={() => undefined}
      />

      <RecordPaymentDialog
        open={paymentTarget != null}
        onClose={() => setPaymentTarget(null)}
        gymId={paymentTarget?.gymId ?? 0}
        gymName={paymentTarget?.gymName ?? ''}
        currency={paymentTarget?.currency ?? currency}
        outstanding={paymentTarget?.outstandingAmount ?? 0}
        onRecorded={() => undefined}
      />

      <SuspendSubscriptionDialog
        open={suspendTarget != null}
        onClose={() => setSuspendTarget(null)}
        gymId={suspendTarget?.gymId ?? 0}
        gymName={suspendTarget?.gymName ?? ''}
        onSuspended={() => undefined}
      />

      <ReactivateSubscriptionDialog
        open={reactivateTarget != null}
        onClose={() => setReactivateTarget(null)}
        gymId={reactivateTarget?.gymId ?? 0}
        gymName={reactivateTarget?.gymName ?? ''}
        defaultOverrideDays={reactivateTarget?.gracePeriodDays ?? data.settings.defaultGracePeriodDays}
        onReactivated={() => undefined}
      />

      <SubscriptionSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={data.settings}
        onSaved={() => undefined}
      />
    </>
  )
}
