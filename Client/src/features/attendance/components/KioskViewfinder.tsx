import { CheckCircle2, CloudOff, Cctv, Loader2, ScanFace, XCircle } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import type { CheckoutPrompt, FrameState, ScannerPhase } from '../hooks/useKioskScanner'
import { CheckoutConfirmCard, ResultOverlay } from './KioskPanels'
import type { AttendanceResult, FaceMatchDetail } from '../types'

const RETICLE_ACTIVE = 'rgba(34,197,94,0.85)'
const RETICLE_IDLE = 'rgba(255,255,255,0.25)'

/** Attendance gate for a live scan; mirrors Biometrics:ScanLivenessThreshold (0.70). */
const LIVENESS_GATE = 0.7

const PHASE_META: Record<ScannerPhase, { title: string; badge: string; tone: string }> = {
  starting: { title: 'Starting camera...', badge: 'STARTING', tone: 'text-white/90' },
  scanning: { title: 'Stand in front of the camera', badge: 'SCANNING', tone: 'text-white/90' },
  recognized: { title: 'Recognized', badge: 'MATCHED', tone: 'text-emerald-300' },
  idle: { title: 'Camera is off', badge: 'IDLE', tone: 'text-white/90' },
}

/**
 * The live liveness percentage badge. Shown whenever a face was detected on the last
 * frame, so the person watching the camera sees the anti-spoofing score move as they
 * adjust - green once it clears the attendance gate, red below it.
 */
