import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Tabs, type TabItem } from '../../../components/ui/tabs'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useFinalizeSeparation, useSeparation, useToggleChecklist } from '../hooks/useTerminations'
import { ExitVerdictForm } from './ExitVerdictForm'
import { SeparationEmployeeData } from './SeparationEmployeeData'
import { GymPill, VerdictChips } from './separation-ui'
import { noticeDaysLeft } from './separation-utils'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { Separation } from '../api/terminations.api'

type DetailTab = 'workflow' | 'employee'

export interface SeparationDetailDialogProps {
  separationId: number
  /** offboarding Edit — checklist toggles, verdict and finalize actions. */
  canManage: boolean
  onClose: () => void
}

/** The leaving case (mock openSeparation): Exit Workflow and Employee Data tabs. */
export function SeparationDetailDialog({ separationId, canManage, onClose }: SeparationDetailDialogProps) {
  const { t } = useTranslation()
  const { data: separation, isLoading, error } = useSeparation(separationId)
  const toggle = useToggleChecklist(separationId)
  const finalize = useFinalizeSeparation(separationId)
  const [tab, setTab] = useState<DetailTab>('workflow')
  const [confirming, setConfirming] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const checklistComplete = (separation?.checklist ?? []).every(([, done]) => done)
  const editable = canManage && separation != null && separation.status !== 'Completed'
  const canFinalize = checklistComplete && separation?.verdict != null

  const onToggle = async (index: number, done: boolean) => {
    setActionError(null)
    try {
      await toggle.mutateAsync({ index, done })
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const onFinalize = async () => {
    setActionError(null)
    try {
      await finalize.mutateAsync()
      onClose()
    } catch (err) {
      setActionError(describeApiError(err))
      setConfirming(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={separation ? t('Leaving — {{name}}', { name: separation.employee }) : t('Separation')}
      description={separation ? `${separation.position} · ${separation.gym}` : undefined}
      className="sm:max-w-3xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          {t('Close')}
        </Button>
      }
    >
      {isLoading ? (
        <LoadingState label={t('Loading case…')} />
      ) : error ? (
        <ErrorState message={describeApiError(error)} />
      ) : separation ? (
        <>
          <Tabs
            items={
              [
                { value: 'workflow', label: t('Exit Workflow') },
                { value: 'employee', label: t('Employee Data') },
              ] satisfies TabItem<DetailTab>[]
            }
            value={tab}
            onChange={setTab}
            variant="compact"
            className="w-full"
          />

          <div className="mt-3">
            {tab === 'workflow' ? (
              <WorkflowTab
                separation={separation}
                canManage={canManage}
                editable={editable}
                checklistComplete={checklistComplete}
                canFinalize={canFinalize}
                confirming={confirming}
                actionError={actionError}
                togglePending={toggle.isPending}
                toggleIndex={toggle.variables?.index}
                finalizePending={finalize.isPending}
                onToggle={onToggle}
                onAskFinalize={() => setConfirming(true)}
                onCancelFinalize={() => setConfirming(false)}
                onFinalize={onFinalize}
              />
            ) : (
              <SeparationEmployeeData separation={separation} />
            )}
          </div>
        </>
      ) : null}
    </Dialog>
  )
}

function WorkflowTab({
  separation,
  canManage,
  editable,
  checklistComplete,
  canFinalize,
  confirming,
  actionError,
  togglePending,
  toggleIndex,
  finalizePending,
  onToggle,
  onAskFinalize,
  onCancelFinalize,
  onFinalize,
}: {
  separation: Separation
  canManage: boolean
  editable: boolean
  checklistComplete: boolean
  canFinalize: boolean
  confirming: boolean
  actionError: string | null
  togglePending: boolean
  toggleIndex: number | undefined
  finalizePending: boolean
  onToggle: (index: number, done: boolean) => void
  onAskFinalize: () => void
  onCancelFinalize: () => void
  onFinalize: () => void
}) {
  const { t } = useTranslation()
  const doneCount = separation.checklist.filter(([, done]) => done).length
  const daysLeft = noticeDaysLeft(separation.lastDay)
  const percent = Math.max(0, Math.min(100, separation.progress))
  const requesterVerb =
    separation.requestedBy === 'Branch Manager'
      ? t('Requested by')
      : separation.requestedBy === 'HR Manager'
        ? t('Initiated by')
        : t('Requested via')

  return (
    <div className="space-y-3">
      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-charcoal-50 px-3 py-2">
        <p className="min-w-0 text-[11px] text-charcoal-500">
          {requesterVerb}{' '}
          <b className="text-charcoal-800">{separation.requestedByUser ?? separation.requestedBy ?? '—'}</b>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={separation.status} />
          <Badge>{t(separation.separationType)}</Badge>
          {separation.submittedDate && (
            <span className="text-[10px] font-medium text-charcoal-500">
              {formatDate(separation.submittedDate)}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-charcoal-200 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">
            {t('Notice period · {{gym}}', { gym: separation.gym })}
          </p>
          <GymPill gym={separation.gym} />
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <p className="text-[10px] uppercase text-charcoal-400">{t('Last working day')}</p>
            <p className="font-semibold text-charcoal-800">
              {formatDate(separation.lastDay, { withYear: 'always' })}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-charcoal-400">{t('Days left')}</p>
            <p className="font-semibold text-charcoal-800">{daysLeft ?? '—'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase text-charcoal-400">{t('Reason')}</p>
            <p className="truncate font-semibold text-charcoal-800" title={separation.reason ?? undefined}>
              {separation.reason ?? '—'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 px-1 text-xs font-semibold">
          <span className="text-charcoal-700">{t('Exit steps')}</span>
          <span className={checklistComplete ? 'text-green-600' : 'text-brand-600'}>
            {doneCount}/{separation.checklist.length} ({percent}%)
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-charcoal-100">
          <div
            className={cn('h-full rounded-full transition-all', separation.status === 'Completed' ? 'bg-green-500' : 'bg-brand-500')}
            style={{ width: `${percent}%` }}
          />
        </div>

        {separation.checklist.length === 0 ? (
          <p className="mt-2 text-[11px] text-charcoal-400">{t('This case has no exit steps on file.')}</p>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {separation.checklist.map(([label, done], index) => (
              <label
                key={label}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg bg-charcoal-50 p-2.5 transition-colors',
                  editable ? 'cursor-pointer hover:bg-charcoal-100' : 'cursor-default',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn('h-2 w-2 shrink-0 rounded-full', done ? 'bg-green-500' : 'bg-charcoal-300')}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      'text-xs',
                      done ? 'text-charcoal-400 line-through' : 'font-medium text-charcoal-800',
                    )}
                  >
                    {label}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={done}
                  disabled={!editable || (togglePending && toggleIndex === index)}
                  onChange={(event) => onToggle(index, event.target.checked)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-charcoal-300 accent-brand-600 disabled:cursor-not-allowed"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {separation.status === 'Completed' ? (
        separation.verdict ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-green-800">{t('Exit verdict')}</p>
              <VerdictChips verdict={separation.verdict} />
            </div>
            <p className="mt-1 text-[11px] text-green-800">{separation.verdict.finalReason}</p>
            {separation.verdict.settlement?.note && (
              <p className="mt-0.5 text-[11px] text-green-700">{t('Settlement: {{note}}', { note: separation.verdict.settlement.note })}</p>
            )}
            {separation.verdict.rehire?.note && (
              <p className="mt-0.5 text-[11px] text-green-700">{t('Rehire: {{note}}', { note: separation.verdict.rehire.note })}</p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-center text-xs font-semibold text-green-800">
            {t('Separation finalized — employee records archived.')}
          </div>
        )
      ) : (
        <ExitVerdictForm separation={separation} canManage={canManage} />
      )}

      {editable && (
        <div className="flex flex-col gap-2 border-t border-charcoal-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-charcoal-500">
            {!checklistComplete
              ? t('Complete remaining exit steps to finalize.')
              : !separation.verdict
                ? t('Record the exit verdict to finalize.')
                : t('All exit steps verified — finalize to archive the employee record.')}
          </span>
          <Button
            variant={canFinalize ? 'danger' : 'secondary'}
            size="sm"
            disabled={!canFinalize}
            onClick={onAskFinalize}
          >
            {t('Finalize Separation')}
          </Button>
        </div>
      )}

      {editable && confirming && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            {t('Finalizing sets {{name}} to Terminated and deactivates their login. This cannot be undone.', {
              name: separation.employee,
            })}
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="danger" size="sm" onClick={onFinalize} loading={finalizePending}>
              {t('Confirm finalize')}
            </Button>
            <Button variant="outline" size="sm" onClick={onCancelFinalize}>
              {t('Cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
