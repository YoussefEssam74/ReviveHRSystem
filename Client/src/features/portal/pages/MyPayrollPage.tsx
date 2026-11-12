import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  Banknote,
  ChevronDown,
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
import { getOwnLeaveBalance, type LeaveBalanceResponse } from '../api/attendance.api'
import {
  getOwnPayslip,
  getOwnPayrollSheets,
  type PayrollSheet,
  type PayrollDeductionDetail,
} from '../api/payroll.api'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Drawer } from '../../../components/ui/drawer'
import { StatusBadge, Badge, type BadgeColor } from '../../../components/ui/badge'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { translate } from '../../../i18n'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney, formatTimeOfDay } from '../../../lib/format'
import { cn } from '../../../lib/utils'

export default function MyPayrollPage() {
  const { t } = useTranslation()
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null

  const [summaryOpen, setSummaryOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [slipId, setSlipId] = useState<number | null>(null)

  const sheetsQuery = useQuery({
    queryKey: ['portal', 'payroll-sheets', employeeId],
    queryFn: ({ signal }) => getOwnPayrollSheets(employeeId!, signal),
    enabled: employeeId != null,
  })
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

  // Open periods (visible=false) render as the "Current Period" card and as the
  // still-open last row of the Monthly Breakdown; closed sheets are payslip history.
  const allSheets = sheetsQuery.data ?? []
  const paid = [...allSheets]
    .filter((sheet) => sheet.visible)
    .sort((a, b) => (b.paidDate ?? '').localeCompare(a.paidDate ?? ''))
  const openSheet = allSheets.find((sheet) => !sheet.visible) ?? null
  const months = openSheet ? [...paid, openSheet] : paid
  const ref = paid[0] ?? null

  const totalNet = paid.reduce((sum, sheet) => sum + sheet.netSalary, 0)
  const totalDed = paid.reduce((sum, sheet) => sum + sheet.totalDeductions, 0)
  // Mock §8 gross: base + bonus + OT pay + the gym's raise slice, closed months only.
  const totalGross = paid.reduce(
    (sum, sheet) =>
      sum + sheet.baseSalary + sheet.totalBonuses + (sheet.overtimePay ?? 0) + (sheet.annualIncrease ?? 0),
    0,
  )
  const avgNet = paid.length ? Math.round(totalNet / paid.length) : 0
  const maxNet = Math.max(...paid.map((sheet) => sheet.netSalary), 1)

  const balance = balanceQuery.data ?? null

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

  return (
    <div className="space-y-2.5">
      <div>
        <h1 className="text-lg font-bold text-charcoal-900">
          {t('My Payroll')}{' '}
          <span className="text-[11px] font-normal text-charcoal-400">
            · {t('{{count}} payslips', { count: paid.length })} · {openSheet ? 1 : 0} {t('open')}
          </span>
        </h1>
      </div>

      {/* One summary row — click to drop open everything underneath it (mock §8) */}
      <SummaryPanel
        open={summaryOpen}
        onToggle={() => setSummaryOpen((current) => !current)}
        summaryLabel={t('EGP {{amount}} net', { amount: totalNet.toLocaleString() })}
        note={`${t('{{count}} payslips', { count: paid.length })} · ${openSheet ? 1 : 0} ${t('open')}`}
      >
        <SummaryBody
          paid={paid}
          latest={ref}
          balance={balance}
          balanceQueryError={balanceQuery.isError ? describeApiError(balanceQuery.error) : null}
          totalGross={totalGross}
          totalDed={totalDed}
          totalNet={totalNet}
          avgNet={avgNet}
        />
      </SummaryPanel>

      {/* Current period — sits under the summary panel, above the breakdown (mock). */}
      {openSheet && <CurrentPeriodCard sheet={openSheet} />}

      {/* Monthly Breakdown — one collapsible card per month, newest first. */}
      <div>
        <h2 className="mb-2 text-base font-bold text-charcoal-900">{t('Monthly Breakdown')}</h2>
        <div className="space-y-2.5">
          {months.map((sheet) => (
            <SheetCard
              key={sheet.id}
              sheet={sheet}
              maxNet={maxNet}
              open={expandedId === sheet.id}
              onToggle={() => setExpandedId((current) => (current === sheet.id ? null : sheet.id))}
              onSlip={() => setSlipId(sheet.id)}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-charcoal-400">{t('Tap a month to drop open its full breakdown.')}</p>
      </div>

      <PayslipDrawer entryId={slipId} employeeId={employeeId} onClose={() => setSlipId(null)} />
    </div>
  )
}

/* ==================== Summary panel (mock: single PAYROLL SUMMARY accordion) ==================== */

function SummaryPanel({
  open,
  onToggle,
  summaryLabel,
  note,
  children,
}: {
  open: boolean
  onToggle: () => void
  summaryLabel: string
  note: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-3 py-2.5 text-start transition-colors hover:bg-charcoal-50/60"
      >
        <div className="flex items-center gap-2">
          <p className="bento-label min-w-0 flex-1 truncate text-charcoal-500">{t('PAYROLL SUMMARY')}</p>
          <span className="hidden min-w-0 truncate text-[11px] text-charcoal-400 sm:block">{note}</span>
          <span className="whitespace-nowrap text-sm font-bold text-charcoal-900">{summaryLabel}</span>
          <ChevronDown
            className={cn('h-4 w-4 flex-shrink-0 text-charcoal-400 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </div>
      </button>
      {open && <div className="border-t border-charcoal-100 bg-charcoal-50/40 p-2">{children}</div>}
    </div>
  )
}

function SummaryBody({
  paid,
  latest,
  balance,
  balanceQueryError,
  totalGross,
  totalDed,
  totalNet,
  avgNet,
}: {
  paid: PayrollSheet[]
  latest: PayrollSheet | null
  balance: LeaveBalanceResponse | null
  balanceQueryError: string | null
  totalGross: number
  totalDed: number
  totalNet: number
  avgNet: number
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      {paid.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="bento-label text-charcoal-400">{t('YEAR TO DATE')}</p>
            <span className="text-[10px] font-semibold text-charcoal-400">{t('{{count}} months paid', { count: paid.length })}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
            <YtdCard icon={<Wallet className="h-4 w-4 text-brand-500" aria-hidden="true" />} tint="bg-brand-50" label={t('Earned')} value={totalGross} color="text-brand-700" />
            <YtdCard icon={<TrendingDown className="h-4 w-4 text-red-400" aria-hidden="true" />} tint="bg-red-50" label={t('Deductions')} value={totalDed} color="text-red-600" />
            <YtdCard icon={<PiggyBank className="h-4 w-4 text-green-500" aria-hidden="true" />} tint="bg-green-50" label={t('Net Pay')} value={totalNet} color="text-green-700" />
            <YtdCard icon={<TrendingUp className="h-4 w-4 text-purple-500" aria-hidden="true" />} tint="bg-purple-50" label={t('Avg / Month')} value={avgNet} color="text-purple-700" />
          </div>
        </div>
      )}

      {latest && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="bento-label text-charcoal-400">{t('SALARY & SCHEDULE')}</p>
            <span className="text-[10px] font-semibold text-charcoal-400">{latest.period}</span>
          </div>
          <div className="space-y-1.5 rounded-xl border border-charcoal-100 bg-white p-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] text-charcoal-600">
                <Banknote className="h-4 w-4 text-charcoal-400" aria-hidden="true" />
                {t('Basic Salary')}
              </span>
              <span className="text-[13px] font-bold text-charcoal-900">{formatMoney(latest.baseSalary)}</span>
            </div>
            {(latest.annualIncrease ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] text-charcoal-600">
                  <TrendingUp className="h-4 w-4 text-green-500" aria-hidden="true" />
                  {t('Annual Increase ({{percent}})', { percent: increasePercentLabel(latest) })}
                </span>
                <span className="text-[13px] font-bold text-green-600">
                  +{formatMoney(latest.annualIncrease ?? 0)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1.5">
              <p className="text-[13px] font-bold text-brand-700">{t('Contractual Salary / month')}</p>
              <p className="text-sm font-bold text-brand-700">
                {formatMoney(latest.baseSalary + (latest.annualIncrease ?? 0))}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-center sm:grid-cols-4">
              <div className="rounded-lg bg-charcoal-50 p-1.5">
                <p className="text-base font-bold text-charcoal-900">{latest.workingDays ?? 0}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-charcoal-500">{t('Scheduled Work Days')}</p>
              </div>
              <div className="rounded-lg bg-charcoal-50 p-1.5">
                <p className="text-base font-bold text-charcoal-900">{latest.scheduledWeeklyDays ?? 6}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-charcoal-500">{t('Weekly Days')}</p>
              </div>
              <div className="rounded-lg bg-charcoal-50 p-1.5">
                <p className="text-base font-bold text-brand-700">{latest.daysWorked ?? 0}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-charcoal-500">
                  {t('Attendance · {{percent}}%', { percent: attendancePct(latest) })}
                </p>
              </div>
              <div className="rounded-lg bg-charcoal-50 p-1.5">
                <p
                  className={cn(
                    'text-base font-bold',
                    (latest.overtimeHours ?? 0) > 0 ? 'text-blue-700' : 'text-charcoal-400',
                  )}
                >
                  {latest.overtimeHours ?? 0}h
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-charcoal-500">{t('Overtime')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="bento-label text-charcoal-400">{t('ANNUAL LEAVE')}</p>
          <span className="text-[10px] font-semibold text-charcoal-400">
            {openPeriodLabel(latest)}
          </span>
        </div>
        <LeaveQuotaBody balance={balance} error={balanceQueryError} />
      </div>
    </div>
  )
}

function openPeriodLabel(latest: PayrollSheet | null): string {
  return latest ? `${latest.period} · latest payslip` : 'not closed'
}

type RaiseInfo = { baseSalary: number; annualIncrease?: number; annualIncreasePercent?: number | null }

/** The mock's "Annual Increase (10%)" label — the gym policy percent, derived from the slice as fallback. */
function increasePercentLabel(sheet: RaiseInfo): string {
  const pct =
    sheet.annualIncreasePercent ??
    (sheet.baseSalary > 0 ? ((sheet.annualIncrease ?? 0) / sheet.baseSalary) * 100 : 0)
  return `${pct % 1 === 0 ? pct : pct.toFixed(1)}%`
}

/** Attendance rate of the period (mock: worked / scheduled). */
function attendancePct(sheet: PayrollSheet): number {
  const working = sheet.workingDays ?? 0
  return working ? Math.round(((sheet.daysWorked ?? 0) / working) * 100) : 0
}

type EarningRow = { label: string; amount: number; reason?: string | null }

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

type DeductionDisplayRow = {
  label: string
  amount: number | null
  reason?: string | null
  status?: string | null
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

function LeaveQuotaBody({ balance, error }: { balance: LeaveBalanceResponse | null; error: string | null }) {
  const { t } = useTranslation()
  if (error) {
    return <p className="text-[11px] text-red-600">{error}</p>
  }
  if (!balance) {
    return <p className="text-[11px] text-charcoal-400">{t('Loading annual leave balance…')}</p>
  }
  const total = balance.dayOff.total
  const used = balance.dayOff.used
  const remaining = Math.max(0, total - used)
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0
  const quota = Math.round(total / 12)
  return (
    <div className="rounded-xl border border-charcoal-100 bg-white p-2">
      <div className="grid grid-cols-3 gap-1">
        <div className="rounded-lg bg-charcoal-50 p-1.5 text-center">
          <p className="text-lg font-bold leading-none text-charcoal-900">{quota}</p>
          <p className="mt-0.5 text-[9px] text-charcoal-500">{t('Accrues / month')}</p>
        </div>
        <div className="rounded-lg bg-charcoal-50 p-1.5 text-center">
          <p className="text-lg font-bold leading-none text-charcoal-900">{used}</p>
          <p className="mt-0.5 text-[9px] text-charcoal-500">{t('Used this year')}</p>
        </div>
        <div className="rounded-lg bg-charcoal-50 p-1.5 text-center">
          <p className="text-lg font-bold leading-none text-brand-700">{remaining}</p>
          <p className="mt-0.5 text-[9px] text-charcoal-500">{t('Days left')}</p>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-charcoal-500">
        {t('Annual leave accrues monthly against your {{total}}-day allowance — you have {{remaining}} of {{total}} days left this year.', {
          total,
          remaining,
        })}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-charcoal-100">
          <div className="h-full rounded-l-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap text-[10px] font-semibold text-charcoal-600">
          {remaining} / {total} days left this year
        </span>
      </div>
    </div>
  )
}

function YtdCard({
  icon,
  tint,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  tint: string
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-charcoal-100/80 bg-white p-1.5 shadow-sm transition-shadow hover:shadow-md">
      <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg', tint)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-charcoal-400">{label}</p>
        <p className={cn('mt-0.5 truncate text-xs font-bold', color)}>{formatMoney(value)}</p>
      </div>
    </div>
  )
}

/* ==================== Current period card ==================== */

function CurrentPeriodCard({ sheet }: { sheet: PayrollSheet }) {
  const { t } = useTranslation()
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-brand-50/50 p-3.5">
      <div className="absolute end-0 top-0 h-28 w-28 translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/40" />
      <div className="relative flex items-center gap-3.5">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-500 shadow-md shadow-brand-200">
          <Clock className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">{t('Current Period')}</p>
          <p className="mt-0.5 text-xl font-bold text-charcoal-900">{sheet.period}</p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={sheet.status} />
            <span className="text-xs text-charcoal-400">{t('· Payout pending')}</span>
          </div>
        </div>
        <div className="hidden flex-shrink-0 text-end sm:block">
          <div className="h-2.5 w-32 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full w-2/3 rounded-full bg-brand-400" />
          </div>
          <p className="mt-1.5 text-[11px] text-charcoal-400">{t('Being processed…')}</p>
        </div>
      </div>
    </div>
  )
}

/* ==================== Monthly breakdown (mock: month cards, expandable) ==================== */

function SheetCard({
  sheet,
  maxNet,
  open,
  onToggle,
  onSlip,
}: {
  sheet: PayrollSheet
  maxNet: number
  open: boolean
  onToggle: () => void
  onSlip: () => void
}) {
  const { t } = useTranslation()
  const openPeriod = !sheet.visible
  const earnings = buildEarningsRows(sheet)
  const earningsTotal = earnings.reduce((sum, row) => sum + row.amount, 0)
  const deductionRows = buildDeductionRows(sheet)
  const workedPct = sheet.workingDays ? Math.round(((sheet.daysWorked ?? 0) / (sheet.workingDays ?? 1)) * 100) : 0
  const notWorked = Math.max(0, (sheet.workingDays ?? 0) - (sheet.daysWorked ?? 0))
  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-3 py-2.5 text-start transition-colors hover:bg-charcoal-50/60"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-charcoal-100">
              <Receipt className="h-4 w-4 text-charcoal-500" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-charcoal-900">{sheet.period}</p>
              <p className="mt-0.5 truncate text-[10px] text-charcoal-400">
                {sheet.paidDate ? t('Paid {{date}}', { date: formatDate(sheet.paidDate) }) : t('Not paid yet')}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <StatusBadge status={sheet.status} />
            {sheet.visible ? (
              <span className="whitespace-nowrap text-sm font-bold text-charcoal-900">{formatMoney(sheet.netSalary)}</span>
            ) : (
              <span className="whitespace-nowrap text-xs text-charcoal-400">—</span>
            )}
            <ChevronDown className={cn('h-4 w-4 text-charcoal-400 transition-transform duration-200', open ? 'rotate-180' : '')} aria-hidden="true" />
          </div>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-charcoal-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${Math.max(4, Math.round((sheet.netSalary / maxNet) * 100))}%` }}
          />
        </div>
      </button>

      {open && (
        <div className="space-y-2 border-t border-charcoal-100 bg-charcoal-50/40 px-3 py-2.5">
          {openPeriod || !sheet.visible ? (
            <p className="text-[11px] text-charcoal-400">
              {t('This period is still open — its payout is not visible yet.')}
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}

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

/* ==================== Breakdown detail pieces (mock §8 stat tiles + deduction trail) ==================== */

function StatTile({ label, value, bg, text }: { label: string; value: string; bg?: string; text?: string }) {
  return (
    <div className={cn('rounded-lg bg-charcoal-50 px-1.5 py-1.5 text-center', bg)}>
      <p className={cn('text-base font-bold leading-none', text ?? 'text-charcoal-700')}>{value}</p>
      <p className="mt-1 truncate text-[9px] leading-tight text-charcoal-500">{label}</p>
    </div>
  )
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
