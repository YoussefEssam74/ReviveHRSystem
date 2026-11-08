import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileWarning, Pencil, Plus, Undo2 } from 'lucide-react'
import {
  closeOffboardingCase,
  getEmployeeDirectory,
  getOffboardingCases,
  initiateOffboarding,
  updateOffboardingLastDay,
  type OffboardingCaseRow,
} from '../api/branch.api'
import { StatusBadge } from '../../../components/ui/badge'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { ConfirmDialog, Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { fetchAllPages } from '../../../lib/paged'
import { formatDate, humanize } from '../../../lib/format'

/**
 * Employee Leaving (mock §24 renderLeaving). Reachable from the Employees header
 * palette and the profile Offboard button (the mock sells it outside the nav).
 * Initiate posts an offboarding case (employees.offboard key); the server
 * creates the employment-history trail and the case starts at "Notice Period".
 */

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export default function BranchLeavingPage() {
  const { can } = usePortalSession()

  if (!can('employees.offboard')) {
    return (
      <EmptyState
        title="Employee Leaving needs the offboarding key"
        hint="Initiating a leaving process is guarded by employees.offboard on /api/auth/me."
      />
    )
  }

  return <LeavingWorkspace />
}

function LeavingWorkspace() {
  const { me } = usePortalSession()
  const [page, setPage] = useState(1)
  const [initiateOpen, setInitiateOpen] = useState(false)

  const casesQuery = useQuery({
    queryKey: ['portal', 'offboarding', page],
    queryFn: ({ signal }) => getOffboardingCases({ page, pageSize: 20, signal }),
    placeholderData: (previous) => previous,
  })

  if (casesQuery.isLoading) return <LoadingState />
  if (casesQuery.error)
    return <ErrorState message={describeApiError(casesQuery.error)} onRetry={() => void casesQuery.refetch()} />

  const rows = casesQuery.data?.items ?? []
  const total = casesQuery.data?.totalCount ?? rows.length
  const totalPages = casesQuery.data?.totalPages ?? 1

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-charcoal-900">Employee Leaving</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {total} active processes · {me?.activeGym?.gymName || 'your gym'}
          </p>
        </div>
        <Button size="sm" onClick={() => setInitiateOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Initiate
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-charcoal-200 bg-white p-8 text-center">
          <FileWarning className="mx-auto mb-2 h-10 w-10 text-charcoal-300" aria-hidden="true" />
          <p className="text-xs text-charcoal-500">No active leaving processes</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <CaseCard key={row.id} row={row} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Previous
          </Button>
          <span className="text-[11px] text-charcoal-500">
            Page {casesQuery.data?.page ?? 1} of {totalPages}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
            Next
          </Button>
        </div>
      )}

      {initiateOpen && (
        <InitiateModal
          onClose={() => setInitiateOpen(false)}
          onSaved={() => setPage(1)}
        />
      )}
    </div>
  )
}

