import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, CircleDot, MinusCircle, Undo2 } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatDateTime } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { getRequest } from '../../requests/api/requests.api'
import type { EmployeeRequestRow } from '../../requests/api/requests.api'

export interface RequestDetailDialogProps {
  /** Row the sheet knows about; the dialog fetches the full record from it. */
  row: EmployeeRequestRow | null
  canDecide: boolean
  busy: boolean
  onClose: () => void
  /** Cover / unscheduled attendance passes the day count the day is worth. */
  onApprove: (id: number, calculatedDays?: number) => void
  onReject: (id: number) => void
  onUndo: (id: number) => void
  onAddDeduction: (row: EmployeeRequestRow) => void
}

/** Request types whose approval must also price the day in days. */
const COVER_TYPES = new Set(['Unscheduled Attendance'])

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-charcoal-100 py-1">
      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">{label}</span>
      <span className="text-right text-[11px] font-medium text-charcoal-800">{value}</span>
    </div>
  )
}

/**
 * Full record behind one monthly request: dates, balance snapshot, both decision
 * stages and the timeline — plus the actions the sheet can take on it.
 */
export default function RequestDetailDialog({
  row,
  canDecide,
  busy,
  onClose,
  onApprove,
  onReject,
  onUndo,
  onAddDeduction,
}: RequestDetailDialogProps) {
  const [coverDays, setCoverDays] = useState<string | null>(null)
  const detail = useQuery({
    queryKey: ['payroll', 'request', row?.id],
    queryFn: ({ signal }) => getRequest(row!.id, signal),
    enabled: row != null,
  })

  if (!row) return null

  const request = detail.data
  const isCover = COVER_TYPES.has(row.type)
  const actionable = request ? request.status === 'Pending' || request.status === 'Pending HR Review' : row.status === 'Pending' || row.status === 'Pending HR Review'
  const decided = request ? request.status === 'Approved' || request.status === 'Rejected' : row.status === 'Approved' || row.status === 'Rejected'

  const confirmCover = () => {
    const days = Number(coverDays)
    if (!Number.isFinite(days) || days <= 0) return
    onApprove(row.id, days)
  }

  return (
    <Modal
      open
      width="wide"
      title={`${row.type} #${row.id}`}
      subtitle={`${formatDate(row.requestedDate)}${row.endDate && row.endDate !== row.requestedDate ? ` – ${formatDate(row.endDate)}` : ''}${row.calculatedDays != null ? ` · ${row.calculatedDays} day(s)` : ''}`}
      onClose={onClose}
      footer={
        <div className="w-full space-y-2">
          {/* Cover / extra: approving it prices the day, so ask for the day count first. */}
          {canDecide && actionable && isCover && coverDays != null && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-2.5 py-1.5">
              <span className="text-[11px] font-semibold text-charcoal-700">
                How many days is this cover worth?
              </span>
              <span className="flex items-center gap-1.5">
                {[1, 2, 3].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setCoverDays(String(days))}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[11px] font-bold transition-colors',
                      Number(coverDays) === days
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-charcoal-700 ring-1 ring-charcoal-200 hover:bg-charcoal-50',
                    )}
                  >
                    {days}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={coverDays}
                  onChange={(event) => setCoverDays(event.target.value)}
                  className="h-6 w-14 rounded border border-charcoal-300 bg-white px-1 text-right text-[11px] font-bold text-charcoal-900 outline-none"
                  aria-label="Cover days"
                />
                <span className="text-[10px] font-semibold text-charcoal-500">day(s)</span>
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {canDecide && actionable && isCover && coverDays == null && (
              <Button
                size="sm"
                variant="success"
                className="h-7 px-2 text-[11px] font-bold"
                disabled={busy}
                onClick={() => setCoverDays(String(row.calculatedDays ?? 1))}
              >
                <Check className="h-3 w-3" aria-hidden="true" /> Approve…
              </Button>
            )}
            {canDecide && actionable && isCover && coverDays != null && (
              <>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px] font-semibold" onClick={() => setCoverDays(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  className="h-7 px-2 text-[11px] font-bold"
                  disabled={busy || !(Number(coverDays) > 0)}
                  onClick={confirmCover}
                >
                  <Check className="h-3 w-3" aria-hidden="true" /> Approve {Number(coverDays) > 0 ? `${coverDays} day(s)` : ''}
                </Button>
              </>
            )}

            {canDecide && actionable && !isCover && (
              <Button size="sm" variant="success" className="h-7 px-2 text-[11px] font-bold" disabled={busy} onClick={() => onApprove(row.id)}>
                <Check className="h-3 w-3" aria-hidden="true" /> Approve
              </Button>
            )}
            {canDecide && actionable && (
              <Button size="sm" variant="danger" className="h-7 px-2 text-[11px] font-bold" disabled={busy} onClick={() => onReject(row.id)}>
                Reject
              </Button>
            )}
            {canDecide && decided && (
              <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px] font-bold" disabled={busy} onClick={() => onUndo(row.id)}>
                <Undo2 className="h-3 w-3" aria-hidden="true" /> Undo decision
              </Button>
            )}
            <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px] font-semibold" onClick={() => onAddDeduction(row)}>
              <MinusCircle className="h-3 w-3" aria-hidden="true" /> Add deduction
            </Button>
          </div>
        </div>
      }
    >
      {detail.isLoading ? (
        <p className="py-6 text-center text-xs text-charcoal-400">Loading request…</p>
      ) : detail.isError ? (
        <p className="py-4 text-center text-[11px] text-red-600">{describeApiError(detail.error)}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge status={request?.status ?? row.status} className="text-[9px] font-bold">
              {request?.status ?? row.status}
            </Badge>
            {row.payment && (
              <span className="rounded-full bg-charcoal-100 px-2 py-0.5 text-[9px] font-bold uppercase text-charcoal-600">
                {row.payment}
              </span>
            )}
            {request?.awaitingManager && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                Awaiting branch manager
              </span>
            )}
            {request?.hasAttachment && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">Attachment</span>
            )}
          </div>

          <div>
            <Field label="Employee" value={request ? `${request.employee} · ${request.position}` : undefined} />
            <Field label="Employee no." value={request?.employeeNumber} />
            <Field label="Branch" value={request?.gym} />
            <Field label="Filed" value={formatDateTime(row.submittedAt ?? row.submittedDate)} />
            <Field label="Days" value={row.calculatedDays != null ? String(row.calculatedDays) : null} />
            <Field label="Payment" value={row.payment} />
          </div>

          <div className="rounded-lg bg-charcoal-50 p-2">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">Reason</p>
            <p className="whitespace-pre-line text-[11px] text-charcoal-700">{row.reason || '—'}</p>
          </div>

          {request?.leaveBalance && (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {[
                { label: 'Entitlement', value: request.leaveBalance.total },
                { label: 'Used', value: request.leaveBalance.used },
                { label: 'Left', value: request.leaveBalance.left },
                { label: 'After approval', value: request.leaveBalance.afterApproval },
              ].map((tile) => (
                <div key={tile.label} className="rounded border border-charcoal-200 px-2 py-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-charcoal-400">{tile.label}</p>
                  <p className="text-sm font-bold text-charcoal-900">{tile.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="rounded-lg border border-charcoal-200 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">Branch manager</p>
              <p className="text-[11px] font-bold text-charcoal-800">{request?.bmDecision ?? 'No decision yet'}</p>
              {request?.bmComment && <p className="mt-0.5 text-[10px] text-charcoal-500">{request.bmComment}</p>}
            </div>
            <div className="rounded-lg border border-charcoal-200 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">HR</p>
              <p className="text-[11px] font-bold text-charcoal-800">{request?.hrDecision ?? 'No decision yet'}</p>
              {request?.hrComment && <p className="mt-0.5 text-[10px] text-charcoal-500">{request.hrComment}</p>}
            </div>
          </div>

          {request?.timeline && request.timeline.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">Timeline</p>
              <ol className="space-y-1">
                {request.timeline.map((step, stepIndex) => (
                  <li key={`${step.step}-${stepIndex}`} className="flex items-center gap-1.5 text-[11px]">
                    <CircleDot
                      className={step.done ? 'h-3 w-3 flex-shrink-0 text-emerald-600' : 'h-3 w-3 flex-shrink-0 text-charcoal-300'}
                      aria-hidden="true"
                    />
                    <span className={step.done ? 'font-semibold text-charcoal-800' : 'text-charcoal-400'}>{step.step}</span>
                    {/* The API already sends a ready stamp ("Nov 12, 2026 · 03:21") or "Pending". */}
                    <span className="text-[10px] text-charcoal-400">{step.date}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
