import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronDown, MinusCircle, PiggyBank, Sparkles } from 'lucide-react'
import {
  getEmployeeDirectory,
  getOffboardingCases,
  listBonusProposals,
  listBranchDeductions,
  listWarningNotices,
  type EmployeeDirectoryRow,
} from '../api/branch.api'
import { getOwnAttendance, type EmployeeAttendanceResponse, type EmployeeAttendanceItem } from '../api/attendance.api'
import { getRequestInbox } from '../api/requests.api'
import { getEvaluationResponses } from '../api/employee-file.api'
import { EmptyState } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Button } from '../../../components/ui/button'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { fetchAllPages } from '../../../lib/paged'
import { cn } from '../../../lib/utils'
import { formatDate, formatDateWithYear, formatMoney, humanize } from '../../../lib/format'

/**
 * Employees Performance (mock §25 renderEmployeesPerformance): the whole roster
 * with real per-employee aggregates from the management-scope lists — request
 * inbox, branch-raised deductions/warnings/bonuses, submitted evaluations and
 * open leaving cases — one fetch each. Clicking a row drops into the drill-in
 * with the mock's seven tabs; a month filter narrows "this month"-sensitive
 * aggregates (All months by default).
 */

type MonthKey = string | 'all'

function ymOf(value: string | null | undefined): string {
  return (value ?? '').slice(0, 7)
}

export default function BranchPerformancePage() {
  const { isBranchManager, isTeamLeader } = usePortalSession()

  if (!isBranchManager && !isTeamLeader) {
    return (
      <EmptyState
        title="Employees Performance is for managers"
        hint="The aggregates read the management-scope lists guarded by the role model."
      />
    )
  }

  return <PerformanceWorkspace />
}

