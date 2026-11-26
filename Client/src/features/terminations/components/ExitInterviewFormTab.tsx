import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, ClipboardCheck, Pencil, Plus, ShieldAlert, X } from 'lucide-react'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { Input, Select, Textarea } from '../../../components/ui/field'
import { Label } from '../../../components/ui/label'
import { describeApiError } from '../../../lib/api-client'
import { formatDateTime } from '../../../lib/format'
import { useSaveClearance, useSaveExitInterview, useSeparation } from '../hooks/useTerminations'
import type {
  ExitInterviewQuestion,
  ExitInterviewQuestionKind,
  Separation,
} from '../api/terminations.api'
import { EmployeeSummary, FormSection } from './termination-ui'
import { ScheduleInterviewDialog } from './ScheduleInterviewDialog'

const KIND_OPTIONS: { value: ExitInterviewQuestionKind; label: string }[] = [
  { value: 'text', label: 'Free text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multi', label: 'Checkboxes (choose many)' },
  { value: 'checkbox', label: 'Checkbox (yes / no)' },
  { value: 'rating', label: 'Rating (1–5)' },
]

const MULTI_SEPARATOR = ' | '

/** Multi answers are stored as "A | B" so the string stays portable. */
function splitMulti(answer: string | null | undefined): string[] {
  return (answer ?? '')
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean)
}

function newQuestionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `q-${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

export interface ExitInterviewFormTabProps {
  separationId: number | null
  cases: Separation[]
  canManage: boolean
  onClear: () => void
}

export function ExitInterviewFormTab({
  separationId,
  cases,
  canManage,
  onClear,
}: ExitInterviewFormTabProps) {
  const { t } = useTranslation()
  const fromList = cases.find((item) => item.id === separationId) ?? null
  const detail = useSeparation(separationId ?? 0)
  const separation = detail.data ?? fromList
  const saveInterview = useSaveExitInterview()
  const saveClearance = useSaveClearance()
  const [actionError, setActionError] = useState<string | null>(null)

  const interview = separation?.exitInterview
  const clearance = separation?.clearance
  const [interviewer, setInterviewer] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [questions, setQuestions] = useState<ExitInterviewQuestion[]>([])
  const [editingQuestions, setEditingQuestions] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [rehireEligible, setRehireEligible] = useState('true')
  const [rehireNote, setRehireNote] = useState('')
  const [blacklisted, setBlacklisted] = useState(false)
  const [blacklistReason, setBlacklistReason] = useState('')

  const [uniformReturned, setUniformReturned] = useState(false)
  const [assetsReturned, setAssetsReturned] = useState(false)
  const [accessRevoked, setAccessRevoked] = useState(false)
  const [finalSettlement, setFinalSettlement] = useState(false)
  const [settlementDirection, setSettlementDirection] = useState<'none' | 'owedToEmployee' | 'employeeOwes'>('none')
  const [settlementAmount, setSettlementAmount] = useState('0')
  const [clearanceNotes, setClearanceNotes] = useState('')

  useEffect(() => {
    if (!separation) return
    setInterviewer(interview?.interviewer ?? '')
    setInterviewDate(interview?.interviewDate ?? '')
    setQuestions(Array.isArray(interview?.questions) ? interview.questions : [])
    setEditingQuestions(false)
    setRehireEligible(interview?.rehireEligible == null ? 'true' : String(interview.rehireEligible))
    setRehireNote(interview?.rehireNote ?? '')
    setBlacklisted(separation.blacklisted)
    setBlacklistReason(separation.blacklistReason ?? '')
    setUniformReturned(clearance?.uniformReturned ?? false)
    setAssetsReturned(clearance?.assetsReturned ?? false)
    setAccessRevoked(clearance?.accessRevoked ?? false)
    setFinalSettlement(clearance?.finalSettlementCompleted ?? false)
    setSettlementDirection((clearance?.settlementDirection as typeof settlementDirection) ?? 'none')
    setSettlementAmount(String(clearance?.settlementAmount ?? 0))
    setClearanceNotes(clearance?.notes ?? '')
  }, [separation?.id])

  if (!separation) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={t('No exit interview selected')}
        message={t('Choose an approved case from Exit Interviews to conduct and complete the interview.')}
        action={
          <Button variant="secondary" onClick={onClear}>
            {t('Back to exit interviews')}
          </Button>
        }
      />
    )
  }

  const isClosed = separation.status === 'Completed' || separation.clearance?.completed === true
  const editable = canManage && !isClosed

  const updateQuestion = (index: number, patch: Partial<ExitInterviewQuestion>) => {
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...patch } : question)))
  }

  const changeKind = (index: number, kind: ExitInterviewQuestionKind) => {
    const question = questions[index]
    const needsOptions = kind === 'select' || kind === 'multi'
    const options = needsOptions
      ? question.options.length > 0
        ? question.options
        : ['', '']
      : []
    updateQuestion(index, { kind, options, answer: null })
  }

  const changeOption = (index: number, optionIndex: number, value: string) => {
    updateQuestion(index, {
      options: questions[index].options.map((option, i) => (i === optionIndex ? value : option)),
    })
  }

  const addOption = (index: number) => {
    updateQuestion(index, { options: [...questions[index].options, ''] })
  }

  const removeOption = (index: number, optionIndex: number) => {
    const question = questions[index]
    const removed = question.options[optionIndex]?.trim()
    const selected = splitMulti(question.answer)
    updateQuestion(index, {
      options: question.options.filter((_, i) => i !== optionIndex),
      answer:
        removed && selected.includes(removed)
          ? selected.filter((value) => value !== removed).join(MULTI_SEPARATOR) || null
          : question.answer,
    })
  }

  const addQuestion = () => {
    setQuestions((current) => [
      ...current,
      { id: newQuestionId(), label: '', kind: 'text', options: [], answer: null },
    ])
  }

  const removeQuestion = (index: number) => {
    setQuestions((current) => current.filter((_, i) => i !== index))
  }

  const toggleMultiAnswer = (index: number, option: string) => {
    const question = questions[index]
    const selected = splitMulti(question.answer)
    const next = selected.includes(option)
      ? selected.filter((value) => value !== option)
      : [...selected, option]
    const ordered = question.options
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && next.includes(value))
    updateQuestion(index, { answer: ordered.join(MULTI_SEPARATOR) || null })
  }

  const saveInterviewForm = async (complete: boolean) => {
    setActionError(null)
    try {
      await saveInterview.mutateAsync({
        id: separation.id,
        body: {
          interviewer: interviewer.trim() || undefined,
          interviewDate: interviewDate || undefined,
          rehireEligible: rehireEligible === 'true',
          rehireNote: rehireNote.trim() || undefined,
          blacklisted,
          blacklistReason: blacklisted ? blacklistReason.trim() || undefined : undefined,
          complete,
          questions: questions
            .filter((question) => question.label.trim().length > 0)
            .map((question) => ({
              id: question.id,
              label: question.label.trim(),
              kind: question.kind,
              options: question.options.map((option) => option.trim()).filter(Boolean),
              answer: question.answer,
            })),
        },
      })
      setEditingQuestions(false)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const completeClearance = async () => {
    setActionError(null)
    try {
      await saveClearance.mutateAsync({
        id: separation.id,
        body: {
          uniformReturned,
          assetsReturned,
          accessRevoked,
          finalSettlementCompleted: finalSettlement,
          settlementDirection,
          settlementAmount: Number(settlementAmount || 0),
          notes: clearanceNotes.trim() || undefined,
          complete: true,
        },
      })
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const ratingOptions = (
    <>
      {[1, 2, 3, 4, 5].map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </>
  )

  const scheduledLabel = separation.exitInterviewScheduledAt
    ? formatDateTime(separation.exitInterviewScheduledAt)
    : null

  return (
    <div className="space-y-2.5">
      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </p>
      )}

      <EmployeeSummary separation={separation} />

      <FormSection
        title={t('Interview schedule')}
        description={t('Book the slot with the employee, or move it when they need another time.')}
        action={
          editable ? (
            <Button variant="secondary" size="sm" onClick={() => setScheduling(true)}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {scheduledLabel ? t('Reschedule') : t('Schedule interview')}
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-charcoal-400">{t('Scheduled slot')}</p>
            <p className="mt-0.5 font-semibold text-charcoal-800">
              {scheduledLabel ?? t('Not scheduled')}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-charcoal-400">{t('Interview status')}</p>
            <p className="mt-0.5">
              <StatusBadge status={separation.exitInterviewStatus ?? 'Not scheduled'} />
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-charcoal-400">{t('Completed at')}</p>
            <p className="mt-0.5 font-semibold text-charcoal-800">
              {separation.exitInterviewCompletedAt
                ? formatDateTime(separation.exitInterviewCompletedAt)
                : '—'}
            </p>
          </div>
        </div>

        {scheduling && (
          <ScheduleInterviewDialog separation={separation} onClose={() => setScheduling(false)} />
        )}
      </FormSection>

      <FormSection
        title={t('Interview details')}
        description={t('Document who conducted the interview and when it happened.')}
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="exit-interviewer">{t('Interviewer')}</Label>
            <Input
              id="exit-interviewer"
              value={interviewer}
              onChange={(event) => setInterviewer(event.target.value)}
              disabled={!editable}
              placeholder={t('HR interviewer name')}
            />
          </div>
          <div>
            <Label htmlFor="exit-interview-date">{t('Interview date')}</Label>
            <Input
              id="exit-interview-date"
              type="date"
              value={interviewDate}
              onChange={(event) => setInterviewDate(event.target.value)}
              disabled={!editable}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title={t('Interview questions')}
        description={
          editingQuestions
            ? t('Edit the question text, the answer type and the dropdown choices, then save the interview.')
            : t('Answer the questions with the employee during the exit interview.')
        }
        action={
          editable ? (
            <Button variant="ghost" size="sm" onClick={() => setEditingQuestions((value) => !value)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              {editingQuestions ? t('Done editing') : t('Edit questions')}
            </Button>
          ) : undefined
        }
      >
        {questions.length === 0 ? (
          <p className="text-[11px] text-charcoal-400">
            {t('This interview has no questions yet. Reload the case to get the default set.')}
          </p>
        ) : (
          <ol className="space-y-2">
            {questions.map((question, index) => {
              const options = question.options.filter((option) => option.trim().length > 0)
              return (
                <li key={question.id} className="rounded-lg border border-charcoal-200 p-2.5">
                  {editingQuestions ? (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Select
                          value={question.kind}
                          onChange={(event) =>
                            changeKind(index, event.target.value as ExitInterviewQuestionKind)
                          }
                          className="sm:w-52"
                          aria-label={t('Question {{number}} type', { number: index + 1 })}
                        >
                          {KIND_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {t(option.label)}
                            </option>
                          ))}
                        </Select>
                        <Input
                          value={question.label}
                          onChange={(event) => updateQuestion(index, { label: event.target.value })}
                          placeholder={t('Question {{number}}', { number: index + 1 })}
                          aria-label={t('Question {{number}} text', { number: index + 1 })}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuestion(index)}
                          aria-label={t('Remove question {{number}}', { number: index + 1 })}
                        >
                          <X className="h-4 w-4 text-red-500" aria-hidden="true" />
                        </Button>
                      </div>

                      {(question.kind === 'select' || question.kind === 'multi') && (
                        <div className="mt-2 space-y-1.5">
                          {question.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <Input
                                value={option}
                                onChange={(event) => changeOption(index, optionIndex, event.target.value)}
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
                                aria-label={t('Remove option {{number}}', { number: optionIndex + 1 })}
                              >
                                <X className="h-4 w-4 text-charcoal-400" aria-hidden="true" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" onClick={() => addOption(index)}>
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('Add option')}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-charcoal-800">{question.label}</p>

                      {question.kind === 'text' && (
                        <Textarea
                          rows={2}
                          value={question.answer ?? ''}
                          onChange={(event) => updateQuestion(index, { answer: event.target.value })}
                          disabled={!editable}
                          placeholder={t('Answer…')}
                          aria-label={question.label}
                          className="mt-1.5"
                        />
                      )}

                      {question.kind === 'select' && (
                        <Select
                          value={question.answer ?? ''}
                          onChange={(event) => updateQuestion(index, { answer: event.target.value || null })}
                          disabled={!editable}
                          aria-label={question.label}
                          className="mt-1.5"
                        >
                          <option value="">{t('Select an answer…')}</option>
                          {options.map((option) => (
                            <option key={option} value={option.trim()}>
                              {option}
                            </option>
                          ))}
                        </Select>
                      )}

                      {question.kind === 'rating' && (
                        <Select
                          value={question.answer ?? ''}
                          onChange={(event) => updateQuestion(index, { answer: event.target.value || null })}
                          disabled={!editable}
                          aria-label={question.label}
                          className="mt-1.5"
                        >
                          <option value="">—</option>
                          {ratingOptions}
                        </Select>
                      )}

                      {question.kind === 'checkbox' && (
                        <label className="mt-1.5 flex items-center gap-2 text-xs text-charcoal-700">
                          <input
                            type="checkbox"
                            checked={question.answer === 'true'}
                            onChange={(event) =>
                              updateQuestion(index, { answer: event.target.checked ? 'true' : 'false' })
                            }
                            disabled={!editable}
                            className="h-4 w-4 accent-brand-600"
                          />
                          {t('Yes')}
                        </label>
                      )}

                      {question.kind === 'multi' && (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {options.map((option) => {
                            const value = option.trim()
                            return (
                              <label
                                key={value}
                                className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-2.5 py-1.5 text-xs text-charcoal-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={splitMulti(question.answer).includes(value)}
                                  onChange={() => toggleMultiAnswer(index, value)}
                                  disabled={!editable}
                                  className="h-4 w-4 accent-brand-600"
                                />
                                {value}
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        {editingQuestions && (
          <div className="mt-2 flex justify-end">
            <Button variant="secondary" size="sm" onClick={addQuestion}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Add question')}
            </Button>
          </div>
        )}
      </FormSection>

      {editable && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => void saveInterviewForm(false)}
            loading={saveInterview.isPending}
          >
            {t('Save interview')}
          </Button>
          <Button
            onClick={() => void saveInterviewForm(true)}
            loading={saveInterview.isPending}
            disabled={!interviewer.trim() || !interviewDate}
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            {t('Complete exit interview')}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <FormSection
          title={t('Rehire eligibility')}
          description={t('HR records whether this employee may be considered in the future.')}
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <Label htmlFor="rehire-status">{t('Eligible for rehire')}</Label>
              <Select
                id="rehire-status"
                value={rehireEligible}
                onChange={(event) => setRehireEligible(event.target.value)}
                disabled={!editable}
              >
                <option value="true">{t('Eligible')}</option>
                <option value="false">{t('Not eligible')}</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="rehire-note">{t('Rehire note')}</Label>
              <Input
                id="rehire-note"
                value={rehireNote}
                onChange={(event) => setRehireNote(event.target.value)}
                disabled={!editable}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title={t('Blacklist status')}
          description={t('Use only for a documented HR/security hold.')}
        >
          <label className="flex items-start gap-2 text-xs text-charcoal-700">
            <input
              type="checkbox"
              checked={blacklisted}
              onChange={(event) => setBlacklisted(event.target.checked)}
              disabled={!editable}
              className="mt-0.5 h-4 w-4 accent-red-600"
            />
            <span>
              <span className="font-semibold">{t('Blacklist employee')}</span>
              <span className="mt-0.5 block text-[11px] text-charcoal-500">
                {t('Blocks rehire consideration and is visible in the employee exit record.')}
              </span>
            </span>
          </label>
          {blacklisted && (
            <div className="mt-2">
              <Label htmlFor="blacklist-reason">{t('Blacklist reason')}</Label>
              <Textarea
                id="blacklist-reason"
                rows={2}
                value={blacklistReason}
                onChange={(event) => setBlacklistReason(event.target.value)}
                disabled={!editable}
              />
            </div>
          )}
        </FormSection>
      </div>

      <FormSection
        title={t('Clearance & final settlement')}
        description={t('Complete both the exit interview and all clearance items before the employee moves to Former Employees.')}
        action={
          separation.exitInterviewStatus === 'Completed'
            ? <span className="badge badge-green">{t('Interview complete')}</span>
            : <span className="badge badge-yellow">{t('Interview pending')}</span>
        }
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t('Uniform returned'), uniformReturned, setUniformReturned],
            [t('Assets returned'), assetsReturned, setAssetsReturned],
            [t('System access revoked'), accessRevoked, setAccessRevoked],
            [t('Final settlement completed'), finalSettlement, setFinalSettlement],
          ].map(([label, checked, setter]) => (
            <label key={String(label)} className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-3 py-2 text-xs text-charcoal-700">
              <input
                type="checkbox"
                checked={Boolean(checked)}
                onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
                disabled={!editable}
                className="h-4 w-4 accent-brand-600"
              />
              {String(label)}
            </label>
          ))}
        </div>

        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div>
            <Label htmlFor="settlement-direction">{t('Settlement')}</Label>
            <Select
              id="settlement-direction"
              value={settlementDirection}
              onChange={(event) => setSettlementDirection(event.target.value as typeof settlementDirection)}
              disabled={!editable}
            >
              <option value="none">{t('No settlement')}</option>
              <option value="owedToEmployee">{t('Owed to employee')}</option>
              <option value="employeeOwes">{t('Employee owes')}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="settlement-amount">{t('Amount (EGP)')}</Label>
            <Input
              id="settlement-amount"
              type="number"
              min="0"
              step="0.01"
              value={settlementAmount}
              onChange={(event) => setSettlementAmount(event.target.value)}
              disabled={!editable}
            />
          </div>
          <div>
            <Label htmlFor="clearance-notes">{t('Clearance notes')}</Label>
            <Textarea
              id="clearance-notes"
              rows={2}
              value={clearanceNotes}
              onChange={(event) => setClearanceNotes(event.target.value)}
              disabled={!editable}
            />
          </div>
        </div>

        {editable && (
          <div className="mt-2.5 flex justify-end">
            <Button
              variant="danger"
              onClick={() => void completeClearance()}
              loading={saveClearance.isPending}
              disabled={
                !uniformReturned ||
                !assetsReturned ||
                !accessRevoked ||
                !finalSettlement ||
                separation.exitInterviewStatus !== 'Completed'
              }
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              {t('Complete clearance & move to Former Employees')}
            </Button>
          </div>
        )}
      </FormSection>
    </div>
  )
}
