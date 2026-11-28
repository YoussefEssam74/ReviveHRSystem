import { useTranslation } from 'react-i18next'
import { CalendarDays, Mail, Phone } from 'lucide-react'
import { AnswerValue } from '../../../components/ui/answer-value'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { FormApplication } from '../api/recruitment.api'

const STATUS_TONE: Record<string, string> = {
  New: 'badge-blue',
  'In Review': 'badge-yellow',
  Shortlisted: 'badge-purple',
  Rejected: 'badge-red',
  'Moved to Pipeline': 'badge-success',
}

export interface ApplicantAnswersDialogProps {
  application: FormApplication
  onClose: () => void
}

/** Read-only view of a hiring-form submission: contact, status and every answer. */
export function ApplicantAnswersDialog({ application, onClose }: ApplicantAnswersDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open
      onClose={onClose}
      title={application.name}
      description={
        [application.position, application.gym, application.formName].filter(Boolean).join(' · ') || undefined
      }
      className="sm:max-w-2xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          {t('Close')}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('badge text-[10px]', STATUS_TONE[application.status] ?? 'badge-gray')}>
            {t(application.status)}
          </span>
          <span className="badge badge-gray text-[10px]">
            <CalendarDays className="me-1 h-3 w-3" aria-hidden="true" />
            {t('Applied {{date}}', { date: formatDate(application.appliedDate) })}
          </span>
          {application.email && (
            <a href={`mailto:${application.email}`} className="badge badge-gray text-[10px] hover:underline">
              <Mail className="me-1 h-3 w-3" aria-hidden="true" />
              {application.email}
            </a>
          )}
          {application.phone && (
            <a href={`tel:${application.phone}`} className="badge badge-gray text-[10px] hover:underline">
              <Phone className="me-1 h-3 w-3" aria-hidden="true" />
              {application.phone}
            </a>
          )}
        </div>

        {application.status === 'Rejected' && application.rejectComment && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {t('Rejected: {{comment}}', { comment: application.rejectComment })}
          </p>
        )}

        {application.answers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-charcoal-200 px-3 py-6 text-center text-xs text-charcoal-400">
            {t('This application has no stored answers.')}
          </p>
        ) : (
          <dl className="divide-y divide-charcoal-100 rounded-lg border border-charcoal-200">
            {application.answers.map((answer, index) => (
              <div key={`${answer.question}-${index}`} className="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <dt className="text-xs font-medium text-charcoal-600">
                  {answer.question}
                  {answer.type && <span className="ms-1 text-[9px] font-normal text-charcoal-400">({answer.type})</span>}
                </dt>
                <dd>
                  <AnswerValue answer={answer.answer} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Dialog>
  )
}
