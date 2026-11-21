import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { formatDate, initialsOf } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { Separation } from '../api/terminations.api'
import { GymPill, VerdictChips } from './separation-ui'
import { STAGE_META, noticeDaysLeft, requesterLabel } from './separation-utils'

export interface SeparationCardProps {
  separation: Separation
  /** offboarding Edit — renders the stage arrows. */
  canManage: boolean
  moving: boolean
  onOpen: () => void
  /** -1 = previous stage, 1 = next stage. */
  onMove: (direction: -1 | 1) => void
}

/** One exit case on the pipeline board (mock _sepCard). */
export function SeparationCard({ separation, canManage, moving, onOpen, onMove }: SeparationCardProps) {
  const { t } = useTranslation()
  const stage = separation.status
  const meta = STAGE_META[stage] ?? STAGE_META.Requested
  const done = separation.checklist.filter(([, completed]) => completed).length
  const total = separation.checklist.length
  const daysLeft = noticeDaysLeft(separation.lastDay)
  const percent = Math.max(0, Math.min(100, separation.progress))
  const verdict = separation.verdict

  return (
    <article className="rounded-lg border border-charcoal-200 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11px] font-semibold text-red-700 ring-1 ring-red-100"
          aria-hidden="true"
        >
          {initialsOf(separation.employee)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-charcoal-900">{separation.employee}</p>
          <p className="truncate text-[11px] text-charcoal-500">{separation.position}</p>
        </div>
      </div>

      <div className="mt-2 space-y-1 rounded-lg bg-charcoal-50 p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-semibold text-purple-700">{requesterLabel(separation)}</p>
          <span className="shrink-0 text-[10px] text-charcoal-400">{formatDate(separation.submittedDate)}</span>
        </div>
        <p className="truncate text-[11px] text-charcoal-600" title={separation.reason ?? undefined}>
          {t('Why: {{reason}}', { reason: separation.reason ?? '—' })}
        </p>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
        <div>
          <dt className="text-[10px] uppercase text-charcoal-400">{t('Last day')}</dt>
          <dd className="font-medium text-charcoal-800">{formatDate(separation.lastDay, { withYear: 'always' })}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-charcoal-400">{t('Notice')}</dt>
          <dd className="font-medium text-charcoal-800">
            {daysLeft === null ? '—' : daysLeft === 1 ? t('1 day left') : t('{{count}} days left', { count: daysLeft })}
          </dd>
        </div>
      </dl>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <GymPill gym={separation.gym} />
        {stage === 'Requested' && <Badge color="purple">{t('From BM')}</Badge>}
        {stage === 'Notice Period' && <Badge color="blue">{t('Notice period')}</Badge>}
        {separation.leaveTaken != null && separation.leaveTaken > 0 && (
          <Badge color="gray">{t('Leave taken {{days}} d', { days: separation.leaveTaken })}</Badge>
        )}
        <VerdictChips verdict={verdict} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-charcoal-100">
          <div className={cn('h-full rounded-full transition-all', meta.bar)} style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[10px] text-charcoal-500">
          {total > 0 ? `${done}/${total}` : `${percent}%`}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {canManage && (
          <div className="flex gap-1">
            {/* No back arrow out of Completed: the backend already archived the
                employee and cut their access, so "un-completing" would desync. */}
            {stage !== 'Requested' && stage !== 'Completed' && (
              <Button
                variant="ghost"
                size="sm"
                className="px-1.5"
                disabled={moving}
                onClick={() => onMove(-1)}
                aria-label={t('Move back')}
                title={t('Move back')}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            {stage !== 'Completed' && (
              <Button
                variant="ghost"
                size="sm"
                className="px-1.5"
                disabled={moving}
                onClick={() => onMove(1)}
                aria-label={t('Move forward')}
                title={t('Move forward')}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
        <Button variant="secondary" size="sm" className="ms-auto" onClick={onOpen}>
          {t('Manage · View data')}
        </Button>
      </div>
    </article>
  )
}
