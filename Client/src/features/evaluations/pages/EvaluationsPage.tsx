import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { EmptyState } from '../../../components/ui/empty-state'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { EDIT, VIEW } from '../../../lib/permissions'
import type { FormKind } from '../components/FormDialog'
import { FormCard, RunningFormCard } from '../components/FormCards'
import { FormDetailView } from '../components/FormDetailView'
import { EvaluationRunView } from '../components/EvaluationRunView'
import { HistoryView } from '../components/HistoryView'
import { AssignmentsInbox } from '../components/AssignmentsInbox'
import { EvaluationsDialogs } from '../components/EvaluationsDialogs'
import { EmptyPanel, SectionLabel } from '../components/evaluation-ui'
import {
  useDeleteEvaluationForm,
  useDeleteHiringForm,
  useDispatchEvaluationForm,
  useEvaluationForms,
  useEvaluationResponses,
  useHiringForms,
} from '../hooks/useEvaluations'
import type {
  DispatchAssignment,
  EvaluationForm,
  EvaluationResponseRow,
  FormCard as FormCardModel,
  HiringForm,
} from '../api/evaluations.api'

type EvaluationsTab = 'evaluation' | 'hiring'

type View =
  | { name: 'list' }
  | { name: 'detail'; kind: FormKind; form: EvaluationForm | HiringForm }
  | { name: 'run'; formId: number | null; assignment: DispatchAssignment | null }
  | { name: 'history' }

/**
 * Evaluations (Mock UI/HR `renderEvaluations`): the merged one-page board —
 * Evaluation / Hiring pill tabs, current running forms, old forms, plus the
 * run view, form detail (responses/applicants) and History & Trends.
 */
