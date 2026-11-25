export interface SessionGymOption {
  gymId: number
  gymName: string
}

export interface SessionUser {
  id: number
  email: string
  userName: string
  userType: string
  gymName: string | null
  gymId?: number | null
  gymAccess?: SessionGymOption[]
}

/** Non-secret UI snapshot. Authentication credentials stay in HttpOnly cookies. */
export interface StoredSession {
  sessionKey: string
  /** Access-token expiry; the cookie refreshes through /api/auth/refresh after this. */
  expiresAt: number
  /** Refresh-cookie expiry, used only to decide whether the cached UI session is stale. */
  sessionExpiresAt: number
  user: SessionUser
}

const STORAGE_KEY = 'revive.session'
const SESSION_SCHEMA_VERSION = 3

export const SESSION_CHANGED_EVENT = 'revive:session-changed'

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false
  const session = value as StoredSession & { version?: number }
  return session.version === SESSION_SCHEMA_VERSION
    && typeof session.sessionKey === 'string'
    && typeof session.expiresAt === 'number'
    && typeof session.sessionExpiresAt === 'number'
    && typeof session.user === 'object'
}

export function loadStoredSession(): StoredSession | null {
  try {
    // Earlier bundles parked bearer credentials in these workspace keys. Remove
    // those legacy snapshots even when the primary session key is already empty.
    for (const key of ['revive.console-session', 'revive.console-workspace-session']) {
      const legacy = window.localStorage.getItem(key)
      if (legacy && /"(?:accessToken|refreshToken)"\s*:/.test(legacy)) window.localStorage.removeItem(key)
    }
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredSession(parsed)) {
      // Remove old schemas, which included browser-readable access/refresh tokens.
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem('revive.console-session')
      window.localStorage.removeItem('revive.console-workspace-session')
      return null
    }
    if (parsed.sessionExpiresAt > Date.now()) return parsed
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  } catch {
    return null
  }
}

export function saveSession(session: StoredSession) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SESSION_SCHEMA_VERSION, ...session }))
  } catch {
    // Storage may be unavailable; the current tab can still keep its UI session in memory.
  }
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}

export function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures; the event still resets in-memory state.
  }
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}
