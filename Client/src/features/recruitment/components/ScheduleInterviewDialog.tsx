import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { describeApiError } from '../../../lib/api-client'
import { useScheduleInterview } from '../hooks/useRecruitment'
import type { CandidateCard } from '../api/recruitment.api'

const INTERVIEW_TYPES = ['On-site', 'Video', 'Trial', 'Panel']

export interface ScheduleInterviewDialogProps {
  candidate: CandidateCard
  /** "First Interview" | "Second Interview" — picks the round being (re)booked. */
  round: string
  onClose: () => void
}

/** Books (or re-books) one interview round for a candidate — POST /api/interviews. */
export function ScheduleInterviewDialog({ candidate, round, onClose }: ScheduleInterviewDialogProps) {
  const { t } = useTranslation()
  const schedule = useScheduleInterview()
  const current = round === 'Second Interview' ? candidate.iv2 : candidate.iv1
  const rescheduling = Boolean(current?.date)

  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [date, setDate] = useState(current?.date?.slice(0, 10) ?? today)
  const [time, setTime] = useState('10:00')
  const [type, setType] = useState(current?.type ?? 'On-site')
  const [interviewer, setInterviewer] = useState(current?.by ?? '')
  const [room, setRoom] = useState(current?.room ?? '')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!date || !time) {
      setError(t('Pick a date and a time for the interview.'))
      return
    }
    try {
      await schedule.mutateAsync({
        candidateId: candidate.id,
        ...(candidate.position ? { position: candidate.position } : {}),
        date,
        time,
        ...(type ? { type } : {}),
        ...(interviewer.trim() ? { interviewer: interviewer.trim() } : {}),
        ...(room.trim() ? { room: room.trim() } : {}),
      })
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Schedule interview — {{name}}', { name: candidate.name })}
      description={candidate.position ? `${t(round)} · ${candidate.position}` : t(round)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={submit} loading={schedule.isPending}>
            {rescheduling ? t('Reschedule interview') : t('Schedule interview')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {rescheduling && current?.date && (
          <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
            {t('Already booked for {{date}}. Saving replaces the booking.', { date: current.date })}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="interview-date">{t('Date')}</Label>
            <Input
              id="interview-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="interview-time">{t('Time')}</Label>
            <Input
              id="interview-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="interview-type">{t('Type')}</Label>
            <Select id="interview-type" value={type} onChange={(event) => setType(event.target.value)}>
              {INTERVIEW_TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="interview-room">{t('Room / link')}</Label>
            <Input
              id="interview-room"
              value={room}
              onChange={(event) => setRoom(event.target.value)}
              placeholder={t('e.g. Room 2 / meet link')}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="interview-interviewer">{t('Interviewer')}</Label>
            <Input
              id="interview-interviewer"
              value={interviewer}
              onChange={(event) => setInterviewer(event.target.value)}
              placeholder={t('Who runs the round?')}
            />
          </div>
        </div>
      </div>
    </Dialog>
  )
}
