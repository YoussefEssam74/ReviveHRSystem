import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { Dialog } from '../../../components/ui/dialog'
import { Textarea } from '../../../components/ui/field'
import { Label } from '../../../components/ui/label'
import { ConfirmDialog } from '../../../components/ui/modal'
import { TBody, TD, TH, THead, TR, Table } from '../../../components/ui/table'
import { StatusBadge } from '../../../components/ui/badge'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { NameDateFilterBar } from '../../../components/name-date-filter-bar'
import { NO_NAME_DATE_FILTER, matchesName, withinDateRange, type NameDateFilter } from '../../../lib/name-date-filter'
import { useDecideTermination } from '../hooks/useTerminations'
import type { Separation } from '../api/terminations.api'
import { EmployeeCell, FilterPill } from './termination-ui'
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
  const [filter, setFilter] = useState<RequestFilter>('Pending')
  const [nameDate, setNameDate] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)
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
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-charcoal-200 bg-white px-2 py-1.5">
        <span className="me-1 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">
          {t('Approval status')}
        </span>
        {(['All', 'Pending', 'Approved', 'Rejected'] as RequestFilter[]).map((option) => (
          <FilterPill key={option} active={filter === option} onClick={() => setFilter(option)}>
            {t(option)} ({counts[option]})
          </FilterPill>
        ))}
        <span className="ms-auto text-[11px] text-charcoal-500">
          {t('Branch Manager request → HR approval → exit interview')}
        </span>
      </div>

      <NameDateFilterBar
        filter={nameDate}
        onChange={setNameDate}
        placeholder={t('Search by employee name…')}
        shown={visible.length}
        total={byApproval.length}
      />

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </p>
      )}

      <div className="rounded-xl border border-charcoal-200 bg-white">
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
              <TH>{t('Employee')}</TH>
              <TH>{t('Branch')}</TH>
              <TH>{t('Reason')}</TH>
              <TH>{t('Notes')}</TH>
              <TH>{t('Request date')}</TH>
              <TH>{t('Status')}</TH>
              <TH className="text-end">{t('Actions')}</TH>
            </THead>
            <TBody>
              {visible.map((separation) => {
                const completed = separation.status === 'Completed' || separation.status === 'Cancelled'
                const pending = separation.approvalStatus === 'Pending'
                return (
                  <TR key={separation.id}>
                    <TD>
                      <EmployeeCell separation={separation} />
                    </TD>
                    <TD>
                      <GymPill gym={separation.gym} />
                      <p className="mt-1 text-[10px] text-charcoal-400">{requesterLabel(separation)}</p>
                    </TD>
                    <TD className="max-w-48">
                      <p className="truncate font-medium text-charcoal-800" title={separation.reason ?? undefined}>
                        {separation.reason ?? '—'}
                      </p>
                      <p className="text-[10px] text-charcoal-400">{t(separation.separationType)}</p>
                    </TD>
                    <TD className="max-w-56">
                      <p className="truncate text-[11px] text-charcoal-600" title={separation.notes ?? undefined}>
                        {separation.notes || '—'}
                      </p>
                    </TD>
                    <TD className="whitespace-nowrap">{formatDate(separation.submittedDate, { withYear: 'always' })}</TD>
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
