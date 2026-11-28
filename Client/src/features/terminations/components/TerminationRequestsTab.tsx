import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarRange, FileText, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { Dialog } from '../../../components/ui/dialog'
import { Textarea } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { ConfirmDialog } from '../../../components/ui/modal'
import { TBody, TD, TH, THead, TR, Table } from '../../../components/ui/table'
import { StatusBadge } from '../../../components/ui/badge'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { NO_NAME_DATE_FILTER, matchesName, withinDateRange, type NameDateFilter } from '../../../lib/name-date-filter'
import { useDecideTermination } from '../hooks/useTerminations'
import type { Separation } from '../api/terminations.api'
import { EmployeeCell, ListToolbar, ToolbarSearch, ToolbarSelect } from './termination-ui'
import { GymPill } from './separation-ui'
import { requesterLabel } from './separation-utils'

type RequestFilter = 'All' | 'Pending' | 'Approved' | 'Rejected'

export interface TerminationRequestsTabProps {
  cases: Separation[]
  canManage: boolean
  /** Jumps to the Exit Interviews tab for the approved case. */
  onOpenInterviews: (separationId: number) => void
}

/** Tab 1 — the Branch Manager's termination requests and the HR decision. */
export function TerminationRequestsTab({ cases, canManage, onOpenInterviews }: TerminationRequestsTabProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<RequestFilter>('All')
  const [nameDate, setNameDate] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)
  const [datesOpen, setDatesOpen] = useState(false)
  const [approving, setApproving] = useState<Separation | null>(null)
  const [rejecting, setRejecting] = useState<Separation | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const decide = useDecideTermination()

  const counts = useMemo(() => {
    const pending = cases.filter((c) => c.approvalStatus === 'Pending').length
    const approved = cases.filter((c) => c.approvalStatus === 'Approved').length
    const rejected = cases.filter((c) => c.approvalStatus === 'Rejected').length
    return { All: cases.length, Pending: pending, Approved: approved, Rejected: rejected } as Record<RequestFilter, number>
  }, [cases])

  const byApproval = useMemo(
    () => (filter === 'All' ? cases : cases.filter((c) => c.approvalStatus === filter)),
    [cases, filter],
  )

  const visible = useMemo(
    () =>
      byApproval.filter(
        (separation) =>
          matchesName(separation.employee, nameDate.name) &&
          withinDateRange(separation.submittedDate, nameDate.from, nameDate.to),
      ),
    [byApproval, nameDate],
  )

  const filtered = nameDate.name.trim() !== '' || nameDate.from !== '' || nameDate.to !== ''
  const datesActive = nameDate.from !== '' || nameDate.to !== ''

  const runDecision = async (separation: Separation, decision: 'Approved' | 'Rejected', note?: string) => {
    setActionError(null)
    try {
      await decide.mutateAsync({ id: separation.id, body: { decision, ...(note ? { note } : {}) } })
      setApproving(null)
      setRejecting(null)
      setRejectNote('')
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
            value={nameDate.name}
            onChange={(name) => setNameDate((current) => ({ ...current, name }))}
            placeholder={t('Search by employee name…')}
            className="sm:max-w-72"
          />
          <ToolbarSelect
            value={filter}
            onChange={(next) => setFilter(next as RequestFilter)}
            label={t('Approval status')}
            className="w-full sm:w-44"
          >
            {(['All', 'Pending', 'Approved', 'Rejected'] as RequestFilter[]).map((option) => (
              <option key={option} value={option}>
                {t(option)} ({counts[option]})
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
            {t('{{shown}} of {{total}}', { shown: visible.length, total: cases.length })}
          </span>
        </ListToolbar>

        {datesOpen && (
          <div className="flex flex-wrap items-center gap-2 border-b border-charcoal-100 bg-charcoal-50/60 px-3 py-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-charcoal-500">
              {t('From')}
              <Input
                type="date"
                value={nameDate.from}
                onChange={(event) => setNameDate((current) => ({ ...current, from: event.target.value }))}
                aria-label={t('From date')}
                className="h-8 w-[140px] text-xs"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-charcoal-500">
              {t('To')}
              <Input
                type="date"
                value={nameDate.to}
                onChange={(event) => setNameDate((current) => ({ ...current, to: event.target.value }))}
                aria-label={t('To date')}
                className="h-8 w-[140px] text-xs"
              />
            </label>
            {datesActive && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setNameDate((current) => ({ ...current, from: '', to: '' }))}
              >
                {t('Clear filters')}
              </Button>
            )}
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t('No termination requests')}
            message={
              filtered
                ? t('No termination requests match these filters.')
                : filter === 'Pending'
                  ? t('No requests are waiting for an HR decision.')
                  : t('There are no termination requests in this view.')
            }
          />
        ) : (
          <Table>
            <THead>
              <TH className="text-start">{t('Employee')}</TH>
              <TH className="hidden text-start xl:table-cell">{t('Branch')}</TH>
              <TH className="text-start">{t('Reason')}</TH>
              <TH className="hidden text-start 2xl:table-cell">{t('Notes')}</TH>
              <TH className="hidden text-start xl:table-cell">{t('Request date')}</TH>
              <TH className="text-start">{t('Status')}</TH>
              <TH className="text-end">{t('Actions')}</TH>
            </THead>
            <TBody>
              {visible.map((separation) => {
                const completed = separation.status === 'Completed' || separation.status === 'Cancelled'
                const pending = separation.approvalStatus === 'Pending'
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
                      {separation.requestedBy === 'Branch Manager' && (
                        <p className="mt-1 text-[10px] text-charcoal-400">{requesterLabel(separation)}</p>
                      )}
                    </TD>
                    <TD className="max-w-48">
                      <p className="truncate text-xs font-medium text-charcoal-800" title={separation.reason ?? undefined}>
                        {separation.reason ?? '—'}
                      </p>
                      <p className="text-[10px] text-charcoal-400">{t(separation.separationType)}</p>
                    </TD>
                    <TD className="hidden 2xl:table-cell">
                      <p className="truncate text-[11px] text-charcoal-600" title={separation.notes ?? undefined}>
                        {separation.notes || '—'}
                      </p>
                    </TD>
                    <TD className="hidden whitespace-nowrap xl:table-cell">
                      {formatDate(separation.submittedDate, { withYear: 'always' })}
                    </TD>
                    <TD>
                      <StatusBadge status={separation.approvalStatus} />
                      {separation.approvedBy && (
                        <p className="mt-1 text-[10px] text-charcoal-400">
                          {t('By {{name}}', { name: separation.approvedBy })}
                        </p>
                      )}
                      {separation.approvalNote && (
                        <p className="mt-0.5 max-w-40 truncate text-[10px] text-charcoal-500" title={separation.approvalNote}>
                          {separation.approvalNote}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap justify-end gap-1">
                        {pending && canManage && (
                          <>
                            <Button variant="success" size="sm" onClick={() => setApproving(separation)}>
                              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                              {t('Approve')}
                            </Button>
                            <Button variant="dangerOutline" size="sm" onClick={() => setRejecting(separation)}>
                              <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                              {t('Reject')}
                            </Button>
                          </>
                        )}
                        {separation.approvalStatus === 'Approved' && !completed && (
                          <Button variant="secondary" size="sm" onClick={() => onOpenInterviews(separation.id)}>
                            {t('Schedule interview →')}
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={approving != null}
        title={t('Approve termination request')}
        message={
          approving
            ? t(
                'Approving moves {{name}} to Notice Period and opens the exit interview step. The employee stays on the roster until clearance completes.',
                { name: approving.employee },
              )
            : ''
        }
        confirmLabel={t('Approve')}
        loading={decide.isPending}
        onConfirm={() => approving && void runDecision(approving, 'Approved')}
        onCancel={() => setApproving(null)}
      />

      {rejecting && (
        <Dialog
          open
          onClose={() => setRejecting(null)}
          title={t('Reject termination request')}
          description={t('{{name}} · {{position}} · {{gym}}', {
            name: rejecting.employee,
            position: rejecting.position,
            gym: rejecting.gym,
          })}
          footer={
            <>
              <Button variant="outline" onClick={() => setRejecting(null)}>
                {t('Cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={rejectNote.trim().length === 0}
                loading={decide.isPending}
                onClick={() => void runDecision(rejecting, 'Rejected', rejectNote.trim())}
              >
                {t('Reject request')}
              </Button>
            </>
          }
        >
          <div className="space-y-2">
            <p className="text-[11px] text-charcoal-500">
              {t('The employee stays active and the case closes. Give HR\'s reason for the record.')}
            </p>
            <div>
              <Label htmlFor="rejection-note">{t('Rejection reason (required)')}</Label>
              <Textarea
                id="rejection-note"
                rows={3}
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                placeholder={t('Why the request was declined…')}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