export default function EvaluationsPage() {
  const { t } = useTranslation()
  const { can } = useMe()
  const { toast } = useToast()
  const canView = can('evaluations', VIEW)
  const canEdit = can('evaluations', EDIT)
  const canSeeApplicants = can('recruitment', VIEW)

  const [tab, setTab] = useState<EvaluationsTab>('evaluation')
  const [view, setView] = useState<View>({ name: 'list' })

  const [dialog, setDialog] = useState<{ kind: FormKind; form: FormCardModel | null } | null>(null)
  const [deleting, setDeleting] = useState<{ kind: FormKind; id: number; name: string } | null>(null)
  const [dispatching, setDispatching] = useState<EvaluationForm | null>(null)
  const [selectedResponse, setSelectedResponse] = useState<EvaluationResponseRow | null>(null)

  const forms = useEvaluationForms({ page: 1, pageSize: 100 }, canView)
  const hiring = useHiringForms({ page: 1, pageSize: 100 }, canView)
  const inProgress = useEvaluationResponses({ status: 'In Progress', page: 1, pageSize: 100 }, canView)

  const deleteEvaluation = useDeleteEvaluationForm()
  const deleteHiring = useDeleteHiringForm()
  const dispatch = useDispatchEvaluationForm()
  const deletingPending = deleteEvaluation.isPending || deleteHiring.isPending

  const evaluationForms = useMemo(() => forms.data?.items ?? [], [forms.data])
  const hiringForms = hiring.data?.items ?? []
  const runningForms = useMemo(() => evaluationForms.filter((form) => form.status === 'Active'), [evaluationForms])
  const oldForms = useMemo(() => evaluationForms.filter((form) => form.status !== 'Active'), [evaluationForms])

  // Per-form "in progress" counters for the running cards (one cheap read).
  const inProgressByForm = useMemo(() => {
    const map = new Map<number, number>()
    ;(inProgress.data?.items ?? []).forEach((row) => {
      map.set(row.formId, (map.get(row.formId) ?? 0) + 1)
    })
    return map
  }, [inProgress.data])

  const openCreate = (kind: FormKind) => setDialog({ kind, form: null })
  const openEdit = (kind: FormKind, form: FormCardModel) => setDialog({ kind, form })

  const onDeleteConfirm = async () => {
    if (!deleting) return
    try {
      if (deleting.kind === 'evaluation') await deleteEvaluation.mutateAsync(deleting.id)
      else await deleteHiring.mutateAsync(deleting.id)
      toast(t('“{{name}}” deleted.', { name: deleting.name }))
      setDeleting(null)
      setView({ name: 'list' })
    } catch (err) {
      toast(describeApiError(err), 'error')
    }
  }

  const onDispatchConfirm = async () => {
    if (!dispatching) return
    try {
      const result = await dispatch.mutateAsync(dispatching.id)
      toast(
        result.createdAssignments.length === 0
          ? t('“{{name}}” was already routed — no new assignments were created.', { name: dispatching.name })
          : t('“{{name}}” routed to {{evaluators}} evaluator(s) · {{evaluations}} evaluation(s) assigned.', {
              name: dispatching.name,
              evaluators: result.routedEvaluators,
              evaluations: result.evaluationsAssigned,
            }),
      )
      setDispatching(null)
    } catch (err) {
      toast(describeApiError(err), 'error')
    }
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-charcoal-200 bg-white">
        <EmptyState
          title={t('No evaluations access')}
          message={t(
            "You don't have permission to view evaluations for this gym. Ask an administrator for the evaluations feature.",
          )}
        />
      </div>
    )
  }

  if (view.name === 'run') {
    return (
      <EvaluationRunView
        forms={evaluationForms}
        initialFormId={view.formId}
        assignment={view.assignment}
        onExit={() => setView({ name: 'list' })}
        onSubmitted={(message) => {
          toast(message)
          // Assigned work lands back on the inbox; free-run lands on History & Trends.
          setView(view.assignment ? { name: 'list' } : { name: 'history' })
        }}
        onCycleLaunched={(message) => {
          toast(message)
          setView({ name: 'history' })
        }}
      />
    )
  }

  if (view.name === 'history') {
    return (
      <HistoryView
        canRun={canEdit}
        onBack={() => setView({ name: 'list' })}
        onRun={() => setView({ name: 'run', formId: null, assignment: null })}
      />
    )
  }

  if (view.name === 'detail') {
    return (
      <>
        <FormDetailView
          kind={view.kind}
          form={view.form}
          canEdit={canEdit}
          canRun={canEdit}
          canSeeApplicants={canSeeApplicants}
          onBack={() => setView({ name: 'list' })}
          onEdit={() => openEdit(view.kind, view.form)}
          onDelete={() => setDeleting({ kind: view.kind, id: view.form.id, name: view.form.name })}
          onRun={() => setView({ name: 'run', formId: view.form.id, assignment: null })}
          onViewResponse={setSelectedResponse}
        />
        <EvaluationsDialogs
          dialog={dialog}
          onCloseDialog={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null)
            toast(message)
          }}
          deleting={deleting}
          onCloseDeleting={() => setDeleting(null)}
          onDeleteConfirm={onDeleteConfirm}
          deletingPending={deletingPending}
          dispatching={dispatching}
          onCloseDispatching={() => setDispatching(null)}
          onDispatchConfirm={onDispatchConfirm}
          dispatchPending={dispatch.isPending}
          selectedResponse={selectedResponse}
          onCloseResponse={() => setSelectedResponse(null)}
        />
      </>
    )
  }

  const loadError = forms.error ?? hiring.error

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-charcoal-900">{t('Evaluations')}</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {t('Dispatch forms to evaluators, fill your assigned evaluations, and review every response — all in one place')}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => openCreate(tab)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('Create New Form')}
          </Button>
        )}
      </div>

      <AssignmentsInbox onStart={(assignment) => setView({ name: 'run', formId: assignment.formId, assignment })} />

      <div
        className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-charcoal-200 bg-charcoal-100 p-1"
        role="tablist"
        aria-label={t('Form types')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'evaluation'}
          onClick={() => setTab('evaluation')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[11px] font-semibold transition-all',
            tab === 'evaluation'
              ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
              : 'border-transparent text-charcoal-600 hover:bg-charcoal-200/70 hover:text-charcoal-800',
          )}
        >
          {t('Evaluation')}
          <span
            className={cn(
              'rounded-full px-1.5 text-[9px] font-semibold',
              tab === 'evaluation' ? 'bg-white/20 text-white' : 'badge badge-brand',
            )}
          >
            {forms.data?.total ?? 0}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'hiring'}
          onClick={() => setTab('hiring')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[11px] font-semibold transition-all',
            tab === 'hiring'
              ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
              : 'border-transparent text-charcoal-600 hover:bg-charcoal-200/70 hover:text-charcoal-800',
          )}
        >
          {t('Hiring')}
          <span
            className={cn(
              'rounded-full px-1.5 text-[9px] font-semibold',
              tab === 'hiring' ? 'bg-white/20 text-white' : 'badge badge-blue',
            )}
          >
            {hiring.data?.total ?? 0}
          </span>
        </button>
      </div>

      {loadError && <ErrorState message={describeApiError(loadError)} />}

      {tab === 'evaluation' ? (
        <>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SectionLabel count={runningForms.length}>
                {t('CURRENT RUNNING FORM{{plural}}', { plural: runningForms.length === 1 ? '' : 'S' })}
              </SectionLabel>
              {canEdit && runningForms.length > 0 && (
                <Button size="sm" onClick={() => setView({ name: 'run', formId: null, assignment: null })}>
                  {t('Run Evaluation')}
                </Button>
              )}
            </div>

            {forms.isLoading || !forms.data ? (
              <LoadingState label={t('Loading evaluation forms…')} />
            ) : runningForms.length === 0 ? (
              <EmptyPanel
                title={t('No form is running right now')}
                hint={
                  canEdit
                    ? t('Click "Create New Form" to build one, then keep its status Active.')
                    : t('No active evaluation forms are available.')
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {runningForms.map((form) => (
                  <RunningFormCard
                    key={form.id}
                    form={form}
                    inProgress={inProgressByForm.get(form.id) ?? 0}
                    canRun={canEdit}
                    canEdit={canEdit}
                    onDispatch={() => setDispatching(form)}
                    onRun={() => setView({ name: 'run', formId: form.id, assignment: null })}
                    onEdit={() => openEdit('evaluation', form)}
                    onOpen={() => setView({ name: 'detail', kind: 'evaluation', form })}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="bento-label text-charcoal-500">{t('OLD FORMS')}</p>
                <span className="text-[10px] text-charcoal-400">
                  {t('Click a form to see who completed it & their answers')}
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setView({ name: 'history' })}>
                {t('History & Trends →')}
              </Button>
            </div>

            {forms.isLoading || !forms.data ? (
              <LoadingState label={t('Loading evaluation forms…')} />
            ) : oldForms.length === 0 ? (
              <EmptyPanel
                title={t('No forms here')}
                hint={
                  canEdit ? t('Click "Create New Form" to create your first form.') : t('No forms have been created yet.')
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {oldForms.map((form) => (
                  <FormCard
                    key={form.id}
                    kind="evaluation"
                    form={form}
                    onOpen={() => setView({ name: 'detail', kind: 'evaluation', form })}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SectionLabel count={hiringForms.length}>{t('HIRING FORMS')}</SectionLabel>
            <span className="text-[10px] text-charcoal-400">{t('Click a form to see who applied & their answers')}</span>
          </div>

          {hiring.isLoading || !hiring.data ? (
            <LoadingState label={t('Loading hiring forms…')} />
          ) : hiringForms.length === 0 ? (
            <EmptyPanel
              title={t('No hiring forms yet')}
              hint={
                canEdit
                  ? t('Click "Create New Form" to create your first one.')
                  : t('No hiring forms have been created yet.')
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {hiringForms.map((form) => (
                <FormCard
                  key={form.id}
                  kind="hiring"
                  form={form}
                  onOpen={() => setView({ name: 'detail', kind: 'hiring', form })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <EvaluationsDialogs
        dialog={dialog}
        onCloseDialog={() => setDialog(null)}
        onSaved={(message) => {
          setDialog(null)
          toast(message)
        }}
        deleting={deleting}
        onCloseDeleting={() => setDeleting(null)}
        onDeleteConfirm={onDeleteConfirm}
        deletingPending={deletingPending}
        dispatching={dispatching}
        onCloseDispatching={() => setDispatching(null)}
        onDispatchConfirm={onDispatchConfirm}
        dispatchPending={dispatch.isPending}
        selectedResponse={selectedResponse}
        onCloseResponse={() => setSelectedResponse(null)}
      />
    </div>
  )
}
