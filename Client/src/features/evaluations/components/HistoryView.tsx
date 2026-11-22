import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { useToast } from '../../../components/ui/toast'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { useCreateGoal, useEvaluationResponses, useGoals, usePerformanceCycles } from '../hooks/useEvaluations'
import { scoreBarTone, scoreTone } from './evaluation-format'
import { EmptyPanel, InitialsAvatar } from './evaluation-ui'

const CYCLE_TONE: Record<string, string> = {
  Upcoming: 'border-charcoal-200 text-charcoal-500',
  'In Progress': 'border-brand-300 bg-brand-50 text-brand-700',
  Completed: 'bg-charcoal-50 text-charcoal-500',
}

const GOAL_TONE: Record<string, string> = {
  'On Track': 'text-green-600',
  'At Risk': 'text-yellow-600',
  Behind: 'text-red-600',
}

function goalBarTone(status: string): string {
  return status === 'On Track' ? 'bg-green-500' : status === 'At Risk' ? 'bg-yellow-500' : 'bg-red-500'
}

export interface HistoryViewProps {
  canRun: boolean
  onBack: () => void
  onRun: () => void
}

/** History & Trends (mock `_evalTab === 'history'`): KPIs, cycles, goals, answers. */
export function HistoryView({ canRun, onBack, onRun }: HistoryViewProps) {
  const { t } = useTranslation()
  const [goalOpen, setGoalOpen] = useState(false)

  const responses = useEvaluationResponses({ page: 1, pageSize: 100 })
  const cycles = usePerformanceCycles()
  const goals = useGoals({ page: 1, pageSize: 20 })

  const history = useMemo(() => responses.data?.items ?? [], [responses.data])

  const stats = useMemo(() => {
    const scored = history.filter((row) => row.score != null)
    const average = scored.length
      ? Math.round(scored.reduce((sum, row) => sum + (row.score ?? 0), 0) / scored.length)
      : 0
    return {
      average,
      completed: history.filter((row) => row.status === 'Completed').length,
      inProgress: history.filter((row) => row.status === 'In Progress').length,
      below: history.filter((row) => (row.score ?? 100) < 60).length,
    }
  }, [history])

  const avgByForm = useMemo(() => {
    const buckets = new Map<string, { sum: number; count: number }>()
    history.forEach((row) => {
      if (row.score == null) return
      const bucket = buckets.get(row.form) ?? { sum: 0, count: 0 }
      bucket.sum += row.score
      bucket.count += 1
      buckets.set(row.form, bucket)
    })
    return [...buckets.entries()]
      .map(([form, bucket]) => ({ form, average: Math.round(bucket.sum / bucket.count) }))
      .sort((left, right) => right.average - left.average)
  }, [history])

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-charcoal-900">{t('History & Trends')}</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {t('Performance cycles, average scores by form & completed evaluations')}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onBack}>
          {t('← All Forms')}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-charcoal-200 border-s-4 border-s-brand-500 bg-white p-3 text-center">
          <p className="text-base font-bold text-brand-600">{stats.average}%</p>
          <p className="text-[10px] text-charcoal-500">{t('Avg Score')}</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-base font-bold text-charcoal-900">{stats.completed}</p>
          <p className="text-[10px] text-charcoal-500">{t('Completed')}</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-base font-bold text-blue-600">{stats.inProgress}</p>
          <p className="text-[10px] text-charcoal-500">{t('In Progress')}</p>
        </div>
        <div className="rounded-xl border border-charcoal-200 bg-white p-3 text-center">
          <p className="text-base font-bold text-charcoal-900">{stats.below}</p>
          <p className="text-[10px] text-charcoal-500">{t('Below Target')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-charcoal-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="bento-label text-charcoal-500">{t('PERFORMANCE CYCLES')}</p>
          {cycles.data?.items[0] && (
            <span className="text-[10px] text-charcoal-500">
              {t('{{name}} · {{status}}', { name: cycles.data.items[0].name, status: t(cycles.data.items[0].status) })}
            </span>
          )}
        </div>
        {cycles.isLoading || !cycles.data ? (
          <LoadingState label={t('Loading cycles…')} />
        ) : cycles.data.items.length === 0 ? (
          <p className="text-xs text-charcoal-400">{t('No performance cycles configured yet.')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {cycles.data!.items.map((cycle) => (
              <span
                key={cycle.id}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-[10px] font-medium',
                  CYCLE_TONE[cycle.status] ?? 'border-charcoal-200 text-charcoal-500',
                )}
              >
                {cycle.name} · {t(cycle.status)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-charcoal-200 bg-white p-3">
          <p className="bento-label mb-2.5 text-charcoal-500">{t('AVG SCORE BY FORM')}</p>
          {avgByForm.length === 0 ? (
            <p className="text-xs text-charcoal-400">{t('Scores appear here once evaluations are submitted.')}</p>
          ) : (
            <div className="space-y-2">
              {avgByForm.map((row) => (
                <div key={row.form} className="flex items-center gap-2">
                  <p className="w-44 flex-shrink-0 truncate text-[10px] text-charcoal-600" title={row.form}>
                    {row.form}
                  </p>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-charcoal-100">
                    <div
                      className={cn('h-full rounded-full', scoreBarTone(row.average))}
                      style={{ width: `${row.average}%` }}
                    />
                  </div>
                  <p className="w-8 text-end text-[10px] font-semibold text-charcoal-800">{row.average}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="flex items-center justify-between border-b border-charcoal-100 px-3 py-2.5">
            <p className="bento-label text-charcoal-500">{t('GOALS & OKRs')}</p>
            <Button size="sm" variant="ghost" onClick={() => setGoalOpen(true)}>
              {t('+ Add')}
            </Button>
          </div>
          <div className="p-3">
            {goals.error ? (
              <ErrorState message={describeApiError(goals.error)} />
            ) : goals.isLoading || !goals.data ? (
              <LoadingState label={t('Loading goals…')} />
            ) : goals.data.items.length === 0 ? (
              <EmptyPanel title={t('No goals yet')} hint={t('Use “+ Add” to set the first employee goal.')} />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {goals.data!.items.map((goal) => (
                  <div key={goal.id} className="rounded-xl border border-charcoal-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-medium leading-snug text-charcoal-800">{goal.title}</p>
                      <span className={cn('text-[9px] font-semibold', GOAL_TONE[goal.status] ?? 'text-charcoal-500')}>
                        {t(goal.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] text-charcoal-400">
                      {[goal.employee, goal.owner, goal.due ? t('Due {{date}}', { date: formatDate(goal.due) }) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-100">
                      <div
                        className={cn('h-full rounded-full', goalBarTone(goal.status))}
                        style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[9px] text-charcoal-500">{t('{{progress}}% complete', { progress: goal.progress })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-100 px-4 py-2.5">
          <p className="bento-label text-charcoal-500">{t('EVALUATION HISTORY')}</p>
          {canRun && (
            <Button size="sm" onClick={onRun}>
              {t('Run New Evaluation')}
            </Button>
          )}
        </div>

        {responses.error ? (
          <ErrorState message={describeApiError(responses.error)} />
        ) : responses.isLoading || !responses.data ? (
          <LoadingState label={t('Loading evaluations…')} />
        ) : history.length === 0 ? (
          <div className="p-4">
            <EmptyPanel
              title={t('No evaluations yet')}
              hint={t('Run a form or launch a cycle to start collecting evaluations.')}
            />
          </div>
        ) : (
          <div className="divide-y divide-charcoal-50">
            {history.map((row) => (
              <div key={row.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar name={row.employee} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-charcoal-900">{row.employee}</p>
                      <p className="truncate text-[9px] text-charcoal-400">
                        {row.form}
                        {row.period ? ` · ${row.period}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className={cn('text-sm font-bold', scoreTone(row.score))}>{row.score ?? '—'}%</p>
                    <p className="text-[9px] text-charcoal-400">
                      <span
                        className={cn(
                          'badge text-[9px]',
                          row.status === 'Completed' ? 'badge-success' : row.status === 'In Progress' ? 'badge-blue' : 'badge-gray',
                        )}
                      >
                        {t(row.status)}
                      </span>
                    </p>
                  </div>
                </div>
                {row.notes && (
                  <div className="mt-2 rounded-lg bg-charcoal-50 p-2 text-[10px] text-charcoal-600">
                    <strong>{t('Manager note:')}</strong> {row.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {goalOpen && <GoalDialog onClose={() => setGoalOpen(false)} />}
    </div>
  )
}

/** Compact "+ Add" goal form (POST /api/goals). */
function GoalDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const createGoal = useCreateGoal()
  const [employee, setEmployee] = useState('')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [owner, setOwner] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSave = async () => {
    setError(null)
    try {
      await createGoal.mutateAsync({
        employee: employee.trim() || undefined,
        title: title.trim(),
        due: due || undefined,
        owner: owner.trim() || undefined,
      })
      toast(t('Goal created'))
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('New goal')}
      description={t('Add an employee goal to the History & Trends board')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSave} loading={createGoal.isPending} disabled={title.trim().length === 0}>
            {t('Create goal')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div>
          <label className="form-label" htmlFor="goal-title">
            {t('Goal')}
          </label>
          <input id="goal-title" className="form-input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="goal-employee">
              {t('Employee')}
            </label>
            <input
              id="goal-employee"
              className="form-input"
              value={employee}
              onChange={(event) => setEmployee(event.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="goal-owner">
              {t('Owner')}
            </label>
            <input id="goal-owner" className="form-input" value={owner} onChange={(event) => setOwner(event.target.value)} />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="goal-due">
            {t('Due date')}
          </label>
          <input
            id="goal-due"
            type="date"
            className="form-input"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
        </div>
      </div>
    </Dialog>
  )
}
