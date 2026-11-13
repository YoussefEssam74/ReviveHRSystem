import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  Clock,
  FileText,
  MinusCircle,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  UserRound,
  Wallet,
} from 'lucide-react'
import {
  getOwnPayslip,
  getOwnPayrollSheets,
  type PayrollSheet,
  type PayrollDeductionDetail,
} from '../api/payroll.api'
import { getOwnLeaveBalance, type LeaveBalanceResponse } from '../api/attendance.api'
import { EmptyState, ProgressBar } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Drawer } from '../../../components/ui/drawer'
import { StatusBadge, Badge, statusColor, type BadgeColor } from '../../../components/ui/badge'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { translate } from '../../../i18n'
import { describeApiError } from '../../../lib/api-client'
import {
  formatDate,
  formatDateWithYear,
  formatEGP,
  formatMoney,
  formatNumber,
  formatTimeOfDay,
} from '../../../lib/format'
import { cn } from '../../../lib/utils'

/** Gross of a period: base + bonuses + overtime pay + the gym's raise slice (mock §8). */
function grossPay(sheet: PayrollSheet): number {
  return sheet.baseSalary + sheet.totalBonuses + (sheet.overtimePay ?? 0) + (sheet.annualIncrease ?? 0)
}

/** Dot colour per status tone (the breakdown table's status marker). */
const STATUS_DOT_CLASS: Record<BadgeColor, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  gray: 'bg-charcoal-400',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
}

/** Dot + label status (mock §8 breakdown table) instead of the pill used in cards. */
function StatusDot({ status }: { status: string }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-charcoal-700">
      <span className={cn('h-2 w-2 rounded-full', STATUS_DOT_CLASS[statusColor(status)])} aria-hidden="true" />
      {t(status)}
    </span>
  )
}

export default function MyPayrollPage() {
  const { t } = useTranslation()
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [slipId, setSlipId] = useState<number | null>(null)

  const sheetsQuery = useQuery({
    queryKey: ['portal', 'payroll-sheets', employeeId],
    queryFn: ({ signal }) => getOwnPayrollSheets(employeeId!, signal),
    enabled: employeeId != null,
  })
  // The snapshot's right half answers "how much leave is left behind this money":
  // the same year-to-date balance the requests page draws from.
  const balanceQuery = useQuery({
    queryKey: ['portal', 'leave-balance', employeeId],
    queryFn: ({ signal }) => getOwnLeaveBalance(employeeId!, signal),
    enabled: employeeId != null,
  })

  if (employeeId == null) {
    return (
      <EmptyState
        title={t('No employee profile')}
        hint={t('This account is not linked to an employee profile, so it has no payroll history.')}
      />
    )
  }
  if (sheetsQuery.isLoading) return <LoadingState label={t('Loading payroll…')} />
  if (sheetsQuery.isError) {
    return <ErrorState message={describeApiError(sheetsQuery.error)} onRetry={() => sheetsQuery.refetch()} />
  }

  const allSheets = sheetsQuery.data ?? []

  if (allSheets.length === 0) {
    return (
      <div className="space-y-2.5">
        <h1 className="text-lg font-bold text-charcoal-900">{t('My Payroll')}</h1>
        <EmptyState
          title={t('No payroll history yet')}
          hint={t('Sheets appear here once a payroll period has been processed for your gym.')}
        />
      </div>
    )
  }

  // Closed sheets are payslip history, newest first; an open period renders as the
  // still-processing last row of the breakdown.
  const paid = [...allSheets]
    .filter((sheet) => sheet.visible)
    .sort((a, b) => (b.paidDate ?? '').localeCompare(a.paidDate ?? ''))
  const openSheet = allSheets.find((sheet) => !sheet.visible) ?? null
  const months = openSheet ? [...paid, openSheet] : paid
  const latestPaid = paid[0] ?? null
  // The snapshot follows the current (open) period — that is what "current" means —
  // and falls back to the latest closed payslip when nothing is running.
  const snapshot = openSheet ?? latestPaid

  return (
    <div className="space-y-1.5">
      {snapshot && (
        <PayrollSnapshotCard
          sheet={snapshot}
          balance={balanceQuery.data ?? null}
          balanceError={balanceQuery.isError ? describeApiError(balanceQuery.error) : null}
        />
      )}

      {/* Side by side on wide screens so the whole page lands inside one viewport. */}
      <MonthlyBreakdown
        months={months}
        expandedId={expandedId}
        onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
        onSlip={setSlipId}
      />

      <PayslipDrawer entryId={slipId} employeeId={employeeId} onClose={() => setSlipId(null)} />
    </div>
  )
}

