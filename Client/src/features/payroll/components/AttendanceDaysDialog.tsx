import { useState } from 'react'
import { Badge, type BadgeColor } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { dateParts, formatDate, formatEGP } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { PayrollAttendance, PayrollAttendanceDay } from '../api/payroll.api'
import PunchAuditDialog from './PunchAuditDialog'

/** The counter rows of the settlement sheet's attendance card. */
export type AttendanceBucket =
  | 'daysAttended'
  | 'weeklyOffs'
  | 'annualLeaves'
  | 'sickLeaves'
  | 'coverDays'
  | 'unapprovedCover'
  | 'overtime'
  | 'lateArrivals'
  | 'unexcusedAbsences'

const BUCKETS: { value: AttendanceBucket; label: string }[] = [
  { value: 'daysAttended', label: 'Days Attended' },
  { value: 'weeklyOffs', label: 'Weekly Offs' },
  { value: 'annualLeaves', label: 'Annual Leave' },
  { value: 'sickLeaves', label: 'Sick Leave' },
  { value: 'coverDays', label: 'Cover Days' },
  { value: 'unapprovedCover', label: 'Unapproved cover' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'lateArrivals', label: 'Late Arrivals' },
  { value: 'unexcusedAbsences', label: 'Absent' },
]

/** Which day kinds each counter sums up. */
const BUCKET_KINDS: Record<AttendanceBucket, string[]> = {
  daysAttended: ['Attended', 'Late', 'EarlyCheckout', 'EarlyLeave', 'MissingCheckout'],
  weeklyOffs: ['WeeklyOff'],
  annualLeaves: ['AnnualLeave', 'ApprovedLeave'],
  sickLeaves: ['SickLeave'],
  coverDays: ['Cover'],
  unapprovedCover: ['CoverRejected'],
  overtime: [],
  lateArrivals: ['Late'],
  unexcusedAbsences: ['Absent'],
}

function matches(bucket: AttendanceBucket, day: PayrollAttendanceDay): boolean {
  return bucket === 'overtime' ? day.overtimeHours > 0 : BUCKET_KINDS[bucket].includes(day.kind)
}

const KIND_TONE: Record<string, BadgeColor> = {
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
}

/** The counter the sheet prints for a bucket (used to explain an empty log). */
function bucketDaysInSheet(attendance: PayrollAttendance, bucket: AttendanceBucket): number {
  switch (bucket) {
    case 'weeklyOffs':
      return attendance.weeklyOffs
    case 'annualLeaves':
      return attendance.annualLeaves
    case 'sickLeaves':
      return attendance.sickLeaves
    case 'coverDays':
      return attendance.coverDays
    case 'unapprovedCover':
      return attendance.unapprovedCoverDays
    case 'lateArrivals':
      return attendance.lateArrivals
    case 'unexcusedAbsences':
      return attendance.unexcusedAbsences
    case 'overtime':
      return attendance.overtimeHours
    default:
      return attendance.daysAttended
  }
}

function bucketValue(attendance: PayrollAttendance, bucket: AttendanceBucket): string {
  switch (bucket) {
    case 'daysAttended':
      return `${attendance.daysAttended} day${attendance.daysAttended === 1 ? '' : 's'}`
    case 'weeklyOffs':
      return `${attendance.weeklyOffs} day${attendance.weeklyOffs === 1 ? '' : 's'}`
    case 'annualLeaves':
      return `${attendance.annualLeaves} day${attendance.annualLeaves === 1 ? '' : 's'}`
    case 'sickLeaves':
      return `${attendance.sickLeaves} day${attendance.sickLeaves === 1 ? '' : 's'}`
    case 'coverDays':
      return `${attendance.coverDays} day${attendance.coverDays === 1 ? '' : 's'}`
    case 'unapprovedCover':
      return `${attendance.unapprovedCoverDays} day${attendance.unapprovedCoverDays === 1 ? '' : 's'}`
    case 'overtime':
      return `${attendance.overtimeHours} hrs`
    case 'lateArrivals':
      return `${attendance.lateArrivals} incident${attendance.lateArrivals === 1 ? '' : 's'}`
    default:
      return `${attendance.unexcusedAbsences} day${attendance.unexcusedAbsences === 1 ? '' : 's'}`
  }
}

