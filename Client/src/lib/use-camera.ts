import { useCallback, useEffect, useRef, useState } from 'react'

const GET_MEDIA_TIMEOUT_MS = 12_000

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

  /** Captures the current frame as a JPEG data URL (null when not ready). */
  const capture = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  }, [])

  return { videoRef, active, error, start, stop, capture }
}
