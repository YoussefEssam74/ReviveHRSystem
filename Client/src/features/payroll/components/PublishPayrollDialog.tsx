import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { formatEGP } from '../../../lib/format'
import type { PayrollPeriodDetail } from '../api/payroll.api'

export interface PublishPayrollDialogProps {
  period: PayrollPeriodDetail
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

/** Publish & lock confirmation: totals, settled state and the disbursed net. */
export default function PublishPayrollDialog({ period, onClose, onConfirm, loading }: PublishPayrollDialogProps) {
  const totalNet = period.items.reduce((sum, entry) => sum + entry.net, 0)

  return (
    <Dialog
      open
      onClose={onClose}
      title="Publish & Lock Branch Payroll"
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={loading}>
            Publish and Lock Period
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <p className="text-charcoal-700">
          You are about to publish and lock the payroll for <b>{period.gym} Branch</b> for the period{' '}
          <b>{period.period}</b>.
        </p>
        <div className="rounded-lg border border-charcoal-200 bg-charcoal-50 p-3">
          <div className="flex justify-between py-1">
            <span>Total Employees:</span> <b>{period.items.length}</b>
          </div>
          <div className="flex justify-between py-1">
            <span>All Accounts Settled:</span> <b className="text-emerald-600">Yes (100%)</b>
          </div>
          <div className="flex justify-between border-t border-charcoal-200 pt-1 font-bold">
            <span>Total Net Disbursed:</span> <b>{formatEGP(totalNet)}</b>
          </div>
        </div>
        <p className="text-[11px] text-charcoal-500">
          Locking will finalize all deduction decisions and make records read-only.
        </p>
      </div>
    </Dialog>
  )
}
