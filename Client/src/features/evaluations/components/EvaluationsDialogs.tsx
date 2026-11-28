import { useTranslation } from 'react-i18next'
import { AnswerValue } from '../../../components/ui/answer-value'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { formatDate, formatDateTime } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { EvaluationForm, EvaluationResponseRow } from '../api/evaluations.api'
import type { FormKind } from './FormBuilder'
import { scoreTone } from './evaluation-format'

export interface EvaluationsDialogsProps {
  deleting: { kind: FormKind; id: number; name: string } | null
  onCloseDeleting: () => void
  onDeleteConfirm: () => void
  deletingPending: boolean

  dispatching: EvaluationForm | null
  onCloseDispatching: () => void
  onDispatchConfirm: () => void
  dispatchPending: boolean

  selectedResponse: EvaluationResponseRow | null
  onCloseResponse: () => void
}

/**
 * Delete / dispatch / answers dialogs. Kept outside the page's view switch so the
 * detail view can open them too (delete, view answers).
 */
export function EvaluationsDialogs({
  deleting,
  onCloseDeleting,
  onDeleteConfirm,
  deletingPending,
  dispatching,
  onCloseDispatching,
  onDispatchConfirm,
  dispatchPending,
  selectedResponse,
  onCloseResponse,
}: EvaluationsDialogsProps) {
  const { t } = useTranslation()

  return (
    <>


      <Dialog
        open={deleting != null}
        onClose={onCloseDeleting}
        title={t('Delete form')}
        description={deleting?.name}
        footer={
          <>
            <Button variant="outline" onClick={onCloseDeleting}>
              {t('Cancel')}
            </Button>
            <Button variant="danger" onClick={onDeleteConfirm} loading={deletingPending}>
              {t('Delete form')}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-charcoal-700">
          <p>{t('The form and its questions are removed permanently. This cannot be undone.')}</p>
          {deleting?.kind === 'evaluation' && (
            <p className="text-charcoal-500">
              {t('Forms that already have responses cannot be deleted — set their status to Inactive instead.')}
            </p>
          )}
          {deleting?.kind === 'hiring' && (
            <p className="text-charcoal-500">{t('Forms with applications cannot be deleted — close them instead.')}</p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={dispatching != null}
        onClose={onCloseDispatching}
        title={t('Dispatch form')}
        description={dispatching?.name}
        footer={
          <>
            <Button variant="outline" onClick={onCloseDispatching}>
              {t('Cancel')}
            </Button>
            <Button onClick={onDispatchConfirm} loading={dispatchPending}>
              {t('Dispatch to evaluators')}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-charcoal-700">
          <p>
            {t(
              "Routes this form to every eligible evaluator in scope. Subjects are matched to the form's gym and target position; assignments already routed are skipped.",
            )}
          </p>
        </div>
      </Dialog>

      <Dialog
        open={selectedResponse != null}
        onClose={onCloseResponse}
        title={t('Evaluation')}
        description={selectedResponse ? `${selectedResponse.employee} · ${selectedResponse.form}` : undefined}
        className="max-w-xl"
        footer={
          <Button variant="outline" onClick={onCloseResponse}>
            {t('Close')}
          </Button>
        }
      >
        {selectedResponse && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'badge',
                  selectedResponse.status === 'Completed'
                    ? 'badge-success'
                    : selectedResponse.status === 'In Progress'
                      ? 'badge-blue'
                      : 'badge-gray',
                )}
              >
                {t(selectedResponse.status)}
              </span>
              {selectedResponse.score != null && (
                <span className={cn('badge', 'badge-gray', scoreTone(selectedResponse.score))}>
                  {selectedResponse.score} / 100
                </span>
              )}
              {selectedResponse.period && <span className="badge badge-gray">{selectedResponse.period}</span>}
              {selectedResponse.gym && <span className="badge badge-gray">{selectedResponse.gym}</span>}
            </div>

            <dl className="divide-y divide-charcoal-100 rounded-xl border border-charcoal-200 text-sm">
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-charcoal-500">{t('Reviewed by')}</dt>
                <dd className="font-medium text-charcoal-900">{selectedResponse.reviewedBy || '—'}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-charcoal-500">{t('Reviewed')}</dt>
                <dd className="font-medium text-charcoal-900">{formatDateTime(selectedResponse.reviewedDate)}</dd>
              </div>
            </dl>

            <div>
              <p className="text-sm font-semibold text-charcoal-900">{t('Answers')}</p>
              {selectedResponse.answers.length === 0 ? (
                <p className="mt-1 text-sm text-charcoal-500">{t('No answers recorded yet.')}</p>
              ) : (
                <ul className="mt-2 divide-y divide-charcoal-100 rounded-xl border border-charcoal-200">
                  {selectedResponse.answers.map((answer, index) => (
                    <li key={`${answer.question}-${index}`} className="px-3 py-2 text-sm">
                      <p className="font-medium text-charcoal-800">{answer.question}</p>
                      <div className="mt-0.5 text-charcoal-600">
                        <AnswerValue answer={answer.answer} className="text-sm text-charcoal-600" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedResponse.notes && (
              <div>
                <p className="text-sm font-semibold text-charcoal-900">{t('Notes')}</p>
                <p className="mt-1 text-sm italic text-charcoal-600">“{selectedResponse.notes}”</p>
              </div>
            )}

            <p className="text-xs text-charcoal-500">
              {t(
                'Submitted {{date}} · Scores at or above 60 pass; lower scores read “Below Target” on the employee file.',
                { date: formatDate(selectedResponse.reviewedDate) },
              )}
            </p>
          </div>
        )}
      </Dialog>
    </>
  )
}
