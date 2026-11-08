import { useState, useDeferredValue } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Zap } from 'lucide-react'
import {
  getAttendanceGrid,
  getEmployeeDirectory,
  type AttendanceGridRow,
  type EmployeeDirectoryRow,
} from '../api/branch.api'
import { createOnBehalfRequest, getRequestTypes } from '../api/requests.api'
import { BranchActionsPalette } from '../components/BranchActionsPalette'
import { EmptyState } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { fetchAllPages } from '../../../lib/paged'
import { cn } from '../../../lib/utils'
import { humanize } from '../../../lib/format'

/**
 * Employees directory (mock §11 renderEmployees): the branch roster with the
 * Actions palette launcher, "Create Request for an Employee" filing and live
 * today-status columns built from the attendance grid. Clicking a row opens
 * the full employee profile.
 */

const EMPLOYMENT_STATUSES = ['Active', 'OnLeave', 'Suspended', 'Terminated'] as const

const WORKING_STATUSES = new Set(['On Time', 'Late', 'Present', 'Early Checkout', 'Missing Checkout'])

/** Local "today" DateOnly in yyyy-MM-dd ("1928-01-01" safe: no timezone drift). */
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Directory statuses render through humanize ("OnLeave" → "On Leave"). */
function employmentLabel(status: string): string {
  return humanize(status)
}

export default function BranchEmployeesPage() {
  const { isBranchManager, isTeamLeader } = usePortalSession()

  if (!isBranchManager && !isTeamLeader) {
    return (
      <EmptyState
        title="Employees directory is for managers"
        hint="The branch roster is guarded by the employees.view permission key."
      />
    )
  }

  return <EmployeesWorkspace />
}

