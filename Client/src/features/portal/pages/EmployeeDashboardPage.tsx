import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ChevronRight, Clock, LogIn, LogOut, Users, Wallet, Zap } from 'lucide-react'
import { getEmployeeDashboard, type DashboardOverview, type ScheduleDay } from '../api/dashboard.api'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState } from '../../../components/async-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { describeApiError } from '../../../lib/api-client'
import { formatMoney } from '../../../lib/format'
import { PAGE_PATHS } from '../portal-nav'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { cn } from '../../../lib/utils'

function time12(value: string | null): string {
  if (!value) return '—'
  const [hourPart, minutePart] = value.split(':')
  const hour = Number(hourPart)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${minutePart} ${suffix}`
}

/** Off-day card on the 7-day schedule strip. Shows check-in/out when a record exists. */
function OffDayCard({ day }: { day: ScheduleDay }) {
  return (
    <div className={cn('schedule-day-card', day.isToday && 'is-today', 'is-off')}>
      <p className={cn('bento-label mb-1', day.isToday && '!text-brand-600')}>
        {day.dayName.toUpperCase()} {day.date.slice(8)}
        {day.isToday ? ' (TODAY)' : ''}
      </p>
      <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-charcoal-500">OFF</p>
      <ClockRow day={day} />
    </div>
  )
}

function ScheduleShiftCard({ day }: { day: ScheduleDay }) {
  const shiftClass =
    day.shiftName === 'Morning' ? 'schedule-shift-morning' : day.shiftName === 'Evening' ? 'schedule-shift-evening' : 'schedule-shift-off'
  return (
    <div className={cn('schedule-day-card', day.isToday && 'is-today')}>
      <p className={cn('bento-label mb-1', day.isToday && '!text-brand-600')}>
        {day.dayName.toUpperCase()} {day.date.slice(8)}
        {day.isToday ? ' (TODAY)' : ''}
      </p>
      <span className={cn('schedule-shift-badge inline-block', shiftClass)}>{day.shiftName}</span>
      <div className="mt-1.5">
        <p className="text-[11px] font-bold leading-tight text-charcoal-900">{time12(day.start)}</p>
        <ChevronRight className="my-0.5 h-3 w-3 rotate-90 text-charcoal-300" aria-hidden="true" />
        <p className="text-[11px] font-semibold leading-tight text-charcoal-500">{time12(day.end)}</p>
      </div>
      <ClockRow day={day} />
    </div>
  )
}

/** Check-in / check-out clock times recorded for that day (past days + today). */
function ClockRow({ day }: { day: ScheduleDay }) {
  if (day.checkIn == null && day.checkOut == null) return null
  return (
    <div className="mt-1.5 border-t border-charcoal-100 pt-1.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold text-charcoal-700">
        <LogIn className="h-3 w-3 text-brand-600" aria-hidden="true" />
        In: {day.checkIn ? time12(day.checkIn) : '—'}
      </span>
      <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-charcoal-500">
        <LogOut className="h-3 w-3 text-charcoal-400" aria-hidden="true" />
        Out: {day.checkOut ? time12(day.checkOut) : '—'}
      </span>
    </div>
  )
}

function OverviewStrip({ overview }: { overview: DashboardOverview }) {
  const isBranchScope = overview.scope.toLowerCase() === 'branch'
  const targetPath = isBranchScope ? PAGE_PATHS.employees : PAGE_PATHS.team
  const label = isBranchScope ? 'BRANCH OVERVIEW' : 'TEAM OVERVIEW'
  const linkLabel = isBranchScope ? 'View Employees' : 'View Team'
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
          <p className="text-[10px] text-charcoal-500">{isBranchScope ? 'Employees' : 'Team Members'}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-2 text-center">
          <p className="text-lg font-bold text-brand-600">{overview.presentToday}</p>
          <p className="text-[10px] text-charcoal-500">Present Today</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-2 text-center">
          <p className="text-lg font-bold text-yellow-600">{overview.pendingRequests}</p>
          <p className="text-[10px] text-charcoal-500">Pending Requests</p>
        </div>
        <div className="rounded-lg bg-red-50 p-2 text-center">
          <p className="text-lg font-bold text-red-600">{overview.absent}</p>
          <p className="text-[10px] text-charcoal-500">Absent</p>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-52" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  )
}

export default function EmployeeDashboardPage() {
  const navigate = useNavigate()
  const dashboard = useQuery({ queryKey: ['portal', 'dashboard'], queryFn: ({ signal }) => getEmployeeDashboard(signal) })

  if (dashboard.isError) {
    return <ErrorState message={describeApiError(dashboard.error)} onRetry={() => dashboard.refetch()} />
  }

  if (dashboard.isLoading || !dashboard.data) {
    return <DashboardSkeleton />
  }

  const data = dashboard.data
  const today = data.todayShift
  const attendance = data.todayAttendance
  const attendanceLabel = attendance?.status || 'Not Checked In'
  const attendanceTone =
    attendance && (attendance.status === 'On Time' || attendance.status === 'Present')
      ? 'bg-blue-50 text-blue-700'
      : attendance?.status === 'Late'
        ? 'bg-yellow-50 text-yellow-700'
        : 'bg-charcoal-50 text-charcoal-600'
  const period = data.latestPayroll

  return (
    <div className="space-y-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-charcoal-900">
            {data.greeting}, {data.user.firstName} 👋
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-charcoal-500">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            {data.user.position || '—'} · {data.user.gymName || '—'}
          </p>
        </div>
        <div className="hidden sm:block">
          <Button size="sm" variant="secondary" onClick={() => navigate(PAGE_PATHS.requests)}>
            New request
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {/* Today's shift */}
          <button type="button" className="card card-interactive p-3 text-left" onClick={() => navigate(PAGE_PATHS.schedule)}>
            <p className="bento-label mb-2">TODAY'S SHIFT</p>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-bold text-charcoal-900">
                  {today ? `${time12(today.start)} — ${time12(today.end)}` : '—'}
                </p>
                <p className="mt-0.5 text-xs text-charcoal-500">{today ? `${today.shiftName} Shift` : 'No shift scheduled'}</p>
              </div>
              {today && (
                <span className="flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  Scheduled
                </span>
              )}
            </div>
          </button>

          {/* Today's attendance */}
          <button type="button" className="card card-interactive p-3 text-left" onClick={() => navigate(PAGE_PATHS.attendance)}>
            <p className="bento-label mb-2">TODAY'S ATTENDANCE</p>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-bold text-charcoal-900">{attendance?.checkedIn ? time12(attendance.checkIn) : '—'}</p>
                <p className="mt-0.5 text-xs text-charcoal-500">{attendance?.checkedIn ? 'Checked In' : 'Not Checked In'}</p>
              </div>
              <span className={cn('flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold', attendanceTone)}>
                <Clock className="h-3 w-3" aria-hidden="true" />
                {attendanceLabel}
              </span>
            </div>
          </button>
        </div>

        {/* 7-day schedule strip */}
        <div className="card p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="bento-label">7-DAY SCHEDULE</p>
            <Link to={PAGE_PATHS.schedule} className="flex items-center text-[11px] font-semibold text-brand-600 hover:underline">
              Full Schedule
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          {data.upcomingSchedule.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-6 w-6" />}
              title="No published schedule"
              hint="Your published shift days will appear here once manager publishes the cycle."
            />
          ) : (
            <div className="schedule-scroll">
              {data.upcomingSchedule.map((day) =>
                day.isOff ? <OffDayCard key={day.date} day={day} /> : <ScheduleShiftCard key={day.date} day={day} />,
              )}
            </div>
          )}
        </div>

        {/* Pending requests + latest payroll */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" className="card card-interactive p-3 text-left" onClick={() => navigate(PAGE_PATHS.requests)}>
            <p className="bento-label mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              PENDING REQUESTS
            </p>
            <p className="text-2xl font-bold leading-none text-charcoal-900">{data.pendingRequestCount}</p>
            <p className="mt-2 text-xs text-charcoal-500">
              {data.pendingRequestCount === 0 ? 'All caught up!' : `${data.pendingRequestCount} awaiting review`}
            </p>
          </button>

          <button type="button" className="card card-interactive relative overflow-hidden p-3 text-left" onClick={() => navigate(PAGE_PATHS.payroll)}>
            <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-brand-500 opacity-[0.07]" aria-hidden="true" />
            <p className="bento-label relative z-10 mb-2 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              LATEST PAYROLL
            </p>
            <div className="relative z-10">
              <p className="text-base font-bold text-charcoal-900">{period?.period ?? 'No payroll yet'}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {period && <StatusBadge status={period.status} />}
                {period && <span className="text-xs text-charcoal-600">{formatMoney(period.netSalary)}</span>}
              </div>
            </div>
          </button>
        </div>

        {data.overview && <OverviewStrip overview={data.overview} />}
      </div>
    </div>
  )
}
