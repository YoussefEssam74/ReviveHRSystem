import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera } from '../../../lib/use-camera'
import { ApiError } from '../../../lib/api-client'
import { postFaceScan, type FaceScanOutcome, type FaceScanResponse } from '../api/attendance.api'

/** Lifecycle of the always-on kiosk scanner. */
export type ScannerPhase = 'starting' | 'scanning' | 'recognized' | 'idle'

/** One frame every ~1.3s: inside the station-attendance rate limit (120/min) and responsive. */
const FRAME_INTERVAL_MS = 1_300

/** How long the "check out now?" prompt waits for the employee before resuming. */
const CHECKOUT_PROMPT_TIMEOUT_MS = 5_000

/**
 * What the last scanned frame told us. The API returns one of these for every frame
 * (a plain 200 with an outcome discriminator), so the HUD shows a live liveness
 * percentage and the matched name and ID without ever string-matching a message.
 */
export interface FrameState {
  outcome: FaceScanOutcome
  /** Human-readable detail: rejection reason, liveness hint, ... */
  message: string | null
  /** Anti-spoofing "real face" confidence measured on this frame (0..1). */
  liveness: number
  /** Employee number of the matched employee, when a face was recognized. */
  employeeId: string | null
  /** Full name of the matched employee, when a face was recognized. */
  employeeName: string | null
}

/** The employee the kiosk is asking "check out now?" about. */
export interface CheckoutPrompt {
  employeeId: string | null
  employeeName: string | null
}

export interface KioskScannerOptions {
  onResult: (result: FaceScanResponse) => void
  /** Poll frames automatically (the kiosk default); when off, scanOnce() drives captures. */
  autoScan?: boolean
  /** The session is gone: the kiosk must return to the enrollment screen. */
  onSessionExpired: () => void
}

/** Projects a scan response into the HUD's frame state. */
function toFrameState(result: FaceScanResponse): FrameState {
  return {
    outcome: result.outcome,
    message: result.message ?? null,
    liveness: result.livenessScore,
    employeeId: result.employeeId ?? null,
    employeeName: result.employeeName ?? null,
  }
}

/**
 * Always-on face scanner for the attendance kiosk. The camera starts as soon as the
 * station is connected and keeps streaming until the terminal disconnects or
 * unmounts; frames are sent automatically with type AUTO, so the server decides
 * check-in vs check-out from the employee's own state.
 *
 * Every frame yields an outcome, not an error: frame-level states (no face, low
 * liveness, unrecognized, already complete) just refresh the HUD and keep the loop
 * running. Only a rejection that deserves the employee's attention (day off, wrong
 * branch) pauses with a card, and an invalid session stops the loop instead of
 * hammering the API.
 */
