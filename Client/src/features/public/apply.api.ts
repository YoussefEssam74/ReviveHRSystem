import { ApiError, apiRequest } from '../../lib/api-client'
import { translate as t } from '../../i18n'
import type { FormQuestion } from '../evaluations/api/evaluations.api'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

/** The public hiring form (GET /api/hiring-forms/{id} — anonymous, Open forms only). */
export interface HiringForm {
  id: number
  name: string
  position: string | null
  /** Public job description written by HR; null when the form has none. */
  description?: string | null
  gym: string
  status: string
  questionList: FormQuestion[]
  questions: number
  createdDate?: string
  lastUsed?: string | null
  applicants?: number
}

/** One card in the public careers catalogue (same shape as the form detail). */
export type HiringFormListItem = HiringForm

/** GET /api/hiring-forms public envelope. */
export interface HiringFormList {
  items: HiringFormListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** One answer in the public submission (string, or `name|dataUrl` for a document). */
export interface PublicAnswer {
  question: string
  type: string
  answer: string | null
}

/** POST /api/applications body — the public careers submission. */
export interface SubmitApplicationBody {
  formId: number
  name: string
  email: string
  phone?: string
  gym?: string
  position?: string
  source?: string
  answers: PublicAnswer[]
}

export function getPublicHiringForm(id: number, signal?: AbortSignal): Promise<HiringForm> {
  return publicGet<{ data: HiringForm }>(`/api/hiring-forms/${id}`, signal).then((r) => r.data)
}

/** The careers catalogue: every Open form across all branches. */
export function getPublicHiringForms(
  params: { gym?: string; position?: string; signal?: AbortSignal } = {},
): Promise<HiringFormList> {
  const query = new URLSearchParams({ pageSize: '100' })
  if (params.gym) query.set('gym', params.gym)
  if (params.position) query.set('position', params.position)
  return publicGet<HiringFormList>(`/api/hiring-forms?${query.toString()}`, params.signal)
}

export function submitApplication(body: SubmitApplicationBody): Promise<unknown> {
  return apiRequest<unknown>('/api/applications', { method: 'POST', body })
}

/** Shapes an error body the way the API envelopes it (or ProblemDetails). */
function toPublicError(status: number, body: unknown): ApiError {
  const envelope = (body ?? {}) as {
    message?: string
    errorMessage?: string
    detail?: string
    title?: string
    error?: string
  }
  const message = envelope.message ?? envelope.errorMessage ?? envelope.detail ?? envelope.title
  return new ApiError(status, envelope.error ?? `HTTP_${status}`, message ?? t('The request failed.'))
}

/**
 * Anonymous read for the careers pages. Cookies are deliberately omitted: a
 * visitor who happens to be signed in (HR previewing the public link, or an
 * employee) must still get the public answer — the Open-forms catalogue,
 * unscoped by gym — instead of a gym-scoped list or a 401 raised by the
 * `evaluations.view` gate on the authenticated branch of the endpoint.
 */
async function publicGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE_URL + path, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(0, 'NETWORK_ERROR', t('Could not reach the server. Check your connection and try again.'))
  }

  const text = await response.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }

  if (!response.ok) throw toPublicError(response.status, json)
  return json as T
}
