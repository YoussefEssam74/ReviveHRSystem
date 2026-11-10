import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Calendar, ChevronRight, Clock, LogIn, LogOut, Users, Wallet, Zap } from 'lucide-react'
import { getEmployeeDashboard, type DashboardOverview, type ScheduleDay } from '../api/dashboard.api'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
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

/** "08:00" → "8a" — compact label for the phone 7-day strip. */
function shortTime(value: string | null): string {
  if (!value) return '—'
  const [hourPart, minutePart] = value.split(':')
  const hour = Number(hourPart)
  if (Number.isNaN(hour)) return value
  const suffix = hour >= 12 ? 'p' : 'a'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return minutePart && minutePart !== '00' ? `${display}:${minutePart}${suffix}` : `${display}${suffix}`
}

/** Off-day card on the 7-day schedule strip. Shows check-in/out when a record exists. */
function OffDayCard({ day }: { day: ScheduleDay }) {
  return (
    <div className={cn('w-[22%] shrink-0 snap-start rounded-lg border border-charcoal-200 bg-white sm:w-auto sm:shrink', day.isToday && 'border-brand-200 bg-brand-50', 'sm:p-3')}>
      {/* Phone: ~4 days visible, the rest one swipe away. */}
      <div className="flex flex-col items-center gap-0.5 px-1 py-2 text-center sm:hidden">
        <p className={cn('text-[9px] font-bold uppercase leading-none text-charcoal-400', day.isToday && 'text-brand-600')}>
          {day.dayName.slice(0, 3)}
        </p>
        <p className={cn('text-sm font-bold leading-none text-charcoal-900', day.isToday && 'text-brand-700')}>{day.date.slice(8)}</p>
        <span className="mt-1 w-full rounded bg-charcoal-100 px-0.5 py-0.5 text-[9px] font-bold leading-tight text-charcoal-600">
          OFF
        </span>
      </div>

      <div className="hidden sm:block">
        <p className={cn('bento-label mb-1', day.isToday && '!text-brand-600')}>
          {day.dayName.toUpperCase()} {day.date.slice(8)}
          {day.isToday ? ' (TODAY)' : ''}
        </p>
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-charcoal-500">OFF</p>
        <ClockRow day={day} />
      </div>
    </div>
  )
}

