import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Star } from 'lucide-react'
import { getMyTeams, getTeamEvaluations, type TeamEvaluation } from '../api/team.api'
import { getOwnEvaluationDetails, type EvaluationDetail } from '../api/employee-file.api'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDateWithYear } from '../../../lib/format'
import { cn } from '../../../lib/utils'

/** The mock's score→result bands (score/5): ≥4 Exceeds, ≥3 Meets, else Below. */
function resultOf(score: number): 'Exceeds' | 'Meets' | 'Below' {
  return score >= 4 ? 'Exceeds' : score >= 3 ? 'Meets' : 'Below'
}

const RESULT_COLORS: Record<string, string> = {
  Exceeds: 'badge-green',
  Meets: 'badge-blue',
  Below: 'badge-red',
}

export default function TeamPerformancePage() {
  const { me, isTeamLeader, isBranchManager } = usePortalSession()
  const ledTeamId = me?.ledTeamId ?? null

  if (!isTeamLeader && !isBranchManager) {
    return <EmptyState title="Team Performance is for managers" hint="Evaluations drill-ins scope to the team you lead." />
  }
  return <TeamsLoader ledTeamId={ledTeamId} />
}

function TeamsLoader({ ledTeamId }: { ledTeamId: number | null }) {
  const teamsQuery = useQuery({
    queryKey: ['portal', 'teams'],
    queryFn: ({ signal }) => getMyTeams(signal),
  })

  if (teamsQuery.isLoading) return <LoadingState />
  if (teamsQuery.error)
    return <ErrorState message={describeApiError(teamsQuery.error)} onRetry={() => teamsQuery.refetch()} />

  const teams = teamsQuery.data ?? []
  if (teams.length === 0) {
    return (
      <EmptyState
        title="No team in this gym"
        hint="Team Performance scopes to the teams you lead or belong to in the active gym."
      />
    )
  }

  return <TeamPerformanceView teams={teams} preferredTeamId={ledTeamId} />
}

function TeamPerformanceView({ teams, preferredTeamId }: { teams: { id: number; name: string; memberCount: number }[]; preferredTeamId: number | null }) {
  const [teamId, setTeamId] = useState<number>(preferredTeamId ?? teams[0].id)
  const team = teams.find((t) => t.id === teamId) ?? teams[0]

  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-charcoal-900">Team Performance</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {team.name} · {team.memberCount} members · evaluations submitted for the team
          </p>
        </div>
        <TeamSelect teams={teams} value={team.id} onChange={setTeamId} />
      </div>

      <EvaluationsPanel teamId={team.id} />
    </div>
  )
}

function TeamSelect({
  teams,
  value,
  onChange,
}: {
  teams: { id: number; name: string }[]
  value: number
  onChange: (id: number) => void
}) {
  if (teams.length === 1) {
    return <span className="badge badge-blue shrink-0">{teams[0].name}</span>
  }
  return (
    <select
      aria-label="Team"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="form-input max-w-[240px] text-[13px]"
    >
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  )
}

function EvaluationsPanel({ teamId }: { teamId: number }) {
  const evalsQuery = useQuery({
    queryKey: ['portal', 'team-evaluations', teamId],
    queryFn: ({ signal }) => getTeamEvaluations(teamId, signal),
  })

  if (evalsQuery.isLoading) return <LoadingState />
  if (evalsQuery.error)
    return <ErrorState message={describeApiError(evalsQuery.error)} onRetry={() => evalsQuery.refetch()} />

  const evals = evalsQuery.data ?? []
  if (evals.length === 0) {
    return (
      <EmptyState
        title="No evaluations yet"
        hint="Team rows appear once evaluations are submitted for the team's members."
      />
    )
  }

  return <PerformanceList evals={evals} />
}

