import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Field, Textarea } from '../../../components/ui/field'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { useSuspendSubscription } from '../hooks/useSubscriptions'

interface SuspendSubscriptionDialogProps {
  open: boolean
  onClose: () => void
  gymId: number
  gymName: string
  onSuspended: (message: string) => void
}

/** Manual suspension: Revive Admin blocks a gym's system access on demand. */
export function SuspendSubscriptionDialog({ open, onClose, gymId, gymName, onSuspended }: SuspendSubscriptionDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const suspend = useSuspendSubscription()
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  const handleSuspend = async () => {
    try {
      const result = await suspend.mutateAsync({ gymId, reason: reason.trim() })
      toast(result.message || t('Subscription suspended.'))
      onSuspended(result.message)
      onClose()
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Suspend system access')}
      description={t('{{gym}} will be signed out and blocked from the HR system until reactivated or the outstanding payment is recorded.', { gym: gymName })}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={suspend.isPending}>
            {t('Cancel')}
          </Button>
          <Button variant="danger" onClick={handleSuspend} loading={suspend.isPending}>
            {t('Suspend access')}
          </Button>
        </>
      }
    >
      <Field label={t('Reason')} hint={t('Shown in the billing audit trail. Optional.')}>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder={t('Why is this gym being suspended?')}
        />
      </Field>
    </Dialog>
  )
}
