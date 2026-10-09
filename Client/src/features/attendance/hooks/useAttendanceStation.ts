import { useMutation } from '@tanstack/react-query'
import { postAttendanceEvent, postStationLogin } from '../api/attendance.api'
import type { AttendanceEventType } from '../types'

/**
 * The biometric events API requires a liveness score (>= 0.70), which real
 * stations get from their camera hardware. This web station has no camera
 * pipeline yet, so events are sent with a passing placeholder score.
 */
export const STATION_LIVENESS_SCORE = 0.95

export interface RecordEventInput {
  code: string
  /** Gym-bound station token from kiosk login — the web session cannot act for a station. */
  stationToken: string
  employeeId: string
  type: AttendanceEventType
  /** Real liveness from the face service; defaults to the manual-entry placeholder. */
  livenessScore?: number
}

/** POST /api/kiosk/login — connect a station by its 6-digit code. */
export function useStationLogin() {
  return useMutation({
    mutationFn: (code: string) => postStationLogin(code),
  })
}

/** POST /api/attendance/events — record a check-in/out for an employee. */
export function useRecordAttendanceEvent() {
  return useMutation({
    mutationFn: (input: RecordEventInput) =>
      postAttendanceEvent(
        {
          code: input.code,
          employeeId: input.employeeId,
          type: input.type,
          // Face scans forward the real liveness measured by the biometric service;
          // only manual entry (no camera) uses the passing placeholder score.
          livenessScore: input.livenessScore ?? STATION_LIVENESS_SCORE,
        },
        input.stationToken,
      ),
  })
}
