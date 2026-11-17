import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { LoadingState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import {
  toQuestionDraft,
  type FormCard,
  type QuestionDraft,
  type QuestionInput,
} from '../api/evaluations.api'
import {
  useEvaluationForm,
  useHiringForm,
  useSaveEvaluationForm,
  useSaveHiringForm,
} from '../hooks/useEvaluations'
import QuestionEditor from './QuestionEditor'

export type FormKind = 'evaluation' | 'hiring'

export interface FormDialogProps {
  kind: FormKind
  /** null = create mode; the list card seeds the editor (detail GET refreshes it). */
  form: FormCard | null
  onClose: () => void
  onSaved: (message: string) => void
}

const EVALUATION_POSITIONS = ['All', 'Trainer', 'Receptionist', 'Cleaner', 'Maintenance', 'Branch Manager']
const EVALUATION_STATUSES = ['Active', 'Completed', 'Inactive']
const HIRING_STATUSES = ['Open', 'Closed']

/** Trims + normalizes the editor drafts into a POST/PUT question list. */
function buildQuestionInputs(questions: QuestionDraft[]): QuestionInput[] {
  return questions.map((question) => ({
    type: question.kind,
    text: question.text.trim(),
    options:
      question.kind === 'text'
        ? []
        : question.options.map((option) => option.trim()).filter((option) => option.length > 0),
  }))
}

/** Create/edit dialog for both form resources (same body shape). */
export default function FormDialog({ kind, form, onClose, onSaved }: FormDialogProps) {
  const { t } = useTranslation()
  const { me } = useMe()
  const editingId = form?.id ?? null

  const evaluationDetail = useEvaluationForm(kind === 'evaluation' ? editingId : null)
  const hiringDetail = useHiringForm(kind === 'hiring' ? editingId : null)
  const fresh = kind === 'evaluation' ? evaluationDetail.data : hiringDetail.data
  const detailLoading = kind === 'evaluation' ? evaluationDetail.isLoading : hiringDetail.isLoading

  const saveEvaluation = useSaveEvaluationForm()
  const saveHiring = useSaveHiringForm()
  const saving = saveEvaluation.isPending || saveHiring.isPending

  const defaultGym = me?.activeGym?.gymName ?? 'All'
  const [name, setName] = useState(form?.name ?? '')
  const [position, setPosition] = useState(form?.position ?? 'All')
  const [gym, setGym] = useState(form?.gym ?? defaultGym)
  const [status, setStatus] = useState(form?.status ?? (kind === 'evaluation' ? 'Active' : 'Open'))
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => (form?.questionList ?? []).map(toQuestionDraft))
  const [error, setError] = useState<string | null>(null)

  // Re-seed once from the fresh detail (PUT replaces the whole question list,
  // so the editor must show the server's current questions). Applied a single
  // time so a background refetch never wipes what the user is typing.
  const appliedFresh = useRef(false)
  useEffect(() => {
    if (!fresh || appliedFresh.current) return
    appliedFresh.current = true
    setName(fresh.name)
    setPosition(fresh.position ?? 'All')
    setGym(fresh.gym || 'All')
    setStatus(fresh.status)
    setQuestions(fresh.questionList.map(toQuestionDraft))
  }, [fresh])

  const positionOptions =
    position && !EVALUATION_POSITIONS.includes(position) ? [...EVALUATION_POSITIONS, position] : EVALUATION_POSITIONS
  const statusOptions = kind === 'evaluation' ? EVALUATION_STATUSES : HIRING_STATUSES
  const resolvedStatuses =
    status && !statusOptions.includes(status) ? [...statusOptions, status] : statusOptions
  const gymNames = me?.gyms.map((option) => option.gymName) ?? []
  const gymOptions = gym && gym !== 'All' && !gymNames.includes(gym) ? ['All', gym, ...gymNames] : ['All', ...gymNames]

  const inputs = buildQuestionInputs(questions)
  const valid =
    name.trim().length > 0 &&
    inputs.length > 0 &&
    inputs.every((input) => input.text.length > 0 && (input.type === 'text' || input.options.length >= 2))

  const onSave = async () => {
    setError(null)
    const body = {
      name: name.trim(),
      position,
      gym,
      status,
      questionList: inputs,
    }
    try {
      if (kind === 'evaluation') {
        await saveEvaluation.mutateAsync({ id: editingId, body })
      } else {
        await saveHiring.mutateAsync({ id: editingId, body })
      }
      onSaved(editingId == null ? t('Form created.') : t('Form saved.'))
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editingId == null ? t('New form') : t('Edit form')}
      description={kind === 'evaluation' ? t('Evaluation template') : t('Hiring application form')}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSave} loading={saving} disabled={!valid || (editingId != null && detailLoading)}>
            {editingId == null ? t('Create form') : t('Save changes')}
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

        {editingId != null && detailLoading ? (
          <LoadingState label={t('Loading form…')} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="form-name">{t('Name')}</Label>
                <Input
                  id="form-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('Trainer QA — Q4 2026')}
                />
              </div>
              <div>
                <Label htmlFor="form-position">{t('Target position')}</Label>
                <Select id="form-position" value={position} onChange={(e) => setPosition(e.target.value)}>
                  {positionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'All' ? t('Any position') : t(option)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="form-gym">{t('Gym')}</Label>
                <Select id="form-gym" value={gym} onChange={(e) => setGym(e.target.value)}>
                  {gymOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'All' ? t('All gyms') : option}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="form-status">{t('Status')}</Label>
                <Select id="form-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {resolvedStatuses.map((option) => (
                    <option key={option} value={option}>
                      {t(option)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <QuestionEditor questions={questions} onChange={setQuestions} />
          </>
        )}
      </div>
    </Dialog>
  )
}
