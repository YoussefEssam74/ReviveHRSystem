import { clearSession, loadStoredSession, saveSession } from './session-store'
import type { StoredSession } from './session-store'

/**
 * Same-origin by default: the Vite dev proxy forwards /api to the API host.
 * Override with VITE_API_URL when the API is reached cross-origin (then the
 * API host must allow CORS for the SPA origin).
 */
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

const REQUEST_TIMEOUT_MS = 15_000

export interface ApiFieldError {
  field: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: ApiFieldError[]

  constructor(status: number, code: string, message: string, fieldErrors: ApiFieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /**
   * Explicit bearer token that overrides the stored web session (e.g. the
   * gym-bound station token issued by POST /api/kiosk/login). Requests sent
   * with one never touch the session store --- a station 401 must not sign the
   * HR user out.
   */
  accessToken?: string
  /**
   * Opaque station session token (POST /api/kiosk/login) sent in the
   * X-Station-Token header. When present the stored web-session token is NOT
   * attached: a public kiosk browser must never emit an HR user's token.
   */
  stationToken?: string
  /**
   * Cookie-authenticated station request: no bearer token and no header are
   * attached; the browser sends the HttpOnly StationSession cookie automatically
   * (the request includes credentials). Like stationToken, a 401 must never
   * touch the HR user's session.
   */
  stationAuth?: boolean
}

const STATUS_FALLBACK_MESSAGES: Record<number, string> = {
  400: 'The request was invalid. Check the form and try again.',
  401: 'You are not signed in, or your session has expired.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This conflicts with the current state. Refresh and try again.',
  422: 'The request could not be processed.',
  429: 'Too many attempts. Please wait a moment and try again.',
  500: 'The server hit an unexpected error. Please try again.',
}

function fallbackMessage(status: number): string {
  if (STATUS_FALLBACK_MESSAGES[status]) return STATUS_FALLBACK_MESSAGES[status]
  return status >= 500 ? 'The server hit an unexpected error. Please try again.' : 'The request failed.'
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** Parses the backend's ApiErrorResponse (and ProblemDetails as fallback) into an ApiError. */
function toApiError(status: number, body: unknown): ApiError {
  if (typeof body === 'object' && body !== null) {
    const errorBody = body as {
      statusCode?: number
      message?: string
      detail?: string
      title?: string
      error?: string
      errors?: unknown
      errorMessage?: string
      validationErrors?: unknown
    }

    const fieldErrors: ApiFieldError[] = []
    if (Array.isArray(errorBody.errors)) {
      for (const item of errorBody.errors) {
        if (typeof item === 'object' && item !== null) {
          const fieldError = item as { field?: string; message?: string }
          fieldErrors.push({ field: fieldError.field ?? '', message: fieldError.message ?? 'Invalid value.' })
        }
      }
    } else if (typeof errorBody.errors === 'object' && errorBody.errors !== null) {
      // ASP.NET ProblemDetails validation envelope: { errors: { Field: ["msg"] } }
      for (const [field, messages] of Object.entries(errorBody.errors)) {
        const message = Array.isArray(messages) && messages.length > 0 ? String(messages[0]) : 'Invalid value.'
        fieldErrors.push({ field, message })
      }
    } else if (Array.isArray(errorBody.validationErrors)) {
      // Project model-state envelope: { validationErrors: [{ field, errors: string[] }] }
      for (const item of errorBody.validationErrors) {
        if (typeof item === 'object' && item !== null) {
          const entry = item as { field?: string; errors?: unknown }
          const field = entry.field ?? ''
          if (Array.isArray(entry.errors) && entry.errors.length > 0) {
            for (const message of entry.errors) fieldErrors.push({ field, message: String(message) })
          } else {
            fieldErrors.push({ field, message: 'Invalid value.' })
          }
        }
      }
    }

    const message = errorBody.message ?? errorBody.errorMessage ?? errorBody.detail ?? errorBody.title ?? fallbackMessage(status)
    const code =
      errorBody.error ??
      (Array.isArray(errorBody.validationErrors) ? 'VALIDATION_FAILED' : status === 401 ? 'UNAUTHORIZED' : 'HTTP_' + status)
    return new ApiError(status, code, message, fieldErrors)
  }

  return new ApiError(status, 'HTTP_' + status, fallbackMessage(status))
}

/** Human-readable message for any thrown request error. */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

/**
 * True when the API's bearer middleware rejected the token itself (invalid or
 * expired session) — its auth failures always carry the standard bearer
 * challenge. A permission denial (a key gate refusing a live session) is a
 * plain 401 with a ProblemDetails body and no challenge (M4): the user stays
 * signed in and the page surfaces it as an access message.
 */
function isAuthChallenge(response: Response): boolean {
  return response.headers.has('WWW-Authenticate')
}

/**
 * Result of one silent-renewal attempt. The distinction matters: only a server
 * that actually refused the refresh credential may end the session. A timeout, a
 * dropped connection or a 5xx says nothing about the credential, and treating it
 * as a refusal is what signed users out mid-session.
 */
type RefreshOutcome =
  | { kind: 'refreshed'; session: StoredSession }
  | { kind: 'rejected' }
  | { kind: 'unavailable' }

let refreshPromise: Promise<RefreshOutcome> | null = null

/**
 * Origin-wide lock serialising silent refreshes across tabs. Every tab shares
 * `revive.session`, so two tabs that 401 at the same moment would otherwise
 * present the same refresh token: the winner rotates it and the loser is
 * refused (the server's rotation grace answers a spent token with a plain 401,
 * not a chain revocation) — which wiped the shared session and signed every
 * tab out.
 */
const REFRESH_LOCK_NAME = 'revive.session.refresh'

/** Runs `task` under the cross-tab refresh lock (directly where it is unavailable). */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks
  return locks ? (locks.request(REFRESH_LOCK_NAME, task) as Promise<T>) : task()
}

/**
 * One rotation attempt. Storage is re-read on both sides of the request: before
 * it (a sibling tab may have rotated while this one waited for the lock) and
 * after a 401/403 (a sibling may have rotated while this request was in
 * flight). In both cases the sibling's session is adopted — the server refusing
 * an already-rotated token does NOT mean the chain is dead.
 */
async function refreshOnce(initial: StoredSession, controller: AbortController): Promise<RefreshOutcome> {
  let session = initial
  const storedAtLock = loadStoredSession()
  if (storedAtLock) {
    if (storedAtLock.accessToken !== session.accessToken && storedAtLock.expiresAt > Date.now()) {
      return { kind: 'refreshed', session: storedAtLock }
    }
    if (storedAtLock.refreshToken && storedAtLock.refreshToken !== session.refreshToken) session = storedAtLock
  }
  if (!session.refreshToken) return { kind: 'rejected' }

  const response = await fetch(BASE_URL + '/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
    signal: controller.signal,
  })

