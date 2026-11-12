import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Plus, Receipt, Undo2, X } from 'lucide-react'
import { Badge, type BadgeColor } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Avatar } from '../../../components/ui/avatar'
import { Select } from '../../../components/ui/select'
import { formatDate, formatDateTime, formatEGP, initialsOf } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { describeApiError } from '../../../lib/api-client'
import {
  getEmployeeRequestRows,
  postDecide,
  postUndoDecision,
} from '../../requests/api/requests.api'
import type { ToastTone } from '../../dashboard/hooks/useMockToast'
import {
  useAddDeduction,
  useCloseEntry,
  useReopenEntry,
  useReviewCandidate,
  useUpdateBonus,
  useUpdateEntryAttendance,
} from '../hooks/usePayroll'
import type { DeductionLine, DeductionSource, PayrollPeriodDetail } from '../api/payroll.api'
import { isEntryClosed, overtimePayOf, pendingLinesOf } from '../lib/payroll-calc'
import PayslipDialog from './PayslipDialog'
import AttendanceDaysDialog, { type AttendanceBucket } from './AttendanceDaysDialog'
import RequestDetailDialog from './RequestDetailDialog'
import type { EmployeeRequestRow } from '../../requests/api/requests.api'

/** Inline editor values (strings so the inputs can be cleared while typing). */
type AttendanceDraft = {
  daysAttended: string
  weeklyOffs: string
  approvedLeaves: string
  overtimeHours: string
  lateArrivals: string
  unexcusedAbsences: string
}

/** How each day-log kind is labelled and toned in the month schedule. */
const SCHEDULE_LABEL: Record<string, string> = {
  Attended: 'Attended',
  Late: 'Late',
  EarlyCheckout: 'Early Leaving',
  EarlyLeave: 'Early Leave',
  MissingCheckout: 'No check-out',
  Absent: 'Absent',
  WeeklyOff: 'Weekly off',
  AnnualLeave: 'Annual leave',
  SickLeave: 'Sick leave',
  ApprovedLeave: 'Leave',
  Cover: 'Cover / extra',
  CoverRejected: 'Unapproved cover',
  Scheduled: 'Upcoming',
  Unscheduled: 'No schedule',
}

const SCHEDULE_TONE: Record<string, BadgeColor> = {
  Attended: 'green',
  Late: 'yellow',
  EarlyCheckout: 'orange',
  EarlyLeave: 'purple',
  MissingCheckout: 'gray',
  Absent: 'red',
  WeeklyOff: 'blue',
  AnnualLeave: 'purple',
  SickLeave: 'purple',
  ApprovedLeave: 'purple',
  Cover: 'green',
  CoverRejected: 'red',
  Scheduled: 'gray',
  Unscheduled: 'gray',
}

export interface SettlementSheetProps {
  period: PayrollPeriodDetail
  employeeId: number
  /** payroll-level Edit: renders the write controls (UX gate only). */
  canEdit: boolean
  onBack: () => void
  onSelectEmployee: (employeeId: number) => void
  onToast: (message: string, tone?: ToastTone) => void
}
/**
 * One line of the deductions card (source badge, approve/waive for Pending lines).
 * The branch can re-price a pending line before approving it — absences are only a
 * suggested 3 days, so HR owns the final amount.
 */