function PerformanceWorkspace() {
  const { me } = usePortalSession()
  const [month, setMonth] = useState<MonthKey>('all')
  const [drillId, setDrillId] = useState<number | null>(null)

  // The whole roster drives the aggregates, so these walk all pages (the API
  // clamps one page to 100 — a large gym is truncated unless we loop).
  const activeGymId = me?.activeGym?.gymId
  const rosterQuery = useQuery({
    queryKey: ['portal', 'perf', 'roster', activeGymId],
    queryFn: ({ signal }) => fetchAllPages((page) => getEmployeeDirectory({ gym: activeGymId ?? undefined, page, pageSize: 100, signal }), signal),
  })
  const inboxQuery = useQuery({
    queryKey: ['portal', 'perf', 'inbox'],
    queryFn: ({ signal }) => fetchAllPages((page) => getRequestInbox({ page, pageSize: 100, signal }), signal),
  })
  const deductionsQuery = useQuery({
    queryKey: ['portal', 'perf', 'deductions'],
    queryFn: ({ signal }) => listBranchDeductions(undefined, signal),
  })
  const warningsQuery = useQuery({
    queryKey: ['portal', 'perf', 'warnings'],
    queryFn: ({ signal }) => listWarningNotices(undefined, signal),
  })
  const bonusesQuery = useQuery({
    queryKey: ['portal', 'perf', 'bonuses'],
    queryFn: ({ signal }) => listBonusProposals(undefined, signal),
  })
  const evaluationsQuery = useQuery({
    queryKey: ['portal', 'perf', 'evaluations'],
    queryFn: ({ signal }) => fetchAllPages((page) => getEvaluationResponses({ page, pageSize: 100, signal }), signal),
  })
  const leavingQuery = useQuery({
    queryKey: ['portal', 'offboarding', 'perf'],
    queryFn: ({ signal }) => getOffboardingCases({ page: 1, pageSize: 100, signal }),
  })

  const roster = rosterQuery.data ?? []
  const inbox = inboxQuery.data ?? []
  const deductions = useMemo(() => deductionsQuery.data ?? [], [deductionsQuery.data])
  const warnings = useMemo(() => warningsQuery.data ?? [], [warningsQuery.data])
  const bonuses = useMemo(() => bonusesQuery.data ?? [], [bonusesQuery.data])
  const evaluations = evaluationsQuery.data ?? []
  const leavingIds = useMemo(
    () =>
      new Set(
        (leavingQuery.data?.items ?? [])
          .filter((row) => row.status !== 'Cancelled' && row.status !== 'Completed')
          .map((row) => row.employeeId),
      ),
    [leavingQuery.data],
  )

  // Months the filter can select: every real activity month on record.
  const months = useMemo(() => {
    const keys = new Set<string>()
    inbox.forEach((row) => keys.add(ymOf(row.submittedDate)))
    deductions.forEach((row) => keys.add(ymOf(row.issuedAt)))
    warnings.forEach((row) => keys.add(ymOf(row.issuedAt)))
    bonuses.forEach((row) => keys.add(ymOf(row.issuedAt)))
    evaluations.forEach((row) => keys.add(ymOf(row.reviewedDate)))
    return [...keys].filter(Boolean).sort((a, b) => (a < b ? 1 : -1))
  }, [inbox, deductions, warnings, bonuses, evaluations])

  const rows = useMemo(
    () =>
      roster.map((row) => {
        const inMonth = (value: string | null | undefined) => month === 'all' || ymOf(value) === month

        const memberRequests = inbox.filter((item) => item.employeeId === row.id)
        const memberDeductions = deductions.filter((item) => item.employeeId === row.id)
        const memberWarnings = warnings.filter((item) => item.employeeId === row.id)
        const memberBonuses = bonuses.filter((item) => item.employeeId === row.id)
        const memberEvaluations = evaluations.filter((item) => item.employee === row.name)

        const monthRequests = memberRequests.filter((item) => inMonth(item.submittedDate))
        const monthDeductions = memberDeductions.filter((item) => inMonth(item.issuedAt))
        const monthWarnings = memberWarnings.filter((item) => inMonth(item.issuedAt))
        const monthBonuses = memberBonuses.filter((item) => inMonth(item.issuedAt))
        const monthEvaluations = memberEvaluations.filter((item) => inMonth(item.reviewedDate))

        const scores = monthEvaluations.map((item) => item.score).filter((score): score is number => score != null)
        const avg = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null

        return {
          employee: row,
          needsReview: leavingIds.has(row.id),
          requests: monthRequests.length,
          pending: monthRequests.filter((item) => item.status === 'Pending').length,
          deductionTotal: monthDeductions.reduce((sum, item) => sum + Math.abs(item.amount), 0),
          bonusTotal: monthBonuses.reduce((sum, item) => sum + Math.abs(item.amount), 0),
          avgScore: avg,
          latestPeriod: monthEvaluations[0]?.period ?? null,
          warnings: monthWarnings.length,
        }
      }),
    [roster, inbox, deductions, warnings, bonuses, evaluations, leavingIds, month],
  )

  const totals = useMemo(
    () => ({
      requests: rows.reduce((sum, row) => sum + row.requests, 0),
      deductions: rows.reduce((sum, row) => sum + row.deductionTotal, 0),
      needsReview: rows.filter((row) => row.needsReview).length,
    }),
    [rows],
  )

  if (rosterQuery.isLoading || inboxQuery.isLoading || deductionsQuery.isLoading || warningsQuery.isLoading || bonusesQuery.isLoading || evaluationsQuery.isLoading) {
    return <LoadingState />
  }

  const firstError =
    rosterQuery.error ?? inboxQuery.error ?? deductionsQuery.error ?? warningsQuery.error ?? bonusesQuery.error ?? evaluationsQuery.error
  if (firstError) {
    const firstQuery = rosterQuery.error ? rosterQuery : inboxQuery.error ? inboxQuery : deductionsQuery.error ? deductionsQuery : warningsQuery.error ? warningsQuery : bonusesQuery.error ? bonusesQuery : evaluationsQuery
    return <ErrorState message={describeApiError(firstQuery.error)} onRetry={() => firstQuery.refetch()} />
  }

  const drillRow = rows.find((row) => row.employee.id === drillId) ?? null
  const monthLabel = month === 'all' ? null : months.includes(month as string) ? month : null

  if (drillRow) {
    return (
      <div className="space-y-3">
        <PerfDrillIn
          row={drillRow}
          month={month}
          months={months}
          onMonthChange={setMonth}
          onClose={() => setDrillId(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-charcoal-900">Employees Performance</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {rowSubline(roster)} · Click an employee to open their full performance history ·{' '}
            {me?.activeGym?.gymName || 'your gym'}
          </p>
        </div>
        <MonthSelect month={month} months={months} onChange={setMonth} />
      </div>

      {/* The four real stat tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PerfTile accent="border-l-brand-500" label="Employees" value={String(roster.length)} valueClass="text-brand-700" />
        <PerfTile
          label={`Requests${monthLabel ? ` · ${monthLabel}` : ''}`}
          value={String(totals.requests)}
        />
        <PerfTile
          label={`Deductions${monthLabel ? ` · ${monthLabel}` : ''}`}
          value={formatMoney(totals.deductions)}
          valueClass={totals.deductions ? 'text-red-600' : 'text-charcoal-900'}
        />
        <PerfTile
          label="Need review"
          value={String(totals.needsReview)}
          valueClass={totals.needsReview ? 'text-orange-600' : 'text-charcoal-900'}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No employees on the roster" hint="As soon as staff exist in this gym they appear here." />
      ) : (
        <>
          {/* Desktop roster table */}
          <div className="hidden overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-charcoal-100 text-left">
                  {['Employee', 'Position', 'Status', 'Requests', 'Deductions', 'Bonuses', 'Evaluations', 'Warnings'].map((column, index) => (
                    <th
                      key={column}
                      className={cn('px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-charcoal-500', index >= 3 && 'text-right')}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-50">
                {rows.map((row) => (
                  <tr
                    key={row.employee.id}
                    className="cursor-pointer transition-colors hover:bg-charcoal-50/50"
                    onClick={() => setDrillId(row.employee.id)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                          {row.employee.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-charcoal-900">
                            {row.employee.name}
                            {row.needsReview && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" title="Leaving case open" />}
                          </p>
                          <p className="text-[10px] text-charcoal-500">{row.employee.employeeNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-charcoal-600">{row.employee.position}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={humanize(row.employee.status)} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-charcoal-900">
                      {row.requests}
                      {row.pending > 0 && <span className="block text-[10px] text-yellow-600">{row.pending} pending</span>}
                    </td>
                    <td className={cn('px-3 py-2.5 text-right text-xs font-semibold', row.deductionTotal ? 'text-red-600' : 'text-charcoal-400')}>
                      {formatMoney(row.deductionTotal)}
                    </td>
                    <td className={cn('px-3 py-2.5 text-right text-xs font-semibold', row.bonusTotal ? 'text-green-600' : 'text-charcoal-400')}>
                      {formatMoney(row.bonusTotal)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {row.avgScore !== null ? (
                        <>
                          <span className="text-charcoal-900">{row.avgScore.toFixed(1)} / 5</span>
                          {row.latestPeriod && <span className="block text-[10px] text-charcoal-400">{row.latestPeriod}</span>}
                        </>
                      ) : (
                        <span className="text-charcoal-400">—</span>
                      )}
                    </td>
                    <td className={cn('px-3 py-2.5 text-right text-xs font-semibold', row.warnings ? 'text-orange-600' : 'text-charcoal-400')}>
                      {row.warnings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-1.5 lg:hidden">
            {rows.map((row) => (
              <button
                key={row.employee.id}
                type="button"
                onClick={() => setDrillId(row.employee.id)}
                className="w-full rounded-xl border border-charcoal-200 bg-white p-3 text-left card-interactive"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                      {row.employee.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-charcoal-900">
                        {row.employee.name}
                        {row.needsReview && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />}
                      </p>
                      <p className="truncate text-[10px] text-charcoal-500">
                        {row.employee.position} · {row.employee.employeeNumber}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={humanize(row.employee.status)} />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                  <div className="rounded-lg bg-charcoal-50 py-1.5">
                    <p className="text-xs font-bold text-charcoal-900">{row.requests}</p>
                    <p className="text-[9px] text-charcoal-500">Requests</p>
                  </div>
                  <div className="rounded-lg bg-charcoal-50 py-1.5">
                    <p className={cn('text-xs font-bold', row.deductionTotal ? 'text-red-600' : 'text-charcoal-900')}>
                      {row.deductionTotal}
                    </p>
                    <p className="text-[9px] text-charcoal-500">Ded. EGP</p>
                  </div>
                  <div className="rounded-lg bg-charcoal-50 py-1.5">
                    <p className="text-xs font-bold text-charcoal-900">{row.avgScore !== null ? row.avgScore.toFixed(1) : '—'}</p>
                    <p className="text-[9px] text-charcoal-500">Eval /5</p>
                  </div>
                  <div className="rounded-lg bg-charcoal-50 py-1.5">
                    <p className={cn('text-xs font-bold', row.warnings ? 'text-orange-600' : 'text-charcoal-900')}>{row.warnings}</p>
                    <p className="text-[9px] text-charcoal-500">Warnings</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function rowSubline(roster: EmployeeDirectoryRow[]): string {
  return `${roster.length} employees`
}

/* ==================== shared bits ==================== */

function PerfTile({
  label,
  value,
  valueClass = 'text-charcoal-900',
  accent,
}: {
  label: string
  value: string
  valueClass?: string
  accent?: string
}) {
  return (
    <div className={cn('rounded-xl border border-charcoal-200 border-l-4 bg-white p-3 text-center', accent)}>
      <p className={cn('text-xl font-bold', valueClass)}>{value}</p>
      <p className="text-[10px] text-charcoal-500">{label}</p>
    </div>
  )
}

function MonthSelect({
  month,
  months,
  onChange,
}: {
  month: MonthKey
  months: string[]
  onChange: (value: MonthKey) => void
}) {
  const value = month === 'all' ? months[0] ?? null : (month as string)
  return (
    <select
      className="form-input w-44"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Filter by month"
    >
      <option value="">All months</option>
      {months.map((key) => (
        <option key={key} value={key}>
          {MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? key} {key.slice(0, 4)}
        </option>
      ))}
    </select>
  )
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/* ==================== drill-in (mock §25 view 2) ==================== */

const DRILL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'requests', label: 'Requests' },
  { id: 'deductions', label: 'Deductions' },
  { id: 'evaluations', label: 'Evaluations' },
  { id: 'bonuses', label: 'Bonuses' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'attendance', label: 'Attendance' },
] as const

type DrillTabId = (typeof DRILL_TABS)[number]['id']

function PerfDrillIn({
  row,
  month,
  months,
  onMonthChange,
  onClose,
}: {
  row: {
    employee: EmployeeDirectoryRow
    needsReview: boolean
    requests: number
    pending: number
    deductionTotal: number
    bonusTotal: number
    avgScore: number | null
    latestPeriod: string | null
    warnings: number
  }
  month: MonthKey
  months: string[]
  onMonthChange: (value: MonthKey) => void
  onClose: () => void
}) {
  const { employee } = row
  const [tab, setTab] = useState<DrillTabId>('overview')
  const navigate = useNavigate()

  const inMonth = (value: string | null | undefined) => month === 'all' || ymOf(value) === month

  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <button
            type="button"
            onClick={onClose}
            className="mb-1 flex items-center gap-1 text-[11px] font-medium text-charcoal-500 hover:text-charcoal-800"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-90" aria-hidden="true" />
            Back to all employees
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
              {employee.initials}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-charcoal-900">{employee.name}</h1>
                <StatusBadge status={humanize(employee.status)} />
                {row.needsReview && <StatusBadge status="Leaving Case Open" />}
              </div>
              <p className="text-[10px] text-charcoal-500">
                {employee.position} · {employee.employeeNumber}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelect month={month} months={months} onChange={onMonthChange} />
          <Button size="sm" variant="secondary" onClick={() => navigate(`/employee/branch/employees/${employee.id}`)}>
            Full profile
          </Button>
        </div>
      </div>

      {/* Aggregated tiles (same algebra as the roster row) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <PerfTile label={`Requests${row.pending ? ` · ${row.pending} pending` : ''}`} value={String(row.requests)} />
        <PerfTile label="Deductions" value={formatMoney(row.deductionTotal)} valueClass={row.deductionTotal ? 'text-red-600' : 'text-charcoal-900'} />
        <PerfTile label="Bonuses" value={formatMoney(row.bonusTotal)} valueClass={row.bonusTotal ? 'text-green-600' : 'text-charcoal-900'} />
        <PerfTile label="Warnings" value={String(row.warnings)} valueClass={row.warnings ? 'text-orange-600' : 'text-charcoal-900'} />
        <PerfTile label="Eval avg" value={row.avgScore !== null ? `${row.avgScore.toFixed(1)} / 5` : '—'} />
      </div>

      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <div className="flex overflow-x-auto border-b border-charcoal-100 bg-charcoal-50/60 px-1.5">
          {DRILL_TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors',
                tab === option.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-charcoal-500 hover:text-charcoal-700',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === 'overview' && (
            <DrillOverview
              row={row}
              inMonth={inMonth}
            />
          )}
          {tab === 'requests' && <DrillRequests employeeId={employee.id} inMonth={inMonth} />}
          {tab === 'deductions' && <DrillDeductions employeeId={employee.id} inMonth={inMonth} />}
          {tab === 'evaluations' && <DrillEvaluations employeeId={employee.id} />}
          {tab === 'bonuses' && <DrillBonuses employeeId={employee.id} inMonth={inMonth} />}
          {tab === 'warnings' && <DrillWarnings employeeId={employee.id} inMonth={inMonth} />}
          {tab === 'attendance' && <DrillAttendance employeeId={employee.id} />}
        </div>
      </div>
    </div>
  )
}

/** Drill-in months — the workspace's derived month keys are passed in. */

function DrillOverview({
  row,
  inMonth,
}: {
  row: {
    employee: EmployeeDirectoryRow
    needsReview: boolean
    requests: number
    pending: number
    deductionTotal: number
    bonusTotal: number
    avgScore: number | null
    latestPeriod: string | null
    warnings: number
  }
  inMonth: (value: string | null | undefined) => boolean
}) {
  void inMonth
  return (
    <div className="space-y-2">
      <p className="text-xs text-charcoal-600">
        {row.employee.name} — {row.employee.position}. The tiles above are the live aggregates for the selected
        month; each tab lists the underlying rows.
      </p>
      {row.needsReview && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" aria-hidden="true" />
          <p className="text-[11px] text-orange-700">This employee has an open leaving (offboarding) case.</p>
        </div>
      )}
      {row.latestPeriod && row.avgScore !== null && (
        <div className="flex items-center justify-between rounded-lg bg-charcoal-50 p-2.5">
          <div>
            <p className="text-[10px] text-charcoal-500">LATEST EVALUATION</p>
            <p className="text-xs font-semibold text-charcoal-900">{row.latestPeriod}</p>
          </div>
          <p className="text-sm font-bold text-charcoal-900">{row.avgScore.toFixed(1)} / 5</p>
        </div>
      )}
    </div>
  )
}

function DrillRequests({ employeeId, inMonth }: { employeeId: number; inMonth: (value: string | null | undefined) => boolean }) {
  const inboxQuery = useQuery({
    queryKey: ['portal', 'perf', 'inbox'],
    queryFn: ({ signal }) => fetchAllPages((page) => getRequestInbox({ page, pageSize: 100, signal }), signal),
  })
  const rows = (inboxQuery.data ?? []).filter(
    (item) => item.employeeId === employeeId && inMonth(item.submittedDate),
  )
  return <DrillList
    isLoading={inboxQuery.isFetching && !inboxQuery.data}
    emptyHint="No requests on record for this filter."
    rows={rows.map((item) => ({
      key: item.id,
      left: (
        <>
          <p className="text-xs font-medium text-charcoal-900">{item.type}</p>
          <p className="text-[10px] text-charcoal-500">
            {formatDate(item.requestedDate)}
            {item.endDate ? ` → ${formatDate(item.endDate)}` : ''} · submitted {formatDate(item.submittedDate)}
          </p>
        </>
      ),
      right: <StatusBadge status={humanize(item.status)} />,
    }))}
  />
}

function DrillDeductions({ employeeId, inMonth }: { employeeId: number; inMonth: (value: string | null | undefined) => boolean }) {
  const deductionsQuery = useQuery({
    queryKey: ['portal', 'perf', 'deductions'],
    queryFn: ({ signal }) => listBranchDeductions(undefined, signal),
  })
  const rows = (deductionsQuery.data ?? []).filter(
    (item) => item.employeeId === employeeId && inMonth(item.issuedAt),
  )
  return (
    <DrillList
      isLoading={deductionsQuery.isFetching && !deductionsQuery.data}
      emptyHint="No deductions raised in this scope."
      rows={rows.map((item) => ({
        key: item.id,
        left: (
          <>
            <p className="text-xs font-medium text-charcoal-900">{item.reason}</p>
            <p className="text-[10px] text-charcoal-500">
              {item.note ?? 'No note'} · by {item.issuedBy} · {formatDate(item.issuedAt)}
            </p>
          </>
        ),
        right: (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-red-600">{formatMoney(item.amount)}</span>
            <StatusBadge status={humanize(item.status)} />
          </div>
        ),
      }))}
      icon={<MinusCircle className="h-8 w-8" aria-hidden="true" />}
    />
  )
}

function DrillEvaluations({ employeeId }: { employeeId: number }) {
  const evalsQuery = useQuery({
    queryKey: ['portal', 'perf', 'eval-rows', employeeId],
    queryFn: ({ signal }) => getEvaluationResponses({ employeeId, pageSize: 50, signal }),
  })
  const rows = evalsQuery.data?.items ?? []
  return (
    <DrillList
      isLoading={evalsQuery.isFetching && !evalsQuery.data}
      emptyHint="No submitted evaluations yet."
      rows={rows.map((item) => ({
        key: item.id,
        left: (
          <>
            <p className="text-xs font-medium text-charcoal-900">
              {item.period ?? item.form} · {item.form}
            </p>
            <p className="text-[10px] text-charcoal-500">
              Reviewer {item.reviewer || '—'} · {formatDate(item.reviewedDate)}
            </p>
            {item.notes && <p className="text-[10px] text-charcoal-400">{item.notes}</p>}
          </>
        ),
        right: (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-charcoal-900">{item.score != null ? `${Number(item.score).toFixed(1)} / 5` : '—'}</span>
            <StatusBadge status={humanize(item.status)} />
          </div>
        ),
      }))}
      icon={<Sparkles className="h-8 w-8" aria-hidden="true" />}
    />
  )
}

function DrillBonuses({ employeeId, inMonth }: { employeeId: number; inMonth: (value: string | null | undefined) => boolean }) {
  const bonusesQuery = useQuery({
    queryKey: ['portal', 'perf', 'bonuses'],
    queryFn: ({ signal }) => listBonusProposals(undefined, signal),
  })
  const rows = (bonusesQuery.data ?? []).filter(
    (item) => item.employeeId === employeeId && inMonth(item.issuedAt),
  )
  return (
    <DrillList
      isLoading={bonusesQuery.isFetching && !bonusesQuery.data}
      emptyHint="No bonuses proposed in this scope."
      rows={rows.map((item) => ({
        key: item.id,
        left: (
          <>
            <p className="text-xs font-medium text-charcoal-900">{item.type}</p>
            <p className="text-[10px] text-charcoal-500">
              {item.reason} · by {item.issuedBy} · {formatDate(item.issuedAt)}
            </p>
          </>
        ),
        right: (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-green-600">+{formatMoney(item.amount)}</span>
            <StatusBadge status={humanize(item.status)} />
          </div>
        ),
      }))}
      icon={<PiggyBank className="h-8 w-8" aria-hidden="true" />}
    />
  )
}

function DrillWarnings({ employeeId, inMonth }: { employeeId: number; inMonth: (value: string | null | undefined) => boolean }) {
  const warningsQuery = useQuery({
    queryKey: ['portal', 'perf', 'warnings'],
    queryFn: ({ signal }) => listWarningNotices(undefined, signal),
  })
  const rows = (warningsQuery.data ?? []).filter(
    (item) => item.employeeId === employeeId && inMonth(item.issuedAt),
  )
  return (
    <DrillList
      isLoading={warningsQuery.isFetching && !warningsQuery.data}
      emptyHint="No warnings on record in this scope."
      rows={rows.map((item) => ({
        key: item.id,
        left: (
          <>
            <p className="text-xs font-medium text-charcoal-900">{item.type}</p>
            <p className="text-[10px] text-charcoal-500">
              {item.reason} · by {item.issuedBy} · {formatDate(item.issuedAt)}
            </p>
          </>
        ),
        right: <StatusBadge status={humanize(item.status)} />,
      }))}
      icon={<AlertTriangle className="h-8 w-8" aria-hidden="true" />}
    />
  )
}

function DrillAttendance({ employeeId }: { employeeId: number }) {
  const [month, setMonth] = useState(currentMonthValue())
  const attendanceQuery = useQuery({
    queryKey: ['portal', 'perf', 'attendance', employeeId, month],
    queryFn: ({ signal }) => getOwnAttendance(employeeId, month, 1, signal),
  })

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="bento-label text-charcoal-400">ATTENDANCE</p>
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="form-input w-40"
          aria-label="Attendance month"
        />
      </div>
      {attendanceQuery.isLoading ? (
        <LoadingState label="Loading attendance…" />
      ) : attendanceQuery.error ? (
        <p className="text-[11px] text-red-600">{describeApiError(attendanceQuery.error)}</p>
      ) : (
        <AttendanceRows history={attendanceQuery.data} />
      )}
    </div>
  )
}

function AttendanceRows({ history }: { history: EmployeeAttendanceResponse | undefined }) {
  const totals = history?.totals
  const items: EmployeeAttendanceItem[] = history?.items ?? []
  if (items.length === 0) return <p className="text-xs text-charcoal-500">No attendance rows for this month.</p>

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <div className="rounded-lg bg-charcoal-50 p-2">
          <p className="text-base font-bold text-brand-700">{totals?.present ?? 0}</p>
          <p className="text-[10px] text-charcoal-500">On time</p>
        </div>
        <div className="rounded-lg bg-charcoal-50 p-2">
          <p className="text-base font-bold text-yellow-600">{totals?.late ?? 0}</p>
          <p className="text-[10px] text-charcoal-500">Late</p>
        </div>
        <div className="rounded-lg bg-charcoal-50 p-2">
          <p className="text-base font-bold text-red-600">{totals?.absent ?? 0}</p>
          <p className="text-[10px] text-charcoal-500">Absent</p>
        </div>
        <div className="rounded-lg bg-charcoal-50 p-2">
          <p className="text-base font-bold text-charcoal-900">{totals ? totals.hours.toFixed(0) : 0}h</p>
          <p className="text-[10px] text-charcoal-500">Hours</p>
        </div>
      </div>
      <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
        {items.slice(0, 10).map((item) => (
          <div key={item.date} className="flex items-center justify-between gap-2 p-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-charcoal-900">{formatDateWithYear(item.date)}</p>
              <p className="truncate text-[10px] text-charcoal-500">
                {item.checkIn ?? '—'} → {item.checkOut ?? '—'}
              </p>
            </div>
            <StatusBadge status={humanize(item.status)} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==================== generic drill list ==================== */

function DrillList({
  rows,
  emptyHint,
  isLoading,
  icon = <CheckCircle2 className="h-8 w-8" aria-hidden="true" />,
}: {
  rows: Array<{ key: string | number; left: React.ReactNode; right: React.ReactNode }>
  emptyHint: string
  isLoading: boolean
  icon?: React.ReactNode
}) {
  if (isLoading) return <LoadingState />
  if (rows.length === 0) {
    return (
      <div className="rounded-lg bg-charcoal-50 p-6 text-center">
        {icon && <div className="mb-1 flex justify-center text-charcoal-300">{icon}</div>}
        <p className="text-xs text-charcoal-500">{emptyHint}</p>
      </div>
    )
  }
  return (
    <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-2 p-2.5">
          <div className="min-w-0">{row.left}</div>
          <div className="flex flex-shrink-0 items-center gap-2">{row.right}</div>
        </div>
      ))}
    </div>
  )
}