export function useKioskScanner({ autoScan = true, onResult, onSessionExpired }: KioskScannerOptions) {
  const { videoRef, error: cameraError, start: startCamera, stop: stopCamera, capture } = useCamera()

  const [phase, setPhase] = useState<ScannerPhase>('starting')
  const [statusText, setStatusText] = useState('Starting camera')
  const [rejection, setRejection] = useState<string | null>(null)
  const [frame, setFrame] = useState<FrameState | null>(null)
  const [checkoutPrompt, setCheckoutPrompt] = useState<CheckoutPrompt | null>(null)

  const timerRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const stoppedRef = useRef(false)
  const pausedRef = useRef(false)
  // The frame that triggered the check-out question - re-sent on confirmation so the
  // server re-identifies the same person instead of trusting a client-supplied ID.
  const pendingImageRef = useRef<string | null>(null)

  // Keep the callbacks fresh without restarting the loop.
  const onResultRef = useRef(onResult)
  const onSessionExpiredRef = useRef(onSessionExpired)
  useEffect(() => {
    onResultRef.current = onResult
    onSessionExpiredRef.current = onSessionExpired
  }, [onResult, onSessionExpired])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const sendFrame = useCallback(async () => {
    if (inFlightRef.current || stoppedRef.current || pausedRef.current) return

    const image = capture()
    if (!image) return

    inFlightRef.current = true
    try {
      const result = await postFaceScan({ type: 'AUTO', image })
      setFrame(toFrameState(result))

      switch (result.outcome) {
        case 'pending_checkout': {
          // AUTO resolved to check-out: nothing was recorded - ask the employee first.
          pendingImageRef.current = image
          pausedRef.current = true
          setCheckoutPrompt({
            employeeId: result.employeeId ?? null,
            employeeName: result.employeeName ?? null,
          })
          setStatusText('')
          return
        }

        case 'rejected': {
          // Recognized but refused by a business rule (day off, wrong branch): show
          // it, pause, then resume.
          pausedRef.current = true
          setStatusText('')
          setRejection(result.message || 'Attendance rejected.')
          return
        }

        case 'already_complete': {
          // Recognized, day already closed: the HUD shows their name and ID, and the
          // loop keeps running - no card, no pause, no buzz. They see they are done
          // and walk away.
          return
        }

        case 'recorded': {
          // Hold the result on screen; resumeAfterResult restarts the loop.
          pausedRef.current = true
          setPhase('recognized')
          setStatusText('')
          onResultRef.current(result)
          return
        }

        default:
          // no_face / low_liveness / unrecognized: ordinary while someone stands in
          // front of the camera. The HUD shows the measured liveness percentage.
          return
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // The session is gone (expired, revoked, or invalid): stop the loop and
        // let the page fall back to the enrollment screen.
        stoppedRef.current = true
        clearTimer()
        stopCamera()
        setPhase('idle')
        setStatusText('')
        onSessionExpiredRef.current()
        return
      }

      // Network trouble, throttling, server hiccup: keep watching, retry soon.
      setStatusText(
        error instanceof ApiError && error.status === 429
          ? 'Server busy - retrying'
          : 'Connection problem - retrying',
      )
    } finally {
      inFlightRef.current = false
    }
  }, [capture, clearTimer, stopCamera])

  const start = useCallback(async () => {
    stoppedRef.current = false
    pausedRef.current = false
    pendingImageRef.current = null
    setCheckoutPrompt(null)
    setRejection(null)
    setFrame(null)
    setPhase('starting')
    setStatusText('Starting camera')

    const started = await startCamera()
    if (!started) {
      setPhase('idle')
      setStatusText('')
      return
    }

    setPhase('scanning')
    setStatusText('Looking for a face')
    clearTimer()
    timerRef.current = window.setInterval(() => void sendFrame(), FRAME_INTERVAL_MS)
  }, [clearTimer, sendFrame, startCamera])

  const stop = useCallback(() => {
    stoppedRef.current = true
    pausedRef.current = false
    pendingImageRef.current = null
    setCheckoutPrompt(null)
    setFrame(null)
    clearTimer()
    stopCamera()
    setPhase('idle')
    setStatusText('')
  }, [clearTimer, stopCamera])

  /** Leaves the check-out prompt and resumes the always-on scan loop. */
  const resumeScanningAfterPrompt = useCallback(() => {
    if (stoppedRef.current) return
    pausedRef.current = false
    setFrame(null)
    setPhase('scanning')
    setStatusText('Looking for a face')
  }, [])

  /** The employee confirmed "check out now": re-send the same frame with confirmation. */
  const confirmCheckout = useCallback(async () => {
    const image = pendingImageRef.current
    if (!image || inFlightRef.current) return

    inFlightRef.current = true
    try {
      const result = await postFaceScan({ type: 'AUTO', image, confirmCheckout: true })
      setCheckoutPrompt(null)
      pendingImageRef.current = null
      if (result.outcome === 'pending_checkout') {
        // Defensive: the state changed between the two frames - just keep scanning.
        resumeScanningAfterPrompt()
        return
      }
      setFrame(toFrameState(result))
      if (result.outcome === 'recorded') {
        pausedRef.current = true
        setPhase('recognized')
        setStatusText('')
        onResultRef.current(result)
        return
      }
      // Anything else (rejected, already complete, ...) keeps scanning; the rejection
      // card is only shown for an explicit rejection.
      if (result.outcome === 'rejected') {
        pausedRef.current = true
        setStatusText('')
        setRejection(result.message || 'Attendance rejected.')
        return
      }
      resumeScanningAfterPrompt()
    } catch (error) {
      setCheckoutPrompt(null)
      pendingImageRef.current = null
      if (error instanceof ApiError && error.status === 401) {
        stoppedRef.current = true
        clearTimer()
        stopCamera()
        setPhase('idle')
        setStatusText('')
        onSessionExpiredRef.current()
        return
      }
      setStatusText(error instanceof ApiError ? error.message : 'Connection problem - retrying')
      resumeScanningAfterPrompt()
    } finally {
      inFlightRef.current = false
    }
  }, [clearTimer, resumeScanningAfterPrompt, stopCamera])

  /** The employee declined (or the prompt timed out): keep the day open and scan on. */
  const cancelCheckout = useCallback(() => {
    setCheckoutPrompt(null)
    pendingImageRef.current = null
    resumeScanningAfterPrompt()
  }, [resumeScanningAfterPrompt])

  // An unattended prompt must not block the next person: fall back to scanning.
  useEffect(() => {
    if (checkoutPrompt === null) return undefined
    const timer = window.setTimeout(() => cancelCheckout(), CHECKOUT_PROMPT_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [checkoutPrompt, cancelCheckout])

  /** Called by the page once a result or rejection card is dismissed. */
  const resumeAfterResult = useCallback(() => {
    setRejection(null)
    if (stoppedRef.current) return
    pausedRef.current = false
    setFrame(null)
    setPhase('scanning')
    setStatusText('Looking for a face')
  }, [])

  // Start/stop the polling loop with the toggle (the camera itself stays on).
  useEffect(() => {
    if (autoScan) {
      clearTimer()
      timerRef.current = window.setInterval(() => void sendFrame(), FRAME_INTERVAL_MS)
    } else {
      clearTimer()
    }
    return clearTimer
  }, [autoScan, clearTimer, sendFrame])

  /** Captures a single frame â€” used when auto-scan is off. */
  const scanOnce = useCallback(() => {
    if (!stoppedRef.current) void sendFrame()
  }, [sendFrame])

  // Never leave the camera running after unmount.
  useEffect(() => stop, [stop])

  return {
    videoRef,
    phase,
    statusText,
    rejection,
    frame,
    checkoutPrompt,
    cameraError,
    start,
    stop,
    resumeAfterResult,
    scanOnce,
    confirmCheckout,
    cancelCheckout,
  }
}