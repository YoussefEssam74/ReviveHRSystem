import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronDown, MinusCircle, PiggyBank, Sparkles } from 'lucide-react'
import {
  branchReviewDeduction,
  getEmployeeDirectory,
  getOffboardingCases,
  listBonusProposals,
  listBranchDeductions,
  listWarningNotices,
  type DeductionCandidateRow,
  type EmployeeDirectoryRow,
} from '../api/branch.api'
import { getOwnAttendance, type EmployeeAttendanceResponse, type EmployeeAttendanceItem } from '../api/attendance.api'
import { getRequestInbox } from '../api/requests.api'
import { getEvaluationResponses } from '../api/employee-file.api'
import { EmptyState } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
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
  // Who is drilled into, and on which tab, lives in the URL: the sidebar's action
  // badge deep-links straight to the employee that still owes a decision, and the
  // view survives a refresh or a back button.
  const [searchParams, setSearchParams] = useSearchParams()

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
          pendingDeductions: monthDeductions.filter((item) => item.status === 'Pending').length,
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

  const drillIdParam = Number(searchParams.get('employee'))
  const drillId = Number.isInteger(drillIdParam) && drillIdParam > 0 ? drillIdParam : null
  const tabParam = searchParams.get('tab')
  const drillTab: DrillTabId = DRILL_TABS.some((option) => option.id === tabParam)
    ? (tabParam as DrillTabId)
    : 'overview'

  /** Open an employee — on the tab that actually holds something to act on. */
  const openDrill = (row: (typeof rows)[number]) => {
    const next = new URLSearchParams(searchParams)
    next.set('employee', String(row.employee.id))
    next.set('tab', row.pendingDeductions > 0 ? 'deductions' : row.pending > 0 ? 'requests' : 'overview')
    setSearchParams(next)
  }
  const changeDrillTab = (tab: DrillTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }
  const closeDrill = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('employee')
    next.delete('tab')
    setSearchParams(next, { replace: true })
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
          tab={drillTab}
          onTabChange={changeDrillTab}
          onMonthChange={setMonth}
          onClose={closeDrill}
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
                    onClick={() => openDrill(row)}
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
                      {row.pendingDeductions > 0 && (
                        <span className="block text-[10px] font-medium text-amber-600">
                          {row.pendingDeductions} to approve
                        </span>
                      )}
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
            {rows.map((row) => {
              const waiting = [
                row.pending > 0 ? `${row.pending} request${row.pending === 1 ? '' : 's'}` : null,
                row.pendingDeductions > 0
                  ? `${row.pendingDeductions} deduction${row.pendingDeductions === 1 ? '' : 's'}`
                  : null,
              ]
                .filter((part): part is string => part != null)
                .join(' · ')
              return (
                <button
                  key={row.employee.id}
                  type="button"
                  onClick={() => openDrill(row)}
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
                  {waiting && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-center text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                      Waiting for your decision: {waiting}
                    </p>
                  )}
                </button>
              )
            })}
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
  tab,
  onTabChange,
  onMonthChange,
  onClose,
}: {
  row: {
    employee: EmployeeDirectoryRow
    needsReview: boolean
    requests: number
    pending: number
    pendingDeductions: number
    deductionTotal: number
    bonusTotal: number
    avgScore: number | null
    latestPeriod: string | null
    warnings: number
  }
  month: MonthKey
  months: string[]
  tab: DrillTabId
  onTabChange: (tab: DrillTabId) => void
  onMonthChange: (value: MonthKey) => void
  onClose: () => void
}) {
  const { employee } = row
  const navigate = useNavigate()

  // How much on each tab is still waiting for a decision — month-scoped, exactly
  // like the rows the tab renders, so the pill never disagrees with the list.
  const tabCounts: Partial<Record<DrillTabId, number>> = {
    requests: row.pending,
    deductions: row.pendingDeductions,
  }

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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <PerfTile
          label="To act on"
          value={String(row.pending + row.pendingDeductions)}
          valueClass={row.pending + row.pendingDeductions ? 'text-amber-600' : 'text-charcoal-900'}
        />
        <PerfTile label={`Requests${row.pending ? ` · ${row.pending} pending` : ''}`} value={String(row.requests)} />
        <PerfTile label="Deductions" value={formatMoney(row.deductionTotal)} valueClass={row.deductionTotal ? 'text-red-600' : 'text-charcoal-900'} />
        <PerfTile label="Bonuses" value={formatMoney(row.bonusTotal)} valueClass={row.bonusTotal ? 'text-green-600' : 'text-charcoal-900'} />
        <PerfTile label="Warnings" value={String(row.warnings)} valueClass={row.warnings ? 'text-orange-600' : 'text-charcoal-900'} />
        <PerfTile label="Eval avg" value={row.avgScore !== null ? `${row.avgScore.toFixed(1)} / 5` : '—'} />
      </div>

      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <div className="flex overflow-x-auto border-b border-charcoal-100 bg-charcoal-50/60 px-1.5">
          {DRILL_TABS.map((option) => {
            const count = tabCounts[option.id] ?? 0
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onTabChange(option.id)}
                className={cn(
                  'whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors',
                  tab === option.id
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-charcoal-500 hover:text-charcoal-700',
                )}
              >
                {option.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'ml-1 inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-bold leading-none tabular-nums',
                      tab === option.id
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
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

/**
 * The three states the branch's deduction list splits into: the rows it still has
 * to decide on, the rows already approved here and waiting for HR's payroll run
 * (still re-priceable / rejectable until HR applies them), and the rows it excused.
 */
const DEDUCTION_VIEWS = [
  {
    id: 'pending',
    label: 'Pending',
    hint: 'Awaiting your decision — approve, re-price or reject.',
    emptyHint: 'No pending deductions.',
    icon: <MinusCircle className="h-8 w-8" aria-hidden="true" />,
  },
  {
    id: 'approved',
    label: 'Approved',
    hint: 'Approved here, waiting for HR — still re-priceable or rejectable until HR applies them.',
    emptyHint: 'No approved deductions yet.',
    icon: <CheckCircle2 className="h-8 w-8" aria-hidden="true" />,
  },
  {
    id: 'rejected',
    label: 'Rejected',
    hint: 'Excused by the branch — a rejected deduction is final.',
    emptyHint: 'No rejected deductions.',
    icon: <AlertTriangle className="h-8 w-8" aria-hidden="true" />,
  },
] as const

type DeductionViewId = (typeof DEDUCTION_VIEWS)[number]['id']

/** Pending is actionable; BranchApproved / Approved sit in the approved view; Rejected in its own. */
function deductionViewOf(status: string): DeductionViewId {
  if (status === 'Pending') return 'pending'
  if (status === 'Rejected') return 'rejected'
  return 'approved'
}

/**
 * One employee's deductions (mock §25 deductions tab): every attendance deduction
 * raised against him — auto-priced absences and late arrivals from the sweep plus
 * whatever the manager issued by hand — grouped into Pending / Approved (waiting
 * for HR) / Rejected. Each row carries the decisions its state still allows:
 * approve, re-price or reject while pending; re-price or reject while it waits for
 * HR; nothing once HR has applied it or the branch has excused it. Approving a row
 * therefore moves it to the next view and takes its Approve button with it.
 */
function DrillDeductions({ employeeId, inMonth }: { employeeId: number; inMonth: (value: string | null | undefined) => boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [view, setView] = useState<DeductionViewId>('pending')

  const deductionsQuery = useQuery({
    queryKey: ['portal', 'perf', 'deductions'],
    queryFn: ({ signal }) => listBranchDeductions(undefined, signal),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, amount: revised }: { id: number; decision: 'approve' | 'reject' | 'edit'; amount?: number }) =>
      branchReviewDeduction(id, { decision, amount: revised }),
    onSuccess: (_data, variables) => {
      toast(
        variables.decision === 'approve'
          ? 'Deduction approved — it goes to HR for the payroll run.'
          : variables.decision === 'reject'
            ? 'Deduction rejected.'
            : 'Deduction amount updated.',
      )
      setEditingId(null)
      void queryClient.invalidateQueries({ queryKey: ['portal', 'perf', 'deductions'] })
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  if (deductionsQuery.isLoading) return <LoadingState />
  if (deductionsQuery.isError) {
    return <ErrorState message={describeApiError(deductionsQuery.error)} onRetry={() => deductionsQuery.refetch()} />
  }

  const rows = (deductionsQuery.data ?? []).filter(
    (item) => item.employeeId === employeeId && inMonth(item.issuedAt),
  )
  const counts: Record<DeductionViewId, number> = { pending: 0, approved: 0, rejected: 0 }
  rows.forEach((item) => {
    counts[deductionViewOf(item.status)] += 1
  })

  const current = DEDUCTION_VIEWS.find((option) => option.id === view) ?? DEDUCTION_VIEWS[0]
  const visible = rows.filter((item) => deductionViewOf(item.status) === view)
  const pending = reviewMutation.isPending
  const submitReprice = (item: DeductionCandidateRow) => {
    const value = Number(amount)
    if (amount === '' || !Number.isFinite(value) || value <= 0) {
      toast('Enter an amount greater than zero.', 'error')
      return
    }
    reviewMutation.mutate({ id: item.id, decision: 'edit', amount: value })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex self-start rounded-lg border border-charcoal-200 bg-charcoal-50 p-1">
          {DEDUCTION_VIEWS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setView(option.id)
                setEditingId(null)
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                view === option.id
                  ? 'bg-white text-brand-700 shadow-sm ring-1 ring-charcoal-200'
                  : 'text-charcoal-500 hover:text-charcoal-700',
              )}
            >
              {option.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums',
                  view === option.id ? 'bg-brand-100 text-brand-700' : 'bg-charcoal-200 text-charcoal-600',
                )}
              >
                {counts[option.id]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-charcoal-500">{current.hint}</p>
      </div>

      <DrillList
        isLoading={deductionsQuery.isFetching && !deductionsQuery.data}
        emptyHint={current.emptyHint}
        rows={visible.map((item) => {
          // What this row's state still allows: the whole decision while it is
          // pending, re-price / reject while it waits for HR, nothing once HR has
          // applied it (or the branch has excused it).
          const isOpen = item.status === 'Pending'
          const canDecide = isOpen || item.status === 'BranchApproved'
          return {
            key: item.id,
            left: (
              <>
                <p className="text-xs font-medium text-charcoal-900">{item.reason}</p>
                <p className="text-[10px] text-charcoal-500">
                  {item.note ?? 'No note'} · by {item.issuedBy} · {formatDate(item.issuedAt)}
                </p>
                {canDecide && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {isOpen && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => reviewMutation.mutate({ id: item.id, decision: 'approve' })}
                        className="rounded-md border border-green-200 px-2 py-1 text-[10px] font-semibold text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(editingId === item.id ? null : item.id)
                        setAmount(String(item.amount))
                      }}
                      className="rounded-md border border-charcoal-200 px-2 py-1 text-[10px] font-semibold text-charcoal-600 transition-colors hover:bg-charcoal-50 disabled:opacity-50"
                    >
                      Edit amount
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => reviewMutation.mutate({ id: item.id, decision: 'reject' })}
                      className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
                {editingId === item.id && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="New amount (EGP)"
                      className="w-28 rounded-md border border-charcoal-200 px-2 py-1 text-[11px] text-charcoal-800 focus:border-brand-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => submitReprice(item)}
                      className="rounded-md bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-charcoal-200 px-2 py-1 text-[10px] font-semibold text-charcoal-600 transition-colors hover:bg-charcoal-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            ),
            right: (
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-bold text-red-600">
                  {item.amount > 0 ? formatMoney(item.amount) : 'Price manually'}
                </span>
                <StatusBadge
                  status={item.status === 'BranchApproved' ? 'Branch approved' : humanize(item.status)}
                />
              </div>
            ),
          }
        })}
        icon={current.icon}
      />
    </div>
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
