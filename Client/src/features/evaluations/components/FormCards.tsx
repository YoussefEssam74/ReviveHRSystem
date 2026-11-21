import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { EvaluationForm, HiringForm } from '../api/evaluations.api'
import { formStatusClass, kindBadgeClass, questionTypeLabel } from './evaluation-format'
import { FormMetaLine } from './evaluation-ui'

/** Active evaluation card: live counters plus Dispatch / Run Now / Edit. */
export function RunningFormCard({
  form,
  inProgress,
  canRun,
  canEdit,
  onDispatch,
  onRun,
  onEdit,
  onOpen,
}: {
  form: EvaluationForm
  inProgress: number
  canRun: boolean
  canEdit: boolean
  onDispatch: () => void
  onRun: () => void
  onEdit: () => void
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const firstQuestion = form.questionList[0]

  return (
    <div className="rounded-xl border border-charcoal-200 border-s-4 border-s-brand-500 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge badge-success text-[9px]">{t('Active')}</span>
          <span className="badge badge-brand text-[9px]">{t('Evaluation')}</span>
          {inProgress > 0 && (
            <span className="badge badge-blue text-[9px]">{t('{{count}} in progress', { count: inProgress })}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {canRun && (
            <Button size="sm" onClick={onDispatch}>
              {t('Dispatch')}
            </Button>
          )}
          {canRun && (
            <Button size="sm" variant="secondary" onClick={onRun}>
              {t('Run Now')}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              {t('Edit')}
            </Button>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-xs font-bold text-charcoal-900">{form.name}</p>
      <FormMetaLine
        questions={form.questions}
        position={form.position}
        gym={form.gym}
        created={form.createdDate ? formatDate(form.createdDate) : undefined}
      />
      {firstQuestion && (
        <p className="mt-1 truncate text-[10px] text-charcoal-400" title={firstQuestion.text}>
          • {firstQuestion.text}
          {form.questions > 1 ? ` +${form.questions - 1} ${t('more…')}` : ''}
        </p>
      )}

      <div className="mt-1.5 flex items-center justify-between border-t border-charcoal-100 pt-1.5">
        <p className="text-[10px] text-charcoal-500">
          {form.submissions === 1 ? t('1 submission') : t('{{count}} submissions', { count: form.submissions })}
          {inProgress > 0
            ? ` · ${inProgress === 1 ? t('1 in progress') : t('{{count}} in progress', { count: inProgress })}`
            : ''}
        </p>
        <button type="button" onClick={onOpen} className="text-[10px] font-semibold text-brand-600 hover:underline">
          {t('View Responses →')}
        </button>
      </div>
    </div>
  )
}

/** Archived / hiring card: badges, first questions and a single Open action. */
export function FormCard({
  kind,
  form,
  onOpen,
}: {
  kind: 'evaluation' | 'hiring'
  form: EvaluationForm | HiringForm
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const questions = form.questionList
  const count = kind === 'evaluation' ? (form as EvaluationForm).submissions : (form as HiringForm).applicants

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col justify-between rounded-xl border border-charcoal-200 bg-white p-3.5 text-start transition-all hover:border-brand-300 hover:shadow-sm"
    >
      <div className="w-full">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('badge text-[9px]', kindBadgeClass(kind))}>
            {kind === 'evaluation' ? t('Evaluation') : t('Hiring')}
          </span>
          <span className={cn('badge text-[9px]', formStatusClass(form.status))}>{t(form.status)}</span>
        </div>
        <p className="mt-1.5 text-xs font-bold text-charcoal-900">{form.name}</p>
        <FormMetaLine questions={form.questions} position={form.position} gym={form.gym} />

        {questions.length > 0 && (
          <div className="mt-2.5 space-y-1 rounded-lg border border-charcoal-100 bg-charcoal-50 p-2">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-charcoal-400">{t('Questions')}</p>
            {questions.slice(0, 3).map((question, index) => (
              <p key={`${question.text}-${index}`} className="truncate text-[10px] text-charcoal-600">
                • {question.text}
                {question.type !== 'text' && (
                  <span className="badge badge-brand ms-1 text-[8px]">{t(questionTypeLabel(question.type))}</span>
                )}
              </p>
            ))}
            {questions.length > 3 && (
              <p className="text-[9px] text-charcoal-400">{t('+{{count}} more…', { count: questions.length - 3 })}</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex w-full items-center justify-between border-t border-charcoal-100 pt-2">
        <p className="text-[10px] text-charcoal-500">
          {kind === 'evaluation'
            ? count === 1
              ? t('1 submission')
              : t('{{count}} submissions', { count })
            : count === 1
              ? t('1 applicant')
              : t('{{count}} applicants', { count })}
        </p>
        <p className="text-[10px] font-semibold text-brand-600">{t('Open →')}</p>
      </div>
    </button>
  )
}
