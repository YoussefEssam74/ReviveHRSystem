import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../../components/ui/badge'
import { Skeleton } from '../../../components/ui/skeleton'
import {
  useEmployee,
  useEmployeeAttendance,
  useEmployeeHistory,
  useEmployeeLeaveBalance,
  useEmployeePayroll,
  useEmployeeRequests,
} from '../../employees/hooks/useEmployees'
import { formatDate, formatDateWithYear, formatMoney, formatNumber, initialsOf } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { Separation } from '../api/terminations.api'
import { Block, GymPill } from './separation-ui'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Shared loading/denied body for one section of the tab. */
function SectionBody({
  isLoading,
  isError,
  empty,
  children,
}: {
  isLoading: boolean
  isError: boolean
  empty?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  if (isLoading) {
    return (
      <div className="mt-2 space-y-1.5">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    )
  }
  if (isError) {
    return <p className="mt-1.5 text-[11px] text-charcoal-400">{t('Not available for this account.')}</p>
  }
  if (empty) {
    return <p className="mt-1.5 text-[11px] text-charcoal-400">{t('Nothing recorded yet.')}</p>
  }
  return <>{children}</>
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-charcoal-50 py-1.5 text-center">
      <p className="text-[10px] uppercase text-charcoal-400">{label}</p>
      <p className={cn('text-xs font-bold text-charcoal-900', tone)}>{value}</p>
    </div>
  )
}

/**
 * "Employee Data" tab of the leaving case (mock _sepEmployeeDataHTML): the
 * profile, payroll, requests, history, attendance and leave settlement of the
 * person leaving — all read from the employee file, never edited here.
 */