/** one case row (mock: initials chip · name · position · last day · reason · status) + BM controls. */
function CaseCard({ row }: { row: OffboardingCaseRow }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const inFlight = row.status === 'Open' || row.status === 'Notice Period'

  // The page list and the sidebar badge counters both revolve around these.
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['portal', 'offboarding'] })
    await queryClient.invalidateQueries({ queryKey: ['portal', 'nav-counts'] })
  }

  const rescheduleMutation = useMutation({
    mutationFn: (lastWorkingDate: string) => updateOffboardingLastDay(row.id, lastWorkingDate),
    onSuccess: (updated) => {
      toast(`Last working day moved for ${updated.employee}.`)
      setRescheduleOpen(false)
      void invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const closeMutation = useMutation({
    mutationFn: () => closeOffboardingCase(row.id),
    onSuccess: (closed) => {
      toast(`Leaving process closed — ${closed.employee} stays employed.`)
      setCloseConfirmOpen(false)
      void invalidate()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <div className="rounded-xl border border-charcoal-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
            {initialsOf(row.employee)}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-charcoal-900">{row.employee}</p>
            <p className="truncate text-[10px] text-charcoal-500">
              {row.position} · Last Day: {formatDate(row.lastWorkingDate)} · {row.reason}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <StatusBadge status={humanize(row.status)} />
          {inFlight && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setRescheduleOpen(true)}>
                <Pencil className="h-3 w-3" aria-hidden="true" />
                Last day
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setCloseConfirmOpen(true)}>
                <Undo2 className="h-3 w-3" aria-hidden="true" />
                Close
              </Button>
            </>
          )}
        </div>
      </div>

      {rescheduleOpen && (
        <RescheduleModal
          row={row}
          pending={rescheduleMutation.isPending}
          onClose={() => setRescheduleOpen(false)}
          onSubmit={(lastWorkingDate) => rescheduleMutation.mutate(lastWorkingDate)}
        />
      )}
      <ConfirmDialog
        open={closeConfirmOpen}
        title="Close leaving process?"
        danger
        message={`Close ${row.employee}'s leaving process? The person stays employed and a new process can be initiated later.`}
        confirmLabel="Close process"
        loading={closeMutation.isPending}
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={() => closeMutation.mutate()}
      />
    </div>
  )
}

/** Change-last-day modal — moves LastWorkingDate while the case is in flight. */
function RescheduleModal({
  row,
  pending,
  onClose,
  onSubmit,
}: {
  row: OffboardingCaseRow
  pending: boolean
  onClose: () => void
  onSubmit: (lastWorkingDate: string) => void
}) {
  const [lastDay, setLastDay] = useState(row.lastWorkingDate)

  return (
    <Modal open title="Change Last Working Day" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-charcoal-500">
          Move the last working day of {row.employee}'s leaving process.
        </p>
        <div>
          <label className="form-label" htmlFor="leaving-last-day">
            Last Working Day
          </label>
          <input
            id="leaving-last-day"
            type="date"
            className="form-input"
            value={lastDay}
            onChange={(event) => setLastDay(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={lastDay.length === 0}
            loading={pending}
            onClick={() => onSubmit(lastDay)}
          >
            Save new date
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Initiate modal (mock openNewLeaving) — real roster + real post. */
function InitiateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [lastDay, setLastDay] = useState('')
  const [reason, setReason] = useState('')

  // Active gym staff for the picker — a Branch Manager holds employees.view.
  const rosterQuery = useQuery({
    queryKey: ['portal', 'offboarding-roster'],
    // Pickers must list the whole gym: walk the pages (one page is capped at 100).
    queryFn: ({ signal }) =>
      fetchAllPages((page) => getEmployeeDirectory({ status: 'Active', page, pageSize: 100, signal }), signal),
  })

  const roster = (rosterQuery.data ?? []).filter(
    (row) => row.status === 'Active' || row.status === 'OnLeave',
  )
  const effectiveEmployeeId = employeeId ?? roster[0]?.id ?? null
  const selected = roster.find((row) => row.id === effectiveEmployeeId) ?? null

  const initiateMutation = useMutation({
    mutationFn: () =>
      initiateOffboarding({
        employeeId: effectiveEmployeeId as number,
        lastWorkingDate: lastDay,
        reason: reason.trim(),
      }),
    onSuccess: (created) => {
      toast(`Leaving process initiated for ${created.employee}.`)
      onSaved()
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal open title="Initiate Employee Leaving" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <FileWarning className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" aria-hidden="true" />
          <p className="text-xs text-yellow-800">
            This will initiate the offboarding process for the selected employee — recorded in his employment
            history and visible to HR.
          </p>
        </div>
        <div>
          <label className="form-label" htmlFor="leave-emp">
            Employee
          </label>
          <select
            id="leave-emp"
            className="form-input"
            value={effectiveEmployeeId ?? ''}
            onChange={(event) => setEmployeeId(Number(event.target.value))}
          >
            {roster.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} — {row.position}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="leave-day">
            Last Working Day
          </label>
          <input
            id="leave-day"
            type="date"
            className="form-input"
            value={lastDay}
            onChange={(event) => setLastDay(event.target.value)}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="leave-reason">
            Reason
          </label>
          <textarea
            id="leave-reason"
            rows={2}
            className="form-input"
            placeholder="Reason for leaving..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={
              effectiveEmployeeId == null ||
              lastDay.length === 0 ||
              reason.trim().length === 0 ||
              rosterQuery.isFetching
            }
            loading={initiateMutation.isPending}
            onClick={() => initiateMutation.mutate()}
          >
            Initiate Leaving
          </Button>
        </div>
        {selected && (
          <p className="text-[10px] text-charcoal-400">({selected.name} · {selected.position})</p>
        )}
      </div>
    </Modal>
  )
}
