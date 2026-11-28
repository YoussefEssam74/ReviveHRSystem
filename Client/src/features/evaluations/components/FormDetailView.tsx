import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { useFormApplications } from '../../recruitment/hooks/useRecruitment'
import { ApplicantAnswersDialog } from '../../recruitment/components/ApplicantAnswersDialog'
import type { FormApplication } from '../../recruitment/api/recruitment.api'
import type { EvaluationForm, EvaluationResponseRow, HiringForm } from '../api/evaluations.api'
import { useEvaluationForm, useEvaluationResponses, useHiringForm } from '../hooks/useEvaluations'
import { formStatusClass, kindBadgeClass, questionTypeLabel, scoreTone } from './evaluation-format'
import { EmptyPanel, InitialsAvatar } from './evaluation-ui'

const APPLICANT_TONE: Record<string, string> = {
  New: 'badge-blue',
  'In Review': 'badge-yellow',
  Shortlisted: 'badge-purple',
  Rejected: 'badge-red',
  'Moved to Pipeline': 'badge-success',
}

export interface FormDetailViewProps {
  kind: 'evaluation' | 'hiring'
  /** List card — renders instantly while the detail GET refreshes questions. */
  form: EvaluationForm | HiringForm
  canEdit: boolean
  canRun: boolean
  /** Applications need recruitment.view; hide the panel when it is missing. */
  canSeeApplicants: boolean
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onRun: () => void
  onViewResponse: (response: EvaluationResponseRow) => void
}

/**
 * Form detail (mock `fbDetailPage`): meta strip, collapsible questions, then the
 * "who completed this form" list (or the applicant list for hiring forms).
 */
