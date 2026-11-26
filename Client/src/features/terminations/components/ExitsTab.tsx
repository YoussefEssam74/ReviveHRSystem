import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { StatusBadge } from '../../../components/ui/badge'
import { TBody, TD, TH, THead, TR, Table } from '../../../components/ui/table'
import { NameDateFilterBar } from '../../../components/name-date-filter-bar'
import { NO_NAME_DATE_FILTER, matchesName, withinDateRange, type NameDateFilter } from '../../../lib/name-date-filter'
import { formatDate, formatDateTime } from '../../../lib/format'
import { SEPARATION_STATUSES, type Separation } from '../api/terminations.api'
import { EmployeeCell, FilterPill } from './termination-ui'
import { GymPill } from './separation-ui'
import { noticeDaysLeft, requesterLabel } from './separation-utils'
import { ScheduleInterviewDialog } from './ScheduleInterviewDialog'

type ExitFilter = 'All' | (typeof SEPARATION_STATUSES)[number]

export interface ExitsTabProps {
  /** Every separation case in scope; cancelled requests are ignored. */
  cases: Separation[]
  /** offboarding Edit — renders the stage and interview actions. */
  canManage: boolean
  /** Case currently moving between stages (disables its arrows). */
  movingId: number | null
  onOpen: (separationId: number) => void
  /** -1 = previous stage, 1 = next stage. */
  onMove: (separation: Separation, direction: -1 | 1) => void
}