function EmployeesWorkspace() {
  const navigate = useNavigate()
  const { me, can } = usePortalSession()
  const activeGymId = me?.activeGym?.gymId
  const [searchInput, setSearchInput] = useState('')
  const search = useDeferredValue(searchInput.trim())
  const [status, setStatus] = useState<(typeof EMPLOYMENT_STATUSES)[number] | 'All'>('All')
  const [page, setPage] = useState(1)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [createRequestOpen, setCreateRequestOpen] = useState(false)
  const today = todayIso()

  const directoryQuery = useQuery({
    queryKey: ['portal', 'directory', activeGymId, search, status, page],
    queryFn: ({ signal }) =>
      getEmployeeDirectory({
        gym: activeGymId ?? undefined,
        search: search || undefined,
        status: status === 'All' ? undefined : status,
        page,
        pageSize: 12,
        signal,
      }),
    placeholderData: (previous) => previous,
  })

  // One day of the composed attendance grid scopes to the caller's gym; rows
  // join the directory by employeeId for the "today" columns.
  const gridQuery = useQuery({
    queryKey: ['portal', 'grid', activeGymId, today],
    queryFn: ({ signal }) => getAttendanceGrid({ date: today, page: 1, pageSize: 200, signal }),
    staleTime: 60_000,
  })

  if (directoryQuery.isLoading) return <LoadingState />
  if (directoryQuery.error)
    return (
      <ErrorState
        message={describeApiError(directoryQuery.error)}
        onRetry={() => directoryQuery.refetch()}
      />
    )

  const envelope = directoryQuery.data
  const rows = envelope?.items ?? []
  const gridRows = gridQuery.data?.items ?? []
  const gridByEmployee = new Map<number, AttendanceGridRow>()
  for (const row of gridRows) {
    if (!gridByEmployee.has(row.employeeId)) gridByEmployee.set(row.employeeId, row)
  }

  const total = envelope?.totalCount ?? rows.length
  const onShiftCount = gridRows.reduce(
    (count, row) => count + (WORKING_STATUSES.has(row.status) ? 1 : 0),
    0,
  )
  const scheduledCount = gridRows.filter((row) => row.status === 'Scheduled').length
  const offCount = gridRows.filter((row) => row.status === 'Off').length

  const canRaise = can('attendance.edit') || can('employees.edit')
  const canOpenPalette =
    canRaise ||
    can('requests.view') ||
    can('schedule.manage') ||
    can('employees.status.change') ||
    can('employees.offboard') ||
    can('recruitment.vacancy_request.create')

  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-charcoal-900">Employees</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {total} employees · {me?.activeGym?.gymName ?? 'Active gym'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {canOpenPalette && (
            <Button size="sm" variant="secondary" onClick={() => setPaletteOpen(true)}>
              <Zap className="h-3.5 w-3.5" /> Actions
            </Button>
          )}
          {can('requests.view') && (
            <Button size="sm" variant="primary" onClick={() => setCreateRequestOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Create Request
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile value={total} label="Employees" accent />
        <StatTile value={onShiftCount} label="On shift" />
        <StatTile value={scheduledCount} label="Upcoming today" />
        <StatTile value={offCount} label="Off today" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value)
            setPage(1)
          }}
          placeholder="Search name, email or phone..."
          className="form-input sm:max-w-xs"
          aria-label="Search employees"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status)
            setPage(1)
          }}
          className="form-input sm:w-40"
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {employmentLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No employees match"
          hint="Adjust the search or status filter — the list covers everyone in the active gym."
        />
      ) : (
        <div className="hidden overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Status</th>
                <th>Today</th>
                <th className="text-right">In</th>
                <th className="text-right">Out</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <EmployeeRow
                  key={row.id}
                  row={row}
                  todayRow={gridByEmployee.get(row.id) ?? null}
                  onOpen={() =>
                    navigate(`/employee/branch/employees/${row.id}`, {
                      state: {
                        name: row.name,
                        position: row.position,
                        initials: row.initials,
                        status: employmentLabel(row.status),
                      },
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1.5 lg:hidden">
        {rows.map((row) => (
          <DirectoryCard
            key={row.id}
            row={row}
            todayRow={gridByEmployee.get(row.id) ?? null}
            onOpen={() =>
              navigate(`/employee/branch/employees/${row.id}`, {
                state: {
                  name: row.name,
                  position: row.position,
                  initials: row.initials,
                  status: employmentLabel(row.status),
                },
              })
            }
          />
        ))}
      </div>

      {envelope && envelope.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <p className="text-[10px] text-charcoal-500">
            Page {envelope.page} of {envelope.totalPages} · {envelope.totalCount} total
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= envelope.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <BranchActionsPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {createRequestOpen && <CreateRequestForEmployeeModal onClose={() => setCreateRequestOpen(false)} />}

      {gridQuery.error && !gridQuery.data && (
        <p className="text-[10px] text-charcoal-400">
          Today's attendance columns are unavailable: {describeApiError(gridQuery.error)}
        </p>
      )}
    </div>
  )
}

function StatTile({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-charcoal-200 bg-white p-3 text-center',
        accent && 'border-l-4 border-l-brand-500',
      )}
    >
      <p className={cn('text-xl font-bold', accent ? 'text-brand-700' : 'text-charcoal-900')}>{value}</p>
      <p className="text-[10px] text-charcoal-500">{label}</p>
    </div>
  )
}

function EmployeeRow({
  row,
  todayRow,
  onOpen,
}: {
  row: EmployeeDirectoryRow
  todayRow: AttendanceGridRow | null
  onOpen: () => void
}) {
  return (
    <tr className="cursor-pointer hover:bg-charcoal-50/50" onClick={onOpen}>
      <td>
        <div className="flex items-center gap-2.5">
          <Avatar initials={row.initials} />
          <div>
            <p className="text-xs font-medium text-charcoal-900">{row.name}</p>
            <p className="text-[10px] text-charcoal-500">
              {row.employeeNumber} · {row.level}
            </p>
          </div>
        </div>
      </td>
      <td className="text-xs">{row.position}</td>
      <td>
        <StatusBadge status={employmentLabel(row.status)} />
      </td>
      <td>{todayRow ? <StatusBadge status={todayRow.status} /> : <span className="text-xs text-charcoal-400">—</span>}</td>
      <td className="text-right text-xs">{todayRow?.checkIn ?? '—'}</td>
      <td className="text-right text-xs">{todayRow?.checkOut ?? '—'}</td>
      <td>
        <ChevronRight className="ml-auto h-3.5 w-3.5 text-charcoal-300" />
      </td>
    </tr>
  )
}

function DirectoryCard({
  row,
  todayRow,
  onOpen,
}: {
  row: EmployeeDirectoryRow
  todayRow: AttendanceGridRow | null
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="card-interactive w-full rounded-xl border border-charcoal-200 bg-white p-3 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar initials={row.initials} />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-charcoal-900">{row.name}</p>
            <p className="truncate text-[10px] text-charcoal-500">{row.position}</p>
          </div>
        </div>
        <StatusBadge status={employmentLabel(row.status)} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-charcoal-500">
        <span>{todayRow ? `In ${todayRow.checkIn ?? '—'} · Out ${todayRow.checkOut ?? '—'}` : 'Not on today’s shift'}</span>
        {todayRow && <StatusBadge status={todayRow.status} />}
      </div>
    </button>
  )
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
      {initials}
    </div>
  )
}