  if (response.status === 401 || response.status === 403) {
    const storedNow = loadStoredSession()
    if (storedNow && storedNow.accessToken !== session.accessToken && storedNow.expiresAt > Date.now()) {
      return { kind: 'refreshed', session: storedNow }
    }
    // Only now does the auth answer prove the stored refresh credential is dead.
    return { kind: 'rejected' }
  }
  if (!response.ok) return { kind: 'unavailable' }
  const json = (await response.json()) as {
    accessToken?: string
    expiresInSeconds?: number
    refreshExpiresInSeconds?: number
    refreshToken?: string
    user?: StoredSession['user']
  }
  if (!json.accessToken) return { kind: 'unavailable' }
  const next: StoredSession = {
    accessToken: json.accessToken,
    refreshToken: json.refreshToken ?? session.refreshToken,
    expiresAt: Date.now() + (json.expiresInSeconds ?? 3600) * 1000,
    refreshExpiresAt: json.refreshExpiresInSeconds
      ? Date.now() + json.refreshExpiresInSeconds * 1000
      : undefined,
    user: json.user ?? session.user,
  }
  // Another tab may have stored a NEWER session while this request was in
  // flight (a gym switch, a fresh login). Overwriting it would resurrect the
  // scope this refresh was minted for — adopt the newer session instead.
  const storedAfterRefresh = loadStoredSession()
  if (
    storedAfterRefresh &&
    storedAfterRefresh.accessToken !== session.accessToken &&
    storedAfterRefresh.accessToken !== next.accessToken
  ) {
    return { kind: 'refreshed', session: storedAfterRefresh }
  }
  saveSession(next)
  return { kind: 'refreshed', session: next }
}

