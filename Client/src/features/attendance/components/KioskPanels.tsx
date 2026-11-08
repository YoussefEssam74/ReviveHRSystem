import { useEffect, useState } from 'react'
import { CheckCircle2, LogOut, XCircle } from 'lucide-react'
import type { StationSummaryRecord } from '../api/attendance.api'
import { Button } from '../../../components/ui/button'
import type { AttendanceResult, FaceMatchDetail } from '../types'

const STATUS_BADGE: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800',
  LEFT: 'bg-slate-200 text-slate-600',
  SCHEDULED: 'bg-sky-100 text-sky-800',
  ABSENT: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  LEFT: 'Left',
  SCHEDULED: 'Not in yet',
  ABSENT: 'Absent',
}

function formatClock(value: string | null | undefined): string {
  if (!value) return '—'
  // The API sends the kiosk-local "HH:mm"; tolerate an ISO stamp from older payloads.
  if (!value.includes('T')) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** One row of the kiosk roster: shift, punches, and lateness/early-leave minutes. */
export function FeedRow({ row }: { row: StationSummaryRecord }) {
  const status = (row.status ?? '').toUpperCase()
  const isManual = (row.method ?? '').toUpperCase() === 'MANUAL'
  const late = row.lateMinutes ?? 0
  const early = row.earlyLeaveMinutes ?? 0

  return (
    <div className="rounded-lg border border-charcoal-100 bg-white px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-charcoal-800">{row.employeeName || row.employeeId}</p>
          <p className="truncate font-mono text-[10px] leading-tight text-charcoal-500">{row.employeeId}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isManual && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">manual</span>
          )}
          <span
            className={
              'rounded px-1.5 py-0.5 text-[10px] font-bold ' +
              (STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-500')
            }
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
        <span className="truncate text-charcoal-500">
          {row.shiftName || 'Shift'} ·{' '}
          <span className="font-mono tabular-nums">
            {row.shiftStart || '—'}–{row.shiftEnd || '—'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 font-mono tabular-nums">
          <span className={row.checkIn ? 'text-charcoal-700' : 'text-charcoal-400'}>in {formatClock(row.checkIn)}</span>
          <span className={row.checkOut ? 'text-charcoal-700' : 'text-charcoal-400'}>out {formatClock(row.checkOut)}</span>
        </span>
      </div>

      {(late > 0 || early > 0) && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {late > 0 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
              Late {late}m
            </span>
          )}
          {early > 0 && (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">
              Left early {early}m
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Full-screen confirmation / rejection card shown inside the viewfinder. Auto-dismisses
 * (handled by the page) so the always-on camera resumes; a dismiss button keeps it
 * keyboard- and touch-accessible.
 */
export function ResultOverlay({
  result,
  face,
  rejection,
  onDismiss,
}: {
  result: AttendanceResult | null
  face: FaceMatchDetail | null
  rejection: string | null
  onDismiss: () => void
}) {
  const isError = rejection !== null && rejection !== undefined
  if (!result && !isError) return null

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm fade-in">
      {/* Always-dark panel: bg-*-950 never flips with the theme, while dark
          mode remaps text-*-50/100/200 to dark tints (they pair with pastel
          backgrounds there). Literal light hexes keep this copy readable in
          both modes — the same convention the rest of the kiosk uses. */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={isError ? 'Attendance rejected' : 'Attendance recorded'}
        className={
          'w-full max-w-md rounded-2xl border p-6 shadow-2xl ' +
          (isError
            ? 'border-red-500/30 bg-red-950/95 text-[#fef2f2]'
            : 'border-emerald-500/30 bg-emerald-950/95 text-[#ecfdf5]')
        }
      >
        {isError ? (
          <>
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-400" aria-hidden="true" />
              <h2 className="text-lg font-bold">Attendance rejected</h2>
            </div>
            <p className="mt-3 text-sm text-[#fecaca]">{rejection}</p>
          </>
        ) : (
          result && (
            <>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" aria-hidden="true" />
                <h2 className="text-lg font-bold">
                  {result.type === 'OUT' ? 'Check-out recorded' : 'Check-in recorded'}
                </h2>
              </div>
              <p className="mt-3 text-base font-semibold">{result.employeeName ?? result.employeeId}</p>
              <dl className="mt-2 space-y-1 text-sm text-[#a7f3d0]">
                <div className="flex justify-between gap-3">
                  <dt>Employee</dt>
                  <dd className="font-mono">{result.employeeId}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Branch</dt>
                  <dd>{result.gymName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Time</dt>
                  <dd>{formatClock(result.timestamp)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Status</dt>
                  <dd>{result.attendanceStatus}</dd>
                </div>
                {result.shiftComparison === 'UNSCHEDULED' && (
                  <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-2.5 text-xs text-[#fde68a]">
                    <p className="font-semibold">Unscheduled / off day</p>
                    <p className="mt-0.5">No shift was scheduled for today — a request was sent to the branch manager and HR for cover/extra-day approval (1 or 2 days).</p>
                  </div>
                )}
                {face && (
                  <div className="flex justify-between gap-3">
                    <dt>Face match</dt>
                    <dd>
                      {Math.round(face.similarity * 100)}% - liveness {Math.round(face.livenessScore * 100)}%
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt>Record</dt>
                  <dd className="font-mono">{result.recordId}</dd>
                </div>
              </dl>
            </>
          )
        )}

        <Button variant="outline" size="sm" className="mt-5 w-full" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}

/**
 * "Check out now?" prompt shown inside the viewfinder when an AUTO face scan would
 * close the employee's open record. Nothing is recorded until they confirm; declining
 * (or walking away - the prompt times out) keeps the check-in open.
 */
export function CheckoutConfirmCard({
  employeeId,
  employeeName,
  onConfirm,
  onCancel,
}: {
  employeeId: string | null
  employeeName: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm fade-in">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm check-out"
        className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-amber-950/95 p-6 text-[#fffbeb] shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <LogOut className="h-8 w-8 text-amber-400" aria-hidden="true" />
          <h2 className="text-lg font-bold">Check out now?</h2>
        </div>
        <p className="mt-3 text-base font-semibold">{employeeName ?? employeeId ?? 'This employee'}</p>
        <p className="mt-1 text-sm text-[#fde68a]">
          You are checked in for today. Confirming records your check-out with the current time.
        </p>
        <div className="mt-5 flex gap-2">
          <Button size="sm" className="flex-1" onClick={onConfirm}>
            Check out now
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
            Not yet
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Kiosk clock (display only - the server is the source of truth for punches). *//** Kiosk clock (display only â€” the server is the source of truth for punches). */
export function useClock(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  return {
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
  }
}

