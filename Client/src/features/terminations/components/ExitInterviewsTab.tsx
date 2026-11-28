import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, ClipboardCheck } from 'lucide-react'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { TBody, TD, TH, THead, TR, Table } from '../../../components/ui/table'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateTime } from '../../../lib/format'
import { matchesName } from '../../../lib/name-date-filter'
import { useUpdateExitInterviewStatus } from '../hooks/useTerminations'
import type { Separation } from '../api/terminations.api'
import { EmployeeCell, ListToolbar, ToolbarSearch, ToolbarSelect } from './termination-ui'
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
  const [search, setSearch] = useState('')
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
    () =>
      cases
        .filter((item) => filter === 'All' || interviewFilterOf(item) === filter)
        .filter((item) => matchesName(item.employee, search)),
    [cases, filter, search],
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
      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <ListToolbar>
          <ToolbarSearch
            value={search}
            onChange={setSearch}
            placeholder={t('Search by employee name…')}
            className="sm:max-w-72"
          />
          <ToolbarSelect
            value={filter}
            onChange={(next) => setFilter(next as InterviewFilter)}
            label={t('Interview status')}
            className="w-full sm:w-44"
          >
            {(['All', 'Not scheduled', 'Scheduled', 'Rescheduled', 'No Show', 'Completed'] as InterviewFilter[]).map(
              (option) => (
                <option key={option} value={option}>
                  {option === 'All' ? t('All statuses') : t(option)} ({counts[option]})
                </option>
              ),
            )}
          </ToolbarSelect>
          <span className="ms-auto text-[11px] text-charcoal-400">
            {t('{{shown}} of {{total}}', { shown: visible.length, total: cases.length })}
          </span>
        </ListToolbar>

        {visible.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t('No exit interviews')}
            message={t('Approved exits appear here so HR can schedule and record the interview.')}
          />
        ) : (
          <Table>
            <THead>
              <TH className="text-start">{t('Employee')}</TH>
              <TH className="hidden text-start xl:table-cell">{t('Branch')}</TH>
              <TH className="text-start">{t('Interview date & time')}</TH>
              <TH className="text-start">{t('Status')}</TH>
              <TH className="hidden text-start xl:table-cell">{t('Clearance')}</TH>
              <TH className="text-end">{t('Actions')}</TH>
            </THead>
            <TBody>
              {visible.map((separation) => {
                const status = separation.exitInterviewStatus
                const clearanceDone = separation.clearance?.completed === true
                return (
                  <TR key={separation.id}>
                    <TD>
                      <EmployeeCell
                        separation={separation}
                        extra={<GymPill gym={separation.gym} className="mt-1 xl:hidden" />}
                      />
                    </TD>
                    <TD className="hidden xl:table-cell">
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
                    <TD className="hidden xl:table-cell">
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
