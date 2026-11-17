import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { describeApiError } from '../../../lib/api-client'
import type { RequestListItem } from '../api/requests.api'
import { useBulkDecide } from '../hooks/useRequests'

export interface BulkApproveDialogProps {
  /** Every Pending HR Review request currently in scope. */
  pending: RequestListItem[]
  onClose: () => void
  onApproved?: (count: number, unpaid: number) => void
}

/**
 * Bulk approve. When some pending requests have no balance left the mock first
 * lists them and warns that approving records those days as unpaid (payroll
 * deduction applies); otherwise it approves straight away.
 */
export function BulkApproveDialog({ pending, onClose, onApproved }: BulkApproveDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const bulk = useBulkDecide()
  const alerts = pending.filter((request) => request.leaveBalance && request.leaveBalance.left <= 0)

  const run = async () => {
    setError(null)
    try {
      const result = await bulk.mutateAsync(undefined)
      onApproved?.(result.approved, result.unpaidApplied)
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={alerts.length > 0 ? 'Bulk Approve — Balance Check' : 'Bulk Approve'}
      className="sm:max-w-xl"
      description={`${pending.length} request${pending.length === 1 ? '' : 's'} awaiting HR`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {alerts.length > 0 ? 'Review individually' : 'Cancel'}
          </Button>
          <Button onClick={run} loading={bulk.isPending} disabled={pending.length === 0}>
            Approve all {pending.length}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {alerts.length > 0 ? (
          <>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] leading-relaxed text-red-800">
              <b>
                {alerts.length} of {pending.length} pending requests
              </b>{' '}
              have no leave balance left. Approving them records those days as <b>unpaid (payroll deduction applies)</b>.
            </div>
            <div className="space-y-1">
              {alerts.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg bg-charcoal-50 p-2"
                >
                  <p className="text-[11px] text-charcoal-800">
                    {request.employee} — {request.type}
                  </p>
                  <span className="badge badge-red text-[9px]">0 days left</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-charcoal-400">
              Review them one by one, or approve everything including the unpaid days.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-charcoal-700">
            Every pending request has balance available, so all of them will be approved as <b>paid</b>.
          </p>
        )}
      </div>
    </Dialog>
  )
}
