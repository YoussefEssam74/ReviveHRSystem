import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BadgeCheck,
  Banknote,
  ChevronDown,
  Clock,
  FileText,
  MinusCircle,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  UserRound,
  Wallet,
} from 'lucide-react'
import { getOwnLeaveBalance, type LeaveBalanceResponse } from '../api/attendance.api'
import { getOwnPayslip, getOwnPayrollSheets, type PayrollSheet } from '../api/payroll.api'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Drawer } from '../../../components/ui/drawer'
import { StatusBadge } from '../../../components/ui/badge'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney } from '../../../lib/format'
import { cn } from '../../../lib/utils'

export default function MyPayrollPage() {
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
        title="No employee profile"
        hint="This account is not linked to an employee profile, so it has no payroll history."
      />
    )
  }
  if (sheetsQuery.isLoading) return <LoadingState label="Loading payroll…" />
  if (sheetsQuery.isError) {
    return <ErrorState message={describeApiError(sheetsQuery.error)} onRetry={() => sheetsQuery.refetch()} />
  }

  // Open periods (visible=false) cannot render money yet — they render once as
  // the "Current Period" card; closed sheets are the payslip history shown in
  // the Monthly Breakdown (newest paid month first, mock ordering).
  const allSheets = sheetsQuery.data ?? []
  const paid = [...allSheets]
    .filter((sheet) => sheet.visible)
    .sort((a, b) => (b.paidDate ?? '').localeCompare(a.paidDate ?? ''))
  const openSheet = allSheets.find((sheet) => !sheet.visible) ?? null
  const ref = paid[0] ?? null

  const totalNet = paid.reduce((sum, sheet) => sum + sheet.netSalary, 0)
  const totalDed = paid.reduce((sum, sheet) => sum + sheet.totalDeductions, 0)
  const totalGross = paid.reduce((sum, sheet) => sum + sheet.baseSalary + sheet.totalBonuses, 0)
  const avgNet = paid.length ? Math.round(totalNet / paid.length) : 0
  const maxNet = Math.max(...paid.map((sheet) => sheet.netSalary), 1)

  const balance = balanceQuery.data ?? null

  if (allSheets.length === 0) {
    return (
      <div className="space-y-2.5">
        <h1 className="text-lg font-bold text-charcoal-900">My Payroll</h1>
        <EmptyState
          title="No payroll history yet"
          hint="Sheets appear here once a payroll period has been processed for your gym."
        />
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div>
        <h1 className="text-lg font-bold text-charcoal-900">
          My Payroll{' '}
          <span className="text-[11px] font-normal text-charcoal-400">
            · {paid.length} payslips · {openSheet ? 1 : 0} open
          </span>
        </h1>
      </div>

      {/* One summary row — click to drop open everything underneath it (mock §8) */}
      <SummaryPanel
        open={summaryOpen}
        onToggle={() => setSummaryOpen((current) => !current)}
        summaryLabel={`EGP ${totalNet.toLocaleString()} net`}
        note={`${paid.length} payslips · ${openSheet ? 1 : 0} open`}
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

      {/* Current period — no money until the period is locked */}
      {openSheet && <CurrentPeriodCard sheet={openSheet} />}

      {/* Monthly Breakdown — one collapsible card per month, newest first */}
      <div>
        <h2 className="mb-2 text-base font-bold text-charcoal-900">Monthly Breakdown</h2>
        <div className="space-y-2.5">
          {paid.map((sheet) => (
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
        <p className="mt-2 text-[11px] text-charcoal-400">Tap a month to drop open its full breakdown.</p>
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
  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-3 py-2.5 text-left transition-colors hover:bg-charcoal-50/60"
      >
        <div className="flex items-center gap-2">
          <p className="bento-label min-w-0 flex-1 truncate text-charcoal-500">PAYROLL SUMMARY</p>
          <span className="hidden min-w-0 truncate text-[11px] text-charcoal-400 sm:block">{note}</span>
          <span className="whitespace-nowrap text-sm font-bold text-charcoal-900">{summaryLabel}</span>
          <ChevronDown
            className={cn('h-4 w-4 flex-shrink-0 text-charcoal-400 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </div>
      </button>
      {open && <div className="border-t border-charcoal-100 bg-charcoal-50/40 p-2.5">{children}</div>}
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
  return (
    <div className="space-y-3">
      {paid.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="bento-label text-charcoal-400">YEAR TO DATE</p>
            <span className="text-[10px] font-semibold text-charcoal-400">{paid.length} months paid</span>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <YtdCard icon={<Wallet className="h-4 w-4 text-brand-500" aria-hidden="true" />} tint="bg-brand-50" label="Earned" value={totalGross} color="text-brand-700" />
            <YtdCard icon={<TrendingDown className="h-4 w-4 text-red-400" aria-hidden="true" />} tint="bg-red-50" label="Deductions" value={totalDed} color="text-red-600" />
            <YtdCard icon={<PiggyBank className="h-4 w-4 text-green-500" aria-hidden="true" />} tint="bg-green-50" label="Net Pay" value={totalNet} color="text-green-700" />
            <YtdCard icon={<TrendingUp className="h-4 w-4 text-purple-500" aria-hidden="true" />} tint="bg-purple-50" label="Avg / Month" value={avgNet} color="text-purple-700" />
          </div>
        </div>
      )}

      {latest && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="bento-label text-charcoal-400">SALARY &amp; SCHEDULE</p>
            <span className="text-[10px] font-semibold text-charcoal-400">{latest.period}</span>
          </div>
          <div className="space-y-1.5 rounded-xl border border-charcoal-100 bg-white p-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] text-charcoal-600">
                <Banknote className="h-4 w-4 text-charcoal-400" aria-hidden="true" />
                Basic Salary
              </span>
              <span className="text-[13px] font-bold text-charcoal-900">{formatMoney(latest.baseSalary)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] text-charcoal-600">
                <TrendingUp className="h-4 w-4 text-green-500" aria-hidden="true" />
                Bonuses this period
              </span>
              <span className="text-[13px] font-bold text-green-600">
                +{formatMoney(latest.totalBonuses)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1.5">
              <p className="text-[13px] font-bold text-brand-700">Contractual salary / month</p>
              <p className="text-sm font-bold text-brand-700">{formatMoney(latest.baseSalary)}</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-center sm:grid-cols-4">
              <div className="rounded-lg bg-charcoal-50 p-1.5">
                <p className="text-base font-bold text-green-700">{formatMoney(latest.baseSalary)}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-charcoal-500">Basic</p>
              </div>
              <div className="rounded-lg bg-charcoal-50 p-1.5">
                <p className="text-base font-bold text-green-700">{formatMoney(latest.totalBonuses)}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-charcoal-500">Bonuses</p>
              </div>
              <div className="rounded-lg bg-charcoal-50 p-1.5">
                <p className={cn('text-base font-bold', latest.totalDeductions ? 'text-red-600' : 'text-charcoal-400')}>
                  {formatMoney(latest.totalDeductions)}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-charcoal-500">Deductions</p>
              </div>
              <div className="rounded-lg bg-charcoal-50 p-1.5">
                <p className="text-base font-bold text-brand-700">{formatMoney(latest.netSalary)}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-charcoal-500">Net paid</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="bento-label text-charcoal-400">ANNUAL LEAVE</p>
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

function LeaveQuotaBody({ balance, error }: { balance: LeaveBalanceResponse | null; error: string | null }) {
  if (error) {
    return <p className="text-[11px] text-red-600">{error}</p>
  }
  if (!balance) {
    return <p className="text-[11px] text-charcoal-400">Loading annual leave balance…</p>
  }
  const total = balance.dayOff.total
  const used = balance.dayOff.used
  const remaining = Math.max(0, total - used)
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0
  const quota = Math.round(total / 12)
  return (
    <div className="rounded-xl border border-charcoal-100 bg-white p-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg bg-charcoal-50 p-2 text-center">
          <p className="text-xl font-bold leading-none text-charcoal-900">{quota}</p>
          <p className="mt-1 text-[10px] text-charcoal-500">Accrues / month</p>
        </div>
        <div className="rounded-lg bg-charcoal-50 p-2 text-center">
          <p className="text-xl font-bold leading-none text-charcoal-900">{used}</p>
          <p className="mt-1 text-[10px] text-charcoal-500">Used this year</p>
        </div>
        <div className="rounded-lg bg-charcoal-50 p-2 text-center">
          <p className="text-xl font-bold leading-none text-brand-700">{remaining}</p>
          <p className="mt-1 text-[10px] text-charcoal-500">Days left</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-charcoal-500">
        Annual leave accrues monthly against your {total}-day allowance — you have {remaining} of {total} days left this year.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal-100">
          <div className="h-full rounded-l-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap text-[11px] font-semibold text-charcoal-600">
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
    <div className="flex items-center gap-2 rounded-xl border border-charcoal-100/80 bg-white p-2 shadow-sm transition-shadow hover:shadow-md">
      <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', tint)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">{label}</p>
        <p className={cn('mt-0.5 truncate text-sm font-bold', color)}>{formatMoney(value)}</p>
      </div>
    </div>
  )
}

/* ==================== Current period card ==================== */

function CurrentPeriodCard({ sheet }: { sheet: PayrollSheet }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-brand-50/50 p-3.5">
      <div className="absolute right-0 top-0 h-28 w-28 translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/40" />
      <div className="relative flex items-center gap-3.5">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-500 shadow-md shadow-brand-200">
          <Clock className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Current Period</p>
          <p className="mt-0.5 text-xl font-bold text-charcoal-900">{sheet.period}</p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={sheet.status} />
            <span className="text-xs text-charcoal-400">· Payout pending</span>
          </div>
        </div>
        <div className="hidden flex-shrink-0 text-right sm:block">
          <div className="h-2.5 w-32 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full w-2/3 rounded-full bg-brand-400" />
          </div>
          <p className="mt-1.5 text-[11px] text-charcoal-400">Being processed…</p>
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
  const openPeriod = !sheet.visible
  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-3 py-2.5 text-left transition-colors hover:bg-charcoal-50/60"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-charcoal-100">
              <Receipt className="h-4 w-4 text-charcoal-500" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-charcoal-900">{sheet.period}</p>
              <p className="mt-0.5 truncate text-[10px] text-charcoal-400">
                {sheet.paidDate ? `Paid ${formatDate(sheet.paidDate)}` : 'Not paid yet'}
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
              This period is still open — its payout is not visible yet.
            </p>
          ) : (
            <>
              <ItemSection
                tone="earnings"
                title="Earnings"
                headerValue={`+${formatMoney(sheet.baseSalary + sheet.totalBonuses)}`}
                rows={[
                  { label: 'Basic Salary', amount: sheet.baseSalary },
                  ...sheet.items
                    .filter((item) => item.kind === 'earning')
                    .map((item) => ({ label: item.label, amount: item.amount, reason: item.reason })),
                ]}
              />
              <ItemSection
                tone="deductions"
                title="Deductions"
                headerValue={`−${formatMoney(sheet.totalDeductions)}`}
                rows={sheet.items
                  .filter((item) => item.kind === 'deduction')
                  .map((item) => ({ label: item.label, amount: Math.abs(item.amount), reason: item.reason }))}
                emptyHint="No deductions this period."
              />
              {/* Dark net bar with the payslip action (mock) */}
              <div className="flex items-center justify-between gap-2 rounded-xl bg-charcoal-900 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-400">Net Salary</p>
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
  rows: Array<{ label: string; amount: number; reason?: string | null }>
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
            <div key={index} className="flex items-center justify-between gap-2.5 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-charcoal-800">{row.label}</p>
                {row.reason && <p className="truncate text-[10px] text-charcoal-400">{row.reason}</p>}
              </div>
              <span className={cn('whitespace-nowrap text-xs font-bold', isEarnings ? 'text-green-700' : 'text-red-600')}>
                {isEarnings ? '+' : '−'} {formatMoney(row.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ==================== Payslip drawer (mock §8 modal) ==================== */

function PayslipDrawer({ entryId, employeeId, onClose }: { entryId: number | null; employeeId: number; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['portal', 'payslip', employeeId, entryId],
    queryFn: ({ signal }) => getOwnPayslip(employeeId, entryId!, signal),
    enabled: entryId != null,
    retry: false,
  })
  const slip = query.data?.data ?? null

  return (
    <Drawer open={entryId != null} title={slip ? `Payslip — ${slip.period}` : 'Payslip'} onClose={onClose}>
      {query.isLoading && <LoadingState label="Loading payslip…" />}
      {query.isError && <ErrorState message={describeApiError(query.error)} onRetry={() => query.refetch()} />}
      {slip && (
        <div className="space-y-3">
          {/* Dark gradient header (mock) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal-800 to-charcoal-900 p-5 text-white">
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5" aria-hidden="true" />
            <div className="absolute bottom-0 left-0 h-20 w-20 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/5" aria-hidden="true" />
            <div className="relative text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-300">Payslip</p>
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
            <SlipRow label="Base Salary" value={formatMoney(slip.baseSalary)} />
            <SlipRow label={`Overtime (${slip.overtime}h)`} value={formatMoney(slip.overtimePay)} color="text-blue-600" />
            <SlipRow label="Bonus" value={formatMoney(slip.bonus)} color="text-green-600" />
            <SlipRow label="Gross" value={formatMoney(slip.gross)} emphasis />
          </div>

          <div>
            <p className="bento-label mb-1">DEDUCTIONS</p>
            {slip.deductions.length === 0 ? (
              <p className="rounded-lg bg-charcoal-50 p-2.5 text-xs text-charcoal-500">No deductions this period.</p>
            ) : (
              <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200 p-0.5">
                {slip.deductions.map((deduction, index) => (
                  <div key={index} className="p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-charcoal-800">
                        {deduction.label}
                        <span className="ml-1.5 text-[9px] font-medium uppercase text-charcoal-400">{deduction.source}</span>
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
            <p className="text-sm font-bold text-brand-700">Net Pay</p>
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
