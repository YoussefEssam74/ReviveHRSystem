import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Wallet } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Select } from '../../../components/ui/select'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { EDIT, VIEW } from '../../../lib/permissions'
import { formatEGP } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { useMockToast } from '../../dashboard/hooks/useMockToast'
import { DashboardToasts } from '../../dashboard/components/DashboardToasts'
import {
  useApprovePeriod,
  useEnsureCurrentPeriod,
  useExportPeriodCsv,
  usePayrollPeriod,
  usePayrollPeriods,
} from '../hooks/usePayroll'
import type { PayrollPeriod } from '../api/payroll.api'
import SettlementSheet from '../components/SettlementSheet'
import PublishPayrollDialog from '../components/PublishPayrollDialog'
import { entryStatusLabel, entryStatusTone, isEntryClosed, overtimePayOf } from '../lib/payroll-calc'

/** One compact stat card above the ledger. */
function StatCard({
  label,
  value,
  hint,
  tone,
  compact,
}: {
  label: string
  value: string
  hint?: string
  tone?: string
  /** Money values need the smaller size so "EGP 96,800" stays on one line. */
  compact?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-charcoal-200 bg-white px-2 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">{label}</p>
        <p
          className={cn(
            'whitespace-nowrap font-extrabold leading-tight text-charcoal-900',
            compact ? 'text-sm' : 'text-lg',
            tone,
          )}
        >
          {value}
        </p>
      </div>
      {hint && <span className="flex-shrink-0 text-[10px] font-medium text-charcoal-400">{hint}</span>}
    </div>
  )
}

/**
 * Staff Payroll & Expense Accounts (mock pages-payroll.js): one branch × period
 * ledger, with the compact settlement sheet reached through "Review Sheet →".
 */
