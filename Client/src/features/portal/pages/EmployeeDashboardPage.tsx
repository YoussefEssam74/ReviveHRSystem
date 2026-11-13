import { useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  LogIn,
  LogOut,
  Plus,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  getEmployeeDashboard,
  type DashboardAttendance,
  type DashboardOverview,
  type DashboardShift,
  type PayrollEntry,
  type ScheduleDay,
} from '../api/dashboard.api'
import { getOwnPayrollSheets, type PayrollSheet } from '../api/payroll.api'
import { getOwnRequests, type EmployeeRequestItem } from '../api/requests.api'
import { NewRequestModal } from '../components/NewRequestModal'
import { useOwnEmployeeId, usePortalSession } from '../../../contexts/PortalSessionContext'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState } from '../../../components/async-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { describeApiError } from '../../../lib/api-client'
import { dateParts, formatDate, formatDateWithYear, formatMoney, formatTimeOfDay } from '../../../lib/format'
import { PAGE_PATHS } from '../portal-nav'
import { Badge, StatusBadge, statusColor } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { cn } from '../../../lib/utils'

/** "08:00:00" → "8 AM" — compact clock label for the narrow schedule tiles. */
function compactTime(value: string | null): string {
  return formatTimeOfDay(value).replace(':00', '')
}

/** Stable empty list so the payroll card's trend memo holds across renders. */
const EMPTY_SHEETS: PayrollSheet[] = []

/** Inclusive day count of a request range (single-day types count as one). */
function inclusiveDays(start: string, end: string | null): number {
  if (!end || end === start) return 1
  const from = new Date(`${start}T00:00:00`).getTime()
  const to = new Date(`${end}T00:00:00`).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) return 1
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1)
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

function toMinutes(value: string | null): number | null {
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

/**
 * Single-series trend line shared by the attendance and payroll cards. Points
 * are real values (worked hours, net pay); fewer than two points renders
 * nothing so the card can show its own message instead of a flat fake line.
 */
function Sparkline({ values, labels, ariaLabel }: { values: number[]; labels: string[]; ariaLabel: string }) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  if (values.length < 2) return null

  const width = 240
  const height = 56
  const pad = 4
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const step = (width - pad * 2) / (values.length - 1)
  const points = values.map((value, index) => ({
    x: pad + index * step,
    y: height - pad - ((value - min) / range) * (height - pad * 2),
  }))
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`

  return (
    <div className="min-w-0" dir="ltr">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-14 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="#16a34a"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between gap-1 text-[10px] font-medium text-charcoal-400">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`} className="truncate">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
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
    <button type="button" className="card card-interactive flex flex-col p-3 text-start sm:p-4" onClick={onOpen}>
      <p className="bento-label">{t("TODAY'S SHIFT")}</p>
      <p className="mt-2 text-xl font-bold leading-tight text-charcoal-900 lg:text-2xl">
        {shift ? `${formatTimeOfDay(shift.start)} – ${formatTimeOfDay(shift.end)}` : t('No shift scheduled')}
      </p>
      {shift ? (
        <>
          <p className="mt-1.5 text-xs text-charcoal-600">{t('Shift: {{shift}}', { shift: t(shift.shiftName) })}</p>
          <p className="mt-0.5 truncate text-xs text-charcoal-500">
            {position || '—'} · {gymName || '—'}
          </p>
          <div className="mt-auto flex items-center gap-1.5 border-t border-charcoal-100 pt-2">
            <span className="text-[11px] text-charcoal-500">{t('Status:')}</span>
            <StatusBadge status="Published" />
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-charcoal-500">
          {t('Your published shift days will appear here once manager publishes the cycle.')}
        </p>
      )}
    </button>
  )
}