export function FormDetailView({
  kind,
  form,
  canEdit,
  canRun,
  canSeeApplicants,
  onBack,
  onEdit,
  onDelete,
  onRun,
  onViewResponse,
}: FormDetailViewProps) {
  const { t } = useTranslation()
  const [showQuestions, setShowQuestions] = useState(false)
  const [openApplication, setOpenApplication] = useState<FormApplication | null>(null)

  const evaluationDetail = useEvaluationForm(kind === 'evaluation' ? form.id : null)
  const hiringDetail = useHiringForm(kind === 'hiring' ? form.id : null)
  const detail = kind === 'evaluation' ? evaluationDetail.data : hiringDetail.data
  const questions = (detail?.questionList ?? form.questionList) || []
  const current = detail ?? form
  const isEvaluation = kind === 'evaluation'

  const responses = useEvaluationResponses({ formId: form.id, page: 1, pageSize: 50 }, isEvaluation)
  const applications = useFormApplications(
    { formId: form.id, page: 1, pageSize: 50 },
    !isEvaluation && canSeeApplicants,
  )

  const submissionCount = isEvaluation ? (responses.data?.total ?? (form as EvaluationForm).submissions) : 0
  const applicantCount = isEvaluation ? 0 : (form as HiringForm).applicants

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
          {t('← All Forms')}
        </Button>
        <div className="flex flex-wrap items-center gap-1.5">
          {canRun && isEvaluation && current.status === 'Active' && (
            <Button size="sm" onClick={onRun}>
              {t('Run Now')}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              {t('Edit')}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="dangerOutline" onClick={onDelete}>
              {t('Delete')}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-charcoal-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('badge text-[9px]', kindBadgeClass(kind))}>
            {isEvaluation ? t('Evaluation Form') : t('Hiring Form')}
          </span>
          <p className="text-sm font-bold text-charcoal-900">{current.name}</p>
          <span className={cn('badge text-[9px]', formStatusClass(current.status))}>{t(current.status)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-charcoal-500">          <span>
            {t('Target:')}{' '}
            <span className="font-semibold text-charcoal-700">
              {current.position && current.position !== 'All'
                ? current.position
                : t(isEvaluation ? 'All Staff' : 'All Positions')}
            </span>
          </span>
          <span>
            {t('Branches:')}{' '}
            <span className="font-semibold text-charcoal-700">{current.gym === 'All' ? t('All') : current.gym}</span>
          </span>
          <span>
            {t('Questions:')} <span className="font-semibold text-charcoal-700">{questions.length}</span>
          </span>
          {current.createdDate && (
            <span>
              {t('Created:')} <span className="font-semibold text-charcoal-700">{formatDate(current.createdDate)}</span>
            </span>
          )}
          <span>
            {isEvaluation ? t('Submissions:') : t('Applicants:')}{' '}
            <span className="font-semibold text-charcoal-700">{isEvaluation ? submissionCount : applicantCount}</span>
          </span>
        </div>

        {!isEvaluation && current.description && (
          <div className="mt-2.5 rounded-lg border border-charcoal-100 bg-charcoal-50 p-2.5">
            <p className="bento-label text-charcoal-500">{t('JOB DESCRIPTION')}</p>
            <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-charcoal-700">
              {current.description}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-charcoal-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="bento-label text-charcoal-500">{t('QUESTIONS ({{count}})', { count: questions.length })}</p>
          <Button size="sm" variant="secondary" onClick={() => setShowQuestions((open) => !open)}>
            {showQuestions ? t('Hide Questions ▴') : t('Show Questions ▾')}
          </Button>
        </div>
        {showQuestions && (
          <div className="mt-2.5 max-h-[35vh] space-y-2 overflow-y-auto pe-1">
            {questions.length === 0 ? (
              <p className="text-xs text-charcoal-400">{t('No questions yet.')}</p>
            ) : (
              questions.map((question, index) => (
                <div
                  key={`${question.text}-${index}`}
                  className="flex items-start gap-2.5 rounded-lg border border-charcoal-200 bg-charcoal-50 p-2.5"
                >
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-charcoal-800">{question.text}</p>
                      <span className="badge badge-brand flex-shrink-0 text-[8px]">
                        {t(questionTypeLabel(question.type))}
                      </span>
                    </div>
                    {question.options.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {question.options.map((option) => (
                          <span
                            key={option}
                            className="rounded border border-charcoal-200 bg-white px-1.5 py-0.5 text-[9px] text-charcoal-600"
                          >
                            {option}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {isEvaluation ? (
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-100 px-4 py-2.5">
            <p className="bento-label text-charcoal-500">{t('WHO COMPLETED THIS FORM')}</p>
            <p className="text-[10px] text-charcoal-400">{t('Click an employee to see their answers')}</p>
          </div>

          {responses.error ? (
            <ErrorState message={describeApiError(responses.error)} />
          ) : responses.isLoading || !responses.data ? (
            <LoadingState label={t('Loading responses…')} />
          ) : responses.data.items.length === 0 ? (
            <div className="p-4">
              <EmptyPanel
                title={t('No submissions yet')}
                hint={t('Run this form from the Evaluations page to see completions here.')}
              />
            </div>
          ) : (
            <div className="divide-y divide-charcoal-50">
              {responses.data.items.map((response) => (
                <div key={response.id} className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-charcoal-50">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar name={response.employee} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-charcoal-900">{response.employee}</p>
                      <p className="truncate text-[10px] text-charcoal-400">
                        {[response.period, response.reviewedBy ? t('Reviewed by {{name}}', { name: response.reviewedBy }) : null, formatDate(response.reviewedDate)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-end">
                      <p className={cn('text-sm font-bold', scoreTone(response.score))}>{response.score ?? '—'}%</p>
                      <p className="text-[9px] text-charcoal-400">{t(response.status)}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => onViewResponse(response)}>
                      {t('View Answers')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-100 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="bento-label text-charcoal-500">{t('WHO APPLIED')}</p>
              <span className="badge badge-brand text-[9px]">{applicantCount}</span>
            </div>
            <p className="text-[10px] text-charcoal-400">{t('Review answers or continue in Recruitment')}</p>
          </div>

          {!canSeeApplicants ? (
            <p className="p-4 text-xs text-charcoal-400">
              {t('Applicant answers need recruitment access — ask an administrator for the recruitment feature.')}
            </p>
          ) : applications.error ? (
            <ErrorState message={describeApiError(applications.error)} />
          ) : applications.isLoading || !applications.data ? (
            <LoadingState label={t('Loading applicants…')} />
          ) : applications.data.items.length === 0 ? (
            <div className="p-4">
              <EmptyPanel title={t('No applications yet')} hint={t('Applications submitted through this form appear here.')} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {applications.data!.items.map((application) => (
                <div
                  key={application.id}
                  className="flex flex-col justify-between rounded-xl border border-charcoal-200 bg-charcoal-50 p-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <InitialsAvatar name={application.name} tone="blue" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-charcoal-900">{application.name}</p>
                          <p className="truncate text-[10px] text-charcoal-400">
                            {[application.position, application.gym].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
                      <span className={cn('badge text-[9px]', APPLICANT_TONE[application.status] ?? 'badge-gray')}>
                        {t(application.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] text-charcoal-500">
                      {t('Applied {{date}}', { date: formatDate(application.appliedDate) })} ·{' '}
                      {t('{{count}} answers', { count: application.answers.length })}
                      {application.phone ? ` · ${application.phone}` : ''}
                    </p>
                  </div>
                  <div className="mt-3 border-t border-charcoal-200 pt-2">
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => setOpenApplication(application)}>
                      {t('View Answers')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {openApplication && (
        <ApplicantAnswersDialog application={openApplication} onClose={() => setOpenApplication(null)} />
      )}
    </div>
  )
}
