import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Receipt } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Select } from '../../../components/ui/select'
import { formatDate, formatEGP } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { describeApiError } from '../../../lib/api-client'
import { getRequests } from '../../requests/api/requests.api'
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
import { entryStatusLabel, isEntryClosed, overtimePayOf, pendingLinesOf } from '../lib/payroll-calc'
import PayslipDialog from './PayslipDialog'
import PunchAuditDialog from './PunchAuditDialog'
import AttendanceDaysDialog, { type AttendanceBucket } from './AttendanceDaysDialog'

/** Inline editor values (strings so the inputs can be cleared while typing). */
type AttendanceDraft = {
  daysAttended: string
  weeklyOffs: string
  approvedLeaves: string
  overtimeHours: string
  lateArrivals: string
  unexcusedAbsences: string
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

/** One line of the deductions card (source badge, approve/waive for Pending lines). */
function DeductionRow({
  line,
  locked,
  closed,
  canEdit,
  onDecision,
  deciding,
}: {
  line: DeductionLine
  locked: boolean
  closed: boolean
  canEdit: boolean
  onDecision: (line: DeductionLine, approved: boolean) => void
  deciding: boolean
}) {
  const pending = line.status === 'Pending'
  const accepted = line.status === 'Accepted' || line.status === 'Approved'
  const rejected = line.status === 'Rejected'
  const biometric = line.source === 'biometric'

  return (
    <div
      className={cn(
        'rounded-lg border p-2 text-xs transition-all',
        pending
          ? 'border-amber-200 bg-amber-50/60 ring-1 ring-amber-100'
          : accepted
            ? 'border-charcoal-200 bg-charcoal-50/70'
            : 'border-gray-200 bg-gray-50 opacity-50',
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
          <p className="mt-0.5 truncate text-[10px] text-charcoal-500">{line.reason || '—'}</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
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
                  Waive
                </Button>
              </div>
            ) : (
              <span className="rounded bg-charcoal-100 px-1 py-0.5 text-[9px] font-bold text-charcoal-400" title="Resolving deductions requires payroll.edit">
                🔒 payroll.edit
              </span>
            )
          ) : accepted ? (
            <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-700">Approved</span>
          ) : (
            <span className="rounded bg-charcoal-100 px-1 py-0.5 text-[9px] font-bold text-charcoal-400 line-through">
              Waived
            </span>
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
  onSelectEmployee,
  onToast,
}: SettlementSheetProps) {
  const entry = period.items.find((item) => item.employeeId === employeeId) ?? period.items[0]
  const locked = period.locked
  const closed = entry ? isEntryClosed(entry) : false
  const pendingCount = entry ? pendingLinesOf(entry) : 0

  const index = period.items.findIndex((item) => item.employeeId === entry?.employeeId)
  const previous = index > 0 ? period.items[index - 1] : null
  const next = index >= 0 && index < period.items.length - 1 ? period.items[index + 1] : null

  const [addingLine, setAddingLine] = useState(false)
  const [source, setSource] = useState<DeductionSource>('manager')
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [bonusDraft, setBonusDraft] = useState<string | null>(null)
  const [bonusSaving, setBonusSaving] = useState(false)
  const [auditRef, setAuditRef] = useState<string | null>(null)
  const [payslipOpen, setPayslipOpen] = useState(false)
  const [daysBucket, setDaysBucket] = useState<AttendanceBucket | null>(null)
  const [attendanceDraft, setAttendanceDraft] = useState<AttendanceDraft | null>(null)

  const updateBonus = useUpdateBonus(period.id)
  const updateAttendance = useUpdateEntryAttendance(period.id)
  const addDeduction = useAddDeduction(period.id)
  const closeEntry = useCloseEntry(period.id)
  const reopenEntry = useReopenEntry(period.id)
  const review = useReviewCandidate()

  const relatedIds = entry ? Array.from(new Set([...entry.relatedRequestIds, ...entry.deductionLines.map((l) => l.requestId).filter((id): id is number => id != null)])) : []
  const linkedRequests = useQuery({
    queryKey: ['requests', 'by-ids', relatedIds],
    queryFn: ({ signal }) => getRequests({ ids: relatedIds.join(','), pageSize: 50 }, signal),
    enabled: relatedIds.length > 0,
  })

  if (!entry) return null

  const base = entry.baseSalary
  const otPay = overtimePayOf(entry)
  const gross = entry.gross
  const approvedDeductions = entry.deductions
  const net = entry.net
  const attendance = entry.attendance
  const bonusValue = bonusDraft ?? String(entry.bonus)

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

  const commitBonus = async (raw: string) => {
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) {
      setBonusDraft(null)
      onToast('Bonus must be zero or more.', 'error')
      return
    }
    if (value === entry.bonus) {
      setBonusDraft(null)
      return
    }
    setBonusSaving(true)
    try {
      await updateBonus.mutateAsync({ employeeId: entry.employeeId, bonus: value })
      setBonusDraft(null)
      onToast(`Bonus updated — net pay recalculated for ${entry.name}.`)
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

  const decideLine = async (line: DeductionLine, approved: boolean) => {
    try {
      await review.mutateAsync({ id: line.id, decision: approved ? 'Accepted' : 'Rejected' })
      onToast(approved ? `Deduction approved for ${entry.name}.` : `Deduction waived for ${entry.name}.`, 'info')
    } catch (err) {
      onToast(describeApiError(err), 'error')
    }
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
    <div className="space-y-2">
      {/* Compact header bar: switcher + net pay + the closing action */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button size="sm" variant="secondary" className="h-7 flex-shrink-0 px-2 text-xs font-semibold" onClick={onBack} title="Back to All Staff">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All Staff
          </Button>

          <span className="text-charcoal-300">|</span>

          <div className="flex flex-shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={!previous}
              onClick={() => previous && onSelectEmployee(previous.employeeId)}
              className="flex h-6 w-6 items-center justify-center rounded bg-charcoal-100 text-xs text-charcoal-700 hover:bg-charcoal-200 disabled:opacity-30"
              aria-label="Previous employee"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && onSelectEmployee(next.employeeId)}
              className="flex h-6 w-6 items-center justify-center rounded bg-charcoal-100 text-xs text-charcoal-700 hover:bg-charcoal-200 disabled:opacity-30"
              aria-label="Next employee"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <Select
            value={entry.employeeId}
            onChange={(event) => onSelectEmployee(Number(event.target.value))}
            aria-label="Employee"
            className="w-full min-w-0 max-w-[220px] truncate border-charcoal-200 bg-charcoal-50 px-2 py-0.5 text-xs font-bold"
          >
            {period.items.map((item) => (
              <option key={item.employeeId} value={item.employeeId}>
                {item.name} ({item.position}) · {entryStatusLabel(item)}
              </option>
            ))}
          </Select>

          <Badge
            color={closed ? 'green' : pendingCount > 0 ? 'yellow' : 'blue'}
            className="text-[9px] font-bold"
          >
            {closed ? 'Closed & Settled' : pendingCount > 0 ? `${pendingCount} Actions Needed` : 'Ready to Close'}
          </Badge>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setPayslipOpen(true)}
            className="flex items-center gap-1 text-[10px] font-semibold text-charcoal-500 hover:text-brand-700"
            title="Payslip preview"
          >
            <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
            Payslip
          </button>

          <div className="text-right">
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-charcoal-400">
              Net Final Pay
            </span>
            <span className="text-sm font-black text-brand-800">{formatEGP(net)}</span>
          </div>

          {!canEdit ? (
            <span className="rounded-md bg-charcoal-100 px-2.5 py-1 text-[11px] font-bold text-charcoal-600" title="Editing payroll requires payroll.edit">
              🔒 Read-only · payroll.edit required
            </span>
          ) : closed ? (
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                ✓ Account Closed
              </span>
              {!locked && (
                <Button size="sm" variant="secondary" className="h-6 px-1.5 text-[10px] text-charcoal-500 hover:text-charcoal-900" onClick={reopen} title="Re-open for adjustments">
                  Edit
                </Button>
              )}
            </div>
          ) : pendingCount > 0 ? (
            <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs opacity-60" disabled title="Approve or waive all deductions first">
              Resolve {pendingCount} Action{pendingCount > 1 ? 's' : ''} First
            </Button>
          ) : (
            <Button size="sm" className="h-7 px-3 text-xs font-bold" onClick={settle} loading={closeEntry.isPending}>
              ✓ Close &amp; Settle Account
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
        {/* LEFT — financial reconciliation */}
        <div className="space-y-2 lg:col-span-7">
          <div className="rounded-lg border border-charcoal-200 bg-white p-2.5">
            <div className="mb-1.5 flex items-center justify-between border-b border-charcoal-200 pb-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
                1. Monthly Earnings &amp; Additions
              </h3>
              <span className="text-xs font-extrabold text-charcoal-900">Gross: {formatEGP(gross)}</span>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded border border-charcoal-100 bg-charcoal-50 p-1.5">
                <span className="block text-[10px] text-charcoal-500">Base Contract Salary</span>
                <span className="text-xs font-bold text-charcoal-900">{formatEGP(base)}</span>
              </div>

              <div className="rounded border border-charcoal-100 bg-charcoal-50 p-1.5">
                <span className="block text-[10px] text-charcoal-500">Overtime ({entry.overtime}h logged)</span>
                <span className="text-xs font-bold text-emerald-600">+ {formatEGP(otPay)}</span>
              </div>

              {/* The whole tile is a label: clicking anywhere (title included) focuses
                  the amount, which is what HR expects when it reads "Editable". */}
              <label
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded border border-brand-200 bg-brand-50/50 p-1.5',
                  (locked || closed || !canEdit) && 'cursor-not-allowed',
                )}
                title={closed ? 'Reopen the sheet to change the bonus' : 'Click the amount to edit the bonus'}
              >
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold text-brand-800">Bonus / Incentive</span>
                  <span className="text-[9px] text-charcoal-400">
                    {closed || locked ? 'Sheet closed' : canEdit ? 'Click to edit' : 'Read-only'}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-brand-800">EGP</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={bonusValue}
                    disabled={locked || closed || !canEdit || bonusSaving}
                    onChange={(event) => setBonusDraft(event.target.value)}
                    onBlur={(event) => commitBonus(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    className="h-6 w-20 rounded border border-brand-300 bg-white px-1 py-0 text-right text-xs font-bold text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-300 disabled:opacity-60"
                    aria-label="Bonus"
                  />
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col rounded-lg border border-charcoal-200 bg-white p-2.5">
            <div className="mb-2 flex items-center justify-between border-b border-charcoal-200 pb-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
                  2. Deductions &amp; Expense Recoveries
                </h3>
                <Badge color={approvedDeductions > 0 ? 'red' : 'gray'} className="text-[9px] font-bold">
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

            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
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
                    onDecision={decideLine}
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
        </div>

        {/* RIGHT — source audit & evidence */}
        <div className="space-y-2 lg:col-span-5">
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
                      { key: 'unexcusedAbsences', label: 'Unexcused Absences' },
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
                {attendanceRow('approvedLeaves', 'Approved Leaves', `${attendance?.approvedLeaves ?? 0} days`)}
                {attendanceRow('overtime', 'Overtime Logged', `${attendance?.overtimeHours ?? entry.overtime} hrs`, 'text-brand-700')}
                {attendanceRow(
                  'lateArrivals',
                  'Late Arrivals',
                  `${attendance?.lateArrivals ?? 0} incident${(attendance?.lateArrivals ?? 0) === 1 ? '' : 's'}`,
                  (attendance?.lateArrivals ?? 0) > 0 ? 'text-amber-600' : undefined,
                )}
                {attendanceRow('unexcusedAbsences', 'Unexcused Absences', `${attendance?.unexcusedAbsences ?? 0} days`)}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-charcoal-200 bg-white p-2.5">
            <div className="mb-1.5 flex items-center justify-between border-b border-charcoal-200 pb-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">Biometric Punch Proof</h3>
            </div>

            {!attendance || attendance.punches.length === 0 ? (
              <p className="py-2 text-center text-xs text-charcoal-400">No biometric punches recorded this period.</p>
            ) : (
              <div className="space-y-1 text-xs">
                {attendance.punches.map((punch) => (
                  <div
                    key={punch.attendanceRef}
                    className={cn(
                      'flex items-center justify-between rounded p-1.5',
                      punch.onTime ? 'bg-charcoal-50' : 'border border-amber-200 bg-amber-50',
                    )}
                  >
                    <div className="min-w-0">
                      <p className={cn('text-[11px] font-bold', punch.onTime ? 'text-charcoal-900' : 'text-amber-900')}>
                        {formatDate(punch.date)} ({punch.exception})
                      </p>
                      <p className={cn('text-[10px]', punch.onTime ? 'text-charcoal-400' : 'text-charcoal-500')}>
                        Punch: {punch.firstIn ?? '—'} In → {punch.lastOut ?? '—'} Out · {punch.device}
                      </p>
                    </div>
                    {punch.onTime ? (
                      <span className="text-[9px] font-bold text-emerald-600">On Time</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-5 px-1 text-[9px] font-bold"
                        onClick={() => setAuditRef(punch.attendanceRef)}
                      >
                        View Log
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-charcoal-200 bg-white p-2.5">
            <div className="mb-1.5 flex items-center justify-between border-b border-charcoal-200 pb-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
                Linked Employee Requests
              </h3>
              <span className="text-[10px] text-charcoal-400">Context for decisions</span>
            </div>

            {(linkedRequests.data?.items.length ?? 0) === 0 ? (
              <p className="py-2 text-center text-xs text-charcoal-400">
                No leave or exception requests logged for this period.
              </p>
            ) : (
              <div className="space-y-1">
                {(linkedRequests.data?.items ?? []).map((request) => (
                  <div key={request.id} className="rounded border border-charcoal-200 bg-charcoal-50 p-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-charcoal-900">{request.type}</span>
                      <Badge status={request.status} className="text-[8px]">
                        {request.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-charcoal-600">{request.reason || 'No reason'}</p>
                    <p className="mt-0.5 text-[9px] text-charcoal-400">
                      BM Decision: <b>{request.bmDecision ?? '—'}</b> ({request.bmComment || 'Reviewed'})
                    </p>
                  </div>
                ))}
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
          onClose={() => setDaysBucket(null)}
        />
      )}

      {auditRef && (
        <PunchAuditDialog
          attendanceRef={auditRef}
          employeeName={entry.name}
          employeeMeta={`${entry.position} · ${entry.gym}`}
          onClose={() => setAuditRef(null)}
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
    </div>
  )
}
