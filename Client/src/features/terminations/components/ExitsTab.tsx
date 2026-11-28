import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, CalendarRange, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { StatusBadge } from '../../../components/ui/badge'
import { Input } from '../../../components/ui/input'
import { TBody, TD, TH, THead, TR, Table } from '../../../components/ui/table'
import { NO_NAME_DATE_FILTER, matchesName, withinDateRange, type NameDateFilter } from '../../../lib/name-date-filter'
import { formatDate, formatDateTime } from '../../../lib/format'
import { SEPARATION_STATUSES, type Separation } from '../api/terminations.api'
import { EmployeeCell, ListFootnote, ListToolbar, ToolbarSearch, ToolbarSelect } from './termination-ui'
import { GymPill } from './separation-ui'
import { requesterLabel } from './separation-utils'
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
  const [datesOpen, setDatesOpen] = useState(false)
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
  const datesActive = filter.from !== '' || filter.to !== ''

  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
      <ListToolbar>
        <ToolbarSearch
          value={filter.name}
          onChange={(name) => setFilter((current) => ({ ...current, name }))}
          placeholder={t('Search by employee name…')}
          className="sm:max-w-72"
        />
        <ToolbarSelect
          value={status}
          onChange={(next) => setStatus(next as ExitFilter)}
          label={t('Status')}
          className="w-full sm:w-44"
        >
          {(['All', ...SEPARATION_STATUSES] as ExitFilter[]).map((option) => (
            <option key={option} value={option}>
              {option === 'All' ? t('All statuses') : t(option)} ({counts[option] ?? 0})
            </option>
          ))}
        </ToolbarSelect>
        <Button
          size="sm"
          variant={datesActive ? 'secondary' : 'ghost'}
          onClick={() => setDatesOpen((open) => !open)}
          aria-expanded={datesOpen}
          aria-label={t('Filter by request date')}
        >
          <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{t('Request date')}</span>
        </Button>
        <span className="ms-auto text-[11px] text-charcoal-400">
          {t('{{shown}} of {{total}}', { shown: visible.length, total: active.length })}
        </span>
      </ListToolbar>

      {datesOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-charcoal-100 bg-charcoal-50/60 px-3 py-2">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-charcoal-500">
            {t('From')}
            <Input
              type="date"
              value={filter.from}
              onChange={(event) => setFilter((current) => ({ ...current, from: event.target.value }))}
              aria-label={t('From date')}
              className="h-8 w-[140px] text-xs"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-charcoal-500">
            {t('To')}
            <Input
              type="date"
              value={filter.to}
              onChange={(event) => setFilter((current) => ({ ...current, to: event.target.value }))}
              aria-label={t('To date')}
              className="h-8 w-[140px] text-xs"
            />
          </label>
          {datesActive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFilter((current) => ({ ...current, from: '', to: '' }))}
            >
              {t('Clear filters')}
            </Button>
          )}
        </div>
      )}

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
            <TH className="px-2 text-start">{t('Employee')}</TH>
            <TH className="hidden px-2 text-start xl:table-cell">{t('Branch')}</TH>
            <TH className="px-2 text-start">{t('Reason')}</TH>
            <TH className="px-2 text-start">{t('Dates')}</TH>
            <TH className="px-2 text-start">{t('Status')}</TH>
            <TH className="px-2 text-end">{t('Actions')}</TH>
          </THead>
          <TBody>
            {visible.map((separation) => {
              const stage = separation.status
              const done = separation.checklist.filter(([, completed]) => completed).length
              const total = separation.checklist.length
              const percent = total > 0 ? Math.round((done / total) * 100) : separation.progress
              const moving = movingId === separation.id
              const approved = separation.approvalStatus === 'Approved'
              const interviewStatus = separation.exitInterviewStatus

              return (
                <TR key={separation.id}>
                  <TD className="px-2">
                    <EmployeeCell
                      separation={separation}
                      extra={<GymPill gym={separation.gym} className="mt-1 xl:hidden" />}
                    />
                  </TD>
                  <TD className="hidden px-2 xl:table-cell">
                    <GymPill gym={separation.gym} />
                    {separation.requestedBy === 'Branch Manager' && (
                      <p className="mt-1 text-[10px] text-charcoal-400">{requesterLabel(separation)}</p>
                    )}
                  </TD>
                  <TD className="max-w-48 px-2">
                    <p className="truncate text-xs font-medium text-charcoal-800" title={separation.reason ?? undefined}>
                      {separation.reason ?? '—'}
                    </p>
                    <p className="text-[10px] text-charcoal-400">{t(separation.separationType)}</p>
                  </TD>
                  <TD className="whitespace-nowrap px-2">
                    <p className="text-xs">{formatDate(separation.submittedDate, { withYear: 'auto' })}</p>
                    <p className="text-[10px] text-charcoal-400">
                      {t('Last day {{date}}', { date: formatDate(separation.lastDay, { withYear: 'auto' }) })}
                    </p>
                  </TD>
                  <TD className="px-2">
                    <div className="flex items-center gap-1">
                      <StatusBadge status={stage} />
                      {canManage && stage !== 'Completed' && (
                        <span className="flex items-center gap-0.5 text-charcoal-400">
                          {stage !== 'Requested' && (
                            <button
                              type="button"
                              disabled={moving}
                              onClick={() => onMove(separation, -1)}
                              aria-label={t('Move back')}
                              title={t('Move back')}
                              className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-charcoal-100 hover:text-charcoal-700 disabled:opacity-40"
                            >
                              <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={moving}
                            onClick={() => onMove(separation, 1)}
                            aria-label={t('Move forward')}
                            title={t('Move forward')}
                            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-charcoal-100 hover:text-charcoal-700 disabled:opacity-40"
                          >
                            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                          </button>
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-1.5 flex items-center gap-1.5"
                      title={t('{{done}}/{{total}} exit steps', { done, total })}
                    >
                      <span className="h-1 w-14 overflow-hidden rounded-full bg-charcoal-100">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                      </span>
                      <span className="text-[10px] text-charcoal-400">
                        {total > 0 ? `${done}/${total}` : `${percent}%`}
                      </span>
                    </div>
                    {interviewStatus && (
                      <p className="mt-1 flex items-center gap-1 whitespace-nowrap text-[10px] text-charcoal-400">
                        <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {t(interviewStatus)}
                        {separation.exitInterviewScheduledAt
                          ? ` · ${formatDateTime(separation.exitInterviewScheduledAt)}`
                          : ''}
                      </p>
                    )}
                  </TD>
                  <TD className="px-2">
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      {canManage && approved && stage !== 'Completed' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setScheduling(separation)}
                          aria-label={separation.exitInterviewScheduledAt ? t('Reschedule') : t('Schedule')}
                          title={separation.exitInterviewScheduledAt ? t('Reschedule') : t('Schedule')}
                        >
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="hidden xl:inline">
                            {separation.exitInterviewScheduledAt ? t('Reschedule') : t('Schedule')}
                          </span>
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpen(separation.id)}
                        aria-label={t('Manage · View data')}
                        title={t('Manage · View data')}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-charcoal-400 transition-colors hover:bg-charcoal-100 hover:text-charcoal-700"
                      >
                        <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                      </button>
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      <ListFootnote>
        <span className="font-semibold text-charcoal-600">{t('EXIT PROCESS')}</span>
        {' · '}
        {t(
          'Standard 5-step offboarding: Exit interview → Handover → Uniform/asset return → Access revocation → Final settlement. Annual leave is settled pro-rata — days taken beyond the accrual are counted as absent, not annual leave.',
        )}
      </ListFootnote>

      {scheduling && <ScheduleInterviewDialog separation={scheduling} onClose={() => setScheduling(null)} />}
    </div>
  )
}
