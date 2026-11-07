import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { useAttendance, useCorrectAttendance } from '../hooks/useAttendanceHr'
import { useMe } from '../../../contexts/MeContext'
import { formatTime } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'
import type { AttendanceRow } from '../api/attendance-hr.api'

const STATUSES = ['', 'On Time', 'Late', 'Absent', 'Early Checkout', 'Missing Checkout', 'Off']

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** HR attendance logs (A1) — date-range grid with per-record correction. */
export default function AttendanceHrPage() {
  const { can, me } = useMe()
  const [date, setDate] = useState(todayIso())
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [correcting, setCorrecting] = useState<AttendanceRow | null>(null)
  const [correctStatus, setCorrectStatus] = useState('')
  const [correctIn, setCorrectIn] = useState('')
  const [correctOut, setCorrectOut] = useState('')
  const [correctReason, setCorrectReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const correct = useCorrectAttendance()

  const { data, isLoading, error } = useAttendance({
    date: date || undefined,
    status: status || undefined,
    page,
    pageSize: 20,
  })

  const canEdit = can('attendance', 2)

  const openCorrect = (row: AttendanceRow) => {
    setCorrecting(row)
    setCorrectStatus(row.status)
    setCorrectIn(row.checkIn ? row.checkIn.slice(0, 5) : '')
    setCorrectOut(row.checkOut ? row.checkOut.slice(0, 5) : '')
    setCorrectReason('')
    setActionError(null)
  }

  const onSubmitCorrect = async () => {
    if (!correcting || correcting.id == null) return
    setActionError(null)
    try {
      await correct.mutateAsync({
        id: correcting.id,
        body: {
          status: correctStatus,
          reason: correctReason,
          checkIn: correctIn || undefined,
          checkOut: correctOut || undefined,
        },
      })
      setCorrecting(null)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={me?.activeGym ? `Daily records for ${me.activeGym.gymName}` : 'Attendance logs'}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div>
            <Label htmlFor="date" className="sr-only">
              Date
            </Label>
            <Input id="date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1) }} className="sm:w-44" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="sm:w-52" aria-label="Filter by status">
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option || 'All statuses'}
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <LoadingState label="Loading attendance…" />
        ) : error ? (
          <ErrorState message={describeApiError(error)} />
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyState icon={CalendarCheck} title="No records" message="No attendance was recorded for this day." />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Employee</TH>
                <TH>Shift</TH>
                <TH>In</TH>
                <TH>Out</TH>
                <TH>Status</TH>
                <TH>Source</TH>
                {canEdit && <TH className="text-right">Action</TH>}
              </THead>
              <TBody>
                {data!.items.map((row, index) => (
                  <TR key={row.id ?? `${row.employeeId}-${index}`}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={row.name?.slice(0, 1).toUpperCase() ?? '?'} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{row.name}</p>
                          <p className="truncate text-xs text-slate-500">{row.employeeId}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-slate-500">{row.shift ?? '—'}</TD>
                    <TD className="font-medium text-slate-900">{formatTime(row.checkIn)}</TD>
                    <TD className="font-medium text-slate-900">{formatTime(row.checkOut)}</TD>
                    <TD>
                      <StatusBadge status={row.status} />
                      {row.correctedBy && <Badge className="mt-0.5">Corrected</Badge>}
                    </TD>
                    <TD className="text-slate-500">{row.source ?? '—'}</TD>
                    {canEdit && (
                      <TD className="text-right">
                        {row.id != null && (
                          <Button variant="outline" size="sm" onClick={() => openCorrect(row)}>
                            Correct
                          </Button>
                        )}
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={data!.page}
              pageSize={data!.pageSize}
              total={data!.total}
              totalPages={data!.totalPages}
              onPageChange={setPage}
              noun="records"
            />
          </>
        )}
      </Card>

      <Dialog
        open={correcting != null}
        onClose={() => setCorrecting(null)}
        title="Correct record"
        description={correcting ? `${correcting.name} · ${correcting.date}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setCorrecting(null)}>
              Cancel
            </Button>
            <Button onClick={onSubmitCorrect} loading={correct.isPending}>
              Save correction
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="check-in">Check in</Label>
              <Input id="check-in" type="time" value={correctIn} onChange={(e) => setCorrectIn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="check-out">Check out</Label>
              <Input id="check-out" type="time" value={correctOut} onChange={(e) => setCorrectOut(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="correct-status">Status</Label>
            <Select id="correct-status" value={correctStatus} onChange={(e) => setCorrectStatus(e.target.value)}>
              {STATUSES.filter(Boolean).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="reason">Reason (required)</Label>
            <Textarea
              id="reason"
              rows={3}
              value={correctReason}
              onChange={(e) => setCorrectReason(e.target.value)}
              placeholder="Why is this record being corrected?"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
