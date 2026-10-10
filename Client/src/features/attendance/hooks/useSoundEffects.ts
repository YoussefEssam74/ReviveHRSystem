import { useCallback, useRef } from 'react'

/**
 * Short synthesized alerts for the kiosk (no audio assets to ship or cache):
 * a two-note chime for a recorded punch, a low buzz for a rejection. Uses the
 * WebAudio API and no-ops where it is unavailable. Defaults to off so a shared
 * terminal is silent until an operator opts in.
 */
export function useSoundEffects() {
  const enabledRef = useRef(false)
  const contextRef = useRef<AudioContext | null>(null)

  const ensureContext = useCallback((): AudioContext | null => {
    if (contextRef.current) return contextRef.current
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null
    try {
      contextRef.current = new AudioContextCtor()
    } catch {
      return null
    }
    return contextRef.current
  }, [])

  const tone = useCallback(
    (frequency: number, startAt: number, duration: number, gainValue: number, type: OscillatorType) => {
      const context = ensureContext()
      if (!context) return
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(gainValue, context.currentTime + startAt)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + startAt + duration)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(context.currentTime + startAt)
      oscillator.stop(context.currentTime + startAt + duration)
    },
    [ensureContext],
  )

  const playSuccess = useCallback(() => {
    if (!enabledRef.current) return
    tone(523.25, 0, 0.18, 0.15, 'sine') // C5
    tone(659.25, 0.12, 0.3, 0.15, 'sine') // E5
  }, [tone])

  const playRejected = useCallback(() => {
    if (!enabledRef.current) return
    tone(220, 0, 0.2, 0.18, 'sawtooth')
    tone(180, 0.2, 0.28, 0.18, 'sawtooth')
  }, [tone])

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled
    if (enabled) ensureContext()
  }, [ensureContext])

  const dispose = useCallback(() => {
    void contextRef.current?.close()
    contextRef.current = null
  }, [])

  return { playSuccess, playRejected, setEnabled, dispose }
}