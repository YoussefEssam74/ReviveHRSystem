import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { useInitiateSeparation } from '../hooks/useTerminations'
import { describeApiError } from '../../../lib/api-client'
import { TERMINATION_REASONS, type EmployeeOption } from '../api/terminations.api'
import { EmployeePicker } from './EmployeePicker'

export interface InitiateSeparationDialogProps {
  onClose: () => void
  /** Opens the freshly created case straight away. */
  onCreated?: (separationId: number) => void
}

/** T2 — the Branch Manager flags who needs to leave; HR receives it in "Requested". */
export function InitiateSeparationDialog({ onClose, onCreated }: InitiateSeparationDialogProps) {
  const { t } = useTranslation()
  const initiate = useInitiateSeparation()
  const [selected, setSelected] = useState<EmployeeOption | null>(null)
  const [lastDay, setLastDay] = useState('')
  const [reason, setReason] = useState<string>(TERMINATION_REASONS[0])
  const [notes, setNotes] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const canSubmit = selected != null && lastDay.trim().length > 0

  const onSubmit = async () => {
    if (!selected || !lastDay) return
    setActionError(null)
    try {
      const created = await initiate.mutateAsync({
        employeeId: selected.id,
        lastDay,
        reason,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      onClose()
      onCreated?.(created.id)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Request Termination')}
      description={t(
        'The Branch Manager flags who needs to leave. HR receives it in Requested, follows the exit steps, then records the verdict.',
      )}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="dangerOutline" onClick={onSubmit} loading={initiate.isPending} disabled={!canSubmit}>
            {t('Submit to HR')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {actionError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}

        <div>
          <Label htmlFor="request-employee">{t('Employee')}</Label>
          <EmployeePicker value={selected} onChange={setSelected} inputId="request-employee" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="last-day">{t('Last working day (required)')}</Label>
            <Input id="last-day" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="reason">{t('Termination reason')}</Label>
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {TERMINATION_REASONS.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="notes">{t('BM notes')}</Label>
          <Textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('Brief context for HR…')}
          />
        </div>
      </div>
    </Dialog>
  )
}
