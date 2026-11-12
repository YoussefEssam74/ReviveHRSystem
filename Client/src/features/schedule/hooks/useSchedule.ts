import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteShiftTemplate,
  getShiftCycle,
  getShiftCycles,
  getShiftTemplates,
  postPublishShiftCycle,
  postShiftCycle,
  postShiftTemplate,
  putShiftTemplate,
  type CreateShiftCycleBody,
  type ShiftTemplateBody,
} from '../api/schedule.api'

/** The gym's shift cycles (chips), newest first. */
export function useShiftCycles(gymId: number | null) {
  return useQuery({
    queryKey: ['schedule', 'cycles', gymId],
    queryFn: ({ signal }) => getShiftCycles(gymId ?? 0, signal),
    enabled: gymId != null,
  })
}

/** One cycle's weekly assignment matrix. */
export function useShiftCycle(cycleId: number | null) {
  return useQuery({
    queryKey: ['schedule', 'cycle', cycleId],
    queryFn: ({ signal }) => getShiftCycle(cycleId ?? 0, signal),
    enabled: cycleId != null,
  })
}

/** The gym's shift templates (legend + management list). */
export function useShiftTemplates(gymId: number | null) {
  return useQuery({
    queryKey: ['schedule', 'templates', gymId],
    queryFn: ({ signal }) => getShiftTemplates(gymId ?? 0, signal),
    enabled: gymId != null,
  })
}

/** Create a Draft cycle. */
export function useCreateShiftCycle(gymId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateShiftCycleBody) => postShiftCycle(gymId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

/** Publish the selected cycle (Draft → Published). */
export function usePublishShiftCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => postPublishShiftCycle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

/** Add a shift template. */
export function useCreateShiftTemplate(gymId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ShiftTemplateBody) => postShiftTemplate(gymId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

/** Rename / re-time a shift template. */
export function useUpdateShiftTemplate(gymId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, body }: { templateId: number; body: ShiftTemplateBody }) =>
      putShiftTemplate(gymId, templateId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

/** Delete a shift template (assigned cells turn into Off days). */
export function useDeleteShiftTemplate(gymId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (templateId: number) => deleteShiftTemplate(gymId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}
