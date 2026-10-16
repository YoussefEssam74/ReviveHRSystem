import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fingerprint, Link2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { describeApiError } from '../../../lib/api-client'
import { postManualAttendance, postStationLogin, getStationSession, getStationSummary, postStationLogout } from '../api/attendance.api'
import { useKioskScanner } from '../hooks/useKioskScanner'
import { useSoundEffects } from '../hooks/useSoundEffects'
import { ManualPanel } from '../components/KioskManualPanel'
import { FeedRow, useClock } from '../components/KioskPanels'
import { KioskViewfinder } from '../components/KioskViewfinder'
import type { AttendanceResult, ConnectedStation, FaceMatchDetail } from '../types'

const RESULT_VISIBLE_MS = 4_000
const REJECTION_VISIBLE_MS = 6_000
const SUMMARY_POLL_MS = 10_000

/**
 * Public attendance station (ADR-004 station credential). No web sign-in: the terminal
 * redeems a short-lived 6-digit enrollment code and the API stores the resulting session
 * in an HttpOnly cookie, so React never sees or stores a token. On mount the station
 * re-enrolls itself from that cookie (GET /api/kiosk/session), surviving reloads, backend
 * restarts and PC reboots for the session's 30-day lifetime. While connected the camera
 * runs continuously, the server decides check-in vs check-out from the employee's own
 * state (type AUTO), and the dashboard shows today's counters and feed for this gym.
 */
