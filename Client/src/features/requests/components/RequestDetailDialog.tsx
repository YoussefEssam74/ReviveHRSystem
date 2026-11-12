import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { RequestListItem } from '../api/requests.api'
import { isDecisionUndoable, requestStatusLabel, requestTypeLabel, requestUrgency } from '../lib/request-status'
import { UrgencyTag } from './RequestCard'

export interface RequestDetailDialogProps {
  request: RequestListItem
  canDecide: boolean
  onClose: () => void
  onDecide: (mode: 'approve' | 'undo') => void
}

/** Read-only request detail: identity, reason, balance, BM + HR blocks, timeline. */
export function RequestDetailDialog({ request, canDecide, onClose, onDecide }: RequestDetailDialogProps) {
  const balance = request.leaveBalance
  const undoable =
    canDecide && (request.status === 'Approved' || request.status === 'Rejected') && isDecisionUndoable(request)

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Request R${request.id} — ${request.employee}`}
      className="sm:max-w-2xl"
      footer={
        <>
          {request.status === 'Pending HR Review' && canDecide && (
            <Button onClick={() => onDecide('approve')}>Decide</Button>
          )}
          {undoable && (
            <Button variant="dangerOutline" onClick={() => onDecide('undo')}>
              Undo Decision
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-gray text-[9px]">{requestTypeLabel(request.type)}</span>
          <span className="badge badge-gray text-[9px]">{request.gym}</span>
          <span className="badge badge-gray text-[9px]">
            {requestStatusLabel(request.status, request.awaitingManager)}
          </span>
          {requestUrgency(request) !== 'Normal' && <UrgencyTag request={request} />}
        </div>

        <p className="text-[11px] text-charcoal-600">
          {formatDate(request.requestedDate)}
          {request.endDate && request.endDate !== request.requestedDate ? ` – ${formatDate(request.endDate)}` : ''} ·
          Submitted {formatDate(request.submittedDate)}
        </p>

        {request.reason && (
          <div className="rounded-lg bg-charcoal-50 p-2.5">
            <p className="text-[9px] uppercase tracking-wide text-charcoal-500">Reason</p>
            <p className="mt-0.5 text-xs text-charcoal-800">{request.reason}</p>
          </div>
        )}

        {balance && (
          <div className="rounded-lg border border-charcoal-200 bg-charcoal-50 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-wide text-charcoal-500">{balance.label}</p>
              <p
                className={cn(
                  'text-[11px] font-bold',
                  balance.left <= 0 ? 'text-red-600' : balance.afterApproval <= 0 ? 'text-yellow-600' : 'text-brand-600',
                )}
              >
                {balance.left}/{balance.total} left
                {request.status === 'Pending HR Review' ? ` → ${balance.afterApproval}` : ''}
              </p>
            </div>
            <p className="mt-1 text-[10px] text-charcoal-600">
              {request.status === 'Rejected'
                ? 'Request rejected — no payment recorded.'
                : request.status === 'Approved'
                  ? request.payment === 'unpaid'
                    ? 'Recorded as unpaid — payroll deduction applies.'
                    : 'Recorded as paid — deducted from the balance.'
                  : balance.left <= 0
                    ? 'No balance left — HR sets paid or unpaid at approval.'
                    : `${balance.afterApproval} of ${balance.total} days remaining after approval.`}
            </p>
          </div>
        )}

        <div className="rounded-lg bg-charcoal-50 p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-charcoal-500">Building manager decision</p>
          <p
            className={cn(
              'mt-0.5 text-xs font-medium',
              request.bmDecision === 'Approved' ? 'text-brand-700' : request.bmDecision ? 'text-red-700' : 'text-charcoal-400',
            )}
          >
            {request.bmDecision ?? 'No BM decision recorded yet.'}
            {request.bmComment ? ` — ${request.bmComment}` : ''}
          </p>
        </div>

        {request.hrDecision && (
          <div className="rounded-lg bg-charcoal-50 p-2.5">
            <p className="text-[9px] uppercase tracking-wide text-charcoal-500">HR final decision</p>
            <p
              className={cn(
                'mt-0.5 text-xs font-medium',
                request.hrDecision === 'Approved' ? 'text-brand-700' : 'text-red-700',
              )}
            >
              {request.hrDecision}
              {request.payment && (
                <span className={cn('badge ml-1 text-[9px]', request.payment === 'paid' ? 'badge-green' : 'badge-red')}>
                  {request.payment === 'paid' ? 'Paid' : 'Unpaid'}
                </span>
              )}
              {request.hrComment ? ` — ${request.hrComment}` : ''}
            </p>
          </div>
        )}

        <div>
          {request.timeline.length === 0 ? (
            <p className="text-[10px] text-charcoal-400">No timeline.</p>
          ) : (
            request.timeline.map((step, index) => (
              <div key={`${step.step}-${index}`} className="flex items-start gap-2.5">
                <div className="flex flex-col items-center">
                  <span className={cn('mt-0.5 h-3 w-3 rounded-full', step.done ? 'bg-brand-500' : 'bg-charcoal-200')} />
                  {step.done && index < request.timeline.length - 1 && <span className="mt-0.5 h-5 w-0.5 bg-brand-500" />}
                </div>
                <div className="pb-3">
                  <p className="text-xs font-medium text-charcoal-800">{step.step}</p>
                  <p className="text-[9px] text-charcoal-400">{step.date}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  )
}
