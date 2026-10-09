import { useState } from 'react'
import { CheckCircle2, Clock3, ScanLine, Sparkles } from 'lucide-react'
import { ApiError, describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { AttendanceEventForm } from '../components/AttendanceEventForm'
import { FaceScanPanel } from '../components/FaceScanPanel'
import { StationConnectForm } from '../components/StationConnectForm'
import { useRecordAttendanceEvent, useStationLogin } from '../hooks/useAttendanceStation'
import type { AttendanceResponse, FaceScanResponse } from '../api/attendance.api'
import type { AttendanceEventType, ConnectedStation } from '../types'

const STATUS_LABELS: Record<string, string> = {
  ONTIME: 'On time',
  LATE: 'Late',
  EARLYCHECKOUT: 'Early checkout',
  ABSENT: 'Absent',
}

const COMPARISON_LABELS: Record<string, string> = {
  ON_SCHEDULE: 'On schedule',
  LATE: 'Late',
  EARLY_CHECKOUT: 'Early checkout',
}

export default function AttendancePage() {
  const stationLogin = useStationLogin()
  const recordEvent = useRecordAttendanceEvent()
  const [station, setStation] = useState<ConnectedStation | null>(null)
  const [lastEvent, setLastEvent] = useState<AttendanceResponse | null>(null)
  const [lastFace, setLastFace] = useState<{ similarity: number; livenessScore: number } | null>(null)
  const [mode, setMode] = useState<'face' | 'manual'>('face')
  const [faceError, setFaceError] = useState<string | null>(null)
  // Shown on the connect form (e.g. after a station token expires mid-session).
  const [connectError, setConnectError] = useState<string | null>(null)

  const handleConnect = async (code: string) => {
    setConnectError(null)
    try {
      const response = await stationLogin.mutateAsync(code)
      if (!response.token) {
        // The API always issues a token; a missing one means a stale contract.
        throw new ApiError(500, 'STATION_TOKEN_MISSING', 'Station login did not return a token. Please retry.')
      }
      setStation({
        code,
        gymId: response.gymId ?? 0,
        gymName: response.gymName ?? 'Unknown gym',
        token: response.token,
      })
      setLastEvent(null)
      setLastFace(null)
      setFaceError(null)
    } catch {
      // Surfaced through stationLogin.error below.
    }
  }

  const handleRecord = async (employeeNumber: string, type: AttendanceEventType) => {
    if (!station) return
    try {
      const response = await recordEvent.mutateAsync({
        code: station.code,
        stationToken: station.token,
        employeeId: employeeNumber,
        type,
      })
      setLastFace(null)
      setLastEvent(response)
    } catch (error) {
      // Expired/rotated station token — the connection itself is gone.
      if (error instanceof ApiError && error.status === 401) {
        handleDisconnect()
        setConnectError('Station connection expired. Reconnect with the station code.')
        return
      }
      // Surfaced through recordEvent.error below.
    }
  }

  const handleFaceResult = (result: FaceScanResponse) => {
    setLastFace({ similarity: result.similarity, livenessScore: result.livenessScore })
    setLastEvent(result.attendance)
  }

  const handleFaceError = (error: unknown) => {
    // An expired/rotated station token invalidates the connection itself —
    // drop back to the connect form instead of showing a dead scanner.
    if (error instanceof ApiError && error.status === 401) {
      handleDisconnect()
      setConnectError('Station connection expired. Reconnect with the station code.')
      return
    }
    setFaceError(describeApiError(error))
  }

  const handleDisconnect = () => {
    setStation(null)
    setLastEvent(null)
    setLastFace(null)
    setFaceError(null)
    setMode('face')
    stationLogin.reset()
    recordEvent.reset()
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <ScanLine className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance station</h1>
        <p className="mt-1 text-sm text-slate-500">Public check-in and check-out — no account needed.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{station ? 'Record attendance' : 'Connect station'}</CardTitle>
          <CardDescription>
            {station
              ? 'Look at the camera for Face ID check-in, or use your employee number.'
              : 'Enter the six-digit code printed on this attendance station.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!station ? (
            <StationConnectForm
              pending={stationLogin.isPending}
              errorMessage={connectError ?? (stationLogin.error ? describeApiError(stationLogin.error) : null)}
              onConnect={handleConnect}
            />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Check-in method">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'face'}
                  onClick={() => setMode('face')}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    mode === 'face' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  Face scan
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'manual'}
                  onClick={() => setMode('manual')}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    mode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  Employee number
                </button>
              </div>

              {mode === 'face' ? (
                <>
                  {faceError && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {faceError}
                    </p>
                  )}
                  <FaceScanPanel
                    stationCode={station.code}
                    stationToken={station.token}
                    onResult={handleFaceResult}
                    onError={handleFaceError}
                  />
                </>
              ) : (
                <AttendanceEventForm
                  gymName={station.gymName}
                  pending={recordEvent.isPending}
                  errorMessage={recordEvent.error ? describeApiError(recordEvent.error) : null}
                  onRecord={handleRecord}
                  onDisconnect={handleDisconnect}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {lastEvent && <EventResultCard event={lastEvent} face={lastFace} />}
    </div>
  )
}

function EventResultCard({ event, face }: { event: AttendanceResponse; face: { similarity: number; livenessScore: number } | null }) {
  const statusLabel = event.attendanceStatus ? (STATUS_LABELS[event.attendanceStatus.toUpperCase()] ?? event.attendanceStatus) : null
  const comparisonLabel = event.shiftComparison ? (COMPARISON_LABELS[event.shiftComparison.toUpperCase()] ?? event.shiftComparison) : null
  const recordedAt = event.timestamp ? new Date(event.timestamp).toLocaleString() : null

  return (
    <Card className="mt-6 border-emerald-200 bg-emerald-50/60">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <p className="text-sm font-bold">
            {event.type === 'IN' ? 'Check-in recorded' : 'Check-out recorded'}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-slate-900">{event.employeeName || event.employeeId}</p>
          <p className="text-xs text-slate-500">{event.employeeId} · {event.gymName}</p>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Status</dt>
            <dd className="mt-0.5 flex items-center gap-1 font-semibold text-slate-900">
              {statusLabel ?? 'Recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Schedule</dt>
            <dd className="mt-0.5 flex items-center gap-1 font-semibold text-slate-900">
              <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              {comparisonLabel ?? '—'}
            </dd>
          </div>
        </dl>

        {face && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Face verified · match {Math.round(face.similarity * 100)}% · liveness {Math.round(face.livenessScore * 100)}%
          </p>
        )}

        {recordedAt && <p className="text-xs text-slate-400">Record {event.recordId} · {recordedAt}</p>}
      </CardContent>
    </Card>
  )
}
