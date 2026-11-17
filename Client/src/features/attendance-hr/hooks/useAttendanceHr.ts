import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAttendance, putCorrect, type AttendanceParams, type CorrectAttendanceBody } from '../api/attendance-hr.api'

/** Paged HR attendance grid. */
export function useAttendance(params: AttendanceParams) {
  return useQuery({
    queryKey: ['attendance-hr', params],
    queryFn: ({ signal }) => getAttendance(params, signal),
  })
}

/** Correct a stored attendance record (with audit trail). */
export function useCorrectAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CorrectAttendanceBody }) => putCorrect(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-hr'] })
    },
  })
}