/* ==================== Current payroll snapshot (mock §8 donut card) ==================== */

function PayrollSnapshotCard({
  sheet,
  balance,
  balanceError,
}: {
  sheet: PayrollSheet
  balance: LeaveBalanceResponse | null
  balanceError: string | null
}) {
  const { t } = useTranslation()
  const net = sheet.netSalary
  const deductions = sheet.totalDeductions
  const gross = grossPay(sheet) || net + deductions

  return (
    <section className="card p-2.5 sm:p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-base font-bold text-charcoal-900">{t('Current Payroll Snapshot')}</h2>
        <span className="text-sm text-charcoal-400">· {sheet.period}</span>
        <StatusBadge status={sheet.status} className="ms-auto" />
      </div>

      <div className="mt-2 grid gap-2.5 lg:grid-cols-2">
        {/* Left half: the money of this period */}
        <div className="flex items-center gap-3 lg:pe-4">
          <DonutChart
            net={net}
            deductions={deductions}
            netLabel={t('Net Pay')}
            netValue={formatEGP(net)}
            ariaLabel={t('Payroll split: net pay {{net}}, deductions {{deductions}}', {
              net: formatEGP(net),
              deductions: formatEGP(deductions),
            })}
          />

          <dl className="min-w-0 flex-1 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="flex min-w-0 items-center gap-1.5 text-charcoal-600">
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                <span className="truncate">{t('Net Pay')}</span>
              </dt>
              <dd className="flex-shrink-0 font-semibold text-charcoal-900">{formatEGP(net)}</dd>
            </div>
            {/* Bonus rides inside the net figure — same row rhythm as the other
                legend entries, marked by its purple dot. */}
            <div className="flex items-center justify-between gap-2">
              <dt className="flex min-w-0 items-center gap-1.5 text-charcoal-600">
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-purple-500" aria-hidden="true" />
                <span className="truncate">{t('Bonus')}</span>
              </dt>
              <dd className="flex-shrink-0 font-semibold text-charcoal-900">{formatEGP(sheet.totalBonuses)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex min-w-0 items-center gap-1.5 text-charcoal-600">
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                <span className="truncate">{t('Deductions')}</span>
              </dt>
              <dd className="flex-shrink-0 font-semibold text-red-600">{formatEGP(deductions)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-charcoal-100 pt-1.5">
              <dt className="min-w-0 leading-tight text-charcoal-600">{t('Total Payout this period')}</dt>
              <dd className="flex-shrink-0 text-sm font-bold text-charcoal-900">{formatEGP(gross)}</dd>
            </div>
          </dl>
        </div>

        {/* Right half: the annual leave standing behind this money */}
        <div className="border-t border-charcoal-100 pt-2.5 lg:flex lg:items-center lg:border-s lg:border-t-0 lg:ps-4 lg:pt-0">
          <LeaveBalanceBlock balance={balance} error={balanceError} />
        </div>
      </div>
    </section>
  )
}

/**
 * Product rule: annual leave is earned one day per completed service month, released
 * after six months and capped at this yearly allowance (mirrors
 * AnnualLeaveAccrual.MaxDaysPerYear on the server).
 */
const ANNUAL_LEAVE_ALLOWANCE = 12

/** Session-level "today" keeps the accrual countdown out of the render path. */
const ACCRUAL_TODAY = new Date()

/**
 * Hire date + six completed months → the day annual leave opens, plus the whole months
 * still to wait (rounded up so "1 month" never hides a nearly-finished month).
 * Mirrors AnnualLeaveAccrual.QualifyingMonths on the server.
 */
function annualLeaveOpensOn(hireDate: string | null | undefined): { opensOn: Date; monthsLeft: number } | null {
  if (!hireDate) return null
  const hired = new Date(hireDate)
  if (Number.isNaN(hired.getTime())) return null
  const opensOn = new Date(hired.getFullYear(), hired.getMonth() + 6, hired.getDate())
  const days = (opensOn.getTime() - ACCRUAL_TODAY.getTime()) / 86_400_000
  return { opensOn, monthsLeft: days <= 0 ? 0 : Math.max(1, Math.ceil(days / 30.44)) }
}

/**
 * Annual leave only, matching the product rule: the balance settles days as paid and
 * carries anything taken ahead of the accrual as an unpaid deficit that only costs
 * money if the employee leaves before the accrual catches up.
 */
function LeaveBalanceBlock({
  balance,
  error,
}: {
  balance: LeaveBalanceResponse | null
  error: string | null
}) {
  const { t } = useTranslation()
  const { user } = usePortalSession()

  if (error) {
    return <p className="text-[11px] text-red-600">{error}</p>
  }
  if (!balance) {
    return (
      <div className="space-y-1.5" role="status" aria-live="polite">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-5" />
        <Skeleton className="h-5" />
        <span className="sr-only">{t('Loading leave balance…')}</span>
      </div>
    )
  }

  // Annual-leave requests only. `dayOff.used` is every annual day booked; the part the
  // accrual already funds is paid, and anything above it is the unpaid deficit that the
  // following months absorb (it only costs money if the employee leaves first).
  const entitlement = balance.dayOff.total
  const paidDays = Math.min(balance.dayOff.used, entitlement)
  const unpaidDays = balance.unpaid.used
  const takenDays = paidDays + unpaidDays
  // Nothing is released before six completed months of service.
  const accruing = entitlement <= 0
  const qualifying = annualLeaveOpensOn(user?.hireDate)

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="bento-label">{t('LEAVE BALANCE')}</p>
        <p className="text-[10px] text-charcoal-400">{t('Year to date')}</p>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-charcoal-600">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
          <span className="truncate">{t('Annual leave')}</span>
        </span>
        <span className="flex-shrink-0 text-[11px] font-semibold text-charcoal-900">
          {takenDays}/{ANNUAL_LEAVE_ALLOWANCE}
        </span>
      </div>
      <ProgressBar
        value={Math.min(takenDays, ANNUAL_LEAVE_ALLOWANCE)}
        max={ANNUAL_LEAVE_ALLOWANCE}
        colorClass="bg-brand-500"
        className="mt-1 h-1"
      />
      {accruing && (
        <p className="mt-1 text-[10px] text-charcoal-400">
          {qualifying && qualifying.monthsLeft > 0
            ? t('Opens on {{date}} · {{count}} months left', {
                date: formatDateWithYear(qualifying.opensOn),
                count: qualifying.monthsLeft,
              })
            : t('After 6 months of service')}
        </p>
      )}

      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-charcoal-50 px-2 py-1.5">
          <p className="truncate text-[10px] text-charcoal-500">{t('Calculated as paid')}</p>
          <p className="text-sm font-bold leading-tight text-charcoal-900">{paidDays}</p>
        </div>
        <div className="rounded-lg bg-charcoal-50 px-2 py-1.5">
          <p className="truncate text-[10px] text-charcoal-500">{t('Unpaid days')}</p>
          <p className={cn('text-sm font-bold leading-tight', unpaidDays > 0 ? 'text-red-600' : 'text-charcoal-900')}>
            {unpaidDays}
          </p>
        </div>
      </div>

      {unpaidDays > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1 text-[10px] font-semibold text-red-600">
          <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {t('Deducted if you leave')}
        </p>
      )}
    </div>
  )
}