/** Tab 1 — every exit as a flat table, with the stage stepper and interview booking. */
export function ExitsTab({ cases, canManage, movingId, onOpen, onMove }: ExitsTabProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ExitFilter>('All')
  const [filter, setFilter] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)
  const [scheduling, setScheduling] = useState<Separation | null>(null)

  const active = useMemo(() => cases.filter((item) => item.status !== 'Cancelled'), [cases])

  const counts = useMemo(() => {
    const next: Record<string, number> = { All: active.length }
    for (const stage of SEPARATION_STATUSES) next[stage] = 0
    for (const item of active) next[item.status] = (next[item.status] ?? 0) + 1
    return next
  }, [active])

  const visible = useMemo(
    () =>
      active.filter(
        (item) =>
          (status === 'All' || item.status === status) &&
          matchesName(item.employee, filter.name) &&
          withinDateRange(item.submittedDate, filter.from, filter.to),
      ),
    [active, status, filter],
  )

  const filtered = status !== 'All' || filter.name.trim() !== '' || filter.from !== '' || filter.to !== ''

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-charcoal-200 bg-white px-2 py-1.5">
        <span className="me-1 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">
          {t('Status')}
        </span>
        {(['All', ...SEPARATION_STATUSES] as ExitFilter[]).map((option) => (
          <FilterPill key={option} active={status === option} onClick={() => setStatus(option)}>
            {t(option)} ({counts[option] ?? 0})
          </FilterPill>
        ))}
      </div>

      <NameDateFilterBar
        filter={filter}
        onChange={setFilter}
        placeholder={t('Search by employee name…')}
        shown={visible.length}
        total={active.length}
      />

      <div className="rounded-xl border border-charcoal-200 bg-white">
        {visible.length === 0 ? (
          <EmptyState
            icon={LogOut}
            title={t('No exits')}
            message={
              filtered
                ? t('No exits match these filters.')
                : t('Termination requests and offboarding cases appear here.')
            }
          />
        ) : (
          <Table>
            <THead>
              <TH className="px-2">{t('Employee')}</TH>
              <TH className="px-2">{t('Branch')}</TH>
              <TH className="px-2">{t('Reason')}</TH>
              <TH className="px-2">{t('Requested / last day')}</TH>
              <TH className="px-2">{t('Status')}</TH>
              <TH className="px-2">{t('Exit interview')}</TH>
              <TH className="sticky end-0 bg-white px-2 text-end">{t('Actions')}</TH>
            </THead>
            <TBody>
              {visible.map((separation) => {
                const stage = separation.status
                const done = separation.checklist.filter(([, completed]) => completed).length
                const total = separation.checklist.length
                const daysLeft = noticeDaysLeft(separation.lastDay)
                const moving = movingId === separation.id
                const approved = separation.approvalStatus === 'Approved'
                const interviewStatus = separation.exitInterviewStatus

                return (
                  <TR key={separation.id}>
                    <TD className="px-2">
                      <EmployeeCell separation={separation} />
                    </TD>
                    <TD className="px-2">
                      <GymPill gym={separation.gym} />
                      <p className="mt-1 text-[10px] text-charcoal-400">{requesterLabel(separation)}</p>
                    </TD>
                    <TD className="max-w-48 px-2">
                      <p className="truncate font-medium text-charcoal-800" title={separation.reason ?? undefined}>
                        {separation.reason ?? '—'}
                      </p>
                      <p className="text-[10px] text-charcoal-400">{t(separation.separationType)}</p>
                    </TD>
                    <TD className="whitespace-nowrap px-2">
                      <p>{formatDate(separation.submittedDate, { withYear: 'always' })}</p>
                      <p className="text-[10px] text-charcoal-400">
                        {t('Last day {{date}}', { date: formatDate(separation.lastDay, { withYear: 'always' }) })}
                        {stage !== 'Completed' && daysLeft !== null && (
                          <> · {daysLeft === 1 ? t('1 day left') : t('{{count}} days left', { count: daysLeft })}</>
                        )}
                      </p>
                    </TD>
                    <TD className="px-2">
                      <div className="flex items-center gap-1">
                        <StatusBadge status={stage} />
                        {canManage && stage !== 'Completed' && (
                          <span className="flex gap-0.5">
                            {stage !== 'Requested' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="px-1"
                                disabled={moving}
                                onClick={() => onMove(separation, -1)}
                                aria-label={t('Move back')}
                                title={t('Move back')}
                              >
                                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-1"
                              disabled={moving}
                              onClick={() => onMove(separation, 1)}
                              aria-label={t('Move forward')}
                              title={t('Move forward')}
                            >
                              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                            </Button>
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-charcoal-400">
                        {total > 0 ? t('{{done}}/{{total}} exit steps', { done, total }) : `${separation.progress}%`}
                      </p>
                    </TD>
                    <TD className="whitespace-nowrap px-2">
                      {interviewStatus ? (
                        <>
                          <StatusBadge status={interviewStatus} />
                          {separation.exitInterviewScheduledAt && (
                            <p className="mt-1 text-[10px] text-charcoal-400">
                              {formatDateTime(separation.exitInterviewScheduledAt)}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-charcoal-400">{t('Not scheduled')}</span>
                      )}
                    </TD>
                    <TD className="sticky end-0 bg-white px-2">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {canManage && approved && stage !== 'Completed' && (
                          <Button variant="secondary" size="sm" onClick={() => setScheduling(separation)}>
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                            {separation.exitInterviewScheduledAt ? t('Reschedule') : t('Schedule')}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onOpen(separation.id)}
                          title={t('Manage · View data')}
                        >
                          {t('Manage')}
                        </Button>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </div>

      <div className="rounded-xl border border-brand-200 border-s-4 border-s-brand-500 bg-white p-3">
        <p className="text-xs font-semibold text-charcoal-900">{t('EXIT PROCESS')}</p>
        <p className="mt-0.5 text-[11px] text-charcoal-500">
          {t(
            'Standard 5-step offboarding: Exit interview → Handover → Uniform/asset return → Access revocation → Final settlement. Annual leave is settled pro-rata — days taken beyond the accrual are counted as absent, not annual leave.',
          )}
        </p>
      </div>

      {scheduling && <ScheduleInterviewDialog separation={scheduling} onClose={() => setScheduling(null)} />}
    </div>
  )
}
