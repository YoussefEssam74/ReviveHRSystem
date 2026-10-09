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
   * with one never touch the session store — a station 401 must not sign the
   * HR user out.
   */
  accessToken?: string
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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, accessToken } = options
  const session = loadStoredSession()
  const bearerToken = accessToken ?? session?.accessToken

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

  let response: Response
  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(bearerToken ? { Authorization: 'Bearer ' + bearerToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
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
    // The API issues short-lived access tokens with no refresh endpoint, so a
    // 401 always means the session is over — clear it and let the UI react.
    // Only session-signed requests are allowed to do that: an expired or
    // rotated station token must leave the HR user's session alone.
    if (response.status === 401 && !accessToken && session) clearSession()
    throw toApiError(response.status, json)
  }

  return json as T
}
