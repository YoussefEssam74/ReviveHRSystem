import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Dialog } from '../../../components/ui/dialog'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useFinalizeSeparation, useSeparation, useToggleChecklist } from '../hooks/useTerminations'
import { VerdictDialog } from './VerdictDialog'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney } from '../../../lib/format'
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
    parts.push(`${verdict.settlement.direction === 'owedToEmployee' ? 'Owed to employee' : 'Employee owes'} ${formatMoney(verdict.settlement.amount)}`)
  }
  if (verdict.rehire) parts.push(`Rehire: ${verdict.rehire.status}`)
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
      title={separation ? separation.employee : 'Separation'}
      description={separation ? `${separation.position} · ${separation.gym}` : undefined}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canManage && separation && separation.status !== 'Completed' && (
            <>
              <Button variant="secondary" onClick={() => setVerdictOpen(true)}>
                Save verdict
              </Button>
              <Button
                onClick={() => setConfirming(true)}
                disabled={!checklistComplete || !separation.verdict}
                title={
                  checklistComplete && separation.verdict
                    ? undefined
                    : 'The whole checklist must be done and a verdict saved before finalizing.'
                }
              >
                Finalize
              </Button>
            </>
          )}
        </>
      }
    >
      {isLoading ? (
        <LoadingState label="Loading case…" />
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
            {separation.verdict && <Badge>Verdict saved</Badge>}
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium text-slate-700">Exit checklist</p>
              <p className="text-slate-500">{separation.progress}% complete</p>
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
                      {done ? 'Undo' : 'Mark done'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label="Last day" value={formatDate(separation.lastDay)} />
            <Detail label="Type" value={separation.separationType} />
            <Detail label="Leave taken" value={separation.leaveTaken != null ? String(separation.leaveTaken) : '—'} />
            <Detail label="Reason" value={separation.reason ?? '—'} />
            <Detail label="Requested by" value={separation.requestedBy ?? '—'} />
            <Detail label="Requested by user" value={separation.requestedByUser ?? '—'} />
            <Detail label="Submitted" value={formatDate(separation.submittedDate)} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Exit verdict</p>
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
              <p className="mt-1 text-sm text-slate-500">No verdict has been recorded yet.</p>
            )}
          </div>

          {canManage && confirming && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Finalizing sets {separation.employee} to Terminated and deactivates their login. This cannot be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="danger" size="sm" onClick={onFinalize} loading={finalize.isPending}>
                  Confirm finalize
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
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
