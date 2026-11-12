import { CalendarDays, Clock3, LogOut, Receipt, Repeat2, Stethoscope, TriangleAlert, Wallet } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { formatDate, relativeDayLabel, tenureLabel } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { RequestListItem } from '../api/requests.api'
import { isDecisionUndoable, requestStatusLabel, requestTypeLabel, requestUrgency } from '../lib/request-status'

/** Type glyphs the mock draws inside the avatar's corner chip. */
const TYPE_ICONS: Record<string, typeof CalendarDays> = {
  // Catalog labels (RequestTypeCatalog) + the legacy labels older rows carry.
  'Annual Leave': CalendarDays,
  'Day Off': CalendarDays,
  'Paid Holiday': CalendarDays,
  'Sick Leave': Stethoscope,
  'Late Attendance': TriangleAlert,
  'Late Arrival': TriangleAlert,
  'Early Leave': Clock3,
  'Leave Early': Clock3,
  'Check-in Correction': Clock3,
  'Shift Swap': Repeat2,
  'Weekly Off Swap': Repeat2,
  'Salary Advance': Wallet,
  'Deduction Correction': Receipt,
  Resignation: LogOut,
}

export function UrgencyTag({ request }: { request: RequestListItem }) {
  switch (requestUrgency(request)) {
    case 'Notice':
      return <Badge color="purple" className="text-[9px]">Notice Period</Badge>
    case 'Urgent':
      return <Badge color="red" className="text-[9px]">Urgent</Badge>
    case 'Review':
      return <Badge color="yellow" className="text-[9px]">BM Rejected</Badge>
    default:
      return <Badge color="blue" className="text-[9px]">Normal</Badge>
  }
}

export interface RequestCardProps {
  request: RequestListItem
  canDecide: boolean
  onDecide: (request: RequestListItem, mode: 'approve' | 'reject' | 'undo') => void
  onDetail: (request: RequestListItem) => void
  onArchive: (request: RequestListItem, restore: boolean) => void
}

/** One inbox card: identity, request/reason/BM/balance rows, timeline, actions. */
export function RequestCard({ request, canDecide, onDecide, onDetail, onArchive }: RequestCardProps) {
  // A stage-1 request is still decidable here: HR takes the final decision when no
  // branch manager is assigned.
  const pending = request.status === 'Pending HR Review' || request.awaitingManager
  const decided = !pending && request.status !== 'Archived'
  const undoable = decided && canDecide && isDecisionUndoable(request)
  const isFinal = decided && !isDecisionUndoable(request)
  const relative = relativeDayLabel(request.requestedDate)
  const tenure = tenureLabel(request.hireDate)
  const balance = request.leaveBalance
  const typeLabel = requestTypeLabel(request.type)
  const Icon = TYPE_ICONS[typeLabel] ?? CalendarDays
  const label = 'pt-px text-[9px] font-semibold uppercase tracking-wide text-charcoal-400'

  const payLabel = request.status === 'Approved' && balance ? (request.payment === 'paid' ? 'Paid' : 'Unpaid') : null

  return (
    <div className="rounded-xl border border-charcoal-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="relative flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
              {request.initials || '?'}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-charcoal-200 bg-white">
              <Icon className="h-2.5 w-2.5 text-charcoal-500" aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-charcoal-900">{request.employee}</p>
              <Badge status={request.awaitingManager ? 'Awaiting Manager' : request.status} className="text-[9px]">
                {requestStatusLabel(request.status, request.awaitingManager)}
              </Badge>
              {pending && <UrgencyTag request={request} />}
              {isFinal && <Badge className="text-[9px]">Final</Badge>}
            </div>
            <p className="mt-0.5 text-[10px] text-charcoal-500">
              {request.position && `${request.position}${request.level ? ` · ${request.level}` : ''} · `}
              {request.gym}
              {tenure && ` · ${tenure} tenure`}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 whitespace-nowrap text-right text-[9px] leading-4 text-charcoal-400">
          ID R{request.id}
          {request.employeeNumber && (
            <>
              <br />
              <span className="text-charcoal-300">{request.employeeNumber}</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[58px_1fr] gap-x-2 gap-y-1">
        <span className={label}>Request</span>
        <span className="text-[11px] text-charcoal-800">
          <span className="font-semibold text-charcoal-900">{typeLabel}</span>
          <span className="mx-1 text-charcoal-300">·</span>
          {formatDate(request.requestedDate)}
          {request.endDate && request.endDate !== request.requestedDate ? ` – ${formatDate(request.endDate)}` : ''}
          {relative && (
            <span className={cn('ml-1', relative.soon ? 'font-semibold text-brand-600' : 'text-charcoal-400')}>
              {relative.text}
            </span>
          )}
        </span>

        <span className={label}>Reason</span>
        <span className="text-[11px] text-charcoal-600">{request.reason ? `“${request.reason}”` : '—'}</span>

        {request.bmDecision && (
          <>
            <span className={label}>BM</span>
            <span className="text-[11px]">
              <span className={cn('font-semibold', request.bmDecision === 'Approved' ? 'text-brand-700' : 'text-red-700')}>
                {request.bmDecision}
              </span>
              {request.bmComment && <span className="text-charcoal-500"> — {request.bmComment}</span>}
            </span>
          </>
        )}

        {balance && (
          <>
            <span className={label}>Balance</span>
            <span className="text-[11px]">
              <span className={cn('font-semibold', balance.left <= 0 ? 'text-red-600' : 'text-brand-600')}>
                {balance.left}/{balance.total}
              </span>{' '}
              <span className="text-charcoal-500">
                left
                {pending
                  ? balance.left <= 0
                    ? ' · HR chooses paid/unpaid'
                    : ` · ${balance.afterApproval} after approval`
                  : ''}
              </span>
              {payLabel && (
                <Badge color={payLabel === 'Paid' ? 'green' : 'red'} className="ml-1 text-[8px]">
                  {payLabel}
                </Badge>
              )}
            </span>
          </>
        )}
      </div>

      {request.awaitingManager && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
          No manager decision recorded yet — a decision here records the final outcome.
        </p>
      )}

      {request.timeline.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg bg-charcoal-50/60 px-2.5 py-1.5">
          {request.timeline.map((step, index) => (
            <span key={`${step.step}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 && <span className="mr-1 text-[9px] text-charcoal-300">→</span>}
              <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', step.done ? 'bg-brand-500' : 'bg-charcoal-200')} />
              <span className={cn('text-[9px] font-medium', step.done ? 'text-charcoal-700' : 'text-charcoal-400')}>
                {step.step}
              </span>
              <span className="text-[8px] text-charcoal-400">{step.date}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {pending && canDecide && (
          <>
            <Button size="sm" variant="primary" className="min-w-[110px] flex-1" onClick={() => onDecide(request, 'approve')}>
              Approve
            </Button>
            <Button size="sm" variant="dangerOutline" className="min-w-[110px] flex-1" onClick={() => onDecide(request, 'reject')}>
              Reject
            </Button>
          </>
        )}
        {undoable && (
          <Button size="sm" variant="dangerOutline" className="min-w-[110px] flex-1" onClick={() => onDecide(request, 'undo')}>
            Undo Decision
          </Button>
        )}
        <Button size="sm" variant="ghost" className="min-w-[90px] flex-1" onClick={() => onDetail(request)}>
          {pending && !canDecide ? 'View BM Log' : 'Detail'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-w-[90px] flex-1"
          onClick={() => onArchive(request, request.status === 'Archived')}
        >
          {request.status === 'Archived' ? 'Restore' : 'Archive'}
        </Button>
      </div>
    </div>
  )
}
