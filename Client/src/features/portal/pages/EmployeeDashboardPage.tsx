import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  LogIn,
  LogOut,
  Plus,
  Receipt,
  Zap,
} from 'lucide-react'
import {
  getEmployeeDashboard,
  type DashboardAttendance,
  type DashboardOverview,
  type DashboardShift,
  type ScheduleDay,
} from '../api/dashboard.api'
import { getEmployeeDeductions, getOwnLeaveBalance } from '../api/attendance.api'
import { getExcusedHoursBudget, getOwnRequests } from '../api/requests.api'
import { NewRequestModal } from '../components/NewRequestModal'
import { useOwnEmployeeId, usePortalSession } from '../../../contexts/PortalSessionContext'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState } from '../../../components/async-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { describeApiError } from '../../../lib/api-client'
import { dateParts, formatDate, formatDateWithYear, formatMoney, formatTimeOfDay } from '../../../lib/format'
import { PAGE_PATHS } from '../portal-nav'
import { Badge, statusColor } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { cn } from '../../../lib/utils'

/** "08:00:00" → "8 AM" — compact clock label for the narrow schedule tiles. */
function compactTime(value: string | null): string {
  return formatTimeOfDay(value).replace(':00', '')
}

/** Morning blue / evening green / off gray — the shared schedule tint. */
function shiftToneClass(day: ScheduleDay): string {
  if (day.isOff) return 'schedule-shift-off'
  return /evening|night/i.test(day.shiftName ?? '') ? 'schedule-shift-evening' : 'schedule-shift-morning'
}

/** Server enum names ("MissingCheckout") → display copy ("Missing Checkout"). */
function humanizeStatus(status: string): string {
  return status.replace(/([a-z])([A-Z])/g, '$1 $2')
}

/** Check-in / check-out clock times recorded for that day (past days + today). */
function ClockRow({ day }: { day: ScheduleDay }) {
  const { t } = useTranslation()
  if (day.checkIn == null && day.checkOut == null) return null
  return (
    <div className="mt-1.5 space-y-0.5 border-t border-charcoal-100 pt-1.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold text-charcoal-600">
        <LogIn className="h-3 w-3 shrink-0 text-brand-600" aria-hidden="true" />
        <span className="truncate">
          {t('In:')} {formatTimeOfDay(day.checkIn)}
        </span>
      </span>
      <span className="flex items-center gap-1 text-[10px] font-semibold text-charcoal-500">
        <LogOut className="h-3 w-3 shrink-0 text-charcoal-400" aria-hidden="true" />
        <span className="truncate">
          {t('Out:')} {formatTimeOfDay(day.checkOut)}
        </span>
      </span>
    </div>
  )
}

function TodayShiftCard({
  shift,
  position,
  gymName,
  onOpen,
}: {
  shift: DashboardShift | null
  position: string
  gymName: string
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <button type="button" className="card card-interactive flex flex-col p-2 text-start sm:p-2.5" onClick={onOpen}>
      <p className="bento-label">{t("TODAY'S SHIFT")}</p>
      <p className="mt-1.5 text-lg font-bold leading-tight text-charcoal-900 lg:text-xl">
        {shift ? `${formatTimeOfDay(shift.start)} – ${formatTimeOfDay(shift.end)}` : t('No shift scheduled')}
      </p>
      {shift ? (
        <>
          <p className="mt-0.5 truncate text-[11px] text-charcoal-600">{t('Shift: {{shift}}', { shift: t(shift.shiftName) })}</p>
          <p className="truncate text-[11px] text-charcoal-500">
            {position || '—'} · {gymName || '—'}
          </p>
        </>
      ) : (
        <p className="mt-0.5 text-[11px] text-charcoal-500">
          {t('Your published shift days will appear here once manager publishes the cycle.')}
        </p>
      )}
    </button>
  )
}

