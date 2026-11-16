import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Zap } from 'lucide-react'
import { Avatar, EmptyState } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { useEmployees } from '../hooks/useEmployees'
import type { EmployeeListItem } from '../api/employees.api'
import { useAttendance } from '../../attendance-hr/hooks/useAttendanceHr'
import { CreateRequestForEmployeeModal } from '../components/CreateRequestForEmployeeModal'
import { EmployeeActionsPalette } from '../components/EmployeeActionsPalette'
import { describeApiError } from '../../../lib/api-client'
import { formatTimeOfDay, humanize } from '../../../lib/format'

/**
 * HR employee directory — the same compact workspace as the branch portal's
 * roster: header + actions, search/status row, a table that fills the viewport,
 * mobile cards with today's punch, and a Previous/Next pager.
 */

const EMPLOYMENT_STATUSES = ['Active', 'OnLeave', 'Suspended', 'Terminated'] as const
type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function EmployeesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me, can } = useMe()
  const activeGymName = me?.activeGym?.gymName ?? t('Active gym')

  const [searchInput, setSearchInput] = useState('')
  const search = useDeferredValue(searchInput.trim())
  const [status, setStatus] = useState<EmploymentStatus | 'All'>('All')
  const [page, setPage] = useState(1)
  const [paletteOpen, setPaletteOpen] = useState(false)
  /** closed = undefined, open with the employee picker = null, pre-selected = id. */
  const [createRequestFor, setCreateRequestFor] = useState<number | null | undefined>(undefined)

  const directoryQuery = useEmployees({
    search: search || undefined,
    status: status === 'All' ? undefined : status,
    page,
    pageSize: 12,
  })

  // Today's grid joins the directory by employee id for the mobile cards' punch line.
  const today = todayIso()
  const attendanceQuery = useAttendance({ date: today, page: 1, pageSize: 200 })

  const openEmployee = (id: number) => navigate(`/console/employees/${id}`)

  if (directoryQuery.isLoading) return <LoadingState />
  if (directoryQuery.error)
    return <ErrorState message={describeApiError(directoryQuery.error)} onRetry={() => directoryQuery.refetch()} />

  const envelope = directoryQuery.data
  const rows = envelope?.items ?? []
  // The grid's employeeId arrives as a number even though the row type declares
  // a string; key by String() so the join works for either shape.
  const attendanceByEmployee = new Map(
    (attendanceQuery.data?.items ?? []).map((row) => [String(row.employeeId), row]),
  )

  const canRaise = can('requests')
  const canOpenPalette =
    canRaise ||
    can('attendance') ||
    can('payroll') ||
    can('evaluations') ||
    can('recruitment') ||
    can('offboarding')

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem-1px)] lg:overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-charcoal-900 sm:text-xl">{t('Employees')}</h1>
          <p className="mt-0.5 hidden truncate text-xs text-charcoal-500 sm:block">
            {t('{{count}} employees · {{gym}}', { count: envelope?.total ?? rows.length, gym: activeGymName })}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {canOpenPalette && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPaletteOpen(true)}
              aria-label={t('Actions')}
              title={t('Actions')}
            >
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('Actions')}</span>
            </Button>
          )}
          {canRaise && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setCreateRequestFor(null)}
              aria-label={t('Create Request')}
              title={t('Create Request')}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('Create Request')}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value)
            setPage(1)
          }}
          placeholder={t('Search name, email or phone...')}
          className="form-input sm:max-w-sm sm:flex-1"
          aria-label={t('Search employees')}
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as EmploymentStatus | 'All')
            setPage(1)
          }}
          className="form-input sm:w-40"
          aria-label={t('Filter by status')}
        >
          <option value="All">{t('All statuses')}</option>
          {EMPLOYMENT_STATUSES.map((option) => (
            <option key={option} value={option}>
              {humanize(option)}
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
        <div className="hidden overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
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
                    canCreateRequest={canRaise && row.status !== 'Terminated'}
                    onActions={() => setPaletteOpen(true)}
                    onCreateRequest={() => setCreateRequestFor(row.id)}
                    onOpen={() => openEmployee(row.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-1.5 lg:hidden">
        {rows.map((row) => (
          <DirectoryCard
            key={row.id}
            row={row}
            todayRow={attendanceByEmployee.get(String(row.id)) ?? null}
            onOpen={() => openEmployee(row.id)}
          />
        ))}
      </div>

      {envelope && envelope.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            {t('Previous')}
          </Button>
          <p className="text-[10px] text-charcoal-500">
            {t('Page {{page}} of {{total}} · {{count}} total', {
              page: envelope.page,
              total: envelope.totalPages,
              count: envelope.total,
            })}
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= envelope.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      )}

      <EmployeeActionsPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onCreateRequest={() => setCreateRequestFor(null)}
      />
      {createRequestFor !== undefined && (
        <CreateRequestForEmployeeModal
          initialEmployeeId={createRequestFor}
          onClose={() => setCreateRequestFor(undefined)}
        />
      )}

      {attendanceQuery.error && !attendanceQuery.data && (
        <p className="text-[10px] text-charcoal-400">
          {t("Today's attendance columns are unavailable: {{error}}", {
            error: describeApiError(attendanceQuery.error),
          })}
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
  row: EmployeeListItem
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
          <Avatar initials={row.initials} size="md" />
          <div>
            <p className="text-xs font-medium text-charcoal-900">{row.name}</p>
            <p className="text-[10px] text-charcoal-500">
              {row.employeeNumber} · {row.level ?? '—'}
            </p>
          </div>
        </div>
      </td>
      <td className="text-xs">{row.position}</td>
      <td>
        <StatusBadge status={humanize(row.status)} />
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
  row: EmployeeListItem
  todayRow: { checkIn: string | null; checkOut: string | null; status: string } | null
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card-interactive w-full rounded-xl border border-charcoal-200 bg-white p-3 text-start"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar initials={row.initials} size="md" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-charcoal-900">{row.name}</p>
            <p className="truncate text-[10px] text-charcoal-500">{row.position}</p>
          </div>
        </div>
        <StatusBadge status={humanize(row.status)} />
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