/**
 * Attempts a single silent refresh; dedupes concurrent callers in this tab.
 *
 * Deliberately NOT bound to any caller's AbortSignal: this refresh mints the
 * session's next credential and is shared by every waiting request, so a
 * navigation that cancels one of them must never cancel the rotation the server
 * is already performing. Discarding that response left storage holding a spent
 * token, and the next refresh was refused — the "signed out after 15–30 min"
 * report this window removes.
 */
async function tryRefreshSession(session: StoredSession): Promise<RefreshOutcome> {
  if (!session.refreshToken) return { kind: 'rejected' }
  if (refreshPromise) return refreshPromise
  // Bound the refresh like every other request: a stalled refresh must settle
  // (releasing the waiters joined on this promise) instead of leaving them and
  // their queued requests pending forever.
  refreshPromise = (async (): Promise<RefreshOutcome> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      return await withRefreshLock(() => refreshOnce(session, controller))
    } catch {
      return { kind: 'unavailable' }
    } finally {
      clearTimeout(timer)
      refreshPromise = null
    }
  })()
  return refreshPromise
}

interface RenewalResult {
  /** Bearer the caller may replay the failed request with. */
  retryToken: string | null
  /** True only when the server refused the refresh credential itself. */
  rejected: boolean
}

/**
 * Renews the bearer behind a request that came back 401. Prefers credentials
 * another tab already rotated — the captured session's refresh token is then
 * stale, and presenting it again trips the server's reuse detection.
 */
async function renewBearer(session: StoredSession): Promise<RenewalResult> {
  const storedNow = loadStoredSession()
  if (storedNow && storedNow.accessToken !== session.accessToken) {
    if (storedNow.expiresAt > Date.now()) return { retryToken: storedNow.accessToken, rejected: false }
    const outcome = await tryRefreshSession(storedNow)
    if (outcome.kind === 'refreshed') return { retryToken: outcome.session.accessToken, rejected: false }
    return { retryToken: null, rejected: outcome.kind === 'rejected' }
  }

  const outcome = await tryRefreshSession(session)
  if (outcome.kind === 'refreshed') return { retryToken: outcome.session.accessToken, rejected: false }
  if (outcome.kind === 'rejected') return { retryToken: null, rejected: true }

  // The refresh reached no verdict (timeout / connection drop): a sibling tab may
  // have finished the rotation meanwhile, so take its bearer when it is newer.
  const storedAfter = loadStoredSession()
  return storedAfter && storedAfter.accessToken !== session.accessToken
    ? { retryToken: storedAfter.accessToken, rejected: false }
    : { retryToken: null, rejected: false }
}