export interface AttendanceDaysDialogProps {
  employeeName: string
  /** Month label of the settlement period ("November 2026"). */
  periodLabel: string
  attendance: PayrollAttendance
  initialBucket: AttendanceBucket
  /** The sheet's deduction lines, so each day can show what it was charged. */
  deductions?: { date: string; amount: number }[]
  onClose: () => void
}

/**
 * Click-through log behind the Work Days & Attendance Log counters: every day of
 * the period with its shift, punches, worked/OT hours and status. Opens on the
 * counter that was clicked; the chips switch between the six attributes.
 */
export default function AttendanceDaysDialog({
  employeeName,
  periodLabel,
  attendance,
  initialBucket,
  deductions,
  onClose,
}: AttendanceDaysDialogProps) {
  const [bucket, setBucket] = useState<AttendanceBucket>(initialBucket)
  const [auditRef, setAuditRef] = useState<string | null>(null)

  const days = attendance.days.filter((day) => matches(bucket, day))
  const totalOvertime = days.reduce((sum, day) => sum + day.overtimeHours, 0)
  // True when the sheet counts something the day log cannot show (e.g. a manual fix).
  const hasSheetValue = bucketDaysInSheet(attendance, bucket) > 0

  // Every deduction line charged to a date (a day can carry more than one).
  const deductionByDate = new Map<string, number>()
  for (const line of deductions ?? []) {
    deductionByDate.set(line.date, (deductionByDate.get(line.date) ?? 0) + line.amount)
  }
  const deductionOf = (date: string) => deductionByDate.get(date) ?? 0

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title="Work Days & Attendance Log"
        description={`${employeeName} · ${periodLabel}`}
        className="sm:max-w-4xl"
        footer={
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          {/* The six attributes, always visible: clicking one filters the day log. */}
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 rounded-lg border border-charcoal-200 bg-charcoal-50 px-2 py-1.5">
            {BUCKETS.map((entry) => {
              const active = entry.value === bucket
              return (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setBucket(entry.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-medium transition-all',
                    active ? 'bg-white font-bold text-charcoal-900 shadow-sm' : 'text-charcoal-600 hover:bg-white/60',
                  )}
                >
                  {entry.label}
                  <span
                    className={cn(
                      'min-w-4 rounded px-1 py-0.5 text-[9px] font-bold',
                      active ? 'bg-brand-600 text-white' : 'bg-charcoal-200 text-charcoal-700',
                    )}
                  >
                    {attendance.days.filter((day) => matches(entry.value, day)).length}
                  </span>
                </button>
              )
            })}
          </div>

          {attendance.adjustedAt && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-800">
              <b>Adjusted by HR</b> on {new Date(attendance.adjustedAt).toLocaleString()} — the counter above is the
              corrected value; the day log below is the raw attendance evidence.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-charcoal-500">
                {BUCKETS.find((entry) => entry.value === bucket)?.label}
              </p>
              <p className="text-sm font-bold text-charcoal-900">{bucketValue(attendance, bucket)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-charcoal-500">
              <span>
                Days in log: <b className="text-charcoal-800">{days.length}</b>
              </span>
              {bucket === 'daysAttended' && days.length !== attendance.daysAttended && (
                <span>
                  Sheet count: <b className="text-charcoal-800">{attendance.daysAttended}</b>
                </span>
              )}
              {bucket === 'overtime' && totalOvertime > 0 && (
                <span>
                  From punches: <b className="text-brand-700">{totalOvertime.toFixed(1)} hrs</b>
                </span>
              )}
              {bucket === 'overtime' && totalOvertime <= 0 && (
                <span className="text-charcoal-400">Logged on the sheet — no punch-based day breakdown</span>
              )}
            </div>
          </div>

          {days.length === 0 ? (
            <div className="space-y-1 py-8 text-center text-xs text-charcoal-400">
              {attendance.days.length === 0 ? (
                <>
                  <p>
                    No attendance has been recorded for {employeeName} in {periodLabel} yet.
                  </p>
                  <p className="text-[10px]">
                    Punches appear here as the employee checks in; HR can also set the numbers by hand with{' '}
                    <b className="text-charcoal-600">Edit</b> on the sheet.
                  </p>
                </>
              ) : (
                <p>
                  No days fall under {(BUCKETS.find((entry) => entry.value === bucket)?.label ?? '').toLowerCase()} for{' '}
                  {periodLabel}
                  {hasSheetValue && (
                    <>
                      {' '}
                      — the sheet&apos;s <b className="text-charcoal-600">{bucketValue(attendance, bucket)}</b> came
                      from a manual correction
                    </>
                  )}
                  .
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-[min(420px,48dvh)] overflow-auto rounded-lg border border-charcoal-200">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="sticky top-0 z-10 bg-charcoal-50">
                  <tr className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
                    <th className="px-2.5 py-2">Date</th>
                    <th className="px-2.5 py-2">Shift</th>
                    <th className="px-2.5 py-2">In → Out</th>
                    <th className="px-2.5 py-2 text-right">Worked</th>
                    <th className="px-2.5 py-2 text-right">OT</th>
                    <th className="px-2.5 py-2">Status</th>
                    <th className="px-2.5 py-2 text-right">Deduction</th>
                    <th className="px-2.5 py-2">Note</th>
                    <th className="px-2.5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-100">
                  {days.map((day) => {
                    const parts = dateParts(day.date)
                    return (
                      <tr key={`${day.date}-${day.kind}`} className="hover:bg-charcoal-50">
                        <td className="whitespace-nowrap px-2.5 py-1.5">
                          <span className="font-semibold text-charcoal-900">{formatDate(day.date)}</span>
                          <span className="ml-1 text-[10px] text-charcoal-400">{parts.weekday}</span>
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[10px] text-charcoal-600">
                          {day.shift ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[10px] text-charcoal-700">
                          {day.checkIn ?? '—'} → {day.checkOut ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-1.5 text-right text-charcoal-700">
                          {day.workedHours > 0 ? `${day.workedHours.toFixed(1)}h` : '—'}
                        </td>
                        <td
                          className={cn(
                            'whitespace-nowrap px-2.5 py-1.5 text-right font-semibold',
                            day.overtimeHours > 0 ? 'text-brand-700' : 'text-charcoal-400',
                          )}
                        >
                          {day.overtimeHours > 0 ? `+${day.overtimeHours.toFixed(1)}h` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-1.5">
                          <Badge color={KIND_TONE[day.kind] ?? 'gray'} className="text-[9px]">
                            {day.status}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-semibold">
                          {deductionOf(day.date) ? (
                            <span className="text-red-600">− {formatEGP(deductionOf(day.date))}</span>
                          ) : (
                            <span className="text-charcoal-300">—</span>
                          )}
                        </td>
                        <td
                          className="max-w-[180px] truncate px-2.5 py-1.5 text-[10px] text-charcoal-500"
                          title={day.note ?? undefined}
                        >
                          {day.note ?? '—'}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          {day.attendanceRef && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-5 px-1.5 text-[9px] font-bold"
                              onClick={() => setAuditRef(day.attendanceRef!)}
                            >
                              Punch
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Dialog>

      {auditRef && (
        <PunchAuditDialog
          attendanceRef={auditRef}
          employeeName={employeeName}
          onClose={() => setAuditRef(null)}
        />
      )}
    </>
  )
}
