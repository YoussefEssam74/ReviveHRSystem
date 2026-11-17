import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/** What a console page publishes into the app header while it is open. */
export interface ConsoleHeaderInfo {
  /** Turns the header leading button into a back control. */
  onBack: () => void
  /** Who/what the page is currently working on ("Karim Hassan - Fitness Trainer"). */
  label: string
  /** Secondary line ("November 2026 - 7 actions needed"). */
  hint?: string
}

const SetInfoContext = createContext<(info: ConsoleHeaderInfo | null) => void>(() => {})
const InfoContext = createContext<ConsoleHeaderInfo | null>(null)

/**
 * Lets a console page drive the header: the leading button becomes "back" and the
 * header names the record being worked on, so the page needs no toolbar of its own.
 */
export function ConsoleHeaderSlotProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<ConsoleHeaderInfo | null>(null)
  return (
    <SetInfoContext.Provider value={setInfo}>
      <InfoContext.Provider value={info}>{children}</InfoContext.Provider>
    </SetInfoContext.Provider>
  )
}

/** Publishes the header info while the calling page is mounted (null clears it). */
export function useConsoleHeaderInfo(info: ConsoleHeaderInfo | null) {
  const setInfo = useContext(SetInfoContext)
  useEffect(() => {
    setInfo(info)
    return () => setInfo(null)
  }, [setInfo, info])
}

export function useConsoleHeaderInfoValue(): ConsoleHeaderInfo | null {
  return useContext(InfoContext)
}