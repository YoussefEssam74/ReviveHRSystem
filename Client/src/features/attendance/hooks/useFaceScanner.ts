import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../lib/api-client'
import { useCamera } from '../../../lib/use-camera'
import { postFaceScan, type FaceScanResponse } from '../api/attendance.api'
import type { AttendanceEventType } from '../types'

export type ScanPhase = 'idle' | 'starting' | 'scanning' | 'recognized'

const SCAN_INTERVAL_MS = 1300

interface UseFaceScannerOptions {
  stationCode: string
  /** Gym-bound station token from kiosk login — required on every face-scan request. */
  stationToken: string
  onResult: (result: FaceScanResponse) => void
  /** Fatal errors (403/404/409/…) surface here; transient 422s keep scanning. */
  onError: (error: unknown) => void
}

/**
 * Owns the webcam and the scan loop: captures frames and posts them to the
 * in-process face pipeline (/api/attendance/face-scan), which records the
 * attendance event on a live match. Faces that are missing, spoofed, or
 * unknown keep the loop scanning — only real failures stop it.
 */
export function useFaceScanner({ stationCode, stationToken, onResult, onError }: UseFaceScannerOptions) {
  const { videoRef, error: cameraError, start: startCamera, stop: stopCamera, capture } = useCamera()
  const timerRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const activeTypeRef = useRef<AttendanceEventType>('IN')
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)
  const stationCodeRef = useRef(stationCode)
  const stationTokenRef = useRef(stationToken)

  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    onResultRef.current = onResult
    onErrorRef.current = onError
    stationCodeRef.current = stationCode
    stationTokenRef.current = stationToken
  }, [onResult, onError, stationCode, stationToken])

  const stopScan = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    stopCamera()
    setPhase('idle')
    setStatusText('')
  }, [stopCamera])

  useEffect(() => stopScan, [stopScan])

  const scanFrame = useCallback(async () => {
    if (busyRef.current) return
    const image = capture()
    if (!image) return
    busyRef.current = true
    try {
      const result = await postFaceScan(
        {
          code: stationCodeRef.current,
          type: activeTypeRef.current,
          image,
        },
        stationTokenRef.current,
      )
      stopScan()
      setPhase('recognized')
      onResultRef.current(result)
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        if (error.code === 'LIVENESS_FAILED') {
          setStatusText('Liveness check failed — use your real face, not a photo or screen.')
        } else if (error.code === 'FACE_NOT_RECOGNIZED') {
          setStatusText('Face not recognized. Enroll this employee or use their number.')
        } else {
          setStatusText('Looking for a face…')
        }
      } else if (error instanceof ApiError && error.status === 0) {
        setStatusText('Connection problem — retrying…')
      } else {
        stopScan()
        onErrorRef.current(error)
      }
    } finally {
      busyRef.current = false
    }
  }, [capture, stopScan])

  const startScan = useCallback(async (type: AttendanceEventType) => {
    activeTypeRef.current = type
    setPhase('starting')
    setStatusText('Starting camera…')
    const started = await startCamera()
    if (!started) {
      setPhase('idle')
      setStatusText('')
      return
    }
    setPhase('scanning')
    setStatusText('Looking for a face…')
    timerRef.current = window.setInterval(() => {
      void scanFrame()
    }, SCAN_INTERVAL_MS)
  }, [startCamera, scanFrame])

  return { videoRef, phase, statusText, cameraError, startScan, stopScan }
}