function DeductionRow({
  line,
  locked,
  closed,
  canEdit,
  onDecision,
  onDays,
  deciding,
}: {
  line: DeductionLine
  locked: boolean
  closed: boolean
  canEdit: boolean
  onDecision: (line: DeductionLine, approved: boolean) => void
  onDays: (line: DeductionLine, days: number) => void
  deciding: boolean
}) {
  const pending = line.status === 'Pending'
  const accepted = line.status === 'Accepted' || line.status === 'Approved'
  const rejected = line.status === 'Rejected'
  const biometric = line.source === 'biometric'
  const [daysDraft, setDaysDraft] = useState<string | null>(null)
  // Only a line raised from an attendance candidate knows its day count.
  const editable = canEdit && !locked && !closed

  const commitDays = () => {
    if (daysDraft == null) return
    const parsed = Number(daysDraft)
    setDaysDraft(null)
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== line.days) {
      onDays(line, parsed)
    }
  }
  return (
    <div
      className={cn(
        'rounded-lg border p-2 text-xs transition-all',
        pending
          ? 'border-amber-200 bg-amber-50/60 ring-1 ring-amber-100'
          : accepted
            ? 'border-charcoal-200 bg-charcoal-50/70'
            : 'border-charcoal-200 bg-charcoal-50/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Badge color={biometric ? 'blue' : 'purple'} className="text-[8px] font-bold">
              {biometric ? 'Biometric' : 'Manager'}
            </Badge>
            <span className="truncate text-xs font-bold text-charcoal-900">{line.label || line.reason}</span>
            <span className="text-[9px] font-semibold text-charcoal-400">· {formatDate(line.date)}</span>
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-charcoal-500">{line.reason || '—'}</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {/* The day count is the editable part: "Edit" opens it, one day per step. */}
          {daysDraft != null ? (
            <input
              autoFocus
              type="number"
              min={1}
              step={1}
              value={daysDraft}
              onChange={(event) => setDaysDraft(event.target.value)}
              onBlur={commitDays}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitDays()
                if (event.key === 'Escape') setDaysDraft(null)
              }}
              className="w-14 rounded border border-brand-400 px-1 py-0.5 text-right text-xs font-bold text-charcoal-900 outline-none"
              aria-label="Deduction days"
            />
          ) : line.days != null ? (
            <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-bold text-charcoal-600">
              {line.days} day{line.days === 1 ? '' : 's'}
              {editable && (
                <button
                  type="button"
                  onClick={() => setDaysDraft(String(line.days))}
                  title="Edit how many days are deducted — the amount follows"
                  className="rounded px-1 py-0.5 text-[10px] font-bold text-brand-700 underline decoration-dotted hover:bg-brand-50 hover:text-charcoal-900"
                >
                  Edit
                </button>
              )}
            </span>
          ) : null}

          <span className={cn('text-xs font-bold', rejected ? 'text-charcoal-400 line-through' : 'text-red-600')}>
            − {formatEGP(line.amount)}
          </span>

          {pending && !locked && !closed ? (
            canEdit ? (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="success"
                  className="h-5 px-1.5 text-[10px] font-bold"
                  onClick={() => onDecision(line, true)}
                  loading={deciding}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-5 px-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50"
                  onClick={() => onDecision(line, false)}
                >
                  Reject
                </Button>
              </div>
            ) : (
              <span className="rounded bg-charcoal-100 px-1 py-0.5 text-[9px] font-bold text-charcoal-400" title="Resolving deductions requires payroll.edit">
                🔒 payroll.edit
              </span>
            )
          ) : accepted ? (
            <div className="flex items-center gap-1">
              <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-700">Approved</span>
              {/* A decision is not a dead end: the sheet can still reject it (and back). */}
              {canEdit && !locked && !closed && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-5 px-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50"
                  onClick={() => onDecision(line, false)}
                  loading={deciding}
                >
                  Reject
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="rounded bg-charcoal-100 px-1 py-0.5 text-[9px] font-bold text-charcoal-500 line-through">
                Rejected
              </span>
              {canEdit && !locked && !closed && (
                <Button
                  size="sm"
                  variant="success"
                  className="h-5 px-1.5 text-[10px] font-bold"
                  onClick={() => onDecision(line, true)}
                  loading={deciding}
                >
                  Approve
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact employee settlement sheet (mock renderPayrollSettlementSheet): the
 * financial reconciliation on the left, attendance/punch/request evidence on the right.
 */
export default function SettlementSheet({
  period,
  employeeId,
  canEdit,
  onBack,
  onToast,
}: SettlementSheetProps) {
  const entry = period.items.find((item) => item.employeeId === employeeId) ?? period.items[0]
  const locked = period.locked
  const closed = entry ? isEntryClosed(entry) : false
  const pendingCount = entry ? pendingLinesOf(entry) : 0

  const [addingLine, setAddingLine] = useState(false)
  const [source, setSource] = useState<DeductionSource>('manager')
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [bonusDraft, setBonusDraft] = useState<string | null>(null)
  const [bonusSaving, setBonusSaving] = useState(false)
  const [payslipOpen, setPayslipOpen] = useState(false)
  const [daysBucket, setDaysBucket] = useState<AttendanceBucket | null>(null)
  const [attendanceDraft, setAttendanceDraft] = useState<AttendanceDraft | null>(null)
  const [detailRow, setDetailRow] = useState<EmployeeRequestRow | null>(null)

  const updateBonus = useUpdateBonus(period.id)
  const updateAttendance = useUpdateEntryAttendance(period.id)
  const addDeduction = useAddDeduction(period.id)
  const closeEntry = useCloseEntry(period.id)
  const reopenEntry = useReopenEntry(period.id)
  const review = useReviewCandidate()

  const queryClient = useQueryClient()
  const [panel, setPanel] = useState<'schedule' | 'requests' | 'deductions'>('schedule')

  // The whole month's conversation with this employee: everything filed, whatever the
  // stage — the sheet's decisions read against it.
  const monthRequests = useQuery({
    queryKey: ['payroll', 'employee-requests', employeeId],
    queryFn: ({ signal }) => getEmployeeRequestRows(employeeId, signal),
    enabled: entry != null,
  })

  const decideRequest = useMutation({
    mutationFn: ({ id, decision, days }: { id: number; decision: 'approved' | 'rejected'; days?: number }) =>
      postDecide(id, {
        decision,
        calculatedDays: decision === 'approved' ? days : undefined,
        comment: decision === 'rejected' ? 'Rejected during payroll settlement.' : undefined,
      }),
    onSuccess: async () => {
      onToast('Request updated')
      await queryClient.invalidateQueries({ queryKey: ['payroll'] })
      await queryClient.invalidateQueries({ queryKey: ['portal', 'requests'] })
    },
    onError: (error) => onToast(describeApiError(error), 'error'),
  })

  const undoRequest = useMutation({
    mutationFn: (id: number) => postUndoDecision(id, 'Re-opened from payroll settlement.'),
    onSuccess: async () => {
      onToast('Decision undone')
      await queryClient.invalidateQueries({ queryKey: ['payroll'] })
      await queryClient.invalidateQueries({ queryKey: ['portal', 'requests'] })
    },
    onError: (error) => onToast(describeApiError(error), 'error'),
  })

  if (!entry) return null

  const base = entry.baseSalary
  const otPay = overtimePayOf(entry)
  const gross = entry.gross
  const approvedDeductions = entry.deductions
  const net = entry.net
  const attendance = entry.attendance
  // The bonus is entered in days like a deduction, on the same daily rate (base ÷ 30).
  const dailyRate = base > 0 ? base / 30 : 0
  const bonusDays = dailyRate > 0 ? Math.round((entry.bonus / dailyRate) * 100) / 100 : 0
  const bonusValue = bonusDraft ?? String(bonusDays)
  const bonusAmount = bonusDraft != null
    ? Math.round((Number(bonusDraft) || 0) * dailyRate * 100) / 100
    : entry.bonus

  // Only the rows that fall inside this sheet's month: the sheet reconciles one period.
  const periodMonth = (() => {
    const parsed = new Date(`${period.period} 1`)
    return Number.isNaN(parsed.getTime())
      ? null
      : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
  })()

  const monthRows = (monthRequests.data ?? []).filter((request) => {
    if (!periodMonth) return true
    const start = request.requestedDate?.slice(0, 7)
    const end = (request.endDate ?? request.requestedDate)?.slice(0, 7)
    return start === periodMonth || end === periodMonth
  })

  const startAttendanceEdit = () => {
    setAttendanceDraft({
      daysAttended: String(attendance?.daysAttended ?? entry.days),
      weeklyOffs: String(attendance?.weeklyOffs ?? 0),
      approvedLeaves: String(attendance?.approvedLeaves ?? 0),
      overtimeHours: String(attendance?.overtimeHours ?? entry.overtime),
      lateArrivals: String(attendance?.lateArrivals ?? 0),
      unexcusedAbsences: String(attendance?.unexcusedAbsences ?? 0),
    })
  }

  const saveAttendance = async () => {
    if (!attendanceDraft) return
    const parsed = {
      daysAttended: Number(attendanceDraft.daysAttended),
      weeklyOffs: Number(attendanceDraft.weeklyOffs),
      approvedLeaves: Number(attendanceDraft.approvedLeaves),
      overtimeHours: Number(attendanceDraft.overtimeHours),
      lateArrivals: Number(attendanceDraft.lateArrivals),
      unexcusedAbsences: Number(attendanceDraft.unexcusedAbsences),
    }
    if (Object.values(parsed).some((value) => !Number.isFinite(value) || value < 0)) {
      onToast('Attendance values must be zero or a positive number', 'warning')
      return
    }

    try {
      await updateAttendance.mutateAsync({ employeeId: entry.employeeId, body: parsed })
      onToast('Attendance corrected on the settlement sheet', 'success')
      setAttendanceDraft(null)
    } catch (error) {
      onToast(describeApiError(error), 'error')
    }
  }

  /** Bonus is entered in days; the amount follows from the same daily rate. */
  const commitBonus = async (rawDays: string) => {
    const days = Number(rawDays)
    if (!Number.isFinite(days) || days < 0) {
      setBonusDraft(null)
      onToast('Bonus days must be zero or more.', 'error')
      return
    }
    if (dailyRate <= 0) {
      setBonusDraft(null)
      onToast('This employee has no base salary to price a bonus day.', 'error')
      return
    }

    const value = Math.round(days * dailyRate * 100) / 100
    if (value === entry.bonus) {
      setBonusDraft(null)
      return
    }
    setBonusSaving(true)
    try {
      await updateBonus.mutateAsync({ employeeId: entry.employeeId, bonus: value })
      setBonusDraft(null)
      onToast(`Bonus set to ${days} day${days === 1 ? '' : 's'} (${formatEGP(value)}) — net pay recalculated.`)
    } catch (err) {
      onToast(describeApiError(err), 'error')
    } finally {
      setBonusSaving(false)
    }
  }

  const saveLine = async () => {
    const parsed = Number(amount)
    if (!reason.trim()) {
      onToast('Please specify a reason.', 'error')
      return
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      onToast('The deduction amount must be greater than zero.', 'error')
      return
    }
    try {
      await addDeduction.mutateAsync({
        employeeId: entry.employeeId,
        body: { source, reason: reason.trim(), amount: parsed },
      })
      setAddingLine(false)
      setReason('')
      setAmount('')
      setSource('manager')
      onToast(`Deduction added for ${entry.name} (${formatEGP(parsed)}).`)
    } catch (err) {
      onToast(describeApiError(err), 'error')
    }
  }

  /** Track a line's amount before approving it: the branch may re-price any pending candidate. */
  const decideLineWithAmount = async (line: DeductionLine, approved: boolean) => {
    try {
      await review.mutateAsync({ id: line.id, decision: approved ? 'Accepted' : 'Rejected' })
      onToast(approved ? `Deduction approved for ${entry.name}.` : `Deduction waived for ${entry.name}.`, 'info')
    } catch (err) {
      onToast(describeApiError(err), 'error')
    }
  }

  /** HR edits days, not money: the server derives the amount from the line's price per day. */
  const setLineDays = async (line: DeductionLine, days: number) => {
    try {
      await review.mutateAsync({ id: line.id, days })
      onToast(`Deduction set to ${days} day${days === 1 ? '' : 's'} for ${entry.name}.`, 'info')
    } catch (err) {
      onToast(describeApiError(err), 'error')
    }
  }

  /** Opens the deduction form pre-filled from a request, so the sheet can price it. */
  const startDeductionFrom = (row: EmployeeRequestRow) => {
    setDetailRow(null)
    setPanel('deductions')
    setSource('manager')
    setReason(`${row.type} #${row.id}${row.reason ? ` — ${row.reason}` : ''}`)
    setAmount('')
    setAddingLine(true)
  }

  const settle = async () => {
    try {
      await closeEntry.mutateAsync(entry.employeeId)
      onToast(`✓ Monthly payroll & expense account closed for ${entry.name}! Net Pay: ${formatEGP(net)}`)
    } catch (err) {
      onToast(describeApiError(err), 'error')
    }
  }

  const reopen = async () => {
    try {
      await reopenEntry.mutateAsync(entry.employeeId)
      onToast(`Account re-opened for edits: ${entry.name}`, 'info')
    } catch (err) {
      onToast(describeApiError(err), 'error')
    }
  }

  const attendanceRow = (bucket: AttendanceBucket, label: string, value: string, tone?: string) => (
    <button
      type="button"
      onClick={() => setDaysBucket(bucket)}
      title={`Show the ${label.toLowerCase()} behind this number`}
      className="group flex w-full items-baseline justify-between gap-2 border-b border-charcoal-100 py-0.5 text-left transition-colors hover:bg-charcoal-50"
    >
      <span className="truncate text-charcoal-500 group-hover:text-charcoal-700">{label}</span>
      <span className={cn('flex flex-shrink-0 items-center gap-1 whitespace-nowrap font-bold text-charcoal-900', tone)}>
        {value}
        <ChevronRight
          className="h-3 w-3 flex-shrink-0 text-charcoal-300 transition-colors group-hover:text-brand-600"
          aria-hidden="true"
        />
      </span>
    </button>
  )

  return (
    <div className="flex flex-col gap-2 lg:h-[calc(100dvh-6rem)]">
      {/* Who this sheet settles — never a nameless page. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-charcoal-200 bg-white px-2.5 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-6 flex-shrink-0 px-2 text-[10px] font-bold"
            onClick={onBack}
            title="Back to the whole staff list"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            All Staff
          </Button>
          <span className="text-charcoal-300">|</span>
          <Avatar name={entry.initials || initialsOf(entry.name)} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-charcoal-900">{entry.name}</p>
            <p className="truncate text-[10px] text-charcoal-500">
              {entry.position}
              {entry.employeeNumber ? ` · ${entry.employeeNumber}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="text-[10px] font-semibold text-charcoal-500">{period.period}</span>
          <Badge color={closed ? 'green' : pendingCount > 0 ? 'yellow' : 'blue'} className="text-[9px] font-bold">
            {closed ? 'Closed & Settled' : pendingCount > 0 ? `${pendingCount} Actions Needed` : 'Ready to Close'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)]">
        {/* LEFT — financial reconciliation */}
        <div className="space-y-2 lg:col-span-7">
          <div className="rounded-lg border border-charcoal-200 bg-white p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-charcoal-200 pb-1.5">
              <h3 className="truncate text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
                1. Monthly Earnings &amp; Additions
              </h3>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPayslipOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-charcoal-500 hover:text-brand-700"
                  title="Payslip preview"
                >
                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                  Payslip
                </button>
                {!canEdit ? (
                  <span className="rounded-md bg-charcoal-100 px-2 py-0.5 text-[10px] font-bold text-charcoal-600" title="Editing payroll requires payroll.edit">
                    🔒 Read-only
                  </span>
                ) : closed ? (
                  <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    ✓ Closed
                    {!locked && (
                      <button type="button" className="underline decoration-dotted hover:text-charcoal-900" onClick={reopen} title="Re-open for adjustments">
                        Edit
                      </button>
                    )}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    className="h-6 px-2 text-[10px] font-bold"
                    onClick={settle}
                    loading={closeEntry.isPending}
                    disabled={pendingCount > 0}
                    title={pendingCount > 0 ? 'Approve or waive every pending deduction first' : 'Close and settle this account'}
                  >
                    ✓ Close &amp; Settle
                  </Button>
                )}
              </div>
            </div>

            <div className="divide-y divide-charcoal-100 text-[11px]">
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-charcoal-500">Base salary</span>
                <span className="font-bold text-charcoal-900">{formatEGP(base)}</span>
              </div>

              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-charcoal-500">
                  Deductions{entry.deductionLines.length > 0 ? ` (${entry.deductionLines.length})` : ''}
                </span>
                <span className={cn('font-bold', approvedDeductions > 0 ? 'text-red-600' : 'text-charcoal-400')}>
                  {approvedDeductions > 0 ? `− ${formatEGP(approvedDeductions)}` : formatEGP(0)}
                </span>
              </div>

              {otPay > 0 && (
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-charcoal-500">Overtime ({entry.overtime}h)</span>
                  <span className="font-bold text-emerald-600">+ {formatEGP(otPay)}</span>
                </div>
              )}

              <label
                className={cn('flex cursor-pointer items-center justify-between gap-2 py-1', (locked || closed || !canEdit) && 'cursor-not-allowed')}
                title={closed ? 'Reopen the sheet to change the bonus' : 'Give the bonus in days — the amount follows'}
              >
                <span className="min-w-0">
                  <span className="text-charcoal-500">Bonus</span>
                  <span className="ms-1 text-[9px] text-charcoal-400">
                    {closed || locked ? '(sheet closed)' : canEdit ? '(in days)' : '(read-only)'}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={bonusValue}
                    disabled={locked || closed || !canEdit || bonusSaving}
                    onChange={(event) => setBonusDraft(event.target.value)}
                    onBlur={(event) => commitBonus(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    className="h-5 w-14 rounded border border-brand-300 bg-white px-1 py-0 text-right text-[11px] font-bold text-charcoal-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-300 disabled:opacity-60"
                    aria-label="Bonus days"
                  />
                  <span className="text-[10px] font-semibold text-charcoal-500">day{Number(bonusValue) === 1 ? '' : 's'}</span>
                  <span className={cn('w-20 text-right text-[11px] font-bold', bonusAmount > 0 ? 'text-emerald-600' : 'text-charcoal-400')}>
                    {bonusAmount > 0 ? `+ ${formatEGP(bonusAmount)}` : formatEGP(0)}
                  </span>
                </span>
              </label>
            </div>

            {/* The card is the month's summary: what is earned, what is taken, the total. */}
            <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-charcoal-200 pt-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-charcoal-700">Total (net)</span>
              <span className="text-sm font-black text-brand-800">{formatEGP(net)}</span>
            </div>
          </div>
        </div>

        {/* FULL WIDTH — month schedule, requests, deductions. Placed on the second grid
            row so it uses the space under both columns instead of leaving the right one
            half empty. */}
        <div className="flex min-h-0 flex-col gap-2 lg:col-span-12 lg:row-start-2">
          <div className="flex flex-shrink-0 items-center gap-1">
            {(
              [
                { key: 'schedule' as const, label: 'Month Schedule' },
                { key: 'requests' as const, label: `Requests (${monthRows.length})` },
                { key: 'deductions' as const, label: `Deductions (${entry.deductionLines.length})` },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPanel(tab.key)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors',
                  panel === tab.key
                    ? 'bg-charcoal-800 text-white'
                    : 'bg-charcoal-100 text-charcoal-600 hover:text-charcoal-900',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {panel === 'schedule' && (
            <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-charcoal-200 bg-white p-2.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-200 pb-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
                  2. Month Schedule
                </h3>
                <span className="text-[10px] font-semibold text-charcoal-400">{period.period}</span>
              </div>

              {!attendance || attendance.days.length === 0 ? (
                <p className="py-6 text-center text-xs text-charcoal-400">
                  No schedule or attendance days for this month yet.
                </p>
              ) : (
                <>
                  {/* Every day of the period with the shift it carried and how the day
                      ended up — the same log the counters drill into, in full. */}
                  <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                    <table className="w-full table-fixed text-[10px]">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-charcoal-400">
                          <th className="w-[22%] py-1 pe-1 font-semibold">Day</th>
                          <th className="w-[13%] py-1 pe-1 font-semibold">Shift</th>
                          <th className="w-[13%] py-1 pe-1 font-semibold">Type</th>
                          <th className="w-[9%] py-1 pe-1 font-semibold">In</th>
                          <th className="w-[9%] py-1 pe-1 font-semibold">Out</th>
                          <th className="py-1 pe-1 font-semibold">Request</th>
                          <th className="w-[7%] py-1 font-semibold">Hrs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.days.map((day) => {
                          const weekday = new Date(`${day.date}T00:00:00`).toLocaleDateString('en-GB', {
                            weekday: 'short',
                          })
                          // Leave/cover filed for this exact day, so the row explains itself.
                          const dayRequests = monthRows.filter(
                            (request) =>
                              request.requestedDate <= day.date &&
                              (request.endDate ?? request.requestedDate) >= day.date,
                          )
                          return (
                            <tr key={`${day.date}-${day.kind}`} className="border-t border-charcoal-100">
                              <td className="whitespace-nowrap py-1 pe-1 font-medium text-charcoal-700">
                                {weekday} {formatDate(day.date)}
                              </td>
                              <td className="whitespace-nowrap py-1 pe-1 text-charcoal-500">
                                {day.shift ?? '—'}
                              </td>
                              <td className="py-1 pe-1">
                                <span title={day.note ?? undefined}>
                                  <Badge color={SCHEDULE_TONE[day.kind] ?? 'gray'} className="text-[8px] font-bold">
                                    {/* The day's meaning first: a cover day must read "Cover / extra",
                                        not the punch verdict ("On Time"). */}
                                    {SCHEDULE_LABEL[day.kind] ?? day.status ?? day.kind}
                                    {(day.earlyLeaveMinutes ?? 0) > 0 && day.kind !== 'EarlyLeave'
                                      ? ` · ${day.earlyLeaveMinutes}m`
                                      : ''}
                                  </Badge>
                                </span>
                              </td>
                              <td className="whitespace-nowrap py-1 pe-1 font-medium text-charcoal-600">
                                {day.checkIn ?? '—'}
                              </td>
                              <td className="whitespace-nowrap py-1 pe-1 font-medium text-charcoal-600">
                                {day.checkOut ?? '—'}
                              </td>
                              <td className="py-1 pe-1">
                                {dayRequests.length === 0 ? (
                                  <span className="text-charcoal-300">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {dayRequests.map((request) => (
                                      <button
                                        key={request.id}
                                        type="button"
                                        onClick={() => setDetailRow(request)}
                                        title={`${request.type} #${request.id} — ${request.status}`}
                                        className="rounded-full bg-charcoal-100 px-1.5 py-0.5 text-[9px] font-bold text-charcoal-700 hover:bg-brand-100 hover:text-brand-800"
                                      >
                                        {request.type} · {request.status === 'Pending HR Review' ? 'Pending' : request.status}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-1 font-semibold text-charcoal-700">
                                {day.workedHours > 0 ? day.workedHours : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* The month at a glance, so the table length never hides the split. */}
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-charcoal-200 pt-1.5">
                    {Object.entries(
                      attendance.days.reduce<Record<string, number>>((acc, day) => {
                        acc[day.kind] = (acc[day.kind] ?? 0) + 1
                        return acc
                      }, {}),
                    ).map(([kind, count]) => (
                      <span
                        key={kind}
                        className="rounded-full bg-charcoal-100 px-1.5 py-0.5 text-[9px] font-semibold text-charcoal-600"
                      >
                        {SCHEDULE_LABEL[kind] ?? kind}: {count}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {panel === 'requests' && (
            <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-charcoal-200 bg-white p-2.5">
              <div className="mb-2 flex items-center justify-between border-b border-charcoal-200 pb-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
                  2. Monthly Requests
                </h3>
                <span className="text-[10px] font-semibold text-charcoal-400">{period.period}</span>
              </div>

              {monthRequests.isLoading ? (
                <p className="py-4 text-center text-xs text-charcoal-400">Loading requests…</p>
              ) : monthRequests.isError ? (
                <p className="py-2 text-center text-[11px] text-red-600">
                  {describeApiError(monthRequests.error)}
                </p>
              ) : monthRows.length === 0 ? (
                <p className="py-6 text-center text-xs text-charcoal-400">
                  No requests filed for this month.
                </p>
              ) : (
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                  {monthRows.map((request) => {
                    const actionable = request.status === 'Pending' || request.status === 'Pending HR Review'
                    const decided = request.status === 'Approved' || request.status === 'Rejected'
                    const busy = decideRequest.isPending || undoRequest.isPending
                    return (
                      <div
                        key={request.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailRow(request)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setDetailRow(request)
                          }
                        }}
                        title="Open the full request"
                        className="cursor-pointer rounded border border-charcoal-200 bg-charcoal-50 p-1.5 transition-colors hover:border-brand-300 hover:bg-white"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] font-bold text-charcoal-900">
                            {request.type} <span className="font-normal text-charcoal-400">#{request.id}</span>
                          </span>
                          <Badge status={request.status} className="text-[8px] font-bold">
                            {request.status}
                          </Badge>
                        </div>

                        {/* The whole record is legible before opening the dialog: when it
                            covers, when it was filed, why, and who decided it. */}
                        <p className="mt-0.5 text-[10px] font-semibold text-charcoal-600">
                          {formatDate(request.requestedDate)}
                          {request.endDate && request.endDate !== request.requestedDate
                            ? ` – ${formatDate(request.endDate)}`
                            : ''}
                          {request.calculatedDays != null ? ` · ${request.calculatedDays} day(s)` : ''}
                          {request.payment ? ` · ${request.payment}` : ''}
                          <span className="ms-1 font-normal text-charcoal-400">
                            · filed {formatDateTime(request.submittedAt ?? request.submittedDate)}
                          </span>
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-charcoal-500">
                          {request.reason || 'No reason given'}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-charcoal-500">
                          <span>
                            {request.bmDecision
                              ? `BM ${request.bmDecision}${request.bmApprover ? ` · ${request.bmApprover}` : ''}`
                              : 'BM pending'}
                            {request.bmDecidedAt ? ` · ${formatDateTime(request.bmDecidedAt)}` : ''}
                          </span>
                          <span className="text-charcoal-300">|</span>
                          <span>{request.hrDecision ? `HR ${request.hrDecision}` : 'HR pending'}</span>
                        </p>
                        {request.bmComment && (
                          <p className="mt-0.5 truncate text-[9px] italic text-charcoal-400">
                            “{request.bmComment}”
                          </p>
                        )}

                        {canEdit && !locked && !closed && (actionable || decided) && (
                          <div className="mt-1 flex items-center gap-1">
                            {actionable && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    decideRequest.mutate({ id: request.id, decision: 'approved' })
                                  }}
                                  className="flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                                >
                                  <Check className="h-2.5 w-2.5" aria-hidden="true" /> Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    decideRequest.mutate({ id: request.id, decision: 'rejected' })
                                  }}
                                  className="flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-40"
                                >
                                  <X className="h-2.5 w-2.5" aria-hidden="true" /> Reject
                                </button>
                              </>
                            )}
                            {decided && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  undoRequest.mutate(request.id)
                                }}
                                className="flex items-center gap-0.5 rounded bg-charcoal-100 px-1.5 py-0.5 text-[9px] font-bold text-charcoal-700 hover:bg-charcoal-200 disabled:opacity-40"
                              >
                                <Undo2 className="h-2.5 w-2.5" aria-hidden="true" /> Undo
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                startDeductionFrom(request)
                              }}
                              className="ms-auto flex items-center gap-0.5 rounded bg-charcoal-100 px-1.5 py-0.5 text-[9px] font-bold text-charcoal-700 hover:bg-charcoal-200"
                            >
                              <Plus className="h-2.5 w-2.5" aria-hidden="true" /> Deduction
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {panel === 'deductions' && (
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-charcoal-200 bg-white p-2.5">
            <div className="mb-2 flex items-center justify-between border-b border-charcoal-200 pb-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
                  2. Deductions &amp; Expense Recoveries
                </h3>                <Badge color={approvedDeductions > 0 ? 'red' : 'gray'} className="text-[9px] font-bold">
                  − {formatEGP(approvedDeductions)}
                </Badge>
              </div>

              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setAddingLine((open) => !open)}
                  disabled={locked || closed}
                  className="flex items-center gap-0.5 text-[10px] font-bold text-brand-600 hover:text-brand-800 disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  {addingLine ? 'Close Form' : 'Add Line'}
                </button>
              ) : (
                <span className="text-[10px] font-semibold text-charcoal-400" title="Adding deductions requires payroll.edit">
                  🔒 Add requires payroll.edit
                </span>
              )}
            </div>

            {addingLine && canEdit && (
              <div className="mb-2 space-y-1.5 rounded border border-charcoal-200 bg-charcoal-50 p-2 text-xs">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <Select
                    value={source}
                    onChange={(event) => setSource(event.target.value as DeductionSource)}
                    aria-label="Deduction source"
                    className="px-1.5 py-0.5 text-[11px]"
                  >
                    <option value="manager">Manager Operational Charge</option>
                    <option value="biometric">Biometric Penalty</option>
                  </Select>
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Reason / Description"
                    className="rounded border border-charcoal-300 px-1.5 py-0.5 text-[11px]"
                    aria-label="Deduction reason"
                  />
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="Amount (EGP)"
                      className="w-full rounded border border-charcoal-300 px-1.5 py-0.5 text-[11px]"
                      aria-label="Deduction amount"
                    />
                    <Button size="sm" className="h-6 flex-shrink-0 px-2 text-[10px]" onClick={saveLine} loading={addDeduction.isPending}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
              {entry.deductionLines.length === 0 ? (
                <div className="py-6 text-center text-xs text-charcoal-400">
                  ✓ No deductions or expense recoveries recorded for this employee.
                </div>
              ) : (
                entry.deductionLines.map((line) => (
                  <DeductionRow
                    key={line.id}
                    line={line}
                    locked={locked}
                    closed={closed}
                    canEdit={canEdit}
                    onDecision={decideLineWithAmount}
                    onDays={setLineDays}
                    deciding={review.isPending}
                  />
                ))
              )}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-charcoal-200 pt-2 text-xs">
              <span className="font-medium text-charcoal-500">
                {formatEGP(gross)} gross − {formatEGP(approvedDeductions)} deductions
              </span>
              <div className="flex items-center gap-1.5 font-bold">
                <span className="text-charcoal-700">Net Pay:</span>
                <span className="text-sm font-black text-brand-800">{formatEGP(net)}</span>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* RIGHT — source audit & evidence */}
        <div className="space-y-2 lg:col-span-5 lg:col-start-8 lg:row-start-1">
          <div className="rounded-lg border border-charcoal-200 bg-white p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-charcoal-200 pb-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
                Work Days &amp; Attendance Log
              </h3>
              <div className="flex items-center gap-1.5">
                {attendance?.adjustedAt && (
                  <span
                    className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800"
                    title={`Counters corrected by HR on ${new Date(attendance.adjustedAt).toLocaleString()}`}
                  >
                    Adjusted
                  </span>
                )}
                <span className="text-[10px] font-semibold text-charcoal-400">{period.period}</span>
                {!attendanceDraft && (
                  <button
                    type="button"
                    onClick={() => startAttendanceEdit()}
                    disabled={!canEdit || locked || closed}
                    title={closed ? 'Reopen the sheet to correct attendance' : 'Correct the attendance numbers'}
                    className="rounded border border-charcoal-200 px-1.5 py-0.5 text-[9px] font-bold text-charcoal-600 transition-colors hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {attendanceDraft ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  {(
                    [
                      { key: 'daysAttended', label: 'Days Attended' },
                      { key: 'weeklyOffs', label: 'Weekly Offs' },
                      { key: 'approvedLeaves', label: 'Approved Leaves' },
                      { key: 'overtimeHours', label: 'Overtime (hrs)' },
                      { key: 'lateArrivals', label: 'Late Arrivals' },
                      { key: 'unexcusedAbsences', label: 'Absent' },
                    ] satisfies { key: keyof AttendanceDraft; label: string }[]
                  ).map((field) => (
                    <label key={field.key} className="flex items-center justify-between gap-2">
                      <span className="truncate text-charcoal-500">{field.label}</span>
                      <input
                        type="number"
                        min={0}
                        step={field.key === 'overtimeHours' ? '0.5' : '1'}
                        aria-label={field.label}
                        value={attendanceDraft[field.key]}
                        onChange={(event) =>
                          setAttendanceDraft((draft) =>
                            draft ? { ...draft, [field.key]: event.target.value } : draft,
                          )
                        }
                        className="h-6 w-16 rounded border border-charcoal-300 bg-white px-1 text-right text-[11px] font-bold text-charcoal-900 focus:border-brand-500 focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-[9px] leading-snug text-charcoal-400">
                  Corrections are recorded on the sheet; the punch log and day list below stay as the raw evidence.
                  Overtime changes the pay.
                </p>
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px]" onClick={() => setAttendanceDraft(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    loading={updateAttendance.isPending}
                    onClick={saveAttendance}
                  >
                    Save corrections
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-5 text-[11px] sm:grid-cols-2">
                {attendanceRow('daysAttended', 'Days Attended', `${attendance?.daysAttended ?? entry.days} days`)}
                {attendanceRow('weeklyOffs', 'Weekly Offs', `${attendance?.weeklyOffs ?? 0} days`)}
                {attendanceRow('annualLeaves', 'Annual Leave', `${attendance?.annualLeaves ?? 0} days`)}
                {attendanceRow('sickLeaves', 'Sick Leave', `${attendance?.sickLeaves ?? 0} days`)}
                {attendanceRow(
                  'coverDays',
                  'Cover Days',
                  `${attendance?.coverDays ?? 0} days`,
                  (attendance?.coverDays ?? 0) > 0 ? 'text-violet-600' : undefined,
                )}
                {attendanceRow(
                  'unapprovedCover',
                  'Unapproved cover',
                  `${attendance?.unapprovedCoverDays ?? 0} days`,
                  (attendance?.unapprovedCoverDays ?? 0) > 0 ? 'text-red-600' : undefined,
                )}
                {attendanceRow('overtime', 'Overtime Logged', `${attendance?.overtimeHours ?? entry.overtime} hrs`, 'text-brand-700')}
                {attendanceRow(
                  'lateArrivals',
                  'Late Arrivals',
                  `${attendance?.lateArrivals ?? 0} incident${(attendance?.lateArrivals ?? 0) === 1 ? '' : 's'}`,
                  (attendance?.lateArrivals ?? 0) > 0 ? 'text-amber-600' : undefined,
                )}
                {attendanceRow('unexcusedAbsences', 'Absent', `${attendance?.unexcusedAbsences ?? 0} days`)}
              </div>
            )}
          </div>
        </div>
      </div>

      {daysBucket && attendance && (
        <AttendanceDaysDialog
          employeeName={entry.name}
          periodLabel={period.period}
          attendance={attendance}
          initialBucket={daysBucket}
          deductions={entry.deductionLines.map((line) => ({ date: line.date, amount: line.amount }))}
          onClose={() => setDaysBucket(null)}
        />
      )}

      {payslipOpen && (
        <PayslipDialog
          periodId={period.id}
          employeeId={entry.employeeId}
          employeeName={entry.name}
          onClose={() => setPayslipOpen(false)}
        />
      )}

      <RequestDetailDialog
        row={detailRow}
        canDecide={canEdit && !locked && !closed}
        busy={decideRequest.isPending || undoRequest.isPending}
        onClose={() => setDetailRow(null)}
        onApprove={(id, days) => decideRequest.mutate({ id, decision: 'approved', days })}
        onReject={(id) => decideRequest.mutate({ id, decision: 'rejected' })}
        onUndo={(id) => undoRequest.mutate(id)}
        onAddDeduction={startDeductionFrom}
      />
    </div>
  )
}
