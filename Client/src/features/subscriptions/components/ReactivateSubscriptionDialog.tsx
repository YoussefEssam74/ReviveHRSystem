import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Field, Input } from '../../../components/ui/field'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { useReactivateSubscription } from '../hooks/useSubscriptions'

interface ReactivateSubscriptionDialogProps {
  open: boolean
  onClose: () => void
  gymId: number
  gymName: string
  defaultOverrideDays: number
  onReactivated: (message: string) => void
}

/**
 * Manual reactivation without a payment. The override window is bounded so the
 * automation resumes once it elapses — access can never be opened indefinitely.
 */
export function ReactivateSubscriptionDialog({
  open,
  onClose,
  gymId,
  gymName,
  defaultOverrideDays,
  onReactivated,
}: ReactivateSubscriptionDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const reactivate = useReactivateSubscription()
  const [overrideDays, setOverrideDays] = useState(String(defaultOverrideDays))

  useEffect(() => {
    if (open) setOverrideDays(String(defaultOverrideDays))
  }, [open, defaultOverrideDays])

  const handleReactivate = async () => {
    const days = overrideDays.trim() === '' ? null : Number(overrideDays)
    if (days !== null && (!Number.isInteger(days) || days < 0 || days > 90)) {
      toast(t('The override window must be between 0 and 90 days.'), 'error')
      return
    }

    try {
      const result = await reactivate.mutateAsync({ gymId, overrideDays: days })
      toast(result.message || t('Subscription reactivated.'))
      onReactivated(result.message)
      onClose()
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Reactivate system access')}
      description={t('Restore access for {{gym}}. The override keeps access open for the chosen window, then the subscription automation resumes.', { gym: gymName })}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={reactivate.isPending}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleReactivate} loading={reactivate.isPending}>
            {t('Reactivate access')}
          </Button>
        </>
      }
    >
      <Field
        label={t('Override window (days)')}
        hint={t('0 ends the override immediately; the next billing sweep may suspend again if payment is still overdue.')}
      >
        <Input
          type="number"
          min="0"
          max="90"
          step="1"
          value={overrideDays}
          onChange={(event) => setOverrideDays(event.target.value)}
        />
      </Field>
    </Dialog>
  )
}
