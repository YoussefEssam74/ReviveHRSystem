import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Field, Input, Textarea } from '../../../components/ui/field'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import type { SubscriptionPlan } from '../api/subscriptions.api'
import { useCreateSubscriptionPlan, useUpdateSubscriptionPlan } from '../hooks/useSubscriptions'

interface SubscriptionPlanDialogProps {
  open: boolean
  onClose: () => void
  plan: SubscriptionPlan | null
  onSaved: (message: string) => void
}

/** Create/edit a catalog plan (Revive Admin). */
export function SubscriptionPlanDialog({ open, onClose, plan, onSaved }: SubscriptionPlanDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const create = useCreateSubscriptionPlan()
  const update = useUpdateSubscriptionPlan()
  const pending = create.isPending || update.isPending

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [cycle, setCycle] = useState('1')
  const [grace, setGrace] = useState('')
  const [reminder, setReminder] = useState('')
  const [active, setActive] = useState(true)
  const [sortOrder, setSortOrder] = useState('0')

  useEffect(() => {
    if (!open) return
    setName(plan?.name ?? '')
    setDescription(plan?.description ?? '')
    setPrice(plan ? String(plan.pricePerCycle) : '')
    setCycle(String(plan?.billingCycleMonths ?? 1))
    setGrace(plan?.gracePeriodDays != null ? String(plan.gracePeriodDays) : '')
    setReminder(plan?.reminderLeadDays != null ? String(plan.reminderLeadDays) : '')
    setActive(plan?.isActive ?? true)
    setSortOrder(String(plan?.sortOrder ?? 0))
  }, [open, plan])

  const handleSave = async () => {
    if (name.trim().length < 2) {
      toast(t('Enter a plan name.'), 'error')
      return
    }
    const priceValue = Number(price)
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      toast(t('Enter a plan price greater than zero.'), 'error')
      return
    }
    const cycleValue = Number(cycle)
    if (!Number.isInteger(cycleValue) || cycleValue < 1 || cycleValue > 36) {
      toast(t('The billing cycle must be between 1 and 36 months.'), 'error')
      return
    }
    const graceValue = grace.trim() === '' ? null : Number(grace)
    if (graceValue !== null && (!Number.isInteger(graceValue) || graceValue < 0 || graceValue > 90)) {
      toast(t('The grace period must be between 0 and 90 days.'), 'error')
      return
    }
    const reminderValue = reminder.trim() === '' ? null : Number(reminder)
    if (reminderValue !== null && (!Number.isInteger(reminderValue) || reminderValue < 0 || reminderValue > 60)) {
      toast(t('The reminder lead time must be between 0 and 60 days.'), 'error')
      return
    }

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      pricePerCycle: priceValue,
      billingCycleMonths: cycleValue,
      gracePeriodDays: graceValue,
      reminderLeadDays: reminderValue,
      isActive: active,
      sortOrder: Number(sortOrder) || 0,
    }

    try {
      if (plan) {
        await update.mutateAsync({ planId: plan.id, body })
      } else {
        await create.mutateAsync(body)
      }
      toast(plan ? t('Plan updated.') : t('Plan created.'))
      onSaved(plan ? t('Plan updated.') : t('Plan created.'))
      onClose()
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={plan ? t('Edit subscription plan') : t('New subscription plan')}
      description={t('Gyms inherit the plan price and cycle; Revive Admin can still override an individual gym amount.')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>{t('Cancel')}</Button>
          <Button onClick={handleSave} loading={pending}>{t('Save plan')}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('Plan name')} className="sm:col-span-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </Field>
        <Field label={t('Description')} className="sm:col-span-2">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={500} />
        </Field>
        <Field label={t('Price per cycle')}>
          <Input type="number" min="0.01" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
        <Field label={t('Billing cycle (months)')} hint={t('1 = monthly')}>
          <Input type="number" min="1" max="36" step="1" value={cycle} onChange={(event) => setCycle(event.target.value)} />
        </Field>
        <Field label={t('Grace period (days)')} hint={t('Blank uses the platform default.')}>
          <Input type="number" min="0" max="90" step="1" value={grace} onChange={(event) => setGrace(event.target.value)} />
        </Field>
        <Field label={t('Reminder lead (days)')} hint={t('Blank uses the platform default.')}>
          <Input type="number" min="0" max="60" step="1" value={reminder} onChange={(event) => setReminder(event.target.value)} />
        </Field>
        <Field label={t('Sort order')} hint={t('Lower numbers appear first.')}>
          <Input type="number" step="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        </Field>
        <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 p-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-slate-900">{t('Active (available for assignment)')}</span>
        </label>
      </div>
    </Dialog>
  )
}
