import { useState } from 'react'
import { ClipboardCheck, FileText, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Tabs } from '../../../components/ui/tabs'
import { Dialog } from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import FormDialog, { type FormKind } from '../components/FormDialog'
import {
  useDeleteEvaluationForm,
  useDeleteHiringForm,
  useDispatchEvaluationForm,
  useEvaluationForms,
  useEvaluationResponses,
  useHiringForms,
} from '../hooks/useEvaluations'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { EDIT, VIEW } from '../../../lib/permissions'
import { formatDate, formatDateTime } from '../../../lib/format'
import type {
  EvaluationForm,
  EvaluationResponseRow,
  FormCard,
  HiringForm,
} from '../api/evaluations.api'

type EvaluationsTab = 'forms' | 'hiring' | 'responses'

const TABS: { value: EvaluationsTab; label: string }[] = [
  { value: 'forms', label: 'Evaluation Forms' },
  { value: 'hiring', label: 'Hiring Forms' },
  { value: 'responses', label: 'Evaluations' },
]

const FORM_STATUSES = ['', 'Active', 'Completed', 'Inactive']
const HIRING_STATUSES = ['', 'Open', 'Closed']
const RESPONSE_STATUSES = ['', 'Completed', 'In Progress']

/** Form builder + evaluation history: templates, hiring forms, submitted evaluations. */
export default function EvaluationsPage() {
  const { can, me } = useMe()
  const canView = can('evaluations', VIEW)
  const canEdit = can('evaluations', EDIT)

  const [tab, setTab] = useState<EvaluationsTab>('forms')

  const [formsStatus, setFormsStatus] = useState('')
  const [formsPosition, setFormsPosition] = useState('')
  const [formsPage, setFormsPage] = useState(1)

  const [hiringStatus, setHiringStatus] = useState('')
  const [hiringPage, setHiringPage] = useState(1)

  const [responseStatus, setResponseStatus] = useState('')
  const [responsesPage, setResponsesPage] = useState(1)

  const [dialog, setDialog] = useState<{ kind: FormKind; form: FormCard | null } | null>(null)
  const [deleting, setDeleting] = useState<{ kind: FormKind; id: number; name: string } | null>(null)
  const [dispatching, setDispatching] = useState<EvaluationForm | null>(null)
  const [selectedResponse, setSelectedResponse] = useState<EvaluationResponseRow | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const forms = useEvaluationForms(
    { status: formsStatus || undefined, position: formsPosition || undefined, page: formsPage, pageSize: 20 },
    canView,
  )
  const hiringForms = useHiringForms({ status: hiringStatus || undefined, page: hiringPage, pageSize: 20 }, canView)
  const responses = useEvaluationResponses(
    { status: responseStatus || undefined, page: responsesPage, pageSize: 20 },
    canView,
  )

  const deleteEvaluation = useDeleteEvaluationForm()
  const deleteHiring = useDeleteHiringForm()
  const dispatch = useDispatchEvaluationForm()
  const deletingPending = deleteEvaluation.isPending || deleteHiring.isPending

  const openCreate = (kind: FormKind) => {
    setActionError(null)
    setDialog({ kind, form: null })
  }

  const openEdit = (kind: FormKind, form: EvaluationForm | HiringForm) => {
    setActionError(null)
    setDialog({ kind, form })
  }

  const onDeleteConfirm = async () => {
    if (!deleting) return
    setActionError(null)
    try {
      if (deleting.kind === 'evaluation') await deleteEvaluation.mutateAsync(deleting.id)
      else await deleteHiring.mutateAsync(deleting.id)
      setDeleting(null)
      setFlash(`“${deleting.name}” deleted.`)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const onDispatchConfirm = async () => {
    if (!dispatching) return
    setActionError(null)
    try {
      const result = await dispatch.mutateAsync(dispatching.id)
      setDispatching(null)
      setFlash(
        result.createdAssignments.length === 0
          ? `“${dispatching.name}” was already routed — no new assignments were created.`
          : `“${dispatching.name}” routed to ${result.routedEvaluators} evaluator(s) · ${result.evaluationsAssigned} evaluation(s) assigned.`,
      )
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const description = me?.activeGym
    ? `Form builder and evaluation history for ${me.activeGym.gymName}`
    : 'Form builder and evaluation history'

  if (!canView) {
    return (
      <div>
        <PageHeader title="Evaluations" description={description} />
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="No evaluations access"
            message="You don't have permission to view evaluations for this gym. Ask an administrator for the evaluations feature."
          />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Evaluations" description={description} />

      <Tabs items={TABS} value={tab} onChange={setTab} className="mb-4 w-fit" />

      {flash && (
        <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {flash}
        </p>
      )}

      {tab === 'forms' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <Input
              placeholder="Filter by target position…"
              value={formsPosition}
              onChange={(e) => {
                setFormsPosition(e.target.value)
                setFormsPage(1)
              }}
              className="sm:max-w-xs"
              aria-label="Filter forms by position"
            />
            <Select
              value={formsStatus}
              onChange={(e) => {
                setFormsStatus(e.target.value)
                setFormsPage(1)
              }}
              className="sm:w-44"
              aria-label="Filter forms by status"
            >
              {FORM_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option || 'All statuses'}
                </option>
              ))}
            </Select>
            <div className="sm:ml-auto">
              <Button size="sm" onClick={() => openCreate('evaluation')} disabled={!canEdit}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New form
              </Button>
            </div>
          </div>

          {forms.isLoading ? (
            <LoadingState label="Loading evaluation forms…" />
          ) : forms.error ? (
            <ErrorState message={describeApiError(forms.error)} />
          ) : (forms.data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileText}
              title="No evaluation forms"
              message="Build your first evaluation template to start routing reviews."
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {forms.data!.items.map((form) => (
                  <FormRow
                    key={form.id}
                    title={form.name}
                    status={form.status}
                    position={form.position}
                    gym={form.gym}
                    meta={`${form.questions} questions · ${form.submissions} submissions · Created ${formatDate(form.createdDate)}${
                      form.lastUsed ? ` · Last used ${formatDate(form.lastUsed)}` : ''
                    }`}
                    canEdit={canEdit}
                    dispatchable={form.status === 'Active'}
                    onEdit={() => openEdit('evaluation', form)}
                    onDelete={() => {
                      setActionError(null)
                      setDeleting({ kind: 'evaluation', id: form.id, name: form.name })
                    }}
                    onDispatch={() => {
                      setActionError(null)
                      setDispatching(form)
                    }}
                  />
                ))}
              </ul>
              <Pagination
                page={forms.data!.page}
                pageSize={forms.data!.pageSize}
                total={forms.data!.total}
                totalPages={forms.data!.totalPages}
                onPageChange={setFormsPage}
                noun="forms"
              />
            </>
          )}
        </Card>
      )}

      {tab === 'hiring' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <Select
              value={hiringStatus}
              onChange={(e) => {
                setHiringStatus(e.target.value)
                setHiringPage(1)
              }}
              className="sm:w-44"
              aria-label="Filter hiring forms by status"
            >
              {HIRING_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option || 'All statuses'}
                </option>
              ))}
            </Select>
            <div className="sm:ml-auto">
              <Button size="sm" onClick={() => openCreate('hiring')} disabled={!canEdit}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New hiring form
              </Button>
            </div>
          </div>

          {hiringForms.isLoading ? (
            <LoadingState label="Loading hiring forms…" />
          ) : hiringForms.error ? (
            <ErrorState message={describeApiError(hiringForms.error)} />
          ) : (hiringForms.data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileText}
              title="No hiring forms"
              message="Hiring forms published here appear on the public careers page."
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {hiringForms.data!.items.map((form) => (
                  <FormRow
                    key={form.id}
                    title={form.name}
                    status={form.status}
                    position={form.position}
                    gym={form.gym}
                    meta={`${form.questions} questions · ${form.applicants} applicants · Created ${formatDate(form.createdDate)}${
                      form.lastUsed ? ` · Last used ${formatDate(form.lastUsed)}` : ''
                    }`}
                    canEdit={canEdit}
                    dispatchable={false}
                    onEdit={() => openEdit('hiring', form)}
                    onDelete={() => {
                      setActionError(null)
                      setDeleting({ kind: 'hiring', id: form.id, name: form.name })
                    }}
                  />
                ))}
              </ul>
              <Pagination
                page={hiringForms.data!.page}
                pageSize={hiringForms.data!.pageSize}
                total={hiringForms.data!.total}
                totalPages={hiringForms.data!.totalPages}
                onPageChange={setHiringPage}
                noun="forms"
              />
            </>
          )}
        </Card>
      )}

      {tab === 'responses' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <Select
              value={responseStatus}
              onChange={(e) => {
                setResponseStatus(e.target.value)
                setResponsesPage(1)
              }}
              className="sm:w-52"
              aria-label="Filter evaluations by status"
            >
              {RESPONSE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option || 'All statuses'}
                </option>
              ))}
            </Select>
          </div>

          {responses.isLoading ? (
            <LoadingState label="Loading evaluations…" />
          ) : responses.error ? (
            <ErrorState message={describeApiError(responses.error)} />
          ) : (responses.data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No evaluations"
              message="Dispatch a form to evaluators or launch a cycle to start collecting evaluations."
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {responses.data!.items.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{row.employee}</p>
                        <StatusBadge status={row.status} />
                        {row.score != null && <Badge>{row.score} / 100</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {row.form}
                        {row.period ? ` · ${row.period}` : ''}
                        {row.gym ? ` · ${row.gym}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Reviewed by {row.reviewedBy || '—'} · {formatDateTime(row.reviewedDate)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedResponse(row)}>
                      View
                    </Button>
                  </li>
                ))}
              </ul>
              <Pagination
                page={responses.data!.page}
                pageSize={responses.data!.pageSize}
                total={responses.data!.total}
                totalPages={responses.data!.totalPages}
                onPageChange={setResponsesPage}
                noun="evaluations"
              />
            </>
          )}
        </Card>
      )}

      {dialog && (
        <FormDialog
          kind={dialog.kind}
          form={dialog.form}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null)
            setFlash(message)
          }}
        />
      )}

      <Dialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title="Delete form"
        description={deleting?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onDeleteConfirm} loading={deletingPending}>
              Delete form
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>The form and its questions are removed permanently. This cannot be undone.</p>
          {deleting?.kind === 'evaluation' && (
            <p className="text-slate-500">
              Forms that already have responses cannot be deleted — set their status to Inactive instead.
            </p>
          )}
          {deleting?.kind === 'hiring' && (
            <p className="text-slate-500">Forms with applications cannot be deleted — close them instead.</p>
          )}
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {actionError}
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={dispatching != null}
        onClose={() => setDispatching(null)}
        title="Dispatch form"
        description={dispatching?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setDispatching(null)}>
              Cancel
            </Button>
            <Button onClick={onDispatchConfirm} loading={dispatch.isPending}>
              Dispatch to evaluators
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Routes this form to every eligible evaluator in scope. Subjects are matched to the form's gym and target
            position; assignments already routed are skipped.
          </p>
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {actionError}
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={selectedResponse != null}
        onClose={() => setSelectedResponse(null)}
        title="Evaluation"
        description={selectedResponse ? `${selectedResponse.employee} · ${selectedResponse.form}` : undefined}
        className="max-w-xl"
        footer={<Button variant="outline" onClick={() => setSelectedResponse(null)}>Close</Button>}
      >
        {selectedResponse && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selectedResponse.status} />
              {selectedResponse.score != null && <Badge>{selectedResponse.score} / 100</Badge>}
              {selectedResponse.period && <Badge>{selectedResponse.period}</Badge>}
              {selectedResponse.gym && <Badge>{selectedResponse.gym}</Badge>}
            </div>

            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-slate-500">Reviewed by</dt>
                <dd className="font-medium text-slate-900">{selectedResponse.reviewedBy || '—'}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-slate-500">Reviewed</dt>
                <dd className="font-medium text-slate-900">{formatDateTime(selectedResponse.reviewedDate)}</dd>
              </div>
            </dl>

            <div>
              <p className="text-sm font-semibold text-slate-900">Answers</p>
              {selectedResponse.answers.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">No answers recorded yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {selectedResponse.answers.map((answer, index) => (
                    <li key={index} className="px-3 py-2 text-sm">
                      <p className="font-medium text-slate-800">{answer.question}</p>
                      <p className="mt-0.5 text-slate-600">{answer.answer || '—'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedResponse.notes && (
              <div>
                <p className="text-sm font-semibold text-slate-900">Notes</p>
                <p className="mt-1 text-sm italic text-slate-600">“{selectedResponse.notes}”</p>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Scores at or above 60 pass; lower scores read “Below Target” on the employee file.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}

/** One form card row (shared by the evaluation and hiring tabs). */
function FormRow({
  title,
  status,
  position,
  gym,
  meta,
  canEdit,
  dispatchable,
  onEdit,
  onDelete,
  onDispatch,
}: {
  title: string
  status: string
  position: string | null
  gym: string
  meta: string
  canEdit: boolean
  dispatchable: boolean
  onEdit: () => void
  onDelete: () => void
  onDispatch?: () => void
}) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">{title}</p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-0.5 text-sm text-slate-600">
          {position && position !== 'All' ? position : 'Any position'} · {gym && gym !== 'All' ? gym : 'All gyms'}
        </p>
        <p className="mt-1 text-sm text-slate-500">{meta}</p>
      </div>
      {canEdit && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {onDispatch && (
            <Button variant="outline" size="sm" onClick={onDispatch} disabled={!dispatchable}>
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Dispatch
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${title}`}>
            <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
          </Button>
        </div>
      )}
    </li>
  )
}
