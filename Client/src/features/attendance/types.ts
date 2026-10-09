export type AttendanceEventType = 'IN' | 'OUT'

export interface ConnectedStation {
  code: string
  gymId: number
  gymName: string
  /** Gym-bound station JWT from kiosk login — required on every attendance request. */
  token: string
}
