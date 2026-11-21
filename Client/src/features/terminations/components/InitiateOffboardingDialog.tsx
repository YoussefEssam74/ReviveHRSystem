import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { useOffboardEmployee } from '../hooks/useTerminations'
import { describeApiError } from '../../../lib/api-client'
import { OFFBOARDING_REASONS, type EmployeeOption } from '../api/terminations.api'
import { EmployeePicker } from './EmployeePicker'

export interface InitiateOffboardingDialogProps {
  onClose: () => void
  /** Opens the freshly created case straight away. */
  onCreated?: (separationId: number) => void
}

/** E19 — HR starts an exit directly; the case begins in Notice Period. */
export function InitiateOffboardingDialog({ onClose, onCreated }: InitiateOffboardingDialogProps) {
  const { t } = useTranslation()
  const offboard = useOffboardEmployee()
  const [selected, setSelected] = useState<EmployeeOption | null>(null)
  const [lastDay, setLastDay] = useState('')
  const [reason, setReason] = useState<string>(OFFBOARDING_REASONS[0])
  const [notes, setNotes] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const canSubmit = selected != null && lastDay.trim().length > 0

  const onSubmit = async () => {
    if (!selected || !lastDay) return
    setActionError(null)
    try {
      const separationId = await offboard.mutateAsync({
        employeeId: selected.id,
        body: {
          lastDay,
          reason,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      })
      onClose()
      onCreated?.(separationId)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Initiate Offboarding')}
      description={t('The employee moves to Notice Period and the five-step exit checklist opens.')}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSubmit} loading={offboard.isPending} disabled={!canSubmit}>
            {t('Create offboarding checklist')}
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
          <Label htmlFor="offboard-employee">{t('Employee')}</Label>
          <EmployeePicker value={selected} onChange={setSelected} inputId="offboard-employee" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="offboard-last-day">{t('Last working day (required)')}</Label>
            <Input
              id="offboard-last-day"
              type="date"
              value={lastDay}
              onChange={(e) => setLastDay(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="offboard-reason">{t('Separation reason')}</Label>
            <Select id="offboard-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {OFFBOARDING_REASONS.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="offboard-notes">{t('Handover & exit notes')}</Label>
          <Textarea
            id="offboard-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('Handover partner, asset returns, replacement vacancy…')}
          />
        </div>
      </div>
    </Dialog>
  )
}
