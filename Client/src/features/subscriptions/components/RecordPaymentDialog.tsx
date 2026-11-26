import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Field, Input, Select, Textarea } from '../../../components/ui/field'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatMoney } from '../../../lib/format'
import { useRecordSubscriptionPayment } from '../hooks/useSubscriptions'

interface RecordPaymentDialogProps {
  open: boolean
  onClose: () => void
  gymId: number
  gymName: string
  currency: string
  outstanding: number
  onRecorded: (message: string) => void
}

const METHODS = ['BankTransfer', 'Cash', 'Card', 'Cheque', 'Online'] as const

/** Records a confirmed payment against the gym's oldest unpaid invoices. */
export function RecordPaymentDialog({
  open,
  onClose,
  gymId,
  gymName,
  currency,
  outstanding,
  onRecorded,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const record = useRecordSubscriptionPayment()

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<string>('BankTransfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setAmount(outstanding > 0 ? String(outstanding.toFixed(2)) : '')
    setMethod('BankTransfer')
    setReference('')
    setNotes('')
  }, [open, outstanding])

  const handleRecord = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      toast(t('Enter a payment amount greater than zero.'), 'error')
      return
    }
    if (value > outstanding + 0.005) {
      toast(t('The payment cannot exceed the outstanding balance of {{amount}}.', { amount: formatMoney(outstanding, currency) }), 'error')
      return
    }

    try {
      const result = await record.mutateAsync({
        gymId,
        body: {
          amount: value,
          method,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        },
      })
      toast(result.message || t('Payment recorded.'))
      onRecorded(result.message)
      onClose()
    } catch (error) {
      toast(describeApiError(error), 'error')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Record subscription payment')}
      description={t('Confirm the payment received from {{gym}}. The oldest unpaid invoice is settled first.', { gym: gymName })}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={record.isPending}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleRecord} loading={record.isPending}>
            {t('Record payment')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('Outstanding balance')} className="sm:col-span-2">
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
            {formatMoney(outstanding, currency)}
          </p>
        </Field>

        <Field label={t('Amount received')} hint={`${currency}`}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        <Field label={t('Payment method')}>
          <Select value={method} onChange={(event) => setMethod(event.target.value)}>
            {METHODS.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('Reference')} hint={t('Bank transfer number, cheque number, receipt id…')} className="sm:col-span-2">
          <Input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} />
        </Field>

        <Field label={t('Notes')} className="sm:col-span-2">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={500} />
        </Field>
      </div>
    </Dialog>
  )
}
