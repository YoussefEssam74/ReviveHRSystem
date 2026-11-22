import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { describeApiError } from '../../../lib/api-client'
import { useScheduleExitInterview } from '../hooks/useTerminations'
import type { Separation } from '../api/terminations.api'
import { isoFromLocalInputs, localDateTimeInputs, todayInputValue } from './termination-ui'

export interface ScheduleInterviewDialogProps {
  separation: Separation
  onClose: () => void
}

/** Books (or re-books) the exit interview date and time. */
export function ScheduleInterviewDialog({ separation, onClose }: ScheduleInterviewDialogProps) {
  const { t } = useTranslation()
  const existing = localDateTimeInputs(separation.exitInterviewScheduledAt)
  const [date, setDate] = useState(existing.date || todayInputValue())
  const [time, setTime] = useState(existing.time || '10:00')
  const [actionError, setActionError] = useState<string | null>(null)
  const schedule = useScheduleExitInterview()
  const rescheduling = separation.exitInterviewScheduledAt != null

  const submit = async () => {
    const scheduledAt = isoFromLocalInputs(date, time)
    if (!scheduledAt) {
      setActionError(t('Choose the interview date and time.'))
      return
    }

    setActionError(null)
    try {
      await schedule.mutateAsync({ id: separation.id, scheduledAt })
      onClose()
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={rescheduling ? t('Reschedule exit interview') : t('Schedule exit interview')}
      description={t('{{name}} · {{position}} · {{gym}}', {
        name: separation.employee,
        position: separation.position,
        gym: separation.gym,
      })}
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={() => void submit()} loading={schedule.isPending}>
            {rescheduling ? t('Save new slot') : t('Schedule')}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        {actionError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="interview-date">{t('Interview date')}</Label>
            <Input
              id="interview-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="interview-time">{t('Interview time')}</Label>
            <Input
              id="interview-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </div>
        </div>

        <p className="rounded-lg bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-500">
          {t('HR conducts the exit interview, then records clearance to release the final settlement.')}
        </p>

        {/* Keeps Enter-to-submit inside the form while the footer button lives outside it. */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  )
}
