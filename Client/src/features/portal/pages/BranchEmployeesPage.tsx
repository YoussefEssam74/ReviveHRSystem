import { useState, useDeferredValue } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Zap } from 'lucide-react'
import {
  getAttendanceGrid,
  getEmployeeDirectory,
  type AttendanceGridRow,
  type EmployeeDirectoryRow,
} from '../api/branch.api'
import { createOnBehalfRequest, getRequestTypes } from '../api/requests.api'
import { BranchActionsPalette } from '../components/BranchActionsPalette'
import { EmployeeAvatar } from '../components/EmployeeAvatar'
import { EmptyState } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { fetchAllPages } from '../../../lib/paged'
import { formatTimeOfDay, humanize } from '../../../lib/format'

/**
 * Employees directory (mock §11 renderEmployees): the branch roster with the
 * Actions palette launcher, "Create Request for an Employee" filing and
 * row-level actions. Clicking a row opens the full employee profile.
 */

const EMPLOYMENT_STATUSES = ['Active', 'OnLeave', 'Suspended', 'Terminated'] as const

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
  const { t } = useTranslation()
  const { isBranchManager, isTeamLeader } = usePortalSession()

  if (!isBranchManager && !isTeamLeader) {
    return (
      <EmptyState
        title={t('Employees directory is for managers')}
        hint={t('The branch roster is guarded by the employees.view permission key.')}
      />
    )
  }

  return <EmployeesWorkspace />
}

function EmployeesWorkspace() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me, can } = usePortalSession()
  const activeGymId = me?.activeGym?.gymId
  const [searchInput, setSearchInput] = useState('')
  const search = useDeferredValue(searchInput.trim())
  const [status, setStatus] = useState<(typeof EMPLOYMENT_STATUSES)[number] | 'All'>('All')
  const [page, setPage] = useState(1)
  const [paletteOpen, setPaletteOpen] = useState(false)
  /** closed = undefined, open with the employee picker = null, pre-selected = id. */
  const [createRequestFor, setCreateRequestFor] = useState<number | null | undefined>(undefined)
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
  // join the directory by employeeId for the mobile card's today summary.
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

  const canRaise = can('attendance.edit') || can('employees.edit')
  const canOpenPalette =
    canRaise ||
    can('requests.view') ||
    can('schedule.manage') ||
    can('employees.status.change') ||
    can('employees.offboard') ||
    can('recruitment.vacancy_request.create')

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6.5rem)]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-charcoal-900 sm:text-xl">{t('Employees')}</h1>
          <p className="mt-0.5 hidden truncate text-xs text-charcoal-500 sm:block">
            {t('{{count}} employees · {{gym}}', { count: total, gym: me?.activeGym?.gymName ?? t('Active gym') })}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {canOpenPalette && (
            <Button size="sm" variant="secondary" onClick={() => setPaletteOpen(true)} aria-label={t('Actions')} title={t('Actions')}>
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('Actions')}</span>
            </Button>
          )}
          {can('requests.view') && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setCreateRequestFor(null)}
              aria-label={t('Create Request')}
              title={t('Create Request')}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('Create Request')}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value)
            setPage(1)
          }}
          placeholder={t('Search name, email or phone...')}
          // Search leads the row and the status filter sits at a fixed 10rem,
          // so the two read as one control group instead of two odd widths.
          className="form-input sm:max-w-sm sm:flex-1"
          aria-label={t('Search employees')}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status)
            setPage(1)
          }}
          className="form-input sm:w-40"
          aria-label={t('Filter by status')}
        >
          <option value="All">{t('All statuses')}</option>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {employmentLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t('No employees match')}
          hint={t('Adjust the search or status filter — the list covers everyone in the active gym.')}
        />
      ) : (
        <div className="hidden overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Employee')}</th>
                <th>{t('Job Title')}</th>
                <th>{t('Status')}</th>
                <th>
                  <span className="block text-end">{t('Actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <EmployeeRow
                  key={row.id}
                  row={row}
                  canOpenPalette={canOpenPalette}
                  canCreateRequest={can('requests.view') && row.status !== 'Terminated'}
                  onActions={() => setPaletteOpen(true)}
                  onCreateRequest={() => setCreateRequestFor(row.id)}
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
            {t('Previous')}
          </Button>
          <p className="text-[10px] text-charcoal-500">
            {t('Page {{page}} of {{total}} · {{count}} total', {
              page: envelope.page,
              total: envelope.totalPages,
              count: envelope.totalCount,
            })}
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= envelope.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      )}

      <BranchActionsPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {createRequestFor !== undefined && (
        <CreateRequestForEmployeeModal
          initialEmployeeId={createRequestFor}
          onClose={() => setCreateRequestFor(undefined)}
        />
      )}

      {gridQuery.error && !gridQuery.data && (
        <p className="text-[10px] text-charcoal-400">
          {t("Today's attendance columns are unavailable: {{error}}", { error: describeApiError(gridQuery.error) })}
        </p>
      )}
    </div>
  )
}

