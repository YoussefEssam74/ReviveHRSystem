import { ApiError } from '../../../lib/api-client'
import { loadStoredSession } from '../../../lib/session-store'
import { translate } from '../../../i18n'

/** The export window: last 30 days (default), last 90 days, or year to date. */
export type ReportPeriod = '30d' | '90d' | 'ytd'

/** GET /api/reports/export query (reports.view) — CSV only. */
export interface ReportExportParams {
  period?: ReportPeriod
  gym?: number | string
}

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

function exportError(status: number): ApiError {
  if (status === 401)
    return new ApiError(401, 'UNAUTHORIZED', translate('You are not signed in, or your session has expired.'))
  if (status === 403)
    return new ApiError(403, 'FORBIDDEN', translate('You do not have permission to perform this action.'))
  if (status === 400) return new ApiError(400, 'BAD_REQUEST', translate('That reporting window is not supported.'))
  return new ApiError(status, 'HTTP_' + status, translate('The report could not be exported. Please try again.'))
}

/**
 * GET /api/reports/export — streams the overview as a `text/csv` file the
 * browser saves (`reports-{period}-{yyyy-MM-dd}.csv`). The CSV body cannot
 * travel through `apiRequest` (it parses JSON), so this is the one
 * module-local fetch: same origin + bearer token as lib/api-client, surfaced
 * as an ApiError on failure.
 */
export async function downloadReportsCsv(params: ReportExportParams = {}): Promise<void> {
  const period = params.period ?? '30d'
  const query = new URLSearchParams()
  query.set('period', period)
  query.set('format', 'csv')
  if (params.gym != null && params.gym !== '') query.set('gym', String(params.gym))

  const token = loadStoredSession()?.accessToken
  let response: Response
  try {
    response = await fetch(`${BASE_URL}/api/reports/export?${query.toString()}`, {
      method: 'GET',
      headers: { Accept: 'text/csv', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', translate('Could not reach the server. Check your connection and try again.'))
  }

  if (!response.ok) throw exportError(response.status)

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `reports-${period}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
