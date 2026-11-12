import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { useAttendanceRef } from '../hooks/usePayroll'

export interface PunchAuditDialogProps {
  /** ATT-{recordId} of the referenced punch. */
  attendanceRef: string
  employeeName: string
  employeeMeta?: string
  onClose: () => void
}

/** "2026-10-01T08:04:00Z" → "08:04" (the punch clock's own wall time). */
function punchTime(value: string | null | undefined): string {
  if (!value) return '—'
  const match = /T(\d{2}):(\d{2})/.exec(value)
  if (match) return `${match[1]}:${match[2]}`
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

/** Biometric punch audit trail behind a deduction (mock openPayrollAttendanceRef). */
export default function PunchAuditDialog({ attendanceRef, employeeName, employeeMeta, onClose }: PunchAuditDialogProps) {
  const { data, isLoading, error } = useAttendanceRef(attendanceRef)

  return (
    <Dialog
      open
      onClose={onClose}
      title="Biometric Punch Audit Trail"
      className="sm:max-w-md"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close Audit
        </Button>
      }
    >
      <div className="space-y-3 text-xs">
        <div className="rounded-xl border border-charcoal-200 bg-charcoal-50 p-3">
          <div className="flex items-center justify-between">
            <Badge color="blue" className="text-[10px] font-bold">
              Biometric Punch Record
            </Badge>
            <span className="font-mono text-[10px] text-charcoal-500">{attendanceRef}</span>
          </div>
          <p className="mt-1.5 text-sm font-bold text-charcoal-900">{employeeName}</p>
          {employeeMeta && <p className="text-[11px] text-charcoal-500">{employeeMeta}</p>}
        </div>

        {isLoading ? (
          <LoadingState label="Loading punch record…" />
        ) : error ? (
          <ErrorState message={describeApiError(error)} />
        ) : data ? (
          <div className="space-y-2">
            <div className="flex justify-between border-b border-charcoal-200 py-1">
              <span className="text-charcoal-500">Record Date:</span>
              <b>{formatDate(data.date)}</b>
            </div>
            <div className="flex justify-between border-b border-charcoal-200 py-1">
              <span className="text-charcoal-500">Punch In / Out:</span>
              <b>
                {punchTime(data.firstIn)} → {punchTime(data.lastOut)}
              </b>
            </div>
            <div className="flex justify-between border-b border-charcoal-200 py-1">
              <span className="text-charcoal-500">Terminal Source:</span>
              <b>{data.device || 'Entrance Biometric Terminal'}</b>
            </div>
            <div className="py-1">
              <span className="mb-1 block text-charcoal-500">System Exception Notes:</span>
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] font-medium text-amber-900">
                {data.detail || data.exception}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
