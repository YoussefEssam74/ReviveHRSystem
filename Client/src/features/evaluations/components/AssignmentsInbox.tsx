import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { DispatchAssignment } from '../api/evaluations.api'
import { useEvaluationAssignments } from '../hooks/useEvaluations'

/** One routed form for the signed-in evaluator, with per-subject progress. */
function AssignmentCard({ assignment, onStart }: { assignment: DispatchAssignment; onStart: () => void }) {
  const { t } = useTranslation()
  const total = assignment.subjects.length
  const done = assignment.subjects.filter((subject) => assignment.completedSubjects.includes(subject)).length
  const percent = total ? Math.round((done / total) * 100) : 0
  const label = done === 0 ? t('Start') : done < total ? t('Continue') : t('Review')

  return (
    <div className="rounded-xl border border-charcoal-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-charcoal-900">{assignment.formName}</p>
          <p className="mt-0.5 text-[10px] text-charcoal-400">
            {t('Dispatched {{date}} by {{name}}', {
              date: formatDate(assignment.dispatchedDate),
              name: assignment.dispatchedBy || '—',
            })}
          </p>
        </div>
        <span className={cn('badge text-[9px]', assignment.status === 'Completed' ? 'badge-success' : 'badge-brand')}>
          {t(assignment.status)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {assignment.subjects.map((subject) => {
          const completed = assignment.completedSubjects.includes(subject)
          return (
            <span key={subject} className={cn('badge text-[9px]', completed ? 'badge-success' : 'badge-gray')}>
              {completed ? '✓ ' : ''}
              {subject}
            </span>
          )
        })}
      </div>

      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10px] text-charcoal-500">
          {done} / {total} {t('completed')}
        </p>
        <Button size="sm" onClick={onStart}>
          {label}
        </Button>
      </div>
    </div>
  )
}

/**
 * "My Evaluations" inbox — rendered above the tabs for evaluators with routed
 * work. HR users without assignments see nothing (the API answers with []).
 */
export function AssignmentsInbox({ onStart }: { onStart: (assignment: DispatchAssignment) => void }) {
  const { t } = useTranslation()
  const assignments = useEvaluationAssignments({ page: 1, pageSize: 20 })
  const items = assignments.data?.items ?? []
  if (items.length === 0) return null

  const pending = items.filter((assignment) => assignment.completedSubjects.length < assignment.subjects.length).length

  return (
    <div className="rounded-xl border border-charcoal-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="bento-label text-brand-600">{t('MY EVALUATIONS')}</p>
          <span className="badge badge-brand text-[9px]">{items.length}</span>
        </div>
        {pending > 0 ? (
          <span className="text-[10px] font-semibold text-brand-600">{t('{{count}} pending', { count: pending })}</span>
        ) : (
          <span className="text-[10px] font-semibold text-green-600">{t('All caught up')}</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((assignment) => (
          <AssignmentCard key={assignment.id} assignment={assignment} onStart={() => onStart(assignment)} />
        ))}
      </div>
    </div>
  )
}
