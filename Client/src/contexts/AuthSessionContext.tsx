import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearSession, loadStoredSession, saveSession, SESSION_CHANGED_EVENT, type StoredSession } from '../lib/session-store'

interface AuthSessionContextValue {
  session: StoredSession | null
  signIn: (session: StoredSession) => void
  signOut: () => void
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => loadStoredSession())

  // The API client clears storage on 401 from anywhere (including other tabs);
  // listening here keeps the in-memory session in sync with storage.
  useEffect(() => {
    const sync = () => setSession(loadStoredSession())
    window.addEventListener(SESSION_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const signIn = useCallback((next: StoredSession) => {
    saveSession(next)
    setSession(next)
  }, [])

  const signOut = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const value = useMemo<AuthSessionContextValue>(() => ({ session, signIn, signOut }), [session, signIn, signOut])

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext)
  if (!context) throw new Error('useAuthSession must be used within AuthSessionProvider')
  return context
}
