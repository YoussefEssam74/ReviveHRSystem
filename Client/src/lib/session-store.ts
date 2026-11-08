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
  /** Gym the token is scoped to, when the login produced a single-gym session. */
  gymId?: number | null
  /** Every gym this user may manage (HR/TopManagement) — drives the station-code picker. */
  gymAccess?: SessionGymOption[]
}

export interface StoredSession {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  /**
   * When the refresh credential itself expires (epoch ms, when known). The
   * session survives an expired ACCESS token until this passes so the client
   * can still silently refresh after a reload or inactivity.
   */
  refreshExpiresAt?: number
  user: SessionUser
}

const STORAGE_KEY = 'revive.session'

/**
 * Schema version of the persisted session. Bump whenever the StoredSession
 * shape or its auth contract changes in a way that must NOT be interpreted by
 * an older client bundle (e.g. refresh-token rotation on gym switches). A
 * version mismatch from a previous deployment forces one transparent re-login
 * instead of resuming a session the current code can no longer reason about.
 */
const SESSION_SCHEMA_VERSION = 2

/** Fired (on window) whenever the persisted session changes, from any source. */
export const SESSION_CHANGED_EVENT = 'revive:session-changed'

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false
  const session = value as StoredSession & { version?: number }
  return session.version === SESSION_SCHEMA_VERSION
    && typeof session.accessToken === 'string' && typeof session.expiresAt === 'number' && typeof session.user === 'object'
    && (session.refreshExpiresAt === undefined || typeof session.refreshExpiresAt === 'number')
}

export function loadStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredSession(parsed)) {
      // Old-schema blob (previous deployment): discard it so the next sign-in
      // persists a session the current code fully understands.
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (parsed.expiresAt > Date.now()) return parsed
    // An expired access token is not the end of the session while the refresh
    // credential is still alive — the 401 refresh flow needs it to renew the
    // session silently after a reload or inactivity.
    const refreshAlive =
      typeof parsed.refreshToken === 'string' && parsed.refreshToken !== '' &&
      (parsed.refreshExpiresAt === undefined || parsed.refreshExpiresAt > Date.now())
    if (!refreshAlive) window.localStorage.removeItem(STORAGE_KEY)
    return refreshAlive ? parsed : null
  } catch {
    return null
  }
}

export function saveSession(session: StoredSession) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SESSION_SCHEMA_VERSION, ...session }))
  } catch {
    // Storage may be unavailable (private mode); the in-memory session still works.
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
