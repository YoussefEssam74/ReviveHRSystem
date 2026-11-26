import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Field, Input, Select } from '../../../components/ui/field'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney } from '../../../lib/format'
import type {
  GymSubscription,
  GymSubscriptionCandidate,
  SubscriptionPlan,
  SubscriptionSettings,
} from '../api/subscriptions.api'
import { useSaveSubscription } from '../hooks/useSubscriptions'

interface SubscriptionTermsDialogProps {
  open: boolean
  onClose: () => void
  /** Existing agreement's gym; null when setting up a new one. */
  gymId: number | null
  gymName: string
  existing: GymSubscription | null
  settings: SubscriptionSettings
  candidates: GymSubscriptionCandidate[]
  plans: SubscriptionPlan[]
  onSaved: (message: string) => void
}

/** Creates or edits a gym's plan, amount, cycle, grace window, reminder lead and next due date. */
export function SubscriptionTermsDialog({
  open,
  onClose,
  gymId,
  gymName,
  existing,
  settings,
  candidates,
  plans,
  onSaved,
}: SubscriptionTermsDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const save = useSaveSubscription()

  const [selectedGymId, setSelectedGymId] = useState<string>('')
  const [planId, setPlanId] = useState('')
  const [amount, setAmount] = useState('')
  const [cycleMonths, setCycleMonths] = useState('1')
  const [graceDays, setGraceDays] = useState('')
  const [reminderDays, setReminderDays] = useState('')
  const [autoSuspension, setAutoSuspension] = useState(true)
  const [billingStart, setBillingStart] = useState('')
  const [nextDueDate, setNextDueDate] = useState('')

  useEffect(() => {
    if (!open) return
    setSelectedGymId(String(gymId ?? candidates[0]?.gymId ?? ''))
    setPlanId(existing?.planId ? String(existing.planId) : '')
    setAmount(existing ? String(existing.amount) : '')
    setCycleMonths(String(existing?.billingCycleMonths ?? settings.defaultBillingCycleMonths))
    // Blank means "inherit the platform default"; only an explicit override is shown.
    setGraceDays(existing?.gracePeriodDaysOverride != null ? String(existing.gracePeriodDaysOverride) : '')
    setReminderDays(existing?.reminderLeadDaysOverride != null ? String(existing.reminderLeadDaysOverride) : '')
    setAutoSuspension(existing?.autoSuspensionEnabled ?? settings.autoSuspensionEnabled)
    setBillingStart(existing?.billingStartDate ?? '')
    setNextDueDate('')
  }, [open, gymId, existing, settings, candidates])

  const handlePlanChange = (value: string) => {
    setPlanId(value)
    const plan = plans.find((candidate) => candidate.id === Number(value))
    if (!plan) return
    setAmount(String(plan.pricePerCycle))
    setCycleMonths(String(plan.billingCycleMonths))
    if (plan.gracePeriodDays != null) setGraceDays(String(plan.gracePeriodDays))
    if (plan.reminderLeadDays != null) setReminderDays(String(plan.reminderLeadDays))
  }

  const targetGymId = gymId ?? Number(selectedGymId)
  const targetGymName =
    gymName || candidates.find((candidate) => candidate.gymId === targetGymId)?.gymName || ''

  const handleSave = async () => {
    if (!Number.isFinite(targetGymId) || targetGymId <= 0) {
      toast(t('Select a gym first.'), 'error')
      return
    }

    const amountValue = Number(amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast(t('Enter an amount greater than zero.'), 'error')
      return
    }

    const cycle = Number(cycleMonths)
    if (!Number.isInteger(cycle) || cycle < 1 || cycle > 36) {
      toast(t('The billing cycle must be between 1 and 36 months.'), 'error')
      return
    }

    const grace = graceDays.trim() === '' ? null : Number(graceDays)
    if (grace !== null && (!Number.isInteger(grace) || grace < 0 || grace > 90)) {
      toast(t('The grace period must be between 0 and 90 days.'), 'error')
      return
    }

    const reminder = reminderDays.trim() === '' ? null : Number(reminderDays)
    if (reminder !== null && (!Number.isInteger(reminder) || reminder < 0 || reminder > 60)) {
      toast(t('The reminder lead time must be between 0 and 60 days.'), 'error')
      return
    }

    try {
      const result = await save.mutateAsync({
        gymId: targetGymId,
        body: {
          amount: amountValue,
          billingCycleMonths: cycle,
          gracePeriodDays: grace,
          reminderLeadDays: reminder,
          autoSuspensionEnabled: autoSuspension,
          billingStartDate: billingStart || null,
          planId: planId ? Number(planId) : null,
          nextDueDate: nextDueDate || null,
        },
      })
      toast(result.message || t('Subscription terms saved.'))
      onSaved(result.message)
      onClose()
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? t('Edit subscription terms') : t('Set up gym billing')}
      description={
        existing
          ? t('Update the amount, cycle, grace window and reminder timing for {{gym}}.', { gym: targetGymName })
          : t('Start billing the monthly HR service for a gym.')
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} loading={save.isPending}>
            {t('Save terms')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!existing && (
          <Field label={t('Gym')} className="sm:col-span-2">
            <Select value={selectedGymId} onChange={(event) => setSelectedGymId(event.target.value)} disabled={gymId != null}>
              {gymId != null ? (
                <option value={gymId}>{targetGymName}</option>
              ) : (
                candidates.map((candidate) => (
                  <option key={candidate.gymId} value={candidate.gymId}>
                    {candidate.gymName}
                    {candidate.branch ? ` — ${candidate.branch}` : ''}
                  </option>
                ))
              )}
            </Select>
          </Field>
        )}

        <Field label={t('Amount per cycle')} hint={`${settings.currency}`}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="4500"
          />
        </Field>

        <Field label={t('Subscription plan')} hint={t('Selecting a plan fills its price and cycle; the amount below remains an optional override.')} className="sm:col-span-2">
          <Select value={planId} onChange={(event) => handlePlanChange(event.target.value)}>
            <option value="">{t('Custom / no plan')}</option>
            {plans
              .filter((plan) => plan.isActive || String(plan.id) === planId)
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatMoney(plan.pricePerCycle, settings.currency)}
                  {plan.isActive ? '' : ` (${t('Archived')})`}
                </option>
              ))}
          </Select>
        </Field>

        <Field label={t('Billing cycle (months)')} hint={t('1 = monthly')}>
          <Input
            type="number"
            min="1"
            max="36"
            step="1"
            value={cycleMonths}
            onChange={(event) => setCycleMonths(event.target.value)}
          />
        </Field>

        <Field
          label={t('Next due date')}
          hint={
            existing?.nextDueDate
              ? t('Current: {{date}}. Blank keeps the current schedule.', { date: formatDate(existing.nextDueDate, { withYear: 'always' }) })
              : t('Blank keeps the cycle schedule.')
          }
          className="sm:col-span-2"
        >
          <Input type="date" value={nextDueDate} onChange={(event) => setNextDueDate(event.target.value)} />
        </Field>

        <Field label={t('Grace period (days)')} hint={t('Blank uses platform default: {{days}} days', { days: settings.defaultGracePeriodDays })}>
          <Input
            type="number"
            min="0"
            max="90"
            step="1"
            value={graceDays}
            onChange={(event) => setGraceDays(event.target.value)}
          />
        </Field>

        <Field label={t('Reminder lead (days)')} hint={t('Blank uses platform default: {{days}} days', { days: settings.reminderLeadDays })}>
          <Input
            type="number"
            min="0"
            max="60"
            step="1"
            value={reminderDays}
            onChange={(event) => setReminderDays(event.target.value)}
          />
        </Field>

        <Field label={t('Billing start date')} hint={t('Blank starts today. The cycle anchors on this date.')} className="sm:col-span-2">
          <Input type="date" value={billingStart} onChange={(event) => setBillingStart(event.target.value)} />
        </Field>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={autoSuspension}
            onChange={(event) => setAutoSuspension(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">{t('Suspend access automatically after grace')}</span>
            <span className="block text-xs text-slate-500">
              {t('When off, overdue invoices keep the gym in grace and never suspend access automatically.')}
            </span>
          </span>
        </label>
      </div>
    </Dialog>
  )
}
