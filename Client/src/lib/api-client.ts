import { clearSession, loadStoredSession } from './session-store'

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
    // Two different 401s live here: the authentication middleware rejecting an
    // invalid or expired token (bearer challenge) and a key gate refusing a live
    // session (plain 401 — M4). Only the former ends the session; a missing
    // permission keeps the user online and surfaces as an access message. Only
    // session-signed requests may clear: a station token must leave the HR
    // user's session alone.
    if (response.status === 401 && !accessToken && !stationToken && !stationAuth
        && session && isAuthChallenge(response)) clearSession()
    throw toApiError(response.status, json)
  }

  return json as T
}

/** Downloads a binary endpoint (payslip PDF, request attachment) with session auth. */
export async function apiDownload(path: string, signal?: AbortSignal): Promise<{ blob: Blob; fileName: string | null }> {
  const session = loadStoredSession()
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
        ...(session?.accessToken ? { Authorization: 'Bearer ' + session.accessToken } : {}),
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
    // Same 401 split as apiRequest (M4): only a bearer-challenge auth failure
    // signs the user out; a permission-denial 401 keeps the session.
    if (response.status === 401 && isAuthChallenge(response) && session) clearSession()
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
