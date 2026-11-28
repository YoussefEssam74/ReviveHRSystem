import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { LoadingState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { useEmployees } from '../../employees/hooks/useEmployees'
import type { DispatchAssignment, EvaluationForm } from '../api/evaluations.api'
import { useLaunchEvaluationCycle, useSubmitEvaluation } from '../hooks/useEvaluations'
import { scoreBarTone, scoreTone } from './evaluation-format'
import { EmptyPanel } from './evaluation-ui'

const PERIODS = ['Q3 2026', 'Mid-Year Review 2026', 'Probation Review']
const RATING_TITLES = ['', 'Poor (1)', 'Fair (2)', 'Good (3)', 'Very Good (4)', 'Excellent (5)']

/** Mock's score → verdict bands for the live preview. */
function verdictOf(percent: number): string {
  if (percent >= 85) return 'Outstanding'
  if (percent >= 75) return 'Exceeds Expectations'
  if (percent >= 60) return 'Meets Expectations'
  return 'Needs Improvement'
}

export interface EvaluationRunViewProps {
  /** Active evaluation forms — the run view only ever scores Active templates. */
  forms: EvaluationForm[]
  initialFormId: number | null
  /** When set, the form + subjects are pinned to this routed assignment. */
  assignment: DispatchAssignment | null
  onExit: () => void
  onSubmitted: (message: string) => void
  onCycleLaunched: (message: string) => void
}

/**
 * Run Evaluation (mock `renderEvaluationRunView`): setup + live score on the
 * left, the scored question list on the right. Free-run picks any eligible
 * employee; assigned mode pins the routed form and its subject list.
 */
export function EvaluationRunView({
  forms,
  initialFormId,
  assignment,
  onExit,
  onSubmitted,
  onCycleLaunched,
}: EvaluationRunViewProps) {
  const { t } = useTranslation()
  const [formId, setFormId] = useState<number | null>(initialFormId ?? forms[0]?.id ?? null)
  // Free-run only ever scores Active templates; an assignment pins its own form
  // even if that template was archived after dispatch.
  const selectableForms = assignment
    ? forms.filter((candidate) => candidate.id === assignment.formId)
    : forms.filter((candidate) => candidate.status === 'Active')
  const form = selectableForms.find((candidate) => candidate.id === formId) ?? selectableForms[0] ?? null

  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [period, setPeriod] = useState(PERIODS[0])
  const [scores, setScores] = useState<Record<number, number>>({})
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const employees = useEmployees({ status: 'Active', page: 1, pageSize: 200 })
  const submit = useSubmitEvaluation()
  const launchCycle = useLaunchEvaluationCycle()

  const questions = form?.questionList ?? []

  // Dispatch scoping: assigned mode pins the routed subjects; free-run applies
  // the form's target position and branch to the active directory.
  const eligible = (employees.data?.items ?? []).filter((employee) => {
    if (assignment) return assignment.subjects.includes(employee.name)
    if (form?.position && form.position !== 'All' && form.position !== 'All Staff' && employee.position !== form.position) {
      return false
    }
    if (form?.gym && form.gym !== 'All' && employee.gym !== form.gym) return false
    return true
  })

  const selectedEmployee = eligible.find((employee) => employee.id === employeeId) ?? eligible[0] ?? null

  const totalPoints = questions.reduce((sum, _question, index) => sum + (scores[index] ?? 4), 0)
  const maxPoints = questions.length * 5
  const percentScore = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0

  const answerText = (index: number): string => {
    const value = answers[index]
    return Array.isArray(value) ? value.join(', ') : (value ?? '')
  }

  const onSubmit = async () => {
    if (!form || !selectedEmployee) return
    setError(null)
    try {
      await submit.mutateAsync({
        formId: form.id,
        body: {
          employeeId: selectedEmployee.id,
          employee: selectedEmployee.name,
          period,
          score: percentScore,
          notes: notes.trim() || undefined,
          answers: questions.map((question, index) => ({
            question: question.text,
            type: question.type || 'text',
            answer: answerText(index),
          })),
          assignmentId: assignment?.id,
        },
      })
      const employeeName = selectedEmployee.name
      setScores({})
      setAnswers({})
      setNotes('')
      onSubmitted(t('Evaluation submitted for {{name}} ({{score}}%)', { name: employeeName, score: percentScore }))
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  const onLaunchCycle = async () => {
    if (!form) return
    setError(null)
    try {
      const result = await launchCycle.mutateAsync({ formId: form.id, period })
      onCycleLaunched(t('Evaluation round launched for {{count}} staff members', { count: result.startedCount }))
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  if (!form) {
    return (
      <div className="space-y-2.5">
        <RunHeader onExit={onExit} />
        <EmptyPanel title={t('No active evaluation form')} hint={t('Create a form and keep its status Active, then run it here.')} />
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <RunHeader onExit={onExit} />

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column: setup & score preview */}
        <div className="space-y-3">
          <div className="rounded-xl border border-charcoal-200 bg-white p-4">
            <p className="bento-label mb-3 text-charcoal-500">{t('SELECT EMPLOYEE & FORM')}</p>
            <div className="space-y-3">
              {!assignment && (
                <div>
                  <label className="form-label" htmlFor="eval-run-form">
                    {t('Evaluation Form')}
                  </label>
                  <select
                    id="eval-run-form"
                    className="form-select"
                    value={form.id}
                    onChange={(event) => {
                      // A new template means a new question set — stale scores cannot carry over.
                      setFormId(Number(event.target.value))
                      setScores({})
                      setAnswers({})
                      setError(null)
                    }}
                  >
                    {selectableForms.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="form-label" htmlFor="eval-run-employee">
                  {t('Employee to Review')}
                </label>
                {employees.isLoading ? (
                  <LoadingState label={t('Loading employees…')} />
                ) : eligible.length === 0 ? (
                  <p className="rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-500">
                    {t('No active employees match this form’s target and branch.')}
                  </p>
                ) : (
                  <select
                    id="eval-run-employee"
                    className="form-select"
                    value={selectedEmployee?.id ?? ''}
                    onChange={(event) => setEmployeeId(Number(event.target.value))}
                  >
                    {eligible.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} ({employee.position} · {employee.gym})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="form-label" htmlFor="eval-run-period">
                  {t('Review Period')}
                </label>
                <select
                  id="eval-run-period"
                  className="form-select"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                >
                  {PERIODS.map((option) => (
                    <option key={option} value={option}>
                      {t(option)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-brand-200 border-s-4 border-s-brand-500 bg-white p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-400">{t('LIVE CALCULATED SCORE')}</p>
            <p className={cn('mt-1 text-3xl font-extrabold', scoreTone(percentScore))}>{percentScore}%</p>
            <p className="mt-1 text-xs font-semibold text-charcoal-700">{t(verdictOf(percentScore))}</p>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-charcoal-100">
              <div
                className={cn('h-full rounded-full transition-all', scoreBarTone(percentScore))}
                style={{ width: `${percentScore}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-charcoal-400">
              {t('{{points}} / {{max}} points across {{count}} criteria', {
                points: totalPoints,
                max: maxPoints,
                count: questions.length,
              })}
            </p>
          </div>

          {!assignment && (
            <div className="rounded-xl border border-charcoal-200 bg-charcoal-50 p-3">
              <p className="text-xs font-semibold text-charcoal-800">{t('Launch Bulk Cycle')}</p>
              <p className="mt-0.5 text-[10px] text-charcoal-500">
                {t('Need to assign evaluations to all gym staff at once?')}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 w-full"
                onClick={onLaunchCycle}
                loading={launchCycle.isPending}
                disabled={!form || eligible.length === 0}
              >
                {t('Launch Cycle for All Eligible ({{count}})', { count: eligible.length })}
              </Button>
            </div>
          )}
        </div>

        {/* Right column: the scored question list */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between rounded-xl border border-charcoal-200 bg-charcoal-50 p-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-charcoal-900">
                {selectedEmployee ? selectedEmployee.name : t('Select Employee')} — {form.name}
              </p>
              <p className="text-[10px] text-charcoal-500">
                {selectedEmployee
                  ? `${selectedEmployee.position} · ${selectedEmployee.level ?? '—'} · ${selectedEmployee.gym}`
                  : ''}
              </p>
            </div>
            <span className="badge badge-brand text-[10px]">{t('1 = Poor, 5 = Excellent')}</span>
          </div>

          <div className="max-h-[52vh] space-y-2.5 overflow-y-auto pe-1">
            {questions.length === 0 ? (
              <EmptyPanel title={t('This form has no questions')} hint={t('Edit the form to add scored criteria.')} />
            ) : (
              questions.map((question, index) => {
                const rating = scores[index] ?? 4
                return (
                  <div key={`${question.text}-${index}`} className="rounded-xl border border-charcoal-200 bg-white p-3">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <p className="min-w-0 text-xs font-semibold leading-snug text-charcoal-900">
                        <span className="me-1.5 font-bold text-brand-600">{index + 1}.</span>
                        {question.text}{' '}
                        <span className="badge badge-brand align-middle text-[8px]">
                          {t(
                            question.type === 'checkbox'
                              ? 'Checkboxes'
                              : question.type === 'choose'
                                ? 'Choose Option'
                                : 'Open Question',
                          )}
                        </span>
                      </p>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        {[1, 2, 3, 4, 5].map((value) => {
                          const selected = rating === value
                          return (
                            <button
                              key={value}
                              type="button"
                              title={t(RATING_TITLES[value])}
                              aria-pressed={selected}
                              onClick={() => setScores((current) => ({ ...current, [index]: value }))}
                              className={cn(
                                'rounded-lg border px-2.5 py-1 text-xs font-bold transition-all',
                                selected
                                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                                  : 'border-charcoal-200 bg-charcoal-50 text-charcoal-700 hover:bg-charcoal-100',
                              )}
                            >
                              {value}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {question.type === 'choose' ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {question.options.map((option) => {
                          const selected = answers[index] === option
                          return (
                            <button
                              key={option}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setAnswers((current) => ({ ...current, [index]: option }))}
                              className={cn(
                                'rounded-lg border px-2.5 py-1 text-xs transition-all',
                                selected
                                  ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
                                  : 'border-charcoal-200 bg-white text-charcoal-700 hover:bg-charcoal-50',
                              )}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                    ) : question.type === 'checkbox' ? (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                        {question.options.map((option) => {
                          const current = Array.isArray(answers[index]) ? (answers[index] as string[]) : []
                          const checked = current.includes(option)
                          return (
                            <label key={option} className="flex cursor-pointer items-center gap-1.5 text-xs text-charcoal-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setAnswers((state) => {
                                    const list = Array.isArray(state[index]) ? (state[index] as string[]) : []
                                    return {
                                      ...state,
                                      [index]: checked ? list.filter((item) => item !== option) : [...list, option],
                                    }
                                  })
                                }
                              />
                              {option}
                            </label>
                          )
                        })}
                      </div>
                    ) : question.type === 'file' ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="btn btn-secondary btn-sm cursor-pointer">
                          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                          {typeof answers[index] === 'string' && answers[index] ? t('Replace document') : t('Upload document')}
                          <input
                            type="file"
                            className="sr-only"
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={async (event) => {
                              const file = event.target.files?.[0]
                              event.target.value = ''
                              if (!file) return
                              if (file.size > 2 * 1024 * 1024) {
                                setError(t('That document is larger than 2 MB.'))
                                return
                              }
                              const dataUrl = await new Promise<string>((resolve, reject) => {
                                const reader = new FileReader()
                                reader.onload = () => resolve(String(reader.result ?? ''))
                                reader.onerror = () => reject(reader.error)
                                reader.readAsDataURL(file)
                              }).catch(() => '')
                              if (!dataUrl) return
                              setError(null)
                              setAnswers((current) => ({ ...current, [index]: `${file.name}|${dataUrl}` }))
                            }}
                          />
                        </label>
                        {typeof answers[index] === 'string' && answers[index] && (
                          <span className="max-w-[16rem] truncate text-[11px] font-medium text-charcoal-700">
                            {String(answers[index]).split('|data:')[0]}
                          </span>
                        )}
                      </div>
                    ) : (
                      <textarea
                        rows={2}
                        className="form-input mt-2 text-xs"
                        placeholder={t('Write your answer...')}
                        value={typeof answers[index] === 'string' ? (answers[index] as string) : ''}
                        onChange={(event) => setAnswers((current) => ({ ...current, [index]: event.target.value }))}
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="rounded-xl border border-charcoal-200 bg-white p-3">
            <label className="form-label" htmlFor="eval-run-notes">
              {t('Manager Feedback & Development Plan')}
            </label>
            <textarea
              id="eval-run-notes"
              rows={2}
              className="form-input"
              placeholder={t('Highlight key achievements, areas for coaching, and recommended training...')}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <div className="mt-3 flex items-center justify-between border-t border-charcoal-100 pt-2">
              <Button size="sm" variant="secondary" onClick={onExit}>
                {t('Cancel')}
              </Button>
              <Button
                size="sm"
                onClick={onSubmit}
                loading={submit.isPending}
                disabled={!selectedEmployee || questions.length === 0}
              >
                {t('Submit Evaluation ({{score}}%) ✓', { score: percentScore })}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RunHeader({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-base font-bold text-charcoal-900">{t('Run Evaluation')}</h1>
        <p className="mt-0.5 text-xs text-charcoal-500">
          {t('Pick an employee, score each criterion live and type answers — the submission lands in the form’s responses')}
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={onExit}>
        {t('← All Forms')}
      </Button>
    </div>
  )
}
