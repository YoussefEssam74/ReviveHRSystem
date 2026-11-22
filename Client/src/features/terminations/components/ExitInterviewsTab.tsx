import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, ClipboardCheck } from 'lucide-react'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { TBody, TD, TH, THead, TR, Table } from '../../../components/ui/table'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateTime } from '../../../lib/format'
import { useUpdateExitInterviewStatus } from '../hooks/useTerminations'
import type { Separation } from '../api/terminations.api'
import { EmployeeCell, FilterPill } from './termination-ui'
import { ScheduleInterviewDialog } from './ScheduleInterviewDialog'
import { GymPill } from './separation-ui'

type InterviewFilter = 'All' | 'Not scheduled' | 'Scheduled' | 'Rescheduled' | 'Completed' | 'No Show'

/** Interview status with a display fallback for "never scheduled". */
function interviewFilterOf(separation: Separation): InterviewFilter {
  return (separation.exitInterviewStatus as InterviewFilter | null) ?? 'Not scheduled'
}

export interface ExitInterviewsTabProps {
  cases: Separation[]
  canManage: boolean
  onOpenForm: (separationId: number) => void
}

/** Tab 2 — HR books the exit interview and records the outcome. */
export function ExitInterviewsTab({ cases, canManage, onOpenForm }: ExitInterviewsTabProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<InterviewFilter>('All')
  const [scheduling, setScheduling] = useState<Separation | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const updateStatus = useUpdateExitInterviewStatus()

  const counts = useMemo(() => {
    const base: Record<InterviewFilter, number> = {
      All: cases.length,
      'Not scheduled': 0,
      Scheduled: 0,
      Rescheduled: 0,
      Completed: 0,
      'No Show': 0,
    }
    for (const item of cases) base[interviewFilterOf(item)] += 1
    return base
  }, [cases])

  const visible = useMemo(
    () => (filter === 'All' ? cases : cases.filter((item) => interviewFilterOf(item) === filter)),
    [cases, filter],
  )

  const markNoShow = async (separation: Separation) => {
    setActionError(null)
    try {
      await updateStatus.mutateAsync({ id: separation.id, body: { status: 'No Show' } })
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-charcoal-200 bg-white px-2 py-1.5">
        <span className="me-1 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">
          {t('Interview status')}
        </span>
        {(['All', 'Not scheduled', 'Scheduled', 'Rescheduled', 'No Show', 'Completed'] as InterviewFilter[]).map(
          (option) => (
            <FilterPill key={option} active={filter === option} onClick={() => setFilter(option)}>
              {t(option)} ({counts[option]})
            </FilterPill>
          ),
        )}
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </p>
      )}

      <div className="rounded-xl border border-charcoal-200 bg-white">
        {visible.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t('No exit interviews')}
            message={t('Approved exits appear here so HR can schedule and record the interview.')}
          />
        ) : (
          <Table>
            <THead>
              <TH>{t('Employee')}</TH>
              <TH>{t('Branch')}</TH>
              <TH>{t('Interview date & time')}</TH>
              <TH>{t('Status')}</TH>
              <TH>{t('Clearance')}</TH>
              <TH className="text-end">{t('Actions')}</TH>
            </THead>
            <TBody>
              {visible.map((separation) => {
                const status = separation.exitInterviewStatus
                const clearanceDone = separation.clearance?.completed === true
                return (
                  <TR key={separation.id}>
                    <TD>
                      <EmployeeCell separation={separation} />
                    </TD>
                    <TD>
                      <GymPill gym={separation.gym} />
                      <p className="mt-1 text-[10px] text-charcoal-400">
                        {t('Last day {{date}}', { date: formatDate(separation.lastDay, { withYear: 'always' }) })}
                      </p>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {separation.exitInterviewScheduledAt ? (
                        formatDateTime(separation.exitInterviewScheduledAt)
                      ) : (
                        <span className="text-charcoal-400">{t('Not scheduled')}</span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge status={status ?? 'Not scheduled'} />
                    </TD>
                    <TD>
                      {clearanceDone ? (
                        <Badge color="green">{t('Closed')}</Badge>
                      ) : status === 'Completed' ? (
                        <Badge color="yellow">{t('Awaiting clearance')}</Badge>
                      ) : (
                        <span className="text-[11px] text-charcoal-400">—</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap justify-end gap-1">
                        {canManage && (
                          <Button variant="secondary" size="sm" onClick={() => setScheduling(separation)}>
                            {separation.exitInterviewScheduledAt ? t('Reschedule') : t('Schedule')}
                          </Button>
                        )}
                        {canManage && (status === 'Scheduled' || status === 'Rescheduled') && (
                          <Button
                            variant="dangerOutline"
                            size="sm"
                            disabled={updateStatus.isPending}
                            onClick={() => void markNoShow(separation)}
                          >
                            {t('No Show')}
                          </Button>
                        )}
                        <Button variant="primary" size="sm" onClick={() => onOpenForm(separation.id)}>
                          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          {status === 'Completed' ? t('Review form') : t('Conduct interview')}
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

      {scheduling && <ScheduleInterviewDialog separation={scheduling} onClose={() => setScheduling(null)} />}
    </div>
  )
}