function ScheduleShiftCard({ day }: { day: ScheduleDay }) {
  const shiftClass =
    day.shiftName === 'Morning' ? 'schedule-shift-morning' : day.shiftName === 'Evening' ? 'schedule-shift-evening' : 'schedule-shift-off'
  const shiftTone =
    day.shiftName === 'Morning' ? 'bg-blue-100 text-blue-800' : day.shiftName === 'Evening' ? 'bg-green-100 text-green-800' : 'bg-charcoal-100 text-charcoal-600'
  return (
    <div className={cn('w-[22%] shrink-0 snap-start rounded-lg border border-charcoal-200 bg-white sm:w-auto sm:shrink', day.isToday && 'border-brand-200 bg-brand-50', 'sm:p-3')}>
      {/* Phone: ~4 days visible, the rest one swipe away. */}
      <div className="flex flex-col items-center gap-0.5 px-1 py-2 text-center sm:hidden">
        <p className={cn('text-[9px] font-bold uppercase leading-none text-charcoal-400', day.isToday && 'text-brand-600')}>
          {day.dayName.slice(0, 3)}
        </p>
        <p className={cn('text-sm font-bold leading-none text-charcoal-900', day.isToday && 'text-brand-700')}>{day.date.slice(8)}</p>
        <span className={cn('mt-1 w-full rounded px-0.5 py-0.5 text-[9px] font-bold leading-tight', shiftTone)}>
          {shortTime(day.start)}–{shortTime(day.end)}
        </span>
      </div>

      <div className="hidden sm:block">
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
  const { me } = usePortalSession()
  const dashboard = useQuery({ queryKey: ['portal', 'dashboard'], queryFn: ({ signal }) => getEmployeeDashboard(signal) })

  if (dashboard.isError) {
    return <ErrorState message={describeApiError(dashboard.error)} onRetry={() => dashboard.refetch()} />
  }

  if (dashboard.isLoading || !dashboard.data) {
    return <DashboardSkeleton />
  }

  const data = dashboard.data
  const today = data.todayShift
  // The dashboard body is derived from the caller's employment record, which is
  // homed in one gym and never follows the active-gym switch (a manager holding
  // a Team-Leader role elsewhere has no record there at all). When the two gym
  // contexts differ, say so explicitly — a bare "{position} · {record gym}"
  // line otherwise reads as "the gym switch didn't happen".
  const recordGymMismatch = Boolean(me?.activeGym?.gymId && data.user.gymId && me.activeGym.gymId !== data.user.gymId)
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
          {recordGymMismatch && (
            <p className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Employment record is from {data.user.gymName} — you are working in {me?.activeGym?.gymName} today
            </p>
          )}
        </div>
        <div className="hidden sm:block">
          <Button size="sm" variant="secondary" onClick={() => navigate(PAGE_PATHS.requests)}>
            New request
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          {/* Today's shift */}
          <button type="button" className="card card-interactive p-2.5 text-left sm:p-3" onClick={() => navigate(PAGE_PATHS.schedule)}>
            <p className="bento-label mb-1.5 sm:mb-2">TODAY'S SHIFT</p>
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight text-charcoal-900 sm:text-base">
                  {today ? `${time12(today.start)}–${time12(today.end)}` : '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-charcoal-500 sm:text-xs">{today ? `${today.shiftName} Shift` : 'No shift scheduled'}</p>
              </div>
              {today && (
                <span className="hidden items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 sm:flex">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  Scheduled
                </span>
              )}
            </div>
          </button>

          {/* Today's attendance */}
          <button type="button" className="card card-interactive p-2.5 text-left sm:p-3" onClick={() => navigate(PAGE_PATHS.attendance)}>
            <p className="bento-label mb-1.5 sm:mb-2">TODAY'S ATTENDANCE</p>
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight text-charcoal-900 sm:text-base">{attendance?.checkedIn ? time12(attendance.checkIn) : '—'}</p>
                <p className="mt-0.5 text-[11px] text-charcoal-500 sm:text-xs">{attendance?.checkedIn ? 'Checked In' : 'Not Checked In'}</p>
              </div>
              <span className={cn('hidden items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold sm:flex', attendanceTone)}>
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
            <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:pb-0">
              {data.upcomingSchedule.map((day) =>
                day.isOff ? <OffDayCard key={day.date} day={day} /> : <ScheduleShiftCard key={day.date} day={day} />,
              )}
            </div>
          )}
        </div>

        {/* Pending requests + latest payroll */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="card card-interactive p-2.5 text-left sm:p-3" onClick={() => navigate(PAGE_PATHS.requests)}>
            <p className="bento-label mb-1.5 flex items-center gap-1.5 sm:mb-2">
              <Users className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
              PENDING REQUESTS
            </p>
            <p className="text-xl font-bold leading-none text-charcoal-900 sm:text-2xl">{data.pendingRequestCount}</p>
            <p className="mt-1.5 text-[11px] text-charcoal-500 sm:mt-2 sm:text-xs">
              {data.pendingRequestCount === 0 ? 'All caught up!' : `${data.pendingRequestCount} awaiting review`}
            </p>
          </button>

          <button type="button" className="card card-interactive relative overflow-hidden p-2.5 text-left sm:p-3" onClick={() => navigate(PAGE_PATHS.payroll)}>
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-brand-500 opacity-[0.07] sm:h-24 sm:w-24" aria-hidden="true" />
            <p className="bento-label relative z-10 mb-1.5 flex items-center gap-1.5 sm:mb-2">
              <Wallet className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
              LATEST PAYROLL
            </p>
            <div className="relative z-10">
              <p className="text-sm font-bold leading-tight text-charcoal-900 sm:text-base">{period?.period ?? 'No payroll yet'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:mt-1.5 sm:gap-2">
                {period && <StatusBadge status={period.status} />}
                {period && <span className="text-[11px] text-charcoal-600 sm:text-xs">{formatMoney(period.netSalary)}</span>}
              </div>
            </div>
          </button>
        </div>

        {data.overview && <OverviewStrip overview={data.overview} />}
      </div>
    </div>
  )
}
