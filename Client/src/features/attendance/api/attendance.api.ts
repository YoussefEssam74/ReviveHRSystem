import { apiRequest } from '../../../lib/api-client'
import type { components } from '../../../types/api/generated'

export type StationLoginResponse = components['schemas']['StationLoginResponse'] & {
  /** Opaque station session token - also persisted in an HttpOnly cookie by the API. */
  token?: string | null
}
export type AttendanceResponse = components['schemas']['AttendanceResponse']
export type StationCodeResponse = components['schemas']['StationCodeResponse']

/** Direction of a punch. AUTO lets the server decide from the employee's own state. */
export type AttendanceEventType = 'IN' | 'OUT' | 'AUTO'

export interface AttendanceEventBody {
  employeeId: string
  type: AttendanceEventType
  livenessScore: number
}

/** POST /api/kiosk/login - public: redeems a station's 6-digit enrollment code for a gym session. */
export function postStationLogin(code: string, signal?: AbortSignal): Promise<StationLoginResponse> {
  // stationAuth: include cookies (the API stores the session in an HttpOnly cookie)
  // and keep any HR bearer token out of this public-kiosk request.
  return apiRequest<StationLoginResponse>('/api/kiosk/login', { method: 'POST', body: { code }, stationAuth: true, signal })
}

/**
 * POST /api/attendance/events - records a biometric check-in/out event.
 * Authenticated by the station session cookie (X-Station-Token header still
 * accepted); the gym is resolved server-side from that session, never from
 * the request body.
 */
export function postAttendanceEvent(body: AttendanceEventBody, signal?: AbortSignal): Promise<AttendanceResponse> {
  return apiRequest<AttendanceResponse>('/api/attendance/events', { method: 'POST', body, stationAuth: true, signal })
}

export interface FaceScanBody {
  type: AttendanceEventType
  image: string
  /** True only after the employee confirmed "check out now" on the kiosk. */
  confirmCheckout?: boolean
}

/**
 * Every frame-level state of a face scan, returned as a plain 200. The kiosk drives
 * its live HUD from this discriminator - liveness percentage, matched name and ID -
 * instead of string-matching error messages.
 */
export type FaceScanOutcome =
  | 'no_face'
  | 'low_liveness'
  | 'unrecognized'
  | 'already_complete'
  | 'rejected'
  | 'recorded'
  | 'pending_checkout'

export interface FaceScanResponse {
  outcome: FaceScanOutcome
  /** The recorded punch; set only when outcome is 'recorded'. */
  attendance?: AttendanceResponse | null
  /** The scan matched an employee whose AUTO direction resolved to check-out. */
  requiresCheckoutConfirmation?: boolean
  /** Employee number of the matched employee, whenever a face was recognized. */
  employeeId?: string | null
  /** Full name of the matched employee, whenever a face was recognized. */
  employeeName?: string | null
  /** Human-readable detail (rejection reason, liveness hint, ...). */
  message?: string | null
  similarity: number
  /** Anti-spoofing "real face" confidence measured on this frame (0..1). */
  livenessScore: number
}

/** POST /api/attendance/face-scan - Face-ID: detect + liveness + recognition, recorded atomically. */
export function postFaceScan(body: FaceScanBody, signal?: AbortSignal): Promise<FaceScanResponse> {
  return apiRequest<FaceScanResponse>('/api/attendance/face-scan', { method: 'POST', body, stationAuth: true, signal })
}

export interface ManualAttendanceBody {
  employeeId: string
  type: AttendanceEventType
  reason: string
}

/** POST /api/attendance/manual - Face-ID fallback; the reason is audited server-side. */
export function postManualAttendance(body: ManualAttendanceBody, signal?: AbortSignal): Promise<AttendanceResponse> {
  return apiRequest<AttendanceResponse>('/api/attendance/manual', { method: 'POST', body, stationAuth: true, signal })
}

export interface FaceEnrollmentResponse {
  employeeId: number
  employeeNumber: string
  fullName: string
  enrolledAt: string
}

/** POST /api/employees/face/enroll - HR-side face enrollment (authenticated). */
export function postFaceEnrollment(body: { employeeNumber: string; image: string }, signal?: AbortSignal): Promise<FaceEnrollmentResponse> {
  return apiRequest<FaceEnrollmentResponse>('/api/employees/face/enroll', { method: 'POST', body, signal })
}

/** One row of the kiosk dashboard feed. */
export interface StationSummaryRecord {
  recordId?: string | null
  employeeId?: string | null
  employeeName?: string | null
  /** PRESENT, LEFT, or DAY_OFF for this employee today. */
  status?: string | null
  lastEventType?: string | null
  lastEventTime?: string | null
  attendanceStatus?: string | null
  method?: string | null
}

/** Today's counters + recent feed for the station's gym. */
export interface StationSummaryResponse {
  presentCount?: number
  scheduledTodayCount?: number
  records?: StationSummaryRecord[] | null
}

/**
 * GET /api/attendance/station-summary — the kiosk dashboard data (counters + feed).
 * Authenticated by the station session; the gym comes from that session.
 */
export function getStationSummary(signal?: AbortSignal): Promise<StationSummaryResponse> {
  return apiRequest<StationSummaryResponse>('/api/attendance/station-summary', { stationAuth: true, signal })
}

/** Live station session (gym context) as returned by GET /api/kiosk/session. */
export interface StationSessionResponse {
  gymId?: number
  gymName?: string | null
  sessionExpiresAtUtc?: string | null
}

/**
 * GET /api/kiosk/session - restores an enrolled kiosk from its HttpOnly cookie
 * after a page reload or machine reboot; 401 when no live session exists.
 */
export function getStationSession(signal?: AbortSignal): Promise<StationSessionResponse> {
  return apiRequest<StationSessionResponse>('/api/kiosk/session', { stationAuth: true, signal })
}

/** POST /api/kiosk/logout - revokes the station session server-side and clears the cookie. */
export function postStationLogout(signal?: AbortSignal): Promise<void> {
  return apiRequest<void>('/api/kiosk/logout', { method: 'POST', stationAuth: true, signal })
}
/** GET /api/gyms/{gymId}/station-codes - HR/TopManagement: the gym's active enrollment code. */
export function getStationCode(gymId: number, signal?: AbortSignal): Promise<StationCodeResponse> {
  return apiRequest<StationCodeResponse>(`/api/gyms/${gymId}/station-codes`, { signal })
}

/** POST /api/gyms/{gymId}/station-codes - generates a new short-lived code and invalidates the old one. */
export function rotateStationCode(gymId: number, signal?: AbortSignal): Promise<StationCodeResponse> {
  return apiRequest<StationCodeResponse>(`/api/gyms/${gymId}/station-codes`, { method: 'POST', signal })
}

export interface StationSessionsRevokedResponse {
  revokedCount: number
}

/**
 * DELETE /api/gyms/{gymId}/station-sessions - disconnects every enrolled kiosk of
 * the gym so they must redeem a fresh code. Does not touch the enrollment codes.
 */
export function revokeStationSessions(gymId: number, signal?: AbortSignal): Promise<StationSessionsRevokedResponse> {
  return apiRequest<StationSessionsRevokedResponse>(`/api/gyms/${gymId}/station-sessions`, { method: 'DELETE', signal })
}