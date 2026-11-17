import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, Smartphone } from 'lucide-react'
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
import { formatTimeLabel, formatTimeOfDay } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'
import type { AttendanceRow } from '../api/attendance-hr.api'

const STATUSES = ['', 'On Time', 'Late', 'Absent', 'Early Checkout', 'Missing Checkout', 'Covering (Extra Shift)', 'Off']

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** HR attendance logs (A1) — date-range grid with per-record correction. */
export default function AttendanceHrPage() {
  const { t } = useTranslation()
  const { can, me } = useMe()
  const navigate = useNavigate()
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
        title={t('Attendance')}
        description={
          me?.activeGym
            ? t('Daily records for {{gym}}', { gym: me.activeGym.gymName })
            : t('Attendance logs')
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div>
            <Label htmlFor="date" className="sr-only">
              {t('Date')}
            </Label>
            <Input id="date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1) }} className="sm:w-44" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="sm:w-52" aria-label={t('Filter by status')}>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option ? t(option) : t('All statuses')}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            className="sm:ms-auto"
            onClick={() => navigate('/console/station-code')}
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            {t('Pair kiosk')}
          </Button>
        </div>

        {isLoading ? (
          <LoadingState label={t('Loading attendance…')} />
        ) : error ? (
          <ErrorState message={describeApiError(error)} />
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyState icon={CalendarCheck} title={t('No records')} message={t('No attendance was recorded for this day.')} />
        ) : (
          <>
            <Table>
              <THead>
                <TH>{t('Employee')}</TH>
                <TH>{t('Shift')}</TH>
                <TH>{t('In')}</TH>
                <TH>{t('Out')}</TH>
                <TH>{t('Status')}</TH>
                <TH>{t('Source')}</TH>
                {canEdit && <TH className="text-end">{t('Action')}</TH>}
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
                    <TD className="text-slate-500">{formatTimeLabel(row.shift)}</TD>
                    <TD className="font-medium text-slate-900">{formatTimeOfDay(row.checkIn)}</TD>
                    <TD className="font-medium text-slate-900">{formatTimeOfDay(row.checkOut)}</TD>
                    <TD>
                      <StatusBadge status={row.status} />
                      {row.correctedBy && <Badge className="mt-0.5">{t('Corrected')}</Badge>}
                    </TD>
                    <TD className="text-slate-500">{row.source ?? '—'}</TD>
                    {canEdit && (
                      <TD className="text-end">
                        {row.id != null && (
                          <Button variant="outline" size="sm" onClick={() => openCorrect(row)}>
                            {t('Correct')}
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
              noun={t('records')}
            />
          </>
        )}
      </Card>

      <Dialog
        open={correcting != null}
        onClose={() => setCorrecting(null)}
        title={t('Correct record')}
        description={correcting ? `${correcting.name} · ${correcting.date}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setCorrecting(null)}>
              {t('Cancel')}
            </Button>
            <Button onClick={onSubmitCorrect} loading={correct.isPending}>
              {t('Save correction')}
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
              <Label htmlFor="check-in">{t('Check in')}</Label>
              <Input id="check-in" type="time" value={correctIn} onChange={(e) => setCorrectIn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="check-out">{t('Check out')}</Label>
              <Input id="check-out" type="time" value={correctOut} onChange={(e) => setCorrectOut(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="correct-status">{t('Status')}</Label>
            <Select id="correct-status" value={correctStatus} onChange={(e) => setCorrectStatus(e.target.value)}>
              {STATUSES.filter(Boolean).map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="reason">{t('Reason (required)')}</Label>
            <Textarea
              id="reason"
              rows={3}
              value={correctReason}
              onChange={(e) => setCorrectReason(e.target.value)}
              placeholder={t('Why is this record being corrected?')}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