function LivenessBadge({ liveness }: { liveness: number }) {
  const percent = Math.round(liveness * 100)
  const passes = liveness >= LIVENESS_GATE
  return (
    <span
      className={
        'rounded px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums ' +
        (passes ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300')
      }
      title={passes ? 'Liveness clears the attendance gate' : 'Liveness below the attendance gate'}
    >
      {percent}%
    </span>
  )
}

interface KioskViewfinderProps {
  videoRef: React.Ref<HTMLVideoElement>
  phase: ScannerPhase
  statusText: string
  rejection: string | null
  frame: FrameState | null
  result: AttendanceResult | null
  face: FaceMatchDetail | null
  checkoutPrompt: CheckoutPrompt | null
  cameraError: string | null
  autoScan: boolean
  soundEnabled: boolean
  gymName: string
  onToggleAutoScan: () => void
  onToggleSound: () => void
  onScanNow: () => void
  onRetryCamera: () => void
  onUseManual: () => void
  onDismissResult: () => void
  onConfirmCheckout: () => void
  onCancelCheckout: () => void
  clockTime: string
}

/**
 * The always-on camera viewfinder: streams from the moment the station connects,
 * with the scanning reticle, laser line and live status HUD. Reticle color tracks
 * the scanner phase; a camera problem keeps manual entry one click away so a blocked
 * camera never blocks attendance.
 */
export function KioskViewfinder({
  videoRef,
  phase,
  statusText,
  rejection,
  frame,
  result,
  face,
  checkoutPrompt,
  cameraError,
  autoScan,
  soundEnabled,
  gymName,
  onToggleAutoScan,
  onToggleSound,
  onScanNow,
  onRetryCamera,
  onUseManual,
  onDismissResult,
  onConfirmCheckout,
  onCancelCheckout,
  clockTime,
}: KioskViewfinderProps) {
  const streaming = phase === 'starting' || phase === 'scanning' || phase === 'recognized'
  const meta = PHASE_META[phase]

  // The strip's first line names whoever was recognized - the employee sees their own
  // name and ID - then falls back to "face detected" while a face is in frame, and to
  // the phase title when there is nothing to report yet.
  const matched = frame?.employeeId != null || frame?.employeeName != null
  const faceInFrame = frame != null && frame.outcome !== 'no_face'
  const stripTitle = matched
    ? [frame?.employeeName, frame?.employeeId ? `(${frame.employeeId})` : null].filter(Boolean).join(' ')
    : faceInFrame
      ? 'Face detected'
      : statusText || meta.title
  const stripDetail = rejection ?? frame?.message ?? 'Anti-spoofing and face identification run continuously'

  return (
    <section className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-100 bg-charcoal-50/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Cctv className="h-[18px] w-[18px] text-brand-600" aria-hidden="true" />
            <p className="text-xs font-bold text-charcoal-800">
              YuNet detection - Silent-Face anti-spoofing - SFace 1-to-N
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSound}
              className="inline-flex items-center gap-1 rounded border border-charcoal-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-charcoal-600 transition-colors hover:text-charcoal-900"
              title="Toggle sound alerts"
            >
              {soundEnabled ? 'Audio: ON' : 'Audio: OFF'}
            </button>
            <button
              type="button"
              onClick={onToggleAutoScan}
              className={
                'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold transition-colors ' +
                (autoScan
                  ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
                  : 'border-charcoal-200 bg-white text-charcoal-600 hover:text-charcoal-900')
              }
              title="Automatically record attendance when a face is recognized"
            >
              {autoScan ? 'Auto-scan: ON' : 'Auto-scan: OFF'}
            </button>
            <span className="rounded border border-charcoal-200 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-charcoal-600">
              {gymName}
            </span>
          </div>
        </div>

        <div
          className="relative flex min-h-[380px] flex-1 flex-col justify-between overflow-hidden border-2 border-brand-500/30 bg-black transition-colors"
          style={{ borderColor: streaming ? (phase === 'recognized' ? RETICLE_ACTIVE : undefined) : RETICLE_IDLE }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={
              'absolute inset-0 z-0 h-full w-full -scale-x-100 object-cover ' + (streaming ? 'block' : 'hidden')
            }
          />

          <div
            className="pointer-events-none absolute inset-4 rounded-2xl border border-white/10 transition-all sm:inset-8"
            style={{ borderColor: streaming ? RETICLE_ACTIVE : RETICLE_IDLE }}
          />
          {['left-4 top-4 rounded-tl-lg sm:left-8 sm:top-8', 'right-4 top-4 rounded-tr-lg sm:right-8 sm:top-8', 'left-4 bottom-4 rounded-bl-lg sm:left-8 sm:bottom-8', 'right-4 bottom-4 rounded-br-lg sm:right-8 sm:bottom-8'].map((position) => (
            <div
              key={position}
              className={
                'pointer-events-none absolute h-8 w-8 border-2 border-brand-400 transition-colors ' + position
              }
            />
          ))}
          {streaming && phase !== 'recognized' && <div className="scanline z-10" />}

          <div className="relative z-10 flex items-center justify-between p-3">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/60 px-2.5 py-1 font-mono text-[11px] text-white/90 backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
              LIVE VISION ACTIVE
            </span>
            <span className="rounded-md border border-white/15 bg-black/60 px-2 py-1 font-mono text-[11px] text-white/70 backdrop-blur-md">
              {clockTime}
            </span>
          </div>

          {/* Camera failure: same overlay design as the Mock UI's offline card,
              constrained to the viewfinder frame (never the whole page). */}
          {cameraError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-charcoal-900/95 px-6 text-center backdrop-blur-sm">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-charcoal-700 bg-charcoal-800 text-amber-400 shadow-lg">
                <CloudOff className="h-[34px] w-[34px]" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-white">Camera unavailable</h3>
              <p className="mt-1 max-w-sm text-xs text-charcoal-400">{cameraError}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={onRetryCamera}>
                  Try camera again
                </Button>
                <Button variant="outline" size="sm" onClick={onUseManual}>
                  Enter employee number
                </Button>
              </div>
            </div>
          )}

          {!streaming && !cameraError && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
              <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full border-2 border-white/20 bg-black/20 text-white/70 backdrop-blur-sm">
                <ScanFace className="h-12 w-12" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-bold text-white drop-shadow">Starting camera...</p>
            </div>
          )}

          <div className="relative z-10 p-3">
            <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/75 px-4 py-2.5 text-white shadow-lg backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-2.5">
                {phase === 'recognized' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-400" aria-hidden="true" />
                ) : rejection ? (
                  <XCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
                ) : matched ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-400" aria-hidden="true" />
                ) : phase === 'scanning' ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-400" aria-hidden="true" />
                ) : (
                  <Cctv className="h-5 w-5 shrink-0 text-brand-400" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p aria-live="polite" className={'truncate text-xs font-bold leading-tight ' + meta.tone}>
                    {stripTitle}
                  </p>
                  <p className="truncate text-[10px] leading-tight text-white/70">{stripDetail}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {faceInFrame && frame ? (
                  <LivenessBadge liveness={frame.liveness} />
                ) : (
                  <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-white/90 uppercase">
                    {meta.badge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!autoScan && (
            <div className="absolute inset-x-0 bottom-16 z-20 flex justify-center">
              <Button size="sm" onClick={onScanNow}>
                Scan now
              </Button>
            </div>
          )}

          {/* Success / rejection cards live INSIDE the viewfinder (mock: #vf-result). */}
          {(result !== null || rejection !== null) && (
            <ResultOverlay result={result} face={face} rejection={rejection} onDismiss={onDismissResult} />
          )}

          {/* "Check out now?" - the AUTO scan would close the day; nothing is recorded
              until the employee confirms. Also lives inside the viewfinder. */}
          {checkoutPrompt !== null && (
            <CheckoutConfirmCard
              employeeId={checkoutPrompt.employeeId}
              employeeName={checkoutPrompt.employeeName}
              onConfirm={onConfirmCheckout}
              onCancel={onCancelCheckout}
            />
          )}
        </div>
      </div>
    </section>
  )
}