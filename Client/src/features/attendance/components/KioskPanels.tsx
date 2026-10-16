import { useEffect, useState } from 'react'
import { CheckCircle2, LogOut, XCircle } from 'lucide-react'
import type { StationSummaryRecord } from '../api/attendance.api'
import { Button } from '../../../components/ui/button'
import type { AttendanceResult, FaceMatchDetail } from '../types'

const STATUS_BADGE: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800',
  LEFT: 'bg-slate-200 text-slate-600',
  DAY_OFF: 'bg-slate-100 text-slate-500',
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  LEFT: 'Left',
  DAY_OFF: 'Day off',
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleTimeString()
}

/** One row of the kiosk dashboard feed. */
export function FeedRow({ row }: { row: StationSummaryRecord }) {
  const status = (row.status ?? '').toUpperCase()
  const isManual = (row.method ?? '').toUpperCase() === 'MANUAL'

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-charcoal-100 bg-white px-2.5 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-charcoal-800">{row.employeeName || row.employeeId}</p>
        <p className="truncate font-mono text-[10px] leading-tight text-charcoal-500">
          {row.employeeId}
          {row.attendanceStatus ? ' - ' + row.attendanceStatus : ''}
        </p>
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
        <span className="font-mono text-[10px] tabular-nums text-charcoal-400">{formatClock(row.lastEventTime)}</span>
      </div>
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
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={isError ? 'Attendance rejected' : 'Attendance recorded'}
        className={
          'w-full max-w-md rounded-2xl border p-6 shadow-2xl ' +
          (isError ? 'border-red-500/30 bg-red-950/95 text-red-50' : 'border-emerald-500/30 bg-emerald-950/95 text-emerald-50')
        }
      >
        {isError ? (
          <>
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-400" aria-hidden="true" />
              <h2 className="text-lg font-bold">Attendance rejected</h2>
            </div>
            <p className="mt-3 text-sm text-red-200">{rejection}</p>
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
              <dl className="mt-2 space-y-1 text-sm text-emerald-200">
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
        className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-amber-950/95 p-6 text-amber-50 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <LogOut className="h-8 w-8 text-amber-400" aria-hidden="true" />
          <h2 className="text-lg font-bold">Check out now?</h2>
        </div>
        <p className="mt-3 text-base font-semibold">{employeeName ?? employeeId ?? 'This employee'}</p>
        <p className="mt-1 text-sm text-amber-200">
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