function EmployeeRow({
  row,
  canOpenPalette,
  canCreateRequest,
  onActions,
  onCreateRequest,
  onOpen,
}: {
  row: EmployeeDirectoryRow
  canOpenPalette: boolean
  canCreateRequest: boolean
  onActions: () => void
  onCreateRequest: () => void
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <tr className="cursor-pointer hover:bg-charcoal-50/50" onClick={onOpen}>
      <td>
        <div className="flex items-center gap-2.5">
          <EmployeeAvatar employeeId={row.id} initials={row.initials} />
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
      <td className="text-end">
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          {canOpenPalette && (
            <Button size="sm" variant="ghost" onClick={onActions} title={t('Actions')}>
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t('Actions')}</span>
            </Button>
          )}
          {canCreateRequest && (
            <Button size="sm" variant="ghost" onClick={onCreateRequest} title={t('Create Request')}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t('Create Request')}</span>
            </Button>
          )}
        </div>
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
  const { t } = useTranslation()
  return (
    <button
      onClick={onOpen}
      className="card-interactive w-full rounded-xl border border-charcoal-200 bg-white p-3 text-start"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <EmployeeAvatar employeeId={row.id} initials={row.initials} />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-charcoal-900">{row.name}</p>
            <p className="truncate text-[10px] text-charcoal-500">{row.position}</p>
          </div>
        </div>
        <StatusBadge status={employmentLabel(row.status)} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-charcoal-500">
        <span>
          {todayRow
            ? t('In {{checkIn}} · Out {{checkOut}}', {
                checkIn: formatTimeOfDay(todayRow.checkIn),
                checkOut: formatTimeOfDay(todayRow.checkOut),
              })
            : t('Not on today’s shift')}
        </span>
        {todayRow && <StatusBadge status={todayRow.status} />}
      </div>
    </button>
  )
}

/* Create Request for an Employee (mock §11 openNewEmployeeRequest) ---------- */

function CreateRequestForEmployeeModal({
  initialEmployeeId,
  onClose,
}: {
  initialEmployeeId?: number | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { me } = usePortalSession()
  const activeGymId = me?.activeGym?.gymId
  const { toast } = useToast()
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ? String(initialEmployeeId) : '')
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
      toast(t('Request #{{id}} filed for {{name}} — pending HR review', { id: created.data.id, name: selected?.name }))
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal
      open
      title={t('Create Request for an Employee')}
      subtitle={t("Filed on the employee's own record and routed to HR for the final decision.")}
      onClose={onClose}
      width="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (save.isPending) return
          if (!selected) return toast(t('Select the employee'), 'error')
          if (reason.trim().length === 0) return toast(t('Please add a reason for the request'), 'error')
          save.mutate()
        }}
        className="space-y-3"
      >
        <div>
          <label className="form-label" htmlFor="er-emp">
            {t('Employee')}
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
              aria-label={t('Employee')}
            >
              <option value="">{t('Select employee...')}</option>
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
            {t('Request Type')}
          </label>
          <select
            id="er-type"
            value={activeType?.id ?? ''}
            onChange={(e) => setTypeId(e.target.value)}
            className="form-input"
          >
            {types.length === 0 && <option value="">{t('Loading types…')}</option>}
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
              {t('Requested Date')}
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
                {t('End date')}
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
            {t('Reason')}
          </label>
          <textarea
            id="er-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
            placeholder={t('Why is this request being filed for them?')}
            required
          />
        </div>
        <div className="rounded-lg bg-charcoal-50 p-2.5 text-[10px] text-charcoal-500">
          Filed under the `requests.view` key; because it is raised by a manager it goes straight to HR review
          (the team-leader stage is skipped).
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={save.isPending}>
            {t('Submit Request')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
