import type { components } from '../../types/api/generated'
import type { AttendanceEventType } from './api/attendance.api'

export type { AttendanceEventType }

/** A station's live session, created by redeeming a 6-digit enrollment code. */
export interface ConnectedStation {
  gymId: number
  gymName: string
  /** When the server stops accepting this session (ISO 8601, UTC). */
  sessionExpiresAtUtc: string
}

/** A recorded attendance event as returned by the API (fields are optional in the schema). */
export type AttendanceResult = components['schemas']['AttendanceResponse']

/** Face-match detail attached to a successful face scan. */
export interface FaceMatchDetail {
  similarity: number
  livenessScore: number
}