function TodayAttendanceCard({
  attendance,
  week,
  onOpen,
}: {
  attendance: DashboardAttendance | null
  week: { values: number[]; labels: string[] }
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const checkedIn = Boolean(attendance?.checkedIn)
  const status = attendance ? t(humanizeStatus(attendance.status)) : null

  return (
    <button type="button" className="card card-interactive flex flex-col p-3 text-start sm:p-4" onClick={onOpen}>
      <p className="bento-label">{t("TODAY'S ATTENDANCE")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xl font-bold leading-none text-charcoal-900 lg:text-2xl">
          {checkedIn ? formatTimeOfDay(attendance?.checkIn) : '—'}
        </p>
        {attendance && (
          <Badge color={statusColor(attendance.status)}>
            {checkedIn ? `${status} (${attendance.checkOut ? t('Checked Out') : t('Checked In')})` : status}
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-xs text-charcoal-500">{checkedIn ? t('Check-in') : t('Not checked in yet')}</p>
      {week.values.some((hours) => hours > 0) && (
        <div className="mt-auto pt-3">
          <Sparkline values={week.values} labels={week.labels} ariaLabel={t('Worked hours in the last 7 days')} />
        </div>
      )}
    </button>
  )
}

function PendingRequestsCard({
  count,
  items,
  loading,
  error,
}: {
  count: number
  items: EmployeeRequestItem[]
  loading: boolean
  error: string | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="card flex flex-col p-3 sm:col-span-2 sm:p-4 lg:col-span-1">
      <div className="flex items-center justify-between gap-2">
        <p className="bento-label">{t('PENDING REQUESTS')}</p>
        <span className="min-w-6 rounded-full bg-charcoal-100 px-2 py-0.5 text-center text-[11px] font-bold leading-4 text-charcoal-700">
          {count}
        </span>
      </div>

      <div className="mt-2 flex-1 space-y-1">
        {loading &&
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-11 rounded-lg" />)}

        {!loading && error && <p className="py-3 text-[11px] text-red-600">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 py-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <p className="text-xs font-medium text-charcoal-600">{t('All caught up!')}</p>
          </div>
        )}

        {!loading &&
          !error &&
          items.map((request) => {
            const days = inclusiveDays(request.requestedDate, request.endDate)
            const title = days > 1 ? `${request.type} · ${t('{{count}} days', { count: days })}` : request.type
            const state = request.status === 'Pending' ? t('Awaiting Manager') : t('Pending HR Review')
            return (
              <button
                key={request.id}
                type="button"
                onClick={() => navigate(PAGE_PATHS.requests)}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-start transition-colors hover:bg-charcoal-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-charcoal-100 text-charcoal-500">
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-charcoal-900">{title}</span>
                  <span className="block truncate text-[11px] text-charcoal-500">
                    {state} · {formatDate(request.requestedDate)}
                  </span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-charcoal-300 rtl:rotate-180" aria-hidden="true" />
              </button>
            )
          })}
      </div>

      <Link
        to={PAGE_PATHS.requests}
        className="mt-2 flex items-center justify-end gap-0.5 border-t border-charcoal-100 pt-2 text-[11px] font-semibold text-brand-600 hover:underline"
      >
        {t('View all requests')}
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </div>
  )
}

function ScheduleDayTile({ day }: { day: ScheduleDay }) {
  const { t } = useTranslation()
  const parts = dateParts(day.date)
  return (
    <div
      className={cn(
        'rounded-xl border border-charcoal-200 bg-white p-2',
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
      <div className={cn('mt-1.5 rounded-lg px-1.5 py-1.5 text-center', shiftToneClass(day))}>
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
    <section className="card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
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

function LatestPayrollCard({ payroll, sheets }: { payroll: PayrollEntry | null; sheets: PayrollSheet[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Closed payslips only: an open period carries no payout yet, so it would
  // draw a zero point and misrepresent the trend.
  const trend = useMemo(() => {
    const closed = sheets
      .filter((sheet) => sheet.visible && sheet.paidDate)
      .sort((a, b) => (a.paidDate ?? '').localeCompare(b.paidDate ?? ''))
      .slice(-6)
    return {
      values: closed.map((sheet) => sheet.netSalary),
      labels: closed.map((sheet) => sheet.period.split(' ')[0].slice(0, 3)),
    }
  }, [sheets])

  return (
    <section className="card p-3 sm:p-4">
      <p className="bento-label">{t('LATEST PAYROLL')}</p>

      {payroll ? (
        <div className="mt-3 grid gap-4 lg:grid-cols-2 lg:items-end">
          <div className="min-w-0">
            <dl className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 border-b border-charcoal-100 pb-2">
                <dt className="text-xs text-charcoal-500">{t('Month')}</dt>
                <dd className="text-xs font-semibold text-charcoal-900">{payroll.period}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-charcoal-100 pb-2">
                <dt className="text-xs text-charcoal-500">{t('Net Pay')}</dt>
                <dd className="text-sm font-bold text-charcoal-900">{formatMoney(payroll.netSalary)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-charcoal-500">{t('Pay Date')}</dt>
                <dd className="text-xs font-semibold text-charcoal-900">
                  {payroll.paidDate ? formatDateWithYear(payroll.paidDate) : t('Not paid yet')}
                </dd>
              </div>
            </dl>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigate(PAGE_PATHS.payroll)}>
              {t('View Payslip')}
            </Button>
          </div>
          <div className="min-w-0">
            {trend.values.length >= 2 ? (
              <Sparkline
                values={trend.values}
                labels={trend.labels}
                ariaLabel={t('Net pay of your last {{count}} payslips', { count: trend.values.length })}
              />
            ) : (
              <p className="text-[11px] text-charcoal-400">{t('Your pay trend appears after your second payslip.')}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <Wallet className="h-6 w-6 text-charcoal-300" aria-hidden="true" />
          <p className="text-xs text-charcoal-500">{t('No payroll yet')}</p>
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
        <div className="rounded-lg bg-charcoal-50 p-2 text-center">
          <p className="text-lg font-bold text-charcoal-900">{overview.memberCount}</p>
          <p className="text-[10px] text-charcoal-500">{isBranchScope ? t('Employees') : t('Team Members')}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-2 text-center">
          <p className="text-lg font-bold text-brand-600">{overview.presentToday}</p>
          <p className="text-[10px] text-charcoal-500">{t('Present Today')}</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-2 text-center">
          <p className="text-lg font-bold text-yellow-600">{overview.pendingRequests}</p>
          <p className="text-[10px] text-charcoal-500">{t('Pending Requests')}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-2 text-center">
          <p className="text-lg font-bold text-red-600">{overview.absent}</p>
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
        <Skeleton className="h-36 rounded-xl sm:col-span-2 lg:col-span-1" />
      </div>
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  )
}

export default function EmployeeDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me } = usePortalSession()
  const employeeId = useOwnEmployeeId()
  const [newRequestOpen, setNewRequestOpen] = useState(false)

  const dashboard = useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: ({ signal }) => getEmployeeDashboard(signal),
  })

  // The dashboard payload carries pending *counts*; the summary card lists the
  // actual requests, so it reuses the My Requests cache instead of duplicating
  // the list server-side.
  const requests = useQuery({
    queryKey: ['portal', 'requests', employeeId, 'list'],
    queryFn: ({ signal }) => getOwnRequests(employeeId as number, signal),
    enabled: employeeId != null,
  })

  // Pay trend of the payroll card: closed payslips only, newest six.
  const payrollSheets = useQuery({
    queryKey: ['portal', 'payroll-sheets', employeeId],
    queryFn: ({ signal }) => getOwnPayrollSheets(employeeId as number, signal),
    enabled: employeeId != null && Boolean(dashboard.data?.latestPayroll),
  })

  const data = dashboard.data

  const pendingRequests = useMemo(
    () =>
      (requests.data ?? [])
        .filter((request) => request.status === 'Pending' || request.status === 'Pending HR Review')
        .sort((a, b) => b.submittedDate.localeCompare(a.submittedDate))
        .slice(0, 3),
    [requests.data],
  )

  // Worked hours of the seven days the schedule strip covers (two past days,
  // today, and the four ahead) — the attendance card's sparkline.
  const attendanceWeek = useMemo(() => {
    const days = data?.upcomingSchedule ?? []
    return {
      values: days.map((day) => {
        const start = toMinutes(day.checkIn)
        const end = toMinutes(day.checkOut)
        return start != null && end != null ? Math.max(0, (end - start) / 60) : 0
      }),
      labels: days.map((day) => dateParts(day.date).weekday.slice(0, 3)),
    }
  }, [data?.upcomingSchedule])

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
    <div className="space-y-3">
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
          week={attendanceWeek}
          onOpen={() => navigate(PAGE_PATHS.attendance)}
        />
        <PendingRequestsCard
          count={data.pendingRequestCount}
          items={pendingRequests}
          loading={requests.isLoading && employeeId != null}
          error={pendingError}
        />
      </div>

      <WeeklyScheduleCard days={data.upcomingSchedule} />

      <LatestPayrollCard payroll={data.latestPayroll} sheets={payrollSheets.data ?? EMPTY_SHEETS} />

      {data.overview && <OverviewStrip overview={data.overview} />}

      {newRequestOpen && employeeId != null && (
        <NewRequestModal employeeId={employeeId} onClose={() => setNewRequestOpen(false)} />
      )}
    </div>
  )
}