export default function AttendancePage() {
  const [station, setStation] = useState<ConnectedStation | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [autoScan, setAutoScan] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [mode, setMode] = useState<'face' | 'manual'>('face')
  const [lastResult, setLastResult] = useState<AttendanceResult | null>(null)
  const [lastFace, setLastFace] = useState<FaceMatchDetail | null>(null)
  const [toast, setToast] = useState<{ tone: 'ok' | 'err'; message: string } | null>(null)

  const sound = useSoundEffects()
  const queryClient = useQueryClient()
  const clock = useClock()

  useEffect(() => {
    sound.setEnabled(soundEnabled)
  }, [sound, soundEnabled])
  useEffect(() => sound.dispose, [sound])

  const connectMutation = useMutation({
    mutationFn: (enteredCode: string) => postStationLogin(enteredCode),
  })

  // Re-enroll from the HttpOnly station cookie after a reload or machine reboot.
  // 401 here simply means "no live session", i.e. the normal awaiting-code state.
  const restore = useQuery({
    queryKey: ['station-session'],
    queryFn: () => getStationSession(),
    retry: false,
    staleTime: Infinity,
  })

  // One-shot hydration: only the first live session (if any) auto-connects the kiosk,
  // so a later disconnect is never undone by a cached restore payload.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    const data = restore.data
    if (data?.gymId) {
      hydratedRef.current = true
      setStation({
        gymId: data.gymId,
        gymName: data.gymName ?? 'Unknown gym',
        sessionExpiresAtUtc: data.sessionExpiresAtUtc ?? '',
      })
      setMode('face')
    } else if (restore.isError) {
      hydratedRef.current = true
    }
  }, [restore.data, restore.isError])

  const manualMutation = useMutation({
    mutationFn: (input: { employeeNumber: string; type: 'IN' | 'OUT'; reason: string }) => {
      if (!station) throw new Error('No station session')
      return postManualAttendance({ employeeId: input.employeeNumber, type: input.type, reason: input.reason })
    },
  })

  // Today's counters and feed for the station's gym (polled; the gym comes from the session).
  const summary = useQuery({
    queryKey: ['station-summary', station?.gymId],
    queryFn: () => getStationSummary(),
    enabled: Boolean(station),
    refetchInterval: SUMMARY_POLL_MS,
    retry: false,
  })

  const toastTimerRef = useRef<number | null>(null)

  const notify = useCallback((tone: 'ok' | 'err', message: string) => {
    setToast({ tone, message })
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3_400)
  }, [])

  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    },
    [],
  )

  const scanner = useKioskScanner({
    autoScan: autoScan && mode === 'face',
    onResult: handleFaceResult,
    onSessionExpired: handleSessionExpired,
  })

  const { start: startScanner, stop: stopScanner, resumeAfterResult, scanOnce } = scanner

  function handleFaceResult(result: {
    attendance?: AttendanceResult | null
    similarity: number
    livenessScore: number
  }) {
    // Only an outcome that actually recorded a punch reaches here; pending
    // check-outs and silent "already complete" frames carry no punch to show.
    if (!result.attendance) return
    setLastFace({ similarity: result.similarity, livenessScore: result.livenessScore })
    setLastResult(result.attendance)
    sound.playSuccess()
    void queryClient.invalidateQueries({ queryKey: ['station-summary'] })
  }

  function handleSessionExpired() {
    setStation(null)
    setLastResult(null)
    setLastFace(null)
    setConnectError('The station session ended. Enter a fresh code to reconnect.')
    notify('err', 'Station session ended')
  }

  const cardVisible = lastResult !== null || scanner.rejection !== null

  // Result and rejection cards pause the camera loop, then auto-dismiss so the
  // always-on scanner resumes on its own.
  useEffect(() => {
    if (!cardVisible) return undefined
    if (scanner.rejection !== null) sound.playRejected()
    const timer = window.setTimeout(
      () => {
        setLastResult(null)
        setLastFace(null)
        resumeAfterResult()
      },
      scanner.rejection !== null ? REJECTION_VISIBLE_MS : RESULT_VISIBLE_MS,
    )
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardVisible, scanner.rejection, resumeAfterResult])

  const handleConnect = useCallback(
    (submittedCode: string) => {
      setConnectError(null)
      connectMutation.mutate(submittedCode, {
        onSuccess: (response) => {
          // The API sets the HttpOnly session cookie; React only keeps the gym context.
          setStation({
            gymId: response.gymId ?? 0,
            gymName: response.gymName ?? 'Unknown gym',
            sessionExpiresAtUtc: response.sessionExpiresAtUtc ?? '',
          })
          setLastResult(null)
          setLastFace(null)
          setMode('face')
        },
      })
    },
    [connectMutation],
  )

  // The camera streams from the moment the station connects until it disconnects.
  // The scan LOOP is gated separately (autoScan && face mode) inside the hook, so
  // using the manual fallback never tears the camera stream down.
  useEffect(() => {
    if (station) {
      void startScanner()
      return () => {
        stopScanner()
      }
    }
    return undefined
  }, [station, startScanner, stopScanner])

  const handleDisconnect = useCallback(() => {
    stopScanner()
    // Best-effort: revoke the session server-side and clear the HttpOnly cookie.
    // A failure (already-expired session, offline API) leaves state to the clears below.
    void postStationLogout().catch(() => undefined)
    setStation(null)
    setLastResult(null)
    setLastFace(null)
    setConnectError(null)
    setMode('face')
    connectMutation.reset()
    manualMutation.reset()
  }, [connectMutation, manualMutation, stopScanner])

  const handleManualRecord = useCallback(
    (employeeNumber: string, type: 'IN' | 'OUT', reason: string) => {
      manualMutation.mutate(
        { employeeNumber, type, reason },
        {
          onSuccess: (result) => {
            setLastFace(null)
            setLastResult(result)
            sound.playSuccess()
            void queryClient.invalidateQueries({ queryKey: ['station-summary'] })
            notify('ok', 'Recorded ' + (result.type === 'OUT' ? 'check-out' : 'check-in') + ' for ' + (result.employeeName ?? result.employeeId ?? employeeNumber))
          },
          onError: (error) => {
            notify('err', describeApiError(error))
            sound.playRejected()
          },
        },
      )
    },
    [manualMutation, notify, queryClient, sound],
  )

  const connectErrorMessage =
    connectError ?? (connectMutation.isError ? describeApiError(connectMutation.error) : null)
  const manualError = manualMutation.isError ? describeApiError(manualMutation.error) : null
  const feed = summary.data?.records ?? []

  if (!station) {
    if (restore.isPending) {
      return (
        <KioskShell clockTime={clock.time} clockDate={clock.date}>
          <p className="flex flex-1 items-center justify-center text-sm font-medium text-charcoal-500">
            Restoring station session...
          </p>
        </KioskShell>
      )
    }
    return (
      <KioskShell clockTime={clock.time} clockDate={clock.date}>
        <ActivationView
          code={code}
          onCodeChange={setCode}
          pending={connectMutation.isPending}
          errorMessage={connectErrorMessage}
          onConnect={handleConnect}
        />
      </KioskShell>
    )
  }

  return (
    <KioskShell
      gymName={station.gymName}
      connected
      clockTime={clock.time}
      clockDate={clock.date}
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[1fr_370px] lg:gap-4 lg:p-4">
        <KioskCameraPanel
          scanner={scanner}
          gymName={station.gymName}
          autoScan={autoScan}
          soundEnabled={soundEnabled}
          clockTime={clock.time}
          lastResult={lastResult}
          lastFace={lastFace}
          onToggleAutoScan={() => setAutoScan((value) => !value)}
          onToggleSound={() => setSoundEnabled((value) => !value)}
          onScanNow={scanOnce}
          onRetryCamera={() => void startScanner()}
          onUseManual={() => setMode('manual')}
          onDismissResult={() => {
            setLastResult(null)
            setLastFace(null)
            resumeAfterResult()
          }}
        />

        <aside className="flex min-h-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-200 bg-white px-3.5 py-2.5 shadow-sm">
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl font-bold leading-none tabular-nums text-brand-600">
                {summary.data?.presentCount ?? 0}
              </p>
              <p className="text-sm font-bold leading-none tabular-nums text-charcoal-400">
                / <span>{summary.data?.scheduledTodayCount ?? 0}</span>
              </p>
            </div>
            <p className="text-right text-[10px] font-medium leading-tight text-charcoal-500">
              employees present now
              <br />
              of scheduled today
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-col overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-charcoal-100 bg-charcoal-50/50 px-3.5 py-2.5">
              <p className="text-[11px] font-bold tracking-wide text-charcoal-700 uppercase whitespace-nowrap">
                {mode === 'face' ? 'Manual fallback' : 'Manual entry'}
              </p>
              <p className="font-mono text-[10px] whitespace-nowrap text-charcoal-400">Method: Manual</p>
            </div>

            {mode === 'face' ? (
              <div className="p-3">
                <Button variant="outline" size="sm" className="w-full" onClick={() => setMode('manual')}>
                  Enter employee number
                </Button>
              </div>
            ) : (
              <ManualPanel
                pending={manualMutation.isPending}
                errorMessage={manualError}
                onRecord={handleManualRecord}
                onBackToFace={() => setMode('face')}
              />
            )}
          </div>

          <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-charcoal-100 bg-charcoal-50/50 px-3.5 py-2.5">
              <p className="text-[11px] font-bold tracking-wide text-charcoal-700 uppercase whitespace-nowrap">
                Gym staff &amp; roster
              </p>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void summary.refetch()}
                  className="text-[11px] font-semibold text-charcoal-500 hover:text-brand-700"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  title="Disconnect this station"
                  className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                >
                  Disconnect
                </button>
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
              {summary.isPending && (
                <p className="px-1 py-2 text-xs text-charcoal-400">Loading today's attendance...</p>
              )}
              {summary.isError && (
                <p className="px-1 py-2 text-xs text-red-600">{describeApiError(summary.error)}</p>
              )}
              {!summary.isPending && !summary.isError && feed.length === 0 && (
                <p className="px-1 py-2 text-xs text-charcoal-400 italic">
                  No attendance recorded at this gym today yet.
                </p>
              )}
              {feed.map((row) => (
                <FeedRow key={row.recordId ?? row.employeeId} row={row} />
              ))}
            </div>
          </div>
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          className={
            'fixed right-4 bottom-4 z-50 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-lg ' +
            (toast.tone === 'ok' ? 'bg-brand-600' : 'bg-red-600')
          }
        >
          {toast.message}
        </div>
      )}
    </KioskShell>
  )
}
/* ------------------------------------------------------------------ */
/* Shell + activation view                                            */
/* ------------------------------------------------------------------ */

