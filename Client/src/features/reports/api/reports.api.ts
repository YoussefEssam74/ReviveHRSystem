import { ApiError, apiRequest } from '../../../lib/api-client'
import { loadStoredSession } from '../../../lib/session-store'

/** The overview window: last 30 days (default), last 90 days, or year to date. */
export type ReportPeriod = '30d' | '90d' | 'ytd'

/** Period selector options shared by the page and the CSV export. */
export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
]

/** A named count for the bar lists (by-status, by-type, by-tenure…). */
export interface ReportBucket {
  label: string
  value: number
}

/** Headcount card + status breakdown + tenure distribution. */
export interface ReportWorkforce {
  totalEmployees: number
  active: number
  onLeave: number
  noticePeriod: number
  suspended: number
  terminated: number
  newHiresInPeriod: number
  byStatus: ReportBucket[]
  byTenure: ReportBucket[]
  avgTenureMonths: number
}

/** Attendance card: counts and on-time rate within the period. */
export interface ReportAttendance {
  recordsInPeriod: number
  onTime: number
  late: number
  absent: number
  missingCheckout: number
  onTimeRate: number
}

/** Requests card: counts by status and by type within the period. */
export interface ReportRequests {
  requestsInPeriod: number
  approved: number
  rejected: number
  pending: number
  approvalRate: number
  byType: ReportBucket[]
}

/** Recruiting card: pipeline funnel + open vacancies. */
export interface ReportRecruiting {
  applicationsInPipeline: number
  hiredInPeriod: number
  openVacancies: number
  openSlots: number
}

/** Payroll card: totals across the scoped entries. */
export interface ReportPayroll {
  entries: number
  totalNetPay: number
}

/** Offboarding card: separations within the period. */
export interface ReportOffboarding {
  separationsInPeriod: number
  openChecklists: number
}

/** GET /api/reports/overview payload (reports.view). */
export interface ReportsOverview {
  /** Resolved period label ("Last 30 days"). */
  period: string
  workforce: ReportWorkforce
  attendance: ReportAttendance
  requests: ReportRequests
  recruiting: ReportRecruiting
  payroll: ReportPayroll
  offboarding: ReportOffboarding
}

export interface ReportsOverviewParams {
  /** 30d (default) | 90d | ytd — anything else is a 400 server-side. */
  period?: ReportPeriod
  /** Gym id or branch name; blank = the actor's full scope. */
  gym?: number | string
}

/** GET /api/reports/overview — metric cards aggregated within the actor's gym scope. */
export function getReportsOverview(
  params: ReportsOverviewParams = {},
  signal?: AbortSignal,
): Promise<ReportsOverview> {
  const query = new URLSearchParams()
  if (params.period) query.set('period', params.period)
  if (params.gym != null && params.gym !== '') query.set('gym', String(params.gym))
  const qs = query.toString()
  return apiRequest<ReportsOverview>(`/api/reports/overview${qs ? '?' + qs : ''}`, { signal })
}

/** GET /api/reports/export query (reports.view) — CSV only. */
export interface ReportExportParams {
  period?: ReportPeriod
  gym?: number | string
}

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

function exportError(status: number): ApiError {
  if (status === 401) return new ApiError(401, 'UNAUTHORIZED', 'You are not signed in, or your session has expired.')
  if (status === 403) return new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.')
  if (status === 400) return new ApiError(400, 'BAD_REQUEST', 'That reporting window is not supported.')
  return new ApiError(status, 'HTTP_' + status, 'The report could not be exported. Please try again.')
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
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.')
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
