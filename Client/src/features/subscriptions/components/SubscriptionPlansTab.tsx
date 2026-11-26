import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Pencil, Plus } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Dialog } from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/empty-state'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatMoney } from '../../../lib/format'
import type { SubscriptionPlan } from '../api/subscriptions.api'
import { useArchiveSubscriptionPlan, useSubscriptionPlans } from '../hooks/useSubscriptions'
import { SubscriptionPlanDialog } from './SubscriptionPlanDialog'

/** Revive Admin plan catalog: create, edit, archive. */
export function SubscriptionPlansTab({ currency }: { currency: string }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const plans = useSubscriptionPlans(true)
  const archive = useArchiveSubscriptionPlan()

  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<SubscriptionPlan | null>(null)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (plan: SubscriptionPlan) => {
    setEditing(plan)
    setDialogOpen(true)
  }

  const confirmArchive = async () => {
    if (!archiveTarget) return
    try {
      await archive.mutateAsync(archiveTarget.id)
      toast(t('Plan archived. Existing gyms keep it until changed.'))
      setArchiveTarget(null)
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  if (plans.isLoading) {
    return <LoadingState label={t('Loading plans…')} />
  }
  if (plans.error || !plans.data) {
    return <ErrorState message={describeApiError(plans.error)} onRetry={() => void plans.refetch()} />
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
          <p className="text-xs text-slate-500">
            {t('{{count}} plan(s) in the catalog', { count: plans.data.length })}
          </p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('New plan')}
          </Button>
        </div>

        {plans.data.length === 0 ? (
          <EmptyState
            icon={Archive}
            title={t('No subscription plans yet')}
            message={t('Create a plan to assign consistent pricing to gyms.')}
            action={<Button size="sm" onClick={openCreate}>{t('New plan')}</Button>}
          />
        ) : (
          <Table>
            <THead>
              <TH>{t('Plan')}</TH>
              <TH>{t('Price')}</TH>
              <TH>{t('Cycle')}</TH>
              <TH>{t('Grace')}</TH>
              <TH>{t('Reminder')}</TH>
              <TH>{t('Gyms')}</TH>
              <TH>{t('Status')}</TH>
              <TH className="text-end">{t('Actions')}</TH>
            </THead>
            <TBody>
              {plans.data.map((plan) => (
                <TR key={plan.id}>
                  <TD>
                    <p className="font-medium text-slate-900">{plan.name}</p>
                    {plan.description && <p className="text-xs text-slate-500">{plan.description}</p>}
                  </TD>
                  <TD className="whitespace-nowrap text-xs font-semibold">{formatMoney(plan.pricePerCycle, currency)}</TD>
                  <TD className="text-xs">{t('{{count}} month(s)', { count: plan.billingCycleMonths })}</TD>
                  <TD className="text-xs">{plan.gracePeriodDays != null ? t('{{count}} days', { count: plan.gracePeriodDays }) : t('Platform default')}</TD>
                  <TD className="text-xs">{plan.reminderLeadDays != null ? t('{{count}} days', { count: plan.reminderLeadDays }) : t('Platform default')}</TD>
                  <TD className="text-xs">{plan.gymCount}</TD>
                  <TD>{plan.isActive ? <Badge color="green">{t('Active')}</Badge> : <Badge color="gray">{t('Archived')}</Badge>}</TD>
                  <TD className="text-end">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('Edit')}
                      </Button>
                      {plan.isActive && (
                        <Button variant="dangerOutline" size="sm" onClick={() => setArchiveTarget(plan)}>
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('Archive')}
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <SubscriptionPlanDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        plan={editing}
        onSaved={() => undefined}
      />

      <Dialog
        open={archiveTarget != null}
        onClose={() => setArchiveTarget(null)}
        title={t('Archive subscription plan')}
        description={t('{{name}} will no longer be assignable to gyms. Existing gyms keep their current plan and price.', { name: archiveTarget?.name ?? '' })}
        footer={
          <>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>{t('Cancel')}</Button>
            <Button variant="danger" onClick={confirmArchive} loading={archive.isPending}>{t('Archive plan')}</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{t('You can reactivate the plan later by editing it.')}</p>
      </Dialog>
    </>
  )
}