export function SeparationEmployeeData({ separation }: { separation: Separation }) {
  const { t } = useTranslation()
  const employeeId = separation.employeeId
  const month = currentMonth()

  const profile = useEmployee(employeeId)
  const payroll = useEmployeePayroll(employeeId)
  const requests = useEmployeeRequests(employeeId)
  const history = useEmployeeHistory(employeeId)
  const attendance = useEmployeeAttendance(employeeId, month)
  const leave = useEmployeeLeaveBalance(employeeId)

  const employee = profile.data
  const name = employee?.name ?? separation.employee
  const firstName = name.split(' ')[0]
  const latestPayroll = payroll.data?.items?.[0]
  const requestRows = requests.data ?? []
  const historyRows = history.data ?? []
  const totals = attendance.data?.totals
  const annual = leave.data?.dayOff
  const leaveTaken = annual?.used ?? separation.leaveTaken
  const leaveBalance = annual ? annual.total - annual.used : null

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-charcoal-50 p-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11px] font-bold text-red-700 ring-1 ring-red-100"
          aria-hidden="true"
        >
          {employee?.initials ?? initialsOf(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-charcoal-900">
            {name}{' '}
            {employee?.employeeNumber && (
              <span className="text-[10px] font-normal text-charcoal-400">{employee.employeeNumber}</span>
            )}
          </p>
          <p className="truncate text-[11px] text-charcoal-500">
            {employee?.position ?? separation.position} · {t('hired {{date}}', { date: formatDateWithYear(employee?.hireDate) })} ·{' '}
            {t('base')} <b className="text-charcoal-700">{formatMoney(employee?.salary)}</b>
          </p>
        </div>
        <GymPill gym={employee?.gym ?? separation.gym} />
        <StatusBadge status={employee?.status ?? separation.status} />
      </div>

      <Block
        title={
          latestPayroll
            ? t('Payroll · {{period}} · {{status}}', {
                period: latestPayroll.period ?? '—',
                status: latestPayroll.status,
              })
            : t('Payroll')
        }
        action={<span className="text-[10px] text-brand-700">{t('read-only')}</span>}
      >
        <SectionBody isLoading={payroll.isLoading} isError={payroll.isError} empty={!latestPayroll}>
          {latestPayroll && (
            <div className="mt-1 grid grid-cols-3 gap-2 text-center">
              <MiniStat label={t('Gross')} value={formatMoney(latestPayroll.gross)} />
              <MiniStat label={t('Deductions')} value={formatMoney(latestPayroll.deductions)} tone="text-red-600" />
              <MiniStat label={t('Net')} value={formatMoney(latestPayroll.net)} tone="text-brand-700" />
            </div>
          )}
        </SectionBody>
      </Block>

      <Block
        title={t('Requests — everything for {{name}}', { name: firstName })}
        action={<span className="text-[10px] text-charcoal-400">{t('{{count}} total', { count: requestRows.length })}</span>}
      >
        <SectionBody isLoading={requests.isLoading} isError={requests.isError} empty={requestRows.length === 0}>
          {requestRows.slice(0, 3).map((request) => (
            <div
              key={request.id}
              className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-charcoal-50 px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-charcoal-800">{request.type}</p>
                <p className="truncate text-[10px] text-charcoal-500">{formatDate(request.requestedDate)}</p>
              </div>
              <StatusBadge status={request.status} />
            </div>
          ))}
        </SectionBody>
      </Block>

      <Block title={t('Employment history')}>
        <SectionBody isLoading={history.isLoading} isError={history.isError} empty={historyRows.length === 0}>
          {historyRows.slice(0, 3).map((entry, index) => (
            <div
              key={`${entry.type}-${entry.date}-${index}`}
              className="mt-1 flex items-start gap-2.5 rounded-lg bg-charcoal-50 p-2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-semibold text-brand-700">
                {entry.type.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-charcoal-900">{entry.type}</p>
                <p className="text-[10px] text-charcoal-500">{formatDateWithYear(entry.date)}</p>
                {entry.detail && <p className="text-[10px] text-charcoal-600">{entry.detail}</p>}
              </div>
            </div>
          ))}
        </SectionBody>
      </Block>

      <Block title={t('Attendance — current month')}>
        <SectionBody isLoading={attendance.isLoading} isError={attendance.isError} empty={!totals}>
          {totals && (
            <div className="mt-1 grid grid-cols-3 gap-2">
              <MiniStat label={t('Present')} value={String(totals.present)} tone="text-green-600" />
              <MiniStat label={t('Late')} value={String(totals.late)} tone="text-amber-600" />
              <MiniStat label={t('Absent')} value={String(totals.absent)} tone="text-red-600" />
            </div>
          )}
        </SectionBody>
        <p className="mt-1.5 text-[10px] text-charcoal-400">
          {t('Leave days over the annual accrual convert to absent at exit.')}
        </p>
      </Block>

      <Block title={t('Annual leave — settlement at exit')}>
        <p className="mt-1 text-[11px] text-charcoal-600">
          {t('Annual leave accrues monthly. At exit the days taken are settled against the accrual:')}
        </p>
        <SectionBody isLoading={leave.isLoading} isError={leave.isError} empty={!annual && leaveTaken == null}>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <MiniStat label={t('Accrued')} value={annual ? `${formatNumber(annual.total)} d` : '—'} />
            <MiniStat
              label={t('Taken')}
              value={leaveTaken != null ? `${formatNumber(leaveTaken)} d` : '—'}
            />
            <MiniStat
              label={t('Balance')}
              value={leaveBalance != null ? `${leaveBalance >= 0 ? '+' : ''}${formatNumber(leaveBalance)} d` : '—'}
              tone={leaveBalance != null && leaveBalance < 0 ? 'text-red-600' : 'text-brand-700'}
            />
          </div>
        </SectionBody>
        <p className="mt-1.5 text-[10px] text-charcoal-400">
          {t('Days taken beyond the accrual are counted as absent, not annual leave.')}
        </p>
      </Block>

      <p className="text-center text-[10px] text-charcoal-400">
        {t('Payroll edits happen in the Payroll module — everything here is read-only.')}
      </p>
    </div>
  )
}