function KioskShell({
  children,
  gymName,
  connected = false,
  clockTime = '--:--:--',
  clockDate = '',
}: {
  children: React.ReactNode
  gymName?: string
  connected?: boolean
  clockTime?: string
  clockDate?: string
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-charcoal-200 bg-white px-4 shadow-sm lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Fingerprint className="h-[22px] w-[22px]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold leading-tight text-charcoal-900">Attendance Station</h1>
              <span className="rounded bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-brand-800 uppercase">
                Kiosk
              </span>
            </div>
            <p className="truncate text-[11px] text-charcoal-500">
              Revive HR · <span className="font-semibold text-charcoal-700">{gymName ?? 'Not connected'}</span> ·{' '}
              <span className={connected ? 'font-semibold text-brand-600' : 'font-semibold text-amber-600'}>
                {connected ? 'Authorized' : 'Awaiting code'}
              </span>
            </p>
          </div>
        </div>

        <div className="pl-1 text-right sm:pl-2">
          <p className="font-mono text-lg font-bold leading-none tabular-nums text-charcoal-900">{clockTime}</p>
          <p className="mt-0.5 text-[10px] tabular-nums text-charcoal-500">{clockDate}</p>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}

function ActivationView({
  code,
  onCodeChange,
  pending,
  errorMessage,
  onConnect,
}: {
  code: string
  onCodeChange: (value: string) => void
  pending: boolean
  errorMessage: string | null
  onConnect: (code: string) => void
}) {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-gray-900 p-4 text-white sm:p-6">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 shadow-lg backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <span>Terminal offline - enter the HR enrollment code to connect</span>
        </div>

        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-300/30 bg-gradient-to-tr from-brand-600 to-emerald-400 shadow-xl shadow-brand-500/20">
          <Fingerprint className="h-8 w-8" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Connect Attendance Station</h1>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-charcoal-300 sm:text-sm">
          Generate a 6-digit code in the <strong className="text-white">Revive HR portal</strong>, enter it below,
          and this terminal locks to that gym branch. The code expires 5 minutes after generation.
        </p>

        <form
          className="relative mt-6 w-full overflow-hidden rounded-3xl border border-charcoal-700/80 bg-charcoal-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
          onSubmit={(event) => {
            event.preventDefault()
            onConnect(code.trim())
          }}
        >
          <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-brand-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />

          <label
            htmlFor="station-code"
            className="mb-2 block px-1 text-left text-[11px] font-bold tracking-wider text-charcoal-300 uppercase"
          >
            Enter 6-digit code
          </label>
          <input
            id="station-code"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={code}
            onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="• • • • • •"
            className="h-16 w-full rounded-2xl border-2 border-brand-500/50 bg-charcoal-800/90 text-center font-mono text-3xl font-extrabold tracking-[0.35em] text-white transition-all outline-none placeholder:tracking-widest placeholder:text-charcoal-600 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/20 sm:text-4xl"
          />

          {errorMessage && (
            <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-950/60 px-3 py-2 text-sm text-red-300">
              {errorMessage}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-5 w-full" loading={pending}>
            <Link2 className="h-5 w-5" aria-hidden="true" />
            Connect &amp; lock to gym
          </Button>
        </form>

        <div className="mt-8 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {[
            ['1. HR generates code', 'HR opens the portal, selects the branch, and generates a code.'],
            ['2. Terminal enters code', 'This station redeems the code once for a gym-bound session.'],
            ['3. Locked to branch', 'Only staff assigned to this gym can check in at this terminal.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-charcoal-800 bg-charcoal-900/60 p-3 text-[11px]">
              <p className="mb-0.5 font-bold text-brand-400">{title}</p>
              <p className="text-charcoal-400">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
/* ------------------------------------------------------------------ */
/* Camera panel wrapper                                               */
/* ------------------------------------------------------------------ */

function KioskCameraPanel({
  scanner,
  autoScan,
  soundEnabled,
  clockTime,
  lastResult,
  lastFace,
  onToggleAutoScan,
  onToggleSound,
  onScanNow,
  onRetryCamera,
  onUseManual,
  onDismissResult,
  gymName,
}: {
  scanner: ReturnType<typeof useKioskScanner>
  autoScan: boolean
  soundEnabled: boolean
  clockTime: string
  lastResult: AttendanceResult | null
  lastFace: FaceMatchDetail | null
  onToggleAutoScan: () => void
  onToggleSound: () => void
  onScanNow: () => void
  onRetryCamera: () => void
  onUseManual: () => void
  onDismissResult: () => void
  gymName: string
}) {
  // The scan loop is gated inside the hook (autoScan && face mode), so the manual
  // fallback pauses scanning while the camera keeps streaming.
  return (
    <KioskViewfinder
      videoRef={scanner.videoRef}
      phase={scanner.phase}
      statusText={scanner.statusText}
      rejection={scanner.rejection}
      frame={scanner.frame}
      result={lastResult}
      face={lastFace}
      checkoutPrompt={scanner.checkoutPrompt}
      cameraError={scanner.cameraError}
      autoScan={autoScan}
      soundEnabled={soundEnabled}
      gymName={gymName}
      clockTime={clockTime}
      onToggleAutoScan={onToggleAutoScan}
      onToggleSound={onToggleSound}
      onScanNow={onScanNow}
      onRetryCamera={onRetryCamera}
      onUseManual={onUseManual}
      onDismissResult={onDismissResult}
      onConfirmCheckout={() => void scanner.confirmCheckout()}
      onCancelCheckout={scanner.cancelCheckout}
    />
  )
}