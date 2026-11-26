import { useTranslation } from 'react-i18next'
import { Pencil, Plus, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Dialog } from '../../../components/ui/dialog'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateTime, formatMoney } from '../../../lib/format'
import type { GymSubscription } from '../api/subscriptions.api'
import { useSubscription } from '../hooks/useSubscriptions'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'

interface SubscriptionDetailDialogProps {
  open: boolean
  gymId: number | null
  onClose: () => void
  onRecordPayment: (subscription: GymSubscription) => void
  onEditTerms: (subscription: GymSubscription) => void
  onSuspend: (subscription: GymSubscription) => void
  onReactivate: (subscription: GymSubscription) => void
}

/** One gym's full billing record: status, invoices and payment ledger. */
export function SubscriptionDetailDialog({
  open,
  gymId,
  onClose,
  onRecordPayment,
  onEditTerms,
  onSuspend,
  onReactivate,
}: SubscriptionDetailDialogProps) {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useSubscription(open ? gymId : null)

  const subscription = data?.subscription
  const currency = subscription?.currency ?? data?.settings.currency ?? 'EGP'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={subscription?.gymName ?? t('Gym subscription')}
      description={subscription?.branch ?? undefined}
      className="sm:max-w-4xl"
      footer={<Button variant="outline" onClick={onClose}>{t('Close')}</Button>}
    >
      {isLoading ? (
        <LoadingState label={t('Loading subscription…')} />
      ) : error ? (
        <ErrorState message={describeApiError(error)} onRetry={() => void refetch()} />
      ) : !subscription ? (
        <p className="py-6 text-center text-sm text-slate-500">{t('Subscription not found.')}</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('Status')}</p>
              <div className="mt-1.5"><SubscriptionStatusBadge status={subscription.status} /></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('Amount per cycle')}</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">{formatMoney(subscription.amount, currency)}</p>
              <p className="text-xs text-slate-500">{t('Every {{count}} month(s)', { count: subscription.billingCycleMonths })}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('Next due')}</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">{formatDate(subscription.nextDueDate, { withYear: 'always' })}</p>
              <p className={`text-xs ${subscription.daysOverdue > 0 ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                {subscription.daysOverdue > 0
                  ? t('{{count}} day(s) overdue', { count: subscription.daysOverdue })
                  : subscription.daysUntilDue != null
                    ? t('In {{count}} day(s)', { count: subscription.daysUntilDue })
                    : t('No unpaid invoice')}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('Outstanding')}</p>
              <p className={`mt-1.5 text-sm font-semibold ${subscription.outstandingAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {formatMoney(subscription.outstandingAmount, currency)}
              </p>
              <p className="text-xs text-slate-500">{t('{{count}} unpaid invoice(s)', { count: subscription.unpaidInvoiceCount })}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Badge color="gray">{t('Grace {{days}} days', { days: subscription.gracePeriodDays })}</Badge>
            <Badge color="gray">{t('Reminder {{days}} days before due', { days: subscription.reminderLeadDays })}</Badge>
            <Badge color={subscription.autoSuspensionEnabled ? 'blue' : 'gray'}>
              {subscription.autoSuspensionEnabled ? t('Auto-suspension on') : t('Auto-suspension off')}
            </Badge>
            {subscription.accessOverrideUntil && (
              <Badge color="yellow">{t('Override until {{date}}', { date: formatDate(subscription.accessOverrideUntil, { withYear: 'always' }) })}</Badge>
            )}
          </div>

          {subscription.suspensionReason && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">{t('Access suspended')}</p>
                <p className="text-xs">{subscription.suspensionReason}</p>
                {subscription.suspendedAtUtc && (
                  <p className="mt-0.5 text-[11px] text-red-700">{t('Since {{date}}', { date: formatDateTime(subscription.suspendedAtUtc) })}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onRecordPayment(subscription)} disabled={subscription.outstandingAmount <= 0}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('Record payment')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEditTerms(subscription)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t('Edit terms')}
            </Button>
            {subscription.status === 'Suspended' ? (
              <Button size="sm" variant="secondary" onClick={() => onReactivate(subscription)}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t('Reactivate')}
              </Button>
            ) : (
              <Button size="sm" variant="dangerOutline" onClick={() => onSuspend(subscription)}>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                {t('Suspend')}
              </Button>
            )}
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{t('Invoices')}</h3>
            <div className="rounded-xl border border-slate-200">
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
                  {(data?.invoices ?? []).map((invoice) => (
                    <TR key={invoice.id}>
                      <TD className="font-mono text-xs">{invoice.invoiceNumber}</TD>
                      <TD className="whitespace-nowrap text-xs">
                        {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                      </TD>
                      <TD className="whitespace-nowrap text-xs">{formatDate(invoice.dueDate, { withYear: 'always' })}</TD>
                      <TD className="whitespace-nowrap text-xs">{formatMoney(invoice.amount, currency)}</TD>
                      <TD className="whitespace-nowrap text-xs">{formatMoney(invoice.amountPaid, currency)}</TD>
                      <TD>
                        <StatusBadge status={invoice.status} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {(data?.invoices.length ?? 0) === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">{t('No invoices yet.')}</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{t('Payment history')}</h3>
            <div className="rounded-xl border border-slate-200">
              <Table>
                <THead>
                  <TH>{t('Date')}</TH>
                  <TH>{t('Invoice')}</TH>
                  <TH>{t('Amount')}</TH>
                  <TH>{t('Method')}</TH>
                  <TH>{t('Reference')}</TH>
                </THead>
                <TBody>
                  {(data?.payments ?? []).map((payment) => (
                    <TR key={payment.id}>
                      <TD className="whitespace-nowrap text-xs">{formatDateTime(payment.paidAtUtc)}</TD>
                      <TD className="font-mono text-xs">{payment.invoiceNumber}</TD>
                      <TD className="whitespace-nowrap text-xs font-semibold">{formatMoney(payment.amount, currency)}</TD>
                      <TD className="text-xs">{t(payment.method)}</TD>
                      <TD className="text-xs">{payment.reference ?? '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {(data?.payments.length ?? 0) === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">{t('No payments recorded yet.')}</p>
              )}
            </div>
          </section>
        </div>
      )}
    </Dialog>
  )
}
