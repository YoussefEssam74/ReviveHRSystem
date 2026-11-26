import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, CreditCard, RefreshCcw, ShieldAlert } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { EmptyState } from '../../../components/ui/empty-state'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateTime, formatMoney } from '../../../lib/format'
import type { SubscriptionPlan } from '../api/subscriptions.api'
import { useMySubscription } from '../hooks/useSubscriptions'
import { GymSubscriptionRequestDialog } from './GymSubscriptionRequestDialog'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'

const SUSPENSION_MESSAGE =
  'Your HR system access has been temporarily suspended due to an outstanding subscription payment. Please complete your payment to restore access.'

interface RequestTarget {
  type: 'Renewal' | 'PlanChange'
  plan: SubscriptionPlan | null
}

/** Gym-side subscription dashboard for the active gym's Branch Manager / Super Admin. */
export function GymSubscriptionView() {
  const { t } = useTranslation()
  const subscription = useMySubscription(true)
  const [requestTarget, setRequestTarget] = useState<RequestTarget | null>(null)

  if (subscription.isLoading) {
    return <LoadingState label={t('Loading your subscription…')} />
  }
  if (subscription.error || !subscription.data) {
    return <ErrorState message={describeApiError(subscription.error)} onRetry={() => void subscription.refetch()} />
  }

  const detail = subscription.data.subscription
  const current = detail.subscription
  const currency = current.currency
  const pending = subscription.data.pendingRequests[0] ?? null
  const currentPlan = subscription.data.availablePlans.find((plan) => plan.id === current.planId) ?? null
  const upgradePlans = subscription.data.availablePlans.filter((plan) => plan.id !== current.planId)

  return (
    <>
      <PageHeader
        title={t('My subscription')}
        description={t('{{gym}} · plan, status, due date and payment history', { gym: current.gymName })}
        actions={
          <Button
            size="sm"
            onClick={() => setRequestTarget({ type: 'Renewal', plan: currentPlan })}
            disabled={pending != null}
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            {t('Renew plan')}
          </Button>
        }
      />

      {current.status === 'Suspended' && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t('Access suspended')}</p>
            <p className="text-xs">{t(SUSPENSION_MESSAGE)}</p>
          </div>
        </div>
      )}

      {pending && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div>
            <p className="font-semibold">{t('Request awaiting review')}</p>
            <p className="text-xs">
              {t(pending.type === 'PlanChange' ? 'Plan change' : 'Renewal')}
              {pending.requestedPlanName ? ` → ${pending.requestedPlanName}` : ''}
              {' · '}
              {formatDateTime(pending.createdAtUtc)}
            </p>
          </div>
          <Badge color="yellow">{t('Pending')}</Badge>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('Current plan')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{current.planName ?? t('Custom plan')}</p>
          <div className="mt-1"><SubscriptionStatusBadge status={current.status} /></div>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('Amount per cycle')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatMoney(current.amount, currency)}</p>
          <p className="text-xs text-slate-500">{t('Every {{count}} month(s)', { count: current.billingCycleMonths })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('Next due')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatDate(current.nextDueDate, { withYear: 'always' })}</p>
          <p className={`text-xs ${current.daysOverdue > 0 ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
            {current.daysOverdue > 0
              ? t('{{count}} day(s) overdue', { count: current.daysOverdue })
              : current.daysUntilDue != null
                ? t('In {{count}} day(s)', { count: current.daysUntilDue })
                : t('No unpaid invoice')}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('Outstanding')}</p>
          <p className={`mt-1 text-lg font-bold ${current.outstandingAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {formatMoney(current.outstandingAmount, currency)}
          </p>
          <p className="text-xs text-slate-500">{t('{{count}} unpaid invoice(s)', { count: current.unpaidInvoiceCount })}</p>
        </Card>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <Badge color="gray">{t('Grace {{days}} days', { days: current.gracePeriodDays })}</Badge>
          <Badge color="gray">{t('Reminder {{days}} days before due', { days: current.reminderLeadDays })}</Badge>
          <Badge color={current.autoSuspensionEnabled ? 'blue' : 'gray'}>
            {current.autoSuspensionEnabled ? t('Auto-suspension on') : t('Auto-suspension off')}
          </Badge>
          <Badge color="gray">{t('Billing starts {{date}}', { date: formatDate(current.billingStartDate, { withYear: 'always' }) })}</Badge>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-slate-900">{t('Upgrade your plan')}</h2>
            <p className="text-xs text-slate-500">{t('Requests are reviewed by Revive Admin before the plan changes.')}</p>
          </div>
          {upgradePlans.length === 0 ? (
            <EmptyState icon={ArrowUpRight} title={t('No other plans available')} message={t('The catalog has no alternative active plan right now.')} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upgradePlans.map((plan) => (
                <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{plan.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatMoney(plan.pricePerCycle, currency)} · {t('every {{count}} month(s)', { count: plan.billingCycleMonths })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending != null}
                    onClick={() => setRequestTarget({ type: 'PlanChange', plan })}
                  >
                    {t('Request upgrade')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-slate-900">{t('Payment history')}</h2>
            <p className="text-xs text-slate-500">{t('Confirmed payments recorded by Revive Admin.')}</p>
          </div>
          {detail.payments.length === 0 ? (
            <EmptyState icon={CreditCard} title={t('No payments recorded yet')} message={t('Your payment history will appear here.')} />
          ) : (
            <Table>
              <THead>
                <TH>{t('Date')}</TH>
                <TH>{t('Invoice')}</TH>
                <TH>{t('Amount')}</TH>
                <TH>{t('Method')}</TH>
              </THead>
              <TBody>
                {detail.payments.map((payment) => (
                  <TR key={payment.id}>
                    <TD className="whitespace-nowrap text-xs">{formatDateTime(payment.paidAtUtc)}</TD>
                    <TD className="font-mono text-xs">{payment.invoiceNumber}</TD>
                    <TD className="whitespace-nowrap text-xs font-semibold">{formatMoney(payment.amount, currency)}</TD>
                    <TD className="text-xs">{t(payment.method)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t('Invoices')}</h2>
        </div>
        {detail.invoices.length === 0 ? (
          <EmptyState icon={CreditCard} title={t('No invoices yet')} message={t('Invoices appear when a billing cycle starts.')} />
        ) : (
          <Table>
            <THead>
              <TH>{t('Invoice')}</TH>
              <TH>{t('Period')}</TH>
              <TH>{t('Due')}</TH>
              <TH>{t('Amount')}</TH>
              <TH>{t('Paid')}</TH>
              <TH>{t('Status')}</TH>
            </THead>
            <TBody>
              {detail.invoices.map((invoice) => (
                <TR key={invoice.id}>
                  <TD className="font-mono text-xs">{invoice.invoiceNumber}</TD>
                  <TD className="whitespace-nowrap text-xs">
                    {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                  </TD>
                  <TD className="whitespace-nowrap text-xs">{formatDate(invoice.dueDate, { withYear: 'always' })}</TD>
                  <TD className="whitespace-nowrap text-xs">{formatMoney(invoice.amount, currency)}</TD>
                  <TD className="whitespace-nowrap text-xs">{formatMoney(invoice.amountPaid, currency)}</TD>
                  <TD><StatusBadge status={invoice.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <GymSubscriptionRequestDialog
        open={requestTarget != null}
        onClose={() => setRequestTarget(null)}
        type={requestTarget?.type ?? 'Renewal'}
        plan={requestTarget?.plan ?? null}
        currentPlanName={current.planName}
        currency={currency}
        onSubmitted={() => undefined}
      />
    </>
  )
}
