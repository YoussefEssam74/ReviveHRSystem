import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { RequestDecisionResult, RequestListItem } from '../api/requests.api'
import { useDecideRequest, useUndoDecision } from '../hooks/useRequests'
import { isDecisionUndoable, requestStatusLabel, requestTypeLabel } from '../lib/request-status'
import { UrgencyTag } from './RequestCard'

export type DecisionMode = 'approve' | 'reject' | 'undo'

export interface RequestDecisionDialogProps {
  request: RequestListItem
  mode: DecisionMode
  onClose: () => void
  /** Fires after the server accepted the decision. */
  onDecided?: (result: RequestDecisionResult, mode: DecisionMode) => void
}

/** Balance bar the mock draws above the payment choice. */
function BalanceStrip({ request }: { request: RequestListItem }) {
  const balance = request.leaveBalance
  if (!balance) return null

  const percent = balance.total ? Math.round((balance.left / balance.total) * 100) : 0
  const zero = balance.left <= 0
  const losesLast = !zero && balance.afterApproval <= 0
  const tone = zero ? 'text-red-600' : losesLast ? 'text-yellow-600' : 'text-brand-600'
  const bar = zero ? 'bg-red-400' : losesLast ? 'bg-yellow-400' : 'bg-brand-500'
  const box = zero ? 'border-red-100 bg-red-50/60' : losesLast ? 'border-yellow-100 bg-yellow-50/60' : 'border-charcoal-200 bg-charcoal-50'

  return (
    <div className={cn('rounded-lg border px-2.5 py-1.5', box)}>
      <div className="flex items-center gap-2">
        <p className="flex-shrink-0 text-[9px] uppercase tracking-wide text-charcoal-500">{balance.label}</p>
        <div className="h-1.5 min-w-[30px] flex-1 overflow-hidden rounded-full bg-charcoal-200">
          <div className={cn('h-full rounded-full', bar)} style={{ width: `${percent}%` }} />
        </div>
        <p className={cn('flex-shrink-0 text-[10px] font-bold', tone)}>
          {balance.left}/{balance.total}
          {request.status === 'Pending HR Review' && (
            <span className="font-normal text-charcoal-400"> → {balance.afterApproval}</span>
          )}
        </p>
      </div>
      {request.status === 'Pending HR Review' && (
        <p className="mt-1 text-[9px] text-charcoal-600">
          {zero ? (
            <>
              <span className="font-semibold text-red-600">0 left</span> — HR sets <b>paid or unpaid</b> at approval.
            </>
          ) : losesLast ? (
            <>
              Approving uses the <b className="text-yellow-700">last day</b> — 0 remaining after approval.
            </>
          ) : (
            <>{balance.afterApproval} of {balance.total} days remaining after approval.</>
          )}
        </p>
      )}
    </div>
  )
}

