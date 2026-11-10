import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import type { QuestionDraft, QuestionKind } from '../api/evaluations.api'

const KIND_OPTIONS: { value: QuestionKind; label: string }[] = [
  { value: 'text', label: 'Rating (1–5)' },
  { value: 'choose', label: 'Choose one' },
  { value: 'checkbox', label: 'Choose many' },
]

export interface QuestionEditorProps {
  questions: QuestionDraft[]
  onChange: (questions: QuestionDraft[]) => void
}

/**
 * Dynamic question builder shared by the evaluation and hiring form dialogs.
 * `text` questions take no options; `choose`/`checkbox` need at least two.
 */
export default function QuestionEditor({ questions, onChange }: QuestionEditorProps) {
  const { t } = useTranslation()
  const update = (index: number, patch: Partial<QuestionDraft>) => {
    onChange(questions.map((question, i) => (i === index ? { ...question, ...patch } : question)))
  }

  const setKind = (index: number, kind: QuestionKind) => {
    const current = questions[index]
    // Choice questions must always carry at least two (possibly blank) slots.
    const options = kind === 'text' ? [] : current.options.length >= 2 ? current.options : ['', '']
    update(index, { kind, options })
  }

  const setOption = (index: number, optionIndex: number, value: string) => {
    update(index, { options: questions[index].options.map((option, i) => (i === optionIndex ? value : option)) })
  }

  const addOption = (index: number) => update(index, { options: [...questions[index].options, ''] })

  const removeOption = (index: number, optionIndex: number) => {
    update(index, { options: questions[index].options.filter((_, i) => i !== optionIndex) })
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{t('Questions')}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...questions, { kind: 'text', text: '', options: [] }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('Add question')}
        </Button>
      </div>

      {questions.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          {t('Add at least one question — rating, choice or checkbox.')}
        </p>
      ) : (
        <ol className="mt-3 space-y-4">
          {questions.map((question, index) => (
            <li key={index} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select
                  value={question.kind}
                  onChange={(e) => setKind(index, e.target.value as QuestionKind)}
                  className="sm:w-44"
                  aria-label={t('Question {{number}} type', { number: index + 1 })}
                >
                  {KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                    </option>
                  ))}
                </Select>
                <Input
                  value={question.text}
                  onChange={(e) => update(index, { text: e.target.value })}
                  placeholder={t('Question {{number}} text', { number: index + 1 })}
                  aria-label={t('Question {{number}} text', { number: index + 1 })}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(questions.filter((_, i) => i !== index))}
                  aria-label={t('Remove question {{number}}', { number: index + 1 })}
                >
                  <X className="h-4 w-4 text-red-500" aria-hidden="true" />
                </Button>
              </div>

              {question.kind !== 'text' && (
                <div className="mt-3 space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) => setOption(index, optionIndex, e.target.value)}
                        placeholder={t('Option {{number}}', { number: optionIndex + 1 })}
                        aria-label={t('Question {{question}} option {{option}}', {
                          question: index + 1,
                          option: optionIndex + 1,
                        })}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index, optionIndex)}
                        disabled={question.options.length <= 2}
                        aria-label={t('Remove option {{number}}', { number: optionIndex + 1 })}
                      >
                        <X className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addOption(index)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('Add option')}
                  </Button>
                  <p className="text-xs text-slate-500">{t('Choice questions need at least two options.')}</p>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