export default function PayrollPage() {
  const { can, me } = useMe()
  const canView = can('payroll', VIEW)
  const canEdit = can('payroll', EDIT)
  const { toasts, toast, remove } = useMockToast()

  const gyms = me?.gyms ?? []
  // me loads after the first render, so fall back to the session's gym each render.
  const [selectedGymId, setSelectedGymId] = useState<number | undefined>(undefined)
  const gymId = selectedGymId ?? me?.activeGym?.gymId ?? gyms[0]?.gymId
  const [periodId, setPeriodId] = useState<number | null>(null)
  const [view, setView] = useState<{ mode: 'overview' } | { mode: 'detail'; employeeId: number }>({ mode: 'overview' })
  const [publishing, setPublishing] = useState(false)

  // Opening the page opens the current month's run and adds any employee who has no
  // sheet yet (new hires), so payroll is never missing staff. Idempotent server-side.
  const ensure = useEnsureCurrentPeriod()
  const ensuredGymRef = useRef<number | null>(null)
  const ensurePeriod = ensure.mutate
  useEffect(() => {
    if (!canEdit || gymId == null || ensuredGymRef.current === gymId) return
    ensuredGymRef.current = gymId
    ensurePeriod(gymId)
  }, [canEdit, gymId, ensurePeriod])

  const periodsQuery = usePayrollPeriods({ gym: gymId, pageSize: 50 }, canView)
  const periods = periodsQuery.data?.items ?? []
  const activePeriod: PayrollPeriod | undefined = periods.find((p) => p.id === periodId) ?? periods[0]

  const detailQuery = usePayrollPeriod(activePeriod?.id ?? 0, canView && Boolean(activePeriod))
  const approve = useApprovePeriod()
  const exportCsv = useExportPeriodCsv()

  const period = detailQuery.data
  const items = useMemo(() => period?.items ?? [], [period])
  const closedCount = items.filter(isEntryClosed).length
  const pendingCount = items.length - closedCount
  const totalNet = items.reduce((sum, entry) => sum + entry.net, 0)
  const totalGross = items.reduce((sum, entry) => sum + entry.gross, 0)
  const locked = Boolean(period?.locked)
  const allClosed = items.length > 0 && closedCount === items.length

  const publish = async () => {
    if (!period || !gymId) return
    try {
      await approve.mutateAsync({ periodId: period.id, gym: period.gym || String(gymId) })
      setPublishing(false)
      toast(`Payroll published and locked for ${period.gym} (${period.period})!`)
    } catch (err) {
      toast(describeApiError(err), 'error')
    }
  }

  const exportPeriod = () => {
    if (!period) return
    exportCsv.mutate(
      { periodId: period.id, gymId: period.gymId ?? gymId },
      { onError: (err) => toast(describeApiError(err), 'error') },
    )
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-300 bg-white p-12 text-center">
        <Wallet className="mx-auto mb-2 h-8 w-8 text-charcoal-300" aria-hidden="true" />
        <h2 className="text-base font-bold text-charcoal-900">No payroll access</h2>
        <p className="mt-1 text-sm text-charcoal-500">
          You don&apos;t have permission to view payroll for this gym. Ask an administrator for the payroll feature.
        </p>
      </div>
    )
  }

  if (periodsQuery.isLoading) return <LoadingState label="Loading payroll periods…" />
  if (periodsQuery.error) return <ErrorState message={describeApiError(periodsQuery.error)} />
  if (periods.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No payroll periods"
        message="No settlement period exists for this branch yet."
      />
    )
  }

  if (view.mode === 'detail') {
    if (!period) return <LoadingState label="Loading settlement sheet…" />
    return (
      <>
        <SettlementSheet
          period={period}
          employeeId={view.employeeId}
          canEdit={canEdit}
          onBack={() => setView({ mode: 'overview' })}
          onSelectEmployee={(employeeId) => setView({ mode: 'detail', employeeId })}
          onToast={toast}
        />
        <DashboardToasts toasts={toasts} onDismiss={remove} />
      </>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <h1 className="text-base font-bold tracking-tight text-charcoal-900">Staff Payroll &amp; Expense Accounts</h1>
          <span
            className={cn(
              'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold',
              locked
                ? 'bg-charcoal-100 text-charcoal-700'
                : 'border border-brand-200 bg-brand-50 text-brand-700',
            )}
          >
            {locked ? '🔒 Locked' : '🟢 Open for Reconciliation'}
          </span>
          {ensure.isPending && (
            <span className="text-[10px] font-semibold text-charcoal-400">Preparing current period…</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            value={gymId ?? ''}
            onChange={(event) => {
              setSelectedGymId(Number(event.target.value))
              setPeriodId(null)
              setView({ mode: 'overview' })
            }}
            aria-label="Branch"
            className="h-7 border-charcoal-200 bg-white px-2 py-1 text-[11px] font-semibold"
          >
            {gyms.map((gym) => (
              <option key={gym.gymId} value={gym.gymId}>
                {gym.gymName} Branch
              </option>
            ))}
          </Select>

          <Select
            value={activePeriod?.id ?? ''}
            onChange={(event) => {
              setPeriodId(Number(event.target.value))
              setView({ mode: 'overview' })
            }}
            aria-label="Period"
            className="h-7 border-charcoal-200 bg-white px-2 py-1 text-[11px] font-semibold"
          >
            {periods.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.period}
                {/* Data can hold two runs for one month; disambiguate them by status. */}
                {periods.filter((other) => other.period === entry.period).length > 1 ? ` · ${entry.status}` : ''}
              </option>
            ))}
          </Select>

          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={exportPeriod}
            loading={exportCsv.isPending}
            title="Export this period as CSV"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            Export
          </Button>

          {locked ? (
            <span className="rounded-lg bg-charcoal-100 px-2 py-1 text-xs font-semibold text-charcoal-500">
              Published
            </span>
          ) : canEdit && allClosed ? (
            <Button size="sm" className="h-7 px-3 text-xs font-bold" onClick={() => setPublishing(true)}>
              ✓ Publish &amp; Lock Branch
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs opacity-60" disabled title="Reconcile all staff sheets first">
              Publish ({pendingCount} pending)
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatCard label="Total Staff" value={String(items.length)} hint={period?.gym} />
        <StatCard
          label="Settled & Closed"
          value={`${closedCount} / ${items.length}`}
          tone="text-emerald-600"
          hint={items.length ? `${Math.round((closedCount / items.length) * 100)}%` : '0%'}
        />
        <StatCard
          label="Pending Review"
          value={String(pendingCount)}
          tone={pendingCount > 0 ? 'text-amber-600' : undefined}
          hint={pendingCount > 0 ? 'Action Needed' : 'All Clear'}
        />
        <StatCard label="Net Disbursed" value={formatEGP(totalNet)} hint={`Gross: ${formatEGP(totalGross)}`} compact />
      </div>

      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        <div className="flex items-center justify-between border-b border-charcoal-200 bg-charcoal-50/60 px-2 py-2">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
              Branch Staff Expense &amp; Payroll Ledger
            </h2>
            <p className="text-[10px] text-charcoal-400">
              Select any employee to review their source attendance, deductions, and close their monthly account
            </p>
          </div>
          <span className="text-[10px] font-semibold text-charcoal-500">{items.length} records</span>
        </div>

        {detailQuery.isLoading ? (
          <LoadingState label="Loading ledger…" />
        ) : detailQuery.error ? (
          <ErrorState message={describeApiError(detailQuery.error)} />
        ) : items.length === 0 ? (
          <EmptyState icon={Wallet} title="No employees on this sheet" message="This period has no entry sheets." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-charcoal-200 bg-charcoal-50">
                <tr className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
                  <th className="px-2 py-2">Employee</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2 text-right">Base Salary</th>
                  <th className="px-2 py-2 text-right">OT &amp; Bonus</th>
                  <th className="px-2 py-2 text-right">Deductions</th>
                  <th className="px-2 py-2 text-right">Net Final</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100">
                {items.map((entry) => {
                  const additions = entry.bonus + overtimePayOf(entry)
                  return (
                    <tr
                      key={entry.employeeId}
                      onClick={() => setView({ mode: 'detail', employeeId: entry.employeeId })}
                      className="cursor-pointer transition-colors hover:bg-charcoal-50"
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-charcoal-100 text-[10px] font-bold text-charcoal-700">
                            {entry.initials || 'EM'}
                          </div>
                          <div className="min-w-0 whitespace-nowrap">
                            <p className="text-xs font-bold text-charcoal-900">{entry.name}</p>
                            <p className="font-mono text-[10px] text-charcoal-400">{entry.employeeNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 font-medium text-charcoal-600">{entry.position}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-charcoal-900">{formatEGP(entry.baseSalary)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-emerald-600">+ {formatEGP(additions)}</td>
                      <td
                        className={cn(
                          'whitespace-nowrap px-2 py-2 text-right font-semibold',
                          entry.deductions > 0 ? 'text-red-600' : 'text-charcoal-400',
                        )}
                      >
                        {entry.deductions > 0 ? `− ${formatEGP(entry.deductions)}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right font-extrabold text-charcoal-900">{formatEGP(entry.net)}</td>
                      <td className="px-2 py-2">
                        <Badge color={entryStatusTone(entry)} className="text-[9px] font-bold">
                          {entryStatusLabel(entry)}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2.5 text-[11px] text-brand-700"
                          onClick={(event) => {
                            event.stopPropagation()
                            setView({ mode: 'detail', employeeId: entry.employeeId })
                          }}
                        >
                          Review Sheet →
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {publishing && period && (
        <PublishPayrollDialog
          period={period}
          onClose={() => setPublishing(false)}
          onConfirm={publish}
          loading={approve.isPending}
        />
      )}

      <DashboardToasts toasts={toasts} onDismiss={remove} />
    </div>
  )
}