function TodayAttendanceCard({
  attendance,
  onOpen,
}: {
  attendance: DashboardAttendance | null
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const status = attendance ? humanizeStatus(attendance.status) : null

  return (
    <button type="button" className="card card-interactive flex flex-col p-2 text-start sm:p-2.5" onClick={onOpen}>
      <div className="flex items-center justify-between gap-2">
        <p className="bento-label">{t("TODAY'S ATTENDANCE")}</p>
        {status && <Badge color={statusColor(status)}>{t(status)}</Badge>}
      </div>

      <div className="mt-1.5 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-charcoal-500">
            <LogIn className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
            {t('Check-in')}
          </span>
          <span className="text-sm font-bold leading-none text-charcoal-900">
            {formatTimeOfDay(attendance?.checkIn)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-charcoal-500">
            <LogOut className="h-3.5 w-3.5 shrink-0 text-charcoal-400" aria-hidden="true" />
            {t('Check-out')}
          </span>
          <span className="text-sm font-bold leading-none text-charcoal-900">
            {formatTimeOfDay(attendance?.checkOut)}
          </span>
        </div>
      </div>

      {!attendance && <p className="mt-0.5 text-[11px] text-charcoal-500">{t('Not checked in yet')}</p>}
    </button>
  )
}

/** Pending / approved / rejected counters; the whole card opens My Requests. */
function RequestsSummaryCard({
  pending,
  approved,
  rejected,
  loading,
  error,
}: {
  pending: number
  approved: number
  rejected: number
  loading: boolean
  error: string | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const rows = [
    { key: 'pending', label: t('Pending'), value: pending, dot: 'bg-yellow-500' },
    { key: 'approved', label: t('Approved'), value: approved, dot: 'bg-brand-500' },
    { key: 'rejected', label: t('Rejected'), value: rejected, dot: 'bg-red-500' },
  ]

  return (
    <button
      type="button"
      onClick={() => navigate(PAGE_PATHS.requests)}
      className="card card-interactive flex flex-col p-2 text-start sm:p-2.5"
    >
      <p className="bento-label">{t('Requests')}</p>

      <div className="mt-1.5 flex flex-1 flex-col justify-center">
        {loading && (
          <div className="space-y-2">
            {rows.map((row) => (
              <Skeleton key={row.key} className="h-3.5 rounded-full" />
            ))}
          </div>
        )}

        {!loading && error && <p className="py-2 text-[11px] text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="space-y-1">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', row.dot)} aria-hidden="true" />
                <span className="shrink-0 text-[11px] font-medium text-charcoal-600">{row.label}</span>
                <span className="h-0 flex-1 border-b border-dotted border-charcoal-300" aria-hidden="true" />
                <span className="shrink-0 text-sm font-bold leading-none text-charcoal-900">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

function ScheduleDayTile({ day }: { day: ScheduleDay }) {
  const { t } = useTranslation()
  const parts = dateParts(day.date)
  return (
    <div
      className={cn(
        'rounded-xl border border-charcoal-200 bg-white p-1.5',
        day.isToday && 'border-brand-300 bg-brand-50',
      )}
    >
      <p
        className={cn(
          'truncate text-[10px] font-bold uppercase tracking-wide text-charcoal-500',
          day.isToday && 'text-brand-700',
        )}
      >
        {parts.weekday} {parts.day}
      </p>
      <div className={cn('mt-1 rounded-lg px-1.5 py-1 text-center', shiftToneClass(day))}>
        <p className="text-[11px] font-bold uppercase leading-tight">{day.isOff ? t('OFF') : t(day.shiftName ?? '')}</p>
        {!day.isOff && (
          <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight">
            {compactTime(day.start)}–{compactTime(day.end)}
          </p>
        )}
      </div>
      <ClockRow day={day} />
    </div>
  )
}

function WeeklyScheduleCard({ days }: { days: ScheduleDay[] }) {
  const { t } = useTranslation()
  return (
    <section className="card p-2.5 sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-charcoal-900">{t('Upcoming Weekly Schedule')}</h3>
        <Link
          to={PAGE_PATHS.schedule}
          className="flex shrink-0 items-center text-[11px] font-semibold text-brand-600 hover:underline"
        >
          {t('Full Schedule')}
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
      {days.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title={t('No published schedule')}
          hint={t('Your published shift days will appear here once manager publishes the cycle.')}
        />
      ) : (
        <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:pb-0">
          {days.map((day) => (
            <div key={day.date} className="w-[92px] shrink-0 snap-start sm:w-auto sm:shrink">
              <ScheduleDayTile day={day} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Live deductions (waived ones no longer count) — why, how much and when, newest first. */
function DeductionsCard({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['portal', 'deductions', employeeId],
    queryFn: ({ signal }) => getEmployeeDeductions(employeeId, signal),
  })

  const deductions = useMemo(
    () =>
      (query.data ?? [])
        .filter((row) => row.status !== 'Rejected' && row.status !== 'Resolved')
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [query.data],
  )
  const visible = deductions.slice(0, 3)
  const total = deductions.reduce((sum, row) => sum + (row.amount ?? 0), 0)

  return (
    <section className="card flex flex-col p-2 sm:p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="bento-label truncate">{t('DEDUCTIONS')}</p>
          {!query.isLoading && !query.isError && (
            <span className="min-w-6 rounded-full bg-charcoal-100 px-2 py-0.5 text-center text-[11px] font-bold leading-4 text-charcoal-700">
              {deductions.length}
            </span>
          )}
        </div>
        <Link
          to={PAGE_PATHS.attendance}
          className="flex shrink-0 items-center text-[11px] font-semibold text-brand-600 hover:underline"
        >
          {t('View all')}
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>

      {query.isLoading && (
        <div className="space-y-1.5">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-4 rounded-full" />
          ))}
        </div>
      )}

      {!query.isLoading && query.isError && (
        <p className="text-[11px] text-red-600">{describeApiError(query.error)}</p>
      )}

      {!query.isLoading && !query.isError && deductions.length === 0 && (
        <div className="flex items-center gap-1.5 py-2 text-charcoal-500">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
          <p className="text-[11px] font-medium">{t('No deductions')}</p>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="space-y-1">
          {visible.map((row) => (
            <li key={row.id} className="flex items-center gap-2">
              <Receipt className="h-3 w-3 shrink-0 text-red-400" aria-hidden="true" />
              <span
                className="min-w-0 flex-1 truncate text-[11px] text-charcoal-500"
                title={`${row.description} · ${row.status}`}
              >
                <span className="font-semibold text-charcoal-900">{row.description}</span>
                {' · '}
                {row.date ? formatDate(row.date) : '—'}
              </span>
              <span className="shrink-0 text-[11px] font-bold text-red-600">
                {row.amount != null ? formatMoney(row.amount) : t('Amount pending')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {total > 0 && (
        <p className="mt-1 border-t border-charcoal-100 pt-1.5 text-[11px] font-semibold text-charcoal-700">
          {t('Total: {{amount}}', { amount: formatMoney(total) })}
        </p>
      )}
    </section>
  )
}

/**
 * Annual leave opens six months after hire. The year's allowance is one day per
 * completed service month up to 31 December, capped at twelve: hired in April → opens
 * in October → 6 + 2 = 8 for that year; employed for the whole year → the full 12
 * (January–April's 4 plus April–December's 8).
 */
function annualLeavePlan(hireDate: string | null | undefined): { opensOn: Date; limit: number } | null {
  if (!hireDate) return null
  const [year, month, day] = hireDate.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  const hired = new Date(year, month - 1, day)
  const opensOn = new Date(year, month - 1 + 6, day)
  const yearEnd = new Date(new Date().getFullYear(), 11, 31)
  if (hired.getTime() > yearEnd.getTime()) return { opensOn, limit: 0 }
  let months = (yearEnd.getFullYear() - hired.getFullYear()) * 12 + (yearEnd.getMonth() - hired.getMonth())
  if (yearEnd.getDate() < hired.getDate()) months -= 1
  return { opensOn, limit: Math.min(12, Math.max(0, months)) }
}

/** What the employee can still draw on: annual, sick and the shared excused-hours cap. */
function LeaveBalanceCard({
  employeeId,
  hireDate,
}: {
  employeeId: number
  hireDate: string | null
}) {
  const { t } = useTranslation()
  const balanceQuery = useQuery({
    queryKey: ['portal', 'leave-balance', employeeId],
    queryFn: ({ signal }) => getOwnLeaveBalance(employeeId, signal),
  })
  const budgetQuery = useQuery({
    queryKey: ['portal', 'excused-hours', employeeId],
    queryFn: ({ signal }) => getExcusedHoursBudget(employeeId, signal),
  })

  const balance = balanceQuery.data
  const budget = budgetQuery.data
  const loading = balanceQuery.isLoading || budgetQuery.isLoading
  const error = balanceQuery.isError
    ? describeApiError(balanceQuery.error)
    : budgetQuery.isError
      ? describeApiError(budgetQuery.error)
      : null

  const rows: {
    key: string
    label: string
    used: number
    total: number
    unit: string
    dot: string
    note?: string
  }[] = []
  const annualPlan = annualLeavePlan(hireDate)
  if (balance) {
    // A locked limit has no usable days yet, so the row reports when it opens instead
    // of a "used / allowance" fraction the employee cannot spend against.
    const lockedUntil = annualPlan && annualPlan.opensOn.getTime() > Date.now() ? annualPlan.opensOn : null
    rows.push(
      {
        key: 'annual',
        label: t('Annual leave'),
        used: balance.dayOff.used,
        total: annualPlan ? annualPlan.limit : balance.dayOff.total,
        unit: t('days'),
        dot: 'bg-brand-500',
        note: lockedUntil ? t('Opens {{date}}', { date: formatDateWithYear(lockedUntil) }) : undefined,
      },
      {
        key: 'sick',
        label: t('Sick leave'),
        used: balance.sick.used,
        total: balance.sick.total,
        unit: t('days'),
        dot: 'bg-red-400',
      },
    )
  }
  if (budget) {
    rows.push({
      key: 'excused',
      label: t('Excused hours'),
      used: budget.usedHours,
      total: budget.capHours,
      unit: t('hours'),
      dot: 'bg-violet-400',
    })
  }

  return (
    <section className="card flex flex-col p-2 sm:p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="bento-label truncate">{t('LEAVE BALANCE')}</p>
        <Link
          to={PAGE_PATHS.requests}
          className="flex shrink-0 items-center text-[11px] font-semibold text-brand-600 hover:underline"
        >
          {t('My Requests')}
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>

      {loading && (
        <div className="space-y-1.5">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-4 rounded-full" />
          ))}
        </div>
      )}

      {!loading && error && <p className="text-[11px] text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="space-y-1">
          {rows.map((row) => {
            const remaining = Math.max(0, row.total - row.used)
            const exhausted = row.total > 0 && remaining <= 0
            return (
              <div key={row.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', row.dot)} aria-hidden="true" />
                <span className="min-w-0 truncate text-[11px] font-medium text-charcoal-600">{row.label}</span>
                <span className="h-0 flex-1 border-b border-dotted border-charcoal-300" aria-hidden="true" />
                {row.note ? (
                  <span className="shrink-0 text-[10px] font-medium text-charcoal-400">{row.note}</span>
                ) : row.total > 0 ? (
                  <span
                    className={cn(
                      'shrink-0 text-[11px] font-bold',
                      exhausted ? 'text-red-600' : 'text-charcoal-900',
                    )}
                  >
                    {row.used} / {row.total}
                    <span className="ms-1 text-[10px] font-medium text-charcoal-400">{row.unit}</span>
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-bold text-charcoal-400">—</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function OverviewStrip({ overview }: { overview: DashboardOverview }) {
  const { t } = useTranslation()
  const isBranchScope = overview.scope.toLowerCase() === 'branch'
  const targetPath = isBranchScope ? PAGE_PATHS.employees : PAGE_PATHS.team
  const label = isBranchScope ? t('BRANCH OVERVIEW') : t('TEAM OVERVIEW')
  const linkLabel = isBranchScope ? t('View Employees') : t('View Team')
  return (
    <div className="card p-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="bento-label">{label}</p>
        <Link to={targetPath} className="text-[11px] font-semibold text-brand-600 hover:underline">
          {linkLabel}
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-charcoal-50 p-1.5 text-center">
          <p className="text-base font-bold text-charcoal-900">{overview.memberCount}</p>
          <p className="text-[10px] text-charcoal-500">{isBranchScope ? t('Employees') : t('Team Members')}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-1.5 text-center">
          <p className="text-base font-bold text-brand-600">{overview.presentToday}</p>
          <p className="text-[10px] text-charcoal-500">{t('Present Today')}</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-1.5 text-center">
          <p className="text-base font-bold text-yellow-600">{overview.pendingRequests}</p>
          <p className="text-[10px] text-charcoal-500">{t('Pending Requests')}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-1.5 text-center">
          <p className="text-base font-bold text-red-600">{overview.absent}</p>
          <p className="text-[10px] text-charcoal-500">{t('Absent')}</p>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <Skeleton className="h-44 rounded-xl" />
      <div className="grid gap-2 lg:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  )
}

export default function EmployeeDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me, user } = usePortalSession()
  const employeeId = useOwnEmployeeId()
  const [newRequestOpen, setNewRequestOpen] = useState(false)

  const dashboard = useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: ({ signal }) => getEmployeeDashboard(signal),
  })

  // The dashboard payload only carries the pending *count*; the summary card
  // also needs approved/rejected, so it reuses the My Requests cache instead of
  // duplicating those counts server-side.
  const requests = useQuery({
    queryKey: ['portal', 'requests', employeeId, 'list'],
    queryFn: ({ signal }) => getOwnRequests(employeeId as number, signal),
    enabled: employeeId != null,
  })

  const data = dashboard.data

  const requestCounts = useMemo(() => {
    const byStatus = new Map<string, number>()
    for (const request of requests.data ?? [])
      byStatus.set(request.status, (byStatus.get(request.status) ?? 0) + 1)
    return {
      pending: (byStatus.get('Pending') ?? 0) + (byStatus.get('Pending HR Review') ?? 0),
      approved: byStatus.get('Approved') ?? 0,
      rejected: byStatus.get('Rejected') ?? 0,
    }
  }, [requests.data])

  if (dashboard.isError) {
    return <ErrorState message={describeApiError(dashboard.error)} onRetry={() => dashboard.refetch()} />
  }

  if (dashboard.isLoading || !data) {
    return <DashboardSkeleton />
  }

  // The dashboard body is derived from the caller's employment record, which is
  // homed in one gym and never follows the active-gym switch (a manager holding
  // a Team-Leader role elsewhere has no record there at all). When the two gym
  // contexts differ, say so explicitly — a bare "{position} · {record gym}"
  // line otherwise reads as "the gym switch didn't happen".
  const recordGymMismatch = Boolean(me?.activeGym?.gymId && data.user.gymId && me.activeGym.gymId !== data.user.gymId)
  const pendingError = requests.isError ? describeApiError(requests.error) : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-charcoal-900 sm:text-2xl">
            {data.greeting}, {data.user.firstName} 👋
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-charcoal-500">
            <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {data.user.position || '—'} · {data.user.gymName || '—'}
            </span>
          </p>
          {recordGymMismatch && (
            <p className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('Employment record is from {{recordGym}} — you are working in {{activeGym}} today', {
                recordGym: data.user.gymName,
                activeGym: me?.activeGym?.gymName,
              })}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => (employeeId != null ? setNewRequestOpen(true) : navigate(PAGE_PATHS.requests))}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('New request')}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <TodayShiftCard
          shift={data.todayShift}
          position={data.user.position}
          gymName={data.user.gymName}
          onOpen={() => navigate(PAGE_PATHS.schedule)}
        />
        <TodayAttendanceCard
          attendance={data.todayAttendance}
          onOpen={() => navigate(PAGE_PATHS.attendance)}
        />
        <RequestsSummaryCard
          pending={requestCounts.pending}
          approved={requestCounts.approved}
          rejected={requestCounts.rejected}
          loading={requests.isLoading && employeeId != null}
          error={pendingError}
        />
      </div>

      <WeeklyScheduleCard days={data.upcomingSchedule} />

      {employeeId != null && (
        <div className="grid gap-2 lg:grid-cols-2">
          <DeductionsCard employeeId={employeeId} />
          <LeaveBalanceCard employeeId={employeeId} hireDate={user?.hireDate ?? null} />
        </div>
      )}

      {data.overview && <OverviewStrip overview={data.overview} />}

      {newRequestOpen && employeeId != null && (
        <NewRequestModal employeeId={employeeId} onClose={() => setNewRequestOpen(false)} />
      )}
    </div>
  )
}
