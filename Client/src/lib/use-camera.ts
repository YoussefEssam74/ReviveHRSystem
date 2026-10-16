import { useCallback, useEffect, useRef, useState } from 'react'

const GET_MEDIA_TIMEOUT_MS = 12_000

// Downscale target for uploaded frames (the face pipeline needs little detail).
const CAPTURE_MAX_WIDTH = 480
const CAPTURE_MAX_HEIGHT = 360
const CAPTURE_JPEG_QUALITY = 0.72

/** Shared webcam control: start/stop the stream and capture JPEG frames. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const abandonedRef = useRef(false)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    abandonedRef.current = true
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(async (): Promise<boolean> => {
    setError(null)
    abandonedRef.current = false
    try {
      // A permission prompt can hang forever (no camera, dismissed dialog);
      // race it against a timeout so the UI always falls back gracefully.
      const mediaPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      mediaPromise.then(
        (lateStream) => {
          if (abandonedRef.current) lateStream.getTracks().forEach((track) => track.stop())
        },
        () => undefined,
      )
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('camera-timeout')), GET_MEDIA_TIMEOUT_MS)
      })
      const stream = await Promise.race([mediaPromise, timeout])
      if (abandonedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setActive(true)
      return true
    } catch {
      setError('Camera unavailable. Allow camera access and try again.')
      return false
    }
  }, [])

  /**
   * Captures the current frame as a JPEG data URL (null when not ready). Frames
   * are downscaled before upload: the always-on kiosk loop sends one every
   * ~1.3s, and face recognition needs far less detail than the source stream.
   */
  const capture = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null
    const scale = Math.min(
      CAPTURE_MAX_WIDTH / video.videoWidth,
      CAPTURE_MAX_HEIGHT / video.videoHeight,
      1,
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', CAPTURE_JPEG_QUALITY)
  }, [])

  return { videoRef, active, error, start, stop, capture }
}