/* Create Request for an Employee (mock §11 openNewEmployeeRequest) ---------- */

function CreateRequestForEmployeeModal({ onClose }: { onClose: () => void }) {
  const { me } = usePortalSession()
  const activeGymId = me?.activeGym?.gymId
  const { toast } = useToast()
  const [employeeId, setEmployeeId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [requestedDate, setRequestedDate] = useState(todayIso())
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const roster = useQuery({
    queryKey: ['portal', 'directory', 'roster', 'fileable', activeGymId],
    // Pickers must list the whole gym: walk the pages (one page is capped at 100).
    queryFn: ({ signal }) => fetchAllPages((page) => getEmployeeDirectory({ gym: activeGymId ?? undefined, page, pageSize: 100, signal }), signal),
    staleTime: 60_000,
  })
  const rosterOptions = roster.data?.filter((e) => e.status !== 'Terminated') ?? []
  const selected = rosterOptions.find((e) => String(e.id) === employeeId) ?? null

  const typesQuery = useQuery({
    queryKey: ['portal', 'request-types'],
    queryFn: ({ signal }) => getRequestTypes(signal),
    staleTime: 5 * 60_000,
  })
  const types = typesQuery.data ?? []
  const activeType = types.find((t) => t.id === typeId) ?? types[0] ?? null

  const save = useMutation({
    mutationFn: () =>
      createOnBehalfRequest({
        employee: selected?.name ?? '',
        // The type catalog matches id or label server-side; ids are the stable key.
        type: activeType?.label ?? activeType?.id ?? typeId,
        requestedDate,
        endDate: endDate || null,
        reason: reason.trim(),
      }),
    onSuccess: (created) => {
      toast(`Request #${created.data.id} filed for ${selected?.name} — pending HR review`)
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal
      open
      title="Create Request for an Employee"
      subtitle="Filed on the employee's own record and routed to HR for the final decision."
      onClose={onClose}
      width="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (save.isPending) return
          if (!selected) return toast('Select the employee', 'error')
          if (reason.trim().length === 0) return toast('Please add a reason for the request', 'error')
          save.mutate()
        }}
        className="space-y-3"
      >
        <div>
          <label className="form-label" htmlFor="er-emp">
            Employee
          </label>
          {roster.isPending ? (
            <LoadingState />
          ) : roster.error ? (
            <ErrorState message={describeApiError(roster.error)} onRetry={() => roster.refetch()} />
          ) : (
            <select
              id="er-emp"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="form-input"
              aria-label="Employee"
            >
              <option value="">Select employee...</option>
              {rosterOptions.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {e.name} — {e.position}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="er-type">
            Request Type
          </label>
          <select
            id="er-type"
            value={activeType?.id ?? ''}
            onChange={(e) => setTypeId(e.target.value)}
            className="form-input"
          >
            {types.length === 0 && <option value="">Loading types…</option>}
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="er-date">
              Requested Date
            </label>
            <input
              id="er-date"
              type="date"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
              className="form-input"
              required
            />
          </div>
          {activeType?.fields.includes('date-from') || activeType?.fields.includes('date-to') ? (
            <div>
              <label className="form-label" htmlFor="er-end">
                End date
              </label>
              <input
                id="er-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
                min={requestedDate}
              />
            </div>
          ) : null}
        </div>
        <div>
          <label className="form-label" htmlFor="er-reason">
            Reason
          </label>
          <textarea
            id="er-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
            placeholder="Why is this request being filed for them?"
            required
          />
        </div>
        <div className="rounded-lg bg-charcoal-50 p-2.5 text-[10px] text-charcoal-500">
          Filed under the `requests.view` key; because it is raised by a manager it goes straight to HR review
          (the team-leader stage is skipped).
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={save.isPending}>
            Submit Request
          </Button>
        </div>
      </form>
    </Modal>
  )
}