function PerformanceList({ evals }: { evals: TeamEvaluation[] }) {
  const [detail, setDetail] = useState<TeamEvaluation | null>(null)

  const stats = useMemo(() => {
    const avg = evals.reduce((acc, e) => acc + e.score, 0) / evals.length
    const counts = { Exceeds: 0, Meets: 0, Below: 0 } as Record<string, number>
    for (const e of evals) counts[resultOf(e.score)] += 1
    return { avg, counts }
  }, [evals])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-charcoal-200 border-l-4 border-l-brand-500 bg-white p-3 text-center">
          <p className="text-lg font-bold text-brand-600">{stats.avg.toFixed(1)}</p>
          <p className="text-[10px] text-charcoal-500">Avg Score</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-green-600">{stats.counts.Exceeds}</p>
          <p className="text-[10px] text-charcoal-500">Exceeds</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-blue-600">{stats.counts.Meets}</p>
          <p className="text-[10px] text-charcoal-500">Meets</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-red-600">{stats.counts.Below}</p>
          <p className="text-[10px] text-charcoal-500">Below</p>
        </div>
      </div>

      <div className="divide-y divide-charcoal-50 overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        {evals.map((e) => (
          <button key={e.id} className="block w-full p-3 text-left transition-colors hover:bg-charcoal-50/50" onClick={() => setDetail(e)}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                  {initialsOf(e.employeeName)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-charcoal-900">{e.employeeName}</p>
                  <p className="text-[10px] text-charcoal-500">
                    {e.period} · {formatDateWithYear(e.date)} · Reviewer {e.reviewer || '—'}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <StarScore score={e.score} />
                <span className={cn('badge', RESULT_COLORS[resultOf(e.score)])}>{resultOf(e.score)}</span>
                <StatusBadge status={e.status} />
                <ChevronRight className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {detail && (
        <TeamEvaluationModal evaluation={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

function StarScore({ score }: { score: number }) {
  const rounded = Math.round(score)
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-charcoal-900">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn('h-3.5 w-3.5', index < rounded ? 'text-yellow-400' : 'text-charcoal-200')}
          fill="currentColor"
          aria-hidden="true"
        />
      ))}
      {score.toFixed(1)}
      <span className="font-normal text-charcoal-400">/ {5}</span>
    </span>
  )
}

function TeamEvaluationModal({ evaluation, onClose }: { evaluation: TeamEvaluation; onClose: () => void }) {
  // The rich criteria live on the B5 detail endpoint; the list row already has
  // them — but re-fetch by employee id to guarantee the freshest answers.
  const detailQuery = useQuery({
    queryKey: ['portal', 'member', 'evaluations', evaluation.employeeId],
    queryFn: ({ signal }) => getOwnEvaluationDetails(evaluation.employeeId, signal),
  })

  const detail: EvaluationDetail | null =
    detailQuery.data?.find((candidate) => candidate.id === evaluation.id) ??
    (detailQuery.data && detailQuery.data.length === 1 ? detailQuery.data[0] : null)

  const shown = detail ?? {
    id: evaluation.id,
    period: evaluation.period,
    score: evaluation.score,
    maxScore: evaluation.maxScore,
    status: evaluation.status,
    date: evaluation.date,
    reviewer: evaluation.reviewer,
    criteria: evaluation.criteria,
    overallComment: evaluation.overallComment,
  }

  return (
    <Modal
      open
      title={`${evaluation.employeeName} — ${shown.period}`}
      subtitle={`Submitted ${formatDateWithYear(shown.date)} · Reviewer ${shown.reviewer || '—'}`}
      onClose={onClose}
      footer={
        <Button size="sm" variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {detailQuery.isLoading && <LoadingState />}
      {detailQuery.error && (
        <ErrorState message={describeApiError(detailQuery.error)} onRetry={() => detailQuery.refetch()} />
      )}
      {!detailQuery.isLoading && !detailQuery.error && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 border-b border-charcoal-100 pb-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-[13px] font-semibold text-brand-700">
              {initialsOf(evaluation.employeeName)}
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold text-charcoal-900">{evaluation.employeeName}</p>
              <p className="text-[10px] text-charcoal-500">{shown.period}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-brand-700">{shown.score.toFixed(1)}</p>
              <p className="text-[10px] text-charcoal-500">/ {shown.maxScore}</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {shown.criteria.map((c, index) => {
              const pct = Math.min(100, Math.round((c.score / (shown.maxScore || 5)) * 100))
              return (
                <div key={index}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-charcoal-900">{c.name}</span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        pct >= 80 ? 'text-brand-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600',
                      )}
                    >
                      {c.score.toFixed(1)}/{shown.maxScore}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal-100">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        pct >= 80 ? 'bg-brand-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {c.comment && <p className="mt-1 text-[10px] text-charcoal-500">{c.comment}</p>}
                </div>
              )
            })}
          </div>
          <div className="rounded-lg bg-charcoal-50 p-3">
            <p className="bento-label text-charcoal-500">OVERALL COMMENT</p>
            <p className="mt-1 text-xs text-charcoal-700">{shown.overallComment || 'No comment'}</p>
          </div>
        </div>
      )}
    </Modal>
  )
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}
