import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clearSession, loadStoredSession, saveSession, SESSION_CHANGED_EVENT, type StoredSession } from '../lib/session-store'

interface AuthSessionContextValue {
  session: StoredSession | null
  signIn: (session: StoredSession) => void
  signOut: () => void
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => loadStoredSession())
  const queryClient = useQueryClient()

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
    // The portal cache is per account + per gym (roles, dashboard, inbox…).
    // A previous login's fresh entries would otherwise be served to the new
    // account (BM/TL sections computed from stale "me" data) — drop them all.
    queryClient.removeQueries({ queryKey: ['portal'] })
  }, [queryClient])

  const signOut = useCallback(() => {
    // Capture the credentials BEFORE clearing the session, so the best-effort
    // revocation call doesn't depend on a store it just emptied.
    const refreshToken = session?.refreshToken
    const accessToken = session?.accessToken ?? null
    const accessUsable = Boolean(session && session.expiresAt > Date.now())
    if (refreshToken) {
      // Best-effort server-side revocation; don't block the UI on it. Logout is
      // an authenticated endpoint: with an expired access token the bearer can't
      // carry the call, so the auth contract's alternative is the refresh flow —
      // mint a fresh bearer first, then revoke through it. When the refresh
      // credential is also spent there is nothing left to revoke client-side;
      // the record simply expires server-side on its own.
      void import('../features/auth/api/auth.api').then(async ({ postLogout, postRefresh }) => {
        try {
          let token = accessUsable ? accessToken : null
          if (!token) {
            const refreshed = await postRefresh(refreshToken)
            token = refreshed.accessToken ?? null
          }
          if (token) await postLogout(refreshToken, token)
        } catch {
          // Revocation succeeded nowhere (credentials already dead) — clear locally anyway.
        }
      })
    }
    clearSession()
    setSession(null)
    queryClient.removeQueries({ queryKey: ['portal'] })
  }, [session, queryClient])

  const value = useMemo<AuthSessionContextValue>(() => ({ session, signIn, signOut }), [session, signIn, signOut])

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext)
  if (!context) throw new Error('useAuthSession must be used within AuthSessionProvider')
  return context
}
