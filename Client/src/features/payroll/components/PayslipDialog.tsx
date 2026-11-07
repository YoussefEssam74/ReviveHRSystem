import { Dialog } from '../../../components/ui/dialog'
import { StatusBadge } from '../../../components/ui/badge'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { formatMoney } from '../../../lib/format'
import { usePayslip } from '../hooks/usePayroll'

export interface PayslipDialogProps {
  periodId: number
  /** null closes the dialog (no payslip requested). */
  employeeId: number | null
  employeeName: string
  onClose: () => void
}

/** Payslip drill-down for one settlement-sheet entry (payroll.view). */
export default function PayslipDialog({ periodId, employeeId, employeeName, onClose }: PayslipDialogProps) {
  const open = employeeId != null
  const { data, isLoading, error } = usePayslip(periodId, employeeId ?? 0, open)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Payslip preview"
      description={employeeName}
      className="max-w-xl"
    >
      {isLoading ? (
        <LoadingState label="Loading payslip…" />
      ) : error ? (
        <ErrorState message={describeApiError(error)} />
      ) : !data ? null : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{data.employee.name}</p>
              <p className="text-sm text-slate-500">
                {data.employee.position} · {data.gym}
              </p>
            </div>
            <StatusBadge status={data.status} />
          </div>

          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            <PayslipRow label="Base salary" value={formatMoney(data.baseSalary)} />
            <PayslipRow label="Overtime" value={`${data.overtime} h · ${formatMoney(data.overtimePay)}`} />
            <PayslipRow label="Bonus" value={formatMoney(data.bonus)} />
            <PayslipRow label="Gross" value={formatMoney(data.gross)} />
          </dl>

          <div>
            <p className="text-sm font-semibold text-slate-900">Deduction lines</p>
            {data.deductions.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No deduction lines on this sheet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {data.deductions.map((line, index) => (
                  <li key={`${line.label}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{line.label || line.reason || 'Deduction'}</p>
                      <p className="truncate text-xs capitalize text-slate-500">{line.source}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={line.status} />
                      <span className="font-medium text-slate-900">{formatMoney(line.amount)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-800">Net pay</p>
            <p className="text-lg font-bold text-emerald-800">{formatMoney(data.net)}</p>
          </div>
          <p className="text-xs text-slate-500">
            Only Accepted and Approved lines are deducted — Pending lines are not yet part of net pay.
          </p>
        </div>
      )}
    </Dialog>
  )
}

function PayslipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  )
}
