import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Field, Textarea } from '../../../components/ui/field'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatMoney } from '../../../lib/format'
import type { SubscriptionPlan } from '../api/subscriptions.api'
import { useCreateMySubscriptionRequest } from '../hooks/useSubscriptions'

interface GymSubscriptionRequestDialogProps {
  open: boolean
  onClose: () => void
  type: 'Renewal' | 'PlanChange'
  plan: SubscriptionPlan | null
  currentPlanName: string | null
  currency: string
  onSubmitted: (message: string) => void
}

/** Gym admin submits a renewal or plan-change request for Revive Admin review. */
export function GymSubscriptionRequestDialog({
  open,
  onClose,
  type,
  plan,
  currentPlanName,
  currency,
  onSubmitted,
}: GymSubscriptionRequestDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const create = useCreateMySubscriptionRequest()
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) setNote('')
  }, [open])

  const handleSubmit = async () => {
    try {
      await create.mutateAsync({
        type,
        requestedPlanId: type === 'PlanChange' ? plan?.id ?? null : plan?.id ?? null,
        note: note.trim() || null,
      })
      toast(t('Request submitted. Revive Admin will review it shortly.'))
      onSubmitted(t('Request submitted. Revive Admin will review it shortly.'))
      onClose()
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={type === 'Renewal' ? t('Request renewal') : t('Request plan change')}
      description={
        type === 'Renewal'
          ? t('Ask Revive Admin to renew {{plan}} for your gym.', { plan: currentPlanName ?? t('your current plan') })
          : t('Ask Revive Admin to move your gym to {{plan}}.', { plan: plan?.name ?? t('the selected plan') })
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>{t('Cancel')}</Button>
          <Button onClick={handleSubmit} loading={create.isPending}>{t('Submit request')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {plan && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">{plan.name}</p>
            <p className="text-xs text-slate-600">
              {formatMoney(plan.pricePerCycle, currency)} · {t('every {{count}} month(s)', { count: plan.billingCycleMonths })}
            </p>
            {plan.description && <p className="mt-1 text-xs text-slate-500">{plan.description}</p>}
          </div>
        )}
        <Field
          label={t('Note for Revive Admin')}
          hint={t('Optional. Explain what you need or when the renewal should start.')}
        >
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} />
        </Field>
      </div>
    </Dialog>
  )
}