export async function apiRequest<T>(path: string, options: RequestOptions & { form?: FormData } = {}): Promise<T> {
  const { method = 'GET', body, form, signal, accessToken, stationToken, stationAuth } = options
  const session = loadStoredSession()
  // Station requests authenticate with their own header or session cookie; a kiosk
  // browser may also hold a stale web session, which must never be sent from a
  // public terminal.
  const isStationRequest = Boolean(stationToken || stationAuth)
  const bearerToken = isStationRequest ? undefined : accessToken ?? session?.accessToken

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  const onExternalAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  // Multipart: the browser sets the Content-Type with the boundary; JSON gets it
  // explicitly. Only one of the two applies to a request.
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(form === undefined && body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(bearerToken ? { Authorization: 'Bearer ' + bearerToken } : {}),
    ...(stationToken ? { 'X-Station-Token': stationToken } : {}),
  }
  const payload: BodyInit | undefined = form ?? (body === undefined ? undefined : JSON.stringify(body))

  let response: Response
  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers,
      body: payload,
      // Cookie-authenticated station requests must carry the HttpOnly session
      // cookie (and accept Set-Cookie on login) even when the API is on another
      // origin; same-origin requests already behave this way by default.
      ...(isStationRequest ? { credentials: 'include' as const } : {}),
      signal: controller.signal,
    })
  } catch (error) {
    // A caller-initiated cancellation (navigation, unmount) is not an app error.
    if (signal?.aborted) throw error
    if (timedOut) throw new ApiError(0, 'TIMEOUT', 'The request timed out. Please try again.')
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onExternalAbort)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const json: unknown = text ? safeJsonParse(text) : null

  if (!response.ok) {
    // Access-token expired? Try a silent refresh once, then retry the original request.
    let renewalRejected = false
    if (response.status === 401 && !accessToken && !stationToken && !stationAuth
        && session && isAuthChallenge(response)
        && path !== '/api/auth/refresh' && path !== '/api/auth/login' && path !== '/api/auth/login/select-gym') {
      const renewal = await renewBearer(session)
      if (renewal.retryToken) {
        return apiRequest<T>(path, { ...options, accessToken: renewal.retryToken })
      }
      renewalRejected = renewal.rejected
    }

    if (response.status === 401 && !accessToken && !stationToken && !stationAuth
        && session && isAuthChallenge(response) && renewalRejected) {
      // Clear-session discipline: only a refresh the server actually refused ends
      // the session. A 401 challenge may also be refused because another tab
      // replaced the session while this request was in flight (single-live-chain
      // sweep), so the holder whose credential is still the stored one is the only
      // one allowed to clear shared storage — a stale in-flight retry must not
      // evict the newer session; it caused the "randomly bounced to login right
      // after picking a gym" multi-tab report.
      const storedOnChallenge = loadStoredSession()
      if (!storedOnChallenge || storedOnChallenge.accessToken === session.accessToken) clearSession()
    }
    throw toApiError(response.status, json)
  }

  return json as T
}

/**
 * Downloads a binary endpoint (payslip PDF, request attachment) with session auth.
 * Renewal mirrors apiRequest: an expired access token is refreshed and the
 * download replayed, so opening a document after the token aged out never ends
 * the session.
 */
export async function apiDownload(
  path: string,
  signal?: AbortSignal,
  accessToken?: string,
): Promise<{ blob: Blob; fileName: string | null }> {
  const session = loadStoredSession()
  const bearerToken = accessToken ?? session?.accessToken
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 4)
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let response: Response
  try {
    response = await fetch(BASE_URL + path, {
      headers: {
        ...(bearerToken ? { Authorization: 'Bearer ' + bearerToken } : {}),
      },
      signal: controller.signal,
    })
  } catch (error) {
    // A caller-initiated cancellation (navigation, unmount) is not an app error.
    if (signal?.aborted) throw error
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    // Same 401 split as apiRequest (M4): only a bearer-challenge auth failure on an
    // implicit session credential may end the session, and only once the server
    // has actually refused the refresh.
    if (response.status === 401 && !accessToken && isAuthChallenge(response) && session) {
      const renewal = await renewBearer(session)
      if (renewal.retryToken) return apiDownload(path, signal, renewal.retryToken)
      if (renewal.rejected) {
        const storedOnChallenge = loadStoredSession()
        if (!storedOnChallenge || storedOnChallenge.accessToken === session.accessToken) clearSession()
      }
    }
    let message = fallbackMessage(response.status)
    try {
      const text = await response.text()
      const json = text ? safeJsonParse(text) : null
      if (json) message = toApiError(response.status, json).message
    } catch {
      /* body was binary — keep the fallback */
    }
    throw new ApiError(response.status, 'HTTP_' + response.status, message)
  }

  const contentDisposition = response.headers.get('Content-Disposition')
  const fileName = contentDisposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1] ?? null
  return { blob: await response.blob(), fileName }
}
