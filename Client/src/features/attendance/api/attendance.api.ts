import { apiRequest } from '../../../lib/api-client'
import type { components } from '../../../types/api/generated'

// TODO: fold into types/api/generated.ts on the next `openapi-typescript` run
// (the generated StationLoginResponse schema predates the token property).
export type StationLoginResponse = components['schemas']['StationLoginResponse'] & {
  /** Gym-bound station JWT — send as the Bearer token on attendance requests. */
  token?: string | null
}
export type AttendanceResponse = components['schemas']['AttendanceResponse']

export interface AttendanceEventBody {
  code: string
  employeeId: string
  type: 'IN' | 'OUT'
  livenessScore: number
}

/** POST /api/kiosk/login — public: validates a station's 6-digit code, returns its gym + station token. */
export function postStationLogin(code: string, signal?: AbortSignal): Promise<StationLoginResponse> {
  return apiRequest<StationLoginResponse>('/api/kiosk/login', { method: 'POST', body: { code }, signal })
}

/**
 * POST /api/attendance/events — records a biometric check-in/out event.
 * Requires the gym-bound station token from kiosk login, not the web session.
 */
export function postAttendanceEvent(body: AttendanceEventBody, stationToken: string, signal?: AbortSignal): Promise<AttendanceResponse> {
  return apiRequest<AttendanceResponse>('/api/attendance/events', { method: 'POST', body, accessToken: stationToken, signal })
}

export interface FaceScanBody {
  code: string
  type: 'IN' | 'OUT'
  image: string
}

export interface FaceScanResponse {
  attendance: AttendanceResponse
  similarity: number
  livenessScore: number
}

/** POST /api/attendance/face-scan — Face-ID: detect + liveness + recognition, recorded atomically. */
export function postFaceScan(body: FaceScanBody, stationToken: string, signal?: AbortSignal): Promise<FaceScanResponse> {
  return apiRequest<FaceScanResponse>('/api/attendance/face-scan', { method: 'POST', body, accessToken: stationToken, signal })
}

// TODO: fold into types/api/generated.ts on the next `openapi-typescript` run.
export interface FaceEnrollmentResponse {
  employeeId: number
  employeeNumber: string
  fullName: string
  enrolledAt: string
}

/** POST /api/employees/face/enroll — HR-side face enrollment (authenticated). */
export function postFaceEnrollment(body: { employeeNumber: string; image: string }, signal?: AbortSignal): Promise<FaceEnrollmentResponse> {
  return apiRequest<FaceEnrollmentResponse>('/api/employees/face/enroll', { method: 'POST', body, signal })
}

export type StationCodeResponse = components['schemas']['StationCodeResponse']

/** GET /api/gyms/{gymId}/station-codes — HR/TopManagement: the gym's active 6-digit code. */
export function getStationCode(gymId: number, signal?: AbortSignal): Promise<StationCodeResponse> {
  return apiRequest<StationCodeResponse>(`/api/gyms/${gymId}/station-codes`, { signal })
}

/** POST /api/gyms/{gymId}/station-codes — generates a new code and invalidates the old one. */
export function rotateStationCode(gymId: number, signal?: AbortSignal): Promise<StationCodeResponse> {
  return apiRequest<StationCodeResponse>(`/api/gyms/${gymId}/station-codes`, { method: 'POST', signal })
}
