import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Paperclip } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { LoadingState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import {
  toQuestionDraft,
  uploadEvaluationFormAttachment,
  type FormCard,
  type QuestionDraft,
  type QuestionInput,
} from '../api/evaluations.api'
import { useEvaluationForm, useHiringForm, useSaveEvaluationForm, useSaveHiringForm } from '../hooks/useEvaluations'
import QuestionEditor from './QuestionEditor'

export type FormKind = 'evaluation' | 'hiring'

export interface FormBuilderProps {
  kind: FormKind
  /** Evaluation kind (Evaluation | FirstInterview | ExitInterview); ignored for hiring forms. */
  formKind?: string
  /** null = create mode; the list card seeds the editor (detail GET refreshes it). */
  form: FormCard | null
  onBack: () => void
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
      question.kind === 'text' || question.kind === 'file'
        ? []
        : question.options.map((option) => option.trim()).filter((option) => option.length > 0),
    attachmentPath: question.attachmentPath ?? null,
    attachmentName: question.attachmentName ?? null,
  }))
}

/**
 * Full-page create/edit builder (Mock UI/HR `fbEditorHtml`): title row, the
 * form-settings card, the questions card and the Cancel / Save Form footer.
 * Replaces the former modal so the builder owns the page like the mock.
 */
export default function FormBuilder({ kind, formKind, form, onBack, onSaved }: FormBuilderProps) {
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
  const [description, setDescription] = useState(form?.description ?? '')
  const [gym, setGym] = useState(form?.gym ?? defaultGym)
  const [status, setStatus] = useState(form?.status ?? (kind === 'evaluation' ? 'Active' : 'Open'))
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    form?.questionList?.length ? form.questionList.map(toQuestionDraft) : [{ kind: 'text', text: '', options: [] }],
  )
  const [attachmentName, setAttachmentName] = useState<string | null>(form?.attachmentName ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed once from the fresh detail (PUT replaces the whole question list, so the
  // editor must show the server's current questions). Applied a single time so a
  // background refetch never wipes what the user is typing.
  const appliedFresh = useRef(false)
  useEffect(() => {
    if (!fresh || appliedFresh.current) return
    appliedFresh.current = true
    setName(fresh.name)
    setPosition(fresh.position ?? 'All')
    setDescription(fresh.description ?? '')
    setGym(fresh.gym || 'All')
    setStatus(fresh.status)
    setAttachmentName(fresh.attachmentName ?? null)
    if (fresh.questionList.length > 0) setQuestions(fresh.questionList.map(toQuestionDraft))
  }, [fresh])

  const positionOptions =
    position && !EVALUATION_POSITIONS.includes(position) ? [...EVALUATION_POSITIONS, position] : EVALUATION_POSITIONS
  const statusOptions = kind === 'evaluation' ? EVALUATION_STATUSES : HIRING_STATUSES
  const resolvedStatuses = status && !statusOptions.includes(status) ? [...statusOptions, status] : statusOptions
  const gymNames = me?.gyms.map((option) => option.gymName) ?? []
  const gymOptions = gym && gym !== 'All' && !gymNames.includes(gym) ? ['All', gym, ...gymNames] : ['All', ...gymNames]

  const inputs = buildQuestionInputs(questions)
  const valid =
    name.trim().length > 0 &&
    inputs.length > 0 &&
    inputs.every((input) => input.text.length > 0 && (input.type === 'text' || input.type === 'file' || input.options.length >= 2))

  const kindLabel =
    kind === 'hiring'
      ? t('HIRING')
      : t(
          formKind === 'FirstInterview'
            ? 'FIRST INTERVIEW'
            : formKind === 'ExitInterview'
              ? 'EXIT INTERVIEW'
              : 'EVALUATION',
        )

  // The Form Type field states which builder this is: interviews are their own
  // kinds, not generic evaluation forms.
  const formTypeValue = kind === 'hiring' ? 'hiring' : (formKind ?? 'Evaluation')

  const onUpload = async (file: File | undefined) => {
    if (!file || editingId == null) return
    setError(null)
    setUploading(true)
    try {
      const saved = await uploadEvaluationFormAttachment(editingId, file)
      setAttachmentName(saved.attachmentName)
    } catch (err) {
      setError(describeApiError(err))
    } finally {
      setUploading(false)
    }
  }

  const onSave = async () => {
    setError(null)
    const body = {
      name: name.trim(),
      position,
      gym,
      status,
      ...(kind === 'evaluation' ? { kind: formKind ?? 'Evaluation' } : {}),
      ...(kind === 'hiring' ? { description: description.trim() } : {}),
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
    <div className="space-y-2.5">
      <div>
        <h1 className="text-base font-bold text-charcoal-900">{t('Form Builder')}</h1>
        <p className="mt-0.5 text-xs text-charcoal-500">
          {t(
            'Creating a new form — each question can be an open question, checkboxes, or a choose option',
          )}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {editingId != null && detailLoading ? (
        <LoadingState label={t('Loading form…')} />
      ) : (
        <div className="mt-3 space-y-3">
          <section className="rounded-xl border border-charcoal-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="bento-label text-charcoal-500">
                {editingId == null ? t('NEW') : t('EDIT')} {kindLabel} {t('FORM')}
              </p>
              <Button size="sm" variant="ghost" onClick={onBack}>
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                {t('Back')}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="sm:col-span-2">
                <Label htmlFor="form-name">
                  {t('Form Title')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="form-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    kind === 'evaluation' ? t('e.g. Trainer Evaluation Q4 2026') : t('e.g. Front Desk Application Form')
                  }
                />
              </div>
              <div>
                <Label htmlFor="form-type">{t('Form Type')}</Label>
                <Select id="form-type" value={formTypeValue} disabled>
                  <option value="Evaluation">{t('Evaluation')}</option>
                  <option value="FirstInterview">{t('First Interview')}</option>
                  <option value="ExitInterview">{t('Exit Interview')}</option>
                  <option value="hiring">{t('Hiring')}</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="form-position">{kind === 'evaluation' ? t('Target Role') : t('Position')}</Label>
                <Select id="form-position" value={position} onChange={(e) => setPosition(e.target.value)}>
                  {positionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'All' ? t('All Staff') : t(option)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="form-gym">{t('Gym Scope')}</Label>
                <Select id="form-gym" value={gym} onChange={(e) => setGym(e.target.value)}>
                  {gymOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'All' ? t('All') : option}
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

            {kind === 'hiring' && (
              <div className="mt-3 border-t border-charcoal-100 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="form-description">{t('Job Description')}</Label>
                  <span className="text-[10px] text-charcoal-400">{description.length} / 4000</span>
                </div>
                <Textarea
                  id="form-description"
                  rows={5}
                  maxLength={4000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('Responsibilities, requirements, working hours…')}
                />
                <p className="mt-1 text-[10px] text-charcoal-400">
                  {t('Shown on the public careers page and above the application form.')}
                </p>
              </div>
            )}

            {editingId != null && kind === 'evaluation' && (
              <div className="mt-4 border-t border-charcoal-100 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">
                  {t('Reference document')}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label className="btn btn-secondary btn-sm cursor-pointer">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                    {attachmentName ? t('Replace document') : t('Upload document')}
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      disabled={uploading || saving}
                      onChange={(event) => {
                        void onUpload(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                  </label>
                  {attachmentName && (
                    <span className="max-w-[18rem] truncate text-[11px] font-medium text-charcoal-700">
                      {attachmentName}
                    </span>
                  )}
                  {uploading && <span className="text-[11px] text-charcoal-400">{t('Uploading…')}</span>}
                </div>
              </div>
            )}
          </section>

          <QuestionEditor questions={questions} onChange={setQuestions} />

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={onBack}>
              {t('Cancel')}
            </Button>
            <Button size="sm" onClick={onSave} loading={saving} disabled={!valid}>
              {t('Save Form')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
