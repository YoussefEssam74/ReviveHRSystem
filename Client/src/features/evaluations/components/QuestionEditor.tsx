import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/field'
import { cn } from '../../../lib/utils'
import type { QuestionDraft, QuestionKind } from '../api/evaluations.api'

// The mock's option wording (Mock UI/HR `fbQuestionCard`).
const KIND_OPTIONS: { value: QuestionKind; label: string }[] = [
  { value: 'text', label: 'Open Question - free text answer' },
  { value: 'checkbox', label: 'Checkboxes - pick multiple answers' },
  { value: 'choose', label: 'Choose Option - pick one answer' },
  { value: 'file', label: 'File upload - the respondent attaches a document' },
]

export interface QuestionEditorProps {
  questions: QuestionDraft[]
  onChange: (questions: QuestionDraft[]) => void
}

/**
 * Dynamic question builder shared by the evaluation and hiring form builders
 * (Mock UI/HR `fbQuestionCard`): numbered card, the mock's `form-select`
 * type chooser and answer options. A `file` question is answered by whoever
 * fills the form — they upload the document, not the author.
 */
export default function QuestionEditor({ questions, onChange }: QuestionEditorProps) {
  const { t } = useTranslation()

  const update = (index: number, patch: Partial<QuestionDraft>) => {
    onChange(questions.map((question, i) => (i === index ? { ...question, ...patch } : question)))
  }

  const setKind = (index: number, kind: QuestionKind) => {
    const current = questions[index]
    // Choice questions must always carry at least two (possibly blank) slots.
    const options = kind === 'text' || kind === 'file' ? [] : current.options.length >= 2 ? current.options : ['', '']
    update(index, { kind, options })
  }

  const setOption = (index: number, optionIndex: number, value: string) => {
    update(index, { options: questions[index].options.map((option, i) => (i === optionIndex ? value : option)) })
  }

  const addOption = (index: number) => update(index, { options: [...questions[index].options, ''] })

  const removeOption = (index: number, optionIndex: number) => {
    update(index, { options: questions[index].options.filter((_, i) => i !== optionIndex) })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= questions.length) return
    const next = [...questions]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <section className="rounded-xl border border-charcoal-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="bento-label text-charcoal-500">{t('QUESTIONS ({{count}})', { count: questions.length })}</p>
        <button
          type="button"
          onClick={() => onChange([...questions, { kind: 'text', text: '', options: [] }])}
          className="text-xs font-semibold text-brand-600 hover:underline"
        >
          + {t('Add Question')}
        </button>
      </div>
      <p className="mb-3 mt-1 text-[10px] text-charcoal-400">
        {t('Each question can be an')} <strong>{t('open question')}</strong> {t('(free text)')},{' '}
        <strong>{t('checkboxes')}</strong> {t('(pick multiple)')}, {t('or a')}{' '}
        <strong>{t('choose option')}</strong> {t('(pick one)')}. {t('Choose')}{' '}
        <strong>{t('file upload')}</strong> {t('when the person filling the form must attach a document.')}
      </p>

      {questions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-charcoal-200 px-3 py-4 text-center text-xs text-charcoal-500">
          {t('Add at least one question Ã¢â‚¬â€ rating, choice or checkbox.')}
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <div key={index} className="rounded-xl border border-charcoal-200 bg-charcoal-50 p-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={question.text}
                    onChange={(e) => update(index, { text: e.target.value })}
                    placeholder={t('Type your question...')}
                    aria-label={t('Question {{number}} text', { number: index + 1 })}
                    className="text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={question.kind}
                      onChange={(e) => setKind(index, e.target.value as QuestionKind)}
                      className="w-auto py-1.5 text-xs"
                      aria-label={t('Question {{number}} type', { number: index + 1 })}
                    >
                      {KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.label)}
                        </option>
                      ))}
                    </Select>

                    {question.kind === 'file' && (
                      <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-800">
                        {t('The respondent uploads a document')}
                      </span>
                    )}

                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        title={t('Move up')}
                        aria-label={t('Move up')}
                        className="flex h-6 w-6 items-center justify-center rounded text-charcoal-400 hover:bg-charcoal-200/60 hover:text-charcoal-700"
                      >
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    {index < questions.length - 1 && (
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        title={t('Move down')}
                        aria-label={t('Move down')}
                        className="flex h-6 w-6 items-center justify-center rounded text-charcoal-400 hover:bg-charcoal-200/60 hover:text-charcoal-700"
                      >
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onChange(questions.filter((_, i) => i !== index))}
                      title={t('Remove question {{number}}', { number: index + 1 })}
                      aria-label={t('Remove question {{number}}', { number: index + 1 })}
                      className="ms-auto flex h-6 w-6 items-center justify-center rounded text-charcoal-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  {question.kind !== 'text' && question.kind !== 'file' && (
                    <div className="space-y-1.5 rounded-lg border border-charcoal-200 bg-white p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-charcoal-400">
                          {t('Answer options ({{count}})', { count: question.options.length })}
                        </p>
                        <button
                          type="button"
                          onClick={() => addOption(index)}
                          className="text-[10px] font-semibold text-brand-600 hover:underline"
                        >
                          + {t('Add option')}
                        </button>
                      </div>
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <span className="flex-shrink-0 text-xs text-charcoal-400" aria-hidden="true">
                            {question.kind === 'checkbox' ? 'Ã¢ËœÂ' : 'Ã¢â€”â€¹'}
                          </span>
                          <Input
                            value={option}
                            onChange={(e) => setOption(index, optionIndex, e.target.value)}
                            placeholder={t('Option text')}
                            aria-label={t('Question {{question}} option {{option}}', {
                              question: index + 1,
                              option: optionIndex + 1,
                            })}
                            className="text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(index, optionIndex)}
                            disabled={question.options.length <= 2}
                            aria-label={t('Remove option {{number}}', { number: optionIndex + 1 })}
                            className={cn(
                              'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-charcoal-400',
                              question.options.length <= 2 ? 'opacity-40' : 'hover:text-red-600',
                            )}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                      {question.options.length < 2 && (
                        <p className="text-[9px] text-red-500">{t('Needs at least 2 options to save.')}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

