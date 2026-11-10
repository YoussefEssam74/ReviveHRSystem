import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Dialog } from '../../../components/ui/dialog'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useFinalizeSeparation, useSeparation, useToggleChecklist } from '../hooks/useTerminations'
import { VerdictDialog } from './VerdictDialog'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney } from '../../../lib/format'
import { translate } from '../../../i18n'
import type { Separation } from '../api/terminations.api'

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-sm text-slate-900">{value}</p>
    </div>
  )
}

function verdictSummary(separation: Separation): string {
  const verdict = separation.verdict
  if (!verdict) return '—'
  const parts = [verdict.finalReason ?? '—']
  if (verdict.settlement && verdict.settlement.direction !== 'none') {
    const direction =
      verdict.settlement.direction === 'owedToEmployee'
        ? translate('Owed to employee')
        : translate('Employee owes')
    parts.push(`${direction} ${formatMoney(verdict.settlement.amount)}`)
  }
  if (verdict.rehire) parts.push(translate('Rehire: {{status}}', { status: translate(verdict.rehire.status) }))
  return parts.join(' · ')
}

export interface SeparationDetailDialogProps {
  separationId: number
  /** offboarding Edit — checklist toggles, verdict and finalize actions. */
  canManage: boolean
  onClose: () => void
}

/** The separation case drawer: checklist, verdict and finalize in one place. */
export function SeparationDetailDialog({ separationId, canManage, onClose }: SeparationDetailDialogProps) {
  const { t } = useTranslation()
  const { data: separation, isLoading, error } = useSeparation(separationId)
  const toggle = useToggleChecklist(separationId)
  const finalize = useFinalizeSeparation(separationId)
  const [verdictOpen, setVerdictOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const checklistComplete = (separation?.checklist ?? []).every(([, done]) => done)

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
      title={separation ? separation.employee : t('Separation')}
      description={separation ? `${separation.position} · ${separation.gym}` : undefined}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Close')}
          </Button>
          {canManage && separation && separation.status !== 'Completed' && (
            <>
              <Button variant="secondary" onClick={() => setVerdictOpen(true)}>
                {t('Save verdict')}
              </Button>
              <Button
                onClick={() => setConfirming(true)}
                disabled={!checklistComplete || !separation.verdict}
                title={
                  checklistComplete && separation.verdict
                    ? undefined
                    : t('The whole checklist must be done and a verdict saved before finalizing.')
                }
              >
                {t('Finalize')}
              </Button>
            </>
          )}
        </>
      }
    >
      {isLoading ? (
        <LoadingState label={t('Loading case…')} />
      ) : error ? (
        <ErrorState message={describeApiError(error)} />
      ) : separation ? (
        <div className="space-y-5">
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={separation.status} />
            <Badge>{separation.separationType}</Badge>
            {separation.verdict && <Badge>{t('Verdict saved')}</Badge>}
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium text-slate-700">{t('Exit checklist')}</p>
              <p className="text-slate-500">{t('{{percent}}% complete', { percent: separation.progress })}</p>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, separation.progress))}%` }}
              />
            </div>
            <ul className="mt-3 space-y-2">
              {separation.checklist.map(([label, done], index) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                    <span
                      className={
                        done
                          ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700'
                          : 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400'
                      }
                      aria-hidden="true"
                    >
                      {done ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                    <span className={done ? 'text-slate-400 line-through' : undefined}>{label}</span>
                  </span>
                  {canManage && separation.status !== 'Completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggle(index, !done)}
                      loading={toggle.isPending && toggle.variables?.index === index}
                    >
                      {done ? t('Undo') : t('Mark done')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label={t('Last day')} value={formatDate(separation.lastDay)} />
            <Detail label={t('Type')} value={separation.separationType} />
            <Detail label={t('Leave taken')} value={separation.leaveTaken != null ? String(separation.leaveTaken) : '—'} />
            <Detail label={t('Reason')} value={separation.reason ?? '—'} />
            <Detail label={t('Requested by')} value={separation.requestedBy ?? '—'} />
            <Detail label={t('Requested by user')} value={separation.requestedByUser ?? '—'} />
            <Detail label={t('Submitted')} value={formatDate(separation.submittedDate)} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Exit verdict')}</p>
            {separation.verdict ? (
              <>
                <p className="mt-1 text-sm text-slate-900">{verdictSummary(separation)}</p>
                {(separation.verdict.settlement?.note || separation.verdict.rehire?.note) && (
                  <p className="mt-1 text-sm italic text-slate-500">
                    {separation.verdict.settlement?.note || separation.verdict.rehire?.note}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">{t('No verdict has been recorded yet.')}</p>
            )}
          </div>

          {canManage && confirming && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                {t('Finalizing sets {{name}} to Terminated and deactivates their login. This cannot be undone.', {
                  name: separation.employee,
                })}
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="danger" size="sm" onClick={onFinalize} loading={finalize.isPending}>
                  {t('Confirm finalize')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {verdictOpen && separation && (
        <VerdictDialog separationId={separation.id} employeeName={separation.employee} onClose={() => setVerdictOpen(false)} />
      )}
    </Dialog>
  )
}
