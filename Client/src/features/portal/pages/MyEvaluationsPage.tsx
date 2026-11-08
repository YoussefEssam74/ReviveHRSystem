import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Sparkles } from 'lucide-react'
import { getOwnEvaluationDetails, type EvaluationDetail } from '../api/employee-file.api'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { StatusBadge } from '../../../components/ui/badge'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'

export default function MyEvaluationsPage() {
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null

  const [openId, setOpenId] = useState<number | null>(null)

  const evaluationsQuery = useQuery({
    queryKey: ['portal', 'evaluations', employeeId],
    queryFn: ({ signal }) => getOwnEvaluationDetails(employeeId!, signal),
    enabled: employeeId != null,
  })

  if (employeeId == null) {
    return <EmptyState title="No employee profile" hint="This account is not linked to an employee profile." />
  }
  if (evaluationsQuery.isLoading) return <LoadingState label="Loading your evaluations…" />
  if (evaluationsQuery.isError) {
    return <ErrorState message={describeApiError(evaluationsQuery.error)} onRetry={() => evaluationsQuery.refetch()} />
  }

  // Newest first — the latest evaluation becomes the hero score card.
  const evaluations = [...(evaluationsQuery.data ?? [])].sort((left, right) => right.date.localeCompare(left.date))
  const latest = evaluations[0] ?? null

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-charcoal-900">My Evaluations</h1>

      {latest ? (
        <div className="rounded-xl border border-charcoal-200 border-l-4 border-l-brand-500 bg-white p-4">
          <div className="flex items-center gap-4">
            <ScoreRing score={latest.score} maxScore={latest.maxScore} />
            <div>
              <p className="bento-label mb-0.5 text-charcoal-500">LATEST EVALUATION</p>
              <p className="text-sm font-bold text-charcoal-900">{latest.period}</p>
              <p className="mt-0.5 text-xs text-charcoal-500">
                Reviewed by {latest.reviewer || '—'} · {formatDate(latest.date)}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusBadge status={latest.status} />
                <span className="text-[10px] text-charcoal-500">
                  {Math.round((latest.score / latest.maxScore) * 100)}% score
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal-200 bg-white p-6 text-center">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-charcoal-300" aria-hidden="true" />
          <p className="text-xs text-charcoal-500">No evaluations completed yet</p>
          <p className="mt-1 text-[10px] text-charcoal-400">
            Once your team leader or HR submits an evaluation for you, the results appear here.
          </p>
        </div>
      )}

      {evaluations.length > 0 && (
        <>
          <h2 className="pt-1 text-sm font-semibold text-charcoal-900">Evaluation History</h2>
          <div className="space-y-1.5">
            {evaluations.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setOpenId(ev.id)}
                className="card card-interactive w-full p-3 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand-200 bg-brand-50">
                      <span className="text-sm font-bold text-brand-700">{ev.score}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-charcoal-900">{ev.period}</p>
                      <p className="text-[10px] text-charcoal-500">
                        {formatDate(ev.date)} · {ev.reviewer || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={ev.status} />
                    <ChevronRight className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {openId != null && (
        <EvaluationDetailModal evaluation={evaluations.find((ev) => ev.id === openId) ?? null} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}

function ScoreRing({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 0
  return (
    <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(#22c55e ${pct * 3.6}deg, #e5e7eb ${pct * 3.6}deg)` }}
      />
      <div className="absolute inset-[3px] rounded-full bg-white" />
      <div className="relative text-center">
        <p className="text-lg font-bold text-charcoal-900">{score}</p>
        <p className="text-[9px] text-charcoal-500">/ {maxScore}</p>
      </div>
    </div>
  )
}

function EvaluationDetailModal({ evaluation, onClose }: { evaluation: EvaluationDetail | null; onClose: () => void }) {
  return (
    <Modal
      open={evaluation != null}
      width="wide"
      title={evaluation ? `${evaluation.period} Evaluation` : ''}
      onClose={onClose}
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      {evaluation && (
        <div className="space-y-3">
          <div className="border-b border-charcoal-100 py-2 text-center">
            <ScoreRing score={evaluation.score} maxScore={evaluation.maxScore} />
            <p className="mt-2 text-xs text-charcoal-500">
              Reviewed by {evaluation.reviewer || '—'} · {formatDate(evaluation.date)}
            </p>
          </div>

          {evaluation.criteria.length === 0 ? (
            <p className="rounded-lg bg-charcoal-50 p-3 text-center text-xs text-charcoal-500">
              No criteria were recorded for this evaluation.
            </p>
          ) : (
            <div className="space-y-2.5">
              {evaluation.criteria.map((criterion, index) => {
                const pct = Math.round((criterion.score / evaluation.maxScore) * 100)
                const scoreColor = pct >= 80 ? 'text-brand-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'
                const barColor = pct >= 80 ? 'bg-brand-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                return (
                  <div key={index}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-charcoal-900">{criterion.name}</span>
                      <span className={cn('text-[11px] font-semibold', scoreColor)}>
                        {criterion.score}/{evaluation.maxScore}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal-100">
                      <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                    </div>
                    {criterion.comment && <p className="mt-1 text-[10px] text-charcoal-500">{criterion.comment}</p>}
                  </div>
                )
              })}
            </div>
          )}

          {evaluation.overallComment && (
            <div className="rounded-lg bg-charcoal-50 p-3">
              <p className="bento-label mb-1 text-charcoal-500">OVERALL COMMENT</p>
              <p className="text-xs text-charcoal-700">{evaluation.overallComment}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
