import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Field, Input } from '../../../components/ui/field'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import type { SubscriptionSettings } from '../api/subscriptions.api'
import { useUpdateSubscriptionSettings } from '../hooks/useSubscriptions'

interface SubscriptionSettingsDialogProps {
  open: boolean
  onClose: () => void
  settings: SubscriptionSettings
  onSaved: (message: string) => void
}

/** Platform-wide cycle, grace, reminder lead and auto-suspension defaults. */
export function SubscriptionSettingsDialog({ open, onClose, settings, onSaved }: SubscriptionSettingsDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const update = useUpdateSubscriptionSettings()

  const [cycle, setCycle] = useState('1')
  const [grace, setGrace] = useState('7')
  const [lead, setLead] = useState('3')
  const [autoSuspension, setAutoSuspension] = useState(true)
  const [currency, setCurrency] = useState('EGP')

  useEffect(() => {
    if (!open) return
    setCycle(String(settings.defaultBillingCycleMonths))
    setGrace(String(settings.defaultGracePeriodDays))
    setLead(String(settings.reminderLeadDays))
    setAutoSuspension(settings.autoSuspensionEnabled)
    setCurrency(settings.currency)
  }, [open, settings])

  const handleSave = async () => {
    const cycleValue = Number(cycle)
    const graceValue = Number(grace)
    const leadValue = Number(lead)
    if (!Number.isInteger(cycleValue) || cycleValue < 1 || cycleValue > 36) {
      toast(t('The billing cycle must be between 1 and 36 months.'), 'error')
      return
    }
    if (!Number.isInteger(graceValue) || graceValue < 0 || graceValue > 90) {
      toast(t('The grace period must be between 0 and 90 days.'), 'error')
      return
    }
    if (!Number.isInteger(leadValue) || leadValue < 0 || leadValue > 60) {
      toast(t('The reminder lead time must be between 0 and 60 days.'), 'error')
      return
    }
    if (!currency.trim()) {
      toast(t('Enter a currency code.'), 'error')
      return
    }

    try {
      await update.mutateAsync({
        defaultBillingCycleMonths: cycleValue,
        defaultGracePeriodDays: graceValue,
        reminderLeadDays: leadValue,
        autoSuspensionEnabled: autoSuspension,
        currency: currency.trim().toUpperCase(),
      })
      toast(t('Billing settings saved.'))
      onSaved(t('Billing settings saved.'))
      onClose()
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Subscription billing settings')}
      description={t('These defaults apply to every gym without an override.')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} loading={update.isPending}>
            {t('Save settings')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('Default billing cycle (months)')} hint={t('1 = monthly')}>
          <Input type="number" min="1" max="36" step="1" value={cycle} onChange={(event) => setCycle(event.target.value)} />
        </Field>
        <Field label={t('Default grace period (days)')} hint={t('Access stays open during grace.')}>
          <Input type="number" min="0" max="90" step="1" value={grace} onChange={(event) => setGrace(event.target.value)} />
        </Field>
        <Field label={t('Reminder lead (days)')} hint={t('How early the payment reminder is sent.')}>
          <Input type="number" min="0" max="60" step="1" value={lead} onChange={(event) => setLead(event.target.value)} />
        </Field>
        <Field label={t('Currency')} hint={t('Shown on every amount and invoice.')}>
          <Input value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={10} />
        </Field>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={autoSuspension}
            onChange={(event) => setAutoSuspension(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">{t('Automatically suspend access after grace')}</span>
            <span className="block text-xs text-slate-500">
              {t('When off, overdue invoices never suspend a gym automatically. Manual suspensions still apply.')}
            </span>
          </span>
        </label>
      </div>
    </Dialog>
  )
}