function DonutChart({
  net,
  deductions,
  netLabel,
  netValue,
  ariaLabel,
}: {
  net: number
  deductions: number
  netLabel: string
  netValue: string
  ariaLabel: string
}) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const total = net + deductions
  const segments = [
    { id: 'net', value: net, color: '#16a34a' },
    { id: 'deductions', value: deductions, color: '#ef4444' },
  ].filter((segment) => segment.value > 0)

  let consumed = 0

  return (
    <div className="relative mx-auto h-24 w-24 flex-shrink-0 sm:h-28 sm:w-28">
      <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label={ariaLabel}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-charcoal-100)" strokeWidth="15" />
        {segments.map((segment) => {
          const length = total > 0 ? (segment.value / total) * circumference : 0
          const dashOffset = -consumed
          consumed += length
          return (
            <circle
              key={segment.id}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="15"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 60 60)"
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-charcoal-400">{netLabel}</p>
        <p className="mt-0.5 text-sm font-bold leading-tight text-charcoal-900">{netValue}</p>
      </div>
    </div>
  )
}

/* ==================== Monthly breakdown (mock §8 table) ==================== */

function MonthlyBreakdown({
  months,
  expandedId,
  onToggle,
  onSlip,
}: {
  months: PayrollSheet[]
  expandedId: number | null
  onToggle: (id: number) => void
  onSlip: (id: number) => void
}) {
  const { t } = useTranslation()
  const paidLabel = (sheet: PayrollSheet) =>
    sheet.paidDate ? t('Paid {{date}}', { date: formatDate(sheet.paidDate) }) : t('Not paid yet')

  const detailActions = (sheet: PayrollSheet, open: boolean) => (
    <>
      <button
        type="button"
        onClick={() => onToggle(sheet.id)}
        aria-expanded={open}
        className="text-[11px] font-semibold text-brand-600 hover:underline"
      >
        {open ? t('Hide details') : t('View Details')}
      </button>
      <span className="text-charcoal-200" aria-hidden="true">
        |
      </span>
      <button
        type="button"
        onClick={() => onSlip(sheet.id)}
        aria-label={t('Open payslip for {{period}}', { period: sheet.period })}
        className="touch-target rounded-lg p-1 text-charcoal-400 transition-colors hover:bg-charcoal-100 hover:text-charcoal-700"
      >
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </>
  )

  return (
    <section className="card overflow-hidden">
      <div className="px-3 pb-2 pt-2.5">
        <h2 className="text-base font-bold text-charcoal-900">{t('Monthly Breakdown')}</h2>
      </div>

      {/* Desktop: the mock's table */}
      <div className="hidden border-t border-charcoal-100 lg:block">
        <table className="w-full [&_td]:py-1.5 [&_th]:py-1.5">
          <thead>
            <tr className="bg-charcoal-50 text-[10px] uppercase tracking-wider text-charcoal-500">
              <th scope="col" className="px-3 py-2 text-start font-semibold">{t('Month & Year')}</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">{t('Status')}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">{t('Net Pay (EGP)')}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">{t('Gross Pay (EGP)')}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">{t('Deductions (EGP)')}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">{t('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((sheet) => {
              const open = expandedId === sheet.id
              return (
                <Fragment key={sheet.id}>
                  <tr className={cn('border-t border-charcoal-100', !sheet.visible && 'bg-amber-50/40')}>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-semibold text-charcoal-900">{sheet.period}</p>
                      <p className="mt-0.5 text-[11px] text-charcoal-400">{paidLabel(sheet)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusDot status={sheet.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-end text-sm font-bold text-charcoal-900">
                      {sheet.visible ? formatNumber(sheet.netSalary) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-end text-sm text-charcoal-700">
                      {sheet.visible ? formatNumber(grossPay(sheet)) : '—'}
                    </td>
                    <td
                      className={cn(
                        'whitespace-nowrap px-3 py-2.5 text-end text-sm',
                        sheet.visible && sheet.totalDeductions > 0 ? 'text-red-600' : 'text-charcoal-500',
                      )}
                    >
                      {sheet.visible ? formatNumber(sheet.totalDeductions) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {sheet.visible ? (
                          detailActions(sheet, open)
                        ) : (
                          <span className="text-[11px] text-charcoal-400">{t('N/A')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open && sheet.visible && (
                    <tr className="border-t border-charcoal-100 bg-charcoal-50/50">
                      <td colSpan={6} className="px-3 py-3">
                        <SheetDetail sheet={sheet} onSlip={() => onSlip(sheet.id)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Below lg: the table restacks into cards (mobile standard). */}
      <div className="space-y-2 border-t border-charcoal-100 p-2.5 lg:hidden">
        {months.map((sheet) => {
          const open = expandedId === sheet.id
          return (
            <div
              key={sheet.id}
              className={cn('overflow-hidden rounded-xl border border-charcoal-200', !sheet.visible && 'bg-amber-50/40')}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-charcoal-900">{sheet.period}</p>
                  <p className="mt-0.5 text-[11px] text-charcoal-400">{paidLabel(sheet)}</p>
                </div>
                <StatusDot status={sheet.status} />
              </div>
              <div className="grid grid-cols-3 gap-1.5 px-3 pb-2.5">
                <StatTile label={t('Net Pay')} value={sheet.visible ? formatNumber(sheet.netSalary) : '—'} />
                <StatTile label={t('Gross Pay')} value={sheet.visible ? formatNumber(grossPay(sheet)) : '—'} />
                <StatTile
                  label={t('Deductions')}
                  value={sheet.visible ? formatNumber(sheet.totalDeductions) : '—'}
                  bg={sheet.visible && sheet.totalDeductions > 0 ? 'bg-red-50' : undefined}
                  text={sheet.visible && sheet.totalDeductions > 0 ? 'text-red-600' : undefined}
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-charcoal-100 px-3 py-1.5">
                {sheet.visible ? (
                  detailActions(sheet, open)
                ) : (
                  <span className="text-[11px] text-charcoal-400">{t('N/A')}</span>
                )}
              </div>
              {open && sheet.visible && (
                <div className="border-t border-charcoal-100 bg-charcoal-50/60 p-2.5">
                  <SheetDetail sheet={sheet} onSlip={() => onSlip(sheet.id)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ==================== Expanded month detail (attendance, earnings, deductions) ==================== */

function SheetDetail({ sheet, onSlip }: { sheet: PayrollSheet; onSlip: () => void }) {
  const { t } = useTranslation()
  const earnings = buildEarningsRows(sheet)
  const earningsTotal = earnings.reduce((sum, row) => sum + row.amount, 0)
  const deductionRows = buildDeductionRows(sheet)
  const workedPct = sheet.workingDays
    ? Math.round(((sheet.daysWorked ?? 0) / (sheet.workingDays ?? 1)) * 100)
    : 0
  const notWorked = Math.max(0, (sheet.workingDays ?? 0) - (sheet.daysWorked ?? 0))

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-charcoal-100 bg-white p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="bento-label text-charcoal-500">{t('ATTENDANCE & LEAVE')}</p>
          <span className="rounded-full bg-charcoal-100 px-2 py-0.5 text-[10px] font-bold text-charcoal-700">
            {t('{{worked}}/{{total}} days', { worked: sheet.daysWorked ?? 0, total: sheet.workingDays ?? 0 })}
          </span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-charcoal-100">
          <div className="h-full rounded-s-full bg-brand-500" style={{ width: `${workedPct}%` }} />
          {notWorked > 0 && <div className="h-full flex-1 rounded-e-full bg-charcoal-200" />}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-[10px] text-charcoal-500">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
            {t('{{count}} worked', { count: sheet.daysWorked ?? 0 })}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-charcoal-400">
            <span className="inline-block h-2 w-2 rounded-full bg-charcoal-200" />
            {t('{{count}} not worked', { count: notWorked })}
          </span>
          {(sheet.overtimeHours ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-charcoal-500">
              <Clock className="h-3 w-3 text-charcoal-400" aria-hidden="true" />
              {t('{{count}}h overtime', { count: sheet.overtimeHours ?? 0 })}
            </span>
          )}
          {(sheet.paidLeaveDays ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-charcoal-500">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-300" />
              {t('{{count}} paid leave', { count: sheet.paidLeaveDays ?? 0 })}
            </span>
          )}
          {(sheet.unpaidLeaveDays ?? 0) > 0 && (
            <span className="text-[10px] text-red-600">{t('{{count}} unpaid', { count: sheet.unpaidLeaveDays ?? 0 })}</span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          <StatTile label={t('Late')} value={String(sheet.lateCount ?? 0)} bg="bg-amber-50" text="text-amber-600" />
          <StatTile label={t('Early Leave')} value={String(sheet.earlyLeaveCount ?? 0)} />
          <StatTile label={t('Sick Leave')} value={String(sheet.sickLeaveDays ?? 0)} bg="bg-blue-50" text="text-blue-600" />
          <StatTile label={t('Annual Leave')} value={String(sheet.annualLeaveDays ?? 0)} bg="bg-blue-50" text="text-blue-600" />
          <StatTile label={t('Absent')} value={String(sheet.absentDays ?? 0)} bg="bg-red-50" text="text-red-600" />
          <StatTile
            label={t('Salary Advance')}
            value={(sheet.salaryAdvance ?? 0) > 0 ? formatMoney(sheet.salaryAdvance ?? 0) : '—'}
            bg={(sheet.salaryAdvance ?? 0) > 0 ? 'bg-red-50' : undefined}
            text={(sheet.salaryAdvance ?? 0) > 0 ? 'text-red-600' : undefined}
          />
        </div>
        {(sheet.leaveDeduction ?? 0) > 0 && (
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-charcoal-500">{t('Leave deduction')}</span>
            <span className="font-semibold text-red-600">−{formatMoney(sheet.leaveDeduction ?? 0)}</span>
          </div>
        )}
      </div>

      <ItemSection
        tone="earnings"
        title={t('Earnings')}
        headerValue={`+${formatMoney(earningsTotal)}`}
        rows={earnings}
      />
      <ItemSection
        tone="deductions"
        title={t('Deductions')}
        headerValue={`−${formatMoney(sheet.totalDeductions)}`}
        rows={deductionRows}
        emptyHint={t('No deductions this period.')}
      />

      {/* Dark net bar with the payslip action (mock) */}
      <div className="flex items-center justify-between gap-2 rounded-xl bg-charcoal-900 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-400">{t('Net Salary')}</p>
          <p className="whitespace-nowrap text-lg font-bold leading-tight text-white">{formatMoney(sheet.netSalary)}</p>
        </div>
        <button
          type="button"
          onClick={onSlip}
          className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-white/20"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Payslip
        </button>
      </div>
    </div>
  )
}

/* ==================== Detail pieces (mock §8 earnings/deduction lists) ==================== */

function ItemSection({
  tone,
  title,
  headerValue,
  rows,
  emptyHint,
}: {
  tone: 'earnings' | 'deductions'
  title: string
  headerValue: string
  rows: DeductionDisplayRow[]
  emptyHint?: string
}) {
  const isEarnings = tone === 'earnings'
  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-100 bg-white">
      <div
        className={cn(
          'flex items-center justify-between border-b px-3 py-2',
          isEarnings ? 'border-green-100 bg-green-50/60' : 'border-red-100 bg-red-50/60',
        )}
      >
        <div className="flex items-center gap-1.5">
          {isEarnings ? (
            <TrendingUp className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
          )}
          <p className={cn('text-[10px] font-bold uppercase tracking-wider', isEarnings ? 'text-green-700' : 'text-red-600')}>
            {title}
          </p>
        </div>
        <p className={cn('text-xs font-bold', isEarnings ? 'text-green-700' : 'text-red-600')}>{headerValue}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-charcoal-500">{emptyHint}</p>
      ) : (
        <div className="divide-y divide-charcoal-50">
          {rows.map((row, index) => (
            <SectionRow key={index} row={row} isEarnings={isEarnings} />
          ))}
        </div>
      )}
    </div>
  )
}

/** One earning/deduction line: icon, label + subline, review badge, signed amount. */
function SectionRow({ row, isEarnings }: { row: DeductionDisplayRow; isEarnings: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      {payItemIcon(row.label, isEarnings)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-charcoal-800">{row.label}</p>
        {row.reason && (
          <p className="whitespace-pre-line text-[10px] leading-tight text-charcoal-400">{row.reason}</p>
        )}
      </div>
      {row.status && (
        <span className="flex-shrink-0">
          <Badge color={DEDUCTION_STATUS_COLORS[row.status] ?? 'gray'}>{row.status}</Badge>
        </span>
      )}
      <span className={cn('whitespace-nowrap text-xs font-bold', isEarnings ? 'text-green-700' : 'text-red-600')}>
        {row.amount == null ? (
          <span className="font-medium text-charcoal-400">—</span>
        ) : isEarnings ? (
          `+${formatMoney(row.amount)}`
        ) : (
          `−${formatMoney(row.amount)}`
        )}
      </span>
    </div>
  )
}

function StatTile({ label, value, bg, text }: { label: string; value: string; bg?: string; text?: string }) {
  return (
    <div className={cn('rounded-lg bg-charcoal-50 px-1.5 py-1.5 text-center', bg)}>
      <p className={cn('text-base font-bold leading-none', text ?? 'text-charcoal-700')}>{value}</p>
      <p className="mt-1 truncate text-[9px] leading-tight text-charcoal-500">{label}</p>
    </div>
  )
}

type EarningRow = { label: string; amount: number; reason?: string | null }

type DeductionDisplayRow = {
  label: string
  amount: number | null
  reason?: string | null
  status?: string | null
}

/**
 * The mock §8 earnings list: Basic Salary, the raise slice, overtime pay and bonus
 * first, then any other earning line the sheet carries. The seeded "Overtime Pay" /
 * "* Bonus" lines are folded into the canonical rows so nothing shows twice.
 */
function buildEarningsRows(sheet: PayrollSheet): EarningRow[] {
  const rows: EarningRow[] = [{ label: translate('Basic Salary'), amount: sheet.baseSalary }]
  if ((sheet.annualIncrease ?? 0) > 0) {
    rows.push({
      label: translate('Annual Increase ({{percent}})', { percent: increasePercentLabel(sheet) }),
      amount: sheet.annualIncrease ?? 0,
    })
  }
  if ((sheet.overtimeHours ?? 0) > 0) {
    rows.push({ label: translate('Overtime Pay ({{hours}} hrs)', { hours: sheet.overtimeHours }), amount: sheet.overtimePay ?? 0 })
  }
  if ((sheet.totalBonuses ?? 0) > 0) {
    rows.push({ label: translate('Bonus'), amount: sheet.totalBonuses })
  }
  const overtimeShown = (sheet.overtimeHours ?? 0) > 0
  const bonusShown = (sheet.totalBonuses ?? 0) > 0
  rows.push(
    ...sheet.items
      .filter((item) => item.kind === 'earning')
      .filter((item) => !(overtimeShown && item.label.toLowerCase().includes('overtime')))
      .filter((item) => !(bonusShown && item.label.toLowerCase().includes('bonus')))
      .map((item) => ({ label: item.label, amount: item.amount, reason: item.reason })),
  )
  return rows
}

/**
 * One Deductions section (mock §8): every payroll line that deducts money, with the
 * per-day trail (shift, minutes late, check-in, pricing note, review status) merged
 * into its own day row via the attendance link. A closed sheet has every day applied,
 * so the section is one flat list — days whose row has no backing line (a rejected
 * day, a purely informational row) keep their place at the end.
 */
function buildDeductionRows(sheet: PayrollSheet): DeductionDisplayRow[] {
  const details = sheet.deductionDetails ?? []
  const taken = new Set<number>()

  const matchDetail = (line: (typeof sheet.items)[number]): number => {
    if (line.attendanceRecordId != null) {
      return details.findIndex((d, i) => !taken.has(i) && d.attendanceRecordId === line.attendanceRecordId)
    }
    // Record-less lines (manual BM raises) pair with a record-less day of the same date.
    return details.findIndex(
      (d, i) => !taken.has(i) && d.attendanceRecordId == null && d.date === line.effectiveDate,
    )
  }

  const rows: DeductionDisplayRow[] = sheet.items
    .filter((item) => item.kind === 'deduction')
    .map((item) => {
      const index = matchDetail(item)
      const detail = index >= 0 ? details[index] : undefined
      if (index >= 0) taken.add(index)
      return {
        label: detail ? `${detail.label} — ${formatDate(detail.date, { withYear: 'never' })}` : item.label,
        amount: Math.abs(item.amount),
        reason: detail
          ? detailSubline(detail) || null
          : item.reason === item.label
            ? null
            : item.reason,
        status:
          item.status === 'Pending'
            ? 'In review'
            : item.status === 'Rejected'
              ? 'Rejected'
              : (detail?.status ?? null),
      } satisfies DeductionDisplayRow
    })

  rows.push(
    ...details.flatMap((detail, index) =>
      taken.has(index)
        ? []
        : [
            {
              label: `${detail.label} — ${formatDate(detail.date, { withYear: 'never' })}`,
              amount: detail.amount,
              reason: detailSubline(detail) || null,
              status: detail.status,
            } satisfies DeductionDisplayRow,
          ],
    ),
  )

  return rows
}

/** Mock §8's per-line item glyph, keyed off the label. */
function payItemIcon(label: string, earning: boolean): React.ReactNode {
  const lower = label.toLowerCase()
  if (lower.includes('annual increase')) {
    return <TrendingUp className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
  }
  if (lower.includes('overtime')) {
    return <Clock className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
  }
  if (lower.includes('bonus')) {
    return <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
  }
  if (lower.includes('advance')) {
    return <PiggyBank className="h-3.5 w-3.5 text-orange-400" aria-hidden="true" />
  }
  if (lower.includes('insurance') || lower.includes('medical')) {
    return <ShieldCheck className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
  }
  if (lower.includes('tax')) {
    return <Receipt className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
  }
  if (lower.includes('basic salary')) {
    return <Banknote className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
  }
  return earning ? (
    <Wallet className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
  ) : (
    <MinusCircle className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
  )
}

type RaiseInfo = { baseSalary: number; annualIncrease?: number; annualIncreasePercent?: number | null }

/** The mock's "Annual Increase (10%)" label — the gym policy percent, derived from the slice as fallback. */
function increasePercentLabel(sheet: RaiseInfo): string {
  const pct =
    sheet.annualIncreasePercent ??
    (sheet.baseSalary > 0 ? ((sheet.annualIncrease ?? 0) / sheet.baseSalary) * 100 : 0)
  return `${pct % 1 === 0 ? pct : pct.toFixed(1)}%`
}

/** Badge color per attached-deduction status (mirrors the attendance page's vocabulary). */
const DEDUCTION_STATUS_COLORS: Record<string, BadgeColor> = {
  'In review': 'yellow',
  'Branch approved': 'yellow',
  Applied: 'red',
  Rejected: 'green',
  Resolved: 'green',
}

/**
 * Mock-style per-day facts under a deduction. Only the day's own facts show: the shift
 * window, and — for a late day — how long the check-in was past shift start. Pricing
 * notes, issuer handles and generic absence copy are deliberately left off.
 */
function detailSubline(row: PayrollDeductionDetail): string {
  const pieces: string[] = []
  if (row.shift) {
    pieces.push(row.shift)
  }
  if (row.kind === 'late' && row.minutesLate != null && row.minutesLate > 0) {
    pieces.push(`${formatLateSpan(row.minutesLate)} late${row.checkInAt ? ` (${formatTimeOfDay(row.checkInAt)} check-in)` : ''}`)
  } else if (row.checkInAt) {
    pieces.push(`${formatTimeOfDay(row.checkInAt)} check-in`)
  }
  return pieces.join('\n')
}

/** "1 h 5 min" / "45 min" — the mock's spoken lateness. */
function formatLateSpan(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/* ==================== Payslip drawer (mock §8 modal) ==================== */

function PayslipDrawer({ entryId, employeeId, onClose }: { entryId: number | null; employeeId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['portal', 'payslip', employeeId, entryId],
    queryFn: ({ signal }) => getOwnPayslip(employeeId, entryId!, signal),
    enabled: entryId != null,
    retry: false,
  })
  const slip = query.data?.data ?? null

  return (
    <Drawer open={entryId != null} title={slip ? t('Payslip — {{period}}', { period: slip.period }) : t('Payslip')} onClose={onClose}>
      {query.isLoading && <LoadingState label={t('Loading payslip…')} />}
      {query.isError && <ErrorState message={describeApiError(query.error)} onRetry={() => query.refetch()} />}
      {slip && (
        <div className="space-y-3">
          {/* Dark gradient header (mock) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal-800 to-charcoal-900 p-5 text-white">
            <div className="absolute end-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5" aria-hidden="true" />
            <div className="absolute bottom-0 start-0 h-20 w-20 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/5" aria-hidden="true" />
            <div className="relative text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-300">{t('Payslip')}</p>
              <p className="mt-1 text-lg font-bold">{slip.period}</p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5">
                <BadgeCheck className="h-3.5 w-3.5 text-green-400" aria-hidden="true" />
                <span className="text-[10px] font-semibold text-green-300">{slip.status}</span>
              </div>
            </div>
          </div>

          {/* Employee info */}
          <div className="flex items-center gap-3 rounded-xl border border-charcoal-100 bg-white p-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100">
              <UserRound className="h-5 w-5 text-brand-600" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-charcoal-900">{slip.employee.name}</p>
              <p className="text-[10px] text-charcoal-500">
                {slip.employee.employeeId} · {slip.employee.position}
              </p>
              <p className="text-[10px] text-charcoal-400">Revive Gym — {slip.gym}</p>
            </div>
          </div>

          <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200 p-0.5">
            <SlipRow label={t('Base Salary')} value={formatMoney(slip.baseSalary)} />
            {(slip.annualIncrease ?? 0) > 0 && (
              <SlipRow
                label={t('Annual Increase ({{percent}})', { percent: increasePercentLabel(slip) })}
                value={`+${formatMoney(slip.annualIncrease ?? 0)}`}
                color="text-green-600"
              />
            )}
            <SlipRow label={t('Overtime ({{hours}}h)', { hours: slip.overtime })} value={formatMoney(slip.overtimePay)} color="text-blue-600" />
            <SlipRow label={t('Bonus')} value={formatMoney(slip.bonus)} color="text-green-600" />
            <SlipRow label={t('Gross')} value={formatMoney(slip.gross)} emphasis />
          </div>

          <div>
            <p className="bento-label mb-1">{t('DEDUCTIONS')}</p>
            {slip.deductions.length === 0 ? (
              <p className="rounded-lg bg-charcoal-50 p-2.5 text-xs text-charcoal-500">{t('No deductions this period.')}</p>
            ) : (
              <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200 p-0.5">
                {slip.deductions.map((deduction, index) => (
                  <div key={index} className="p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-charcoal-800">
                        {deduction.label}
                        <span className="ms-1.5 text-[9px] font-medium uppercase text-charcoal-400">{deduction.source}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={deduction.status} />
                        <span className="flex items-center gap-0.5 text-xs font-bold text-red-600">
                          <MinusCircle className="h-3 w-3" aria-hidden="true" />
                          {formatMoney(deduction.amount)}
                        </span>
                      </div>
                    </div>
                    {deduction.reason && <p className="mt-0.5 text-[10px] text-charcoal-500">{deduction.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
            <p className="text-sm font-bold text-brand-700">{t('Net Pay')}</p>
            <p className="text-base font-bold text-brand-700">{formatMoney(slip.net)}</p>
          </div>
        </div>
      )}
    </Drawer>
  )
}

function SlipRow({ label, value, color, emphasis }: { label: string; value: string; color?: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between p-2.5">
      <span className="text-[10px] text-charcoal-500">{label}</span>
      <span className={cn(emphasis ? 'text-sm font-bold text-charcoal-900' : 'text-xs font-semibold', color ?? (emphasis ? undefined : 'text-charcoal-800'))}>
        {value}
      </span>
    </div>
  )
}