/** Approve / Reject / Undo — payment choice, note, BM block, timeline, rule hints. */
export function RequestDecisionDialog({ request, mode, onClose, onDecided }: RequestDecisionDialogProps) {
  const balance = request.leaveBalance
  const [payment, setPayment] = useState<'paid' | 'unpaid'>(balance && balance.left <= 0 ? 'unpaid' : 'paid')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const decide = useDecideRequest()
  const undo = useUndoDecision()
  const pending = decide.isPending || undo.isPending

  const isReject = mode === 'reject'
  const isUndo = mode === 'undo'
  const title = isUndo ? 'Undo Decision' : isReject ? 'Reject Request' : 'Approve Request'

  const submit = async () => {
    setError(null)
    if (isReject && !note.trim()) {
      setError('A rejection reason is required.')
      return
    }
    try {
      const result = isUndo
        ? await undo.mutateAsync({ id: request.id, comment: note.trim() || undefined })
        : await decide.mutateAsync({
            id: request.id,
            body: {
              decision: isReject ? 'rejected' : 'approved',
              comment: note.trim() || undefined,
              payment: !isReject && balance ? payment : undefined,
            },
          })
      onDecided?.(result, mode)
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${title} — ${request.employee}`}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={isReject || isUndo ? 'dangerOutline' : 'primary'}
            onClick={submit}
            loading={pending}
            disabled={isUndo && !isDecisionUndoable(request)}
          >
            {isUndo ? 'Undo & Return to Review' : isReject ? 'Reject' : 'Approve'}
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-gray text-[9px]">{requestTypeLabel(request.type)}</span>
          <span className="badge badge-gray text-[9px]">{request.gym}</span>
          <span className="badge badge-gray text-[9px]">{requestStatusLabel(request.status, request.awaitingManager)}</span>
          <UrgencyTag request={request} />
        </div>

        {request.awaitingManager && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10px] leading-relaxed text-amber-800">
            This request hasn&apos;t reached a branch manager yet. Your decision records the final outcome and marks
            the manager stage as skipped in the timeline.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-charcoal-50 p-2.5 text-[11px]">
          <div>
            <p className="text-[9px] uppercase text-charcoal-400">Requested for</p>
            <p className="font-medium text-charcoal-800">
              {formatDate(request.requestedDate)}
              {request.endDate && request.endDate !== request.requestedDate ? ` – ${formatDate(request.endDate)}` : ''}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-charcoal-400">Submitted</p>
            <p className="font-medium text-charcoal-800">{formatDate(request.submittedDate)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[9px] uppercase text-charcoal-400">Reason</p>
            <p className="font-medium text-charcoal-800">{request.reason || '—'}</p>
          </div>
        </div>

        <BalanceStrip request={request} />

        {!isReject && !isUndo && balance && (
          <div className="rounded-lg bg-charcoal-50 p-2.5">
            <p className="text-[9px] uppercase tracking-wide text-charcoal-500">Payment</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-charcoal-700">
                <input
                  type="radio"
                  name="req-payment"
                  value="paid"
                  className="accent-brand-600"
                  checked={payment === 'paid'}
                  onChange={() => setPayment('paid')}
                />
                Paid — deduct from balance
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-charcoal-700">
                <input
                  type="radio"
                  name="req-payment"
                  value="unpaid"
                  className="accent-brand-600"
                  checked={payment === 'unpaid'}
                  onChange={() => setPayment('unpaid')}
                />
                Unpaid — payroll deduction
              </label>
            </div>
          </div>
        )}

        <div
          className={cn(
            'rounded-lg border-l-4 bg-charcoal-50 p-2.5',
            request.bmDecision === 'Approved' ? 'border-l-brand-500' : 'border-l-red-500',
          )}
        >
          <p className="text-[9px] uppercase tracking-wide text-charcoal-500">Building manager</p>
          <p
            className={cn(
              'mt-0.5 text-xs font-medium',
              request.bmDecision === 'Approved' ? 'text-brand-700' : 'text-red-700',
            )}
          >
            {request.bmDecision ?? 'No BM decision recorded'}
            {request.bmComment ? ` — ${request.bmComment}` : ''}
          </p>
        </div>

        <div>
          {request.timeline.length === 0 ? (
            <p className="text-[10px] text-charcoal-400">No timeline yet.</p>
          ) : (
            request.timeline.map((step, index) => (
              <div key={`${step.step}-${index}`} className="flex items-start gap-2.5">
                <div className="flex flex-col items-center">
                  <span
                    className={cn('mt-0.5 h-3 w-3 rounded-full', step.done ? 'bg-brand-500' : 'bg-charcoal-200')}
                  />
                  {step.done && index < request.timeline.length - 1 && (
                    <span className="mt-0.5 h-5 w-0.5 bg-brand-500" />
                  )}
                </div>
                <div className="pb-3">
                  <p className="text-xs font-medium text-charcoal-800">{step.step}</p>
                  <p className="text-[9px] text-charcoal-400">{step.date}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div
          className={cn(
            'rounded-lg border p-2.5 text-[10px] leading-relaxed',
            isUndo
              ? 'border-orange-200 bg-orange-50 text-orange-800'
              : 'border-yellow-200 bg-yellow-50 text-yellow-800',
          )}
        >
          {isUndo ? (
            <>
              This reverses the HR decision and returns the request to <b>Pending HR Review</b> so it can be
              decided again. The BM decision stays as is — allowed only while the requested date hasn&apos;t
              passed.
              {request.payment === 'paid' ? ' The deducted balance day will be returned.' : ''}
            </>
          ) : (
            <>
              You are the final approver. Your decision becomes visible to the employee. While the requested
              date hasn&apos;t passed, HR can still <b>undo</b> the decision from the Decided list.
            </>
          )}
        </div>

        <div>
          <Label htmlFor="req-note">
            {isReject ? 'Rejection reason' : isUndo ? 'Undo note (optional)' : 'Approval note (optional)'}
          </Label>
          <Textarea
            id="req-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={isReject ? 'Required for rejection…' : isUndo ? 'Why is this decision being undone?…' : 'Optional note…'}
          />
        </div>
      </div>
    </Dialog>
  )
}
